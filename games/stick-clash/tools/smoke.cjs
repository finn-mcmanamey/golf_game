// Smoke test: builds the game, loads it in headless Chromium and checks EVERY registered weapon, skill, map, mode,
// orb, hat and status (so new content is covered automatically), the core systems, and the menu -> match -> results
// flow. Prints a compact table and exits non-zero on any failure.
//   node tools/smoke.cjs            full run (screenshots of every map go to tmp/smoke/)
//   node tools/smoke.cjs --quick    shorter simulations
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const QUICK = process.argv.includes('--quick');
const SHOTS = path.join(ROOT, 'tmp', 'smoke');
const SECS = QUICK ? 12 : 25;
const failures = [];
const rows = [];

function check(ok, what) { if (!ok) failures.push(what); return ok; }

function build() {
  try { execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio: 'inherit' }); }
  catch { console.error('build failed'); process.exit(1); }
}

// ---------- page-side helpers (serialised into the page) ----------
const PAGE_HELPERS = `
window.__T = {
  // Totals over finished rounds (G.log) plus the round in progress.
  collect() {
    const L = SC.G.log, logged = L.length && L[L.length - 1].round === SC.G.round;
    const cur = logged ? [] : SC.F.map(f => ({ dmg: f.stats.dmgDealt, hits: f.stats.hits, skillsUsed: f.stats.skills, shots: f.stats.shots, upright: f.aliveT ? f.upT / f.aliveT : 1 }));
    const all = L.flatMap(r => r.fighters).concat(cur);
    const sum = k => all.reduce((s, f) => s + (f[k] || 0), 0);
    return { rounds: L.length, dmg: sum('dmg'), hits: sum('hits'), skills: sum('skillsUsed'), shots: sum('shots'),
      upright: all.length ? sum('upright') / all.length : 1, avgT: L.length ? L.reduce((s, r) => s + r.time, 0) / L.length : 0 };
  },
  nan() { return SC.F.some(f => f.P.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) || PROJ.some(p => !Number.isFinite(p.x)); },
  // Simulates in chunks, checking for NaN and running an optional per-chunk action; renders a frame at the end.
  run(cfg, secs, each) {
    const e0 = SC.errors.length;
    SC.start(cfg);
    let nan = false;
    for (let t = 0; t < secs && !nan; t += 1) { if (each) each(); SC.sim(1); nan = __T.nan(); }
    for (let k = 0; k < 3; k++) SC.render(1 / 60);
    return Object.assign(__T.collect(), { nan, errors: SC.errors.slice(e0).map(e => e.msg), state: SC.G.state });
  },
};`;

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource|ERR_|fonts\.g/.test(m.text())) return;   // offline font requests are fine
    errors.push(m.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(PAGE_HELPERS);
  return { page, errors };
}

// ---------- registry coverage ----------
async function testWeapons(page) {
  const res = await page.evaluate(secs => {
    const firstMap = Object.keys(SC.reg.MAPS).find(k => !SC.reg.MAPS[k].hidden);
    return Object.keys(SC.reg.WEAPONS).map(k => {
      const r = __T.run({ mode: 'watch', map: firstMap, weapons: [k, k], skills: [['none', 'none'], ['none', 'none']] }, secs);
      return Object.assign(r, { key: k, ranged: !!SC.reg.WEAPONS[k].ranged });
    });
  }, SECS);
  for (const r of res) {
    const ok = check(!r.errors.length, `weapon ${r.key}: errors ${r.errors.join(' | ')}`)
      & check(!r.nan, `weapon ${r.key}: NaN positions`)
      & check(r.dmg > 0, `weapon ${r.key}: no damage dealt in ${SECS}s`)
      & check(r.upright >= .55, `weapon ${r.key}: fighters upright only ${(r.upright * 100).toFixed(0)}%`)
      & check(!r.ranged || r.shots > 0, `weapon ${r.key}: ranged weapon never fired`);
    rows.push({ kind: 'weapon', key: r.key, ok: !!ok, ...summary(r) });
  }
}

async function testSkills(page) {
  const res = await page.evaluate(secs => {
    return Object.keys(SC.reg.SKILLS).map(k => {
      // Both fighters carry the skill; we also press it every second so it is exercised even if the AI never wants it.
      const r = __T.run({ mode: 'watch', weapons: ['blade', 'blade'], skills: [[k, 'none'], ['none', k]] }, secs,
        () => { SC.press(0, 'skill1'); SC.press(1, 'skill2'); });
      return Object.assign(r, { key: k });
    });
  }, SECS);
  for (const r of res) {
    const ok = check(!r.errors.length, `skill ${r.key}: errors ${r.errors.join(' | ')}`)
      & check(!r.nan, `skill ${r.key}: NaN positions`)
      & check(r.skills > 0, `skill ${r.key}: never used successfully`)
      & check(r.upright >= .5, `skill ${r.key}: fighters upright only ${(r.upright * 100).toFixed(0)}%`);
    rows.push({ kind: 'skill', key: r.key, ok: !!ok, ...summary(r) });
  }
}

async function testMaps(page) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const keys = await page.evaluate(() => Object.keys(SC.reg.MAPS));
  for (const k of keys) {
    const r = await page.evaluate(([k, secs]) => {
      const out = __T.run({ mode: 'watch', map: k, weapons: ['random', 'random'] }, secs);
      const hat = Object.keys(SC.reg.HATS).find(h => h !== 'none');
      SC.start({ mode: 'watch', map: k, weapons: ['random', 'random'], hats: [hat, hat] });
      SC.sim(3.2); BANNER = null;
      for (let i = 0; i < 40; i++) SC.render(1 / 60);
      return Object.assign(out, { key: k, map: SC.state().map });
    }, [k, SECS]);
    await page.screenshot({ path: path.join(SHOTS, `map-${k}.png`) });
    const ok = check(!r.errors.length, `map ${k}: errors ${r.errors.join(' | ')}`)
      & check(r.map === k, `map ${k}: match did not load it`)
      & check(!r.nan, `map ${k}: NaN positions`)
      & check(r.dmg > 0, `map ${k}: no damage dealt`)
      & check(r.upright >= .5, `map ${k}: fighters upright only ${(r.upright * 100).toFixed(0)}%`);
    rows.push({ kind: 'map', key: k, ok: !!ok, ...summary(r) });
  }
}

async function testModes(page) {
  const res = await page.evaluate(secs => Object.keys(SC.reg.MODES).map(k => {
    // autopilot: the CPU brain drives human fighters too, so every mode can be simulated.
    const e0 = SC.errors.length;
    // Training's dummy stands still, and on a few arenas (a high ledge, a spike pit) the autopilot can't reach it in
    // time: run it on the open Dojo so "no damage" means a real bug, not an unlucky map.
    const map = k === 'training' && SC.reg.MAPS.dojo ? 'dojo' : 'random';
    const r = __T.run({ mode: k, autopilot: true, map }, secs);
    const fighters = SC.F.length;
    SC.sim(240);
    const over = SC.G.state === 'over', result = SC.G.result;
    return Object.assign(r, { key: k, fighters, over, title: result && result.title, errors: SC.errors.slice(e0).map(e => e.msg) });
  }), SECS);
  for (const r of res) {
    const ok = check(!r.errors.length, `mode ${r.key}: errors ${r.errors.join(' | ')}`)
      & check(r.fighters >= 2, `mode ${r.key}: fewer than 2 fighters`)
      & check(!r.nan, `mode ${r.key}: NaN positions`)
      & check(r.dmg > 0, `mode ${r.key}: no damage dealt`)
      & check(!r.over || !!r.title, `mode ${r.key}: match ended without a results title`);
    rows.push({ kind: 'mode', key: r.key, ok: !!ok, ...summary(r), note: r.over ? 'finished: ' + r.title : 'still running after 240s' });
  }
}

async function testOrbsHatsStatuses(page) {
  const res = await page.evaluate(() => {
    const out = [];
    const e = () => SC.errors.length;
    for (const k of Object.keys(SC.reg.ORBS)) {
      const e0 = e();
      SC.start({ mode: 'watch', weapons: ['blade', 'blade'] }); SC.sim(1.2);
      const o = spawnOrb(k), f = SC.F[0], c = chest(f);
      let grabbed = false;
      if (o) { o.solid = null; o.x = c.x; o.y = c.y; SC.sim(.05); grabbed = o.taken; }
      SC.sim(2); SC.render();
      out.push({ kind: 'orb', key: k, ok: !!o && grabbed && e() === e0, note: !o ? 'no spawn spot' : grabbed ? '' : 'not grabbed', errors: SC.errors.slice(e0).map(x => x.msg) });
    }
    for (const k of Object.keys(SC.reg.HATS)) {
      const e0 = e();
      SC.start({ mode: 'watch', weapons: ['blade', 'blade'], hats: [k, k] }); SC.sim(1); SC.render(); SC.render();
      out.push({ kind: 'hat', key: k, ok: e() === e0, errors: SC.errors.slice(e0).map(x => x.msg) });
    }
    for (const k of Object.keys(SC.reg.STATUS)) {
      const e0 = e();
      SC.start({ mode: 'watch', weapons: ['blade', 'blade'] }); SC.sim(1.2);
      const s = addStatus(SC.F[0], k, 2, 1, SC.F[1]);
      SC.render(); SC.sim(1); SC.render(); SC.sim(1.5);
      out.push({ kind: 'status', key: k, ok: !!s && e() === e0 && !__T.nan(), errors: SC.errors.slice(e0).map(x => x.msg) });
    }
    return out;
  });
  for (const r of res) {
    check(r.ok, `${r.kind} ${r.key}: ${r.note || ''} ${r.errors.join(' | ')}`);
    rows.push({ kind: r.kind, key: r.key, ok: r.ok, note: r.note || '' });
  }
}

// ---------- core systems (test-only content is registered at runtime, hidden from menus) ----------
async function testCore(page) {
  const res = await page.evaluate(() => {
    const out = {};
    const DT = 1 / 120;
    const quiet = () => { SC.G.state = 'paused'; SC.G.lock = 0; };   // freeze the real-time loop and round flow
    defMap('t-pit', { hidden: true, floor: null, walls: false, orbs: false,
      solids: [{ x: 200, y: 600, w: 880, h: 40, oneWay: false }, { x: 560, y: 420, w: 160, move: { dx: 200, dy: 0, period: 4 } }],
      hazards: [{ kind: 'spikes', x: 900, y: 580, w: 80, h: 20, dps: 40 }], spawns: [[400, 600], [800, 600]] });
    defWeapon('t-shield', { hidden: true, cat: 'shield', len: 40, mass: 1, dmg: .2, width: 10, block: 1, draw() {} });
    defWeapon('t-dual', { hidden: true, cat: 'blade', len: 60, offhand: 't-shield', draw() {} });
    // Idle humans (no autopilot) so positions only change when the test moves them.
    defMode('t-teams', { hidden: true, setup: () => ({ roster: [
      { team: 0, weapon: 'blade', ctrl: 'human', cls: 'none' }, { team: 0, weapon: 'spear', ctrl: 'human', slot: 1, cls: 'none' },
      { team: 1, weapon: 'hammer', scale: 1.6, hpMul: 1.5, ctrl: 'human' }, { team: 1, weapon: 'pistol', ctrl: 'human', slot: 1, cls: 'none' }] }) });
    const place = (f, x) => { moveFighter(f, x - f.P[2].x, 650 - feetY(f)); f.P.forEach(p => { p.ox = p.x; p.oy = p.y; }); };
    const kos = [];
    on('ko', (v, k, o) => kos.push(o.kind || 'melee'));

    // Ring-out: a fighter dropped into the void is KO'd.
    SC.start({ mode: 'pvp', classes: ['none', 'none'], map: 't-pit', weapons: ['blade', 'blade'] }); quiet();
    moveFighter(SC.F[1], 100 - SC.F[1].P[2].x, 0); SC.sim(3);
    out.ringout = !SC.F[1].alive && kos.includes('ringout');

    // Moving platform carries a fighter standing on it.
    SC.start({ mode: 'pvp', classes: ['none', 'none'], map: 't-pit', weapons: ['blade', 'blade'] }); quiet(); SC.sim(.1);
    const plat = MAP.solids[1], f0 = SC.F[0];
    moveFighter(f0, plat.x + plat.w / 2 - f0.P[2].x, plat.y - feetY(f0) - 2); f0.P.forEach(p => { p.ox = p.x; p.oy = p.y; });
    const px0 = plat.x, fx0 = f0.P[2].x; SC.sim(1.2);
    out.carry = Math.abs((f0.P[2].x - fx0) - (plat.x - px0)) < 40 && Math.abs(plat.x - px0) > 60 && Math.abs(feetY(f0) - plat.y) < 12;

    // Hazard hurts.
    SC.start({ mode: 'pvp', classes: ['none', 'none'], map: 't-pit', weapons: ['blade', 'blade'] }); quiet();
    moveFighter(SC.F[1], 940 - SC.F[1].P[2].x, 0); SC.sim(.6);
    out.hazard = SC.F[1].hp < SC.F[1].maxHp;

    // Projectiles: explode, homing, bounce, pierce, and a shield deflect.
    SC.start({ mode: 't-teams', map: 'neon' }); quiet(); SC.sim(.2);
    const [a, b, boss, d] = SC.F;
    out.teams = enemiesOf(a).length === 2 && alliesOf(a).length === 1 && nearestEnemy(a).team === 1;
    out.boss = boss.maxHp === 240 && boss.scale === 1.6;
    const hp0 = boss.hp, bc = chest(boss);
    spawnProj({ owner: a, x: bc.x - 30, y: bc.y, vx: 900, vy: 0, explode: 120, dmg: 20 }); SC.sim(.2);
    out.explode = boss.hp < hp0;
    const dc = chest(d), hp1 = d.hp;
    spawnProj({ owner: a, x: dc.x, y: dc.y - 300, vx: 0, vy: -600, homing: 12, dmg: 5, life: 3 }); SC.sim(1.5);
    out.homing = d.hp < hp1;
    const bp = spawnProj({ owner: a, x: 640, y: 600, vx: 0, vy: 900, bounce: 2, life: 2, dmg: 1 }); SC.sim(.15);
    out.bounce = bp.bounce < 2;
    place(boss, 700); place(d, 840); place(a, 200); place(b, 120); SC.sim(.6);
    const pp = spawnProj({ owner: a, x: 560, y: 610, vx: 1400, vy: 0, pierce: 3, dmg: 2, life: 1 });
    SC.sim(.4);
    out.pierce = pp.hits.length >= 2;

    SC.start({ mode: 'pvp', classes: ['none', 'none'], map: 'neon', weapons: ['t-dual', 'pistol'] }); quiet(); SC.sim(.5);
    const s = SC.F[0];
    out.offhand = !!s.off && s.off.w.key === 't-shield';
    const sh = s.P[s.off.tip], hand = s.P[s.off.hand], mx = (sh.x + hand.x) / 2, my = (sh.y + hand.y) / 2;
    const dp = spawnProj({ owner: SC.F[1], x: mx + 24, y: my, vx: -1500, vy: 0, dmg: 5 }); SC.sim(DT * 4);
    out.deflect = dp.team === s.team;

    // Statuses: freeze stops actions and shatters on a hit; giant grows the weapon.
    addStatus(s, 'freeze', 2); out.freeze = !canAct(s);
    damage(s, 5, { src: SC.F[1], kind: 'melee' }); out.shatter = !s.status.freeze;
    const len0 = s.main.links[0].cur; addStatus(s, 'giant', 3); SC.sim(1);
    out.giant = s.main.links[0].cur > len0 * 1.3;

    // Ranged weapons fire, use ammo, and reload.
    const g = SC.F[1], ammo0 = g.ammo;
    SC.press(1, 'attack'); SC.sim(.1);
    out.fires = g.ammo === ammo0 - 1;
    for (let k = 0; k < 10; k++) { g.atkCd = 0; SC.press(1, 'attack'); SC.sim(DT * 2); }
    out.reload = g.reload > 0 || g.ammo === g.w.ranged.ammo;

    // Auto weapons keep firing while the attack key is held.
    defWeapon('t-auto', { hidden: true, cat: 'ranged', len: 40, ranged: { auto: true, cooldown: .08, ammo: 30, reload: 1 }, draw() {} });
    SC.start({ mode: 'pvp', classes: ['none', 'none'], map: 'neon', weapons: ['t-auto', 'blade'] }); quiet(); SC.sim(.3);
    SC.F[0].inp.attackHeld = true; SC.sim(.6);
    out.autoFire = SC.F[0].stats.shots >= 5;

    // Double jump and dash.
    SC.start({ mode: 'pvp', classes: ['none', 'none'], map: 'neon', weapons: ['blade', 'blade'] }); quiet(); SC.sim(.5);
    const j = SC.F[0], y0 = j.P[2].y;
    j.inp.jumpHeld = true;
    SC.press(0, 'jump'); SC.sim(.3); SC.press(0, 'jump'); SC.sim(.05);
    out.doubleJump = j.airJumps === 0 && j.P[2].y < y0 - 150;
    SC.sim(1.5); const x0 = j.P[2].x; SC.press(0, 'dash'); SC.sim(.4);
    out.dash = Math.abs(j.P[2].x - x0) > 120;
    out.errors = SC.errors.map(e => e.msg);
    return out;
  });
  const errs = res.errors; delete res.errors;
  for (const [k, v] of Object.entries(res)) {
    check(v, `core ${k}: failed`);
    rows.push({ kind: 'core', key: k, ok: !!v });
  }
  check(!errs.length, 'core: errors ' + errs.join(' | '));
}

// ---------- v3 fighting depth: every class, throwable, mount, ultimate and element, plus the core moves ----------
// Shared page helpers for the v3 checks: an idle 1v1 on the flat Neon arena with plain (classless) fighters.
const V3_HELPERS = `
window.__V = {
  quiet() { SC.G.state = 'paused'; SC.G.lock = 0; },
  place(f, x) { moveFighter(f, x - f.P[2].x, 650 - feetY(f)); f.P.forEach(p => { p.ox = p.x; p.oy = p.y; }); },
  duel(o = {}) {
    SC.start(Object.assign({ mode: 'pvp', map: 'neon', classes: ['none', 'none'], weapons: ['blade', 'blade'], throws: [['none', 'none'], ['none', 'none']] }, o));
    __V.quiet(); SC.sim(.3);
    const [A, B] = SC.F;
    __V.place(A, 500); __V.place(B, 500 + (o.gap || 120)); SC.sim(.2);
    return [A, B];
  },
  errs(e0) { return SC.errors.slice(e0).map(e => e.msg); },
};`;

async function testV3Registry(page) {
  await page.evaluate(V3_HELPERS);
  const res = await page.evaluate(secs => {
    const out = [];
    // Classes: a full CPU fight with each (random weapons); the class must apply its numbers.
    for (const k of Object.keys(SC.reg.CLASSES)) {
      const r = __T.run({ mode: 'watch', classes: [k, k], weapons: ['random', 'random'] }, secs);
      const f = SC.F[0], c = SC.reg.CLASSES[k];
      const ok = !r.errors.length && !r.nan && r.dmg > 0 && f.clsKey === k && f.maxHp === Math.max(1, Math.round(100 * c.hp)) && f.maxStamina === Math.round(100 * c.stamina);
      out.push({ kind: 'class', key: k, ok, rounds: r.rounds, avgT: r.avgT, hits: r.hits, dmg: r.dmg, upright: r.upright, note: `hp ${f.maxHp} stamina ${f.maxStamina}`, errors: r.errors });
    }
    // Throwables: thrown at a foe 300 px away must hurt or affect it (the mine needs the foe to walk onto it).
    for (const k of Object.keys(SC.reg.THROWABLES)) {
      const e0 = SC.errors.length, [A, B] = __V.duel({ gap: 300, throws: [[k, k], ['none', 'none']] }), hp0 = B.hp;
      SC.press(0, 'throw'); SC.sim(.05);
      const thrown = A.throwN[0] === 0 && A.stats.thrown === 1;
      SC.sim(1.2); SC.move(1, -1); SC.sim(2.5); SC.move(1, 0);
      const hit = B.hp < hp0 || Object.keys(B.status).length > 0 || Object.keys(A.status).length > 0;
      SC.press(0, 'throw'); SC.sim(.05); const second = A.throwN[1] === 0;
      SC.render(); SC.sim(2); SC.render();
      const errors = __V.errs(e0);
      out.push({ kind: 'throwable', key: k, ok: thrown && hit && second && !errors.length && !__T.nan(), note: `foe hp ${hp0}->${B.hp} ${Object.keys(B.status).join(',')}`, errors });
    }
    // Mounts: ride toward a foe attacking for 2.5 s (it must hurt it, or for the jetpack lift us), then the timer ends it,
    // and a big hit knocks the rider off.
    for (const k of Object.keys(SC.reg.MOUNTS)) {
      const e0 = SC.errors.length, [A, B] = __V.duel({ gap: 220 }), hp0 = B.hp, y0 = A.P[2].y, def = SC.reg.MOUNTS[k];
      const m = mount(A, k);
      A.inp.jumpHeld = true; A.inp.attackHeld = true; SC.move(0, 1); SC.press(0, 'jump');   // take off (jetpack)
      let top = y0;
      for (let t = 0; t < 2.5; t += .25) { SC.press(0, 'attack'); SC.sim(.25); top = Math.min(top, A.P[2].y); SC.render(); }
      const effect = def.fly ? top < y0 - 120 : B.hp < hp0;   // flyers must fly, ground mounts must hurt the foe
      SC.move(0, 0); A.inp.attackHeld = false; A.inp.jumpHeld = false;
      SC.sim(def.time); const timed = !A.mount;
      mount(A, k); damage(A, 45, { src: B, kind: 'melee', nx: -1 }); const knocked = !A.mount;   // big even through mech armour
      const errors = __V.errs(e0), nan = __T.nan();
      out.push({ kind: 'mount', key: k, ok: !!m && effect && timed && knocked && !errors.length && !nan,
        note: `foe hp ${hp0}->${Math.round(B.hp)} rise ${Math.round(y0 - top)}${timed ? '' : ' no-timeout'}${knocked ? '' : ' no-knockoff'}${nan ? ' NaN' : ''}`, errors });
    }
    // Ultimates: a full meter and the super key with a weapon of each category, foe 150 px in front.
    for (const cat of Object.keys(SC.reg.ULTIMATES)) {
      const w = Object.values(SC.reg.WEAPONS).find(x => x.cat === cat && !x.hidden) || Object.values(SC.reg.WEAPONS).find(x => x.cat === cat);
      const e0 = SC.errors.length, [A, B] = __V.duel({ gap: 150, weapons: [w.key, 'blade'] }), hp0 = B.hp;
      A.super = 100; SC.press(0, 'super'); SC.sim(.05);
      const started = !!A.ult && A.super === 0;
      for (let t = 0; t < 2; t += .25) { SC.sim(.25); SC.render(); }
      const errors = __V.errs(e0);
      out.push({ kind: 'ultimate', key: cat, ok: started && !A.ult && B.hp < hp0 && !errors.length && !__T.nan(), note: `${SC.reg.ULTIMATES[cat].name} with ${w.key}: ${hp0 - Math.round(B.hp)} dmg`, errors });
    }
    // Elements: a fused weapon's hit applies its effect (shock arcs to a second foe).
    defMode('t-three', { hidden: true, setup: () => ({ roster: [0, 1, 2].map(t => ({ team: t, ctrl: 'human', slot: t ? 1 : 0, weapon: 'blade', cls: 'none', throws: ['none', 'none'] })) }) });
    const want = { fire: B => B.status.burn, ice: B => B.status.slow, poison: B => B.status.poison, shock: (B, C) => C.hp < C.maxHp };
    for (const k of Object.keys(SC.reg.ELEMENTS)) {
      const e0 = SC.errors.length;
      SC.start({ mode: 't-three', map: 'neon' }); __V.quiet(); SC.sim(.2);
      const [A, B, C] = SC.F;
      __V.place(A, 400); __V.place(B, 500); __V.place(C, 580); SC.sim(.1);
      fuseElement(A, k);
      damage(B, 6, { src: A, kind: 'melee', nx: 1 });
      const check = want[k] ? !!want[k](B, C) : true;
      SC.render();
      const errors = __V.errs(e0);
      out.push({ kind: 'element', key: k, ok: check && weaponLabel(A).startsWith(SC.reg.ELEMENTS[k].adj) && !errors.length, note: weaponLabel(A), errors });
    }
    return out;
  }, QUICK ? 10 : 20);
  for (const r of res) {
    check(r.ok, `${r.kind} ${r.key}: failed (${r.note || ''}) ${r.errors.join(' | ')}`);
    rows.push({ kind: r.kind, key: r.key, ok: r.ok, rounds: r.rounds, avgT: r.avgT ? r.avgT.toFixed(1) : '', hits: r.hits, dmg: r.dmg, upright: r.upright != null ? Math.round(r.upright * 100) + '%' : '', note: r.note || '' });
  }
}

async function testV3Core(page) {
  await page.evaluate(V3_HELPERS);
  const res = await page.evaluate(() => {
    const out = {}, notes = {}, DT = 1 / 120, e0 = SC.errors.length;
    const ev = {};
    for (const k of ['parry', 'guardBreak', 'grab', 'throw', 'grabEscape', 'wallJump', 'disarm', 'pickup', 'levelUp', 'shatter']) on(k, () => { ev[k] = (ev[k] || 0) + 1; });

    // Guard: front hits only chip, back hits land in full; a fresh guard parries and staggers the attacker.
    let [A, B] = __V.duel();
    SC.hold(0, 'block'); SC.sim(.3);
    const chip = damage(A, 20, { src: B, kind: 'melee', nx: -1 }), back = damage(A, 20, { src: B, kind: 'melee', nx: 1 });
    out.blockChip = A.blocking && chip <= 5 && back >= 18 && A.stamina < A.maxStamina;
    notes.blockChip = `front ${chip}, back ${back}`;
    SC.hold(0, 'block', false); SC.sim(.5); SC.hold(0, 'block'); SC.sim(DT * 3);
    const hp0 = A.hp, parried = damage(A, 20, { src: B, kind: 'melee', nx: -1 });
    out.parry = parried === 0 && A.hp === hp0 && !!B.status.stun && ev.parry === 1;
    SC.hold(0, 'block', false); SC.sim(.5); SC.hold(0, 'block'); SC.sim(DT * 3);
    const shot = spawnProj({ owner: B, x: A.P[1].x + 40, y: chest(A).y, vx: -1400, vy: 0, dmg: 8, life: 1 }); SC.sim(DT * 4);
    out.parryShot = shot.team === A.team && shot.owner === A;
    SC.hold(0, 'block', false); SC.sim(1); SC.hold(0, 'block'); SC.sim(.3);
    for (let k = 0; k < 12 && !A.guardBroken; k++) { damage(A, 10, { src: B, kind: 'melee', nx: -1 }); A.hp = A.maxHp; }
    out.guardBreak = A.guardBroken > 0 && !!A.status.stun && !A.blocking && ev.guardBreak === 1;
    SC.hold(0, 'block', false);

    // Grab and throw: grabs go through a guard; the throw ragdolls and hurts; mashing breaks free.
    [A, B] = __V.duel({ gap: 50 });
    SC.hold(1, 'block'); SC.sim(.2);
    SC.press(0, 'grab'); SC.sim(DT * 2);
    const held = A.holding === B && B.heldBy === A && !B.blocking;
    SC.sim(.3); const bhp = B.hp; SC.press(0, 'grab'); SC.sim(DT * 2);
    out.grabThrow = held && !A.holding && !!B.status.ragdoll && B.hp < bhp && ev.throw === 1;
    SC.hold(1, 'block', false); SC.sim(1.5); __V.place(A, 500); __V.place(B, 550); SC.sim(.2);
    SC.press(0, 'grab'); SC.sim(DT * 2);
    const held2 = A.holding === B;
    for (let k = 0; k < 8; k++) { SC.press(1, 'mash'); SC.sim(DT * 2); }
    out.escape = held2 && !B.heldBy && !A.holding && ev.grabEscape === 1;
    notes.escape = `held ${held2}, presses ${B.escape}`;
    // Block + attack grabs too.
    SC.sim(1.5); __V.place(A, 500); __V.place(B, 550); SC.sim(.2);
    SC.hold(0, 'block'); SC.sim(.05); SC.press(0, 'attack'); SC.sim(DT * 2);
    out.blockAttackGrabs = A.holding === B;
    SC.hold(0, 'block', false); SC.sim(1.5);

    // Walls: pressing into the arena wall in the air slows the fall; jump kicks off it.
    [A, B] = __V.duel();
    moveFighter(A, 30 - A.P[2].x, -320); SC.move(0, -1);
    let slid = false, maxV = 0;
    for (let k = 0; k < 40; k++) { SC.sim(DT * 2); if (A.wallSliding) { slid = true; maxV = Math.max(maxV, vy(A.P[2])); } }
    SC.press(0, 'jump'); SC.sim(DT * 3);
    out.wallSlideJump = slid && maxV < 450 && A.stats.wallJumps === 1 && vx(A.P[2]) > 200 && ev.wallJump === 1;
    notes.wallSlideJump = `slid ${slid} max fall ${Math.round(maxV)} kick vx ${Math.round(vx(A.P[2]))}`;
    SC.move(0, 0);

    // Disarm: the weapon flies off as a pickup, the fighter is bare-handed, and walking over it re-arms them.
    [A, B] = __V.duel({ gap: 200 });
    const key = A.wkey, item = disarm(A, B, { nx: 1 });
    const bare = A.wkey === 'fists' && !!item && pickupsLive().length === 1;
    SC.sim(1.4);
    __V.place(A, item.x); SC.sim(.3);
    out.disarmPickup = bare && A.wkey === key && ev.pickup === 1;
    notes.disarmPickup = `bare ${bare}, now ${A.wkey}`;
    let chanceDisarms = 0;                                   // strong hits knock weapons loose now and then
    for (let k = 0; k < 80 && !chanceDisarms; k++) { B.hp = B.maxHp; damage(B, 30, { src: A, kind: 'melee', nx: 1 }); if (B.wkey === 'fists') chanceDisarms++; }
    out.disarmChance = chanceDisarms > 0;
    // Bare-handed for 5 s: a supply crate drops next to them; touching it hands over its weapon.
    for (const p of pickupsLive()) p.dead = true;
    SC.sim(.1); disarm(A, B, { nx: 1 }); for (const p of pickupsLive()) p.dead = true;
    SC.sim(6);
    const crate = pickupsLive().find(p => p.pickup === 'crate');
    SC.sim(3);
    if (crate) { __V.place(A, crate.x); SC.sim(.3); }
    out.supplyCrate = !!crate && A.wkey !== 'fists';
    notes.supplyCrate = crate ? `crate with ${crate.wkey}, now ${A.wkey}` : 'no crate';

    // Weapon levels: damage dealt levels the weapon; Lv3 hits carry the category's element (heavy: fire).
    [A, B] = __V.duel({ weapons: ['hammer', 'blade'] });
    const reach0 = A.reachMul, ups0 = ev.levelUp || 0;
    for (let k = 0; k < 8; k++) { B.hp = B.maxHp; damage(B, 25, { src: A, kind: 'melee', weapon: A.w, nx: 1 }); }
    B.hp = B.maxHp; removeStatus(B, 'burn'); damage(B, 10, { src: A, kind: 'melee', weapon: A.w, nx: 1 });
    out.weaponLevels = A.lvl === 3 && A.reachMul > reach0 && A.lvlDmg > 1 && !!B.status.burn && ev.levelUp - ups0 === 2;
    notes.weaponLevels = `lv ${A.lvl} reach ${A.reachMul} dmg ${A.lvlDmg} burn ${!!B.status.burn} ups ${ev.levelUp - ups0}`;

    // Super meter: fills from damage dealt and taken; full + super key fires the ultimate.
    [A, B] = __V.duel();
    A.super = B.super = 0;
    damage(B, 40, { src: A, kind: 'melee', nx: 1 });
    out.superMeter = A.super > 15 && B.super > 10;
    notes.superMeter = `dealer ${A.super.toFixed(1)} taker ${B.super.toFixed(1)}`;

    // Class passives: Ninja triple jump, Trickster's longer dash + invisibility, Gunner's bigger magazine, Mage cooldowns.
    [A, B] = __V.duel({ classes: ['ninja', 'trickster'], weapons: ['blade', 'blade'] });
    A.inp.jumpHeld = true; SC.press(0, 'jump'); SC.sim(.25); SC.press(0, 'jump'); SC.sim(.25); SC.press(0, 'jump'); SC.sim(.05);
    out.ninjaTripleJump = A.stats.jumps === 3;
    SC.sim(1.5);
    const dashFrom = x => { const f = SC.F[x]; const x0 = f.P[2].x; SC.press(x, 'dash'); SC.sim(.45); return Math.abs(f.P[2].x - x0); };
    const trick = (__V.place(B, 300), SC.sim(.3), dashFrom(1)), invis = !!B.status.invis;
    [A, B] = __V.duel({ classes: ['gunner', 'none'], weapons: ['pistol', 'blade'] });
    const plain = (__V.place(B, 300), SC.sim(.3), dashFrom(1));
    out.tricksterDash = trick > plain * 1.3 && invis;
    notes.tricksterDash = `${Math.round(trick)} vs ${Math.round(plain)} px`;
    out.gunnerAmmo = A.ammo === Math.round(WEAPONS.pistol.ranged.ammo * 1.5);
    [A, B] = __V.duel({ classes: ['mage', 'none'], weapons: ['blade', 'blade'] });
    out.mageCooldown = A.skillCdMul < 1;

    // Eight fighters: distinct spawns on every arena, a long CPU brawl without errors, and the step cost.
    const spread = [];
    for (const m of Object.keys(SC.reg.MAPS).filter(k => !SC.reg.MAPS[k].hidden)) {
      SC.start({ mode: 'watch', fighters: 8, map: m }); __V.quiet();
      const xs = new Set(SC.F.map(f => Math.round(f.P[2].x / 25)));
      spread.push(xs.size);
    }
    SC.start({ mode: 'watch', fighters: 8, map: 'neon' });
    const t0 = performance.now(); SC.sim(30); const ms = (performance.now() - t0) / (30 * 120);
    const r0 = performance.now(); for (let k = 0; k < 20; k++) SC.render(1 / 60); const rms = (performance.now() - r0) / 20;
    out.eightFighters = SC.F.length === 8 && Math.min(...spread) >= 5 && !__T.nan() && ms < 2.5;
    notes.eightFighters = `min distinct spawns ${Math.min(...spread)}, ${ms.toFixed(2)} ms/step, ${rms.toFixed(1)} ms/frame`;
    SC.start({ mode: 'ffa', fighters: 8, autopilot: true }); SC.sim(75);       // a round ends by 61 s at the latest
    const crowd = SC.F.filter(f => !f.summon).length;
    out.ffaEight = crowd === 8 && SC.G.log.length > 0 && !__T.nan();
    notes.ffaEight = `${crowd} fighters, ${SC.G.log.length} rounds, avg ${(SC.G.log.reduce((t, r) => t + r.time, 0) / Math.max(1, SC.G.log.length)).toFixed(1)} s`;

    out.errors = __V.errs(e0);
    return { out, notes };
  });
  const errs = res.out.errors; delete res.out.errors;
  for (const [k, v] of Object.entries(res.out)) {
    check(v, `v3 core ${k}: failed ${res.notes[k] || ''}`);
    rows.push({ kind: 'v3', key: k, ok: !!v, note: res.notes[k] || '' });
  }
  check(!errs.length, 'v3 core: errors ' + errs.join(' | '));
}

// Real-time screens of the v3 features (read them after a run): an 8-fighter brawl, a mounted fighter, an ultimate's
// cut-in, the shatter replayed in the kill-cam, and the loadout's class and throwable tabs.
// v3 party modes (71-73), the ranked ladder and multi-phase bosses (74): each party mode must reach its results
// headless (CPUs play the objective), bossPhases must fire its phases and clean up its adds.
const PARTY_MODES = ['ctf', 'soccer', 'potato', 'gungame', 'juggernaut', 'zombies', 'royale', 'lava', 'ranked'];
async function testPartyModes(page) {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const k of PARTY_MODES) {
    const r = await page.evaluate(k => {
      if (!SC.reg.MODES[k]) return { missing: true };
      const e0 = SC.errors.length;
      SC.start({ mode: k, autopilot: true, map: 'random' });
      let t = 0;
      while (SC.G.state !== 'over' && t < 300) { SC.sim(5); t += 5; }
      const out = { over: SC.G.state === 'over', t, title: SC.G.result && SC.G.result.title, errors: SC.errors.slice(e0).map(e => e.msg) };
      SC.start({ mode: k, autopilot: true, map: 'random' }); SC.sim(8); BANNER = null;
      for (let i = 0; i < 10; i++) SC.render(1 / 60);
      return out;
    }, k);
    if (r.missing) { check(false, `party mode ${k}: not registered`); continue; }
    await page.screenshot({ path: path.join(SHOTS, `mode-${k}.png`) });
    const ok = check(r.over && !!r.title, `party mode ${k}: no result after ${r.t}s`) & check(!r.errors.length, `party mode ${k}: errors ${r.errors.join(' | ')}`);
    rows.push({ kind: 'party', key: k, ok: !!ok, note: r.over ? `${r.title} (${r.t}s)` : 'unfinished' });
  }
  const b = await page.evaluate(() => {
    const e0 = SC.errors.length, out = {};
    SC.start({ mode: 'bossrush', autopilot: true, map: 'neon' }); SC.G.lock = 0; SC.sim(.2);
    const boss = SC.F.find(f => f.isBoss), ctl = bossPhaseCtl(boss);
    boss.hp = boss.maxHp * .45; SC.sim(.3);
    out.p2 = ctl && ctl.idx === 1 && BANNER && BANNER.a === ctl.phases[0].name;
    boss.hp = boss.maxHp * .2; SC.sim(.3);
    out.p3 = ctl && ctl.idx === 2 && PROJ.filter(p => p.kind === 'mode-hazard').length >= 2;
    SC.start({ mode: 'watch', map: 'neon', weapons: ['blade', 'blade'] }); SC.G.lock = 0;
    const c2 = bossPhases(SC.F[1], [{ at: .5, name: 'TEST PHASE', fx: [['adds', { n: 2 }], ['rain', { every: .2, first: 0 }], ['platforms', {}]] }]);
    SC.F[1].hp = SC.F[1].maxHp * .4; SC.sim(.5);
    out.adds = SC.F.filter(f => f.summon && f.owner === SC.F[1]).length === 2 && PROJ.some(p => p.zone && p.danger > 0);
    knockout(SC.F[1], SC.F[0]); SC.sim(.2);
    out.cleanup = c2.done && !SC.F.some(f => f.summon && f.alive);
    out.rank = rankOf(0).label === 'Bronze III' && rankOf(299).label === 'Bronze I' && rankOf(300).label === 'Silver III' && rankOf(RANK_GM + 50).gm
      && rankSettle(true, true).delta > 0;
    out.errors = SC.errors.slice(e0).map(e => e.msg);
    return out;
  });
  for (const k of ['p2', 'p3', 'adds', 'cleanup', 'rank']) {
    check(b[k], `boss phases / ranked: ${k} failed`);
    rows.push({ kind: 'v3-modes', key: k, ok: !!b[k] });
  }
  check(!b.errors.length, 'boss phases: errors ' + b.errors.join(' | '));
}

async function testV3Screens(browser) {
  const { page, errors } = await newPage(browser);
  const step = async (name, fn) => { try { const ok = await fn(); check(ok, `ui ${name}: failed`); rows.push({ kind: 'ui', key: name, ok: !!ok }); } catch (e) { check(false, `ui ${name}: ${e.message}`); rows.push({ kind: 'ui', key: name, ok: false }); } };
  await step('8-fighter match screen', async () => {
    await page.evaluate(() => { startMatch({ mode: 'watch', fighters: 8, map: 'dojo', diff: 'hard' }); SC.G.state = 'play'; });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: path.join(SHOTS, 'v3-eight.png') });
    return page.evaluate(() => SC.F.filter(f => !f.summon).length === 8 && SC.G.state !== 'menu');   // decoys don't count
  });
  await step('mounted fighters screen', async () => {
    await page.evaluate(() => {
      startMatch({ mode: 'watch', fighters: 4, map: 'neon', loadouts: [{ cls: 'none' }, { cls: 'none' }, { cls: 'none' }, { cls: 'none' }] });
      SC.G.lock = 0; ['dragon', 'mech', 'hoverboard', 'jetpack'].forEach((k, i) => mount(SC.F[i], k));
    });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(SHOTS, 'v3-mounts.png') });
    return page.evaluate(() => SC.F.filter(f => f.mount).length >= 2);
  });
  await step('ultimate cut-in screen', async () => {
    await page.evaluate(() => {
      startMatch({ mode: 'versus', map: 'dojo', loadouts: [{ weapon: 'greatsword', cls: 'brute' }, { weapon: 'spear' }] });
      SC.G.lock = 0; for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; }
      BANNER = null; SC.F[0].super = 100; SC.press(0, 'super');
    });
    await page.waitForTimeout(420);
    await page.screenshot({ path: path.join(SHOTS, 'v3-ultimate.png') });
    return page.evaluate(() => SC.F[0].stats.ults === 1);
  });
  await step('shatter replays in the kill-cam', async () => {
    await page.evaluate(() => { startMatch({ mode: 'versus', map: 'neon' }); SC.G.lock = 0; for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; } });
    await page.waitForTimeout(2200);
    await page.evaluate(() => { SC.G.score[0] = SC.G.winScore - 1; damage(SC.F[1], 999, { src: SC.F[0], kind: 'melee', nx: 1, ny: -.3 }); });
    const live = await page.evaluate(() => SHARDS.length > 0 && KC.events.some(e => e.kind === 'shatter'));
    // The replay starts after the K.O. delay; wait until its clock passes the K.O. so the pieces are re-spawned.
    await page.waitForFunction(() => KC.play && KC.play.clock > KC.play.ko.t + .15, null, { timeout: 9000 });
    const replay = await page.evaluate(() => ({ state: SC.G.state, shards: SHARDS.length, hidden: SC.F.some(f => !f.alive && f.shatterT > 0) }));
    await page.screenshot({ path: path.join(SHOTS, 'v3-killcam-shatter.png') });
    await page.evaluate(() => SC.killcam.skip());
    return live && replay.state === 'killcam' && replay.shards > 0 && replay.hidden;
  });
  await step('loadout class + throwable tabs', async () => {
    await page.evaluate(() => toMenu());
    await page.waitForTimeout(200);
    await page.click('#menu button:has-text("Play")'); await page.waitForTimeout(150);
    await page.click('#modes [data-key="mode-versus"]'); await page.waitForTimeout(150);
    await page.click('#loadout [data-key="tab-class"]'); await page.waitForTimeout(150);
    await page.click('#loadout [data-key="cls-tank"]'); await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, 'v3-loadout-class.png') });
    await page.click('#loadout [data-key="tab-gear"]'); await page.waitForTimeout(150);
    await page.click('#loadout [data-key="th-clear"]'); await page.click('#loadout [data-key="th-mine"]'); await page.click('#loadout [data-key="th-smoke"]');
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(SHOTS, 'v3-loadout-gear.png') });
    const lo = await page.evaluate(() => MENU.loadouts[0]);
    await page.evaluate(() => { LO.tab = 'weapon'; });
    return lo.cls === 'tank' && lo.throws[0] === 'mine' && lo.throws[1] === 'smoke';
  });
  await step('how-to-play lists the v3 moves', async () => {
    await page.evaluate(() => { toMenu(); openScreen('howto', 'menu'); });
    await page.waitForTimeout(150);
    const txt = await page.textContent('#howto');
    await page.screenshot({ path: path.join(SHOTS, 'v3-howto.png'), fullPage: true });
    await page.evaluate(() => goBack());
    return ['Block and parry', 'Grab and throw', 'Walls', 'Classes', 'Super and ultimates', 'Weapon levels', 'Throwables', 'Disarms'].every(t => txt.includes(t));
  });
  await step('no console errors (v3 screens)', async () => !errors.length && !(await page.evaluate(() => SC.errors.length)));
  if (errors.length) failures.push('v3 screens console: ' + errors.join(' | '));
  await page.close();
}

// ---------- the real UI: menu -> match -> pause -> results -> menu ----------
// Phone-sized touch device: on-screen buttons appear during play and drive P1.
// Input checks measure P1's movement, so the CPU goes idle (no decisions, no reflex shooting) and can't stun, freeze,
// slow, shoot or pull P1 mid-check.
const CALM_CPUS = () => { for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; f.inp.mx = 0; f.inp.attackHeld = false; } };

async function testTouch(browser) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.screenshot({ path: path.join(SHOTS, 'touch-menu.png') });
  await page.evaluate(() => { MENU.map = 'dojo'; MENU.mode = 'versus'; });
  await page.tap('#menu .go');
  await page.evaluate(CALM_CPUS);
  await page.waitForTimeout(1500);
  const visible = await page.isVisible('#touch');
  const x0 = await page.evaluate(() => SC.F[0].P[2].x);
  // The floating stick (91-touch): a thumb lands on the left side and drags toward the foe.
  const cdp = await ctx.newCDPSession(page), dir = x0 < 640 ? 1 : -1;
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await touch('touchStart', [{ x: 170, y: 300, id: 1 }]);
  for (let k = 1; k <= 6; k++) await touch('touchMove', [{ x: 170 + dir * k * 10, y: 300, id: 1 }]);
  await page.waitForTimeout(400); await touch('touchEnd', []);
  const moved = Math.abs((await page.evaluate(() => SC.F[0].P[2].x)) - x0);
  const bb = await page.locator('#touch [data-act="block"]').boundingBox();
  let guard = false;
  if (bb) {
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down(); await page.waitForTimeout(150);
    guard = await page.evaluate(() => SC.F[0].blocking);
    await page.mouse.up();
  }
  const v3Buttons = await page.evaluate(() => ['super', 'throw', 'grab', 'block', 'taunt'].every(a => { const b = document.querySelector(`#touch [data-act="${a}"]`); return b && b.offsetParent !== null; }));
  await page.screenshot({ path: path.join(SHOTS, 'touch-play.png') });
  const ok = check(visible, 'touch: buttons hidden on a touch device') & check(moved > 40, 'touch: the stick did not move P1')
    & check(guard, 'touch: block button did not raise the guard') & check(v3Buttons, 'touch: super/throw/grab/block/taunt buttons missing')
    & check(!errors.length, 'touch: errors ' + errors.join(' | '));
  rows.push({ kind: 'ui', key: 'touch controls', ok: !!ok });
  await ctx.close();
}

async function testUI(browser) {
  const { page, errors } = await newPage(browser);
  const step = async (name, fn) => { try { const ok = await fn(); check(ok, `ui ${name}: failed`); rows.push({ kind: 'ui', key: name, ok: !!ok }); } catch (e) { check(false, `ui ${name}: ${e.message}`); rows.push({ kind: 'ui', key: name, ok: false }); } };
  await step('menu visible', async () => page.isVisible('#menu .go'));
  await page.screenshot({ path: path.join(SHOTS, 'ui-menu.png') });
  await step('fight starts a match', async () => {
    // A walled, pit-free arena: the input checks walk, dash and fire ultimates, which could ring P1 out elsewhere.
    await page.evaluate(() => { MENU.map = 'dojo'; MENU.mode = 'versus'; window.__kos = []; on('ko', (v, k, o) => __kos.push(`${v.name} by ${k ? k.name : '-'} (${(o && o.kind) || 'melee'}${o && o.throw ? ' throw' : ''})`)); });
    await page.click('#menu .go');
    await page.evaluate(CALM_CPUS);
    await page.waitForTimeout(300);
    return page.evaluate(() => SC.G.state === 'play' && SC.F.some(f => f.ctrl === 'human'));
  });
  await page.waitForTimeout(1300);   // let "ROUND 1 / FIGHT!" finish
  await step('keyboard moves P1', async () => {
    const x0 = await page.evaluate(() => SC.F[0].P[2].x);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(450); await page.keyboard.up('KeyD');
    const x1 = await page.evaluate(() => SC.F[0].P[2].x);
    return x1 - x0 > 60;
  });
  // Reads P1's input while the key is held (the arena is random: on ice, turning around takes most of the hold).
  await step('P1 also answers the arrow keys in 1P', async () => {
    const x0 = await page.evaluate(() => SC.F[0].P[2].x);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(200);
    const mx = await page.evaluate(() => SC.F[0].inp.mx);
    await page.waitForTimeout(250); await page.keyboard.up('ArrowLeft');
    return mx < 0 && (await page.evaluate(() => SC.F[0].P[2].x)) - x0 < -15;
  });
  await step('attack key swings', async () => {
    await page.keyboard.press('KeyS'); await page.waitForTimeout(60);
    return page.evaluate(() => SC.F[0].swingT > 0 || SC.F[0].atkCd > 0 || SC.F[0].stats.shots > 0);   // fast guns' cooldown is < 60ms
  });
  await step('block key raises the guard', async () => {
    await page.keyboard.down('KeyF'); await page.waitForTimeout(150);
    const up = await page.evaluate(() => SC.F[0].blocking);
    await page.keyboard.up('KeyF'); await page.waitForTimeout(60);
    return up && !(await page.evaluate(() => SC.F[0].blocking));
  });
  await step('grab, throwable and super keys', async () => {
    await page.keyboard.press('KeyC'); await page.waitForTimeout(60);
    const grabbed = await page.evaluate(() => SC.F[0].grabCd > 0);
    await page.keyboard.press('KeyR'); await page.waitForTimeout(80);
    await page.evaluate(() => { SC.F[0].super = 100; });
    await page.keyboard.press('KeyX'); await page.waitForTimeout(80);
    const r = await page.evaluate(() => ({ thrown: SC.F[0].stats.thrown, ults: SC.F[0].stats.ults }));
    await page.waitForTimeout(900);                     // let the ultimate finish
    return grabbed && r.thrown === 1 && r.ults === 1;
  });
  await page.screenshot({ path: path.join(SHOTS, 'ui-play.png') });
  await step('escape pauses', async () => {
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    return (await page.evaluate(() => SC.G.state === 'paused')) && page.isVisible('#pause');
  });
  await page.screenshot({ path: path.join(SHOTS, 'ui-pause.png') });
  await step('resume', async () => {
    await page.click('#pause .go'); await page.waitForTimeout(150);
    return page.evaluate(() => SC.G.state === 'play');
  });
  await step('results after the match', async () => {
    // A round may already be ending (the checks above use real moves): let it finish before forcing the last K.O.
    const kos = await page.evaluate(() => (window.__kos || []).join(' | '));
    if (kos) rows.push({ kind: 'ui', key: 'K.O.s during the key checks', ok: true, note: kos });
    await page.evaluate(() => { if (SC.G.ending) SC.sim(TUNE.koDelay + .2); SC.G.score[0] = SC.G.winScore - 1; SC.G.lock = 0; damage(SC.F[1], 999, { src: SC.F[0], kind: 'melee' }); SC.sim(4); });
    await page.waitForTimeout(300);
    return (await page.evaluate(() => SC.G.state === 'over')) && page.isVisible('#over h2');
  });
  await page.screenshot({ path: path.join(SHOTS, 'ui-results.png') });
  await step('back to menu', async () => {
    await page.click('#over button:not(.go)'); await page.waitForTimeout(200);
    return (await page.evaluate(() => SC.G.state === 'menu')) && page.isVisible('#menu .go');
  });
  await step('controls panel', async () => {
    await page.click('#menu button:has-text("Controls")'); await page.waitForTimeout(100);
    const vis = await page.isVisible('#controls .binds');
    await page.screenshot({ path: path.join(SHOTS, 'ui-controls.png') });
    await page.click('#controls .go');
    return vis && page.isVisible('#menu .go');
  });
  await step('double-tap dashes', async () => {
    await page.evaluate(() => { startMatch({ mode: 'versus' }); SC.G.lock = 0; });
    await page.evaluate(CALM_CPUS);
    await page.keyboard.press('KeyD'); await page.waitForTimeout(90); await page.keyboard.press('KeyD'); await page.waitForTimeout(150);
    return page.evaluate(() => SC.F[0].stats.dashes > 0);
  });
  await step('gamepad moves and jumps', async () => {
    await page.evaluate(() => {
      window.__pad = { index: 0, id: 'mock pad', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
      navigator.getGamepads = () => [window.__pad];
      window.__x0 = SC.F[0].P[2].x; __pad.axes[0] = 1;
    });
    await page.waitForTimeout(400);
    // The dash above may have left P1 against a wall on the right (e.g. Haunted Mansion): then walk left instead.
    if (await page.evaluate(() => Math.abs(SC.F[0].P[2].x - __x0) < 60)) {
      await page.evaluate(() => { window.__x0 = SC.F[0].P[2].x; __pad.axes[0] = -1; });
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => { __pad.axes[0] = 0; __pad.buttons[0].pressed = true; });
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => ({ moved: Math.abs(SC.F[0].P[2].x - __x0), jumps: SC.F[0].stats.jumps }));
    await page.evaluate(() => { __pad.buttons[0].pressed = false; __pad.buttons[6].value = 1; });   // LT: hold to block
    await page.waitForTimeout(120);
    const guard = await page.evaluate(() => SC.F[0].blocking);
    await page.evaluate(() => { __pad.buttons[6].value = 0; navigator.getGamepads = () => []; });
    return r.moved > 60 && r.jumps > 0 && guard;
  });
  await step('no console errors', async () => !errors.length && !(await page.evaluate(() => SC.errors.length)));
  if (errors.length) failures.push('ui console: ' + errors.join(' | '));
  await page.close();
}

function summary(r) {
  return { rounds: r.rounds, avgT: r.avgT ? r.avgT.toFixed(1) : '', hits: r.hits, dmg: r.dmg, upright: Math.round(r.upright * 100) + '%' };
}

(async () => {
  const t0 = Date.now();
  build();
  const browser = await chromium.launch();
  try {
    const { page, errors } = await newPage(browser);
    check(!(await page.evaluate(() => SC.errors.length)), 'boot: errors ' + (await page.evaluate(() => SC.errors.map(e => e.msg).join(' | '))));
    await testWeapons(page);
    await testSkills(page);
    await testMaps(page);
    await testModes(page);
    await testOrbsHatsStatuses(page);
    await testCore(page);
    await testV3Registry(page);
    await testV3Core(page);
    await testPartyModes(page);
    await require('./smoke-quest.cjs').run(page, browser, { check, rows, SHOTS, newPage });   // campaign nodes + challenges + their screens
    await require('./smoke-progress.cjs').run(page, browser, { check, rows, SHOTS, newPage });   // outfits, pets, mutators, track, quests, codex
    if (errors.length) failures.push('console: ' + [...new Set(errors)].join(' | '));
    await page.close();
    await testUI(browser);
    await testV3Screens(browser);
    await testTouch(browser);
    await require('./smoke-fx.cjs').run(browser, { check, rows, SHOTS });
    await require('./smoke-access.cjs').run(browser, { check, rows, SHOTS });   // touch stick, pads, accessibility, save codes   // announcer, crowd, music, bloom, photo mode, highlights
  } catch (e) {
    failures.push('smoke crashed: ' + (e.stack || e.message));
  } finally {
    await browser.close();
  }
  console.table(rows.map(r => ({ kind: r.kind, key: r.key, ok: r.ok ? 'ok' : 'FAIL', rounds: r.rounds ?? '', avgT: r.avgT ?? '', hits: r.hits ?? '', dmg: r.dmg ?? '', upright: r.upright ?? '', note: r.note ?? '' })));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (failures.length) {
    console.error(`\nSMOKE FAILED (${failures.length}) in ${secs}s:\n - ` + failures.join('\n - '));
    process.exit(1);
  }
  console.log(`\nSMOKE OK: ${rows.length} checks in ${secs}s. Screenshots in tmp/smoke/`);
})();
