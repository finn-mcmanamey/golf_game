// 62-maps-wild.js: arenas that bend the physics: Sunken Temple (underwater drag and buoyancy), Rainbow Bounce
// (trampolines), Haunted Graveyard (darkness, fog and drifting ghosts) and Orbital Station (zero-g columns).
// Uses the toolkit in 60-maps.js.

// ---------- Sunken Temple ----------
defMap('temple', {
  name: 'Sunken Temple', desc: 'Underwater: heavy drag, floaty jumps and a slow current that sways everyone.', order: 110,
  floor: 650, gravity: 1050, drag: .984, friction: .14,
  palette: { sky1: '#021a2a', sky2: '#0a4a5a', ground: '#0e3a40', line: '#5effd8', accent: '#ffd84a', solid: '#1a4a4a' },
  solids: [{ x: 130, y: 470, w: 230 }, { x: 920, y: 470, w: 230 }, { x: 540, y: 320, w: 200 }],
  spawns: [[330, 650], [950, 650], [245, 470], [1035, 470]],
  onStep(dt, t) { PHYS.windX = Math.sin(t * .35) * 170; },       // a slow tidal current
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#04324a', '#063a4e', '#021a2a']);
    // Sun rays slanting down from the surface.
    for (let k = 0; k < 6; k++) {
      const x = 80 + k * 230 + Math.sin(t * .4 + k) * 40;
      ctx.fillStyle = `rgba(150,255,240,${.05 + .03 * Math.sin(t * .7 + k * 2)})`;
      poly(ctx, [[x, -20], [x + 70, -20], [x + 260, fl], [x + 120, fl]], ctx.fillStyle);
    }
    // Ruined temple: steps, columns and a carved idol face.
    ctx.fillStyle = '#05303a';
    for (let k = 0; k < 4; k++) ctx.fillRect(330 + k * 40, fl - 60 - k * 40, 620 - k * 80, 40);
    for (const x of [400, 520, 760, 880]) { ctx.fillRect(x - 18, 200, 36, fl - 200); ctx.fillRect(x - 26, 196, 52, 14); }
    ctx.fillRect(360, 180, 560, 24);
    poly(ctx, [[360, 180], [640, 100], [920, 180]], '#05303a');
    ctx.save(); ctx.globalAlpha = .55 + .2 * Math.sin(t * 1.5);
    circle(ctx, 610, 150, 7, '#5effd8'); circle(ctx, 670, 150, 7, '#5effd8'); ctx.restore();
    this.drawFish(ctx, t);
    mapParticles(ctx, t, 30, { vx: 6, vy: -50, sway: 14, size: 3, color: '#bffff2', alpha: .5, shape: 'ring', seed: 61 });
    // Sandy floor with caustic shimmer.
    ctx.fillStyle = '#0e3a40'; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
    ctx.strokeStyle = 'rgba(150,255,230,.12)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k < 14; k++) { const x = k * 95 + Math.sin(t + k) * 12; ctx.moveTo(x, fl + 10 + (k % 3) * 14); ctx.quadraticCurveTo(x + 25, fl + 4 + (k % 3) * 14, x + 50, fl + 12 + (k % 3) * 14); }
    ctx.stroke();
    glowLine(ctx, 0, fl, W, fl, '#5effd8', 3);
  },
  drawFish(ctx, t) {
    for (let k = 0; k < 9; k++) {
      const dir = k % 2 ? 1 : -1, x = mapWrap(k * 170 + dir * t * (30 + k * 4), W + 200) - 100, y = 120 + (k * 53) % 300 + Math.sin(t + k) * 10;
      ctx.fillStyle = k % 3 ? 'rgba(255,200,90,.35)' : 'rgba(255,120,160,.35)';
      ctx.beginPath(); ctx.ellipse(x, y, 12, 5, 0, 0, TAU); ctx.fill();
      poly(ctx, [[x - dir * 10, y], [x - dir * 20, y - 6], [x - dir * 20, y + 6]], ctx.fillStyle);
    }
  },
  drawSolid(ctx, s) {
    mapSlab(ctx, s, '#123a40', '#5effd8');
    ctx.fillStyle = 'rgba(94,255,216,.35)';
    for (let x = s.x + 16; x < s.x + s.w - 16; x += 40) { ctx.fillRect(x, s.y + 5, 14, 2); ctx.fillRect(x + 6, s.y + 5, 2, 6); }
  },
  drawFg(ctx, t) {
    // Seaweed swaying along the edges, bubbles rising in front.
    for (let k = 0; k < 10; k++) {
      const x = k < 5 ? 20 + k * 30 : W - 20 - (k - 5) * 30, h = 70 + (k * 23) % 60;
      ctx.strokeStyle = k % 2 ? 'rgba(60,200,120,.75)' : 'rgba(40,160,100,.75)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, H);
      for (let y = 0; y < h; y += 12) ctx.lineTo(x + Math.sin(t * 1.6 + k + y * .05) * (y * .18), H - 70 - y);
      ctx.stroke();
    }
    mapParticles(ctx, t, 16, { vx: 0, vy: -90, sway: 20, size: 4, color: '#dffffa', alpha: .55, shape: 'ring', seed: 99 });
  },
});

// ---------- Rainbow Bounce ----------
const BOUNCE_COLORS = ['#ff4a6a', '#ff9a3a', '#ffe34a', '#5dff9a', '#4ad8ff', '#8a7dff', '#ff5ad1'];

defMap('bounce', {
  name: 'Rainbow Bounce', desc: 'Trampolines launch you sky-high. Bounce over foes and land on top of them.', order: 120,
  floor: 650,
  palette: { sky1: '#1a0a3a', sky2: '#ff7ad8', ground: '#2a0e4a', line: '#ff9af0', accent: '#ffe34a', solid: '#3a1a5a' },
  solids: [{ x: 100, y: 430, w: 200 }, { x: 980, y: 430, w: 200 }, { x: 560, y: 480, w: 160 }, { x: 520, y: 230, w: 240 }],
  pads: [
    { x: 330, y: 650, w: 110, v: 2050, color: '#ff4a6a' },
    { x: 840, y: 650, w: 110, v: 2050, color: '#4ad8ff' },
    { x: 595, y: 480, w: 90, v: 1700, color: '#ffe34a' },
  ],
  spawns: [[220, 650], [1060, 650], [200, 430], [1080, 430]],
  onStep(dt) {
    if (!this.livePads) this.livePads = this.pads.map(p => Object.assign({}, p));   // per-round copy (squash state)
    mapStepPads(this, this.livePads, dt);
  },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#14062e', '#4a1a7a', '#c24ab0', '#ffa0c8']);
    // Rainbow arcs.
    BOUNCE_COLORS.forEach((c, k) => {
      ctx.strokeStyle = rgba(c, .28); ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(640, fl + 60, 560 - k * 18, Math.PI, 0); ctx.stroke();
    });
    mapStars(ctx, t, 40, 260, 70);
    // Floating balloons.
    for (let k = 0; k < 8; k++) {
      const x = 80 + k * 160 + Math.sin(t * .5 + k) * 20, y = mapWrap(560 - t * (14 + k * 2) - k * 90, 640) - 40, c = BOUNCE_COLORS[k % 7];
      lineXY(ctx, x, y + 26, x + Math.sin(t + k) * 6, y + 70, 'rgba(255,255,255,.3)', 1);
      ctx.fillStyle = rgba(c, .55); ctx.beginPath(); ctx.ellipse(x, y, 18, 24, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(x - 6, y - 8, 4, 7, -.4, 0, TAU); ctx.fill();
    }
    // Checkered candy floor.
    for (let x = 0, k = 0; x < W; x += 64, k++) {
      ctx.fillStyle = k % 2 ? '#3a1260' : '#2a0e4a'; ctx.fillRect(x, fl, 64, H - fl + 40);
    }
    BOUNCE_COLORS.forEach((c, k) => { ctx.fillStyle = rgba(c, .5); ctx.fillRect(0, fl + 4 + k * 3, W, 3); });
    glowLine(ctx, 0, fl, W, fl, '#ff9af0', 3);
  },
  drawSolid(ctx, s, t) {
    const k = Math.floor(s.x / 97) % 7;
    mapSlab(ctx, s, '#3a1a5a', BOUNCE_COLORS[k]);
    for (let x = s.x + 8, j = 0; x < s.x + s.w - 4; x += 16, j++) circle(ctx, x, s.y + 8, 3, BOUNCE_COLORS[(j + k) % 7]);
  },
  drawFg(ctx, t) {
    for (const pd of this.livePads || this.pads) bounceDrawPad(ctx, pd, t);
  },
});

// A springy drum that squashes when someone bounces on it.
function bounceDrawPad(ctx, pd, t) {
  const sq = pd.squash || 0, h = 16 - sq * 8, cx = pd.x + pd.w / 2, top = pd.y - h;
  lineXY(ctx, pd.x + 10, pd.y, pd.x + 4, pd.y + 6, '#ffffff', 3); lineXY(ctx, pd.x + pd.w - 10, pd.y, pd.x + pd.w - 4, pd.y + 6, '#ffffff', 3);
  ctx.fillStyle = '#1a0a2a'; ctx.fillRect(pd.x, top + 4, pd.w, h - 2);
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = pd.x + 6; x < pd.x + pd.w - 4; x += 10) { ctx.moveTo(x, top + 6); ctx.lineTo(x + 5, pd.y - 2); }
  ctx.stroke();
  glow(ctx, pd.color, 18 + sq * 20, () => {
    ctx.fillStyle = pd.color; ctx.beginPath(); ctx.ellipse(cx, top + 2, pd.w / 2 + sq * 6, 5 - sq * 2, 0, 0, TAU); ctx.fill();
  });
  const bob = Math.sin(t * 6) * 3;               // a little up arrow hint
  ctx.fillStyle = rgba(pd.color, .7); poly(ctx, [[cx - 8, top - 14 + bob], [cx, top - 24 + bob], [cx + 8, top - 14 + bob]], rgba(pd.color, .7));
}

// ---------- Haunted Graveyard ----------
const GRAVE_GHOSTS = [
  { cx: 640, cy: 420, rx: 420, ry: 60, sp: .22, ph: 0 },
  { cx: 400, cy: 540, rx: 260, ry: 40, sp: -.3, ph: 2 },
  { cx: 880, cy: 360, rx: 240, ry: 90, sp: .27, ph: 4 },
];
let GRAVE_FOG = null;      // offscreen canvas for the darkness layer (made on first draw)

defMap('graveyard', {
  name: 'Haunted Graveyard', desc: 'Dark and foggy: you only see what is near. Ghosts drift through and chill whoever they touch.', order: 130,
  floor: 650,
  palette: { sky1: '#05040e', sky2: '#1a1030', ground: '#120e1a', line: '#9a7dff', accent: '#8dffc8', solid: '#221a30' },
  solids: [{ x: 120, y: 450, w: 200 }, { x: 960, y: 430, w: 200 }, { x: 520, y: 470, w: 240, oneWay: true }, { x: 575, y: 300, w: 130 }],
  hazards: GRAVE_GHOSTS.map(() => ({ kind: 'ghost', x: MAP_PARK, y: -MAP_PARK, w: 44, h: 54, dps: 0, tick: .4, status: ['slow', 1.2, 1], draw: graveDrawGhost })),
  spawns: [[320, 650], [960, 650], [220, 450], [1060, 430]],
  onStep(dt, t) {
    // Ghosts wander on slow loops; they only appear once the safe start is over.
    this.hazards.forEach((hz, k) => {
      const g = GRAVE_GHOSTS[k], a = t * g.sp + g.ph;
      hz.fade = Math.min(1, (hz.fade || 0) + (G_STATE.roundT > MAP_SAFE_START ? dt : 0));
      if (hz.fade <= 0) { mapPark(hz); return; }
      const x = g.cx + Math.cos(a) * g.rx - 22, y = g.cy + Math.sin(a * 2) * g.ry - 27;
      hz.face = x > (hz.lastX ?? x) ? 1 : -1; hz.lastX = x;
      mapPlace(hz, { x, y, w: 44, h: 54 });
    });
  },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#04030a', '#120a24', '#24163a']);
    mapStars(ctx, t, 50, 300, 90);
    mapGlow(ctx, 980, 150, 220, '#cfd8ff', .25);
    circle(ctx, 980, 150, 64, '#e8ecff');
    ctx.fillStyle = 'rgba(160,170,210,.35)';
    for (const [x, y, r] of [[960, 130, 12], [1000, 170, 8], [990, 120, 5]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    this.drawBats(ctx, t);
    mapRidge(ctx, fl, 90, .007, 3, '#100a1c', fl);
    this.drawTree(ctx, 160, fl, 1.1); this.drawTree(ctx, 1150, fl, .9);
    this.drawCrypt(ctx, 640, fl);
    for (let k = 0; k < 12; k++) this.drawStone(ctx, 60 + k * 106 + (k % 3) * 12, fl, k);
    ctx.fillStyle = '#120e1a'; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
    glowLine(ctx, 0, fl, W, fl, '#9a7dff', 2);
  },
  drawBats(ctx, t) {
    ctx.strokeStyle = '#05040a'; ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      const x = mapWrap(k * 300 + t * (40 + k * 6), W + 100) - 50, y = 90 + k * 40 + Math.sin(t * 2 + k) * 20, f = Math.sin(t * 14 + k) * 6;
      ctx.beginPath(); ctx.moveTo(x - 12, y - f); ctx.quadraticCurveTo(x - 5, y + 2, x, y); ctx.quadraticCurveTo(x + 5, y + 2, x + 12, y - f); ctx.stroke();
    }
  },
  drawTree(ctx, x, fl, s) {
    ctx.strokeStyle = '#0a0612'; ctx.lineCap = 'round';
    const branch = (x1, y1, ang, len, w) => {
      if (len < 12) return;
      const x2 = x1 + Math.cos(ang) * len, y2 = y1 + Math.sin(ang) * len;
      ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      branch(x2, y2, ang - .5, len * .68, w * .65); branch(x2, y2, ang + .45, len * .62, w * .65);
    };
    branch(x, fl, -Math.PI / 2, 130 * s, 16 * s);
    ctx.lineCap = 'butt';
  },
  drawCrypt(ctx, x, fl) {
    ctx.fillStyle = '#18122a'; ctx.fillRect(x - 120, 480, 240, fl - 480);
    poly(ctx, [[x - 140, 482], [x, 400], [x + 140, 482]], '#18122a');
    ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.moveTo(x - 34, fl); ctx.lineTo(x - 34, 560); ctx.arc(x, 560, 34, Math.PI, 0); ctx.lineTo(x + 34, fl); ctx.fill();
    ctx.fillStyle = 'rgba(141,255,200,.25)'; ctx.fillRect(x - 3, 420, 6, 34); ctx.fillRect(x - 13, 430, 26, 6);
  },
  drawStone(ctx, x, fl, k) {
    const h = 30 + (k * 17) % 26, tilt = ((k * 7) % 5 - 2) * .05;
    ctx.save(); ctx.translate(x, fl); ctx.rotate(tilt);
    ctx.fillStyle = '#1e1830'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14, -h + 12); ctx.arc(0, -h + 12, 14, Math.PI, 0); ctx.lineTo(14, 0); ctx.fill();
    ctx.fillStyle = 'rgba(160,140,220,.18)'; ctx.fillRect(-7, -h + 10, 14, 3);
    ctx.restore();
  },
  drawSolid(ctx, s) {
    mapSlab(ctx, s, '#221a30', '#9a7dff');
    ctx.fillStyle = 'rgba(141,255,200,.25)';            // moss
    for (let x = s.x + 6; x < s.x + s.w - 6; x += 18) ctx.fillRect(x, s.y + 12, 8, 4 + (x % 5));
  },
  drawFg(ctx, t) {
    // Low fog banks drifting along the ground.
    for (let k = 0; k < 8; k++) {
      const x = mapWrap(k * 200 + t * (15 + k * 3) * (k % 2 ? 1 : -1), W + 400) - 200;
      ctx.fillStyle = 'rgba(170,160,220,.10)'; ctx.beginPath(); ctx.ellipse(x, 640 - (k % 3) * 20, 220, 36, 0, 0, TAU); ctx.fill();
    }
    graveDarkness(ctx, t);
  },
});

// Darkness everywhere except soft light around fighters, orbs, shots and ghosts (drawn at low res, then scaled up).
function graveDarkness(ctx, t) {
  if (typeof document === 'undefined') return;
  if (!GRAVE_FOG) { GRAVE_FOG = document.createElement('canvas'); GRAVE_FOG.width = 320; GRAVE_FOG.height = 180; }
  const fc = GRAVE_FOG.getContext('2d'), k = 320 / W;
  fc.setTransform(1, 0, 0, 1, 0, 0); fc.globalCompositeOperation = 'source-over'; fc.clearRect(0, 0, 320, 180);
  fc.fillStyle = 'rgba(6,3,16,.8)'; fc.fillRect(0, 0, 320, 180);
  fc.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => {
    const g = fc.createRadialGradient(x * k, y * k, 0, x * k, y * k, r * k);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.6, `rgba(0,0,0,${a * .7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    fc.fillStyle = g; fc.fillRect((x - r) * k, (y - r) * k, r * 2 * k, r * 2 * k);
  };
  hole(980, 150, 260, .7);                                   // moonlight
  for (const f of F) if (f.alive) { const c = chest(f); hole(c.x, c.y, 230 + Math.sin(t * 3 + f.id) * 8, 1); }
  for (const o of ORB_LIST) hole(o.x, o.y, 90, .9);
  for (const p of PROJ) hole(p.x, p.y, 70, .8);
  if (MAP) for (const hz of MAP.hazards) if (!mapParked(hz)) hole(hz.x + hz.w / 2, hz.y + hz.h / 2, 80, .7 * (hz.fade ?? 1));
  ctx.drawImage(GRAVE_FOG, -2, -2, W + 4, H + 4);
}

function graveDrawGhost(ctx, hz, t) {
  if (mapParked(hz)) return;
  const x = hz.x + hz.w / 2, y = hz.y + 20 + Math.sin(t * 3 + hz.x * .01) * 4, a = .55 * (hz.fade ?? 1), face = hz.face || 1;
  ctx.save(); ctx.globalAlpha = a;
  glow(ctx, '#8dffc8', 20, () => {
    ctx.fillStyle = '#e8fff4'; ctx.beginPath(); ctx.arc(x, y, 20, Math.PI, 0); ctx.lineTo(x + 20, y + 28);
    for (let k = 0; k < 4; k++) ctx.lineTo(x + 20 - (k + .5) * 10, y + 22 + Math.sin(t * 8 + k) * 4 + (k % 2) * 6);
    ctx.lineTo(x - 20, y + 28); ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = '#1a0a2a';
  ctx.beginPath(); ctx.ellipse(x - 7 + face * 3, y - 2, 4, 6, 0, 0, TAU); ctx.ellipse(x + 7 + face * 3, y - 2, 4, 6, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + face * 3, y + 10, 4, 3, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------- Orbital Station ----------
const STATION_ZONES = [{ x: 150, y: 215, w: 210, h: 435, rise: .12 }, { x: 920, y: 215, w: 210, h: 435, rise: .12 }];

defMap('station', {
  name: 'Orbital Station', desc: 'Zero-g columns let you float up to the high decks. Fight mid-air or ride them to safety.', order: 140,
  floor: 650,
  palette: { sky1: '#02030a', sky2: '#0a1028', ground: '#1a2030', line: '#5ef2ff', accent: '#ff5ad1', solid: '#1e2638' },
  solids: [{ x: 140, y: 190, w: 230 }, { x: 910, y: 190, w: 230 }, { x: 520, y: 450, w: 240 }, { x: 580, y: 280, w: 120, move: { dx: 160, dy: 0, period: 7 } }],
  spawns: [[460, 650], [820, 650], [560, 450], [720, 450]],
  onStep() { mapStepZeroG(STATION_ZONES); },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#010208', '#060a1c', '#0a1028']);
    // A big viewport onto space: drifting stars and a ringed planet.
    ctx.save(); ctx.beginPath(); ctx.ellipse(640, 250, 330, 190, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = '#01020a'; ctx.fillRect(300, 50, 680, 400);
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 80; k++) { ctx.globalAlpha = .3 + mapHash(k) * .6; ctx.fillRect(mapWrap(mapHash(k + 3) * 700 - t * (8 + mapHash(k) * 20), 700) + 290, 60 + mapHash(k + 8) * 380, 2, 2); }
    ctx.globalAlpha = 1;
    const px = 760, py = 280;
    mapGlow(ctx, px, py, 160, '#ff8ad8', .3);
    const pg = ctx.createLinearGradient(px - 80, py - 80, px + 80, py + 80); pg.addColorStop(0, '#ffb08a'); pg.addColorStop(1, '#6a2a8a');
    circle(ctx, px, py, 80, pg);
    ctx.strokeStyle = 'rgba(255,220,200,.55)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(px, py, 150, 30, -.25 + Math.sin(t * .1) * .03, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#2a3450'; ctx.lineWidth = 14; ctx.beginPath(); ctx.ellipse(640, 250, 330, 190, 0, 0, TAU); ctx.stroke();
    glow(ctx, '#5ef2ff', 10, () => { ctx.strokeStyle = 'rgba(94,242,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(640, 250, 340, 200, 0, 0, TAU); ctx.stroke(); });
    // Wall panels with blinking status lights.
    ctx.strokeStyle = 'rgba(94,242,255,.07)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x < W; x += 106) { ctx.moveTo(x, 0); ctx.lineTo(x, fl); }
    ctx.stroke();
    for (let k = 0; k < 14; k++) circle(ctx, 40 + k * 92, 520, 3, Math.sin(t * 2 + k * 1.7) > .4 ? '#ff5ad1' : '#3a1030');
    for (const z of STATION_ZONES) stationDrawZone(ctx, z, t);
    // Metal deck.
    ctx.fillStyle = '#1a2030'; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
    ctx.strokeStyle = 'rgba(94,242,255,.12)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < W; x += 64) { ctx.moveTo(x, fl); ctx.lineTo(x, H); }
    ctx.moveTo(0, fl + 30); ctx.lineTo(W, fl + 30); ctx.stroke();
    glowLine(ctx, 0, fl, W, fl, '#5ef2ff', 3);
  },
  drawSolid(ctx, s) {
    mapSlab(ctx, s, '#1e2638', s.move ? '#ff5ad1' : '#5ef2ff');
    ctx.fillStyle = 'rgba(94,242,255,.4)';
    for (let x = s.x + 10; x < s.x + s.w - 10; x += 22) ctx.fillRect(x, s.y + 8, 12, 2);
  },
});

// A shimmering column with upward chevrons and motes, so the zero-g area reads at a glance.
function stationDrawZone(ctx, z, t) {
  const g = ctx.createLinearGradient(z.x, 0, z.x + z.w, 0);
  g.addColorStop(0, 'rgba(94,242,255,.16)'); g.addColorStop(.5, 'rgba(94,242,255,.04)'); g.addColorStop(1, 'rgba(94,242,255,.16)');
  ctx.fillStyle = g; ctx.fillRect(z.x, z.y, z.w, z.h);
  glowLine(ctx, z.x, z.y, z.x, z.y + z.h, 'rgba(94,242,255,.5)', 2); glowLine(ctx, z.x + z.w, z.y, z.x + z.w, z.y + z.h, 'rgba(94,242,255,.5)', 2);
  ctx.strokeStyle = 'rgba(94,242,255,.25)'; ctx.lineWidth = 3; ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const y = z.y + z.h - mapWrap(t * 60 + k * z.h / 5, z.h), cx = z.x + z.w / 2;
    ctx.moveTo(cx - 24, y + 12); ctx.lineTo(cx, y); ctx.lineTo(cx + 24, y + 12);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(190,250,255,.6)';
  for (let k = 0; k < 14; k++) ctx.fillRect(z.x + mapHash(k + z.x) * z.w, z.y + z.h - mapWrap(t * (30 + mapHash(k) * 40) + k * 37, z.h), 2, 2);
}
