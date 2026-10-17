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
// Shorthands shared by every arena drawing: a stroke colour and width on a fresh path, a filled rect, a fill colour
// on a fresh path, a line segment added to the path, a platform's top edge.
function mapPen(c, col, w) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); }
function mapRect(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function mapBrush(c, col) { c.fillStyle = col; c.beginPath(); }
function mapSeg(c, x1, y1, x2, y2) { c.moveTo(x1, y1); c.lineTo(x2, y2); }
const mapEdge = (c, s, col, w) => glowLine(c, s.x, s.y, s.x + s.w, s.y, col, w);

function mapPlace(o, r) { o.x = r.x; o.y = r.y; o.w = r.w; o.h = r.h; }
function mapPark(o) { o.x = MAP_PARK; o.y = -MAP_PARK; o.w = 1; o.h = 1; }
const mapParked = o => o.x === MAP_PARK;
const mapStoodOn = s => F.some(f => f.alive && (f.P[8].gs === s || f.P[10].gs === s));

// Vertical sky gradient over the arena down to `bottom`, a whole screen above it (the camera may rise past the arena
// top under a tall HUD) and a little past the sides (screen shake). When it paints the live arena it also records the
// top colour, which the renderer's void fill uses (mapSkyTop in 85-render).
function mapSky(c2, bottom, colors) {
  mapRect(c2, colors[0], -40, -H, W + 80, H + 2);
  mapVGrad(c2, -40, 0, W + 80, bottom, colors);
  if (MAP && c2 === ctx) MAP.skyTopLive = colors[0];
}

// A soft radial glow (sun, moon, lamp).
function mapGlow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
  mapRect(ctx, g, x - r, y - r, r * 2, r * 2);
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

// Wrapping particle field (snow, ash, petals, sand, bubbles, embers). o: { vx, vy, x0, x1, y0, y1, size, color, sway,
// alpha, seed, shape }. Drawn in three alpha groups of one path each: three fills instead of one per speck.
function mapParticles(ctx, t, n, o) {
  const x0 = o.x0 ?? -40, xs = (o.x1 ?? W + 40) - x0, y0 = o.y0 ?? -20, span = (o.y1 ?? H + 20) - y0, seed = o.seed || 0, sh = o.shape;
  for (let g = 0; g < 3; g++) {
    ctx.beginPath();
    for (let k = g; k < n; k += 3) {
      const r1 = mapHash(k + seed), r2 = mapHash(k * 5 + seed + 3), sp = .6 + r2 * .8;
      const x = x0 + mapWrap(r1 * xs + (o.vx || 0) * sp * t + Math.sin(t * 1.3 + k) * (o.sway || 0), xs);
      const y = y0 + mapWrap(r2 * span + (o.vy || 0) * sp * t, span), s = (o.size || 3) * (.6 + r1 * .8), a = t * 2 + k;
      if (sh === 'petal') { ctx.moveTo(x + Math.cos(a) * s * 1.4, y + Math.sin(a) * s * 1.4); ctx.ellipse(x, y, s * 1.4, s * .7, a, 0, TAU); }
      else if (sh) { ctx.moveTo(x + s, y); ctx.arc(x, y, s, 0, TAU); }
      else ctx.rect(x, y, s, s);
    }
    ctx.globalAlpha = (o.alpha ?? .8) * (.5 + g * .25);
    if (sh === 'ring') { ctx.strokeStyle = o.color; ctx.lineWidth = 1.2; ctx.stroke(); } else { ctx.fillStyle = o.color; ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// Layered hill/dune/mountain silhouette along the bottom: a sum of sines between yBase - amp and yBase.
function mapRidge(ctx, yBase, amp, freq, phase, color, bottom = H) {
  mapBrush(ctx, color); ctx.moveTo(-40, bottom);
  for (let x = -40; x <= W + 40; x += 16) {
    const y = yBase - amp * (.55 + .3 * Math.sin(x * freq + phase) + .15 * Math.sin(x * freq * 2.7 + phase * 1.7));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 40, bottom); ctx.closePath(); ctx.fill();
}

// A platform slab with a neon top edge (the house style); fill/edge colours per arena. Shaded like a block (a lit top
// fading to a dark base) over a soft contact shadow.
function mapSlab(ctx, s, fill, edge, alpha = 1) {
  const st = artNow();
  if (st.slab) return st.slab(artRaw(ctx), s, fill, edge, alpha);   // ink, paper or chalk (59-styles)
  const h = s.oneWay ? Math.min(s.h, 14) : s.h;
  ctx.globalAlpha = alpha;
  mapVGrad(ctx, s.x + 6, s.y + h, s.w - 12, 14, ['rgba(0,0,0,.3)', 'rgba(0,0,0,0)']);
  mapRect(ctx, fill, s.x, s.y, s.w, h);
  mapVGrad(ctx, s.x, s.y, s.w, h, [rgba(edge, .22), 'rgba(0,0,0,0)', 'rgba(0,0,0,.34)']);
  if (!s.oneWay) { ctx.strokeStyle = rgba(edge, .4); ctx.lineWidth = 2; ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, h - 2); }
  mapEdge(ctx, s, edge, 3);
  if (s.move) for (const x of [s.x + 10, s.x + s.w - 10]) circle(ctx, x, s.y + 7, 3, edge);
  ctx.globalAlpha = 1;
}

// Big warning text centred at (x, y); its glow goes through glow(), so quality tiers scale it.
function mapSign(ctx, text, x, y, size, col, blur = 0) {
  ctx.save(); ctx.fillStyle = col; ctx.font = `${size}px ${FONT_DISPLAY}`; ctx.textAlign = 'center';
  glow(ctx, col, blur, () => ctx.fillText(text, x, y)); ctx.restore();
}

// ---------- depth and atmosphere ----------
// Vertical gradients (stops evenly spaced) from a cached 1x64 strip: a tenth of a gradient fill's cost on a software
// canvas. Style proxies and styled arenas' neon look (which styles are timed against) keep real gradients.
const MAP_STRIPS = new Map();
function mapGrad(c2, y0, y1, colors) {
  const g = c2.createLinearGradient(0, y0, 0, y1);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  return g;
}
function mapVGrad(c2, x, y, w, h, colors) {
  let s = artRaw(c2) === c2 && !(MAP && MAP.style) && MAP_STRIPS.get(colors + '');
  if (s === undefined && (s = artCanvas(1, 64))) { const g = s.getContext('2d'); mapRect(g, mapGrad(g, 0, 64, colors), 0, 0, 1, 64); MAP_STRIPS.set(colors + '', s); }
  if (s) c2.drawImage(s, x, y, w, h); else mapRect(c2, mapGrad(c2, y, y + h, colors), x, y, w, h);
}

// The ground (to 40 px under the arena, for shake): fill (colour or stops), deco(), a depth falloff, a lit lip, the edge.
function mapGround(c2, fl, fill, edge, w = 3, deco) {
  const h = H + 40 - fl;
  if (fill.map) mapVGrad(c2, -40, fl, W + 80, h, fill); else mapRect(c2, fill, -40, fl, W + 80, h);
  if (deco) deco();
  mapVGrad(c2, -40, fl, W + 80, h, ['rgba(0,0,0,0)', 'rgba(0,0,0,.42)']);
  if (edge) { mapVGrad(c2, -40, fl, W + 80, 20, [rgba(edge, .3), rgba(edge, 0)]); glowLine(c2, 0, fl, W, fl, edge, w); }
}

// Parallax: decoration at depth d shifts by d of the camera's offset (half as much vertically); thumbnails draw flat.
// With m, a static draw() is cached once in 59's backdrop canvas. World-lock rule: never for what fighters touch or read.
function mapFar(c2, d, draw, m) {
  if (c2 !== ctx && !c2.live) return draw(c2);
  c2.save(); c2.translate((CAM.x - W / 2) * d, (CAM.y - H / 2) * d / 2);
  const img = m && artRaw(c2) === c2 && artBackdrop({ key: m.key + '~', art: { bg: draw } }, STYLES.neon);
  if (img) c2.drawImage(img, ART_BOX.x, ART_BOX.y, ART_BOX.w, ART_BOX.h); else draw(c2);
  c2.restore();
}
// Haze between depth layers: col thickening to alpha a at the horizon y.
const mapHaze = (c2, y, h, col, a) => mapVGrad(c2, -40, y - h, W + 80, h + 40, [rgba(col, 0), rgba(col, a)]);

// A banded sun (stops top to bottom); t slides the bands down (0 keeps them still).
function mapSun(c2, x, y, r, stops, band, t) {
  c2.save(); c2.beginPath(); c2.arc(x, y, r, 0, TAU); c2.clip();
  mapVGrad(c2, x - r, y - r, r * 2, r * 2, stops);
  c2.fillStyle = band;
  for (let k = 0; k < 7; k++) c2.fillRect(x - r, y + r * (.18 + k * .118) + (t * 8) % (r * .118), r * 2, 3 + k);
  c2.restore();
}

// A seeded skyline on base (towers reach 40 px below it); with win, windows that switch slowly with t.
function mapSkyline(c2, base, n, seed, hMax, body, win, t = 0) {
  const step = (W + 80) / n;
  for (let k = 0; k < n; k++) {
    const x = k * step - 40, w = step * (.6 + .35 * mapHash(k + seed)), top = base - hMax * (.3 + .7 * mapHash(k * 3 + seed));
    mapRect(c2, body, x, top, w, base - top + 40);
    if (win) for (let y = top + 12, i = k * 40; y < base - 12; y += 22) for (let wx = x + 5; wx < x + w - 9; wx += 13) if (Math.sin(seed + i++ * 7.3 + t * .3) > .55) mapRect(c2, win, wx, y, 5, 8);
  }
}

// Dense soft decoration drawn at quarter resolution into 58's layer canvas, then laid over rows y0..y1 in one stretched
// draw: overlapping puffs cost a sixteenth, and they are blurry anyway. Layers in it still get their parallax (live).
function mapSoft(c2, y0, y1, draw) {
  if (c2 !== ctx || artRaw(c2) !== c2 || typeof document !== 'object') return draw(c2);
  const L = worldLayer(), g = L.g, k = WORLD_SHADE_K, sy = (y0 + 40) * k, sh = (y1 - y0) * k;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, sy - 1, L.width, sh + 2);
  g.setTransform(k, 0, 0, k, 40 * k, 40 * k); g.live = 1;
  draw(g);
  c2.drawImage(L, 0, sy, L.width, sh, -40, y0, 1360, y1 - y0);
}
// A soft puff: 84's light sprite stretched to an ellipse, for clouds, smoke and fog with soft edges.
function mapPuff(c2, x, y, rx, ry, col, a) {
  const s = postfxSprite(col);
  if (s && a > 0) { c2.globalAlpha = Math.min(1, a); c2.drawImage(s, x - rx, y - ry, rx * 2, ry * 2); c2.globalAlpha = 1; }
}
// A drifting, wrapping row of n clouds of `puffs` puffs. o: { y, n, sp, rx, ry, col, a, puffs, seed }
function mapClouds(c2, t, o) {
  for (let k = 0, p = o.puffs || 3; k < o.n * p; k++) {
    const c = k / p | 0, x = mapWrap(mapHash(c + o.seed) * (W + 400) + t * o.sp, W + 400) - 200 + (k % p - (p - 1) / 2) * o.rx * .9;
    mapPuff(c2, x, o.y + (mapHash(c * 3 + o.seed) - .5) * 26 + Math.sin(k * 2) * o.ry * .3, o.rx * (1 - k % 2 * .25), o.ry, o.col, o.a);
  }
}
// A plume rising from (x, y): puffs grow, drift and fade. o: { n, rate, r0, r1, h, sway, drift, col, a }
function mapSmoke(c2, t, x, y, o) {
  for (let k = 0; k < o.n; k++) {
    const u = mapWrap(t * o.rate + k / o.n, 1), r = o.r0 + u * o.r1;
    mapPuff(c2, x + Math.sin(k * 2.3 + t * .3) * o.sway * u + u * (o.drift || 0), y - u * o.h, r, r, o.col, Math.min(1, u * 6) * (1 - u) * o.a);
  }
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

// Generic warning marker: a tinted column that flashes faster as the strike nears, and a target on the ground. Art
// styles draw it unmapped in their own warning colour, so it reads as clearly as on neon.
function mapDrawWarn(c2, hz, t) {
  if (mapParked(hz) || hz.st !== 'warn') return;
  const st = artNow(), ctx = artRaw(c2), k = 1 - hz.tt / hz.max, on = SETTINGS.reduceFlash || Math.sin(t * (12 + k * 34)) > -.2;
  const col = st.warn || hz.warnColor || '#ffd84a';
  const bx = hz.x + hz.w / 2, by = hz.y + hz.h;
  mapRect(ctx, rgba(col, .05 + .12 * k), hz.x, hz.y, hz.w, hz.h);
  if (on) {
    ctx.strokeStyle = rgba(col, .35 + .4 * k); ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60;
    ctx.strokeRect(hz.x, hz.y, hz.w, hz.h); ctx.setLineDash([]);
    glow(c2, col, 16, () => {   // c2: the style scales or drops the glow
      mapPen(ctx, col, 3);
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
  if (g.st === 'warn' && (SETTINGS.reduceFlash || Math.sin(t * 18) > -.3)) mapSign(ctx, g.dir > 0 ? 'GUST  ›››' : '‹‹‹  GUST', W / 2, 150, 30, rgba(color, .75));
  if (g.k < .05) return;
  mapPen(ctx, rgba(color, .35 * g.k), 2);
  for (let k = 0; k < 26; k++) {
    const len = 60 + mapHash(k) * 90, y = 40 + mapHash(k + 9) * 600;
    const x = mapWrap(mapHash(k + 4) * W + g.dir * t * (900 + mapHash(k) * 600), W + len) - len;
    mapSeg(ctx, x, y, x + g.dir * len, y);
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
  floor: 650,
  solids: [{ x: 150, y: 470, w: 250 }, { x: 880, y: 470, w: 250 }, { x: 515, y: 315, w: 250 }],
  spawns: [[330, 650], [950, 650], [275, 470], [1005, 470]],
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#0a0b1d', '#1c1340', '#2e1849']);
    mapFar(ctx, .25, c => {                      // far: the banded sun and pale towers sinking into a pink haze
      mapGlow(c, 640, 450, 280, '#ff3c8c', .26);
      c.globalAlpha = .55; mapSun(c, 640, 450, 130, ['#ffc46a', '#ff5a6a', '#c8287a'], '#2e1849', 0); c.globalAlpha = 1;
      mapSkyline(c, fl, 26, 3, 250, '#221a44');
      mapHaze(c, fl, 170, '#ff4a8a', .2);
    });
    mapFar(ctx, .12, c => mapSkyline(c, fl, 34, 8, 170, '#120f26', 'rgba(255,200,120,.3)', t));   // near: lit windows
    drawGridFloor(ctx, fl, '#0c0d1a', 'rgba(120,100,255,.22)', '#8b7dff');
  },
});

defMap('dojo', {
  name: 'Dojo Courtyard', desc: 'Open boards, no ledges, no power-ups. A pure duel of footwork and timing.', order: 15,
  floor: 640, orbs: false, style: 'ink',
  spawns: [[420, 640], [860, 640], [270, 640], [1010, 640]],
  palette: { sky1: '#1b0b30', sky2: '#ff6a5a', ground: '#2a1410', line: '#ff7ab8', accent: '#ffcf6b', solid: '#3a1c14' },
  // Ink: a vermilion sun behind the torii, washed hills, pagodas in grey wash; the lanterns still swing.
  art: { top: ART_PAPER,
    bg(g, m) {
      const fl = m.floor, wash = artMono(g, 'rgba(30,25,21,.45)');
      inkPaper(g, 11);
      inkSun(g, 640, 360, 165, '#cf3b2b');
      inkWash(g, 560, 120, .006, 1.2, .12, fl); inkWash(g, 600, 70, .011, 4, .22, fl);
      m.drawPagoda(wash, 150, fl, 1); m.drawPagoda(wash, 1130, fl, .8);
      m.drawTorii(artMono(g, ART_INK), 640, fl);
      for (const [x, y, s] of [[300, 150, 1], [345, 128, .7], [930, 210, .8]]) inkStroke(g, [[x - 14 * s, y - 4 * s], [x, y + 3 * s], [x + 14 * s, y - 5 * s]], 1.8 * s, .5);   // birds
      inkGround(g, fl, 31);
    },
    live(c, m, t) { for (let k = 0; k < 7; k++) m.drawLantern(c, 120 + k * 173, 40 + (k % 2) * 26, t, k); } },
  drawBg(ctx, t) {
    if (artBg(ctx, this, t)) return;
    const fl = this.floor;
    mapSky(ctx, fl, ['#12082a', '#4a1450', '#c23a5a', '#ff9a5a']);
    mapSun(ctx, 640, 470, 170, ['#ffe08a', '#ff4a7a'], '#c23a5a', t);   // banded setting sun
    mapRidge(ctx, 560, 120, .006, 1.2, '#3a0f3a', fl);
    mapRidge(ctx, 600, 70, .011, 4, '#2a0a2c', fl);
    this.drawTorii(ctx, 640, fl);
    this.drawPagoda(ctx, 150, fl, 1); this.drawPagoda(ctx, 1130, fl, .8);
    for (let k = 0; k < 7; k++) this.drawLantern(ctx, 120 + k * 173, 40 + (k % 2) * 26, t, k);
    mapGround(ctx, fl, '#2a1410', '#ff7ab8', 3, () => {        // wooden deck
      mapPen(ctx, 'rgba(255,170,120,.12)', 2);
      for (let y = fl + 14; y < H; y += 16) mapSeg(ctx, 0, y, W, y);
      for (let k = 0; k < 18; k++) { const x = (k * 97) % W, y = fl + 14 + (k % 5) * 16; mapSeg(ctx, x, y, x, y + 16); }
      ctx.stroke();
    });
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
    glow(ctx, '#ff8a4a', 18, () => { mapBrush(ctx, '#ff6a4a'); ctx.ellipse(0, y + 18, 13, 18, 0, 0, TAU); ctx.fill(); });
    mapRect(ctx, '#2a0a1a', -7, y - 1, 14, 4); ctx.fillRect(-7, y + 34, 14, 4);
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
    const p = this.palette, fl = this.floor;
    mapSky(ctx, fl, [p.sky1, p.sky2]);
    mapFar(ctx, .2, c => {                                      // gears turning far back
      drawGear(c, 200, 210, 120, 14, t * .15, '#24100b');
      drawGear(c, 1090, 160, 90, 11, -t * .2, '#24100b');
      drawGear(c, 960, 330, 55, 9, t * .33, '#2c140d');
    });
    mapFar(ctx, .1, c => {                                      // smoking chimney stacks in the heat of the pit
      c.fillStyle = '#1d0c08';
      for (const [x, w, h] of FOUNDRY_STACKS) c.fillRect(x, fl - h, w, h + 40);
      mapGlow(c, 640, fl, 420, '#ff6e28', .42);
      for (const [x, w, h] of FOUNDRY_STACKS) mapSmoke(c, t + x, x + w / 2, fl - h, { n: 4, rate: .09, r0: 10, r1: w * .7, h: 150, sway: 14, drift: 40, col: '#5a382c', a: .9 });
    });
    mapParticles(ctx, t, 26, { x0: 480, x1: 800, y0: fl - 520, y1: fl, vy: -115, sway: 18, size: 3, color: '#ff9a40', alpha: .9, seed: 41 });   // embers
    drawGridFloor(ctx, fl, p.ground, 'rgba(255,120,60,.16)', p.line);
  },
});
const FOUNDRY_STACKS = [[360, 70, 330], [450, 40, 260], [820, 60, 300], [900, 36, 220]];   // chimneys: x, width, height

// A simple cog silhouette for industrial backdrops.
function drawGear(ctx, x, y, r, teeth, ang, color, rim = 'rgba(255,120,60,.10)') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); mapBrush(ctx, color);
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
    mapGround(ctx, fl, ['#9fd8f5', '#4a86b8', '#2e5b89', '#183a64'], '#bff4ff', 3, () => {   // glassy ice: reflections, cracks
      for (let k = 0; k < 6; k++) { const x = mapWrap(k * 230 + t * 12, W + 200) - 100; poly(ctx, [[x, fl + 6], [x + 60, fl + 6], [x + 20, H], [x - 40, H]], 'rgba(255,255,255,.07)'); }
      mapPen(ctx, 'rgba(255,255,255,.35)', 1);
      for (const [x, l] of [[210, 40], [520, 60], [760, 35], [1050, 55]]) { mapSeg(ctx, x, fl + 8, x + l * .6, fl + 22); ctx.lineTo(x + l, fl + 18); mapSeg(ctx, x + l * .6, fl + 22, x + l * .5, fl + 40); }
      ctx.stroke();
    });
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
  floor: 650, gravity: 1350, style: 'pixel',
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
    mapRect(ctx, '#1f5fbf', ex - er, ey - er, er * 2, er * 2);
    ctx.fillStyle = '#3fae5a';
    for (let k = 0; k < 5; k++) { const x = ex - er + mapWrap(k * 61 + t * 6, er * 3) - er * .5; ctx.beginPath(); ctx.ellipse(x, ey - 30 + k * 15, 24, 11, k, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let k = 0; k < 4; k++) { const x = ex - er + mapWrap(k * 47 + t * 10, er * 3) - er * .5; ctx.fillRect(x, ey - 50 + k * 28, 50, 5); }
    mapBrush(ctx, 'rgba(0,0,20,.55)'); ctx.arc(ex + 30, ey + 10, er, 0, TAU); ctx.fill();   // night side
    ctx.restore();
    // Distant crater rim and the base dome.
    mapRidge(ctx, fl - 20, 70, .008, 2, '#2a2a3a', fl);
    this.drawDome(ctx, 230, fl, t);
    mapRect(ctx, '#1e1e2c', 820, fl - 160, 8, 160);   // antenna mast with blinking light
    circle(ctx, 824, fl - 166, 5, Math.sin(t * 4) > 0 ? '#ff4a6a' : '#401018');
    mapGround(ctx, fl, ['#8a8a9a', '#3a3a4a'], '#b6c3ff', 2, () => {   // regolith with craters
      for (const [x, y, r] of [[160, 670, 30], [480, 695, 22], [760, 668, 40], [1110, 690, 26], [980, 708, 14]]) {
        mapBrush(ctx, 'rgba(30,30,45,.45)'); ctx.ellipse(x, y, r, r * .3, 0, 0, TAU); ctx.fill();
        mapPen(ctx, 'rgba(255,255,255,.18)', 2); ctx.ellipse(x, y + 2, r, r * .3, 0, 0, Math.PI); ctx.stroke();
      }
    });
  },
  drawDome(ctx, x, fl, t) {
    mapBrush(ctx, 'rgba(120,200,255,.10)'); ctx.arc(x, fl, 120, Math.PI, 0); ctx.fill();
    mapPen(ctx, 'rgba(150,220,255,.4)', 2); ctx.arc(x, fl, 120, Math.PI, 0); ctx.stroke();
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
    mapFar(ctx, .3, c => {                                 // the low sun and distant floating isles
      mapGlow(c, 640, 640, 420, '#ffd08a', .35);
      for (const [x, y, s] of [[200, 210, .5], [1080, 170, .4], [760, 120, .3]]) this.drawIsle(c, x + Math.sin(t * .3 + x) * 8, y, 120 * s, 'rgba(60,40,90,.55)');
    });
    mapSoft(ctx, 250, 640, g => [.35, .2, .1].forEach((d, k) => mapFar(g, d, c =>   // soft clouds, nearer and brighter layer by layer
      mapClouds(c, t, { y: 330 + k * 120, n: 6, sp: 8 + k * 10, rx: 76, ry: 32, col: '#ffdcf0', a: .45 + k * .25, seed: k * 9 }))));
  },
  drawIsle(ctx, x, y, w, fill) {
    poly(ctx, [[x - w, y], [x + w, y], [x + w * .5, y + w * .5], [x + w * .1, y + w * .9], [x - w * .4, y + w * .5]], fill);
  },
  drawSolid(ctx, s, t) {
    if (!s.oneWay) {                                       // big rocky island with grass, roots and a waterfall
      const cx = s.x + s.w / 2;
      poly(ctx, [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w - 30, s.y + s.h + 30], [cx + 40, s.y + s.h + 110], [cx - 50, s.y + s.h + 90], [s.x + 26, s.y + s.h + 20]], '#3a2a44', '#5a4064', 2);
      mapRect(ctx, '#2a6a4a', s.x, s.y, s.w, 12);
      mapEdge(ctx, s, '#7dffb0', 3);
      mapPen(ctx, 'rgba(120,220,160,.5)', 2);
      for (let k = 0; k < 5; k++) { const x = s.x + 40 + k * 60; ctx.moveTo(x, s.y + 14); ctx.quadraticCurveTo(x + 8, s.y + 40, x - 4, s.y + 60 + (k % 2) * 20); }
      ctx.stroke();
      const wx = s.x < W / 2 ? s.x + 14 : s.x + s.w - 24;
      mapRect(ctx, 'rgba(140,220,255,.35)', wx, s.y + 6, 10, 240);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let k = 0; k < 6; k++) ctx.fillRect(wx + 2, s.y + 6 + mapWrap(t * 260 + k * 40, 240), 6, 14);
    } else {                                               // cloud platform
      ctx.fillStyle = 'rgba(255,240,250,.9)';
      for (let x = s.x + 10; x < s.x + s.w; x += 26) { ctx.beginPath(); ctx.arc(x, s.y + 6, 14, 0, TAU); ctx.fill(); }
      mapEdge(ctx, s, s.move ? '#ffd84a' : '#ffffff', 2);
    }
  },
  drawFg(ctx, t) { mapSoft(ctx, 640, 760, g => mapClouds(g, t, { y: 700, n: 6, sp: -30, rx: 150, ry: 36, col: '#ffe6f5', a: .55, seed: 4 })); },
});
