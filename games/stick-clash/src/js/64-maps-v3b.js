// 64-maps-v3b.js: v3 arenas, part 2: Volcano Eruption (the arena reshapes mid-fight), Space Asteroid (round
// planetoids with their own gravity), Haunted Mansion (blackouts, ghosts) and Giant's Kitchen (toaster, blender,
// rolling fruit). Also places breakables (58-world brkSolid) in a few older arenas.

// ====================================================================================================================
// ---------- Volcano Eruption ----------
// calm -> rumble (3 s: the pool areas flash, CPUs clear out) -> erupt: lava fills both side basins, the side ledges sink
// into it, two basalt ledges rise from it (lifting anyone in the lava out) and lava bombs fall on marked spots.
const ERUPT_POOLS = [{ x: 0, w: 400 }, { x: 880, w: 400 }];
const ERUPT_ROCKS = [{ x: 150, y: 430, w: 170 }, { x: 960, y: 430, w: 170 }];
const ERUPT_OBSIDIAN = { fill: '#1a1420', edge: '#ff7a3a', debris: ['#3a2a3a', '#ff7a3a'] };

defMap('eruption', {
  name: 'Volcano Eruption', desc: 'Mid-fight the volcano blows: the side ledges sink into rising lava, new rock rises from it and lava bombs rain on the marked spots.', order: 240,
  floor: 650, gravity: 2200, weather: ['night', 'wind', 'fog', 'rain'],
  palette: { sky1: '#1a0608', sky2: '#6a1a0a', ground: '#1c1012', line: '#ff6a2a', accent: '#ffd36b', solid: '#2a1a1a' },
  solids: [
    { x: 110, y: 500, w: 220, side: true }, { x: 950, y: 500, w: 220, side: true }, { x: 520, y: 380, w: 240 },
    ...ERUPT_ROCKS.map((r, i) => ({ x: MAP_PARK, y: -MAP_PARK, w: 1, rock: i })),
    brkSolid('crate', 610, 594, 60, 56, { look: ERUPT_OBSIDIAN }),
  ],
  hazards: [
    ...ERUPT_POOLS.map(p => ({ kind: 'lava', pool: p, x: MAP_PARK, y: -MAP_PARK, w: 1, h: 1, dps: 16, tick: .3, status: ['burn', 2, 1], launch: 1100, color: '#ff6a2a', onTouch: eruptPushIn })),
    ...ERUPT_POOLS.map(p => ({ kind: 'warn', poolWarn: p, x: MAP_PARK, y: -MAP_PARK, w: 1, h: 1, dps: 0, draw: mapDrawWarn, warnColor: '#ff5a2a' })),
    ...mapTrapSlots('bomb', 2, { dps: 20, tick: 1, status: ['burn', 2, 1], launch: 900, color: '#ff8a2a', draw: eruptDrawBomb }),
  ],
  spawns: [[220, 500], [1060, 500], [560, 650], [720, 650], [640, 380], [460, 650], [820, 650], [140, 500]],
  lights() { return this.er && this.er.st === 'erupt' ? [{ x: 640, y: 160, r: 260, a: .7 }] : []; },
  onStep(dt) {
    const e = this.er || (this.er = { st: 'calm', at: rnd(8, 11), k: 0, tt: 0 });
    if (e.st === 'calm' && G_STATE.roundT > e.at - 3 && !G_STATE.ending) eruptRumble(this, e);
    else if (e.st === 'rumble' && (e.tt -= dt) <= 0) eruptBlow(this, e);
    else if (e.st === 'erupt') eruptStep(this, e, dt);
    for (const w of this.hazards) if (w.poolWarn && w.st === 'warn') w.tt = Math.max(0, w.tt - dt);
    mapStepTraps(this, 'bomb', dt, {
      every: [1.8, 3.5], first: [0, 1], warn: 1.3, hit: .5,
      aim: () => e.st === 'erupt' ? eruptAim() : null,
      fire: (m, r) => { shake(6); sfx('boom', .7); burst(r.x + r.w / 2, r.y + r.h, '#ffb347', 22, 480, { grav: 1 }); },
    });
  },
  frame(f, phase, enter) { if (phase === 'think' && !enter) eruptBrain(this, f); },
  drawBg(ctx, t) { eruptDrawBg(ctx, this, t); },
  drawFg(ctx, t) {
    const e = this.er;
    if (e && e.st === 'rumble' && (SETTINGS.reduceFlash || Math.sin(t * 16) > -.2)) {
      ctx.save(); ctx.fillStyle = '#ff7a3a'; ctx.font = `36px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
      glow(ctx, '#ff5a2a', 20, () => ctx.fillText('⚠ ERUPTION — GET TO THE MIDDLE', W / 2, 200)); ctx.restore();
    }
    if (e && e.st === 'erupt') mapParticles(ctx, t, 40, { vx: 20, vy: 90, sway: 20, size: 2.5, color: '#8a7a7a', alpha: .6, seed: 23 });   // ash fall
  },
  drawSolid(ctx, s, t) {
    const shake = s.side && this.er && this.er.st !== 'calm' ? Math.sin(t * 50) * 2 : 0;
    ctx.save(); ctx.translate(shake, 0);
    mapSlab(ctx, s, s.rock != null ? '#2a1a1a' : '#3a2420', '#ff6a2a');
    ctx.fillStyle = 'rgba(255,120,50,.55)';
    for (let x = s.x + 16; x < s.x + s.w - 10; x += 30) ctx.fillRect(x, s.y + 8, 10, 2);
    ctx.restore();
  },
});

function eruptRumble(m, e) {
  e.st = 'rumble'; e.tt = 3;
  for (const w of m.hazards) if (w.poolWarn) { mapPlace(w, { x: w.poolWarn.x, y: 520, w: w.poolWarn.w, h: 130 }); w.st = 'warn'; w.tt = w.max = 3; w.avoid = true; }
  sfx('arRumble');
}

function eruptBlow(m, e) {
  e.st = 'erupt'; e.k = 0;
  for (const w of m.hazards) {
    if (w.poolWarn) { mapPark(w); w.avoid = false; w.st = null; }
    if (w.pool) mapPlace(w, { x: w.pool.x, y: 650, w: w.pool.w, h: 70 });
  }
  for (const s of m.solids) if (s.rock != null) { const r = ERUPT_ROCKS[s.rock]; s.x = r.x; s.y = 700; s.w = r.w; }
  shake(16); sfx('mapGeyser'); sfx('boom');
  burst(640, 140, '#ff8a2a', 40, 700, { grav: 1 });
}

// Lava rises in the basins, the side ledges sink into it, and the basalt ledges rise to their spots.
function eruptStep(m, e, dt) {
  e.k = Math.min(1, e.k + dt / 2.5);
  const ease = 1 - (1 - e.k) * (1 - e.k);
  for (const w of m.hazards) if (w.pool && !mapParked(w)) { w.y = 650 - 30 * ease; w.h = 70 + 30 * ease; }
  for (const s of m.solids) {
    if (s.side && !mapParked(s)) { s.dy = 70 * dt; s.y += s.dy; if (s.y > 660) mapPark(s); }
    if (s.rock != null && !mapParked(s)) { const ny = lerp(700, ERUPT_ROCKS[s.rock].y, ease); s.dy = ny - s.y; s.y = ny; }
  }
}

// Lava touched: pop toward the middle of the arena rather than into the wall.
function eruptPushIn(f) { const dir = f.P[2].x < W / 2 ? 1 : -1; for (const p of f.P) kick(p, dir * 560, 0); }

function eruptAim() {
  const live = F.filter(f => f.alive && !f.summon);
  const x = clamp(live.length && chance(.5) ? pick(live).P[2].x + rnd(-80, 80) : rnd(120, 1160), 80, 1200);
  const g = groundBelow(x, 150);
  return g == null ? null : { x: x - 50, y: g - 150, w: 100, h: 152 };
}

// CPUs standing at basin level when the warning starts head for the middle (and hop out of lava).
function eruptBrain(m, f) {
  const e = m.er;
  if (!e || e.st === 'calm') return;
  const x = f.P[2].x, low = feetY(f) > 600, inPool = ERUPT_POOLS.some(p => x > p.x - 20 && x < p.x + p.w + 20);
  if (!low || !inPool) return;
  f.inp.mx = x < W / 2 ? 1 : -1; f.inp.dash = 0;
  if (e.st === 'erupt' && f.grounded) f.inp.jump = true;
}

function eruptDrawBg(ctx, m, t) {
  const e = m.er || { st: 'calm', k: 0 }, fl = m.floor, hot = e.st === 'erupt' ? 1 : e.st === 'rumble' ? .5 : 0;
  mapSky(ctx, fl, hot ? ['#2a0604', '#7a1a08', '#c8400a'] : ['#120608', '#3a1010', '#6a2a1a']);
  mapGlow(ctx, 640, 160, 300, '#ff5a2a', .15 + hot * .35);
  poly(ctx, [[180, fl], [540, 170], [740, 170], [1100, fl]], '#24100c');          // the volcano
  poly(ctx, [[540, 170], [600, 190], [680, 190], [740, 170]], hot ? '#ff7a2a' : '#3a1a10');
  if (e.st !== 'calm') for (let k = 0; k < 10; k++) {                                // smoke column
    const life = mapWrap(t * .25 + k / 10, 1), r = 30 + life * 110;
    circle(ctx, 640 + Math.sin(k * 2.3 + t * .3) * 40 * life, 170 - life * 260, r, `rgba(40,20,20,${(1 - life) * .55})`);
  }
  if (e.st === 'erupt') {
    glow(ctx, '#ff7a2a', 30, () => {                                                   // the fountain and two lava streams
      ctx.fillStyle = '#ffb347';
      for (let k = 0; k < 14; k++) { const a = -Math.PI / 2 + Math.sin(k * 7.1) * .5, u = mapWrap(t * 1.2 + k / 14, 1); circle(ctx, 640 + Math.cos(a) * u * 220, 170 + Math.sin(a) * u * 220 + u * u * 200, 6 * (1 - u) + 2, '#ffb347'); }
    });
    ctx.strokeStyle = 'rgba(255,120,40,.8)'; ctx.lineWidth = 6; ctx.beginPath();
    ctx.moveTo(590, 185); ctx.quadraticCurveTo(450, 380, 300, fl); ctx.moveTo(690, 185); ctx.quadraticCurveTo(830, 380, 980, fl); ctx.stroke();
  }
  ctx.fillStyle = '#1c1012'; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
  glowLine(ctx, 0, fl, W, fl, '#ff6a2a', 2 + hot * 2);
}

function eruptDrawBomb(ctx, hz, t) {
  if (mapParked(hz) || !hz.ref) return;
  const k = 1 - hz.ref.tt / hz.ref.max, x = hz.x + hz.w / 2, y = hz.y + hz.h;
  glow(ctx, '#ff6a2a', 26, () => circle(ctx, x, y - 20, 24 + k * 50, `rgba(255,120,40,${1 - k})`));
}

// ====================================================================================================================
// ---------- Space Asteroid ----------
// Each planetoid pulls toward its centre. A fighter is re-oriented every step: worldFrame turns the whole world about
// its hip so that "down" points at its planet, runs its brain and drive in that frame (so walking, jumping, guarding
// and every CPU rule work unchanged) and turns everything back. Gravity is then applied toward the planet.
const ASTRO_G = 2100;
const ASTRO_PLANETS = [
  { x: 640, y: 500, r: 165, c1: '#8a7aff', c2: '#2a2058' }, { x: 205, y: 330, r: 85, c1: '#5adcb0', c2: '#14483a' },
  { x: 1075, y: 330, r: 85, c1: '#ff9a6a', c2: '#5a2414' }, { x: 640, y: 105, r: 48, c1: '#d8d8e8', c2: '#4a4a5a' },
].map(p => Object.assign(p, { dx: 0, dy: 0 }));

defMap('asteroid', {
  name: 'Space Asteroid', desc: 'Every planetoid has its own gravity: run right round it, jump to hop to the next. Get knocked into deep space and you are out.', order: 250,
  floor: null, walls: false, gravity: ASTRO_G, orbs: false, weather: false,
  palette: { sky1: '#02020a', sky2: '#120a2a', ground: '#2a2058', line: '#8a7aff', accent: '#5adcb0', solid: '#2a2058' },
  // Thin cores inside each planet: projectiles stop on them and the map has something to stand on for the core rules.
  solids: ASTRO_PLANETS.map(p => ({ x: p.x - p.r * .66, y: p.y - 22, w: p.r * 1.32, h: 44, oneWay: false, core: true })),
  spawns: [[560, 356], [720, 356], [205, 245], [1075, 245], [640, 335], [640, 57], [160, 258], [1120, 258]],
  collide(p, friction) { for (const pl of ASTRO_PLANETS) astroCollide(p, pl, friction); },
  frame(f, phase, enter) { astroFrame(this, f, phase, enter); },
  // Real ground for blinks, supply crates, mines, mount landings and the blade ultimate's dash: the top of the planet
  // under (x, y) instead of the thin core inside it. The brain thinks with the flat floor at 1e5 (astroFrame: its pit
  // rules would misread curved ground), and that still wins while it is set.
  groundBelow(x, y) { return this.floor == null ? astroGroundBelow(x, y) : undefined; },
  onStep(dt) { astroPullShots(dt); },
  drawBg(ctx, t) { astroDrawBg(ctx, t); },
  drawSolid() {},
});

// Height of the nearest planet's top surface straight under (x, y), or null over deep space. Curved ground rises
// ahead of a walker, so a surface up to ASTRO_STEP px above the query still counts (flat platforms allow 2 px).
const ASTRO_STEP = 30;
function astroGroundBelow(x, y) {
  let best = null;
  for (const pl of ASTRO_PLANETS) {
    const dx = x - pl.x;
    if (Math.abs(dx) >= pl.r) continue;
    const top = pl.y - Math.sqrt(pl.r * pl.r - dx * dx);
    if (top >= y - ASTRO_STEP && (best == null || top < best)) best = top;
  }
  return best;
}

const astroPlanetOf = pt => ASTRO_PLANETS.reduce((a, b) => Math.hypot(pt.x - b.x, pt.y - b.y) - b.r < Math.hypot(pt.x - a.x, pt.y - a.y) - a.r ? b : a);

// A point inside a planet is pushed out to its surface; inward speed is removed and the rest gets friction.
function astroCollide(p, pl, friction) {
  const dx = p.x - pl.x, dy = p.y - pl.y, r = pl.r;
  if (dx > r || dx < -r || dy > r || dy < -r) return;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return;
  const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
  let vx = p.x - p.ox, vy = p.y - p.oy;
  const vn = vx * nx + vy * ny;
  if (vn < 0) { vx -= nx * vn; vy -= ny * vn; }
  if (friction) { vx *= 1 - PHYS.friction; vy *= 1 - PHYS.friction; }
  p.x = pl.x + nx * r; p.y = pl.y + ny * r;
  p.ox = p.x - vx; p.oy = p.y - vy;
  p.g = true; p.gs = pl;
}

// Turns every fighter and projectile by angle a about (cx, cy): positions, previous positions (so velocities turn
// too) and pending forces.
function astroRotate(a, cx, cy) {
  const c = Math.cos(a), s = Math.sin(a);
  for (const g of F) for (const p of g.P) {
    let x = p.x - cx, y = p.y - cy; p.x = cx + x * c - y * s; p.y = cy + x * s + y * c;
    x = p.ox - cx; y = p.oy - cy; p.ox = cx + x * c - y * s; p.oy = cy + x * s + y * c;
    x = p.fx; p.fx = x * c - p.fy * s; p.fy = x * s + p.fy * c;
  }
  for (const p of PROJ) {
    let x = p.x - cx, y = p.y - cy; p.x = cx + x * c - y * s; p.y = cy + x * s + y * c;
    x = p.vx || 0; y = p.vy || 0; p.vx = x * c - y * s; p.vy = x * s + y * c;
  }
}

function astroFrame(m, f, phase, enter) {
  const st = f.mem.astro || (f.mem.astro = { flip: false });
  if (enter) {
    st.on = f.alive;
    if (!st.on) return;
    const hip = f.P[2], pl = astroPlanetOf(hip), dx = pl.x - hip.x, dy = pl.y - hip.y, r = Math.hypot(dx, dy) || 1;
    Object.assign(st, { pl, ang: Math.atan2(-dx / r, dy / r), px: hip.x, py: hip.y });
    if (phase === 'think') { st.floor = m.floor; m.floor = 1e5; }    // the brain's pit rules would misread curved ground
    else if (f.ctrl === 'human' && !f.autopilot) { st.mx = f.inp.mx; f.inp.mx = astroHumanMx(st, f.inp.mx); }
    astroRotate(-st.ang, st.px, st.py);
    return;
  }
  if (!st.on) return;
  astroRotate(st.ang, st.px, st.py);
  if (phase === 'think') { m.floor = st.floor; astroBrain(f, st); return; }
  if (st.mx !== undefined) { f.inp.mx = st.mx; st.mx = undefined; }
  astroPull(f, st.pl);
}

// A player's left/right stays screen left/right: on a planet's underside the walking direction flips (with some
// hysteresis on the sides so it doesn't flicker).
function astroHumanMx(st, mx) {
  const c = Math.cos(st.ang);
  if (c < -.3) st.flip = true; else if (c > .3) st.flip = false;
  return st.flip ? -mx : mx;
}

// Gravity toward the fighter's planet (weaker further out), replacing the map's straight-down pull.
function astroPull(f, pl) {
  const hip = f.P[2], dx = pl.x - hip.x, dy = pl.y - hip.y, d = Math.hypot(dx, dy) || 1;
  const g = ASTRO_G * clamp(((pl.r + 140) / d) ** 2, .45, 1), gx = dx / d * g, gy = dy / d * g - PHYS.gravity;
  for (const p of f.P) { p.fx += gx; p.fy += gy; }
}

// Shots, grenades and dropped weapons fall toward the nearest planet too.
function astroPullShots(dt) {
  for (const p of PROJ) {
    const k = p.kind === 'pickup' ? 1 : p.grav;
    if (!k || p.dead) continue;
    const pl = astroPlanetOf(p), dx = pl.x - p.x, dy = pl.y - p.y, d = Math.hypot(dx, dy) || 1;
    p.vx += dx / d * ASTRO_G * k * dt; p.vy += (dy / d * ASTRO_G - PHYS.gravity) * k * dt;
    if (p.kind === 'pickup' && d < pl.r + 10) {      // dropped weapons come to rest on the surface
      p.x = pl.x - dx / d * (pl.r + 10); p.y = pl.y - dy / d * (pl.r + 10); p.vx = 0; p.vy = -PHYS.gravity * dt;
    }
  }
}

// A CPU whose foe stands on another planet walks round to the side facing it and jumps across.
function astroBrain(f, st) {
  const foe = f.ai.foe, inp = f.inp, a = f.ai;
  if (!foe || !foe.alive) return;
  if (a.astroHop > G_STATE.t) { inp.jump = false; inp.mx = 0; inp.dash = 0; return; }
  const home = st.pl, there = astroPlanetOf(foe.P[2]);
  if (home === there || !f.grounded) return;
  const hip = f.P[2], d = aiWrap(Math.atan2(there.y - home.y, there.x - home.x) - Math.atan2(hip.y - home.y, hip.x - home.x));
  inp.dash = 0;
  if (Math.abs(d) > .2) { inp.mx = Math.sign(d); inp.jump = false; }
  else { inp.mx = 0; inp.jump = true; a.astroHop = G_STATE.t + .8; }
}

function astroDrawBg(ctx, t) {
  mapSky(ctx, H, ['#02020a', '#0a0620', '#120a2a']);
  mapGlow(ctx, 300, 160, 340, '#6a3aff', .12); mapGlow(ctx, 1000, 560, 380, '#ff3a8a', .08);
  mapStars(ctx, t, 130, H, 3);
  for (const pl of ASTRO_PLANETS) {
    ctx.strokeStyle = rgba(pl.c1, .08); ctx.lineWidth = 2;                        // pulsing gravity rings
    for (let k = 0; k < 3; k++) { const r = pl.r + 30 + mapWrap(t * 30 + k * 40, 120); ctx.globalAlpha = 1 - (r - pl.r - 30) / 120; ctx.beginPath(); ctx.arc(pl.x, pl.y, r, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    mapGlow(ctx, pl.x, pl.y, pl.r * 1.35, pl.c1, .25);
    const g = ctx.createRadialGradient(pl.x - pl.r * .35, pl.y - pl.r * .4, pl.r * .1, pl.x, pl.y, pl.r);
    g.addColorStop(0, pl.c1); g.addColorStop(1, pl.c2);
    circle(ctx, pl.x, pl.y, pl.r, g);
    for (let k = 0; k < Math.round(pl.r / 18); k++) {                              // craters
      const a = mapHash(k + pl.r) * TAU, rr = mapHash(k * 3 + pl.r) * pl.r * .7;
      circle(ctx, pl.x + Math.cos(a) * rr, pl.y + Math.sin(a) * rr, 4 + mapHash(k * 7 + pl.r) * pl.r * .12, 'rgba(0,0,0,.18)');
    }
    circle(ctx, pl.x, pl.y, pl.r, null, pl.c1, 3);
  }
}

// ====================================================================================================================
// ---------- Haunted Mansion ----------
// Lights: on (a dim glow) -> flicker (1.2 s warning) -> off (3.5 s, near black: fighters and blades glow) -> on.
// The balconies stand on pillars; break one and its balcony crashes down. Ghosts drift through after the start.
const HAUNT_CANDLES = [[200, 300], [640, 170], [1080, 300]];

defMap('mansion', {
  name: 'Haunted Mansion', desc: 'The lights flicker and die every few seconds: fighters and blades glow in the dark. Ghosts drift through the hall and chill anyone they touch.', order: 260,
  floor: 650, gravity: 2200, weather: ['fog'], skyTop: '#1a1024',   // the wallpaper colour continues above the arena
  palette: { sky1: '#0a0612', sky2: '#24143a', ground: '#1a1020', line: '#b89aff', accent: '#9affd8', solid: '#3a2a3a' },
  solids: [
    { x: 60, y: 430, w: 320, restsOn: 'mp1' }, { x: 900, y: 430, w: 320, restsOn: 'mp2' },
    brkSolid('pillar', 336, 444, 34, 206, { id: 'mp1' }), brkSolid('pillar', 910, 444, 34, 206, { id: 'mp2' }),
    { x: 560, y: 290, w: 160, move: { dx: 40, period: 5 }, chandelier: true },
    brkSolid('glass', 626, 566, 28, 84),
  ],
  hazards: [
    { kind: 'ghost', x: 595, y: 520, w: 50, h: 64, dps: 5, tick: .8, status: ['slow', 1.2, 1], color: '#9affd8', move: { dx: 430, dy: 30, period: 11 }, draw: hauntDrawGhost },
    { kind: 'ghost', x: 595, y: 330, w: 50, h: 64, dps: 5, tick: .8, status: ['slow', 1.2, 1], color: '#9affd8', move: { dx: 520, dy: 40, period: 14, phase: 2 }, draw: hauntDrawGhost },
  ],
  spawns: [[200, 650], [1080, 650], [220, 430], [1060, 430], [480, 650], [800, 650], [120, 430], [1160, 430]],
  lights(t) {
    const out = HAUNT_CANDLES.map(([x, y]) => ({ x, y, r: 150, a: .5 + .1 * Math.sin(t * 9 + x) }));
    for (const hz of this.hazards) if (!mapParked(hz)) out.push({ x: hz.x + 25, y: hz.y + 30, r: 90, a: .5 });
    return out;
  },
  onStep(dt, t) {
    hauntStepLights(this, dt, t);
    for (const hz of this.hazards) if (!mapLive()) mapPark(hz);     // ghosts only appear once the fight is on
  },
  drawBg(ctx, t) { hauntDrawBg(ctx, this, t); },
  drawFg(ctx) {
    ctx.strokeStyle = 'rgba(220,220,240,.25)'; ctx.lineWidth = 1; ctx.beginPath();   // cobwebs in the corners
    for (const [x, d] of [[0, 1], [W, -1]]) for (let k = 0; k < 5; k++) { ctx.moveTo(x, 0); ctx.lineTo(x + d * (40 + k * 25), 120 - k * 22); }
    ctx.stroke();
  },
  drawSolid(ctx, s, t) {
    if (s.chandelier) {
      lineXY(ctx, s.x + s.w / 2, -40, s.x + s.w / 2, s.y, '#5a4a3a', 3);
      mapSlab(ctx, s, '#4a3a2a', '#ffd38a');
      for (let x = s.x + 14; x < s.x + s.w; x += 33) { lineXY(ctx, x, s.y, x, s.y - 14, '#f0e8d0', 4); circle(ctx, x, s.y - 18, 3 + Math.sin(t * 11 + x) * .8, '#ffd38a'); }
      return;
    }
    mapSlab(ctx, s, '#3a2a3a', '#b89aff');
    ctx.fillStyle = '#2a1a2a';
    for (let x = s.x + 8; x < s.x + s.w - 4; x += 16) ctx.fillRect(x, s.y + 14, 6, 20);   // balusters
    lineXY(ctx, s.x, s.y + 34, s.x + s.w, s.y + 34, '#3a2a3a', 4);
  },
});

function hauntStepLights(m, dt, t) {
  const L = m.lt || (m.lt = { st: 'on', tt: rnd(4, 6) }), go = (st, tt) => { L.st = st; L.tt = tt; };
  if ((L.tt -= dt) <= 0) {
    if (L.st === 'on') { if (mapLive()) go('flicker', 1.2); else L.tt = .3; }
    else if (L.st === 'flicker') { go('off', 3.5); sfx('arGhost'); }
    else go('on', rnd(5, 8));
  }
  const flick = Math.sin(t * 37) + Math.sin(t * 23) > .4;
  const target = L.st === 'off' ? .9 : L.st === 'flicker' ? (SETTINGS.reduceFlash ? .6 : flick ? .85 : .3) : .3;   // reduce flashing: a steady dim
  m.dark = lerp(m.dark ?? .3, target, Math.min(1, dt * (L.st === 'flicker' ? 30 : 6)));
}

function hauntDrawBg(ctx, m, t) {
  const fl = m.floor;
  ctx.fillStyle = '#1a1024'; ctx.fillRect(-40, -40, W + 80, fl + 40);
  ctx.fillStyle = 'rgba(184,154,255,.05)';                                        // damask wallpaper
  for (let y = 20; y < fl; y += 60) for (let x = (y / 60 % 2) * 40; x < W; x += 80) { ctx.beginPath(); ctx.ellipse(x, y, 10, 18, 0, 0, TAU); ctx.fill(); }
  const bolt = mapWrap(t, 9) < .15 && !SETTINGS.reduceFlash;                       // lightning through the windows
  for (const x of [470, 810]) {
    ctx.fillStyle = bolt ? '#c8d8ff' : '#141a34'; ctx.beginPath(); ctx.roundRect(x - 60, 90, 120, 230, [60, 60, 0, 0]); ctx.fill();
    circle(ctx, x + 20, 150, 18, bolt ? '#ffffff' : '#d8e0ff');
    ctx.strokeStyle = '#2a1e30'; ctx.lineWidth = 6; ctx.strokeRect(x - 60, 150, 120, 170); lineXY(ctx, x, 90, x, 320, '#2a1e30', 6);
  }
  for (const [x, y] of [[200, 200], [1080, 200]]) {                                // portraits whose eyes follow you
    ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 46, y - 60, 92, 120); ctx.fillStyle = '#20162a'; ctx.fillRect(x - 36, y - 50, 72, 100);
    circle(ctx, x, y - 10, 22, '#3a2e3a');
    const foe = F.find(f => f.alive), look = foe ? clamp((foe.P[0].x - x) / 400, -1, 1) * 3 : 0;
    for (const ex of [-8, 8]) circle(ctx, x + ex + look, y - 14, 2.5, '#9affd8');
  }
  for (const [x, y] of HAUNT_CANDLES) circle(ctx, x, y, 4, '#ffd38a');
  poly(ctx, [[540, fl], [640, 420], [740, fl]], '#140c1a');                       // staircase in the shadows
  ctx.fillStyle = '#1a1020'; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
  ctx.fillStyle = 'rgba(120,20,40,.35)'; ctx.fillRect(200, fl, 880, 12);          // runner rug
  glowLine(ctx, 0, fl, W, fl, '#b89aff', 2);
}

function hauntDrawGhost(ctx, hz, t) {
  if (mapParked(hz)) return;
  const x = hz.x + hz.w / 2, y = hz.y + 26 + Math.sin(t * 3 + hz.y) * 5, a = .45 + (MAP && MAP.dark || 0) * .5;
  ctx.save(); ctx.globalAlpha = a;
  glow(ctx, '#9affd8', 22, () => {
    ctx.fillStyle = '#d8fff0'; ctx.beginPath(); ctx.arc(x, y, 22, Math.PI, 0);
    for (let k = 0; k <= 4; k++) ctx.lineTo(x + 22 - k * 11, y + 30 + (k % 2 ? -6 : 0) + Math.sin(t * 8 + k) * 3);
    ctx.fill();
  });
  circle(ctx, x - 7, y - 4, 3.5, '#1a1024'); circle(ctx, x + 7, y - 4, 3.5, '#1a1024');
  ctx.restore();
}

// ====================================================================================================================
// ---------- Giant's Kitchen ----------
// A countertop at fighter scale. Toaster: when its slots glow it pops whoever stands on it into the air (no damage).
// Blender: its light turns red, then the blades whirl and fling anyone inside out. Fruit: an arrow flashes at one end
// of the counter, then a runaway orange or tomato rolls across.
const KITCHEN_SUGAR = { fill: '#f4f4f8', edge: '#ffffff', debris: ['#ffffff', '#d8d8e8'] };
const KITCHEN_JAR = { x: 994, w: 192 };
const KITCHEN_LANE = { x0: 330, x1: 975 };

defMap('kitchen', {
  name: "Giant's Kitchen", desc: 'Tiny fighters on a giant countertop. The toaster pops you skyward, the blender whirls when its light turns red, and runaway fruit rolls across.', order: 270,
  floor: 650, gravity: 2200, weather: ['night'], skyTop: '#b8a68a',   // the wall tiles continue above the arena
  palette: { sky1: '#f0e0c8', sky2: '#d8c0a0', ground: '#e8e4dc', line: '#ff8a5a', accent: '#5ab0ff', solid: '#c89a6a' },
  solids: [
    { x: 100, y: 520, w: 220, h: 144, oneWay: false, toaster: true },
    { x: 980, y: 490, w: 14, h: 174, oneWay: false, jar: true }, { x: 1186, y: 490, w: 14, h: 174, oneWay: false, jar: true },
    { x: 420, y: 500, w: 200, board: true }, { x: 700, y: 470, w: 160, plates: true }, { x: 480, y: 320, w: 300, shelf: true },
    brkSolid('crate', 660, 602, 48, 48, { id: 'sc1', look: KITCHEN_SUGAR }), brkSolid('crate', 660, 554, 48, 48, { restsOn: 'sc1', look: KITCHEN_SUGAR }),
  ],
  hazards: [
    ...mapTrapSlots('toast', 1, { dps: 0, tick: 1, launch: 1700, color: '#ff8a3a' }),
    ...mapTrapSlots('blend', 1, { dps: 16, tick: .3, launch: 1500, color: '#c8e8ff', draw: kitchenDrawBlades }),
    ...mapTrapSlots('roll', 1, { dps: 10, tick: 1, launch: 900, color: '#ff8a2a', draw: kitchenDrawFruit }),
  ],
  spawns: [[220, 520], [880, 650], [370, 650], [520, 500], [780, 470], [640, 320], [600, 650], [50, 650]],
  lights: () => [{ x: 640, y: 40, r: 420, a: .55 }, { x: 1090, y: 470, r: 120, a: .6 }],
  onStep(dt) {
    mapStepTraps(this, 'toast', dt, {
      every: [4, 7], first: [0, 2], warn: 1.2, hit: .15,
      aim: () => ({ x: 100, y: 420, w: 220, h: 104 }), fire: () => sfx('arPop'),
    });
    mapStepTraps(this, 'blend', dt, {
      every: [4, 7], first: [1, 3], warn: 1.4, hit: 2.4,
      aim: () => ({ x: KITCHEN_JAR.x, y: 490, w: KITCHEN_JAR.w, h: 160 }), hitRect: r => ({ x: r.x, y: 580, w: r.w, h: 72 }), fire: () => sfx('arWhirr'),
    });
    mapStepTraps(this, 'roll', dt, {
      every: [3.5, 6], first: [.5, 2], warn: 1.3, hit: 1.6,
      aim: (m, w) => { w.dir = chance(.5) ? 1 : -1; w.fruit = rndi(0, 2); return { x: KITCHEN_LANE.x0, y: 580, w: KITCHEN_LANE.x1 - KITCHEN_LANE.x0, h: 70 }; },
      hitRect: () => ({ x: 0, y: 586, w: 64, h: 64 }),
    });
    kitchenRollFruit(this);
  },
  drawBg(ctx, t) { kitchenDrawBg(ctx, this, t); },
  drawFg(ctx, t) {
    const w = this.hazards.find(h => h.trap === 'roll' && h.role === 'warn');
    if (w && w.st === 'warn' && (SETTINGS.reduceFlash || Math.sin(t * 18) > -.2)) {
      const x = w.dir > 0 ? KITCHEN_LANE.x0 + 40 : KITCHEN_LANE.x1 - 40;
      ctx.save(); ctx.fillStyle = '#ff8a2a'; ctx.font = `40px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
      glow(ctx, '#ff8a2a', 16, () => ctx.fillText(w.dir > 0 ? '›››' : '‹‹‹', x, 560)); ctx.restore();
    }
    kitchenDrawJar(ctx, this, t);
  },
  drawSolid(ctx, s, t) { kitchenDrawSolid(ctx, s, this, t); },
});

// The fruit's hit box slides along the lane during the strike.
function kitchenRollFruit(m) {
  const w = m.hazards.find(h => h.trap === 'roll' && h.role === 'warn'), hit = w && m.hazards[m.hazards.indexOf(w) + 1];
  if (!w || w.st !== 'hit' || mapParked(hit)) return;
  const k = clamp((m.t - w.hitAt) / w.max, 0, 1), span = KITCHEN_LANE.x1 - KITCHEN_LANE.x0 - 64;
  hit.x = w.dir > 0 ? KITCHEN_LANE.x0 + k * span : KITCHEN_LANE.x1 - 64 - k * span;
  hit.dir = w.dir; hit.fruit = w.fruit; hit.k = k;
}

function kitchenDrawFruit(ctx, hz) {
  if (mapParked(hz) || hz.k == null) return;
  const x = hz.x + 32, y = hz.y + 32, col = ['#ff9a2a', '#e8402a', '#7ad83a'][hz.fruit || 0];
  circle(ctx, x, y, 32, col, 'rgba(0,0,0,.25)', 2);
  const a = hz.k * 10 * (hz.dir || 1);
  lineXY(ctx, x, y, x + Math.cos(a) * 22, y + Math.sin(a) * 22, 'rgba(255,255,255,.45)', 4);
  circle(ctx, x + Math.cos(a - 1.6) * 26, y + Math.sin(a - 1.6) * 26, 5, '#3a8a2a');
}

function kitchenDrawBlades(ctx, hz, t) {
  if (mapParked(hz)) return;
  const cx = hz.x + hz.w / 2, cy = hz.y + hz.h - 16;
  glow(ctx, '#c8e8ff', 14, () => { for (let k = 0; k < 3; k++) { const a = t * 40 + k * TAU / 3; lineXY(ctx, cx, cy, cx + Math.cos(a) * 80, cy + Math.sin(a) * 12, '#e8f0ff', 5); } });
}

function kitchenDrawJar(ctx, m, t) {
  const w = m.hazards.find(h => h.trap === 'blend' && h.role === 'warn'), st = w ? w.st : 'idle';
  ctx.fillStyle = 'rgba(200,230,255,.12)'; ctx.fillRect(980, 490, 220, 160);
  ctx.strokeStyle = 'rgba(220,240,255,.6)'; ctx.lineWidth = 2; ctx.strokeRect(981, 490, 218, 160);
  ctx.fillStyle = '#3a3a44'; ctx.fillRect(970, 650, 240, 70);
  const lit = st === 'hit' || (st === 'warn' && (SETTINGS.reduceFlash || Math.sin(t * 22) > 0));
  glow(ctx, lit ? '#ff3a3a' : '#3aff8a', lit ? 18 : 8, () => circle(ctx, 1090, 685, 9, lit ? '#ff3a3a' : '#3aff8a'));
  if (st !== 'hit') lineXY(ctx, 1010, 636, 1170, 636, '#9aa8b8', 4);                // resting blades
}

function kitchenDrawSolid(ctx, s, m, t) {
  if (s.jar) return;                                                                   // drawn with the jar in drawFg
  if (s.toaster) {
    const w = m.hazards.find(h => h.trap === 'toast' && h.role === 'warn'), hot = w && w.st === 'warn';
    ctx.fillStyle = '#c8ccd8'; ctx.beginPath(); ctx.roundRect(s.x, s.y, s.w, 130, 22); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(s.x + 16, s.y + 20, 8, 90);
    for (const x of [s.x + 40, s.x + 125]) { ctx.fillStyle = hot ? `rgba(255,${100 + Math.sin(t * 20) * 60},40,.9)` : '#3a3a44'; ctx.fillRect(x, s.y + 4, 56, 8); }
    ctx.fillStyle = '#2a2a34'; ctx.fillRect(s.x + s.w - 6, s.y + (hot ? 80 : 40), 22, 10);   // the lever
    glowLine(ctx, s.x + 10, s.y, s.x + s.w - 10, s.y, '#ff8a5a', 2);
    return;
  }
  const look = s.shelf ? ['#8a5a3a', '#ffd38a'] : s.plates ? ['#f4f4f8', '#5ab0ff'] : ['#c89a6a', '#ff8a5a'];
  ctx.fillStyle = look[0]; ctx.beginPath(); ctx.roundRect(s.x, s.y, s.w, s.plates ? 22 : 14, 6); ctx.fill();
  if (s.plates) for (let k = 1; k < 3; k++) lineXY(ctx, s.x + 6, s.y + k * 7, s.x + s.w - 6, s.y + k * 7, '#c8d8e8', 1.5);
  if (s.shelf) for (const [x, c] of [[s.x + 40, '#c84a3a'], [s.x + 110, '#e8c84a'], [s.x + 190, '#4ac86a']]) { ctx.fillStyle = c; ctx.fillRect(x, s.y - 40, 26, 40); }
  glowLine(ctx, s.x, s.y, s.x + s.w, s.y, look[1], 2);
}

function kitchenDrawBg(ctx, m, t) {
  const fl = m.floor;
  ctx.fillStyle = '#b8a68a'; ctx.fillRect(-40, -40, W + 80, fl + 40);
  ctx.strokeStyle = 'rgba(90,74,54,.35)'; ctx.lineWidth = 3; ctx.beginPath();        // giant wall tiles
  for (let x = 0; x <= W; x += 160) { ctx.moveTo(x, 0); ctx.lineTo(x, fl); }
  for (let y = 40; y < fl; y += 160) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.fillStyle = '#9ad0ff'; ctx.fillRect(560, 40, 300, 200); ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.strokeRect(560, 40, 300, 200);   // window
  circle(ctx, 800, 90, 26, '#fff4c8');
  ctx.fillStyle = '#a8784a'; ctx.fillRect(-40, -40, 520, 120); ctx.fillRect(900, -40, 420, 120);          // cabinets
  for (const x of [100, 330, 1000, 1180]) circle(ctx, x, 60, 8, '#e8c87a');
  ctx.fillStyle = '#c84a3a'; ctx.beginPath(); ctx.roundRect(360, 360, 70, 290, 16); ctx.fill();          // a giant mug behind the board
  ctx.strokeStyle = '#c84a3a'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(430, 470, 46, -1.2, 1.2); ctx.stroke();
  for (let k = 0; k < 3; k++) { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(380 + k * 15, 350); ctx.quadraticCurveTo(370 + k * 15 + Math.sin(t * 2 + k) * 10, 320, 385 + k * 15, 290); ctx.stroke(); }
  const g = ctx.createLinearGradient(0, fl, 0, H);                                   // marble countertop
  g.addColorStop(0, '#f4f0e8'); g.addColorStop(1, '#c8c0b0');
  ctx.fillStyle = g; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
  ctx.strokeStyle = 'rgba(120,110,100,.25)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let k = 0; k < 6; k++) { const x = k * 230; ctx.moveTo(x, fl + 10); ctx.quadraticCurveTo(x + 60, fl + 40, x + 140, fl + 30); }
  ctx.stroke();
  glowLine(ctx, 0, fl, W, fl, '#ff8a5a', 2);
}

// ====================================================================================================================
// ---------- older arenas: breakables and weather rules ----------
// Stacked crates in the Dojo corners, glass panes at the outer ends of the Neon ledges, a crate in the Desert Ruins, and a pillar
// holding up the Graveyard's middle ledge (break it and the ledge drops).
function brkAddToArenas() {
  const set = (key, o) => { if (MAPS[key]) Object.assign(MAPS[key], o); };    // weather that suits each older arena
  set('storm', { ownWind: true }); set('desert', { ownWind: true });
  for (const k of ['moon', 'station', 'temple']) set(k, { weather: ['night', 'fog'] });
  const add = (key, ...list) => { if (MAPS[key]) MAPS[key].solids.push(...list); };
  add('dojo', brkSolid('crate', 30, 580, 60, 60, { id: 'dj1' }), brkSolid('crate', 30, 520, 60, 60, { restsOn: 'dj1' }),
    brkSolid('crate', 1190, 580, 60, 60, { id: 'dj2' }), brkSolid('crate', 1190, 520, 60, 60, { restsOn: 'dj2' }));
  add('neon', brkSolid('glass', 152, 400, 16, 70), brkSolid('glass', 1112, 400, 16, 70));
  add('desert', brkSolid('crate', 612, 594, 56, 56));
  const gy = MAPS.graveyard && MAPS.graveyard.solids.find(s => s.x === 520 && s.y === 470);
  if (gy) { gy.restsOn = 'gyp'; MAPS.graveyard.solids.push(brkSolid('pillar', 625, 484, 30, 166, { id: 'gyp' })); }
}
brkAddToArenas();   // also sets which weathers suit the older arenas
