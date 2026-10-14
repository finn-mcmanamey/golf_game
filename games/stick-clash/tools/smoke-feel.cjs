// Smoke tests for the v4 fighting feel (Agent 1): the silly body profile, hit-stop and heavy knockback, the gun pass,
// distinct blades and human-like CPUs. Called by tools/smoke.cjs; also runs on its own (`node tools/smoke-feel.cjs`,
// after `node build.mjs`). All headless (SC.sim), about a minute:
// - upright: CPU duels on six arenas under TUNE_SILLY stay upright >= 70% of alive time, nobody lies down for 4 s+,
//   and the profile really is floppier than TUNE_CLASSIC (more head sway when stopping);
// - hits: hit-stop is 0 for light hits, grows with damage (heavy 60-120 ms) and is longest on the K.O. blow;
//   a heavy hit knocks harder and higher than a light one with the same push, and sets off a tumble;
// - guns vs melee: a short CPU round robin of four guns against four melee weapons lands within 30-70%;
// - blades: every blade's reach (largest hip gap one swing hurts an idle dummy at) and swing speed (1 / cooldown):
//   no two within 10% on both;
// - CPUs: every level slips (> 0 a minute, Easy most, Insane least) and each level still beats the one below.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

async function openPage(browser) {
  const page = await browser.newPage(), errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  return { page, errors };
}

// Page-side helpers: a still duel (both CPUs idle) at a given hip gap, and plain CPU duels on an arena.
const HELPERS = () => {
  window.__F = {
    duel(wa, wb, gap = 200) {
      SC.start({ mode: 'watch', map: 'dojo', weapons: [wa, wb], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
        throws: [['none', 'none'], ['none', 'none']], orbs: false, winScore: 999 });
      SC.G.state = 'play'; SC.G.lock = 0;
      for (const f of SC.F) { f.ai.behave = 'idle'; f.ai.t = 1e9; }
      const [A, B] = SC.F;
      moveFighter(A, 520 - A.P[2].x, 0); moveFighter(B, 520 + gap - B.P[2].x, 0);
      SC.sim(.5);
      return [A, B];
    },
    // CPU vs CPU on one arena: upright share and the longest stretch any fighter spent not upright.
    upright(map, secs) {
      let alive = 0, up = 0, worst = 0;
      const down = new Map();
      for (let k = 0; k < 2; k++) {
        SC.start({ mode: 'watch', map, weapons: ['random', 'random'], winScore: 999 }); SC.G.state = 'play';
        for (let t = 0; t < secs / 2; t += 1 / 30) {
          const was = SC.F.map(f => f.upT);
          SC.sim(1 / 30);
          SC.F.forEach((f, i) => {
            if (!f.alive || f.summon || SC.G.lock > 0) { down.delete(f); return; }
            alive++;
            if (f.upT > was[i]) { up++; down.delete(f); return; }
            const d = (down.get(f) || 0) + 1 / 30; down.set(f, d); worst = Math.max(worst, d);
          });
        }
      }
      return { map, upright: up / Math.max(1, alive), worstDown: worst };
    },
  };
};

async function testUpright(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const silly = Object.keys(TUNE_SILLY).every(k => SC.TUNE[k] === TUNE_SILLY[k]);
    const maps = ['neon', 'dojo', 'sky', 'pirate', 'train', 'kitchen'].map(m => __F.upright(m, 90));
    // Floppier: how far the head swings past the hip when a running fighter stops, silly vs classic.
    const lean = () => {
      const [A] = __F.duel('blade', 'blade', 600);
      A.ctrl = 'human';                       // no brain: the scripted input stands
      A.inp.mx = 1; SC.sim(.5); A.inp.mx = 0;
      let lo = 1e9, hi = -1e9;
      for (let k = 0; k < 60; k++) { SC.sim(1 / 120); const d = A.P[0].x - A.P[2].x; lo = Math.min(lo, d); hi = Math.max(hi, d); }
      return hi - lo;
    };
    const sillyLean = lean(), keep = Object.assign({}, SC.TUNE);
    Object.assign(SC.TUNE, TUNE_CLASSIC); const classicLean = lean(); Object.assign(SC.TUNE, keep);
    return { silly, maps, sillyLean, classicLean, errors: SC.errors.map(e => e.msg) };
  });
  const worst = Math.min(...r.maps.map(m => m.upright)), longest = Math.max(...r.maps.map(m => m.worstDown));
  const ok = check(r.silly, 'feel: TUNE does not hold the TUNE_SILLY profile')
    & check(worst >= .7, `feel: upright only ${(worst * 100).toFixed(0)}% on ${r.maps.find(m => m.upright === worst).map}`)
    & check(longest < 4, `feel: a fighter stayed down ${longest.toFixed(1)} s (stuck?)`)
    & check(r.sillyLean > r.classicLean * 1.1, `feel: silly profile not floppier (head sway ${r.sillyLean.toFixed(1)} vs classic ${r.classicLean.toFixed(1)} px)`)
    & check(!r.errors.length, 'feel upright: errors ' + r.errors.join(' | '));
  rows.push({ kind: 'feel', key: 'silly upright', ok: !!ok, note: r.maps.map(m => `${m.map} ${Math.round(m.upright * 100)}%`).join(', ') +
    `; longest down ${longest.toFixed(1)} s; stop sway ${r.sillyLean.toFixed(0)} vs ${r.classicLean.toFixed(0)} px` });
}

async function testHits(page, { check, rows }) {
  const r = await page.evaluate(() => {
    // Hit-stop is real-time only: read FX.hitstop straight after damage() with the game paused (outside SC.sim).
    // A plays as a human here, so the CPU-vs-CPU toughness factor (aiArmorMul) leaves the damage as given.
    const stopFor = amt => {
      const [A, B] = __F.duel('blade', 'blade', 120);
      A.ctrl = 'human'; SC.G.state = 'paused'; FX.hitstop = 0;
      damage(B, amt, { src: A, kind: 'skill', nx: 1, ny: 0, kb: 300 });   // kind skill: no weapon power or class scaling
      const s = FX.hitstop; FX.hitstop = 0; return s;
    };
    const stops = [4, 8, 12, 18, 26].map(stopFor), koStop = stopFor(999);
    // Same push (kb 300), light vs heavy damage: the heavy hit knocks harder, launches higher and tumbles.
    const push = amt => {
      const [A, B] = __F.duel('blade', 'blade', 120), hip = B.P[2];
      A.ctrl = 'human'; B.airJumps = 0;
      damage(B, amt, { src: A, kind: 'skill', nx: 1, ny: 0, kb: 300 });
      return { vx: vx(hip), vy: vy(hip), tumble: B.tumble, airJumps: B.airJumps };
    };
    return { stops, koStop, light: push(5), heavy: push(24), errors: SC.errors.map(e => e.msg) };
  });
  const [s4, s8, s12, s18, s26] = r.stops;
  const ok = check(s4 === 0 && s8 === 0, `hits: light hits freeze (${s4}, ${s8} s)`)
    & check(s12 > 0 && s18 > s12 && s26 > s18, `hits: hit-stop does not grow with damage (${r.stops.join(', ')})`)
    & check(s18 >= .06 && s26 <= .12 + 1e-9, `hits: heavy hit-stop outside 60-120 ms (${s18}, ${s26})`)
    & check(r.koStop > s26, `hits: K.O. blow hit-stop ${r.koStop} not longer than a heavy hit's`)
    & check(r.heavy.vx > r.light.vx * 1.15 && r.heavy.vy < r.light.vy - 60, `hits: heavy knockback not bigger (${JSON.stringify(r.light)} vs ${JSON.stringify(r.heavy)})`)
    & check(r.heavy.tumble > 0 && r.light.tumble === 0 && r.heavy.airJumps >= 1, 'hits: heavy hit set off no tumble / gave no air jump back')
    & check(!r.errors.length, 'feel hits: errors ' + r.errors.join(' | '));
  rows.push({ kind: 'feel', key: 'hit-stop + knockback', ok: !!ok, note: `stop ms ${r.stops.map(s => Math.round(s * 1000)).join('/')} K.O. ${Math.round(r.koStop * 1000)}; ` +
    `push light ${Math.round(r.light.vx)},${Math.round(r.light.vy)} heavy ${Math.round(r.heavy.vx)},${Math.round(r.heavy.vy)}` });
}

async function testGuns(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const guns = ['pistol', 'shotgun', 'laser', 'crossbow'], melee = ['blade', 'hammer', 'spear', 'katana'];
    const maps = ['neon', 'dojo', 'frost', 'factory'];
    let g = 0, n = 0;
    guns.forEach((a, i) => melee.forEach((b, j) => {
      for (let k = 0; k < 2; k++) {
        SC.start({ mode: 'watch', map: maps[(i + j + k) % 4], weapons: k ? [b, a] : [a, b], skills: [['none', 'none'], ['none', 'none']],
          classes: ['none', 'none'], throws: [['none', 'none'], ['none', 'none']], orbs: false, winScore: 999 });
        SC.G.state = 'play'; SC.sim(40);
        for (const l of SC.G.log) { if (l.winner < 0) continue; n++; if (l.winner === k) g++; }
      }
    }));
    return { win: g / Math.max(1, n), rounds: n, errors: SC.errors.map(e => e.msg) };
  });
  const ok = check(r.win >= .3 && r.win <= .7, `guns: ranged vs melee ${(r.win * 100).toFixed(0)}% (want 35-65, short-sim tolerance 30-70)`)
    & check(!r.errors.length, 'feel guns: errors ' + r.errors.join(' | '));
  rows.push({ kind: 'feel', key: 'guns vs melee', ok: !!ok, rounds: r.rounds, note: `guns win ${(r.win * 100).toFixed(0)}% of ${r.rounds} rounds` });
}

async function testBlades(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const keys = Object.keys(SC.reg.WEAPONS).filter(k => SC.reg.WEAPONS[k].cat === 'blade' && !SC.reg.WEAPONS[k].hidden);
    const table = keys.map(k => {
      let reach = 0;
      for (let gap = 40; gap <= 300; gap += 10) {
        const [, B] = __F.duel(k, 'blade', gap), hp0 = B.hp;
        SC.press(0, 'attack'); SC.sim(.7);
        if (hp0 - B.hp >= 2) reach = gap;
      }
      return { k, reach, speed: 1 / SC.reg.WEAPONS[k].cd, sig: !!SC.reg.WEAPONS[k].sig };
    });
    return { table, errors: SC.errors.map(e => e.msg) };
  });
  const close = [];
  for (let i = 0; i < r.table.length; i++) for (let j = i + 1; j < r.table.length; j++) {
    const a = r.table[i], b = r.table[j];
    if (Math.abs(a.reach - b.reach) / Math.max(a.reach, b.reach) < .1 && Math.abs(a.speed - b.speed) / Math.max(a.speed, b.speed) < .1) close.push(a.k + '~' + b.k);
  }
  const ok = check(r.table.length >= 11, `blades: only ${r.table.length} blades`)
    & check(r.table.every(b => b.reach > 0 && b.sig), 'blades: a blade never hit the dummy or has no signature: ' + r.table.filter(b => !b.reach || !b.sig).map(b => b.k).join(', '))
    & check(!close.length, 'blades: too alike (reach and speed within 10%): ' + close.join(', '))
    & check(!r.errors.length, 'feel blades: errors ' + r.errors.join(' | '));
  rows.push({ kind: 'feel', key: 'distinct blades', ok: !!ok, note: r.table.map(b => `${b.k} ${b.reach}px ${b.speed.toFixed(2)}/s`).join(', ') });
}

async function testCpu(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const slips = {}, mins = {}, maps = ['neon', 'dojo', 'foundry', 'frost'];
    const off = on('aiSlip', f => { slips[f.aiLevel] = (slips[f.aiLevel] || 0) + 1; });
    const ladder = [['easy', 'normal'], ['normal', 'hard'], ['hard', 'insane']].map(([lo, hi], i) => {
      let w = 0, n = 0;
      for (let k = 0; k < 6; k++) {   // ~30 rounds a pair: a true ~72% shows at or under half less than 1 run in 100
        SC.start({ mode: 'watch', diffs: k % 2 ? [hi, lo] : [lo, hi], map: maps[(i + k) % 4], weapons: ['random', 'random'], winScore: 999 });
        SC.G.state = 'play';
        for (let t = 0; t < 120; t += .1) {
          SC.sim(.1);
          for (const f of SC.F) if (f.alive && !f.summon && SC.G.lock <= 0 && !SC.G.ending) mins[f.aiLevel] = (mins[f.aiLevel] || 0) + .1 / 60;
        }
        for (const l of SC.G.log) { if (l.winner < 0) continue; n++; if (l.winner === (k % 2 ? 0 : 1)) w++; }
      }
      return { pair: lo + '<' + hi, win: w / Math.max(1, n), n };
    });
    off();
    const perMin = Object.fromEntries(AI_ORDER.map(L => [L, (slips[L] || 0) / Math.max(1e-9, mins[L] || 0)]));
    return { ladder, perMin, errors: SC.errors.map(e => e.msg) };
  });
  const pm = r.perMin;
  const ok = check(Object.values(pm).every(v => v > 0), 'cpu: a level never slipped: ' + JSON.stringify(pm))
    & check(pm.easy > pm.normal && pm.normal > pm.insane && pm.hard > pm.insane, 'cpu: slips not ordered by level: ' + JSON.stringify(pm))
    & check(r.ladder.every(p => p.win > .5), 'cpu: ladder out of order: ' + r.ladder.map(p => `${p.pair} ${(p.win * 100).toFixed(0)}%`).join(', '))
    & check(!r.errors.length, 'feel cpu: errors ' + r.errors.join(' | '));
  rows.push({ kind: 'feel', key: 'human-like CPUs', ok: !!ok, note: 'slips/min ' + Object.entries(pm).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ') +
    '; ladder ' + r.ladder.map(p => `${p.pair} ${(p.win * 100).toFixed(0)}% (${p.n})`).join(', ') });
}

async function run(browser, ctx) {
  const { page, errors } = await openPage(browser);
  await page.evaluate(HELPERS);
  for (const t of [testUpright, testHits, testGuns, testBlades, testCpu]) {
    try { await t(page, ctx); } catch (e) { ctx.check(false, `feel ${t.name} crashed: ${e.message}`); }
  }
  ctx.check(!errors.length, 'feel console: ' + [...new Set(errors)].join(' | '));
  await page.close();
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const browser = await chromium.launch(), failures = [], rows = [];
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    const t0 = Date.now();
    try { await run(browser, { check, rows }); } finally { await browser.close(); }
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`FEEL FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`FEEL OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
