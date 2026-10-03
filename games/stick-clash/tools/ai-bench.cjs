// AI and mode bench (headless, SC.sim):
//   1. difficulty matrix: every CPU level fights every other level (random weapons and maps, sides swapped);
//      prints the row level's round win rate against each column level, plus average round length.
//   2. modes: every mode runs with humans on autopilot until it produces a result (or a time cap).
//   node tools/ai-bench.cjs [secondsPerPair=300] [modeCapSeconds=600] [matrix|modes|all]   (run `node build.mjs` first)
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

(async () => {
  const [secs = 300, cap = 600, what = 'all'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC);
  if (what !== 'modes') {
    const t0 = Date.now();
    const out = await page.evaluate(secs => {
      const levels = Object.keys(AI_LEVELS), maps = Object.keys(SC.reg.MAPS).filter(k => !SC.reg.MAPS[k].hidden);
      const table = {}, time = {};
      for (const a of levels) { table[a] = {}; for (const b of levels) table[a][b] = a === b ? '—' : null; }
      for (let i = 0; i < levels.length; i++) for (let j = i + 1; j < levels.length; j++) {
        let wa = 0, n = 0, t = 0;
        for (let k = 0; k < 6; k++) {
          const swap = k % 2, diffs = swap ? [levels[j], levels[i]] : [levels[i], levels[j]];
          SC.start({ mode: 'watch', diffs, map: maps[(i * 7 + j * 3 + k) % maps.length], weapons: ['random', 'random'], winScore: 999 });
          SC.G.state = 'play';
          SC.sim(secs / 6);
          for (const l of SC.G.log) { if (l.winner < 0) continue; n++; t += l.time; if (l.winner === (swap ? 1 : 0)) wa++; }
        }
        table[levels[i]][levels[j]] = Math.round(100 * wa / n) + '%';
        table[levels[j]][levels[i]] = Math.round(100 * (n - wa) / n) + '%';
        time[levels[i] + ' v ' + levels[j]] = { rounds: n, avgRound: (t / n).toFixed(1) + 's' };
      }
      return { table, time, errors: SC.errors.map(e => e.msg) };
    }, +secs);
    console.log('Round win rate of ROW level vs COLUMN level:');
    console.table(out.table);
    console.table(out.time);
    console.log(`matrix took ${((Date.now() - t0) / 1000).toFixed(1)} s; errors: ${out.errors.length ? out.errors.join(' | ') : 'none'}`);
  }
  if (what !== 'matrix') {
    const rows = await page.evaluate(cap => Object.keys(SC.reg.MODES).filter(k => !SC.reg.MODES[k].hidden).map(k => {
      const e0 = SC.errors.length, t0 = performance.now();
      SC.start({ mode: k, autopilot: true });
      let t = 0;
      while (SC.G.state !== 'over' && t < cap) { SC.sim(5); t += 5; }
      const r = SC.G.result;
      return { mode: k, over: SC.G.state === 'over', simSecs: t, rounds: SC.G.log.length, title: r ? r.title : '(running)',
        line: r && r.lines ? r.lines[0] : '', ms: Math.round(performance.now() - t0), errors: SC.errors.slice(e0).map(e => e.msg).join(' | ') };
    }), +cap);
    console.table(rows);
  }
  await browser.close();
})();
