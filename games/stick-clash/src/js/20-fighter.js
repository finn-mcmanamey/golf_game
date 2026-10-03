// 20-fighter.js: building fighters (body + weapon rigs), driving them (move, jump, dash, attack, skills, ranged aim),
// teams, and status effects. Body points: 0 head, 1 neck, 2 hip, 3/4 back elbow/hand, 5/6 weapon elbow/hand,
// 7/8 and 9/10 knee/foot. Weapon points follow from index 11.

const BODY_LINKS = [[0, 1], [1, 2], [1, 3], [3, 4], [1, 5], [5, 6], [2, 7], [7, 8], [2, 9], [9, 10]];
const BODY_POSE = [[0, -152], [0, -130], [0, -80], [-8, -106], [-12, -84], [12, -110], [30, -104], [-6, -40], [-12, 0], [8, -40], [14, 0]];
const HEAD_R = 14, LIMB_R = 6;
// Hurt shapes: the head circle plus a capsule per limb (radii scale with the fighter).
const HIT_SHAPES = [{ a: 0, b: 0, r: HEAD_R, head: true }, ...BODY_LINKS.map(([a, b]) => ({ a, b, r: LIMB_R }))];
const UPPER_BODY = [0, 1, 2, 3, 4], KNEES = [7, 9];

// ---------- building ----------
// o: { id, team, ctrl, slot, x, y (feet), face, weapon, skills, color, hat, name, scale, hpMul, autopilot, aiLevel }
function makeFighter(o) {
  const scale = o.scale || 1, face = o.face || 1, id = o.id || 0;
  const maxHp = Math.round(100 * (o.hpMul || 1) * scale);
  const f = {
    id, team: o.team ?? id, ctrl: o.ctrl || 'cpu', slot: o.slot ?? 0, autopilot: !!o.autopilot, aiLevel: o.aiLevel || null,
    color: o.color || DEFAULT_COLORS[id % DEFAULT_COLORS.length], hat: o.hat || 'none', name: o.name || 'CPU ' + (id + 1), scale,
    P: BODY_POSE.map(([dx, dy]) => pt(o.x + dx * face * scale, o.y + dy * scale, scale)), L: [],
    face, hp: maxHp, maxHp, hpShow: maxHp, alive: true, koT: 0,
    skills: [0, 1].map(k => (o.skills && SKILLS[o.skills[k]]) ? o.skills[k] : null), skillCd: [0, 0], skillBuf: [0, 0],
    status: {}, immune: {}, mem: {},   // mem: per-round scratch space for weapons/skills, e.g. f.mem.myCharge
    ammo: 0, reload: 0, atkCd: 0, atkBuf: 0, jumpBuf: 0, jumpCd: 0, coyote: 0, airJumps: 1, rising: false,
    dashCd: 0, dashT: 0, stagger: 0, flash: 0, swingT: 0, phase: 0, aim: face > 0 ? 0 : Math.PI, gvx: 0, grounded: false,
    combo: 0, comboT: 0, hitCd: {}, lastHitBy: null, lastHitT: 0, inv: 0,
    inp: { mx: 0, my: 0, jump: false, jumpHeld: false, attack: false, attackHeld: false, skill1: false, skill2: false, dash: 0,
      blockHeld: false, block: false, grab: false, throw: false, super: false, mash: false },   // v3 actions (22-moves)
    ai: {}, stats: { dmgDealt: 0, dmgTaken: 0, hits: 0, kos: 0, skills: 0, jumps: 0, shots: 0, dashes: 0 },
    trail: [], upT: 0, aliveT: 0,
  };
  BODY_LINKS.forEach(([a, b]) => addLink(f, a, b));
  addLink(f, 0, 2);                                        // rigid spine
  addLink(f, 2, 8, { min: true, r: dist(f.P[2], f.P[8]) * .93 });   // legs can't fold flat
  addLink(f, 2, 10, { min: true, r: dist(f.P[2], f.P[10]) * .93 });
  addLink(f, 8, 10, { min: true, r: 14 * scale });                  // feet don't merge
  initFightingDepth(f, o);          // v3: class, stamina, super meter, throwables, weapon levels (22-moves)
  equipWeapon(f, o.weapon);
  return f;
}

// Builds one weapon as a chain of points out from a hand, held up and forward. Returns the rig.
function buildWeaponRig(f, def, handIdx, elbowIdx) {
  const s = f.scale, n = Math.max(1, def.chain | 0), hand = f.P[handIdx], len = def.len * s;
  const ux = .73 * f.face, uy = -.68;
  const rig = { w: def, ws: [], pts: [handIdx], links: [], hand: handIdx, elbow: elbowIdx, tip: handIdx };
  for (let k = 1; k <= n; k++) {
    f.P.push(pt(hand.x + ux * len * k / n, hand.y + uy * len * k / n, (k === n ? def.mass : .4) * s));
    const a = k === 1 ? handIdx : f.P.length - 2, b = f.P.length - 1, l = addLink(f, a, b, { weapon: true });
    l.rG = l.r * 1.5;                       // length while the giant status is active
    rig.ws.push([a, b]); rig.pts.push(b); rig.links.push(l);
  }
  rig.tip = f.P.length - 1;
  if (!def.chain && !def.ranged && def.stiff > 0) {   // soft elbow->tip link keeps a rigid weapon aligned with the forearm
    const l = addLink(f, elbowIdx, rig.tip, { k: def.stiff, weapon: true }), e = f.P[elbowIdx];
    l.rG = Math.hypot(hand.x + ux * len * 1.5 - e.x, hand.y + uy * len * 1.5 - e.y);
    rig.links.push(l);
  }
  return rig;
}

// Gives a fighter a weapon (also usable mid-round, e.g. by an orb or skill). The off-hand comes from def.offhand.
function equipWeapon(f, key) {
  const def = WEAPONS[key] || WEAPONS[Object.keys(WEAPONS)[0]];
  if (!def) { report(new Error('no weapons registered'), 'equipWeapon'); return; }
  f.P.length = BODY_POSE.length;
  f.L = f.L.filter(l => !l.weapon);
  f.w = def; f.wkey = def.key;
  f.main = buildWeaponRig(f, def, 6, 5);
  f.ws = f.main.ws; f.tip = f.main.tip;
  const offDef = def.offhand && WEAPONS[def.offhand];
  if (def.offhand && !offDef) report(new Error(`offhand "${def.offhand}" is not a registered weapon`), def.key);
  f.off = offDef ? buildWeaponRig(f, offDef, 4, 3) : null;
  f.ammo = ammoCap(f); f.reload = 0; f.atkCd = Math.max(f.atkCd, .15);
  hook(def, 'onEquip', f);
}

// Magazine size: the weapon's ammo, more for classes with an ammo bonus (Gunner).
const ammoCap = f => f.w && f.w.ranged ? Math.max(1, Math.round(f.w.ranged.ammo * (f.ammoMul || 1))) : 0;

// Both weapon rigs of a fighter (main first). Each has { w, ws, tip, pts, hand, elbow }.
// Read many times every step, so the list is cached on the fighter and rebuilt only when its rigs change.
function rigsOf(f) {
  const c = f.rigCache;
  if (c && c[0] === f.main && (c[1] || null) === f.off) return c;
  return (f.rigCache = f.off ? [f.main, f.off] : [f.main]);
}

// Shifts a whole fighter (keeping its velocity), e.g. for teleports.
function moveFighter(f, dx, dy) {
  for (const p of f.P) { p.x += dx; p.y += dy; p.ox += dx; p.oy += dy; }
}
const feetY = f => Math.max(f.P[8].y, f.P[10].y);

// ---------- teams ----------
const enemiesOf = f => F.filter(o => o !== f && o.team !== f.team);
const alliesOf = f => F.filter(o => o !== f && o.team === f.team);
const chest = f => ({ x: (f.P[1].x + f.P[2].x) / 2, y: (f.P[1].y + f.P[2].y) / 2 });
// Nearest living enemy by hip distance. visibleOnly skips invisible foes unless they are close.
function nearestEnemy(f, visibleOnly = false) {
  let best = null, bd = Infinity;
  for (const o of F) {
    if (o === f || o.team === f.team || !o.alive) continue;
    const d = dist(o.P[2], f.P[2]);
    if (visibleOnly && o.status.invis && d > 190) continue;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function aliveTeams() { return [...new Set(F.filter(f => f.alive).map(f => f.team))]; }

// ---------- status effects ----------
function addStatus(f, name, seconds, power = 1, src = null) {
  const def = STATUS[name];
  if (!def) { report(new Error(`unknown status "${name}"`), 'addStatus'); return null; }
  if (!f || !f.alive || !(seconds > 0)) return null;
  if (f.immune[name] > G_STATE.t) return null;     // brief immunity after it wore off: no stun-locks
  let s = f.status[name];
  if (s) { s.t = Math.min(def.max, Math.max(s.t, seconds)); s.power = Math.max(s.power, power); s.max = Math.max(s.max, s.t); }
  else {
    s = f.status[name] = { t: Math.min(def.max, seconds), max: Math.min(def.max, seconds), power, acc: 0, src };
    hook(def, 'onAdd', f, s);
  }
  if (src) s.src = src;
  emit('status', f, name, seconds);
  return s;
}
function removeStatus(f, name) {
  const s = f.status[name], def = STATUS[name];
  if (!s) return;
  delete f.status[name];
  if (def && def.immunity) f.immune[name] = G_STATE.t + def.immunity;
  hook(def, 'onEnd', f, s);
}
const hasStatus = (f, name) => !!f.status[name];

function tickStatus(f, dt) {
  const all = f.status;
  for (const name of Object.keys(all)) {
    if (!f.alive || f.status !== all) return;    // a tick can KO the fighter, which clears its statuses
    const s = all[name];
    if (!s) continue;
    s.t -= dt;
    hook(STATUS[name], 'tick', f, dt, s);
    if (s.t <= 0 && all[name] === s) removeStatus(f, name);
  }
}

// Damage over time, delivered in small chunks so the numbers stay readable.
function tickDot(f, dt, s, dps, color) {
  s.acc += dps * dt;
  if (s.acc >= 3) { const n = Math.floor(s.acc); s.acc -= n; damage(f, n, { kind: 'status', src: s.src, color, small: true }); }
}

defStatus('burn', { name: 'Burn', icon: '✹', color: '#ff7a2e', debuff: true, max: 8,
  tick(f, dt, s) {
    tickDot(f, dt, s, 6 * s.power, this.color);
    const p = pick(f.P);                                     // flames lick off random body points
    if (chance(dt * 18)) burst(p.x, p.y, chance(.5) ? '#ffb02e' : '#ff4a1a', 1, 90, { grav: -500 });
  } });
defStatus('poison', { name: 'Poison', icon: '☠', color: '#8dff4a', debuff: true, max: 12,
  tick(f, dt, s) {
    tickDot(f, dt, s, 3.5 * s.power, this.color);
    if (chance(dt * 6)) burst(f.P[0].x, f.P[0].y, this.color, 1, 50, { grav: -200 });
  } });
defStatus('freeze', { name: 'Frozen', icon: '❄', color: '#9fe8ff', debuff: true, max: 4, immunity: 1 });
defStatus('stun', { name: 'Stunned', icon: '✶', color: '#ffe066', debuff: true, max: 3, immunity: .6 });
defStatus('slow', { name: 'Slowed', icon: '▼', color: '#6aa8ff', debuff: true, max: 10 });
defStatus('rage', { name: 'Rage', icon: '✚', color: '#ff3d5a', max: 12 });
defStatus('haste', { name: 'Haste', icon: '»', color: '#ffd84a', max: 12 });
defStatus('regen', { name: 'Regen', icon: '+', color: '#5dff9a', max: 15,
  tick(f, dt, s) { heal(f, 6 * s.power * dt, false); } });
defStatus('invis', { name: 'Invisible', icon: '◌', color: '#c7b8ff', max: 10 });
defStatus('shield', { name: 'Shield', icon: '◆', color: '#7fd8ff', max: 30 });   // blocks the next `power` hits
defStatus('giant', { name: 'Giant', icon: '▲', color: '#ff5ad1', max: 12 });     // weapon grows 1.5x

function heal(f, amount, show = true) {
  if (!f.alive || amount <= 0) return;
  const before = f.hp;
  f.hp = Math.min(f.maxHp, f.hp + amount);
  if (show && f.hp - before >= 1) float(f.P[0].x, f.P[0].y - 34, '+' + Math.round(f.hp - before), '#5dff9a', 22);
}

// Multipliers from statuses and the weapon, used by drive and damage.
function moveMul(f) {
  const s = f.status;
  return (f.w.speed || 1) * (s.haste ? 1.45 : 1) * (s.slow ? .55 : 1) * (s.rage ? 1.12 : 1) * (s.freeze ? 0 : 1) * statusMul(f, 'moveMul') *
    (f.spdMul || 1) * (f.blocking ? BLOCK.moveMul : 1) * (f.holding ? .6 : 1) * mountMul(f, 'speed');   // v3: class, guard, carrying, mount
}
function cdMul(f) { const s = f.status; return (s.haste ? .65 : 1) * (s.slow ? 1.35 : 1) * (s.rage ? .85 : 1) * statusMul(f, 'cdMul'); }
function dmgMul(f) { const s = f.status; return (s.rage ? 1.35 : 1) * (s.giant ? 1.1 : 1) * statusMul(f, 'dmgMul') * (f.dmgCls || 1); }
function takenMul(f) { return (f.w.armor || 1) * (f.off ? f.off.w.armor || 1 : 1) * (f.status.freeze ? 1.25 : 1) * statusMul(f, 'takenMul') * mountMul(f, 'taken'); }
// Content statuses may set moveMul, cdMul, dmgMul or takenMul on their def (a number, or (f, s) => number).
function statusMul(f, field) {
  let m = 1;
  for (const name in f.status) {
    const v = STATUS[name] && STATUS[name][field];
    if (v != null) m *= typeof v === 'function' ? v(f, f.status[name]) : v;
  }
  return m;
}
const canAct = f => f.alive && G_STATE.lock <= 0 && !f.status.stun && !f.status.freeze && !f.status.ragdoll && !f.heldBy;

// ---------- driving (called every physics step) ----------
function spring(p, tx, ty, k, c) { p.fx += (tx - p.x) * k - vx(p) * c; p.fy += (ty - p.y) * k - vy(p) * c; }
// Feet chase a spot under the hip; damping is relative to the hip so legs keep up instead of dragging the body.
function footSpring(p, tx, lifting, hipVx) { p.fx += (tx - p.x) * 160 - (vx(p) - hipVx) * 12; if (lifting) p.fy -= PHYS.gravity * 2.8; }

function updateFacing(f) {
  if (f.status.stun || f.status.freeze) return;
  if (f.w.ranged) { f.face = Math.cos(f.aim) >= 0 ? 1 : -1; return; }
  const foe = nearestEnemy(f, true);
  if (foe) f.face = foe.P[2].x > f.P[2].x ? 1 : -1;
  else if (f.inp.mx) f.face = Math.sign(f.inp.mx);
}

// The body hangs like a puppet between a lifted head and weighted feet, so it stays upright but wobbles.
function driveBody(f, dt, grounded, locked) {
  if (f.status.ragdoll || f.heldBy) return;      // limp: thrown or held fighters just fall (22-moves moves held ones)
  const P = f.P, [head, neck, hip] = P, G = PHYS.gravity, s = f.scale, face = f.face;
  const up = (grounded ? 1 : .55) * (f.status.stun ? .45 : 1) * (f.stagger > 0 ? .75 : 1);
  head.fy -= G * 3.4 * up; neck.fy -= G * 2.2 * up; hip.fy -= G * 1.2 * up; P[8].fy += G; P[10].fy += G;
  // Keep the head over the hip, but not when upside down: that would balance the body on its head.
  if (head.y < hip.y - 10 * s) head.fx += (hip.x + face * 3 * s - head.x) * 120;
  else head.fx += (head.x < hip.x ? -1 : 1) * G * 1.5;     // tip over so the lift can stand us back up
  const mx = locked ? 0 : clamp(f.inp.mx, -1, 1), speed = TUNE.speed * moveMul(f);
  let k = grounded ? TUNE.accelGround : TUNE.accelAir;
  if (f.stagger > 0 || f.dashT > 0) k *= .12;      // let knockback and dashes carry the body
  if (f.status.freeze) k = grounded ? 5 : .5;      // a frozen statue slides to a stop
  if (grounded && f.grip != null) k *= f.grip;      // maps set f.grip < 1 on slippery ground (ice)
  if (f.wallLock > 0) k *= .12;                     // just wall-jumped: let the kick-off carry us away from the wall
  const target = mx * speed + (grounded ? f.gvx : 0);
  for (const j of UPPER_BODY) P[j].fx += (target - vx(P[j])) * k;
  for (const j of KNEES) P[j].fx += (target - vx(P[j])) * k * TUNE.kneeDrive;
  if (mx && grounded) f.phase += dt * 13 * clamp(speed / TUNE.speed, .6, 1.5);
  const sw = Math.cos(f.phase) * 26 * s * Math.abs(mx), lift = Math.sin(f.phase), walking = mx && !f.status.freeze;
  const hipVx = vx(hip);
  // Legs pointing up (lying on the back): the foot springs would balance them there, so topple them away from the head.
  const legsUp = P[8].y < hip.y - 20 * s && P[10].y < hip.y - 20 * s;
  if (legsUp) { const away = hip.x >= head.x ? 1 : -1; P[8].fx += away * G * 1.5; P[10].fx += away * G * 1.5; }
  else {
    footSpring(P[8], hip.x - face * 11 * s + sw, walking && lift > 0, hipVx);
    footSpring(P[10], hip.x + face * 11 * s - sw, walking && lift < 0, hipVx);
  }
  // Snappier arcs: extra gravity when falling, and when rising with the jump key released (tap = short hop).
  // Only for an upright body: a knocked-down fighter getting back up must not be pulled down.
  if (grounded) f.rising = false;
  else if (!f.status.freeze && head.y < hip.y - 20 * s && !(f.mount && f.mount.carried)) {
    const hipVy = vy(hip);
    if (hipVy > 0) f.rising = false;
    const extra = hipVy > 0 ? TUNE.fallGrav : f.rising && !f.inp.jumpHeld ? TUNE.cutGrav : TUNE.riseGrav;
    if (extra) for (const p of P) p.fy += G * extra;
  }
}

function driveArms(f) {
  if (f.blocking && guardPose(f)) return;          // 22-moves: weapon raised as a guard
  const P = f.P, neck = P[1], s = f.scale, face = f.face, G = PHYS.gravity;
  const guard = f.off && f.off.w.block > 0;      // a shield is held out in front, the weapon hand a little behind it
  if (f.w.ranged) aimRanged(f);
  else spring(P[6], neck.x + face * (guard ? 28 : 36) * s, neck.y + 10 * s, 110, 8);
  if (f.w.twoHanded) {   // back hand grips the shaft a little way up from the main hand
    const h = P[f.main.hand], t = P[f.tip], L = Math.hypot(t.x - h.x, t.y - h.y) || 1;
    spring(P[4], h.x + (t.x - h.x) / L * 18 * s, h.y + (t.y - h.y) / L * 18 * s, 90, 7);
  } else if (guard) spring(P[4], neck.x + face * 44 * s, neck.y + 22 * s, 100, 8);
  else if (f.off) spring(P[4], neck.x + face * 24 * s, neck.y + 24 * s, 70, 6);
  else spring(P[4], neck.x - face * 10 * s, neck.y + 44 * s, 25, 4);
  if (!f.w.chain && !f.w.ranged) P[f.tip].fy -= G * f.w.lift;
  if (f.off && !f.off.w.chain) P[f.off.tip].fy -= G * f.off.w.lift;
}

// Ranged weapons point at the nearest visible enemy, with a little wobble so aim isn't perfect.
function aimRanged(f) {
  const P = f.P, neck = P[1], s = f.scale, foe = nearestEnemy(f, true);
  let ang = foe ? angleTo(neck, chest(foe)) : (f.face > 0 ? -.15 : Math.PI + .15);
  ang += Math.sin(G_STATE.t * 3.3 + f.id * 1.7) * (f.status.stun ? .5 : .05);
  let d = ang - f.aim;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  f.aim += d * .18;
  const ux = Math.cos(f.aim), uy = Math.sin(f.aim), len = f.main.links[0].cur * (f.w.chain || 1);
  spring(P[6], neck.x + ux * 38 * s, neck.y + 8 * s + uy * 34 * s, 120, 9);
  spring(P[f.tip], P[6].x + ux * len, P[6].y + uy * len, 260, 12);
}

function doJump(f, mul) {
  const v = TUNE.jumpVel * mul;
  for (const p of f.P) p.oy = p.y + v * DT;      // set (not add) the vertical speed: every jump feels the same
  f.jumpBuf = 0; f.jumpCd = .16; f.coyote = 0; f.rising = true; f.stats.jumps++;
  const fy = feetY(f);
  burst(f.P[2].x, fy, mul < 1 ? f.color : '#9096c2', mul < 1 ? 10 : 6, 180);
  if (mul < 1) ring(f.P[2].x, fy, 26 * f.scale, rgba(f.color, .7), .25, 3);
  sfx('jump', mul < 1 ? .8 : 1);
  emit('jump', f);
}

function doDash(f) {
  const dir = f.inp.dash === -1 || f.inp.dash === 1 ? f.inp.dash : (Math.sign(f.inp.mx) || f.face);
  const far = f.dashMul || 1;                     // Trickster dashes further
  for (const p of f.P) { p.ox = p.x - dir * TUNE.dashVel * Math.sqrt(far) * DT; kick(p, 0, -70); }
  f.dashCd = TUNE.dashCd * (f.dashCdMul || 1); f.dashT = TUNE.dashTime * Math.sqrt(far); f.stats.dashes++;
  burst(f.P[2].x, f.P[2].y, f.color, 14, 260);
  sfx('dash');
  emit('dash', f);
}

// Default melee attack: swing the arm and weapon over the top toward the foe, with a lunge. A chain weapon whose
// head hangs below the shoulder swings underhand instead, so the ball sweeps forward and up rather than backwards.
function spinAttack(f, power = 1) {
  const P = f.P, neck = P[1], face = f.face, k = 15 * power;
  const swing = (idx, dir) => { for (const j of idx) { const p = P[j]; kick(p, -(p.y - neck.y) * dir * k, (p.x - neck.x) * dir * k); } };
  const underhand = f.w.chain && P[f.tip].y > neck.y;
  swing([5, 6, ...f.main.pts.slice(1)], underhand ? -face : face);
  if (f.off && f.off.w.block > 0) for (const j of [3, 4, ...f.off.pts.slice(1)]) kick(P[j], face * 520, -80);   // shield bash
  else if (f.off) swing([3, 4, ...f.off.pts.slice(1)], face);
  for (const j of [0, 1, 2]) kick(P[j], face * 220, 0);
  f.swingT = .32;
  sfx('swing', clamp(f.w.mass, .6, 1.6));
}

function attack(f) {
  const def = f.w;
  f.atkBuf = 0;
  f.atkCd = def.cd * cdMul(f);
  if (f.mount && MOUNTS[f.mount.key] && MOUNTS[f.mount.key].attack) hook(MOUNTS[f.mount.key], 'attack', f, f.mount);   // mounts bring their own attack
  else if (typeof def.attack === 'function') hook(def, 'attack', f);
  else if (def.ranged) { if (!fireRanged(f)) f.atkCd = .05; }   // empty/reloading: stay ready to fire the moment it's done
  else spinAttack(f);
  emit('attack', f);
}

// Fires the fighter's ranged weapon along the barrel (hand -> tip). overrides: extra spawnProj options.
function fireRanged(f, overrides) {
  const r = f.w.ranged;
  if (!r || f.reload > 0) return null;
  if (f.ammo <= 0) { f.reload = r.reload; return null; }
  const hand = f.P[f.main.hand], tip = f.P[f.tip], base = Math.atan2(tip.y - hand.y, tip.x - hand.x);
  let last = null;
  for (let k = 0; k < (r.pellets || 1); k++) {
    const ang = base + rnd(-r.spread, r.spread);
    last = spawnProj(Object.assign({ owner: f, x: tip.x, y: tip.y, vx: Math.cos(ang) * r.speed, vy: Math.sin(ang) * r.speed,
      color: f.w.color }, r.proj, overrides));
  }
  f.ammo--; f.stats.shots++;
  f.atkCd = r.cooldown * cdMul(f);
  kick(tip, -Math.cos(base) * r.recoil, -Math.sin(base) * r.recoil - r.recoil * .4);
  kick(hand, -Math.cos(base) * r.recoil * .4, -r.recoil * .2);
  burst(tip.x, tip.y, f.w.color, 4, 220, { life: .18 });
  sfx(r.sfx || 'shoot');
  if (f.ammo <= 0) f.reload = r.reload;
  emit('fire', f, last);
  return last;
}

function useSkill(f, slot) {
  const key = f.skills[slot], def = SKILLS[key];
  f.skillBuf[slot] = 0;
  if (!def || f.skillCd[slot] > 0) return false;
  if (hook(def, 'use', f) === false) return false;
  f.skillCd[slot] = def.cd * (f.status.haste ? .8 : 1) * (f.skillCdMul || 1);   // Mage: shorter cooldowns
  f.stats.skills++;
  float(f.P[0].x, f.P[0].y - 46 * f.scale, def.name.toUpperCase(), def.color, 17);
  sfx(def.sfx || 'skill');
  emit('skill', f, key);
  return true;
}

function handleActions(f, grounded, locked) {
  const inp = f.inp;
  if (inp.jump) f.jumpBuf = TUNE.buffer;
  if (inp.attack) f.atkBuf = TUNE.buffer;
  if (inp.skill1) f.skillBuf[0] = TUNE.buffer;
  if (inp.skill2) f.skillBuf[1] = TUNE.buffer;
  movesInput(f);                                   // v3: guard, mash-to-escape (even while locked)
  if (locked) return;
  if (movesActions(f, grounded)) return;           // v3: grab, throw, throwable, ultimate took this step
  if (f.jumpBuf > 0 && f.jumpCd <= 0) {
    if (grounded || f.coyote > 0) doJump(f, 1);
    else if (f.wallT > 0) wallJump(f);               // v3: kick off a wall instead of spending the air jump
    else if (f.airJumps > 0) { f.airJumps--; doJump(f, TUNE.airJumpMul); }
  }
  const auto = ((f.w.ranged && f.w.ranged.auto) || mountAuto(f)) && inp.attackHeld;
  if ((f.atkBuf > 0 || auto) && f.atkCd <= 0 && !f.blocking && !f.ult) attack(f);
  if (inp.dash && f.dashCd <= 0) doDash(f);
  for (let k = 0; k < 2; k++) if (f.skillBuf[k] > 0 && f.skillCd[k] <= 0 && f.skills[k]) useSkill(f, k);
}

function drive(f, dt) {
  if (!f.alive) return;
  const P = f.P, grounded = P[8].g || P[10].g || !!(f.mount && f.mount.hover), locked = !canAct(f);
  const gs = P[8].gs || P[10].gs;
  f.grounded = grounded;
  f.gvx = gs ? gs.dx / DT : 0;
  if (grounded) { f.coyote = TUNE.coyote; f.airJumps = 1 + (f.mem.extraJumps || 0) + (f.clsJumps || 0); } else f.coyote -= dt;
  updateFacing(f);
  driveBody(f, dt, grounded, locked);
  driveArms(f);
  driveMoves(f, dt, grounded);                     // v3: walls, guard, grabs, mounts, ultimates
  handleActions(f, grounded, locked);
}

// One-shot inputs last a single physics step; buffers above remember them a little longer.
function clearPresses(f) { const i = f.inp; i.jump = i.attack = i.skill1 = i.skill2 = i.block = i.grab = i.throw = i.super = i.mash = false; i.dash = 0; }

function tickFighter(f, dt) {
  for (const k of ['atkCd', 'atkBuf', 'jumpBuf', 'jumpCd', 'dashCd', 'dashT', 'stagger', 'flash', 'swingT', 'comboT', 'inv']) {
    if (f[k] > 0) f[k] = Math.max(0, f[k] - dt);
  }
  for (let k = 0; k < 2; k++) { f.skillCd[k] = Math.max(0, f.skillCd[k] - dt); f.skillBuf[k] = Math.max(0, f.skillBuf[k] - dt); }
  for (const id in f.hitCd) if ((f.hitCd[id] -= dt) <= 0) delete f.hitCd[id];
  if (!f.alive) return;
  f.aliveT += dt;
  if (f.P[0].y < f.P[2].y - 25 * f.scale) f.upT += dt;
  if (f.reload > 0 && (f.reload -= dt * (f.reloadRate || 1)) <= 0) { f.reload = 0; f.ammo = ammoCap(f); sfx('reload'); }
  const big = !!f.status.giant, reach = f.reachMul || 1;   // giant (and weapon level reach) grow links smoothly
  for (const l of f.L) if (l.rG) l.cur = lerp(l.cur, (big ? l.rG : l.r) * reach, .08);
  tickMoves(f, dt);                                // v3: stamina, timers, super meter, mounts
  tickStatus(f, dt);
  hook(f.w, 'onStep', f, dt);
  if (f.off) hook(f.off.w, 'onStep', f, dt);
  for (const key of f.skills) if (key && SKILLS[key]) hook(SKILLS[key], 'onStep', f, dt);
}
