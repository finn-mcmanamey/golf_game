// 22-moves.js: v3 "fighting depth" moves that every fighter has: guard (block button, stamina, perfect-timed parry,
// guard break), grab & throw (with mash-to-escape), and wall slide / wall jump. It also owns the per-fighter v3 state
// (initFightingDepth) and the per-step dispatch to the other v3 slices: 24-classes, 32-arms (disarm, pickups),
// 33-power (super meter, ultimates, weapon levels), 34-throwables, 56-fusion (elements) and 57-mounts.

// Guard tuning. chip: share of damage that still gets through a front block, per damage kind.
const BLOCK = {
  parryWin: .15,       // a hit landing this soon after the guard went up is parried
  reArm: .3,           // re-raising the guard sooner than this after dropping it gets no parry window (no mashing)
  moveMul: .35,        // walking speed while guarding
  kbMul: .35,          // knockback through a guard
  chip: { melee: .2, proj: .2, skill: .5, explode: .6 },
  cost: 3.2, costBase: 6,   // stamina per point of blocked damage, plus a flat cost per blocked hit
  drain: 5, regen: 30, regenDelay: .55,   // stamina/s while holding, per second back, delay after use
  parryRefund: 30, parryStun: .65, breakStun: 1.1, breakRefill: .4,
};
// Grab tuning. reach: chest-to-chest px (× scale) a grab connects at; mash: presses needed to break free.
const GRAB = { reach: 74, hold: 1.1, minHold: .15, mash: 7, cd: 1.1, dmg: 9, throwVx: 980, throwVy: 640, ragdoll: .85 };
// Wall tuning. slide: max fall speed px/s while sliding; kick: horizontal speed of a wall jump.
const WALL = { slide: 260, kick: 600, jump: .95, lock: .2, coyote: .12, reach: 24 };

defStatus('ragdoll', { name: 'Thrown', icon: '↻', color: '#ffb36b', debuff: true, max: 2, immunity: .3 });

// ---------- per-fighter v3 state (called by makeFighter before the weapon is equipped) ----------
function initFightingDepth(f, o) {
  applyClass(f, o.cls);                                            // 24-classes: hp, speed, mass, passives
  Object.assign(f, {
    stamina: f.maxStamina, blocking: false, blockStart: -9, blockEnd: -9, guardBroken: 0, staminaCd: 0,
    heldBy: null, holding: null, grabT: 0, grabCd: 0, escape: 0,
    wallT: 0, wallDir: 0, wallLock: 0, wallSliding: false,
    super: clamp(o.superKeep || 0, 0, 100), ult: null, ultT: 0,   // the meter carries over between rounds
    wxp: o.wxp || {}, lvl: 1, lvlDmg: 1, reachMul: 1,             // xp per weapon key for the whole match
    element: null, elementT: 0, mount: null, shatterT: 0, bareT: 0, throwCd: 0,
  });
  f.throws = resolveThrows(o.throws);                              // 34-throwables: two picks, one use each per round
  f.throwN = f.throws.map(k => k ? 1 : 0);
  const first = f.throwN.findIndex(n => n > 0);
  if (first >= 0) f.throwN[first] += f.cls.throwBonus || 0;          // Gunner: one extra of the first throwable
  Object.assign(f.stats, { blocks: 0, parries: 0, grabs: 0, throws: 0, wallJumps: 0, ults: 0, thrown: 0, disarms: 0, pickups: 0 });
}

// ---------- guard ----------
// Is the hit coming at B's front? From the push direction (attacker -> B), else from where the attacker stands.
function guardFront(B, A, o) {
  if (o.proj) return o.proj.vx * B.face < 0 || Math.abs(o.proj.vx) < 60;
  if (o.nx != null && (o.nx || o.ny)) return o.nx * B.face < .3;
  return !A || (A.P[2].x - B.P[2].x) * B.face > -20;
}

// Called by damage() for direct hits: returns the share of damage that gets through (1 = unguarded, 0 = parried).
function guardHit(B, A, o, x, y, amount) {
  const share = BLOCK.chip[o.kind];
  if (!B.blocking || share == null || o.unblockable || !guardFront(B, A, o)) return 1;
  if (G_STATE.t - B.blockStart < BLOCK.parryWin && !o.blast) { parry(B, A, o, x, y); return 0; }   // blasts can't be parried
  B.stamina -= amount * BLOCK.cost + BLOCK.costBase;
  B.staminaCd = BLOCK.regenDelay;
  B.stats.blocks++;
  if (A && o.kind === 'melee') guardRecoil(A, o, 300);
  burst(x, y, '#9fe8ff', 10, 300, { life: .25 });
  ring(x, y, 22, rgba(B.color, .8), .16, 3);
  sfx('block', .8);
  emit('block', B, A);
  if (B.stamina <= 0) { guardBreak(B); return 1; }                // the hit that breaks the guard lands in full
  return share;
}

// The attacker's weapon bounces off a guard (and harder off a parry).
function guardRecoil(A, o, power) {
  for (const rig of rigsOf(A)) for (const j of rig.pts.slice(1)) kick(A.P[j], -(o.nx || 0) * power, -(o.ny || 0) * power - 80);
}

function parry(B, A, o, x, y) {
  B.blockStart = -9;                                // one parry per raised guard: the rest of a burst is only blocked
  B.stamina = Math.min(B.maxStamina, B.stamina + BLOCK.parryRefund);
  B.stats.parries++;
  gainSuper(B, 10);
  if (o.proj) reflectProj(o.proj, B);
  else if (A && A.alive) {
    guardRecoil(A, o, 620);
    addStatus(A, 'stun', BLOCK.parryStun, 1, B);
    A.stagger = Math.max(A.stagger, .3);
  }
  burst(x, y, '#ffffff', 22, 520, { life: .3 });
  ring(x, y, 46, '#ffffff', .25, 5);
  float(x, y - 30, 'PARRY!', '#ffffff', 28);
  hitstop(.06); shake(6); sfx('parry');
  emit('parry', B, A);
}

// A parried shot changes sides and flies back the way it came, a little faster.
function reflectProj(p, B) {
  p.vx = -p.vx * 1.1; p.vy = -p.vy * .6 - 120;
  p.owner = B; p.team = B.team; p.hits = []; p.t = Math.min(p.t, p.life * .5); p.reflected = true;
}

function guardBreak(f) {
  f.blocking = false; f.blockEnd = G_STATE.t; f.stamina = 0;
  f.guardBroken = BLOCK.breakStun + .3;
  addStatus(f, 'stun', BLOCK.breakStun, 1, null);
  const c = chest(f);
  float(c.x, c.y - 60, 'GUARD BREAK', '#ff8a2e', 28);
  burst(c.x, c.y, '#ff8a2e', 20, 400);
  ring(c.x, c.y, 60 * f.scale, '#ff8a2e', .3, 5);
  shake(8); sfx('shatter');
  emit('guardBreak', f);
}

// Weapon raised in front of the face. Returns true when it replaced the normal arm pose.
function guardPose(f) {
  const P = f.P, neck = P[1], s = f.scale, face = f.face;
  spring(P[6], neck.x + face * 26 * s, neck.y - 4 * s, 130, 9);
  spring(P[4], neck.x + face * 22 * s, neck.y + 16 * s, 100, 8);
  if (!f.w.chain) {   // blade up and across the body
    const L = f.main.links[0].cur * (f.w.chain || 1);
    spring(P[f.tip], P[6].x + face * L * .25, P[6].y - L * .95, 200, 11);
  }
  return true;
}

function drawGuard(f) {
  if (!f.blocking) return;
  const c = chest(f), r = 50 * f.scale, a0 = f.face > 0 ? -1.15 : Math.PI - 1.15, frac = f.stamina / f.maxStamina;
  const parryWin = G_STATE.t - f.blockStart < BLOCK.parryWin;
  ctx.save();
  ctx.globalAlpha = .35 + .4 * frac;
  ctx.shadowColor = parryWin ? '#ffffff' : f.color; ctx.shadowBlur = 16;
  ctx.strokeStyle = parryWin ? '#ffffff' : f.color; ctx.lineWidth = 5 * f.scale;
  ctx.beginPath(); ctx.arc(c.x, c.y - 10 * f.scale, r, a0, a0 + 2.3); ctx.stroke();
  ctx.restore();
}

// ---------- grab & throw ----------
// Everything that keeps B out of A's hands except its size (a boss is "TOO BIG" rather than silently ungrabbable).
function canBeHeld(A, B) {
  return B.alive && B !== A && B.team !== A.team && !B.heldBy && !B.holding && !(B.inv > 0) && !B.mount && !B.ult && !B.status.ragdoll &&
    !B.summon;
}
function canBeGrabbed(A, B) { return canBeHeld(A, B) && B.scale <= A.scale * 1.3; }

// Grabs the nearest grabbable foe in reach. Grabs go through a guard (that is what they are for).
function tryGrab(A) {
  if (A.grabCd > 0 || A.mount || A.holding) return false;
  const c = chest(A);
  let best = null, bd = Infinity, big = null;
  for (const B of F) {
    if (!canBeHeld(A, B)) continue;
    const cb = chest(B), d = Math.hypot(cb.x - c.x, (cb.y - c.y) * 1.4), reach = GRAB.reach * A.scale + 18 * B.scale;
    if (B.scale > A.scale * 1.3) {   // too big to lift: say so when its chest or hip is in reach (a giant's chest is high)
      const hb = B.P[2], dh = Math.hypot(hb.x - c.x, (hb.y - c.y) * 1.4);
      if (!big && Math.min(d, dh) < reach) big = B;
      continue;
    }
    if (d < reach && d < bd) { bd = d; best = B; }
  }
  A.grabCd = best ? GRAB.cd : .35;   // a whiffed grab also has a short recovery
  if (!best) {
    if (big) float(c.x, c.y - 60, 'TOO BIG', '#ffd84a', 16);   // say why the grab did nothing (silent in sim and demo)
    return false;
  }
  A.holding = best; best.heldBy = A; A.grabT = G_STATE.t; best.escape = 0;
  best.blocking = false; best.blockEnd = G_STATE.t;
  A.stats.grabs++;
  const cb = chest(best);
  float(cb.x, cb.y - 50, 'GRABBED', A.color, 22);
  burst(cb.x, cb.y, A.color, 10, 220);
  sfx('swing', .7);
  emit('grab', A, best);
  return true;
}

// The holder carries the held fighter at arm's length (springs pull the whole body there; gravity is cancelled).
function carryHeld(A, dt) {
  const B = A.holding, n = A.P[1], s = A.scale;
  if (!B || !B.alive || B.heldBy !== A) { grabRelease(A); return; }
  const tx = n.x + A.face * 46 * s, ty = n.y + 6 * s, hip = B.P[2], dx = tx - hip.x, dy = ty - hip.y;
  for (const p of B.P) { p.fx += dx * 160 - vx(p) * 12; p.fy += dy * 160 - vy(p) * 12 - PHYS.gravity; }
  spring(A.P[6], tx, ty - 20 * s, 120, 9); spring(A.P[4], tx, ty - 10 * s, 120, 9);
  if (G_STATE.t - A.grabT > GRAB.hold) grabThrow(A);              // held too long: throw automatically
}

function grabRelease(A) {
  const B = A.holding;
  A.holding = null;
  if (B && B.heldBy === A) B.heldBy = null;
}

function grabThrow(A) {
  const B = A.holding;
  if (!B) return;
  grabRelease(A);
  const dir = Math.sign(A.inp.mx) || A.face, c = chest(B);
  for (const p of B.P) setVel(p, dir * GRAB.throwVx, -GRAB.throwVy);
  addStatus(B, 'ragdoll', GRAB.ragdoll, 1, A);
  damage(B, GRAB.dmg, { src: A, kind: 'skill', unblockable: true, x: c.x, y: c.y, nx: dir, ny: -.5, throw: true });
  A.stats.throws++;
  shake(10); sfx('slam');
  emit('throw', A, B);
}

// Each button press while held fills the escape meter; full = break free and shove the holder away.
function grabMash(B) {
  const A = B.heldBy;
  if (!A) return;
  B.escape++;
  if (B.escape < GRAB.mash) { if (!G_STATE.sim && chance(.5)) burst(B.P[0].x, B.P[0].y, B.color, 3, 160, { life: .2 }); return; }
  grabRelease(A);
  const dir = Math.sign(B.P[2].x - A.P[2].x) || -A.face;
  for (const p of B.P) kick(p, dir * 420, -260);
  for (const p of A.P) kick(p, -dir * 320, -80);
  A.stagger = Math.max(A.stagger, .35); B.inv = Math.max(B.inv, .25); A.grabCd = GRAB.cd;
  float(B.P[0].x, B.P[0].y - 40, 'ESCAPED', B.color, 22);
  sfx('dash');
  emit('grabEscape', B, A);
}

// ---------- walls ----------
// Which side a wall touches us on (-1 left, 1 right, 0 none): the arena edge or the side of a tall solid block.
function wallSide(f) {
  if (!MAP) return 0;
  const hip = f.P[2], c = chest(f), pad = WALL.reach * f.scale;
  if (MAP.walls) { if (hip.x < WALL_PAD + pad) return -1; if (hip.x > W - WALL_PAD - pad) return 1; }
  for (const s of MAP.solids) {
    if (s.oneWay || s.h < 50 || c.y < s.y - 10 || c.y > s.y + s.h + 30) continue;
    if (hip.x <= s.x + 2 && hip.x > s.x - pad) return 1;
    if (hip.x >= s.x + s.w - 2 && hip.x < s.x + s.w + pad) return -1;
  }
  return 0;
}

// Airborne against a wall: remember it briefly (wall-jump coyote time); pressing into it slows the fall to a slide.
function driveWall(f, grounded) {
  f.wallSliding = false;
  if (grounded || f.mount || f.heldBy || f.status.ragdoll || !f.alive) return;
  const side = wallSide(f);
  if (!side) return;
  f.wallT = WALL.coyote; f.wallDir = side;
  if (Math.sign(f.inp.mx) !== side || vy(f.P[2]) < 0) return;
  f.wallSliding = true;
  for (const p of f.P) { const v = vy(p); if (v > WALL.slide) p.oy = p.y - lerp(v, WALL.slide, .3) * DT; }
  if (!G_STATE.sim && chance(.15)) burst(f.P[2].x + side * 10, f.P[2].y, '#c9cdee', 1, 60, { life: .3 });
}

function wallJump(f) {
  const side = f.wallDir, v = TUNE.jumpVel * WALL.jump;
  for (const p of f.P) { p.ox = p.x + side * WALL.kick * DT; p.oy = p.y + v * DT; }
  Object.assign(f, { wallT: 0, wallLock: WALL.lock, jumpBuf: 0, jumpCd: .16, coyote: 0, rising: true, face: -side });
  f.stats.wallJumps++; f.stats.jumps++;
  burst(f.P[2].x + side * 12, f.P[2].y, f.color, 10, 220);
  sfx('jump', .9);
  emit('wallJump', f);
}

// ---------- per-step input and actions (called from handleActions in 20-fighter) ----------
// Guard up/down from the held block button, and mash presses while held. Runs even while the fighter can't act.
function movesInput(f) {
  const inp = f.inp;
  if (f.heldBy && (inp.mash || inp.jump || inp.attack || inp.dash || inp.grab || inp.block || inp.skill1 || inp.skill2 || inp.throw)) grabMash(f);
  const want = inp.blockHeld && canAct(f) && f.guardBroken <= 0 && !f.holding && !f.ult && !f.mount && f.stamina > 0;
  if (want && !f.blocking) {
    f.blocking = true;
    f.blockStart = G_STATE.t - f.blockEnd < BLOCK.reArm ? -9 : G_STATE.t;   // fresh guard: parry window opens
  } else if (!want && f.blocking) { f.blocking = false; f.blockEnd = G_STATE.t; }
}

// Grab / throw / throwable / ultimate. Returns true when the step was used up (no jump or swing this step).
function movesActions(f) {
  const inp = f.inp;
  if (f.holding) {
    if ((inp.attack || inp.grab) && G_STATE.t - f.grabT > GRAB.minHold) grabThrow(f);
    f.atkBuf = 0;
    return true;
  }
  if (f.ult) { f.atkBuf = 0; return true; }                         // busy with an ultimate
  if (inp.super && f.super >= 100 && useUltimate(f)) return true;   // 33-power
  if (inp.throw && f.throwCd <= 0) throwNext(f);                     // 34-throwables
  if (inp.grab || (f.blocking && inp.attack)) {                      // grab button, or attack while guarding
    f.atkBuf = 0;
    if (!tryGrab(f) && inp.grab) armsGrabKey(f);                     // 32-arms: nothing to grab: pick up a weapon
    return true;
  }
  return false;
}

// Called by drive() after the body and arms: walls, carrying, mounts, ultimates.
function driveMoves(f, dt, grounded) {
  driveWall(f, grounded);
  if (f.holding) carryHeld(f, dt);
  if (f.mount) mountDrive(f, dt, grounded);                         // 57-mounts
  if (f.ult) ultStep(f, dt);                                         // 33-power
}

// Timers and stamina; also lets the other v3 slices tick (called from tickFighter).
function tickMoves(f, dt) {
  for (const k of ['wallT', 'wallLock', 'grabCd', 'staminaCd', 'throwCd']) if (f[k] > 0) f[k] = Math.max(0, f[k] - dt);
  if (f.guardBroken > 0 && (f.guardBroken -= dt) <= 0) { f.guardBroken = 0; f.stamina = Math.max(f.stamina, f.maxStamina * BLOCK.breakRefill); }
  if (f.blocking) {
    f.stamina -= BLOCK.drain * dt; f.staminaCd = BLOCK.regenDelay;
    if (f.stamina <= 0) guardBreak(f);
  } else if (f.staminaCd <= 0 && f.guardBroken <= 0) f.stamina = Math.min(f.maxStamina, f.stamina + BLOCK.regen * dt);
  armsTick(f, dt); powerTick(f, dt); mountTick(f, dt);
}

// Grabs end when either side is K.O.'d.
on('ko', victim => {
  if (victim.holding) grabRelease(victim);
  if (victim.heldBy) grabRelease(victim.heldBy);
  victim.blocking = false;
});

// ---------- drawing hooks (85-render calls these around each fighter) ----------
function drawFighterUnder(f) { if (f.mount) mountDraw(f, 'under'); }
function drawFighterOver(f) {
  drawGuard(f);
  if (f.element) fusionDraw(f);
  if (f.lvl >= 3) levelDraw(f);
  if (f.mount) mountDraw(f, 'over');
  if (f.ult) ultDraw(f);
}
