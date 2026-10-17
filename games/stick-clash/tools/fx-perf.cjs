// tools/fx-perf.cjs: frame rate of an 8-CPU brawl in real time with bloom off / low / high (run `node build.mjs` first).
// Headless Chromium has no GPU: WebGL is software (SwiftShader), where the game picks the cheaper 2D glow; the "gl"
// rows force the WebGL shader path anyway to show its worst case.
// Usage: node tools/fx-perf.cjs [seconds=4] [--map caldera] [--size 1280x720@1] [--step 3] [--rows off,low,high,gl-low,gl-high]
//        [--bench N] [--free] [--sync] [--json out.json]
//   --map    a fixed arena, so runs compare (default: random, as before)
//   --size   viewport and device pixel ratio
//   --step   force a resolution step (SC.res, 84-quality); tests run at step 3 (today's canvas) anyway
//   --bench  also run the SC.perf benchmark N times (its median render times per bloom level)
//   --free   unthrottled frames (no vsync, no frame-rate limit): frame gaps then show the real cost instead of
//            snapping to 16.7 ms multiples, so small changes are measurable
//   --sync   read one pixel back after each frame, so renderMs includes the deferred raster work
//   --json   write the rows (frame gap and render time medians) to a file
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2), flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const SECS = +(argv[0] && !argv[0].startsWith('--') ? argv[0] : 4);
const MAP = flag('map', null), STEP = flag('step', null), BENCH = +flag('bench', 0), JSON_OUT = flag('json', null);
const FREE = argv.includes('--free'), SYNC = argv.includes('--sync');
const [, VW, VH, DPR] = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(flag('size', '1280x720@1'));
const ROWS = flag('rows', 'off,low,high,gl-low,gl-high').split(',').map(r => [r.replace('gl-', ''), r.startsWith('gl-') ? 1 : 0]);
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
(async () => {
  const browser = await chromium.launch({ args: FREE ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [] });
  const page = await browser.newPage({ viewport: { width: +VW, height: +VH }, deviceScaleFactor: +(DPR || 1) });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.resolve(__dirname, '..', 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  const canvas = await page.evaluate(step => {
    if (step != null && SC.res) SC.res.force(+step);
    return `${cv.width}x${cv.height}`;
  }, STEP);
  const rows = [];
  for (const [q, gl] of ROWS) {
    rows.push(await page.evaluate(([q, gl, secs, map, sync]) => new Promise(res => {
      const B = SC.postfx.bloom;
      if (gl && !B.gl) Object.assign(B, { allowSoftware: true, failed: false });
      if (!gl && B.gl) { B.cv.remove(); Object.assign(B, { gl: null, cv: null, failed: true, w: 0, h: 0 }); }
      Object.assign(B, { tier: 0, slowFrames: -1e9 });          // no governor: measure the raw cost
      SETTINGS.bloom = q;
      SC.start(Object.assign({ mode: 'watch', fighters: 8, winScore: 99 }, map ? { map } : {}));
      // Render time: the game's own render, timed from outside (the global is reassignable, like 84-quality's wrap).
      const base = render, work = [];
      render = function (dt) { const t = performance.now(); base(dt); if (sync) CTX_MAIN.getImageData(0, 0, 1, 1); work.push(performance.now() - t); };
      const times = []; let last = 0; const t0 = performance.now();
      const tick = now => {
        if (last) times.push(now - last);
        last = now;
        if (now - t0 < secs * 1000) return requestAnimationFrame(tick);
        render = base;
        const s = times.slice().sort((a, b) => a - b), w = work.slice().sort((a, b) => a - b);
        const avg = times.reduce((a, x) => a + x, 0) / times.length;
        res({ bloom: q, path: q === 'off' ? '-' : B.mode, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(1),
          medMs: +s[s.length >> 1].toFixed(2), p95Ms: +s[Math.floor(s.length * .95)].toFixed(1), renderMs: +w[w.length >> 1].toFixed(2) });
      };
      requestAnimationFrame(tick);
    }), [q, gl, SECS, MAP, SYNC]));
  }
  console.log(`canvas ${canvas} (viewport ${VW}x${VH}@${DPR || 1}${MAP ? ', map ' + MAP : ''}${STEP != null ? ', step ' + STEP : ''}${FREE ? ', free' : ''}${SYNC ? ', sync' : ''})`);
  console.table(rows);
  const bench = [];
  for (let k = 0; k < BENCH; k++) {
    bench.push(await page.evaluate(() => new Promise(res => {
      toMenu();
      setTimeout(async () => {
        const r = await SC.perf.run(2);
        res(r && r.stats && Object.fromEntries(Object.entries(r.stats).map(([q, s]) => [q, { fps: s.fps, ms: s.ms }])));
      }, 500);
    })));
  }
  if (BENCH) { console.log('benchmark (SC.perf.run(2)):'); console.table(bench.map(b => Object.fromEntries(Object.entries(b || {}).map(([q, s]) => [q, `${s.fps} fps ${s.ms} ms`])))); }
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ canvas, viewport: `${VW}x${VH}@${DPR || 1}`, map: MAP, step: STEP, secs: SECS, free: FREE, sync: SYNC, rows, bench,
    benchMs: BENCH ? Object.fromEntries(['off', 'low', 'high'].map(q => [q, med(bench.filter(Boolean).map(b => b[q].ms))])) : null }, null, 1));
  await browser.close();
})();
