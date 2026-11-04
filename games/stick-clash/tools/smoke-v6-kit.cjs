// Smoke tests for agent S's v6 kit: 8 skills, 3 classes, 4 throwables, 2 mounts and the Team Super. Called by
// tools/smoke.cjs; also runs on its own (`node tools/smoke-v6-kit.cjs`, after `node build.mjs`). Headless (SC.sim),
// seeded where it counts:
// - registry: every item is registered with a name, icon, description and codex lore; the mount orbs exist;
// - skills: each one scripted against a foe (reflect, teleport + bonus, shrink, launch, barrier, crash, rally, lift);
// - classes: the Duelist's late parry and riposte, the Wrestler's reach, throw and Piledriver, the Engineer's turret by
//   the throwable key (none left / hold to charge / tap still throws, once a round), and seeded CPU fights in which each
//   class plays to its passive;
// - throwables and mounts: each one on a foe, the duck luring a CPU, CPUs riding both mounts;
// - Team Super: two co-op humans (armed, Double Team hits every foe), a lone press firing its own ultimate, players too
//   far apart, and Versus, which must never arm it;
// - screenshots of the menus and the effects at 1920x1080@1 and 1536x864@1.25 (tmp/smoke/v6s-*.png).
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const SKILLS = ['mirror-shield', 'shadow-step', 'shrink-ray', 'spring-pad', 'wall-up', 'pinball', 'rally-cry', 'tornado'];
const CLASSES = ['duelist', 'wrestler', 'engineer'], THROWS = ['glue', 'bouncer', 'tornado-jar', 'duck'], MOUNTS = ['rocket-board', 'pogo'];

async function openPage(browser, view = { width: 1280, height: 720 }, dpr = 1) {
  const page = await browser.newPage({ viewport: view, deviceScaleFactor: dpr }), errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(HELPERS);
  return { page, errors };
}

// Page-side helpers: seeded randomness, a still duel on the flat Neon floor, and placing fighters.
const HELPERS = () => {
  window.__K = {
    seed(n) {
      for (const k in AI_MOVES) delete AI_MOVES[k];
      for (const k in CLASH_T) delete CLASH_T[k];
      let s = n * 7919;
      Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      SC.G.t = 1000;
    },
    place(f, x, feet = 650) { moveFighter(f, x - f.P[2].x, feet - feetY(f)); f.P.forEach(p => { p.ox = p.x; p.oy = p.y; }); },
    // Two humans (no brain: only scripted input) on Neon, A at 500 and B gap px to its right.
    duel(o = {}) {
      SC.start(Object.assign({ mode: 'pvp', map: 'neon', classes: ['none', 'none'], weapons: ['blade', 'blade'],
        throws: [['none', 'none'], ['none', 'none']], skills: [['none', 'none'], ['none', 'none']] }, o));
      SC.G.state = 'paused'; SC.G.lock = 0; SC.sim(.3);
      const [A, B] = SC.F;
      __K.place(A, 500); __K.place(B, 500 + (o.gap || 120)); A.face = 1; B.face = -1; SC.sim(.2);
      return [A, B];
    },
    errs(e0) { return SC.errors.slice(e0).map(e => e.msg); },
    nan() { return SC.F.some(f => f.P.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) || PROJ.some(p => !Number.isFinite(p.x)); },
  };
};

async function testRegistry(page, { check, rows }) {
  const r = await page.evaluate(([S, C, T, M]) => {
    const R = SC.reg, bad = [];
    const need = (reg, keys, extra) => keys.forEach(k => { const d = reg[k]; if (!d || !d.name || !d.icon || !d.desc || (extra && !extra(d))) bad.push(k); });
    need(R.SKILLS, S, d => d.cd > 0 && typeof d.ai.when === 'function');
    need(R.CLASSES, C, d => d.passive && d.color);
    need(R.THROWABLES, T);
    need(R.MOUNTS, M, d => R.ORBS['mount-' + d.key] && R.ORBS['mount-' + d.key].weight > 0);
    const lore = [...S.map(k => SC.lore.s[k]), ...C.map(k => SC.lore.c[k])];
    return { bad, lore: lore.every(t => typeof t === 'string' && t.length >= 60), help: V5_TECHNIQUES.some(t => /Double Team/.test(t.name)) };
  }, [SKILLS, CLASSES, THROWS, MOUNTS]);
  const ok = check(!r.bad.length, 'v6 kit registry: missing name/icon/desc/fields: ' + r.bad.join(', ')) & check(r.lore, 'v6 kit: a skill or class has no codex lore')
    & check(r.help, 'v6 kit: Team Super missing from the codex Techniques');
  rows.push({ kind: 'v6 kit', key: 'registry + lore', ok: !!ok, note: `${SKILLS.length} skills, ${CLASSES.length} classes, ${THROWS.length} throwables, ${MOUNTS.length} mounts` });
}

async function testSkills(page, { check, rows }) {
  const res = await page.evaluate(() => {
    const out = {}, e0 = SC.errors.length, use = k => { const [A, B] = __K.duel({ gap: 300, skills: [[k, 'none'], ['none', 'none']] }); return [A, B]; };
    { // Mirror Shield: a shot fired at A comes back and hits its shooter
      const [A, B] = use('mirror-shield'); SC.press(0, 'skill1'); SC.sim(.05);
      const hpA = A.hp, hpB = B.hp;
      spawnProj({ owner: B, x: chest(A).x + 140, y: chest(A).y, vx: -1100, vy: 0, dmg: 9, r: 4, life: 1.5 });
      SC.sim(.6);
      out.mirror = { ok: A.hp === hpA && B.hp < hpB, note: `A ${hpA}->${A.hp}, shooter ${hpB}->${B.hp}` };
    }
    { // Shadow Step: lands behind the foe (B faces A, so behind = further right) with the +30% bonus
      const [A, B] = use('shadow-step'); SC.press(0, 'skill1'); SC.sim(1 / 60);
      const behind = A.P[2].x > B.P[2].x, bonus = !!A.status.umbra, d = damage(B, 10, { src: A, kind: 'skill', nx: -1 });
      out.shadow = { ok: behind && bonus && d === 14, note: `behind ${behind}, 10 -> ${d}` };
    }
    { // Shrink Bolt: the bolt shrinks the foe, who then deals 25% less
      const [A, B] = use('shrink-ray'); const h0 = B.P[2].y - B.P[0].y;
      SC.press(0, 'skill1'); SC.sim(.6);
      const h1 = B.P[2].y - B.P[0].y, d = damage(A, 10, { src: B, kind: 'skill', nx: -1 });
      out.shrink = { ok: !!B.status.shrunk && h1 < h0 * .85 && d === 8, note: `body ${h0.toFixed(0)}->${h1.toFixed(0)} px, 10 -> ${d}` };
    }
    { // Spring Pad: a foe walking onto it is launched high and dazed; the dropper isn't launched at once
      const [A, B] = use('spring-pad'); const ay = A.P[2].y;
      SC.press(0, 'skill1'); SC.sim(.5);
      const selfStill = Math.abs(A.P[2].y - ay) < 40, pad = PROJ.find(p => p.kind === 'spring-pad');
      __K.place(A, 300); __K.place(B, pad.x + 70); SC.move(1, -1);
      let top = B.P[2].y, stun = false;
      for (let t = 0; t < 1; t += 1 / 60) { SC.sim(1 / 60); top = Math.min(top, B.P[2].y); stun = stun || !!B.status.stun; }
      SC.move(1, 0);
      out.spring = { ok: selfStill && 650 - 80 - top > 200 && stun, note: `foe rose ${Math.round(650 - 80 - top)} px, dazed ${stun}` };
    }
    { // Wall Up: stops the foe's shot and the foe walking in; the caster walks through; gone after 4 s
      const [A, B] = use('wall-up'); SC.press(0, 'skill1'); SC.sim(.1);
      const wall = PROJ.find(p => p.kind === 'wall-up'), hpA = A.hp;
      spawnProj({ owner: B, x: wall.x + 120, y: chest(A).y, vx: -1100, vy: 0, dmg: 9, r: 4, life: 1.5 });
      SC.move(1, -1); SC.sim(1); SC.move(1, 0);
      const held = B.P[2].x > wall.x, blocked = A.hp === hpA;
      SC.move(0, 1); SC.sim(.8); SC.move(0, 0);
      const through = A.P[2].x > wall.x; SC.sim(3.5);
      out.wall = { ok: blocked && held && through && !PROJ.includes(wall), note: `shot blocked ${blocked}, foe held ${held}, caster through ${through}` };
    }
    { // Pinball: rolls at the foe and hurts it, then the body uncurls
      const [A, B] = use('pinball'), hp0 = B.hp; SC.press(0, 'skill1'); SC.sim(.4);
      const curled = A.L[1].cur < A.L[1].r * .8; SC.sim(2.4);
      out.pinball = { ok: curled && B.hp < hp0 && Math.abs(A.L[1].cur - A.L[1].r) < .01, note: `foe ${hp0}->${B.hp}` };
    }
    { // Rally Cry in a 1v1: heals 8% and +15% damage
      const [A, B] = use('rally-cry'); A.hp = 50; SC.press(0, 'skill1'); SC.sim(.05);
      const d = damage(B, 20, { src: A, kind: 'skill', nx: 1 });
      out.rally = { ok: A.hp === 58 && d === 23, note: `hp 50->${A.hp}, 20 -> ${d}` };
    }
    { // Rally Cry with an ally (Team 2v2: YOU + ALLY): both heal 12%
      SC.start({ mode: 'team', map: 'neon', skills: [['rally-cry', 'none']], classes: ['none', 'none', 'none', 'none'] });
      SC.G.state = 'paused'; SC.G.lock = 0; SC.sim(.3);
      const [A, B] = SC.F; __K.place(A, 400); __K.place(B, 520); A.hp = B.hp = 50;
      SC.press(0, 'skill1'); SC.sim(.05);
      out.rallyTeam = { ok: A.hp === 62 && B.hp === 62 && !!B.status.rally, note: `you ${A.hp}, ally ${B.hp}` };
    }
    { // Tornado: lifts the foe and carries it; on a bottomless arena it never crosses a pit
      const [A, B] = use('tornado'), y0 = B.P[2].y; SC.press(0, 'skill1');
      let top = y0; for (let t = 0; t < 3; t += .05) { SC.sim(.05); top = Math.min(top, B.P[2].y); }
      out.tornado = { ok: y0 - top > 50 && B.hp < 100, note: `foe lifted ${Math.round(y0 - top)} px, hp ${B.hp}` };
      SC.start({ mode: 'pvp', map: 'sky', classes: ['none', 'none'], skills: [['tornado', 'none'], ['none', 'none']] });
      SC.G.state = 'paused'; SC.G.lock = 0; SC.sim(.5); SC.press(0, 'skill1'); SC.sim(.05);
      const z = PROJ.find(p => p.kind === 'tornado'); let overPit = false;
      for (let t = 0; t < 3.2 && z; t += .05) { SC.sim(.05); if (!z.dead && groundBelow(z.x, z.y - 40) == null) overPit = true; }
      out.tornadoPit = { ok: !!z && !overPit, note: z ? 'stayed on the ground' : 'not cast' };
    }
    out.errors = __K.errs(e0); out.nan = __K.nan();
    return out;
  });
  for (const k of Object.keys(res).filter(k => res[k] && res[k].note)) {
    check(res[k].ok, `v6 skill ${k}: ${res[k].note}`);
    rows.push({ kind: 'v6 skill', key: k, ok: res[k].ok, note: res[k].note });
  }
  check(!res.errors.length && !res.nan, 'v6 skills: errors ' + res.errors.join(' | ') + (res.nan ? ' NaN' : ''));
}

async function testClasses(page, { check, rows }) {
  const res = await page.evaluate(() => {
    const out = {}, e0 = SC.errors.length;
    // Duelist: a fresh guard raised .2 s before a hit (past the normal .15 s window) still parries; riposte +40%.
    const late = cls => {
      const [A, B] = __K.duel({ classes: [cls, 'none'] });
      A.inp.blockHeld = true; SC.sim(.2);
      const took = damage(A, 10, { src: B, kind: 'melee', nx: -1, ny: 0 });
      A.inp.blockHeld = false; SC.sim(.05);
      return { took, rip: !!A.status.riposte, next: damage(B, 10, { src: A, kind: 'skill', nx: 1 }), spent: !A.status.riposte };
    };
    const d = late('duelist'), n = late('none');
    out.duelist = { ok: d.took === 0 && d.rip && d.next === 14 && d.spent && n.took > 0 && !n.rip, note: `late hit ${d.took} (classless ${n.took}), riposte 10 -> ${d.next}` };
    // Wrestler: grabs a foe ~100 px away that a classless fighter can't reach; harder throw; the Piledriver.
    const grab = cls => { const [A, B] = __K.duel({ classes: [cls, 'none'], gap: 104 }), ok = tryGrab(A); let dmg = 0;
      if (ok) { SC.sim(.2); const h = B.hp; SC.press(0, 'grab'); SC.sim(.3); dmg = h - B.hp; } return { ok, dmg }; };
    const w = grab('wrestler'), c = grab('none');
    { const [A, B] = __K.duel({ classes: ['wrestler', 'none'], gap: 80 }), hp0 = B.hp;
      tryGrab(A); SC.sim(.2); A.inp.jumpHeld = true; SC.press(0, 'jump'); SC.sim(.25); SC.press(0, 'grab'); SC.sim(.02);
      const flipped = B.P[0].y > B.P[2].y; SC.sim(1);
      out.piledriver = { ok: flipped && hp0 - B.hp === 18 && A.stats.throws === 1, note: `flipped ${flipped}, ${hp0 - B.hp} dmg` };
    }
    out.wrestler = { ok: w.ok && !c.ok && w.dmg === 11, note: `grab at ~100 px ${w.ok} (classless ${c.ok}), throw ${w.dmg} dmg` };
    // Engineer, no throwables: the throwable key deploys the turret (once a round); it plinks a foe and lasts 8 s.
    { const [A, B] = __K.duel({ classes: ['engineer', 'none'], gap: 400 }), hp0 = B.hp;
      SC.press(0, 'throw'); SC.sim(.05);
      const up = PROJ.filter(p => p.kind === 'turret').length; SC.sim(8.2);
      const gone = !PROJ.some(p => p.kind === 'turret'); SC.press(0, 'throw'); SC.sim(.05);
      out.engineer = { ok: up === 1 && gone && hp0 > B.hp && !PROJ.some(p => p.kind === 'turret'), note: `turret ${up}, foe ${hp0}->${B.hp}, gone after 8 s ${gone}` };
    }
    // ...with throwables: a tap still throws; holding the key charges and deploys without spending one.
    { const [A] = __K.duel({ classes: ['engineer', 'none'], gap: 400, throws: [['grenade', 'ice'], ['none', 'none']] });
      SC.press(0, 'throw'); SC.sim(.05); const tap = A.throwN[0] === 0;
      SC.sim(.6); A.inp.throwHeld = true; SC.press(0, 'throw'); SC.sim(.6); A.inp.throwHeld = false; SC.sim(.05);
      out.engineerHold = { ok: tap && PROJ.some(p => p.kind === 'turret') && A.throwN[1] === 1, note: `tap threw ${tap}, hold deployed, throws left ${A.throwN.join('/')}` };
    }
    // CPUs play to their class: seeded CPU-vs-classless duels count parries + ripostes, grabs, turrets.
    const ev = { parry: 0, riposte: 0, grab: 0, pile: 0 }, offs = [on('parry', B => { if (B.clsKey === 'duelist') ev.parry++; }),
      on('grab', A => { if (A.clsKey === 'wrestler') ev.grab++; }), on('throw', (A, B) => { if (A.clsKey === 'wrestler' && B.status.ragdoll && B.P[0].y > B.P[2].y) ev.pile++; })];
    const offR = on('status', (f, name) => { if (name === 'riposte') ev.riposte++; });
    let turrets = 0, rounds = { duelist: 0, wrestler: 0, engineer: 0 };
    for (const k of ['duelist', 'wrestler', 'engineer']) for (let i = 0; i < 3; i++) {
      __K.seed(31 + i * 7 + k.length);
      SC.start({ mode: 'watch', map: ['dojo', 'neon', 'frost'][i], classes: [k, 'none'], weapons: ['katana', 'axe'], diffs: ['hard', 'hard'], winScore: 999 });
      SC.G.state = 'play';
      for (let t = 0; t < 40; t += .5) { SC.sim(.5); if (k === 'engineer') turrets += PROJ.filter(p => p.kind === 'turret' && p.t < .5).length; }
      rounds[k] += SC.G.log.length;
    }
    offs.forEach(o => o()); offR();
    out.cpu = { ok: ev.parry > 0 && ev.riposte > 0 && ev.grab > 0 && turrets >= rounds.engineer * .6, note: `duelist parries ${ev.parry} ripostes ${ev.riposte}; wrestler grabs ${ev.grab} piledrivers ${ev.pile}; turrets ${turrets} in ${rounds.engineer} rounds` };
    out.errors = __K.errs(e0); out.nan = __K.nan();
    return out;
  });
  for (const k of Object.keys(res).filter(k => res[k] && res[k].note)) {
    check(res[k].ok, `v6 class ${k}: ${res[k].note}`);
    rows.push({ kind: 'v6 class', key: k, ok: res[k].ok, note: res[k].note });
  }
  check(!res.errors.length && !res.nan, 'v6 classes: errors ' + res.errors.join(' | ') + (res.nan ? ' NaN' : ''));
}

async function testThrowablesMounts(page, { check, rows }) {
  const res = await page.evaluate(() => {
    const out = {}, e0 = SC.errors.length;
    const toss = k => { const [A, B] = __K.duel({ gap: 300, throws: [[k, 'none'], ['none', 'none']] }); SC.press(0, 'throw'); SC.sim(.05); return [A, B]; };
    { const [A, B] = toss('glue'); SC.sim(1.2); let slow = false;
      for (let t = 0; t < 1; t += .1) { SC.sim(.1); slow = slow || (!!B.status.glued && moveMul(B) < .5); }
      out.glue = { ok: slow && PROJ.some(p => p.kind === 'glue'), note: `foe glued ${slow}` };
    }
    { const [A, B] = toss('bouncer'), x0 = B.P[2].x, hp0 = B.hp; SC.sim(1.5);
      out.bouncer = { ok: B.hp < hp0 && B.P[2].x - x0 > 30, note: `foe ${hp0}->${B.hp}, knocked ${Math.round(B.P[2].x - x0)} px` };
    }
    { const [A, B] = toss('tornado-jar'), y0 = B.P[2].y; let top = y0;
      for (let t = 0; t < 2.5; t += .05) { SC.sim(.05); top = Math.min(top, B.P[2].y); }
      out.jar = { ok: y0 - top > 40, note: `foe lifted ${Math.round(y0 - top)} px` };
    }
    { // The duck lures a CPU (watch mode, the thrower idle): it walks up, whacks it and the pop hurts it.
      __K.seed(5);
      SC.start({ mode: 'watch', map: 'dojo', classes: ['none', 'none'], weapons: ['blade', 'katana'], throws: [['duck', 'none'], ['none', 'none']], diffs: ['easy', 'easy'], orbs: false, winScore: 999 });
      SC.G.state = 'play'; SC.G.lock = 0; SC.sim(.2);
      const [A, B] = SC.F; A.ai.behave = 'idle'; __K.place(A, 300); __K.place(B, 760); A.face = 1;
      SC.sim(.1); throwNext(A); SC.sim(1.2);
      const duck = PROJ.find(p => p.duck), hp0 = B.hp; let popped = false, closest = 1e9;
      for (let t = 0; t < 4 && duck; t += .05) { SC.sim(.05); if (!duck.dead) closest = Math.min(closest, Math.abs(B.P[2].x - duck.x)); if (duck.dead) { popped = true; break; } }
      out.duck = { ok: !!duck && popped && B.hp < hp0, note: `landed ${!!duck}, CPU came to ${Math.round(closest)} px, popped ${popped}, foe ${hp0}->${Math.round(B.hp)}` };
    }
    // Mounts: ridden at a foe they hurt it; the orbs mount you; CPUs fight with both.
    for (const k of ['rocket-board', 'pogo']) {
      const [A, B] = __K.duel({ gap: 220 }), hp0 = B.hp, x0 = A.P[2].x;
      ORBS['mount-' + k].grab(A); const mounted = !!A.mount && A.mount.key === k;
      A.inp.jumpHeld = true; SC.move(0, 1);
      for (let t = 0; t < 2; t += .25) { SC.press(0, 'attack'); SC.sim(.25); }
      SC.move(0, 0);
      out[k] = { ok: mounted && B.hp < hp0, note: `orb mounts ${mounted}, foe ${hp0}->${B.hp}, rode ${Math.round(A.P[2].x - x0)} px` };
      let dealt = 0, uses = 0;
      for (let i = 0; i < 3; i++) {   // a CPU rides it for its full 8 s against a CPU on foot
        __K.seed(11 + i + k.length);
        SC.start({ mode: 'watch', map: 'dojo', classes: ['none', 'none'], weapons: ['blade', 'blade'], diffs: ['normal', 'normal'], orbs: false, winScore: 999 });
        SC.G.state = 'play'; SC.sim(1.3);
        const rider = SC.F[0]; mount(rider, k);
        const offs = [on('damage', (V, amt, o) => { if (o.fromMount && o.src === rider) dealt += amt; }), on('attack', f => { if (f === rider && f.mount) uses++; })];
        SC.sim(8); offs.forEach(o => o());
      }
      out[k + '-cpu'] = { ok: dealt > 0 && uses > 0, note: `CPU rider: ${uses} attacks, dealt ${Math.round(dealt)} in 3 x 8 s` };
    }
    out.errors = __K.errs(e0); out.nan = __K.nan();
    return out;
  });
  for (const k of Object.keys(res).filter(k => res[k] && res[k].note)) {
    check(res[k].ok, `v6 ${k}: ${res[k].note}`);
    rows.push({ kind: 'v6 gear', key: k, ok: res[k].ok, note: res[k].note });
  }
  check(!res.errors.length && !res.nan, 'v6 throwables/mounts: errors ' + res.errors.join(' | ') + (res.nan ? ' NaN' : ''));
}

async function testTeamSuper(page, { check, rows }) {
  const res = await page.evaluate(() => {
    const out = {}, e0 = SC.errors.length;
    // Co-op 2v2: P1 and P2 (both human, team 0) vs two idle CPUs.
    const coop = (gap, second) => {
      SC.start({ mode: 'coop', map: 'neon', classes: ['none', 'none', 'none', 'none'], weapons: ['blade', 'hammer', 'blade', 'blade'],
        throws: [['none', 'none'], ['none', 'none'], ['none', 'none'], ['none', 'none']], skills: [['none', 'none'], ['none', 'none']] });
      SC.G.state = 'paused'; SC.G.lock = 0; SC.sim(.3);
      const [A, B, C, D] = SC.F;
      __K.place(A, 300); __K.place(B, 300 + gap); __K.place(C, 800); __K.place(D, 960);
      for (const f of [C, D]) { f.ai.behave = 'idle'; f.ai.t = 1e9; }
      SC.sim(.2); A.super = B.super = 100; SC.sim(1 / 120);
      const ready = TS.ready.length, hp0 = [C.hp, D.hp];
      SC.press(0, 'super'); SC.sim(.2);
      const waited = !A.ult && A.super === 100;
      if (second) SC.press(1, 'super');
      SC.sim(.05);
      const team = !!(A.ult && A.ult.team2 && B.ult && B.ult.team2), supers = [A.super, B.super];
      SC.sim(.3); SC.render();
      SC.sim(1.3); SC.render();
      return { ready, waited, team, dealt: [hp0[0] - C.hp, hp0[1] - D.hp], supers, after: [A.super, B.super], ults: [A.stats.ults, B.stats.ults] };
    };
    const t = coop(150, true), lone = coop(150, false), far = coop(420, true);
    out.coop = { ok: t.ready === 1 && t.waited && t.team && t.dealt.every(d => d >= 15) && t.supers.every(s => s < 1) && t.ults.join() === '1,1',
      note: `armed ${t.ready}, first press waited ${t.waited}, Double Team ${t.team} (meters ${t.supers.join('/')}, ults ${t.ults.join('/')}), foes took ${t.dealt.map(Math.round).join(' + ')}` };
    out.lone = { ok: lone.ready === 1 && lone.ults.join() === '1,0' && lone.after[1] === 100, note: `own ultimate after the window: ults ${lone.ults.join('/')}` };
    out.far = { ok: far.ready === 0 && !far.team && far.ults.join() === '1,1', note: `${far.ready} armed 420 px apart, two own ultimates` };
    // Versus: two humans close together with full meters never arm it; each press fires its own ultimate at once.
    { const [A, B] = __K.duel({ gap: 150 }); A.super = B.super = 100; SC.sim(1 / 120);
      const ready = TS.ready.length; SC.press(0, 'super'); SC.sim(.05); const now = !!A.ult; SC.press(1, 'super'); SC.sim(.05);
      out.versus = { ok: ready === 0 && now && !!B.ult && !A.ult.team2 && !B.ult.team2, note: `armed ${ready}, P1 fired at once ${now}` };
    }
    // Co-op Waves (Survival for two) arms it too.
    { SC.start({ mode: 'coopwaves', map: 'neon' }); SC.G.state = 'paused'; SC.G.lock = 0; SC.sim(.3);
      const hs = SC.F.filter(f => f.ctrl === 'human'); __K.place(hs[0], 400); __K.place(hs[1], 520);
      hs.forEach(f => f.super = 100); SC.sim(1 / 120);
      out.waves = { ok: hs.length === 2 && TS.ready.length === 1, note: `${hs.length} heroes, armed ${TS.ready.length}` };
    }
    out.errors = __K.errs(e0); out.nan = __K.nan();
    return out;
  });
  for (const k of Object.keys(res).filter(k => res[k] && res[k].note)) {
    check(res[k].ok, `v6 team super ${k}: ${res[k].note}`);
    rows.push({ kind: 'v6 team', key: k, ok: res[k].ok, note: res[k].note });
  }
  check(!res.errors.length && !res.nan, 'v6 team super: errors ' + res.errors.join(' | ') + (res.nan ? ' NaN' : ''));
}

// Screenshots: the loadout's Class and Throwables tabs, How to Play, and the effects in a frozen fight.
async function shots(browser, { check, SHOTS }, view, dpr, tag) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const { page, errors } = await openPage(browser, view, dpr);
  const shot = async name => page.screenshot({ path: path.join(SHOTS, `v6s-${name}-${tag}.png`) });
  const scene = async fn => { await page.evaluate(fn); await page.waitForTimeout(120); };
  try {
    await page.evaluate(() => { SC.start({ mode: 'coop', map: 'neon', classes: ['duelist', 'engineer', 'wrestler', 'none'], weapons: ['katana', 'pistol', 'blade', 'axe'],
      skills: [['mirror-shield', 'tornado'], ['wall-up', 'rally-cry']], throws: [['duck', 'glue'], ['bouncer', 'tornado-jar']] }); SC.G.state = 'paused'; SC.G.lock = 0; SC.sim(.4);
      const [A, B, C, D] = SC.F; __K.place(A, 330); __K.place(B, 470); __K.place(C, 820); __K.place(D, 1000); for (const f of [C, D]) { f.ai.behave = 'idle'; f.ai.t = 1e9; }
      A.super = B.super = 100; SC.sim(.1); BANNER = null; SC.render(); });
    await scene(() => SC.render()); await shot('team-ready');
    await scene(() => { SC.press(0, 'super'); SC.sim(.1); SC.press(1, 'super'); SC.sim(.2); for (let k = 0; k < 4; k++) SC.render(1 / 60); });
    await shot('double-team-telegraph');
    await scene(() => { SC.sim(.45); BANNER = null; for (let k = 0; k < 2; k++) SC.render(1 / 60); }); await shot('double-team-dash');   // in play the banner is gone by now
    await scene(() => { SC.sim(2); BANNER = null; const [A, B, C] = SC.F; SC.press(0, 'skill2'); SC.press(1, 'skill1'); throwNext(A); throwNext(B); SC.sim(.6);
      engDeploy(B); mount(C, 'pogo'); SC.sim(.5); for (let k = 0; k < 3; k++) SC.render(1 / 60); });
    await shot('skills-fx');
    await scene(() => { const [A, B, C, D] = SC.F; mount(D, 'rocket-board'); D.face = -1; MOUNTS['rocket-board'].attack(D, D.mount); addStatus(A, 'mirror', 1); addStatus(C, 'pinball', 1);
      SC.press(0, 'skill1'); SC.sim(.15); for (let k = 0; k < 3; k++) SC.render(1 / 60); });
    await shot('mounts-fx');
    // Menus: the loadout's Class and Throwables tabs and How to Play.
    await page.evaluate(() => { startMatch(demoConfig()); SC.G.state = 'menu'; });
    await page.evaluate(() => openScreen('loadout')); await page.waitForTimeout(250);
    for (const tab of ['class', 'gear', 'skills']) {
      const ok = await page.evaluate(t => { const b = document.querySelector(`#loadout [data-key="tab-${t}"]`); if (b) b.click(); return !!b; }, tab);
      await page.waitForTimeout(250);
      await page.evaluate(() => { const g = document.querySelector('#loadout .skill-grid'); if (g && g.lastElementChild) g.lastElementChild.scrollIntoView({ block: 'end' }); });   // the v6 tiles come last
      await page.waitForTimeout(150);
      check(ok, `v6 kit: loadout tab ${tab} not found`); if (ok) await shot('loadout-' + tab);
    }
    await page.evaluate(() => { goBack(); openScreen('howto'); }); await page.waitForTimeout(250);
    const card = await page.evaluate(() => {   // found by title: other v6 slices add How to Play cards after this one
      const c = [...document.querySelectorAll('#howto .help-grid .help-card')].find(s => /Team Super/.test((s.querySelector('h3') || {}).textContent || ''));
      if (c) c.scrollIntoView(); return !!c; });
    check(card, 'v6 kit: How to Play has no Team Super card'); await shot('howto');
  } catch (e) { check(false, `v6 kit screenshots (${tag}) crashed: ${e.message}`); }
  check(!errors.length, `v6 kit screenshots (${tag}) console: ` + [...new Set(errors)].join(' | '));
  await page.close();
}

async function run(browser, ctx) {
  const { page, errors } = await openPage(browser);
  for (const t of [testRegistry, testSkills, testClasses, testThrowablesMounts, testTeamSuper]) {
    try { await t(page, ctx); } catch (e) { ctx.check(false, `v6 kit ${t.name} crashed: ${e.message}`); }
  }
  ctx.check(!errors.length, 'v6 kit console: ' + [...new Set(errors)].join(' | '));
  await page.close();
  await shots(browser, ctx, { width: 1920, height: 1080 }, 1, '1080p');
  await shots(browser, ctx, { width: 1536, height: 864 }, 1.25, '864p125');
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const browser = await chromium.launch(), failures = [], rows = [];
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    const t0 = Date.now();
    try { await run(browser, { check, rows, SHOTS: path.join(ROOT, 'tmp', 'smoke') }); } finally { await browser.close(); }
    console.table(rows.map(r => ({ kind: r.kind, key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`V6 KIT FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`V6 KIT OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
