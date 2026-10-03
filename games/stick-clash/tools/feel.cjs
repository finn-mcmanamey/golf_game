// Movement feel numbers for one scripted fighter alone in the arena: acceleration, stopping, turning, jumps, dash.
//   node tools/feel.cjs ['{"jumpVel":1400}']    (optional TUNE overrides as JSON). Run `node build.mjs` first.
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

(async () => {
  const tune = JSON.parse(process.argv[2] || '{}');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC);
  const out = await page.evaluate(tune => {
    Object.assign(SC.TUNE, tune);
    const step = n => { for (let i = 0; i < n; i++) SC.sim(DT); };
    const hipVx = f => vx(f.P[2]);
    // A fresh fighter standing in the open centre of the arena, its opponent removed.
    const solo = () => {
      SC.start({ mode: 'pvp', map: 'neon', weapons: ['blade', 'blade'] });
      SC.G.state = 'paused'; SC.G.lock = 0;
      const [f, g] = SC.F;
      g.alive = false; moveFighter(g, 0, 2000); moveFighter(f, 640 - f.P[2].x, 0);
      SC.sim(.6);
      return f;
    };
    const timeUntil = (f, cond) => { let t = 0; while (!cond() && t < 2) { step(1); t += DT; } return +t.toFixed(3); };
    const r = {};
    let f = solo();
    f.inp.mx = 1; r.accelTo90 = timeUntil(f, () => hipVx(f) > SC.TUNE.speed * .9); step(60);
    r.topSpeed = Math.round(hipVx(f));
    const x0 = f.P[2].x; f.inp.mx = 0; r.stopTime = timeUntil(f, () => Math.abs(hipVx(f)) < 30); r.slide = Math.round(f.P[2].x - x0);
    f.inp.mx = 1; step(60); f.inp.mx = -1; r.turn = timeUntil(f, () => hipVx(f) < -SC.TUNE.speed * .9);
    const jump = (held, secondAt) => {
      f = solo(); const y0 = f.P[2].y; let top = y0, apex = 0, air = 0;
      f.inp.jumpHeld = held; SC.press(0, 'jump');
      for (let i = 0; i < 400; i++) {
        step(1); air += DT;
        if (secondAt && Math.abs(air - secondAt) < DT / 2) SC.press(0, 'jump');
        if (f.P[2].y < top) { top = f.P[2].y; apex = air; }
        if (air > .1 && f.grounded) break;
      }
      return `${Math.round(y0 - top)}px, apex ${apex.toFixed(2)}s, lands ${air.toFixed(2)}s`;
    };
    r.fullJump = jump(true); r.shortHop = jump(false); r.doubleJump = jump(true, .35);
    f = solo(); const x1 = f.P[2].x; f.inp.dash = 1; step(60); r.dash = Math.round(f.P[2].x - x1) + 'px';
    return r;
  }, tune);
  console.table(out);
  await browser.close();
})();
