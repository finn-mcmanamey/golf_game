// Leaderboard check: fakes the artifact runtime with an in-memory db, plants an honest run, a forged time on
// that run's code and a copied code, and checks only the honest run is shown. Needs Playwright.
//   node rowing/test/leaderboard.cjs

const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    const rows = new Map(), subs = [];
    const snap = () => ({ docs: [...rows].map(([id, d]) => ({ id, exists: true, data: () => d })).sort((a, b) => a.data().dailyTime - b.data().dailyTime) });
    const q = { where: () => q, orderBy: () => q, limit: () => q, onSnapshot: fn => { subs.push(fn); setTimeout(() => fn(snap()), 10); return () => {} } };
    const db = { collection: () => q, doc: path => ({ set: async d => { rows.set(path.split('/')[1], d); subs.forEach(f => f(snap())) } }) };
    window.__rows = rows; window.__push = () => subs.forEach(f => f(snap()));
    window.claude = { use: async n => n === 'db' ? db : n === 'user' ? { id: async () => 'u_me' } : null };
  });
  await p.goto('file://' + require('node:path').resolve(__dirname, '../dist/index.html'));
  await p.waitForFunction(() => typeof dailyOpts === 'function');
  await p.evaluate(() => {
    // An honest run: re-row today's daily with the autopilot, and a forged one claiming an impossible time.
    const o = dailyOpts(), r = makeRace(o);
    while (!r.done) stepRace(r, r.started ? packInput(autoRow(r.player), 34) : packInput(0, 34));
    const code = encodeRace(o, r.inputs);
    __rows.set('u_honest', { name: 'Honest Hans', dailySeed: o.seed, dailyTime: r.player.finishTime, dailyCode: code });
    __rows.set('u_cheat', { name: 'Cheaty Pete', dailySeed: o.seed, dailyTime: 60, dailyCode: code }); __rows.set('u_copy', { name: 'Copycat', dailySeed: o.seed, dailyTime: r.player.finishTime, dailyCode: code, at: Date.now() + 5 }); __rows.get('u_honest').at = Date.now();
    __push();
  });
  await p.waitForTimeout(3000);
  const text = await p.evaluate(() => $('dailyBoard').innerText);
  const ok = text.includes('Honest Hans') && !text.includes('Cheaty Pete') && !text.includes('Copycat');
  console.log(ok ? 'ok: only the honest run is shown' : 'FAIL: ' + text.replace(/\n/g, ' | '));
  if (!ok) process.exitCode = 1;

  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
