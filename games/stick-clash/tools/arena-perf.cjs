// tools/arena-perf.cjs: render cost of every arena with 8 fighters (run `node build.mjs` first). Standalone: not part
// of smoke.cjs. Each scene is a CPU match simulated for a moment with a seeded Math.random (the same fight every run
// and every build), then paused, so every frame draws the same picture. The page's own frame loop is stopped, so only
// the measured frames draw. A sample is the mean of 4 frames, each read back through a 1x1 canvas so the rasterising
// is counted; a scene's number is the median of its samples, then the median over the runs (which interleave the
// scenes). Scenes: every arena, the Eruption mid-eruption, and Neon City under each weather.
// Timings drift by several % between runs on a shared machine, so to compare two builds use --vs: both are measured
// in the same browser, alternating scene by scene, and the change is the median of the per-run ratios.
// Usage: node tools/arena-perf.cjs [--runs 3] [--html dist/stick-clash.html] [--out tmp/perf.json]
//          [--vs other.html] (A/B against another build) [--base tmp/perf-base-b.json] (change vs a saved run)
//          [--only neon,storm] [--styles] (adds smoke-styles' styled-vs-neon ratios, worst arena per style)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : process.argv[i + 1] ?? true; };
const RUNS = +arg('runs', 3), HTML = path.resolve(ROOT, arg('html', 'dist/stick-clash.html'));
const VS = arg('vs', '') && path.resolve(ROOT, arg('vs'));
const ONLY = arg('only', '') ? String(arg('only')).split(',') : null;
const SAMPLES = 16, PER = 4;   // samples per scene and run, frames per sample

// One scene: [name, map, weather, seconds simulated before the picture is frozen].
function scenes(maps) {
  const list = maps.map(k => [k, k, 'clear', 1.5]);
  list.push(['eruption!', 'eruption', 'clear', 12]);          // lava up, smoke column, bombs
  for (const wx of ['rain', 'snow', 'fog', 'night', 'wind']) list.push(['neon:' + wx, 'neon', wx, 1.5]);
  return ONLY ? list.filter(s => ONLY.includes(s[0])) : list;
}

const MEASURE = `([map, weather, secs, samples, per]) => {
  let seed = 7;                                     // mulberry32: the same fight every run
  Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const B = SC.postfx && SC.postfx.bloom;
  if (B) Object.assign(B, { tier: 0, slowFrames: -1e9, probe: null });   // no governor: the raw cost
  if (SC.res && SC.res.force) SC.res.force(3);      // today's resolution, if the adaptive ladder exists
  const e0 = SC.errors.length;
  SC.G.t = 100;                                     // game time carries over between matches: pin it, so the fight repeats
  SC.start({ mode: 'watch', map, fighters: 8, weather, winScore: 99 });
  SC.G.lock = 0;
  SC.sim(secs);
  SC.G.state = 'paused'; BANNER = null;
  const fc = window.__apFc || (window.__apFc = document.createElement('canvas')), fg = fc.getContext('2d', { willReadFrequently: true });
  fc.width = fc.height = 1;
  const cv = document.getElementById('c'), frame = dt => { SC.render(dt); fg.drawImage(cv, 0, 0, 1, 1); fg.getImageData(0, 0, 1, 1); };
  for (let k = 0; k < 6; k++) frame(1);             // the camera settles
  for (let k = 0; k < 12; k++) frame(1 / 60);       // caches warm
  const out = [];
  for (let s = 0; s < samples; s++) {
    const t0 = performance.now();
    for (let k = 0; k < per; k++) frame(1 / 60);
    out.push((performance.now() - t0) / per);
  }
  out.sort((a, b) => a - b);
  return { ms: out[out.length >> 1], wx: WX.key, errors: SC.errors.slice(e0).map(e => e.msg) };
}`;

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

async function openPage(browser, html, errors, tag) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + html);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });   // the game loop stops after its next frame
  await page.waitForTimeout(100);
  return page;
}

(async () => {
  const browser = await chromium.launch(), errors = [];
  const page = await openPage(browser, HTML, errors, 'build'), ref = VS && await openPage(browser, VS, errors, 'vs');
  const maps = await page.evaluate(() => Object.keys(SC.reg.MAPS));
  const list = scenes(maps), res = {};
  const measure = async (p, name, map, wx, secs, key) => {
    const r = await p.evaluate(`(${MEASURE})(${JSON.stringify([map, wx, secs, SAMPLES, PER])})`);
    const row = res[name] || (res[name] = { runs: [], vsRuns: [], wx: r.wx });
    row[key].push(+r.ms.toFixed(3));
    if (r.errors.length) errors.push(`${name}: ${r.errors.join(' | ')}`);
  };
  for (let run = 0; run < RUNS; run++) {
    for (const [name, map, wx, secs] of list) {
      if (ref && run % 2) await measure(ref, name, map, wx, secs, 'vsRuns');   // alternate who goes first
      await measure(page, name, map, wx, secs, 'runs');
      if (ref && !(run % 2)) await measure(ref, name, map, wx, secs, 'vsRuns');
    }
  }
  for (const r of Object.values(res)) {
    r.ms = +median(r.runs).toFixed(3);
    if (ref) { r.vs = +median(r.vsRuns).toFixed(3); r.ratio = +median(r.runs.map((x, i) => x / r.vsRuns[i])).toFixed(4); }
    else delete r.vsRuns;
  }
  const out = { html: path.relative(ROOT, HTML), vs: VS ? path.relative(ROOT, VS) : undefined, when: new Date().toISOString(), runs: RUNS, scenes: res };
  if (arg('styles', false)) {
    const fails = [];
    const perf = await require('./smoke-styles.cjs').perf(browser, { check: (ok, what) => { if (!ok) fails.push(what); return ok; }, rows: [] });
    const by = {};
    for (const [map, r] of Object.entries(perf)) { const k = r.styled / r.neon; if (!by[r.style] || k > by[r.style].k) by[r.style] = { k: +k.toFixed(3), map }; }
    out.styles = by;
    if (fails.length) errors.push(...fails);
  }
  await browser.close();
  const base = arg('base', '') && JSON.parse(fs.readFileSync(path.resolve(ROOT, arg('base')), 'utf8'));
  const pct = k => `${((k - 1) * 100).toFixed(1)}%`;
  console.table(Object.fromEntries(Object.entries(res).map(([k, r]) => {
    const b = base && base.scenes[k], row = { ms: r.ms, runs: r.runs.join(' / '), wx: r.wx };
    if (ref) Object.assign(row, { vs: r.vs, change: pct(r.ratio) });
    if (b) Object.assign(row, { base: b.ms, 'vs base': pct(r.ms / b.ms) });
    return [k, row];
  })));
  if (out.styles) console.table(Object.fromEntries(Object.entries(out.styles).map(([k, v]) =>
    [k, Object.assign({}, v, base && base.styles && base.styles[k] ? { base: base.styles[k].k } : {})])));
  if (arg('out', '')) { const f = path.resolve(ROOT, arg('out')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(out, null, 1)); console.log('wrote ' + f); }
  if (errors.length) { console.error('ERRORS:\n - ' + errors.join('\n - ')); process.exit(1); }
})();
