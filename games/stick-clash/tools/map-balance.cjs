// Arena check: CPU vs CPU with random weapons and skills on every visible arena: round lengths, how rounds end
// (ko / time / draw), how often fighters stay upright, errors. Run `node build.mjs` first.
//   node tools/map-balance.cjs [simSecsPerMap=400] [diff=normal]
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const secs = +(process.argv[2] || 240), diff = process.argv[3] || 'normal';
  const b = await chromium.launch(); const page = await b.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  const out = await page.evaluate(([secs, diff]) => {
    const keys = Object.keys(SC.reg.MAPS).filter(k => !SC.reg.MAPS[k].hidden);
    return keys.map(k => {
      const rows = []; let reasons = {};
      for (let i = 0; i < 4; i++) {
        SC.start({ mode: 'watch', map: k, diff, weapons: ['random', 'random'], winScore: 999 });
        SC.G.state = 'play'; SC.sim(secs / 4);
        for (const l of SC.G.log) { rows.push(l); reasons[l.reason] = (reasons[l.reason] || 0) + 1; }
      }
      const ts = rows.map(r => r.time).sort((a, b) => a - b);
      const up = rows.flatMap(r => r.fighters.map(f => f.upright));
      return { map: k, rounds: rows.length, median: ts[ts.length >> 1]?.toFixed(1), mean: (ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1),
        max: ts[ts.length - 1]?.toFixed(1), upright: Math.round(100 * up.reduce((a, b) => a + b, 0) / up.length) + '%', reasons: JSON.stringify(reasons), errors: SC.errors.length };
    });
  }, [secs, diff]);
  console.table(out); await b.close();
})();
