// 40-weapons-melee.js: melee weapon defs. draw(ctx, f, s): s.h hand point, s.t tip, s.ux/uy unit vector hand->tip,
// s.nx/ny its normal, s.L current length, s.pts all rig points (chains), s.k thickness scale, s.at(d, o) = point d px
// along the weapon from the hand (negative = behind it) and o px to the side.
//
// Roster (30 visible): blades, heavies, polearms, chains, fists and joke weapons. Specials live in attack()/onHit()/
// onStep(); shared helpers are prefixed `melee`. Hidden defs are off-hand halves (daggers, shield, glove, staff ends).

// ---------- shared behaviour ----------

// Bleed: a short damage-over-time from sharp axes and hooked chains (red drips).
defStatus('bleed', { name: 'Bleed', icon: '◆', color: '#ff3b4e', debuff: true, max: 6,
  tick(f, dt, s) {
    tickDot(f, dt, s, 4 * s.power, this.color);
    if (chance(dt * 10)) { const p = pick(f.P); burst(p.x, p.y, this.color, 1, 40, { grav: 900, size: 2 }); }
  } });

// Weapon sounds are registered once the audio slice (which loads later) exists.
on('boot', () => {
  if (typeof defSfx !== 'function') return;
  defSfx('pan', v => { tone(1250, 1170, .45, 'triangle', .12 * v); tone(2630, 2500, .3, 'sine', .06 * v); noise(.05, 3000, .2 * v); });
  defSfx('saw', v => { tone(95, 150, .14, 'sawtooth', .05 * v); noise(.12, 1800, .06 * v); });
  defSfx('crack', v => { noise(.05, 6000, .35 * v, 'highpass'); tone(2600, 500, .06, 'square', .05 * v); });
  defSfx('punch', v => { noise(.1, 500, .5 * v, 'lowpass'); tone(150, 55, .12, 'sine', .4 * v); });
  defSfx('zap', v => { tone(1600, 180, .22, 'square', .06 * v); noise(.18, 4200, .18 * v, 'highpass'); });
  defSfx('gust', v => noise(.28, 900, .22 * v));
  defSfx('quake', v => { noise(.5, 140, .7 * v, 'lowpass'); tone(70, 28, .45, 'sine', .55 * v); });
});

// Aim from the neck at the nearest visible foe, kept within ~35 degrees of level so thrusts don't stab the floor.
function meleeAim(f) {
  const foe = nearestEnemy(f, true), neck = f.P[1];
  if (!foe) return { x: f.face, y: 0 };
  const dx = chest(foe).x - neck.x, a = clamp(Math.atan2(chest(foe).y - neck.y, Math.abs(dx)), -.6, .6), sx = Math.sign(dx) || f.face;
  return { x: Math.cos(a) * sx, y: Math.sin(a) };
}

// A straight stab (rapier, spear, halberd, punches): level the weapon on the aim line, then drive arm and body along it.
function meleeThrust(f, power = 1, rig = f.main) {
  const P = f.P, u = meleeAim(f), hand = P[rig.hand], tip = P[rig.tip], len = dist(hand, tip), sp = 1150 * power;
  kick(tip, (hand.x + u.x * len - tip.x) * 14 + u.x * sp, (hand.y + u.y * len - tip.y) * 14 + u.y * sp);
  for (const j of rig.pts.slice(1, -1)) kick(P[j], u.x * sp, u.y * sp);
  kick(hand, u.x * sp * .85, u.y * sp * .85);
  kick(P[rig.elbow], u.x * sp * .5, u.y * sp * .5);
  for (const j of [0, 1, 2]) kick(P[j], u.x * 300 * power, 0);
  f.swingT = .22;
  sfx('swing', .6);
}

// Pulls the target toward the attacker (scythe, kusarigama hooks).
function meleePull(A, B, strength) {
  const dir = Math.sign(A.P[2].x - B.P[2].x) || A.face;
  for (const p of B.P) kick(p, dir * strength, -strength * .15);
  B.stagger = Math.max(B.stagger, .2);
}

// Is any enemy body within reach of this weapon segment? Returns { B, x, y } for the first one found.
function meleeTouching(f, rig, pad) {
  const P = f.P, a = P[rig.hand], b = P[rig.tip];
  for (const B of enemiesOf(f)) {
    if (!B.alive || B.inv > 0) continue;
    for (const T of HIT_SHAPES) {
      const r = segSeg(a.x, a.y, b.x, b.y, B.P[T.a].x, B.P[T.a].y, B.P[T.b].x, B.P[T.b].y);
      if (r.d < T.r * B.scale + pad) return { B, x: r.qx, y: r.qy };
    }
  }
  return null;
}

// Ground shockwave: hurts and pops up enemies standing near (x, groundY).
function meleeShockwave(f, x, gy, radius, dmg) {
  for (const B of enemiesOf(f)) {
    if (!B.alive) continue;
    const dx = B.P[2].x - x;
    if (Math.abs(dx) > radius || Math.abs(feetY(B) - gy) > 40) continue;
    damage(B, dmg * (1 - Math.abs(dx) / radius * .5), { src: f, kind: 'skill', x: B.P[2].x, y: gy - 10,
      nx: Math.sign(dx) * .45, ny: -.9, kb: 520, parts: [2, 7, 8, 9, 10], color: '#ffd27a' });
  }
  ring(x, gy, radius, '#ffd27a', .35, 5); ring(x, gy, radius * .5, '#ffffff', .2, 3);
  burst(x, gy, '#c9a46a', 22, 420, { grav: 1400 });
  shake(10);
  sfx('quake');
}

// Status on hit with a chance and a little "proc" text so players learn what their weapon does.
function meleeProc(B, p, status, secs, power, A, label, color) {
  if (!chance(p) || !B.alive) return false;
  addStatus(B, status, secs, power, A);
  if (label) float(B.P[0].x, B.P[0].y - 40, label, color, 20);
  return true;
}

// Off-hand staff end: spring its tip to point straight back along the main shaft, so both ends of a staff hit.
function meleeStaffEnd(f, def) {
  if (!f.off || f.off.w !== def) return;
  const P = f.P, h = P[f.main.hand], t = P[f.main.tip], L = Math.hypot(t.x - h.x, t.y - h.y) || 1;
  const base = P[f.off.hand], len = f.off.links[0].cur;
  spring(P[f.off.tip], base.x - (t.x - h.x) / L * len, base.y - (t.y - h.y) / L * len, 650, 20);
}
// Puts the staff's back end in place at once so it doesn't flip over at round start.
function meleeStaffSnap(f) {
  if (!f.off) return;
  const P = f.P, h = P[f.main.hand], t = P[f.main.tip], L = Math.hypot(t.x - h.x, t.y - h.y) || 1;
  const base = P[f.off.hand], tip = P[f.off.tip], len = f.off.w.len * f.scale;
  tip.x = tip.ox = base.x - (t.x - h.x) / L * len;
  tip.y = tip.oy = base.y - (t.y - h.y) / L * len;
}

// ---------- shared drawing ----------

// Handle from `back` px behind the hand up to the hand.
function meleeHandle(ctx, s, back, color, w) { line(ctx, s.at(-back * s.k), s.h, color, w * s.k); }
// Crossguard across the weapon at distance d.
function meleeGuard(ctx, s, d, half, color, w) { line(ctx, s.at(d, -half * s.k), s.at(d, half * s.k), color, w * s.k); }
// Straight tapered blade from d0 to the tip (or to d1), w px wide, with a bright edge line.
function meleeBlade(ctx, s, d0, w, fill, edge, d1 = s.L, point = w * 1.4) {
  const k = s.k, hw = w * k / 2, p = point * k;
  poly(ctx, [s.at(d0, -hw), s.at(d1 - p, -hw), s.at(d1), s.at(d1 - p, hw), s.at(d0, hw)], fill);
  if (edge) line(ctx, s.at(d0 + 2 * k, hw * .45), s.at(d1 - p * .5, hw * .2), edge, 1.6 * k);
}
// Curved blade (katana, scythe): quadratic edge bulging `bow` px to the side.
function meleeCurve(ctx, s, d0, d1, w, bow, fill, edge) {
  const k = s.k, side = s.face, a = s.at(d0, -w / 2 * k * side), b = s.at(d1), c = s.at((d0 + d1) / 2, bow * k * side);
  const a2 = s.at(d0, w / 2 * k * side), c2 = s.at((d0 + d1) / 2, (bow + w) * k * side);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
  ctx.quadraticCurveTo(c2.x, c2.y, a2.x, a2.y); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.quadraticCurveTo(c2.x, c2.y, b.x, b.y); ctx.stroke(); }
}
// A chain drawn through the rig points (dashed links), starting at the given point.
function meleeChain(ctx, s, from, color, w) {
  const pts = s.pts.slice(1);
  ctx.setLineDash([4 * s.k, 3 * s.k]);
  ctx.strokeStyle = color; ctx.lineWidth = w * s.k; ctx.beginPath(); ctx.moveTo(from.x, from.y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.stroke(); ctx.setLineDash([]);
}
// Direction of the last chain link (for orienting heads on chains).
function meleeChainDir(s) {
  const n = s.pts.length, a = s.pts[n - 2], b = s.pts[n - 1], L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / L, y: (b.y - a.y) / L };
}
// Point relative to the chain's tip: d along the last link, o to its side.
function meleeTipAt(s, d, o) {
  const u = meleeChainDir(s);
  return { x: s.t.x + u.x * d - u.y * o, y: s.t.y + u.y * d + u.x * o };
}

// ---------- blades ----------

defWeapon('blade', {
  power: 1.1,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Blade', cat: 'blade', desc: 'Balanced sword. Quick swings, reliable reach. The yardstick.', order: 1,
  len: 78, mass: 1, dmg: 1.14, width: 5,
  ai: { range: 130, style: 'melee' },
  draw(ctx, f, s) {
    meleeHandle(ctx, s, 12, '#3a3046', 6);
    meleeGuard(ctx, s, 0, 11, '#c9b37a', 5);
    meleeBlade(ctx, s, 2, 6, '#dfe6ff', '#ffffff');
  },
});

defWeapon('katana', {
  power: 1.12,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Katana', cat: 'blade', order: 2,
  desc: 'Long, light, curved. Wait a moment between swings and the next one is a lightning-fast draw cut.',
  len: 90, mass: .8, dmg: 1.05, width: 4,
  ai: { range: 145, style: 'melee' },
  onStep(f, dt) { f.mem.katanaSheath = f.swingT > 0 ? 0 : (f.mem.katanaSheath || 0) + dt; },
  attack(f) {
    const ready = f.mem.katanaSheath > 1.2;   // a rested blade swings harder
    spinAttack(f, ready ? 1.4 : 1);
    if (ready) { ring(f.P[f.tip].x, f.P[f.tip].y, 30, '#ffffff', .2, 3); float(f.P[0].x, f.P[0].y - 44, 'IAI!', '#ffffff', 18); }
    f.mem.katanaSheath = 0;
  },
  draw(ctx, f, s) {
    meleeHandle(ctx, s, 22, '#1d1b2a', 6);
    for (let d = -20; d < 0; d += 6) meleeGuard(ctx, s, d, 3, '#c43b52', 2);   // wrapped grip
    circle(ctx, s.h.x, s.h.y, 6 * s.k, '#c9b37a');                               // round guard
    meleeCurve(ctx, s, 3, s.L, 5, 4, '#e6ecff', '#ffffff');
    if (f.mem.katanaSheath > 1.2) circle(ctx, s.t.x, s.t.y, 3 * s.k, '#ffffff');       // ready glint
  },
});

defWeapon('broadsword', {
  name: 'Broadsword', cat: 'blade', order: 3,
  desc: 'Wide, heavy blade. Hits harder than the Blade and its flat can parry incoming shots.',
  len: 88, mass: 1.35, dmg: 1.15, width: 7, block: .2, kb: 1.1,
  ai: { range: 140, style: 'melee' },
  draw(ctx, f, s) {
    meleeHandle(ctx, s, 16, '#4a3628', 7);
    circle(ctx, s.at(-17 * s.k).x, s.at(-17 * s.k).y, 4 * s.k, '#c9b37a');   // pommel
    meleeGuard(ctx, s, 0, 15, '#c9b37a', 6);
    meleeBlade(ctx, s, 3, 12, '#c8d0e6', '#ffffff', s.L, 14);
    line(ctx, s.at(6 * s.k), s.at(s.L * .7), '#8f98b4', 2 * s.k);              // fuller groove
  },
});

defWeapon('greatsword', {
  power: 1.06,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Greatsword', cat: 'blade', twoHanded: true, order: 4,
  desc: 'Two-handed slab of steel. Slow to swing and to run with, but huge reach and crushing hits. Armour soaks 10%.',
  len: 118, mass: 2.2, dmg: .95, width: 8, kb: 1.25, speed: .88, armor: .92,
  ai: { range: 170, style: 'melee' },
  draw(ctx, f, s) {
    meleeHandle(ctx, s, 26, '#3b2b22', 7);
    meleeGuard(ctx, s, 0, 20, '#9aa1b8', 7);
    meleeGuard(ctx, s, 10, 8, '#9aa1b8', 4);                                   // ricasso lugs
    meleeBlade(ctx, s, 3, 14, '#b9c2dc', '#f0f4ff', s.L, 18);
    line(ctx, s.at(14 * s.k), s.at(s.L * .75), '#7e87a4', 3 * s.k);
  },
});

defWeapon('dagger-left', {
  name: 'Dagger', cat: 'blade', hidden: true, desc: 'Off-hand dagger.',
  len: 44, mass: .5, dmg: .78, width: 4,
  onHit(A, B) { meleeProc(B, .35, 'poison', 2, .7, A); },
  draw(ctx, f, s) { meleeDaggerDraw(ctx, s); },
});
function meleeDaggerDraw(ctx, s) {
  meleeHandle(ctx, s, 9, '#2f2a3a', 5);
  meleeGuard(ctx, s, 0, 7, '#8dff4a', 3);
  meleeBlade(ctx, s, 1, 6, '#d9e2ff', '#ffffff', s.L, 10);
  line(ctx, s.at(4 * s.k), s.at(s.L * .6), rgba('#8dff4a', .7), 1.5 * s.k);   // venom groove
}
defWeapon('twin-daggers', {
  name: 'Twin Fangs', cat: 'blade', offhand: 'dagger-left', order: 5,
  desc: 'A venom-coated dagger in each hand. Short and relentless; hits may poison.',
  len: 44, mass: .5, dmg: .78, width: 4, cd: .36, speed: 1.06,
  ai: { range: 92, style: 'melee' },
  onHit(A, B) { meleeProc(B, .35, 'poison', 2, .7, A); },
  draw(ctx, f, s) { meleeDaggerDraw(ctx, s); },
});

defWeapon('kite-shield', {
  name: 'Kite Shield', cat: 'shield', hidden: true, desc: 'Off-hand shield.',
  len: 34, mass: 1, dmg: .3, width: 11, block: .5, armor: .9, lift: 1.4,
  draw(ctx, f, s) {
    const k = s.k, m = s.L * .5;
    const pts = [s.at(-6 * k, -13 * k), s.at(-6 * k, 13 * k), s.at(m, 15 * k), s.at(s.L + 8 * k, 0), s.at(m, -15 * k)];
    poly(ctx, pts, '#2a3a66', '#c9b37a', 3 * k);
    line(ctx, s.at(-2 * k), s.at(s.L), rgba(s.color, .9), 3 * k);                // emblem in the owner's colour
    line(ctx, s.at(m * .7, -9 * k), s.at(m * .7, 9 * k), rgba(s.color, .9), 3 * k);
  },
});
defWeapon('sword-shield', {
  name: 'Guardian', cat: 'blade', offhand: 'kite-shield', order: 6,
  desc: 'Arming sword and kite shield. The shield often deflects projectiles and the guard soaks damage.',
  len: 70, mass: .95, dmg: .84, width: 5, speed: .95,
  ai: { range: 120, style: 'melee' },
  draw(ctx, f, s) {
    meleeHandle(ctx, s, 11, '#3a3046', 6);
    meleeGuard(ctx, s, 0, 10, '#c9b37a', 5);
    meleeBlade(ctx, s, 2, 7, '#dfe6ff', '#ffffff');
  },
});

defWeapon('rapier', {
  power: 0.94,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Rapier', cat: 'blade', order: 7,
  desc: 'Needle-thin duelling blade. Every attack is a fast lunge straight at the foe.',
  len: 92, mass: .55, dmg: .8, width: 3, cd: .44,
  ai: { range: 150, style: 'melee' },
  attack(f) { meleeThrust(f, 1.08); },
  draw(ctx, f, s) {
    const k = s.k;
    meleeHandle(ctx, s, 11, '#3a2b20', 5);
    ctx.strokeStyle = '#d9c27a'; ctx.lineWidth = 2 * k; ctx.beginPath();          // swept basket hilt
    const a = s.at(-8 * k, 0), b = s.at(4 * k, 9 * k * s.face), c = s.at(8 * k, 0);
    ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, b.y, c.x, c.y); ctx.stroke();
    meleeGuard(ctx, s, 2, 9, '#d9c27a', 3);
    line(ctx, s.at(3 * k), s.t, '#e8eeff', 3 * k);
    line(ctx, s.at(3 * k), s.t, '#ffffff', 1 * k);
  },
});

defWeapon('saber', {
  power: 1.22,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Energy Saber', cat: 'blade', color: '#b26bff', order: 8,
  desc: 'Light, fast plasma blade. Hits hard for its weight and can bat away shots.',
  len: 82, mass: .6, dmg: .96, width: 6, block: .22,
  ai: { range: 140, style: 'melee' },
  draw(ctx, f, s) {
    meleeHandle(ctx, s, 13, '#2b2b36', 7);
    meleeGuard(ctx, s, -4, 2, '#8e96c4', 8);
    glow(ctx, '#b26bff', 22, () => line(ctx, s.h, s.t, '#a066ff', 9 * s.k));
    line(ctx, s.h, s.t, '#f2e8ff', 3 * s.k);
  },
});

defWeapon('frost-blade', {
  power: 1.08,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Rimefang', cat: 'blade', color: '#9fe8ff', order: 9,
  desc: 'An ice-crystal sword. Each hit has a chance to freeze the foe solid for a moment.',
  len: 80, mass: .95, dmg: 1.06, width: 6,
  ai: { range: 132, style: 'melee' },
  onHit(A, B) { if (meleeProc(B, .2, 'freeze', .75, 1, A, 'FROZEN', '#9fe8ff')) sfx('shatter', .6); },
  draw(ctx, f, s) {
    const k = s.k;
    meleeHandle(ctx, s, 12, '#28405a', 6);
    poly(ctx, [s.at(-2 * k, -10 * k), s.at(5 * k, 0), s.at(-2 * k, 10 * k), s.at(2 * k, 0)], '#bff3ff');   // crystal guard
    glow(ctx, '#9fe8ff', 14, () => meleeBlade(ctx, s, 3, 9, 'rgba(160,232,255,.85)', null, s.L, 16));
    for (let d = 16; d < s.L - 14; d += 16) poly(ctx, [s.at(d * 1, 4 * k), s.at(d + 6 * k, 10 * k), s.at(d + 8 * k, 3 * k)], '#e8fbff');
    line(ctx, s.at(5 * k), s.at(s.L - 6 * k), '#ffffff', 1.5 * k);
  },
});

defWeapon('flame-sword', {
  power: 1.1,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Emberbrand', cat: 'blade', color: '#ff7a2e', order: 10,
  desc: 'A sword wreathed in fire. Every hit sets the target burning.',
  len: 78, mass: 1, dmg: .86, width: 6,
  ai: { range: 130, style: 'melee' },
  onHit(A, B) { addStatus(B, 'burn', 1.5, .6, A); },
  onStep(f) { if (chance(.12)) { const p = f.P[f.tip]; burst(p.x, p.y, chance(.5) ? '#ffb02e' : '#ff4a1a', 1, 60, { grav: -600 }); } },
  draw(ctx, f, s) {
    const k = s.k, t = G_STATE.t * 18;
    meleeHandle(ctx, s, 12, '#3a1d14', 6);
    meleeGuard(ctx, s, 0, 11, '#ffb02e', 5);
    glow(ctx, '#ff7a2e', 18, () => {
      for (let d = 8; d < s.L; d += 9) {   // flickering tongues of flame along the blade
        const h = (6 + Math.sin(t + d) * 4) * k * (1 - d / s.L * .5);
        line(ctx, s.at(d, 0), s.at(d + 4 * k, -h * s.face), '#ff8a2e', 4 * k);
      }
    });
    meleeBlade(ctx, s, 2, 6, '#5a2216', null);
    line(ctx, s.at(3 * k), s.at(s.L - 4 * k), '#ffd27a', 1.5 * k);
  },
});

defWeapon('war-fan', {
  power: 1.15,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Tempest Fan', cat: 'blade', color: '#c9f3ff', order: 11,
  desc: 'Steel folding fan. Each swing also throws a short gust that shoves the foe away.',
  len: 50, mass: .6, dmg: .9, width: 7, cd: .5,
  ai: { range: 150, style: 'melee' },
  attack(f) {
    spinAttack(f, .95);
    const t = f.P[f.tip], u = meleeAim(f);
    spawnProj({ owner: f, x: t.x, y: t.y, vx: u.x * 820, vy: u.y * 820 - 40, r: 15, dmg: 3, life: .32, drag: 2.6,
      kind: 'gust', trail: false, solid: false, kb: 620, color: '#c9f3ff', draw: meleeGustDraw });
    sfx('gust');
  },
  draw(ctx, f, s) {
    const k = s.k, base = s.at(-4 * k), n = 7, spread = .95;
    const ang = Math.atan2(s.uy, s.ux);
    ctx.beginPath(); ctx.moveTo(base.x, base.y);
    ctx.arc(base.x, base.y, s.L + 4 * k, ang - spread / 2, ang + spread / 2);
    ctx.closePath(); ctx.fillStyle = 'rgba(30,40,70,.9)'; ctx.fill();
    for (let i = 0; i < n; i++) {   // ribs
      const a = ang - spread / 2 + spread * i / (n - 1);
      lineXY(ctx, base.x, base.y, base.x + Math.cos(a) * (s.L + 4 * k), base.y + Math.sin(a) * (s.L + 4 * k), '#c9f3ff', 1.5 * k);
    }
    ctx.strokeStyle = s.color; ctx.lineWidth = 3 * k; ctx.beginPath();
    ctx.arc(base.x, base.y, s.L + 4 * k, ang - spread / 2, ang + spread / 2); ctx.stroke();
  },
});
// Gust projectile: three fading wind arcs.
function meleeGustDraw(ctx, p) {
  const a = Math.atan2(p.vy, p.vx), fade = clamp(1 - p.t / p.life, 0, 1);
  ctx.strokeStyle = rgba('#c9f3ff', .7 * fade); ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(p.x - Math.cos(a) * i * 9, p.y - Math.sin(a) * i * 9, p.r - i * 3, a - .9, a + .9); ctx.stroke();
  }
}

// ---------- heavies ----------

defWeapon('hammer', {
  power: 1.14,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Quake Hammer', cat: 'heavy', twoHanded: true, order: 20,
  desc: 'Slow and heavy. Smash the ground on a downswing to send out a shockwave.',
  len: 66, mass: 2.5, dmg: 1.14, width: 7, kb: 1.2, speed: .92,
  ai: { range: 120, style: 'melee' },
  attack(f) { spinAttack(f); f.mem.hammerSlam = .55; },
  onStep(f, dt) {
    if (!(f.mem.hammerSlam > 0)) return;
    f.mem.hammerSlam -= dt;
    const t = f.P[f.tip], g = groundBelow(t.x, t.y - 30);
    if (g != null && t.y > g - 22 && vy(t) > 300) { f.mem.hammerSlam = 0; meleeShockwave(f, t.x, g, 150, 7); }
  },
  draw(ctx, f, s) {
    line(ctx, s.at(-12 * s.k), s.t, '#8d7155', 6 * s.k);
    const c = s.t, hw = 20 * s.k, hl = 12 * s.k;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: c.x + s.nx * hw * a + s.ux * hl * b, y: c.y + s.ny * hw * a + s.uy * hl * b }));
    poly(ctx, pts, '#9aa1b8', '#5d6378', 2);
    line(ctx, s.at(s.L - 2 * s.k, -20 * s.k), s.at(s.L - 2 * s.k, 20 * s.k), '#ffd27a', 2 * s.k);   // glowing seam
  },
});

defWeapon('battle-axe', {
  power: 1.1,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Reaver Axe', cat: 'heavy', order: 21,
  desc: 'Bearded war axe. Deep cuts make the target bleed.',
  len: 72, mass: 1.7, dmg: .88, width: 6, kb: 1.1,
  ai: { range: 125, style: 'melee' },
  onHit(A, B) { addStatus(B, 'bleed', 2, 1, A); },
  draw(ctx, f, s) {
    const k = s.k, L = s.L, side = s.face;
    line(ctx, s.at(-14 * k), s.t, '#7a5a3a', 6 * k);
    const head = [s.at(L - 4 * k, 0), s.at(L - 26 * k, 4 * k * side), s.at(L - 30 * k, 24 * k * side), s.at(L - 14 * k, 26 * k * side), s.at(L + 4 * k, 18 * k * side), s.at(L + 2 * k, 0)];
    poly(ctx, head, '#aab3c9', '#e8ecff', 2);
    line(ctx, s.at(L - 30 * k, 24 * k * side), s.at(L + 4 * k, 18 * k * side), '#ffffff', 2 * k);   // edge
  },
});

defWeapon('double-axe', {
  power: 1.2,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Twinblade Axe', cat: 'heavy', twoHanded: true, order: 22,
  desc: 'Double-bladed axe. Every attack is a two-chop whirl.',
  len: 76, mass: 2.1, dmg: .98, width: 9, kb: 1.25, speed: .92, cd: .78,
  ai: { range: 130, style: 'melee' },
  attack(f) { spinAttack(f, 1.05); f.mem.axeWhirl = .22; },
  onStep(f, dt) { if (f.mem.axeWhirl > 0 && (f.mem.axeWhirl -= dt) <= 0 && canAct(f)) spinAttack(f, .85); },
  draw(ctx, f, s) {
    const k = s.k, L = s.L;
    line(ctx, s.at(-14 * k), s.at(L + 8 * k), '#6b4f36', 6 * k);
    for (const side of [1, -1]) {
      const head = [s.at(L - 4 * k, 3 * k * side), s.at(L - 22 * k, 22 * k * side), s.at(L - 2 * k, 30 * k * side), s.at(L + 16 * k, 22 * k * side), s.at(L + 2 * k, 3 * k * side)];
      poly(ctx, head, '#b4bdd4', '#eef2ff', 2);
    }
    circle(ctx, s.t.x, s.t.y, 4 * k, '#ff5ad1');
  },
});

defWeapon('mace', {
  power: 1.16,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Spiked Mace', cat: 'heavy', order: 23,
  desc: 'Flanged iron club. Solid blows may leave the foe stunned.',
  len: 64, mass: 1.7, dmg: 1.18, width: 8, kb: 1.1,
  ai: { range: 118, style: 'melee' },
  onHit(A, B, hit) { if (hit.dmg >= 6) meleeProc(B, .28, 'stun', .5, 1, A, 'DAZED', '#ffe066'); },
  draw(ctx, f, s) {
    const k = s.k, c = s.at(s.L - 6 * k);
    line(ctx, s.at(-12 * k), c, '#5a4a3a', 6 * k);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + Math.atan2(s.uy, s.ux);
      lineXY(ctx, c.x, c.y, c.x + Math.cos(a) * 19 * k, c.y + Math.sin(a) * 19 * k, '#c4cad8', 3 * k);
    }
    circle(ctx, c.x, c.y, 12 * k, '#7d8499', '#c4cad8', 2);
  },
});

defWeapon('bat', {
  power: 1.13,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Slugger', cat: 'heavy', order: 24,
  desc: 'Wooden bat. Massive knockback; head hits send them flying. Knock-outs are home runs.',
  len: 84, mass: 1.25, dmg: 1.06, width: 7, kb: 1.55,
  ai: { range: 135, style: 'melee' },
  onHit(A, B, hit) {
    if (hit.head && B.alive) for (const p of B.P) kick(p, hit.nx * 260, -260);
    if (!B.alive) { float(B.P[0].x, B.P[0].y - 50, 'HOME RUN!', '#ffd84a', 30); for (const p of B.P) kick(p, A.face * 500, -500); }
  },
  draw(ctx, f, s) {
    const k = s.k, L = s.L;
    poly(ctx, [s.at(-14 * k, -3 * k), s.at(L * .35, -3.5 * k), s.at(L, -8 * k), s.at(L + 4 * k, 0), s.at(L, 8 * k), s.at(L * .35, 3.5 * k), s.at(-14 * k, 3 * k)], '#d9a866', '#8a5a2a', 1.5);
    meleeGuard(ctx, s, -15, 5, '#8a5a2a', 4);                                           // knob
    for (let d = -12; d < 6; d += 4) meleeGuard(ctx, s, d, 3.5, '#2a2a3a', 2);          // grip tape
  },
});

defWeapon('frying-pan', {
  power: 1.18,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Iron Skillet', cat: 'exotic', order: 25,
  desc: 'A trusty frying pan. BONK. Big flat face, comedic clang, good odds of a stun.',
  len: 52, mass: 1.15, dmg: 1.12, width: 10, kb: 1.15,
  ai: { range: 105, style: 'melee' },
  onHit(A, B) { sfx('pan'); meleeProc(B, .45, 'stun', .45, 1, A, 'BONK!', '#ffe066'); },
  draw(ctx, f, s) {
    const k = s.k, c = s.at(s.L - 4 * k);
    line(ctx, s.at(-12 * k), s.at(s.L - 18 * k), '#2a2a34', 5 * k);
    meleeGuard(ctx, s, -12, 3, '#c43b52', 3);
    circle(ctx, c.x, c.y, 17 * k, '#3a3d4a', '#9aa1b8', 3 * k);
    circle(ctx, c.x - 4 * k, c.y - 4 * k, 6 * k, rgba('#ffffff', .18));                  // shine
  },
});

defWeapon('chainsaw', {
  power: 1.12,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Ripper Saw', cat: 'exotic', twoHanded: true, color: '#ffb347', order: 26,
  desc: 'Revving chainsaw. Attacks spin it up: while revving it grinds anything it touches for steady damage.',
  len: 70, mass: 1.6, dmg: .6, width: 7, speed: .95, kb: .7,
  ai: { range: 112, style: 'melee' },
  attack(f) { spinAttack(f, .85); f.mem.sawRev = .9; },
  onStep(f, dt) {
    const m = f.mem;
    m.sawGrind = (m.sawGrind || 0) - dt; m.sawSnd = (m.sawSnd || 0) - dt;
    if (!(m.sawRev > 0)) return;
    m.sawRev -= dt;
    if (m.sawSnd <= 0) { sfx('saw', .8); m.sawSnd = .14; }
    const hit = m.sawGrind <= 0 && meleeTouching(f, f.main, 6 * f.scale);
    if (!hit) return;
    m.sawGrind = .1;
    damage(hit.B, 2, { src: f, kind: 'status', x: hit.x, y: hit.y, color: '#ffb347', small: true });
    for (const p of hit.B.P) kick(p, f.face * 40, -10);
    hit.B.stagger = Math.max(hit.B.stagger, .1);
    burst(hit.x, hit.y, '#ffd27a', 4, 360, { life: .2 });
  },
  draw(ctx, f, s) {
    const k = s.k, L = s.L, rev = f.mem.sawRev > 0;
    poly(ctx, [s.at(-16 * k, -9 * k), s.at(10 * k, -9 * k), s.at(10 * k, 9 * k), s.at(-16 * k, 9 * k)], '#ff9a2e', '#5a3010', 2);   // motor
    line(ctx, s.at(-14 * k, -11 * k), s.at(2 * k, -13 * k), '#2a2a34', 3 * k);       // top handle
    poly(ctx, [s.at(8 * k, -6 * k), s.at(L, -5 * k), s.at(L + 6 * k, 0), s.at(L, 5 * k), s.at(8 * k, 6 * k)], '#c4cad8', '#5d6378', 1.5);   // bar
    const off = (G_STATE.t * (rev ? 90 : 10)) % 8;                                    // teeth crawl round the bar
    for (let d = 10 + off; d < L; d += 8) for (const side of [-1, 1]) {
      poly(ctx, [s.at(d, 5 * k * side), s.at(d + 3 * k, 9 * k * side), s.at(d + 5 * k, 5 * k * side)], rev ? '#ffffff' : '#9aa1b8');
    }
  },
});

defWeapon('lollipop', {
  power: 1.16,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Sugar Rush', cat: 'exotic', color: '#ff5ad1', order: 27,
  desc: 'A giant swirly lollipop. Weak hits with silly knockback, and every hit gives you a sugar rush (haste).',
  len: 84, mass: .9, dmg: .95, width: 9, kb: 1.6,
  ai: { range: 140, style: 'melee' },
  onHit(A, B, hit) { addStatus(A, 'haste', 1.6, 1, A); burst(hit.x, hit.y, pick(['#ff5ad1', '#5ef2ff', '#ffd84a']), 8, 300); },
  draw(ctx, f, s) {
    const k = s.k, c = s.at(s.L - 6 * k), r = 18 * k;
    line(ctx, s.at(-12 * k), c, '#f5f0ff', 4 * k);
    circle(ctx, c.x, c.y, r, '#ff5ad1', '#ffffff', 2 * k);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * k; ctx.beginPath();             // spiral, spinning slowly
    for (let a = 0; a < TAU * 2.2; a += .3) {
      const rr = r * a / (TAU * 2.4), aa = a + G_STATE.t * 2;
      a ? ctx.lineTo(c.x + Math.cos(aa) * rr, c.y + Math.sin(aa) * rr) : ctx.moveTo(c.x, c.y);
    }
    ctx.stroke();
  },
});

// ---------- polearms ----------

defWeapon('spear', {
  power: 1.06,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Spear', cat: 'polearm', twoHanded: true, order: 30,
  desc: 'Longest reach. Lunging pokes from safety; weaker up close.',
  len: 120, mass: .8, dmg: .74, width: 4,
  ai: { range: 175, style: 'melee' },
  attack(f) { const foe = nearestEnemy(f, true); foe && dist(foe.P[2], f.P[2]) > 110 ? meleeThrust(f, .85) : spinAttack(f); },
  draw(ctx, f, s) {
    line(ctx, s.at(-24 * s.k), s.t, '#b08955', 5 * s.k);
    const tip = s.at(s.L + 20 * s.k), l = s.at(s.L, -8 * s.k), r = s.at(s.L, 8 * s.k);
    poly(ctx, [tip, l, r], '#e8ecff');
    meleeGuard(ctx, s, s.L - 2 * s.k, 4, s.color, 3);                                  // tassel band
  },
});

defWeapon('halberd', {
  power: 1.06,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Halberd', cat: 'polearm', twoHanded: true, order: 31,
  desc: 'Axe blade, spike and hook on a long haft. Attacks alternate between a lunge and a sweeping chop.',
  len: 112, mass: 1.5, dmg: .85, width: 6, kb: 1.15, speed: .95,
  ai: { range: 165, style: 'melee' },
  attack(f) { (f.mem.halberdAlt = !f.mem.halberdAlt) ? meleeThrust(f, .95) : spinAttack(f, 1.05); },
  draw(ctx, f, s) {
    const k = s.k, L = s.L, side = s.face;
    line(ctx, s.at(-24 * k), s.t, '#6e5235', 5 * k);
    poly(ctx, [s.at(L, 0), s.at(L + 22 * k, 0), s.at(L + 2 * k, 3 * k)], '#e8ecff');                       // spike
    poly(ctx, [s.at(L - 22 * k, 2 * k * side), s.at(L - 26 * k, 20 * k * side), s.at(L - 2 * k, 22 * k * side), s.at(L + 2 * k, 2 * k * side)], '#b4bdd4', '#eef2ff', 2);  // axe
    poly(ctx, [s.at(L - 16 * k, -2 * k * side), s.at(L - 6 * k, -16 * k * side), s.at(L - 8 * k, -2 * k * side)], '#b4bdd4');   // back hook
  },
});

defWeapon('trident', {
  power: 1.06,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Tidecaller', cat: 'polearm', twoHanded: true, color: '#3fd0ff', order: 32,
  desc: 'Three-pronged trident. Wide tip that is hard to dodge; hits drag the foe down with a slow.',
  len: 108, mass: 1.1, dmg: .95, width: 7,
  ai: { range: 165, style: 'melee' },
  onHit(A, B) { addStatus(B, 'slow', 1.1, 1, A); },
  draw(ctx, f, s) {
    const k = s.k, L = s.L;
    line(ctx, s.at(-22 * k), s.at(L - 8 * k), '#2f6f8f', 5 * k);
    line(ctx, s.at(L - 8 * k, -12 * k), s.at(L - 8 * k, 12 * k), '#cfe9ff', 4 * k);
    for (const o of [-12, 0, 12]) {
      const base = s.at(L - 8 * k, o * k), end = s.at(L + (o ? 12 : 18) * k, o * k);
      line(ctx, base, end, '#cfe9ff', 3.5 * k);
      poly(ctx, [s.at(L + (o ? 18 : 24) * k, o * k), s.at(L + (o ? 10 : 16) * k, (o - 4) * k), s.at(L + (o ? 10 : 16) * k, (o + 4) * k)], '#ffffff');
    }
  },
});

defWeapon('scythe', {
  power: 1.16,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Reaper Scythe', cat: 'polearm', twoHanded: true, color: '#b98cff', order: 33,
  desc: 'Long hooked blade. Hits reel the victim in toward you for the follow-up.',
  len: 104, mass: 1.35, dmg: 1.04, width: 6, kb: .65,
  ai: { range: 160, style: 'melee' },
  onHit(A, B) { if (B.alive) meleePull(A, B, 520); },
  draw(ctx, f, s) {
    const k = s.k, L = s.L, side = -s.face;   // the blade hooks back toward the wielder
    line(ctx, s.at(-20 * k), s.t, '#3a2b4a', 5 * k);
    meleeGuard(ctx, s, L * .45, 3, '#b98cff', 3);
    const a = s.at(L, 0), c1 = s.at(L + 10 * k, 40 * k * side), b = s.at(L - 30 * k, 52 * k * side), c2 = s.at(L - 2 * k, 30 * k * side);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c1.x, c1.y, b.x, b.y); ctx.quadraticCurveTo(c2.x, c2.y, s.at(L - 6 * k).x, s.at(L - 6 * k).y);
    ctx.closePath(); ctx.fillStyle = '#d8dcef'; ctx.fill();
    glow(ctx, '#b98cff', 10, () => { ctx.strokeStyle = '#b98cff'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c1.x, c1.y, b.x, b.y); ctx.stroke(); });
  },
});

// Bo staff: main half forward, hidden off-hand half held pointing straight back, so both ends strike.
defWeapon('bo-end', {
  name: 'Staff End', cat: 'polearm', hidden: true, desc: 'Back half of a bo staff.',
  len: 62, mass: .7, dmg: .72, width: 5, stiff: 0, lift: 0,
  onStep(f) { meleeStaffEnd(f, this); },
  draw(ctx, f, s) { meleeBoDraw(ctx, s); },
});
function meleeBoDraw(ctx, s) {
  line(ctx, s.h, s.t, '#a87a4a', 6 * s.k);
  meleeGuard(ctx, s, s.L - 8 * s.k, 3.5, '#2a2a3a', 4);
  meleeGuard(ctx, s, 6 * s.k, 3.5, '#2a2a3a', 4);
}
defWeapon('bo-staff', {
  name: 'Bo Staff', cat: 'polearm', twoHanded: true, offhand: 'bo-end', order: 34,
  desc: 'Long wooden staff held in the middle. Both ends strike, so spins hit in front and behind.',
  len: 62, mass: .7, dmg: .72, width: 5, cd: .46, speed: 1.04,
  ai: { range: 115, style: 'melee' },
  onEquip(f) { meleeStaffSnap(f); },
  draw(ctx, f, s) { meleeBoDraw(ctx, s); },
});

// Plasma staff: same two-ended rig; every third hit discharges a static burst around the target.
function meleePlasmaCharge(A, hit) {
  A.mem.plasmaCharge = (A.mem.plasmaCharge || 0) + 1;
  if (A.mem.plasmaCharge < 3) return;
  A.mem.plasmaCharge = 0;
  explode(hit.x, hit.y, 80, 5, A, { color: '#5ef2ff', kb: 380 });
  sfx('zap');
}
function meleePlasmaDraw(ctx, f, s) {
  const k = s.k, hot = (f.mem.plasmaCharge || 0) >= 2;
  line(ctx, s.h, s.at(16 * k), '#2b2b36', 7 * k);
  glow(ctx, '#5ef2ff', hot ? 26 : 16, () => line(ctx, s.at(16 * k), s.t, '#2fb8ff', 8 * k));
  line(ctx, s.at(16 * k), s.t, '#e8fbff', 3 * k);
}
defWeapon('plasma-end', {
  name: 'Plasma End', cat: 'magic', hidden: true, color: '#5ef2ff', desc: 'Back half of the plasma staff.',
  len: 66, mass: .65, dmg: .44, width: 6, stiff: 0, lift: 0,
  onStep(f) { meleeStaffEnd(f, this); },
  onHit(A, B, hit) { meleePlasmaCharge(A, hit); },
  draw: meleePlasmaDraw,
});
defWeapon('plasma-staff', {
  name: 'Twin Plasma Staff', cat: 'magic', twoHanded: true, offhand: 'plasma-end', color: '#5ef2ff', order: 35,
  desc: 'Double-ended energy staff. Both ends burn; every third hit releases a static blast.',
  len: 66, mass: .65, dmg: .44, width: 6, cd: .46,
  ai: { range: 120, style: 'melee' },
  onEquip(f) { meleeStaffSnap(f); },
  onHit(A, B, hit) { meleePlasmaCharge(A, hit); },
  draw: meleePlasmaDraw,
});

// ---------- chains ----------

defWeapon('flail', {
  power: 1.1,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Morning Star', cat: 'chain', order: 40,
  desc: 'Spiked ball on a chain. Wild, heavy, hard to block.',
  len: 90, mass: 1.5, dmg: .9, width: 8, chain: 3,   // wide hitbox matches the spiked ball
  ai: { range: 150, style: 'melee' },
  draw(ctx, f, s) {
    const chain = s.pts.slice(1), t = s.t;
    line(ctx, s.at(-12 * s.k), chain[0], '#6b5844', 6 * s.k);
    meleeChain(ctx, s, chain[0], '#c4cad8', 3);
    circle(ctx, t.x, t.y, 11 * s.k, '#aab1c4');
    for (let k = 0; k < 8; k++) {
      const a = k * .785 + f.phase * .1;
      lineXY(ctx, t.x + Math.cos(a) * 9 * s.k, t.y + Math.sin(a) * 9 * s.k, t.x + Math.cos(a) * 17 * s.k, t.y + Math.sin(a) * 17 * s.k, '#aab1c4', 3 * s.k);
    }
  },
});

defWeapon('nunchaku', {
  power: 1.08,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Nunchaku', cat: 'chain', order: 41,
  desc: 'Two sticks on a short chain. Very fast flurries; the loose stick cracks at high speed.',
  len: 66, mass: .7, dmg: 1.08, width: 5, chain: 2, cd: .36, speed: 1.05,
  ai: { range: 100, style: 'melee' },
  draw(ctx, f, s) {
    const k = s.k, mid = s.pts[1], t = s.t;
    line(ctx, s.at(-14 * k), s.at(6 * k), '#1d1b2a', 7 * k);                          // held stick
    line(ctx, s.at(-14 * k), s.at(6 * k), s.color, 2 * k);
    lineXY(ctx, s.at(6 * k).x, s.at(6 * k).y, mid.x, mid.y, '#c4cad8', 2 * k);        // chain
    const u = meleeChainDir(s), back = { x: t.x - u.x * 24 * k, y: t.y - u.y * 24 * k };
    lineXY(ctx, mid.x, mid.y, back.x, back.y, '#c4cad8', 2 * k);
    line(ctx, back, t, '#1d1b2a', 7 * k);                                             // swinging stick
    line(ctx, back, t, s.color, 2 * k);
  },
});

defWeapon('whip', {
  power: 1.2,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Viper Whip', cat: 'chain', color: '#ffd84a', order: 42,
  desc: 'Very long leather whip. Low damage but huge reach; a full-speed crack slows the target.',
  len: 150, mass: .35, dmg: .6, width: 4, chain: 4, cd: .48, kb: .7,
  ai: { range: 205, style: 'melee' },
  // Nearly float the lash so a long whip lying on the ground can't anchor a fallen wielder.
  onStep(f) { for (const j of f.main.pts.slice(1)) f.P[j].fy -= PHYS.gravity * .85; },
  onHit(A, B, hit) {
    if (hit.rel < 1500) return;
    addStatus(B, 'slow', 1, 1, A);
    float(hit.x, hit.y - 30, 'CRACK!', '#ffd84a', 22);
    sfx('crack');
  },
  draw(ctx, f, s) {
    const k = s.k, pts = s.pts;
    line(ctx, s.at(-14 * k), s.h, '#3a2416', 7 * k);
    ctx.strokeStyle = '#8a5a2a'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.h.x, s.h.y);
    for (let i = 1; i < pts.length; i++) {   // taper toward the tip
      ctx.lineWidth = (5 - i * .6) * k; ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y);
    }
    circle(ctx, s.t.x, s.t.y, 2.5 * k, '#ffd84a');
  },
});

defWeapon('kusarigama', {
  name: 'Kusarigama', cat: 'chain', order: 43,
  desc: 'Sickle on a long chain. Hooks the target, makes it bleed and drags it closer.',
  len: 118, mass: .9, dmg: .64, width: 6, chain: 4,
  ai: { range: 175, style: 'melee' },
  onHit(A, B) { addStatus(B, 'bleed', 1.6, .8, A); if (B.alive) meleePull(A, B, 300); },
  draw(ctx, f, s) {
    const k = s.k, t = s.t;
    line(ctx, s.at(-10 * k), s.at(6 * k), '#2a2a3a', 6 * k);                          // weight handle
    meleeChain(ctx, s, s.at(6 * k), '#9aa1b8', 2.5);
    const shaft = meleeTipAt(s, -14 * k, 0);
    line(ctx, shaft, t, '#7a5a3a', 5 * k);
    poly(ctx, [t, meleeTipAt(s, 4 * k, 14 * k), meleeTipAt(s, -8 * k, 24 * k), meleeTipAt(s, -2 * k, 10 * k)], '#e3e8f8', '#ffffff', 1.5);
  },
});

// ---------- fists ----------

defWeapon('glove-left', {
  name: 'Left Glove', cat: 'fist', hidden: true, desc: 'Off-hand boxing glove.',
  len: 22, mass: 1.05, dmg: .72, width: 11, kb: 1.4, lift: .6,
  onHit(A) { sfx('punch'); },
  draw(ctx, f, s) { meleeGloveDraw(ctx, s, '#e83b4e'); },
});
function meleeGloveDraw(ctx, s, color) {
  const k = s.k;
  line(ctx, s.h, s.at(8 * k), '#f5f0ff', 9 * k);                                     // cuff
  circle(ctx, s.t.x, s.t.y, 12 * k, color, rgba('#000000', .35), 2);
  circle(ctx, s.t.x - s.nx * 4 * k + s.ux * 3 * k, s.t.y - s.ny * 4 * k + s.uy * 3 * k, 4 * k, rgba('#ffffff', .35));
}
defWeapon('boxing-gloves', {
  name: 'Haymakers', cat: 'fist', offhand: 'glove-left', order: 50,
  desc: 'Boxing gloves. Short reach, but fast alternating jabs with huge knockback.',
  len: 22, mass: 1.05, dmg: .72, width: 11, kb: 1.4, lift: .6, cd: .34, speed: 1.08,
  ai: { range: 88, style: 'melee' },
  attack(f) { f.mem.gloveJab = !f.mem.gloveJab; meleeThrust(f, 1.1, f.mem.gloveJab || !f.off ? f.main : f.off); },
  onHit(A) { sfx('punch'); },
  draw(ctx, f, s) { meleeGloveDraw(ctx, s, s.color); },
});
