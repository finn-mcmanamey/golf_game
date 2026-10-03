// 30-combat.js: melee strikes (main and off-hand), the one damage() path, knockouts, weapon clashes, projectiles,
// explosions, map hazards, ring-outs and power-up orbs.

const ALL_BODY = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CLASH_T = {};          // pair id -> game time until which that pair can't clash again

// Whoever hit this fighter recently gets credit if it then dies to a hazard, a pit or a status effect.
function recentAttacker(f) { return f.lastHitBy && G_STATE.t - f.lastHitT < 5 ? f.lastHitBy : null; }

// ---------- melee ----------
function strikeAll() {
  for (const A of F) {
    if (!A.alive) continue;
    for (const B of F) {
      if (B === A || B.team === A.team || !B.alive) continue;
      for (const rig of rigsOf(A)) strike(A, B, rig);
    }
  }
}

// Hit-cooldown keys ('3m', '3o') are built once per fighter id instead of a new string every check.
const STRIKE_KEYS = [];
function strikeKey(id, off) {
  const k = STRIKE_KEYS[id] || (STRIKE_KEYS[id] = [id + 'm', id + 'o']);
  return k[off ? 1 : 0];
}

// Finds the fastest contact between a weapon rig and the target's body this step; fast enough = a hit.
function strike(A, B, rig) {
  const def = rig.w, cdKey = strikeKey(B.id, rig === A.off);
  if (def.dmg <= 0 || A.hitCd[cdKey] > 0 || B.inv > 0) return;
  const width = def.width * A.scale * (A.status.giant ? 1.3 : 1);
  // Indexed loops and scalar bests: this runs for every rig x enemy x body part, 120 times a second.
  let bestRel = -1, bestRx = 0, bestRy = 0, bestT = null, bestX = 0, bestY = 0;
  const ws = rig.ws;
  for (let w = 0; w < ws.length; w++) {
    const a = A.P[ws[w][0]], b = A.P[ws[w][1]];
    for (let h = 0; h < HIT_SHAPES.length; h++) {
      const T = HIT_SHAPES[h], c = B.P[T.a], d = B.P[T.b], r = segSeg(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
      if (r.d > T.r * B.scale + width) continue;
      const rx = lerp(vx(a), vx(b), r.s) - lerp(vx(c), vx(d), r.t), ry = lerp(vy(a), vy(b), r.s) - lerp(vy(c), vy(d), r.t);
      const rel = Math.sqrt(rx * rx + ry * ry);
      if (rel > bestRel) { bestRel = rel; bestRx = rx; bestRy = ry; bestT = T; bestX = r.px; bestY = r.py; }
    }
  }
  if (bestRel < TUNE.minHit) return;
  A.hitCd[cdKey] = TUNE.hitCd;
  meleeHit(A, B, rig, { rel: bestRel, rx: bestRx, ry: bestRy, T: bestT, x: bestX, y: bestY });
}

function meleeHit(A, B, rig, h) {
  const def = rig.w, nx = h.rx / h.rel, ny = h.ry / h.rel;
  const raw = (h.rel - TUNE.minHit + 60) / TUNE.dmgDiv * def.dmg * (h.T.head ? TUNE.headMul : 1);
  const amount = Math.min(raw, TUNE.maxHit * Math.sqrt(Math.max(1, def.dmg)));   // heavy weapons may hit a bit harder
  const kb = Math.min(h.rel * TUNE.kbMul, TUNE.kbMax) * def.kb;
  const dealt = damage(B, amount, { src: A, x: h.x, y: h.y, nx, ny, kb, head: h.T.head, kind: 'melee', weapon: def, parts: [h.T.a, h.T.b, 2] });
  const hit = { x: h.x, y: h.y, nx, ny, rel: h.rel, head: !!h.T.head, dmg: dealt, part: h.T, rig };
  if (dealt > 0) hook(def, 'onHit', A, B, hit);
  emit('hit', A, B, hit);
}

// ---------- damage ----------
// The only way health goes down. o: { src, x, y, nx, ny, kb, head, kind, status: [name, secs, power], parts,
// weapon, color, small }. kind: melee | proj | explode | skill | hazard | status | ringout. Returns damage dealt.
function damage(B, amount, o = {}) {
  if (!B || !B.alive || !(amount > 0)) return 0;
  const A = o.src && o.src !== B ? o.src : null, kind = o.kind || 'melee';
  const direct = kind !== 'status' && kind !== 'hazard' && kind !== 'ringout';
  if (B.inv > 0 && kind !== 'ringout') return 0;
  // Once a round is decided, its winners can't be hurt during the K.O. delay (lava or a burn must not undo a win).
  if (G_STATE.ending && G_STATE.winner >= 0 && B.team === G_STATE.winner) return 0;
  const x = o.x ?? B.P[1].x, y = o.y ?? B.P[1].y;
  if (direct && B.status.shield) { blockHit(B, A, x, y, o); return 0; }
  const shatter = direct && B.status.freeze;
  const amt = Math.max(1, Math.round(amount * (A ? dmgMul(A) * weaponPower(A, kind) : 1) * (direct ? takenMul(B) : 1) * (B.dmgTakenMul || 1) * aiArmorMul(B, A)));
  B.hp = Math.max(0, B.hp - amt);
  B.flash = .12; B.stats.dmgTaken += amt;
  if (A) {
    A.stats.dmgDealt += amt;
    B.lastHitBy = A; B.lastHitT = G_STATE.t;
    if (direct) { A.stats.hits++; countCombo(A); }
  }
  if (direct && A) { B.combo = 0; B.comboT = 0; }    // a combo means hits without being hit back
  if (shatter) { removeStatus(B, 'freeze'); burst(x, y, '#c8f4ff', 18, 380); sfx('shatter'); }
  if (o.status && B.hp > 0) addStatus(B, o.status[0], o.status[1], o.status[2] ?? 1, A);
  if (direct) knockback(B, o, amt);
  hitFeedback(B, amt, x, y, o, direct);
  emit('damage', B, amt, o);
  if (B.hp <= 0) knockout(B, A || recentAttacker(B), o);
  return amt;
}

// A weapon's `power` (balance knob, default 1) scales what its wielder deals with it; skills and statuses are unaffected.
const weaponPower = (A, kind) => kind === 'melee' || kind === 'proj' || kind === 'explode' ? (A.w.power || 1) : 1;

// Hits within 0.1 s of the last counted one (a pellet spread, a kunai fan, a minigun burst) are one combo step.
// Each fighter has one combo label that updates in place. In crowded matches CPUs only show milestones (5, 10, ...).
function countCombo(A) {
  if (A.comboT > 0 && G_STATE.t - (A.comboAt || 0) < .1) return;
  A.comboAt = G_STATE.t;
  A.combo = A.comboT > 0 ? A.combo + 1 : 1;
  A.comboT = 2.2;
  if (A.combo < 3) return;
  const crowd = F.filter(f => !f.summon).length > 2, player = A.ctrl === 'human' && !A.autopilot;
  if (crowd && !player && A.combo % 5) return;
  float(A.P[0].x, A.P[0].y - 54 * A.scale, A.combo + ' HIT COMBO', A.color, 19 + Math.min(10, A.combo), 'combo' + A.id);
}

// Shoves the struck part hardest and the whole body a bit, then staggers so the shove isn't cancelled at once.
function knockback(B, o, amt) {
  B.stagger = Math.max(B.stagger, clamp(amt * TUNE.staggerPerDmg, .06, TUNE.staggerMax));
  if (!o.kb) return;
  const kb = o.kb * (B.hp > 0 ? 1 : 1.6) / Math.pow(B.scale, 1.5) * (B.kbMul || 1);
  const nx = o.nx || 0, ny = o.ny || 0, lift = 60 + kb * .18;
  const parts = o.parts || [1, 2];
  for (const j of ALL_BODY) {
    const k = parts.includes(j) ? 1 : .38;
    kick(B.P[j], nx * kb * k, (ny * kb - lift) * k);
  }
}

function hitFeedback(B, amt, x, y, o, direct) {
  if (o.small || !direct) {
    if (FX.dmgNumbers) float(x + rnd(-10, 10), y - 20, String(amt), o.color || '#ffb36b', 16);
    return;
  }
  burst(x, y, hitColor(B), 8 + amt * .8, 200 + amt * 12);   // hitColor: 87-juice (sparks or red setting)
  burst(x, y, '#ffffff', 6, 520, { life: .25 });
  ring(x, y, 16 + amt * 1.4, 'rgba(255,255,255,.75)', .18, 3);
  if (FX.dmgNumbers) float(x, y - 24, (o.head ? 'HEAD ' : '') + amt, o.head ? '#ffd84a' : o.color || '#ffffff', 20 + Math.min(amt, 30) * .6);
  shake(Math.min(18, 3 + amt * .45));
  if (amt >= TUNE.hitstopMin) hitstop(clamp(amt * .0035, .035, .1));
  sfx('hit', clamp(amt / 22, .4, 1.4));
}

// A shield status soaks one hit and pushes a melee attacker back.
function blockHit(B, A, x, y, o) {
  const s = B.status.shield;
  s.power -= 1;
  if (s.power <= 0) removeStatus(B, 'shield');
  burst(x, y, '#7fd8ff', 22, 420);
  const c = chest(B);
  ring(c.x, c.y, 66 * B.scale, '#7fd8ff', .3, 4);
  float(x, y - 20, 'BLOCKED', '#7fd8ff', 24);
  sfx('block');
  if (A && o.kind === 'melee') for (const p of A.P) kick(p, -(o.nx || 0) * 320, -(o.ny || 0) * 320);
  emit('block', B, A);
}

function knockout(B, A, o = {}) {
  if (!B.alive) return;
  B.alive = false; B.hp = 0; B.status = {};
  if (A && A !== B) A.stats.kos++;
  const c = chest(B);
  if (o.kind !== 'ringout') { burst(c.x, c.y, B.color, 40, 600); burst(c.x, c.y, '#ffffff', 16, 800); ring(c.x, c.y, 120, B.color, .5, 5); }
  float(clamp(c.x, 80, W - 80), clamp(c.y - 70, 60, H - 40), o.kind === 'ringout' ? 'RING OUT' : 'K.O.', '#ff4a6a', 34);
  shake(24); slowmo(1.1); flashScreen(B.color, .22);
  if (aliveTeams().length <= 1) focusCamera(c.x, c.y);    // zoom in on the round-deciding KO only
  sfx('ko');
  emit('ko', B, A, o);
  hook(G_STATE.mode, 'onKO', B, A, o);
}

// ---------- weapon clashes ----------
// Weapons that meet at speed throw sparks and bounce apart instead of hurting anyone. Shields (block) bounce harder.
function clashAll() {
  for (let i = 0; i < F.length; i++) {
    for (let j = i + 1; j < F.length; j++) {
      const A = F[i], B = F[j];
      if (A.team !== B.team && A.alive && B.alive) clash(A, B);
    }
  }
}

function clash(A, B) {
  const key = A.id + ':' + B.id;
  if (CLASH_T[key] > G_STATE.t) return;
  for (const ra of rigsOf(A)) for (const rb of rigsOf(B)) for (let u = 0; u < ra.ws.length; u++) for (let v = 0; v < rb.ws.length; v++) {
    const a = A.P[ra.ws[u][0]], b = A.P[ra.ws[u][1]], c = B.P[rb.ws[v][0]], d = B.P[rb.ws[v][1]];
    const r = segSeg(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
    if (r.d > ra.w.width * A.scale + rb.w.width * B.scale) continue;
    if (Math.hypot(vx(b) - vx(d), vy(b) - vy(d)) < 300) continue;
    let nx = r.qx - r.px, ny = r.qy - r.py, n = Math.hypot(nx, ny);
    if (n < 1e-3) { nx = A.face; ny = 0; n = 1; }
    nx /= n; ny /= n;
    const pa = 420 * (1 + (rb.w.block || 0)), pb = 420 * (1 + (ra.w.block || 0));
    for (const p of [a, b]) kick(p, -nx * pa, -ny * pa);
    for (const p of [c, d]) kick(p, nx * pb, ny * pb);
    for (const s of ['m', 'o']) {   // a deflected swing must not also land this instant
      A.hitCd[B.id + s] = Math.max(A.hitCd[B.id + s] || 0, .12);
      B.hitCd[A.id + s] = Math.max(B.hitCd[A.id + s] || 0, .12);
    }
    const mx = (r.px + r.qx) / 2, my = (r.py + r.qy) / 2;
    burst(mx, my, '#ffe9a8', 16, 520, { life: .3 });
    ring(mx, my, 34, '#ffe9a8', .16, 3);
    shake(5); sfx('clash');
    CLASH_T[key] = G_STATE.t + .14;
    hook(ra.w, 'onClash', A, B); hook(rb.w, 'onClash', B, A);
    emit('clash', A, B, mx, my);
    return;
  }
}

// ---------- projectiles ----------
// See ARCHITECTURE.md for the options. grav is a fraction of map gravity; drag is velocity lost per second (0..1);
// homing is turn rate in rad/s; explode is a blast radius (the blast then deals the damage).
function spawnProj(o) {
  const owner = o.owner || null;
  const p = Object.assign({
    owner, team: owner ? owner.team : -1, x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 10, life: 2, grav: 0, drag: 0, wind: 0,
    pierce: 0, bounce: 0, homing: 0, kind: 'bullet', color: owner ? owner.color : '#ffffff', trail: true, explode: 0,
    status: null, kb: null, solid: true, headMul: 1.25,
  }, o, { t: 0, dead: false, hits: [], rolled: {}, tr: [] });
  PROJ.push(p);
  if (PROJ.length > 400) PROJ.splice(0, PROJ.length - 400);
  return p;
}

function stepProjectiles(dt) {
  for (const p of PROJ) if (!p.dead) stepProj(p, dt);
  PROJ = PROJ.filter(p => !p.dead);
}

function stepProj(p, dt) {
  p.t += dt;
  if (p.homing) steerProj(p, dt);
  p.vy += PHYS.gravity * p.grav * dt;
  p.vx += PHYS.windX * p.wind * dt;
  if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
  const x0 = p.x, y0 = p.y;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.trail) { p.tr.push(x0, y0); if (p.tr.length > 16) p.tr.splice(0, 2); }
  hook(p, 'onStep', p, dt);
  if (p.dead || projHitsShield(p, x0, y0) || projHitsBody(p, x0, y0)) return;
  if (p.solid) projHitsWorld(p, x0, y0);
  if (!p.dead && (p.t >= p.life || p.x < -400 || p.x > W + 400 || p.y > H + 400 || p.y < -900)) killProj(p, 'expire');
}

function steerProj(p, dt) {
  let best = null, bd = Infinity;
  for (const f of F) {
    if (!f.alive || f.team === p.team) continue;
    const c = chest(f), d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  const sp = Math.hypot(p.vx, p.vy), cur = Math.atan2(p.vy, p.vx);
  let d = Math.atan2(best.y - p.y, best.x - p.x) - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const a = cur + clamp(d, -p.homing * dt, p.homing * dt);
  p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
}

// Weapons with block > 0 (shields) may deflect a projectile back at its owner's team (rolled once per shield).
function projHitsShield(p, x0, y0) {
  for (const B of F) {
    if (!B.alive || B.team === p.team) continue;
    for (const rig of rigsOf(B)) {
      if (!(rig.w.block > 0)) continue;
      for (const [i, j] of rig.ws) {
        const a = B.P[i], b = B.P[j], r = segSeg(x0, y0, p.x, p.y, a.x, a.y, b.x, b.y);
        if (r.d > p.r + rig.w.width * B.scale + 2) continue;
        const roll = p.rolled[B.id] ?? (p.rolled[B.id] = Math.random() < rig.w.block);
        if (!roll) continue;
        deflectProj(p, B, a, b, r.qx, r.qy);
        return true;
      }
    }
  }
  return false;
}

function deflectProj(p, B, a, b, x, y) {
  const sx = b.x - a.x, sy = b.y - a.y, sl = Math.hypot(sx, sy) || 1, nx = -sy / sl, ny = sx / sl;
  const dot = p.vx * nx + p.vy * ny;
  p.vx = (p.vx - 2 * dot * nx) * .85; p.vy = (p.vy - 2 * dot * ny) * .85;
  const c = chest(B);
  if ((p.x - c.x) * p.vx + (p.y - c.y) * p.vy < 0) { p.vx = -p.vx; p.vy = -p.vy; }   // always away from the blocker
  p.x = x + Math.sign(p.vx) * 4; p.owner = B; p.team = B.team; p.hits = []; p.t = Math.min(p.t, p.life * .5);
  burst(x, y, '#ffe9a8', 12, 420, { life: .25 });
  sfx('block');
  emit('block', B, null);
}

function projHitsBody(p, x0, y0) {
  for (const B of F) {
    if (!B.alive || B.team === p.team || p.hits.includes(B.id) || B.inv > 0) continue;
    for (const T of HIT_SHAPES) {
      const c = B.P[T.a], d = B.P[T.b], r = segSeg(x0, y0, p.x, p.y, c.x, c.y, d.x, d.y);
      if (r.d > T.r * B.scale + p.r) continue;
      projHit(p, B, T, r.px, r.py);
      return p.dead;
    }
  }
  return false;
}

function projHit(p, B, T, x, y) {
  p.hits.push(B.id);
  if (p.explode > 0) { p.x = x; p.y = y; killProj(p, 'hit', B); return; }   // the blast deals the damage
  const sp = Math.hypot(p.vx, p.vy) || 1;
  const dealt = damage(B, p.dmg * (T.head ? p.headMul : 1), { src: p.owner, x, y, nx: p.vx / sp, ny: p.vy / sp,
    kb: p.kb ?? Math.min(sp * .28, 450), head: T.head, kind: 'proj', status: p.status, parts: [T.a, T.b, 2], color: p.color, small: p.small });
  hook(p, 'onHit', p, B, dealt);
  if (p.pierce > 0) p.pierce--; else killProj(p, 'hit', B);
}

// Floor, walls, solid boxes, and one-way platforms from above. Bounces if it has bounces left.
function projHitsWorld(p, x0, y0) {
  let nx = 0, ny = 0;
  const s = solidAt(p.x, p.y);
  if (s) {
    if (y0 <= s.y) ny = -1; else if (y0 >= s.y + s.h) ny = 1; else nx = x0 < s.x ? -1 : 1;
  } else if (MAP.walls && (p.x < 0 || p.x > W)) nx = p.x < 0 ? 1 : -1;
  else if (p.vy > 0) {
    for (const o of MAP.solids) if (o.oneWay && p.x >= o.x && p.x <= o.x + o.w && y0 <= o.y && p.y >= o.y) { ny = -1; break; }
  }
  if (!nx && !ny) return;
  if (p.bounce > 0) {
    p.bounce--;
    if (nx) { p.vx = -p.vx * .8; p.x = x0; }
    if (ny) { p.vy = -p.vy * .65; p.y = y0; p.vx *= .9; }
    burst(p.x, p.y, p.color, 3, 140, { life: .2 });
    hook(p, 'onBounce', p);
    return;
  }
  p.x = x0; p.y = y0;
  killProj(p, 'world');
}

function killProj(p, why, target) {
  if (p.dead) return;
  p.dead = true;
  if (p.explode > 0) explode(p.x, p.y, p.explode, p.dmg, p.owner, { status: p.status, color: p.color, kb: p.kb, team: p.team });
  else if (why === 'world') burst(p.x, p.y, p.color, 5, 160, { life: .25 });
  hook(p, 'onExpire', p, why, target);
}

// Radial damage with falloff and outward knockback against everyone not on the owner's team.
// o: { team, status, color, kb, selfDamage, kind }
function explode(x, y, radius, dmg, owner, o = {}) {
  const team = o.team ?? (owner ? owner.team : -1);
  for (const B of F) {
    if (!B.alive || (B.team === team && !(o.selfDamage && B === owner))) continue;
    let d = Infinity;
    for (const j of [0, 1, 2, 4, 6, 8, 10]) d = Math.min(d, Math.hypot(B.P[j].x - x, B.P[j].y - y));
    if (d > radius) continue;
    const fall = 1 - d / radius * .6, c = chest(B);
    let nx = c.x - x, ny = c.y - y - 30;
    const n = Math.hypot(nx, ny) || 1;
    damage(B, dmg * fall, { src: owner, x: c.x, y: c.y, nx: nx / n, ny: ny / n, kb: (o.kb ?? 650) * fall,
      kind: o.kind || 'explode', status: o.status, parts: ALL_BODY, color: o.color });
  }
  const color = o.color || '#ffb347';
  ring(x, y, radius, color, .35, 6); ring(x, y, radius * .55, '#ffffff', .22, 3);
  burst(x, y, color, 30, radius * 4); burst(x, y, '#ffe9a8', 14, radius * 3, { life: .3 });
  flashScreen(color, .14); shake(clamp(radius * .09, 6, 22));
  sfx('boom', clamp(radius / 110, .5, 1.5));
  emit('explode', x, y, radius, owner);
}

// ---------- hazards and ring-outs ----------
// Hazard: { kind, x, y, w, h, dps, tick (s), status: [name, secs, power], launch (px/s up), color, onTouch(f, hz) }
function stepHazards(dt) {
  if (!MAP) return;
  MAP.hazards.forEach((hz, idx) => {
    for (const f of F) {
      if (!f.alive) continue;
      const timers = f.hzT || (f.hzT = {});
      if (timers[idx] > 0) { timers[idx] -= dt; continue; }
      if (![2, 8, 10, 0].some(j => inRect(f.P[j].x, f.P[j].y, hz))) continue;
      timers[idx] = hz.tick ?? .25;
      touchHazard(f, hz, timers[idx]);
    }
  });
}

function touchHazard(f, hz, tick) {
  const c = chest(f);
  if (hz.dps) damage(f, hz.dps * tick, { kind: 'hazard', x: c.x, y: c.y, color: hz.color || '#ff9a3a', small: true });
  if (hz.status && f.alive) addStatus(f, hz.status[0], hz.status[1], hz.status[2] ?? 1, recentAttacker(f));
  if (hz.launch && f.alive) {   // pop the fighter up and out instead of letting it sit in the hazard
    const out = f.P[2].x < hz.x + hz.w / 2 ? -1 : 1;
    for (const p of f.P) { p.oy = p.y + hz.launch * DT; kick(p, out * 260, 0); }
    f.stagger = Math.max(f.stagger, .25);
    burst(c.x, Math.max(f.P[8].y, f.P[10].y), hz.color || '#ff9a3a', 14, 300);
  }
  hook(hz, 'onTouch', f, hz);
}

function checkRingOuts() {
  if (!MAP) return;
  for (const f of F) {
    if (!f.alive) continue;
    const h = f.P[2], out = h.y > H + 260 || (!MAP.walls && (h.x < -260 || h.x > W + 260));
    if (out) knockout(f, recentAttacker(f), { kind: 'ringout' });
  }
}

// ---------- power-up orbs ----------
let orbTimer = 5;
function resetOrbs() { ORB_LIST = []; orbTimer = rnd(4, 7); }

function weightedOrb() {
  const list = listOf(ORBS), total = list.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of list) if ((r -= o.weight) <= 0) return o;
  return list[list.length - 1];
}

// A random standing spot (floor or platform top) that isn't inside a hazard.
function orbSpot() {
  const spots = [];
  if (MAP.floor != null) spots.push({ x0: 110, x1: W - 110, y: MAP.floor, solid: null });
  for (const s of MAP.solids) if (s.w > 70 && s.y > 60) spots.push({ x0: s.x + 30, x1: s.x + s.w - 30, y: s.y, solid: s });
  for (let k = 0; k < 10 && spots.length; k++) {
    const sp = pick(spots), x = rnd(sp.x0, sp.x1), y = sp.y - 42;
    if (!MAP.hazards.some(hz => inRect(x, y, hz, 50)) && !solidAt(x, y)) return { x, y, solid: sp.solid };
  }
  return null;
}

function spawnOrb(key) {
  const def = key ? ORBS[key] : weightedOrb(), spot = def && orbSpot();
  if (!spot) return null;
  const o = { def, key: def.key, x: spot.x, y: spot.y, solid: spot.solid, t: 0, taken: false };
  ORB_LIST.push(o);
  ring(o.x, o.y, 40, def.color, .4, 3);
  return o;
}

function stepOrbs(dt) {
  if (!MAP) return;
  const allowed = MAP.orbs !== false && !(G_STATE.cfg && G_STATE.cfg.orbs === false) && listOf(ORBS).length;
  if (allowed && G_STATE.lock <= 0 && !G_STATE.ending && (orbTimer -= dt) <= 0) {
    orbTimer = rnd(6, 11) / (G_STATE.cfg && G_STATE.cfg.orbRate || 1);   // orbRate: the menu's item frequency
    if (ORB_LIST.length < MAP.maxOrbs) spawnOrb();
  }
  for (const o of ORB_LIST) {
    o.t += dt;
    if (o.solid) { o.x += o.solid.dx; o.y += o.solid.dy; }   // ride moving platforms
    for (const f of F) if (f.alive && !o.taken && f.P.some(p => Math.hypot(p.x - o.x, p.y - o.y) < 34)) grabOrb(f, o);
  }
  ORB_LIST = ORB_LIST.filter(o => !o.taken && o.t < 14);
}

function grabOrb(f, o) {
  o.taken = true;
  hook(o.def, 'grab', f, o);
  burst(o.x, o.y, o.def.color, 24, 300);
  ring(o.x, o.y, 50, o.def.color, .3, 4);
  float(o.x, o.y - 30, o.def.name.toUpperCase(), o.def.color, 22);
  sfx('orb');
  emit('orb', f, o);
}
