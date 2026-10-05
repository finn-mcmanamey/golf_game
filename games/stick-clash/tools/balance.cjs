// Weapon balance: every visible weapon fights every other, CPU vs CPU (no skills, orbs, classes or throwables), two halves per pair with
// sides swapped, maps rotated over all visible arenas, on 4 parallel pages. Prints each weapon's round win rate and
// writes tmp/balance-weapons-<diff>.json (per weapon and per pair). Run `node build.mjs` first.
//   node tools/balance.cjs [secsPerPair=120] [diff=normal] [workers=4] [onlyKeysComma]
//   POWER='{"wand":0.8}' node tools/balance.cjs ...   tries `power` overrides without editing the weapon files
//   V3=1 node tools/balance.cjs ...   v3 mechanics on: each segment gives both fighters the same random class and throwables
// 120 s per pair gives ~300-400 rounds per weapon (about ±2.5%); the full run takes ~4.5 min. Target 40-60%.
const path = require('path'), fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [secs = 120, diff = 'normal', workers = 4, only = ''] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const open = async () => { const p = await browser.newPage(); await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await p.goto('file://' + path.join(__dirname, '..', 'dist', 'stick-clash.html')); await p.waitForFunction(() => window.SC && SC.G.state === 'menu');
    await p.evaluate(pw => { for (const k in pw) SC.reg.WEAPONS[k].power = pw[k]; }, JSON.parse(process.env.POWER || '{}')); return p; };
  const p0 = await open();
  const keys = await p0.evaluate(() => Object.keys(SC.reg.WEAPONS).filter(k => !SC.reg.WEAPONS[k].hidden && !SC.reg.WEAPONS[k].secret));
  const onlySet = only ? new Set(only.split(',')) : null;
  const pairs = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
    if (!onlySet || onlySet.has(keys[i]) || onlySet.has(keys[j])) pairs.push([keys[i], keys[j]]);
  const chunks = Array.from({ length: +workers }, (_, w) => pairs.filter((_, i) => i % workers === w));
  const t0 = Date.now();
  const results = (await Promise.all(chunks.map(async (chunk, w) => {
    const page = w ? await open() : p0;
    return page.evaluate(([chunk, secs, diff, v3]) => {
      const maps = Object.keys(SC.reg.MAPS).filter(k => !SC.reg.MAPS[k].hidden);
      return chunk.map(([a, b], n) => {
        const r = { a, b, wa: 0, wb: 0, rounds: 0, time: 0, timeouts: 0 };
        for (let k = 0; k < 2; k++) {
          const swap = k % 2;
          const cls = v3 ? resolveClass('random') : 'none', th = v3 ? resolveThrows(['random', 'random']) : ['none', 'none'];
          SC.start({ mode: 'watch', diff, orbs: false, map: maps[(n * 2 + k) % maps.length], weapons: swap ? [b, a] : [a, b], skills: [['none', 'none'], ['none', 'none']],
            classes: [cls, cls], throws: [th, th], winScore: 999 });   // weapons only (V3=1: plus the same class and throwables)
          SC.G.state = 'play'; SC.sim(secs / 2);
          for (const l of SC.G.log) {
            if (l.winner < 0) { r.rounds++; r.time += l.time; r.timeouts++; continue; }
            r.rounds++; r.time += l.time; if (l.reason === 'time') r.timeouts++;
            if ((l.winner === 0) !== !!swap) r.wa++; else r.wb++;   // by side: a disarmed winner may hold another weapon
          }
        }
        return r;
      });
    }, [chunk, +secs, diff, !!process.env.V3]);
  }))).flat();
  const per = {};
  for (const k of keys) per[k] = { wins: 0, rounds: 0, time: 0 };
  for (const r of results) {
    per[r.a].wins += r.wa; per[r.b].wins += r.wb;
    per[r.a].rounds += r.rounds; per[r.b].rounds += r.rounds; per[r.a].time += r.time; per[r.b].time += r.time;
  }
  const cat = await p0.evaluate(() => Object.fromEntries(Object.keys(SC.reg.WEAPONS).map(k => [k, SC.reg.WEAPONS[k].ranged ? 'ranged' : 'melee'])));
  const rows = keys.filter(k => per[k].rounds).map(k => ({ weapon: k, type: cat[k], win: +(100 * per[k].wins / per[k].rounds).toFixed(1), rounds: per[k].rounds, avgRound: +(per[k].time / per[k].rounds).toFixed(1) }))
    .sort((x, y) => y.win - x.win);
  fs.writeFileSync(path.join(__dirname, '..', 'tmp', `balance-weapons-${diff}${process.env.V3 ? '-v3' : ''}${only ? '-only' : ''}.json`), JSON.stringify({ secs, diff, rows, pairs: results }, null, 0));
  console.table(rows);
  console.log('took', ((Date.now() - t0) / 1000).toFixed(0), 's; pairs', pairs.length);
  await browser.close();
})();
