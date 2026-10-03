// tools/fx-perf.cjs: frame rate of an 8-CPU brawl in real time with bloom off / low / high (run `node build.mjs` first).
// Headless Chromium has no GPU: WebGL is software (SwiftShader), where the game picks the cheaper 2D glow; the "gl"
// rows force the WebGL shader path anyway to show its worst case. Usage: node tools/fx-perf.cjs [seconds=4]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const SECS = +process.argv[2] || 4;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.resolve(__dirname, '..', 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  const rows = [];
  for (const [q, gl] of [['off', 0], ['low', 0], ['high', 0], ['low', 1], ['high', 1]]) {
    rows.push(await page.evaluate(([q, gl, secs]) => new Promise(res => {
      const B = SC.postfx.bloom;
      if (gl && !B.gl) Object.assign(B, { allowSoftware: true, failed: false });
      if (!gl && B.gl) { B.cv.remove(); Object.assign(B, { gl: null, cv: null, failed: true, w: 0, h: 0 }); }
      Object.assign(B, { tier: 0, slowFrames: -1e9 });          // no governor: measure the raw cost
      SETTINGS.bloom = q;
      SC.start({ mode: 'watch', fighters: 8, winScore: 99 });
      const times = []; let last = 0; const t0 = performance.now();
      const tick = now => {
        if (last) times.push(now - last);
        last = now;
        if (now - t0 < secs * 1000) return requestAnimationFrame(tick);
        times.sort((a, b) => a - b);
        const avg = times.reduce((s, x) => s + x, 0) / times.length;
        res({ bloom: q, path: q === 'off' ? '-' : B.mode, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(1), p95Ms: +times[Math.floor(times.length * .95)].toFixed(1) });
      };
      requestAnimationFrame(tick);
    }), [q, gl, SECS]));
  }
  console.table(rows);
  await browser.close();
})();
