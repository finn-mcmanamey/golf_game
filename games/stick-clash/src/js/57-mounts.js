// 57-mounts.js: ridden power-ups from rare orbs: hoverboard, mech suit, jetpack and dragon. Each lasts def.time
// seconds and has its own movement (drive), attack and drawing; it ends on the timer, when its hp is worn down, or on
// one big hit (MOUNT_BIG damage). Mounted fighters can't block, grab, be grabbed, use ultimates or be disarmed.
// defMount(key, { name, icon, color, desc, time, hp, speedMul, takenMul, kbMul, auto, fly,
//   onMount(f, m), drive(f, dt, m, grounded), attack(f, m), draw(ctx, f, m, layer: 'under'|'over'), onEnd(f, m),
//   ai: { range, style, fly } })

const MOUNT_BIG = 18;
const MOUNT_TOP = 170;          // flying mounts stop climbing here (hip / dragon height), so the rider stays in view

function mount(f, key) {
  const def = MOUNTS[key];
  if (!def || !f.alive) return null;
  if (f.mount) dismount(f, 'swap');
  if (f.holding) grabRelease(f);
  f.blocking = false;
  f.mount = { key, t: def.time, hp: def.hp, x: f.P[2].x, y: f.P[2].y + 30, vx: 0, vy: 0, fuel: 100, hover: false, ramT: {} };
  hook(def, 'onMount', f, f.mount);
  const c = chest(f);
  float(c.x, c.y - 80, def.name.toUpperCase(), def.color, 24);
  ring(c.x, c.y, 90, def.color, .4, 5);
  sfx('orb');
  emit('mount', f, key);
  return f.mount;
}

function dismount(f, why) {
  const m = f.mount, def = m && MOUNTS[m.key];
  if (!m) return;
  f.mount = null;
  hook(def, 'onEnd', f, m);
  const c = chest(f);
  if (why === 'hit') { float(c.x, c.y - 70, 'DISMOUNTED', '#ff8a2e', 22); burst(c.x, c.y + 20, def.color, 24, 420); shake(8); sfx('shatter'); }
  else burst(c.x, c.y + 20, def.color, 12, 240);
  emit('dismount', f, m.key, why);
}

const mountDef = f => f.mount && MOUNTS[f.mount.key];
// Multiplier a mount puts on speed, damage taken or knockback (field 'speed' | 'taken' | 'kb').
function mountMul(f, field) { const d = mountDef(f); return d && d[field + 'Mul'] != null ? d[field + 'Mul'] : 1; }
const mountAuto = f => !!(mountDef(f) && mountDef(f).auto);
function mountDrive(f, dt, grounded) { const d = mountDef(f); if (d) hook(d, 'drive', f, dt, f.mount, grounded); }
function mountTick(f, dt) { if (f.mount && (f.mount.t -= dt) <= 0) dismount(f, 'time'); }
function mountDraw(f, layer) { const d = mountDef(f); if (d) hook(d, 'draw', ctx, f, f.mount, layer); }

// Hits wear the mount down; one big hit knocks the rider off. A flying mount is shoved along with its rider.
on('damage', (B, amt, o) => {
  const m = B.mount, direct = o && o.kind !== 'status' && o.kind !== 'hazard' && o.kind !== 'ringout';
  if (!m || !direct || !B.alive) return;
  m.hp -= amt;
  if (o.kb) { m.vx += (o.nx || 0) * o.kb * .5; m.vy += (o.ny || 0) * o.kb * .4; }
  if (amt >= MOUNT_BIG || m.hp <= 0) dismount(B, 'hit');
});
on('ko', v => { if (v.mount) dismount(v, 'ko'); });

// Mount attacks: damage that doesn't level the weapon or carry its element.
function mountHit(f, e, amt, o = {}) {
  const c = chest(e);
  return damage(e, amt, Object.assign({ src: f, kind: 'skill', x: c.x, y: c.y, nx: Math.sign(c.x - f.P[2].x) || f.face, ny: -.4, kb: 600,
    fromMount: true, parts: ALL_BODY }, o));
}
const mountFoes = (f, x, y, r) => F.filter(e => e.alive && e.team !== f.team && Math.hypot(chest(e).x - x, chest(e).y - y) < r);

// ---------- hoverboard: fast gliding, rams anyone it hits at speed ----------
defMount('hoverboard', { name: 'Hoverboard', icon: '≋', color: '#5ef2ff', time: 8, hp: 40, speedMul: 1.45,
  desc: 'Glide at high speed over the ground and ram foes.', ai: { range: 0, style: null },
  drive(f, dt, m) {
    const fy = feetY(f), g = groundBelow(f.P[2].x, fy - 10);
    m.hover = g != null && g - fy < 70 && vy(f.P[2]) > -400;
    if (m.hover) for (const j of [8, 10]) { const p = f.P[j]; p.fy += -PHYS.gravity * 2 + (g - 26 - p.y) * 300 - vy(p) * 22; }
    const sp = vx(f.P[2]);
    if (Math.abs(sp) < 420) return;
    for (const e of mountFoes(f, f.P[2].x, fy - 20, 70)) {
      if ((m.ramT[e.id] || 0) > G_STATE.t) continue;
      m.ramT[e.id] = G_STATE.t + .6;
      mountHit(f, e, 9, { kb: 760, nx: Math.sign(sp), ny: -.5 });
      sfx('punch');
    }
  },
  draw(ctx, f, m, layer) {
    if (layer !== 'under') return;
    const a = f.P[8], b = f.P[10], cx = (a.x + b.x) / 2, y = Math.max(a.y, b.y) + 8;
    glow(ctx, '#5ef2ff', 18, () => { ctx.fillStyle = '#163a4d'; ctx.beginPath(); ctx.ellipse(cx, y, 40, 7, 0, 0, TAU); ctx.fill(); });
    lineXY(ctx, cx - 36, y, cx + 36, y, '#5ef2ff', 3);
    ctx.globalAlpha *= .5 + .3 * Math.sin(G_STATE.t * 30);
    poly(ctx, [[cx - 22, y + 6], [cx - 14, y + 22], [cx - 6, y + 6]], '#5ef2ff'); poly(ctx, [[cx + 6, y + 6], [cx + 14, y + 22], [cx + 22, y + 6]], '#5ef2ff');
    ctx.globalAlpha /= .5 + .3 * Math.sin(G_STATE.t * 30);
  },
});

// ---------- mech suit: slow, armoured, huge punches ----------
defMount('mech', { name: 'Mech Suit', icon: '▣', color: '#ffd84a', time: 6, hp: 30, speedMul: .72, takenMul: .85, kbMul: .6,
  desc: 'Armour that softens damage and most knockback. Attack throws a crushing mech punch.', ai: { range: 125, style: 'melee' },
  attack(f, m) {
    f.atkCd = .95; m.punchT = .22;
    const c = chest(f);
    kick(f.P[6], f.face * 1400, -100); kick(f.P[5], f.face * 700, 0);
    for (const e of mountFoes(f, c.x + f.face * 70, c.y, 95)) mountHit(f, e, 12, { kb: 950, nx: f.face, ny: -.5 });
    burst(c.x + f.face * 90, c.y, '#ffd84a', 10, 320);
    sfx('slam', .8);
  },
  draw(ctx, f, m, layer) {
    if (layer !== 'over') return;
    const P = f.P, s = f.scale, n = P[1], h = P[2], col = '#8a93b8';
    ctx.save(); ctx.lineCap = 'round';
    for (const [a, b] of [[2, 7], [7, 8], [2, 9], [9, 10]]) line(ctx, P[a], P[b], col, 13 * s);    // armoured legs
    const ang = Math.atan2(h.y - n.y, h.x - n.x) - Math.PI / 2;
    ctx.translate((n.x + h.x) / 2, (n.y + h.y) / 2); ctx.rotate(ang);
    ctx.fillStyle = '#3a4058'; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-24 * s, -34 * s, 48 * s, 68 * s, 8) : ctx.rect(-24 * s, -34 * s, 48 * s, 68 * s); ctx.fill(); ctx.stroke();
    circle(ctx, 0, -8 * s, 7 * s, '#ffd84a');
    ctx.restore();
    for (const j of [4, 6]) circle(ctx, P[j].x, P[j].y, 13 * s, '#5a6280', f.color, 3);               // big fists
  },
});

// ---------- jetpack: hold jump to fly; the exhaust scorches whoever is below ----------
defMount('jetpack', { name: 'Jetpack', icon: '⇑', color: '#ff8a2e', time: 8, hp: 40, fly: true,
  desc: 'Hold jump to fly. The exhaust burns anyone underneath.', ai: { range: 0, style: null, fly: true },
  drive(f, dt, m, grounded) {
    const thrust = f.inp.jumpHeld && m.fuel > 0 && !grounded && f.coyote <= 0 && f.P[2].y > MOUNT_TOP;   // airborne, not a stride
    m.thrust = thrust;
    if (!grounded) f.jumpCd = Math.max(f.jumpCd, .1);                  // in the air the jump key is the throttle
    if (thrust) {
      m.fuel = Math.max(0, m.fuel - 28 * dt);
      // Pushed from the back, high up: more lift on the head and neck keeps the rider upright in flight.
      f.P.forEach((p, j) => { p.fy -= PHYS.gravity * (j <= 2 ? 3.3 : 2.2); if (vy(p) < -540) p.fy += (-540 - vy(p)) * 8; });
      for (const j of UPPER_BODY) f.P[j].fx += (clamp(f.inp.mx, -1, 1) * TUNE.speed - vx(f.P[j])) * 6;
      if ((m.burnT = (m.burnT || 0) - dt) <= 0) {
        m.burnT = .15;
        const x = f.P[2].x - f.face * 10, y = f.P[2].y + 30;
        for (const e of F) if (e.alive && e.team !== f.team && Math.abs(chest(e).x - x) < 34 && chest(e).y > y && chest(e).y - y < 150) {
          mountHit(f, e, 2, { kb: 0, status: ['burn', .8, .5], small: true });
        }
      }
    } else if (grounded) m.fuel = Math.min(100, m.fuel + 45 * dt);
  },
  draw(ctx, f, m, layer) {
    if (layer !== 'over') return;
    const n = f.P[1], h = f.P[2], s = f.scale, bx = lerp(n.x, h.x, .45) - f.face * 12 * s, by = lerp(n.y, h.y, .45);
    ctx.fillStyle = '#4a5070'; ctx.strokeStyle = '#ff8a2e'; ctx.lineWidth = 2;
    ctx.fillRect(bx - 8 * s, by - 16 * s, 16 * s, 30 * s); ctx.strokeRect(bx - 8 * s, by - 16 * s, 16 * s, 30 * s);
    if (m.thrust) {
      const L = 22 + Math.random() * 16;
      glow(ctx, '#ff8a2e', 16, () => poly(ctx, [[bx - 6 * s, by + 14 * s], [bx, by + (14 + L) * s], [bx + 6 * s, by + 14 * s]], '#ffb02e'));
    }
    ctx.fillStyle = '#ff8a2e'; ctx.fillRect(bx - 8 * s, by - 20 * s, 16 * s * m.fuel / 100, 3);        // fuel gauge
  },
});

// ---------- dragon: fly freely and breathe fire (hold attack) ----------
defMount('dragon', { name: 'Dragon', icon: '♞', color: '#ff4a3c', time: 8, hp: 55, fly: true, auto: true, speedMul: 1.15,
  desc: 'Ride a small dragon: fly with jump, hold attack to breathe fire.', ai: { range: 300, style: 'ranged', fly: true },
  onMount(f, m) { m.x = f.P[2].x; m.y = feetY(f) - 10; m.carried = true; },   // carried: the rider's body just sits on it
  drive(f, dt, m) {
    const want = clamp(f.inp.mx, -1, 1) * TUNE.speed * 1.15;
    m.vx += (want - m.vx) * Math.min(1, dt * 5);
    m.vy += ((f.inp.jumpHeld ? -380 : 140) - m.vy) * Math.min(1, dt * 3);
    m.x = clamp(m.x + m.vx * dt, 50, W - 50); m.y += m.vy * dt;
    const g = groundBelow(m.x, m.y - 40);
    if (g != null && m.y > g - 36) { m.y = g - 36; m.vy = Math.min(0, m.vy); }
    if (m.y < MOUNT_TOP + 60) { m.y = MOUNT_TOP + 60; m.vy = Math.max(0, m.vy); }   // the rider sits ~100 px above it
    if (m.y > H + 200) m.y = H + 200;
    f.jumpCd = Math.max(f.jumpCd, .1);                                // the jump key flies; no hopping off
    const s = f.scale;                                                 // the rider straddles the dragon's back
    for (const p of f.P) p.fy -= PHYS.gravity;
    spring(f.P[2], m.x, m.y - 30 * s, 260, 18);
    spring(f.P[8], m.x - f.face * 26 * s, m.y + 12 * s, 160, 12); spring(f.P[10], m.x + f.face * 14 * s, m.y + 16 * s, 160, 12);
    spring(f.P[0], m.x + f.face * 6 * s, m.y - 100 * s, 120, 10);
  },
  attack(f, m) {
    f.atkCd = .07;
    const hx = m.x + f.face * 86 * f.scale, hy = m.y - 24 * f.scale, foe = nearestEnemy(f, true);
    let ang = foe ? Math.atan2(chest(foe).y - hy, chest(foe).x - hx) : (f.face > 0 ? .2 : Math.PI - .2);
    if (Math.cos(ang) * f.face < .2) ang = f.face > 0 ? clamp(ang, -1.3, 1.3) : Math.PI - clamp(Math.PI - ang, -1.3, 1.3);   // breathe forward only
    ang += rnd(-.12, .12);
    spawnProj({ owner: f, x: hx, y: hy, vx: Math.cos(ang) * 760, vy: Math.sin(ang) * 760, r: 6, dmg: 2.1, life: .45, drag: 1.4,
      color: chance(.5) ? '#ff7a2e' : '#ffd84a', status: ['burn', .8, .6], kb: 60, dmgKind: 'skill', fromMount: true });
    if (chance(.25)) sfx('gun-flame', .5);
  },
  draw(ctx, f, m, layer) {
    if (layer !== 'under') return;
    const s = f.scale * 1.5, x = m.x, y = m.y, d = f.face, flap = Math.sin(G_STATE.t * 9) * 26 * s;
    ctx.save(); ctx.lineCap = ctx.lineJoin = 'round';
    poly(ctx, [[x - 10 * d * s, y - 6 * s], [x - 40 * d * s, y - 30 * s - flap], [x + 6 * d * s, y - 8 * s]], rgba('#ff4a3c', .7), '#ffd84a', 2);   // far wing
    ctx.lineWidth = 6 * s; ctx.strokeStyle = '#c42e22';
    ctx.beginPath(); ctx.moveTo(x - 30 * d * s, y + 2 * s); ctx.quadraticCurveTo(x - 60 * d * s, y + 10 * s, x - 76 * d * s, y - 6 * s + flap * .2); ctx.stroke();   // tail
    glow(ctx, '#ff4a3c', 14, () => { ctx.fillStyle = '#e0412f'; ctx.beginPath(); ctx.ellipse(x, y, 36 * s, 15 * s, 0, 0, TAU); ctx.fill(); });
    ctx.beginPath(); ctx.moveTo(x + 26 * d * s, y - 4 * s); ctx.quadraticCurveTo(x + 46 * d * s, y - 22 * s, x + 56 * d * s, y - 16 * s); ctx.stroke();   // neck
    circle(ctx, x + 60 * d * s, y - 16 * s, 9 * s, '#e0412f', '#ffd84a', 2);                                   // head
    circle(ctx, x + 63 * d * s, y - 19 * s, 2 * s, '#ffd84a');
    poly(ctx, [[x + 4 * d * s, y - 6 * s], [x + 26 * d * s, y - 38 * s + flap], [x + 30 * d * s, y - 4 * s]], rgba('#ff6a4c', .85), '#ffd84a', 2);   // near wing
    ctx.restore();
  },
});

// ---------- the mount orbs (rare) ----------
for (const key of Object.keys(MOUNTS)) {
  const d = MOUNTS[key];
  defOrb('mount-' + key, { name: d.name, icon: d.icon, color: d.color, weight: .2, desc: `Ride for ${d.time} s: ${d.desc}`,
    grab(f) { mount(f, key); } });
}
