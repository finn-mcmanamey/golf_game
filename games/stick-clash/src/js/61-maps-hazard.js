// 61-maps-hazard.js: arenas built around telegraphed dangers: Caldera (lava geysers), Robo Factory (conveyors and
// crushers), Spike Pit, Storm Rooftop (gusts and lightning) and Desert Ruins (sandstorm, crumbling ledges).
// Uses the toolkit in 60-maps.js (mapStepTraps, mapStepWind, mapStepCrumble...).

// ---------- Caldera ----------
const CALDERA_POOLS = [{ x: 300, w: 220 }, { x: 760, w: 220 }];
// The volcano's smoke plume (mapSmoke), also used by the Volcano Eruption (64).
const CALDERA_SMOKE = { n: 8, rate: .06, r0: 40, r1: 130, h: 250, sway: 40, drift: 120, col: '#2a0e0c', a: 1.3 };

defMap('caldera', {
  name: 'Caldera', desc: 'Two lava pools bubble in the crater floor and erupt in geysers. Watch for the glow.', order: 30,
  floor: 650, gravity: 2200,
  palette: { sky1: '#1a0405', sky2: '#5a1408', ground: '#1c0c0a', line: '#ff5a2a', accent: '#ffd36b', solid: '#2a1210' },
  solids: [{ x: 330, y: 470, w: 160 }, { x: 790, y: 470, w: 160 }, { x: 540, y: 320, w: 200 }],
  hazards: [
    ...CALDERA_POOLS.map(p => ({ kind: 'lava', x: p.x, y: 628, w: p.w, h: 60, dps: 16, status: ['burn', 2, 1], launch: 1100, color: '#ff6a2a' })),
    ...mapTrapSlots('geyser', 2, { dps: 26, tick: .35, status: ['burn', 3, 1], launch: 950, color: '#ff8a2a', draw: calderaDrawGeyser }),
  ],
  spawns: [[150, 650], [1130, 650], [640, 650], [640, 320]],
  onStep(dt) {
    mapStepTraps(this, 'geyser', dt, {
      every: [2.5, 5], first: [0, 1.5], warn: 1.3, hit: 1.1,
      aim: () => { const p = pick(CALDERA_POOLS); return { x: p.x + rnd(10, p.w - 90), y: 300, w: 80, h: 350 }; },
      fire: (m, r) => { shake(7); sfx('mapGeyser', .9); burst(r.x + r.w / 2, 630, '#ffb347', 30, 700, { grav: 1 }); },
    });
  },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#0e0204', '#3a0a08', '#8a2410']);
    mapFar(ctx, .2, c => {                            // the distant volcano: glowing vent, lava rivers, red haze, a ridge
      mapGlow(c, 640, 250, 260, '#ff5a2a', .3);
      poly(c, [[260, fl + 40], [560, 260], [720, 260], [1020, fl + 40]], '#2a0a08');
      mapPen(c, 'rgba(255,110,40,.5)', 3);
      c.moveTo(600, 265); c.quadraticCurveTo(560, 400, 470, fl - 30); c.moveTo(690, 265); c.quadraticCurveTo(730, 420, 820, fl - 40);
      c.stroke();
      mapHaze(c, fl, 200, '#ff5a2a', .2);
      mapRidge(c, fl, 120, .009, .5, '#1a0606', fl + 40);
    });
    mapFar(ctx, .2, c => mapSmoke(c, t, 640, 250, CALDERA_SMOKE));
    mapParticles(ctx, t, 40, { vx: 10, vy: -40, sway: 20, size: 2.5, color: '#ff9a4a', alpha: .7, seed: 8 });
    mapGround(ctx, fl, '#1c0c0a', '#ff5a2a', 3, () => {             // cracked basalt with glowing seams
      mapPen(ctx, `rgba(255,100,40,${.35 + .15 * Math.sin(t * 2)})`, 2);
      for (const x of [60, 200, 580, 690, 1060, 1180]) { mapSeg(ctx, x, fl, x + 14, fl + 20); ctx.lineTo(x + 4, fl + 46); ctx.lineTo(x + 20, H); }
      ctx.stroke();
    });
  },
  drawSolid(ctx, s) {
    mapSlab(ctx, s, '#2a1210', '#ff7a3a');
    ctx.fillStyle = 'rgba(255,120,50,.5)';
    for (let x = s.x + 18; x < s.x + s.w - 10; x += 34) ctx.fillRect(x, s.y + 9, 12, 2);
  },
});

// The geyser column: shoots up fast, churns while live, then collapses.
function calderaDrawGeyser(ctx, hz, t) {
  if (mapParked(hz) || !hz.ref) return;
  const w = hz.ref, age = w.max - w.tt, rise = Math.min(1, age / .15) * Math.min(1, w.tt / .2 + .2);
  const top = hz.y + hz.h - hz.h * rise, cx = hz.x + hz.w / 2;
  glow(ctx, '#ff6a2a', 30, () => {
    const g = ctx.createLinearGradient(0, top, 0, hz.y + hz.h);
    g.addColorStop(0, '#ffe08a'); g.addColorStop(.3, '#ff7a2a'); g.addColorStop(1, '#a01a04');
    mapBrush(ctx, g); ctx.moveTo(hz.x + 6, hz.y + hz.h);
    for (let y = hz.y + hz.h; y > top; y -= 14) ctx.lineTo(hz.x + 6 + Math.sin(y * .08 + t * 20) * 6, y);
    ctx.quadraticCurveTo(cx, top - 30, hz.x + hz.w - 6, top);
    for (let y = top; y < hz.y + hz.h; y += 14) ctx.lineTo(hz.x + hz.w - 6 + Math.sin(y * .08 - t * 20) * 6, y);
    ctx.closePath(); ctx.fill();
  });
  for (let k = 0; k < 6; k++) circle(ctx, cx + Math.sin(t * 9 + k * 2) * 30, top - 10 - mapWrap(t * 300 + k * 30, 80), 4, '#ffd36b');
}

// ---------- Robo Factory ----------
const FACTORY_BELTS = [{ x: 0, w: 470, v: -120 }, { x: 810, w: 470, v: 120 }];
const FACTORY_CRUSHERS = [{ x: 24, w: 150 }, { x: 1106, w: 150 }];
const FACTORY_HEAD_UP = 120;    // y of a retracted crusher head's bottom

defMap('factory', {
  name: 'Robo Factory', desc: 'Conveyor belts drag you toward the crushers by the walls. Lights flash before they slam.', order: 70,
  floor: 650, style: 'pixel',
  palette: { sky1: '#0b0f14', sky2: '#1c2630', ground: '#20262e', line: '#ffd84a', accent: '#ff8a2e', solid: '#2a323c' },
  solids: [
    { x: 200, y: 460, w: 180 }, { x: 900, y: 460, w: 180 },
    { x: 550, y: 470, w: 180, move: { dx: 145, dy: 0, period: 6 } },
    { x: 560, y: 290, w: 160, move: { dx: 0, dy: 50, period: 4 } },
  ],
  floorBusy: FACTORY_BELTS,     // King of the Hill keeps its zone off the belts
  hazards: mapTrapSlots('crusher', 2, { dps: 24, tick: 1, status: ['stun', .5, 1], launch: 900, color: '#ffd84a' }),
  spawns: [[560, 650], [720, 650], [290, 460], [990, 460]],
  onStep(dt) {
    mapStepTraps(this, 'crusher', dt, {
      every: [3.5, 6.5], first: [0, 2], warn: 1.2, hit: .45,
      aim: (m, w) => { const c = FACTORY_CRUSHERS[w.idx]; return { x: c.x, y: FACTORY_HEAD_UP, w: c.w, h: m.floor - FACTORY_HEAD_UP }; },
      fire: (m, r) => { shake(10); sfx('mapCrush'); burst(r.x + r.w / 2, m.floor, '#ffd84a', 24, 500); },
    });
    this.beltShift = (this.beltShift || 0) + dt;
    for (const f of F) if (f.alive) factoryBelt(f, dt, this.floor);
  },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#06080c', '#121a22', '#1c2630']);
    // Back wall: panels, pipes, gears and a swinging robot arm.
    mapPen(ctx, 'rgba(120,140,160,.08)', 2);
    for (let x = 0; x < W; x += 80) mapSeg(ctx, x, 0, x, fl);
    for (let y = 60; y < fl; y += 120) mapSeg(ctx, 0, y, W, y);
    ctx.stroke();
    drawGear(ctx, 380, 180, 70, 12, t * .4, '#18202a', 'rgba(255,216,74,.10)');
    drawGear(ctx, 470, 120, 40, 9, -t * .7, '#1a232e', 'rgba(255,216,74,.10)');
    drawGear(ctx, 900, 200, 90, 14, -t * .25, '#18202a', 'rgba(255,216,74,.10)');
    lineXY(ctx, 0, 70, W, 70, '#2a3440', 14); lineXY(ctx, 0, 92, W, 92, '#222a34', 8);
    for (let k = 0; k < 6; k++) circle(ctx, 110 + k * 210, 70, 5, Math.sin(t * 3 + k) > .6 ? '#ff8a2e' : '#3a2a1a');
    this.drawArm(ctx, 640, 70, t);
    // Floor: steel centre plate and two belts with moving chevrons.
    mapGround(ctx, fl, '#20262e', null, 3, () => { for (const b of FACTORY_BELTS) this.drawBelt(ctx, b, fl, t); });
    glowLine(ctx, 470, fl, 810, fl, '#ffd84a', 3);
  },
  drawArm(ctx, x, y, t) {
    const a1 = Math.sin(t * .7) * .6 + Math.PI / 2, a2 = Math.sin(t * 1.1) * .8;
    const ex = x + Math.cos(a1) * 120, ey = y + Math.sin(a1) * 120, hx = ex + Math.cos(a1 + a2) * 90, hy = ey + Math.sin(a1 + a2) * 90;
    lineXY(ctx, x, y, ex, ey, '#2c3642', 16); lineXY(ctx, ex, ey, hx, hy, '#2c3642', 12);
    circle(ctx, x, y, 14, '#3a4652'); circle(ctx, ex, ey, 10, '#3a4652');
    circle(ctx, hx, hy, 6, Math.sin(t * 6) > 0 ? '#ff8a2e' : '#ffd84a');
  },
  drawBelt(ctx, b, fl, t) {
    mapRect(ctx, '#14181e', b.x, fl, b.w, 22);
    ctx.save(); ctx.beginPath(); ctx.rect(b.x, fl, b.w, 22); ctx.clip();
    mapPen(ctx, 'rgba(255,216,74,.55)', 3);
    const d = Math.sign(b.v), off = mapWrap(t * b.v, 40);
    for (let x = b.x - 40 + off; x < b.x + b.w + 40; x += 40) { mapSeg(ctx, x - d * 8, fl + 4, x + d * 4, fl + 11); ctx.lineTo(x - d * 8, fl + 18); }
    ctx.stroke(); ctx.restore();
    for (let x = b.x + 12; x < b.x + b.w; x += 46) circle(ctx, x, fl + 30, 7, '#2a323c', '#4a5664', 2);
    glowLine(ctx, b.x, fl, b.x + b.w, fl, '#ff8a2e', 3);
  },
  drawSolid(ctx, s) {
    mapSlab(ctx, s, '#2a323c', s.move ? '#ff8a2e' : '#ffd84a');
    ctx.save(); ctx.beginPath(); ctx.rect(s.x, s.y + 3, s.w, 8); ctx.clip();      // hazard stripes under the edge
    ctx.fillStyle = 'rgba(255,216,74,.35)';
    for (let x = s.x - 10; x < s.x + s.w; x += 20) poly(ctx, [[x, s.y + 11], [x + 10, s.y + 11], [x + 18, s.y + 3], [x + 8, s.y + 3]], 'rgba(255,216,74,.35)');
    ctx.restore();
  },
  drawFg(ctx, t) {
    for (const w of this.hazards) if (w.role === 'warn') factoryDrawCrusher(ctx, w, this, t);
  },
});

// Belts carry anyone standing on the floor over them: positions shift without adding velocity, like a moving walkway.
function factoryBelt(f, dt, floor) {
  const hip = f.P[2], feetDown = f.grounded && !(f.P[8].gs || f.P[10].gs) && feetY(f) > floor - 4;
  if (!feetDown) return;
  const b = FACTORY_BELTS.find(b => hip.x >= b.x && hip.x <= b.x + b.w);
  if (!b) return;
  for (const p of f.P) { p.x += b.v * dt; p.ox += b.v * dt; }
}

// A crusher head's height follows its trap state: retracted, creeping and shaking (warn), slammed (hit), rising again.
function factoryDrawCrusher(ctx, w, m, t) {
  const c = FACTORY_CRUSHERS[w.idx];
  let bottom = FACTORY_HEAD_UP;
  if (w.st === 'warn') bottom += (1 - w.tt / w.max) * 18 + Math.sin(t * 60) * 2;
  else if (w.st === 'hit') bottom = lerp(FACTORY_HEAD_UP, m.floor, Math.min(1, (m.t - w.hitAt) / .06));
  else if (w.endAt != null) bottom = lerp(m.floor, FACTORY_HEAD_UP, Math.min(1, (m.t - w.endAt) / .6));
  factoryDrawHead(ctx, c.x, c.w, bottom, w.st === 'warn', t);
}

function factoryDrawHead(ctx, x, w, bottom, warn, t) {
  mapRect(ctx, '#3a4450', x + w / 2 - 14, -20, 28, bottom - 40);       // piston rod
  mapRect(ctx, '#2a323c', x, bottom - 60, w, 60);
  ctx.save(); ctx.beginPath(); ctx.rect(x, bottom - 16, w, 16); ctx.clip();
  mapRect(ctx, '#ffd84a', x, bottom - 16, w, 16);
  ctx.fillStyle = '#1a1a1a';
  for (let k = x - 20; k < x + w; k += 24) poly(ctx, [[k, bottom], [k + 12, bottom], [k + 28, bottom - 16], [k + 16, bottom - 16]], '#1a1a1a');
  ctx.restore();
  const lit = warn && (SETTINGS.reduceFlash || Math.sin(t * 30) > 0);
  for (const lx of [x + 18, x + w - 18]) {
    if (lit) mapGlow(ctx, lx, bottom - 40, 60, '#ff3a3a', .6);
    circle(ctx, lx, bottom - 40, 7, lit ? '#ff4a4a' : '#5a1a1a');
  }
}

// ---------- Spike Pit ----------
defMap('spikepit', {
  name: 'Spike Pit', desc: 'A bed of spikes fills the middle of the arena. A hovering bridge crosses it.', order: 80,
  floor: 650, style: 'chalk',
  palette: { sky1: '#0e0610', sky2: '#2a0c1a', ground: '#1a1016', line: '#ff3d5a', accent: '#ffd84a', solid: '#2a1a22' },
  solids: [
    { x: 130, y: 460, w: 220 }, { x: 930, y: 460, w: 220 },
    { x: 565, y: 500, w: 150, move: { dx: 110, dy: 0, period: 4.5 } },
    { x: 560, y: 300, w: 160 },
  ],
  hazards: [{ kind: 'spikes', x: 470, y: 620, w: 340, h: 32, dps: 30, tick: .35, launch: 1250, color: '#ff3d5a' }],
  spawns: [[260, 650], [1020, 650], [240, 460], [1040, 460]],
  // Chalk: the colosseum sketched on slate, the crowd in coloured chalk, the pit hatched red; the torches still flicker.
  art: { top: '#27312e',
    bg(g, m) {
      const fl = m.floor, ch = '#e6ece4', r = artRng(2);
      chalkBoard(g, '#27312e', 5);
      chalkLine(g, [[-40, 122], [W + 40, 118]], ch, 2.5, 1); chalkLine(g, [[-40, 350], [W + 40, 353]], ch, 2.5, 2);
      for (let k = 0; k < 14; k++) { const x = 20 + k * 92; chalkLine(g, [[x, 350], ...artArc(x + 34, 220, 34, Math.PI, TAU, 10), [x + 68, 350]], 'rgba(230,236,228,.5)', 2, k); }
      for (let k = 0; k < 60; k++) {                       // the crowd
        const x = k * 22 + 4, y = 108 + r() * 6, col = ['#ffb8c8', '#b8e2ff', '#fff2a6', '#c6f2b0'][k % 4];
        chalkLine(g, artArc(x, y, 7, 0, TAU, 8), col, 1.6, k, true); chalkLine(g, artArc(x, y + 20, 10, Math.PI, TAU, 6), col, 1.6, k + 70);
      }
      for (const x of [90, 400, 880, 1190]) chalkLine(g, [[x, 424], [x, 460]], '#d9a273', 5, x);
      mapRect(g, 'rgba(8,12,11,.4)', 470, fl - 30, 340, H - fl + 70);
      chalkHatch(g, 470, fl - 30, 340, H - fl + 70, '#ff8f8f', .85, 9);
      chalkLine(g, [[-40, fl], [470, fl], [470, H + 20]], ch, 3.5, 3); chalkLine(g, [[W + 40, fl], [810, fl], [810, H + 20]], ch, 3.5, 4);
    },
    live(c, m, t) { for (const x of [90, 400, 880, 1190]) m.drawTorch(c, x, 420, t); } },
  drawBg(ctx, t) {
    if (artBg(ctx, this, t)) return;
    const fl = this.floor;
    mapSky(ctx, fl, ['#08040a', '#1e0814', '#3a0e1e']);
    // Colosseum arches with a cheering crowd silhouette.
    ctx.fillStyle = '#1a0a14';
    ctx.fillRect(-40, 120, W + 80, 230);
    for (let k = 0; k < 14; k++) {
      const x = 20 + k * 92;
      mapBrush(ctx, '#0c040a'); mapSeg(ctx, x, 350, x, 220); ctx.arc(x + 34, 220, 34, Math.PI, 0); ctx.lineTo(x + 68, 350); ctx.fill();
    }
    ctx.fillStyle = '#26101c';
    for (let k = 0; k < 60; k++) {
      const x = k * 22 + 4, bob = Math.max(0, Math.sin(t * 6 + k * 1.7)) * 6, y = 120 - bob;
      ctx.beginPath(); ctx.arc(x, y - 12, 8, 0, TAU); ctx.fill(); ctx.fillRect(x - 9, y - 6, 18, 16);
    }
    // Torches on the pillars.
    for (const x of [90, 400, 880, 1190]) this.drawTorch(ctx, x, 420, t);
    mapRidge(ctx, fl, 40, .02, 1, '#140810', fl);
    mapGround(ctx, fl, '#1a1016', null, 3, () => {
      mapRect(ctx, '#0a0408', 470, fl - 30, 340, H - fl + 30);         // the sunken pit
      mapPen(ctx, 'rgba(255,61,90,.12)', 1);
      for (let x = 0; x < W; x += 60) mapSeg(ctx, x, fl, x + (x - W / 2) * .3, H);
      ctx.stroke();
    });
    glowLine(ctx, 0, fl, 470, fl, '#ff3d5a', 3); glowLine(ctx, 810, fl, W, fl, '#ff3d5a', 3);
  },
  drawTorch(ctx, x, y, t) {
    mapRect(ctx, '#2a1410', x - 5, y, 10, 40);
    mapGlow(ctx, x, y - 10, 90, '#ff8a3a', .28 + Math.sin(t * 13 + x) * .05);
    for (let k = 0; k < 3; k++) {
      const h = 22 + Math.sin(t * 17 + k * 2 + x) * 6;
      poly(ctx, [[x - 8 + k * 2, y], [x + Math.sin(t * 9 + k) * 4, y - h], [x + 8 - k * 2, y]], ['#ff5a2a', '#ffa03a', '#ffe08a'][k]);
    }
  },
  drawSolid(ctx, s) {
    mapSlab(ctx, s, '#2a1a22', s.move ? '#ffd84a' : '#ff3d5a');
    if (s.move) for (const x of [s.x + 20, s.x + s.w - 20]) { ctx.fillStyle = 'rgba(255,216,74,.25)'; poly(ctx, [[x - 10, s.y + 14], [x + 10, s.y + 14], [x, s.y + 36]], 'rgba(255,216,74,.25)'); }
  },
});

// ---------- Storm Rooftop ----------
defMap('storm', {
  name: 'Storm Rooftop', desc: 'Gusts shove everyone sideways and lightning hits the highest ground. Strikes are marked first.', order: 90,
  floor: 650,
  palette: { sky1: '#05070e', sky2: '#1a2234', ground: '#141a24', line: '#9ad0ff', accent: '#ffe34a', solid: '#222a38' },
  solids: [{ x: 140, y: 460, w: 220 }, { x: 920, y: 440, w: 220 }, { x: 570, y: 300, w: 140 }],
  hazards: mapTrapSlots('bolt', 2, { dps: 20, tick: 1, status: ['stun', .45, 1], launch: 650, color: '#bfe6ff', draw: stormDrawBolt }),
  spawns: [[330, 650], [950, 650], [250, 460], [1030, 440]],
  onStep(dt) {
    mapStepWind(this, dt, { calm: [3, 6], first: [0, 1.5], warn: 1, blow: [1.8, 3], power: 1700 });
    mapStepTraps(this, 'bolt', dt, {
      every: [3, 5.5], first: [.5, 3], warn: 1.1, hit: .25,
      aim: () => stormAim(),
      fire: (m, r) => { flashScreen('#dff2ff', .28); shake(9); sfx('mapThunder'); burst(r.x + r.w / 2, r.y + r.h, '#bfe6ff', 26, 600); },
    });
  },
  drawBg(ctx, t) {
    const fl = this.floor, flash = stormFlash(t);
    mapSky(ctx, fl, flash > 0 ? ['#2a3450', '#4a5a7a'] : ['#04060c', '#101624', '#1a2234']);
    mapSoft(ctx, -40, 250, g => {                    // rolling clouds, the nearer ones lower, lighter and faster
      for (let k = 0; k < 3; k++) mapFar(g, .3 - k * .1, c => mapClouds(c, t, { y: 34 + k * 50, n: 9, sp: 12 + k * 8, rx: 112, ry: 50, col: ['#1e2434', '#2a3042', '#363c50'][k], a: 1, puffs: 4, seed: k * 7 }));
    });
    if (flash > 0) this.drawFarBolt(ctx, t);
    mapFar(ctx, .15, c => { mapSkyline(c, fl, 22, 40, 280, '#0a0e18', 'rgba(255,220,140,.25)', t); mapHaze(c, fl, 220, '#4a6a9a', .2); });   // the city in the rain below the roof
    this.drawTower(ctx, 250, 460); this.drawBillboard(ctx, 1030, 440, t);
    mapGround(ctx, fl, '#141a24', '#9ad0ff', 3, () => {        // wet roof with rain splashes
      mapRect(ctx, 'rgba(150,200,255,.08)', -40, fl + 2, W + 80, 10);
      for (let k = 0; k < 18; k++) {
        const ph = mapWrap(t * 2 + k * .37, 1), x = mapHash(k + 77) * W;
        mapPen(ctx, `rgba(180,220,255,${.4 * (1 - ph)})`, 1); ctx.ellipse(x, fl + 4, 3 + ph * 10, 1 + ph * 2, 0, 0, TAU); ctx.stroke();
      }
    });
  },
  drawFarBolt(ctx, t) {
    const seed = Math.floor(t / 4.3), x0 = 200 + mapHash(seed) * 880;
    mapPen(ctx, 'rgba(220,240,255,.6)', 2); ctx.moveTo(x0, 0);
    for (let y = 30, x = x0; y < 380; y += 30) { x += (mapHash(seed * 13 + y) - .5) * 60; ctx.lineTo(x, y); }
    ctx.stroke();
  },
  drawTower(ctx, x, top) {
    mapPen(ctx, '#0e121c', 6);
    mapSeg(ctx, x - 90, 650, x - 80, top); mapSeg(ctx, x + 90, 650, x + 80, top);
    mapSeg(ctx, x - 85, 560, x + 85, 480); mapSeg(ctx, x + 85, 560, x - 85, 480);
    ctx.stroke();
    mapRect(ctx, '#121824', x - 90, top - 110, 180, 110);
    ctx.beginPath(); mapSeg(ctx, x - 100, top - 110, x, top - 150); ctx.lineTo(x + 100, top - 110); ctx.fill();
  },
  drawBillboard(ctx, x, top, t) {
    lineXY(ctx, x - 70, top, x - 70, 650, '#0e121c', 8); lineXY(ctx, x + 70, top, x + 70, 650, '#0e121c', 8);
    mapRect(ctx, '#10141e', x - 110, top - 130, 220, 120);
    const on = Math.sin(t * 7) > -.6 || Math.sin(t * 23) > .9, col = on ? '#ff5ad1' : '#3a1030';
    mapSign(ctx, 'VOLT', x, top - 72, 30, col, on ? 18 : 0); mapSign(ctx, 'COLA', x, top - 46, 16, col, on ? 18 : 0);
  },
  drawSolid(ctx, s) { mapSlab(ctx, s, '#222a38', '#9ad0ff'); },
  drawFg(ctx, t) { wxRain(ctx, t); mapDrawWind(ctx, this, t, '#bfe6ff'); },   // rain slants with the gusts (58)
});

// Lightning aims at a fighter (sometimes slightly off) and hits the highest surface above them.
function stormAim() {
  const live = F.filter(f => f.alive);
  if (!live.length) return null;
  const f = pick(live), x = clamp(f.P[2].x + rnd(-50, 50), 60, W - 60), g = groundBelow(x, -200) ?? MAP.floor;
  return { x: x - 40, y: 0, w: 80, h: g };
}

// A brief background lightning flash every few seconds (decoration only).
const stormFlash = t => { const ph = mapWrap(t, 4.3); return !SETTINGS.reduceFlash && ph < .12 && Math.sin(ph * 90) > 0 ? 1 : 0; };

function stormDrawBolt(ctx, hz, t) {
  if (mapParked(hz) || !hz.ref) return;
  const cx = hz.x + hz.w / 2, seed = Math.floor(t * 30), bottom = hz.y + hz.h;
  glow(ctx, '#bfe6ff', 30, () => {
    for (const [wid, col] of [[9, 'rgba(160,210,255,.5)'], [3.5, '#ffffff']]) {
      mapPen(ctx, col, wid); ctx.moveTo(cx, 0);
      for (let y = 40, x = cx; y < bottom; y += 40) { x = cx + (mapHash(seed + y) - .5) * 50; ctx.lineTo(x, Math.min(y, bottom)); }
      ctx.lineTo(cx, bottom); ctx.stroke();
    }
  });
  mapGlow(ctx, cx, bottom, 90, '#dff2ff', .6);
}

// ---------- Desert Ruins ----------
defMap('desert', {
  name: 'Desert Ruins', desc: 'Sandstorms push you around and old ledges crumble underfoot, then rebuild from the sand.', order: 100,
  floor: 650,
  palette: { sky1: '#1a0e2a', sky2: '#ff9a4a', ground: '#c08a4a', line: '#ffc86b', accent: '#ff6a3a', solid: '#a8743a' },
  solids: [
    { x: 380, y: 505, w: 130 }, { x: 770, y: 505, w: 130 },
    { x: 110, y: 400, w: 200, crumble: true }, { x: 970, y: 400, w: 200, crumble: true }, { x: 545, y: 310, w: 190, crumble: true },
  ],
  spawns: [[220, 650], [1060, 650], [445, 505], [835, 505]],
  onStep(dt) {
    mapStepWind(this, dt, { calm: [4, 7], first: [1, 3], warn: 1.2, blow: [2.5, 4], power: 1200 });
    const before = this.solids.map(s => s.cs);
    mapStepCrumble(this, dt);
    if (this.solids.some((s, i) => s.cs === 'fall' && before[i] === 'shake')) sfx('mapCrumble');
  },
  drawBg(ctx, t) {
    const fl = this.floor, g = this.gust ? this.gust.k : 0;
    mapSky(ctx, fl, ['#1a0e2a', '#6a2a4a', '#e0603a', '#ffb05a']);
    mapGlow(ctx, 900, 330, 200, '#ffe08a', .5);
    circle(ctx, 900, 330, 62, '#ffe7a8');
    // Pyramids and dunes.
    poly(ctx, [[120, fl - 60], [330, fl - 300], [540, fl - 60]], '#8a4a3a');
    poly(ctx, [[330, fl - 300], [540, fl - 60], [420, fl - 60]], '#6a3428');
    poly(ctx, [[640, fl - 60], [760, fl - 200], [880, fl - 60]], '#7a4234');
    mapRidge(ctx, fl - 20, 90, .005, t * .02, '#b0663a', fl);
    mapRidge(ctx, fl, 60, .009, 2 + t * .03, '#c88048', fl);
    // Broken columns behind the stone ledges.
    for (const s of this.solids) if (!s.crumble) this.drawColumn(ctx, s.x + s.w / 2, s.y, fl);
    mapGround(ctx, fl, '#c08a4a', '#ffc86b', 3, () => {        // rippled sand that drifts with the gusts
      mapPen(ctx, 'rgba(120,70,30,.35)', 2);
      for (let y = fl + 14; y < H; y += 18) for (let x = 0; x < W; x += 140) { const o = mapWrap(x + y * 3 + t * 20 * Math.sign(PHYS.windX || 1) * g, 140); ctx.moveTo(x + o, y); ctx.quadraticCurveTo(x + o + 30, y - 6, x + o + 60, y); }
      ctx.stroke();
    });
  },
  drawColumn(ctx, x, top, fl) {
    mapRect(ctx, '#8a5a32', x - 26, top + 14, 52, fl - top - 14);
    ctx.fillStyle = 'rgba(60,30,10,.25)';
    for (let k = -16; k <= 16; k += 16) ctx.fillRect(x + k - 2, top + 20, 4, fl - top - 26);
  },
  drawSolid(ctx, s, t) {
    if (s.cs === 'gone') return;
    const shake = s.cs === 'shake' ? Math.sin(t * 70) * 3 : 0, alpha = s.cs === 'back' ? 1 - s.ct / .5 : 1;
    ctx.save(); ctx.translate(shake, 0);
    mapSlab(ctx, s, s.crumble ? '#a8743a' : '#8a5a32', s.crumble ? '#ffc86b' : '#ffe0a0', alpha);
    if (s.crumble) {
      ctx.globalAlpha = alpha; mapPen(ctx, 'rgba(70,35,10,.8)', 1.5);
      for (let x = s.x + 26, k = 0; x < s.x + s.w - 10; x += 44, k++) {      // jagged cracks running down the slab
        const j = (k % 2 ? 1 : -1) * 4;
        mapSeg(ctx, x, s.y + 1, x + j, s.y + 5); ctx.lineTo(x - j * .5, s.y + 9); ctx.lineTo(x + j, s.y + 14);
        mapSeg(ctx, x + j, s.y + 5, x + j * 3, s.y + 7);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      if (s.cs === 'shake') for (let k = 0; k < 3; k++) circle(ctx, s.x + mapHash(k + Math.floor(t * 20)) * s.w, s.y + 16 + mapWrap(t * 120 + k * 9, 30), 2, '#d9b27a');
    }
    ctx.restore();
  },
  drawFg(ctx, t) {
    const g = this.gust ? this.gust.k : 0, dir = this.gust ? this.gust.dir : 1;
    mapParticles(ctx, t, 30 + Math.round(g * 90), { vx: dir * (60 + g * 700), vy: 10, sway: 10, size: 2.5, color: '#ffd9a0', alpha: .4 + g * .4, seed: 33 });
    if (g > .02) { mapRect(ctx, `rgba(230,150,80,${.16 * g})`, -40, -40, W + 80, H + 80); }
    mapDrawWind(ctx, this, t, '#ffe0a0');
  },
});
