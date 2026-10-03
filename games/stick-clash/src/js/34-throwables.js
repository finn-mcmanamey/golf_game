// 34-throwables.js: hand-thrown items. Each fighter brings two picks from the loadout and can throw each once per
// round (the Gunner class gets one extra). The throw key lobs the next one in an arc toward the nearest visible foe.
// Throwables deal kind 'skill' damage (never scaled by the weapon held) and their blasts can be blocked, not parried.
// Add one with defThrowable(key, { name, icon, color, desc, throw(f, aim) -> proj, ai: { min, max, when(f, foe, d) } }).

const THROW = { cd: .45, grav: .85, minT: .35, maxT: .95, speed: 650, maxV: 1250 };

// 'random' picks a visible throwable; 'none'/unknown leaves the slot empty. No list (summons, previews) = none.
function resolveThrows(keys) {
  const list = Array.isArray(keys) ? keys : [null, null];
  return [0, 1].map(i => list[i] === 'random' ? randomKey(THROWABLES) : THROWABLES[list[i]] ? list[i] : null);
}

// An arc from the throwing hand that lands on the foe's chest (leading a moving foe a little).
function throwAim(f) {
  const hand = f.P[6], foe = nearestEnemy(f, true);
  if (!foe) return { x: hand.x, y: hand.y, vx: f.face * 620, vy: -520, foe: null };
  const c = chest(foe), dx = c.x + vx(foe.P[2]) * .25 - hand.x, dy = c.y - hand.y;
  const T = clamp(Math.abs(dx) / THROW.speed, THROW.minT, THROW.maxT), g = PHYS.gravity * THROW.grav;
  let vxx = dx / T, vyy = (dy - .5 * g * T * T) / T;
  const sp = Math.hypot(vxx, vyy);
  if (sp > THROW.maxV) { vxx *= THROW.maxV / sp; vyy *= THROW.maxV / sp; }
  return { x: hand.x, y: hand.y, vx: vxx, vy: vyy, foe };
}

// Throws the next throwable left this round. Returns the projectile (or null).
function throwNext(f) {
  const slot = f.throwN[0] > 0 ? 0 : f.throwN[1] > 0 ? 1 : -1, def = slot >= 0 && THROWABLES[f.throws[slot]];
  if (!def || f.mount) return null;
  const p = hook(def, 'throw', f, throwAim(f));
  if (!p) return null;
  f.throwN[slot]--; f.throwCd = THROW.cd; f.stats.thrown++;
  kick(f.P[6], f.face * 700, -300); kick(f.P[5], f.face * 300, -100);
  sfx('swing', .7);
  emit('throwable', f, def.key, p);
  return p;
}

// Base options every thrown item shares.
function thrBase(f, aim, o) {
  return Object.assign({ owner: f, x: aim.x, y: aim.y, vx: aim.vx, vy: aim.vy, r: 6, grav: THROW.grav, dmg: 0, life: 2, trail: false,
    kind: 'throwable', dmgKind: 'skill', blastKind: 'skill', solid: true, kb: 520 }, o);
}

// ---------- the throwables ----------
defThrowable('grenade', { name: 'Grenade', icon: '●', color: '#9dff5a', order: 10,
  desc: 'Bounces about, then blows up after 1.5 s (or on contact).', ai: { min: 200, max: 560 },
  throw: (f, aim) => spawnProj(thrBase(f, aim, { color: '#9dff5a', bounce: 6, life: 1.5, dmg: 24, explode: 120, draw: thrDrawBall })) });

defThrowable('sticky', { name: 'Sticky Bomb', icon: '◉', color: '#ff5ad1', order: 20,
  desc: 'Sticks to the first fighter or wall it touches and explodes a moment later.', ai: { min: 110, max: 420 },
  throw: (f, aim) => spawnProj(thrBase(f, aim, { color: '#ff5ad1', bounce: 1, life: 2.4, pierce: 99, draw: thrDrawSticky,
    onHit: (p, B) => thrStick(p, B), onBounce: p => thrStick(p, null), onStep: thrStickStep })) });

defThrowable('mine', { name: 'Proximity Mine', icon: '✕', color: '#ff4a6a', order: 30,
  desc: 'Lands and arms itself. The first foe to step close sets it off.',
  ai: { min: 0, max: 300, when: (f, foe, d) => d < 300 && (foe.P[2].x - f.P[2].x) * vx(foe.P[2]) < 0 },
  throw: (f, aim) => spawnProj(thrBase(f, { ...aim, vx: aim.vx * .5, vy: Math.min(aim.vy, -300) }, { color: '#ff4a6a', bounce: 1, life: 14, pierce: 99,
    draw: thrDrawMine, onBounce: thrMineLand, onStep: thrMineStep })) });

defThrowable('smoke', { name: 'Smoke Bomb', icon: '☁', color: '#c9cdee', order: 40,
  desc: 'A thick cloud: anyone inside is hidden from sight and aim.',
  ai: { min: 0, max: 400, when: (f, foe, d) => f.hp < f.maxHp * .45 || (foe.w.ranged && d > 220) },
  throw: (f, aim) => spawnProj(thrBase(f, { ...aim, vx: aim.vx * .6, vy: aim.vy * .8 }, { color: '#c9cdee', bounce: 0, life: .9, pierce: 99,
    draw: thrDrawBall, onExpire: thrSmokeCloud })) });

defThrowable('ice', { name: 'Ice Bomb', icon: '❄', color: '#9fe8ff', order: 50,
  desc: 'Shatters on impact and freezes everyone nearby for 1.2 s.', ai: { min: 110, max: 450 },
  throw: (f, aim) => spawnProj(thrBase(f, aim, { color: '#9fe8ff', life: 1.6, draw: thrDrawIce, onExpire: thrIceBurst })) });

defThrowable('cluster', { name: 'Cluster Bomb', icon: '⁂', color: '#ffb347', order: 60,
  desc: 'Pops after a second and scatters five bomblets.', ai: { min: 220, max: 620 },
  throw: (f, aim) => spawnProj(thrBase(f, aim, { color: '#ffb347', bounce: 3, life: 1, dmg: 8, explode: 70, draw: thrDrawBall, onExpire: thrClusterSplit })) });

// ---------- behaviours ----------
// Sticky: glue onto a fighter (follows its chest) or the spot it hit, then blow 1.1 s later.
function thrStick(p, B) {
  if (p.stuck != null) return;
  p.stuck = B ? 1 : 0; p.on = B; p.vx = p.vy = 0; p.grav = 0; p.solid = false; p.r = -1e4; p.bounce = 0;
  if (B) { const c = chest(B); p.offX = p.x - c.x; p.offY = p.y - c.y; }
  p.life = p.t + 1.1; p.explode = 105; p.dmg = 26;
  sfx('trap', .6);
}
function thrStickStep(p) {
  if (p.stuck == null && p.t > 2.2) { p.explode = 105; p.dmg = 26; }   // never stuck: still blows at the end of its flight
  if (!p.on) return;
  if (!p.on.alive) { p.on = null; return; }
  const c = chest(p.on); p.x = c.x + p.offX; p.y = c.y + p.offY;
}

// Mine: lands flat, arms after .5 s, and waits for a foe's feet to come within 48 px.
function thrMineLand(p) {
  if (p.armAt) return;
  p.vx = p.vy = 0; p.grav = 0; p.solid = false; p.r = -1e4; p.bounce = 0; p.armAt = p.t + .5;
  p.zone = true; p.danger = 80;                         // CPUs on the other team steer around it
  sfx('trap', .5);
}
function thrMineStep(p) {
  if (!p.armAt) { if (p.t > 2.5) thrMineLand(p); return; }
  if (p.t < p.armAt) return;
  for (const f of F) {
    if (!f.alive || f.team === p.team) continue;
    if (Math.hypot(f.P[8].x - p.x, f.P[8].y - p.y) < 48 || Math.hypot(f.P[10].x - p.x, f.P[10].y - p.y) < 48) {
      p.explode = 95; p.dmg = 22; killProj(p, 'hit', f); return;
    }
  }
}

// Smoke: a lingering cloud that hides whoever stands in it.
function thrSmokeCloud(p) {
  const owner = p.owner;
  spawnProj({ owner, x: p.x, y: p.y - 20, vx: 0, vy: 0, r: -1e4, dmg: 0, solid: false, trail: false, life: 5, kind: 'zone', zone: true,
    radius: 150, onStep: thrSmokeStep, draw: thrDrawSmoke });
  sfx('cloud', .8);
}
function thrSmokeStep(z) {
  for (const f of F) if (f.alive && Math.hypot(chest(f).x - z.x, chest(f).y - z.y) < z.radius) addStatus(f, 'invis', .35);
}

// Ice: everyone (on the other team) within 115 px is chilled and frozen.
function thrIceBurst(p) {
  for (const e of F) {
    if (!e.alive || e.team === p.team || Math.hypot(chest(e).x - p.x, chest(e).y - p.y) > 115) continue;
    damage(e, 8, { src: p.owner, kind: 'skill', x: chest(e).x, y: chest(e).y, status: ['freeze', 1.2], blast: true });
  }
  ring(p.x, p.y, 115, '#9fe8ff', .4, 5); burst(p.x, p.y, '#e8fbff', 24, 380);
  sfx('freeze');
}

// Cluster: the shell pops and five bomblets scatter.
function thrClusterSplit(p) {
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k - 2) * .45;
    spawnProj({ owner: p.owner, x: p.x, y: p.y - 6, vx: Math.cos(a) * rnd(280, 420), vy: Math.sin(a) * rnd(380, 560), r: 4, grav: 1,
      dmg: 10, explode: 62, life: rnd(.6, .9), bounce: 1, color: '#ffb347', trail: false, kind: 'throwable', dmgKind: 'skill', blastKind: 'skill',
      kb: 380, draw: thrDrawBall });
  }
}

// ---------- drawing ----------
function thrDrawBall(ctx, p) {
  circle(ctx, p.x, p.y, 7, p.color, '#07080f', 2);
  if (Math.sin(p.t * 30) > 0) circle(ctx, p.x + 4, p.y - 6, 2.5, '#ffffff');      // fuse spark
}
function thrDrawSticky(ctx, p) {
  circle(ctx, p.x, p.y, 7, p.color, '#07080f', 2);
  circle(ctx, p.x, p.y, 2.5, Math.sin(p.t * (p.stuck != null ? 40 : 12)) > 0 ? '#ff2d55' : '#3a0a14');
}
function thrDrawMine(ctx, p) {
  ctx.fillStyle = '#2a2d3e'; ctx.fillRect(p.x - 12, p.y - 6, 24, 6);
  const armed = p.armAt && p.t >= p.armAt, on = Math.sin(p.t * (armed ? 16 : 6)) > 0;
  glow(ctx, '#ff4a6a', armed && on ? 12 : 0, () => circle(ctx, p.x, p.y - 8, 3.5, on ? '#ff4a6a' : '#5a1020'));
}
function thrDrawIce(ctx, p) {
  poly(ctx, [[p.x, p.y - 9], [p.x + 7, p.y], [p.x, p.y + 9], [p.x - 7, p.y]], '#9fe8ff', '#ffffff', 1.5);
}
function thrDrawSmoke(ctx, z) {
  const fade = Math.min(1, z.t * 3, (z.life - z.t) * 1.2);
  ctx.save();
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4 + z.t * .4, r = z.radius * (.35 + .4 * ((k * 37) % 10) / 10);
    ctx.globalAlpha = .55 * fade;
    circle(ctx, z.x + Math.cos(a) * r * .8, z.y + Math.sin(a) * r * .45, 52 + 10 * Math.sin(z.t * 2 + k), k % 2 ? '#8a8fae' : '#a4a9c8');
  }
  ctx.restore();
}
