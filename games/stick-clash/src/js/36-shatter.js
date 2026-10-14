// 36-shatter.js: every K.O. pops the fighter apart into glowing neon limbs (no blood) that tumble, bounce and fade.
// Drawing only: the pieces never touch the game. The K.O. stores f.shatterT (a number, so the kill-cam snapshots
// it) and the renderer hides a shattered body; the burst itself is recorded as a kill-cam event ('shatter'), so a
// replay re-spawns the pieces at the right moment and they tumble in slow motion with it.

const SHATTER = { life: 2.3, speed: 420, spin: 14, max: 160 };
let SHARDS = [];

on('ko', (v, k, o) => {
  if (v.summon) return;
  v.shatterT = G_STATE.t;
  const pts = [];
  for (let j = 0; j < 11; j++) pts.push(v.P[j].x, v.P[j].y);
  shatterSpawn(pts, v.color, v.scale, (o && o.nx) || 0, (o && o.ny) || 0);
  emit('shatter', v);
});
on('roundStart', () => { SHARDS = []; });
on('matchStart', () => { SHARDS = []; });
on('boot', () => { if (typeof KC_FX === 'object') KC_FX.shatter = shatterSpawn; });   // replayed by the kill-cam

// pts: the 11 body points as a flat [x0, y0, x1, y1, ...] list. Each limb (and the head) becomes a piece flying
// away from the hip, pushed along the killing blow (nx, ny).
function shatterSpawn(pts, color, scale, nx, ny) {
  if (G_STATE.sim) return;
  if (FX_RECORD) FX_RECORD('shatter', [pts.slice(), color, scale, nx, ny]);
  const t0 = G_STATE.t, hx = pts[4], hy = pts[5];
  // TUNE's silly profile: pieces pop further (koPop), pinwheel faster (koSpin) and bounce higher (koBounce; the head
  // most of all, like a rubber ball).
  const pop = TUNE.koPop, piece = (x, y, len, ang, head) => {
    const away = Math.atan2(y - hy, x - hx), sp = SHATTER.speed * pop * rnd(.5, 1.1);
    SHARDS.push({ x, y, len, ang, head, color, w: 6.5 * scale, r: HEAD_R * scale, t0, last: t0, life: SHATTER.life * rnd(.8, 1.1),
      vx: Math.cos(away) * sp + nx * 380 * pop, vy: Math.sin(away) * sp + ny * 380 * pop - 420 * (head ? pop : 1),
      va: rnd(-SHATTER.spin, SHATTER.spin) * TUNE.koSpin, bounce: Math.min(.85, TUNE.koBounce * (head ? 1.25 : 1)), squash: 0 });
  };
  piece(pts[0], pts[1], 0, 0, true);
  for (const [a, b] of BODY_LINKS) {
    const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
    piece((ax + bx) / 2, (ay + by) / 2, Math.hypot(bx - ax, by - ay), Math.atan2(by - ay, bx - ax), false);
  }
  if (SHARDS.length > SHATTER.max) SHARDS.splice(0, SHARDS.length - SHATTER.max);
  burst(hx, hy, color, 18, 360, { life: .5 });
  ring(hx, hy, 60 * scale, '#ffffff', .25, 3);
}

// Moves the pieces by game time (so pauses freeze them and replays slow them) and draws them as neon sticks.
function shatterDraw(c2) {
  const now = G_STATE.t;
  if (!SHARDS.length) return;
  SHARDS = SHARDS.filter(s => s.t0 <= now + 1e-6 && now - s.t0 < s.life);    // a replay rewound time: drop "future" pieces
  c2.save();
  c2.lineCap = 'round';
  for (const s of SHARDS) {
    shatterMove(s, clamp(now - s.last, 0, .05)); s.last = now;
    const age = (now - s.t0) / s.life, a = age < .6 ? 1 : 1 - (age - .6) / .4;
    c2.globalAlpha = a;
    c2.shadowColor = s.color; c2.shadowBlur = 16;
    if (s.head) shatterHead(c2, s);
    else {
      const dx = Math.cos(s.ang) * s.len / 2, dy = Math.sin(s.ang) * s.len / 2;
      lineXY(c2, s.x - dx, s.y - dy, s.x + dx, s.y + dy, s.color, s.w);
      c2.shadowBlur = 0;
      lineXY(c2, s.x - dx * .8, s.y - dy * .8, s.x + dx * .8, s.y + dy * .8, rgba('#ffffff', .7), s.w * .3);
    }
  }
  c2.restore();
}

function shatterMove(s, dt) {
  if (!dt) return;
  s.vy += PHYS.gravity * .8 * dt;
  s.x += s.vx * dt; s.y += s.vy * dt; s.ang += s.va * dt;
  if (MAP && MAP.walls && (s.x < 10 || s.x > W - 10)) { s.x = clamp(s.x, 10, W - 10); s.vx = -s.vx * .5; }
  s.squash = Math.max(0, (s.squash || 0) - dt * 4);
  const g = MAP ? groundBelow(s.x, s.y - 30) : null;
  if (g != null && s.y > g - 4 && s.vy > 0) {
    if (s.vy > 160) s.squash = Math.min(.45, s.vy / 1600);   // a hard landing squashes the piece for a moment
    s.y = g - 4; s.vy *= -(s.bounce ?? .35); s.vx *= .7; s.va *= .6;
  }
}

// The head piece: a ring that squashes flat when it lands and springs back round (drawing only).
function shatterHead(c2, s) {
  const q = s.squash || 0;
  c2.save(); c2.translate(s.x, s.y + s.r * q * .5); c2.scale(1 + q, 1 - q);
  circle(c2, 0, 0, s.r, null, s.color, 4);
  c2.restore();
}
