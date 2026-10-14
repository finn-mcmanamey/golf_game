// 59-styles.js: arena art styles (v4, drawing only): defMap `style` = neon (default) | ink | pixel | paper | chalk.
// 85-render's world pass runs in artWorld, where ctx maps every colour through the style. ARCHITECTURE.md: "Art styles".

const STYLES = {};
function defStyle(key, def) { return (STYLES[key] = Object.assign({ key, glow: 0, bloom: false, lights: false, fxLife: 1 }, def)); }
const ART = { style: null, layerOn: null, layer: null, cache: null, proxies: new WeakMap(), grains: new Map(), monos: {}, tex: {} };
const ART_INK = '#17130f', ART_PAPER = '#efe6d1', ART_SHADE = 'rgba(80,40,40,.24)';
const ART_BOX = { x: -40, y: -120, w: 1360, h: 880 };   // the world a cached backdrop covers
// Seeded, so jitter and texture never flicker.
const artHash = k => { const s = Math.sin(k * 91.7 + 47.3) * 43758.5453; return s - Math.floor(s); };
const artRng = seed => () => artHash(seed++ * 1.618);
const artStyleOf = m => ((typeof SETTINGS !== 'object' || SETTINGS.arenaArt !== 'neon') && m && STYLES[m.style]) || STYLES.neon;
const artNow = () => artStyleOf(MAP), artIs = key => artNow().key === key;

// ---------- colours: style.map(rgba, use: fill | stroke | shadow | stop | tone, hsl, alpha)
function artHsl(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  return [60 * (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4), d / (1 - Math.abs(2 * l - 1)), l];
}
const artCss = (h, s, l, a = 1) => `hsla(${Math.round(h)},${Math.round(clamp(s, 0, 1) * 100)}%,${Math.round(clamp(l, 0, 1) * 100)}%,${Math.round(a * 1e3) / 1e3})`;
function artColor(st, str, kind) {
  if (!st.map || typeof str !== 'string') return str;
  const memo = st.memo || (st.memo = new Map()), key = kind + str;
  let v = memo.get(key);
  if (v === undefined) {
    const c = skinParse(str);   // 78-outfits
    v = c ? st.map(c, kind, artHsl(c), c[3]) : str;
    if (memo.size > 900) memo.clear();
    memo.set(key, v);
  }
  return v;
}

// ---------- the style proxy: colours and gradient stops set on it go through style st (like 78's skin proxy)
const ART_RAW = Symbol('artRaw'), ART_KINDS = { fillStyle: 'fill', strokeStyle: 'stroke', shadowColor: 'shadow' };
const artRaw = c => (c && c[ART_RAW]) || c;
function artProxy(real, st) {
  let per = ART.proxies.get(real);
  if (!per) ART.proxies.set(real, per = {});
  if (per[st.key]) return per[st.key];
  const fns = {}, grad = fn => (...a) => {
    const g = fn.apply(real, a), add = g.addColorStop.bind(g);
    g.addColorStop = (o, col) => add(o, artColor(st, col, 'stop'));
    return g;
  };
  return (per[st.key] = new Proxy(real, {
    get(t, k) {
      if (k === ART_RAW) return t;
      const v = t[k];
      if (typeof v !== 'function') return v;
      if (st.cut && k === 'fillRect') return (x, y, w, h) => { artPath(t, artCutRect(x, y, w, h, x * .7 + y)); t.fill(); };   // cut by hand
      if (ART.dots && st.dot && k === 'rect') return (x, y, w) => st.dot(t, x + w / 2, y + w / 2, w);   // 35's particles in the style's shape
      return fns[k] || (fns[k] = /^create(Linear|Radial)/.test(k) ? grad(v) : v.bind(t));
    },
    set(t, k, v) {
      t[k] = ART_KINDS[k] ? artColor(st, v, ART_KINDS[k]) : k === 'shadowBlur' ? v * (st.blur ?? st.glow) : v;
      return true;
    },
  }));
}
// Everything in one colour: silhouettes, paper weapon shadows.
function artMono(g, color) {
  const st = ART.monos[color] || (ART.monos[color] = { key: 'mono' + color, glow: 0, map: (c, kind) => kind === 'shadow' ? 'rgba(0,0,0,0)' : color });
  return artProxy(artRaw(g), st);
}

// ---------- textures (made once)
function artCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c.getContext('2d') ? c : null;
}
// Chalk grain: a 64px tile, gaps clustered in diagonal streaks.
function artGrainMask() {
  if (ART.tex.grain !== undefined) return ART.tex.grain;
  const c = artCanvas(64, 64), r = artRng(9);
  if (c) {
    const g = c.getContext('2d'), d = g.createImageData(64, 64);
    for (let i = 0; i < 4096; i++) {
      d.data.fill(255, i * 4, i * 4 + 3);
      d.data[i * 4 + 3] = r() < (Math.sin((i & 63) * .45 + (i >> 6) * 1.6 + Math.sin((i & 63) * .2) * 3) > .5 ? .55 : .18) ? 25 : 160 + r() * 95;
    }
    g.putImageData(d, 0, 0);
  }
  return (ART.tex.grain = c);
}
// A chalk pattern of one colour (cached; 'fill' fainter).
function artGrain(color, kind) {
  let p = ART.grains.get(kind + color);
  if (p !== undefined) return p;
  const mask = artGrainMask(), c = mask && artCanvas(64, 64);
  p = color;
  if (c) {
    const g = c.getContext('2d');
    g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in';
    g.globalAlpha = kind === 'fill' ? .7 : 1; g.fillStyle = color; g.fillRect(0, 0, 64, 64);
    p = g.createPattern(c, 'repeat') || color;
  }
  if (ART.grains.size > 400) ART.grains.clear();
  ART.grains.set(kind + color, p);
  return p;
}
// Lays paper fibres (a 128px tile of specks and strands) over a backdrop.
function artFibres(g, alpha) {
  const c = ART.tex.fib || (ART.tex.fib = artCanvas(128, 128)), r = artRng(4);
  if (!c) return;
  const t = c.getContext('2d');
  if (!c.done) for (let k = 0; k < 980; k++) {
    const x = r() * 128, y = r() * 128, a = r() * TAU, L = k < 900 ? 1 : 4 + r() * 13;
    t.strokeStyle = k < 900 ? (r() < .55 ? 'rgba(90,70,40,.08)' : 'rgba(255,255,255,.14)') : 'rgba(110,85,50,.1)';
    t.beginPath(); t.moveTo(x, y); t.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); t.stroke();
  }
  c.done = 1;
  g.save(); g.globalAlpha = alpha; g.fillStyle = g.createPattern(c, 'repeat'); g.fillRect(ART_BOX.x, ART_BOX.y, ART_BOX.w, ART_BOX.h); g.restore();
}

// ---------- shapes
// Adds a tapered stroke a -> b (half-widths w0 -> w1, round ends) to the path.
function artTaper(c, ax, ay, bx, by, w0, w1) {
  const L = Math.hypot(bx - ax, by - ay) || 1, nx = (ay - by) / L, ny = (bx - ax) / L, a = Math.atan2(by - ay, bx - ax), q = Math.PI / 2;
  c.moveTo(ax + nx * w0, ay + ny * w0); c.lineTo(bx + nx * w1, by + ny * w1);
  c.arc(bx, by, w1, a + q, a - q, true); c.lineTo(ax - nx * w0, ay - ny * w0);
  c.arc(ax, ay, w0, a - q, a + q, true); c.closePath();
}
function artPath(c, pts, dx = 0, dy = 0, close = true) {
  c.beginPath();
  pts.forEach(([x, y], i) => i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy));
  if (close) c.closePath();
}
// A hand-cut rectangle: corners and midpoints nudged by a seeded hash (stable as it moves).
const artCutRect = (x, y, w, h, seed) => [[0, 0], [.5, 0], [1, 0], [1, .5], [1, 1], [.5, 1], [0, 1], [0, .5]]
  .map(([u, v], i) => [x + u * w + (artHash(seed + i) - .5) * 2.4, y + v * h + (artHash(seed - i) - .5) * 2.4]);
// The stick figure: one stroke and a head disc (growing with the width), offset by (dx, dy).
function artStick(c, f, col, w, dx, dy, hm) {
  const P = f.P;
  c.strokeStyle = col; c.lineWidth = w; c.beginPath();
  for (const [a, b] of BODY_LINKS) { c.moveTo(P[a].x + dx, P[a].y + dy); c.lineTo(P[b].x + dx, P[b].y + dy); }
  c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(P[0].x + dx, P[0].y + dy, Math.max(1, HEAD_R * f.scale * hm + (w - 9.5 * f.scale) / 2), 0, TAU); c.fill();
}

// ---------- the world pass (85-render): ctx = the style proxy (pixel: over the low-res layer)
function artWorld(draw) {
  const st = ART.style = artNow(), keep = GLOW_SCALE;
  if (st.key === 'neon') return draw();
  const L = st.pixel ? artLayerStart() : null;
  GLOW_SCALE = st.glow > 0 ? keep : 0;
  if (L) st.blur = st.glow * L.q * VIEW.dpr * 2;   // shadowBlur ignores the transform: a layer pixel or two
  ctx = artProxy(L ? L.g : CTX_MAIN, st);
  ART.layerOn = L;
  try { draw(); } finally {
    ctx = CTX_MAIN; GLOW_SCALE = keep; ART.layerOn = null; ART.dots = 0;
    if (L) artLayerEnd(L);
  }
}
// paper: a soft card shadow under platforms, blocks and hazards.
function artSurfaces(c, on) {
  if (!ART.style || !ART.style.shadow) return;
  const raw = artRaw(c), z = VIEW.s * CAM.z;
  if (!on) return raw.restore();
  raw.save(); raw.shadowColor = 'rgba(80,40,40,.3)'; raw.shadowOffsetX = 3 * z; raw.shadowOffsetY = 4 * z; raw.shadowBlur = 3 * z;
}
function artBody(f, color, sc) {
  const st = ART.style, hm = f.headMul || 1;
  if (!st || !st.body) return glow(ctx, auraColor(f), f.alive ? (f.status.rage ? 22 : 10) : 0, () => drawBody(f, color, 7 * sc));
  const raw = artRaw(ctx), draw = () => st.body(raw, f, color, sc, hm);
  if (st.glow > 0) glow(raw, auraColor(f), (f.alive ? 8 : 0) * (st.blur ?? st.glow), draw); else draw();
}
// paper: a weapon's shadow (its own drawing in one colour); ink: its halo (below).
function artWeaponShadow(f, rig, view) {
  if (ART.style && ART.style.halo) return artWeaponHalo(f, rig, view, ART.style.halo);
  if (!ART.style || !ART.style.shadow) return;
  const c = artMono(ctx, 'rgba(80,40,40,.22)');
  c.save(); c.translate(3.5 * f.scale, 4.5 * f.scale); hook(rig.w, 'draw', c, f, view); c.restore();
}
// ink: a thin paper rim keeps dark weapons readable over dark ink (the Dojo's gate): the weapon drawn first in paper,
// every line `extra` wider and every fill outlined; alphas kept, so see-through parts stay see-through.
function artWeaponHalo(f, rig, view, color) {
  const raw = artRaw(ctx), extra = 3.2 * f.scale, alphaOf = v => { const c = typeof v === 'string' && skinParse(v); return c ? c[3] : 1; };
  raw.save(); raw.lineWidth += extra;
  const widen = (fn, outline) => (...a) => { fn.apply(raw, a); const lw = raw.lineWidth; raw.lineWidth = extra; outline(a); raw.lineWidth = lw; };
  const c = new Proxy(raw, {
    get(t, k) {
      if (k === ART_RAW) return t;
      if (k === 'fill') return widen(t.fill, a => t.stroke(...a.filter(p => typeof p === 'object')));
      if (k === 'fillRect') return widen(t.fillRect, ([x, y, w, h]) => t.strokeRect(x, y, w, h));
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) {
      t[k] = k === 'lineWidth' ? v + extra : k === 'shadowColor' ? 'rgba(0,0,0,0)' : ART_KINDS[k] ? rgba(color, alphaOf(v)) : v;
      return true;
    },
  });
  try { hook(rig.w, 'draw', c, f, view); } finally { raw.restore(); }
}
// Hits (84-postfx) through the style's spark, flash and ring.
function artImpact(c, P) {
  const st = ART.style || artNow();
  for (const s of P.sparks) { const e = postfxAge(s); if (e >= 0 && e <= s.life) { c.globalAlpha = 1 - e / s.life; st.spark(c, postfxSparkAt(s, e), s); } }
  for (const f of P.flashes) { const k = postfxAge(f) / f.life; if (k >= 0 && k <= 1) st.flash(c, f, k, postfxAge(f)); }
  for (const w of P.waves) { const k = postfxAge(w) / w.life; if (k >= 0 && k <= 1) st.ring(c, w.x, w.y, w.r * (.2 + .8 * Math.sqrt(k)), 6 * (1 - k) + 2, w.color, (1 - k) * .8); }
  c.globalAlpha = 1;
}

// ---------- cached backdrops
// The arena's static art in one reused canvas, redrawn when arena, style or view scale change.
function artBackdrop(m, st) {
  const k = Math.min(VIEW.s * Math.max(1.15, VIEW.zMin), Math.sqrt(2.4e6 / (ART_BOX.w * ART_BOX.h))), key = `${m.key}|${st.key}|${k.toFixed(3)}`;
  const C = ART.cache || (ART.cache = { key: '', cv: artCanvas(1, 1) });
  if (C.cv && C.key !== key) {
    C.cv.width = Math.ceil(ART_BOX.w * k); C.cv.height = Math.ceil(ART_BOX.h * k);
    const g = C.cv.getContext('2d');
    g.setTransform(k, 0, 0, k, -ART_BOX.x * k, -ART_BOX.y * k);
    try { m.art.bg(g, m); } catch (e) { report(e, 'art ' + m.key); }
    C.key = key;
  }
  return C.cv;
}
// Arena m's styled backdrop (cached on the game canvas) + live extras; false when none (its drawBg runs).
function artBg(c2, m, t) {
  const st = artStyleOf(m), raw = artRaw(c2);
  if (st.key === 'neon' || !m.art) return false;
  const img = raw === CTX_MAIN && artBackdrop(m, st);
  if (img) raw.drawImage(img, ART_BOX.x, ART_BOX.y, ART_BOX.w, ART_BOX.h); else m.art.bg(raw, m);
  if (m.art.live) m.art.live(c2 === raw ? artProxy(raw, st) : c2, m, t);
  return true;
}
function artReset() {
  if (ART.cache) ART.cache.key = '';
  if (typeof MAP_THUMBS === 'object') for (const k in MAP_THUMBS) delete MAP_THUMBS[k];
}

// ---------- pixel: the low-res world layer
const ART_PIXEL = 4;   // CSS px per layer pixel
// One layer canvas, resized only with the view; its text is queued, to be drawn crisp.
function artLayerStart() {
  const L = ART.layer || (ART.layer = { cv: artCanvas(1, 1), texts: [], sizes: 0 });
  if (!L.cv) return null;
  const w = Math.max(80, Math.round(VIEW.vw / VIEW.dpr / ART_PIXEL)), h = Math.max(45, Math.round(VIEW.vh / VIEW.dpr / ART_PIXEL));
  if (L.cv.width !== w || L.cv.height !== h) { L.cv.width = w; L.cv.height = h; L.sizes++; }
  if (!L.g) {
    L.g = L.cv.getContext('2d');
    for (const k of ['fillText', 'strokeText']) L.g[k] = function (text, x, y, mw) {
      if (this.getTransform) L.texts.push({ k, text, x, y, mw, m: this.getTransform(), font: this.font, style: this[k === 'fillText' ? 'fillStyle' : 'strokeStyle'],
        lw: this.lineWidth, align: this.textAlign, base: this.textBaseline, a: this.globalAlpha });
    };
  }
  L.q = w / VIEW.vw;
  L.g.save(); L.g.setTransform(1, 0, 0, 1, 0, 0);
  L.g.fillStyle = artColor(STYLES.pixel, mapSkyTop(MAP), 'fill'); L.g.fillRect(0, 0, w, h);
  return L;
}
function artLayerEnd(L) {
  const c = CTX_MAIN, q = L.q;
  L.g.restore();
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = false; L.smooth = c.imageSmoothingEnabled;
  c.drawImage(L.cv, VIEW.vx, VIEW.vy, VIEW.vw, VIEW.vh);
  c.lineJoin = 'round';
  for (const T of L.texts) {
    const m = T.m;
    c.setTransform(m.a / q, m.b / q, m.c / q, m.d / q, m.e / q + VIEW.vx, m.f / q + VIEW.vy);
    Object.assign(c, { font: T.font, textAlign: T.align, textBaseline: T.base, globalAlpha: T.a, lineWidth: T.lw });
    c[T.k === 'fillText' ? 'fillStyle' : 'strokeStyle'] = T.style;
    if (T.mw == null) c[T.k](T.text, T.x, T.y); else c[T.k](T.text, T.x, T.y, T.mw);
  }
  L.texts.length = 0;
  c.restore();
}

defStyle('neon', { glow: 1, bloom: true, lights: true });

// ---------- ink: brush on rice paper; strokes turn to ink, fills to a muted wash, white to paper
const inkTone = color => artColor(STYLES.ink, color, 'tone');
defStyle('ink', { fxLife: 4, warn: '#c8322a', vignette: 'rgba(110,70,30,.3)', halo: ART_PAPER, frame: '#d6c9ad',
  map(c, kind, [h, s, l], a) {
    if (kind === 'shadow') return 'rgba(0,0,0,0)';
    if (kind === 'tone') return artCss(h, s * .85, clamp(l * .82, .32, .56), a);
    if (kind === 'stroke') return l > .86 && s < .3 ? artCss(30, .2, .09, a) : artCss(h, s * .45, .16, a);
    if (l < .22) return artCss(h, s * .3, .1, a);
    return s < .16 ? artCss(40, .3, l > .86 ? .9 : .3 + l * .5, a) : artCss(h, s * .72, clamp(l * .8, .34, .6), a);
  },
  // Tapered brush limbs; the player's colour on the head and a sash.
  body(c, f, color, sc, hm) {
    const P = f.P, ink = color === f.color ? ART_INK : '#8a8274', tone = inkTone(f.color), hip = P[2], r = HEAD_R * sc * hm;   // a hit flash washes out
    c.fillStyle = ink; c.beginPath();
    BODY_LINKS.forEach(([a, b], i) => {
      const w = (i === 1 ? 5.6 : i === 0 ? 3.4 : i % 2 ? 3.6 : 4.6) * sc * (.85 + artHash(f.id * 17 + i) * .3);
      artTaper(c, P[a].x, P[a].y, P[b].x, P[b].y, w, w * (i < 2 ? .8 : .45));
    });
    c.moveTo(P[0].x + r + 1.1 * sc, P[0].y); c.arc(P[0].x, P[0].y, r + 1.1 * sc, 0, TAU);   // the head's outer edge
    c.strokeStyle = this.halo; c.lineWidth = 3.4 * sc; c.lineJoin = 'round'; c.stroke();     // its paper halo (see artWeaponHalo)
    c.fill();
    circle(c, P[0].x, P[0].y, r, tone, ink, 2.2 * sc);
    c.lineWidth = 4.4 * sc; c.beginPath(); c.arc(P[0].x, P[0].y, HEAD_R * sc * hm, f.id, f.id + 2.1); c.stroke();   // brush pressure
    c.fillStyle = tone; c.beginPath(); artTaper(c, hip.x, hip.y - 4 * sc, hip.x - (f.face + clamp(vx(hip) / 900, -.6, .6)) * 14 * sc, hip.y + 7 * sc, 2.6 * sc, .8 * sc); c.fill();
  },
  // Brush strokes seeded by the edge's length (a moving platform keeps them).
  edge(c, x1, y1, x2, y2, color, w) {
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(L / 170));
    c.fillStyle = ART_INK; c.beginPath();
    for (let i = 0; i < n; i++) {
      const u0 = i / n - (i ? .03 : 0), u1 = (i + 1) / n, wv = w * (.55 + artHash(L + i) * .4), dy = artHash(L + i * 3) * 2 - 1;
      artTaper(c, lerp(x1, x2, u0), lerp(y1, y2, u0) + dy, lerp(x1, x2, u1), lerp(y1, y2, u1) - dy, wv, wv * .5);
    }
    c.fill();
  },
  slab(c, s, fill, edge, alpha) {   // a wash under a brush line
    c.globalAlpha = alpha * .6; c.fillStyle = artColor(this, fill, 'fill'); c.fillRect(s.x, s.y, s.w, s.oneWay ? Math.min(s.h, 14) : s.h);
    c.globalAlpha = alpha;
    this.edge(c, s.x, s.y, s.x + s.w, s.y, edge, 4);
    c.globalAlpha = 1;
  },
  dot(c, x, y, s) { c.moveTo(x + s * .6, y); c.arc(x, y, s * .6, 0, TAU); },   // round ink spots
  spark(c, p, s) { c.fillStyle = artColor(this, s.c, 'stroke'); c.beginPath(); inkDrop(c, p.x, p.y, s.vx, s.vy, 2.6); c.fill(); },
  // The flash: a splat, droplets thrown along the blow.
  flash(c, f, k, e) {
    const r = f.r * .42 * Math.min(1, e / .04 + .4) * (1 + k * .12), seed = f.x * .13 + f.y * .71;
    c.globalAlpha = (1 - k * k) * .9; c.fillStyle = artColor(this, f.color, 'stroke'); c.beginPath();
    c.moveTo(f.x + r, f.y); c.arc(f.x, f.y, r, 0, TAU);
    for (let i = 0; i < 7; i++) {
      const a = f.a + (artHash(seed + i) - .5) * 2.6, d = r * (1.2 + artHash(seed + i * 3) * 1.5), q = r * (.12 + artHash(seed + i * 7) * .2);
      c.moveTo(f.x + Math.cos(a) * d + q, f.y + Math.sin(a) * d); c.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, q, 0, TAU);
    }
    c.fill();
  },
  // An open brush circle (ensō) thinning into its tail.
  ring(c, x, y, rad, width, color, alpha) {
    const a0 = artHash(x * .37 + y) * TAU;
    c.globalAlpha = alpha; c.strokeStyle = artColor(this, color, 'stroke'); c.lineCap = 'round';
    for (let k = 0; k < 3; k++) { c.lineWidth = Math.max(1, width * (1.5 - k * .5)); c.beginPath(); c.arc(x, y, rad, a0 + k * 1.8, a0 + k * 1.8 + 1.9); c.stroke(); }
  },
});
function inkDrop(c, x, y, vx, vy, s) {   // a droplet stretched along its flight
  const a = Math.atan2(vy, vx), rx = s * (.5 + Math.min(Math.hypot(vx, vy), 900) / 900);
  c.moveTo(x + Math.cos(a) * rx, y + Math.sin(a) * rx); c.ellipse(x, y, rx, s * .45, a, 0, TAU);
}

// ---------- pixel: the world at ~1/4 resolution in the 216 web-safe colours (fighters keep theirs)
defStyle('pixel', { glow: .6, lights: true, pixel: true, warn: '#ffcc33', vignette: 'rgba(0,0,0,.42)',
  map: (c, kind, hsl, a) => `rgba(${[0, 1, 2].map(i => Math.round(c[i] / 51) * 51)},${a})`,
  body(c, f, color, sc, hm) { artStick(c, f, '#0e0c16', 14 * sc, 0, 0, hm); artStick(c, f, color, 9.5 * sc, 0, 0, hm); },
});

// ---------- paper: flat card shapes with soft drop shadows
defStyle('paper', { fxLife: 2.5, shadow: true, warn: '#e2412b', vignette: 'rgba(90,50,40,.2)', frame: '#d9c8ae',
  map(c, kind, [h, s, l], a) {
    if (kind === 'shadow') return 'rgba(0,0,0,0)';
    return l > .9 ? artCss(42, .6, .96, a) : l < .16 ? artCss(h, s * .3, .19, a) : artCss(h, Math.min(s, .82) * .88, clamp(l, .3, .8), a);
  },
  // A cut-out puppet: flat limbs in the player's colour on a white card margin, over a drop shadow.
  body(c, f, color, sc, hm) {
    artStick(c, f, ART_SHADE, 12.5 * sc, 3.5 * sc, 4.5 * sc, hm);
    artStick(c, f, '#fffaf0', 14.5 * sc, 0, 0, hm);
    artStick(c, f, artColor(this, color, 'fill'), 9.5 * sc, 0, 0, hm);
  },
  edge(c, x1, y1, x2, y2, color, w) {
    c.lineCap = 'butt';
    lineXY(c, x1 + 2, y1 + 3, x2 + 2, y2 + 3, ART_SHADE, w + 2);
    lineXY(c, x1, y1, x2, y2, artColor(this, color, 'fill'), w + 2);
  },
  slab(c, s, fill, edge, alpha) {   // hand-cut card (shadow: artSurfaces)
    c.globalAlpha = alpha; c.fillStyle = artColor(this, fill, 'fill');
    artPath(c, artCutRect(s.x, s.y, s.w, s.oneWay ? Math.min(s.h, 14) : s.h, (s.x0 ?? s.x) * .7 + (s.y0 ?? s.y))); c.fill();
    this.edge(c, s.x, s.y + 1.5, s.x + s.w, s.y + 1.5, edge, 2);
    c.globalAlpha = 1;
  },
  dot(c, x, y, s) { const h = s * .5 * Math.abs(Math.sin(x * .1 + y * .07)) + .4; c.rect(x - s * .8, y - h, s * 1.6, h * 2); },   // confetti flipping as it flies
  spark(c, p, s) { c.fillStyle = artColor(this, s.c, 'fill'); c.beginPath(); this.dot(c, p.x, p.y, 4); c.fill(); },
  // The flash: a paper star popping up over its shadow.
  flash(c, f, k, e) {
    const r = f.r * .8 * Math.min(1, e / .05 + .3) * (1 - k * .3);
    c.globalAlpha = 1 - k * k;
    for (const [col, o] of [[ART_SHADE, 4], [artColor(this, f.color, 'fill'), 0]]) {
      c.fillStyle = col; c.beginPath();
      for (let i = 0; i < 16; i++) { const a = f.a + i * TAU / 16, q = r * (i % 2 ? .45 : 1); c.lineTo(f.x + o + Math.cos(a) * q, f.y + o + Math.sin(a) * q); }
      c.fill();
    }
  },
  ring(c, x, y, rad, width, color, alpha) { c.globalAlpha = alpha; circle(c, x + 3, y + 4, rad, null, ART_SHADE, width); circle(c, x, y, rad, null, artColor(this, color, 'fill'), width); },
});

// ---------- chalk: grainy pastel chalk on slate; dark fills become the slate
const chalkTone = color => artColor(STYLES.chalk, color, 'tone');   // never sinks into the slate
defStyle('chalk', { fxLife: 3, warn: '#ffe45c', vignette: 'rgba(0,0,0,.45)', frame: '#3a2a1e',
  map(c, kind, [h, s, l], a) {
    if (kind === 'shadow') return 'rgba(0,0,0,0)';
    if (kind === 'tone') return artCss(h, s, clamp(.5 + l * .32, .6, .82), a);
    if (l < .2 && kind !== 'stroke') return artCss(165, .1, .15, a);
    const col = artCss(Math.round(h / 8) * 8, Math.round(s * 6) / 10, Math.round(clamp(.62 + l * .32, .62, .95) * 20) / 20, Math.ceil(a * 8) / 8);   // few patterns
    return kind === 'stop' ? col : artGrain(col, kind);
  },
  // Grainy strokes in the player's colour, an offset pass for rough edges, a filled ringed head.
  body(c, f, color, sc, hm) {
    const P = f.P, col = chalkTone(color), r = HEAD_R * sc * hm;
    c.strokeStyle = artGrain(col, 'stroke'); c.lineWidth = 7 * sc; c.beginPath();
    for (const [a, b] of BODY_LINKS) { c.moveTo(P[a].x, P[a].y); c.lineTo(P[b].x, P[b].y); }
    c.stroke();
    c.strokeStyle = artGrain(col, 'fill'); c.lineWidth = 2 * sc; c.beginPath();
    BODY_LINKS.forEach(([a, b], i) => {
      const o = (artHash(f.id * 11 + i) - .5) * 8 * sc, L = Math.hypot(P[b].x - P[a].x, P[b].y - P[a].y) || 1, nx = (P[a].y - P[b].y) / L * o, ny = (P[b].x - P[a].x) / L * o;
      c.moveTo(P[a].x + nx, P[a].y + ny); c.lineTo(P[b].x + nx * .4, P[b].y + ny * .4);
    });
    c.stroke();
    c.fillStyle = artGrain(col, 'fill'); c.beginPath(); c.arc(P[0].x, P[0].y, r * .85, 0, TAU); c.fill();
    c.strokeStyle = artGrain(col, 'stroke'); c.lineWidth = 3.4 * sc; c.beginPath(); c.arc(P[0].x, P[0].y, r, 0, TAU); c.stroke();
  },
  edge(c, x1, y1, x2, y2, color, w) {
    const col = chalkTone(color), o = artHash(Math.hypot(x2 - x1, y2 - y1)) * 2 - 1;
    c.lineCap = 'round';
    lineXY(c, x1, y1, x2, y2, artGrain(col, 'stroke'), w + 1);
    lineXY(c, x1, y1 + 2.5 + o, x2, y2 + 2 - o, artGrain(col, 'fill'), 1.4);
  },
  slab(c, s, fill, edge, alpha) {   // a darker hatched strip
    const h = s.oneWay ? Math.min(s.h, 14) : s.h, col = chalkTone(edge);
    c.globalAlpha = alpha; c.fillStyle = 'rgba(10,16,15,.5)'; c.fillRect(s.x, s.y, s.w, h);
    chalkHatch(c, s.x, s.y, s.w, h, col, alpha * .55, 8);
    this.edge(c, s.x, s.y, s.x + s.w, s.y, edge, 3);
    c.globalAlpha = 1;
  },
  dot(c, x, y, s) { c.moveTo(x + s, y); c.arc(x, y, s, 0, TAU); },   // dust puffs
  spark(c, p, s) { c.lineCap = 'round'; lineXY(c, p.x, p.y, p.x - s.vx * .03, p.y - s.vy * .03, artColor(this, s.c, 'stroke'), 2.6); },
  // The flash: a starburst in a puff of dust.
  flash(c, f, k) {
    const r = f.r * (.7 + k * .5), seed = f.x + f.y * 3;
    postfxGlow(c, f.x, f.y, r * 1.5, '#e8efe8', (1 - k) * .45);
    c.globalAlpha = 1 - k; c.strokeStyle = artColor(this, f.color, 'stroke'); c.lineWidth = 2.5; c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = f.a + i * TAU / 8 + (artHash(seed + i) - .5) * .4, L = r * (.8 + artHash(seed + i * 5) * .6);
      c.moveTo(f.x + Math.cos(a) * r * .35, f.y + Math.sin(a) * r * .35); c.lineTo(f.x + Math.cos(a) * L, f.y + Math.sin(a) * L);
    }
    c.stroke();
  },
  ring(c, x, y, rad, width, color, alpha) {   // two rough circles
    const o = artHash(x * .3 + y) * 4 - 2;
    c.globalAlpha = alpha; c.strokeStyle = artColor(this, color, 'stroke'); c.lineWidth = Math.max(1.5, width * .8);
    c.beginPath(); c.arc(x, y, rad, 0, TAU); c.moveTo(x + o + rad * .95, y - o); c.arc(x + o, y - o, rad * .95, 0, TAU); c.stroke();
  },
});
function chalkHatch(c, x, y, w, h, col, a, gap = 9) {   // diagonal hatching in a rectangle
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.globalAlpha = a; c.strokeStyle = artGrain(col, 'fill'); c.lineWidth = 1.3; c.beginPath();
  for (let k = -h; k < w; k += gap) { c.moveTo(x + k, y + h); c.lineTo(x + k + h, y); }
  c.stroke(); c.restore();
}

// ---------- backdrop helpers (art.bg is drawn once, into the cache)
function inkPaper(g, seed) {   // rice paper: tone, a soft mottle, fibres
  const r = artRng(seed);
  g.fillStyle = ART_PAPER; g.fillRect(ART_BOX.x, ART_BOX.y, ART_BOX.w, ART_BOX.h);
  for (let k = 0; k < 16; k++) mapGlow(g, r() * W, r() * H, 90 + r() * 220, '#a07850', .04 + r() * .05);
  artFibres(g, 1);
}
// A brush stroke through pts, half-width w0 thinning to w1.
function inkStroke(g, pts, w0, w1, color = ART_INK) {
  g.fillStyle = color; g.beginPath();
  for (let i = 1, n = pts.length - 1; i <= n; i++) artTaper(g, ...pts[i - 1], ...pts[i], lerp(w0, w1, (i - 1) / n), lerp(w0, w1, i / n));
  g.fill();
}
const inkWash = (g, y, amp, freq, ph, a, fl) => mapRidge(g, y, amp, freq, ph, `rgba(32,28,24,${a})`, fl);   // ink-wash hills
function inkSun(g, x, y, r, color) {   // a watercolour disc bleeding past its edge
  g.fillStyle = color;
  for (const [a, k] of [[.2, 1.06], [.75, 1]]) { g.globalAlpha = a; g.beginPath(); g.arc(x, y, r * k, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}
function inkGround(g, fl, seed) {   // a pale wash, a long brush line and dry strokes
  const r = artRng(seed);
  g.fillStyle = 'rgba(190,168,130,.28)'; g.fillRect(-40, fl, W + 80, H - fl + 60);
  STYLES.ink.edge(g, -30, fl, W + 30, fl, ART_INK, 5);
  for (let k = 0; k < 8; k++) {
    const y = fl + 14 + r() * (H - fl - 8), x = r() * W - 120, L = 160 + r() * 380;
    inkStroke(g, [[x, y], [x + L / 2, y + r() * 5 - 2.5], [x + L, y + r() * 6 - 3]], 1.2 + r() * 1.6, .3, `rgba(23,19,15,${.2 + r() * .3})`);
  }
}
// paper: the arena's own drawing in card, each shape with a soft shadow, then fibres.
const ART_CUT = Object.assign({}, STYLES.paper, { key: 'papercut', cut: true });
function paperBackdrop(g, draw) {
  const k = g.getTransform ? g.getTransform().a : 1;
  g.save(); g.shadowColor = 'rgba(80,40,40,.3)'; g.shadowBlur = 8 * k; g.shadowOffsetX = 2.5 * k; g.shadowOffsetY = 5 * k;
  draw(artProxy(g, ART_CUT));
  g.restore();
  artFibres(g, .9);
}
function chalkBoard(g, color, seed) {   // slate: tone, smudges of old chalk, dust
  const r = artRng(seed);
  g.fillStyle = color; g.fillRect(ART_BOX.x, ART_BOX.y, ART_BOX.w, ART_BOX.h);
  for (let k = 0; k < 18; k++) mapGlow(g, r() * W, r() * H, 60 + r() * 200, '#dfe8e0', .03 + r() * .04);
  g.fillStyle = 'rgba(230,240,232,.09)';
  for (let k = 0; k < 900; k++) g.fillRect(ART_BOX.x + r() * ART_BOX.w, ART_BOX.y + r() * ART_BOX.h, 1.4, 1.4);
}
// A chalk line: a grainy stroke and a fainter pass a little off it.
function chalkLine(g, pts, color, w, seed = 0, close = false) {
  const o = (artHash(seed) - .5) * w * 1.4;
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = artGrain(color, 'stroke'); g.lineWidth = w; artPath(g, pts, 0, 0, close); g.stroke();
  g.strokeStyle = artGrain(color, 'fill'); g.lineWidth = Math.max(1, w * .4); artPath(g, pts, o, -o * .6, close); g.stroke();
}
const artArc = (x, y, r, a0, a1, n = 16) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(a0 + (a1 - a0) * i / n) * r, y + Math.sin(a0 + (a1 - a0) * i / n) * r]);

// ---------- Settings → Effects → "Arena art" (wrapped at boot, like 87-juice) + test hooks
on('boot', () => {
  SETTING_DEFAULTS.arenaArt = 'arena'; SETTING_CHOICES.arenaArt = ['arena', 'neon'];
  if (!SETTING_CHOICES.arenaArt.includes(SETTINGS.arenaArt)) SETTINGS.arenaArt = 'arena';
  const build = typeof SCREENS === 'object' && SCREENS.settings;
  if (typeof build === 'function') SCREENS.settings = () => {
    const node = build(), h3 = [...node.querySelectorAll('.set-group h3')].find(h => h.textContent === 'Effects');
    if (h3) h3.parentNode.append(segField('Arena art', [['arena', 'Per arena'], ['neon', 'Neon everywhere']], SETTINGS.arenaArt === 'neon' ? 'neon' : 'arena',
      v => { setSetting('arenaArt', v); artReset(); }));
    return node;
  };
  if (window.SC) SC.styles = { STYLES, ART, of: key => artStyleOf(MAPS[key]).key, reset: artReset,
    layer: () => ART.layer && ART.layer.cv && { w: ART.layer.cv.width, h: ART.layer.cv.height, smooth: ART.layer.smooth, sizes: ART.layer.sizes } };
});
