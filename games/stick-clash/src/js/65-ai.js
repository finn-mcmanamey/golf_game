// 65-ai.js: the CPU brain. think(f, dt) runs every physics step for CPU fighters (and for humans on autopilot in
// tests). Two layers:
//   - a "decision" every reaction time (aiDecide): pick a target, choose where to stand, arm an attack, use skills;
//   - "reflexes" every step (aiMicro): swing the moment the foe is in reach, aim and fire, climb platforms,
//     dodge hazards, stay on the stage and recover from falls.
// Weapons steer it with ai: { range, style: 'melee'|'ranged'|'kite', think(f, foe, dist) } and skills with ai.when.
// Modes may set f.ai.behave = 'idle' (training dummy) or 'roam' (moves, never attacks), and may define
// aiGoal(f) -> { x, y, w } (a zone to stand in, e.g. King of the Hill).

// Difficulty. react: seconds between decisions. attack/skill/dodge/orb/punish: chances. aimErr: radians of aim
// error. lead: how well moving targets are led. spacing: px of sloppiness in footsies. wide: how far out of reach
// it may swing anyway (wasted swings). idle: chance per decision to hesitate. edge: awareness of walls and pits.
// moves: melee tactics it knows (g swing, j jump + swing, d dash + swing). pick: only attack where the learned payoff
// is at least this share of the best known (tactic, distance); 0 = swing whenever the foe is in reach.
// walk: approach speed (cautious bots walk). armor: damage taken × from another CPU only (bot-vs-bot fights are
// chaotic physics, so behaviour alone separates levels only ~10%; a modest toughness factor makes the ladder clear).
// Never against a human: see aiArmorMul.
// brawl: chance per decision to press a close-range melee foe (stay at half reach, swing the moment it's in reach)
// instead of footsies; measured against a walk-in-and-mash player, the spacing dance (stepping out, backing off after a
// swing, dash/jump tactics) lost to plain pressure, so the top levels brawl up close and use tactics from further out.
// gunArmor: extra toughness for a CPU holding a ranged weapon. The dash/jump tactics Hard and Insane unlock only help
// melee, so without it an Insane gunner lost to a Hard CPU (46%) while an Insane swordsman won 74%.
const AI_LEVELS = {
  easy: { react: .42, attack: .35, skill: .22, dodge: .08, orb: .30, aimErr: .09, lead: 0, spacing: 60, wide: 70, idle: .30, punish: 0,
    edge: 0, jump: .05, pick: 0, moves: 'g', walk: .75, armor: 1.3 },
  normal: { react: .24, attack: .6, skill: .48, dodge: .28, orb: .45, aimErr: .035, lead: .4, spacing: 30, wide: 35, idle: .12, punish: .3,
    edge: .3, jump: .07, pick: .25, moves: 'g', walk: .9, armor: 1.08 },
  hard: { react: .14, attack: .85, skill: .78, dodge: .58, orb: .60, aimErr: .015, lead: .8, spacing: 14, wide: 14, idle: .03, punish: .7,
    edge: .7, jump: .08, pick: .45, moves: 'gjd', walk: 1, armor: .94, gunArmor: .82, brawl: .85 },
  insane: { react: .075, attack: .97, skill: .92, dodge: .80, orb: .70, aimErr: 0, lead: 1, spacing: 6, wide: 4, idle: 0, punish: .95,
    edge: 1, jump: .08, pick: .3, moves: 'gjd', walk: 1, armor: .82, gunArmor: .72, brawl: 1 },
};
const AI_ORDER = ['easy', 'normal', 'hard', 'insane'];
const aiBrain = f => !!f && (f.ctrl === 'cpu' || f.autopilot);
// Level toughness (armor, gunArmor) only applies between two CPU brains: it separates the bot ladder, but a human
// always fights a CPU with exactly the health bar they see. Read live, so a weapon swap (Roulette) updates it.
function aiArmorMul(B, A) {
  if (!aiBrain(B) || !aiBrain(A) || B.summon || (G_STATE.mode && G_STATE.mode.aiArmor === false)) return 1;
  const L = aiLevel(B);
  return (L.armor || 1) * (B.w.ranged ? L.gunArmor || 1 : 1);
}
const aiLevel = f => AI_LEVELS[f.aiLevel] || AI_LEVELS[G_STATE.cfg && G_STATE.cfg.diff] || AI_LEVELS.normal;
// Difficulty `steps` levels above (or below) `key`, clamped to the table: used by modes that ramp up.
function aiShift(key, steps) {
  const i = AI_ORDER.indexOf(AI_LEVELS[key] ? key : 'normal');
  return AI_ORDER[clamp(i + steps, 0, AI_ORDER.length - 1)];
}

const aiWrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const aiUpright = f => f.P[0].y < f.P[2].y - 20 * f.scale;

function think(f, dt) {
  if (!f.alive) return;
  const a = f.ai, L = aiLevel(f);
  f.inp.jumpHeld = true;                     // CPUs always take full jumps
  if (a.behave === 'idle') { f.inp.mx = 0; f.inp.attackHeld = false; return; }
  a.t = (a.t || 0) - dt;
  if (a.t <= 0) {
    a.t = L.react * rnd(.6, 1.4);
    aiDecide(f, L);
  }
  aiMicro(f, L, dt);
  aiMovesStep(f, L, dt);                     // v3 moves: guard, grab/throw, mash, walls, flying mounts (66-ai-moves)
  if (MAP) aiSafety(f);
}

// ---------- decisions ----------
function aiDecide(f, L) {
  const a = f.ai, inp = f.inp;
  inp.attackHeld = false; a.armed = false; a.fire = false;
  if (!aiLeaping(f)) a.nav = null;
  a.aimErr = (Math.random() + Math.random() - 1) * L.aimErr;   // a fresh small aim error each decision
  const foe = a.foe = aiTarget(f);
  if (a.behave === 'roam') { aiRoam(f); return; }
  if (!foe) {                                    // nobody to fight (e.g. they're respawning): take the objective
    const zone = hook(G_STATE.mode, 'aiGoal', f);
    if (zone) aiGoTo(f, zone.x, zone.y); else aiGoTo(f, W / 2, null);
    return;
  }
  const c = aiSense(f, foe);
  a.los = aiLos(f, foe);
  if (!aiUpright(f) && aiGetUp(f, L, c)) return;
  const zoneMode = !!(G_STATE.mode && G_STATE.mode.aiGoal);    // an objective to hold: no idle dithering
  if (G_STATE.lock <= 0 && !zoneMode && chance(L.idle)) { inp.mx = chance(.5) ? 0 : -c.dir; return; }   // easier bots hesitate
  const goal = aiObjective(f, L, c);
  a.zonePush = !!(goal && goal.zone);
  if (goal) {
    aiGoTo(f, goal.x, goal.y);
    if (goal.zone) { a.armed = chance(L.attack); if (inp.mx) inp.mx = Math.sign(inp.mx); }   // run to the zone, swing at anyone in the way
  }
  else if (c.style === 'melee') { a.gapClose = !aiVsHumanGunner(foe) || chance(AI_GUNNER_CLOSE); aiMelee(f, L, c); }
  else aiRanged(f, L, c);
  if (a.zoneHold) aiStayInZone(f, a.zoneHold);
  aiDodge(f, L, c);
  aiSkills(f, foe, c.d, L);
  hook(f.w.ai, 'think', f, foe, c.d);
  aiDecideMoves(f, L, c);                    // v3: ultimate, throwable, grab, guard, looting (66-ai-moves)
}

// What we know about the fight: horizontal gap d, direction, height difference of the feet, our reach.
function aiSense(f, foe) {
  const me = f.P[2], op = foe.P[2], dx = op.x - me.x;
  const range = aiReach(f);                  // v3: weapon level reach and mounts (66-ai-moves)
  return { d: Math.abs(dx), dx, dir: Math.sign(dx) || f.face, dy: feetY(foe) - feetY(f), range, style: aiStyle(f),
    foeRange: aiReach(foe) };
}

// Chooses whom to fight: nearest, but finish off weak foes, help a hurt ally, and don't all pile on one enemy.
function aiTarget(f) {
  const a = f.ai;
  let best = null, bs = Infinity;
  for (const o of enemiesOf(f)) {
    if (!o.alive) continue;
    const d = dist(o.P[2], f.P[2]);
    if (o.status.invis && d > 190) continue;
    let s = d - (1 - o.hp / o.maxHp) * 90;
    if (o === a.foe) s -= 70;                                    // stick with the current target
    for (const al of alliesOf(f)) {
      if (!al.alive || al.summon) continue;
      if (al.ai.foe === o && al.ctrl === 'cpu' && !f.summon) s += 80;              // spread out over the enemies
      if (al.hp < al.maxHp * .4 && dist(o.P[2], al.P[2]) < 230) s -= 130;           // protect a hurt teammate
    }
    if (s < bs) { bs = s; best = o; }
  }
  return best || nearestEnemy(f);
}

// Is there a clear shot (no solid block) between us and the foe?
function aiLos(f, foe) {
  const a = f.P[1], b = chest(foe), n = Math.ceil(dist(a, b) / 30);
  for (let k = 1; k < n; k++) if (solidAt(lerp(a.x, b.x, k / n), lerp(a.y, b.y, k / n))) return false;
  return true;
}

// Knocked down: lie still and let the body stand up, or scramble away from a nearby foe.
function aiGetUp(f, L, c) {
  const inp = f.inp;
  inp.mx = c.d < 160 && chance(L.edge) ? -c.dir : 0;
  if (f.grounded && c.d < 140 && chance(L.dodge * .5) && f.dashCd <= 0) inp.dash = -c.dir;
  return true;
}

// An orb worth grabbing, or the mode's objective (a zone), when no foe is in our face.
function aiObjective(f, L, c) {
  f.ai.zoneHold = null;
  const zone = hook(G_STATE.mode, 'aiGoal', f), me = f.P[2];
  const inside = !!zone && Math.abs(me.x - zone.x) < zone.w / 2 - 10 && Math.abs(feetY(f) - zone.y) < 30;
  const orb = (!zone || inside) && aiWantedOrb(f, c, L);    // with a zone to take, orbs wait until we're on it
  if (orb) return { x: orb.x, y: orb.y + 42 };
  if (!zone) return null;
  // Holding the zone with a foe close: fight for it, but from inside (aiStayInZone clamps the footwork).
  if (inside && c.d < c.range * 1.6) { f.ai.zoneHold = zone; return null; }
  // Outside: always push in, even past a foe standing on it (armed, so we swing on contact). Far off on the same
  // level: dash toward it.
  const gap = zone.x - me.x;
  if (Math.abs(gap) > zone.w / 2 + 200 && Math.abs(feetY(f) - zone.y) < 40 && f.grounded && f.dashCd <= 0) f.inp.dash = Math.sign(gap);
  return { x: zone.x + (f.id % 2 ? 1 : -1) * Math.min(30, zone.w / 4), y: zone.y, zone: true };
}
// Keeps the footwork chosen by aiMelee/aiRanged inside the zone (no chasing or backing off out of it).
function aiStayInZone(f, zone) {
  const a = f.ai, lo = zone.x - zone.w / 2 + 18, hi = zone.x + zone.w / 2 - 18, me = f.P[2];
  const tx = clamp(a.tx ?? me.x, lo, hi);
  a.tx = tx;
  f.inp.mx = Math.abs(tx - me.x) > 12 ? Math.sign(tx - me.x) : 0;
  if (f.inp.dash && (me.x + f.inp.dash * 160 < lo || me.x + f.inp.dash * 160 > hi)) f.inp.dash = 0;   // no dashing out
  f.inp.jump = false;                  // feet on the hill: no hopping about (aiDodge, after this, may still jump a shot)
}

// Goes for a nearby orb when behind on health (or sometimes anyway).
function aiWantedOrb(f, c, L) {
  const me = f.P[2];
  let best = null;
  for (const o of ORB_LIST) if (!best || Math.abs(o.x - me.x) < Math.abs(best.x - me.x)) best = o;
  if (!best || Math.abs(best.x - me.x) > 460 || best.y < me.y - 380) return null;
  if (f.ai.orbKey !== best) { f.ai.orbKey = best; f.ai.orbWant = f.hp < f.ai.foe.hp || chance(L.orb); }
  if (c.d < c.range * .7 && Math.abs(best.x - me.x) > 120) return null;     // don't turn our back on a foe in reach
  return f.ai.orbWant ? best : null;
}

// Melee footsies: close to just inside reach, swing on contact, back off after a whiff, punish the foe's whiffs.
function aiMelee(f, L, c) {
  const a = f.ai, inp = f.inp, foe = a.foe, me = f.P[2], op = foe.P[2];
  if (aiFlinching(f, foe, c)) { aiGoTo(f, me.x - c.dir * AI_FLINCH.back, null); a.armed = c.d < c.range; return; }
  a.brawl = !!L.brawl && c.d < c.range * 2.4 && !foe.w.ranged && Math.abs(c.dy) < 60 && chance(L.brawl);
  if (a.brawl) { a.armed = true; aiGoTo(f, op.x - c.dir * c.range * .5, feetY(foe)); return; }
  const sweet = L.pick > 0 ? aiMoveBest(f, L).gap : c.range * .55;
  const keep = Math.max(25, sweet + rnd(-1, 1) * L.spacing);
  const foeSwinging = foe.swingT > .05 && c.d < c.foeRange + 50 && !foe.w.ranged;
  const foeOpen = foe.atkCd > .22 && !foe.w.ranged && c.d < c.range * 2.2;     // they just swung: punish
  a.armed = chance(L.attack);
  if (foeSwinging && !foeOpen && chance(L.dodge * .7)) {          // step out of their swing (or hop over it)
    aiGoTo(f, me.x - c.dir * 160, null);
    if (chance(.35) && f.grounded) inp.jump = true;
    a.armed = chance(L.attack * .5);
  } else if (f.atkCd > .25 && c.d < c.range && chance(L.punish * .6)) {
    aiGoTo(f, me.x - c.dir * 90, null);                           // our own swing is recovering: give a step
  } else aiGoTo(f, op.x - c.dir * keep, feetY(foe));
  if (foeOpen && chance(L.punish)) { a.armed = true; if (c.d > c.range * .8) inp.dash = c.dir; }
  if (aiCornered(f, c.dir) && c.d < c.range * 1.4 && chance(L.edge)) aiHopOver(f, c);
  // Rush gunners. A CPU gunner has evasion reflexes to survive it; a human gunner doesn't, so rush them less.
  if (foe.w.ranged && c.d > 220 && chance(aiBrain(foe) ? .4 * L.attack : AI_RUSH_HUMAN * L.attack * Math.min(1, L.react / .14))) inp.dash = c.dir;
  if (c.d > 480 && chance(.18 * L.attack * (aiVsHumanGunner(foe) ? Math.min(1, L.react / .14) : 1))) inp.dash = c.dir;
  if (c.d < c.range * 1.3 && Math.abs(c.dy) < 60 && f.grounded && chance(L.jump * 1.5)) { inp.jump = true; a.armed = true; }
  if (c.dy < -60 && c.d < c.range && !foe.grounded && f.grounded && chance(.5)) inp.jump = true;   // meet them in the air
}

// Ranged spacing: hold a comfortable distance with a clear shot, never get pinned. A melee rusher inside its
// danger zone is escaped by dashing away, or by hopping over it when our back is to a wall or an edge.
function aiRanged(f, L, c) {
  const a = f.ai, inp = f.inp, foe = a.foe, me = f.P[2], op = foe.P[2];
  const near = c.range * (c.style === 'kite' ? .85 : .72), far = c.range * 1.05;
  const rusher = aiStyle(foe) === 'melee', danger = rusher ? Math.max(c.foeRange + 60, 290) : near * .6;   // ~a dash-swing away
  a.fire = c.d < c.range * 1.6 && chance(Math.min(1, L.attack + .15));
  if (c.d < danger) {
    const pinned = aiCornered(f, -c.dir) || aiCornered(f, -c.dir, 220);
    if (pinned && c.d < danger * .8 && chance(.4 + L.edge * .6)) { aiHopOver(f, c); return; }
    aiGoTo(f, me.x - c.dir * 260, null);
    if (f.dashCd <= 0 && !pinned && chance(.25 + L.dodge * .6)) inp.dash = -c.dir;
  } else if (c.d < near * .8) aiGoTo(f, me.x - c.dir * 200, null);
  else if (c.d > far || !a.los) aiGoTo(f, op.x - c.dir * near * 1.2, a.los ? null : feetY(foe));
  else if (c.style === 'kite') aiGoTo(f, me.x - c.dir * 60, null);
  else aiGoTo(f, me.x + rnd(-60, 60), null);                        // in the sweet spot: shuffle so we're not a sitting duck
}

// No safe ground behind us (wall or pit edge) within `room` px in direction -dir.
function aiCornered(f, dir, room = 100) {
  const me = f.P[2], back = me.x - dir * room;
  if (back < 70 || back > W - 70) return true;
  if (!MAP || MAP.floor != null) return false;
  const g = groundBelow(back, feetY(f) - 4);
  return g == null || g > feetY(f) + 200;
}

function aiHopOver(f, c) {
  const inp = f.inp;
  if (f.grounded) inp.jump = true;
  f.ai.nav = { hop: c.dir, t: .6 };
  inp.mx = c.dir;
}

// Projectiles and big swings: jump them, or dash through.
function aiDodge(f, L, c) {
  const inp = f.inp, shot = incoming(f);
  if (!shot) return;
  // A human's shot is judged once (one chance to see it coming), not every decision: a fast-deciding Insane bot
  // otherwise dodged nearly every bullet a human fired. CPU shooters keep the per-decision roll (ladder balance).
  if (shot.owner && !aiBrain(shot.owner)) {
    if (f.ai.dodgeSeen === shot) return;
    f.ai.dodgeSeen = shot;
  }
  if (!chance(L.dodge)) return;
  if (f.grounded || (f.airJumps > 0 && vy(f.P[2]) > -200)) inp.jump = true;
  else if (f.dashCd <= 0 && Math.abs(shot.vy) > Math.abs(shot.vx)) inp.dash = -c.dir;   // a shot from above: slip sideways
}

// Skills: each skill's ai.when says when it makes sense; the level decides how often we notice.
function aiSkills(f, foe, d, L) {
  if (G_STATE.lock > 0) return;
  for (let k = 0; k < 2; k++) {
    const def = SKILLS[f.skills[k]];
    if (!def || f.skillCd[k] > 0 || !chance(L.skill)) continue;
    let ok = false;
    try { ok = def.ai.when(f, foe, d); } catch (e) { report(e, def.key + '.ai.when'); }
    if (ok) f.inp['skill' + (k + 1)] = true;
  }
}

// A passive training partner: wanders, hops, never attacks.
function aiRoam(f) {
  const a = f.ai, me = f.P[2];
  if (!a.roamX || Math.abs(a.roamX - me.x) < 40 || chance(.04)) a.roamX = rnd(160, W - 160);
  aiGoTo(f, a.roamX, null);
  if (chance(.06) && f.grounded) f.inp.jump = true;
}

// Is an enemy projectile about to reach us? Returns it (truthy) or null.
function incoming(f) {
  const c = chest(f);
  for (const p of PROJ) {
    if (p.zone || p.team === f.team || (p.owner && p.owner.team === f.team)) continue;   // zones and pickups aren't shots
    const dx = c.x - p.x, dy = c.y - p.y;
    if (dx * dx + dy * dy < 260 * 260 && dx * p.vx + dy * p.vy > 0) return p;
  }
  return null;
}

// ---------- navigation ----------
// Walk toward x; if gy (a feet height) is well above us, plan a climb onto the best platform within jump reach;
// if it's well below, walk off the nearest edge. The climb itself (jump, double jump) happens in aiNavStep.
function aiGoTo(f, gx, gy) {
  const a = f.ai, me = f.P[2], fy = feetY(f);
  let tx = clamp(gx, 40, W - 40);
  if (!aiLeaping(f)) a.nav = null;
  if (aiLeaping(f)) { a.tx = tx; return; }                // mid-leap: the hop steers until we land
  if (MAP && gy != null && gy < fy - 70) {
    const step = aiStepUp(f, tx, gy, fy);
    if (step) { a.nav = step; tx = step.x; }
  } else if (MAP && gy != null && gy > fy + 70 && f.grounded) {
    const s = aiPlatformUnder(f);
    if (s && tx > s.x - 10 && tx < s.x + s.w + 10) tx = tx - s.x < s.x + s.w - tx ? s.x - 45 : s.x + s.w + 45;
  }
  a.tx = tx;
  f.inp.mx = Math.abs(tx - me.x) > 18 ? Math.sign(tx - me.x) * (aiLevel(f).walk || 1) : 0;   // cautious levels walk slower
}

// A committed hop (over a foe or across a gap) is in progress.
const aiLeaping = f => !!(f.ai.nav && f.ai.nav.hop && f.ai.nav.t > 0);

// The best platform to climb onto next: above us, not above the goal, within double-jump reach, near the goal.
function aiStepUp(f, gx, gy, fy) {
  const me = f.P[2];
  let best = null, bs = Infinity;
  for (const s of MAP.solids) {
    if (s.y >= fy - 40 || s.y < gy - 40 || s.y < 40 || s.w < 40 || fy - s.y > 360) continue;
    const cx = clamp(gx, s.x + 20, s.x + s.w - 20);
    const score = Math.abs(cx - gx) + Math.abs(s.y - gy) * .6 + Math.abs(cx - me.x) * .3;
    if (score < bs) { bs = score; best = s; }
  }
  if (!best) return null;
  let x = clamp(gx, best.x + 25, best.x + best.w - 25);
  const under = me.x > best.x - 10 && me.x < best.x + best.w + 10 && fy > best.y + best.h;
  if (!best.oneWay && under) x = me.x - best.x < best.x + best.w - me.x ? best.x - 55 : best.x + best.w + 55;   // go round a solid block
  return { x, land: clamp(gx, best.x + 25, best.x + best.w - 25), x0: best.x, x1: best.x + best.w, top: best.y, solid: !best.oneWay, s: best };
}

function aiPlatformUnder(f) {
  const me = f.P[2], fy = feetY(f);
  for (const s of MAP.solids) if (me.x > s.x - 4 && me.x < s.x + s.w + 4 && Math.abs(s.y - fy) < 16) return s;
  return null;
}

// Per-step climbing: jump when near the platform, double jump near the apex, then steer onto it.
function aiNavStep(f) {
  const n = f.ai.nav, inp = f.inp, me = f.P[2];
  if (!n) return;
  if (n.hop) {                                               // hopping over a foe or a gap: hold on, double jump, dash
    inp.mx = n.hop;
    if (!f.grounded && f.airJumps > 0 && vy(me) > -150) inp.jump = true;
    if (n.dash && !f.grounded && f.airJumps <= 0 && f.dashCd <= 0) { inp.dash = n.hop; n.dash = false; }
    if (!f.grounded) n.air = true;
    if ((n.t -= DT) <= 0 || (n.air && f.grounded)) f.ai.nav = null;    // done once we land
    return;
  }
  if (n.top == null) return;
  const fy = feetY(f), near = me.x > n.x0 - 110 && me.x < n.x1 + 110;
  const blocked = n.solid && me.x > n.x0 - 8 && me.x < n.x1 + 8 && fy > n.top + 10;   // under a solid block's ceiling
  if (fy < n.top - 6) { inp.mx = Math.abs(n.land - me.x) > 18 ? Math.sign(n.land - me.x) : 0; return; }   // above it: land
  if (blocked) return;
  if (f.grounded && near && fy > n.top + 20 && f.jumpCd <= 0) inp.jump = true;
  else if (!f.grounded && near && f.airJumps > 0 && vy(me) > -260 && fy > n.top + 8) inp.jump = true;
  if (!f.grounded && fy > n.top - 6 && fy < n.top + 120 && vy(me) < 0) inp.mx = Math.sign(clamp(n.land, n.x0 + 30, n.x1 - 30) - me.x) || inp.mx;
}

// Flinching under a human's gunfire: a person stops for a moment when bullets land, and a CPU that walked straight
// through every shot left a human gunner ~23% wins at Insane (~38% at Hard). Each landed shot may make a melee CPU
// hold its approach (no advance, no dash, a small step back) for AI_FLINCH.secs; it still swings if the shooter is in
// reach. reach: flinch only beyond this × our reach (0 = at any distance). Tuned with tmp/fix/gunv.cjs.
// Only against a human gunner: CPU-vs-CPU fights (the ladder, weapon balance) never flinch.
const AI_FLINCH = { secs: .6, back: 90, reach: 0, chance: { easy: .4, normal: .5, hard: .9, insane: .85 } };
on('damage', (B, amt, o) => {
  const A = o && o.src;
  if (!A || (o.kind !== 'proj' && o.kind !== 'explode') || !B.ai || !aiBrain(B) || aiBrain(A) || !A.w || !A.w.ranged || B.w.ranged) return;
  if (chance(AI_FLINCH.chance[B.aiLevel || (G_STATE.cfg && G_STATE.cfg.diff)] ?? .45)) { B.ai.flinch = G_STATE.t + AI_FLINCH.secs; B.ai.t = 0; }   // a flinch is a reflex: decide now
});
const aiFlinching = (f, foe, c) => f.ai.flinch > G_STATE.t && aiVsHumanGunner(foe) && c.d > c.range * AI_FLINCH.reach;

// ---------- reflexes (every step) ----------
function aiMicro(f, L, dt) {
  const a = f.ai, foe = a.foe, inp = f.inp;
  aiNavStep(f);
  aiUnstick(f, dt);
  aiMoveLearn(f);
  if (!foe || !foe.alive || G_STATE.lock > 0 || !canAct(f)) return;
  if (aiStyle(f) !== 'melee') aiEvadeDash(f, L, foe);
  if (f.w.ranged || a.fire) aiShoot(f, L, foe);
  else if (a.queue && G_STATE.t >= a.queue) { inp.attack = true; a.queue = 0; }      // the swing that follows a dash/jump
  else if (a.armed && !a.queue && f.atkCd <= 0) aiTryMove(f, L, foe);
  if (f.w.ai.think && f.w.ranged) hook(f.w.ai, 'think', f, foe, Math.abs(foe.P[2].x - f.P[2].x));   // charge/hold weapons
}

// A human with a gun has none of the CPU gunner's evasion reflexes, so the dash- and jump-in tactics that beat
// CPU gunners crushed human ones (~20% wins at Hard). Against them only this share of decisions may use them.
const AI_GUNNER_CLOSE = .4;
const aiVsHumanGunner = foe => !!foe && !!foe.w.ranged && !aiBrain(foe);
const AI_RUSH_HUMAN = .12;  // chance factor (× attack) to dash-rush a human gunner per decision (CPU gunners: .4)
const AI_BRAWL_WIDE = 25;   // px beyond reach where a brawling CPU starts its swing (the tip needs time to get fast)
// Melee: pick the tactic that has paid off best at this distance and do it (or keep closing in).
function aiTryMove(f, L, foe) {
  const a = f.ai, inp = f.inp, me = f.P[2], op = foe.P[2];
  const gap = Math.abs(op.x + (vx(op) - vx(me)) * .08 - me.x), dir = Math.sign(op.x - me.x) || f.face;
  const range = aiReach(f);
  if (Math.abs(feetY(foe) - feetY(f)) > range * .9 + 20) return;
  let k = null;
  if (a.brawl) k = gap < range + AI_BRAWL_WIDE ? 'g' : null;   // pressure: plain swings, started a bit early
  else if (L.pick <= 0) k = gap < range + L.wide ? 'g' : null;
  else {
    const here = aiMoveAt(f, L, gap), best = aiMoveBest(f, L);
    if (here.k && here.v > 0 && here.v >= best.v * L.pick && (here.k !== 'g' || gap < range + L.wide)) k = here.k;
  }
  if (k && k !== 'g' && a.gapClose === false) k = null;      // this decision: no dash/jump-in at a human gunner
  if (k && k !== 'g' && (a.zoneHold || a.zonePush)) k = gap < range + L.wide ? 'g' : null;   // zone: plain swings, no leaving it
  if (!k) return;
  a.armed = false;
  if (k === 'g') inp.attack = true;
  else if (k === 'j') { inp.jump = true; a.queue = G_STATE.t + .14; }
  else { inp.dash = dir; a.queue = G_STATE.t + .05; }
  (a.moves = a.moves || []).push({ t: G_STATE.t, w: f.w, k, slot: aiMoveSlot(f, gap), dmg0: f.stats.dmgDealt, hurt0: f.stats.dmgTaken });
}

// ---------- learned tactics ----------
// Where melee attacks actually land differs a lot from a weapon's nominal range: a sword spins over the top and only
// connects up close, a spear thrusts far, a flail's ball lands mid-range, and a dash or jump into a swing adds the
// speed that makes hits count. Every CPU attack is recorded per weapon as (tactic, hip gap) -> damage dealt in the
// next 0.55 s, shared by all CPUs for the session. Smarter levels choose the best-paying option; new weapons
// (custom attacks too) are learned the same way, starting from a prior based on the weapon's shape.
const AI_MOVES = {}, MOVE_STEP = 20, MOVE_N = 17, MOVE_PRIOR = 4;
function aiMoveTable(w) {
  let t = AI_MOVES[w.key];
  if (t) return t;
  const sweet = w.chain ? w.len * 1.2 : w.len * .8;
  const prior = { g: gap => Math.max(.5, 6 - Math.abs(gap - sweet) / 12), j: gap => gap > 120 && gap < 250 ? 4 : .5,
    d: gap => gap > 110 && gap < 300 ? 6 : .5 };
  t = AI_MOVES[w.key] = {};
  for (const k of 'gjd') t[k] = Array.from({ length: MOVE_N }, (_, i) => ({ n: MOVE_PRIOR, sum: prior[k]((i + .5) * MOVE_STEP) * MOVE_PRIOR }));
  return t;
}
const aiMoveScale = f => f.scale * (f.status.giant ? 1.4 : 1);
const aiMoveSlot = (f, gap) => clamp(Math.floor(gap / aiMoveScale(f) / MOVE_STEP), 0, MOVE_N - 1);
// Tactics usable right now: jumps need the ground under us, dashes need the cooldown.
const aiMovesNow = (f, L) => [...L.moves].filter(k => k === 'g' || (k === 'j' ? f.grounded && f.jumpCd <= 0 : f.dashCd <= 0));
// The best usable tactic at this gap: { k, v }.
function aiMoveAt(f, L, gap) {
  const t = aiMoveTable(f.w), i = aiMoveSlot(f, gap);
  let best = { k: null, v: -1 };
  for (const k of aiMovesNow(f, L)) { const v = t[k][i].sum / t[k][i].n; if (v > best.v) best = { k, v }; }
  return best;
}
// The best usable (tactic, gap) overall: where to hover. Returns { k, gap (px, scaled to us), v }.
function aiMoveBest(f, L) {
  const t = aiMoveTable(f.w);
  let best = { k: 'g', gap: 60, v: 0 };
  for (const k of aiMovesNow(f, L)) for (let i = 0; i < MOVE_N; i++) {
    const v = t[k][i].sum / t[k][i].n;
    if (v > best.v) best = { k, gap: (i + .5) * MOVE_STEP * aiMoveScale(f), v };
  }
  return best;
}
function aiMoveLearn(f) {
  const list = f.ai.moves;
  while (list && list.length && G_STATE.t - list[0].t > .55) {
    const m = list.shift(), b = aiMoveTable(m.w)[m.k][m.slot];
    b.n++; b.sum += clamp(f.stats.dmgDealt - m.dmg0 - (f.stats.dmgTaken - m.hurt0) * .6, -20, 30);   // net: trades count against
    if (b.n > 160) { b.n /= 2; b.sum /= 2; }       // forget slowly so it keeps adapting
  }
}

// Shooters: a melee foe dashing at us gets jumped over (decided once per dash; better levels react more often).
function aiEvadeDash(f, L, foe) {
  const a = f.ai, me = f.P[2], op = foe.P[2], gap = op.x - me.x;
  if (foe.dashT <= 0 || foe.w.ai.style !== 'melee') { a.sawDash = false; return; }
  if (a.sawDash || Math.abs(gap) > 330 || vx(op) * gap > 0) return;     // only dashes coming toward us
  a.sawDash = true;
  if (!chance(.2 + L.dodge * .75)) return;
  const away = -Math.sign(gap) || -f.face;
  if (f.dashCd <= 0 && !aiCornered(f, -away, 200)) f.inp.dash = away;          // match their dash, keep the distance
  else if (f.grounded) { f.inp.jump = true; a.nav = { hop: -away, t: .5 }; }    // no room or no dash: hop over them
}

// Ranged: steer our aim (leading moving targets, arcing lobbed shots) and fire when lined up.
function aiShoot(f, L, foe) {
  const a = f.ai, inp = f.inp, r = f.w.ranged;
  const lined = (r ? Math.abs(aiAim(f, L, foe, r)) < .45 : true);   // custom-attack casters just fire
  inp.attackHeld = !!(a.fire && lined);
  if (a.fire && lined && f.atkCd <= 0 && f.reload <= 0) inp.attack = true;
}

// The core aims at the nearest visible enemy with smoothing (aim += diff × .18 per step). Adding a bias b each step
// settles that smoothing on core + b × .82 / .18, so we pick b to make it settle on the angle we want.
function aiAim(f, L, foe, r) {
  const neck = f.P[1], tc = chest(foe), spd = r.speed || 1400;
  const t = Math.min(1.2, dist(neck, tc) / spd), lead = L.lead * t;
  const x = tc.x + vx(foe.P[2]) * lead, y = tc.y + vy(foe.P[2]) * lead * .5;
  const g = ((r.proj && r.proj.grav) || 0) * PHYS.gravity;
  const want = Math.atan2(y - .5 * g * t * t * Math.min(1, L.lead + .3) - neck.y, x - neck.x) + (f.ai.aimErr || 0);
  const core = nearestEnemy(f, true), coreAng = core ? angleTo(neck, chest(core)) : f.aim;
  if (!f.status.stun && !f.status.freeze) f.aim += aiWrap(want - coreAng) * .18 / .82;
  return aiWrap(want - f.aim);
}

// Walking into something for a while without moving: hop, or try the other way.
function aiUnstick(f, dt) {
  const a = f.ai, me = f.P[2];
  if (!f.inp.mx || !f.grounded) { a.stuckT = 0; a.stuckX = me.x; return; }
  if (Math.abs(me.x - (a.stuckX ?? me.x)) > 25) { a.stuckT = 0; a.stuckX = me.x; return; }
  if ((a.stuckT = (a.stuckT || 0) + dt) > .7) { f.inp.jump = true; a.stuckT = 0; }
}

// ---------- safety (every step) ----------
// Don't walk into hazards or off ledges over pits, and climb back when falling.
function aiSafety(f) {
  const inp = f.inp, me = f.P[2], fy = feetY(f);
  for (const hz of MAP.hazards) {
    if (!hz.dps && !hz.status && !hz.avoid) continue;   // avoid: a map's warning marker (strike incoming)
    if (inRect(me.x, fy - 6, hz, 8)) { inp.mx = me.x < hz.x + hz.w / 2 ? -1 : 1; if (f.grounded) inp.jump = true; return; }
    if (aiLeaping(f)) continue;                         // a committed leap over the hazard steers itself
    const dashEnd = me.x + (inp.dash || 0) * 230;   // don't dash into a hazard (maps: lava, spikes, warnings)
    if (inp.dash && dashEnd > hz.x - 20 && dashEnd < hz.x + hz.w + 20 && fy > hz.y - 50 && fy < hz.y + hz.h + 40) inp.dash = 0;
    const ahead = me.x + inp.mx * 80;
    if (inp.mx && ahead > hz.x - 10 && ahead < hz.x + hz.w + 10 && fy > hz.y - 50 && fy < hz.y + hz.h + 40) {
      if (f.grounded && aiLeapHazard(f, hz)) continue;
      if (hz.w < 180 && f.grounded && Math.abs(vx(me)) > 200) inp.jump = true; else if (f.grounded) inp.mx = 0;
      else if (vy(me) > 0 && hz.w >= 180) inp.mx = -inp.mx;   // falling toward a wide hazard: steer back
    }
  }
  aiAvoidZones(f, aiLevel(f));
  if (MAP.floor != null) return;
  if (inp.dash) {                                           // never dash off the stage
    const g = groundBelow(me.x + inp.dash * 230, fy - 4);
    if (g == null || g > fy + 260) inp.dash = 0;
  }
  if (f.grounded && inp.mx && !(f.ai.nav && f.ai.nav.hop)) {
    const g = groundBelow(me.x + inp.mx * 55, fy - 4);
    if (g == null || g > fy + 260) aiCrossGap(f, inp.mx);
  }
  if (!f.grounded) aiRecover(f);
}

// A floor hazard (lava, spikes) between us and where we're going: leap it with jump, double jump and, if it's
// wide, an air dash, instead of waiting at its edge forever. Warning markers (no damage) are just waited out.
function aiLeapHazard(f, hz) {
  const me = f.P[2], a = f.ai, dir = Math.sign(f.inp.mx) || f.face;
  const farEdge = dir > 0 ? hz.x + hz.w : hz.x;
  if (!hz.dps || hz.w > 420 || ((a.tx ?? me.x) - farEdge) * dir < 10) return false;
  f.inp.jump = true;
  a.nav = { hop: dir, t: 1.2, dash: hz.w > 200 };
  return true;
}

// Enemy skill zones with a `danger` radius (poison clouds, mines, lightning and meteor marks): step out of them and
// don't walk in. Each CPU notices a given zone with a chance that grows with its dodge skill.
function aiAvoidZones(f, L) {
  const inp = f.inp, me = f.P[2], fy = feetY(f);
  for (const z of PROJ) {
    if (!z.zone || !z.danger || z.dead || z.team === f.team) continue;
    const seen = z.seenBy || (z.seenBy = {});
    if (seen[f.id] === undefined) seen[f.id] = chance(.25 + L.dodge * .75);
    if (!seen[f.id] || Math.abs(fy - z.y) > z.danger + 70) continue;
    const dx = me.x - z.x, away = Math.sign(dx) || -f.face;
    if (Math.abs(dx) < z.danger) { inp.mx = away; if (f.grounded && Math.abs(dx) < z.danger * .5) inp.jump = true; }
    else if (inp.mx && Math.sign(inp.mx) === -away && Math.abs(dx) < z.danger + 60 && f.grounded) inp.mx = 0;
  }
}

// At a pit edge: if where we're going lies beyond the gap and there's ground in reach, leap it (double jump, then
// dash if it's wide); otherwise stop at the edge.
function aiCrossGap(f, dir) {
  const me = f.P[2], fy = feetY(f), a = f.ai, beyond = ((a.tx ?? me.x) - me.x) * dir > 90;
  let land = null;
  for (let d = 60; d <= 420 && beyond; d += 20) {
    const g = groundBelow(me.x + dir * d, fy - 200);
    if (g != null && g <= fy + 120) { land = d; break; }
  }
  if (land == null) { f.inp.mx = 0; return; }
  f.inp.jump = true;
  a.nav = { hop: dir, t: 1.1, dash: land > 230 };
}

// Over a pit: steer toward the nearest platform and use the double jump (and dash) on the way down.
function aiRecover(f) {
  const me = f.P[2], fy = feetY(f), g = groundBelow(me.x, fy);
  if (g != null && g < fy + 300) return;
  const hop = f.ai.nav && f.ai.nav.hop;                     // mid-leap: only look ahead, not back where we came from
  let best = null, bd = Infinity;
  for (const s of MAP.solids) {
    const x = clamp(me.x, s.x + 24, s.x + s.w - 24), d = Math.abs(x - me.x) + Math.max(0, fy - s.y) * .6;
    if (hop && (x - me.x) * hop < -10) continue;
    if (s.y > 40 && d < bd) { bd = d; best = { x, y: s.y }; }
  }
  if (!best) return;
  f.inp.mx = Math.sign(best.x - me.x);
  if (vy(me) > 0 && f.airJumps > 0) f.inp.jump = true;
  if (vy(me) > 150 && f.dashCd <= 0 && Math.abs(best.x - me.x) > 160) f.inp.dash = Math.sign(best.x - me.x);
}
