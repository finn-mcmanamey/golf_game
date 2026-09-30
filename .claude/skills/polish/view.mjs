// Screenshots the built game so Claude can see it. Usage:
//   node .claude/skills/polish/view.mjs <outdir> [view ...]
// Views: front (title page) · tee:<seed>[:<hole>] (on the tee) · card:<seed> (a 3-hole scorecard) ·
// sheet:<tab> (a clubhouse tab, e.g. sheet:pSettings) · add @mobile to any view for a 390x844 phone screen.
// Prints each file written and any page errors.
import { mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

let pw;
try { pw = await import('playwright') } catch { pw = await import(execSync('npm root -g').toString().trim() + '/playwright/index.mjs') }
const [out = '.', ...views] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const PAGE = 'file://' + new URL('../../../dist/index.html', import.meta.url).pathname;

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const raw of views.length ? views : ['front']) {
  const [view, device] = raw.split('@'), mobile = device === 'mobile';
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: mobile });
  page.on('pageerror', e => errors.push(raw + ': ' + e));
  page.on('console', m => { if (m.type() === 'error') errors.push(raw + ': ' + m.text()) });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.VL && VL.S);
  const [kind, a, b] = view.split(':');
  await page.evaluate(([kind, a, b]) => {
    // the same steps the buttons take; a fixed seed so every round of the loop shows the same scene
    const tee = (seed, n, hole, tier = 0) => { S.seed = seed; seedIn.value = seed; S.over = false; S.setup = 0; S.season = courseSeason(seed); S.wear = 0; S.casual = 0; S.kind = 0; startRound(n, null, null, tier); if (hole) loadHole(hole); S.intro = null; snapCam() };
    if (kind === 'tee') tee(+a || 2206, 9, +b || 0);
    else if (kind === 'card') { tee(+a || 2206, 3, 0, 3); for (let h = 0; h < 3; h++) { S.log[h] = ghostLog(h).slice(); S.strokes[h] = holeStrokes(S.log[h], S.pars[h]) } showCard(true) }
    else if (kind === 'sheet') chTab(a || 'pPlay');
  }, [kind, a, b]);
  await page.waitForTimeout(2000);
  const file = `${out}/${view.replace(/:/g, '-')}${mobile ? '-mobile' : ''}.png`;
  await page.screenshot({ path: file });
  console.log('wrote ' + file);
  await page.close();
}
console.log(errors.length ? 'PAGE ERRORS:\n' + [...new Set(errors)].join('\n') : 'no page errors');
await browser.close();
