// 10-physics.js: verlet points and links, integration, constraint solving, and collision with the current map
// (floor, walls, solid boxes, one-way and moving platforms). PHYS holds the map's gravity, friction, drag and wind.

const SOLVER_ITERS = 8;
const VEL_CAP = 40;          // max movement per step (px), i.e. 4800 px/s: keeps knockback from tunnelling
const WALL_PAD = 12, CEILING = -320;

// m: mass (heavier points move less when links are solved). g/gs: touching ground this step, and on which solid.
const pt = (x, y, m = 1) => ({ x, y, ox: x, oy: y, m, fx: 0, fy: 0, g: false, gs: null });

// A link keeps two points at distance `cur` (stiffness k). min: only pushes apart; max: only pulls together.
function addLink(f, a, b, opts) {
  const l = Object.assign({ a, b, r: dist(f.P[a], f.P[b]), k: 1, min: false, max: false }, opts);
  l.cur = l.r;
  f.L.push(l);
  return l;
}

// Moves every point by its velocity plus accumulated forces (accelerations in px/s²).
function integrate(f) {
  const g = PHYS.gravity, drag = PHYS.drag, wind = PHYS.windX;
  for (const p of f.P) {
    const dx = clamp((p.x - p.ox) * drag, -VEL_CAP, VEL_CAP), dy = clamp((p.y - p.oy) * drag, -VEL_CAP, VEL_CAP);
    p.ox = p.x; p.oy = p.y;
    p.x += dx + (p.fx + wind) * DT * DT;
    p.y += dy + (g + p.fy) * DT * DT;
    p.fx = p.fy = 0; p.g = false; p.gs = null;
  }
}

function solveLinks(P, L) {
  for (let i = 0; i < L.length; i++) {             // hot loop: indexed and sqrt, no iterator or hypot garbage
    const l = L[i], a = P[l.a], b = P[l.b], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    if ((l.min && d >= l.cur) || (l.max && d <= l.cur)) continue;
    const s = (d - l.cur) / d * l.k, wa = 1 / a.m, wb = 1 / b.m, t = wa + wb;
    a.x += dx * s * wa / t; a.y += dy * s * wa / t;
    b.x -= dx * s * wb / t; b.y -= dy * s * wb / t;
  }
}

// feetY: where a living fighter's feet were last step. One-way platforms only catch a fighter whose feet were already
// above them, so jumping up through a ledge can't leave the hip "sitting" on it with the legs dangling below.
function solve(f) {
  const feetY = f.alive && f.P.length > 10 ? Math.max(f.P[8].oy, f.P[10].oy) : null;
  for (let it = 0; it < SOLVER_ITERS; it++) {
    solveLinks(f.P, f.L);
    for (let i = 0; i < f.P.length; i++) collidePoint(f.P[i], it === 0, feetY);
  }
}

// ---------- world collision ----------
// Rest a point on a surface at height y. s = the solid (for moving-platform carry) or null for the floor.
function land(p, y, friction, s) {
  const sdx = s ? s.dx : 0, sdy = s ? s.dy : 0;
  p.y = y;
  p.oy = Math.max(p.oy, p.y - sdy);           // can't keep moving down faster than the surface
  p.g = true; p.gs = s;
  if (friction) p.ox += (p.x - p.ox - sdx) * PHYS.friction;   // friction relative to the surface's motion
}

function collidePoint(p, friction, feetY = null) {
  const m = MAP;
  if (!m) return;
  if (m.walls) {
    if (p.x < WALL_PAD) { p.x = WALL_PAD; p.ox = Math.min(p.ox, p.x); }
    if (p.x > W - WALL_PAD) { p.x = W - WALL_PAD; p.ox = Math.max(p.ox, p.x); }
  }
  if (p.y < CEILING) p.y = CEILING;
  if (m.floor != null && p.y > m.floor) land(p, m.floor, friction, null);
  for (const s of m.solids) collideSolid(p, s, friction, feetY);
}

function collideSolid(p, s, friction, feetY) {
  if (p.x < s.x || p.x > s.x + s.w || p.y < s.y) return;
  const prevTop = s.y - s.dy;
  if (s.oneWay) {   // only catches points coming down from above (jump up through it)
    if (p.oy <= prevTop + 1.5 && p.y < s.y + 40 && (feetY == null || feetY <= prevTop + 3)) land(p, s.y, friction, s);
    return;
  }
  if (p.y > s.y + s.h) return;
  const pl = s.x - s.dx, pr = pl + s.w, pb = prevTop + s.h;
  if (p.oy <= prevTop + 1.5) land(p, s.y, friction, s);
  else if (p.oy >= pb - 1.5) { p.y = s.y + s.h; p.oy = Math.min(p.oy, p.y); }
  else if (p.ox <= pl + 1.5) { p.x = s.x; p.ox = Math.min(p.ox, p.x); }
  else if (p.ox >= pr - 1.5) { p.x = s.x + s.w; p.ox = Math.max(p.ox, p.x); }
  else {   // started inside (e.g. pushed by a link): leave by the shortest way
    const up = p.y - s.y, down = s.y + s.h - p.y, left = p.x - s.x, right = s.x + s.w - p.x, m = Math.min(up, down, left, right);
    if (m === up) land(p, s.y, friction, s);
    else if (m === down) p.y = s.y + s.h;
    else if (m === left) p.x = s.x;
    else p.x = s.x + s.w;
  }
}

// Is (x, y) inside any solid (or below the floor)? Used by projectiles, AI and skills that teleport.
function solidAt(x, y, oneWayToo = false) {
  if (!MAP) return null;
  if (MAP.floor != null && y >= MAP.floor) return { floor: true, x: -1e4, y: MAP.floor, w: 2e4, h: 1e4 };
  for (const s of MAP.solids) if ((oneWayToo || !s.oneWay) && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
  return null;
}

// Height of the first surface at or below (x, y), or null over a bottomless gap.
function groundBelow(x, y) {
  let best = MAP && MAP.floor != null ? MAP.floor : null;
  if (!MAP) return best;
  for (const s of MAP.solids) if (x >= s.x && x <= s.x + s.w && s.y >= y - 2 && (best == null || s.y < best)) best = s.y;
  return best;
}

// ---------- map runtime ----------
// Each round gets a fresh copy of the map's solids and hazards so moving parts can carry state.
function instantiateMap(def) {
  const m = Object.assign({}, def);
  const live = o => Object.assign({ h: 14, oneWay: true }, o, { x0: o.x, y0: o.y, dx: 0, dy: 0 });
  m.solids = (def.solids || []).map(live);
  m.hazards = (def.hazards || []).map(o => Object.assign({ dps: 20, kind: 'hazard' }, o, { x0: o.x, y0: o.y, dx: 0, dy: 0 }));
  m.t = 0;
  return m;
}

// move: { dx, dy, period, phase } slides back and forth along (dx, dy) around the start position.
function moveThing(o, t) {
  if (!o.move) { o.dx = o.dy = 0; return; }
  const mv = o.move, k = Math.sin(TAU * t / (mv.period || 4) + (mv.phase || 0));
  const nx = o.x0 + (mv.dx || 0) * k, ny = o.y0 + (mv.dy || 0) * k;
  o.dx = nx - o.x; o.dy = ny - o.y; o.x = nx; o.y = ny;
}

function updateMap(dt) {
  if (!MAP) return;
  MAP.t += dt;
  for (const s of MAP.solids) moveThing(s, MAP.t);
  for (const hz of MAP.hazards) moveThing(hz, MAP.t);
}

function applyMapPhysics(m) {
  PHYS.gravity = m.gravity; PHYS.friction = m.friction; PHYS.drag = m.drag; PHYS.windX = m.windX;
}
