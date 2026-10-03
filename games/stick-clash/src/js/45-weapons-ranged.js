// 45-weapons-ranged.js: ranged and magic weapon defs. A def with `ranged` aims the weapon arm at the nearest enemy and
// the attack key fires along the barrel (hand -> tip) via fireRanged(f), which handles ammo, reload, recoil and sfx.
// ranged: { cooldown, ammo, reload, auto, speed, spread (rad), recoil, pellets, sfx, proj: { ...spawnProj options } }
//
// Fairness rules every gun here follows, so melee is never helpless:
// - limited ammo and a real reload; out of ammo with a foe in reach you club them with the gun instead (light damage);
// - recoil kicks the arm, and heavy guns shove the whole wobbly body (`bodyRecoil`);
// - every projectile can be batted back by a fast melee swing (a parry) or deflected by shields; beams and lightning
//   are stopped by shields too.
// Extra def fields used in this file: bodyRecoil (px/s shove on the torso per shot), chargeTime / chargeMax (s, for
// hold-to-charge weapons).

// ---------- shared helpers ----------
const RANGED_PARRY_SPEED = 620;     // weapon-tip speed (px/s, relative to the hip) that bats a projectile away
const RANGED_PARTY = ['#ff5ad1', '#ffd84a', '#5ef2ff', '#9dff5a', '#ff8a2e', '#b98cff'];

// +1 when the gun points right, -1 when left: multiply a side offset by it so grips and stocks stay below the barrel.
const rangedSide = s => s.ux >= 0 ? 1 : -1;

// Barrel origin and direction (hand -> tip).
function rangedBarrel(f) {
  const h = f.P[f.main.hand], t = f.P[f.tip], L = Math.hypot(t.x - h.x, t.y - h.y) || 1;
  return { x: t.x, y: t.y, ux: (t.x - h.x) / L, uy: (t.y - h.y) / L };
}

// Pushes the torso away from where the gun points: big guns rock the wobbly body.
function rangedShove(f, power) {
  const b = rangedBarrel(f);
  for (const j of [0, 1, 2, 3, 4, 5, 6]) kick(f.P[j], -b.ux * power, -b.uy * power * .5 - power * .15);
  f.stagger = Math.max(f.stagger, Math.min(.25, power / 1600));
}

// fireRanged plus the weapon's body recoil. Returns the (last) projectile or null when empty/reloading.
function rangedFire(f, overrides) {
  const p = fireRanged(f, overrides);
  if (p && f.w.bodyRecoil) rangedShove(f, f.w.bodyRecoil);
  return p;
}

// Ammo, cooldown, recoil and sound for weapons that don't spawn projectiles (beams, lightning). True if it fired.
function rangedSpend(f) {
  const r = f.w.ranged;
  if (!r || f.reload > 0) return false;
  if (f.ammo <= 0) { f.reload = r.reload; return false; }
  f.ammo--; f.stats.shots++;
  f.atkCd = r.cooldown * cdMul(f);
  const b = rangedBarrel(f);
  kick(f.P[f.tip], -b.ux * r.recoil, -b.uy * r.recoil - r.recoil * .4);
  kick(f.P[f.main.hand], -b.ux * r.recoil * .4, -r.recoil * .2);
  if (f.w.bodyRecoil) rangedShove(f, f.w.bodyRecoil);
  burst(b.x, b.y, f.w.color, 5, 240, { life: .18 });
  sfx(r.sfx || 'shoot');
  if (f.ammo <= 0) f.reload = r.reload;
  emit('fire', f, { owner: f, x: b.x, y: b.y, vx: b.ux * r.speed, vy: b.uy * r.speed, kind: 'beam', color: f.w.color });
  return true;
}

// The attack every weapon here uses: fire when loaded; when empty and a foe is in reach, club them with the gun.
function rangedAttack(f, fire) {
  if (f.reload > 0 || f.ammo <= 0) {
    const foe = nearestEnemy(f, true);
    if (foe && dist(foe.P[2], f.P[2]) < (f.w.len + 85) * f.scale) {
      spinAttack(f, .9);
      f.atkCd = .7 * cdMul(f);
      return;
    }
    if (f.ammo <= 0 && f.reload <= 0) f.reload = f.w.ranged.reload;
    f.atkCd = .05;                   // stay ready to fire the moment the reload is done
    return;
  }
  fire(f);
}

// Default projectile options: every shot from this file can be parried. `own` is the weapon's own onStep (optional).
function rangedProj(o) {
  const own = o.onStep;
  return Object.assign({}, o, {
    onStep(p, dt) {
      if (!p.noParry && rangedParry(p, dt)) return;
      if (own) own.call(p, p, dt);
    },
  });
}

// A melee weapon swung fast through a projectile bats it back toward the shooter's side.
function rangedParry(p, dt) {
  const x0 = p.x - p.vx * dt, y0 = p.y - p.vy * dt;
  for (const B of F) {
    if (!B.alive || B.team === p.team) continue;
    for (const rig of rigsOf(B)) {
      if (rig.w.ranged || rig.w.dmg <= 0) continue;
      const tip = B.P[rig.tip], hip = B.P[2];
      if (Math.hypot(vx(tip) - vx(hip), vy(tip) - vy(hip)) < RANGED_PARRY_SPEED) continue;
      for (const [i, j] of rig.ws) {
        const a = B.P[i], b = B.P[j], r = segSeg(x0, y0, p.x, p.y, a.x, a.y, b.x, b.y);
        if (r.d > Math.max(2, p.r) + rig.w.width * B.scale + 6) continue;
        deflectProj(p, B, a, b, r.qx, r.qy);
        p.vx *= 1.25; p.vy *= 1.25;                 // a good swing sends it back faster than the shove-off
        float(r.qx, r.qy - 26, 'PARRY!', '#ffe9a8', 22);
        ring(r.qx, r.qy, 40, '#ffe9a8', .2, 3);
        sfx('clash');
        return true;
      }
    }
  }
  return false;
}

// A projectile that never hits anything (negative radius): used for stuck arrows, bubbles and gravity wells.
function rangedDecor(o) {
  return spawnProj(Object.assign({ r: -999, dmg: 0, solid: false, trail: false, vx: 0, vy: 0, kind: 'decor', draw() {} }, o));
}

// Leaves a stuck arrow/knife where a projectile hit a wall.
function rangedStick(p, why, len, color) {
  if (why !== 'world') return;
  const a = Math.atan2(p.vy, p.vx);
  rangedDecor({ x: p.x, y: p.y, life: 2.5, kind: 'stuck', color,
    draw(ctx, q) {
      ctx.globalAlpha = clamp((q.life - q.t) * 2, 0, 1);
      lineXY(ctx, q.x - Math.cos(a) * len, q.y - Math.sin(a) * len, q.x + Math.cos(a) * 4, q.y + Math.sin(a) * 4, color, 3);
      ctx.globalAlpha = 1;
    } });
}

// How far a straight shot travels before a solid block, the floor or a side wall (one-way platforms don't stop it).
function rangedRayLen(x, y, ux, uy, max) {
  if (!MAP) return max;
  for (let d = 0; d < max; d += 8) {
    const px = x + ux * d, py = y + uy * d;
    if (solidAt(px, py) || (MAP.walls && (px < 0 || px > W))) return d;
  }
  return max;
}

// Enemies a beam from (x, y) along (ux, uy) of length len passes through, nearest first.
// Each hit: { B, s (0..1 along the beam), x, y, T, blocked (a shield caught it first) }.
function rangedBeamHits(f, x, y, ux, uy, len) {
  const ex = x + ux * len, ey = y + uy * len, out = [];
  for (const B of F) {
    if (!B.alive || B.team === f.team || B.inv > 0) continue;
    let best = null;
    for (const T of HIT_SHAPES) {
      const c = B.P[T.a], d = B.P[T.b], r = segSeg(x, y, ex, ey, c.x, c.y, d.x, d.y);
      if (r.d <= T.r * B.scale + 4 && (!best || r.s < best.s)) best = { B, s: r.s, x: r.px, y: r.py, T, blocked: false };
    }
    if (!best) continue;
    const sh = rangedShieldOnRay(B, x, y, ex, ey);
    if (sh && sh.s <= best.s + .02) Object.assign(best, { s: sh.s, x: sh.x, y: sh.y, blocked: true });
    out.push(best);
  }
  return out.sort((a, b) => a.s - b.s);
}

// A shield (weapon with block > 0) on the ray catches it with chance = block. Returns the catch point or null.
function rangedShieldOnRay(B, x, y, ex, ey) {
  for (const rig of rigsOf(B)) {
    if (!(rig.w.block > 0)) continue;
    for (const [i, j] of rig.ws) {
      const a = B.P[i], b = B.P[j], r = segSeg(x, y, ex, ey, a.x, a.y, b.x, b.y);
      if (r.d <= rig.w.width * B.scale + 4 && Math.random() < rig.w.block) return { s: r.s, x: r.px, y: r.py };
    }
  }
  return null;
}

function rangedBlockFx(B, x, y) {
  burst(x, y, '#7fd8ff', 16, 380);
  float(x, y - 20, 'BLOCKED', '#7fd8ff', 22);
  sfx('block');
  emit('block', B, null);
}

// Pellets and rapid-fire streams carry no damage of their own (dmg: 0). Their hits on a target are gathered for a
// short window (packWindow) and land as one readable hit: one number, one combo step, one knockback.
// Projectile fields: pdmg (damage per hit), pkb (knockback), pstatus, packWindow (s), packKey (groups hits), packSmall.
let RANGED_SHOT_ID = 0;
const rangedVolleyKey = () => 'v' + (++RANGED_SHOT_ID);

function rangedPackHit(p, B) {
  const packs = B.mem.rngPacks || (B.mem.rngPacks = {}), key = (p.packKey || 'x') + ':' + (p.owner ? p.owner.id : -1);
  let pack = packs[key];
  if (!pack || pack.done || G_STATE.t - pack.t0 > p.packWindow + .2) {
    const fresh = pack = packs[key] = { dmg: 0, n: 0, t0: G_STATE.t, done: false };
    rangedDecor({ life: p.packWindow || .1, kind: 'hit-pack', onExpire: () => rangedPackLand(B, fresh) });
  }
  const sp = Math.hypot(p.vx, p.vy) || 1;
  Object.assign(pack, { src: p.owner, x: p.x, y: p.y, nx: p.vx / sp, ny: p.vy / sp, kb: p.pkb || 0, status: p.pstatus,
    color: p.color, small: !!p.packSmall });
  pack.dmg += p.pdmg || 0; pack.n++;
}

function rangedPackLand(B, pack) {
  pack.done = true;
  if (!B.alive || !(pack.dmg > 0)) return;
  damage(B, pack.dmg, { src: pack.src, x: pack.x, y: pack.y, nx: pack.nx, ny: pack.ny, kb: pack.kb * Math.min(1.8, .7 + pack.n * .15),
    kind: 'proj', status: pack.status, color: pack.color, small: pack.small, parts: [1, 2] });
}

// ---------- hold-to-charge weapons (bow, plasma) ----------
function rangedChargeStart(f) {
  if (f.reload > 0 || f.ammo <= 0 || (f.mem.charge && f.mem.charge.key === f.wkey)) return;
  f.mem.charge = { key: f.wkey, t: 0 };
  sfx('gun-charge');
}

// Charges while attack is held; releasing (or holding past chargeMax) fires with power 0..1.
function rangedChargeStep(f, dt, release) {
  const c = f.mem.charge;
  if (!c || c.key !== f.wkey) return;
  if (!canAct(f)) { f.mem.charge = null; return; }         // stunned or frozen: the shot fizzles
  c.t += dt;
  if (f.inp.attackHeld && c.t < f.w.chargeMax) return;
  f.mem.charge = null;
  release(f, clamp(c.t / f.w.chargeTime, 0, 1));
}

const rangedChargeFrac = f => f.mem.charge && f.mem.charge.key === f.wkey ? clamp(f.mem.charge.t / f.w.chargeTime, 0, 1) : 0;

// CPU: pick how long to charge when a charge starts, then hold until reached.
function rangedChargeThink(f) {
  const c = f.mem.charge;
  if (!c || c.key !== f.wkey) { f.ai.chargeGoal = rnd(.45, 1.05) * f.w.chargeTime; return; }
  f.inp.attackHeld = c.t < f.ai.chargeGoal;
}

// Charge meter around the hand.
function rangedDrawCharge(ctx, f, s, color) {
  const k = rangedChargeFrac(f);
  if (!k) return;
  ctx.globalAlpha = .9; ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(s.h.x, s.h.y, 20 * s.k, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
  ctx.globalAlpha = 1;
  if (k >= 1) circle(ctx, s.h.x, s.h.y, 24 * s.k + Math.sin(G_STATE.t * 30) * 2, null, '#ffffff', 1.5);
}

// Reload ring around the gun (shared by every weapon here).
function rangedDrawReload(ctx, f, s, color, ranged) {
  if (!(f.reload > 0)) return;
  const c = s.at(s.L * .4), done = 1 - f.reload / ranged.reload;
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(c.x, c.y, 16 * s.k, -Math.PI / 2, -Math.PI / 2 + TAU * done); ctx.stroke();
}

// A star shape (wand shots, sparkles).
function rangedStar(ctx, x, y, r, rot, fill) {
  const pts = [];
  for (let k = 0; k < 10; k++) { const a = rot + k * Math.PI / 5, rr = k % 2 ? r * .45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  poly(ctx, pts, fill);
}

// A jagged lightning bolt made of short beams.
function rangedZigzag(x1, y1, x2, y2, color, width) {
  const n = 7, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  let px = x1, py = y1;
  for (let k = 1; k <= n; k++) {
    const off = k < n ? rnd(-16, 16) : 0, x = x1 + dx * k / n + nx * off, y = y1 + dy * k / n + ny * off;
    beam(px, py, x, y, color, width, .24);
    px = x; py = y;
  }
}

// A tiny crackle drawn straight onto the canvas (weapon idle sparkle). Unlike rangedZigzag it spawns no effects,
// so it is safe inside draw(): nothing leaks into BEAMS, the kill-cam recording or the menu previews.
function rangedSpark(ctx, x1, y1, x2, y2, color, width) {
  const n = 4, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  glow(ctx, color, 8, () => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1);
    for (let k = 1; k <= n; k++) { const off = k < n ? rnd(-6, 6) : 0; ctx.lineTo(x1 + dx * k / n + nx * off, y1 + dy * k / n + ny * off); }
    ctx.stroke();
  });
}

// Default trail drawing for custom projectiles: a fading line through the last few positions.
function rangedTrail(ctx, p, color, width) {
  const tr = p.tr;
  if (tr.length < 4) return;
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(tr[0], tr[1]);
  for (let k = 2; k < tr.length; k += 2) ctx.lineTo(tr[k], tr[k + 1]);
  ctx.lineTo(p.x, p.y); ctx.stroke();
}

// ---------- extra statuses ----------
// Pinned: a crossbow bolt nails the legs in place for a moment (can still jump and swing).
defStatus('pinned', { name: 'Pinned', icon: '⊥', color: '#ffcf6b', debuff: true, max: 1.5, immunity: .8,
  tick(f, dt) {
    for (const j of [2, 7, 8, 9, 10]) { const p = f.P[j]; p.ox += (p.x - p.ox) * Math.min(1, 32 * dt); }
  } });

// Bubbled: trapped in a floating bubble that drifts upward (great for ring-outs over pits).
defStatus('bubbled', { name: 'Bubbled', icon: '◯', color: '#8fe9ff', debuff: true, max: 2, immunity: 1.4,
  onAdd(f) { rangedBubbleShell(f); },
  tick(f, dt) {
    for (const p of f.P) {
      kick(p, (0 - vx(p)) * 3 * dt, (-170 - vy(p)) * 22 * dt - PHYS.gravity * dt);
    }
  },
  onEnd(f) {
    const c = chest(f);
    burst(c.x, c.y, '#c8f6ff', 18, 320); ring(c.x, c.y, 70, '#c8f6ff', .25, 3);
    sfx('gun-pop');
  } });

// The visible bubble around a bubbled fighter (a decor projectile that follows it).
function rangedBubbleShell(f) {
  rangedDecor({ x: chest(f).x, y: chest(f).y, life: 2.2, kind: 'bubble-shell',
    onStep(q) {
      if (!f.alive || !f.status.bubbled) { q.dead = true; return; }
      const c = chest(f); q.x = c.x; q.y = c.y;
    },
    draw(ctx, q) {
      const r = 62 * f.scale + Math.sin(q.t * 9) * 3;
      circle(ctx, q.x, q.y, r, 'rgba(143,233,255,.12)', 'rgba(200,246,255,.75)', 2.5);
      circle(ctx, q.x - r * .4, q.y - r * .45, r * .16, 'rgba(255,255,255,.55)');
    } });
}

// ---------- sounds (80-audio loads after this slice, so they register at boot) ----------
on('boot', () => {
  defSfx('gun-revolver', () => { noise(.2, 1700, .4); tone(240, 55, .25, 'sawtooth', .12); });
  defSfx('gun-shotgun', () => { noise(.35, 650, .6, 'lowpass'); tone(150, 38, .3, 'sine', .45); noise(.08, 3000, .2); });
  defSfx('gun-minigun', () => { noise(.04, 3800, .12); tone(1300, 600, .03, 'square', .025); });
  defSfx('gun-spin', () => tone(160, 700, .14, 'sawtooth', .03));
  defSfx('gun-sniper', () => { noise(.45, 1300, .5); tone(1000, 70, .45, 'sawtooth', .1); noise(.5, 500, .16, 'lowpass', .16); });
  defSfx('gun-rocket', () => { noise(.55, 480, .4, 'lowpass'); tone(190, 80, .45, 'triangle', .09); });
  defSfx('gun-thump', () => { tone(170, 60, .14, 'sine', .45); noise(.1, 420, .25, 'lowpass'); });
  defSfx('gun-bounce', () => tone(620, 480, .05, 'triangle', .06));
  defSfx('gun-twang', () => { tone(330, 130, .2, 'triangle', .15); noise(.06, 3200, .1); });
  defSfx('gun-throw', () => noise(.13, 5200, .16, 'highpass'));
  defSfx('gun-laser', () => { tone(2300, 260, .24, 'sawtooth', .09); tone(1150, 140, .26, 'square', .05); });
  defSfx('gun-plasma', () => { tone(140, 640, .32, 'sawtooth', .1); noise(.3, 900, .22); });
  defSfx('gun-charge', () => tone(260, 900, .5, 'triangle', .035));
  defSfx('gun-flame', () => noise(.14, 850, .16));
  defSfx('gun-ice', () => { tone(2700, 1900, .08, 'triangle', .05); noise(.05, 6200, .08, 'highpass'); });
  defSfx('gun-zap', () => { noise(.28, 3200, .32, 'highpass'); tone(85, 60, .22, 'sawtooth', .16); });
  defSfx('gun-wand', () => { tone(880, 1760, .16, 'sine', .08); tone(1320, 2640, .13, 'triangle', .05, .05); });
  defSfx('gun-void', () => { tone(95, 38, .7, 'sine', .45); tone(620, 90, .55, 'sawtooth', .05); });
  defSfx('gun-sling', () => { tone(520, 190, .08, 'triangle', .09); noise(.05, 2100, .1); });
  defSfx('gun-bonk', () => tone(760, 360, .1, 'square', .07));
  defSfx('gun-bubble', () => tone(380, 1250, .1, 'sine', .1));
  defSfx('gun-pop', () => { tone(950, 1900, .05, 'sine', .09); noise(.04, 5200, .08, 'highpass'); });
  defSfx('gun-party', () => {
    noise(.16, 2500, .3);
    tone(523, 523, .09, 'square', .06, .05); tone(659, 659, .09, 'square', .06, .14); tone(784, 784, .22, 'square', .06, .23);
  });
  defSfx('gun-click', () => tone(1500, 1400, .03, 'square', .04));
});

// =====================================================================================================================
// ---------- Pulse Pistol: the all-rounder ----------
defWeapon('pistol', {
  name: 'Pulse Pistol', cat: 'ranged', desc: 'Six quick energy shots, then a reload. Keep your distance.', order: 10,
  len: 34, mass: .7, dmg: .25, width: 4, color: '#5ef2ff',
  ranged: { cooldown: .3, ammo: 6, reload: 1.6, speed: 1500, spread: .05, recoil: 150,
    proj: rangedProj({ dmg: 6, r: 4, life: 1.2, kind: 'bullet' }) },
  ai: { range: 400, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.h, s.at(-4 * k, 12 * k * side), '#30344c', 7 * k);       // grip
    line(ctx, s.at(-8 * k), s.t, '#454b6b', 10 * k);                      // body
    line(ctx, s.at(-6 * k, -2 * k * side), s.at(s.L - 4 * k, -2 * k * side), '#8e96c4', 3 * k);
    glow(ctx, this.color, 12, () => line(ctx, s.at(2 * k, 2 * k * side), s.at(s.L - 6 * k, 2 * k * side), this.color, 2 * k));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Thunder Six: a heavy revolver ----------
defWeapon('revolver', {
  power: 1.0,    // balance: × damage dealt with it (see tmp/balance.md; raised from .88 for v3 guards)
  name: 'Thunder Six', cat: 'ranged', desc: 'Six slow, heavy rounds that knock foes back. Long reload.', order: 11,
  len: 40, mass: .9, dmg: .25, width: 4, color: '#ffd84a', bodyRecoil: 160,
  ranged: { cooldown: .5, ammo: 6, reload: 2.3, speed: 2100, spread: .035, recoil: 320, sfx: 'gun-revolver',
    proj: rangedProj({ dmg: 8, r: 5, life: 1, kb: 420, kind: 'bullet' }) },
  ai: { range: 420, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.h, s.at(-8 * k, 13 * k * side), '#6b4a2e', 8 * k);       // wooden grip
    line(ctx, s.at(-6 * k), s.t, '#5a5f78', 7 * k);                        // long barrel
    const cyl = s.at(6 * k);
    circle(ctx, cyl.x, cyl.y, 7 * k, '#8e96c4', '#2a2d3e', 2);
    for (let i = 0; i < 6; i++) {                                          // cylinder chambers: lit = loaded
      const a = i * TAU / 6, cx = cyl.x + Math.cos(a) * 4 * k, cy = cyl.y + Math.sin(a) * 4 * k;
      circle(ctx, cx, cy, 1.4 * k, i < f.ammo ? this.color : '#1a1c2c');
    }
    glow(ctx, this.color, 8, () => circle(ctx, s.t.x, s.t.y, 2.5 * k, this.color));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Boomstick: shotgun ----------
defWeapon('shotgun', {
  power: 0.92,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Boomstick', cat: 'ranged', desc: 'Six pellets per blast. Brutal up close, kicks like a mule.', order: 12,
  len: 56, mass: 1.2, dmg: .25, width: 5, color: '#ff8a2e', twoHanded: true, bodyRecoil: 380,
  ranged: { cooldown: .8, ammo: 2, reload: 2, speed: 1350, spread: .17, pellets: 6, recoil: 380, sfx: 'gun-shotgun',
    proj: { dmg: 0, pdmg: 2.4, pkb: 260, packWindow: .07, r: 3, life: .42, drag: 1.6 } },
  ai: { range: 230, style: 'ranged' },
  attack(f) { rangedAttack(f, g => rangedFire(g, rangedProj({ packKey: rangedVolleyKey(), onHit: rangedPackHit }))); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.at(-22 * k, 6 * k * side), s.h, '#6b4a2e', 10 * k);     // stock
    line(ctx, s.at(-4 * k), s.t, '#3a3f58', 8 * k);
    line(ctx, s.at(4 * k, -3 * k * side), s.at(s.L, -3 * k * side), '#5a5f78', 4 * k);
    line(ctx, s.at(12 * k, 5 * k * side), s.at(28 * k, 5 * k * side), '#8a6a44', 6 * k);   // pump
    glow(ctx, this.color, 10, () => line(ctx, s.at(s.L - 3 * k, -5 * k), s.at(s.L - 3 * k, 5 * k), this.color, 3 * k));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Buzzsaw: minigun that has to spin up ----------
defWeapon('minigun', {
  power: 0.9,    // balance: × damage dealt with it (see tmp/balance.md; raised from .82 for v3 guards)
  name: 'Buzzsaw', cat: 'ranged', desc: 'Hold attack to spin up, then a hail of bullets. Heavy: you walk slower.', order: 13,
  len: 58, mass: 1.6, dmg: .25, width: 6, color: '#ffe066', twoHanded: true, speed: .85, bodyRecoil: 30,
  ranged: { cooldown: .08, ammo: 40, reload: 3, auto: true, speed: 1700, spread: .1, recoil: 50, sfx: 'gun-minigun',
    proj: rangedProj({ dmg: 0, pdmg: 1.6, pkb: 90, packWindow: .3, packKey: 'minigun', r: 3, life: .9, onHit: rangedPackHit }) },
  ai: { range: 380, style: 'ranged',
    think(f, foe, d) { f.inp.attackHeld = d < 600 && (f.mem.spin > .2 || chance(.65)); } },
  attack(f) {
    const spin = f.mem.spin || 0;
    if (spin < .35 && f.ammo > 0 && f.reload <= 0) { f.atkCd = .03; return; }   // still spinning up
    rangedAttack(f, g => { rangedFire(g); g.atkCd = lerp(.16, .08, spin) * cdMul(g); });
  },
  onStep(f, dt) {
    const want = f.inp.attackHeld && canAct(f) && f.reload <= 0;
    const before = f.mem.spin || 0;
    f.mem.spin = clamp(before + (want ? dt / .35 : -dt / .7), 0, 1);   // ~.12 s to the first shot
    f.mem.spinA = (f.mem.spinA || 0) + f.mem.spin * dt * 40;
    if (want && before < .05) sfx('gun-spin');
  },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s), a = f.mem.spinA || 0;
    line(ctx, s.h, s.at(-6 * k, 14 * k * side), '#30344c', 7 * k);
    line(ctx, s.at(-14 * k), s.at(16 * k), '#454b6b', 16 * k);             // motor housing
    for (let i = 0; i < 3; i++) {                                           // three spinning barrels
      const o = Math.sin(a + i * TAU / 3) * 5 * k;
      line(ctx, s.at(14 * k, o), s.at(s.L, o), Math.cos(a + i * TAU / 3) > 0 ? '#9aa1c4' : '#5a5f78', 3 * k);
    }
    line(ctx, s.at(s.L - 6 * k, -7 * k), s.at(s.L - 6 * k, 7 * k), '#2a2d3e', 4 * k);
    const heat = f.mem.spin || 0;
    if (heat > .1) glow(ctx, this.color, 14, () => circle(ctx, s.t.x, s.t.y, 3 * k * heat, rgba('#ffe066', heat)));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Longshot: sniper rifle with a laser sight ----------
defWeapon('sniper', {
  power: 0.85,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Longshot', cat: 'ranged', desc: 'Huge damage, two shots, slow reload. Stand still for a steady aim.', order: 14,
  len: 74, mass: 1.3, dmg: .25, width: 4, color: '#ff3d5a', twoHanded: true, speed: .92, bodyRecoil: 420,
  ranged: { cooldown: 1.3, ammo: 2, reload: 2.8, speed: 3400, spread: 0, recoil: 460, sfx: 'gun-sniper',
    proj: rangedProj({ dmg: 14, r: 4, life: .8, pierce: 1, kb: 520, headMul: 1.5 }) },
  ai: { range: 560, style: 'ranged' },
  attack(f) {
    rangedAttack(f, g => {
      const b = rangedBarrel(g), moving = Math.abs(vx(g.P[2])) > 120 || !g.grounded;
      const a = Math.atan2(b.uy, b.ux) + rnd(-1, 1) * (moving ? .11 : .012);   // running or airborne shots stray
      rangedFire(g, { vx: Math.cos(a) * 3400, vy: Math.sin(a) * 3400 });
      flashScreen(this.color, .08);
    });
  },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    if (f.reload <= 0 && f.alive && f.atkCd <= .3) {                         // laser sight (hidden while cycling)
      const len = rangedRayLen(s.t.x, s.t.y, s.ux, s.uy, 1500);
      ctx.globalAlpha = .55;
      lineXY(ctx, s.t.x, s.t.y, s.t.x + s.ux * len, s.t.y + s.uy * len, this.color, 1.2);
      ctx.globalAlpha = 1;
      circle(ctx, s.t.x + s.ux * len, s.t.y + s.uy * len, 3, this.color);
    }
    line(ctx, s.at(-24 * k, 5 * k * side), s.at(4 * k), '#6b4a2e', 9 * k);   // stock
    line(ctx, s.at(-2 * k), s.t, '#6a7394', 5 * k);
    line(ctx, s.at(-2 * k), s.t, '#9aa1c4', 1.5 * k);
    line(ctx, s.at(6 * k, -7 * k * side), s.at(26 * k, -7 * k * side), '#5a5f78', 6 * k);   // scope
    const lens = s.at(26 * k, -7 * k * side);
    glow(ctx, this.color, 8, () => circle(ctx, lens.x, lens.y, 2.4 * k, this.color));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Skyrocket: rocket launcher (blast yourself for a rocket jump) ----------
function rocketStep(p, dt) {
  const sp = Math.hypot(p.vx, p.vy) || 1, k = Math.min(1500, sp + 2600 * dt) / sp;   // accelerates after launch
  p.vx *= k; p.vy *= k;
  if (chance(dt * 40)) burst(p.x - p.vx * .01, p.y - p.vy * .01, chance(.5) ? '#8a8fa8' : '#ffb347', 1, 60, { grav: -120, life: .5, size: 1.6 });
}
// The blast throws its own shooter too (no damage): fire at your feet to rocket jump.
function rocketSelfBlast(p) {
  const f = p.owner;
  if (!f || !f.alive) return;
  let d = Infinity;
  for (const j of [0, 2, 8, 10]) d = Math.min(d, Math.hypot(f.P[j].x - p.x, f.P[j].y - p.y));
  const reach = p.explode * 1.2;
  if (d > reach) return;
  const c = chest(f), n = Math.hypot(c.x - p.x, c.y - p.y) || 1, fall = 1 - d / reach * .5;
  const nx = (c.x - p.x) / n, ny = (c.y - p.y) / n;
  for (const q of f.P) setVel(q, vx(q) + nx * 700 * fall, Math.min(vy(q), 0) + ny * 500 * fall - 1100 * fall);
  f.stagger = Math.max(f.stagger, .15);
  float(c.x, c.y - 60, 'ROCKET JUMP', p.color, 18);
}
function rocketDraw(ctx, p) {
  const a = Math.atan2(p.vy, p.vx), c = Math.cos(a), s = Math.sin(a);
  rangedTrail(ctx, p, 'rgba(160,165,190,.35)', 6);
  lineXY(ctx, p.x - c * 14, p.y - s * 14, p.x + c * 8, p.y + s * 8, '#d8dcef', 7);
  lineXY(ctx, p.x + c * 6, p.y + s * 6, p.x + c * 11, p.y + s * 11, p.color, 7);
  circle(ctx, p.x - c * 17, p.y - s * 17, 4 + Math.random() * 3, '#ffb347');
  circle(ctx, p.x - c * 16, p.y - s * 16, 2.5, '#ffffff');
}
defWeapon('rocket', {
  power: 0.94,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Skyrocket', cat: 'ranged', desc: 'One big explosive rocket. Blast your own feet to rocket jump.', order: 15,
  len: 62, mass: 1.6, dmg: .25, width: 7, color: '#ff5a3a', twoHanded: true, speed: .9, bodyRecoil: 340,
  ranged: { cooldown: .6, ammo: 1, reload: 2.3, speed: 520, spread: .02, recoil: 360, sfx: 'gun-rocket',
    proj: rangedProj({ dmg: 19, r: 6, life: 2.4, explode: 100, kb: 760, kind: 'rocket', trail: true, onStep: rocketStep,
      onExpire: rocketSelfBlast, draw: rocketDraw }) },
  ai: { range: 380, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.h, s.at(-2 * k, 12 * k * side), '#30344c', 7 * k);
    line(ctx, s.at(-26 * k), s.t, '#3d5a3a', 15 * k);                       // tube
    line(ctx, s.at(-26 * k), s.at(-20 * k), '#2a2d3e', 17 * k);
    line(ctx, s.at(s.L - 6 * k), s.t, '#2a2d3e', 17 * k);
    if (f.ammo > 0) glow(ctx, this.color, 10, () => circle(ctx, s.t.x, s.t.y, 5 * k, this.color));   // rocket loaded
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Pop Launcher: bouncing grenades on a fuse ----------
function grenadeDraw(ctx, p) {
  const blink = Math.sin(p.t * (8 + p.t * 30)) > 0;
  circle(ctx, p.x, p.y, 7, '#4f6b3a', '#1c2a14', 2);
  circle(ctx, p.x + 2, p.y - 3, 2.6, blink ? '#ff3d5a' : '#5a1c26');
  if (blink) circle(ctx, p.x, p.y, 16, null, rgba('#ff3d5a', .35), 2);
}
defWeapon('grenade', {
  power: 0.8,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Pop Launcher', cat: 'ranged', desc: 'Lobs bouncing grenades that blow after a short fuse.', order: 16,
  len: 50, mass: 1.3, dmg: .25, width: 6, color: '#9dff5a', twoHanded: true, bodyRecoil: 160,
  ranged: { cooldown: .55, ammo: 3, reload: 2.3, speed: 980, spread: .04, recoil: 260, sfx: 'gun-thump',
    proj: rangedProj({ dmg: 11, r: 7, life: 1.15, grav: .9, bounce: 4, explode: 92, kb: 640, kind: 'grenade', trail: false,
      onStep(p) { if (!p.lob) { p.lob = true; p.vy -= 360; } },     // lob a little higher than the barrel points
      onBounce() { sfx('gun-bounce'); }, draw: grenadeDraw }) },
  ai: { range: 340, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.at(-18 * k, 6 * k * side), s.h, '#3a3f58', 9 * k);
    line(ctx, s.at(-4 * k), s.t, '#4f6b3a', 13 * k);
    const drum = s.at(10 * k, 3 * k * side);
    circle(ctx, drum.x, drum.y, 8 * k, '#3a3f58', '#9aa1c4', 1.5);
    glow(ctx, this.color, 8, () => line(ctx, s.at(s.L - 4 * k, -6 * k), s.at(s.L - 4 * k, 6 * k), this.color, 3 * k));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Nailbow: crossbow whose bolts pin the legs ----------
function boltDraw(ctx, p) {
  const a = Math.atan2(p.vy, p.vx), c = Math.cos(a), s = Math.sin(a);
  lineXY(ctx, p.x - c * 26, p.y - s * 26, p.x, p.y, '#c9b37a', 3);
  poly(ctx, [[p.x + c * 7, p.y + s * 7], [p.x - s * 4, p.y + c * 4], [p.x + s * 4, p.y - c * 4]], '#e8ecff');
  lineXY(ctx, p.x - c * 26, p.y - s * 26, p.x - c * 20 - s * 5, p.y - s * 20 + c * 5, p.color, 2);
  lineXY(ctx, p.x - c * 26, p.y - s * 26, p.x - c * 20 + s * 5, p.y - s * 20 - c * 5, p.color, 2);
}
defWeapon('crossbow', {
  power: 0.82,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Nailbow', cat: 'ranged', desc: 'Fast heavy bolts that pin the target\'s legs in place.', order: 17,
  len: 46, mass: 1, dmg: .25, width: 5, color: '#ffcf6b', bodyRecoil: 90,
  ranged: { cooldown: .4, ammo: 1, reload: 1.1, speed: 2300, spread: .02, recoil: 200, sfx: 'gun-twang',
    proj: rangedProj({ dmg: 12, r: 4, life: 1.2, grav: .12, kb: 260, kind: 'bolt', status: ['pinned', .8], trail: false,
      draw: boltDraw, onExpire(p, why) { rangedStick(p, why, 24, '#c9b37a'); } }) },
  ai: { range: 440, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s), loaded = f.ammo > 0;
    line(ctx, s.at(-14 * k, 4 * k * side), s.t, '#6b4a2e', 7 * k);         // stock
    const bowAt = s.at(s.L - 8 * k), arm = 22 * k, pull = loaded ? 12 * k : 2 * k;
    const l = { x: bowAt.x + s.nx * arm - s.ux * 6 * k, y: bowAt.y + s.ny * arm - s.uy * 6 * k };
    const r = { x: bowAt.x - s.nx * arm - s.ux * 6 * k, y: bowAt.y - s.ny * arm - s.uy * 6 * k };
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 4 * k; ctx.beginPath();
    ctx.moveTo(l.x, l.y); ctx.quadraticCurveTo(bowAt.x + s.ux * 10 * k, bowAt.y + s.uy * 10 * k, r.x, r.y); ctx.stroke();
    const nock = s.at(s.L - 8 * k - pull);
    ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(l.x, l.y); ctx.lineTo(nock.x, nock.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    if (loaded) glow(ctx, this.color, 8, () => line(ctx, nock, s.at(s.L + 6 * k), this.color, 2.5 * k));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Moonbow: hold to draw, release to loose ----------
function arrowDraw(ctx, p) {
  const a = Math.atan2(p.vy, p.vx), c = Math.cos(a), s = Math.sin(a), len = 34;
  if (p.full) glow(ctx, p.color, 14, () => lineXY(ctx, p.x - c * len, p.y - s * len, p.x, p.y, p.color, 3));
  else lineXY(ctx, p.x - c * len, p.y - s * len, p.x, p.y, '#d8c8a0', 2.5);
  poly(ctx, [[p.x + c * 8, p.y + s * 8], [p.x - s * 4, p.y + c * 4], [p.x + s * 4, p.y - c * 4]], '#ffffff');
  lineXY(ctx, p.x - c * len, p.y - s * len, p.x - c * (len - 8) - s * 5, p.y - s * (len - 8) + c * 5, p.color, 2);
  lineXY(ctx, p.x - c * len, p.y - s * len, p.x - c * (len - 8) + s * 5, p.y - s * (len - 8) - c * 5, p.color, 2);
}
function longbowRelease(f, k) {
  const speed = lerp(950, 2500, k), full = k >= 1;
  const b = rangedBarrel(f), a = Math.atan2(b.uy, b.ux) - (1 - k) * .08;    // weak draws droop, so aim a touch higher
  rangedFire(f, { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: lerp(4, 16.5, k), kb: lerp(140, 420, k),
    pierce: full ? 1 : 0, full, color: full ? '#d8f0ff' : f.w.color });
  if (full) ring(b.x, b.y, 30, '#d8f0ff', .2, 3);
}
defWeapon('longbow', {
  power: 0.9,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Moonbow', cat: 'ranged', desc: 'Hold attack to draw, release to fire. A full draw pierces.', order: 18,
  len: 30, mass: .7, dmg: .25, width: 4, color: '#b9c8ff', chargeTime: .8, chargeMax: 2.4,
  ranged: { cooldown: .25, ammo: 1, reload: .4, speed: 2000, spread: .015, recoil: 110, sfx: 'gun-twang',
    proj: rangedProj({ dmg: 12, r: 4, life: 1.6, grav: .45, kind: 'arrow', trail: false, draw: arrowDraw,
      onExpire(p, why) { rangedStick(p, why, 30, '#d8c8a0'); } }) },
  ai: { range: 470, style: 'ranged', think: rangedChargeThink },
  attack(f) { rangedAttack(f, rangedChargeStart); },
  onStep(f, dt) { rangedChargeStep(f, dt, longbowRelease); },
  draw(ctx, f, s) {
    const k = s.k, pull = rangedChargeFrac(f), arm = 44 * k;
    const mid = s.t, l = { x: mid.x + s.nx * arm - s.ux * 12 * k, y: mid.y + s.ny * arm - s.uy * 12 * k };
    const r = { x: mid.x - s.nx * arm - s.ux * 12 * k, y: mid.y - s.ny * arm - s.uy * 12 * k };
    ctx.strokeStyle = '#d0d8ff'; ctx.lineWidth = 4 * k; ctx.beginPath();
    ctx.moveTo(l.x, l.y); ctx.quadraticCurveTo(mid.x + s.ux * 18 * k, mid.y + s.uy * 18 * k, r.x, r.y); ctx.stroke();
    const nock = s.at(s.L - 12 * k - pull * 30 * k);
    glow(ctx, this.color, 6, () => {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(l.x, l.y); ctx.lineTo(nock.x, nock.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    });
    if (f.ammo > 0 && f.reload <= 0) line(ctx, nock, s.at(s.L + 10 * k), pull >= 1 ? '#d8f0ff' : '#d8c8a0', 2.5 * k);
    rangedDrawCharge(ctx, f, s, this.color);
  },
});

// ---------- Shadow Kunai: a fan of thrown knives ----------
function kunaiDraw(ctx, p) {
  const a = p.t * 26, c = Math.cos(a), s = Math.sin(a);
  lineXY(ctx, p.x - c * 9, p.y - s * 9, p.x + c * 9, p.y + s * 9, '#dfe6ff', 3);
  circle(ctx, p.x - c * 10, p.y - s * 10, 2.5, null, p.color, 1.5);
}
defWeapon('kunai', {
  power: 1.12,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Shadow Kunai', cat: 'ranged', desc: 'Throw a fan of three spinning knives. Quick to restock.', order: 19,
  len: 26, mass: .5, dmg: .35, width: 4, color: '#b98cff',
  ranged: { cooldown: .45, ammo: 3, reload: 1.6, speed: 1500, spread: .11, pellets: 3, recoil: 90, sfx: 'gun-throw',
    proj: rangedProj({ dmg: 3.2, r: 4, life: 1, grav: .3, kb: 160, kind: 'kunai', trail: false, draw: kunaiDraw,
      onExpire(p, why) { rangedStick(p, why, 14, '#dfe6ff'); } }) },
  ai: { range: 340, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k;
    line(ctx, s.at(-6 * k), s.at(8 * k), '#2b2b36', 5 * k);
    poly(ctx, [s.at(8 * k, -4 * k), s.at(s.L + 6 * k), s.at(8 * k, 4 * k)], '#dfe6ff');
    const pommel = s.at(-9 * k);
    circle(ctx, pommel.x, pommel.y, 3.5 * k, null, this.color, 2);           // ring pommel
    for (let i = 1; i < f.ammo; i++) {                                     // spare knives fanned behind the first
      const a = s.at(4 * k, (i % 2 ? -1 : 1) * 7 * k * i);
      line(ctx, a, { x: a.x + s.ux * 18 * k, y: a.y + s.uy * 18 * k }, 'rgba(223,230,255,.6)', 2.5 * k);
    }
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Wingrang: a boomerang that hits going out and coming back ----------
function boomerangStep(p, dt) {
  const f = p.thrower;
  if (solidAt(p.x, p.y)) { p.vy = -Math.abs(p.vy) * .7; p.y -= 4; }      // skims off floors instead of passing through
  if (p.t < .38) { p.vy -= 260 * dt; return; }                            // outbound: curve up a little
  if (!p.back) { p.back = true; p.hits = []; }                              // can hit the same foe again on the way back
  if (!f || !f.alive) return;
  const h = f.P[f.main.hand], dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy) || 1;
  // Turn toward the thrower's hand (sharply when close) while speeding up.
  const cur = Math.atan2(p.vy, p.vx), want = Math.atan2(dy, dx), da = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
  const turn = d < 160 ? Math.PI : 7 * dt, a = cur + clamp(da, -turn, turn);
  const sp = Math.min(1400, Math.max(450, Math.hypot(p.vx, p.vy)) + 2600 * dt);
  p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
  if (d < 40 && p.owner === f) killProj(p, 'caught');
}
function boomerangCatch(p, why) {
  const f = p.thrower;
  if (why !== 'caught' || !f || !f.alive || f.wkey !== 'boomerang') return;
  f.ammo = f.w.ranged.ammo; f.reload = 0;
  burst(p.x, p.y, p.color, 6, 160, { life: .2 });
  sfx('reload');
}
function boomerangDraw(ctx, p) {
  const a = p.t * 22;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
  glow(ctx, p.color, 10, () => {
    ctx.strokeStyle = p.color; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(0, -4); ctx.lineTo(14, 8); ctx.stroke();
  });
  ctx.restore();
}
defWeapon('boomerang', {
  power: 0.7,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Wingrang', cat: 'exotic', desc: 'Hits on the way out and on the way back. Catch it to throw again.', order: 20,
  len: 28, mass: .6, dmg: .35, width: 5, color: '#5dff9a',
  ranged: { cooldown: .3, ammo: 1, reload: 2.2, speed: 1250, spread: .02, recoil: 120, sfx: 'gun-throw',
    proj: rangedProj({ dmg: 13, r: 10, life: 2, pierce: 20, kb: 300, solid: false, kind: 'boomerang', trail: false,
      onStep: boomerangStep, onExpire: boomerangCatch, draw: boomerangDraw }) },
  ai: { range: 340, style: 'ranged' },
  attack(f) { rangedAttack(f, g => rangedFire(g, { thrower: g })); },
  draw(ctx, f, s) {
    const k = s.k;
    if (!(f.ammo > 0)) { circle(ctx, s.h.x, s.h.y, 4 * k, null, this.color, 2); return; }   // empty hand while it flies
    const mid = s.at(s.L * .55);
    glow(ctx, this.color, 8, () => {
      ctx.strokeStyle = this.color; ctx.lineWidth = 6 * k; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(s.h.x, s.h.y); ctx.lineTo(mid.x + s.nx * 10 * k, mid.y + s.ny * 10 * k); ctx.lineTo(s.t.x, s.t.y); ctx.stroke();
    });
  },
});

// ---------- Photon Lance: instant laser beam ----------
function laserFire(f) {
  if (!rangedSpend(f)) return;
  const b = rangedBarrel(f), color = f.w.color;
  let len = rangedRayLen(b.x, b.y, b.ux, b.uy, 1500), left = 2;
  for (const h of rangedBeamHits(f, b.x, b.y, b.ux, b.uy, len)) {
    if (h.blocked) { len *= h.s; rangedBlockFx(h.B, h.x, h.y); break; }
    damage(h.B, 8.5 * (h.T.head ? 1.3 : 1), { src: f, x: h.x, y: h.y, nx: b.ux, ny: b.uy, kb: 300, head: h.T.head,
      kind: 'proj', parts: [h.T.a, h.T.b, 2], color });
    if (--left <= 0) { len *= h.s; break; }
  }
  const ex = b.x + b.ux * len, ey = b.y + b.uy * len;
  beam(b.x, b.y, ex, ey, color, 12, .22);
  beam(b.x, b.y, ex, ey, '#ffffff', 3, .12);
  burst(ex, ey, color, 10, 300, { life: .3 });
  ring(ex, ey, 22, color, .18, 3);
}
defWeapon('laser', {
  name: 'Photon Lance', cat: 'ranged', desc: 'An instant beam that pierces two foes. Three charges per cell.', order: 21,
  len: 56, mass: 1.1, dmg: .25, width: 5, color: '#ff5ad1', twoHanded: true, bodyRecoil: 120,
  ranged: { cooldown: .6, ammo: 3, reload: 2.5, speed: 3000, spread: 0, recoil: 220, sfx: 'gun-laser', proj: {} },
  ai: { range: 460, style: 'ranged' },
  attack(f) { rangedAttack(f, laserFire); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.at(-16 * k, 5 * k * side), s.h, '#30344c', 8 * k);
    line(ctx, s.at(-4 * k), s.t, '#e8ecff', 9 * k);
    line(ctx, s.at(-4 * k), s.t, '#9aa1c4', 4 * k);
    for (let i = 0; i < 3; i++) {                                            // charge cells
      const c = s.at(6 * k + i * 9 * k, -7 * k * side);
      circle(ctx, c.x, c.y, 2.6 * k, i < f.ammo ? this.color : '#2a2d3e');
    }
    glow(ctx, this.color, 16, () => circle(ctx, s.t.x, s.t.y, (3 + Math.sin(G_STATE.t * 12)) * k, this.color));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Nova Cannon: charge a plasma orb ----------
function plasmaDraw(ctx, p) {
  const r = p.r * (1 + Math.sin(p.t * 30) * .1);
  rangedTrail(ctx, p, rgba(p.color, .3), p.r * 1.6);
  glow(ctx, p.color, 22, () => circle(ctx, p.x, p.y, r, p.color));
  circle(ctx, p.x, p.y, r * .55, '#ffffff');
}
function plasmaRelease(f, k) {
  const big = k >= .5;
  rangedFire(f, { r: lerp(6, 16, k), dmg: lerp(7, 21, k), explode: big ? lerp(50, 95, k) : 0, kb: lerp(220, 700, k) });
  if (big) rangedShove(f, 240 * k);
}
defWeapon('plasma', {
  power: 0.94,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Nova Cannon', cat: 'ranged', desc: 'Hold to grow a plasma orb. Big orbs explode on impact.', order: 22,
  len: 48, mass: 1.4, dmg: .25, width: 6, color: '#7a5cff', twoHanded: true, chargeTime: 1.1, chargeMax: 2.6,
  ranged: { cooldown: .35, ammo: 1, reload: 1, speed: 780, spread: .01, recoil: 260, sfx: 'gun-plasma',
    proj: rangedProj({ dmg: 10, r: 8, life: 1.8, kind: 'plasma', trail: true, draw: plasmaDraw }) },
  ai: { range: 420, style: 'ranged', think: rangedChargeThink },
  attack(f) { rangedAttack(f, rangedChargeStart); },
  onStep(f, dt) { rangedChargeStep(f, dt, plasmaRelease); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s), ch = rangedChargeFrac(f);
    line(ctx, s.h, s.at(-2 * k, 12 * k * side), '#30344c', 7 * k);
    line(ctx, s.at(-14 * k), s.at(s.L - 8 * k), '#3a3460', 14 * k);
    line(ctx, s.at(s.L - 10 * k, -9 * k), s.at(s.L, -6 * k), '#9aa1c4', 4 * k);   // emitter prongs
    line(ctx, s.at(s.L - 10 * k, 9 * k), s.at(s.L, 6 * k), '#9aa1c4', 4 * k);
    if (ch > 0) {                                                                  // the orb growing at the muzzle
      const c = s.at(s.L + 4 * k), r = lerp(4, 16, ch) * k;
      glow(ctx, this.color, 24, () => circle(ctx, c.x, c.y, r + Math.sin(G_STATE.t * 40) * ch, this.color));
      circle(ctx, c.x, c.y, r * .5, '#ffffff');
    } else if (f.ammo > 0) {
      const core = s.at(s.L * .5);
      glow(ctx, this.color, 10, () => circle(ctx, core.x, core.y, 3 * k, this.color));
    }
    rangedDrawCharge(ctx, f, s, this.color);
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Dragon's Breath: flamethrower ----------
function flameDraw(ctx, p) {
  const k = clamp(p.t / p.life, 0, 1), r = 6 + k * 18;
  const color = k < .3 ? '#fff2a8' : k < .6 ? '#ffb02e' : k < .85 ? '#ff4a1a' : '#5a4a50';
  ctx.globalAlpha = (1 - k) * .75;
  circle(ctx, p.x, p.y, r, color);
  ctx.globalAlpha = 1;
}
defWeapon('flamethrower', {
  power: 1.4,    // balance: × damage dealt with it (see tmp/balance.md; raised from 1.08 for v3 guards)
  name: "Dragon's Breath", cat: 'ranged', desc: 'A short cone of fire. Sets foes alight; runs dry fast.', order: 23,
  len: 52, mass: 1.3, dmg: .25, width: 6, color: '#ff8a2e', twoHanded: true,
  ranged: { cooldown: .04, ammo: 45, reload: 2.6, auto: true, speed: 640, spread: .16, recoil: 18, sfx: 'gun-silent',
    proj: { dmg: 0, pdmg: .62, pkb: 110, pstatus: ['burn', 1.3, .6], packWindow: .3, packKey: 'flame', r: 10, life: .4,
      drag: 2.2, grav: -.12, pierce: 3, kind: 'flame', trail: false, onHit: rangedPackHit, draw: flameDraw } },
  ai: { range: 175, style: 'ranged',
    think(f, foe, d) { f.inp.attackHeld = d < 280 && chance(.85); } },
  attack(f) {
    rangedAttack(f, g => {
      rangedFire(g);
      if ((g.mem.flameN = (g.mem.flameN || 0) + 1) % 4 === 0) sfx('gun-flame');
    });
  },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.h, s.at(-4 * k, 12 * k * side), '#30344c', 7 * k);
    line(ctx, s.at(-18 * k, 8 * k * side), s.at(6 * k, 8 * k * side), '#a83a2a', 11 * k);   // fuel tank
    line(ctx, s.at(-6 * k), s.t, '#5a5f78', 6 * k);
    line(ctx, s.at(s.L - 6 * k), s.t, '#2a2d3e', 10 * k);
    const pilot = s.at(s.L + 3 * k);                                          // pilot light flickers
    glow(ctx, '#ffb02e', 10, () => circle(ctx, pilot.x, pilot.y, (2.5 + Math.random() * 1.5) * k, '#ffb02e'));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Cryo Ray: chills, then freezes ----------
// Each shard slows; enough shards in a row freeze the target solid (its next hit shatters the ice).
function cryoHit(p, B) {
  rangedPackHit(p, B);
  if (B.status.shield) return;
  const c = B.mem.rngChill || (B.mem.rngChill = { n: 0, t: 0 });
  if (G_STATE.t - c.t > 1.2) c.n = 0;
  c.n++; c.t = G_STATE.t;
  if (c.n >= 5 && addStatus(B, 'freeze', 1.1, 1, p.owner)) {
    c.n = 0;
    const ch = chest(B);
    ring(ch.x, ch.y, 70, '#c8f4ff', .35, 4);
    float(ch.x, ch.y - 50, 'FROZEN', '#c8f4ff', 24);
  }
}
function shardDraw(ctx, p) {
  const a = Math.atan2(p.vy, p.vx), c = Math.cos(a), s = Math.sin(a);
  rangedTrail(ctx, p, 'rgba(159,232,255,.3)', 4);
  poly(ctx, [[p.x + c * 8, p.y + s * 8], [p.x - s * 3, p.y + c * 3], [p.x - c * 6, p.y - s * 6], [p.x + s * 3, p.y - c * 3]], '#dff8ff');
}
defWeapon('cryo', {
  power: 0.88,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Cryo Ray', cat: 'ranged', desc: 'A stream of ice shards. Slows; a long burst freezes solid.', order: 24,
  len: 50, mass: 1.1, dmg: .25, width: 5, color: '#9fe8ff', twoHanded: true,
  ranged: { cooldown: .1, ammo: 22, reload: 2.3, auto: true, speed: 1250, spread: .05, recoil: 40, sfx: 'gun-ice',
    proj: rangedProj({ dmg: 0, pdmg: 1.9, pkb: 60, pstatus: ['slow', 1.1], packWindow: .3, packKey: 'cryo', r: 4, life: .5, drag: .8, kind: 'shard',
      onHit: cryoHit, draw: shardDraw }) },
  ai: { range: 330, style: 'ranged',
    think(f, foe, d) { f.inp.attackHeld = d < 520 && chance(.8); } },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.h, s.at(-4 * k, 12 * k * side), '#30344c', 7 * k);
    line(ctx, s.at(-10 * k), s.at(s.L - 12 * k), '#d8e4f0', 10 * k);
    for (let i = 0; i < 3; i++) {                                             // cooling rings
      const c = s.at(s.L - 12 * k + i * 5 * k);
      circle(ctx, c.x, c.y, (6 - i) * k, null, this.color, 2);
    }
    glow(ctx, this.color, 14, () => circle(ctx, s.t.x, s.t.y, 3 * k, '#e8fbff'));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Storm Staff: chain lightning ----------
// Nearest living enemy to (x, y) within range that isn't in `skip` and can be seen (no wall in between).
function stormTarget(x, y, team, range, skip) {
  let best = null, bd = range;
  for (const B of F) {
    if (!B.alive || B.team === team || skip.includes(B) || B.inv > 0) continue;
    const c = chest(B), d = Math.hypot(c.x - x, c.y - y);
    if (d >= bd) continue;
    if (rangedRayLen(x, y, (c.x - x) / (d || 1), (c.y - y) / (d || 1), d) < d - 4) continue;
    bd = d; best = B;
  }
  return best;
}
function stormZap(f) {
  const tip = f.P[f.tip], first = stormTarget(tip.x, tip.y, f.team, 380, []);
  if (!first) {                                                             // nothing in range: a harmless fizzle, no charge spent
    burst(tip.x, tip.y, f.w.color, 6, 200, { life: .2 });
    f.atkCd = .25;
    return;
  }
  if (!rangedSpend(f)) return;
  let from = { x: tip.x, y: tip.y }, B = first, power = 5.6;
  const hit = [];
  while (B && hit.length < 3) {
    const c = chest(B);
    rangedZigzag(from.x, from.y, c.x, c.y, f.w.color, 6);
    hit.push(B);
    const sh = rangedShieldOnRay(B, from.x, from.y, c.x, c.y);
    if (sh) { rangedBlockFx(B, sh.x, sh.y); break; }
    const nx = c.x - from.x, ny = c.y - from.y, n = Math.hypot(nx, ny) || 1;
    damage(B, power, { src: f, x: c.x, y: c.y, nx: nx / n, ny: ny / n, kb: 200, kind: 'proj', color: f.w.color,
      status: hit.length === 1 && chance(.2) ? ['stun', .3] : null, parts: ALL_BODY });
    burst(c.x, c.y, '#ffffff', 8, 300, { life: .2 });
    from = c; power *= .75;
    B = stormTarget(c.x, c.y, f.team, 260, hit);
  }
  flashScreen(f.w.color, .06);
}
defWeapon('storm-staff', {
  name: 'Storm Staff', cat: 'magic', desc: 'Lightning leaps to the nearest foe, then chains to others.', order: 30,
  len: 70, mass: .9, dmg: .35, width: 5, color: '#8fd0ff', twoHanded: true,
  ranged: { cooldown: .75, ammo: 3, reload: 2.8, speed: 2000, spread: 0, recoil: 140, sfx: 'gun-zap', proj: {} },
  ai: { range: 300, style: 'ranged' },
  attack(f) { rangedAttack(f, stormZap); },
  draw(ctx, f, s) {
    const k = s.k;
    line(ctx, s.at(-26 * k), s.at(s.L - 8 * k), '#5a4636', 5 * k);
    const c = s.at(s.L), t = G_STATE.t;
    ctx.strokeStyle = '#c9b37a'; ctx.lineWidth = 2.5 * k;
    ctx.beginPath(); ctx.arc(c.x, c.y, 9 * k, 0, TAU); ctx.stroke();       // orb cage
    const lit = f.ammo > 0 && f.reload <= 0;
    glow(ctx, this.color, lit ? 20 : 4, () => circle(ctx, c.x, c.y, 5.5 * k, lit ? this.color : '#3a4a60'));
    if (lit && Math.sin(t * 23 + f.id) > .6) rangedSpark(ctx, c.x, c.y, c.x + rnd(-18, 18) * k, c.y + rnd(-18, 18) * k, this.color, 2);
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Starlight Wand: homing stars ----------
function starDraw(ctx, p) {
  rangedTrail(ctx, p, rgba(p.color, .35), 4);
  glow(ctx, p.color, 14, () => rangedStar(ctx, p.x, p.y, 8, p.t * 9, p.color));
  circle(ctx, p.x, p.y, 2.5, '#ffffff');
}
defWeapon('wand', {
  power: 0.74,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Starlight Wand', cat: 'magic', desc: 'Slow stars that curve toward the nearest foe.', order: 31,
  len: 40, mass: .5, dmg: .25, width: 4, color: '#ffe36b',
  ranged: { cooldown: .42, ammo: 4, reload: 1.7, speed: 640, spread: .25, recoil: 70, sfx: 'gun-wand',
    proj: rangedProj({ dmg: 6.6, r: 6, life: 2, homing: 3.2, kb: 200, kind: 'star', draw: starDraw,
      onStep(p, dt) { if (chance(dt * 25)) burst(p.x, p.y, '#fff6c0', 1, 40, { grav: 0, life: .4, size: .8 }); } }) },
  ai: { range: 400, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k;
    line(ctx, s.h, s.t, '#3a2c50', 4 * k);
    line(ctx, s.at(-8 * k), s.at(4 * k), '#e8ecff', 5 * k);
    const lit = f.ammo > 0 && f.reload <= 0;
    glow(ctx, this.color, lit ? 16 : 3, () => rangedStar(ctx, s.t.x, s.t.y, 8 * k, G_STATE.t * 2, lit ? this.color : '#6b6440'));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Void Orb: a slow orb that collapses into a gravity well ----------
const VOID_RADIUS = 230;
// Pulls every enemy toward the well and gnaws at those near the middle.
function voidPull(q, dt) {
  q.acc = (q.acc || 0) + dt;
  const tick = q.acc >= .3;
  if (tick) q.acc -= .3;
  for (const B of F) {
    if (!B.alive || B.team === q.team) continue;
    const c = chest(B), d = Math.hypot(c.x - q.x, c.y - q.y);
    if (d > VOID_RADIUS) continue;
    const pull = (2600 * (1 - d / VOID_RADIUS) + 500) * dt, nx = (q.x - c.x) / (d || 1), ny = (q.y - c.y) / (d || 1);
    for (const p of B.P) kick(p, nx * pull, ny * pull - PHYS.gravity * .25 * dt);
    B.stagger = Math.max(B.stagger, .08);
    if (tick && d < 110) damage(B, 4, { src: q.owner, x: c.x, y: c.y, kind: 'proj', small: true, color: '#b98cff' });
  }
  if (chance(dt * 40)) {
    const a = rnd(0, TAU);
    burst(q.x + Math.cos(a) * 150, q.y + Math.sin(a) * 150, '#7a5cff', 1, 30, { grav: 0, life: .4 });
  }
}
function voidWellDraw(ctx, q) {
  const k = clamp(q.t / .2, 0, 1) * clamp((q.life - q.t) / .2, 0, 1), t = q.t;
  ctx.globalAlpha = .35 * k;
  circle(ctx, q.x, q.y, VOID_RADIUS * (.9 + Math.sin(t * 6) * .05), null, '#7a5cff', 2);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 3; i++) {
    const r = ((t * 140 + i * 60) % 180) + 10;
    ctx.globalAlpha = k * (1 - r / 190);
    circle(ctx, q.x, q.y, VOID_RADIUS * (1 - r / 190) * .8, null, '#b98cff', 2);
  }
  ctx.globalAlpha = 1;
  glow(ctx, '#7a5cff', 26, () => circle(ctx, q.x, q.y, 16 * k, '#05040c', '#b98cff', 3));
}
function voidCollapse(p) {
  const owner = p.owner;
  rangedDecor({ x: p.x, y: p.y, life: 1.4, owner, team: p.team, kind: 'void-well', onStep: voidPull, draw: voidWellDraw,
    onExpire(q) { explode(q.x, q.y, 85, 10, owner, { color: '#b98cff', kb: 520, team: q.team }); } });
  sfx('gun-void');
}
// The orb opens its well early when it flies past a foe, so a rusher who closes in can't simply outrun it.
function voidProximity(p) {
  for (const B of F) {
    if (B.alive && B.team !== p.team && dist(chest(B), p) < 80) { p.life = Math.min(p.life, p.t); return; }
  }
}
function voidOrbDraw(ctx, p) {
  glow(ctx, '#7a5cff', 18, () => circle(ctx, p.x, p.y, 10, '#05040c', '#b98cff', 3));
  ctx.strokeStyle = '#d8c8ff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, 15, p.t * 8, p.t * 8 + 2); ctx.stroke();
}
defWeapon('void-orb', {
  power: 0.82,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Void Orb', cat: 'magic', desc: 'Lob a dark orb that opens a gravity well (early, if it flies past a foe), then bursts.', order: 32,
  len: 30, mass: .8, dmg: .25, width: 5, color: '#b98cff',
  ranged: { cooldown: .5, ammo: 1, reload: 2, speed: 860, spread: .02, recoil: 120, sfx: 'gun-wand',
    proj: rangedProj({ dmg: 5, r: 9, life: .7, drag: 1.3, kb: 120, kind: 'void', trail: false, draw: voidOrbDraw,
      onStep: voidProximity, onExpire: voidCollapse }) },
  ai: { range: 360, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k, c = s.at(s.L * .7);
    line(ctx, s.h, c, '#3a2c50', 4 * k);
    for (let i = 0; i < 3; i++) {                                             // claw holding the orb
      const a = i * TAU / 3 + G_STATE.t * 1.5;
      lineXY(ctx, c.x, c.y, c.x + Math.cos(a) * 12 * k, c.y + Math.sin(a) * 12 * k, '#6b5a8a', 2.5 * k);
    }
    if (f.ammo > 0) glow(ctx, '#7a5cff', 16, () => circle(ctx, c.x, c.y, 8 * k, '#05040c', this.color, 2.5));
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Pebble Sling: bouncy, bonks heads ----------
function pebbleHit(p, B, dealt) {
  const head = B.P[0], onHead = Math.hypot(p.x - head.x, p.y - head.y) < (HEAD_R + 6) * B.scale + p.r;
  if (dealt > 0 && onHead) { addStatus(B, 'stun', .45, 1, p.owner); float(p.x, p.y - 30, 'BONK', '#ffd84a', 22); sfx('gun-bonk'); }
}
defWeapon('slingshot', {
  power: 0.84,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Pebble Sling', cat: 'ranged', desc: 'Bouncing pebbles with a big shove. Headshots stun.', order: 25,
  len: 32, mass: .5, dmg: .25, width: 4, color: '#c9b37a',
  ranged: { cooldown: .4, ammo: 5, reload: 1.4, speed: 1350, spread: .04, recoil: 100, sfx: 'gun-sling',
    proj: rangedProj({ dmg: 6, r: 5, life: 1.4, grav: .6, bounce: 2, kb: 440, headMul: 1.6, kind: 'pebble', trail: false,
      onHit: pebbleHit, onBounce() { sfx('gun-bounce'); },
      draw(ctx, p) { circle(ctx, p.x, p.y, 5, '#a8a090', '#5a5448', 2); } }) },
  ai: { range: 360, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k, fork = s.at(s.L - 8 * k), l = s.at(s.L, -10 * k), r = s.at(s.L, 10 * k);
    line(ctx, s.h, fork, '#8a6a44', 5 * k);
    line(ctx, fork, l, '#8a6a44', 4 * k); line(ctx, fork, r, '#8a6a44', 4 * k);
    const pouch = s.at(s.L - 14 * k);
    ctx.strokeStyle = '#ffcf6b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(pouch.x, pouch.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    if (f.ammo > 0 && f.reload <= 0) circle(ctx, pouch.x, pouch.y, 3.5 * k, '#a8a090');
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Bubble Blaster: joke gun that floats foes away ----------
function bubbleDraw(ctx, p) {
  const r = p.r + Math.sin(p.t * 10) * 1.5;
  circle(ctx, p.x, p.y, r, 'rgba(143,233,255,.15)', 'rgba(200,246,255,.85)', 2);
  circle(ctx, p.x - r * .35, p.y - r * .4, r * .22, 'rgba(255,255,255,.7)');
}
defWeapon('bubble', {
  power: 1.15,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Bubble Blaster', cat: 'exotic', desc: 'Silly slow bubbles. Trapped foes float helplessly upward.', order: 40,
  len: 36, mass: .6, dmg: .25, width: 5, color: '#8fe9ff',
  ranged: { cooldown: .34, ammo: 5, reload: 1.5, speed: 640, spread: .12, recoil: 60, sfx: 'gun-bubble',
    proj: rangedProj({ dmg: 5, r: 10, life: 2.2, grav: -.03, drag: .5, kb: 60, kind: 'bubble', trail: false,
      status: ['bubbled', 1.1], draw: bubbleDraw,
      onStep(p, dt) { p.vy += Math.sin(p.t * 7) * 240 * dt; },
      onExpire(p) { burst(p.x, p.y, '#c8f6ff', 6, 120, { life: .3 }); sfx('gun-pop'); } }) },
  ai: { range: 300, style: 'ranged' },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.h, s.at(-4 * k, 12 * k * side), '#ff5ad1', 7 * k);
    line(ctx, s.at(-8 * k), s.at(s.L - 8 * k), '#ffd84a', 12 * k);
    const tank = s.at(-2 * k, -9 * k * side);
    circle(ctx, tank.x, tank.y, 6 * k, 'rgba(143,233,255,.5)', '#5ef2ff', 2);   // soap tank
    const ringAt = s.at(s.L - 2 * k);
    circle(ctx, ringAt.x, ringAt.y, 7 * k, null, '#ff5ad1', 3 * k);
    if (f.ammo > 0) circle(ctx, ringAt.x, ringAt.y, 5 * k, 'rgba(200,246,255,.3)');
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});

// ---------- Party Popper: joke confetti cannon with a real shove ----------
function confettiDraw(ctx, p) {
  if (!p.cc) { p.cc = pick(RANGED_PARTY); p.spin = rnd(0, TAU); }        // each scrap gets its own colour and tumble
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 18 + p.spin);
  ctx.globalAlpha = clamp((p.life - p.t) * 4, 0, 1);
  ctx.fillStyle = p.cc; ctx.fillRect(-4, -2, 8, 4);
  ctx.restore(); ctx.globalAlpha = 1;
}
function confettiFire(f) {
  if (!rangedFire(f, rangedProj({ packKey: rangedVolleyKey(), onHit: rangedPackHit }))) return;
  const b = rangedBarrel(f);
  float(b.x, b.y - 30, pick(['TA-DA!', 'SURPRISE!', 'WOO!']), pick(RANGED_PARTY), 20);
  burst(b.x, b.y, pick(RANGED_PARTY), 14, 420, { life: .5 });
}
defWeapon('confetti', {
  power: 0.95,   // balance: × damage dealt with it (see tmp/balance.md)
  name: 'Party Popper', cat: 'exotic', desc: 'A blast of confetti. Barely hurts, but it shoves hard.', order: 41,
  len: 40, mass: .7, dmg: .25, width: 6, color: '#ff5ad1', bodyRecoil: 200,
  ranged: { cooldown: .55, ammo: 2, reload: 1.8, speed: 1150, spread: .3, pellets: 12, recoil: 260, sfx: 'gun-party',
    proj: { dmg: 0, pdmg: 1.05, pkb: 330, packWindow: .08, r: 4, life: .5, drag: 2.6, grav: .3, kind: 'confetti', trail: false,
      draw: confettiDraw } },
  ai: { range: 200, style: 'ranged' },
  attack(f) { rangedAttack(f, confettiFire); },
  draw(ctx, f, s) {
    const k = s.k, side = rangedSide(s);
    line(ctx, s.h, s.at(-4 * k, 12 * k * side), '#30344c', 6 * k);
    const mouthL = s.at(s.L, -11 * k), mouthR = s.at(s.L, 11 * k);
    poly(ctx, [s.at(-4 * k, -5 * k), mouthL, mouthR, s.at(-4 * k, 5 * k)], '#ff5ad1', '#ffd84a', 2);
    for (let i = 0; i < 3; i++) {                                              // stripes
      const d = (8 + i * 10) * k, w = 5 + (d / s.L) * 6;
      line(ctx, s.at(d, -w * k), s.at(d, w * k), RANGED_PARTY[(i + 1) % RANGED_PARTY.length], 2.5 * k);
    }
    for (let i = 0; f.ammo > 0 && i < 4; i++) {                              // confetti peeking out of a loaded tube
      const c = s.at(s.L - 2 * k, (i - 1.5) * 5 * k);
      circle(ctx, c.x, c.y, 1.8 * k, RANGED_PARTY[i]);
    }
    rangedDrawReload(ctx, f, s, this.color, this.ranged);
  },
});
