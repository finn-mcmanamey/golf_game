// 63-maps-v3.js: v3 arenas, part 1: Pirate Ship (rolling deck, cannon fire), Train Roof (headwind, tunnels),
// Jungle Temple (swinging vines, dart traps) and Candy Land (sticky caramel, bouncy marshmallows).
// Part 2 (Volcano Eruption, Space Asteroid, Haunted Mansion, Giant's Kitchen) is 64-maps-v3b.js.
// Uses the map toolkit in 60-maps.js and the world systems in 58-world.js (breakables, darkness, worldFrame).
// Every dynamic hazard waits MAP_SAFE_START seconds and is telegraphed; 8 spawns per arena.

on('boot', () => {
  if (typeof defSfx !== 'function') return;
  defSfx('arHorn', v => { tone(220, 220, .7, 'sawtooth', .12 * v); tone(277, 277, .7, 'sawtooth', .1 * v); });
  defSfx('arPop', v => { tone(300, 900, .12, 'square', .12 * v); metal(1800, .4, .15 * v, .05); });
  defSfx('arWhirr', v => { noiseSweep(1.2, 300, 1600, .3 * v, 'bandpass', 0, 4); tone(90, 140, 1.2, 'sawtooth', .07 * v); });
  defSfx('arRumble', v => { noise(1.6, 90, .9 * v, 'lowpass'); thump(60, 30, 1.2, .5 * v); });
  defSfx('arGhost', v => { tone(520, 380, 1, 'sine', .08 * v); tone(530, 395, 1, 'sine', .06 * v, .05); });
  defSfx('arVine', v => noiseSweep(.25, 500, 1500, .25 * v, 'bandpass', 0, 3));
});

// Drains a share k of a fighter's velocity this step (sticky goo).
function arDamp(f, k) { for (const p of f.P) p.ox += (p.x - p.ox) * k; }

// ====================================================================================================================
// ---------- Pirate Ship ----------
// The hull heaves on the swell; the deck rolls, so footing slides toward the low side (PHYS.windX follows the roll).
const SHIP_ROLL = 6, SHIP_SWAY = { dy: 8, period: SHIP_ROLL, phase: Math.PI / 2 };
const SHIP_HULL = { oneWay: false, move: SHIP_SWAY };

defMap('pirate', {
  name: 'Pirate Ship', desc: 'The deck rolls with the swell and footing slides downhill. Cannonballs land on the flashing red rings.', order: 200,
  floor: null, walls: false, gravity: 2200,
  palette: { sky1: '#0b1430', sky2: '#d8703a', ground: '#3a2414', line: '#ffcf7a', accent: '#ff7a3a', solid: '#5a3a22' },
  solids: [
    Object.assign({ x: 110, y: 470, w: 230, h: 200 }, SHIP_HULL),           // stern castle
    Object.assign({ x: 340, y: 560, w: 640, h: 110 }, SHIP_HULL),           // main deck
    Object.assign({ x: 980, y: 500, w: 200, h: 170 }, SHIP_HULL),           // forecastle
    Object.assign({ x: 110, y: 426, w: 12, h: 60, rail: true }, SHIP_HULL), // railings stop a slide off the ends
    Object.assign({ x: 1168, y: 456, w: 12, h: 60, rail: true }, SHIP_HULL),
    { x: 520, y: 400, w: 240, move: { dx: 26, period: SHIP_ROLL } },        // yardarm
    { x: 590, y: 245, w: 100, move: { dx: 44, period: SHIP_ROLL } },        // crow's nest
    brkSolid('crate', 400, 504, 56, 56, { move: SHIP_SWAY }), brkSolid('crate', 870, 504, 56, 56, { move: SHIP_SWAY }),
  ],
  hazards: mapTrapSlots('cannon', 2, { dps: 14, tick: 1, launch: 1000, color: '#ff7a3a', draw: shipDrawBlast }),
  spawns: [[225, 470], [1075, 500], [520, 560], [760, 560], [640, 400], [160, 470], [1130, 500], [640, 560]],
  lights: () => [{ x: 180, y: 430, r: 200, a: .7 }, { x: 1120, y: 460, r: 200, a: .7 }, { x: 640, y: 360, r: 160, a: .6 }],
  onStep(dt, t) {
    this.roll = Math.sin(TAU * t / SHIP_ROLL);
    PHYS.windX = this.roll * 480;
    mapStepTraps(this, 'cannon', dt, {
      every: [3, 5.5], first: [0, 1.5], warn: 1.5, hit: .3,
      aim: () => shipAim(), fire: (m, r) => { shake(9); sfx('boom', .9); burst(r.x + r.w / 2, r.y + r.h, '#ffb347', 26, 520, { grav: 1 }); },
    });
  },
  drawBg(ctx, t) {
    const roll = this.roll || 0;
    mapSky(ctx, H, ['#0b1430', '#3a2a5a', '#d8703a']);
    mapGlow(ctx, 1010, 420, 240, '#ffb060', .45); circle(ctx, 1010, 430, 40, '#ffd08a');
    ctx.save(); ctx.translate(640, 620); ctx.rotate(-roll * .05);             // the horizon tilts as we roll
    shipDrawSea(ctx, t);
    shipDrawEnemy(ctx, -420, -40, t, this.hazards);
    ctx.restore();
    shipDrawMast(ctx, t, roll);
    poly(ctx, [[96, 640], [1196, 640], [1130, 760], [170, 760]], '#3a2414');   // hull below the waterline
  },
  drawFg(ctx, t) {
    ctx.fillStyle = 'rgba(30,80,120,.85)'; ctx.beginPath(); ctx.moveTo(-40, H + 40);
    for (let x = -40; x <= W + 40; x += 20) ctx.lineTo(x, 672 + Math.sin(x * .02 + t * 2) * 7 + Math.sin(x * .05 - t * 3) * 3);
    ctx.lineTo(W + 40, H + 40); ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,.5)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = -40; x <= W + 40; x += 20) ctx.lineTo(x, 672 + Math.sin(x * .02 + t * 2) * 7 + Math.sin(x * .05 - t * 3) * 3);
    ctx.stroke();
    for (const w of this.hazards) if (w.role === 'warn' && w.st === 'warn') shipDrawBall(ctx, w);
  },
  drawSolid(ctx, s) {
    if (s.rail) { ctx.fillStyle = '#7a5230'; ctx.fillRect(s.x, s.y, s.w, 44); return; }
    const h = s.oneWay ? 12 : s.h;
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(s.x, s.y, s.w, h);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let y = s.y + 16; y < s.y + h; y += 16) { ctx.moveTo(s.x, y); ctx.lineTo(s.x + s.w, y); }
    ctx.stroke();
    glowLine(ctx, s.x, s.y, s.x + s.w, s.y, '#ffcf7a', 3);
  },
});

// Half the shots land near a fighter, the rest anywhere on the deck.
function shipAim() {
  const live = F.filter(f => f.alive && !f.summon);
  const x = clamp(live.length && chance(.5) ? pick(live).P[2].x + rnd(-60, 60) : rnd(170, 1120), 150, 1140);
  const g = groundBelow(x, 200);
  return g == null ? null : { x: x - 55, y: g - 170, w: 110, h: 172 };
}

function shipDrawSea(ctx, t) {
  const g = ctx.createLinearGradient(0, -60, 0, 200);
  g.addColorStop(0, '#2a5a7a'); g.addColorStop(1, '#0a1e33');
  ctx.fillStyle = g; ctx.fillRect(-1000, -60, 2000, 400);
  ctx.strokeStyle = 'rgba(255,200,140,.25)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let k = 0; k < 18; k++) {
    const y = -50 + mapHash(k) * 140, x = mapWrap(mapHash(k + 5) * 2000 + t * (10 + k), 2000) - 1000;
    ctx.moveTo(x, y); ctx.lineTo(x + 40 + y * .3, y);
  }
  ctx.stroke();
}

// A rival ship on the horizon; its gun ports flash while a shot is on its way.
function shipDrawEnemy(ctx, x, y, t, hazards) {
  const firing = hazards.some(w => w.role === 'warn' && w.st === 'warn' && w.tt < .5);
  poly(ctx, [[x - 90, y], [x + 90, y], [x + 70, y + 24], [x - 70, y + 24]], '#1a1020');
  lineXY(ctx, x, y, x, y - 110, '#1a1020', 5);
  poly(ctx, [[x + 4, y - 104], [x + 54, y - 80], [x + 4, y - 30]], '#2a1e30');
  for (let k = -2; k <= 2; k++) circle(ctx, x + k * 30, y + 10, 4, firing && Math.sin(t * 40 + k) > 0 ? '#ffd36b' : '#3a2a3a');
}

function shipDrawMast(ctx, t, roll) {
  const top = 150, sway = roll * 6;
  ctx.strokeStyle = 'rgba(40,24,14,.8)'; ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(640 + sway, top); ctx.lineTo(150, 470); ctx.moveTo(640 + sway, top); ctx.lineTo(1150, 500); ctx.stroke();
  lineXY(ctx, 640, 560, 640 + sway, top, '#4a2e18', 14);
  const bil = 30 + Math.sin(t * 1.3) * 8;      // billowing sails, with our own star emblem
  for (const [y0, y1, w] of [[175, 240, 70], [270, 390, 120]]) {
    ctx.fillStyle = '#efe2c4'; ctx.beginPath();
    ctx.moveTo(640 - w, y0); ctx.lineTo(640 + w, y0); ctx.quadraticCurveTo(640 + w + bil * .3, (y0 + y1) / 2, 640 + w, y1);
    ctx.lineTo(640 - w, y1); ctx.quadraticCurveTo(640 - w + bil * .3, (y0 + y1) / 2, 640 - w, y0); ctx.fill();
  }
  ctx.fillStyle = '#c84a3a'; ctx.font = `46px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText('★', 646, 345);
  poly(ctx, [[640 + sway, top], [640 + sway + 60, top + 10 + Math.sin(t * 6) * 5], [640 + sway, top + 22]], '#c84a3a');
}

// The cannonball arcing in from the rival ship during the last moments of the warning.
function shipDrawBall(ctx, w) {
  const k = 1 - w.tt / w.max;
  if (k < .55) return;
  const u = (k - .55) / .45, tx = w.x + w.w / 2, ty = w.y + w.h;
  const x = lerp(160, tx, u), y = lerp(560, ty, u) - Math.sin(u * Math.PI) * 260;
  circle(ctx, x, y, 11, '#1a1a22', '#ffb347', 2);
}

function shipDrawBlast(ctx, hz, t) {
  if (mapParked(hz) || !hz.ref) return;
  const w = hz.ref, k = 1 - w.tt / w.max, x = hz.x + hz.w / 2, y = hz.y + hz.h;
  glow(ctx, '#ff7a3a', 30, () => { circle(ctx, x, y - 30, 30 + k * 60, `rgba(255,140,60,${1 - k})`); circle(ctx, x, y - 30, 18 + k * 30, `rgba(255,230,150,${1 - k})`); });
}

// ====================================================================================================================
// ---------- Train Roof ----------
// Three cars with gaps; the coupling in each gap is the shelter. A tunnel sweeps over the roofline after a warning:
// anyone standing up top is knocked flat. Inside, it is dark.
const RAIL_ROOF = 470, RAIL_SPEED = 1600, RAIL_GAPS = [425, 855];   // gap centres (gaps are 90 px wide)
const RAIL_TUNNEL = { y: 250, h: 165 };          // a standing fighter's head and hip are in it; a crouched one in a gap isn't

defMap('train', {
  name: 'Train Roof', desc: 'Fight on a speeding train into a headwind. When TUNNEL flashes, drop into a gap between the cars.', order: 210,
  floor: null, walls: true, windX: -260, gravity: 2200,
  palette: { sky1: '#1a1030', sky2: '#e0804a', ground: '#2a2230', line: '#ffd84a', accent: '#ff8a3a', solid: '#3a4a5e' },
  solids: [
    { x: 0, y: RAIL_ROOF, w: 380, h: 260, oneWay: false, car: true },
    { x: 470, y: RAIL_ROOF, w: 340, h: 260, oneWay: false, car: true },
    { x: 900, y: RAIL_ROOF, w: 380, h: 260, oneWay: false, car: true },
    { x: 380, y: 600, w: 90, coupling: true }, { x: 810, y: 600, w: 90, coupling: true },
    { x: 570, y: 392, w: 140, h: 92, oneWay: false, box: true },      // freight box (its base sinks into the car roof)
    brkSolid('crate', 1010, 414, 56, 56), brkSolid('crate', 316, 414, 56, 56),
  ],
  hazards: [{ kind: 'tunnel', x: MAP_PARK, y: -MAP_PARK, w: 1, h: 1, dps: 16, tick: .6, status: ['stun', .35, 1], color: '#8a7a6a',
    onTouch(f) { for (const p of f.P) kick(p, -340, 60); }, draw() {} }],
  spawns: [[200, 470], [1100, 470], [520, 470], [760, 470], [640, 392], [80, 470], [300, 470], [960, 470]],
  lights() { return railLamps(this); },
  onStep(dt) {
    this.scroll = (this.scroll || 0) + dt * RAIL_SPEED;
    railStepTunnel(this, dt);
  },
  frame(f, phase, enter) { if (phase === 'think' && !enter) railBrain(this, f); },
  drawBg(ctx, t) {
    const sc = this.scroll || 0;
    mapSky(ctx, H, ['#160c2a', '#5a2a4a', '#e0804a']);
    mapGlow(ctx, 300, 420, 200, '#ffb070', .4);
    mapRidge(ctx, 470, 120, .006, sc * .0008, '#3a2440', 520);
    mapRidge(ctx, 520, 70, .013, sc * .002, '#2a1a30', 560);
    ctx.fillStyle = '#1a1420'; ctx.fillRect(-40, 560, W + 80, 200);
    for (let k = 0; k < 6; k++) {                                         // telegraph poles whipping past
      const x = mapWrap(k * 260 - sc * .9, W + 260) - 130;
      lineXY(ctx, x, 300, x, 600, '#120c18', 6); lineXY(ctx, x - 26, 320, x + 26, 320, '#120c18', 4);
    }
    ctx.strokeStyle = 'rgba(255,200,120,.25)'; ctx.lineWidth = 2; ctx.beginPath();   // ground rushing by (seen in the gaps)
    for (let k = 0; k < 12; k++) { const x = mapWrap(k * 120 - sc, W + 120) - 60; ctx.moveTo(x, 690); ctx.lineTo(x + 50, 690); }
    ctx.stroke();
    railDrawPortal(ctx, this.tun, t);
  },
  drawFg(ctx, t) { railDrawTunnel(ctx, this, t); },
  drawSolid(ctx, s, t) {
    if (s.coupling) { lineXY(ctx, s.x - 6, s.y + 7, s.x + s.w + 6, s.y + 7, '#5a5a66', 10); glowLine(ctx, s.x, s.y, s.x + s.w, s.y, '#ffd84a', 2); return; }
    if (s.box) { mapSlab(ctx, Object.assign({}, s, { h: 78 }), '#b8541e', '#ffb45a'); ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let x = s.x + 10; x < s.x + s.w; x += 18) ctx.fillRect(x, s.y + 8, 6, 64); return; }
    ctx.fillStyle = '#3a4a5e'; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#2a3646'; ctx.fillRect(s.x, s.y, s.w, 12);
    for (let x = s.x + 24; x < s.x + s.w - 40; x += 70) {                // lit windows and the wheels below
      ctx.fillStyle = 'rgba(255,214,140,.75)'; ctx.fillRect(x, s.y + 50, 40, 34);
    }
    for (const x of [s.x + 60, s.x + 110, s.x + s.w - 110, s.x + s.w - 60]) circle(ctx, x, 712, 18, '#16161c', '#5a5a66', 3);
    glowLine(ctx, s.x, s.y, s.x + s.w, s.y, '#ffd84a', 3);
  },
});

// idle -> warn (2.2 s, horn and flashing sign) -> in (the mouth sweeps over, then darkness) -> out (the tail sweeps) -> idle
function railStepTunnel(m, dt) {
  const tn = m.tun || (m.tun = { st: 'idle', tt: rnd(5, 7), x: W, max: 1 }), hz = m.hazards[0];
  tn.tt -= dt;
  if (tn.st === 'idle' && tn.tt <= 0) {
    if (mapLive()) { tn.st = 'warn'; tn.tt = tn.max = 2.2; sfx('arHorn'); } else tn.tt = .4;
  } else if (tn.st === 'warn' && tn.tt <= 0) { tn.st = 'in'; tn.x = W + 40; tn.tt = 2.8; }
  else if (tn.st === 'in') { tn.x = Math.max(-40, tn.x - RAIL_SPEED * dt); if (tn.tt <= 0) { tn.st = 'out'; tn.x = W + 40; } }
  else if (tn.st === 'out') { tn.x -= RAIL_SPEED * dt; if (tn.x < -40) { tn.st = 'idle'; tn.tt = rnd(7, 11); } }
  if (tn.st === 'in') mapPlace(hz, { x: tn.x, y: RAIL_TUNNEL.y, w: W + 40 - tn.x, h: RAIL_TUNNEL.h });
  else if (tn.st === 'out') mapPlace(hz, { x: -40, y: RAIL_TUNNEL.y, w: tn.x + 40, h: RAIL_TUNNEL.h });
  else mapPark(hz);
  const cover = tn.st === 'in' ? (W - tn.x) / W : tn.st === 'out' ? tn.x / W : 0;
  m.dark = clamp(cover, 0, 1) * .85;
}

// CPUs on the roof run for the nearest gap when a tunnel comes, and stay down until it has passed.
function railBrain(m, f) {
  const tn = m.tun;
  const inp = f.inp, x = f.P[2].x, fy = feetY(f), sheltered = fy > RAIL_ROOF + 40;
  if (!tn || tn.st === 'idle' || (tn.st === 'out' && x > tn.x + 80)) {      // the tail has passed us: back to the fight
    if (sheltered && f.grounded && f.jumpCd <= 0) { inp.jump = true; inp.mx = inp.mx || (x < W / 2 ? 1 : -1); }   // climb out of the gap
    return;
  }
  inp.dash = 0;
  if (sheltered) { inp.mx = 0; inp.jump = false; return; }                // already sheltering in a gap
  const gx = RAIL_GAPS.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
  inp.mx = Math.abs(gx - x) > 12 ? Math.sign(gx - x) : 0;
  inp.blockHeld = false;
  const blocked = f.grounded && inp.mx && Math.abs(vx(f.P[2])) < 60 && f.jumpCd <= 0;   // a crate in the way: hop it
  inp.jump = blocked && Math.abs(gx - x) > 50;
}

// The tunnel mouth growing on the horizon during the warning, with a flashing sign.
function railDrawPortal(ctx, tn, t) {
  if (!tn || tn.st !== 'warn') return;
  const k = 1 - tn.tt / tn.max, x = W - 40 - k * 120, s = .4 + k * .8;
  poly(ctx, [[x - 40 * s, 560], [x + 30, 560 - 300 * s], [W + 40, 560 - 320 * s], [W + 40, 560]], '#2a2026');
  ctx.fillStyle = '#050508'; ctx.beginPath(); ctx.ellipse(x + 60 * s, 560, 70 * s, 120 * s, 0, Math.PI, 0); ctx.fill();
  if (SETTINGS.reduceFlash || Math.sin(t * 16) > -.2) {
    ctx.save(); ctx.fillStyle = '#ffd84a'; ctx.font = `34px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
    glow(ctx, '#ffd84a', 18, () => ctx.fillText('⚠ TUNNEL — DROP INTO A GAP', W / 2, 200));
    ctx.restore();
  }
}

// The tunnel ceiling over the roof while inside it (from the mouth or up to the tail).
function railDrawTunnel(ctx, m, t) {
  const tn = m.tun;
  if (!tn || (tn.st !== 'in' && tn.st !== 'out')) return;
  const x0 = tn.st === 'in' ? tn.x : -40, x1 = tn.st === 'in' ? W + 40 : tn.x, bottom = RAIL_TUNNEL.y + RAIL_TUNNEL.h - 40;
  ctx.fillStyle = '#2a2026'; ctx.fillRect(x0, -40, x1 - x0, bottom + 40);
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let y = 20; y < bottom; y += 34) for (let x = x0 - mapWrap((m.scroll || 0) * .5, 68); x < x1; x += 68) { ctx.moveTo(x, y); ctx.lineTo(x + 60, y); }
  ctx.stroke();
  glowLine(ctx, x0, bottom, x1, bottom, '#ff8a3a', 3);
}

function railLamps(m) {
  const tn = m.tun;
  if (!tn || (tn.st !== 'in' && tn.st !== 'out')) return [];
  return [0, 1, 2, 3].map(k => ({ x: mapWrap(k * 360 - (m.scroll || 0) * .5, W + 360) - 180, y: 360, r: 170, a: .55 }));
}

// ====================================================================================================================
// ---------- Jungle Temple ----------
// Vines hang over a spike pit: press grab in mid-air beside one to catch it, move to pump the swing, jump to let go.
// Stone faces in the temple walls spit poison darts along a lane after their eyes glow. The floating altar stands on a
// pillar: break it and the altar drops into the spikes.
const JUNGLE_VINES = [{ x: 450, y: 20, len: 310 }, { x: 830, y: 20, len: 310 }];
const JUNGLE_LANES = [530, 352];       // dart lane tops (floor fighters' chests, altar fighters' legs)
const JUNGLE_MOSS = { fill: '#4a5a3e', edge: '#9fe07a', debris: ['#8a9a6e', '#3e4a2e'] };

defMap('jungle', {
  name: 'Jungle Temple', desc: 'Grab a vine in mid-air (grab key) to swing over the spike pit; jump to let go. Stone faces spit darts when their eyes glow.', order: 220,
  floor: 650, gravity: 2200,
  palette: { sky1: '#06180e', sky2: '#1e4a2a', ground: '#2a2a1a', line: '#9fe07a', accent: '#ffd84a', solid: '#5a5a42' },
  solids: [
    // The steps sink 14 px into the ground (like BRK_SINK): a block ending exactly at the floor let a fighter lying on
    // the floor slide into it along the seam and stay wedged there.
    { x: 0, y: 560, w: 300, h: 104, oneWay: false }, { x: 0, y: 470, w: 180, h: 194, oneWay: false },
    { x: 980, y: 560, w: 300, h: 104, oneWay: false }, { x: 1100, y: 470, w: 180, h: 194, oneWay: false },
    { x: 560, y: 420, w: 160, restsOn: 'jp' }, brkSolid('pillar', 625, 434, 30, 216, { id: 'jp', look: JUNGLE_MOSS }),
    { x: 190, y: 330, w: 150 }, { x: 940, y: 330, w: 150 },
  ],
  hazards: [
    { kind: 'spikes', x: 500, y: 620, w: 280, h: 40, dps: 18, tick: .4, status: ['slow', .6, 1], launch: 1150, color: '#c8d0a0' },
    ...mapTrapSlots('dart', 1, { dps: 9, tick: 1, status: ['poison', 2.5, 1], color: '#9fe07a', draw: jungleDrawDart }),
  ],
  spawns: [[90, 470], [1190, 470], [240, 560], [1040, 560], [640, 420], [265, 330], [1015, 330], [400, 650]],
  onStep(dt) {
    mapStepTraps(this, 'dart', dt, {
      every: [2.8, 5], first: [.5, 2], warn: 1.3, hit: .35,
      aim: (m, w) => { w.dir = chance(.5) ? 1 : -1; w.warnColor = '#9fe07a'; return { x: 300, y: pick(JUNGLE_LANES), w: 680, h: 24 }; },
      fire: () => sfx('arVine', .8),
    });
    jungleStepVines(this, dt);
  },
  frame(f, phase, enter) { if (phase === 'think' && !enter) jungleBrain(this, f); },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#041008', '#0e2a16', '#1e4a2a']);
    for (let k = 0; k < 5; k++) mapGlow(ctx, 200 + k * 230, 80 + mapHash(k) * 60, 160, '#c8ff9a', .07);   // light shafts
    mapRidge(ctx, 420, 160, .008, 1.3, '#0c2414', 600);
    poly(ctx, [[440, 600], [640, 140], [840, 600]], '#2a3424');          // the stepped temple behind
    for (let y = 200; y < 600; y += 50) lineXY(ctx, 640 - (y - 140) * .43, y, 640 + (y - 140) * .43, y, 'rgba(0,0,0,.25)', 2);
    ctx.fillStyle = '#060a06'; ctx.fillRect(612, 520, 56, 80);
    mapParticles(ctx, t, 30, { vx: 8, vy: 12, sway: 18, size: 2, color: '#d8ff8a', alpha: .6, seed: 14, shape: 'circle' });   // fireflies
    ctx.fillStyle = '#2a2a1a'; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
    glowLine(ctx, 0, fl, W, fl, '#9fe07a', 2);
    for (const k of [0, 1]) jungleDrawFace(ctx, k ? 980 : 300, k ? -1 : 1, this.hazards, t);
    jungleDrawVines(ctx, this, t);
  },
  drawFg(ctx, t) {
    for (let k = 0; k < 9; k++) {                                         // hanging canopy leaves
      const x = k * 150 + 20, sw = Math.sin(t * .8 + k) * 6;
      ctx.fillStyle = k % 2 ? '#14381e' : '#1c4a26'; ctx.beginPath(); ctx.ellipse(x + sw, -10, 110, 46, .1, 0, TAU); ctx.fill();
    }
  },
  drawSolid(ctx, s) {
    if (s.y + s.h > this.floor) s = Object.assign({}, s, { h: this.floor - s.y });   // the sunk part stays out of sight
    mapSlab(ctx, s, '#5a5a42', '#9fe07a');
    if (!s.oneWay) { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = s.x + 45; x < s.x + s.w; x += 60) { ctx.moveTo(x, s.y + 4); ctx.lineTo(x, s.y + s.h); } ctx.stroke(); }
  },
});

function jungleVines(m) { return m.vineState || (m.vineState = JUNGLE_VINES.map((v, i) => Object.assign({ a: i ? -.35 : .35, w: 0, holder: null }, v))); }
const jungleTip = v => ({ x: v.x + Math.sin(v.a) * v.len, y: v.y + Math.cos(v.a) * v.len });

function jungleStepVines(m, dt) {
  const vines = jungleVines(m);
  for (const v of vines) {
    if (v.holder && !(v.holder.alive && v.holder.mem.vine && v.holder.mem.vine.v === v)) v.holder = null;
    if (v.holder) continue;
    v.w += (-(PHYS.gravity / v.len) * Math.sin(v.a) - v.w * .25) * dt;   // a free vine swings like a pendulum
    v.a += v.w * dt;
  }
  for (const f of F) {
    if (!f.alive) continue;
    if (f.mem.vine) jungleHang(f, dt);
    else if (f.inp.grab && !f.grounded && !f.heldBy && !f.holding && !f.mount) jungleCatch(f, vines);
  }
}

// Catch the nearest vine within reach of the neck or a hand.
function jungleCatch(f, vines) {
  for (const v of vines) {
    if (v.holder) continue;
    const tip = jungleTip(v), hit = [1, 4, 6].some(j => segSeg(v.x, v.y, tip.x, tip.y, f.P[j].x, f.P[j].y, f.P[j].x, f.P[j].y).d < 44);
    if (!hit) continue;
    const n = f.P[1];
    f.mem.vine = { v, L: clamp(dist(v, n), 110, v.len), t: 0 };
    v.holder = f; f.inp.grab = false;
    sfx('arVine');
    return;
  }
}

// Hanging: the neck stays on the rope's circle (outward speed removed), move pumps the swing, jump lets go with a kick.
function jungleHang(f, dt) {
  const st = f.mem.vine, v = st.v, n = f.P[1];
  st.t += dt;
  if (f.inp.jump || f.inp.grab || st.t > 4 || !canAct(f) || (f.grounded && st.t > .15)) { jungleLetGo(f, f.inp.jump); return; }
  let dx = n.x - v.x, dy = n.y - v.y, d = Math.hypot(dx, dy) || 1;
  if (d > st.L) { moveFighter(f, v.x + dx * st.L / d - n.x, v.y + dy * st.L / d - n.y); dx *= st.L / d; dy *= st.L / d; d = st.L; }
  const ux = dx / d, uy = dy / d;
  for (const p of f.P) { const vr = (p.x - p.ox) * ux + (p.y - p.oy) * uy; if (vr > 0) { p.ox += ux * vr; p.oy += uy * vr; } }
  const mx = clamp(f.inp.mx || 0, -1, 1);
  for (const p of f.P) { p.fx += uy * mx * 1500; p.fy -= ux * mx * 1500; }
  for (const j of [4, 6]) spring(f.P[j], v.x + ux * (d - 34), v.y + uy * (d - 34), 120, 8);
  v.a = Math.atan2(dx, dy); v.w = 0;
  f.airJumps = Math.max(f.airJumps, 1);
}

function jungleLetGo(f, jumped) {
  const st = f.mem.vine;
  f.mem.vine = null;
  if (st) st.v.holder = null;
  if (!jumped) return;
  f.inp.jump = false;
  for (const p of f.P) kick(p, 0, -620);
  f.airJumps = Math.max(f.airJumps, 1);
}

// CPUs hop a dart lane they are standing in just before it fires.
function jungleBrain(m, f) {
  const w = m.hazards.find(h => h.trap === 'dart' && h.role === 'warn' && h.st === 'warn');
  if (!w || w.tt > .55 || !f.grounded) return;
  if ([0, 2, 8].some(j => inRect(f.P[j].x, f.P[j].y, w, 6))) f.inp.jump = true;
}

function jungleDrawVines(ctx, m, t) {
  for (const v of jungleVines(m)) {
    const h = v.holder, end = h ? h.P[4] : jungleTip(v);
    ctx.strokeStyle = '#3e6a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(v.x, v.y);
    ctx.quadraticCurveTo((v.x + end.x) / 2 + Math.sin(t * 1.4 + v.x) * 10, (v.y + end.y) / 2, end.x, end.y); ctx.stroke();
    for (let k = 1; k < 6; k++) {
      const u = k / 6, x = lerp(v.x, end.x, u), y = lerp(v.y, end.y, u);
      ctx.fillStyle = '#5a9a3a'; ctx.beginPath(); ctx.ellipse(x + (k % 2 ? 7 : -7), y, 8, 4, k % 2 ? .6 : -.6, 0, TAU); ctx.fill();
    }
    circle(ctx, v.x, v.y, 6, '#2a4a1e');
  }
}

// A carved face in the temple wall; its eyes glow green while a dart is coming.
function jungleDrawFace(ctx, x, dir, hazards, t) {
  const w = hazards.find(h => h.trap === 'dart' && h.role === 'warn');
  for (const y of JUNGLE_LANES) {
    const armed = w && w.st === 'warn' && w.rect && w.rect.y === y && w.dir === dir;
    const fx = x - dir * 26;
    ctx.fillStyle = '#4a4a36'; ctx.fillRect(fx - 24, y - 26, 48, 52);
    const eye = armed && Math.sin(t * 20) > -.3 ? '#b8ff6a' : '#1a1a10';
    circle(ctx, fx - 9, y - 8, 5, eye); circle(ctx, fx + 9, y - 8, 5, eye);
    ctx.fillStyle = '#14140c'; ctx.fillRect(fx - 8, y + 6, 16, 8);
  }
}

function jungleDrawDart(ctx, hz) {
  if (mapParked(hz) || !hz.ref) return;
  const w = hz.ref, k = 1 - w.tt / w.max, dir = w.dir || 1, y = hz.y + hz.h / 2;
  const x = dir > 0 ? hz.x + k * hz.w : hz.x + hz.w - k * hz.w;
  lineXY(ctx, x - dir * 40, y, x, y, 'rgba(160,255,120,.4)', 3);
  lineXY(ctx, x - dir * 18, y, x, y, '#e8e0c0', 3);
  poly(ctx, [[x, y], [x - dir * 8, y - 4], [x - dir * 8, y + 4]], '#9fe07a');
}

// ====================================================================================================================
// ---------- Candy Land ----------
// Caramel puddles grab your feet (you wade through them slowly); marshmallow blocks are springs.
const CANDY_GOO = [{ x: 150, w: 230 }, { x: 900, w: 230 }];
const CANDY_CHOCO = { fill: '#5a3020', edge: '#ffb0d0', debris: ['#7a4a2a', '#3a1e10'] };

defMap('candy', {
  name: 'Candy Land', desc: 'Caramel puddles stick to your feet and slow you down. Marshmallow blocks bounce you sky-high.', order: 230,
  floor: 650, gravity: 2200,
  palette: { sky1: '#ffb8e0', sky2: '#a8d8ff', ground: '#ff8ac8', line: '#ff5ab0', accent: '#7ae0ff', solid: '#ffe0f0' },
  solids: [
    { x: 470, y: 540, w: 110, mallow: true }, { x: 700, y: 540, w: 110, mallow: true },   // floating marshmallows: springs
    { x: 120, y: 440, w: 200 }, { x: 960, y: 440, w: 200 }, { x: 540, y: 300, w: 200 },
    brkSolid('crate', 40, 590, 60, 60, { look: CANDY_CHOCO }), brkSolid('crate', 1180, 590, 60, 60, { look: CANDY_CHOCO }),
  ],
  pads: [{ x: 470, y: 540, w: 110, v: 1500, color: '#ffd6f0' }, { x: 700, y: 540, w: 110, v: 1500, color: '#ffd6f0' }],
  hazards: CANDY_GOO.map(g => ({ kind: 'caramel', x: g.x, y: 638, w: g.w, h: 26, dps: 0, tick: 1, draw: candyDrawGoo })),
  spawns: [[440, 650], [840, 650], [220, 440], [1060, 440], [640, 650], [600, 300], [140, 440], [1140, 440]],
  onStep(dt) {
    if (!this.livePads) this.livePads = this.pads.map(p => Object.assign({}, p));
    mapStepPads(this, this.livePads, dt);
    for (const f of F) if (f.alive && f.grounded && candyInGoo(f)) arDamp(f, .09);
  },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#c86aa8', '#b88ad8', '#8ab8e8']);
    for (let k = 0; k < 5; k++) {                                         // cotton-candy clouds
      const x = mapWrap(k * 300 + t * 8, W + 300) - 150, y = 70 + mapHash(k) * 120;
      for (const [dx, r] of [[-40, 34], [0, 46], [42, 32]]) circle(ctx, x + dx, y, r, 'rgba(255,230,245,.7)');
    }
    mapRidge(ctx, fl - 60, 110, .007, .8, '#ffa8d8', fl);
    for (let k = 0; k < 6; k++) candyDrawLolly(ctx, 90 + k * 225, fl - 20, 50 + mapHash(k) * 60, k, t);
    ctx.fillStyle = '#ff8ac8'; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
    ctx.fillStyle = '#ffffff';
    for (let x = -40; x < W + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, fl); ctx.lineTo(x + 20, fl); ctx.lineTo(x + 50, H + 40); ctx.lineTo(x + 30, H + 40); ctx.fill(); }
    glowLine(ctx, 0, fl, W, fl, '#ff5ab0', 3);
    mapParticles(ctx, t, 26, { vy: 30, sway: 14, size: 3, color: '#7ae0ff', alpha: .7, seed: 5 });   // sprinkles
  },
  drawSolid(ctx, s, t) {
    if (s.mallow) {
      const pd = (this.livePads || []).find(p => p.x === s.x), sq = pd ? pd.squash : 0, top = s.y + sq * 8;
      ctx.fillStyle = '#fff6fb'; ctx.beginPath(); ctx.roundRect(s.x - sq * 4, top, s.w + sq * 8, 46 - sq * 8, 18); ctx.fill();
      ctx.fillStyle = '#ffc8e4'; ctx.beginPath(); ctx.roundRect(s.x - sq * 4, top, s.w + sq * 8, 14, 10); ctx.fill();
      return;
    }
    ctx.fillStyle = '#ffe0f0'; ctx.beginPath(); ctx.roundRect(s.x, s.y, s.w, 16, 8); ctx.fill();
    ctx.fillStyle = '#ff7ac0';                                             // frosting drips
    for (let x = s.x + 10; x < s.x + s.w - 10; x += 22) { ctx.beginPath(); ctx.ellipse(x, s.y + 14, 6, 6 + mapHash(x) * 8, 0, 0, TAU); ctx.fill(); }
    glowLine(ctx, s.x, s.y, s.x + s.w, s.y, '#ff5ab0', 3);
  },
});

function candyInGoo(f) {
  return [f.P[8], f.P[10]].some(p => p.g && CANDY_GOO.some(g => p.x > g.x && p.x < g.x + g.w) && p.y > 630);
}

function candyDrawGoo(ctx, hz, t) {
  const g = ctx.createLinearGradient(0, hz.y, 0, hz.y + hz.h);
  g.addColorStop(0, '#ffb84a'); g.addColorStop(1, '#a8601a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(hz.x, hz.y + 4, hz.w, hz.h, 10); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,.5)'; ctx.fillRect(hz.x + 14, hz.y + 7, hz.w - 28, 3);
  for (let k = 0; k < 4; k++) {
    const ph = mapWrap(t * .6 + k * .27, 1), x = hz.x + 20 + mapHash(k + hz.x) * (hz.w - 40);
    circle(ctx, x, hz.y + 10 - ph * 6, 3 + ph * 4, null, `rgba(255,220,150,${1 - ph})`, 1.5);
  }
}

function candyDrawLolly(ctx, x, base, h, k, t) {
  lineXY(ctx, x, base, x, base - h, '#ffffff', 5);
  const cy = base - h - 22, a = t * .5 + k;
  circle(ctx, x, cy, 24, ['#ff6ab0', '#7ae0ff', '#ffd84a'][k % 3]);
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4; ctx.beginPath();
  for (let r = 4; r < 22; r += 2) ctx.lineTo(x + Math.cos(a + r * .5) * r, cy + Math.sin(a + r * .5) * r);
  ctx.stroke();
}
