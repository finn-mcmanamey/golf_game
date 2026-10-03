// 35-effects.js: particles, floating text, rings, beams, screen shake, hit-stop, slow motion and screen flash.
// Effects are visual only; during SC.sim they are skipped so headless simulation stays fast.

let PARTS = [], FLOATS = [], RINGS = [], BEAMS = [];
const FX = { shake: 0, hitstop: 0, slow: 0, slowRate: .3, flash: '#ffffff', flashA: 0,
  shakeMul: 1, partMul: 1, dmgNumbers: true };   // the last three are set from the Settings screen (75-cosmetics)
const MAX_PARTS = 900;
let FX_RECORD = null;   // the kill-cam (88) sets this to record effects as timed events: FX_RECORD(kind, args)

// o: { life (s), grav (px/s², negative floats up), size }
function burst(x, y, color, n = 10, speed = 250, o = {}) {
  if (G_STATE.sim) return;
  if (FX_RECORD) FX_RECORD('burst', arguments);
  n = Math.round(n * FX.partMul);
  for (let k = 0; k < n; k++) {
    const a = rnd(0, TAU), v = rnd(.3, 1) * speed, life = o.life ? rnd(.6, 1) * o.life : rnd(.3, .7);
    PARTS.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life, max: life, c: color, s: rnd(2, 4.5) * (o.size || 1), grav: o.grav ?? 1400 });
  }
  if (PARTS.length > MAX_PARTS) PARTS.splice(0, PARTS.length - MAX_PARTS);
}

const MAX_FLOATS = 8;   // more live labels than this bury the fighters: the oldest small ones go first
// `key` (optional) replaces the live label with the same key instead of stacking a new one (a fighter's combo count).
function float(x, y, text, color = '#ffffff', size = 22, key = null) {
  if (G_STATE.sim || G_STATE.demo) return;      // the attract demo behind the menus stays free of text clutter
  if (FX_RECORD) FX_RECORD('float', arguments);
  if (key != null) FLOATS = FLOATS.filter(t => t.key !== key);
  y = floatFreeY(x, y, String(text), size);
  FLOATS.push({ x, y, text, color, size, life: 1, key });
  while (FLOATS.length > MAX_FLOATS) floatDropOne();
}
function floatDropOne() {
  const small = FLOATS.findIndex(t => t.size < 24);
  FLOATS.splice(small >= 0 ? small : 0, 1);
}

// Moves a new label up above any fresh label it would overlap ("2 HIT COMBO" over a skill name, stacked K.O. texts).
function floatFreeY(x, y, text, size) {
  const halfW = t => String(t.text).length * t.size * .3 + 6;
  for (let tries = 0; tries < 5; tries++) {
    const hit = FLOATS.find(t => t.life > .55 && Math.abs(t.y - y) < (t.size + size) * .5 &&
      Math.abs(t.x - x) < halfW(t) + text.length * size * .3);
    if (!hit) break;
    y = hit.y - (hit.size + size) * .55;
  }
  return y;
}

// Labels that overlap while they drift (a skill or orb name over damage numbers, two callouts born a moment apart,
// or ones squeezed together at a wall) are nudged apart vertically a little each step, the upper one up and the lower
// one down, so every label stays readable. floatFreeY only places new labels; this keeps them apart afterwards.
const FLOAT_NUDGE = 420;   // px/s: fast enough to clear within a few frames, slow enough to read as a glide
function floatSeparate(dt) {
  const n = FLOATS.length, halfW = t => String(t.text).length * t.size * .3 + 6, step = FLOAT_NUDGE * dt;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = FLOATS[i], b = FLOATS[j];       // b is the newer label
    if (Math.abs(a.x - b.x) >= halfW(a) + halfW(b)) continue;
    const need = (a.size + b.size) * .5, gap = b.y - a.y;
    if (Math.abs(gap) >= need) continue;
    const push = Math.min((need - Math.abs(gap)) / 2, step), dir = gap > 0 ? 1 : -1;   // equal: the newer one rises
    a.y -= dir * push; b.y += dir * push;
  }
}

// An expanding ring that fades out (shockwaves, pickups, blasts).
function ring(x, y, r, color = '#ffffff', life = .35, width = 4) {
  if (G_STATE.sim) return;
  if (FX_RECORD) FX_RECORD('ring', arguments);
  RINGS.push({ x, y, r, color, life, max: life, width });
}

// A glowing straight line that fades (lasers, lightning, teleport streaks).
function beam(x1, y1, x2, y2, color = '#ffffff', width = 6, life = .25) {
  if (G_STATE.sim) return;
  if (FX_RECORD) FX_RECORD('beam', arguments);
  BEAMS.push({ x1, y1, x2, y2, color, width, life, max: life });
}

function shake(amount) { if (FX_RECORD) FX_RECORD('shake', arguments); FX.shake = Math.max(FX.shake, amount * FX.shakeMul); }
// Freezes the action for a few frames on big hits so they land with weight (real-time play only).
function hitstop(seconds) { if (!G_STATE.sim) FX.hitstop = Math.max(FX.hitstop, Math.min(seconds, .15)); }
function slowmo(seconds, rate = .3) { if (!G_STATE.sim) { FX.slow = Math.max(FX.slow, seconds); FX.slowRate = rate; } }
function flashScreen(color = '#ffffff', alpha = .3) { if (FX_RECORD) FX_RECORD('flashScreen', arguments); FX.flash = color; FX.flashA = Math.max(FX.flashA, alpha); }

function clearFx() {
  PARTS = []; FLOATS = []; RINGS = []; BEAMS = [];
  FX.shake = FX.hitstop = FX.slow = FX.flashA = 0;
}

function fxStep(dt) {
  if (!PARTS.length && !FLOATS.length && !RINGS.length && !BEAMS.length) return;
  const floor = MAP && MAP.floor != null ? MAP.floor : Infinity;
  for (const p of PARTS) {
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.y > floor) { p.y = floor; p.vy *= -.3; p.vx *= .6; }
  }
  for (const t of FLOATS) { t.y -= 50 * dt; t.life -= dt * .9; }
  floatSeparate(dt);
  for (const r of RINGS) r.life -= dt;
  for (const b of BEAMS) b.life -= dt;
  fxCompact(PARTS); fxCompact(FLOATS); fxCompact(RINGS); fxCompact(BEAMS);
}
// Drops dead entries (life <= 0) in place, keeping order: no new array every step.
function fxCompact(list) {
  let n = 0;
  for (let i = 0; i < list.length; i++) if (list[i].life > 0) list[n++] = list[i];
  list.length = n;
}

// Particles are batched by colour and a few alpha steps: one fill per group instead of one per particle.
// The groups (colour -> 4 lists by alpha step) persist between frames and are only emptied, to avoid garbage.
const PART_GROUPS = new Map();
function drawParticles(ctx) {
  if (PART_GROUPS.size > 300) PART_GROUPS.clear();
  for (const p of PARTS) {
    const a = Math.ceil(clamp(p.life / p.max * 1.6, 0, 1) * 4);
    if (!a) continue;
    let g = PART_GROUPS.get(p.c);
    if (!g) PART_GROUPS.set(p.c, g = [[], [], [], []]);
    g[a - 1].push(p);
  }
  for (const [color, g] of PART_GROUPS) for (let k = 0; k < 4; k++) {
    const list = g[k];
    if (!list.length) continue;
    ctx.globalAlpha = (k + 1) / 4; ctx.fillStyle = color; ctx.beginPath();
    for (const p of list) ctx.rect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    ctx.fill();
    list.length = 0;
  }
  ctx.globalAlpha = 1;
}

// The world x range the camera shows right now, so labels near a wall stay fully on screen.
function floatViewX() {
  if (typeof CAM === 'undefined') return [0, W];
  const half = W / (2 * CAM.z * (1 + (CAM.punch || 0)));
  return [Math.max(0, CAM.x - half), Math.min(W, CAM.x + half)];
}

// Draws world-space effects (called by the renderer inside the camera transform).
function drawFx(ctx) {
  drawParticles(ctx);
  for (const r of RINGS) {
    const k = 1 - r.life / r.max, rad = r.r * (.25 + .75 * Math.sqrt(k));
    ctx.globalAlpha = clamp(r.life / r.max * 1.3, 0, 1);
    circle(ctx, r.x, r.y, rad, null, r.color, r.width * (1 - k * .6));
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  for (const b of BEAMS) {
    const a = clamp(b.life / b.max, 0, 1);
    ctx.globalAlpha = a;
    glow(ctx, b.color, 18, () => lineXY(ctx, b.x1, b.y1, b.x2, b.y2, b.color, b.width * (.5 + a * .5)));
    lineXY(ctx, b.x1, b.y1, b.x2, b.y2, '#ffffff', Math.max(1, b.width * .3 * a));
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const view = floatViewX();
  for (const t of FLOATS) {
    const pop = 1 + Math.max(0, t.life - .85) * 2.5;
    ctx.globalAlpha = clamp(t.life * 1.5, 0, 1);
    ctx.font = `${Math.round(t.size * pop)}px ${FONT_DISPLAY}`;
    const half = ctx.measureText(t.text).width / 2 + 8, x = clamp(t.x, view[0] + half, Math.max(view[0] + half, view[1] - half));
    ctx.lineWidth = 5; ctx.strokeStyle = '#07080f'; ctx.strokeText(t.text, x, t.y);
    ctx.fillStyle = t.color; ctx.fillText(t.text, x, t.y);
  }
  ctx.globalAlpha = 1;
}
