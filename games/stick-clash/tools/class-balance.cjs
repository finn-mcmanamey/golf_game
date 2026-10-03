// Class balance: every class fights every other, CPU vs CPU. Each segment gives both fighters the SAME random weapon,
// skills and throwables (orbs on), so the only difference is the class; sides swap every segment and arenas rotate.
// Prints each class's round win rate and the pair matrix, and writes tmp/balance-classes-<diff>.json. Target 35-65%
// for every pair (40-60% overall). Run `node build.mjs` first.
//   node tools/class-balance.cjs [segments=12] [secsPerSegment=20] [diff=normal] [workers=4]
//   CLASSES='{"tank":{"hp":1.3}}' node tools/class-balance.cjs ...   tries class overrides without editing 24-classes.js
const path = require('path'), fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [segs = 12, secs = 20, diff = 'normal', workers = 4] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const open = async () => {
    const p = await browser.newPage();
    await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await p.goto('file://' + path.join(__dirname, '..', 'dist', 'stick-clash.html'));
    await p.waitForFunction(() => window.SC && SC.G.state === 'menu');
    await p.evaluate(o => { for (const k in o) Object.assign(SC.reg.CLASSES[k], o[k]); }, JSON.parse(process.env.CLASSES || '{}'));
    return p;
  };
  const p0 = await open();
  const keys = await p0.evaluate(() => Object.keys(SC.reg.CLASSES).filter(k => !SC.reg.CLASSES[k].hidden));
  const pairs = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) pairs.push([keys[i], keys[j]]);
  const chunks = Array.from({ length: +workers }, (_, w) => pairs.filter((_, i) => i % workers === w));
  const t0 = Date.now();
  const results = (await Promise.all(chunks.map(async (chunk, w) => {
    const page = w ? await open() : p0;
    return page.evaluate(([chunk, segs, secs, diff]) => {
      const maps = Object.keys(SC.reg.MAPS).filter(k => !SC.reg.MAPS[k].hidden);
      const pickW = () => randomKey(SC.reg.WEAPONS), pickS = () => resolveSkills(['random', 'random']), pickT = () => resolveThrows(['random', 'random']);
      return chunk.map(([a, b], n) => {
        const r = { a, b, wa: 0, wb: 0, rounds: 0, time: 0 };
        for (let k = 0; k < segs; k++) {
          const swap = k % 2, w = pickW(), s = pickS(), t = pickT();
          SC.start({ mode: 'watch', diff, map: maps[(n * segs + k) % maps.length], weapons: [w, w], skills: [s, s], throws: [t, t],
            classes: swap ? [b, a] : [a, b], winScore: 999 });
          SC.G.mode.rerollRandom = false; SC.G.state = 'play'; SC.sim(secs);
          SC.G.mode.rerollRandom = true;
          for (const l of SC.G.log) {
            r.rounds++; r.time += l.time;
            if (l.winner < 0) continue;
            if ((l.winner === 0) !== !!swap) r.wa++; else r.wb++;
          }
        }
        return r;
      });
    }, [chunk, +segs, +secs, diff]);
  }))).flat();
  const per = Object.fromEntries(keys.map(k => [k, { wins: 0, rounds: 0 }]));
  for (const r of results) { per[r.a].wins += r.wa; per[r.b].wins += r.wb; per[r.a].rounds += r.rounds; per[r.b].rounds += r.rounds; }
  const rows = keys.map(k => ({ class: k, win: +(100 * per[k].wins / per[k].rounds).toFixed(1), rounds: per[k].rounds })).sort((x, y) => y.win - x.win);
  const matrix = {};
  for (const k of keys) matrix[k] = {};
  for (const r of results) {
    const n = r.wa + r.wb || 1;
    matrix[r.a][r.b] = Math.round(100 * r.wa / n); matrix[r.b][r.a] = Math.round(100 * r.wb / n);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'tmp', `balance-classes-${diff}.json`), JSON.stringify({ segs, secs, diff, rows, matrix, pairs: results }));
  console.table(rows);
  console.log('row class win % against column class:');
  console.table(matrix);
  const worst = results.map(r => [r.a, r.b, 100 * r.wa / (r.wa + r.wb || 1)]).sort((x, y) => Math.abs(y[2] - 50) - Math.abs(x[2] - 50))[0];
  console.log(`most lopsided pair: ${worst[0]} vs ${worst[1]} ${worst[2].toFixed(0)}%`);
  console.log('took', ((Date.now() - t0) / 1000).toFixed(0), 's; pairs', pairs.length);
  await browser.close();
})();
