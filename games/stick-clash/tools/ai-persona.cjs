// CPU rivals bench (headless, SC.sim; run `node build.mjs` first):
//   1. personas: each rival (with its favourite gear) vs a plain Normal CPU: actions per round and distance kept;
//   2. adaptive: knobs stay between the level and its neighbour; a strong / weak autopilot "human" vs Normal CPUs
//      with adaptive on and off; never active in Ranked;
//   3. habits: a scripted human repeating dash-ins or jump-ins vs a Hard CPU, with habit reading on and off.
//   node tools/ai-persona.cjs [secsPerPersona=150] [personas|adapt|habits|all]
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

(async () => {
  const [secs = 150, what = 'all'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC);
  const all = what === 'all';

  if (all || what === 'personas') {
    const rows = await page.evaluate(secs => {
      const maps = Object.keys(SC.reg.MAPS).filter(k => !SC.reg.MAPS[k].hidden && SC.reg.MAPS[k].floor != null);
      let orbs = 0;
      on('orb', f => { if (f.id === 0) orbs++; });
      const out = [];
      for (const key of ['none', ...aiPersonaKeys()]) {
        const tot = { blocks: 0, parries: 0, grabs: 0, throws: 0, dashes: 0, ults: 0, jumps: 0 };
        let rounds = 0, wins = 0, dist = 0, samples = 0; orbs = 0;
        for (let g = 0; g < 4; g++) {
          const e = aiPersonaEntry({ weapon: 'random', skills: ['random', 'random'], cls: 'random', throws: ['random', 'random'] }, key, { gear: 'force' });
          SC.start({ mode: 'watch', diffs: ['normal', 'normal'], personas: [key], map: maps[(g * 5 + key.length) % maps.length], winScore: 999,
            weapons: [e.weapon, 'random'], skills: [e.skills, ['random', 'random']], classes: [e.cls, 'random'], throws: [e.throws, ['random', 'random']] });
          SC.G.state = 'play';
          let last = null;
          const add = f => { for (const k of ['blocks', 'parries', 'grabs', 'dashes', 'ults', 'jumps']) tot[k] += f.stats[k] || 0; tot.throws += f.stats.thrown || 0; };
          for (let t = 0; t < secs / 4; t += .1) {
            SC.sim(.1);
            const a = SC.F[0], b = SC.F[1];
            if (last && last !== a) add(last);
            last = a;
            if (a && b && a.alive && b.alive && SC.G.lock <= 0) { dist += Math.abs(a.P[2].x - b.P[2].x); samples++; }
          }
          add(last);
          for (const l of SC.G.log) { if (l.winner < 0) continue; rounds++; if (l.winner === 0) wins++; }
        }
        const r = n => +(n / rounds).toFixed(2);
        out.push({ persona: key, title: key === 'none' ? '(plain CPU)' : aiPersona(key).title, rounds, 'win%': Math.round(100 * wins / rounds),
          blocks: r(tot.blocks), parries: r(tot.parries), grabs: r(tot.grabs), throwables: r(tot.throws), dashes: r(tot.dashes),
          ults: r(tot.ults), orbs: r(orbs), 'avg dist': Math.round(dist / samples) });
      }
      return { out, talk: AI_TALK.said, errors: SC.errors.map(e => e.msg) };
    }, +secs);
    console.log('Per-round actions of each rival (Normal, own favourite gear) vs a plain Normal CPU:');
    console.table(rows.out);
    console.log(`bubbles said: ${rows.talk}; errors: ${rows.errors.length ? rows.errors.join(' | ') : 'none'}`);
  }

  if (all || what === 'adapt') {
    const res = await page.evaluate(() => {
      // Bounds: with v at ±1 every knob stays between the level and its neighbour (≤ AI_ADAPT.max of the gap).
      SC.start({ mode: 'versus', diff: 'normal', autopilot: true, loadouts: [{}, { persona: 'none' }] });
      const f = SC.F[1], bounds = [];
      for (const lvl of AI_ORDER) for (const v of [-1, 1]) {
        AI_ADAPT.v = v; f.aiLevel = lvl;
        const L = aiTuned(f), base = AI_LEVELS[lvl], nb = AI_LEVELS[AI_ORDER[AI_ORDER.indexOf(lvl) + v]] || base;
        let worst = 0, out = 0;
        for (const k in Object.assign({}, base, nb)) {
          const b0 = base[k] ?? 0, b1 = nb[k] ?? 0;
          if (typeof b0 !== 'number' || typeof b1 !== 'number' || b0 === b1 || k === 'armor' || k === 'gunArmor') continue;
          const share = ((L[k] ?? 0) - b0) / (b1 - b0);
          worst = Math.max(worst, share); if (share < -1e-9 || share > AI_ADAPT.max + 1e-9) out++;
        }
        bounds.push({ level: lvl, v, 'max share of gap': +worst.toFixed(3), 'knobs out of bounds': out, react: +L.react.toFixed(3), attack: +L.attack.toFixed(3) });
      }
      // Effect: an autopilot "human" one or two levels off the CPU's, adaptive on vs off.
      const duel = (humanLvl, adaptive) => {
        SETTINGS.adaptive = adaptive;
        const off = on('roundStart', () => { SC.F[0].aiLevel = humanLvl; SC.F[0].ai.L = null; });
        let cpu = 0, n = 0, vs = [];
        for (let g = 0; g < 4; g++) {
          SC.start({ mode: 'versus', diff: 'normal', autopilot: true, winScore: 999, weapons: ['random', 'random'], loadouts: [{}, { persona: 'none' }] });
          SC.F[0].aiLevel = humanLvl; SC.F[0].ai.L = null; SC.G.state = 'play';
          SC.sim(150);
          for (const l of SC.G.log) { if (l.winner < 0) continue; n++; if (l.winner === 1) cpu++; }
          vs.push(...AI_ADAPT.log.map(x => x.v));
        }
        off(); SETTINGS.adaptive = true;
        return { 'human proxy': humanLvl, adaptive: adaptive ? 'on' : 'off', rounds: n, 'CPU win%': Math.round(100 * cpu / n),
          'v range': vs.length ? `${Math.min(...vs).toFixed(2)}..${Math.max(...vs).toFixed(2)}` : '-', 'mean v': vs.length ? +(vs.reduce((s, x) => s + x, 0) / vs.length).toFixed(2) : 0 };
      };
      const effect = [duel('hard', false), duel('hard', true), duel('easy', false), duel('easy', true)];
      SC.start({ mode: 'ranked', autopilot: true });
      return { bounds, effect, ranked: aiAdaptOn(), errors: SC.errors.map(e => e.msg) };
    });
    console.log('Adaptive bounds (share of the gap to the neighbour level; cap ' + 0.4 + '):');
    console.table(res.bounds);
    console.table(res.effect);
    console.log(`adaptive active in Ranked: ${res.ranked}; errors: ${res.errors.length ? res.errors.join(' | ') : 'none'}`);
  }

  if (all || what === 'habits') {
    const res = await page.evaluate(() => {
      // A scripted human that only ever does one thing. Success = the CPU loses health within .6 s of the swing.
      function proxyRun(pattern, habitsOn, seconds) {
        AI_HABIT.on = habitsOn;
        SC.start({ mode: 'versus', diff: 'hard', hpMul: 4, winScore: 999, weapons: ['katana', 'katana'], skills: [['none', 'none'], ['none', 'none']],
          classes: ['none', 'none'], throws: [['none', 'none'], ['none', 'none']], loadouts: [{}, { persona: 'none' }] });
        SC.G.state = 'play';
        const tries = [];
        let next = 0, swingAt = 0, cpuHp = 0;
        for (let t = 0; t < seconds; t += DT) {
          const me = SC.F[0], cpu = SC.F[1];
          if (me && cpu && me.alive && cpu.alive && SC.G.lock <= 0 && !SC.G.ending) {
            const dx = cpu.P[2].x - me.P[2].x, d = Math.abs(dx), dir = Math.sign(dx) || 1, now = SC.G.t;
            me.inp.mx = 0;
            if (swingAt && now >= swingAt) { me.inp.attack = true; swingAt = 0; tries.push({ t: now, hp: cpu.hp, cpu, dmg: 0 }); }
            else if (!swingAt && now > next) {
              const lo = pattern === 'dashIn' ? 170 : 120, hi = pattern === 'dashIn' ? 320 : 240;
              if (d > hi) me.inp.mx = dir; else if (d < lo) me.inp.mx = -dir;
              else if (me.grounded && me.dashCd <= 0) {
                me.face = dir;
                if (pattern === 'dashIn') { me.inp.dash = dir; swingAt = now + .1; } else { me.inp.jump = true; me.inp.mx = dir; swingAt = now + .22; }
                next = now + 1.4;
              }
            } else if (pattern === 'jumpIn' && swingAt) me.inp.mx = dir;
          }
          SC.sim(DT);
          for (const tr of tries) if (!tr.done && SC.G.t - tr.t > .6) { tr.done = true; tr.dmg = tr.hp - Math.max(0, tr.cpu.hp); tr.hit = tr.dmg >= 3; }
        }
        AI_HABIT.on = true;
        const rate = list => list.length ? Math.round(100 * list.filter(x => x.hit).length / list.length) : null;
        const done = tries.filter(x => x.done), dmg = list => list.length ? list.reduce((s, x) => s + x.dmg, 0) / list.length : 0;
        return { pattern, habits: habitsOn ? 'on' : 'off', tries: done.length, 'success% first 5': rate(done.slice(0, 5)),
          'success% after': rate(done.slice(5)), 'dmg/try after': dmg(done.slice(5)), reads: AI_HABIT.reads, seen: (AI_HAB[0] || { n: {} }).n[pattern] || 0 };
      }
      const rows = [];
      for (const p of ['dashIn', 'jumpIn']) for (const on of [false, true]) {
        const r = [0, 1, 2, 3, 4, 5].map(() => proxyRun(p, on, 70));
        const sum = k => r.reduce((s, x) => s + (x[k] || 0), 0);
        rows.push({ pattern: p, habits: on ? 'on' : 'off', tries: sum('tries'), 'success% first 5': Math.round(sum('success% first 5') / r.length),
          'success% after': Math.round(sum('success% after') / r.length), 'dmg/try after': +(sum('dmg/try after') / r.length).toFixed(1), reads: sum('reads') });
      }
      // A turtle: holds guard and walks in. Counted: grabs it eats per minute.
      const turtle = on => {
        AI_HABIT.on = on;
        let grabs = 0, hurt = 0, reads = 0; const off = window.on('grab', (A, B) => { if (B.id === 0) grabs++; });
        for (let g = 0; g < 4; g++) {
          SC.start({ mode: 'versus', diff: 'hard', hpMul: 4, winScore: 999, weapons: ['katana', 'katana'], loadouts: [{}, { persona: 'none' }] });
          SC.G.state = 'play';
          for (let t = 0; t < 90; t += DT) {
            const me = SC.F[0], cpu = SC.F[1];
            if (me && cpu) { me.inp.blockHeld = true; me.inp.mx = Math.abs(cpu.P[2].x - me.P[2].x) > 60 ? Math.sign(cpu.P[2].x - me.P[2].x) : 0; }
            SC.sim(DT);
          }
          hurt += SC.G.log.length * 400 + (SC.F[0].maxHp - SC.F[0].hp); reads += AI_HABIT.reads;
        }
        off(); AI_HABIT.on = true;
        return { pattern: 'turtle', habits: on ? 'on' : 'off', 'grabs taken /min': +(grabs / 6).toFixed(1), 'hp lost /min': Math.round(hurt / 6), reads };
      };
      return { rows, turtle: [turtle(false), turtle(true)], errors: SC.errors.map(e => e.msg) };
    });
    console.log('Scripted human repeating one pattern vs a Hard CPU (6 × 70 s each; success = the swing took ≥ 3 hp, i.e. more than block chip):');
    console.table(res.rows);
    console.table(res.turtle);
    console.log(`errors: ${res.errors.length ? res.errors.join(' | ') : 'none'}`);
  }
  await browser.close();
})();
