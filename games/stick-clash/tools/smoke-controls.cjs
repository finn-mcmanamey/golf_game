// Smoke tests for v4 controls (90-input schemes + key layout, 91-touch table mode, 94-controls-card). Called by
// tools/smoke.cjs; also runs on its own (`node tools/smoke-controls.cjs`, after `node build.mjs`).
// - a fresh save starts on Simple, an existing one on Advanced; Simple ignores grab / throwable / skill 2 / taunt (and
//   carries one skill, no throwables), blocks by holding back from an attacking foe, its skill key fires a full super;
// - Compact 2P: both players' keys at once (keyboard.down for both), "/" and "." never reach the browser, P2's skill 2
//   on "," (works, and the card rows and Controls screen show it);
// - key strips at match start, faded after a few seconds of play, back when idle; renamed for a new match's players,
//   none in a CPU-only Watch; Simple players catch Jungle Temple vines by touch, Training's hint drops "3" for them;
// - the controls card: once per session, the right device sections, closed by a key / tap, also from the pause menu;
// - table mode at 1194x834 and 1366x1024: two sets, P2's turned 180°, CDP multitouch per half, clear of the HUD; a stray
//   key or pad press keeps both sets; switching it off frees the lobby's second touch seat; never on a phone (844x390).
// Screenshots: tmp/smoke/keystrip-*.png, card-*.png, table-*.png.
const path = require('path');
const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'dist', 'stick-clash.html');
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ipad = (w, h) => ({ viewport: { width: w, height: h }, screen: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: IPAD_UA });
const NO_WEBDRIVER = () => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });   // the card opens as for a player
const CALM = () => { for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; f.inp.mx = 0; f.inp.attackHeld = false; } };
const wait = ms => new Promise(r => setTimeout(r, ms));

async function open(browser, ctxOpts, init) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, ctxOpts));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  for (const fn of [].concat(init || [])) await page.addInitScript(fn);
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto(URL);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  const cdp = ctxOpts && ctxOpts.hasTouch ? await ctx.newCDPSession(page) : null;
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const sc = () => page.evaluate(() => SC.errors.map(e => e.msg));
  return { ctx, page, errors, touch, sc };
}
// A fight on the flat Dojo with the round's start freeze skipped and any CPU standing still.
const fight = (page, cfg) => page.evaluate(c => { ROTATE_SKIPPED = true; SC.start(Object.assign({ map: 'dojo' }, c)); SC.G.lock = 0;
  for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; } }, cfg);
const place = (page, xs) => page.evaluate(xs => xs.forEach((x, i) => moveFighter(SC.F[i], x - SC.F[i].P[2].x, 0)), xs);

// ---------- Simple scheme on the keyboard ----------
async function testSimple(browser) {
  const r = {};
  const old = await open(browser, null, () => localStorage.setItem('stickclash.v2.settings', '{"rounds":3}'));
  r.existingAdvanced = await old.page.evaluate(() => CTL.schemes.every(s => s === 'advanced') && JSON.parse(localStorage.getItem('stickclash.v2.controls')).schemes[0] === 'advanced');
  await old.ctx.close();
  const { ctx, page, errors, sc } = await open(browser);
  r.freshSimple = await page.evaluate(() => CTL.schemes.every(s => s === 'simple') && JSON.parse(localStorage.getItem('stickclash.v2.controls')).schemes[0] === 'simple');
  await fight(page, { mode: 'versus', weapons: ['katana', 'blade'], skills: [['blink', 'slam'], ['none', 'none']], throws: [['grenade', 'mine'], ['none', 'none']] });
  await place(page, [400, 800]);
  await wait(250);
  r.oneSkill = await page.evaluate(() => { const f = SC.F[0]; return f.skills[0] === 'blink' && f.skills[1] === null && f.throwN.join() === '0,0' && keyHint(0, 'skill2') === ''; });
  // Grab (C), throwable (R), skill 2 (E) and taunt (T) do nothing for a Simple P1...
  await page.evaluate(() => { window.__ev = { taunt: 0, grab: 0, atk: 0 }; on('taunt', () => __ev.taunt++); on('attack', f => { if (f === SC.F[0]) __ev.atk++; }); });
  for (const k of ['KeyC', 'KeyR', 'KeyE', 'KeyT']) { await page.keyboard.press(k); await wait(60); }
  r.offIgnored = await page.evaluate(() => { const f = SC.F[0]; return f.grabCd === 0 && f.stats.thrown === 0 && f.stats.skills === 0 && __ev.taunt === 0; });
  // ...and the same grab key works once P1 is on Advanced.
  await page.evaluate(() => setScheme(0, 'advanced'));
  await page.keyboard.press('KeyC'); await wait(60);
  r.advancedGrabs = await page.evaluate(() => SC.F[0].grabCd > 0);
  await page.evaluate(() => setScheme(0, 'simple'));
  // The skill key (Q) fires the super while the meter is full; the HUD names that key.
  await wait(1300);
  await page.evaluate(() => { SC.F[0].super = 100; });
  r.hint = await page.evaluate(() => [keyHint(0, 'super'), keyHint(0, 'skill1')].join(' '));
  await page.keyboard.press('KeyQ'); await wait(100);
  r.superFromSkill = await page.evaluate(() => SC.F[0].stats.ults === 1 && SC.F[0].stats.skills === 0);
  await wait(1200);                                   // let the ultimate finish
  // Hold back (A) from a foe attacking on the right: the guard goes up; with no attack it stays down.
  await place(page, [500, 640]);
  await wait(300);
  await page.keyboard.down('KeyA');
  r.guardBefore = await page.evaluate(() => SC.F[0].blocking);
  const up = await page.evaluate(async () => { let up = false; for (let k = 0; k < 8 && !up; k++) { attack(SC.F[1]); await new Promise(r => setTimeout(r, 60)); up = SC.F[0].blocking; } return up; });
  // Attack while guarding: the guard drops and P1 swings (no grab).
  const swung = await page.evaluate(async () => { const a0 = __ev.atk; SC.F[0].atkCd = 0; pressAction(0, 'attack'); await new Promise(r => setTimeout(r, 120)); return __ev.atk > a0 && SC.F[0].grabCd === 0; });
  await wait(700);
  const after = await page.evaluate(() => SC.F[0].blocking);
  await page.keyboard.up('KeyA');
  r.autoBlock = !r.guardBefore && up && !after;
  r.attackNotGrab = swung;
  // On a pad: RT (grab), LB (throwable) and d-pad up (taunt) do nothing; B (the skill) fires the full super.
  r.pad = await page.evaluate(async () => {
    const pad = { index: 0, id: 'Mock pad', connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
    navigator.getGamepads = () => [pad];
    const f = SC.F[0], tap = async i => { pad.buttons[i].pressed = true; await new Promise(r => setTimeout(r, 80)); pad.buttons[i].pressed = false; await new Promise(r => setTimeout(r, 80)); };
    await new Promise(r => setTimeout(r, 100));
    const u0 = f.stats.ults, t0 = __ev.taunt;
    for (const i of [7, 4, 12]) await tap(i);
    const off = f.grabCd === 0 && f.stats.thrown === 0 && __ev.taunt === t0;
    f.super = 100; await tap(1);
    navigator.getGamepads = () => [];
    return off && f.stats.ults === u0 + 1;
  });
  await wait(1200);
  // Trials keep every move: a Simple P1 keeps the Grenadier challenge's throwables (it is built on them).
  r.trial = await page.evaluate(async () => {
    SC.quest.start('challenge', 'grenadier', { autopilot: false }); SC.G.lock = 0;
    await new Promise(res => setTimeout(res, 250));
    const f = SC.F.find(x => x.ctrl === 'human');
    return CTL.schemes[0] === 'simple' && schemeOf(0) === 'advanced' && f.throwN.some(n => n > 0);
  });
  // A CPU fighter is never touched by a scheme.
  r.cpuKeeps = await page.evaluate(() => { SC.start({ mode: 'watch', map: 'dojo', skills: [['blink', 'slam'], ['slam', 'blink']] }); return SC.F.every(f => f.skills[1]); });
  await wait(200);
  r.cpuKeeps = r.cpuKeeps && await page.evaluate(() => SC.F.every(f => f.skills[1]));
  // Simple has no grab key: touching a Jungle Temple vine in mid-air catches it. Training hides "3" (skill 2) for Simple.
  r.vine = await page.evaluate(() => {
    SC.start({ mode: 'versus', map: 'jungle', weather: 'clear', weapons: ['katana', 'katana'], killcam: false }); SC.G.lock = 0;
    const f = SC.F[0], foe = SC.F[1], tip = jungleTip(jungleVines(MAP)[0]); foe.ai.behave = 'idle'; foe.ai.t = 1e9;
    moveFighter(f, tip.x - 30 - f.P[1].x, tip.y + 10 - f.P[1].y); for (const p of f.P) { p.ox = p.x; p.oy = p.y; }
    let caught = false; for (let k = 0; k < 20 && !caught; k++) { SC.sim(1 / 120); caught = !!f.mem.vine; }
    return caught;
  });
  r.trainHint = await page.evaluate(() => {
    const said = [], keep = window.modeText; window.modeText = (c, t, ...a) => { said.push(t); return keep(c, t, ...a); };
    SC.start({ mode: 'training', map: 'dojo' }); SC.render(1 / 60); setScheme(0, 'advanced'); SC.render(1 / 60); setScheme(0, 'simple');
    window.modeText = keep; return said.filter(t => /dummy weapon/.test(t)).map(t => t.split(' · ')[1]).join();
  });
  r.errors = [...errors, ...await sc()];
  await ctx.close();
  return r;
}

// ---------- Compact 2P: both players at once ----------
async function testCompact(browser) {
  const { ctx, page, errors, sc } = await open(browser);
  const r = {};
  await page.evaluate(() => { setKeyLayout('compact'); window.__prevented = []; addEventListener('keydown', e => __prevented.push(e.code + ':' + e.defaultPrevented)); });
  await page.keyboard.press('Slash'); await page.keyboard.press('Period');   // on the title screen: no quick find either
  r.menuKeys = await page.evaluate(() => __prevented.join());
  await fight(page, { mode: 'pvp', weapons: ['katana', 'katana'] });
  await place(page, [400, 880]);
  await wait(300);
  const x0 = await page.evaluate(() => SC.F.map(f => f.P[2].x));
  await page.keyboard.down('KeyD'); await page.keyboard.down('ArrowLeft');
  await wait(450);
  r.both = await page.evaluate(() => SC.F.map(f => f.inp.mx).join());
  await page.keyboard.up('KeyD'); await page.keyboard.up('ArrowLeft');
  const x1 = await page.evaluate(() => SC.F.map(f => f.P[2].x));
  r.moved = x1[0] - x0[0] > 40 && x0[1] - x1[1] > 40;
  await page.keyboard.down('KeyS'); await page.keyboard.down('ArrowDown');
  await wait(150);
  r.blocks = await page.evaluate(() => SC.F.map(f => f.blocking).join());
  await page.keyboard.up('KeyS'); await page.keyboard.up('ArrowDown');
  await wait(400);
  await page.evaluate(() => { window.__atk = [0, 0]; on('attack', f => { if (f.ctrl === 'human') __atk[f.slot]++; }); window.__j = SC.F.map(f => f.stats.jumps); });
  await page.keyboard.down('KeyF'); await page.keyboard.down('Period'); await wait(80); await page.keyboard.up('KeyF'); await page.keyboard.up('Period');
  await page.keyboard.down('KeyW'); await page.keyboard.down('ArrowUp'); await wait(120); await page.keyboard.up('KeyW'); await page.keyboard.up('ArrowUp');
  r.attacks = await page.evaluate(() => __atk.join());
  r.jumps = await page.evaluate(() => SC.F.map((f, i) => f.stats.jumps > __j[i]).join());
  // An Advanced P2 has skill 2 on Comma (its old block key): it works, and the card, strips and Controls screen show it.
  await page.evaluate(() => { setScheme(1, 'advanced'); const f = SC.F[1]; f.skills = ['frenzy', 'frenzy']; f.skillCd = [0, 0]; window.__sk = f.stats.skills; });
  await page.keyboard.press('Comma'); await wait(100);
  r.skill2 = await page.evaluate(() => { const f = SC.F[1], out = { key: keySets()[1].skill2, used: f.stats.skills > __sk && f.skillCd[1] > 0,
    rows: ctlKeyRows(1, 'advanced').some(([k, l]) => k.join() === ',' && l === 'skill 2') }; setScheme(1, 'simple'); return out; });
  await wait(900);
  await page.evaluate(() => { for (const f of SC.F) f.super = 100; });
  await page.keyboard.down('KeyG'); await page.keyboard.down('Slash'); await wait(80); await page.keyboard.up('KeyG'); await page.keyboard.up('Slash');
  await wait(80);
  r.supers = await page.evaluate(() => SC.F.map(f => f.stats.ults).join());
  r.inFight = await page.evaluate(() => __prevented.filter(s => /^(Slash|Period|KeyG|KeyF)/.test(s)).every(s => s.endsWith(':true')));
  r.hints = await page.evaluate(() => [0, 1].map(i => ['left', 'attack', 'block'].map(a => keyHint(i, a)).join('')).join(' '));
  r.skill2.screen = await page.evaluate(() => { toMenu(); openScreen('controls', 'menu'); const b = document.querySelector('#controls [data-key="bind-1-skill2"]');
    return b && b.textContent + (b.disabled ? ' fixed' : ''); });
  r.errors = [...errors, ...await sc()];
  await ctx.close();
  return r;
}

// ---------- dash off Shift (v4.1.1) ----------
// Windows opens Sticky Keys after five Shift presses, so dash is Space (P1) and Enter (P2), and P2's super moved to
// backslash. Real key presses drive them; saved binds with the old defaults move once; a player's own key stays.
async function testDashKeys(browser) {
  const { ctx, page, errors, sc } = await open(browser);
  const r = {};
  await page.evaluate(() => setKeyLayout('standard'));
  await fight(page, { mode: 'pvp', weapons: ['katana', 'katana'] });
  await place(page, [400, 880]);
  await wait(400);
  await page.evaluate(() => { window.__d = SC.F.map(f => f.stats.dashes); setScheme(1, 'advanced'); for (const f of SC.F) f.super = 100; window.__u = SC.F[1].stats.ults; });
  await page.keyboard.press('Space'); await page.keyboard.press('Enter'); await wait(150);
  r.dashes = await page.evaluate(() => SC.F.map((f, i) => f.stats.dashes > __d[i]).join());
  await page.keyboard.press('Backslash'); await wait(150);
  r.p2super = await page.evaluate(() => SC.F[1].stats.ults > __u);
  r.keys = await page.evaluate(() => [BINDS[0].dash, BINDS[1].dash, BINDS[1].super].join());
  // An older save (written from a second document: file:// can lose a first document's storage on reload).
  const reloadWith = async kind => {
    await page.goto(URL); await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
    await page.evaluate(k => {
      const D = DEFAULT_BINDS, b = k === 'old' ? [Object.assign({}, D[0], { dash: 'ShiftLeft' }), Object.assign({}, D[1], { dash: 'ShiftRight', super: 'Enter' })]
        : [Object.assign({}, D[0], { dash: 'KeyV' }), D[1]];
      store.set('binds', b); store.set('bindsV', 0);
    }, kind);
    await page.reload(); await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
    return page.evaluate(() => ({ keys: [BINDS[0].dash, BINDS[1].dash, BINDS[1].super].join(), v: store.get('bindsV', 0) }));
  };
  r.migrated = await reloadWith('old');
  r.own = await reloadWith('own');
  r.errors = [...errors, ...await sc()];
  await ctx.close();
  return r;
}

// ---------- key strips ----------
async function testStrips(browser, SHOTS) {
  const { ctx, page, errors, sc } = await open(browser);
  const strips = () => page.evaluate(() => [...document.querySelectorAll('.kstrip')].map(s => ({ on: s.classList.contains('on'), side: s.className.includes('kstrip-l') ? 'l' : 'r',
    op: +getComputedStyle(s).opacity, text: s.textContent })));
  await fight(page, { mode: 'pvp', weapons: ['katana', 'katana'] });
  await place(page, [420, 860]);
  await wait(700);
  const start = await strips();
  await page.screenshot({ path: path.join(SHOTS, 'keystrip-start.png') });
  await page.keyboard.down('KeyD');                    // P1 plays; P2 stays idle
  for (let k = 0; k < 7; k++) { await wait(500); await page.keyboard.press('KeyW'); }
  await page.keyboard.up('KeyD');
  await wait(800);
  const played = await strips();
  await page.screenshot({ path: path.join(SHOTS, 'keystrip-played.png') });
  await wait(5200);                                    // idle again: P1's strip comes back
  const idle = await strips();
  await page.evaluate(() => { SETTINGS.keyStrips = false; });
  await wait(400);
  const off = await strips();
  await page.evaluate(() => { SETTINGS.keyStrips = true; });
  // A new match with the same colours but other names relabels the strip; a Watch match with no human shows none.
  await page.evaluate(() => SC.start({ mode: 'pvp', map: 'dojo', names: ['Ann', 'Bob'], silly: 'off', minigames: false }));
  await wait(600);
  const renamed = (await strips()).filter(s => s.on).map(s => s.text.split(' · ')[0]).join();
  await page.evaluate(() => SC.start({ mode: 'watch', map: 'dojo' }));
  await wait(600);
  const watch = (await strips()).filter(s => s.on).length;
  const r = { start, played, idle, off: off.every(s => !s.on), renamed, watch, errors: [...errors, ...await sc()] };
  await ctx.close();
  return r;
}

// ---------- the controls card ----------
async function testCard(browser, SHOTS) {
  const { ctx, page, errors, sc } = await open(browser, null, NO_WEBDRIVER);
  const card = () => page.evaluate(() => ({ open: SC.controls.cardOpen(), devs: [...document.querySelectorAll('.cc-sec')].map(s => s.dataset.dev).join(), override: !!SC.G.override,
    t: SC.G.t, text: (document.querySelector('.cc') || {}).textContent || '' }));
  const r = {};
  await page.evaluate(() => { MENU.map = 'dojo'; MENU.mode = 'versus'; });
  await page.click('#menu .go');
  await wait(400);
  r.first = await card();
  await wait(300);
  r.frozen = (await card()).t === r.first.t;
  await page.screenshot({ path: path.join(SHOTS, 'card-keyboard.png') });
  await page.keyboard.press('KeyK');
  await wait(300);
  r.closed = await card();
  await wait(200);
  r.runs = (await card()).t > r.closed.t && (await page.evaluate(() => SC.G.state)) === 'play';
  await page.evaluate(() => { toMenu(); startFromMenu(); });
  await wait(300);
  r.again = await card();                              // once per session
  // From the pause menu: opens over it, Esc closes it and the game stays paused.
  await page.keyboard.press('Escape');
  await wait(150);
  await page.click('[data-key="pause-card"]');
  await wait(400);
  r.pauseOpen = await card();
  await page.keyboard.press('Escape');
  await wait(150);
  r.pauseClosed = Object.assign(await card(), { state: await page.evaluate(() => SC.G.state) });
  // A pad player and a keyboard player (2 Players, one pad: it drives P1): one section each.
  await page.evaluate(() => { window.__pad = { index: 0, id: 'Mock pad', connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
    navigator.getGamepads = () => [__pad]; setState('play'); toMenu(); emit('pad', 'jump', 0); SC.start({ mode: 'pvp', map: 'dojo' }); SC.controls.card(true); });
  await wait(400);
  r.padCard = await card();
  await page.screenshot({ path: path.join(SHOTS, 'card-pad-keys.png') });
  await page.evaluate(() => { __pad.buttons[0].pressed = true; });
  await wait(120);
  await page.evaluate(() => { __pad.buttons[0].pressed = false; navigator.getGamepads = () => []; });
  await wait(120);
  r.padClosed = await card();
  r.errors = [...errors, ...await sc()];
  await ctx.close();
  return r;
}

// ---------- table mode ----------
async function testTable(browser, SHOTS, w, h) {
  const { ctx, page, errors, touch, sc } = await open(browser, ipad(w, h), NO_WEBDRIVER);
  const r = {};
  // The 2-player setup's switch beside Fight!, then the card (two touch sections, P2's turned) closed by a tap.
  await page.evaluate(() => { MENU.mode = 'pvp'; MENU.map = 'dojo'; MENU.loadouts = [{ weapon: 'katana' }, { weapon: 'katana' }]; ROTATE_SKIPPED = true; setScheme(1, 'advanced');
    if (typeof DUO === 'object') DUO.silly = 'off';   // 79-silly's rule vote would hold the round start
    openScreen('maps', 'modes'); });
  await page.tap('[data-key="table-mode"]');
  r.toggle = await page.evaluate(() => SETTINGS.tableMode === true && /✓/.test(document.querySelector('[data-key="table-mode"]').textContent));
  await page.tap('#maps .go');
  await wait(500);
  r.card = await page.evaluate(() => [...document.querySelectorAll('.cc-sec')].map(s => s.dataset.dev + (s.classList.contains('flip') ? ':flip' : '')).join());
  await page.screenshot({ path: path.join(SHOTS, `table-card-${w}x${h}.png`) });
  await touch('touchStart', [{ x: w / 2, y: h / 2, id: 1 }]); await touch('touchEnd', []);
  await wait(300);
  r.cardClosed = await page.evaluate(() => !SC.controls.cardOpen() && !SC.G.override && SC.G.state === 'play');
  await page.evaluate(() => { SC.G.lock = 0; });
  await place(page, [400, w > 1300 ? 860 : 880]);
  await wait(400);
  const sets = await page.evaluate(() => {
    const vis = e => !!e && e.offsetParent !== null, boxes = [...document.querySelectorAll('#touch .tset')];
    return { table: document.getElementById('touch').classList.contains('table'), n: boxes.filter(vis).length, transform: getComputedStyle(boxes[1]).transform,
      buttons: boxes.map(b => [...b.querySelectorAll('.tarc button')].filter(vis).map(x => x.dataset.act).join(' ')) };
  });
  r.sets = sets;
  const m = /matrix\(([^)]+)\)/.exec(sets.transform), v = m ? m[1].split(',').map(Number) : [];
  r.rotated = v.length === 6 && Math.abs(v[0] + 1) < 1e-6 && Math.abs(v[3] + 1) < 1e-6 && Math.abs(v[1]) < 1e-6;
  // Nothing of P2's set reaches into the HUD block (its cards), and both sets stay on screen.
  r.hud = await page.evaluate(() => {
    const V = SC.view.VIEW, hud = { t: V.hudY / V.dpr, b: (V.hudY + V.hudH) / V.dpr }, out = [];
    for (const e of document.querySelectorAll('#touch .tset2 .tarc button, #touch .tset2 .tzone, #touch .tset2 .tstick')) {
      if (e.offsetParent === null) continue;
      const b = e.getBoundingClientRect();
      if (b.top < hud.b && b.bottom > hud.t) out.push(e.className || e.dataset.act);
      if (b.left < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1) out.push('off-screen ' + (e.className || e.dataset.act));
    }
    return { hudBottom: Math.round(hud.b), overlaps: out };
  });
  // Two thumbs at once: P1 in the bottom half pushes right, P2 in the top half pushes toward the screen's left.
  const zone = sel => page.evaluate(q => { const b = document.querySelector(q).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
  const z1 = await zone('#touch .tset:not(.tset2) .tzone-l'), z2 = await zone('#touch .tset2 .tzone-l');
  const x0 = await page.evaluate(() => SC.F.map(f => f.P[2].x));
  await touch('touchStart', [{ x: z1.x, y: z1.y, id: 1 }, { x: z2.x, y: z2.y, id: 2 }]);
  for (let k = 1; k <= 6; k++) await touch('touchMove', [{ x: z1.x + k * 10, y: z1.y, id: 1 }, { x: z2.x - k * 10, y: z2.y, id: 2 }]);
  await wait(450);
  r.axes = await page.evaluate(() => TSETS.map(s => s.mx.toFixed(2)).join());
  await page.screenshot({ path: path.join(SHOTS, `table-${w}x${h}.png`) });
  await touch('touchEnd', []);
  const x1 = await page.evaluate(() => SC.F.map(f => f.P[2].x));
  r.moved = { p1: Math.round(x1[0] - x0[0]), p2: Math.round(x1[1] - x0[1]) };
  // One thumb in the top half drives only P2 (P1's input stays still; a body still tumbling from the clash may drift);
  // P2's attack button attacks with P2, and P2's hits buzz the touch screen.
  await place(page, [250, 760]);
  await wait(500);
  const y0 = await page.evaluate(() => SC.F[1].P[2].x);
  await touch('touchStart', [{ x: z2.x, y: z2.y, id: 3 }]);
  for (let k = 1; k <= 6; k++) await touch('touchMove', [{ x: z2.x + k * 10, y: z2.y, id: 3 }]);
  await wait(200);
  const mx = await page.evaluate(() => SC.F.map(f => f.inp.mx));
  await wait(200); await touch('touchEnd', []);
  r.onlyP2 = mx[0] === 0 && mx[1] > .5 && (await page.evaluate(() => SC.F[1].P[2].x)) - y0 > 30;
  const atk = await page.evaluate(() => { window.__atk = []; on('attack', f => __atk.push(f.slot)); const b = document.querySelector('#touch .tset2 [data-act="attack"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.evaluate(() => { SC.F[1].atkCd = 0; });
  await touch('touchStart', [{ x: atk.x, y: atk.y, id: 4 }]); await wait(60); await touch('touchEnd', []);
  await wait(100);
  r.p2Attack = await page.evaluate(() => __atk.join());
  r.haptic = await page.evaluate(() => { window.__hap = []; window.StickClashNative = { haptic: s => __hap.push(s) }; HAPTIC.at = 0;
    damage(SC.F[1], 20, { src: SC.F[0], kind: 'melee', nx: 1, ny: 0 }); const n = __hap.length; delete window.StickClashNative; return n > 0; });
  // Simple's skill button turns into the super (★) while the meter is full.
  await page.evaluate(() => { SC.F[0].super = 100; });
  await wait(250);
  r.star = await page.evaluate(() => { const b = document.querySelector('#touch .tset:not(.tset2) [data-act="skill1"]'); return b.textContent + (b.classList.contains('ready') ? ' ready' : ''); });
  if (w === 1194) {
    // A stray hardware key or pad press keeps both players' sets on screen.
    await page.keyboard.press('KeyK'); await page.evaluate(() => emit('pad', 'attack', 0)); await wait(200);
    r.stray = await page.evaluate(() => ({ hidden: TOUCH_EL.hidden, table: tableActive(), sets: [...document.querySelectorAll('#touch .tset')].filter(e => e.offsetParent !== null).length }));
    // Two touch seats in the lobby, then table mode off: the second seat leaves and is told to use a keyboard or pad.
    await page.evaluate(() => { toMenu(); MENU.mode = 'ffa'; LOBBY.list = [{ touch: true, label: 'Touch screen' }, { touch: true, label: 'Touch screen (top, table mode)' }, { keys: 0 }];
      openScreen('maps', 'modes'); });
    await page.tap('[data-key="table-mode"]');
    r.lobby = await page.evaluate(() => ({ list: LOBBY.list.map(j => j.touch ? 'T' : 'K').join(''), toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join('|') }));
    await page.evaluate(() => { LOBBY.list = []; });
  }
  r.errors = [...errors, ...await sc()];
  await ctx.close();
  return r;
}
// A phone (844x390) is too small for table mode: it isn't offered, and a saved "on" doesn't split the screen.
async function testTablePhone(browser) {
  const { ctx, page, errors, sc } = await open(browser, ipad(844, 390));
  const r = await page.evaluate(() => {
    ROTATE_SKIPPED = true; MENU.mode = 'pvp'; openScreen('maps', 'modes');
    const out = { setup: !!document.querySelector('[data-key="table-mode"]') };
    openScreen('settings', 'menu'); out.settings = [...document.querySelectorAll('#settings .lbl')].some(l => l.textContent === 'Table mode');
    SETTINGS.tableMode = true; SC.start({ mode: 'pvp', map: 'dojo', silly: 'off', minigames: false });
    out.seat = TSETS[1].slot; out.table = tableActive(); SETTINGS.tableMode = false;
    return out;
  });
  r.errors = [...errors, ...await sc()];
  await ctx.close();
  return r;
}

async function run(browser, { check, rows, SHOTS }) {
  const add = (key, ok, note) => { check(ok, 'controls ' + key + (note ? ': ' + note : '')); rows.push({ kind: 'controls', key, ok: !!ok, note: note || '' }); };
  const errs = [];
  const s = await testSimple(browser);
  errs.push(...s.errors);
  add('defaults: Simple fresh, Advanced for a save', s.freshSimple && s.existingAdvanced);
  add('Simple: one skill, no throwables', s.oneSkill);
  add('Simple: grab/throw/skill2/taunt off', s.offIgnored && s.advancedGrabs, `advanced grabs ${s.advancedGrabs}`);
  add('Simple: skill key fires a full super', s.superFromSkill && s.hint === 'Q ★Q', `hints "${s.hint}"`);
  add('Simple: hold back from an attack blocks', s.autoBlock && s.attackNotGrab, JSON.stringify({ auto: s.autoBlock, swing: s.attackNotGrab }));
  add('Simple on a pad: off buttons, B = full super', s.pad);
  add('CPUs keep every action; trials use Advanced', s.cpuKeeps && s.trial, `trial ${s.trial}`);
  add('Simple: vines caught by touch; Training hides skill 2', s.vine && s.trainHint === '2 skill,2/3 skills', JSON.stringify({ vine: s.vine, hint: s.trainHint }));
  const c = await testCompact(browser);
  errs.push(...c.errors);
  add('Compact 2P: both players at once', c.both === '1,-1' && c.moved && c.blocks === 'true,true' && c.attacks === '1,1' && c.jumps === 'true,true' && c.supers === '1,1',
    JSON.stringify({ both: c.both, moved: c.moved, blocks: c.blocks, attacks: c.attacks, jumps: c.jumps, supers: c.supers }));
  add('Compact 2P: "/" and "." held back', /Slash:true/.test(c.menuKeys) && /Period:true/.test(c.menuKeys) && c.inFight && c.hints === 'AFS ←.↓', `${c.menuKeys} hints ${c.hints}`);
  add('Compact 2P: P2 skill 2 on comma', c.skill2.key === 'Comma' && c.skill2.used && c.skill2.rows && c.skill2.screen === ', comma fixed', JSON.stringify(c.skill2));
  const k = await testStrips(browser, SHOTS);
  errs.push(...k.errors);
  const side = (list, sd) => list.find(x => x.side === sd) || {};
  add('key strips at start (both players)', side(k.start, 'l').on && side(k.start, 'r').on && /A\s*D/.test(side(k.start, 'l').text) && /←/.test(side(k.start, 'r').text),
    JSON.stringify(k.start.map(x => x.side + (x.on ? ' on' : ' off'))));
  add('key strips: new names, none without a human', k.renamed === 'Ann,Bob' && k.watch === 0, JSON.stringify({ renamed: k.renamed, watch: k.watch }));
  add('key strips fade with play, return when idle', !side(k.played, 'l').on && side(k.played, 'l').op < .05 && side(k.played, 'r').on && side(k.idle, 'l').on && k.off,
    JSON.stringify({ played: k.played.map(x => x.side + (x.on ? ' on ' : ' off ') + x.op.toFixed(2)), idle: k.idle.map(x => x.side + (x.on ? ' on' : ' off')) }));
  const d = await testCard(browser, SHOTS);
  errs.push(...d.errors);
  add('card: first fight, keyboard section, fight waits', d.first.open && d.first.devs === 'keyboard' && d.first.override && d.frozen, JSON.stringify(d.first).slice(0, 160));
  add('card: closed by a key, once per session', !d.closed.open && !d.closed.override && d.runs && !d.again.open, JSON.stringify({ closed: d.closed.open, again: d.again.open }));
  add('card: from the pause menu', d.pauseOpen.open && !d.pauseOpen.override && !d.pauseClosed.open && d.pauseClosed.state === 'paused', JSON.stringify(d.pauseClosed));
  add('card: pad + keyboard sections, pad closes', d.padCard.devs === 'gamepad,keyboard' && !d.padClosed.open, d.padCard.devs);
  for (const [w, h] of [[1194, 834], [1366, 1024]]) {
    const t = await testTable(browser, SHOTS, w, h);
    errs.push(...t.errors);
    add(`table ${w}x${h}: setup switch + card`, t.toggle && t.card === 'touch,touch:flip' && t.cardClosed, `card ${t.card}`);
    add(`table ${w}x${h}: two sets, P2 turned 180°`, t.sets.table && t.sets.n === 2 && t.rotated && t.sets.buttons[0] === 'attack jump skill1' && t.sets.buttons[1].split(' ').length >= 8,
      JSON.stringify(t.sets));
    add(`table ${w}x${h}: clear of the HUD cards`, !t.hud.overlaps.length, JSON.stringify(t.hud));
    add(`table ${w}x${h}: multitouch drives each half's fighter`, t.moved.p1 > 40 && t.moved.p2 < -40 && t.onlyP2 && t.p2Attack === '1' && t.haptic,
      JSON.stringify({ axes: t.axes, moved: t.moved, onlyP2: t.onlyP2, p2Attack: t.p2Attack, haptic: t.haptic }));
    add(`table ${w}x${h}: Simple skill button shows the super`, t.star === '★ ready', t.star);
    if (t.stray) add('table: a stray key or pad keeps both sets; table off frees the 2nd touch seat', !t.stray.hidden && t.stray.table && t.stray.sets === 2
      && t.lobby.list === 'TK' && /Player 2 needs a keyboard or pad/.test(t.lobby.toast), JSON.stringify({ stray: t.stray, lobby: t.lobby }));
  }
  const dk = await testDashKeys(browser);
  errs.push(...dk.errors);
  add('dash off Shift: Space / Enter dash, \\ super; old saves move once', dk.dashes === 'true,true' && dk.p2super && dk.keys === 'Space,Enter,Backslash'
    && dk.migrated.keys === 'Space,Enter,Backslash' && dk.migrated.v === 2 && dk.own.keys.startsWith('KeyV,'), JSON.stringify(dk).slice(0, 240));
  const tp = await testTablePhone(browser);
  errs.push(...tp.errors);
  add('table mode: not on a phone (844x390)', !tp.setup && !tp.settings && tp.seat === -1 && !tp.table, JSON.stringify(tp));
  add('no console errors (controls)', !errs.length, errs.join(' | ').slice(0, 300));
}
module.exports = { run };

if (require.main === module) {
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  const fails = [], rows = [], SHOTS = path.join(ROOT, 'tmp', 'smoke');
  require('fs').mkdirSync(SHOTS, { recursive: true });
  (async () => {
    const browser = await chromium.launch();
    try { await run(browser, { check: (ok, what) => { if (!ok) fails.push(what); return ok; }, rows, SHOTS }); }
    catch (e) { fails.push('crashed: ' + e.stack); }
    finally { await browser.close(); }
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: (r.note || '').slice(0, 150) })));
    if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
    console.log('CONTROLS SMOKE OK');
  })();
}
