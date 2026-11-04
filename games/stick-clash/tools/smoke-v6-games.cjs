// Smoke tests for the v6 two-player games (agent M2): Volley Clash, Paint Wars, Tower Race, Boss Raid: The Colossus,
// Defend the Core, and the Coin Rush and Last Platform mini-games. Called by tools/smoke.cjs; also runs on its own
// (`node tools/smoke-v6-games.cjs`, after `node build.mjs`). Headless SC sims with seeded Math.random:
// - every mode runs to its end with CPUs filling seats (Players: 1) and with both human slots autopiloted, and scores
//   correctly (the winner is the side that met the goal); Short/Long round length changes goals, towers and clocks;
// - the team versions (4 fighters), the tower's scrolling world (no ring-outs, checkpoints claimed), the Colossus's
//   phases in order (cannons before the core), Defend the Core's waves, final rush and repair orbs;
// - both mini-games finish, score and hand back a fresh round, on a floored and a bottomless arena;
// - the rivalry line (counted once), the co-op MVP line, quit mid-match and quick rematch, the arena screen's rules
//   panel and Players choice, How to Play, no errors; screenshots at 1920x1080 and 1536x864@1.25 in tmp/smoke/v6-*.png.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const MODES = ['volley', 'paint', 'tower', 'raid', 'defend'], MINIS = ['coinrush', 'lastplatform'];

async function openPage(browser, viewport = { width: 1280, height: 720 }, dpr = 1) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: dpr }), errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(HELPERS);
  return { page, errors };
}

// Page-side helpers: a seeded start, and a run to the end of the match with a summary of what happened.
const HELPERS = () => {
  window.__V = {
    seed(n) {
      for (const k in AI_MOVES) delete AI_MOVES[k];
      for (const k in CLASH_T) delete CLASH_T[k];
      let s = n * 7919;
      Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      SC.G.t = 1000;
    },
    nan: () => SC.F.some(f => f.P.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) || PROJ.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)),
    // Runs a seeded match to its end (or cap seconds); each(run, t) may look at the mode's state every second.
    play(cfg, seed, cap = 420, each) {
      __V.seed(seed);
      const e0 = SC.errors.length, out = { kos: { ringout: 0 }, nan: false };
      const off = on('ko', (v, k, o) => { if (o && o.kind === 'ringout') out.kos.ringout++; });
      SC.start(cfg);
      for (let t = 0; t < cap && SC.G.state !== 'over'; t++) { SC.sim(1); if (each) each(SC.G.info.run || {}, t); if (__V.nan()) { out.nan = true; break; } }
      off();
      for (let k = 0; k < 3; k++) SC.render(1 / 60);
      const r = SC.G.result || {};
      return Object.assign(out, { state: SC.G.state, title: r.title, won: r.won, lines: r.lines || [], winner: SC.G.winner, reason: SC.G.endReason,
        score: SC.G.score.slice(), t: SC.G.t, fighters: SC.F.filter(f => !f.summon).length, humans: SC.G.roster.filter(x => x.ctrl === 'human').length,
        errors: SC.errors.slice(e0).map(e => e.msg) });
    },
  };
};

// Each mode to its end, with CPUs in the second seat and with both seats autopiloted; checks the scoring.
async function testModes(page, { check, rows }) {
  const res = await page.evaluate(MODES => {
    const out = [], arg = (a, i) => a.indexOf(Math.max(...a)) === i;
    for (const k of MODES) for (const [label, cfg] of [['cpu seat', { humans: 1 }], ['2 humans', {}], ['4 fighters', { fighters: 4 }]]) {
      if (label === '4 fighters' && (k === 'raid' || k === 'defend')) cfg.fighters = 3;
      const seen = { phases: [], waves: new Set(), rush: false, cps: 0, scroll: 0, coverage: 0, repairs: 0, kills: 0, partsBefore: true };
      const r = __V.play(Object.assign({ mode: k, autopilot: true }, cfg), k.length * 13 + label.length, 420, run => {
        if (k === 'tower' && run.tower) { seen.scroll = Math.max(seen.scroll, run.scroll); seen.cps = Math.max(seen.cps, Object.keys(run.cp).length); }
        if (k === 'raid' && run.arms) { if (!seen.phases.includes(run.phase)) seen.phases.push(run.phase); if (run.phase === 1 && run.core.hp < run.core.maxHp) seen.partsBefore = false; }
        if (k === 'defend' && run.core) { seen.waves.add(run.wave); seen.rush = seen.rush || run.rush; seen.repairs = run.repairs; seen.kills = run.kills; }
        if (k === 'paint' && run.segs) seen.coverage = Math.max(seen.coverage, run.count[0] + run.count[1]);
      });
      const run = SC.G.info.run || {};
      let score = true, note = '';
      if (k === 'volley') { score = Math.max(...run.pts) === vcGoal() && arg(run.pts, r.winner); note = `points ${run.pts.join('-')}, spikes ${Object.values(run.spikes).reduce((a, b) => a + b, 0)}`; }
      if (k === 'paint') { score = r.winner === (run.count[0] === run.count[1] ? -1 : run.count[0] > run.count[1] ? 0 : 1) && seen.coverage > run.total * .3; note = `cover ${run.count.join('/')} of ${run.total}`; }
      if (k === 'tower') { score = Math.max(...r.score) === 2 && seen.scroll > 600 && seen.cps > 0 && r.kos.ringout === 0; note = `races ${r.score.join('-')}, scroll ${Math.round(seen.scroll)}, checkpoints ${seen.cps}, ring-outs ${r.kos.ringout}`; }
      if (k === 'raid') { score = (r.won ? seen.phases.join() === '1,2,3' && !F.includes(run.core) && r.reason === 'boss' && r.winner === 0 : r.reason === 'wipe') && seen.partsBefore; note = `${r.won ? 'won' : 'lost'} in ${Math.round(run.t)} s, phases ${seen.phases.join('>')}`; }
      if (k === 'defend') { score = seen.waves.size >= 2 && seen.kills > 5 && (r.won ? seen.rush && seen.waves.size === 6 && F.includes(run.core) && r.reason === 'time' : !F.includes(run.core) && r.reason === 'core'); note = `${r.won ? 'saved' : 'shattered'}, waves ${[...seen.waves].join('')}, rush ${seen.rush}, kills ${seen.kills}, repairs ${seen.repairs}`; }
      out.push(Object.assign(r, { k, label, score, note }));
    }
    return out;
  }, MODES);
  for (const r of res) {
    const ok = check(!r.errors.length, `v6 ${r.k} (${r.label}): errors ${r.errors.join(' | ')}`)
      & check(!r.nan, `v6 ${r.k} (${r.label}): NaN positions`)
      & check(r.state === 'over' && !!r.title, `v6 ${r.k} (${r.label}): no result after the cap (state ${r.state})`)
      & check(r.score, `v6 ${r.k} (${r.label}): scoring wrong: ${r.note}`)
      & check(r.humans === (r.label === 'cpu seat' ? 1 : 2), `v6 ${r.k} (${r.label}): ${r.humans} human seats`);
    rows.push({ kind: 'v6 mode', key: `${r.k} · ${r.label}`, ok: !!ok, note: `${r.title} · ${r.note}` });
  }
}

// Round length: Volley's goal, the tower's height and the clocks follow Short/Normal/Long.
async function testRoundLength(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const out = {};
    for (const len of ['short', 'long']) {
      __V.seed(len.length);
      SC.start({ mode: 'volley', autopilot: true, roundLen: len }); out['volley ' + len] = vcGoal();
      SC.start({ mode: 'tower', autopilot: true, roundLen: len }); out['tower ' + len] = SC.G.info.run.tower.tall;
      SC.start({ mode: 'defend', autopilot: true, roundLen: len }); out['defend ' + len] = Math.round(SC.G.roundLimit);
      SC.start({ mode: 'paint', autopilot: true, roundLen: len }); out['paint ' + len] = Math.round(SC.G.roundLimit);
    }
    out.short = __V.play({ mode: 'volley', autopilot: true, roundLen: 'short' }, 3, 300);
    out.shortPts = SC.G.info.run.pts.slice();
    return out;
  });
  const ok = check(r['volley short'] === 5 && r['volley long'] === 11, `v6 round length: volley goals ${r['volley short']}/${r['volley long']}`)
    & check(r['tower short'] < 2600 && r['tower long'] > 4000, `v6 round length: tower heights ${r['tower short']}/${r['tower long']}`)
    & check(r['defend short'] === 126 && r['defend long'] === 288 && r['paint short'] === 42 && r['paint long'] === 96, `v6 round length: clocks ${r['defend short']}/${r['defend long']} ${r['paint short']}/${r['paint long']}`)
    & check(r.short.state === 'over' && Math.max(...r.shortPts) === 5 && !r.short.errors.length, `v6 round length: a Short volley match ended ${r.shortPts.join('-')}`);
  rows.push({ kind: 'v6', key: 'round length', ok: !!ok, note: `volley 5/7/11, tower ${r['tower short']}/${r['tower long']}, defend ${r['defend short']}/${r['defend long']} s` });
}

// The mini-games: each finishes, scores and hands back a fresh round, on a floored and a bottomless arena.
async function testMinis(page, { check, rows }) {
  const res = await page.evaluate(MINIS => {
    const out = [];
    for (const k of MINIS) for (const [map, n] of [['dojo', 2], ['sky', 4], ['neon', 3]]) {
      __V.seed(k.length + n);
      const e0 = SC.errors.length;
      SC.start({ mode: n > 2 ? 'ffa' : 'pvp', autopilot: true, minigames: true, map, fighters: n });
      SC.G.state = 'play'; SC.G.round = 2; miniStart(2, k); SC.G.lock = 0;
      const m = MINI, tiles0 = k === 'lastplatform' ? m.data.tiles.length : 0;
      let outs = 0, coins = 0;
      for (let t = 0; t < MINIS_TIME[k] + 1 && !m.over; t += .5) { SC.sim(.5); if (k === 'coinrush') coins = Math.max(coins, m.pts.reduce((a, b) => a + b, 0)); else outs = Object.keys(m.data.out).length; }
      SC.render(1 / 60);
      const left = k === 'lastplatform' ? m.pts.map((p, i) => i).filter(i => m.data.out[i] == null) : [];   // the last one standing tops the scores
      out.push({ k, map, n, over: m.over, round: SC.G.round, state: SC.G.state, pts: m.pts.slice(), coins, outs, tilesLeft: k === 'lastplatform' ? m.data.tiles.length : 0, tiles0,
        topOk: left.length !== 1 || m.pts[left[0]] === Math.max(...m.pts),
        tileSolids: MAP.solids.filter(s => s.lastTile).length, frame: !MAP.frame || MAP.frame === MAPS[MAP.key].frame, errors: SC.errors.slice(e0).map(e => e.msg) });
    }
    return out;
  }, MINIS).catch(e => [{ k: 'minis', errors: [e.message] }]);
  for (const r of res) {
    const job = r.k === 'coinrush' ? r.coins > 0 : (r.tilesLeft < r.tiles0 || r.outs >= r.n - 1) && r.pts.some(p => p > 0);
    const ok = check(!r.errors.length, `v6 mini ${r.k} ${r.map}: errors ${(r.errors || []).join(' | ')}`)
      & check(r.over && r.round === 2 && r.state !== 'over', `v6 mini ${r.k} ${r.map}: did not hand back the round (over ${r.over}, round ${r.round})`)
      & check(job, `v6 mini ${r.k} ${r.map}: did nothing (pts ${r.pts}, tiles ${r.tilesLeft}/${r.tiles0}, outs ${r.outs})`)
      & check(r.tileSolids === 0 && r.frame, `v6 mini ${r.k} ${r.map}: left tiles or its frame hook behind`)
      & check(r.topOk !== false, `v6 mini ${r.k} ${r.map}: the last one standing did not top the scores (${r.pts})`);
    rows.push({ kind: 'v6 mini', key: `${r.k} · ${r.map} · ${r.n}`, ok: !!ok, note: `pts ${r.pts} ${r.k === 'lastplatform' ? `tiles ${r.tilesLeft}/${r.tiles0}, out ${r.outs}` : ''}` });
  }
}

// The rivalry line (head-to-head, counted once) when the players meet among CPUs; the co-op MVP line; quit and rematch.
async function testFlows(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const e0 = SC.errors.length, key = 'ann|bo';
    delete DUO.pairs[key];
    __V.seed(5);
    SC.start({ mode: 'volley', fighters: 4, names: ['Ann', 'Bo'] }); SC.G.lock = 0;
    modeRun().pts = [6, 2]; Object.assign(modeRun().ball, { hold: 0, x: 870, y: 600 });   // lands in Bo's court, out of the CPUs' reach
    SC.sim(5);
    const lines = (SC.G.result || {}).lines || [], rec = DUO.pairs[key], once = rec && rec.total;
    hook(SC.G.mode, 'results'); duoSettle();                                   // asking again must not count again
    const h2h = { line: lines.find(l => /Head-to-head/.test(l)), total: once, again: DUO.pairs[key].total, wins: DUO.pairs[key].w.slice(), state: SC.G.state };
    delete DUO.pairs[key]; duoSave();
    SC.start({ mode: 'raid', autopilot: true }); SC.sim(4);
    const quitErrors = SC.errors.length;
    startMatch(demoConfig()); SC.sim(2); SC.render(1 / 60);
    const quit = { errors: SC.errors.length - quitErrors, map: MAP.key, drawn: !SC.F.some(f => f.v6part) };
    const coop = __V.play({ mode: 'defend', autopilot: true, roundLen: 'short' }, 9, 300);
    const mvp = coop.lines.find(l => /Friendly rivalry/.test(l) && /MVP/.test(l));
    let rematch = false;
    if (SC.G.state === 'over') { quickRematch(); SC.sim(3); rematch = SC.G.mode.key === 'defend' && SC.G.state === 'play' && !!modeRun().core; }
    return { h2h, quit, mvp, rematch, errors: SC.errors.slice(e0).map(e => e.msg) };
  });
  const ok = check(r.h2h.line === 'Head-to-head: Ann 1 – 0 Bo' && r.h2h.total === 1 && r.h2h.again === 1, `v6 rivalry line: ${JSON.stringify(r.h2h)}`)
    & check(!!r.mvp, 'v6 co-op results: no MVP line')
    & check(r.quit.errors === 0 && r.quit.drawn, `v6 quit mid-raid: ${JSON.stringify(r.quit)}`)
    & check(r.rematch, 'v6 quick rematch of Defend the Core did not start')
    & check(!r.errors.length, 'v6 flows: errors ' + r.errors.join(' | '));
  rows.push({ kind: 'v6', key: 'rivalry, MVP, quit, rematch', ok: !!ok, note: `${r.h2h.line} · ${r.mvp}` });
}

// The arena screen's rules panel and Players choice (it reaches the match cfg), How to Play, the codex lore keys.
async function testMenus(page, { check, rows }) {
  const r = await page.evaluate(MODES => {
    const out = { panels: {}, keys: ['volley', 'paint', 'tower'].every(k => MODES_REG(k)) && ['coinrush', 'lastplatform'].every(k => !!MINIS[k]) };
    for (const k of MODES) {
      MENU.mode = k; openScreen('maps', 'modes');
      const p = PANELS.maps || document.querySelector('#maps');
      out.panels[k] = { help: !!p.querySelector('.v6-help li'), own: !!p.querySelector('.v6-own'), grid: !!p.querySelector('.map-grid'), seats: p.querySelectorAll('.v6-help .seg button').length };
    }
    MENU.mode = 'raid'; openScreen('maps', 'modes');
    (PANELS.maps || document).querySelector('.v6-help .seg button').click();
    out.solo = menuCfg().humans;
    MENU.v6humans = {}; saveMenu();
    openScreen('howto', 'menu');
    out.howto = [...document.querySelectorAll('.v6-howto li')].length;
    out.lore = ['beach', 'spire', 'colossus', 'corevault'].every(k => LORE_LINES.m[k]) && !!LORE_LINES.w['drone-blaster'];
    goBack();
    return out;
  }, MODES).catch(e => ({ error: e.message }));
  const ok = check(!r.error, 'v6 menus crashed: ' + r.error)
    && check(Object.values(r.panels).every(p => p.help && p.seats === 2), `v6 arena screen: ${JSON.stringify(r.panels)}`)
    & check(r.panels.volley.own && !r.panels.volley.grid && r.panels.paint.grid && !r.panels.paint.own, 'v6 arena screen: own-arena card wrong')
    & check(r.solo === 1, 'v6 Players choice did not reach the cfg')
    & check(r.howto === 7, `v6 How to Play rows ${r.howto}`)
    & check(r.keys && r.lore, 'v6 mode keys or lore missing');
  rows.push({ kind: 'v6', key: 'menus, help, keys, lore', ok: !!ok, note: `how-to rows ${r.howto}` });
}

// Screenshots of every mode in play, the arena screen and a results card, at 1920x1080 and 1536x864 @1.25.
async function shots(browser, { check, rows, SHOTS }) {
  const dir = SHOTS || path.join(ROOT, 'tmp', 'smoke');
  fs.mkdirSync(dir, { recursive: true });
  for (const [w, h, dpr] of [[1920, 1080, 1], [1536, 864, 1.25]]) {
    const { page, errors } = await openPage(browser, { width: w, height: h }, dpr), tag = `${w}x${h}`;
    for (const [k, secs] of [['volley', 9], ['paint', 20], ['tower', 14], ['raid', 12], ['defend', 70]]) {
      await page.evaluate(([k, secs]) => { __V.seed(11); SC.start({ mode: k, autopilot: true }); SC.sim(secs); BANNER = null; }, [k, secs]);
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(dir, `v6-${k}-${tag}.png`) });
    }
    await page.evaluate(() => { __V.seed(2); SC.start({ mode: 'watch', minigames: true, map: 'neon', fighters: 3 }); SC.G.round = 2; miniStart(2, 'lastplatform'); SC.G.lock = 0; SC.sim(4); BANNER = null; });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(dir, `v6-lastplatform-${tag}.png`) });
    await page.evaluate(() => { __V.seed(3); SC.start({ mode: 'watch', minigames: true, map: 'dojo' }); SC.G.round = 2; miniStart(2, 'coinrush'); SC.G.lock = 0; SC.sim(5); BANNER = null; });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(dir, `v6-coinrush-${tag}.png`) });
    await page.evaluate(() => { startMatch(demoConfig()); MENU.mode = 'raid'; openScreen('maps', 'modes'); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(dir, `v6-arena-screen-${tag}.png`) });
    await page.evaluate(() => { __V.play({ mode: 'raid', autopilot: true }, 4, 400); });
    await page.waitForTimeout(2500);
    await page.keyboard.press('Escape').catch(() => {});                       // skip a kill-cam replay if one plays
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(dir, `v6-results-${tag}.png`) });
    const ok = check(!errors.length, `v6 screenshots ${tag}: console ${[...new Set(errors)].join(' | ')}`);
    rows.push({ kind: 'v6', key: `screenshots ${tag}`, ok: !!ok, note: 'tmp/smoke/v6-*-' + tag + '.png' });
    await page.close();
  }
}

async function run(browser, ctx) {
  const { page, errors } = await openPage(browser);
  await page.evaluate(() => { window.MINIS_TIME = Object.fromEntries(Object.keys(MINIS).map(k => [k, MINIS[k].time])); window.MODES_REG = k => !!MODES[k]; });
  for (const t of [testModes, testRoundLength, testMinis, testFlows, testMenus]) {
    try { await t(page, ctx); } catch (e) { ctx.check(false, `v6 ${t.name} crashed: ${e.message}`); }
  }
  ctx.check(!errors.length, 'v6 games console: ' + [...new Set(errors)].join(' | '));
  await page.close();
  try { await shots(browser, ctx); } catch (e) { ctx.check(false, `v6 screenshots crashed: ${e.message}`); }
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const browser = await chromium.launch(), failures = [], rows = [], t0 = Date.now();
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    try { await run(browser, { check, rows, SHOTS: path.join(ROOT, 'tmp', 'smoke') }); } finally { await browser.close(); }
    console.table(rows.map(r => ({ kind: r.kind, key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`V6 GAMES FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`V6 GAMES OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
