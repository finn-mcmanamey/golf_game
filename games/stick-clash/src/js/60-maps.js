// 60-maps.js: arena defs plus the shared map toolkit (telegraphed traps, wind gusts, crumbling and bouncy surfaces,
// zero-g zones, scenery helpers). More arenas live in 61-maps-hazard.js and 62-maps-wild.js.
// Coordinates are in the 1280x720 arena; spawns are [x, feetY]. Solids default to 14px-thick one-way platforms; set
// oneWay: false (and h) for solid blocks. move: { dx, dy, period, phase } makes them slide and carry fighters.
// Fairness rules every arena follows: dynamic hazards stay idle for the first MAP_SAFE_START seconds of a round, and
// every strike is telegraphed by a flashing marker (which CPUs also steer away from) before it lands.

// ---------- shared toolkit ----------
const MAP_SAFE_START = 2.5;     // seconds after FIGHT! before any dynamic hazard may fire
const MAP_PARK = -1e5;          // parked solids/hazards live far outside the arena

const mapLive = () => G_STATE.roundT > MAP_SAFE_START && !G_STATE.ending;
// Stateless pseudo-random in [0, 1) for scenery that must look the same every frame.
const mapHash = k => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const mapWrap = (v, span) => ((v % span) + span) % span;

function mapPlace(o, r) { o.x = r.x; o.y = r.y; o.w = r.w; o.h = r.h; }
function mapPark(o) { o.x = MAP_PARK; o.y = -MAP_PARK; o.w = 1; o.h = 1; }
const mapParked = o => o.x === MAP_PARK;
const mapStoodOn = s => F.some(f => f.alive && (f.P[8].gs === s || f.P[10].gs === s));

// Vertical sky gradient over the arena down to `bottom`, a whole screen above it (the camera may rise past the arena
// top under a tall HUD) and a little past the sides (screen shake). When it paints the live arena it also records the
// top colour, which the renderer's void fill uses (mapSkyTop in 85-render).
function mapSky(c2, bottom, colors) {
  const g = c2.createLinearGradient(0, 0, 0, bottom);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  c2.fillStyle = g; c2.fillRect(-40, -H, W + 80, bottom + H);
  if (MAP && c2 === ctx) MAP.skyTopLive = colors[0];
}

// A soft radial glow (sun, moon, lamp).
function mapGlow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// Twinkling star field in the top `h` pixels.
function mapStars(ctx, t, n, h, seed = 0) {
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < n; k++) {
    const x = mapHash(k + seed) * W, y = mapHash(k * 3 + seed + 7) * h, s = mapHash(k * 7 + seed) < .15 ? 2.5 : 1.5;
    ctx.globalAlpha = .35 + .35 * Math.sin(t * (1 + mapHash(k) * 2) + k);
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

// Wrapping particle field (snow, ash, petals, sand, bubbles). o: { vx, vy, y0, y1, size, color, sway, alpha, seed, shape }
function mapParticles(ctx, t, n, o) {
  const y0 = o.y0 ?? -20, span = (o.y1 ?? H + 20) - y0, seed = o.seed || 0;
  ctx.fillStyle = o.color;
  for (let k = 0; k < n; k++) {
    const r1 = mapHash(k + seed), r2 = mapHash(k * 5 + seed + 3), sp = .6 + r2 * .8;
    const x = mapWrap(r1 * (W + 80) + (o.vx || 0) * sp * t + Math.sin(t * 1.3 + k) * (o.sway || 0), W + 80) - 40;
    const y = y0 + mapWrap(r2 * span + (o.vy || 0) * sp * t, span), s = (o.size || 3) * (.6 + r1 * .8);
    ctx.globalAlpha = (o.alpha ?? .8) * (.5 + .5 * r2);
    if (o.shape === 'circle') { ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
    else if (o.shape === 'ring') circle(ctx, x, y, s, null, o.color, 1.2);
    else if (o.shape === 'petal') { ctx.beginPath(); ctx.ellipse(x, y, s * 1.4, s * .7, t * 2 + k, 0, TAU); ctx.fill(); }
    else ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

// Layered hill/dune/mountain silhouette along the bottom: a sum of sines between yBase - amp and yBase.
function mapRidge(ctx, yBase, amp, freq, phase, color, bottom = H) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-40, bottom);
  for (let x = -40; x <= W + 40; x += 16) {
    const y = yBase - amp * (.55 + .3 * Math.sin(x * freq + phase) + .15 * Math.sin(x * freq * 2.7 + phase * 1.7));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 40, bottom); ctx.closePath(); ctx.fill();
}

// A platform slab with a neon top edge (the house style); fill/edge colours per arena.
function mapSlab(ctx, s, fill, edge, alpha = 1) {
  const h = s.oneWay ? Math.min(s.h, 14) : s.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill; ctx.fillRect(s.x, s.y, s.w, h);
  if (!s.oneWay) { ctx.strokeStyle = rgba(edge, .4); ctx.lineWidth = 2; ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, h - 2); }
  glowLine(ctx, s.x, s.y, s.x + s.w, s.y, edge, 3);
  if (s.move) for (const x of [s.x + 10, s.x + s.w - 10]) circle(ctx, x, s.y + 7, 3, edge);
  ctx.globalAlpha = 1;
}

// ---------- telegraphed traps (lightning, geysers, crushers) ----------
// Each trap is a pair of hazard slots: a harmless 'warn' marker (CPUs avoid it) and the 'hit' hazard that is placed
// only while the strike is live. Slots start parked; mapStepTraps moves them around. hit = hazard options for strikes.
function mapTrapSlots(id, count, hit) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ kind: 'warn', trap: id, idx: i, role: 'warn', dps: 0, x: MAP_PARK, y: -MAP_PARK, w: 1, h: 1, draw: mapDrawWarn });
    out.push(Object.assign({ kind: 'trap', tick: 1, draw() {} }, hit, { trap: id, idx: i, role: 'hit', x: MAP_PARK, y: -MAP_PARK, w: 1, h: 1 }));
  }
  return out;
}

// o: { every: [min, max] idle secs, first: [min, max], warn: secs, hit: secs, aim(m, slot) -> rect | null,
//      fire(m, rect, slot), hitRect(rect) -> rect }. Slot state: st ('idle'|'warn'|'hit'), tt (time left), max.
function mapStepTraps(m, id, dt, o) {
  m.hazards.forEach((w, i) => {
    if (w.trap !== id || w.role !== 'warn') return;
    const hit = m.hazards[i + 1];
    if (!w.st) { w.st = 'idle'; w.tt = rnd(...(o.first || o.every)); hit.ref = w; }
    if ((w.tt -= dt) > 0) return;
    if (w.st === 'idle') {
      const r = mapLive() && o.aim(m, w);
      if (!r) { w.tt = .3; return; }
      w.rect = r; mapPlace(w, r); w.avoid = true;
      w.st = 'warn'; w.tt = w.max = o.warn;
    } else if (w.st === 'warn') {
      mapPark(w); w.avoid = false;
      mapPlace(hit, o.hitRect ? o.hitRect(w.rect) : w.rect);
      w.st = 'hit'; w.tt = w.max = o.hit; w.hitAt = m.t;
      if (o.fire) o.fire(m, w.rect, w);
    } else {
      mapPark(hit);
      w.st = 'idle'; w.tt = rnd(...o.every); w.endAt = m.t;
    }
  });
}

// Generic warning marker: a tinted column that flashes faster as the strike nears, and a target on the ground.
function mapDrawWarn(ctx, hz, t) {
  if (mapParked(hz) || hz.st !== 'warn') return;
  const k = 1 - hz.tt / hz.max, on = SETTINGS.reduceFlash || Math.sin(t * (12 + k * 34)) > -.2, col = hz.warnColor || '#ffd84a';
  const bx = hz.x + hz.w / 2, by = hz.y + hz.h;
  ctx.fillStyle = rgba(col, .05 + .12 * k); ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
  if (on) {
    ctx.strokeStyle = rgba(col, .35 + .4 * k); ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60;
    ctx.strokeRect(hz.x, hz.y, hz.w, hz.h); ctx.setLineDash([]);
    glow(ctx, col, 16, () => {
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
      ctx.ellipse(bx, by - 3, hz.w * .5 * (1.3 - k * .3), 9, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = col; ctx.font = `28px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('!', bx, by - 22 - Math.sin(t * 10) * 4);
    });
  }
}

// ---------- wind gusts (storm, sandstorm) ----------
// o: { calm: [min, max], first: [min, max], warn, blow: [min, max], power (px/s²), base }. PHYS.windX follows it.
function mapStepWind(m, dt, o) {
  const g = m.gust || (m.gust = { st: 'calm', tt: rnd(...(o.first || o.calm)), dir: 1, k: 0, warn: o.warn });
  if ((g.tt -= dt) <= 0) {
    if (g.st === 'calm') {
      if (mapLive()) { g.st = 'warn'; g.tt = o.warn; g.dir = chance(.5) ? 1 : -1; } else g.tt = .3;
    } else if (g.st === 'warn') { g.st = 'blow'; g.tt = rnd(...o.blow); }
    else { g.st = 'calm'; g.tt = rnd(...o.calm); }
  }
  g.k += ((g.st === 'blow' ? 1 : 0) - g.k) * Math.min(1, dt * 2.5);     // gusts ramp in and out smoothly
  PHYS.windX = (o.base || 0) + g.dir * o.power * g.k;
}

// Gust telegraph and streaks: arrows blink across the top before a gust, wind lines race through during it.
function mapDrawWind(ctx, m, t, color) {
  const g = m.gust;
  if (!g) return;
  if (g.st === 'warn' && (SETTINGS.reduceFlash || Math.sin(t * 18) > -.3)) {
    ctx.save(); ctx.fillStyle = rgba(color, .75); ctx.font = `30px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
    ctx.fillText(g.dir > 0 ? 'GUST  ›››' : '‹‹‹  GUST', W / 2, 150); ctx.restore();
  }
  if (g.k < .05) return;
  ctx.strokeStyle = rgba(color, .35 * g.k); ctx.lineWidth = 2; ctx.beginPath();
  for (let k = 0; k < 26; k++) {
    const len = 60 + mapHash(k) * 90, y = 40 + mapHash(k + 9) * 600;
    const x = mapWrap(mapHash(k + 4) * W + g.dir * t * (900 + mapHash(k) * 600), W + len) - len;
    ctx.moveTo(x, y); ctx.lineTo(x + g.dir * len, y);
  }
  ctx.stroke();
}

// ---------- crumbling platforms (solids with crumble: true) ----------
// ok -> (someone stands on it) shake -> fall -> gone (parked) -> back (fades in once nobody is in the way) -> ok
function mapStepCrumble(m, dt) {
  for (const s of m.solids) {
    if (!s.crumble) continue;
    if (!s.cs) { s.cs = 'ok'; s.w0 = s.w; }
    if (s.cs === 'ok') { if (mapLive() && mapStoodOn(s)) { s.cs = 'shake'; s.ct = .8; } continue; }
    s.ct -= dt;
    if (s.cs === 'shake' && s.ct <= 0) {
      s.cs = 'fall'; s.vy = 0;
      for (const o of ORB_LIST) if (o.solid === s) o.solid = null;      // orbs stay hovering in place
      burst(s.x + s.w / 2, s.y + 8, '#d9b27a', 18, 260);
    } else if (s.cs === 'fall') {
      s.vy += 1700 * dt; s.dy = s.vy * dt; s.y += s.dy;
      if (s.y > H + 80) { s.cs = 'gone'; s.ct = 4; mapPark(s); s.w = 0; s.dx = s.dy = 0; }
    } else if (s.cs === 'gone' && s.ct <= 0) {
      const clear = !F.some(f => f.alive && f.P.some(p => p.x > s.x0 - 10 && p.x < s.x0 + s.w0 + 10 && p.y > s.y0 - 110 && p.y < s.y0 + 30));
      if (clear) { s.x = s.x0; s.y = s.y0; s.w = s.w0; s.h = 14; s.cs = 'back'; s.ct = .5; } else s.ct = .3;
    } else if (s.cs === 'back' && s.ct <= 0) s.cs = 'ok';
  }
}

// ---------- bounce pads ----------
// pads: [{ x, y (surface), w, v (launch speed px/s) }]. A grounded foot on a pad launches the fighter straight up.
function mapStepPads(m, pads, dt) {
  for (const pd of pads) pd.squash = Math.max(0, (pd.squash || 0) - dt * 4);
  for (const f of F) {
    if (!f.alive) continue;
    f.mem.padCd = Math.max(0, (f.mem.padCd || 0) - dt);
    if (f.mem.padCd > 0) continue;
    const pd = pads.find(pd => [f.P[8], f.P[10]].some(p => p.g && Math.abs(p.y - pd.y) < 3 && p.x > pd.x && p.x < pd.x + pd.w));
    if (!pd) continue;
    for (const p of f.P) p.oy = p.y + pd.v * DT;                // set upward velocity, keep sideways speed
    f.mem.padCd = .3; f.airJumps = 1 + (f.mem.extraJumps || 0); pd.squash = 1;
    burst(pd.x + pd.w / 2, pd.y, pd.color || '#ff5ad1', 12, 300);
    sfx('mapBoing', .8);
  }
}

// ---------- gravity zones ----------
// zones: [{ x, y, w, h, rise }]. Airborne fighters inside lose their weight and drift slowly upward (rise = net lift in
// g); motion is damped so they float. Standing fighters are left alone, so you jump to start floating.
function mapStepZeroG(zones) {
  const G = PHYS.gravity;
  for (const f of F) {
    if (!f.alive || f.grounded) continue;
    const hip = f.P[2], z = zones.find(z => inRect(hip.x, hip.y, z));
    if (!z) continue;
    const cancel = G * (1 + mapExtraGrav(f) - (z.rise ?? .12));
    for (const p of f.P) p.fy -= cancel + vy(p) * 1.2;
    f.airJumps = Math.max(f.airJumps, 1);     // you can always push off again while floating
  }
}

// The extra airborne gravity driveBody will add this step (mirrors its rule), so zones can cancel it exactly.
function mapExtraGrav(f) {
  const head = f.P[0], hip = f.P[2];
  if (f.status.freeze || head.y >= hip.y - 20 * f.scale) return 0;
  if (vy(hip) > 0) return TUNE.fallGrav;
  return f.rising && !f.inp.jumpHeld ? TUNE.cutGrav : TUNE.riseGrav;
}

// Extra synthesized sounds for arenas (80-audio loads after this slice, so register on boot).
on('boot', () => {
  if (typeof defSfx !== 'function') return;
  defSfx('mapThunder', v => { noise(.9, 120, .8 * v, 'lowpass'); noise(.25, 2400, .3 * v, 'highpass'); tone(80, 30, .7, 'sine', .4 * v); });
  defSfx('mapCrush', v => { noise(.35, 180, .9 * v, 'lowpass'); tone(140, 40, .3, 'square', .25 * v); });
  defSfx('mapGeyser', v => { noise(.8, 400, .5 * v, 'lowpass'); tone(200, 60, .6, 'sawtooth', .08 * v); });
  defSfx('mapBoing', v => { tone(180, 720, .22, 'sine', .22 * v); tone(360, 1100, .16, 'triangle', .06 * v, .03); });
  defSfx('mapCrumble', v => noise(.5, 600, .35 * v, 'lowpass'));
});

// ====================================================================================================================
defMap('neon', {
  name: 'Neon City', desc: 'The classic rooftop arena. Three ledges, lots of room, no tricks.', order: 10,
  floor: 650, skyTop: '#0a0b1d',   // what shows above the arena (drawBg paints its own sky, not with mapSky)
  solids: [{ x: 150, y: 470, w: 250 }, { x: 880, y: 470, w: 250 }, { x: 515, y: 315, w: 250 }],
  spawns: [[330, 650], [950, 650], [275, 470], [1005, 470]],
  skyline: Array.from({ length: 34 }, (_, k) => ({ x: k * 40 - 20, w: rnd(30, 60), h: rnd(40, 170), seed: Math.random() * 1000 })),
  drawBg(ctx, t) {
    const sky = ctx.createLinearGradient(0, 0, 0, this.floor);
    sky.addColorStop(0, '#0a0b1d'); sky.addColorStop(1, '#251744');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, this.floor);
    const sun = ctx.createRadialGradient(W / 2, 430, 20, W / 2, 430, 260);
    sun.addColorStop(0, 'rgba(255,120,80,.55)'); sun.addColorStop(.45, 'rgba(255,60,140,.18)'); sun.addColorStop(1, 'rgba(255,60,140,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, this.floor);
    for (const b of this.skyline) {
      ctx.fillStyle = '#120f26'; ctx.fillRect(b.x, this.floor - b.h, b.w, b.h);
      ctx.fillStyle = 'rgba(255,200,120,.22)';      // a few lit windows that flicker slowly
      for (let k = 0; k < 4; k++) {
        const wy = this.floor - b.h + 12 + k * 22;
        if (wy < this.floor - 8 && Math.sin(b.seed + k * 7.3 + t * .3) > .35) ctx.fillRect(b.x + 6 + (k % 2) * 14, wy, 6, 8);
      }
    }
    drawGridFloor(ctx, this.floor, '#0c0d1a', 'rgba(120,100,255,.22)', '#8b7dff');
  },
});

defMap('dojo', {
  name: 'Dojo Courtyard', desc: 'Open boards, no ledges, no power-ups. A pure duel of footwork and timing.', order: 15,
  floor: 640, orbs: false,
  spawns: [[420, 640], [860, 640], [270, 640], [1010, 640]],
  palette: { sky1: '#1b0b30', sky2: '#ff6a5a', ground: '#2a1410', line: '#ff7ab8', accent: '#ffcf6b', solid: '#3a1c14' },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#12082a', '#4a1450', '#c23a5a', '#ff9a5a']);
    // Banded setting sun.
    ctx.save(); ctx.beginPath(); ctx.arc(640, 470, 170, 0, TAU); ctx.clip();
    const sun = ctx.createLinearGradient(0, 300, 0, 640); sun.addColorStop(0, '#ffe08a'); sun.addColorStop(1, '#ff4a7a');
    ctx.fillStyle = sun; ctx.fillRect(470, 300, 340, 340);
    ctx.fillStyle = '#c23a5a';
    for (let k = 0; k < 7; k++) ctx.fillRect(470, 500 + k * 20 + ((t * 8) % 20), 340, 3 + k);
    ctx.restore();
    mapRidge(ctx, 560, 120, .006, 1.2, '#3a0f3a', fl);
    mapRidge(ctx, 600, 70, .011, 4, '#2a0a2c', fl);
    this.drawTorii(ctx, 640, fl);
    this.drawPagoda(ctx, 150, fl, 1); this.drawPagoda(ctx, 1130, fl, .8);
    for (let k = 0; k < 7; k++) this.drawLantern(ctx, 120 + k * 173, 40 + (k % 2) * 26, t, k);
    // Wooden deck.
    ctx.fillStyle = '#2a1410'; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
    ctx.strokeStyle = 'rgba(255,170,120,.12)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let y = fl + 14; y < H; y += 16) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    for (let k = 0; k < 18; k++) { const x = (k * 97) % W, y = fl + 14 + (k % 5) * 16; ctx.moveTo(x, y); ctx.lineTo(x, y + 16); }
    ctx.stroke();
    glowLine(ctx, 0, fl, W, fl, '#ff7ab8', 3);
  },
  drawTorii(ctx, x, fl) {
    ctx.fillStyle = '#1a0618';
    ctx.fillRect(x - 150, fl - 300, 22, 300); ctx.fillRect(x + 128, fl - 300, 22, 300);
    poly(ctx, [[x - 205, fl - 330], [x + 205, fl - 330], [x + 190, fl - 300], [x - 190, fl - 300]], '#1a0618');
    ctx.fillRect(x - 170, fl - 270, 340, 16);
  },
  drawPagoda(ctx, x, fl, s) {
    ctx.fillStyle = '#1e0820';
    for (let k = 0; k < 4; k++) {
      const y = fl - 70 * s - k * 62 * s, w = (130 - k * 22) * s;
      ctx.fillRect(x - w * .35, y, w * .7, 62 * s);
      poly(ctx, [[x - w * .75, y + 4 * s], [x + w * .75, y + 4 * s], [x + w * .4, y - 18 * s], [x - w * .4, y - 18 * s]], '#1e0820');
    }
    ctx.fillRect(x - 3, fl - 70 * s - 4 * 62 * s - 40 * s, 6, 40 * s);
  },
  drawLantern(ctx, x, y, t, k) {
    const sw = Math.sin(t * 1.4 + k) * .12;
    ctx.save(); ctx.translate(x, 0); ctx.rotate(sw);
    lineXY(ctx, 0, -10, 0, y, 'rgba(40,10,30,.9)', 2);
    mapGlow(ctx, 0, y + 18, 60, '#ffb35a', .35);
    glow(ctx, '#ff8a4a', 18, () => { ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.ellipse(0, y + 18, 13, 18, 0, 0, TAU); ctx.fill(); });
    ctx.fillStyle = '#2a0a1a'; ctx.fillRect(-7, y - 1, 14, 4); ctx.fillRect(-7, y + 34, 14, 4);
    ctx.restore();
  },
  drawFg(ctx, t) {
    mapParticles(ctx, t, 34, { vx: 40, vy: 55, sway: 30, size: 4, color: '#ffb3d9', alpha: .8, shape: 'petal', seed: 3 });
  },
});

defMap('foundry', {
  name: 'Molten Foundry', desc: 'A lava pit splits the floor. A sliding platform crosses above it.', order: 20,
  gravity: 2150, floor: 650,
  palette: { sky1: '#120604', sky2: '#3d140c', ground: '#1a0d0a', line: '#ff7a3a', accent: '#ffb347', solid: '#2b1510' },
  solids: [
    { x: 80, y: 455, w: 210 }, { x: 990, y: 455, w: 210 },
    { x: 545, y: 470, w: 190, move: { dx: 230, dy: 0, period: 5.5 } },
    { x: 560, y: 290, w: 160, move: { dx: 0, dy: 60, period: 3.6 } },
  ],
  hazards: [{ kind: 'lava', x: 480, y: 626, w: 320, h: 60, dps: 16, status: ['burn', 2, 1], launch: 1100, color: '#ff6a2a' }],
  spawns: [[280, 650], [1000, 650], [185, 455], [1095, 455]],
  drawBg(ctx, t) {
    const p = this.palette;
    mapSky(ctx, this.floor, [p.sky1, p.sky2]);
    drawGear(ctx, 200, 210, 120, 14, t * .15, '#24100b');
    drawGear(ctx, 1090, 160, 90, 11, -t * .2, '#24100b');
    drawGear(ctx, 960, 330, 55, 9, t * .33, '#2c140d');
    ctx.fillStyle = '#1d0c08';                                  // chimney stacks
    for (const [x, w, h] of [[360, 70, 330], [450, 40, 260], [820, 60, 300], [900, 36, 220]]) ctx.fillRect(x, this.floor - h, w, h);
    const heat = ctx.createRadialGradient(640, this.floor, 20, 640, this.floor, 420);
    heat.addColorStop(0, 'rgba(255,110,40,.42)'); heat.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = heat; ctx.fillRect(0, 0, W, this.floor);
    for (let k = 0; k < 26; k++) {                              // embers drifting up from the pit
      const life = (t * .22 + k * .137) % 1, x = 480 + ((k * 97) % 320) + Math.sin(t + k) * 18, y = this.floor - life * 520;
      ctx.globalAlpha = (1 - life) * .8; ctx.fillStyle = k % 3 ? '#ff8a3a' : '#ffd36b'; ctx.fillRect(x, y, 3, 3);
    }
    ctx.globalAlpha = 1;
    drawGridFloor(ctx, this.floor, p.ground, 'rgba(255,120,60,.16)', p.line);
  },
});

// A simple cog silhouette for industrial backdrops.
function drawGear(ctx, x, y, r, teeth, ang, color, rim = 'rgba(255,120,60,.10)') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color; ctx.beginPath();
  for (let k = 0; k < teeth * 2; k++) {
    const a = k / (teeth * 2) * TAU, rr = k % 2 ? r : r * 1.14;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  circle(ctx, 0, 0, r * .55, null, rim, 4);
  circle(ctx, 0, 0, r * .16, rim);
  ctx.restore();
}

defMap('frost', {
  name: 'Frost Peak', desc: 'The ice floor is slick: stopping and turning take longer. Snowy ledges give grip.', order: 40,
  floor: 650, friction: .015,
  palette: { sky1: '#06122a', sky2: '#2a4a7a', ground: '#bfe6ff', line: '#9fe8ff', accent: '#ffffff', solid: '#e8f6ff' },
  solids: [{ x: 120, y: 470, w: 230 }, { x: 930, y: 470, w: 230 }, { x: 540, y: 320, w: 200 }],
  spawns: [[340, 650], [940, 650], [235, 470], [1045, 470]],
  onStep() {
    // Bare ice (the floor) is slippery; snow-covered ledges give normal grip.
    for (const f of F) f.grip = f.grounded && !(f.P[8].gs || f.P[10].gs) ? .2 : 3;   // ledges: extra grip makes up for the slick feet
  },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#030818', '#0b1e44', '#2a4a7a']);
    mapStars(ctx, t, 70, 300, 11);
    // Aurora ribbons.
    for (let b = 0; b < 3; b++) {
      ctx.fillStyle = b === 1 ? `rgba(120,255,200,${.07 + .03 * Math.sin(t * .8)})` : 'rgba(90,220,255,.05)';
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 90 + b * 40 + Math.sin(x * .006 + t * .4 + b) * 40 + Math.sin(x * .017 - t * .7) * 14);
      for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, 160 + b * 40 + Math.sin(x * .006 + t * .4 + b + .6) * 40);
      ctx.closePath(); ctx.fill();
    }
    this.drawMountains(ctx, fl);
    // Glassy ice floor with reflections and cracks.
    const ice = ctx.createLinearGradient(0, fl, 0, H);
    ice.addColorStop(0, '#9fd8f5'); ice.addColorStop(.25, '#4a86b8'); ice.addColorStop(1, '#183a64');
    ctx.fillStyle = ice; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    for (let k = 0; k < 6; k++) { const x = mapWrap(k * 230 + t * 12, W + 200) - 100; poly(ctx, [[x, fl + 6], [x + 60, fl + 6], [x + 20, H], [x - 40, H]], 'rgba(255,255,255,.07)'); }
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (const [x, l] of [[210, 40], [520, 60], [760, 35], [1050, 55]]) { ctx.moveTo(x, fl + 8); ctx.lineTo(x + l * .6, fl + 22); ctx.lineTo(x + l, fl + 18); ctx.moveTo(x + l * .6, fl + 22); ctx.lineTo(x + l * .5, fl + 40); }
    ctx.stroke();
    glowLine(ctx, 0, fl, W, fl, '#bff4ff', 3);
  },
  drawMountains(ctx, fl) {
    const peaks = (pts, fill, snow) => {
      poly(ctx, [[-40, fl], ...pts, [W + 40, fl]], fill);
      for (const [x, y] of pts) if (y < fl - 150) poly(ctx, [[x - 40, y + 46], [x, y], [x + 40, y + 46], [x + 14, y + 36], [x - 10, y + 50]], snow);
    };
    peaks([[90, 330], [260, 420], [420, 250], [600, 400], [760, 300], [930, 420], [1100, 270], [1240, 380]], '#1a2c52', 'rgba(230,245,255,.75)');
    peaks([[0, 500], [180, 440], [380, 520], [560, 450], [800, 530], [1000, 440], [1280, 500]], '#122140', 'rgba(230,245,255,.5)');
    ctx.fillStyle = '#0c1830';                                     // pine silhouettes
    for (let k = 0; k < 16; k++) {
      const x = 30 + k * 82 + (k % 3) * 11, h = 50 + (k * 37) % 40;
      poly(ctx, [[x - h * .3, fl], [x, fl - h], [x + h * .3, fl]], '#0c1830');
    }
  },
  drawSolid(ctx, s) {
    mapSlab(ctx, s, '#2c4a72', '#bff4ff');
    ctx.fillStyle = '#f2fbff';                                     // snow cap with drifts and icicles
    ctx.beginPath(); ctx.moveTo(s.x - 4, s.y + 2);
    for (let x = 0; x <= s.w + 8; x += 16) ctx.lineTo(s.x - 4 + x, s.y - 4 - Math.sin(x * .2 + s.x) * 3);
    ctx.lineTo(s.x + s.w + 4, s.y + 4); ctx.lineTo(s.x - 4, s.y + 4); ctx.closePath(); ctx.fill();
    for (let x = s.x + 10; x < s.x + s.w - 6; x += 23) poly(ctx, [[x, s.y + 14], [x + 7, s.y + 14], [x + 3, s.y + 26 + (x % 3) * 4]], 'rgba(200,240,255,.8)');
  },
  drawFg(ctx, t) {
    mapParticles(ctx, t, 70, { vx: -30, vy: 70, sway: 24, size: 3, color: '#ffffff', alpha: .85, shape: 'circle', seed: 21 });
  },
});

defMap('moon', {
  name: 'Moon Base', desc: 'Low gravity: huge floaty jumps, long knockbacks, and lazy grenades.', order: 50,
  floor: 650, gravity: 1350,
  palette: { sky1: '#000006', sky2: '#0a0a1e', ground: '#6a6a7a', line: '#b6c3ff', accent: '#5ef2ff', solid: '#3a3d55' },
  solids: [{ x: 110, y: 410, w: 230 }, { x: 940, y: 410, w: 230 }, { x: 520, y: 230, w: 240 }, { x: 570, y: 500, w: 140, move: { dx: 0, dy: 60, period: 6 } }],
  spawns: [[330, 650], [950, 650], [225, 410], [1055, 410]],
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#000004', '#05051a', '#0e0e2a']);
    mapStars(ctx, t, 160, fl - 60, 5);
    // Earth hanging in the sky, slowly turning.
    const ex = 1010, ey = 150, er = 70;
    mapGlow(ctx, ex, ey, er * 1.8, '#5ab0ff', .25);
    ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.clip();
    ctx.fillStyle = '#1f5fbf'; ctx.fillRect(ex - er, ey - er, er * 2, er * 2);
    ctx.fillStyle = '#3fae5a';
    for (let k = 0; k < 5; k++) { const x = ex - er + mapWrap(k * 61 + t * 6, er * 3) - er * .5; ctx.beginPath(); ctx.ellipse(x, ey - 30 + k * 15, 24, 11, k, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let k = 0; k < 4; k++) { const x = ex - er + mapWrap(k * 47 + t * 10, er * 3) - er * .5; ctx.fillRect(x, ey - 50 + k * 28, 50, 5); }
    ctx.fillStyle = 'rgba(0,0,20,.55)'; ctx.beginPath(); ctx.arc(ex + 30, ey + 10, er, 0, TAU); ctx.fill();   // night side
    ctx.restore();
    // Distant crater rim and the base dome.
    mapRidge(ctx, fl - 20, 70, .008, 2, '#2a2a3a', fl);
    this.drawDome(ctx, 230, fl, t);
    ctx.fillStyle = '#1e1e2c'; ctx.fillRect(820, fl - 160, 8, 160);   // antenna mast with blinking light
    circle(ctx, 824, fl - 166, 5, Math.sin(t * 4) > 0 ? '#ff4a6a' : '#401018');
    // Regolith floor with craters.
    const g = ctx.createLinearGradient(0, fl, 0, H); g.addColorStop(0, '#8a8a9a'); g.addColorStop(1, '#3a3a4a');
    ctx.fillStyle = g; ctx.fillRect(-40, fl, W + 80, H - fl + 40);
    for (const [x, y, r] of [[160, 670, 30], [480, 695, 22], [760, 668, 40], [1110, 690, 26], [980, 708, 14]]) {
      ctx.fillStyle = 'rgba(30,30,45,.45)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .3, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 2, r, r * .3, 0, 0, Math.PI); ctx.stroke();
    }
    glowLine(ctx, 0, fl, W, fl, '#b6c3ff', 2);
  },
  drawDome(ctx, x, fl, t) {
    ctx.fillStyle = 'rgba(120,200,255,.10)'; ctx.beginPath(); ctx.arc(x, fl, 120, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(150,220,255,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, fl, 120, Math.PI, 0); ctx.stroke();
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x, fl, 120 * k / 4, 120, 0, Math.PI, 0); ctx.stroke(); }
    for (let k = 0; k < 5; k++) circle(ctx, x - 80 + k * 40, fl - 12, 3, Math.sin(t * 3 + k) > 0 ? '#5ef2ff' : '#123040');
  },
  drawSolid(ctx, s) {
    mapSlab(ctx, s, '#2a2d44', s.move ? '#5ef2ff' : '#b6c3ff');
    ctx.fillStyle = '#5ef2ff';
    for (let x = s.x + 14; x < s.x + s.w - 8; x += 28) ctx.fillRect(x, s.y + 6, 10, 2);
  },
});

defMap('sky', {
  name: 'Sky Islands', desc: 'Floating isles over a bottomless sky. Knock them off the edge for a ring-out.', order: 60,
  floor: null, walls: false, gravity: 2100,
  palette: { sky1: '#0b1a3a', sky2: '#ff8ab8', ground: '#2a6a4a', line: '#7dffb0', accent: '#ffd84a', solid: '#3a2a3a' },
  solids: [
    { x: 80, y: 520, w: 340, h: 70, oneWay: false },
    { x: 860, y: 520, w: 340, h: 70, oneWay: false },
    { x: 560, y: 440, w: 160, move: { dx: 0, dy: 70, period: 5 } },
    { x: 510, y: 250, w: 260 },
  ],
  spawns: [[260, 520], [1020, 520], [150, 520], [1130, 520]],
  drawBg(ctx, t) {
    mapSky(ctx, H, ['#0b1a3a', '#3a2a6a', '#c4508a', '#ffb07a']);
    mapGlow(ctx, 640, 640, 420, '#ffd08a', .35);
    for (let layer = 0; layer < 3; layer++) this.drawClouds(ctx, t, layer);
    // Distant floating isles.
    for (const [x, y, s] of [[200, 210, .5], [1080, 170, .4], [760, 120, .3]]) this.drawIsle(ctx, x + Math.sin(t * .3 + x) * 8, y, 120 * s, 'rgba(60,40,90,.55)');
  },
  drawClouds(ctx, t, layer) {
    const y = 330 + layer * 120, sp = 8 + layer * 10, a = .10 + layer * .06;
    ctx.fillStyle = `rgba(255,220,240,${a})`;
    for (let k = 0; k < 7; k++) {
      const x = mapWrap(k * 230 + t * sp + layer * 90, W + 300) - 150;
      for (let b = 0; b < 4; b++) { ctx.beginPath(); ctx.ellipse(x + b * 36, y + Math.sin(b * 2) * 8, 50, 22, 0, 0, TAU); ctx.fill(); }
    }
  },
  drawIsle(ctx, x, y, w, fill) {
    poly(ctx, [[x - w, y], [x + w, y], [x + w * .5, y + w * .5], [x + w * .1, y + w * .9], [x - w * .4, y + w * .5]], fill);
  },
  drawSolid(ctx, s, t) {
    if (!s.oneWay) {                                       // big rocky island with grass, roots and a waterfall
      const cx = s.x + s.w / 2;
      poly(ctx, [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w - 30, s.y + s.h + 30], [cx + 40, s.y + s.h + 110], [cx - 50, s.y + s.h + 90], [s.x + 26, s.y + s.h + 20]], '#3a2a44', '#5a4064', 2);
      ctx.fillStyle = '#2a6a4a'; ctx.fillRect(s.x, s.y, s.w, 12);
      glowLine(ctx, s.x, s.y, s.x + s.w, s.y, '#7dffb0', 3);
      ctx.strokeStyle = 'rgba(120,220,160,.5)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < 5; k++) { const x = s.x + 40 + k * 60; ctx.moveTo(x, s.y + 14); ctx.quadraticCurveTo(x + 8, s.y + 40, x - 4, s.y + 60 + (k % 2) * 20); }
      ctx.stroke();
      const wx = s.x < W / 2 ? s.x + 14 : s.x + s.w - 24;
      ctx.fillStyle = 'rgba(140,220,255,.35)'; ctx.fillRect(wx, s.y + 6, 10, 240);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let k = 0; k < 6; k++) ctx.fillRect(wx + 2, s.y + 6 + mapWrap(t * 260 + k * 40, 240), 6, 14);
    } else {                                               // cloud platform
      ctx.fillStyle = 'rgba(255,240,250,.9)';
      for (let x = s.x + 10; x < s.x + s.w; x += 26) { ctx.beginPath(); ctx.arc(x, s.y + 6, 14, 0, TAU); ctx.fill(); }
      glowLine(ctx, s.x, s.y, s.x + s.w, s.y, s.move ? '#ffd84a' : '#ffffff', 2);
    }
  },
  drawFg(ctx, t) {
    ctx.fillStyle = 'rgba(255,230,245,.18)';
    for (let k = 0; k < 6; k++) {
      const x = mapWrap(k * 260 - t * 30, W + 300) - 150;
      ctx.beginPath(); ctx.ellipse(x, 690 + (k % 2) * 16, 110, 30, 0, 0, TAU); ctx.fill();
    }
  },
});
