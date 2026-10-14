// Smoke tests for the v4 two-player features (73-duo, 74-tagteam, 79-silly, Co-op Waves in 70, co-op quest in 76/98):
// the head-to-head record (once per match, kept over a reload), the handicap (scripted record, cap, HUD tag, told once),
// the quick rematch (button, R and pad Start: new weapons, no menu), Co-op Waves (waves, revive, best per pair), the
// co-op quest node (two heroes, tougher foes, stars saved, dialogue), the silly-rules vote (both players' keys, the
// right rule, one round only), Tag Team (tag-in on K.O., round ends with both down; vs CPU) and round length.
// v4 fixes: damaged duo saves, no vote/handicap/record in lobby party modes, mutators and colours for tag-ins, the
// first tag K.O. not treated as deciding, Giant Heads' hitbox, co-op quest spawns and Player 2's loadout, toasts on the
// results card (none over its title at 1280x720, 1194x834, 844x390; buttons in reach on the phone).
// Screenshots (tmp/smoke/2p-*.png) at 1280x720 and 1194x834: the 2-player setup, the vote, a tag-in, the results.
// Called by tools/smoke.cjs; also runs alone (`node tools/smoke-2p.cjs`, after `node build.mjs`).
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'dist', 'stick-clash.html');
const SIZES = [[1280, 720], [1194, 834]];

async function open(browser, [w, h] = SIZES[0], init) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  if (init) await ctx.addInitScript(init.fn, init.arg);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto(URL);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(HELPERS);
  return { ctx, page, errors };
}

// Headless Chromium on file:// (under load) sometimes loses what a page's FIRST document stored when it reloads (see
// smoke-progress's migration test), so a check that saves survive a reload stores them from a second document.
async function secondDoc(page) {
  await page.goto(URL);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(HELPERS);
}

// Page-side helpers: name the players, finish a match for one side, K.O. a fighter.
const HELPERS = `
window.__2 = {
  names(a, b) { DUO.names = [a, b]; duoSave(); },
  ko(f, by) { SC.G.lock = 0; f.inv = 0; damage(f, 9999, { src: by || null, kind: 'melee' }); },
  // Ends the running duel with team t winning its last round.
  win(t) { if (SC.G.ending) SC.sim(TUNE.koDelay + .2); SC.G.score[t] = SC.G.winScore - 1; SC.G.lock = 0;
    for (const f of SC.F) if (f.team !== t) __2.ko(f, SC.F.find(o => o.team === t)); SC.sim(TUNE.koDelay + 1); return SC.G.state; },
  // P1 wins the match with one huge blow (a first one unlocks Heavy Hitter): returns how many toasts named that trophy.
  blow() { SC.G.score[0] = SC.G.winScore - 1; __2.ko(SC.F[1], SC.F[0]);
    const n = [...document.querySelectorAll('.toast')].filter(t => /Heavy Hitter/.test(t.textContent)).length; SC.sim(TUNE.koDelay + 1); return n; },
};`;

async function testRivalry(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  await secondDoc(page);
  const r = await page.evaluate(() => {
    __2.names('Finn', 'Dad');
    const play = (t, o) => { SC.start(Object.assign({ mode: 'pvp', map: 'dojo', weapons: ['katana', 'katana'], killcam: false }, o)); return __2.win(t); };
    const out = { over: play(0) };
    out.line1 = (document.querySelector('#over .duo-res') || {}).textContent;
    emit('matchOver', SC.G.result); duoSettle();             // asked again: still counted once
    out.total1 = duoRec('Finn', 'Dad').total;
    play(1); play(1);
    out.line3 = (document.querySelector('#over .duo-res') || {}).textContent;
    play(1, { autopilot: true });                            // autopilot matches never count
    play(0, { mode: 'versus' });                             // nor matches against a CPU
    const rec = duoRec('Finn', 'Dad');
    Object.assign(out, { total: rec.total, last: rec.last, w: rec.w.slice(), streak: rec.streak.slice(), names: rec.n.slice() });
    toMenu(); STATS_TAB.tab = 'rivals'; openScreen('stats', 'menu');
    out.tab = (document.querySelector('#stats .duo-rivals') || {}).textContent;
    return out;
  });
  await page.reload();
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  const after = await page.evaluate(() => { const rec = duoRec('dad', 'FINN'); return rec && { total: rec.total, last: rec.last, w: rec.w.slice() }; });
  const ok = check(r.over === 'over' && r.line1 === 'Head-to-head: Finn 1 – 0 Dad', `2p rivalry: first results line "${r.line1}"`)
    & check(r.total1 === 1, `2p rivalry: counted ${r.total1} times`)
    & check(r.line3 === 'Head-to-head: Finn 1 – 2 Dad · Dad on a 2-win streak', `2p rivalry: third line "${r.line3}"`)
    & check(r.total === 3 && r.last === 'baa' && r.names.join() === 'Dad,Finn', `2p rivalry: record ${JSON.stringify(r)}`)
    & check(/Dad 2 – 1 Finn3 matches · Dad on a 2-win streak/.test(r.tab || ''), `2p rivalry: Rivals tab "${r.tab}"`)
    & check(after && after.total === 3 && after.last === 'baa', `2p rivalry: after reload ${JSON.stringify(after)}`)
    & check(!errors.length, '2p rivalry errors: ' + errors.join(' | '));
  rows.push({ kind: '2p', key: 'rivalry record', ok: !!ok, note: `${r.line3}; reload kept ${after && after.total}` });
  await ctx.close();
}

// A damaged or hand-edited 'duo' save: repaired or dropped pair by pair, so the 2-player setup, a match, the results card
// and the Rivals tab all work; a record that throws still leaves the results card up; save codes refuse bad shapes.
async function testStores(browser, { check, rows }) {
  const bad = JSON.stringify({ names: { a: 1 }, hcap: 'x', silly: 3, pairs: { 'dad|finn': { n: ['Dad', 'Finn'], w: 5, last: 7, streak: 2, total: 'lots' },
    'x|y': { n: 'XY', w: [1, 1] }, odd: 3 } });
  const { ctx, page, errors } = await open(browser, SIZES[0], { fn: s => localStorage.setItem('stickclash.v2.duo', s), arg: bad });
  const r = await page.evaluate(() => {
    const out = { pairs: JSON.stringify(DUO.pairs), names: DUO.names.join() };
    MENU.mode = 'pvp'; openScreen('maps', 'menu'); out.panel = !!document.querySelector('#maps .duo-panel');
    MENU.mode = 'tagteam'; openScreen('maps', 'menu');
    SC.start({ mode: 'pvp', map: 'dojo', handicap: true, silly: 'off', killcam: false, names: ['Finn', 'Dad'] }); __2.win(0);
    out.line = (document.querySelector('#over .duo-res') || {}).textContent;
    const keep = window.duoSettle;
    window.duoSettle = () => { throw new Error('test: broken record'); };
    SC.start({ mode: 'pvp', map: 'dojo', silly: 'off', killcam: false, names: ['Finn', 'Dad'] }); __2.win(1);
    window.duoSettle = keep;
    out.card = !PANELS.over.hidden && !!document.querySelector('#over .results-card h2') && !document.querySelector('#over .duo-res');
    toMenu(); STATS_TAB.tab = 'rivals'; openScreen('stats', 'menu'); out.rivals = (document.querySelector('#stats .duo-rivals') || {}).textContent;
    const refused = (k, v) => { try { saveShapeCheck('stickclash.v2.' + k, v); return false; } catch (e) { return true; } };
    out.shapes = [refused('duo', 5), refused('duo', { pairs: 7 }), refused('controls', []), !refused('duo', { pairs: {} }), !refused('controls', { schemes: [] })].join();
    out.errors = SC.errors.map(e => e.msg).filter(m => !/test: broken record/.test(m));
    return out;
  });
  const errs = errors.filter(e => !/test: broken record/.test(e)).concat(r.errors);
  const ok = check(r.pairs === '{"dad|finn":{"n":["Dad","Finn"],"w":[0,0],"last":"","streak":[-1,0],"total":0,"wave":0}}' && r.names === ',', `2p stores: loaded ${r.pairs} names "${r.names}"`)
    & check(r.panel && r.line === 'Head-to-head: Finn 1 – 0 Dad' && r.card, `2p stores: panel ${r.panel}, line "${r.line}", card after a throw ${r.card}`)
    & check(/Dad 1 – 1 Finn2 matches/.test(r.rivals || ''), `2p stores: Rivals "${r.rivals}"`)
    & check(r.shapes === 'true,true,true,true,true', `2p stores: save shapes ${r.shapes}`)
    & check(!errs.length, '2p stores errors: ' + errs.join(' | '));
  rows.push({ kind: '2p', key: 'damaged duo save', ok: !!ok, note: 'bad pairs repaired or dropped; results card shown even if the record throws' });
  await ctx.close();
}

async function testHandicap(browser, { check, rows, SHOTS }) {
  const { ctx, page, errors } = await open(browser);
  const r = await page.evaluate(() => {
    __2.names('Finn', 'Dad');
    const rec = duoRec('Finn', 'Dad', true), out = {};       // n = ['Dad', 'Finn']: 'a' is a Dad win
    rec.last = 'abaaabaaab'; out.even = duoHandicap(Object.assign({}, rec, { last: 'aabb' }));
    out.h = duoHandicap(rec);                                // Dad 7 - 3: lead 4 -> 20 %
    rec.last = 'aaaaaaaaab'; out.cap = duoHandicap(rec);     // 9 - 1: lead 8 -> 40 %, capped at 30
    rec.last = 'aaaaaabbbb'; duoSave();                      // 6 - 4: 10 %
    DUO.told = false;
    const cfg = { mode: 'pvp', map: 'dojo', handicap: true, classes: ['none', 'none'], killcam: false };
    SC.start(cfg); SC.G.lock = 0;
    out.hp = SC.F.map(f => [f.name, f.maxHp, f.hcap]);
    out.toast = [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ');
    out.told = DUO.told;
    let n = 0; const draw = window.duoBadge; window.duoBadge = function (...a) { n++; return draw.apply(this, a); };
    SC.render(1 / 60); window.duoBadge = draw; out.badges = n;
    __2.win(1); SC.start(cfg); out.round2 = SC.F[1].maxHp;   // Dad won again (6-4 of the last 10): still −10 %
    SC.start(Object.assign({}, cfg, { handicap: undefined })); out.off = SC.F.map(f => f.maxHp);   // no cfg.handicap: plain
    SC.start(cfg); SC.G.lock = 0; SC.render(1 / 60);
    return out;
  });
  await page.screenshot({ path: path.join(SHOTS, '2p-handicap-hud.png') });
  const ok = check(!r.even, '2p handicap: an even record still handicaps')
    & check(r.h && r.h.name === 'Dad' && r.h.pct === 20 && r.h.won === 7 && r.h.of === 10, `2p handicap: 7-3 gave ${JSON.stringify(r.h)}`)
    & check(r.cap && r.cap.pct === 30, `2p handicap: cap ${JSON.stringify(r.cap)}`)
    & check(r.hp[1][0] === 'Dad' && r.hp[1][1] === 90 && r.hp[1][2] === 10 && r.hp[0][1] === 100 && !r.hp[0][2], `2p handicap: health ${JSON.stringify(r.hp)}`)
    & check(/Handicap: Dad −10% health/.test(r.toast) && r.told, `2p handicap: explained "${r.toast}"`)
    & check(r.badges === 1, `2p handicap: HUD tag drawn ${r.badges}x`)
    & check(r.round2 === 90 && r.off.join() === '100,100', `2p handicap: rematch ${r.round2}, off ${r.off}`)
    & check(!errors.length, '2p handicap errors: ' + errors.join(' | '));
  rows.push({ kind: '2p', key: 'handicap', ok: !!ok, note: `7-3 → −${r.h && r.h.pct}%, 9-1 → −${r.cap && r.cap.pct}% (cap), HUD ♥ −10%` });
  await ctx.close();
}

// Notices that must not hide: the first handicap toast waits for the controls card (not behind its scrim); on the
// results card a trophy toasts once and a toast shows only where it covers neither the title nor the score (1280x720,
// 1194x834, 844x390); on the phone the card scrolls with its buttons pinned in reach.
async function testNotices(browser, { check, rows }) {
  const NO_WEBDRIVER = { fn: () => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }) };
  const { ctx, page, errors } = await open(browser, SIZES[0], NO_WEBDRIVER);
  const held = await page.evaluate(() => {
    __2.names('Finn', 'Dad'); const rec = duoRec('Finn', 'Dad', true); rec.last = 'aaaaaabbbb'; DUO.told = false; duoSave();
    SC.start({ mode: 'pvp', map: 'dojo', handicap: true, silly: 'off', killcam: false });
    return { card: SC.controls.cardOpen(), toasts: document.querySelectorAll('.toast').length };
  });
  await page.waitForTimeout(450);                              // the card ignores input for its first moment
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(100);
  const shown = await page.evaluate(() => ({ card: SC.controls.cardOpen(), toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') }));
  const ok1 = check(held.card && !held.toasts && !shown.card && /Handicap: Dad −10% health/.test(shown.toast), `2p notices: handicap toast behind the card ${JSON.stringify({ held, shown })}`)
    & check(!errors.length, '2p notices errors: ' + errors.join(' | '));
  await ctx.close();
  const phone = await open(browser, [844, 390]);
  await phone.page.evaluate(() => { __2.names('Finn', 'Dad'); SC.start({ mode: 'pvp', map: 'dojo', weapons: ['katana', 'spear'], killcam: false }); window.__blow = __2.blow(); });
  const r = await resultsToasts(phone.page);
  const ok2 = check(r.ok && !phone.errors.length, '2p notices 844x390: results toasts ' + JSON.stringify(r) + phone.errors.join(' | '));
  await phone.ctx.close();
  rows.push({ kind: '2p', key: 'notices', ok: !!(ok1 & ok2), note: 'handicap toast after the card; results: one trophy toast, none over title/score; phone buttons in reach' });
}
// After a match won by a real Heavy Hitter blow (__2.blow): that trophy toasted once, a toast fired on the results card
// covers neither its title nor its score (it shows above the card or waits), and the card's buttons are on screen.
async function resultsToasts(page) {
  await page.evaluate(() => toast('Secret found: Test', 'A notice at results time', '🗝', '#ff5ad1'));
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const card = document.querySelector('#over .results-card'), box = e => e.getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const covered = [card.querySelector('h2'), card.querySelector('.res-score')].map(box);
    const toasts = [...document.querySelectorAll('.toast')].filter(t => getComputedStyle(t).display !== 'none');
    const btns = [...card.querySelectorAll('.row:last-child button')].map(box);
    return { blow: __blow, visible: toasts.length, over: toasts.some(t => covered.some(c => hit(box(t), c))), heavy: [...document.querySelectorAll('.toast')].filter(t => /Heavy Hitter/.test(t.textContent)).length,
      btnsIn: btns.every(b => b.top >= 0 && b.bottom <= innerHeight + 1), held: RES_HELD.length };
  });
  r.ok = r.blow === 1 && !r.over && r.heavy <= 1 && r.btnsIn && r.visible + r.held >= 1;
  return r;
}

async function testQuickRematch(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  const one = async how => {
    const before = await page.evaluate(() => { SC.start({ mode: 'pvp', map: 'neon', weapons: ['katana', 'spear'], roundLen: 'long', killcam: false }); __2.win(0);
      return { state: SC.G.state, w: SC.F.map(f => f.wkey), map: SC.G.cfg.map, btn: !!document.querySelector('#over .quick-rm') }; });
    await page.waitForTimeout(1300);                           // the results screen arms after 1.2 s
    if (how === 'button') await page.click('#over .quick-rm');
    else if (how === 'key') await page.keyboard.press('KeyR');
    else await page.evaluate(() => emit('pad', 'pause', 0));
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => ({ state: SC.G.state, mode: SC.G.mode.key, w: SC.F.map(f => f.wkey), map: SC.G.cfg.map, len: SC.G.cfg.roundLen,
      panel: !!activePanel(), round: SC.G.round }));
    return { how, before, after, ok: before.state === 'over' && before.btn && after.state === 'play' && after.mode === 'pvp' && !after.panel && after.round === 1
      && after.map === 'neon' && after.len === 'long' && after.w.every(k => !before.w.includes(k)) };
  };
  const res = [await one('button'), await one('key'), await one('pad')];
  const early = await page.evaluate(() => { SC.start({ mode: 'pvp', map: 'neon' }); __2.win(0); quickArmed(); return quickArmed(); });   // not armed yet
  const ok = check(res.every(x => x.ok), '2p quick rematch: ' + JSON.stringify(res.filter(x => !x.ok)))
    & check(!early, '2p quick rematch: armed at once')
    & check(!errors.length, '2p quick rematch errors: ' + errors.join(' | '));
  rows.push({ kind: '2p', key: 'quick rematch', ok: !!ok, note: res.map(x => `${x.how}: ${x.before.w.join('+')} → ${x.after.w.join('+')}`).join('; ') });
  await ctx.close();
}

async function testCoopWaves(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  const r = await page.evaluate(() => {
    __2.names('Finn', 'Dad');
    SC.start({ mode: 'coopwaves', map: 'dojo', killcam: false }); SC.G.lock = 0;
    const heroes = () => SC.F.filter(f => f.team === 0), foes = () => SC.F.filter(f => f.team === 1), out = {};
    out.start = { heroes: heroes().map(f => f.ctrl + ':' + f.name), foes: foes().length };
    __2.ko(SC.F[1]);                                          // Dad goes down mid-wave...
    for (const f of foes()) __2.ko(f, SC.F[0]);
    SC.sim(TUNE.koDelay + .5);
    out.wave2 = { wave: modeRun().wave, cleared: modeRun().cleared, dad: [SC.F[1].alive, SC.F[1].hp], foes: foes().length };   // ...and is back up
    for (let w = 0; w < 3; w++) { SC.G.lock = 0; for (const f of foes()) __2.ko(f, SC.F[0]); SC.sim(TUNE.koDelay + .5); }
    out.wave5 = { wave: modeRun().wave, boss: foes().map(f => f.scale) };
    SC.G.lock = 0; for (const f of heroes()) __2.ko(f); SC.sim(TUNE.koDelay + 1);
    out.end = { state: SC.G.state, title: SC.G.result && SC.G.result.title, best: duoRec('Finn', 'Dad').wave, line: SC.G.result && SC.G.result.lines.join(' '),
      score: !!document.querySelector('#over .res-score') };   // waves cleared are the result: no heroes-vs-foes score row
    return out;
  });
  const ok = check(r.start.heroes.join() === 'human:Finn,human:Dad' && r.start.foes === 2, `2p co-op waves: start ${JSON.stringify(r.start)}`)
    & check(r.wave2.wave === 2 && r.wave2.cleared === 1 && r.wave2.dad[0] && r.wave2.dad[1] === 50 && r.wave2.foes >= 2, `2p co-op waves: wave 2 ${JSON.stringify(r.wave2)}`)
    & check(r.wave5.wave === 5 && r.wave5.boss.some(s => s > 1.2), `2p co-op waves: boss wave ${JSON.stringify(r.wave5)}`)
    & check(r.end.state === 'over' && r.end.title === '4 waves cleared' && r.end.best === 4 && /Finn & Dad/.test(r.end.line) && !r.end.score, `2p co-op waves: end ${JSON.stringify(r.end)}`)
    & check(!errors.length, '2p co-op waves errors: ' + errors.join(' | '));
  rows.push({ kind: '2p', key: 'co-op waves', ok: !!ok, note: `revived Dad at ${r.wave2.dad[1]} hp; boss on wave 5; best together ${r.end.best}` });
  await ctx.close();
}

async function testCoopQuest(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  const r = await page.evaluate(() => {
    __2.names('Finn', 'Dad');
    const out = {}, foes = () => SC.F.filter(f => f.team === 1);
    const hpMul = () => SC.G.roster.filter(r => r.team === 1).map(r => r.hpMul);   // classes are random: compare the roster
    SC.start({ mode: 'campaign', node: 'e2' }); const solo = hpMul();
    SC.start({ mode: 'campaign', node: 'e2', coop: true });
    out.e2 = { heroes: SC.F.filter(f => f.team === 0).map(f => `${f.ctrl}:${f.slot}:${f.name}`), solo, coop: hpMul() };
    SC.start({ mode: 'campaign', node: 'e1', coop: true }); out.e1 = foes().length;
    SC.start({ mode: 'campaign', node: 'es', coop: true });   // a group of 3 gets a 4th foe: never on Player 2's spot (spawn 4)
    const p2 = SC.F[1].P[2]; out.es = foes().length === 4 && foes().every(f => Math.hypot(f.P[2].x - p2.x, f.P[2].y - p2.y) > 60);
    // The node card's button: Player 2 picks a loadout (not the Versus CPU's), then the walk, dialogue and the fight
    // with two heroes; a win saves stars as usual.
    MENU.mode = 'versus'; MENU.loadouts[1] = { weapon: 'rocket', hat: 'random', persona: 'grizz', skills: ['random', 'random'] };
    store.set('quest', { at: 'e1', stars: {}, seen: {}, tree: {} }); toMenu(); openScreen('campaign', 'menu');
    document.querySelector('#campaign .ci-coop').click();
    out.pick = { screen: UI.screen, picker: LO.picker, tabs: [...document.querySelectorAll('#loadout .player-tabs button')].map(b => b.textContent).join('|'),
      go: (document.querySelector('#loadout .sheet-foot .go') || {}).textContent };
    LO.tab = 'weapon'; LO.cat = 'all'; LO.query = ''; refreshScreen();
    document.querySelector('#loadout [data-key="w-spear"]').click();
    document.querySelector('#loadout .sheet-foot .go').click();
    out.dialogue = !!CAMP_UI.dlg;
    if (CAMP_UI.dlg) CAMP_UI.dlg.querySelector('.dlg-skip').click();
    out.started = { state: SC.G.state, coop: !!SC.G.cfg.coop, heroes: SC.F.filter(f => f.team === 0 && f.ctrl === 'human').length,
      p2: SC.F[1] && SC.F[1].wkey + ' ' + SC.F[1].hat, mode: MENU.mode };
    SC.quest.win(); SC.sim(5);
    out.won = { state: SC.G.state, stars: campSave().stars.e1, title: SC.G.result && SC.G.result.title };
    return out;
  });
  const ratio = r.e2.coop[0] / r.e2.solo[0];
  const ok = check(r.e2.heroes.join() === 'human:0:Finn,human:1:Dad', `2p co-op quest: heroes ${r.e2.heroes}`)
    & check(Math.abs(ratio - 1.4) < .02, `2p co-op quest: lone foe health ×${ratio.toFixed(2)}`)
    & check(r.e1 === 3 && r.es, `2p co-op quest: e1 foes ${r.e1}, es spawns clear of Player 2 ${r.es}`)
    & check(r.pick.screen === 'loadout' && r.pick.picker === 1 && r.pick.tabs === 'Player 1|Player 2' && r.pick.go === 'Fight ▸', `2p co-op quest: P2 picker ${JSON.stringify(r.pick)}`)
    & check(r.dialogue && r.started.state === 'play' && r.started.coop && r.started.heroes === 2 && r.started.p2 === 'spear none' && r.started.mode === 'versus',
      `2p co-op quest: node card ${JSON.stringify(r.started)}`)
    & check(r.won.state === 'over' && r.won.stars >= 1, `2p co-op quest: win saved ${JSON.stringify(r.won)}`)
    & check(!errors.length, '2p co-op quest errors: ' + errors.join(' | '));
  rows.push({ kind: '2p', key: 'co-op quest', ok: !!ok, note: `2 heroes; lone foe ×${ratio.toFixed(2)} health; pair + 1 foe; ${r.won.title}` });
  await ctx.close();
}

async function testVote(browser, { check, rows, SHOTS }) {
  const res = [];
  for (const [w, h] of SIZES) {
    const { ctx, page, errors } = await open(browser, [w, h]);
    await page.evaluate(() => { __2.names('Finn', 'Dad'); SC.start({ mode: 'pvp', map: 'dojo', silly: 'vote', killcam: false, minigames: false }); });
    // The world waits, frozen, while the players vote (nothing can carry a waiting fighter off); the vote shows from then on.
    await page.waitForFunction(() => SC.G.override === sillyHold, null, { timeout: 3000 }).catch(() => {});
    const open0 = await page.evaluate(() => ({ open: VOTE.open, shown: !!document.querySelector('.vote:not([hidden]) .vote-opt') }));
    const frozen = await page.evaluate(async () => { const t0 = MAP.t, x0 = SC.F[0].P[2].x; await new Promise(r => setTimeout(r, 300));
      return { held: SC.G.override === sillyHold, still: MAP.t === t0 && SC.F[0].P[2].x === x0 }; });
    // In a lobby's seat order (JOINED) a player's own keys move their cursor: here P1 joined with the arrow keys.
    const seats = await page.evaluate(() => { JOINED = [{ keys: 1 }, { keys: 0 }];
      for (const type of ['keydown', 'keyup']) dispatchEvent(new KeyboardEvent(type, { code: 'ArrowRight' }));
      const cur = VOTE.cur.join(); JOINED = null; VOTE.cur = [1, 1]; sillyRender(); return cur; });
    await page.evaluate(() => { VOTE.opts = ['giant', 'slippery', 'lowgrav']; sillyRender(); });
    await page.keyboard.press('KeyD');                         // P1: cursor to Slippery Floor
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `2p-vote-${w}.png`) });
    await page.keyboard.press('KeyA'); await page.keyboard.press('KeyA');   // P1 back to Giant Heads, then picks it
    await page.keyboard.press('KeyS');
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowDown');   // P2: Giant Heads too
    await page.waitForTimeout(200);
    // Giant Heads: the head hitbox grows with the drawing (a shot 26 px above the head centre hits), for that round only.
    await page.evaluate(() => { window.__headShot = () => { const B = SC.F[1], c = B.P[0], hp = B.hp; PROJ.length = 0; B.inv = 0;
      spawnProj({ owner: SC.F[0], x: c.x - 60, y: c.y - 26, vx: 1400, vy: 0, r: 4, dmg: 5, life: .3 }); for (let k = 0; k < 12; k++) stepProjectiles(1 / 120);
      PROJ.length = 0; return hp - B.hp; }; });
    const r = await page.evaluate(() => ({ open: VOTE.open, rule: SILLY_ON && SILLY_ON.key, held: !!SC.G.override, heads: SC.F.map(f => f.headMul), hidden: !document.querySelector('.vote:not([hidden])'),
      hit: __headShot() > 0 }));
    const next = await page.evaluate(() => { SC.G.lock = 0; __2.ko(SC.F[1], SC.F[0]); SC.sim(TUNE.koDelay + .3);
      return { round: SC.G.round, open: VOTE.open, rule: SILLY_ON, heads: SC.F.map(f => f.headMul || 1), hit: __headShot() > 0 }; });
    // Different picks: one of the two wins. No picks: the timer chooses.
    const mixed = await page.evaluate(() => { VOTE.opts = ['bouncy', 'zoom', 'reverse']; sillyInput(0, 'left'); sillyInput(0, 'ok'); sillyInput(1, 'right'); sillyInput(1, 'ok');
      SC.sim(.05); const k = SILLY_ON && SILLY_ON.key; __2.ko(SC.F[0], SC.F[1]); SC.sim(TUNE.koDelay + .3); SC.sim(SILLY_TIME + .2);
      const timed = !VOTE.open && !!SILLY_ON;
      // A party mini-game round (pvp, round 2): no vote until the real round after it.
      SC.start({ mode: 'pvp', map: 'dojo', silly: 'vote', killcam: false, minigames: true }); SC.sim(SILLY_TIME + .2); SC.G.lock = 0;
      __2.ko(SC.F[1], SC.F[0]); SC.sim(TUNE.koDelay + .3);
      const mini = !!MINI && !MINI.over && !VOTE.open;
      miniFinish();
      return { k, timed, mini, after: VOTE.open && SC.G.round === 2 }; });
    res.push({ w, ok: open0.open && open0.shown && frozen.held && frozen.still && seats === '2,1' && !r.held && !r.open && r.rule === 'giant' && r.heads.every(x => x === 2.4) && r.hidden && r.hit
      && next.round === 2 && next.open && !next.rule && next.heads.every(x => x === 1) && !next.hit && ['bouncy', 'reverse'].includes(mixed.k) && mixed.timed && mixed.mini && mixed.after && !errors.length,
    detail: { open0, frozen, seats, r, next, mixed, errors } });
    await ctx.close();
  }
  const ok = check(res.every(x => x.ok), '2p vote: ' + JSON.stringify(res.filter(x => !x.ok).map(x => x.detail)));
  rows.push({ kind: '2p', key: 'silly vote', ok: !!ok, note: 'keys of both players (lobby order too) → Giant Heads (bigger head hitbox) for round 1 only; split picks drawn; timer picks' });
}

async function testTagTeam(browser, { check, rows, SHOTS }) {
  const res = [];
  for (const [w, h] of SIZES) {
    const { ctx, page, errors } = await open(browser, [w, h]);
    const r = await page.evaluate(() => {
      __2.names('Finn', 'Dad');
      SC.start({ mode: 'tagteam', map: 'dojo', weapons: ['katana', 'spear', 'battle-axe', 'mace'], killcam: false }); SC.G.lock = 0;
      // The fighters left per side, drawn by the mode's HUD in each player's colour (modeText is watched for one frame).
      const dots = () => { const said = [], keep = window.modeText; window.modeText = (c, t, x, y, s, col, ...a) => { said.push(t + ' ' + col); return keep(c, t, x, y, s, col, ...a); };
        SC.render(1 / 60); window.modeText = keep; return said.filter(t => /^[●○]+ /.test(t)).join(); };
      const out = { start: SC.F.map(f => f.wkey), colors: SC.F.map(f => f.color), dots: dots() };
      __2.ko(SC.F[1], SC.F[0]); SC.sim(.5);
      out.waiting = { ending: SC.G.ending, alive: SC.F[1].alive };
      SC.sim(.6);
      out.tagged = { ending: SC.G.ending, w: SC.F[1].wkey, alive: SC.F[1].alive, inv: SC.F[1].inv, name: SC.F[1].name, color: SC.F[1].color, dots: dots() };
      SC.render(1 / 60);
      return out;
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, `2p-tag-${w}.png`) });
    const r2 = await page.evaluate(() => {
      SC.F[1].inv = 0; __2.ko(SC.F[1], SC.F[0]); SC.sim(.1);
      const out = { ending: SC.G.ending, winner: SC.G.winner, score: SC.G.score.slice() };
      SC.sim(TUNE.koDelay + .5); out.round2 = { round: SC.G.round, w: SC.F.map(f => f.wkey) };
      SC.start({ mode: 'tagcpu', map: 'dojo', weapons: ['katana', 'spear', 'battle-axe', 'mace'], killcam: false }); SC.G.lock = 0;
      out.cpu = { ctrl: SC.F.map(f => f.ctrl), keys: bindsFor(0).length };
      __2.ko(SC.F[1], SC.F[0]); SC.sim(1.2); out.cpu.tag = [SC.F[1].wkey, SC.F[1].ctrl, SC.F[1].alive, SC.G.ending];
      // The first K.O. leaves a partner waiting: a mid-round K.O.'s hit-stop and slow-mo, no zoom, "K.O.!" called; the
      // partner gets the match mutators; the last K.O. decides the round as before.
      SC.start({ mode: 'tagteam', map: 'dojo', weapons: ['katana', 'spear', 'battle-axe', 'mace'], killcam: false, mutators: ['sudden', 'bigheads'] }); SC.G.lock = 0;
      const fx = () => { const o = { stop: +FX.hitstop.toFixed(3), slow: +FX.slow.toFixed(2), zoom: CAM.focusT > 0 }; Object.assign(FX, { hitstop: 0, slow: 0 }); CAM.focusT = 0; return o; };
      fx(); ANN.log.length = 0;
      __2.ko(SC.F[1], SC.F[0]); out.first = Object.assign(fx(), { ann: ANN.log.map(a => a.text).join() });
      SC.sim(1.2); out.partner = { w: SC.F[1].wkey, taken: SC.F[1].dmgTakenMul, head: SC.F[1].headMul };
      __2.ko(SC.F[1], SC.F[0]); out.last = fx();
      return out;
    });
    const dots = (a, b) => `${a} ${r.colors[0]},${b} ${r.colors[1]}`;   // each side's dots in its player's colour
    res.push({ w, r, r2, errors, ok: r.start.join() === 'katana,battle-axe' && !r.waiting.ending && r.tagged.alive && r.tagged.w === 'mace' && !r.tagged.ending
      && r.tagged.inv > .5 && r.tagged.name === 'Dad' && r.tagged.color === r.colors[1] && r.dots === dots('●●', '●●') && r.tagged.dots === dots('●●', '●○')
      && r2.first.stop > 0 && r2.first.stop < r2.last.stop && r2.first.slow < r2.last.slow && !r2.first.zoom && r2.last.zoom && /K\.O\.!/.test(r2.first.ann)
      && r2.partner.w === 'mace' && r2.partner.taken === 2.5 && r2.partner.head === 1.9 && r2.ending && r2.winner === 0 && r2.score.join() === '1,0'
      && r2.round2.round === 2 && r2.round2.w.join() === 'katana,battle-axe' && r2.cpu.ctrl.join() === 'human,cpu' && r2.cpu.keys === 2
      && r2.cpu.tag.join() === 'mace,cpu,true,false' && !errors.length });
    await ctx.close();
  }
  const ok = check(res.every(x => x.ok), '2p tag team: ' + JSON.stringify(res.filter(x => !x.ok)));
  rows.push({ kind: '2p', key: 'tag team', ok: !!ok, note: 'battle-axe K.O. → mace tags in (protected, own colour, mutators; a mid-round K.O.); round ends when both are down; vs CPU' });
}

async function testRoundLength(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  const r = await page.evaluate(() => {
    const at = cfg => { SC.start(Object.assign({ map: 'dojo', classes: ['none', 'none'] }, cfg)); return { hp: SC.F.map(f => f.maxHp), t: SC.G.roundLimit }; };
    const out = { short: at({ mode: 'pvp', roundLen: 'short' }), normal: at({ mode: 'pvp', roundLen: 'normal' }), long: at({ mode: 'pvp', roundLen: 'long' }),
      none: at({ mode: 'pvp' }), quest: at({ mode: 'campaign', node: 'e2', roundLen: 'short' }).hp[0], questBase: at({ mode: 'campaign', node: 'e2' }).hp[0] };
    MENU.mode = 'ctf'; out.ctfMenu = menuCfg().roundLen; MENU.mode = 'pvp'; out.pvpMenu = menuCfg().roundLen;
    // A respawn keeps the short health and gets the match mutators, once (Sudden Death: ×2.5, not ×6.25).
    SC.start({ mode: 'ctf', roundLen: 'short', autopilot: true, classes: ['none'], mutators: ['sudden'] }); SC.G.lock = 0;
    const id = SC.F[0].id, f0 = SC.F[0]; __2.ko(SC.F[0]); SC.sim(4); const back = SC.F.find(f => f.id === id);
    out.respawn = back.maxHp; out.respawnMut = back !== f0 && back.dmgTakenMul === 2.5;
    SC.start({ mode: 'juggernaut', mutators: ['sudden'], killcam: false });   // the giant is crowned inside onRoundStart
    out.jugg = SC.F.map(f => f.dmgTakenMul).every(m => m === 2.5);
    // Lobby party modes (two keyboard players in Soccer): no handicap, no silly vote and no rivalry record.
    __2.names('Finn', 'Dad'); MENU.mode = 'soccer'; LOBBY.list = [{ keys: 0 }, { keys: 1 }]; MENU.crowd = Object.assign({}, MENU.crowd, { soccer: 2 });
    const pc = menuCfg(); startMatch(pc); SC.sim(.1);
    out.party = { cfg: 'handicap' in pc || 'silly' in pc, humans: SC.G.roster.filter(r => r.ctrl === 'human').length, vote: VOTE.open, pair: duoPair() };
    setState('over'); out.party.rec = !!(duoSettle() || duoRec('P1', 'P2')); LOBBY.list = [];
    toMenu(); MENU.mode = 'pvp'; openScreen('maps', 'modes');
    out.field = !!document.querySelector('#maps [data-key="Round length-long"]');
    return out;
  });
  const base = r.normal.t;
  const ok = check(r.short.hp.join() === '70,70' && Math.abs(r.short.t - base * .7) < 1e-6, `2p round length: short ${JSON.stringify(r.short)}`)
    & check(r.long.hp.join() === '160,160' && Math.abs(r.long.t - base * 1.6) < 1e-6, `2p round length: long ${JSON.stringify(r.long)}`)
    & check(r.none.hp.join() === '100,100' && r.none.t === base, `2p round length: none ${JSON.stringify(r.none)}`)
    & check(r.quest === r.questBase && r.quest === 130, `2p round length: the campaign hero ${r.quest} vs ${r.questBase}`)
    & check(r.ctfMenu === 'short' && r.pvpMenu === 'normal', `2p round length: defaults ${r.ctfMenu}/${r.pvpMenu}`)
    & check(r.respawn === 70 && r.respawnMut && r.jugg, `2p round length: respawn ${r.respawn}, mutators ${r.respawnMut}, Juggernaut ${r.jugg}`)
    & check(!r.party.cfg && r.party.humans === 2 && !r.party.vote && !r.party.pair && !r.party.rec, `2p lobby party mode: ${JSON.stringify(r.party)}`)
    & check(r.field, '2p round length: no field on the arena screen')
    & check(!errors.length, '2p round length errors: ' + errors.join(' | '));
  rows.push({ kind: '2p', key: 'round length', ok: !!ok, note: `health 70/100/160, time ${r.short.t}/${base}/${r.long.t} s; party default Short; respawns get mutators once; lobby Soccer: no duo extras` });
  await ctx.close();
}

// The 2-player setup and the results card with the rivalry line, at both sizes.
async function shots(browser, { check, rows, SHOTS }) {
  let ok = true;
  for (const [w, h] of SIZES) {
    const { ctx, page, errors } = await open(browser, [w, h]);
    await page.evaluate(() => { __2.names('Finn', 'Dad'); const rec = duoRec('Finn', 'Dad', true);
      Object.assign(rec, { w: [9, 7], last: 'abaaabbaaa', streak: [0, 3], total: 16 }); duoSave();   // rec.n: Dad, Finn
      MENU.mode = 'pvp'; openScreen('maps', 'modes'); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `2p-setup-${w}.png`) });
    const setup = await page.evaluate(() => { const p = document.querySelector('#maps .duo-panel'), b = p && p.getBoundingClientRect();
      return { text: p && p.textContent, top: b && b.top, inView: !!b && b.bottom < innerHeight }; });
    await page.evaluate(() => { SC.start({ mode: 'pvp', map: 'dojo', weapons: ['katana', 'spear'], killcam: false }); window.__blow = __2.blow(); });
    const toasts = await resultsToasts(page);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, `2p-results-${w}.png`) });
    const res = await page.evaluate(() => ({ line: (document.querySelector('#over .duo-res') || {}).textContent,
      order: [...document.querySelectorAll('#over .row button')].map(b => [b.getBoundingClientRect(), b.textContent]).sort(([a], [b]) => a.top - b.top || a.left - b.left).map(x => x[1]) }));
    ok = check(/Finn 7 – 9 Dad · Dad on a 3-win streak/.test(setup.text || '') && /Handicap/.test(setup.text) && /Silly rules/.test(setup.text) && setup.inView,
      `2p setup ${w}: ${JSON.stringify(setup)}`)
      & check(res.line === 'Head-to-head: Finn 8 – 9 Dad', `2p results ${w}: "${res.line}"`)
      & check(res.order[0] === 'Rematch' && res.order[1] === 'Rematch · new weapons', `2p results ${w}: buttons ${res.order}`)
      & check(toasts.ok, `2p results ${w}: toasts ${JSON.stringify(toasts)}`)
      & check(!errors.length, `2p shots ${w} errors: ` + errors.join(' | ')) && ok;
    await ctx.close();
  }
  rows.push({ kind: '2p', key: 'screens', ok: !!ok, note: '2p-setup / 2p-vote / 2p-tag / 2p-results × 1280x720, 1194x834' });
}

async function run(browser, ctx) {
  fs.mkdirSync(ctx.SHOTS, { recursive: true });
  for (const t of [testRivalry, testStores, testHandicap, testNotices, testQuickRematch, testCoopWaves, testCoopQuest, testVote, testTagTeam, testRoundLength, shots]) {
    try { await t(browser, ctx); } catch (e) { ctx.check(false, `2p ${t.name} crashed: ${e.message}`); }
  }
}
module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const browser = await chromium.launch(), failures = [], rows = [], t0 = Date.now();
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    try { await run(browser, { check, rows, SHOTS: path.join(ROOT, 'tmp', 'smoke') }); } finally { await browser.close(); }
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`2P FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`2P OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
