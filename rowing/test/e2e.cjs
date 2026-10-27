// End-to-end smoke test: plays one short race in each mode in headless Chromium and fails on any page error.
// Needs Playwright with Chromium (not a dependency of this repo). Run after `npm run build:rowing`:
//   node rowing/test/e2e.cjs            (add --shots to save a screenshot per mode in rowing/test/shots/)
// Software rendering is slow, so the races are 250 m and fast-forwarded once they start.
const { chromium } = require('playwright');
const path = require('node:path'), fs = require('node:fs');

const page = 'file://' + path.resolve(__dirname, '../dist/index.html') + '#autopilot';
const shots = process.argv.includes('--shots') && path.resolve(__dirname, 'shots');
const MODES = [
  { name: 'regatta', setup: "settings.kind='regatta';settings.cls='1x'", button: '#btnRace' },
  { name: 'eight', setup: "settings.kind='regatta';settings.cls='8+'", button: '#btnRace' },
  { name: 'head race', setup: "settings.kind='head';settings.cls='1x'", button: '#btnRace' },
  { name: 'bumps', setup: "settings.kind='bumps';settings.cls='4x'", button: '#btnRace', distance: 500 },
  { name: 'week', setup: "settings.kind='regatta';settings.cls='1x'", button: '#btnWeek', note: true },
  { name: 'boat race', setup: "settings.kind='regatta'", start: 'startBoatRace(250)', note: true },
  { name: 'erg', setup: "settings.kind='erg'", button: '#btnRace' },
  { name: 'cup', setup: "settings.kind='regatta';settings.cls='2x'", button: '#btnCup' },
  { name: 'season', setup: "settings.kind='regatta'", button: '#btnCareer' },
];

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let failed = 0;
  if (shots) fs.mkdirSync(shots, { recursive: true });
  for (const m of MODES) {
    const p = await browser.newPage({ viewport: { width: 960, height: 540 } }), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) });
    const t0 = Date.now();
    try {
      await p.goto(page);
      await p.evaluate(m.setup + `;settings.distance=${m.distance || 250};menuChanged()`);
      if (m.start) await p.evaluate(m.start); else await p.click(m.button);
      await p.waitForFunction(() => race.started, null, { timeout: 120000 });
      await p.waitForTimeout(1500);
      if (shots) await p.screenshot({ path: path.join(shots, m.name.replace(/ /g, '-') + '.png') });
      await p.evaluate(() => { game.fastForward = true });
      await p.waitForFunction(() => game.state === 'results', null, { timeout: 300000 });
      const r = await p.evaluate(() => ({ time: race.player.finishTime ?? race.player.out?.t, place: placeOf(race, race.player), boats: race.boats.length }));
      if (r.time == null) errors.push('player did not finish');
      if (m.note && !(await p.textContent('#careerNote')).trim()) errors.push('no campaign note on the results');
      console.log(`${errors.length ? 'FAIL' : 'ok  '} ${m.name.padEnd(10)} ${fmt(r.time)} place ${r.place}/${r.boats} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    } catch (e) { errors.push(e.message.split('\n')[0]); console.log(`FAIL ${m.name}`) }
    for (const e of errors) console.log('     ' + e);
    failed += errors.length ? 1 : 0;
    await p.close();
  }
  await browser.close();
  console.log(failed ? `${failed} mode(s) failed` : 'all modes ok');
  process.exit(failed ? 1 : 0);
})();

function fmt(s) { return s == null ? '–' : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}` }
