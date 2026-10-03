// Smoke tests for input + accessibility (90-input, 91-touch, 92-access, 93-pads, 94-savecode). Called by
// tools/smoke.cjs; also runs on its own (`node tools/smoke-access.cjs`, after `node build.mjs`).
// - one-button mode, colour-blind palettes, reduce flashing, practice speed, rumble + native haptics (headless);
// - pad remap + a remapped button driving P1, the join lobby with 3 mocked pads driving 3 players;
// - save codes: round trip, damaged codes refused, the Transfer screen's preview + confirm + reload;
// - the touch stick, flick-up jump, tap-to-attack and the taunt button at 844x390 and 390x844.
// Screenshots: tmp/smoke/access-*.png.
const path = require('path');
const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'dist', 'stick-clash.html');
const MOCK_PADS = n => `window.__pads = Array.from({ length: ${n} }, (_, i) => ({ index: i, id: 'Mock pad ' + (i + 1), connected: true,
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0],
  vibrationActuator: { playEffect: (t, o) => { (window.__rumble = window.__rumble || []).push([i, t, o.strongMagnitude]); return Promise.resolve(); } } }));
  navigator.getGamepads = () => window.__pads;`;
const CALM = () => { for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; f.inp.mx = 0; f.inp.attackHeld = false; } };

async function open(browser, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, opts));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto(URL);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  return { ctx, page, errors };
}

// Headless checks: everything that doesn't need real input events.
async function testHeadless(page) {
  return page.evaluate(() => {
    const out = {}, keep = Object.assign({}, SETTINGS);
    // One-button: walks to the foe, press = attack, hold = block, quick double tap = super.
    SETTINGS.oneButton = 'p1';
    SC.start({ mode: 'versus', map: 'dojo' }); SC.G.state = 'paused'; SC.G.lock = 0;
    for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; }
    const P = SC.F[0], gap0 = Math.abs(SC.F[1].P[2].x - P.P[2].x);
    let t = 1000;
    for (let k = 0; k < 150; k++) { oneButtonDrive(P, t += 16); SC.sim(1 / 60); for (const f of SC.F) if (f.ctrl === 'cpu') f.inp.mx = 0; }
    out.walked = gap0 - Math.abs(SC.F[1].P[2].x - P.P[2].x);
    P.inp.attackHeld = true; oneButtonDrive(P, t += 16); out.pressAttack = P.inp.attack;
    oneButtonDrive(P, t += 300); out.holdBlock = P.inp.blockHeld;
    P.inp.attackHeld = false; oneButtonDrive(P, t += 16);
    P.inp.attackHeld = true; oneButtonDrive(P, t += 16); P.inp.attackHeld = false; oneButtonDrive(P, t += 60);
    P.super = 100; P.inp.attack = false; P.inp.attackHeld = true; oneButtonDrive(P, t += 60);
    out.doubleSuper = P.inp.super && !P.inp.attack;
    SETTINGS.oneButton = 'off';
    // Colour-blind: an 8-fighter FFA takes the palette; a team mode gives each team one palette colour.
    SETTINGS.cbPalette = 'deutan';
    SC.start({ mode: 'ffa', fighters: 8 }); SC.render(1 / 60);
    out.cbFfa = SC.F.every((f, i) => f.color === CB_PALETTES.deutan[i]);
    SC.start({ mode: 'ctf' }); SC.render(1 / 60);
    out.cbTeams = SC.F.every(f => f.color === CB_PALETTES.deutan[f.team]) && PARTY_TEAMS[1].color === CB_PALETTES.deutan[1];
    SETTINGS.cbPalette = 'off'; SC.start({ mode: 'ctf' });
    out.cbOff = PARTY_TEAMS[0].color === '#4ab8ff';
    // Reduce flashing: flashes and shake shrink.
    setSetting('reduceFlash', true); FX.flashA = 0; flashScreen('#ffffff', .3);
    out.flash = FX.flashA <= .11 && FX.shakeMul <= .25;
    setSetting('reduceFlash', false); FX.flashA = 0;
    // Practice speed: solo only, never ranked.
    SETTINGS.practiceSpeed = .5;
    SC.start({ mode: 'versus' }); const solo = accessSpeedMul();
    SC.start({ mode: 'ranked' }); const ranked = accessSpeedMul();
    SC.start({ mode: 'watch' }); const watch = accessSpeedMul();
    out.speed = solo === .5 && ranked === 1 && watch === 1;
    // Rumble + haptics: a hit on P1 rumbles its pad (scaled) and taps the native bridge.
    window.__haptics = []; window.StickClashNative = { haptic: s => __haptics.push(s) };
    window.__rumble = [];
    window.__pads = [{ index: 0, id: 'pad', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0],
      vibrationActuator: { playEffect: (t, o) => { __rumble.push(o.strongMagnitude); return Promise.resolve(); } } }];
    navigator.getGamepads = () => __pads;
    SETTINGS.rumble = .5;
    SC.start({ mode: 'versus', map: 'dojo' }); SC.G.lock = 0; pollPads();
    damage(SC.F[0], 20, { src: SC.F[1], kind: 'melee', nx: 1, ny: 0 });
    out.rumble = __rumble.length > 0 && __rumble[0] <= .5 + 1e-9 && __haptics.length > 0;
    SETTINGS.rumble = 0; __rumble.length = 0; damage(SC.F[0], 20, { src: SC.F[1], kind: 'melee', nx: 1, ny: 0 });
    out.rumbleOff = __rumble.length === 0;
    navigator.getGamepads = () => []; delete window.StickClashNative; pollPads();
    Object.assign(SETTINGS, keep); saveSettings();
    out.errors = SC.errors.map(e => e.msg);
    return out;
  });
}

async function testPads(page, SHOTS) {
  const r = {};
  await page.evaluate(MOCK_PADS(3));
  // Remap: P1 jump onto Y (skill 2 takes A), then Y jumps in a match.
  await page.evaluate(() => { toMenu(); openScreen('controls', 'menu'); });
  await page.click('[data-key="padmap-open"]');
  await page.click('[data-key="pad-jump"]');
  await page.waitForTimeout(80);
  await page.evaluate(() => { __pads[0].buttons[3].pressed = true; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { __pads[0].buttons[3].pressed = false; });
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(SHOTS, 'access-remap.png') });
  r.remap = await page.evaluate(() => PAD_MAPS[0].jump === 3 && PAD_MAPS[0].skill2 === 0 && store.get('padmap')[0].jump === 3);
  r.remapPlays = await page.evaluate(async () => {
    startMatch({ mode: 'versus', map: 'dojo' }); SC.G.lock = 0;
    await new Promise(res => setTimeout(res, 150));            // the first poll after a state change ignores held buttons
    const j0 = SC.F[0].stats.jumps; __pads[0].buttons[3].pressed = true;
    await new Promise(res => setTimeout(res, 150)); __pads[0].buttons[3].pressed = false;
    const ok = SC.F[0].stats.jumps > j0;
    resetPadMap(0); toMenu();
    return ok;
  });
  // Join lobby: three pads press A, the match gets three humans, pad 3 drives P3.
  await page.evaluate(() => { MENU.mode = 'ffa'; MENU.map = 'dojo'; LOBBY.list = []; openScreen('maps', 'modes'); });
  await page.click('[data-key="join-open"]');
  for (let i = 0; i < 3; i++) {
    await page.evaluate(i => { __pads[i].buttons[0].pressed = true; }, i); await page.waitForTimeout(60);
    await page.evaluate(i => { __pads[i].buttons[0].pressed = false; }, i); await page.waitForTimeout(60);
  }
  await page.screenshot({ path: path.join(SHOTS, 'access-join.png') });
  r.joined = await page.evaluate(() => LOBBY.list.length === 3);
  await page.click('#join .go');
  await page.waitForTimeout(300);
  r.match = await page.evaluate(() => {
    const humans = SC.G.roster.filter(x => x.ctrl === 'human').map(x => x.slot).sort();
    return SC.G.state === 'play' && humans.join() === '0,1,2' && JOINED && JOINED.length === 3;
  });
  await page.evaluate(CALM);
  await page.waitForTimeout(1500);
  r.p3moves = await page.evaluate(async () => {
    const f = SC.F.find(x => x.ctrl === 'human' && x.slot === 2), x0 = f.P[2].x;
    __pads[2].axes[0] = x0 < 640 ? 1 : -1;
    await new Promise(res => setTimeout(res, 400)); __pads[2].axes[0] = 0;
    return Math.abs(f.P[2].x - x0) > 40;
  });
  await page.screenshot({ path: path.join(SHOTS, 'access-party.png') });
  await page.evaluate(() => { LOBBY.list = []; toMenu(); navigator.getGamepads = () => []; });
  return r;
}

async function testScreens(page, SHOTS) {
  await page.evaluate(() => { SETTINGS.cbPalette = 'deutan'; SC.start({ mode: 'ffa', fighters: 8, map: 'dojo' }); SC.G.lock = 0; SC.sim(1); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 'access-colourblind.png') });
  await page.evaluate(() => { SETTINGS.cbPalette = 'off'; toMenu(); openScreen('settings', 'menu'); });
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector('[data-group="access"]').scrollIntoView());
  await page.screenshot({ path: path.join(SHOTS, 'access-settings.png') });
  return page.evaluate(() => !!document.querySelector('[data-group="access"]') && !!document.querySelector('[data-group="devices"]'));
}

// Save codes: round trip, a damaged code is refused, the screen previews and imports (then reloads).
async function testSaveCodes(page, SHOTS) {
  const r = await page.evaluate(async () => {
    const code = await makeSaveCode(), back = await readSaveCode(code);
    const same = JSON.stringify(back.k) === JSON.stringify(saveKeysNow());
    let bad = '';
    try { await readSaveCode(code.slice(0, -12) + 'AAAA' + code.slice(-8)); } catch (e) { bad = e.message; }
    const p = JSON.parse(localStorage.getItem('stickclash.v2.profile') || '{}');
    p.coins = 4321;
    const k = Object.assign({}, back.k, { 'stickclash.v2.profile': JSON.stringify(p) });
    const json = JSON.stringify({ v: 1, t: Date.now(), k });
    window.__code = `SC1p.${toB64u(new TextEncoder().encode(json))}.${fnv1a(json)}`;
    return { same, bad: !!bad, zipped: code.startsWith('SC1z.'), len: code.length };
  });
  await page.evaluate(() => { toMenu(); openScreen('transfer', 'settings'); });
  await page.waitForFunction(() => /^SC1/.test(document.querySelector('[data-key="xfer-out"]').value));
  await page.fill('[data-key="xfer-in"]', await page.evaluate(() => __code));
  await page.click('[data-key="xfer-check"]');
  await page.waitForSelector('.xfer-preview');
  await page.screenshot({ path: path.join(SHOTS, 'access-transfer.png'), fullPage: true });
  r.preview = await page.evaluate(() => /4321/.test(document.querySelector('.xfer-facts').textContent));
  await Promise.all([page.waitForEvent('load'), page.click('[data-key="xfer-confirm"]')]);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  r.imported = await page.evaluate(() => PROFILE.coins === 4321);
  return r;
}

// Touch: the stick moves P1, flicking up jumps, a tap on the right attacks, taunt has a button.
async function testTouch(browser, SHOTS, w, h) {
  const { ctx, page, errors } = await open(browser, { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await page.evaluate(() => { ROTATE_SKIPPED = true; MENU.map = 'dojo'; MENU.mode = 'versus'; startFromMenu(); });
  await page.evaluate(CALM);
  await page.evaluate(() => { window.__atk = 0; on('attack', f => { if (f === SC.F[0]) __atk++; }); });
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const sx = w * .2, sy = h * .75, x0 = await page.evaluate(() => SC.F[0].P[2].x), dir = x0 < 640 ? 1 : -1;
  await touch('touchStart', [{ x: sx, y: sy, id: 1 }]);
  for (let k = 1; k <= 6; k++) await touch('touchMove', [{ x: sx + dir * k * 10, y: sy, id: 1 }]);
  await page.waitForTimeout(400);
  const moved = Math.abs((await page.evaluate(() => SC.F[0].P[2].x)) - x0);
  await page.screenshot({ path: path.join(SHOTS, `access-stick-${w}x${h}.png`) });
  const j0 = await page.evaluate(() => SC.F[0].stats.jumps);
  await touch('touchMove', [{ x: sx + dir * 20, y: sy - 50, id: 1 }]);
  await page.waitForTimeout(150);
  const jumped = (await page.evaluate(() => SC.F[0].stats.jumps)) > j0;
  // A second finger taps the right side while the stick is held (multitouch): attack.
  await touch('touchStart', [{ x: sx + dir * 20, y: sy - 50, id: 1 }, { x: w * .62, y: h * .3, id: 2 }]);
  await page.waitForTimeout(40);
  await touch('touchEnd', []);
  await page.waitForTimeout(60);
  const attacked = await page.evaluate(() => __atk > 0 || SC.F[0].stats.shots > 0);
  const taunt = await page.evaluate(() => { const b = document.querySelector('#touch [data-act="taunt"]'); return !!b && b.offsetParent !== null; });
  const inView = await page.evaluate(() => [...document.querySelectorAll('#touch .tarc button')].every(b => {
    const r = b.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
  await ctx.close();
  return { moved: moved > 40, jumped, attacked, taunt, inView, errors };
}

async function run(browser, { check, rows, SHOTS }) {
  const add = (key, ok, note) => { check(ok, 'access ' + key + (note ? ': ' + note : '')); rows.push({ kind: 'access', key, ok: !!ok, note: note || '' }); };
  const { ctx, page, errors } = await open(browser);
  const h = await testHeadless(page);
  add('one-button walks to the foe', h.walked > 80, 'closed ' + Math.round(h.walked) + ' px');
  add('one-button press/hold/double', h.pressAttack && h.holdBlock && h.doubleSuper);
  add('colour-blind palettes', h.cbFfa && h.cbTeams && h.cbOff);
  add('reduce flashing', h.flash);
  add('practice speed (solo only)', h.speed);
  add('rumble + haptics', h.rumble && h.rumbleOff);
  const p = await testPads(page, SHOTS);
  add('pad remap', p.remap && p.remapPlays);
  add('join lobby: 3 pads, 3 players', p.joined && p.match && p.p3moves);
  add('accessibility screens', await testScreens(page, SHOTS));
  const s = await testSaveCodes(page, SHOTS);
  add('save code round trip', s.same && s.bad, `${s.len} chars${s.zipped ? ', deflated' : ''}`);
  add('save code import', s.preview && s.imported, s.preview ? '' : 'no preview');
  add('no errors (access)', !errors.length && !h.errors.length, [...errors, ...h.errors].join(' | '));
  await ctx.close();
  for (const [w, hh] of [[844, 390], [390, 844]]) {
    const t = await testTouch(browser, SHOTS, w, hh);
    add(`touch ${w}x${hh}`, t.moved && t.jumped && t.attacked && t.taunt && t.inView && !t.errors.length,
      Object.entries(t).filter(([k, v]) => v === false).map(([k]) => k).join(' ') + t.errors.join(' | '));
  }
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
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
  })();
}
