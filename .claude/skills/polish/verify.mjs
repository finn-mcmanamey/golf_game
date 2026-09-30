// Replay check: `node verify.mjs verify` re-verifies the saved rounds (codes.json) on the current build, in the page and the worker.
// record: bot rounds on the current build -> codes.json; verify: re-verify codes.json on the current build.
import { execSync } from 'node:child_process';
let pw;
try { pw = await import('playwright') } catch { pw = await import(execSync('npm root -g').toString().trim() + '/playwright/index.mjs') }
const { chromium } = pw;
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const DIR = new URL('.', import.meta.url).pathname;
const PAGE = 'file://' + new URL('../../../dist/index.html', import.meta.url).pathname;
const [mode = 'shots', out = DIR + 'shots'] = process.argv.slice(2);
const SEEDS = [101, 577, 2206, 4260, 8185, 16471];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) });
await page.goto(PAGE);
await page.waitForFunction(() => window.VL && VL.S);

if (mode === 'record' || mode === 'verify') {
  const codes = mode === 'record' ? await page.evaluate(seeds => seeds.map(seed => {
    S.seed = seed; seedIn.value = seed; S.over = false; S.setup = 0; S.season = courseSeason(seed); S.wear = 0; S.casual = 0; S.kind = 0;
    startRound(3, null, null, 3);
    const logs = [0, 1, 2].map(h => ghostLog(h));
    return encodeRound(seed, 3, logs, 0, S.cv, { bag: botBag(3), ball: 0, setup: S.setup, season: S.season, wear: S.wear, casual: 0, kind: 0, seat: 0, look: 0, hand: 0 });
  }), SEEDS) : JSON.parse(readFileSync(DIR + 'codes.json', 'utf8')).map(c => c.code);
  const res = await page.evaluate(codes => codes.map(code => {
    const d = decodeRound(code); useCalib(d.cv); setBag(d.bag); const r = verifyRound6(d);
    return { code, ok: r.ok, total: r.total, why: r.why || null };
  }), codes);
  if (mode === 'record') writeFileSync(DIR + 'codes.json', JSON.stringify(res, null, 1));
  const base = existsSync(DIR + 'codes.json') ? JSON.parse(readFileSync(DIR + 'codes.json', 'utf8')) : res;
  let bad = 0;
  res.forEach((r, i) => { const same = r.ok && r.total === base[i].total; if (!same) bad++; console.log((same ? 'OK  ' : 'FAIL') + ' total ' + r.total + ' (base ' + base[i].total + ')' + (r.why ? ' ' + r.why : '')) });
  console.log(bad ? bad + ' round(s) FAILED' : 'all ' + res.length + ' rounds verify');
  // the same codes through the headless worker built from the page's own script (it breaks silently on bad top-level code)
  const wk = await page.evaluate(codes => Promise.all(codes.map(c => new Promise(r => { const t = setTimeout(() => r({ ok: false, why: 'timeout' }), 240000); vqAdd(c, x => { clearTimeout(t); r({ ok: x.ok, total: x.total, why: x.why }) }) }))).then(a => ({ a, worker: !!VQ.w })), res.map(r => r.code));
  const wbad = wk.a.filter((r, i) => !r.ok || r.total !== base[i].total);
  console.log('worker ' + (wk.worker ? 'in use' : 'NOT available (idle-slice fallback)') + ': ' + (wbad.length ? wbad.length + ' FAILED ' + JSON.stringify(wbad) : 'all verify'));
} else {
  mkdirSync(out, { recursive: true });
  const shots = JSON.parse(process.env.SHOTS || '[[2206,0,12],[4260,0,17],[8185,1,9]]');
  for (const [seed, hole, clock, aim] of shots) {
    await page.evaluate(([seed, hole, clock, aim]) => {
      S.seed = seed; seedIn.value = seed; S.over = false; S.setup = 0; S.season = courseSeason(seed); S.wear = 0; S.casual = 0; S.kind = 0;
      startRound(9, null, null, 0); if (hole) loadHole(hole); S.intro = null; if (clock != null) applyClock(W, clock); if (aim === 'pond') { const q = W.PD.reduce((a, b) => Math.hypot(b.x, b.z) < Math.hypot(a.x, a.z) ? b : a); S.yaw = Math.atan2(q.x, q.z); S.pitch = .5 } snapCam();
      document.body.classList.add('hudlite');
    }, [seed, hole, clock, aim]);
    for (const l of [1, 2, 3]) {
      await page.evaluate(l => { gfxSet(l, true); $('hint').classList.remove('on'); $('msg').classList.remove('on') }, l);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/s${seed}-h${hole}-t${clock}-g${l}.png` });
    }
  }
  const ft = await page.evaluate(() => new Promise(r => { const t = []; let p = performance.now(); const f = n => { t.push(n - p); p = n; t.length < 60 ? requestAnimationFrame(f) : r(t.sort((a, b) => a - b)[30]) }; requestAnimationFrame(f) }));
  console.log('median frame (ms, software GL, Ultra):', ft.toFixed(1));
}
console.log(errors.length ? 'PAGE ERRORS:\n' + [...new Set(errors)].join('\n') : 'no page errors');
await browser.close();
