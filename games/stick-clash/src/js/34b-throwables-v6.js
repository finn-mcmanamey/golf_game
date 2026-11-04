// 34b-throwables-v6.js: Glue Bomb, Bouncer, Tornado Jar and Rubber Duck, plus the whirlwind zone 53's Tornado shares and
// the lure that makes CPUs attack a duck. Built on 34's thrBase and 50's skillZone; nothing here is weapon-scaled.

// ---------- shared helpers ----------
// The solid a zone at (x, y) stands on (to ride a moving platform), or null for the floor.
function zoneSolidAt(x, y) {
  return MAP ? MAP.solids.find(s => !mapParked(s) && x >= s.x && x <= s.x + s.w && Math.abs(s.y - y) < 3) || null : null;
}
// Moves a ground zone with its platform; false (and the zone is gone) once that platform broke or was parked.
function zoneRide(z) {
  if (!z.on) return true;
  if (mapParked(z.on) || z.on.broken) { z.dead = true; return false; }
  z.x += z.on.dx; z.y += z.on.dy;
  return true;
}
// Ground under a landed throwable, or null over a pit (it is lost).
const thrLandY = p => { const g = groundBelow(clamp(p.x, 1, W - 1), p.y - 30); return g != null && g - p.y < 280 ? g : null; };

// ---------- whirlwind: drifts toward foes along the ground, lifting and carrying anyone caught inside ----------
// o: { life, radius (half width), height, speed (px/s), dir, dps, lift (strength), color, kind }

function whirlSpawn(owner, x, gy, o) {
  const r = o.radius || 55;
  return skillZone(Object.assign({ owner, x, y: gy, life: 2, radius: r, height: 180, speed: 80, dir: owner.face || 1, dps: 3, lift: 1,
    color: '#bfe9ff', kind: 'whirl', tick: .3, on: zoneSolidAt(x, gy), onStep: whirlStep, draw: whirlDraw }, o, { danger: r + 25 }));
}
function whirlStep(z, dt) {
  if (!zoneRide(z)) return;
  whirlDrift(z, dt);
  const caught = whirlCatch(z);
  if ((z.tick -= dt) > 0) return;
  z.tick = .3;
  for (const e of caught) damage(e, z.dps * .3, { src: z.owner, kind: 'status', color: z.color, small: true });
}
// Turns back at walls, ledges and drops, so it never carries anyone over a pit.
function whirlDrift(z, dt) {
  if (z.on) return;                                           // on a moving platform it just rides along
  const nx = z.x + z.dir * z.speed * dt, g = groundBelow(nx, z.y - 40);
  if (nx < 40 || nx > W - 40 || g == null || Math.abs(g - z.y) > 30) { z.dir = -z.dir; return; }
  z.x = nx; z.y = g;
}
// Foes inside rise toward the funnel's middle and are carried with it (big fighters less).
function whirlCatch(z) {
  const out = [];
  for (const e of F) {
    const hip = e.P[2];
    if (!e.alive || e.team === z.team || e.heldBy || (e.mount && e.mount.carried)) continue;
    if (Math.abs(hip.x - z.x) > z.radius + 12 * e.scale || hip.y < z.y - z.height - 40 || hip.y > z.y + 10) continue;
    out.push(e);
    const k = clamp(z.lift / (e.scale * e.scale), 0, 1.2), top = z.y - z.height * .85 + Math.sin(z.t * 5 + e.id) * 18;
    const wantVy = clamp((top - hip.y) * 7, -850, 300), wantVx = z.dir * z.speed + (z.x - hip.x) * 4;
    for (const p of e.P) { p.oy = p.y - lerp(vy(p), wantVy, .2 * k) * DT; p.ox = p.x - lerp(vx(p), wantVx, .1 * k) * DT; }
    e.stagger = Math.max(e.stagger, .08);
  }
  return out;
}
// A funnel of spinning rings widening upward, with dust specks circling it.
function whirlDraw(ctx, z) {
  const fade = clamp(Math.min(z.t * 5, (z.life - z.t) * 3), 0, 1), n = Math.round(z.height / 26);
  ctx.save();
  for (let k = 0; k < n; k++) {
    const h = k / (n - 1), y = z.y - h * z.height, rx = z.radius * (.35 + h * .75);
    ctx.globalAlpha = fade * (.7 - h * .3); ctx.strokeStyle = k % 2 ? z.color : '#ffffff'; ctx.lineWidth = 4 - h * 2;
    ctx.beginPath(); ctx.ellipse(z.x + Math.sin(z.t * 7 + k) * 10 * h, y, rx, rx * .22, 0, z.t * 9 + k, z.t * 9 + k + 4.2); ctx.stroke();
    circle(ctx, z.x + Math.cos(z.t * 6 + k * 2.3) * rx, y, 2.5, '#d8c9a8');
  }
  ctx.restore();
}

// ---------- Glue Bomb: a puddle that slows ----------
defStatus('glued', { name: 'Glued', icon: '◍', color: '#b6ff3a', debuff: true, max: 3, moveMul: .4,
  draw(ctx, f) { for (const j of [8, 10]) circle(ctx, f.P[j].x, f.P[j].y - 3 * f.scale, 7 * f.scale, rgba('#7fcf1f', .8)); } });

defThrowable('glue', { name: 'Glue Bomb', icon: '◍', color: '#b6ff3a', order: 70,
  desc: 'Splats into a sticky green puddle for 5 s. Foes wading through it slow to a crawl.', ai: { min: 110, max: 480 },
  throw: (f, aim) => spawnProj(thrBase(f, aim, { color: '#b6ff3a', life: 1.6, draw: glueDrawBomb, onExpire: glueSplat })) });

function glueSplat(p) {
  const gy = thrLandY(p), x = clamp(p.x, 40, W - 40);
  if (gy == null) return;
  skillZone({ owner: p.owner, x, y: gy, life: 5, kind: 'glue', w: 78, danger: 70, on: zoneSolidAt(x, gy), onStep: glueStep, draw: glueDrawPuddle });
  burst(x, gy, '#b6ff3a', 16, 260); sfx('rift-splat');
}
function glueStep(z) {
  if (!zoneRide(z)) return;
  for (const e of F) if (e.alive && e.team !== z.team && Math.abs(e.P[2].x - z.x) < z.w && Math.abs(feetY(e) - z.y) < 18) addStatus(e, 'glued', .4, 1, z.owner);
}
function glueDrawBomb(ctx, p) { circle(ctx, p.x, p.y, 8, '#7fcf1f', '#07080f', 2); circle(ctx, p.x - 2, p.y - 3, 3, '#e6ffb0'); }
function glueDrawPuddle(ctx, z) {
  ctx.save(); ctx.globalAlpha = .8 * clamp(Math.min(z.t * 6, (z.life - z.t) * 2), 0, 1);
  ctx.fillStyle = '#5fa012'; ctx.beginPath(); ctx.ellipse(z.x, z.y - 2, z.w, 9, 0, 0, TAU); ctx.fill();
  for (let k = 0; k < 5; k++) circle(ctx, z.x + (k / 4 - .5) * z.w * 1.1, z.y - 4, 7 + (k % 3) * 2 + Math.sin(z.t * 3 + k) * 1.5, '#86d61c');
  ctx.restore();
}

// ---------- Bouncer: a rubber ball that ricochets and knocks back ----------
defThrowable('bouncer', { name: 'Bouncer', icon: '◓', color: '#ff4a6a', order: 80,
  desc: 'A rubber ball that ricochets off walls, floors and foes, up to 3 hits, knocking each one back hard.', ai: { min: 80, max: 620 },
  throw: (f, aim) => spawnProj(thrBase(f, { ...aim, vx: aim.vx * 1.15 }, { color: '#ff4a6a', r: 9, life: 3.2, bounce: 9, dmg: 7, kb: 860, pierce: 2,
    draw: bouncerDraw, onBounce: bouncerBounce, onHit: bouncerHit })) });

// Rubber is livelier than the core bounce, and a wall bounce lets it hit the same foe again.
function bouncerBounce(p) { p.vy *= 1.25; p.hits = []; p.boingT = p.t; sfx('mapBoing', .4); }
function bouncerHit(p) { p.vx = -p.vx * .75; p.vy = -Math.abs(p.vy) * .5 - 380; p.dmg *= .75; p.boingT = p.t; sfx('mapBoing', .8); }
function bouncerDraw(ctx, p) {
  const sq = 1 - .25 * clamp(1 - (p.t - (p.boingT ?? -9)) / .12, 0, 1);   // squashed for a moment after each bounce
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1 / sq, sq); ctx.rotate(p.t * 9);
  circle(ctx, 0, 0, p.r, '#ff4a6a', '#07080f', 2);
  lineXY(ctx, -p.r + 2, 0, p.r - 2, 0, '#ffd84a', 4);
  ctx.restore();
}

// ---------- Tornado Jar: a small whirlwind ----------
defThrowable('tornado-jar', { name: 'Tornado Jar', icon: '⚗', color: '#bfe9ff', order: 90,
  desc: 'A jar of captured wind. It shatters into a small whirlwind that lifts and spins foes for 2 s.', ai: { min: 140, max: 520 },
  throw: (f, aim) => spawnProj(thrBase(f, aim, { color: '#bfe9ff', life: 1.6, draw: jarDraw, onExpire: jarShatter })) });

function jarShatter(p) {
  const gy = thrLandY(p);
  burst(p.x, p.y, '#e6fbff', 14, 300); sfx('brkGlass', .6);
  if (gy == null || !p.owner) return;
  whirlSpawn(p.owner, clamp(p.x, 40, W - 40), gy, { life: 2.2, radius: 50, height: 170, speed: 70, dps: 3, lift: .85, kind: 'tornado-jar' });
  sfx('arWhirr', .6);
}
function jarDraw(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 7);
  ctx.fillStyle = 'rgba(191,233,255,.35)'; ctx.strokeStyle = '#e6fbff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 2, 7, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a6a4a'; ctx.fillRect(-4, -10, 8, 4);                                   // cork
  ctx.restore();
}

// ---------- Rubber Duck: a squeaky decoy that CPUs attack; it pops in a small blast ----------
const DUCK = { life: 6, lure: 520, popR: 90, popDmg: 12, touch: 28 };
const DUCKS = { seen: -9 };      // game time a duck last sat on the floor (the CPU lure only looks while one does)

defThrowable('duck', { name: 'Rubber Duck', icon: '🦆', color: '#ffd84a', order: 100, ai: { min: 90, max: 460 },
  desc: 'A squeaky decoy lobbed in front of you. CPUs can\'t resist attacking it; it pops in a small blast when hit, stepped on or after 6 s.',
  throw: (f, aim) => spawnProj(thrBase(f, { ...aim, vx: aim.vx * .55, vy: Math.min(aim.vy, -380) }, { color: '#ffd84a', bounce: 1, life: 1.6, pierce: 99,
    draw: duckDraw, onBounce: duckLand })) });

// First touch of the floor: it sits there as a zone (like the mine) and starts squeaking.
function duckLand(p) {
  const gy = thrLandY(p);
  if (p.duck) return;
  Object.assign(p, { duck: true, face: Math.sign(p.vx) || 1, vx: 0, vy: 0, grav: 0, solid: false, r: -1e4, bounce: 0, zone: true,
    popAt: p.t + DUCK.life, life: p.t + DUCK.life + 1, sq: p.t, onStep: duckStep, on: gy != null ? zoneSolidAt(p.x, gy) : null });
  if (gy != null) p.y = gy;
  sfx('s6-squeak', .7);
}
function duckStep(p) {
  DUCKS.seen = G_STATE.t;
  if (!zoneRide(p)) return;
  if (p.t - p.sq > 1.1) { p.sq = p.t; sfx('s6-squeak', .35); }
  if (p.t >= p.popAt || duckTouched(p)) duckPop(p);
}
// An enemy weapon swung into it, an enemy foot on it, or an enemy shot.
function duckTouched(p) {
  const near = (o, r) => Math.hypot(o.x - p.x, o.y - p.y + 14) < r;
  return enemyTipHits(p.team, t => near(t, 30)) || enemyShotsHit(p.team, s => near(s, 16 + s.r)) > 0 ||
    F.some(e => e.alive && e.team !== p.team && [8, 10].some(j => Math.hypot(e.P[j].x - p.x, e.P[j].y - p.y) < DUCK.touch * e.scale));
}
function duckPop(p) {
  if (p.dead) return;
  p.dead = true;
  explode(p.x, p.y - 16, DUCK.popR, DUCK.popDmg, p.owner, { color: '#ffd84a', kb: 560, kind: 'skill', team: p.team });
  burst(p.x, p.y - 16, '#ffffff', 12, 340);
  float(p.x, p.y - 56, 'POP!', '#ffd84a', 26);
  sfx('s6-squeak', 1.2);
}
function duckDraw(ctx, p) {
  const sit = p.duck, squish = sit && p.t - p.sq < .15 ? .8 : 1, y = p.y - (sit ? 10 - Math.sin(p.t * 6) * 1.5 : 0);
  ctx.save(); ctx.translate(p.x, y); ctx.scale(p.face || 1, squish); if (!sit) ctx.rotate(p.t * 8);
  ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#c79a1e'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 13, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();               // body
  circle(ctx, 7, -9, 6.5, '#ffd84a', '#c79a1e', 1.5);                                       // head
  poly(ctx, [[12, -10], [19, -8], [12, -6]], '#ff8a2e');                                   // beak
  circle(ctx, 8.5, -11, 1.4, '#0b0c18');
  ctx.restore();
}

// CPUs on the other team that notice a duck (smarter levels see through it more often) go and whack it.
function duckLure(f) {
  if (G_STATE.t - DUCKS.seen > .05 || !f.alive || !canAct(f) || f.holding || f.mount || aiStyle(f) !== 'melee') return;
  const me = f.P[2], fy = feetY(f);
  const duck = PROJ.find(p => {
    if (!p.duck || p.dead || p.team === f.team || Math.abs(p.x - me.x) > DUCK.lure || Math.abs(p.y - fy) > 200) return false;
    const seen = p.lured || (p.lured = {});
    if (seen[f.id] === undefined) seen[f.id] = chance(1 - aiLevel(f).dodge * .6);
    return seen[f.id];
  });
  if (!duck) return;
  const dx = duck.x - me.x, reach = aiReach(f) * .8;
  f.inp.mx = Math.abs(dx) > reach * .45 ? Math.sign(dx) : 0;
  f.face = Math.sign(dx) || f.face;
  if (Math.abs(dx) < reach && Math.abs(duck.y - fy) < 90 && f.atkCd <= 0) f.inp.attack = true;
  aiSafety(f);                                 // still mind the hazards and ledges on the way
}

THINK_AFTER.push(duckLure);
on('boot', () => {
  defSfx('s6-squeak', v => { tone(1500, 2300, .07, 'square', .05 * v); tone(2300, 1300, .09, 'square', .045 * v, .07); });
});
