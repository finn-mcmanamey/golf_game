// 85-render.js: canvas setup, the dynamic camera (drawing only: it never changes the game), world drawing (map,
// hazards, platforms, orbs, fighters, weapons, projectiles, effects) and the HUD (health, skills, ammo, statuses,
// round pips) plus big banners. Everything is drawn in arena units (1280x720) and scaled to fit the window.

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
// VIEW: s = arena px -> canvas px; (vx, vy, vw, vh) = the world viewport on the canvas; (ox, oy) = where the 1280x720
// "screen" of overlays and banners sits (centred in the viewport); hv = viewport height in arena units; zMin = the
// least camera zoom that keeps the view inside the arena; hudK = extra HUD scale so its text stays readable; hudY = top
// of the HUD (canvas px). On a landscape screen the viewport is the letterboxed 16:9 arena (hv = H, zMin = 1).
const VIEW = { s: 1, ox: 0, oy: 0, dpr: 1, vx: 0, vy: 0, vw: W, vh: H, cx: W / 2, cy: H / 2, hv: H, top: 0, zMin: 1, hudK: 1, hudW: W, hudY: 0 };
const VIEW_HUD_CSS = .72;      // smallest on-screen (CSS px) scale for HUD text: 15px HUD text stays ~11px
const CAM = { x: W / 2, y: H / 2, z: 1, fx: 0, fy: 0, focusT: 0, follow: store.getBool('camera', true), maxZoom: 1.24,
  punch: 0 };   // punch: brief extra zoom on heavy hits (set by 87-juice, decays here)
let BANNER = null;

// The frame cost grows with pixels (sky gradients, glows, vignettes), and the arena is a fixed 1280x720 drawing, so
// the backing store is capped at about 2.3 megapixels and CSS scales it up on big or high-DPI screens.
const MAX_CANVAS_PIXELS = 2.3e6;
function resize() {
  const css = Math.max(1, innerWidth * innerHeight);
  const dpr = Math.max(.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_CANVAS_PIXELS / css)));
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  VIEW.dpr = dpr;
  // Portrait (after "Play in portrait anyway"): a 16:9 strip would leave fighters tiny, so the viewport fills the
  // width and is taller (up to ~square, between the HUD band and the thumb buttons); the camera zooms in to fill it.
  const portrait = cv.height > cv.width, s = portrait ? cv.width / W : Math.min(cv.width / W, cv.height / H);
  const vw = W * s, vh = portrait ? Math.round(Math.min(cv.height * .56, cv.width * 1.15)) : H * s;
  Object.assign(VIEW, { s, vw, vh, vx: (cv.width - vw) / 2, vy: portrait ? Math.round(cv.height * .19) : (cv.height - vh) / 2 });
  VIEW.cx = VIEW.vx + vw / 2; VIEW.cy = VIEW.vy + vh / 2;
  VIEW.ox = VIEW.vx; VIEW.oy = VIEW.cy - H * s / 2;
  VIEW.hv = vh / s; VIEW.top = (VIEW.vy - VIEW.oy) / s; VIEW.zMin = Math.max(1, VIEW.hv / H);
  VIEW.hudK = clamp(VIEW_HUD_CSS / (s / dpr), 1, 2.2); VIEW.hudW = W / VIEW.hudK;   // HUD layout width (centred)
  VIEW.hudY = portrait ? Math.round(cv.height * .075) : VIEW.oy;
}
addEventListener('resize', resize);
resize();

// ---------- camera ----------
function focusCamera(x, y, seconds = 1.1) { CAM.fx = x; CAM.fy = y; CAM.focusT = seconds; }

// Frames every living fighter, zooming in gently when they are close together.
function updateCamera(dt) {
  if (photoCamera()) return;   // photo mode's free camera (86)
  let tx = W / 2, ty = H / 2, tz = 1;
  const live = F.filter(f => f.alive);
  if (CAM.follow && live.length) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const f of live) for (const j of [0, 2, 8, 10]) {
      const p = f.P[j];
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    x0 -= 240; x1 += 240; y0 -= 200; y1 += 110;
    tz = clamp(Math.min(W / (x1 - x0), VIEW.hv / (y1 - y0)), VIEW.zMin, Math.max(CAM.maxZoom, VIEW.zMin * 1.12));
    tx = (x0 + x1) / 2; ty = (y0 + y1) / 2;
  }
  if (CAM.focusT > 0 && CAM.follow) { CAM.focusT -= dt; tz = Math.max(tz, 1.3 * VIEW.zMin); tx = CAM.fx; ty = CAM.fy; }
  tz = Math.max(tz, VIEW.zMin);
  const k = 1 - Math.exp(-dt * 3.5), kz = 1 - Math.exp(-dt * 2.4);
  CAM.z += (tz - CAM.z) * kz; CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k;
  CAM.z = Math.max(CAM.z, VIEW.zMin);
  CAM.punch *= Math.exp(-dt * 9);
  const hw = W / (2 * CAM.z), hh = VIEW.hv / (2 * CAM.z);   // never show outside the arena
  CAM.x = clamp(CAM.x, hw, W - hw); CAM.y = clamp(CAM.y, hh, H - hh);
}

function setWorldTransform(sx = 0, sy = 0) {
  const s = VIEW.s * CAM.z * (1 + CAM.punch);
  ctx.setTransform(s, 0, 0, s, VIEW.cx - CAM.x * s + sx, VIEW.cy - CAM.y * s + sy);
}
function setArenaTransform() { ctx.setTransform(VIEW.s, 0, 0, VIEW.s, VIEW.ox, VIEW.oy); }
// CSS pixel -> arena coordinates through the current camera (for pointer features).
function screenToWorld(px, py) {
  const s = VIEW.s * CAM.z, X = px * VIEW.dpr, Y = py * VIEW.dpr;
  return { x: (X - VIEW.cx) / s + CAM.x, y: (Y - VIEW.cy) / s + CAM.y };
}

// ---------- map drawing ----------
function glowLine(c2, x1, y1, x2, y2, color, width = 3) {
  glow(c2, color, 12, () => lineXY(c2, x1, y1, x2, y2, color, width));
}

// Dark ground with a perspective grid and a neon edge (v1's look), reusable by any map.
function drawGridFloor(c2, floor, fill, grid, edge) {
  c2.fillStyle = fill; c2.fillRect(0, floor, W, H - floor + 300);
  c2.strokeStyle = grid; c2.lineWidth = 1; c2.beginPath();
  for (let k = -12; k <= 12; k++) { c2.moveTo(W / 2 + k * 30, floor); c2.lineTo(W / 2 + k * 130, H); }
  for (let k = 1; k < 5; k++) { const y = floor + (H - floor) * (k / 5) ** 1.6; c2.moveTo(0, y); c2.lineTo(W, y); }
  c2.stroke();
  glowLine(c2, 0, floor, W, floor, edge);
}

// A ready-made backdrop from the map palette (used when a map has no drawBg).
function drawStdBackground(c2, m, t) {
  const p = m.palette, bottom = m.floor ?? H, sky = c2.createLinearGradient(0, 0, 0, bottom);
  sky.addColorStop(0, p.sky1); sky.addColorStop(1, p.sky2);
  c2.fillStyle = sky; c2.fillRect(0, 0, W, H);
  c2.fillStyle = 'rgba(255,255,255,.5)';
  for (let k = 0; k < 40; k++) {
    const x = (k * 233) % W, y = (k * 97) % (bottom * .6);
    c2.globalAlpha = .25 + .25 * Math.sin(t * 1.3 + k);
    c2.fillRect(x, y, 2, 2);
  }
  c2.globalAlpha = 1;
  if (m.floor != null) drawGridFloor(c2, m.floor, p.ground, rgba(p.line, .2), p.line);
  else {   // bottomless: a faint glow rising out of the void
    const v = c2.createLinearGradient(0, H - 160, 0, H);
    v.addColorStop(0, rgba(p.accent, 0)); v.addColorStop(1, rgba(p.accent, .18));
    c2.fillStyle = v; c2.fillRect(0, H - 160, W, 160);
  }
}

function drawSolid(c2, s, m, t) {
  if (s.draw) return hook(s, 'draw', c2, s, t);
  if (m.drawSolid) return hook(m, 'drawSolid', c2, s, t);
  const p = m.palette;
  c2.fillStyle = p.solid;
  c2.fillRect(s.x, s.y, s.w, s.oneWay ? Math.min(s.h, 14) : s.h);
  if (!s.oneWay) { c2.strokeStyle = rgba(p.line, .45); c2.lineWidth = 2; c2.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2); }
  glowLine(c2, s.x, s.y, s.x + s.w, s.y, s.move ? p.accent : p.line);
  if (s.move) for (const x of [s.x + 10, s.x + s.w - 10]) circle(c2, x, s.y + 7, 3, p.accent);
}

// Liquid pool with a wavy glowing surface and bubbles (lava, acid...).
function drawLiquid(c2, hz, t, light, dark) {
  const top = hz.y + 10, grad = c2.createLinearGradient(0, top, 0, hz.y + hz.h);
  grad.addColorStop(0, light); grad.addColorStop(1, dark);
  glow(c2, light, 24, () => {
    c2.beginPath(); c2.moveTo(hz.x, hz.y + hz.h);
    for (let x = 0; x <= hz.w; x += 8) c2.lineTo(hz.x + x, top + Math.sin(x * .05 + t * 3) * 3);
    c2.lineTo(hz.x + hz.w, hz.y + hz.h); c2.closePath();
    c2.fillStyle = grad; c2.fill();
  });
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
  spikes(c2, hz) {
    const n = Math.max(1, Math.round(hz.w / 18)), w = hz.w / n;
    for (let k = 0; k < n; k++) poly(c2, [[hz.x + k * w, hz.y + hz.h], [hz.x + k * w + w / 2, hz.y], [hz.x + (k + 1) * w, hz.y + hz.h]], '#c9cde6', '#5d6290', 1);
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
    ctx.save(); ctx.globalAlpha = fade; ctx.shadowColor = c; ctx.shadowBlur = 24;
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

// While swinging, a filled swoosh shows the arc of the attack so it reads clearly; otherwise a faint tip trail.
function drawTrail(f, base) {
  const tr = f.trail;
  if (tr.length < 2 || !f.alive) return;
  for (let k = 1; k < tr.length; k++) {
    const a = tr[k - 1], b = tr[k], age = k / tr.length;
    if (f.swingT > 0) {
      ctx.globalAlpha = base * age * .4 * Math.min(1, f.swingT / .12);
      poly(ctx, [{ x: a.hx, y: a.hy }, a, b, { x: b.hx, y: b.hy }], f.color);
    } else if (b.fast) {
      ctx.globalAlpha = base * age * .35;
      line(ctx, a, b, f.color, 2 + k);
    }
  }
  ctx.globalAlpha = base;
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

function drawFighter(f) {
  if (!f.alive && f.shatterT > 0) return;          // K.O.'d: the body burst into neon pieces (36-shatter)
  const P = f.P, sc = f.scale, base = fighterAlpha(f);
  ctx.save();
  postfxSquash(ctx, f);                            // squash and stretch on hits (84)
  ctx.globalAlpha = base; ctx.lineCap = ctx.lineJoin = 'round';
  drawTrail(f, base);
  drawFighterUnder(f);                             // v3: hoverboard, dragon (22-moves dispatches)
  if (f.alive && (f.status.haste || f.dashT > 0)) {   // afterimage
    ctx.globalAlpha = base * .22;
    ctx.save(); ctx.translate(-f.face * 16 * sc, 0); drawBody(f, f.color, 6 * sc); ctx.restore();
    ctx.globalAlpha = base;
  }
  const look = lookOf(f), hm = f.headMul || 1;      // 78-outfits: outfit, weapon skins; 79: big-heads mutator
  outfitDraw(ctx, f, look, 'back', G_STATE.t);
  glow(ctx, auraColor(f), f.alive ? (f.status.rage ? 22 : 10) : 0, () => drawBody(f, bodyColor(f), 7 * sc));
  outfitDraw(ctx, f, look, 'front', G_STATE.t);
  circle(ctx, P[0].x + f.face * 6 * sc * hm, P[0].y - 2 * sc * hm, (f.alive ? 3 : 1.5) * sc * hm, '#0b0c18');   // eye
  drawHat(f);
  for (const rig of rigsOf(f)) skinDrawWeapon(ctx, f, rig, weaponView(f, rig), look);
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
    circle(ctx, x, y, 8, 'rgba(8,9,20,.82)');
    ctx.strokeStyle = def.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(s.t / s.max, 0, 1)); ctx.stroke();
    ctx.fillStyle = def.color; ctx.font = `600 10px ${FONT_BODY}`; ctx.fillText(def.icon, x, y + .5);
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
}

// Arrows at the screen edge for fighters launched out of view (drawn in arena coordinates).
function drawOffscreen() {
  const s = CAM.z, left = CAM.x - W / (2 * s), top = CAM.y - VIEW.hv / (2 * s), y0 = VIEW.top, y1 = VIEW.top + VIEW.hv;
  for (const f of F) {
    if (!f.alive) continue;
    const head = f.P[0], sx = (head.x - left) * s, sy = (head.y - top) * s + y0;
    if (sx > -10 && sx < W + 10 && sy > y0 - 10 && sy < y1 + 10) continue;
    const x = clamp(sx, 26, W - 26), y = clamp(sy, y0 + 26, y1 - 26), a = Math.atan2(sy - y, sx - x);
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    poly(ctx, [[14, 0], [-8, -10], [-8, 10]], f.color, '#07080f', 2);
    ctx.restore();
    circle(ctx, x - Math.cos(a) * 20, y - Math.sin(a) * 20, 9, 'rgba(8,9,20,.8)', f.color, 2);
  }
}

// ---------- HUD ----------
function fillBar(x, y, w, h, frac, right) {
  const fw = w * clamp(frac, 0, 1);
  ctx.fillRect(right ? x + w - fw : x, y, fw, h);
}

function drawSkillIcon(f, k, x, y) {
  const def = SKILLS[f.skills[k]], cd = f.skillCd[k], frac = clamp(cd / def.cd, 0, 1), ready = cd <= 0, r = 13;
  circle(ctx, x, y, r, 'rgba(8,9,20,.85)', rgba(def.color, ready ? .95 : .35), 2);
  ctx.fillStyle = ready ? def.color : rgba(def.color, .4);
  ctx.font = `600 13px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(def.icon, x, y + 1);
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

function drawCard(f, x, y, w, right) {
  f.hpShow = lerp(f.hpShow, f.hp, .08);
  const dir = right ? -1 : 1, ax = right ? x + w : x, frac = f.hp / f.maxHp;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = right ? 'right' : 'left';
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
  aiPersonaHudTag(f, ax + dir * (wlEnd + (f.lvl > 1 ? 34 : 2)), y - 13, dir);   // the CPU rival's title (67)
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 3, y - 3, w + 6, 24);
  ctx.fillStyle = 'rgba(255,255,255,.45)'; fillBar(x, y, w, 18, f.hpShow / f.maxHp, right);
  ctx.fillStyle = f.alive ? f.color : '#444a66'; fillBar(x, y, w, 18, frac, right);
  if (f.alive && frac < .25) { ctx.fillStyle = `rgba(255,60,90,${.25 + .2 * Math.sin(G_STATE.t * 10)})`; fillBar(x, y, w, 18, frac, right); }
  accessCardMark(f, x, y, w, 18, right);   // colour-blind marker + pattern (92-access)
  ctx.font = `700 12px ${FONT_BODY}`; ctx.textBaseline = 'middle'; ctx.textAlign = right ? 'left' : 'right';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(7,8,15,.85)'; ctx.fillStyle = '#ffffff'; ctx.lineJoin = 'round';
  const hpText = f.alive ? String(Math.ceil(f.hp)) : 'K.O.', hx = right ? x + 6 : x + w - 6;
  ctx.strokeText(hpText, hx, y + 10); ctx.fillText(hpText, hx, y + 10);
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

// ---------- v3 HUD pieces ----------
// Class badge before the name. Returns the width it took.
function drawClassIcon(f, x, y) {
  if (!f.cls || f.cls.key === 'none') return 0;
  circle(ctx, x, y, 9, 'rgba(8,9,20,.85)', f.cls.color, 1.5);
  ctx.fillStyle = f.cls.color; ctx.font = `600 11px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(f.cls.icon, x, y + .5);
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
    ctx.fillText(`SUPER · ${keyHint(f.slot, 'super')}`, x + w / 2, sy + 3);
  }
}
// The two throwables with how many are left.
function drawThrowIcons(f, cx, y, dir) {
  for (let k = 0; k < 2; k++) {
    const def = THROWABLES[f.throws[k]];
    if (!def) continue;
    const n = f.throwN[k];
    circle(ctx, cx, y, 10, 'rgba(8,9,20,.85)', rgba(def.color, n > 0 ? .9 : .25), 1.5);
    ctx.fillStyle = n > 0 ? def.color : rgba(def.color, .3); ctx.font = `600 11px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, y + .5);
    if (n > 1) { ctx.font = `700 9px ${FONT_BODY}`; ctx.fillStyle = '#ffffff'; ctx.fillText('×' + n, cx + 9, y + 9); }
    cx += dir * 25;
  }
  return cx + dir * 4;
}
function drawMountTimer(f, cx, y, dir) {
  const def = MOUNTS[f.mount.key], frac = clamp(f.mount.t / def.time, 0, 1);
  circle(ctx, cx + dir * 4, y, 11, 'rgba(8,9,20,.85)');
  ctx.strokeStyle = def.color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx + dir * 4, y, 11, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
  ctx.fillStyle = def.color; ctx.font = `600 12px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(def.icon, cx + dir * 4, y + .5);
  return cx + dir * 30;
}

// Small card for crowded matches (5-8 fighters): name, health, stamina + super, round pips.
function drawCompactCard(f, x, y, w) {
  f.hpShow = lerp(f.hpShow, f.hp, .08);
  const frac = f.hp / f.maxHp, cw = drawClassIcon(f, x + 9, y - 10);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  hudTextShadow(true);
  ctx.font = `13px ${FONT_DISPLAY}`; ctx.fillStyle = f.color; ctx.fillText(f.name, x + cw, y - 5);
  const nw = ctx.measureText(f.name).width + cw;
  ctx.font = `600 11px ${FONT_BODY}`; ctx.fillStyle = '#c4c9ee';
  const cwl = weaponLabel(f) + (f.lvl > 1 ? ' LV' + f.lvl : '') + (f.mount ? ' · ' + MOUNTS[f.mount.key].name : '');
  ctx.fillText(cwl, x + nw + 8, y - 5);
  hudTextShadow(false);
  aiPersonaHudTag(f, x + nw + 20 + ctx.measureText(cwl).width, y - 9, 1);   // the CPU rival's title (67)
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 2, y - 2, w + 4, 16);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; fillBar(x, y, w, 12, f.hpShow / f.maxHp, false);
  ctx.fillStyle = f.alive ? f.color : '#444a66'; fillBar(x, y, w, 12, frac, false);
  accessCardMark(f, x, y, w, 12, false);   // colour-blind marker + pattern (92-access)
  ctx.font = `700 10px ${FONT_BODY}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(7,8,15,.85)';
  const hpText = f.alive ? String(Math.ceil(f.hp)) : 'K.O.';
  ctx.strokeText(hpText, x + w - 4, y + 6.5); ctx.fillText(hpText, x + w - 4, y + 6.5);
  drawMeters(f, x, y + 15, w, false, 3);
  const n = Math.min(G_STATE.winScore, 9), won = G_STATE.score[f.team] || 0;
  for (let k = 0; k < n; k++) circle(ctx, x + w - 4 - k * 11, y - 10, 3.5, k < won ? f.color : 'rgba(255,255,255,.14)');
}

function drawCardStatuses(f, x, y, dir) {
  let k = 0;
  for (const name in f.status) {
    const def = STATUS[name], cx = x + dir * (k * 22 + 8);
    circle(ctx, cx, y, 9, 'rgba(8,9,20,.85)', rgba(def.color, .8), 1.5);
    ctx.fillStyle = def.color; ctx.font = `600 11px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, y + .5);
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
  const k = VIEW.hudK, hs = VIEW.s * k, Wh = VIEW.hudW, L = (W - Wh) / 2, two = n === 2, compact = n > 4;
  ctx.setTransform(hs, 0, 0, hs, VIEW.cx - W / 2 * hs, VIEW.hudY);
  // Up to 4 fighters: full cards (2 per row on narrow screens). 5-8: compact cards, 4 per row (2 on narrow screens).
  const perRow = two ? 2 : compact ? clamp(Math.floor((Wh - 44) / 200), 2, 4) : clamp(Math.floor((Wh - 44) / 256), 1, n);
  const rows = two ? 1 : Math.ceil(n / perRow), rowH = compact ? 46 : 84;
  const cw = two ? Math.min(430, Math.floor((Wh - 92) / 2)) : Math.floor((Wh - 60 - (perRow - 1) * 16) / perRow);
  const cardX = (i) => two ? (i === 1 ? L + Wh - 34 - cw : L + 34) : L + 30 + (i % perRow) * (cw + 16);
  const cardY = (i) => (compact ? 26 : 30) + (two ? 0 : Math.floor(i / perRow)) * rowH;
  const plates = cards.map((f, i) => compact ? [cardX(i) - 8, cardY(i) - 24, cw + 16, 52] : [cardX(i) - 10, cardY(i) - 32, cw + 20, 100]);
  const lblY = midGap0(two, Wh, cw) ? 52 : (compact ? 22 : 30) + rows * rowH;
  plates.push([W / 2 - 62, lblY - 21, 124, G_STATE.roundLimit - G_STATE.roundT < 10 && !G_STATE.ending ? 56 : 28]);   // round label + countdown
  hudPlatePath(plates); ctx.fillStyle = 'rgba(8,9,22,.55)'; ctx.fill();
  cards.forEach((f, i) => {
    const right = two && i === 1, col = two ? i : i % perRow, row = two ? 0 : Math.floor(i / perRow);
    if (compact) drawCompactCard(f, L + 30 + col * (cw + 16), 26 + row * rowH, cw);
    else drawCard(f, two ? (right ? L + Wh - 34 - cw : L + 34) : L + 30 + col * (cw + 16), 30 + row * rowH, cw, right);
  });
  hudTextShadow(false);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `15px ${FONT_DISPLAY}`; ctx.fillStyle = '#c4c9ee';
  const midGap = midGap0(two, Wh, cw);   // room for the round label between two cards
  const centre = W / 2, cy = midGap ? 52 : (compact ? 22 : 30) + rows * rowH;
  ctx.fillText(G_STATE.demo ? 'DEMO' : hook(G_STATE.mode, 'roundLabel') || 'ROUND ' + G_STATE.round, centre, cy);   // modes may relabel (WAVE 3)
  const left = G_STATE.roundLimit - G_STATE.roundT;
  wxDrawAnnounce(ctx, centre, cy + 14);   // weather card under the round label (58)
  if (!G_STATE.demo && !G_STATE.ending && left < 10 && left > 0) {
    ctx.font = `22px ${FONT_DISPLAY}`; ctx.fillStyle = left < 4 ? '#ff4a6a' : '#ffd84a';
    ctx.fillText(Math.ceil(left), centre, cy + 26);
  }
  if (MUTED) {
    ctx.font = `600 12px ${FONT_BODY}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(200,205,240,.55)';
    ctx.fillText('MUTED (M)', L + Wh - 14, H - 12);
  }
  ctx.translate(0, (rows - 1) * rowH + (compact ? rowH - 84 : 8) + (two && !midGap ? 54 : 0));   // mode HUDs sit below the (taller) card block
  hook(G_STATE.mode, 'hud', ctx);
  miniDraw(ctx);                 // party mini-game scoreboard (79)
}

// ---------- banners ----------
// Big centred text: `a` first, then `b` (e.g. "ROUND 2" then "FIGHT!").
function banner(a, b = '', len = 1.6, color = null) { BANNER = { a, b, t: 0, len, color }; }

function drawBanner(dt) {
  const B = BANNER;
  if (!B || G_STATE.demo) return;
  B.t += dt;
  if (B.t > B.len) { BANNER = null; return; }
  const half = B.b ? B.len * .55 : B.len, second = B.t >= half, txt = second ? B.b : B.a;
  if (!txt) return;
  const local = second ? B.t - half : B.t, sc = 1 + Math.max(0, .35 - local) * 1.5;
  ctx.save();
  ctx.globalAlpha = clamp((B.len - B.t) * 5, 0, 1);
  ctx.translate(W / 2, H / 2 - 60); ctx.scale(sc, sc);
  ctx.font = `84px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 12; ctx.strokeStyle = '#07080f'; ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = B.color || (txt === 'K.O.' ? '#ff4a6a' : '#ffd84a');
  glow(ctx, ctx.fillStyle, 26, () => ctx.fillText(txt, 0, 0));
  ctx.restore();
}

// ---------- frame ----------
let VIGNETTE = null;
function drawScreenOverlays(dt) {
  const y0 = VIEW.top, vh = VIEW.hv;   // the whole viewport (taller than 720 on portrait screens)
  if (FX.slow > 0) { ctx.fillStyle = `rgba(255,40,90,${Math.min(.12, FX.slow * .1)})`; ctx.fillRect(0, y0, W, vh); }
  if (FX.flashA > 0) {
    ctx.globalAlpha = FX.flashA; ctx.fillStyle = FX.flash; ctx.fillRect(0, y0, W, vh); ctx.globalAlpha = 1;
    FX.flashA = Math.max(0, FX.flashA - dt * 1.8);
  }
  if (!VIGNETTE) {
    VIGNETTE = ctx.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .95);
    VIGNETTE.addColorStop(0, 'rgba(0,0,0,0)'); VIGNETTE.addColorStop(1, 'rgba(0,0,0,.38)');
  }
  ctx.fillStyle = VIGNETTE; ctx.fillRect(0, y0, W, vh);
}

function render(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!MAP) return;
  kcRecord();   // kill-cam snapshot of this frame (88)
  updateCamera(dt);
  const t = G_STATE.t, sh = FX.shake * VIEW.s;
  FX.shake = FX.shake > .2 ? FX.shake * Math.pow(.86, dt * 60) : 0;
  ctx.save();
  ctx.beginPath(); ctx.rect(VIEW.vx, VIEW.vy, VIEW.vw, VIEW.vh); ctx.clip();
  setWorldTransform((Math.random() - .5) * sh, (Math.random() - .5) * sh);
  if (typeof MAP.drawBg === 'function') hook(MAP, 'drawBg', ctx, t); else drawStdBackground(ctx, MAP, t);
  for (const hz of MAP.hazards) drawHazard(ctx, hz, MAP, t);
  for (const s of MAP.solids) drawSolid(ctx, s, MAP, t);
  drawOrbs();
  juiceDrawWorld(ctx, dt);   // landing dust, speed streaks (87)
  if (dt > 0) for (const f of F) recordTrail(f);
  for (const f of F) if (!f.alive) drawFighter(f);
  for (const f of F) if (f.alive) drawFighter(f);
  shatterDraw(ctx);          // neon limbs of K.O.'d fighters (36)
  koFxDraw(ctx); petsDraw(ctx); miniDrawWorld(ctx);   // K.O. effects, pets (78), mini-game props (79)
  drawProjectiles();
  drawFx(ctx);
  hook(MAP, 'drawFg', ctx, t);
  worldDrawTop(ctx, t);      // weather, darkness and lights (58)
  postfxDrawWorld(ctx);      // dynamic lights, impact sparks and flashes (84)
  hook(G_STATE.mode, 'drawWorld', ctx);
  if (!photoHidesHud()) aiTalkDraw(ctx);   // CPU speech bubbles (67), hidden with the HUD in photo mode
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
