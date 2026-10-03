// tools/juice.cjs: real-time checks for the juice slices that SC.sim can't cover (sound, kill-cam replay).
// Plays a CPU duel to one point with and without WebAudio, waits for the K.O. replay, skips nothing, and checks that
// the replay plays, the results then appear, and nothing errors. Screenshots go to tmp/juice/.
// Usage: node tools/juice.cjs   (run `node build.mjs` first)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'tmp', 'juice');
fs.mkdirSync(OUT, { recursive: true });

async function run(browser, noAudio) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (noAudio) await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.keyboard.press('KeyX');             // a user gesture starts the audio
  await page.waitForTimeout(400);
  const audio = await page.evaluate(() => !!AC);
  await page.evaluate(() => { SC.start({ mode: 'watch', winScore: 1, weapons: ['katana', 'battle-axe'] }); });
  await page.waitForTimeout(1400);
  await page.evaluate(() => { for (const f of SC.F) f.hp = 20; });
  let sawReplay = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    const s = await page.evaluate(() => SC.G.state);
    if (s === 'killcam' && !sawReplay) { sawReplay = true; await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, `replay${noAudio ? '-noaudio' : ''}.png`) }); }
    if (s === 'over') break;
    await page.waitForTimeout(80);
  }
  const over = await page.evaluate(() => SC.G.state === 'over' && !SC.G.override);
  const gameErrors = await page.evaluate(() => SC.errors.map(e => e.msg));
  await page.close();
  return { noAudio, audio, sawReplay, over, errors: errors.concat(gameErrors) };
}

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const noAudio of [false, true]) {
      const r = await run(browser, noAudio);
      const ok = r.sawReplay && r.over && !r.errors.length && r.audio === !noAudio;
      if (!ok) failed++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${noAudio ? 'without WebAudio' : 'with WebAudio   '}  replay:${r.sawReplay} results:${r.over} audio:${r.audio} errors:${r.errors.join(' | ') || 'none'}`);
    }
  } finally { await browser.close(); }
  process.exit(failed ? 1 : 0);
})();
