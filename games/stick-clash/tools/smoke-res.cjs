// Smoke tests for the adaptive resolution (84-quality's RES ladder, 85-render's canvas sizing). Called by
// tools/smoke.cjs; also runs on its own (`node tools/smoke-res.cjs`, after `node build.mjs`). About a minute:
// - forced steps at 1366x1024@2 and 844x390@3: the canvas size of each step's pixel budget (step 3 = the old formula),
//   VIEW.glowK = dpr / step-3 dpr, the bloom tier of steps 4-7, and steps that change nothing are skipped;
// - under test automation the governor is off and the canvas is the old one (step 3);
// - 25 ms frames step down; a step with no gain carries on to step 3, then the dive is undone and dives hold (30 s,
//   then for the session);
// - 300 frames at 16.7 ms climb one step; a climb undone within 30 s doubles the wait; failing twice sets the ceiling;
// - nothing is measured in a pause, the kill-cam, photo mode or the benchmark; photo mode draws at step 0 and a
//   highlight export at step 3;
// - across steps the backdrop cache is never redrawn and the bloom buffers keep their size.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

async function openPage(browser, size) {
  const page = await browser.newPage(size), errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  return { page, errors };
}

// Page side: the expected dpr of a step (the brief's formula, written out independently of 84-quality), and a governor
// started fresh at a given step with the real frame loop kept out of it (paused: real frames are never measured).
const HELPERS = () => {
  window.__R = {
    dpr(s) {
      const css = Math.max(1, innerWidth * innerHeight), d = devicePixelRatio || 1, px = [6e6, 4e6, 3e6, 2.3e6, 2.3e6, 2.3e6, 2.3e6, 1.6e6][s];
      return Math.max(.5, Math.min(d, s < 3 ? Infinity : 2, Math.sqrt(px / css)));
    },
    fresh(step, map = 'dojo') {
      SC.res.force(null); SC.res.auto(true);
      SC.start({ mode: 'versus', map }); SC.G.lock = 0; SC.G.state = 'paused';
      Object.assign(SC.res.RES, { step, cool: 0, avg: 0, clock: 0 });
      SC.render(0);
    },
    // Feeds n frames of gap ms one at a time; returns the steps the governor went through.
    walk(gap, n) {
      const seen = [SC.res.RES.step];
      for (let k = 0; k < n; k++) { const s = SC.res.feed(gap); if (s !== seen[seen.length - 1]) seen.push(s); }
      return seen;
    },
  };
};

async function testForced(browser, { check, rows }, size) {
  const { page, errors } = await openPage(browser, size);
  await page.evaluate(HELPERS);
  const r = await page.evaluate(() => {
    const out = { boot: { auto: SC.res.RES.auto, shown: SC.res.RES.shown, cv: [cv.width, cv.height], want: [Math.round(innerWidth * __R.dpr(3)), Math.round(innerHeight * __R.dpr(3))] } };
    Object.assign(SC.postfx.bloom, { allowSoftware: true, failed: false });   // the WebGL path, so its buffers exist
    SETTINGS.bloom = 'high';
    SC.start({ mode: 'versus', map: 'neon' }); SC.G.lock = 0; SC.G.state = 'paused';
    out.steps = [];
    for (let s = 0; s < 8; s++) {
      SC.res.force(s); SC.render(1 / 60); SC.render(1 / 60);
      const d = __R.dpr(s), B = SC.postfx.bloom;
      out.steps.push({ s, cv: [cv.width, cv.height], want: [Math.round(innerWidth * d), Math.round(innerHeight * d)], glowK: VIEW.glowK, wantK: d / __R.dpr(3),
        tier: B.tier, bloom: [B.w, B.h, B.half && B.half.width, B.half && B.half.height].join('x') });
    }
    // Steps that change nothing here are skipped (resNext): with bloom off, the bloom steps never are a next step.
    SETTINGS.bloom = 'off'; SC.res.force(null); SC.res.auto(true);
    out.next = [0, 1, 2, 3].map(s => resNext(s, 1));
    SC.res.auto(false); SETTINGS.bloom = 'low';
    out.errors = SC.errors.map(e => e.msg);
    return out;
  });
  const label = `${size.viewport.width}x${size.viewport.height}@${size.deviceScaleFactor}`;
  const bad = r.steps.filter(x => x.cv[0] !== x.want[0] || x.cv[1] !== x.want[1] || Math.abs(x.glowK - x.wantK) > 1e-9);
  const tiers = r.steps.map(x => x.tier).join('');
  // Pixel steps 0-3 keep bloom High (1/3-size buffers), 4-5 step it to Low (1/4): within each, the buffers never change.
  const blooms = [...new Set(r.steps.slice(0, 4).map(x => x.bloom))], lows = [...new Set(r.steps.slice(4, 6).map(x => x.bloom))];
  // The next step down from each pixel step: the next one whose canvas differs, then 7 if it is smaller than step 3.
  const nextWant = [0, 1, 2, 3].map(s => { for (let n = s + 1; n < 8; n++) if (Math.abs(r.steps[n].want[0] - r.steps[s].want[0]) > 0) return n; return -1; });
  const ok = check(!r.boot.auto && r.boot.shown === 3 && r.boot.cv.join() === r.boot.want.join(), `res ${label}: under test automation the canvas is not the old one ${JSON.stringify(r.boot)}`)
    & check(!bad.length, `res ${label}: forced steps ${JSON.stringify(bad)}`)
    & check(tiers === '00001233', `res ${label}: bloom tiers by step ${tiers}`)
    & check(blooms.length === 1 && lows.length === 1 && !blooms[0].startsWith('0x'), `res ${label}: bloom buffers changed across steps ${blooms.join(' / ')} | ${lows.join(' / ')}`)
    & check(r.next.join() === nextWant.join(), `res ${label}: next steps ${r.next} (want ${nextWant})`)
    & check(!r.errors.length && !errors.length, `res ${label}: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'res', key: `forced steps ${label}`, ok: !!ok, note: r.steps.map(x => `${x.s}:${x.cv.join('x')}`).join(' ') + ` · bloom ${blooms[0]}` });
  await page.close();
}

async function testGovernor(browser, { check, rows }) {
  const { page, errors } = await openPage(browser, { viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2 });
  await page.evaluate(HELPERS);
  const r = await page.evaluate(() => {
    const R = SC.res.RES, out = {};
    SETTINGS.bloom = 'off';   // bloom steps then change nothing: a dive from 3 has nowhere left to go but 7
    // Down: from step 1, 25 ms frames dive to 2, carry on to 3 (no gain), then the dive is undone: back to 1, held 30 s.
    __R.fresh(1);
    out.down = __R.walk(25, 400);
    out.hold1 = { held: R.held, left: R.hold - R.clock, step: R.step };
    out.during = __R.walk(25, 1000);                     // 25 s more: still held
    out.again = __R.walk(25, 400);                       // past the 30 s: another dive, undone again, held for good
    out.hold2 = { held: R.held, hold: R.hold, step: R.step };
    SC.render(0); out.cv = [cv.width, cv.height, Math.round(innerWidth * __R.dpr(1))];
    // A real gain stops the dive where it is: 33.3 ms frames, then 16.7 ms ones once at step 2.
    __R.fresh(1);
    __R.walk(33.3, 77);
    out.dived = R.step;
    out.gain = __R.walk(19, 90);                         // in the dead band and 43% faster than the start: stays
    out.gainDive = R.dive;
    // Up: 300 frames at 16.7 ms climb a step; undone within 30 s, the wait doubles; failing twice sets the ceiling.
    __R.fresh(3);
    out.up = __R.walk(16.7, 300);
    out.undo = __R.walk(25, 100);
    out.wait1 = R.wait;
    out.notYet = __R.walk(16.7, 300);                    // 4.5 s of the 8 s wait
    out.up2 = __R.walk(16.7, 250);
    out.undo2 = __R.walk(25, 100);
    out.ceil = { ceil: R.ceil, wait: R.wait };
    out.capped = __R.walk(16.7, 2000);
    // A borderline screen: step 0 misses ~18% of vsyncs at random, step 1 runs clean. A slowdown within 30 s of a climb
    // counts as that climb failing, so the governor settles instead of flapping (a 3 s window switched 14 times here).
    __R.fresh(1);
    let seed = 5, flips = 0, last = R.step;
    const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (let k = 0; k < 18000; k++) { const st = SC.res.feed(R.step === 0 && rnd() < .18 ? 33.3 : 16.7); if (st !== last) { flips++; last = st; } }
    out.flap = { flips, step: R.step, ceil: R.ceil };
    // The dead band (50-57 fps) changes nothing either way.
    __R.fresh(2);
    out.band = __R.walk(18.5, 1500);
    SC.res.auto(false); SETTINGS.bloom = 'low';
    out.errors = SC.errors.map(e => e.msg);
    return out;
  });
  const ok = check(r.down.join() === '1,2,3,1' && r.hold1.held === 1 && r.hold1.left > 2e4 && r.hold1.left <= 3e4, `res down: ${JSON.stringify({ down: r.down, hold: r.hold1 })}`)
    & check(r.during.join() === '1' && r.again.join() === '1,2,3,1' && r.hold2.held === 2 && (r.hold2.hold === Infinity || r.hold2.hold === null),
      `res hold: ${JSON.stringify({ during: r.during, again: r.again, hold: r.hold2 })}`)
    & check(r.cv[0] === r.cv[2], `res down: canvas back at step 1 ${r.cv}`)
    & check(r.dived === 2 && r.gain.join() === '2' && r.gainDive === null, `res gain: ${JSON.stringify({ dived: r.dived, gain: r.gain, dive: r.gainDive })}`)
    & check(r.up.join() === '3,2' && r.undo.join() === '2,3' && r.wait1 === 8000, `res up: ${JSON.stringify({ up: r.up, undo: r.undo, wait: r.wait1 })}`)
    & check(r.notYet.join() === '3' && r.up2.join() === '3,2' && r.undo2.join() === '2,3' && r.ceil.ceil === 3 && r.ceil.wait === 16000 && r.capped.join() === '3',
      `res ceiling: ${JSON.stringify({ notYet: r.notYet, up2: r.up2, undo2: r.undo2, ceil: r.ceil, capped: r.capped })}`)
    & check(r.band.join() === '2', `res dead band: ${r.band}`)
    & check(r.flap.flips <= 6 && r.flap.step === 1 && r.flap.ceil === 1, `res no flip-flop: ${JSON.stringify(r.flap)}`)
    & check(!r.errors.length && !errors.length, `res governor: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'res', key: 'governor down / up / hold', ok: !!ok, note: `down ${r.down}, up ${r.up}, wait ${r.wait1} -> ${r.ceil.wait}, ceiling ${r.ceil.ceil}` });
  await page.close();
}

// Nothing is measured while paused, replaying a K.O., in photo mode or during the benchmark; the pins hold their step.
async function testHolds(browser, { check, rows }) {
  const { page, errors } = await openPage(browser, { viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2 });
  await page.evaluate(HELPERS);
  const r = await page.evaluate(async () => {
    const R = SC.res.RES, out = {}, slow = n => { for (let k = 0; k < n; k++) SC.render(.03); return { step: R.step, clock: R.clock, slow: R.slow }; };
    __R.fresh(1, 'neon');
    out.pause = slow(120);
    SC.G.state = 'over'; out.results = slow(60);
    // Photo mode: drawn at step 0, measured never, back to the governor's step on the way out.
    SC.setState('paused'); SC.photo.enter();
    out.photo = Object.assign(slow(60), { shown: R.shown, state: SC.G.state, cv: cv.width, want: Math.round(innerWidth * __R.dpr(0)) });
    SC.photo.exit(); SC.render(0);
    out.photoOut = { shown: R.shown, state: SC.G.state };
    // A highlight export records at step 3.
    HL.rec = { fake: true }; SC.render(0); out.export = R.shown; HL.rec = null; SC.render(0); out.exportOut = R.shown;
    // The kill-cam replay of a deciding K.O. (it needs real frames: the governor is off for the run-up).
    SC.res.auto(false);
    SC.start({ mode: 'versus', map: 'neon' }); SC.G.lock = 0;
    for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; }
    await new Promise(done => setTimeout(done, 1500));
    // A replay needs 20 recorded frames over .8 s (88-killcam); a slow runner can take longer than 1.5 s to record them.
    const enough = () => KC.frames.length >= 24 && KC.frames[KC.frames.length - 1].t - KC.frames[0].t >= 1;
    for (let k = 0; k < 100 && !enough(); k++) await new Promise(done => setTimeout(done, 50));
    SC.G.score[0] = SC.G.winScore - 1; damage(SC.F[1], 999, { src: SC.F[0], kind: 'melee', nx: 1, ny: -.3 });
    for (let k = 0; k < 160 && !KC.play; k++) await new Promise(done => setTimeout(done, 50));
    out.kcState = SC.G.state;
    Object.assign(R, { auto: true, step: 1 });
    const before = R.clock;
    for (let k = 0; k < 90; k++) SC.render(.03);
    out.killcam = { step: R.step, measured: R.clock - before, state: SC.G.state };
    SC.killcam.skip();
    // The benchmark: step 3 while it runs (whatever the governor's step), nothing measured.
    toMenu(); Object.assign(R, { auto: true, step: 1 });
    const c0 = R.clock, shownDuring = [];
    const watch = setInterval(() => shownDuring.push(R.shown), 50);
    const res = await new Promise(done => setTimeout(async () => done(await SC.perf.run(.6)), 300));
    clearInterval(watch);
    out.bench = { tier: res && res.tier, shown: [...new Set(shownDuring)].join(), measured: R.clock - c0, after: R.shown };
    SC.res.auto(false);
    out.errors = SC.errors.map(e => e.msg);
    return out;
  });
  const ok = check(r.pause.step === 1 && r.pause.clock === 0 && r.results.clock === 0, `res hold: pause/results measured ${JSON.stringify([r.pause, r.results])}`)
    & check(r.photo.state === 'photo' && r.photo.shown === 0 && r.photo.cv === r.photo.want && r.photo.clock === 0 && r.photoOut.shown === 1 && r.photoOut.state === 'paused',
      `res photo: ${JSON.stringify([r.photo, r.photoOut])}`)
    & check(r.export === 3 && r.exportOut === 1, `res export pin: ${r.export} then ${r.exportOut}`)
    & check(r.kcState === 'killcam' && r.killcam.measured === 0 && r.killcam.step === 1, `res kill-cam: ${r.kcState} ${JSON.stringify(r.killcam)}`)
    & check(r.bench.shown.split(',').includes('3') && r.bench.measured === 0, `res benchmark: ${JSON.stringify(r.bench)}`)
    & check(!r.errors.length && !errors.length, `res holds: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'res', key: 'holds + pins (pause, results, photo, export, kill-cam, benchmark)', ok: !!ok, note: `photo at ${r.photo.shown}, export at ${r.export}, bench shown ${r.bench.shown}` });
  await page.close();
}

// Steps never redraw the backdrop cache; a real resize redraws it once, 400 ms after the last resize.
async function testCache(browser, { check, rows }) {
  const { page, errors } = await openPage(browser, { viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2 });
  const r = await page.evaluate(() => {
    SC.start({ mode: 'versus', map: 'dojo' }); SC.G.lock = 0; SC.G.state = 'paused';
    SC.render(0); SC.render(0);
    const C = SC.styles.ART.cache, n0 = C.n, size = [C.cv.width, C.cv.height].join('x');
    for (let s = 0; s < 8; s++) { SC.res.force(s); SC.render(0); SC.render(0); }
    SC.res.force(null); SC.render(0);
    return { n0, n1: C.n, size, after: [C.cv.width, C.cv.height].join('x'), errors: SC.errors.map(e => e.msg) };
  });
  // Right after the resize event (listened to after the game's own handler, so the deferral is tested whatever the load).
  await page.evaluate(() => { window.__mid = null; addEventListener('resize', () => { if (__mid === null) { SC.render(0); __mid = SC.styles.ART.cache.n; } }); });
  await page.setViewportSize({ width: 640, height: 400 });   // a smaller cache scale
  await page.waitForFunction(() => window.__mid !== null);
  const mid = await page.evaluate(() => __mid);
  await page.waitForTimeout(700);
  const end = await page.evaluate(() => { SC.render(0); SC.render(0); return { n: SC.styles.ART.cache.n, k: SC.styles.ART.k }; });
  const ok = check(r.n1 === r.n0 && r.after === r.size, `res cache: redrawn across steps ${JSON.stringify(r)}`)
    & check(mid === r.n1 && end.n === r.n1 + 1, `res cache: resize redraws ${r.n1} -> ${mid} (at the resize) -> ${end.n} (700 ms later)`)
    & check(!r.errors.length && !errors.length, `res cache: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'res', key: 'backdrop cache across steps + resize', ok: !!ok, note: `${r.size}, ${r.n0} build(s) over 8 steps; resize: +${end.n - r.n1} after 400 ms` });
  await page.close();
}

async function run(browser, ctx) {
  for (const size of [{ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2 }, { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 }]) {
    try { await testForced(browser, ctx, size); } catch (e) { ctx.check(false, `res forced crashed: ${e.message}`); }
  }
  for (const t of [testGovernor, testHolds, testCache]) {
    try { await t(browser, ctx); } catch (e) { ctx.check(false, `res ${t.name} crashed: ${e.message}`); }
  }
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
    if (failures.length) { console.error(`RES FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`RES OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
