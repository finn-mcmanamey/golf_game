// Smoke tests for v7 "juicier fights" (87c-juice-v7.js). Called by tools/smoke.cjs; also runs on its own
// (`node tools/smoke-v7-juice.cjs`, after `node build.mjs`), about a minute. Real (non-sim) steps with drawing, seeded:
// - impact tiers: light hits add nothing, heavy ones a glint + kick, crushing ones a starburst, speed lines, a zoom
//   punch, a comic word, a longer hit-stop and dizzy birds; seeded CPU fights land both tiers on their own;
// - finishers: every title (HOME RUN!, WIPEOUT!, SPLAT!, KABOOM!, SUPLEX!, CRUSHED!, WHOOPS!) reaches the K.O.
//   banner, the announcer log and the kill-cam tag; a plain K.O. keeps "K.O.";
// - streaks: the combo ladder (3 HIT / 5 HIT / FRENZY), DOUBLE K.O., ON FIRE after three rounds (aura next round),
//   COMEBACK from the brink, CLOSE CALL at 5 hp;
// - body gags: dizzy, flight scream, landing squash, BOING, the 5% ghost;
// - settings: reduced flashing skips zooms, kicks and flashes; "Comic callouts" off hides callouts but keeps tiers;
// - fairness: SC.sim logs nothing, and a seeded real-time fight ends the same with the callouts on or off;
// - screenshots at 1920x1080@1 and 1536x864@1.25 (tmp/smoke/v7j-*.png).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SHOTS_DIR = path.join(ROOT, 'tmp', 'smoke');

async function openPage(browser, viewport = { width: 1280, height: 720 }, scale = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await ctx.newPage(), errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(HELPERS);
  return { page, errors, ctx };
}

// Page-side helpers.
const HELPERS = () => {
  window.__J = {
    seed(n) {
      for (const k in AI_MOVES) delete AI_MOVES[k];
      for (const k in CLASH_T) delete CLASH_T[k];
      let s = n * 7919;
      Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    },
    // A still duel (CPUs idle) on a walled arena, real-time state, no start lock.
    duel(map = 'dojo', n = 2, winScore = 3) {
      SC.start({ mode: n > 2 ? 'ffa' : 'versus', map, weapons: Array(n).fill('blade'), classes: Array(n).fill('none'),
        skills: Array(n).fill(['none', 'none']), throws: Array(n).fill(['none', 'none']), orbs: false, winScore, killcam: true });
      SC.G.state = 'play'; SC.G.lock = 0;
      for (const f of SC.F) { f.ai.behave = 'idle'; f.ai.t = 1e9; }
      SETTINGS.reduceFlash = false; SETTINGS.fightGags = true; SETTINGS.announcer = 'synth'; SETTINGS.juice = 'normal';
      JZ.log.length = 0; JZ.stickers.length = 0; ANN.log.length = 0; CAM.punch = 0; FX.hitstop = 0;
      __J.steps(.3);
      return SC.F;
    },
    // Real steps (not SC.sim) with a frame drawn every other step, so the drawing hooks run too.
    steps(secs) {
      for (let k = 0, n = Math.round(secs / DT); k < n && !SC.G.override; k++) { worldStep(DT); if (k % 2) render(1 / 60); }
      render(1 / 60);
    },
    hit(A, B, amt, extra = {}) { return damage(B, amt, Object.assign({ src: A, kind: 'melee', nx: 1, ny: -.2, x: B.P[1].x, y: B.P[1].y }, extra)); },
    has: s => JZ.log.includes(s),
  };
};

async function testTiers(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const [A, B] = __J.duel();
    const out = {};
    __J.hit(A, B, 8); render(1 / 60);
    out.light = { log: JZ.log.slice(), bursts: JZ.bursts.length, kick: Math.hypot(JZ.kx, JZ.ky) };
    FX.hitstop = 0; __J.hit(A, B, 14); const heavyStop = FX.hitstop;
    out.heavy = { tier: __J.has('tier:heavy'), glint: JZ.bursts.some(b => b.tier === 2), kick: Math.hypot(JZ.kx, JZ.ky), stop: heavyStop };
    B.hp = 100; CAM.punch = 0; FX.hitstop = 0; __J.hit(A, B, 23); const crushStop = FX.hitstop; render(1 / 60);
    out.crush = { tier: __J.has('tier:crushing'), star: JZ.bursts.some(b => b.tier === 3), punch: CAM.punch, kick: Math.hypot(JZ.kx, JZ.ky),
      word: JZ.words.length > 0 && /!$/.test(JZ.words[JZ.words.length - 1].text), stop: crushStop, dizzy: B.jzDizzy > SC.G.t };
    JZ.log.length = 0; B.hp = 100; __J.hit(A, B, 6, { kind: 'skill', throw: true });
    out.throwCrush = __J.has('tier:crushing');
    // Seeded CPU fights land heavy and crushing hits on their own.
    let heavy = 0, crush = 0;
    for (let s = 1; s <= 3; s++) {
      __J.seed(s * 17);
      SC.start({ mode: 'watch', map: 'dojo', weapons: ['hammer', 'greatsword'], winScore: 99, orbs: false });
      SC.G.state = 'play'; JZ.log.length = 0;
      __J.steps(25);
      heavy += JZ.log.filter(x => x === 'tier:heavy').length; crush += JZ.log.filter(x => x === 'tier:crushing').length;
    }
    out.cpu = { heavy, crush };
    return out;
  });
  const ok = check(!r.light.log.some(s => s.startsWith('tier')) && r.light.bursts === 0, 'juice7: a light hit should add no tier effects')
    & check(r.heavy.tier && r.heavy.glint && r.heavy.kick > 2, `juice7: heavy hit glint/kick ${JSON.stringify(r.heavy)}`)
    & check(r.crush.tier && r.crush.star && r.crush.punch > .05 && r.crush.kick > 8 && r.crush.word && r.crush.dizzy,
      `juice7: crushing hit starburst/punch/kick/word/dizzy ${JSON.stringify(r.crush)}`)
    & check(r.crush.stop > r.heavy.stop + .02, `juice7: crushing hit-stop ${r.crush.stop} should beat heavy ${r.heavy.stop}`)
    & check(r.throwCrush, 'juice7: a grab throw should count as crushing')
    & check(r.cpu.heavy > 0 && r.cpu.crush > 0, `juice7: seeded CPU fights land heavy ${r.cpu.heavy} / crushing ${r.cpu.crush} hits`);
  rows.push({ kind: 'juice7', key: 'impact tiers', ok: !!ok, note: `hit-stop heavy ${(r.heavy.stop * 1000).toFixed(0)} ms, crushing ${(r.crush.stop * 1000).toFixed(0)} ms; CPU fights ${r.cpu.heavy} heavy / ${r.cpu.crush} crushing` });
}

async function testFinishers(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const out = {};
    const finish = (kind, setup) => {
      const [A, B] = __J.duel(kind === 'home' ? 'sky' : 'dojo');
      setup(A, B);
      __J.steps(.2);
      out[kind] = { banner: BANNER && BANNER.a, color: BANNER && BANNER.color, ann: ANN.log.map(l => l.text),
        kc: KC.lastKO && KC.lastKO.jzFinish ? KC.lastKO.jzFinish[0] : null, log: JZ.log.filter(s => s.startsWith('finisher')) };
    };
    const mid = (B, x = 640) => { moveFighter(B, x - B.P[2].x, 0); };
    finish('home', (A, B) => { moveFighter(B, -420 - B.P[2].x, -200); for (const p of B.P) setVel(p, -1500, -300); B.lastHitBy = A; B.lastHitT = SC.G.t; checkRingOuts(); });
    finish('wipe', (A, B) => { moveFighter(B, 0, H + 320 - B.P[2].y); for (const p of B.P) setVel(p, 0, 300); B.lastHitBy = A; B.lastHitT = SC.G.t; checkRingOuts(); });
    finish('splat', (A, B) => { moveFighter(B, 30 - chest(B).x, 0); B.hp = 5; __J.hit(A, B, 9, { nx: -1, ny: 0 }); });
    finish('boom', (A, B) => { mid(B); B.hp = 5; __J.hit(A, B, 9, { kind: 'explode' }); });
    finish('suplex', (A, B) => { mid(B); B.hp = 5; __J.hit(A, B, 9, { kind: 'skill', throw: true }); });
    finish('crush', (A, B) => { mid(B); B.hp = 10; __J.hit(A, B, 22); });
    finish('oops', (A, B) => { mid(B); B.hp = 3; damage(B, 5, { kind: 'hazard' }); });
    finish('ko', (A, B) => { mid(B); B.hp = 5; __J.hit(A, B, 8); });
    return out;
  });
  const want = { home: 'HOME RUN!', wipe: 'WIPEOUT!', splat: 'SPLAT!', boom: 'KABOOM!', suplex: 'SUPLEX!', crush: 'CRUSHED!', oops: 'WHOOPS!' };
  let ok = true;
  for (const [k, title] of Object.entries(want)) {
    const x = r[k];
    ok &= check(x && x.banner === title && x.kc === title && x.ann.some(t => t.toUpperCase() === title.toUpperCase()),
      `juice7 finisher ${k}: banner ${x && x.banner}, kill-cam ${x && x.kc}, announcer ${x && x.ann.join(', ')}`);
  }
  ok &= check(r.ko.banner === 'K.O.' && !r.ko.kc, `juice7 finisher: a plain K.O. keeps "K.O." (got ${r.ko.banner})`);
  rows.push({ kind: 'juice7', key: 'finishers', ok: !!ok, note: Object.keys(want).map(k => r[k] && r[k].banner).join(' ') });
}

async function testStreaks(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const out = {};
    let [A, B] = __J.duel();
    for (let k = 0; k < 9; k++) { B.hp = 100; SC.G.t += .2; __J.hit(A, B, 6); }
    out.ladder = JZ.log.filter(s => s.startsWith('callout')).slice();
    out.frenzyRender = (render(1 / 60), A.combo >= 8 && A.comboT > 0);
    // Close call: down to 4 hp in one hit.
    B.hp = 30; JZ.log.length = 0; __J.hit(A, B, 26, { kind: 'skill' });
    out.close = __J.has('callout:CLOSE CALL!') && JZ.words.some(w => w.text === 'CLOSE CALL!');
    // Comeback: A falls to 10% and still wins.
    [A, B] = __J.duel();
    A.hp = 10; jzTrackGap(A); B.hp = 5; __J.hit(A, B, 9); __J.steps(.2);
    out.comeback = JZ.log.includes('callout:COMEBACK!');
    // Double K.O. in a three-way brawl.
    const [X, Y, Z] = __J.duel('dojo', 3);
    Y.hp = 4; Z.hp = 4; __J.hit(X, Y, 8); SC.G.t += .5; __J.hit(X, Z, 8);
    out.double = __J.has('callout:DOUBLE K.O.!');
    // ON FIRE after three round wins in a row, with the aura in the next round.
    __J.duel('dojo', 2, 5);
    for (let round = 0; round < 3; round++) {
      const [P, Q] = SC.F; SC.G.lock = 0; Q.hp = 4; __J.hit(P, Q, 8);
      for (let k = 0; k < 600 && SC.G.round === round + 1; k++) worldStep(DT);
      SC.G.lock = 0;
    }
    out.fire = { log: __J.has('callout:ON FIRE!'), aura: SC.F[0].jzFire === 1 && !SC.F[1].jzFire, round: SC.G.round };
    render(1 / 60);
    return out;
  });
  const ok = check(['callout:3 HIT!', 'callout:5 HIT!', 'callout:FRENZY!'].every(s => r.ladder.includes(s)), `juice7: combo ladder ${r.ladder.join(', ')}`)
    & check(r.frenzyRender, 'juice7: a frenzy combo should draw its flames')
    & check(r.close, 'juice7: CLOSE CALL at 5 hp or less')
    & check(r.comeback, 'juice7: COMEBACK when the winner was far behind on health')
    & check(r.double, 'juice7: DOUBLE K.O. for two K.O.s in a row')
    & check(r.fire.log && r.fire.aura, `juice7: ON FIRE after three wins ${JSON.stringify(r.fire)}`);
  rows.push({ kind: 'juice7', key: 'streaks + callouts', ok: !!ok, note: r.ladder.join(' ') });
}

async function testBodies(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const out = {};
    const [A, B] = __J.duel();
    addStatus(B, 'stun', 1.5, 1, A); out.stun = __J.has('gag:dizzy') && B.jzDizzy > SC.G.t;
    render(1 / 60);
    // Launched: a long flight screams.
    moveFighter(A, 0, -300); for (const p of A.P) setVel(p, 1100, -900); A.lastHitT = SC.G.t;
    for (let k = 0; k < 60 && (k < 4 || !A.grounded); k++) { worldStep(DT); render(1 / 120); out.fly = Math.max(out.fly || 0, A.jzFly); }
    // A hard landing squashes; a bounce boings.
    __J.duel();
    const [C] = SC.F; JZ.log.length = 0;
    moveFighter(C, 0, -320); for (const p of C.P) setVel(p, 0, 1300);
    for (let k = 0; k < 120 && !__J.has('gag:squash'); k++) { worldStep(DT); render(1 / 120); }
    out.squash = __J.has('gag:squash');
    JZ.prevVy.set(C, 900); for (const p of C.P) setVel(p, 0, -900); C.flash = 0; C.jzBoingT = -9; render(1 / 60);
    out.boing = __J.has('gag:boing') && JZ.words.some(w => w.text === 'BOING!');
    // The rare ghost (forced here).
    const [D, E] = __J.duel(); JZ.forceGhost = true; E.hp = 3; __J.hit(D, E, 9); JZ.forceGhost = false; render(1 / 60);
    out.ghost = __J.has('gag:ghost') && JZ.ghosts.length === 1;
    // The roll itself lands near 5% over many K.O.s.
    let n = 0;
    for (let i = 0; i < 2000; i++) { SC.G.t = 1000 + i * .37; SC.G.round = 1 + i % 7; if (jzGhostRoll({ id: i % 8 })) n++; }
    out.ghostRate = n / 2000;
    return out;
  });
  const ok = check(r.stun, 'juice7: a long stun makes the fighter dizzy') & check(r.fly > .25, `juice7: a long flight screams (flight ${r.fly})`)
    & check(r.squash, 'juice7: a hard landing squashes the body') & check(r.boing, 'juice7: a bounce says BOING')
    & check(r.ghost, 'juice7: the K.O. ghost') & check(r.ghostRate > .03 && r.ghostRate < .07, `juice7: ghost rate ${r.ghostRate}`);
  rows.push({ kind: 'juice7', key: 'body gags', ok: !!ok, note: `ghost rate ${(r.ghostRate * 100).toFixed(1)}%` });
}

async function testSettings(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const out = {};
    let [A, B] = __J.duel();
    SETTINGS.reduceFlash = true; CAM.punch = 0;
    __J.hit(A, B, 23); B.hp = 5; __J.hit(A, B, 9); render(1 / 60);
    out.reduced = { bursts: JZ.bursts.length, punchFromJz: JZ.log.includes('tier:crushing'), kick: JZ.kx + JZ.ky, squash: PFX.squash.size };
    [A, B] = __J.duel();
    SETTINGS.fightGags = false;
    for (let k = 0; k < 6; k++) { B.hp = 100; SC.G.t += .2; __J.hit(A, B, 22); }
    out.noGags = { words: JZ.words.length, stickers: JZ.stickers.length, tiers: JZ.log.filter(s => s.startsWith('tier')).length };
    SETTINGS.fightGags = true;
    // Settings screen row.
    const node = SCREENS.settings();
    out.row = [...node.querySelectorAll('.set-group')].some(g => /Comic callouts/.test(g.textContent));
    return out;
  });
  const ok = check(r.reduced.bursts === 0 && r.reduced.kick === 0 && r.reduced.punchFromJz, `juice7: reduced flashing skips starbursts/kicks ${JSON.stringify(r.reduced)}`)
    & check(r.noGags.words === 0 && r.noGags.stickers === 0 && r.noGags.tiers === 6, `juice7: callouts off ${JSON.stringify(r.noGags)}`)
    & check(r.row, 'juice7: the Comic callouts row in Settings > Effects');
  rows.push({ kind: 'juice7', key: 'settings', ok: !!ok, note: 'reduced flashing + callouts off' });
}

async function testFairness(page, { check, rows }, browser) {
  const simLog = await page.evaluate(() => {
    JZ.log.length = 0;
    SC.start({ mode: 'watch', map: 'dojo', weapons: ['hammer', 'spear'], winScore: 99 }); SC.G.state = 'play';
    SC.sim(20);
    return JZ.log.length;
  });
  // The same seeded real-time fight on a fresh page each time (matches leave CPU memories behind), callouts on / off / on.
  const fight = async gags => {
    const { page: p, ctx } = await openPage(browser);
    const out = await p.evaluate(g => {
      // 83b's voices draw Math.random behind a wall-clock rate limit, so they are off for a repeatable fight.
      SETTINGS.voices = false; SETTINGS.fightGags = g; __J.seed(99); SC.G.t = 1000;
      SC.start({ mode: 'watch', map: 'dojo', weapons: ['hammer', 'greatsword'], winScore: 99, orbs: false }); SC.G.state = 'play';
      __J.steps(15);
      return JSON.stringify(SC.F.map(f => [f.hp, Math.round(f.P[2].x), Math.round(f.P[2].y), f.stats.hits]).concat(SC.G.score)) + ' log ' + JZ.log.length;
    }, gags);
    await ctx.close();
    return out;
  };
  const a = await fight(true), b = await fight(false), c = await fight(true), strip = x => x.replace(/ log \d+$/, '');
  const ok = check(simLog === 0, `juice7: SC.sim should log nothing (${simLog})`)
    & check(strip(a) === strip(b) && a === c, `juice7: a seeded fight must end the same with callouts on or off\n   ${a}\n   ${b}\n   ${c}`);
  rows.push({ kind: 'juice7', key: 'fairness', ok: !!ok, note: 'sim untouched; seeded fight identical with callouts on/off: ' + strip(a) });
}

// A finished match replays its deciding K.O. with the finisher in the tag; screenshots of the effects.
async function testShots(browser, { check, rows }) {
  const shots = [];
  for (const [vp, scale, tag] of [[{ width: 1920, height: 1080 }, 1, '1080'], [{ width: 1229, height: 691 }, 1.25, '864']]) {
    const { page, errors, ctx } = await openPage(browser, vp, scale);
    const shot = async name => { const p = path.join(SHOTS_DIR, `v7j-${name}-${tag}.png`); await page.screenshot({ path: p }); shots.push(path.relative(ROOT, p)); };
    // Crushing hit mid-air: starburst, speed lines, comic word, dizzy birds, a combo sticker.
    await page.evaluate(() => {
      const [A, B] = __J.duel('dojo');
      moveFighter(B, 700 - B.P[2].x, 0); moveFighter(A, 600 - A.P[2].x, 0); __J.steps(.2);
      for (let k = 0; k < 5; k++) { B.hp = 100; SC.G.t += .2; __J.hit(A, B, 6); }
      B.hp = 100; __J.hit(A, B, 24, { nx: 1, ny: -.4 });
      for (let k = 0; k < 4; k++) { worldStep(DT); }
      SC.G.state = 'paused'; BANNER = null; document.querySelectorAll('.toast').forEach(t => t.remove()); render(0);
    });
    await page.waitForTimeout(80); await shot('crush');
    // Flight scream + on-fire aura on the neon arena.
    await page.evaluate(() => {
      const [A, B] = __J.duel('neon'); A.jzFire = 1;
      jzSticker('ON FIRE!', '#ff7a2e', -1, A.name);
      moveFighter(B, 0, -260); for (const p of B.P) setVel(p, 1000, -700); B.lastHitT = SC.G.t;
      for (let k = 0; k < 50 && (B.jzFly || 0) < .45; k++) { worldStep(DT); render(1 / 120); }
      A.jzDizzy = SC.G.t + 2;
      SC.G.state = 'paused'; BANNER = null; document.querySelectorAll('.toast').forEach(t => t.remove()); render(0);
    });
    await page.waitForTimeout(80); await shot('flight');
    // A finisher banner (SPLAT against the wall) and then its kill-cam replay.
    const kc = await page.evaluate(() => {
      const [A, B] = __J.duel('dojo', 2, 1);
      __J.steps(2.5);
      moveFighter(B, 34 - chest(B).x, 0); moveFighter(A, 150 - A.P[2].x, 0); B.hp = 5; __J.hit(A, B, 12, { nx: -1, ny: 0 });
      for (let k = 0; k < 30; k++) { worldStep(DT); render(1 / 120); }
      SC.G.state = 'paused'; document.querySelectorAll('.toast').forEach(t => t.remove()); render(0);
      return BANNER && BANNER.a;
    });
    await page.waitForTimeout(80); await shot('splat');
    const replay = await page.evaluate(() => {
      SC.G.state = 'play';
      for (let k = 0; k < 400 && !KC.play; k++) { worldStep(DT); }
      if (!KC.play) return null;
      for (let k = 0; k < 70; k++) kcUpdate(1 / 60), render(1 / 60);
      return { tag: KC.play.ko.jzFinish && KC.play.ko.jzFinish[0] };
    });
    await page.waitForTimeout(80); await shot('killcam');
    await page.evaluate(() => { if (KC.play) kcStop(); });
    const ok = check(kc === 'SPLAT!', `juice7 screens ${tag}: SPLAT banner (${kc})`) & check(replay && replay.tag === 'SPLAT!', `juice7 screens ${tag}: kill-cam tag ${JSON.stringify(replay)}`)
      & check(!errors.length, `juice7 screens ${tag} console: ` + [...new Set(errors)].join(' | '));
    rows.push({ kind: 'juice7', key: 'screens ' + tag, ok: !!ok, note: shots.slice(-4).join(' ') });
    await ctx.close();
  }
}

async function run(browser, ctx) {
  const { page, errors, ctx: bctx } = await openPage(browser);
  for (const t of [testTiers, testFinishers, testStreaks, testBodies, testSettings, testFairness]) {
    try { await t(page, ctx, browser); } catch (e) { ctx.check(false, `juice7 ${t.name} crashed: ${e.message}`); }
  }
  ctx.check(!errors.length, 'juice7 console: ' + [...new Set(errors)].join(' | '));
  const errs = await page.evaluate(() => SC.errors.map(e => e.msg));
  ctx.check(!errs.length, 'juice7 SC.errors: ' + errs.join(' | '));
  await bctx.close();
  try { await testShots(browser, ctx); } catch (e) { ctx.check(false, `juice7 testShots crashed: ${e.message}`); }
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    require('fs').mkdirSync(SHOTS_DIR, { recursive: true });
    const browser = await chromium.launch(), failures = [], rows = [];
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    const t0 = Date.now();
    try { await run(browser, { check, rows }); } finally { await browser.close(); }
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`JUICE7 FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`JUICE7 OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
