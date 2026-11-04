// 57b-mounts-v6.js: the Rocket Skateboard and the Pogo Stick, with their own mount orbs (57 only made orbs for the mounts
// before it). Their hits use 57's mountHit, so they never level a weapon or carry its element.

// ---------- Rocket Skateboard ----------
const SKATE = { charge: .55, speed: 1250, dmg: 13, kb: 980, cd: 1.1, wheel: 16 };

defMount('rocket-board', { name: 'Rocket Skateboard', icon: '🛹', color: '#ff8a3d', time: 8, hp: 40, speedMul: 1.2,
  desc: 'Skate fast; attack fires the rocket for a ramming charge that bowls over every foe in the way.', ai: { range: 300, style: 'melee' },
  drive(f, dt, m) {
    const fy = feetY(f), g = groundBelow(f.P[2].x, fy - 10);
    m.hover = g != null && g - fy < 40 && vy(f.P[2]) > -300;          // wheels on the ground: ride a little above it
    if (m.hover) for (const j of [8, 10]) { const p = f.P[j]; p.fy += -PHYS.gravity * 2 + (g - SKATE.wheel - p.y) * 300 - vy(p) * 22; }
    if (m.charge > 0) skateCharge(f, dt, m);
  },
  attack(f, m) {
    if (m.charge > 0) return;
    f.atkCd = SKATE.cd; m.charge = SKATE.charge; m.dir = f.face; m.rammed = {};
    burst(f.P[2].x - f.face * 30, feetY(f) - 6, '#ffb347', 16, 320); shake(5); sfx('rocket');
  },
  draw(ctx, f, m, layer) { if (layer === 'under') skateDraw(ctx, f, m); },
  cpu(f) {   // CPUs charge a foe in range on the same level, never off a ledge (the swing brain can't judge a charge)
    const foe = f.ai.foe, dx = foe ? foe.P[2].x - f.P[2].x : 0;
    f.inp.attack = !!foe && f.atkCd <= 0 && Math.abs(dx) < 300 && Math.abs(foe.P[2].y - f.P[2].y) < 90 && chance(.2) && skillSafeAhead(f, Math.sign(dx) || f.face, 560);
  },
});
// The rocket shoves the rider along at full speed, bowling over each foe it meets once.
function skateCharge(f, dt, m) {
  m.charge -= dt;
  for (const p of f.P) p.ox = p.x - m.dir * SKATE.speed * DT;
  swingHitsOff(f, .12);                                               // only the ram hits at rocket speed
  for (const e of mountFoes(f, f.P[2].x + m.dir * 24, feetY(f) - 40, 78)) {
    if (m.rammed[e.id]) continue;
    m.rammed[e.id] = true;
    mountHit(f, e, SKATE.dmg, { kb: SKATE.kb, nx: m.dir, ny: -.55 }); shake(8); sfx('punch');
  }
  if (chance(.6)) burst(f.P[2].x - m.dir * 40, feetY(f) - 8, '#ffb347', 2, 200, { life: .3 });
}
function skateDraw(ctx, f, m) {
  const cx = (f.P[8].x + f.P[10].x) / 2, y = feetY(f) + 6, d = f.face, s = f.scale, tx = cx - d * 30 * s;
  ctx.save(); ctx.lineCap = 'round';
  lineXY(ctx, cx - 34 * s, y, cx + 34 * s, y, '#3a2a1e', 7 * s);                               // deck
  for (const k of [-22, 22]) circle(ctx, cx + k * s, y + 7 * s, 5 * s, '#c9cdee', '#2a2d3e', 2);   // wheels
  ctx.fillStyle = '#5a6280'; ctx.fillRect(tx - 9 * s, y - 14 * s, 18 * s, 9 * s);                // the rocket at the back
  if (m.charge > 0) glow(ctx, '#ff8a3d', 18, () => poly(ctx, [[tx - d * 9 * s, y - 14 * s], [tx - d * (34 + Math.random() * 18) * s, y - 9 * s], [tx - d * 9 * s, y - 5 * s]], '#ffd84a'));
  ctx.restore();
}

// ---------- Pogo Stick ----------
const POGO = { stick: 34, hop: 1080, big: 1350, stomp: 14, dive: 1700, diveR: 120, diveDmg: 11, landR: 70, landDmg: 5 };

defMount('pogo', { name: 'Pogo Stick', icon: '↟', color: '#9dff5a', time: 8, hp: 40, speedMul: 1.1, ai: { range: 110, style: 'melee' },
  desc: 'Boing! Big automatic bounces (hold jump for higher). Land on a foe to stomp it; attack in the air dives for a shockwave.',
  onMount(f, m) { m.boingT = -9; },
  drive(f, dt, m) { pogoDrive(f, m); },
  attack(f, m) {
    f.atkCd = .45;
    if (f.grounded || m.dive) return;
    m.dive = true;
    for (const p of f.P) setVel(p, vx(p) * .3, POGO.dive);
    sfx('dash', .7);
  },
  draw(ctx, f, m, layer) { if (layer === 'over') pogoStickDraw(ctx, f, m); },
  cpu(f) { const foe = f.ai.foe; if (foe && !f.grounded && Math.abs(foe.P[2].x - f.P[2].x) < 70 && f.P[2].y < foe.P[0].y - 30) f.inp.attack = true; },   // dive onto a foe below
});
// The stick holds the feet above the ground; touching down bounces straight back up (a dive lands with a shockwave).
function pogoDrive(f, m) {
  const hip = f.P[2], fy = feetY(f), g = groundBelow(hip.x, fy - 10), stick = POGO.stick * f.scale;
  f.jumpCd = Math.max(f.jumpCd, .1);                                  // the jump key sets the bounce height instead
  if (m.dive) swingHitsOff(f, .12);                                   // only the shockwave hits at dive speed
  if (vy(hip) > 250) pogoStomp(f, m);
  if (g == null || g - fy > stick + 4) return;
  if (vy(hip) > -100 && G_STATE.t - m.boingT > .2) { pogoBoing(f, m, g); return; }
  for (const j of [8, 10]) { const p = f.P[j]; p.fy += -PHYS.gravity * 2 + (g - stick - p.y) * 260 - vy(p) * 18; }
}
function pogoBoing(f, m, g) {
  const x = f.P[2].x, dive = m.dive, r = dive ? POGO.diveR : POGO.landR;
  m.boingT = G_STATE.t; m.dive = false; f.rising = false;
  for (const p of f.P) p.oy = p.y + (f.inp.jumpHeld ? POGO.big : POGO.hop) * (dive ? 1.1 : 1) * DT;
  for (const e of mountFoes(f, x, g - 40, r)) mountHit(f, e, dive ? POGO.diveDmg : POGO.landDmg, { kb: dive ? 760 : 420, nx: Math.sign(chest(e).x - x) || f.face, ny: -.85, status: dive ? ['stun', .3] : null });
  if (dive) { ring(x, g, r, '#9dff5a', .35, 5); burst(x, g, '#c9a27a', 18, 360); shake(10); sfx('slam', .7); }
  sfx('mapBoing', f.inp.jumpHeld ? 1 : .7);
}
// Coming down onto a foe's head or shoulders: a stomp, and a bounce off them.
function pogoStomp(f, m) {
  const tx = f.P[2].x, ty = feetY(f) + POGO.stick * f.scale;
  const e = (m.stompT || 0) > G_STATE.t ? null : F.find(e => e.alive && e.team !== f.team && Math.abs(tx - e.P[0].x) < 34 * e.scale && ty > e.P[0].y - 30 && ty < e.P[1].y + 20);
  if (!e) return;
  m.stompT = G_STATE.t + .35; m.boingT = G_STATE.t; m.dive = false;
  mountHit(f, e, POGO.stomp, { kb: 380, nx: 0, ny: 1, status: ['stun', .35] });
  for (const p of f.P) p.oy = p.y + POGO.hop * DT;
  float(e.P[0].x, e.P[0].y - 40, 'STOMP!', '#9dff5a', 22); sfx('mapBoing'); shake(6);
}
function pogoStickDraw(ctx, f, m) {
  const s = f.scale, hx = f.P[2].x, fy = feetY(f), tipY = fy + POGO.stick * s - clamp(1 - (G_STATE.t - m.boingT) / .15, 0, 1) * 10 * s;
  const tx = (f.P[4].x + f.P[6].x) / 2, ty = (f.P[4].y + f.P[6].y) / 2;
  ctx.save(); ctx.lineCap = 'round';
  lineXY(ctx, tx - 12 * s, ty, tx + 12 * s, ty, '#c9cdee', 4 * s);                              // handlebar
  lineXY(ctx, tx, ty, hx, fy - 4, '#9dff5a', 4 * s);                                             // shaft
  ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; ctx.beginPath();                               // the spring
  for (let k = 0; k <= 6; k++) ctx.lineTo(hx + (k % 2 ? 5 : -5) * s, lerp(fy, tipY - 6 * s, k / 6));
  ctx.stroke();
  lineXY(ctx, hx, tipY - 6 * s, hx, tipY, '#5a6280', 4 * s);
  ctx.restore();
}

// ---------- the mount orbs (rare, like 57's) ----------
for (const key of ['rocket-board', 'pogo']) {
  const d = MOUNTS[key];
  defOrb('mount-' + key, { name: d.name, icon: d.icon, color: d.color, weight: .2, desc: `Ride for ${d.time} s: ${d.desc}`, grab(f) { mount(f, key); } });
}

THINK_AFTER.push((f, dt) => { const d = mountDef(f); if (d && d.cpu && f.alive) hook(d, 'cpu', f, dt); });   // mount tactics for CPUs
