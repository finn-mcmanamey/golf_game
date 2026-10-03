// Skill balance (CPU vs CPU, 4 parallel pages). Run `node build.mjs` first.
//   impact: a carrier of one skill vs the same random weapon with no skills (sides swapped) -> carrier win %, uses/round
//           (a skill should help: aim for ~52-68%)
//   field:  both fighters carry two random skills and random weapons -> win % of rounds where the skill was carried
//           (aim for 40-60%)
//   node tools/skill-balance.cjs [impactSecsPerSkill=2400] [fieldSecsPerWorker=7200] [diff=normal]   (~4 min)
//   ONLY=fireball,mend node tools/skill-balance.cjs 6000 0    re-measures just those skills' impact
const path = require('path'), fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const [isecs = 2400, fsecs = 7200, diff = 'normal'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const open = async () => { const p = await b.newPage(); await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await p.goto('file://' + path.join(__dirname, '..', 'dist', 'stick-clash.html')); await p.waitForFunction(() => window.SC && SC.G.state === 'menu');
    if (process.env.PATCH) await p.evaluate(process.env.PATCH); return p; };
  const pages = await Promise.all([0, 1, 2, 3].map(open));
  const keys = (await pages[0].evaluate(() => Object.keys(SC.reg.SKILLS).filter(k => !SC.reg.SKILLS[k].hidden))).filter(k => !process.env.ONLY || process.env.ONLY.split(',').includes(k));
  const impact = (await Promise.all(pages.map((p, w) => p.evaluate(([keys, secs, diff]) => keys.map(k => {
    const maps = Object.keys(SC.reg.MAPS).filter(m => !SC.reg.MAPS[m].hidden);
    let win = 0, n = 0, used = 0, t = 0;
    for (let i = 0; i < 8; i++) {
      const wpn = randomKey(WEAPONS), swap = i % 2, sk = [[k, 'none'], ['none', 'none']];
      SC.start({ mode: 'watch', diff, map: maps[(i * 3 + k.length) % maps.length], weapons: [wpn, wpn], skills: swap ? [sk[1], sk[0]] : sk, winScore: 999,
        classes: ['none', 'none'], throws: [['none', 'none'], ['none', 'none']] });   // v3: skills only
      SC.G.state = 'play'; SC.sim(secs / 8);
      for (const l of SC.G.log) { if (l.winner < 0) continue; const ci = swap ? 1 : 0; n++; t += l.time; if (l.winner === ci) win++; used += l.fighters[ci].skillsUsed || 0; }
    }
    return { skill: k, impact: +(100 * win / n).toFixed(1), usesPerRound: +(used / n).toFixed(2), rounds: n, avgRound: +(t / n).toFixed(1) };
  }), [keys.filter((_, i) => i % 4 === w), +isecs, diff])))).flat();
  const field = await Promise.all(pages.map(p => p.evaluate(([secs, diff]) => {
    const s = {};
    let t = 0;
    while (t < secs) {
      SC.start({ mode: 'watch', diff, winScore: 999 }); SC.G.state = 'play'; SC.sim(60); t += 60;
      for (const l of SC.G.log) {
        if (l.winner < 0) continue;
        l.fighters.slice(0, 2).forEach((f, i) => { for (const sk of new Set(f.skills)) if (sk && sk !== 'none') { const r = s[sk] || (s[sk] = { w: 0, n: 0 }); r.n++; if (l.winner === i) r.w++; } });
      }
    }
    return s;
  }, [+fsecs, diff])));
  const F = {};
  for (const part of field) for (const k in part) { F[k] = F[k] || { w: 0, n: 0 }; F[k].w += part[k].w; F[k].n += part[k].n; }
  const rows = impact.map(r => ({ ...r, field: F[r.skill] ? +(100 * F[r.skill].w / F[r.skill].n).toFixed(1) : null, fieldN: F[r.skill] ? F[r.skill].n : 0 }))
    .sort((a, b) => b.impact - a.impact);
  if (!process.env.ONLY) fs.writeFileSync(path.join(__dirname, '..', 'tmp', `balance-skills-${diff}.json`), JSON.stringify(rows));
  console.table(rows);
  const errs = await pages[0].evaluate(() => SC.errors.map(e => e.msg));
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
