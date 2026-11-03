// 85-render.js: canvas setup, the dynamic camera (drawing only: it never changes the game), world drawing (map,
// hazards, platforms, orbs, fighters, weapons, projectiles, effects) and the HUD (health, skills, ammo, statuses,
// round pips) plus big banners. Everything is drawn in arena units (1280x720) and scaled to fit the window.

const cv = document.getElementById('c'), CTX_MAIN = cv.getContext('2d');
let ctx = CTX_MAIN;   // the world pass points it at the art style's proxy (59-styles)
// VIEW: s = arena px -> canvas px; (vx, vy, vw, vh) = the world viewport on the canvas; (ox, oy) = where the 1280x720
// "screen" of overlays and banners sits (centred in the viewport); hv = viewport height in arena units; zMin = the
// least camera zoom that keeps the view inside the arena; hudK = extra HUD scale so its text stays readable; hudY = top
// of the HUD (canvas px). On a landscape screen the viewport is the letterboxed 16:9 arena (hv = H, zMin = 1).
// band = the letterbox strip above the viewport (canvas px, 0 in portrait); hudH = the HUD block's height; hudOver =
// how much of it still overlaps the top of the viewport (0 when the band is tall enough, as on a 12.9" iPad);
// inset = the top safe-area inset (canvas px): the status bar of a home-screen app, which the HUD stays below.
// glowK = dpr / step-3 dpr (glows scale by it); w3 x h3 = the step-3 canvas size (fixed-size effect buffers).
const VIEW = { s: 1, ox: 0, oy: 0, dpr: 1, vx: 0, vy: 0, vw: W, vh: H, cx: W / 2, cy: H / 2, hv: H, top: 0, zMin: 1, hudK: 1, hudW: W, hudY: 0,
  band: 0, hudH: 0, hudOver: 0, inset: 0, glowK: 1, w3: W, h3: H };
const VIEW_HUD_CSS = .72;      // smallest on-screen (CSS px) scale for HUD text: 15px HUD text stays ~11px
const CAM = { x: W / 2, y: H / 2, z: 1, fx: 0, fy: 0, focusT: 0, follow: store.getBool('camera', true), maxZoom: 1.24,
  punch: 0 };   // punch: brief extra zoom on heavy hits (set by 87-juice, decays here)
let BANNER = null;

// The frame cost grows with pixels (sky gradients, glows, vignettes), and the arena is a fixed 1280x720 drawing, so
// the backing store's size comes from the resolution step (84-quality; 3 = the old ~2.3 MP cap) and CSS scales it up.

// A home-screen (standalone) app on iOS has the status bar laid over the page. A hidden probe measures
// env(safe-area-inset-top) in CSS px (0 in a browser tab or an embedded viewer) so the HUD can start below the bar.
// Tests stub it by setting #safe-probe's padding-top.
let SAFE_PROBE = null;
function safeInsetTop() {
  if (typeof document === 'undefined' || !document.body) return 0;
  if (!SAFE_PROBE) {
    SAFE_PROBE = document.createElement('div');
    SAFE_PROBE.id = 'safe-probe';
    SAFE_PROBE.setAttribute('aria-hidden', 'true');
    SAFE_PROBE.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
    document.body.append(SAFE_PROBE);
  }
  return Math.max(0, parseFloat(getComputedStyle(SAFE_PROBE).paddingTop) || 0);
}

// step 1: a resolution step (84-quality). A real resize also rebuilds the backdrop cache, once, 400 ms after the last.
function resize(step) {
  const dpr = resDpr(RES.shown), d3 = resDpr(3);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  Object.assign(VIEW, { dpr, glowK: dpr / d3, w3: Math.round(innerWidth * d3), h3: Math.round(innerHeight * d3) });
  VIEW.inset = Math.round(safeInsetTop() * dpr);
  // Portrait (after "Play in portrait anyway"): a 16:9 strip would leave fighters tiny, so the viewport fills the
  // width and is taller (up to ~square, between the HUD band and the thumb buttons); the camera zooms in to fill it.
  const portrait = cv.height > cv.width, s = portrait ? cv.width / W : Math.min(cv.width / W, cv.height / H);
  const vw = W * s, vh = portrait ? Math.round(Math.min(cv.height * .56, cv.width * 1.15)) : H * s;
  Object.assign(VIEW, { s, vw, vh, vx: (cv.width - vw) / 2, vy: portrait ? Math.round(cv.height * .19) : (cv.height - vh) / 2 });
  VIEW.cx = VIEW.vx + vw / 2; VIEW.cy = VIEW.vy + vh / 2;
  VIEW.ox = VIEW.vx; VIEW.oy = VIEW.cy - H * s / 2;
  VIEW.hv = vh / s; VIEW.top = (VIEW.vy - VIEW.oy) / s; VIEW.zMin = Math.max(1, VIEW.hv / H);
  VIEW.hudK = clamp(VIEW_HUD_CSS / (s / dpr), 1, 2.2); VIEW.hudW = W / VIEW.hudK;   // HUD layout width (centred)
  hudLayout();
  RES.cool = 30;   // let the new canvas settle
  if (step !== 1 && ART.k) { clearTimeout(ART.kt); ART.kt = setTimeout(() => { ART.k = 0; }, 400); }   // not at boot: no cache yet
}
addEventListener('resize', resize);

// Height of the HUD block in canvas px (the card rows plus the round label), with the row maths drawHUD uses.
function hudBlockPx() {
  const g = hudGrid(Math.max(2, F.filter(f => !f.summon).length));
  return (g.rows * g.rowH + 36) * VIEW.s * VIEW.hudK;
}
// Up to 4 fighters: full cards (2 per row on narrow screens). 5-8: compact cards, 4 per row (2 on narrow screens).
function hudGrid(n) {
  const Wh = VIEW.hudW, two = n === 2, compact = n > 4;
  const perRow = two ? 2 : compact ? clamp(Math.floor((Wh - 44) / 200), 2, 4) : clamp(Math.floor((Wh - 44) / 256), 1, n);
  return { two, compact, perRow, rows: two ? 1 : Math.ceil(n / perRow), rowH: compact ? 46 : 84 };
}
// Where the HUD sits: in the letterbox band above the arena when there is one (4:3 iPads), else overlapping the top
// of the viewport by hudOver px (16:9 screens), where the camera keeps fighters below it (updateCamera).
function hudLayout() {
  const portrait = cv.height > cv.width, inset = VIEW.inset || 0;   // the status bar's strip (standalone mode) is off limits
  VIEW.band = portrait ? 0 : Math.max(0, VIEW.vy - inset);
  VIEW.hudH = hudBlockPx();
  VIEW.hudY = portrait ? Math.round(cv.height * .075) + inset : Math.max(inset, VIEW.vy - VIEW.hudH);
  VIEW.hudOver = portrait ? 0 : Math.max(0, VIEW.hudY + VIEW.hudH - VIEW.vy);
}
on('roundStart', hudLayout);   // the number of cards (and so the block height) can change between matches
resize();

// ---------- glow scale (Safari draws canvas shadows slowly) ----------
// The quality tier sets GLOW_SCALE for every glow() in the game: High 1, Medium .5, Low 0 (no shadows at all).
// 84-quality applies a tier through SETTINGS.particles, so Auto and Custom mixes follow that choice as well.
const GLOW_BY_LEVEL = { high: 1, medium: .5, low: 0 };
function glowApply() {
  const S = typeof SETTINGS === 'object' && SETTINGS ? SETTINGS : {};
  const level = GLOW_BY_LEVEL[S.quality] != null ? S.quality : S.particles;
  GLOW_SCALE = GLOW_BY_LEVEL[level] ?? 1;
}
on('boot', () => {
  const glowBaseApply = applySettings;   // 75's declaration is reassignable (84-postfx and 92-access wrap it the same way)
  applySettings = function () { glowBaseApply(); glowApply(); };
  glowApply();
});

// ---------- camera ----------
function focusCamera(x, y, seconds = 1.1) { CAM.fx = x; CAM.fy = y; CAM.focusT = seconds; }

// Frames every living fighter, zooming in gently when they are close together.
const CAM_OUT = .94;   // the zoom-out allowed below zMin: backdrops paint about 40 px past each side
function updateCamera(dt) {
  if (photoCamera()) return;   // photo mode's free camera (86)
  let tx = W / 2, ty = H / 2, tz = 1, boxTop = null, feetY = null, zFloor = VIEW.zMin;
  const live = F.filter(f => f.alive);
  if (CAM.follow && live.length) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const f of live) for (const j of [0, 2, 8, 10]) {
      const p = f.P[j];
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const top = y0 - 30, usable = VIEW.hv - VIEW.hudOver / VIEW.s, fit = usable / (y1 + 16 - top);
    feetY = y1 + 16;                                 // the lowest feet always stay on screen (below)
    x0 -= 240; x1 += 240; y0 -= 200; y1 += 110;
    // The strip of the viewport under the HUD (hudOver) is not usable height.
    tz = clamp(Math.min(W / (x1 - x0), usable / (y1 - y0)), VIEW.zMin, Math.max(CAM.maxZoom, VIEW.zMin * 1.12));
    tx = (x0 + x1) / 2; ty = (y0 + y1) / 2;
    boxTop = y0;
    // A high fighter and the floor that won't both fit under the HUD: zoom out a little rather than drop the floor.
    if (fit < VIEW.zMin) { tz = zFloor = Math.max(fit, VIEW.zMin * CAM_OUT); ty = (top + feetY) / 2 - VIEW.hudOver / (2 * VIEW.s * tz); }
  }
  if (CAM.focusT > 0 && CAM.follow) { CAM.focusT -= dt; tz = Math.max(tz, 1.3 * VIEW.zMin); tx = CAM.fx; ty = CAM.fy; feetY = null; }
  tz = Math.max(tz, zFloor);
  const k = 1 - Math.exp(-dt * 3.5), kz = 1 - Math.exp(-dt * 2.4);
  CAM.z += (tz - CAM.z) * kz; CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k;
  CAM.z = Math.max(CAM.z, VIEW.zMin * CAM_OUT);
  CAM.punch *= Math.exp(-dt * 9);
  const hw = W / (2 * CAM.z), hh = VIEW.hv / (2 * CAM.z);   // never show outside the arena (bar CAM_OUT's sliver)...
  // ...except above it, as far as the physics ceiling plus the strip the HUD covers (topPad), and only as high as
  // the fighters need: they then sit under the HUD instead of behind it (the Asteroid's top planet, the Kitchen shelf).
  const topPad = VIEW.hudOver / (VIEW.s * CAM.z);
  const minY = boxTop == null ? hh : clamp(boxTop + hh - topPad, hh - topPad + CEILING, hh);
  // That rise never pushes the lowest feet below the view, not even during a punch-zoom (87).
  const lowY = feetY == null ? minY : Math.max(minY, feetY - hh / (1 + CAM.punch));
  CAM.x = hw >= W / 2 ? W / 2 : clamp(CAM.x, hw, W - hw); CAM.y = clamp(CAM.y, Math.min(lowY, H - hh), H - hh);
}

function setWorldTransform(sx = 0, sy = 0) {
  const s = VIEW.s * CAM.z * (1 + CAM.punch), e = VIEW.cx - CAM.x * s + sx, f = VIEW.cy - CAM.y * s + sy, L = ART.layerOn;
  if (!L) return ctx.setTransform(s, 0, 0, s, e, f);
  ctx.setTransform(s * L.q, 0, 0, s * L.q, Math.round((e - VIEW.vx) * L.q), Math.round((f - VIEW.vy) * L.q));   // pixel layer (59)
}
function setArenaTransform() { ctx.setTransform(VIEW.s, 0, 0, VIEW.s, VIEW.ox, VIEW.oy); }

// ---------- map drawing ----------
function glowLine(c2, x1, y1, x2, y2, color, width = 3) {
  const st = artNow();
  if (st.edge) return st.edge(artRaw(c2), x1, y1, x2, y2, color, width);   // ink, paper or chalk (59-styles)
  glow(c2, color, 12, () => lineXY(c2, x1, y1, x2, y2, color, width));
}

// Dark ground (fill: hex) with a perspective grid fading toward the horizon and a neon edge (v1's look), for any map.
function drawGridFloor(c2, floor, fill, grid, edge) {
  const fade = c2.createLinearGradient(0, floor, 0, H);
  c2.fillStyle = fill; c2.fillRect(0, floor, W, H - floor + 300);
  c2.strokeStyle = grid; c2.lineWidth = 1; c2.beginPath();
  for (let k = -12; k <= 12; k++) { c2.moveTo(W / 2 + k * 30, floor); c2.lineTo(W / 2 + k * 130, H); }
  for (let k = 1; k < 5; k++) { const y = floor + (H - floor) * (k / 5) ** 1.6; c2.moveTo(0, y); c2.lineTo(W, y); }
  c2.stroke();
  fade.addColorStop(0, rgba(fill, .9)); fade.addColorStop(.5, rgba(fill, 0));
  c2.fillStyle = fade; c2.fillRect(0, floor, W, (H - floor) / 2);
  glowLine(c2, 0, floor, W, floor, edge);
}

// A ready-made backdrop from the map palette (used when a map has no drawBg).
function drawStdBackground(c2, m, t) {
  const p = m.palette, fl = m.floor;
  mapSky(c2, fl ?? H, [p.sky1, p.sky2]);
  mapStars(c2, t, 40, (fl ?? H) * .6);
  if (fl != null) drawGridFloor(c2, fl, p.ground, rgba(p.line, .2), p.line);
  else mapGlow(c2, W / 2, H, W / 2, p.accent, .18);   // bottomless: a faint glow rising out of the void
}

// Background-only particles provide weather and atmosphere without touching simulation or collision state.
// Each map family gets a different motion profile; fixed seeds keep shapes stable between frames.
function drawAmbientLayer(c2, m, t) {
  if (!m) return;
  const key = String(m.key || '').toLowerCase(), p = m.palette || {};
  const qualityMul = SETTINGS.quality === 'low' ? .42 : SETTINGS.quality === 'medium' ? .7 : 1;
  const particleMul = PARTICLE_MULS[SETTINGS.particles] || 1;
  const cold = /frost|moon|storm/.test(key), hot = /foundry|factory|eruption|caldera|train|station/.test(key);
  const spooky = /graveyard|mansion/.test(key), water = /pirate|ocean|ship/.test(key);
  const sweet = /candy|bounce/.test(key), kitchen = /kitchen/.test(key);
  const sand = /desert|temple|jungle/.test(key), space = /asteroid|sky|neon|space/.test(key);
  const color = cold ? '#ccefff' : hot ? '#ffad66' : spooky ? '#c4ffd9' : water ? '#8deaff' : sweet ? '#ffc0ef' : kitchen ? '#dfedff' : sand ? (key.includes('jungle') ? '#baff9a' : '#f3d19a') : (p.accent || '#b6c6ff');
  const count = Math.max(5, Math.round((cold || hot || spooky ? 24 : 17) * qualityMul * particleMul));
  c2.save(); c2.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const seed = i * 127.13 + (key.length * 31.7);
    const drift = Math.sin(t * (cold ? .4 : spooky ? .7 : .22) + i * 1.71) * (cold ? 10 : spooky ? 18 : 16);
    const speed = cold ? 19 + (i % 5) * 7 : hot ? 12 + (i % 7) * 8 : spooky ? 7 + (i % 4) * 4 : water ? 4 + (i % 5) * 3 : sand ? 5 + (i % 4) * 3 : 2;
    const xMotion = water ? t * speed * (i % 2 ? 1 : -.75) : hot ? t * speed * .45 : t * (cold ? 5 : 1.5);
    const x = ((seed * 13.37 + drift + xMotion) % (W + 40) + W + 40) % (W + 40) - 20;
    const yMotion = spooky || kitchen ? -t * speed : t * speed;
    const y = ((seed * 7.91 + yMotion + Math.sin(t * .7 + i) * 11) % (H + 40) + H + 40) % (H + 40) - 20;
    const r = cold ? .8 + (i % 3) * .55 : hot ? .7 + (i % 3) * .35 : .65 + (i % 2) * .4;
    c2.globalAlpha = (cold || spooky ? .22 : hot || water ? .24 : sweet ? .18 : .13) * (.65 + .35 * Math.sin(t * 1.7 + i * 2));
    c2.fillStyle = color;
    if (cold) { c2.beginPath(); c2.arc(x, y, r, 0, TAU); c2.fill(); }
    else if (hot) { c2.strokeStyle = color; c2.lineWidth = r; c2.beginPath(); c2.moveTo(x, y); c2.lineTo(x - 1.5 - (i % 3), y + 3 + (i % 4)); c2.stroke(); }
    else if (spooky) { c2.beginPath(); c2.arc(x, y, r * 1.7, 0, TAU); c2.strokeStyle = color; c2.lineWidth = .7; c2.stroke(); }
    else if (water) { c2.strokeStyle = color; c2.lineWidth = r; c2.beginPath(); c2.moveTo(x - 4, y); c2.quadraticCurveTo(x, y - 1.5, x + 5, y); c2.stroke(); }
    else if (sweet) { c2.beginPath(); c2.moveTo(x, y - 2.5); c2.lineTo(x + 1.3, y); c2.lineTo(x, y + 2.5); c2.lineTo(x - 1.3, y); c2.closePath(); c2.fill(); }
    else if (kitchen) { c2.strokeStyle = color; c2.lineWidth = .8; c2.beginPath(); c2.moveTo(x, y + 4); c2.quadraticCurveTo(x - 3, y, x + 1, y - 4); c2.stroke(); }
    else if (sand) { c2.fillRect(x, y, r * 1.8, r * .8); }
    else if (space) { c2.fillRect(x, y, r, r); }
    else { c2.beginPath(); c2.arc(x, y, r, 0, TAU); c2.fill(); }
  }
  c2.restore();
}

function drawSolid(c2, s, m, t) {
  if (s.draw) return hook(s, 'draw', c2, s, t);
  if (m.drawSolid) return hook(m, 'drawSolid', c2, s, t);
  mapSlab(c2, s, m.palette.solid, s.move ? m.palette.accent : m.palette.line);   // the shared slab (60-maps)
  // v5: one-way ledges show rail posts and moving platforms carry end lights, so both read at a glance.
  const p = m.palette;
  if (s.oneWay) { c2.fillStyle = rgba(p.line, .32); for (let xx = s.x + 18; xx < s.x + s.w - 8; xx += 34) c2.fillRect(xx, s.y + 5, 1, Math.max(1, Math.min(s.h, 14) - 8)); }
  if (s.move) for (const x of [s.x + 10, s.x + s.w - 10]) { circle(c2, x, s.y + 7, 4.2, rgba(p.accent, .16)); circle(c2, x, s.y + 7, 2.2, p.accent); circle(c2, x, s.y + 7, .8, '#ffffff'); }
}

// Liquid pool (lava, acid...): a fainter wave rolling the other way behind the glowing one, a bright crest, bubbles.
function drawLiquid(c2, hz, t, light, dark) {
  const top = hz.y + 10, bot = hz.y + hz.h, grad = c2.createLinearGradient(0, top, 0, bot);
  const crest = (y, ph, a) => { for (let x = 0; x <= hz.w; x += 8) c2.lineTo(hz.x + x, y + Math.sin(x * .05 + ph) * a); };
  const wave = (y, ph, a) => { c2.beginPath(); c2.moveTo(hz.x, bot); crest(y, ph, a); c2.lineTo(hz.x + hz.w, bot); };
  grad.addColorStop(0, light); grad.addColorStop(1, dark);
  wave(top - 3, 2 - t * 1.5, 4); c2.fillStyle = rgba(light, .5); c2.fill();
  glow(c2, light, 24, () => { wave(top, t * 3, 3); c2.fillStyle = grad; c2.fill(); });
  c2.save(); c2.globalCompositeOperation = 'lighter'; c2.beginPath(); crest(top, t * 3, 3);
  c2.strokeStyle = light; c2.lineWidth = 2; c2.stroke(); c2.restore();
  for (let k = 0; k < 6; k++) {
    const ph = (t * .7 + k * .31) % 1, x = hz.x + 14 + ((k * 53) % Math.max(1, hz.w - 28));
    c2.globalAlpha = 1 - ph;
    circle(c2, x, top + 14 - ph * 16, 2 + ph * 4, null, '#ffe0a0', 1.5);
  }
  c2.globalAlpha = 1;
}

const HAZARD_DRAW = {
  lava: (c2, hz, t) => drawLiquid(c2, hz, t, hz.color || '#ff6a2a', '#5a0e02'),
  acid: (c2, hz, t) => drawLiquid(c2, hz, t, hz.color || '#8dff4a', '#103d06'),
  // Steel spikes of two heights with glowing tips in the hazard's colour, over a faint glow.
  spikes(c2, hz, t) {
    const n = Math.max(1, Math.round(hz.w / 20)), w = hz.w / n, base = hz.y + hz.h, col = hz.color || '#ff3d5a';
    for (let k = 0; k < n; k++) {
      const x = hz.x + k * w, tip = hz.y + (k % 2) * 6;
      poly(c2, [[x, base], [x + w / 2, tip], [x + w, base]], '#8a90aa', '#4a4e66', 1);
      poly(c2, [[x + w * .3, tip + 10], [x + w / 2, tip], [x + w * .7, tip + 10]], rgba(col, .6 + .3 * Math.sin(t * 4 + k)));
    }
    mapGlow(c2, hz.x + hz.w / 2, hz.y + 10, hz.w * .6, col, .12);
  },
  electric(c2, hz, t) {
    c2.fillStyle = 'rgba(90,160,255,.12)'; c2.fillRect(hz.x, hz.y, hz.w, hz.h);
    const col = hz.color || '#7fd8ff';
    glow(c2, col, 14, () => {
      c2.strokeStyle = col; c2.lineWidth = 2; c2.beginPath();
      for (let x = 0; x <= hz.w; x += 12) c2.lineTo(hz.x + x, hz.y + hz.h / 2 + Math.sin(x * 1.7 + t * 40) * hz.h * .35);
      c2.stroke();
    });
  },
  default(c2, hz, t) {
    c2.save(); c2.beginPath(); c2.rect(hz.x, hz.y, hz.w, hz.h); c2.clip();
    c2.fillStyle = rgba(hz.color || '#ff4a6a', .25); c2.fillRect(hz.x, hz.y, hz.w, hz.h);
    c2.strokeStyle = rgba(hz.color || '#ff4a6a', .6); c2.lineWidth = 6; c2.beginPath();
    for (let x = -hz.h + ((t * 30) % 24); x < hz.w; x += 24) { c2.moveTo(hz.x + x, hz.y + hz.h); c2.lineTo(hz.x + x + hz.h, hz.y); }
    c2.stroke(); c2.restore();
  },
};

function drawHazard(c2, hz, m, t) {
  if (hz.draw) return hook(hz, 'draw', c2, hz, t);
  if (m.drawHazard) return hook(m, 'drawHazard', c2, hz, t);
  (HAZARD_DRAW[hz.kind] || HAZARD_DRAW.default)(c2, hz, t);
}

function drawOrbs() {
  for (const o of ORB_LIST) {
    const y = o.y + Math.sin(o.t * 3) * 6, fade = o.t > 11 ? (Math.sin(o.t * 20) > 0 ? 1 : .3) : 1, c = o.def.color;
    ctx.save(); ctx.globalAlpha = fade; ctx.shadowColor = c; ctx.shadowBlur = 24 * GLOW_SCALE;
    circle(ctx, o.x, y, 18, 'rgba(10,10,25,.85)', c, 3);
    ctx.shadowBlur = 0; ctx.fillStyle = c; ctx.font = `20px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.def.icon, o.x, y + 1);
    ctx.restore();
  }
}

// ---------- fighters ----------
function fighterAlpha(f) {
  if (!f.alive) return .7;
  if (f.status.invis) return f.ctrl === 'human' && !f.autopilot ? .35 : .12;
  return 1;
}
function bodyColor(f) { return f.flash > 0 ? '#ffffff' : f.status.freeze ? '#8fdcff' : f.color; }
function auraColor(f) {
  const s = f.status;
  return s.rage ? '#ff3d5a' : s.burn ? '#ff7a2e' : s.poison ? '#8dff4a' : s.freeze ? '#9fe8ff' : f.color;
}

// What a weapon's draw(ctx, f, s) receives; see 40-weapons-melee.js for the fields.
function weaponView(f, rig) {
  const P = f.P, h = P[rig.hand], t = P[rig.tip], dx = t.x - h.x, dy = t.y - h.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  return { h, t, ux, uy, nx: -uy, ny: ux, L, k: f.scale * (f.status.giant ? 1.25 : 1), scale: f.scale, color: f.color, face: f.face,
    off: rig === f.off, pts: rig.pts.map(i => P[i]), at: (d, o = 0) => ({ x: h.x + ux * d - uy * o, y: h.y + uy * d + ux * o }) };
}

// Tip positions of the last few frames; restarts after a jump in time or position (teleports, sims).
function recordTrail(f) {
  const h = f.P[f.main.hand], t = f.P[f.tip], last = f.trail[f.trail.length - 1];
  if (last && (G_STATE.t - last.t > .1 || Math.hypot(t.x - last.x, t.y - last.y) > 160)) f.trail.length = 0;
  const hip = f.P[2], fast = Math.hypot(vx(t) - vx(hip), vy(t) - vy(hip)) > 700;   // swinging, not just falling
  f.trail.push({ x: t.x, y: t.y, hx: lerp(h.x, t.x, .3), hy: lerp(h.y, t.y, .3), t: G_STATE.t, fast });
  if (f.trail.length > 8) f.trail.shift();
}

// The attack ribbon combines a translucent swept surface with a crisp, tapered tip trace.
// Saving canvas state prevents trail alpha and shadow settings leaking into the fighter body pass.
function drawTrail(f, base) {
  const tr = f.trail;
  if (tr.length < 2 || !f.alive) return;
  ctx.save();
  const swinging = f.swingT > 0, swing = Math.min(1, f.swingT / .12);
  const trailColor = f.element && ELEMENTS[f.element] ? ELEMENTS[f.element].color : (f.w && f.w.color && f.w.color !== '#dfe6ff' ? f.w.color : f.color);
  for (let k = 1; k < tr.length; k++) {
    const a = tr[k - 1], b = tr[k], age = k / tr.length;
    if (swinging) {
      ctx.globalAlpha = base * age * .34 * swing;
      poly(ctx, [{ x: a.hx, y: a.hy }, a, b, { x: b.hx, y: b.hy }], trailColor);
    }
    if (swinging || b.fast) {
      const power = swinging ? swing : .6;
      ctx.globalAlpha = base * age * (swinging ? .52 : .2) * power;
      ctx.strokeStyle = trailColor; ctx.lineCap = 'round';
      ctx.lineWidth = (1.3 + age * (swinging ? 3.6 : 2.2)) * f.scale;
      ctx.shadowColor = trailColor; ctx.shadowBlur = 8 * GLOW_SCALE;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (swinging && age > .55) {
        ctx.globalAlpha *= .58; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(.7, ctx.lineWidth * .32);
        ctx.shadowBlur = 0; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawBody(f, color, width) {
  const P = f.P;
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
  for (const [a, b] of BODY_LINKS) { ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); }
  ctx.stroke();
  circle(ctx, P[0].x, P[0].y, HEAD_R * f.scale * (f.headMul || 1), color);
}

function drawHat(f) {
  const hat = HATS[f.hat];
  if (!hat || f.hat === 'none') return;
  const head = f.P[0], neck = f.P[1];
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(Math.atan2(head.y - neck.y, head.x - neck.x) + Math.PI / 2);
  const hm = f.headMul || 1;
  hook(hat, 'draw', ctx, f, { r: HEAD_R * f.scale * hm, face: f.face, scale: f.scale * hm, color: f.color });
  ctx.restore();
}

function drawStatusOverlays(f) {
  const s = f.status, c = chest(f), sc = f.scale, t = G_STATE.t;
  for (const name in s) if (STATUS[name] && STATUS[name].draw) hook(STATUS[name], 'draw', ctx, f, s[name]);   // content statuses
  if (s.shield) {
    const r = 62 * sc + Math.sin(t * 6) * 2;
    circle(ctx, c.x, c.y, r, 'rgba(127,216,255,.08)', 'rgba(127,216,255,.75)', 3);
  }
  if (s.freeze) drawIceBlock(f);
  if (s.stun) {
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + k * TAU / 3, head = f.P[0];
      ctx.fillStyle = '#ffe066'; ctx.font = `${Math.round(12 * sc)}px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✶', head.x + Math.cos(a) * 20 * sc, head.y - 22 * sc + Math.sin(a) * 6 * sc);
    }
  }
}

// Frozen fighters sit in a translucent block of ice.
function drawIceBlock(f) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let j = 0; j < 11; j++) { const p = f.P[j]; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const pad = 14 * f.scale, x = x0 - pad, y = y0 - pad - HEAD_R * f.scale, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2 + HEAD_R * f.scale;
  ctx.fillStyle = 'rgba(150,225,255,.22)'; ctx.strokeStyle = 'rgba(210,248,255,.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 8) : ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 8, y + h * .35); ctx.lineTo(x + w * .35, y + 8); ctx.moveTo(x + 8, y + h * .55); ctx.lineTo(x + w * .2, y + h * .4); ctx.stroke();
}

// Lightweight combat rim-light. It follows the actual ragdoll joints, so effects stay
// attached through knockback and unusual poses instead of behaving like a static sticker.
function drawFighterEnergy(f, sc) {
  const low = !f.status.invis && f.hp / f.maxHp < .22;
  const active = f.swingT > 0 || f.dashT > 0 || f.status.rage || f.status.burn || f.status.haste || f.status.freeze || low;
  if (!active || !f.alive) return;
  const color = f.status.freeze ? '#9fe8ff' : f.status.burn ? '#ff7a2e' : f.status.rage ? '#ff3d5a' : low ? '#ff435d' : f.color;
  const strength = f.swingT > 0 ? .34 : low ? .14 + .045 * (1 + Math.sin(G_STATE.t * 10 + f.id)) : .19;
  ctx.save(); ctx.globalAlpha *= strength;
  ctx.strokeStyle = color; ctx.lineWidth = (f.swingT > 0 ? 10 : 7) * sc;
  ctx.lineCap = ctx.lineJoin = 'round'; ctx.shadowColor = color; ctx.shadowBlur = 13 * GLOW_SCALE;
  ctx.beginPath();
  for (const [a, b] of BODY_LINKS) { ctx.moveTo(f.P[a].x, f.P[a].y); ctx.lineTo(f.P[b].x, f.P[b].y); }
  ctx.stroke();
  ctx.shadowBlur = 0; ctx.globalAlpha *= .9; ctx.lineWidth = 1.5 * sc;
  ctx.beginPath();
  for (const [a, b] of BODY_LINKS) { ctx.moveTo(f.P[a].x, f.P[a].y); ctx.lineTo(f.P[b].x, f.P[b].y); }
  ctx.stroke();
  if (f.swingT > 0) {
    const h = f.P[f.main.hand], tip = f.P[f.tip];
    const dx = tip.x - h.x, dy = tip.y - h.y, len = Math.hypot(dx, dy) || 1;
    ctx.globalAlpha *= .8; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 18 * GLOW_SCALE;
    circle(ctx, h.x + dx / len * len * .72, h.y + dy / len * len * .72, 3.2 * sc, color);
  }
  ctx.restore();
}

function drawFighterShadow(f) {
  if (!f.alive || !f.P || f.P.length < 11) return;
  const feet = [f.P[8], f.P[10]].filter(Boolean);
  if (!feet.length) return;
  const x = feet.reduce((n, p) => n + p.x, 0) / feet.length;
  const y = Math.max(...feet.map(p => p.y)) + 8 * f.scale;
  // Find the nearest visible landing surface beneath the fighter instead of using only MAP.floor.
  // This lets the shadow tighten under jumps and land on the top of raised platforms.
  let groundY = MAP.floor == null ? H + 140 : MAP.floor;
  for (const s of MAP.solids || []) {
    if (x < s.x - 4 || x > s.x + s.w + 4 || s.y < y - 6) continue;
    if (s.y < groundY || groundY < y - 6) groundY = s.y;
  }
  const height = Math.max(0, groundY - y);
  const spread = clamp(1 - height / 620 * .68, .28, 1);
  const opacity = .2 * clamp(1 - height / 1100, .24, 1);
  const auraColor = f.status.freeze ? '#9fe8ff' : f.status.burn ? '#ff7a2e' : f.status.rage ? '#ff3d5a' : f.color;
  // A faint palette glow pins the fighter to the arena visually; it fades rapidly while airborne.
  const contact = clamp(1 - height / 100, 0, 1) * .22;
  if (contact > .005) {
    ctx.save(); ctx.globalAlpha = contact;
    const rad = ctx.createRadialGradient(x, y + 1, 0, x, y + 1, 44 * f.scale * spread);
    rad.addColorStop(0, rgba(auraColor, .5)); rad.addColorStop(.45, rgba(auraColor, .14)); rad.addColorStop(1, rgba(auraColor, 0));
    ctx.fillStyle = rad; ctx.beginPath(); ctx.ellipse(x, y + 1, 44 * f.scale * spread, 9 * f.scale * spread, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = opacity; ctx.fillStyle = '#02030a'; ctx.shadowColor = '#000'; ctx.shadowBlur = 12 * GLOW_SCALE * spread;
  ctx.beginPath(); ctx.ellipse(x, y, 29 * f.scale * spread, 6 * f.scale * spread, 0, 0, TAU); ctx.fill(); ctx.restore();
}

// A restrained specular pass gives rigid metal weapons a readable edge without changing their hitboxes.
function drawWeaponEdgePass(c2, f, rig, v) {
  const cat = rig.w && rig.w.cat;
  if (!v || rig.w.chain || !['blade', 'heavy', 'polearm'].includes(cat) || v.L < 18) return;
  c2.save();
  const a = v.at(v.L * .18, 1.1 * v.k), b = v.at(v.L * .78, 1.1 * v.k);
  const shine = c2.createLinearGradient(a.x, a.y, b.x, b.y);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(.38, 'rgba(255,255,255,.22)');
  shine.addColorStop(.72, 'rgba(255,255,255,.68)');
  shine.addColorStop(1, 'rgba(255,255,255,.04)');
  c2.globalAlpha *= .8; c2.strokeStyle = shine; c2.lineWidth = Math.max(.65, 1.15 * f.scale);
  c2.lineCap = 'round'; c2.beginPath(); c2.moveTo(a.x, a.y); c2.lineTo(b.x, b.y); c2.stroke();
  const glint = v.at(v.L * (.52 + .08 * Math.sin(G_STATE.t * 5 + f.id)), 1.1 * v.k);
  c2.globalAlpha *= .75; c2.fillStyle = '#ffffff'; c2.shadowColor = '#ffffff'; c2.shadowBlur = 5 * GLOW_SCALE;
  c2.beginPath(); c2.arc(glint.x, glint.y, 1.1 * f.scale, 0, TAU); c2.fill();
  c2.restore();
}

// Tiny joint collars and a broken head rim make the ragdoll silhouette feel deliberately designed,
// while remaining attached to the live physics points during flips, grabs and knockback.
function drawFighterDetailPass(c2, f) {
  if (!f.alive || !f.P || f.P.length < 11 || f.status.invis) return;
  const P = f.P, sc = f.scale, col = f.status.freeze ? '#c7f1ff' : f.status.burn ? '#ffb06e' : f.color;
  c2.save(); c2.globalAlpha *= .42; c2.lineCap = 'round'; c2.lineJoin = 'round';
  const headR = HEAD_R * sc * (f.headMul || 1);
  c2.strokeStyle = col; c2.lineWidth = Math.max(.8, 1.25 * sc);
  c2.beginPath(); c2.arc(P[0].x, P[0].y, headR + 2.1 * sc, Math.PI * 1.04, Math.PI * 1.82); c2.stroke();
  c2.globalAlpha *= .76; c2.strokeStyle = '#ffffff'; c2.lineWidth = Math.max(.65, .75 * sc);
  c2.beginPath(); c2.arc(P[0].x - 1.2 * sc, P[0].y - 1.2 * sc, headR + .7 * sc, Math.PI * 1.08, Math.PI * 1.48); c2.stroke();
  c2.fillStyle = col;
  for (const i of [3, 5, 7, 9]) {
    const p = P[i]; if (!p) continue;
    c2.beginPath(); c2.arc(p.x, p.y, Math.max(1.3, 1.8 * sc), 0, TAU); c2.fill();
  }
  const cx = P[1].x * .38 + P[2].x * .62, cy = P[1].y * .38 + P[2].y * .62;
  c2.globalAlpha *= .7; c2.fillStyle = '#ffffff'; c2.beginPath(); c2.arc(cx, cy, Math.max(.8, 1.3 * sc), 0, TAU); c2.fill();
  c2.restore();
}

function drawFighter(f) {
  if (!f.alive && f.shatterT > 0) return;          // K.O.'d: the body burst into neon pieces (36-shatter)
  const P = f.P, sc = f.scale, base = fighterAlpha(f);
  ctx.save();
  postfxSquash(ctx, f);                            // squash and stretch on hits (84)
  ctx.globalAlpha = base; ctx.lineCap = ctx.lineJoin = 'round';
  drawFighterShadow(f);
  drawTrail(f, base);
  drawFighterUnder(f);                             // v3: hoverboard, dragon (22-moves dispatches)
  if (f.alive && (f.status.haste || f.dashT > 0)) {   // velocity-led afterimages, not a fixed sideways duplicate
    const torso = P[2], speedX = vx(torso), speedY = vy(torso);
    const mag = Math.hypot(speedX, speedY), inv = mag > 1 ? 1 / mag : 0;
    const backX = mag > 70 ? -speedX * inv : -f.face, backY = mag > 70 ? -speedY * inv : 0;
    const streak = clamp(mag * .018, 13, 30) * sc;
    ctx.save();
    for (let ghost = 2; ghost >= 1; ghost--) {
      ctx.globalAlpha = base * (ghost === 1 ? .16 : .075);
      ctx.translate(backX * streak * .46, backY * streak * .46);
      drawBody(f, f.status.haste ? '#b9f8ff' : f.color, (6 - ghost * .55) * sc);
    }
    ctx.restore(); ctx.globalAlpha = base;
  }
  const look = lookOf(f), hm = f.headMul || 1;      // 78-outfits: outfit, weapon skins; 79: big-heads mutator
  drawFighterEnergy(f, sc);
  outfitDraw(ctx, f, look, 'back', G_STATE.t);
  artBody(f, bodyColor(f), sc);                    // in the arena's art style (59)
  outfitDraw(ctx, f, look, 'front', G_STATE.t);
  circle(ctx, P[0].x + f.face * 6 * sc * hm, P[0].y - 2 * sc * hm, (f.alive ? 3 : 1.5) * sc * hm, '#0b0c18');   // eye
  drawHat(f);
  for (const rig of rigsOf(f)) if (f.P[rig.hand] && f.P[rig.tip]) {   // a rig can outlive its points (replay ghosts)
    const view = weaponView(f, rig);
    artWeaponShadow(f, rig, view); skinDrawWeapon(ctx, f, rig, view, look);   // paper: a shadow first (59)
    drawWeaponEdgePass(ctx, f, rig, view);
  }
  drawFighterDetailPass(ctx, f);
  drawUpgradeDamageFlash(f);                      // crisp, short-lived impact response (visual only)
  drawStatusOverlays(f);
  for (const key of f.skills) if (key && SKILLS[key] && SKILLS[key].draw) hook(SKILLS[key], 'draw', ctx, f);
  drawFighterOver(f);                              // v3: guard arc, element glow, Lv3 trail, mech/jetpack, ultimates
  ctx.restore();
  if (f.alive && !photoHidesHud()) drawTags(f);    // photo mode (86) without HUD: no name tags or status icons
}

// Name tag for humans (so players can find themselves) and active status icons, above the head.
// How far a hat reaches above the head centre, in head radii: measured once per hat from its drawn pixels, so tall
// hats (wizard, top hat, kabuto...) push the name tag and status icons up instead of hiding them.
const HAT_REACH = {};
function hatReach(key) {
  if (!key || key === 'none' || !HATS[key]) return 0;
  if (HAT_REACH[key] != null) return HAT_REACH[key];
  HAT_REACH[key] = 2;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d'), r = HEAD_R;
    if (!g) return HAT_REACH[key];                  // WebKit hands back null when canvas memory runs out
    g.translate(80, 120);
    HATS[key].draw(g, { id: 0, P: [{ x: 0, y: 0 }], face: 1 }, { r, face: 1, scale: 1, color: '#ffffff' });
    const d = g.getImageData(0, 0, 160, 160).data;
    let top = 120;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { top = Math.floor(i / 4 / 160); break; }
    HAT_REACH[key] = (120 - top) / r;
  } catch (e) { /* keep the default */ }
  return HAT_REACH[key];
}

function drawTags(f) {
  const lift = Math.max(HEAD_R + 20, hatReach(f.hat) * HEAD_R + 13) * (f.headMul || 1);
  const head = f.P[0], y = head.y - lift * f.scale, keys = Object.keys(f.status);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (f.ctrl === 'human' && !G_STATE.demo && fighterAlpha(f) > .3) {
    ctx.font = `12px ${FONT_DISPLAY}`; ctx.fillStyle = f.color; ctx.globalAlpha = .85;
    ctx.fillText(f.name, head.x, y - (keys.length ? 20 : 0));
    ctx.globalAlpha = 1;
  }
  if (!f.summon) accessTagMark(f, head.x, y - (keys.length ? 20 : 0));   // colour-blind marker (92-access)
  keys.slice(0, 5).forEach((k, i) => {
    const def = STATUS[k], s = f.status[k], x = head.x + (i - (Math.min(keys.length, 5) - 1) / 2) * 19;
    hudBadge(x, y, 8, null, 0, def.color, 10, def.icon);
    ctx.strokeStyle = def.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(s.t / s.max, 0, 1)); ctx.stroke();
  });
}

// Default projectiles are batched by colour and size: a faint wide trail, a bright narrow one and a white-hot core
// fake a glow without shadowBlur. Projectiles with their own draw() are drawn one by one.
function drawProjectiles() {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const groups = new Map();
  for (const p of PROJ) {
    if (p.draw) { hook(p, 'draw', ctx, p); continue; }
    const key = p.color + '|' + p.r;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { color: p.color, r: p.r, list: [] });
    g.list.push(p);
  }
  for (const g of groups.values()) {
    ctx.beginPath();
    for (const p of g.list) {
      const tr = p.tr;
      if (tr.length < 4) continue;
      ctx.moveTo(tr[0], tr[1]);
      for (let k = 2; k < tr.length; k += 2) ctx.lineTo(tr[k], tr[k + 1]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = rgba(g.color, .25); ctx.lineWidth = g.r * 4; ctx.stroke();
    ctx.strokeStyle = g.color; ctx.lineWidth = g.r * 1.5; ctx.stroke();
    ctx.beginPath();
    for (const p of g.list) { ctx.moveTo(p.x + g.r * 1.2, p.y); ctx.arc(p.x, p.y, g.r * 1.2, 0, TAU); }
    ctx.fillStyle = g.color; ctx.fill();
    ctx.beginPath();
    for (const p of g.list) { ctx.moveTo(p.x + g.r * .6, p.y); ctx.arc(p.x, p.y, g.r * .6, 0, TAU); }
    ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  // Velocity-led tail sheens make fast shots read clearly against busy arenas. This is a single
  // narrow stroke per projectile, layered over the batched trails above to keep the renderer cheap.
  ctx.save(); ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
  const qualityCap = SETTINGS.quality === 'low' ? 12 : SETTINGS.quality === 'medium' ? 36 : 72;
  const streakLimit = Math.min(PROJ.length, Math.max(8, Math.round(qualityCap * (PARTICLE_MULS[SETTINGS.particles] || 1))));
  let streaks = 0;
  for (let i = PROJ.length - 1; i >= 0 && streaks < streakLimit; i--) {
    const p = PROJ[i];
    if (p.draw || p.trail === false || !(p.r > 0)) continue;
    const speed = Math.hypot(p.vx || 0, p.vy || 0);
    if (speed < 300) continue;
    const ux = (p.vx || 0) / speed, uy = (p.vy || 0) / speed;
    const len = Math.min(25, 5 + speed * .004) * clamp(p.r / 5, .65, 1.7);
    const tail = ctx.createLinearGradient(p.x - ux * len, p.y - uy * len, p.x, p.y);
    tail.addColorStop(0, rgba(p.color, 0)); tail.addColorStop(.68, rgba(p.color, .38)); tail.addColorStop(1, 'rgba(255,255,255,.86)');
    ctx.strokeStyle = tail; ctx.lineWidth = Math.max(.8, p.r * .52);
    ctx.beginPath(); ctx.moveTo(p.x - ux * len, p.y - uy * len); ctx.lineTo(p.x, p.y); ctx.stroke();
    streaks++;
  }
  ctx.restore();
}

// Arrows at the screen edge for fighters launched out of view (drawn in arena coordinates).
function drawOffscreen() {
  const s = CAM.z, left = CAM.x - W / (2 * s), top = CAM.y - VIEW.hv / (2 * s), y0 = VIEW.top, y1 = VIEW.top + VIEW.hv;
  for (const f of F) {
    if (!f.alive) continue;
    const head = f.P[0], sx = (head.x - left) * s, sy = (head.y - top) * s + y0;
    if (sx > -10 && sx < W + 10 && sy > y0 - 10 && sy < y1 + 10) continue;
    const x = clamp(sx, 26, W - 26), y = clamp(sy, y0 + 26, y1 - 26), a = Math.atan2(sy - y, sx - x);
    const pulse = .5 + .5 * Math.sin(G_STATE.t * 5.5 + f.id * 1.9);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .18 + pulse * .12; ctx.strokeStyle = f.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 15 + pulse * 3, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.globalAlpha = .28 + pulse * .12; poly(ctx, [[17, 0], [-10, -12], [-10, 12]], f.color, f.color, 1);
    ctx.globalAlpha = 1; poly(ctx, [[14, 0], [-8, -9], [-8, 9]], f.color, '#07080f', 2);
    ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(8, 0); ctx.stroke();
    ctx.restore();
    const bx = x - Math.cos(a) * 20, by = y - Math.sin(a) * 20;
    circle(ctx, bx, by, 9, 'rgba(8,9,20,.88)', rgba(f.color, .65 + pulse * .25), 2);
    circle(ctx, bx, by, 3.2, f.color);
  }
}

// ---------- HUD ----------
function fillBar(x, y, w, h, frac, right) {
  const fw = w * clamp(frac, 0, 1);
  ctx.fillRect(right ? x + w - fw : x, y, fw, h);
}

// A round HUD badge: a dark disc, a ring when given, the icon in the middle.
function hudBadge(x, y, r, ring, lw, col, px, icon) {
  circle(ctx, x, y, r, 'rgba(8,9,20,.85)', ring, lw);
  ctx.fillStyle = col; ctx.font = `600 ${px}px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(icon, x, y + .5);
}

function drawSkillIcon(f, k, x, y) {
  const def = SKILLS[f.skills[k]], cd = f.skillCd[k], frac = clamp(cd / def.cd, 0, 1), ready = cd <= 0, r = 13;
  hudBadge(x, y, r, rgba(def.color, ready ? .95 : .35), 2, ready ? def.color : rgba(def.color, .4), 13, def.icon);
  if (!ready) {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.closePath(); ctx.fill();
  }
  if (f.ctrl === 'human' && !f.autopilot && typeof keyHint === 'function') {
    ctx.font = `600 10px ${FONT_BODY}`; ctx.fillStyle = '#9096c2';
    ctx.fillText(keyHint(f.slot, 'skill' + (k + 1)), x, y + r + 9);
  }
}

// Ammo pips (or a count for big magazines) and a reload bar. Returns the width used.
function drawAmmo(f, x, y, dir) {
  const r = f.w.ranged, w = 70;
  ctx.textAlign = dir > 0 ? 'left' : 'right'; ctx.textBaseline = 'middle'; ctx.font = `600 12px ${FONT_BODY}`;
  if (f.reload > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(dir > 0 ? x : x - w, y - 3, w, 6);
    ctx.fillStyle = f.w.color; const fw = w * (1 - f.reload / r.reload); ctx.fillRect(dir > 0 ? x : x - fw, y - 3, fw, 6);
    ctx.fillStyle = '#c9cdee'; ctx.fillText('RELOAD', x, y - 11);
    return w;
  }
  const cap = ammoCap(f);
  if (cap <= 12) {
    for (let k = 0; k < cap; k++) {
      ctx.fillStyle = k < f.ammo ? f.w.color : 'rgba(255,255,255,.14)';
      ctx.fillRect(x + dir * k * 7 - (dir < 0 ? 4 : 0), y - 7, 4, 14);
    }
    return cap * 7;
  }
  ctx.fillStyle = f.w.color; ctx.fillText(`${f.ammo}/${cap}`, x, y);
  return 44;
}

// Readability on bright arenas: one dark rounded plate behind every card (filled once, so overlaps don't double up)
// and a soft dark shadow under card text.
function hudPlatePath(rects) {
  ctx.beginPath();
  for (const [x, y, w, h] of rects) {
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10); else ctx.rect(x, y, w, h);
  }
}
function hudTextShadow(on) {
  ctx.shadowColor = on ? 'rgba(0,0,0,.9)' : 'transparent'; ctx.shadowBlur = on ? 3 : 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = on ? 1 : 0;
}

// Finishing pass for health bars: a restrained gloss, dark lower bevel, 10% scale marks and a fine rim.
// It is clipped to the actual filled health so damage remains immediately legible.
function drawHealthBarFinish(x, y, w, h, frac, right) {
  const liveW = w * clamp(frac, 0, 1), liveX = right ? x + w - liveW : x;
  ctx.save();
  if (liveW > 0) {
    ctx.beginPath(); ctx.rect(liveX, y, liveW, h); ctx.clip();
    const gloss = ctx.createLinearGradient(0, y, 0, y + h);
    gloss.addColorStop(0, 'rgba(255,255,255,.24)');
    gloss.addColorStop(.35, 'rgba(255,255,255,.055)');
    gloss.addColorStop(1, 'rgba(0,0,0,.19)');
    ctx.fillStyle = gloss; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const xx = x + w * i / 10;
      ctx.beginPath(); ctx.moveTo(xx, y + 3); ctx.lineTo(xx, y + h - 3); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(230,238,255,.26)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), 1);
}

function drawCard(f, x, y, w, right) {
  f.hpShow = lerp(f.hpShow, f.hp, .08);
  const dir = right ? -1 : 1, ax = right ? x + w : x;
  const cw = drawClassIcon(f, ax + dir * 9, y - 14);
  hudTextShadow(true);
  ctx.font = `17px ${FONT_DISPLAY}`; ctx.fillStyle = f.color; ctx.textAlign = right ? 'right' : 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(f.name, ax + dir * cw, y - 8);
  const nw = ctx.measureText(f.name).width + cw;
  ctx.font = `600 14px ${FONT_BODY}`; ctx.fillStyle = f.element && ELEMENTS[f.element] ? ELEMENTS[f.element].color : '#dfe2fa';
  const wl = weaponLabel(f) + (f.off && !f.off.w.hidden ? ' + ' + f.off.w.name : '');
  ctx.fillText(wl, ax + dir * (nw + 12), y - 8);
  const wlEnd = nw + 18 + ctx.measureText(wl).width;
  hudTextShadow(false);
  if (f.lvl > 1) drawLevelTag(f, ax + dir * wlEnd, y - 13, dir);
  const tx = ax + dir * (wlEnd + (f.lvl > 1 ? 34 : 2));
  aiPersonaHudTag(f, tx, y - 13, dir);   // the CPU rival's title (67)
  if (f.hcap) duoBadge(f, tx, y - 13, dir);   // handicap (73)
  hudHealth(f, x, y, w, 18, right);
  drawMeters(f, x, y + 21, w, right, 4);
  let cx = ax + dir * 13;
  const ry = y + 46;
  for (let k = 0; k < 2; k++) if (f.skills[k]) { drawSkillIcon(f, k, cx, ry); cx += dir * 32; }
  cx = drawThrowIcons(f, cx, ry, dir);
  if (f.w.ranged) cx += dir * (drawAmmo(f, cx - dir * 4, ry, dir) + 8);
  if (f.mount) cx = drawMountTimer(f, cx, ry, dir);
  drawCardStatuses(f, cx, ry, dir);
  drawPips(f.team, right ? x + 7 : x + w - 7, ry, -dir);
}

// A card's health bar (h 18 full, 12 compact), its damage ghost, low-health pulse (full cards) and number.
function hudHealth(f, x, y, w, h, right) {
  const frac = f.hp / f.maxHp, big = h > 12, p = big ? 3 : 2;
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - p, y - p, w + p * 2, h + p * 2);
  ctx.fillStyle = rgba('#ffffff', big ? .45 : .4); fillBar(x, y, w, h, f.hpShow / f.maxHp, right);
  ctx.fillStyle = f.alive ? f.color : '#444a66'; fillBar(x, y, w, h, frac, right);
  if (big && f.alive && frac < .25) { ctx.fillStyle = `rgba(255,60,90,${.25 + .2 * Math.sin(G_STATE.t * 10)})`; fillBar(x, y, w, h, frac, right); }
  drawHealthBarFinish(x, y, w, h, frac, right);   // v5: gloss and tick marks
  accessCardMark(f, x, y, w, h, right);   // colour-blind marker + pattern (92-access)
  ctx.font = `700 ${big ? 12 : 10}px ${FONT_BODY}`; ctx.textBaseline = 'middle'; ctx.textAlign = right ? 'left' : 'right';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(7,8,15,.85)'; ctx.fillStyle = '#ffffff'; ctx.lineJoin = 'round';
  const t = f.alive ? String(Math.ceil(f.hp)) : 'K.O.', hx = right ? x + 6 : x + w - p * 2, hy = y + h / 2 + p / 3;
  ctx.strokeText(t, hx, hy); ctx.fillText(t, hx, hy);
}

// ---------- v3 HUD pieces ----------
// Class badge before the name. Returns the width it took.
function drawClassIcon(f, x, y) {
  if (!f.cls || f.cls.key === 'none') return 0;
  hudBadge(x, y, 9, f.cls.color, 1.5, f.cls.color, 11, f.cls.icon);
  return 22;
}
function drawLevelTag(f, x, y, dir) {
  const txt = 'LV' + f.lvl, col = f.lvl >= 3 ? '#ffd84a' : '#5ef2ff';
  ctx.font = `11px ${FONT_DISPLAY}`; ctx.textBaseline = 'middle'; ctx.textAlign = dir > 0 ? 'left' : 'right';
  glow(ctx, col, f.lvl >= 3 ? 10 : 0, () => { ctx.fillStyle = col; ctx.fillText(txt, x, y); });
}
// Stamina (thin, cyan) and super meter (gold, glowing and labelled when full) under the health bar.
function drawMeters(f, x, y, w, right, h) {
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 3, y - 1, w + 6, h * 2 + 5);
  const st = f.stamina / (f.maxStamina || 100);
  ctx.fillStyle = f.guardBroken > 0 ? '#ff8a2e' : f.blocking ? '#ffffff' : '#7fd8ff'; fillBar(x, y, w, h - 1, st, right);
  const full = f.super >= 100, sy = y + h + 1;
  ctx.fillStyle = 'rgba(255,216,74,.18)'; ctx.fillRect(x, sy, w, h + 1);
  if (full) glow(ctx, '#ffd84a', 12 + 6 * Math.sin(G_STATE.t * 8), () => { ctx.fillStyle = '#ffd84a'; ctx.fillRect(x, sy, w, h + 1); });
  else { ctx.fillStyle = '#c9a43a'; fillBar(x, sy, w, h + 1, f.super / 100, right); }
  if (full && h >= 4 && f.ctrl === 'human' && !f.autopilot && typeof keyHint === 'function') {
    ctx.font = `10px ${FONT_DISPLAY}`; ctx.fillStyle = '#07080f'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const k = keyHint(f.slot, 'super');   // '' on the touch screen
    ctx.fillText(k ? 'SUPER · ' + k : 'SUPER', x + w / 2, sy + 3);
  }
}
// The two throwables with how many are left.
function drawThrowIcons(f, cx, y, dir) {
  for (let k = 0; k < 2; k++) {
    const def = THROWABLES[f.throws[k]];
    if (!def) continue;
    const n = f.throwN[k];
    hudBadge(cx, y, 10, rgba(def.color, n > 0 ? .9 : .25), 1.5, n > 0 ? def.color : rgba(def.color, .3), 11, def.icon);
    if (n > 1) { ctx.font = `700 9px ${FONT_BODY}`; ctx.fillStyle = '#ffffff'; ctx.fillText('×' + n, cx + 9, y + 9); }
    cx += dir * 25;
  }
  return cx + dir * 4;
}
function drawMountTimer(f, cx, y, dir) {
  const def = MOUNTS[f.mount.key], frac = clamp(f.mount.t / def.time, 0, 1);
  hudBadge(cx + dir * 4, y, 11, null, 0, def.color, 12, def.icon);
  ctx.strokeStyle = def.color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx + dir * 4, y, 11, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
  return cx + dir * 30;
}

// Small card for crowded matches (5-8 fighters): name, health, stamina + super, round pips.
function drawCompactCard(f, x, y, w) {
  f.hpShow = lerp(f.hpShow, f.hp, .08);
  const cw = drawClassIcon(f, x + 9, y - 10);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  hudTextShadow(true);
  ctx.font = `13px ${FONT_DISPLAY}`; ctx.fillStyle = f.color; ctx.fillText(f.name, x + cw, y - 5);
  const nw = ctx.measureText(f.name).width + cw;
  ctx.font = `600 11px ${FONT_BODY}`; ctx.fillStyle = '#c4c9ee';
  const cwl = weaponLabel(f) + (f.lvl > 1 ? ' LV' + f.lvl : '') + (f.mount ? ' · ' + MOUNTS[f.mount.key].name : '');
  ctx.fillText(cwl, x + nw + 8, y - 5);
  hudTextShadow(false);
  aiPersonaHudTag(f, x + nw + 20 + ctx.measureText(cwl).width, y - 9, 1);   // the CPU rival's title (67)
  hudHealth(f, x, y, w, 12, false);
  drawMeters(f, x, y + 15, w, false, 3);
  const n = Math.min(G_STATE.winScore, 9), won = G_STATE.score[f.team] || 0;
  for (let k = 0; k < n; k++) circle(ctx, x + w - 4 - k * 11, y - 10, 3.5, k < won ? f.color : 'rgba(255,255,255,.14)');
}

function drawCardStatuses(f, x, y, dir) {
  let k = 0;
  for (const name in f.status) {
    const def = STATUS[name];
    hudBadge(x + dir * (k * 22 + 8), y, 9, rgba(def.color, .8), 1.5, def.color, 11, def.icon);
    if (++k >= 5) break;
  }
}

// Round-win pips for a team, drawn from x toward dir.
function drawPips(team, x, y, dir) {
  const n = Math.min(G_STATE.winScore, 9), won = G_STATE.score[team] || 0, color = teamColor(team);
  for (let k = 0; k < n; k++) circle(ctx, x + dir * k * 18, y, 6, k < won ? color : 'rgba(255,255,255,.12)');
}

const midGap0 = (two, Wh, cw) => two && Wh - 68 - 2 * cw >= 130;
function drawHUD() {
  if (G_STATE.demo || G_STATE.state === 'killcam') return;   // replays (88) show their own caption; the attract demo plays behind the menus without health bars (added by the UI slice)
  const cards = F.filter(f => !f.summon);   // summoned helpers (e.g. decoys) get no health card
  const n = cards.length;
  if (!n) return;
  // Scaled by VIEW.hudK around the top centre, so on small screens the cards fit in the narrower width Wh (in rows).
  const k = VIEW.hudK, hs = VIEW.s * k, Wh = VIEW.hudW, L = (W - Wh) / 2, { two, compact, perRow, rows, rowH } = hudGrid(n);
  ctx.setTransform(hs, 0, 0, hs, VIEW.cx - W / 2 * hs, VIEW.hudY);
  const cw = two ? Math.min(430, Math.floor((Wh - 92) / 2)) : Math.floor((Wh - 60 - (perRow - 1) * 16) / perRow);
  const cardX = (i) => two ? (i === 1 ? L + Wh - 34 - cw : L + 34) : L + 30 + (i % perRow) * (cw + 16);
  const cardY = (i) => (compact ? 26 : 30) + (two ? 0 : Math.floor(i / perRow)) * rowH;
  const plates = cards.map((f, i) => compact ? [cardX(i) - 8, cardY(i) - 24, cw + 16, 52] : [cardX(i) - 10, cardY(i) - 32, cw + 20, 100]);
  const midGap = midGap0(two, Wh, cw), centre = W / 2, cy = midGap ? 52 : (compact ? 22 : 30) + rows * rowH;   // midGap: room for the round label between two cards
  plates.push([W / 2 - 62, cy - 21, 124, G_STATE.roundLimit - G_STATE.roundT < 10 && !G_STATE.ending ? 56 : 28]);   // round label + countdown
  hudPlatePath(plates); ctx.fillStyle = 'rgba(8,9,22,.55)'; ctx.fill();
  cards.forEach((f, i) => (compact ? drawCompactCard : drawCard)(f, cardX(i), cardY(i), cw, two && i === 1));
  hudTextShadow(false);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `15px ${FONT_DISPLAY}`; ctx.fillStyle = '#c4c9ee';
  ctx.fillText(G_STATE.demo ? 'DEMO' : hook(G_STATE.mode, 'roundLabel') || 'ROUND ' + G_STATE.round, centre, cy);   // modes may relabel (WAVE 3)
  const left = G_STATE.roundLimit - G_STATE.roundT;
  wxDrawAnnounce(ctx, centre, cy + 14);   // weather card under the round label (58)
  if (!G_STATE.demo && !G_STATE.ending && left < 10 && left > 0) {
    ctx.font = `22px ${FONT_DISPLAY}`; ctx.fillStyle = left < 4 ? '#ff4a6a' : '#ffd84a';
    ctx.fillText(Math.ceil(left), centre, cy + 26);
  }
  ctx.translate(0, (rows - 1) * rowH + (compact ? rowH - 84 : 8) + (two && !midGap ? 54 : 0));   // mode HUDs sit below the (taller) card block
  hook(G_STATE.mode, 'hud', ctx);
  miniDraw(ctx);                 // party mini-game scoreboard (79)
  if (MUTED) {                   // at the viewport's bottom corner, wherever the HUD block went
    setArenaTransform();
    ctx.font = `600 12px ${FONT_BODY}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(200,205,240,.55)';
    ctx.fillText('MUTED (M)', W - 14, H - 12);
  }
}

// ---------- banners ----------
// Big centred text: `a` first, then `b` (e.g. "ROUND 2" then "FIGHT!").
function banner(a, b = '', len = 1.6, color = null) { BANNER = { a, b, t: 0, len, color }; }

// Lines stay whole (long names, mini-game rules): shrunk to fit W - 80, or a subtitle under BANNER_MIN px split in two.
const BANNER_PX = 84, BANNER_MIN = 56;
function bannerFit(txt, wrap) {
  ctx.font = `${BANNER_PX}px ${FONT_DISPLAY}`;
  const fit = lines => {
    const w = Math.max(...lines.map(s => ctx.measureText(s).width)), px = Math.floor(BANNER_PX * Math.min(1, (W - 80) / w));
    return { lines, px, w: w * px / BANNER_PX };
  };
  const words = txt.split(' ');
  let best = fit([txt]);
  if (wrap && best.px < BANNER_MIN) for (let i = 1; i < words.length; i++) {
    const two = fit([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
    if (two.px > best.px) best = two;
  }
  return best;
}
const BANNER_CALM = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

function drawBanner(dt) {
  const B = BANNER;
  if (!B || G_STATE.demo) return;
  B.t += dt;
  if (B.t > B.len) { BANNER = null; return; }
  const half = B.b ? B.len * .55 : B.len, second = B.t >= half, txt = second ? B.b : B.a;
  if (!txt) return;
  const fit = (B.fit || (B.fit = []))[+second] || (B.fit[+second] = bannerFit(txt, second));
  // The pop-in never pushes a long line off screen; reduced motion (setting or system) skips it.
  const calm = SETTINGS.reduceFlash || (BANNER_CALM && BANNER_CALM.matches);
  const local = second ? B.t - half : B.t, sc = calm ? 1 : Math.min(1 + Math.max(0, .35 - local) * 1.5, (W - 40) / fit.w);
  const color = B.color || (txt === 'K.O.' ? '#ff4a6a' : '#ffd84a'), ys = fit.lines.map((s, i) => (i - (fit.lines.length - 1) / 2) * fit.px * 1.1);
  ctx.save();
  ctx.globalAlpha = clamp((B.len - B.t) * 5, 0, 1);
  ctx.translate(W / 2, H / 2 - 60); ctx.scale(sc, sc);
  ctx.font = `${fit.px}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 12 * fit.px / BANNER_PX; ctx.strokeStyle = '#07080f';
  fit.lines.forEach((s, i) => ctx.strokeText(s, 0, ys[i]));
  ctx.fillStyle = color;
  glow(ctx, color, 26, () => fit.lines.forEach((s, i) => ctx.fillText(s, 0, ys[i])));
  ctx.restore();
}

// The colour of the sky at the arena's top edge: what shows above y = 0 when the camera rises past it. Maps that draw
// with mapSky (60) record their live top colour; the others name a skyTop; the palette is the fallback.
const mapSkyTop = m => (m && ((artStyleOf(m).key !== 'neon' && m.art && m.art.top) || m.skyTopLive || m.skyTop || (m.palette && m.palette.sky1))) || '#05060c';
on('boot', () => { if (window.SC) SC.view = { VIEW, CAM }; });   // layout + camera for the smoke tests

// ---------- frame ----------
let VIGNETTE = null;
function drawScreenOverlays(dt) {
  const y0 = VIEW.top, vh = VIEW.hv;   // the whole viewport (taller than 720 on portrait screens)
  if (FX.slow > 0) { ctx.fillStyle = `rgba(255,40,90,${Math.min(.12, FX.slow * .1)})`; ctx.fillRect(0, y0, W, vh); }
  if (FX.flashA > 0) {
    ctx.globalAlpha = FX.flashA; ctx.fillStyle = FX.flash; ctx.fillRect(0, y0, W, vh); ctx.globalAlpha = 1;
    FX.flashA = Math.max(0, FX.flashA - dt * 1.8);
  }
  const edge = (ART.style && ART.style.vignette) || 'rgba(0,0,0,.38)';   // per art style (59)
  if (!VIGNETTE || VIGNETTE.edge !== edge) {
    VIGNETTE = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .95);
    VIGNETTE.addColorStop(0, 'rgba(0,0,0,0)'); VIGNETTE.addColorStop(1, edge); VIGNETTE.edge = edge;
  }
  ctx.fillStyle = VIGNETTE; ctx.fillRect(0, y0, W, vh);
}

// The arena and everything in it, in world coordinates.
function drawWorld(dt, t, sx, sy) {
  setWorldTransform(sx, sy);
  if (typeof MAP.drawBg === 'function') hook(MAP, 'drawBg', ctx, t); else drawStdBackground(ctx, MAP, t);
  drawAmbientLayer(ctx, MAP, t);  // map-family weather and drifting motes, behind all gameplay geometry
  artSurfaces(ctx, true);    // paper: card shadows
  for (const hz of MAP.hazards) drawHazard(ctx, hz, MAP, t);
  for (const s of MAP.solids) drawSolid(ctx, s, MAP, t);
  artSurfaces(ctx, false);
  drawOrbs();
  juiceDrawWorld(ctx, dt);   // landing dust, speed streaks (87)
  if (dt > 0) for (const f of F) recordTrail(f);
  for (const f of F) if (!f.alive) drawFighter(f);
  for (const f of F) if (f.alive) drawFighter(f);
  shatterDraw(ctx);          // neon limbs of K.O.'d fighters (36)
  koFxDraw(ctx); petsDraw(ctx); miniDrawWorld(ctx);   // K.O. effects, pets (78), mini-game props (79)
  drawProjectiles();
  ART.dots = 1; drawFx(ctx); ART.dots = 0;   // particles in the art style's shape (59)
  drawCombatMarks(ctx);  // signature marks for weapon-specific hit feedback
  hook(MAP, 'drawFg', ctx, t);
  worldDrawTop(ctx, t);      // weather, darkness and lights (58)
  postfxDrawWorld(ctx);      // dynamic lights, impact sparks and flashes (84)
  hook(G_STATE.mode, 'drawWorld', ctx);
}

function render(dt) {
  if (!CTX_MAIN) return;                           // no 2D context (WebKit out of canvas memory): nothing to draw with
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = (MAP && artStyleOf(MAP).frame) || '#05060c'; ctx.fillRect(0, 0, cv.width, cv.height);   // letterbox: the art style's frame (59)
  if (!MAP) return;
  kcRecord();   // kill-cam snapshot of this frame (88)
  updateCamera(dt);
  const t = G_STATE.t, sh = FX.shake * VIEW.s;
  FX.shake = FX.shake > .2 ? FX.shake * Math.pow(.86, dt * 60) : 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(VIEW.vx, VIEW.vy, VIEW.vw, VIEW.vh); ctx.clip();
  ctx.fillStyle = mapSkyTop(MAP); ctx.fillRect(VIEW.vx, VIEW.vy, VIEW.vw, VIEW.vh);   // sky above the arena when the camera rises past it
  const sx = (Math.random() - .5) * sh, sy = (Math.random() - .5) * sh;
  artWorld(() => drawWorld(dt, t, sx, sy));     // in the arena's art style (59-styles)
  setWorldTransform(sx, sy);
  if (!photoHidesHud()) aiTalkDraw(ctx);   // CPU speech bubbles (67), unstyled, hidden with the HUD in photo mode
  setArenaTransform();
  drawScreenOverlays(dt);
  juiceDrawScreen(ctx, dt);   // K.O. chroma/vignette, low-health heartbeat (87)
  if (!photoHidesHud()) drawOffscreen();
  postfxFrame(dt);           // bloom (84) from the finished arena, before the HUD so menus and numbers don't glow
  ctx.restore();             // the HUD may sit outside the world viewport (portrait: in the band above it)
  ctx.save();
  if (!photoHidesHud()) {     // photo mode (86) can hide the HUD, banners and cut-ins
    drawHUD();
    setArenaTransform();
    drawBanner(dt);
    powerDrawScreen(ctx, dt);   // the ultimate's cut-in band, above banners (33)
  }
  setArenaTransform();
  kcDrawOverlay(ctx);   // replay letterbox (88)
  photoDrawScreen(ctx);       // photo filters' overlays and frames (86)
  ctx.restore();
  hlRecordFrame();            // highlight video export copies the finished frame (89)
}
