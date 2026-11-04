// 72b-coop-v6.js (v6): co-op Boss Raid: The Colossus and Defend the Core. Boss parts and the core are pinned
// stand-in fighters, so every attack and CPU treats them as foes; summons get no HUD card.

// ---------- co-op helpers ----------
let CV6_ID = 0;
const cv6Id = () => 1000 + CV6_ID++ % 4000;
const cv6Heroes = () => F.filter(f => f.team === 0 && !f.summon);
// The heroes, all on team 0: P1, P2 (a CPU ally when alone) and allies up to n.
function cv6Roster(cfg, n, hpMul) {
  const list = v6Crowd(cfg, n, [0, 0], 'ALLY', () => 0);
  for (const r of list) r.hpMul = (r.hpMul || 1) * hpMul;
  return list;
}
function cv6Summon(o, extra) {
  const f = makeFighter(Object.assign({ id: cv6Id(), team: 1, ctrl: 'cpu', skills: [], hat: 'none', cls: 'none', throws: [], aiLevel: modeDiff() }, o));
  Object.assign(f, { summon: true, superMul: 1e-6 }, extra);
  F = F.concat([f]);
  return f;
}
// A boss part or the core: an idle, unshovable stand-in with the part's health.
function cv6Part(o) {
  const f = cv6Summon({ team: o.team, weapon: 'fists', color: o.color, name: o.name, scale: o.scale || 1.5, aiLevel: 'easy', x: o.x, y: o.y + 60 }, { v6part: true, kbMul: 0 });
  f.ai.behave = 'idle'; f.maxHp = f.hp = f.hpShow = Math.max(1, Math.round(o.hp));
  for (const r of rigsOf(f)) r.ws = [];  // no weapon to strike or clash with: heroes walk into parts unhurt
  return f;
}
// Holds a part still: no speed and no drive forces, so its idle body never flails a fist into a hero.
const cv6Still = f => { for (const p of f.P) { p.ox = p.x; p.oy = p.y; p.fx = p.fy = 0; } };
function cv6Pin(f, x, y) { moveFighter(f, x - f.P[2].x, y - f.P[2].y); cv6Still(f); }
// The arenas' frame hook, after each fighter's drive: parts drop what their drive just did.
const cv6Frame = (f, phase, enter) => { if (f.v6part && phase === 'drive' && !enter) cv6Still(f); };
function cv6Drone(owner, x, y, o) {
  const d = cv6Summon({ weapon: 'drone-blaster', color: o.color || '#ff5ad1', name: 'DRONE', scale: .7, hpMul: o.hp || .3, aiLevel: o.level || modeDiff(), face: -1, x, y },
    { owner, v6draw: cv6DrawDrone, v6fly: { t: rnd(0, TAU), side: chance(.5) ? 1 : -1 } });
  ring(x, y, 50, d.color, .35, 3); sfx('blink', .5);
  return d;
}
// Drones hover beside their target: one velocity for every point, gravity cancelled.
function cv6Fly(d, dt) {
  const fl = d.v6fly, foe = d.ai.foe && d.ai.foe.alive ? d.ai.foe : nearestEnemy(d), hip = d.P[2];
  fl.t += dt;
  const tx = foe ? clamp(foe.P[2].x + fl.side * 150, 60, W - 60) : W / 2, ty = (MAP.floor ?? 650) - 220 + Math.sin(fl.t * 1.7) * 45;
  const sx = clamp((tx - hip.x) * 2, -260, 260), sy = clamp((ty - hip.y) * 2.4, -260, 260);
  for (const p of d.P) { p.ox = p.x - sx * DT; p.oy = p.y - sy * DT + PHYS.gravity * DT * DT; }
}
function cv6DrawDrone(c, d) {
  const p = chest(d), a = d.aim, col = d.flash > 0 ? '#ffffff' : d.color, ax = p.x + Math.cos(a) * 28, ay = p.y + Math.sin(a) * 28;
  lineXY(c, p.x, p.y, ax, ay, '#2a1a3a', 7); lineXY(c, p.x, p.y, ax, ay, col, 2.5);
  glow(c, col, 12, () => { c.fillStyle = '#1f1430'; c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.ellipse(p.x, p.y, 24, 14, 0, 0, TAU); c.fill(); c.stroke(); });
  circle(c, p.x + Math.cos(a) * 9, p.y + Math.sin(a) * 4, 5, col);
  for (const s of [-1, 1]) { const w = 18 * Math.abs(Math.sin(G_STATE.t * 40 + s)); lineXY(c, p.x + s * 17 - w, p.y - 18, p.x + s * 17 + w, p.y - 18, 'rgba(255,255,255,.75)', 2); }
}
// Beaten summons just vanish: give them a K.O. burst, credit the hero, tell the mode.
on('damage', (B, amt, o) => {
  if (!B.summon || B.alive || B.v6dead || !(B.v6inv || B.v6fly || B.v6part)) return;
  B.v6dead = true;
  const A = o && o.src && (o.src.summon ? o.src.owner : o.src), pts = [];
  if (A && A.team !== B.team && A.stats) A.stats.kos++;
  if (!B.v6part) { for (let j = 0; j < 11; j++) pts.push(B.P[j].x, B.P[j].y); shatterSpawn(pts, B.color, B.scale, o.nx || 0, o.ny || 0); }
  hook(G_STATE.mode, 'v6Fallen', B);
});
// The co-op rivalry line: both players' damage and K.O.s, and the MVP.
function cv6Rivalry() {
  const rows = G_STATE.roster.map((r, i) => G_STATE.log.reduce((a, l) => { const f = l.fighters[i]; if (f) { a.dmg += f.dmg; a.kos += f.kos; } return a; }, { r, dmg: 0, kos: 0 })).slice(0, 2);
  const mvp = rows[0].dmg >= rows[1].dmg ? rows[0] : rows[1];
  return `Friendly rivalry: ${rows.map(x => `${x.r.name}: ${Math.round(x.dmg)} damage, ${x.kos} K.O.${x.kos === 1 ? '' : 's'}`).join(' · ')} · MVP: ${mvp.r.name}.`;
}
// The players' best together (store 'v6coop'); better(a, b): a beats b.
function cv6Best(kind, value, better, show) {
  const names = G_STATE.roster.filter(r => r.ctrl === 'human').map(r => r.name).sort(), key = kind + ':' + names.map(duoLow).join('|');
  const all = store.getObj('v6coop'), old = all[key], top = value != null && (old == null || better(value, old));
  if (top && !G_STATE.cfg.autopilot) { all[key] = value; store.set('v6coop', all); }
  return top || old != null ? `${top ? 'New best' : 'Best'} together (${names.join(' & ')}): ${show(top ? value : old)}.` : null;
}
const cv6Result = (won, title, lose, col, lines) => ({ title: won ? title : lose, color: won ? col : '#ff4a6a', won, lines: [lines[0], cv6Rivalry(), lines[1]].filter(Boolean) });

defWeapon('drone-blaster', { name: 'Drone Blaster', cat: 'ranged', hidden: true, tier: 'common', desc: 'A Colossus drone\'s blaster.',
  len: 30, mass: .6, dmg: .4, color: '#ff5ad1', ai: { range: 460, style: 'ranged' },
  ranged: { cooldown: 1.3, ammo: 3, reload: 2.4, speed: 760, spread: .08, recoil: 40, sfx: 'gun-laser', proj: { dmg: 5, r: 4, life: 1.4, color: '#ff5ad1' } },
  draw(c, f, s) { line(c, s.at(-6 * s.k), s.t, '#3a2448', 7 * s.k); line(c, s.at(10 * s.k), s.t, '#ff5ad1', 3 * s.k); },
});

// ---------- Boss Raid: The Colossus ----------
// Phase 1: cannons shoot and slam. Phase 2 (74's bossPhases): the core opens, lasers sweep, drones come. Phase 3: debris.
const COLO = { rest: [[214, 392], [1066, 392]], shoulder: [[452, 236], [828, 236]], core: [640, 330], eye: [640, 116] };
const COLO_HP = { cannon: 520, core: 1040 }, COLO_TAKEN = .6, COLO_RAISE = 1, COLO_REST = 1.7, COLO_AIM = 1.1, COLO_SWEEP = 1.9;
const COLO_DODGE = { easy: .45, normal: .75, hard: .9, insane: .97 }, COLO_DIFF = { easy: .7, normal: 1, hard: 1.4, insane: 1.7 };
const coloGap = run => (run.phase === 1 ? 2.3 : run.phase === 2 ? 2.1 : 1.5) * (1 - .1 * (run.n - 2)) / run.dk ** .5 * rnd(.85, 1.15);
const coloSet = (a, s) => { a.state = s; a.t = 0; };

defMap('colossus', {
  name: "The Colossus's Yard", hidden: true, desc: 'A scrapyard where the Colossus sleeps standing up. Boss Raid wakes it.',
  floor: 650, maxOrbs: 1, weather: false,
  palette: { sky1: '#12060f', sky2: '#4a1426', ground: '#1c1218', line: '#ff8a2e', accent: '#ff5ad1', solid: '#2a1a24' },
  solids: [{ x: 80, y: 500, w: 260 }, { x: 940, y: 500, w: 260 }, { x: 530, y: 446, w: 220 }],
  spawns: [[400, 650], [880, 650], [260, 650], [1020, 650]], frame: cv6Frame,
  drawBg(c, t) { coloDrawBody(c, t); },
});

v6Def('raid', {
  name: 'Boss Raid: The Colossus', icon: '🤖', order: 53, duo: 'coop', roundLimit: 300, noScore: true, noDisarm: true, aiArmor: false, respawn: 5, ownMap: 'colossus',
  desc: 'Team up against a giant war machine: break its arm cannons, then its glowing core, dodging slams, lasers and drones.',
  setup(cfg) { return { roster: cv6Roster(cfg, partyCrowd(cfg, this), 1.3), map: 'colossus', run: { dead: {} } }; },
  roundLabel() { return 'BOSS RAID'; },
  onRoundStart() { coloStart(modeRun()); },
  onStep(dt) { coloStep(modeRun(), dt); },
  aiGoal(f) { return f.team ? null : coloAiGoal(modeRun(), f); },
  drawWorld(c) { coloDrawFx(c, modeRun()); },
  hud(c) { coloHud(c, modeRun()); },
  v6Fallen(B) { const run = modeRun(), a = run.arms && run.arms.find(x => x.part === B); if (a) coloBreak(a); },
  results() {
    const run = modeRun(), won = !!run.won, left = run.ctl ? Math.round(bossPhaseFrac(run.ctl) * 100) : 100;
    return cv6Result(won, 'COLOSSUS DOWN!', 'The Colossus stands', '#ffd84a', [
      won ? `Felled in ${v6Clock(run.t)} by ${run.n} heroes (${levelName(modeDiff())}).` : `It had ${left}% left${run.phase > 1 ? ', its core exposed' : ''}.`,
      cv6Best('raid', won ? Math.round(run.t) : null, (a, b) => a < b, v => 'the Colossus felled in ' + v6Clock(v))]);
  },
});

function coloStart(run) {
  const heroes = cv6Heroes(), n = heroes.length, k = (1 + .55 * (n - 2)) * roundLenMul(), part = (name, color, hp, [x, y]) => Object.assign(cv6Part({ team: 1, name, color, hp, x, y }), { dmgTakenMul: COLO_TAKEN });
  Object.assign(run, { n, t: 0, phase: 1, next: 3, atk: null, waves: [], vent: 0, open: 0, droneT: 0, coreY: COLO.core[1], won: false, dk: COLO_DIFF[modeDiff()] || 1 });
  run.arms = [0, 1].map(i => ({ i, x: COLO.rest[i][0], y: COLO.rest[i][1], state: 'idle', t: 0, tx: 0, part: part(i ? 'RIGHT CANNON' : 'LEFT CANNON', '#ff8a2e', COLO_HP.cannon * k, COLO.rest[i]) }));
  run.core = part('CORE', '#ff5ad1', COLO_HP.core * k, COLO.core);
  run.core.inv = 1e9;  // shielded until both cannons break: then the pool is exactly half
  run.ctl = bossPhases([run.arms[0].part, run.arms[1].part, run.core], [
    { at: .5, name: 'CORE EXPOSED', sub: 'The chest opens: smash the glowing core!', color: '#ff5ad1', enter: () => coloPhase(run, 2) },
    { at: .25, name: 'OVERLOAD', sub: 'It is coming apart: debris falls!', color: '#ff4a6a', fx: [['rain', { every: 1.5, dmg: Math.round(8 * run.dk), radius: 60, color: '#ff8a2e' }]], enter: () => coloPhase(run, 3) }]);
  heroes.forEach((f, i) => partyPlace(f, 640 + (i - (n - 1) / 2) * 170, MAP.floor));
  banner('THE COLOSSUS', 'BREAK ITS ARM CANNONS!', 2.4, '#ff8a2e');
}
function coloPhase(run, p) {
  run.phase = p; run.core.inv = 1; run.atk = null; run.next = 2.2;
  coloDrones(run, run.n - 1 + (p === 3));
}
function coloBreak(a) {
  a.broken = true;
  if (a.zone) a.zone.dead = true;
  burst(a.x, a.y, '#ff8a2e', 40, 520); ring(a.x, a.y, 120, '#ffd84a', .5, 6); shake(14); sfx('boom'); flashScreen('#ff8a2e', .15);
  float(a.x, a.y - 60, 'CANNON DESTROYED!', '#ffd84a', 26);
}
function coloStep(run, dt) {
  if (!run.arms) return;
  for (const a of run.arms) coloArm(run, a, dt);
  run.coreY = lerp(run.coreY, COLO.core[1] + (run.vent > 0 ? 80 : 0), Math.min(1, dt * 4));
  if (F.includes(run.core)) cv6Pin(run.core, COLO.core[0], run.coreY);
  if (!partyLive()) return;
  run.t += dt; run.vent -= dt; run.droneT -= dt;
  if (run.phase > 1) run.open = Math.min(1, run.open + dt * 1.5);
  partyTickRespawns(run, dt, old => partyRespawn(old, old.id % 2 ? 880 : 400, MAP.floor));
  for (const d of F) if (d.v6fly && d.alive) cv6Fly(d, dt);
  coloAttack(run, dt);
  coloWaves(run, dt);
  coloDodge(run);
  if (!F.includes(run.core)) return coloWin(run);
  if (!cv6Heroes().some(f => f.alive) || G_STATE.roundT >= G_STATE.roundLimit) partyEnd(1, 'wipe', G_STATE.roundT >= G_STATE.roundLimit ? 'TIME!' : 'WIPED OUT', 'THE COLOSSUS STANDS', '#ff4a6a');
}
// The slam: raise over the target (the warning), fall, rest on the floor, return.
function coloArm(run, a, dt) {
  const [rx, ry] = COLO.rest[a.i], k = Math.min(1, dt * 5);
  a.t += dt;
  if (a.broken) { a.x = lerp(a.x, rx + (a.i ? 50 : -50), dt * 2); a.y = lerp(a.y, 575, dt * 2); }
  else if (a.state === 'raise') { a.x = lerp(a.x, a.tx, k); a.y = lerp(a.y, 150, k); if (a.t >= COLO_RAISE) coloSet(a, 'fall'); }
  else if (a.state === 'fall') { a.y += 2600 * dt; if (a.y >= 600) { a.y = 600; coloImpact(run, a.x); coloSet(a, 'rest'); } }
  else if (a.state === 'rest') { if (a.t >= COLO_REST) coloSet(a, 'back'); }
  else {
    const kb = a.state === 'back' ? Math.min(1, dt * 3) : k;
    a.x = lerp(a.x, rx, kb); a.y = lerp(a.y, ry + Math.sin(G_STATE.t * 1.6 + a.i * 2) * 10, kb);
    if (a.state === 'back' && a.t > .9) coloSet(a, 'idle');
  }
  if (F.includes(a.part)) cv6Pin(a.part, a.x, a.y);
}
function coloAttack(run, dt) {
  const a = run.atk;
  if (a) {
    a.t += dt;
    if (a.kind === 'laser') coloLaser(run, a);
    else if (a.kind === 'shot' && a.t >= .75) coloFire(run, a.arm);
    else if (a.kind === 'stomp' && a.t >= .9) { coloImpact(run, W / 2); run.atk = null; run.next = coloGap(run); }
    else if (a.kind === 'slam' && (a.arm.state === 'idle' || a.arm.broken)) { run.atk = null; run.next = coloGap(run); }
    return;
  }
  if ((run.next -= dt) > 0) return;
  const armed = run.arms.filter(x => !x.broken), go = (kind, arm, o) => { run.atk = Object.assign({ kind, arm, t: 0 }, o); sfx('charge', kind === 'shot' ? .5 : .8); };
  if (run.phase === 1 && armed.length) { const arm = pick(armed); return chance(.45) ? coloSlam(run, arm, go) : go('shot', arm); }
  if (run.droneT <= 0 && F.filter(d => d.v6fly && d.alive).length < run.n) { run.droneT = 14; run.next = 1.5; return coloDrones(run, run.n - 1); }
  const l = chance(.5);
  if (chance(.6)) go('laser', null, { x0: l ? 70 : W - 70, x1: l ? W - 70 : 70, hit: new Set() });
  else { go('stomp'); skillZone({ owner: run.core, x: W / 2, y: 540, life: 1.2, danger: 120 }); }  // CPUs step out
}
function coloSlam(run, a, go) {
  const half = a.i ? [700, 1190] : [90, 580], foes = cv6Heroes().filter(f => f.alive && f.P[2].x > half[0] - 60 && f.P[2].x < half[1] + 60);
  a.tx = clamp(foes.length ? pick(foes).P[2].x : (half[0] + half[1]) / 2, half[0], half[1]);
  coloSet(a, 'raise');
  a.zone = skillZone({ owner: run.core, x: a.tx, y: MAP.floor, life: COLO_RAISE + .3, danger: 120 });  // CPUs step out
  go('slam', a);
}
// The fist hurts anyone under it, ledges too (no safe camping); a shockwave rolls both ways along the floor.
function coloImpact(run, x) {
  const fl = MAP.floor;
  shake(18); sfx('slam'); burst(x, fl - 4, '#ff8a2e', 30, 480, { grav: 1 }); ring(x, fl, 140, '#ff8a2e', .4, 6);
  for (const e of cv6Heroes()) if (e.alive && Math.abs(e.P[2].x - x) < 100 && feetY(e) > fl - 210) damage(e, 15 * run.dk, { src: run.core, kind: 'skill', nx: Math.sign(e.P[2].x - x) || 1, ny: -1, kb: 620, color: '#ff8a2e' });
  for (const dir of [-1, 1]) run.waves.push({ x, dir, t: 0, hit: new Set() });
}
function coloWaves(run, dt) {
  const fl = MAP.floor;
  for (const w of run.waves) {
    w.t += dt; w.x += w.dir * 560 * dt;
    for (const e of cv6Heroes()) if (e.alive && !w.hit.has(e) && Math.abs(feetY(e) - fl) < 34 && Math.abs((e.P[8].x + e.P[10].x) / 2 - w.x) < 30) {
      w.hit.add(e); damage(e, 9 * run.dk, { src: run.core, kind: 'skill', nx: w.dir, ny: -1, kb: 520, color: '#ffd84a' });
    }
  }
  run.waves = run.waves.filter(w => w.t < 1.6 && w.x > -40 && w.x < W + 40);
}
// The cannon blasts the nearest hero at range; heroes hugging it are swatted off instead (no damage).
function coloFire(run, arm) {
  const heroes = cv6Heroes().filter(f => f.alive), far = f => dist(chest(f), arm) > 150, foe = heroes.filter(far).sort((p, q) => dist(chest(p), arm) - dist(chest(q), arm))[0];
  const c = foe && chest(foe), d = c && dist(c, arm);
  run.atk = null; run.next = coloGap(run) * .7;
  if (arm.broken) return;
  for (const e of heroes) if (!far(e)) { for (const p of e.P) kick(p, (Math.sign(e.P[2].x - arm.x) || 1) * 480, -300); float(e.P[0].x, e.P[0].y - 40, 'SWAT!', '#ffd84a', 20); }
  if (!foe) return sfx('slam', .5);
  spawnProj({ owner: arm.part, x: arm.x, y: arm.y, vx: (c.x - arm.x) / d * 540, vy: (c.y - arm.y) / d * 540, r: 11, dmg: 9 * run.dk, explode: 60, kb: 420, life: 2.5, color: '#ff8a2e' });
  sfx('boom', .4);
}
// The floor laser sweeps after its aiming line; then the core sinks to vent.
function coloLaser(run, a) {
  const k = (a.t - COLO_AIM) / COLO_SWEEP, fl = MAP.floor;
  if (k < 0) return;
  if (!a.ix) sfx('v6-laser');
  if (k >= 1) { run.atk = null; run.next = coloGap(run); run.vent = 2.6; return; }
  a.ix = lerp(a.x0, a.x1, k);
  for (const e of cv6Heroes()) if (e.alive && !a.hit.has(e) && Math.abs(e.P[2].x - a.ix) < 36 && feetY(e) > fl - 80) {
    a.hit.add(e); damage(e, 12 * run.dk, { src: run.core, kind: 'skill', nx: Math.sign(a.x1 - a.x0), ny: -1, kb: 460, status: ['burn', 2, 1], color: '#ff4a6a' });
  }
}
function coloDrones(run, n) {
  for (let k = 0; k < Math.max(1, n); k++) cv6Drone(run.core, 640 + (k % 2 ? 1 : -1) * (70 + k * 30), 280, { hp: .3 * (1 + .3 * (run.n - 2)) });
  float(640, 220, 'DRONES!', '#ff5ad1', 26);
}
// CPU heroes jump shockwaves and the laser (better levels more often).
function coloDodge(run) {
  const fl = MAP.floor, a = run.atk, ix = a && a.kind === 'laser' ? a.ix : null;
  for (const f of cv6Heroes()) {
    if (!f.alive || !aiBrain(f) || !f.grounded || Math.abs(feetY(f) - fl) > 12 || (f.mem.coloJ || 0) > G_STATE.t) continue;
    const x = f.P[2].x;
    if (!run.waves.some(w => (x - w.x) * w.dir > 0 && Math.abs(w.x - x) < 110) && !(ix != null && Math.abs(ix - x) < 120 && (x - ix) * (a.x1 - a.x0) > 0)) continue;
    f.mem.coloJ = G_STATE.t + .8;
    if (chance(COLO_DODGE[f.aiLevel || modeDiff()] ?? .75)) f.inp.jump = true;
  }
}
// CPU heroes: a resting cannon, else a cannon's ledge; later the core's ledge.
function coloAiGoal(run, f) {
  if (!run.arms) return null;
  if (run.phase > 1) return { x: 640 + (f.id % 2 ? 50 : -50), y: 446, w: 140 };
  const live = run.arms.filter(a => !a.broken), me = f.P[2].x, a = live.find(x => x.state === 'rest') || live.sort((p, q) => Math.abs(p.x - me) - Math.abs(q.x - me))[0];
  return !a ? null : a.state === 'rest' ? { x: a.x + (a.i ? -50 : 50), y: MAP.floor, w: 60 } : { x: a.i ? 1010 : 270, y: 500, w: 120 };
}
function coloWin(run) {
  if (G_STATE.ending) return;
  run.won = true;
  for (let k = 0; k < 6; k++) burst(rnd(420, 860), rnd(160, 560), pick(['#ff8a2e', '#ff5ad1', '#ffd84a']), 30, 560);
  ring(640, 330, 260, '#ffd84a', .7, 10); shake(30); slowmo(1.2); flashScreen('#ffd84a', .3); sfx('boom', 1.5); sfx('cheer');
  partyEnd(0, 'boss', 'COLOSSUS DOWN!', 'THE HEROES WIN', '#ffd84a');
}

function coloHud(c, run) {
  if (!run.ctl) return;
  const w = Math.min(760, VIEW.hudW - 80), x = (W - w) / 2, y = H - 50, col = run.phase > 1 ? '#ff5ad1' : '#ff8a2e', left = run.arms.filter(a => !a.broken).length;
  modeBigBar(c, x, y, w, bossPhaseFrac(run.ctl), col, 'THE COLOSSUS' + (run.phase === 3 ? '  ·  OVERLOAD' : ''));
  bossPhaseMarks(c, x, y, w, run.core);
  modeText(c, run.phase === 1 ? `Break the arm cannons: ${left} left` : 'Smash the glowing core!', W / 2, PARTY_HUD_Y, 17, col, 'center', v6Body);
  partyDrawRespawns(c, run, PARTY_HUD_Y + 26);
}
function coloMark(c, f, x, y, col) {
  if (!col) return modeText(c, '🔒', x, y, 24, '#c9cdee');
  const r = 46 * (1 + .08 * Math.sin(G_STATE.t * 8));
  c.strokeStyle = rgba(col, .85); c.lineWidth = 3; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + G_STATE.t; lineXY(c, x + Math.cos(a) * (r - 8), y + Math.sin(a) * (r - 8), x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8), col, 3); }
  mapRect(c, 'rgba(0,0,0,.65)', x - 42, y - r - 20, 84, 9); mapRect(c, col, x - 41, y - r - 19, 82 * clamp(f.hp / f.maxHp, 0, 1), 7);
}
function coloDrawFx(c, run) {
  if (!run.arms) return;
  const fl = MAP.floor, a = run.atk, t = G_STATE.t, warn = .45 + .35 * Math.sin(t * 18), [ex, ey] = COLO.eye;
  for (const arm of run.arms) {
    if (arm.state === 'raise' && !arm.broken) {
      c.globalAlpha = warn * .5; mapRect(c, '#ff4a6a', arm.tx - 90, 120, 180, fl - 120); c.globalAlpha = 1;
      c.strokeStyle = '#ff4a6a'; c.lineWidth = 4; c.beginPath(); c.ellipse(arm.tx, fl - 2, 100, 14, 0, 0, TAU); c.stroke();
    }
    if (!arm.broken && F.includes(arm.part)) coloMark(c, arm.part, arm.x, arm.y, '#ff8a2e');
  }
  if (F.includes(run.core)) coloMark(c, run.core, COLO.core[0], run.coreY, run.phase > 1 ? '#ff5ad1' : null);
  for (const w of run.waves) glow(c, '#ffd84a', 16, () => { c.strokeStyle = rgba('#ffd84a', 1 - w.t / 1.6); c.lineWidth = 6; c.beginPath(); c.arc(w.x, fl, 34, Math.PI, 0); c.stroke(); });
  if (!a) return;
  if (a.kind === 'shot' && !a.arm.broken) glow(c, '#ff8a2e', 20, () => circle(c, a.arm.x, a.arm.y, 8 + a.t * 26, rgba('#ffd84a', .5 + a.t * .5)));
  if (a.kind === 'stomp') { c.globalAlpha = warn * .5; mapRect(c, '#ff4a6a', W / 2 - 100, 120, 200, fl - 120); c.globalAlpha = 1; modeText(c, '! STOMP !', W / 2, fl - 60, 22, '#ff4a6a'); }
  if (a.kind === 'laser' && a.t < COLO_AIM) {
    c.setLineDash([14, 10]); lineXY(c, a.x0, fl - 6, a.x1, fl - 6, rgba('#ff4a6a', warn), 4); c.setLineDash([]);
    modeText(c, a.x1 > a.x0 ? 'LASER ▶▶' : '◀◀ LASER', a.x0 + (a.x1 > a.x0 ? 80 : -80), fl - 34, 22, '#ff4a6a');
  } else if (a.kind === 'laser' && a.ix) {
    glow(c, '#ff4a6a', 24, () => { lineXY(c, ex, ey, a.ix, fl, '#ff4a6a', 14); lineXY(c, ex, ey, a.ix, fl, '#ffe0e0', 4); });
    circle(c, a.ix, fl - 6, 30 + Math.sin(t * 50) * 4, rgba('#ffd84a', .7));
  }
}
// The Colossus behind the arena (asleep outside the raid).
function coloDrawBody(c, t) {
  const run = v6Mode('raid') && c === ctx ? modeRun() : {}, live = !!run.arms, fl = MAP.floor ?? 650, coreY = live ? run.coreY : COLO.core[1];
  const sink = coreY - COLO.core[1], open = live ? run.open : 0, lit = live && run.phase > 1, charge = live && run.atk && run.atk.kind === 'laser' ? Math.min(1, run.atk.t / COLO_AIM) : 0;
  mapSky(c, fl, ['#12060f', '#3a0f22', '#7a2a1c']);
  for (let k = 0; k < 5; k++) mapRect(c, '#1a0c14', 40 + k * 300, fl - 330 - mapHash(k) * 140, 46, 420);
  c.lineCap = c.lineJoin = 'round';
  poly(c, [[400, fl + 40], [430, 210 + sink], [850, 210 + sink], [880, fl + 40]], '#2a1622', '#ff8a2e', 3);
  poly(c, [[560, 66], [720, 66], [740, 170], [540, 170]], '#2a1622', '#ff8a2e', 3);
  glow(c, '#ff4a6a', 10 + charge * 30, () => circle(c, COLO.eye[0], COLO.eye[1], 13 + charge * 8, live ? '#ff4a6a' : '#5a2030'));
  for (let i = 0; i < 2; i++) {
    const [sx, sy] = COLO.shoulder[i], a = live ? run.arms[i] : { x: COLO.rest[i][0], y: COLO.rest[i][1] };
    const ex = (sx + a.x) / 2 + (i ? 70 : -70), ey = (sy + a.y) / 2 + 50, edge = a.broken ? '#6a3a3a' : '#ff8a2e';
    for (const [w, col] of [[50, edge], [42, '#3a2030']]) { lineXY(c, sx, sy + sink, ex, ey, col, w); lineXY(c, ex, ey, a.x, a.y, col, w - 8); }
    circle(c, sx, sy + sink, 40, '#2a1622', edge, 3);
    poly(c, [[a.x - 34, a.y - 26], [a.x + 34, a.y - 26], [a.x + 26, a.y + 30], [a.x - 26, a.y + 30]], '#3a2030', edge, 3);
    circle(c, a.x, a.y + 30, 12, a.broken ? '#2a1a1a' : '#ffd84a');
    if (a.broken) for (let k = 0; k < 3; k++) circle(c, a.x + Math.sin(t * 9 + k * 2) * 20, a.y - 20 + k * 10, 2.5, '#ffd84a');
  }
  glow(c, lit ? '#ff5ad1' : '#5a2a40', lit ? 30 : 6, () => circle(c, COLO.core[0], coreY, 36 + (lit ? Math.sin(t * 6) * 4 : 0), lit ? '#ff9ae6' : '#3a1a2a', '#ffffff', 2));
  for (const d of [-1, 1]) { const x0 = 640 + d * (6 + open * 74), x1 = 640 + d * (60 + open * 74); poly(c, [[x0, coreY - 52], [x1, coreY - 52], [x1, coreY + 52], [x0, coreY + 52]], '#3a2030', '#ff8a2e', 3); }
  mapGround(c, fl, ['#2a1a20', '#120a10'], '#ff8a2e', 3);
}

// ---------- Defend the Core ----------
// Invaders storm the core from both gates; survive the clock, with a final rush at the end. Scales with the heroes.
const VAULT_CORE = [640, 588], VAULT_HP = 760, VAULT_RUSH = 30;
const VAULT_KINDS = {
  husk: { name: 'HUSK', color: '#9d7dff', hp: .32 },
  skitter: { name: 'SKITTER', color: '#c8ff3a', hp: .22, speed: 1.3, level: 1 },
  blastling: { name: 'BLASTLING', color: '#ff8a2e', hp: .3, speed: .9, bomb: true },
  drone: { name: 'DRONE', color: '#ff5ad1', hp: .26, fly: true },
  brute: { name: 'GLOAM BRUTE', color: '#ff4a6a', hp: .9, scale: 1.4, weapons: ['hammer', 'mace', 'battle-axe'] },
};
const VAULT_WAVES = [['husk'], ['husk', 'skitter'], ['husk', 'skitter', 'blastling'], ['husk', 'skitter', 'blastling', 'drone'],
  ['skitter', 'blastling', 'drone', 'brute', 'husk'], ['brute', 'blastling', 'drone', 'skitter', 'husk', 'husk']];  // last: the rush

defMap('corevault', {
  name: 'The Core Vault', hidden: true, desc: 'A crystal vault with a gate at each end. Defend the Core sets a core in the middle.',
  floor: 650, maxOrbs: 1, weather: false,
  palette: { sky1: '#050b18', sky2: '#0e2a3a', ground: '#0b1a24', line: '#5ef2ff', accent: '#7dffcf', solid: '#10283a' },
  solids: [{ x: 120, y: 480, w: 250 }, { x: 910, y: 480, w: 250 }, { x: 500, y: 330, w: 280 }],
  spawns: [[460, 650], [820, 650], [300, 650], [980, 650]], frame: cv6Frame,
  drawBg(c, t) { vaultDrawBg(c, t); },
});

v6Def('defend', {
  name: 'Defend the Core', icon: '💎', order: 54, duo: 'coop', roundLimit: 180, noScore: true, aiArmor: false, respawn: 4, ownMap: 'corevault',
  desc: 'Guard a crystal core through 3 minutes of growing waves. Grab repair orbs and survive the final rush.',
  setup(cfg) { return { roster: cv6Roster(cfg, partyCrowd(cfg, this), 1), map: 'corevault', run: { dead: {} } }; },
  roundLabel() { const run = modeRun(); return run.rush ? 'FINAL RUSH' : `DEFEND · WAVE ${run.wave || 1}`; },
  onRoundStart() { vaultStart(modeRun()); },
  onStep(dt) { vaultStep(modeRun(), dt); },
  aiGoal(f) { return vaultAiGoal(modeRun(), f); },
  drawWorld(c) { vaultDrawFx(c, modeRun()); },
  hud(c) { vaultHud(c, modeRun()); },
  v6Fallen(B) { const run = modeRun(); if (B.v6inv) run.kills++; if (B.v6bomb) vaultBoom(B); },
  results() {
    const run = modeRun(), won = !!run.won, held = Math.min(G_STATE.roundT, G_STATE.roundLimit);
    return cv6Result(won, 'CORE SAVED!', 'The core shattered', '#5ef2ff', [
      `${won ? 'Held for the full' : 'Held for'} ${v6Clock(held)}: ${run.kills} invaders destroyed, ${run.repairs} repairs (${levelName(modeDiff())}).`,
      cv6Best('vault', won ? 1000 + run.kills : Math.round(held), (a, b) => a > b, v => v >= 1000 ? `the core saved, ${v - 1000} invaders down` : 'held for ' + v6Clock(v))]);
  },
});

function vaultStart(run) {
  const heroes = cv6Heroes(), n = heroes.length;
  Object.assign(run, { n, k: 1 + .45 * (n - 2), wave: 1, rush: false, spawnT: 2.5, repairT: 18, orb: null, kills: 0, repairs: 0, won: false });
  run.core = cv6Part({ team: 0, name: 'CORE', color: '#5ef2ff', hp: VAULT_HP * run.k * roundLenMul(), x: VAULT_CORE[0], y: VAULT_CORE[1], scale: 1.6 });
  heroes.forEach((f, i) => partyPlace(f, 640 + (i % 2 ? 1 : -1) * (140 + (i >> 1) * 120), MAP.floor));
  banner('DEFEND THE CORE', `HOLD OUT FOR ${v6Clock(G_STATE.roundLimit)}`, 2.4, '#5ef2ff');
}
function vaultStep(run, dt) {
  if (!run.core) return;
  if (F.includes(run.core)) cv6Pin(run.core, ...VAULT_CORE);
  if (!partyLive()) return;
  if (!F.includes(run.core)) return partyEnd(1, 'core', 'THE CORE SHATTERED', 'THE VAULT FALLS', '#ff4a6a');
  const L = G_STATE.roundLimit, t = G_STATE.roundT, n = VAULT_WAVES.length, wave = L - t <= VAULT_RUSH ? n : Math.min(n - 1, 1 + Math.floor(t / ((L - VAULT_RUSH) / (n - 1))));
  if (wave !== run.wave) {
    run.wave = wave; run.rush = wave === n;
    banner(run.rush ? 'FINAL RUSH!' : 'WAVE ' + wave, run.rush ? 'HOLD THE LINE!' : 'MORE ARE COMING', 1.6, run.rush ? '#ff4a6a' : '#5ef2ff'); sfx('round');
  }
  partyTickRespawns(run, dt, old => partyRespawn(old, 640 + (old.id % 2 ? 110 : -110), MAP.floor));
  for (const d of F) if (d.v6fly && d.alive) cv6Fly(d, dt);
  if ((run.spawnT -= dt) <= 0) {
    run.spawnT = (run.rush ? 1.8 : lerp(3.4, 2, wave / n)) / run.k;
    if (F.filter(f => f.v6inv && f.alive).length < Math.min(7, 1 + wave + run.n)) vaultInvader(run, pick(VAULT_WAVES[wave - 1]), chance(.5) ? 1 : 0);
  }
  for (const f of F) if (f.v6bomb && f.alive && F.some(o => o.team === 0 && o.alive && dist(chest(o), chest(f)) < (o === run.core ? 90 : 60))) { vaultBoom(f); decoyDismiss(f); }
  vaultRepair(run, dt);
  if (t >= L) { run.won = true; partyEnd(0, 'time', 'CORE SAVED!', 'THE VAULT HOLDS', '#5ef2ff'); }
}
function vaultInvader(run, kind, side) {
  const z = VAULT_KINDS[kind], x = side ? W - 26 : 26, hp = z.hp * run.k * (run.rush ? 1.1 : 1);
  const lv = AI_ORDER[clamp(AI_ORDER.indexOf(modeDiff()) - 1 + (z.level || 0) + (run.wave > 4), 0, AI_ORDER.length - 1)];
  const f = z.fly ? cv6Drone(null, x, 240, { color: z.color, hp, level: lv }) : cv6Summon({ color: z.color, name: z.name, scale: z.scale || 1, hpMul: hp, aiLevel: lv,
    weapon: z.weapons ? modeWeapon(z.weapons, ['heavy']) : z.bomb ? 'fists' : resolveWeapon('random'), face: side ? -1 : 1, x, y: MAP.floor }, { spdMul: z.speed || 1, v6bomb: !!z.bomb });
  f.v6inv = kind;
  ring(x, z.fly ? 240 : MAP.floor - 60, 60, z.color, .4, 4);
}
// A blastling's blast hurts heroes and core alike.
function vaultBoom(f) { const c = chest(f); f.v6bomb = false; explode(c.x, c.y, 120, 14, f, { color: '#ff8a2e', kb: 640 }); }
// A repair orb every ~20 s; a hero's touch heals the core 15%.
function vaultRepair(run, dt) {
  const o = run.orb;
  if (!o) {
    if ((run.repairT -= dt) > 0) return;
    const sp = [0, 1, 2, 3, 4, 5].map(() => orbSpot()).find(s => s && Math.abs(s.x - 640) > 200);
    if (sp) { run.orb = { x: sp.x, y: -30, gy: sp.y + 42, t: 0 }; float(sp.x, 160, 'REPAIR ORB!', '#7dffcf', 22); } else run.repairT = 2;
    return;
  }
  o.t += dt; o.y = Math.min(o.y + 260 * dt, o.gy - 30);
  const f = cv6Heroes().find(h => h.alive && h.P.slice(0, 11).some(p => Math.hypot(p.x - o.x, p.y - o.y) < 36));
  if (f) {
    heal(run.core, run.core.maxHp * .15); run.repairs++;
    ring(o.x, o.y, 60, '#7dffcf', .4, 4); burst(o.x, o.y, '#7dffcf', 24, 320); float(o.x, o.y - 40, 'CORE REPAIRED', '#7dffcf', 20); sfx('heal');
  }
  if (f || o.t > 14) { run.orb = null; run.repairT = rnd(18, 24); }
}
// Invaders head for the core; CPU heroes fetch repair orbs or guard the busier side.
function vaultAiGoal(run, f) {
  const o = run.orb, side = F.reduce((s, e) => s + (e.v6inv && e.alive ? Math.sign(e.P[2].x - 640) : 0), 0);
  if (!run.core) return null;
  if (f.team) return { x: 640 + (f.id % 2 ? 46 : -46), y: MAP.floor, w: 120 };
  if (o && run.core.hp < run.core.maxHp * .75 && cv6Heroes().filter(h => h.alive && aiBrain(h)).sort((a, b) => Math.abs(a.P[2].x - o.x) - Math.abs(b.P[2].x - o.x))[0] === f) return { x: o.x, y: o.gy, w: 30 };
  return { x: 640 + (Math.abs(side) < 2 ? (f.id % 2 ? 1 : -1) : Math.sign(side)) * 170, y: MAP.floor, w: 220 };
}
function vaultHud(c, run) {
  if (!run.core) return;
  const w = Math.min(560, VIEW.hudW - 140), y = PARTY_HUD_Y - 6, frac = run.core.hp / run.core.maxHp, left = Math.max(0, G_STATE.roundLimit - G_STATE.roundT);
  modeBigBar(c, (W - w) / 2, y, w, frac, frac < .3 ? '#ff4a6a' : '#5ef2ff', 'CRYSTAL CORE');
  modeText(c, `${run.rush ? 'FINAL RUSH' : `WAVE ${run.wave} of ${VAULT_WAVES.length - 1}`}  ·  ${v6Clock(left)}  ·  ${run.kills} destroyed`, W / 2, y + 38, 16, run.rush ? '#ff4a6a' : '#c9cdee', 'center', v6Body);
  if (run.orb) modeText(c, '✚ A repair orb is down: touch it to heal the core', W / 2, y + 60, 14, '#7dffcf', 'center', v6Body);
  partyDrawRespawns(c, run, y + 82);
}
function vaultDrawFx(c, run) {
  const o = run.orb, t = G_STATE.t, oy = o && o.y + Math.sin(t * 4) * 4;
  if (o) {
    c.globalAlpha = .25; mapRect(c, '#7dffcf', o.x - 3, 0, 6, o.y); c.globalAlpha = 1;
    glow(c, '#7dffcf', 18, () => circle(c, o.x, oy, 15, '#0b2a24', '#7dffcf', 3));
    modeText(c, '✚', o.x, oy, 18, '#7dffcf');
  }
  for (const f of F) if (f.v6bomb && f.alive) { const p = f.P[0]; circle(c, p.x, p.y - 26, 9, '#1a0d00', '#ff8a2e', 2); circle(c, p.x + 5, p.y - 36, 3 + Math.sin(t * 30), '#ffd84a'); }
}
// The vault; the core cracks as it is hurt.
function vaultDrawBg(c, t) {
  const run = v6Mode('defend') && c === ctx ? modeRun() : {}, fl = MAP.floor ?? 650, core = run.core, frac = core ? clamp(core.hp / core.maxHp, 0, 1) : 1;
  const [cx, cy] = VAULT_CORE, col = skillMixColor('#ff4a6a', '#5ef2ff', frac), bob = Math.sin(t * 2) * 3;
  mapSky(c, fl, ['#050b18', '#0a1c2c', '#0e2a3a']);
  for (const x of [0, W - 46]) { mapRect(c, '#0b1a24', x, fl - 200, 46, 200); glowLine(c, x ? x : 46, fl - 200, x ? x : 46, fl, '#ff4a6a', 3); }
  mapGround(c, fl, ['#0b1a24', '#050b12'], '#5ef2ff', 3);
  poly(c, [[cx - 70, fl], [cx - 50, fl - 22], [cx + 50, fl - 22], [cx + 70, fl]], '#10283a', '#5ef2ff', 2);
  if (core && !F.includes(core)) return;
  glow(c, col, 26, () => poly(c, [[cx, cy - 84 + bob], [cx + 40, cy - 30 + bob], [cx + 30, cy + 40], [cx - 30, cy + 40], [cx - 40, cy - 30 + bob]], rgba(col, .55), '#ffffff', 2.5));
  for (let k = 0; k < Math.round((1 - frac) * 6); k++) lineXY(c, cx + (mapHash(k) - .5) * 50, cy - 50 + k * 14, cx + (mapHash(k + 9) - .5) * 60, cy - 36 + k * 14, '#ffffff', 1.5);
}

// ---------- boot: rules, lore ----------
Object.assign(V6.help, {
  raid: [
    'Break both arm cannons: from the side ledges, or while a fist rests on the floor after a slam.',
    'A red column means a slam: get out (ledges too), then jump the shockwave.',
    'Then smash the core from the middle ledge. Jump the floor laser; after it, the core sinks low.',
    'Shoot down the drones. Heroes are back in 5 s, but if everyone is down at once the raid fails.'],
  defend: [
    'Invaders come through both gates, and drones over the walls, to smash the core.',
    'Stop orange Blastlings early: they explode beside the core.',
    'Touch green repair orbs to heal the core. Fallen heroes are back beside it in 4 s.',
    'Survive 3 minutes (Short 2:06, Long 4:48); the last 30 seconds are the final rush.'],
});
on('boot', () => {
  Object.assign(LORE_LINES.m, {
    colossus: 'Forged in the Neon Foundry to carry the Great Candle, the Colossus was left to rust when it grew a temper. It wakes for anyone loud enough.',
    corevault: 'Deep under the Crystal Court a shard of the Candle hums in its vault. Whatever crawls out of the Shadow Depths wants it.',
  });
  LORE_LINES.w['drone-blaster'] = 'The Colossus builds its drones from rivets and spite, each with a little blaster aimed at anything that glows.';
});
