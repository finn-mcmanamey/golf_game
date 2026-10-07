// 66-ai-moves.js: how CPUs use the v3 moves. 65-ai calls aiDecideMoves (once per decision) and aiMovesStep (every
// step, after its reflexes and before the safety checks). Every knob is per difficulty and merged into AI_LEVELS:
//   guard: chance per decision to raise a guard against a foe that is ready to swing in reach
//   parry: chance to answer a swing (or shot) with a perfectly timed guard; block: chance to guard late (chip damage)
//   grab: chance to grab a guarding (or stunned, or edge-standing) foe in reach
//   mash: button presses per second to break out of a grab; hold: seconds before a CPU throws who it holds
//   throw: chance per decision to use a throwable when its range fits; super: same for a full super meter
//   wall: chance per second to kick off a wall when it helps; loot: chance to go for a weapon when bare-handed
//   vine: chance per leap over the Jungle Temple's pit to catch a vine on the way (jungleCpuVines, 63-maps-v3)

const AI_MOVE_LEVELS = {
  easy: { guard: .1, block: .18, parry: .05, grab: .1, mash: 3, hold: .55, throw: .1, super: .3, wall: .3, loot: .6, vine: .25 },
  normal: { guard: .14, block: .25, parry: .12, grab: .22, mash: 6, hold: .45, throw: .16, super: .5, wall: .6, loot: .8, vine: .5 },
  hard: { guard: .22, block: .4, parry: .32, grab: .4, mash: 9, hold: .35, throw: .24, super: .8, wall: .85, loot: 1, vine: .75 },
  insane: { guard: .3, block: .5, parry: .55, grab: .55, mash: 12, hold: .3, throw: .3, super: .95, wall: 1, loot: 1, vine: .9 },
};
for (const k in AI_MOVE_LEVELS) if (AI_LEVELS[k]) Object.assign(AI_LEVELS[k], AI_MOVE_LEVELS[k]);
const AI_GUARD_MIN = 28;        // stamina below which a CPU stops guarding (a broken guard is worse than a hit)
// Seconds between a CPU's guard decisions against gunfire: judging every bullet kept a guard up against a minigun's
// stream and dropped rapid-fire guns ~15 points in tools/balance.cjs.
const AI_SHOT_JUDGE = .7;

// The AI view of a fighter's reach and style: a mount's own attack (mech punch, dragon breath) overrides the weapon's.
function aiReach(f) {
  const m = mountDef(f), r = m && m.ai.range ? m.ai.range : f.w.ai.range;
  return r * f.scale * (f.status.giant ? 1.4 : 1) * (f.reachMul || 1);
}
const aiStyle = f => (mountDef(f) && mountDef(f).ai.style) || f.w.ai.style || 'melee';

// ---------- once per decision ----------
function aiDecideMoves(f, L, c) {
  const a = f.ai, foe = a.foe;
  if (!foe || G_STATE.lock > 0 || f.heldBy) return;
  aiLoot(f, L, c);
  if (!canAct(f) || f.ult) return;
  if (f.super >= 100 && aiWantsUltimate(f, foe, c) && chance(L.super * .5)) { f.inp.super = true; return; }
  if (f.throwCd <= 0 && f.throwN[0] + f.throwN[1] > 0 && a.los && chance(L.throw * .15) && aiThrowFits(f, foe, c.d)) f.inp.throw = true;
  if (aiShouldGrab(f, foe, c, L)) { f.inp.grab = true; return; }
  // Guard up when a foe that is ready to swing stands in its reach and faces us.
  const foeReach = aiReach(foe) + 30;
  if (aiStyle(foe) === 'melee' && c.d < foeReach && foe.atkCd < .1 && (f.P[2].x - foe.P[2].x) * foe.face > 0 && chance(L.guard)) aiGuard(f, 0, rnd(.3, .6));
}

function aiWantsUltimate(f, foe, c) {
  const def = ultFor(f);
  if (!def || f.mount || f.heldBy) return false;
  return c.d < def.ai.range * f.scale && Math.abs(c.dy) < 150;
}

function aiThrowFits(f, foe, d) {
  const def = THROWABLES[f.throws[f.throwN[0] > 0 ? 0 : 1]];
  if (!def) return false;
  if (def.ai.when) { try { return !!def.ai.when(f, foe, d); } catch (e) { report(e, def.key + '.ai.when'); return false; } }
  return d >= def.ai.min && d <= def.ai.max;
}

// Grabs beat guards: take a turtling foe, a guard-broken one, or anyone standing near a drop we can throw them into.
function aiShouldGrab(f, foe, c, L) {
  if (f.grabCd > 0 || f.mount || !canBeGrabbed(f, foe)) return false;
  if (c.d > GRAB.reach * f.scale + 10 || Math.abs(c.dy) > 60) return false;
  if (foe.blocking) return chance(L.grab);
  if (foe.status.stun || foe.guardBroken > 0) return chance(L.grab * .5);
  return aiThrowDir(f) !== 0 && chance(L.grab * .35);
}

// Bare-handed: head for the nearest weapon lying around (or a crate) unless a foe is right in our face.
function aiLoot(f, L, c) {
  if (!isBare(f) || !f.ai.lootOk) return;
  if (c.d < aiReach(f) * 1.2 && f.hp > f.ai.foe.hp) return;      // already brawling and winning: keep punching
  const me = f.P[2];
  let best = null, bd = 700;
  for (const p of pickupsLive()) {
    const d = Math.abs(p.x - me.x) + Math.max(0, feetY(f) - p.y - 40) * 1.5;
    if (d < bd && p.t > .3) { bd = d; best = p; }
  }
  if (best) aiGoTo(f, best.x, best.y + 8);
}

// ---------- every step ----------
function aiMovesStep(f, L, dt) {
  const a = f.ai, inp = f.inp;
  if (a.lootOk === undefined) a.lootOk = chance(L.loot);
  if (f.heldBy) { if (chance(L.mash * dt)) inp.mash = true; inp.blockHeld = false; return; }
  if (f.holding) { aiHoldAndThrow(f, L); return; }
  if (f.mount) aiFly(f);
  aiWallKick(f, L, dt);
  aiGuardStep(f, L);
}

// Holding someone: pick the throw direction (a drop, a hazard, a wall to bounce off), then throw.
function aiHoldAndThrow(f, L) {
  const dir = aiThrowDir(f) || f.face;
  f.inp.mx = dir; f.inp.blockHeld = false;
  if (G_STATE.t - f.grabT > L.hold) f.inp.grab = true;
}

// -1/1 toward a nearby drop or damaging hazard worth throwing a foe into, else 0.
function aiThrowDir(f) {
  if (!MAP) return 0;
  const x = f.P[2].x, fy = feetY(f);
  let best = 0, bd = 330;
  for (const dir of [-1, 1]) {
    for (let d = 40; d < bd; d += 30) {
      const g = groundBelow(x + dir * d, fy - 10), off = !MAP.walls && (x + dir * d < 0 || x + dir * d > W);
      if (off || (MAP.floor == null && (g == null || g > fy + 300))) { best = dir; bd = d; break; }
    }
  }
  for (const hz of MAP.hazards) {
    if (!hz.dps) continue;
    const cx = hz.x + hz.w / 2, d = Math.abs(cx - x);
    if (d < bd && Math.abs(hz.y - fy) < 120) { best = Math.sign(cx - x); bd = d; }
  }
  return best;
}

// Flying mounts: hover near the foe's height (dragon breath from above, jetpack to reach high foes and ledges).
function aiFly(f) {
  const def = mountDef(f), foe = f.ai.foe;
  if (!def || !def.ai.fly) return;
  const climb = f.ai.nav && f.ai.nav.top != null ? f.ai.nav.top - 40 : null;
  const target = climb ?? (foe ? chest(foe).y - (def.key === 'dragon' ? 70 : 30) : H / 2);
  const want = f.P[2].y > target + 12;
  f.inp.jumpHeld = want;
  if (want && f.grounded && f.jumpCd <= 0) f.inp.jump = true;
}

// Against a wall in the air: kick off it to climb toward a ledge, to get back from a fall, or to escape a corner.
function aiWallKick(f, L, dt) {
  if (f.wallT <= 0 || f.grounded || f.mount) return;
  const fy = feetY(f), n = f.ai.nav, foe = f.ai.foe;
  const climbing = n && n.top != null && n.top < fy - 30;
  const falling = MAP.floor == null && vy(f.P[2]) > 100 && (groundBelow(f.P[2].x, fy) == null);
  const cornered = foe && foe.alive && Math.abs(foe.P[2].x - f.P[2].x) < 170 && Math.sign(foe.P[2].x - f.P[2].x) === -f.wallDir;
  if ((climbing || falling || cornered) && chance(L.wall * dt * 4)) f.inp.jump = true;
}

// Raises the guard from `delay` seconds from now for `secs` seconds (unless a guard is already planned).
function aiGuard(f, delay, secs) {
  const a = f.ai, t = G_STATE.t;
  if (f.stamina < AI_GUARD_MIN || f.guardBroken > 0 || f.mount || (a.guardUntil || 0) > t + delay) return;
  a.guardAt = t + delay; a.guardUntil = t + delay + secs;
}

function aiGuardStep(f, L) {
  const a = f.ai, t = G_STATE.t, foe = a.foe, shot = incoming(f);
  if (shot && a.shotSeen !== shot && t >= (a.shotJudgeAt || 0)) {      // judge incoming fire now and then, not every bullet
    a.shotSeen = shot; a.shotJudgeAt = t + AI_SHOT_JUDGE;
    const facing = shot.vx * f.face < 0, eta = Math.hypot(shot.x - chest(f).x, shot.y - chest(f).y) / (Math.hypot(shot.vx, shot.vy) || 1);
    if (facing && chance(L.parry * .6)) aiGuard(f, Math.max(0, eta - .1), .3);
    else if (facing && chance(L.block * .5)) aiGuard(f, 0, .4);
  }
  let up = t >= (a.guardAt || 0) && t < (a.guardUntil || 0) && f.stamina > AI_GUARD_MIN * .5;
  // A foe left open after its swing: drop the guard and punish instead.
  // (Not while a habit read (68) holds the guard for a swing it saw coming: a.guardLock.)
  if (up && foe && foe.atkCd > .22 && t >= (a.guardLock || 0) && Math.abs(foe.P[2].x - f.P[2].x) < aiReach(f) && chance(L.punish || 0)) { up = false; a.guardUntil = t; }
  if (up && shot && shot.vx * f.face > 0) up = false;                  // a shot from behind: a front guard won't help
  f.inp.blockHeld = up;
}

// A foe started a swing: CPUs in its reach may answer with a parry (timed) or a late guard.
on('attack', A => {
  if (!A.alive || G_STATE.lock > 0) return;
  const reach = aiReach(A) + 40;
  for (const B of F) {
    if (!B.alive || B.team === A.team || !aiBrain(B) || B.summon || !B.ai) continue;
    if (Math.abs(B.P[2].x - A.P[2].x) > reach || Math.abs(B.P[2].y - A.P[2].y) > 120) continue;
    const L = aiLevel(B);
    if (chance(L.parry || 0)) aiGuard(B, .01, .25);
    else if (chance((L.block || 0) * .5)) aiGuard(B, L.react * rnd(.4, 1), .4);
  }
});
