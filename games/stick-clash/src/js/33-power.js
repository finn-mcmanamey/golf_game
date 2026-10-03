// 33-power.js: the super meter, in-match weapon levels and the eight weapon-category ultimates.
//   Super meter: fills from damage dealt and taken (0..100, carried between rounds). Full + the super key fires the
//   ultimate of the held weapon's category (ULTIMATES[cat], defUltimate in 00-core). Ultimates deal kind 'skill'
//   damage so their strength never depends on the weapon's balance knob.
//   Weapon levels: damage dealt with a weapon (per weapon key, for the whole match) levels it Lv1 -> Lv2 -> Lv3.
//   Lv2: longer reach (melee) and +10% damage. Lv3: +20% and an elemental trail whose hits carry a light effect.

const SUPER = { dealt: .55, taken: .4, indirect: .2, cap: 30 };   // meter per point of damage: about one ultimate every two rounds
const LEVELS = { xp: [0, 55, 140], dmg: [1, 1.1, 1.2], reach: [1, 1.15, 1.25] };
// The natural element of each category at Lv3 (56-fusion defines the elements).
const LEVEL_ELEMENT = { blade: 'shock', heavy: 'fire', polearm: 'ice', chain: 'poison', fist: 'fire', ranged: 'shock', magic: 'ice',
  exotic: 'poison', shield: 'shock' };

// ---------- super meter ----------
function gainSuper(f, n) {
  if (!f || !f.alive || f.summon || f.ult || !(n > 0)) return;
  const before = f.super;
  f.super = Math.min(100, f.super + n * (f.superMul || 1));
  if (before < 100 && f.super >= 100) {
    const c = chest(f);
    float(c.x, c.y - 70, 'SUPER READY', '#ffd84a', 22);
    ring(c.x, c.y, 70 * f.scale, '#ffd84a', .4, 4);
    sfx('skill', .6);
  }
}

// Gains count at most SUPER.cap per hit, so an overkill blow (or a one-hit-KO mode) can't fill a bar at once.
on('damage', (B, amt, o) => {
  const A = o && o.src && o.src !== B ? o.src : null, kind = o && o.kind, n = Math.min(amt, SUPER.cap);
  const direct = kind !== 'status' && kind !== 'hazard' && kind !== 'ringout';
  if (B.hp > 0) gainSuper(B, n * (direct ? SUPER.taken : SUPER.indirect));
  if (A && direct) gainSuper(A, n * SUPER.dealt);
  if (A && (kind === 'melee' || kind === 'proj' || kind === 'explode') && !o.fromMount) levelXp(A, n, o);
});

// ---------- weapon levels ----------
function levelXp(A, amt, o) {
  if (!A.alive || A.summon || !A.wxp || (o.weapon && o.weapon !== A.w && o.weapon !== (A.off && A.off.w))) return;
  A.wxp[A.wkey] = (A.wxp[A.wkey] || 0) + amt;
  const lv = levelOf(A);
  if (lv > A.lvl) { setLevel(A, lv); levelUpFx(A, lv); }
}
const levelOf = f => LEVELS.xp.reduce((lv, need, i) => (f.wxp[f.wkey] || 0) >= need ? i + 1 : lv, 1);

function setLevel(f, lv) {
  f.lvl = lv; f.lvlKey = f.wkey;
  f.lvlDmg = LEVELS.dmg[lv - 1];
  f.reachMul = f.w.ranged ? 1 : LEVELS.reach[lv - 1];
}

function levelUpFx(f, lv) {
  const t = f.P[f.tip];
  float(t.x, t.y - 30, `${f.w.name.toUpperCase()} LV${lv}`, lv >= 3 ? '#ffd84a' : '#5ef2ff', 22);
  ring(t.x, t.y, 50, lv >= 3 ? '#ffd84a' : '#5ef2ff', .35, 4);
  burst(t.x, t.y, '#ffffff', 12, 300);
  sfx('orb', .6);
  emit('levelUp', f, lv);
}

// Draw-only sparkle trail along a Lv3 weapon (no burst(): drawing must not spawn effects).
function levelDraw(f) {
  const el = ELEMENTS[LEVEL_ELEMENT[f.w.cat]], tip = f.P[f.tip];
  if (!el || f.element) return;
  ctx.save();
  ctx.globalAlpha = .75; ctx.shadowColor = el.color; ctx.shadowBlur = 14;
  for (let k = 0; k < 4; k++) {
    const a = G_STATE.t * 9 + k * 1.7, r = 6 + 4 * Math.sin(G_STATE.t * 13 + k);
    circle(ctx, tip.x + Math.cos(a) * r, tip.y + Math.sin(a) * r, 2.2 * f.scale, el.color);
  }
  ctx.restore();
}

// ---------- ultimates ----------
const ultFor = f => ULTIMATES[f.w.cat] || ULTIMATES.blade;
let ULT_CUTIN = null;     // { name, who, color, t } for the cinematic band across the screen

function useUltimate(f) {
  const def = ultFor(f);
  if (!def || f.super < 100 || f.mount || f.heldBy || f.holding || f.ult) return false;
  f.ult = { key: def.key, t: 0, dur: def.time, hit: new Set(), n: 0 };
  if (hook(def, 'use', f, f.ult) === false) { f.ult = null; return false; }
  f.super = 0; f.stats.ults++;
  f.blocking = false;
  const c = chest(f);
  ultCutin(def.name, f.name, def.color);
  focusCamera(c.x, c.y, .9);
  slowmo(.3, .35); flashScreen(def.color, .22); shake(10);
  sfx('ult');
  emit('ultimate', f, def.key);
  return true;
}

function ultCutin(name, who, color) {
  if (G_STATE.sim || G_STATE.demo) return;
  if (FX_RECORD) FX_RECORD('cutin', [name, who, color]);
  ULT_CUTIN = { name, who, color, t: 0 };
}
on('boot', () => {
  if (typeof KC_FX === 'object') KC_FX.cutin = ultCutin;            // the kill-cam replays the cut-in
  // A rising power chord with a whoosh: the ultimate's sting (audio loads after this slice, so it registers at boot).
  defSfx('ult', v => { tone(220, 660, .5, 'sawtooth', .07 * v); tone(330, 990, .5, 'square', .04 * v, .05); noiseSweep(.6, 300, 4000, .08 * v, 'bandpass'); thump(120, 40, .35, .3 * v, .45); });
});

function ultStep(f, dt) {
  const u = f.ult, def = ULTIMATES[u.key];
  if (!f.alive || !def) { f.ult = null; return; }
  u.t += dt;
  hook(def, 'step', f, dt, u);
  if (u.t >= u.dur && f.ult === u) { hook(def, 'end', f, u); f.ult = null; }
}
function ultDraw(f) { const def = ULTIMATES[f.ult.key]; if (def && def.draw) hook(def, 'draw', ctx, f, f.ult); }

// Shared helpers for the ultimates below.
const ultFoes = (f, x, y, r) => F.filter(e => e.alive && e.team !== f.team && Math.hypot(chest(e).x - x, chest(e).y - y) < r);
function ultHit(f, e, amt, o = {}) {
  const c = chest(e), fc = chest(f), nx = Math.sign(c.x - fc.x) || f.face;
  return damage(e, amt, Object.assign({ src: f, kind: 'skill', x: c.x, y: c.y, nx, ny: -.35, kb: 500, parts: ALL_BODY }, o));
}
// Holds every point still in the air (cancels gravity and velocity), for floating or dashing ultimates.
function ultHover(f, keep = 0) { for (const p of f.P) { p.ox = lerp(p.ox, p.x, 1 - keep); p.oy = lerp(p.oy, p.y, 1 - keep); p.fy -= PHYS.gravity; } }
// Distance from point (px, py) to the segment (ax, ay)-(bx, by).
function ultSegDist(px, py, ax, ay, bx, by) { return segSeg(px, py, px, py, ax, ay, bx, by).d; }

// 1. Blade: a blink dash through everyone in front, then every foe passed is cut again.
defUltimate('blade', { name: 'Phantom Edge', color: '#5ef2ff', time: .62, ai: { range: 330 },
  use(f, u) { u.x0 = f.P[2].x; u.dir = f.face; f.inv = Math.max(f.inv, .7); },
  step(f, dt, u) {
    if (u.t < .26) {
      const step = u.dir * 1400 * dt, ahead = f.P[2].x + step + u.dir * 30, g = groundBelow(ahead, feetY(f) - 10);
      const safe = g != null && g < feetY(f) + 140;                      // never blink off a ledge into a pit
      if (ahead > 30 && ahead < W - 30 && safe && !solidAt(ahead, f.P[2].y)) moveFighter(f, step, 0);
      ultHover(f);
      for (const e of F) if (e.alive && e.team !== f.team && !u.hit.has(e) && Math.abs(chest(e).x - f.P[2].x) < 50 && Math.abs(chest(e).y - chest(f).y) < 95) {
        u.hit.add(e); ultHit(f, e, 13, { kb: 200, status: ['bleed', 2, 1] });
        beam(chest(e).x - 50, chest(e).y + 40, chest(e).x + 50, chest(e).y - 40, '#ffffff', 5, .3);
      }
    } else if (!u.cut && u.t > .48) {
      u.cut = true;
      for (const e of u.hit) if (e.alive) { ultHit(f, e, 13, { kb: 760, ny: -.6 }); beam(chest(e).x + 60, chest(e).y + 50, chest(e).x - 60, chest(e).y - 50, '#5ef2ff', 7, .35); }
    }
  },
  draw(ctx, f, u) {
    if (u.t > .3) return;
    ctx.save(); ctx.globalAlpha = .35;
    for (let k = 1; k <= 3; k++) { ctx.translate(-u.dir * 28, 0); for (const [a, b] of BODY_LINKS) line(ctx, f.P[a], f.P[b], '#5ef2ff', 5); }
    ctx.restore();
  },
});

// 2. Heavy: leap high, slam down, a shockwave launches everyone on the ground.
defUltimate('heavy', { name: 'Earthbreaker', color: '#ff8a2e', time: 1.1, ai: { range: 340 },
  use(f) { for (const p of f.P) setVel(p, f.face * 160, -980); },
  step(f, dt, u) {
    if (u.t > .34 && !u.down) { u.down = true; for (const p of f.P) setVel(p, 0, 1900); }
    if (u.down && !u.boom && (f.grounded || u.t > .95)) {
      u.boom = true; u.t = Math.max(u.t, u.dur - .12);
      const x = f.P[2].x, y = feetY(f);
      for (const e of F) {
        if (!e.alive || e.team === f.team) continue;
        const dx = Math.abs(e.P[2].x - x), dy = Math.abs(feetY(e) - y);
        if (dx < 380 && dy < 170) ultHit(f, e, 32 * (1 - dx / 380 * .45), { kb: 950, nx: Math.sign(e.P[2].x - x) * .4, ny: -1, status: ['stun', .45] });
      }
      ring(x, y, 380, '#ff8a2e', .5, 8); ring(x, y, 200, '#ffffff', .3, 4);
      burst(x, y, '#ff8a2e', 40, 700); shake(24); sfx('slam'); sfx('boom', 1.2);
    }
  },
});

// 3. Polearm: three spectral thrusts down a long line; the last one sends them flying.
defUltimate('polearm', { name: 'Skyline Skewer', color: '#9dff5a', time: .75, ai: { range: 330 },
  step(f, dt, u) {
    const due = [.1, .3, .52][u.n];
    if (due == null || u.t < due) return;
    const last = ++u.n === 3, c = chest(f), ex = c.x + f.face * 340;
    for (const p of f.P) kick(p, f.face * 260, 0);
    for (const e of F) if (e.alive && e.team !== f.team && ultSegDist(chest(e).x, chest(e).y, c.x, c.y, ex, c.y) < 44) {
      ultHit(f, e, last ? 11 : 7, { kb: last ? 900 : 220, ny: last ? -.5 : -.1 });
    }
    beam(c.x, c.y, ex, c.y, '#9dff5a', last ? 12 : 7, .25); sfx('lunge');
  },
});

// 4. Chain: a spinning cyclone pulls foes in and shreds them, then blasts them away.
defUltimate('chain', { name: 'Cyclone', color: '#b98cff', time: 1.3, ai: { range: 220 },
  step(f, dt, u) {
    const c = chest(f);
    for (const j of f.main.pts.slice(1)) { const p = f.P[j]; kick(p, -(p.y - c.y) * 38 * f.scale * dt, (p.x - c.x) * 38 * f.scale * dt); }   // whirl the weapon
    for (const e of ultFoes(f, c.x, c.y, 270)) { const ec = chest(e); for (const p of e.P) kick(p, (c.x - ec.x) * 2.6 * dt * 60, (c.y - ec.y) * 1.2 * dt * 60); }
    if (u.t - (u.tick || 0) >= .2) {
      u.tick = u.t;
      for (const e of ultFoes(f, c.x, c.y, 150)) ultHit(f, e, 3.5, { kb: 120 });
      ring(c.x, c.y, 150, '#b98cff', .2, 3);
    }
  },
  end(f) { const c = chest(f); for (const e of ultFoes(f, c.x, c.y, 200)) ultHit(f, e, 6, { kb: 820, ny: -.5 }); ring(c.x, c.y, 200, '#ffffff', .3, 5); sfx('gust'); },
  draw(ctx, f, u) {
    const c = chest(f);
    ctx.save(); ctx.globalAlpha = .4; ctx.strokeStyle = '#b98cff'; ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(c.x, c.y, 60 + k * 40, u.t * 14 + k, u.t * 14 + k + 2.4); ctx.stroke(); }
    ctx.restore();
  },
});

// 5. Fist: rush the nearest foe, a flurry of blows, then a towering uppercut.
defUltimate('fist', { name: 'Meteor Flurry', color: '#ff5ad1', time: .95, ai: { range: 260 },
  use(f, u) { u.foe = nearestEnemy(f); },
  step(f, dt, u) {
    const e = u.foe;
    if (!e || !e.alive) { u.t = u.dur; return; }
    const gap = chest(e).x - chest(f).x;
    if (Math.abs(gap) > 70) moveFighter(f, clamp(gap - Math.sign(gap) * 60, -1100 * dt, 1100 * dt), 0);
    f.face = Math.sign(gap) || f.face;
    if (u.t < .8 && u.t - (u.tick || 0) >= .09 && Math.abs(gap) < 120) {
      u.tick = u.t;
      ultHit(f, e, 2, { kb: 90 });
      const hand = f.P[++u.n % 2 ? 6 : 4]; kick(hand, f.face * 900, rnd(-200, 200));
    }
    if (u.t >= .8 && !u.upper) { u.upper = true; if (Math.abs(gap) < 140) ultHit(f, e, 12, { kb: 1150, nx: f.face * .2, ny: -1 }); for (const p of f.P) kick(p, 0, -500); sfx('punch'); }
  },
});

// 6. Ranged: a storm of shots rains down on every foe.
defUltimate('ranged', { name: 'Bullet Storm', color: '#ffd84a', time: 1.2, ai: { range: 900 },
  step(f, dt, u) {
    if (u.t - (u.tick || 0) < .08 || u.n >= 14) return;
    u.tick = u.t; u.n++;
    const foes = F.filter(e => e.alive && e.team !== f.team);
    if (!foes.length) return;
    const e = foes[u.n % foes.length], c = chest(e);
    spawnProj({ owner: f, x: c.x + rnd(-70, 70) + vx(e.P[2]) * .2, y: Math.max(-60, c.y - 560), vx: rnd(-60, 60), vy: 1500,
      dmg: 3, r: 4, life: 1, color: '#ffd84a', kb: 160, solid: false, dmgKind: 'skill' });   // rains through platforms
    if (u.n % 3 === 0) sfx('shoot', .5);
  },
});
// 7. Magic: float, gather power, then a huge arcane nova.
defUltimate('magic', { name: 'Arcane Nova', color: '#c7b8ff', time: 1, ai: { range: 340 },
  step(f, dt, u) {
    if (u.t < .5) { ultHover(f, .85); return; }
    if (u.boom) return;
    u.boom = true;
    const c = chest(f), status = f.element && ELEMENTS[f.element] ? ELEMENTS[f.element].status : ['slow', 1.6, 1];
    for (const e of ultFoes(f, c.x, c.y, 360)) {
      const d = Math.hypot(chest(e).x - c.x, chest(e).y - c.y);
      ultHit(f, e, 34 * (1 - d / 360 * .5), { kb: 820, ny: -.4, status });
    }
    ring(c.x, c.y, 360, '#c7b8ff', .5, 9); ring(c.x, c.y, 220, '#ffffff', .35, 5); burst(c.x, c.y, '#c7b8ff', 40, 900);
    shake(18); sfx('boom');
  },
  draw(ctx, f, u) {
    if (u.t > .5) return;
    const c = chest(f);
    glow(ctx, '#c7b8ff', 24, () => circle(ctx, c.x, c.y, 12 + u.t * 70, rgba('#c7b8ff', .25), '#ffffff', 2));
  },
});

// 8. Exotic: a parade of bouncing, homing oddities with random effects.
const ULT_PARADE = [['#ff5ad1', ['bubbled', .8]], ['#5ef2ff', ['slow', 1.5]], ['#9dff5a', ['tiny', 2]], ['#ffd84a', ['slow', 1]], ['#ff7a2e', ['burn', 1]]];
defUltimate('exotic', { name: 'Chaos Parade', color: '#ff5ad1', time: .6, ai: { range: 600 },
  step(f, dt, u) {
    if (u.t - (u.tick || 0) < .08 || u.n >= 5) return;
    u.tick = u.t;
    const [color, status] = ULT_PARADE[u.n % ULT_PARADE.length], a = -Math.PI / 2 + (u.n - 2) * .4, h = f.P[6];
    u.n++;
    spawnProj({ owner: f, x: h.x, y: h.y, vx: Math.cos(a) * 620 + f.face * 200, vy: Math.sin(a) * 620, dmg: 4.5, r: 7, life: 2.2, homing: 4,
      bounce: 3, grav: .25, color, status: [status[0], status[1], 1], dmgKind: 'skill' });
    sfx('gun-pop', .5);
  },
});

// ---------- per-step bookkeeping (called from tickMoves) ----------
function powerTick(f) {
  if (f.wxp && f.lvlKey !== f.wkey) setLevel(f, levelOf(f));        // a new weapon (pickup, swap) has its own level
}

// ---------- screen overlay: the ultimate's cut-in band ----------
function powerDrawScreen(c2, dt) {
  const U = ULT_CUTIN;
  if (!U) return;
  U.t += dt;
  if (U.t > 1.1) { ULT_CUTIN = null; return; }
  const inT = clamp(U.t / .18, 0, 1), out = clamp((U.t - .85) / .25, 0, 1), slide = (1 - inT) * -W + out * W;
  c2.save();
  c2.translate(W / 2 + slide, H * .42); c2.rotate(-.08);
  c2.fillStyle = 'rgba(5,6,14,.82)'; c2.fillRect(-W, -46, W * 2, 92);
  c2.fillStyle = U.color; c2.fillRect(-W, -46, W * 2, 4); c2.fillRect(-W, 42, W * 2, 4);
  c2.textAlign = 'center'; c2.textBaseline = 'middle';
  c2.font = `600 16px ${FONT_BODY}`; c2.fillStyle = '#c9cdee'; c2.fillText(U.who + (U.who === 'YOU' ? ' unleash' : ' unleashes'), 0, -24);
  c2.font = `46px ${FONT_DISPLAY}`; c2.fillStyle = U.color;
  glow(c2, U.color, 22, () => c2.fillText(U.name.toUpperCase(), 0, 10));
  c2.restore();
}
