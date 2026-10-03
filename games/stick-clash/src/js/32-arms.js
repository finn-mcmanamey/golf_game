// 32-arms.js: disarming and weapon pickups. A strong hit can knock the weapon out of a fighter's hand: it flies off
// as a physics pickup anyone can take (bare-handed fighters just walk over it; armed ones press grab to swap), and
// the disarmed fighter fights with bare fists. After ARMS.crateAfter seconds bare-handed, a supply crate with a
// random weapon parachutes down near them. Pickups and crates ride PROJ as zones (like skill zones), so they are
// stepped, drawn, recorded by the kill-cam and cleared each round with no extra plumbing.

// min/span/max: disarm chance = clamp((damage - min) / span, 0, max) for a melee hit (× Brute bonus, × head hits).
const ARMS = { min: 12, span: 40, max: .45, shotMin: 14, life: 14, crateLife: 22, crateAfter: 5, reach: 36, swap: 74 };

// ---------- bare fists (what a disarmed fighter fights with) ----------
defWeapon('fist-left', { name: 'Left Fist', cat: 'fist', hidden: true, desc: 'Bare off-hand fist.',
  len: 16, mass: .8, dmg: .62, width: 9, kb: 1.15, lift: .6,
  draw(ctx, f, s) { armsFistDraw(ctx, s); } });
defWeapon('fists', { name: 'Bare Fists', cat: 'fist', hidden: true, offhand: 'fist-left',
  desc: 'No weapon: quick jabs until you find one.', len: 16, mass: .8, dmg: .62, width: 9, kb: 1.15, lift: .6, cd: .3, speed: 1.06,
  ai: { range: 78, style: 'melee' },
  attack(f) { f.mem.fistJab = !f.mem.fistJab; meleeThrust(f, 1.05, f.mem.fistJab || !f.off ? f.main : f.off); },
  onHit() { sfx('punch', .8); },
  draw(ctx, f, s) { armsFistDraw(ctx, s); } });
function armsFistDraw(ctx, s) {
  circle(ctx, s.t.x, s.t.y, 7 * s.k, s.color, '#07080f', 1.5);
  circle(ctx, s.t.x + s.ux * 3 * s.k, s.t.y + s.uy * 3 * s.k, 2.5 * s.k, rgba('#ffffff', .5));
}
const isBare = f => f.wkey === 'fists';

// ---------- disarm ----------
on('damage', (B, amt, o) => {
  const A = o && o.src;
  if (!A || A === B || !B.alive || B.hp <= 0 || B.summon || B.scale > 1.2 || o.blocked || isBare(B) || B.mount || B.ult) return;
  if (G_STATE.mode && G_STATE.mode.noDisarm) return;                 // modes can opt out (e.g. a fixed-weapon mode)
  if (o.kind !== 'melee' && !(o.kind === 'proj' && amt >= ARMS.shotMin)) return;
  const p = clamp((amt - ARMS.min) / ARMS.span, 0, ARMS.max) * (A.disarmMul || 1) * (o.head ? 1.3 : 1);
  if (chance(p)) disarm(B, A, o);
});

// Knocks B's weapon away (it becomes a pickup) and leaves B with bare fists.
function disarm(B, A, o = {}) {
  if (isBare(B) || !WEAPONS.fists) return null;
  const hand = B.P[B.main.hand], key = B.wkey, dir = Math.sign(o.nx || (B.P[2].x - (A ? A.P[2].x : B.P[2].x))) || -B.face;
  equipWeapon(B, 'fists');
  B.bareT = 0; B.crateCalled = false;
  const item = spawnPickup('weapon', key, hand.x, hand.y, dir * rnd(380, 620), -rnd(520, 760), { dropBy: B });
  if (A) A.stats.disarms++;
  float(hand.x, hand.y - 40, 'DISARMED!', '#ffd84a', 26);
  burst(hand.x, hand.y, '#ffe9a8', 16, 420);
  sfx('clash'); shake(6);
  emit('disarm', B, A, key);
  return item;
}

// ---------- pickups (weapons on the ground, supply crates) ----------
// kind: 'weapon' (wkey lies in the arena) or 'crate' (falls on a parachute, holds wkey). Returns the PROJ entry.
function spawnPickup(kind, wkey, x, y, vx, vy, o = {}) {
  return spawnProj(Object.assign({ owner: null, team: -9, x, y, vx, vy, r: -1e4, dmg: 0, solid: false, trail: false, grav: 1, drag: .25,
    life: kind === 'crate' ? ARMS.crateLife : ARMS.life, kind: 'pickup', pickup: kind, wkey, ang: rnd(0, TAU), va: rnd(-14, 14),
    rest: 0, landY: null, color: kind === 'crate' ? '#ffd84a' : (WEAPONS[wkey] || {}).color || '#dfe6ff',
    onStep: pickupStep, draw: pickupDraw }, o, { zone: true }));
}

function pickupStep(p, dt) {
  const crate = p.pickup === 'crate';
  if (crate && !p.rest) { p.vy = Math.min(p.vy, 230); p.vx *= .9; }          // parachute: a slow, steady fall
  if (!p.rest) p.ang += p.va * dt;
  pickupCollide(p);
  if (p.y > H + 260) { p.dead = true; return; }
  if (p.t > .25) for (const f of F) if (pickupAuto(f, p) && pickupTouch(f, p)) { takePickup(f, p); break; }
}

// Lands on the floor or a platform (a crate ignores everything above the spot it was aimed at), slides to a stop.
function pickupCollide(p) {
  if (MAP.walls && (p.x < 16 || p.x > W - 16)) { p.x = clamp(p.x, 16, W - 16); p.vx = -p.vx * .5; }
  const g = groundBelow(p.x, p.y - 14 - Math.max(0, p.vy) * DT);
  if (g == null || p.y < g - 8 || p.vy < 0 || (p.landY != null && g < p.landY - 4)) { p.rest = 0; return; }
  p.y = g - 8;
  const s = MAP.solids.find(o => p.x >= o.x && p.x <= o.x + o.w && Math.abs(o.y - g) < 1);
  if (s) { p.x += s.dx; p.y += s.dy; }                                  // ride moving platforms
  if (Math.abs(p.vy) > 160 && p.pickup !== 'crate') { p.vy = -p.vy * .32; p.vx *= .7; p.va *= .6; return; }
  p.vy = 0; p.vx *= .8; p.rest = 1;
  p.ang = lerp(p.ang, Math.round(p.ang / Math.PI) * Math.PI, .2);      // settle flat
}

// Bare-handed fighters take things by walking over them; the one who just dropped a weapon can't grab it back at once.
const pickupAuto = (f, p) => f.alive && !f.summon && isBare(f) && !f.mount && !(p.dropBy === f && p.t < 1.2);
function pickupTouch(f, p) {
  for (const j of [2, 4, 6, 8, 10]) if (Math.hypot(f.P[j].x - p.x, f.P[j].y - p.y) < ARMS.reach) return true;
  return false;
}

function takePickup(f, p) {
  if (p.dead || !WEAPONS[p.wkey]) return;
  p.dead = true;
  if (!isBare(f)) spawnPickup('weapon', f.wkey, f.P[f.main.hand].x, f.P[f.main.hand].y, -f.face * 160, -380, { dropBy: f });   // a swap drops ours
  equipWeapon(f, p.wkey);
  f.bareT = 0; f.crateCalled = false; f.stats.pickups++;
  float(p.x, p.y - 34, WEAPONS[p.wkey].name.toUpperCase(), p.pickup === 'crate' ? '#ffd84a' : f.color, 20);
  burst(p.x, p.y, p.pickup === 'crate' ? '#ffd84a' : f.color, 14, 260);
  sfx('orb', .8);
  emit('pickup', f, p);
}

// The grab key with nobody to grab: take (or swap for) the nearest pickup within reach.
function armsGrabKey(f) {
  let best = null, bd = ARMS.swap;
  for (const p of PROJ) {
    if (p.dead || p.kind !== 'pickup' || p.t < .2) continue;
    const d = Math.hypot(p.x - f.P[2].x, p.y - feetY(f) + 20);
    if (d < bd) { bd = d; best = p; }
  }
  if (best) takePickup(f, best);
  return !!best;
}

// Live pickups (for the AI and tests).
const pickupsLive = () => PROJ.filter(p => !p.dead && p.kind === 'pickup');

// ---------- supply crates ----------
// Called every step per fighter: bare-handed for a while -> a crate drops near them.
function armsTick(f, dt) {
  if (!f.alive || !isBare(f) || f.summon) return;
  f.bareT += dt;
  if (f.bareT >= ARMS.crateAfter && !f.crateCalled && G_STATE.lock <= 0 && !G_STATE.ending) { f.crateCalled = true; dropCrate(f); }
}

// Picks a spot beside the fighter on the ground they stand on (or the nearest ground) and drops a random weapon there.
function dropCrate(f, key) {
  const fy = feetY(f);
  let x = clamp(f.P[2].x + rnd(70, 150) * (chance(.5) ? 1 : -1), 60, W - 60), g = groundBelow(x, fy - 60);
  if (g == null || g > fy + 200) { x = clamp(f.P[2].x, 60, W - 60); g = groundBelow(x, fy - 60); }
  if (g == null) return null;
  const wkey = key || randomKey(WEAPONS, w => !w.hidden) || 'blade';
  const c = spawnPickup('crate', wkey, x, Math.max(-40, g - 520), 0, 120, { landY: g, ang: 0, va: 0 });
  float(x, Math.max(60, g - 300), 'SUPPLY DROP', '#ffd84a', 20);
  sfx('orb', .5);
  return c;
}

// ---------- drawing ----------
const ARMS_DUMMIES = new Map();     // posable fighters (never in F) used to draw a weapon lying on the ground
function armsDummy(key) {
  let d = ARMS_DUMMIES.get(key);
  if (!d) { d = makeFighter({ id: 0, x: 0, y: 0, face: 1, weapon: key, ctrl: 'cpu', name: 'pickup' }); ARMS_DUMMIES.set(key, d); }
  return d;
}
// Lays the weapon's rig out straight from (0, 0) along +x so its own draw() renders it.
function armsLayRig(d, rig) {
  const n = rig.pts.length - 1, len = rig.w.len;
  rig.pts.forEach((j, k) => { const x = -len * .35 + len * k / Math.max(1, n), p = d.P[j]; p.x = p.ox = x; p.y = p.oy = 0; });
}

function pickupDraw(ctx, p) {
  const fade = p.life - p.t < 2.5 ? (Math.sin(p.t * 18) > 0 ? 1 : .35) : 1, bob = p.rest ? Math.sin(p.t * 3) * 2 : 0;
  ctx.save();
  ctx.globalAlpha *= fade;
  if (p.pickup === 'crate') crateDraw(ctx, p);
  else {
    const pulse = .5 + .5 * Math.sin(p.t * 5);
    ctx.globalAlpha *= .5;
    circle(ctx, p.x, p.y + bob, 26 + pulse * 6, null, p.color, 2);
    ctx.globalAlpha /= .5;
    ctx.translate(p.x, p.y - 4 + bob); ctx.rotate(p.ang); ctx.scale(.8, .8);
    try {
      const d = armsDummy(p.wkey);
      d.color = '#c9cdee';
      for (const rig of rigsOf(d)) { armsLayRig(d, rig); rig.w.draw.call(rig.w, ctx, d, weaponView(d, rig)); }
    } catch (e) { report(e, 'pickup draw ' + p.wkey); p.draw = crateDraw; }
  }
  ctx.restore();
}

function crateDraw(ctx, p) {
  const x = p.x, y = p.y, s = 18;
  if (!p.rest) {                                                         // parachute
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x - 30, y - 62); ctx.moveTo(x + s, y - s); ctx.lineTo(x + 30, y - 62); ctx.stroke();
    ctx.fillStyle = rgba('#ff5ad1', .85);
    ctx.beginPath(); ctx.arc(x, y - 58, 34, Math.PI, 0); ctx.closePath(); ctx.fill();
  }
  glow(ctx, '#ffd84a', 14, () => {
    ctx.fillStyle = '#3a2a12'; ctx.fillRect(x - s, y - s * 2 + 8, s * 2, s * 2);
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2.5; ctx.strokeRect(x - s, y - s * 2 + 8, s * 2, s * 2);
  });
  ctx.fillStyle = '#ffd84a'; ctx.font = `20px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', x, y - s + 9);
}

// A K.O.'d fighter's weapon drops where they fell (their body shatters in 36-shatter); ring-outs take it with them.
on('ko', (v, k, o) => {
  if (v.summon || isBare(v) || (o && o.kind === 'ringout')) return;
  const h = v.P[v.main.hand];
  spawnPickup('weapon', v.wkey, h.x, h.y, rnd(-200, 200), -rnd(300, 500), { dropBy: v });
});
