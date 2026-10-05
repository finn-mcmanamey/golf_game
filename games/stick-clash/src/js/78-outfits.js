// 78-outfits.js: outfits with cloth physics, weapon skins, K.O. effects, taunts and victory poses.
// A fighter's "look" ({ outfit, skins: { cat: key }, ko, pet, pose }) rides its roster entry (lookOf(f)); the menu
// previews pass the loadout instead. Cloth, skins and K.O. effects are drawing only. Taunts grant a little super
// meter, and both taunts and victory poses move the arms with springs (like the body's own drive).

const OUTFITS = {}, WSKINS = {}, KOFX = {}, POSES = {};
// One registry helper for every look kind: listOf() sorts by order and hides `hidden` (secret) entries.
function defLook(reg, key, def) {
  reg[key] = Object.assign({ key, order: Object.keys(reg).length, icon: '★' }, def);
  return reg[key];
}
// The look of a fighter in a match: its roster entry (a decoy uses its owner's).
function lookOf(f) {
  const id = f.summon && f.owner ? f.owner.id : f.id, r = G_STATE.roster && G_STATE.roster[id];
  return (r && r.look) || {};
}

// ---------- cloth: verlet strands hung from body points (drawing only) ----------
// A strand: { at: [i, j, t], dx, dy (offset; dx follows facing), n segments, len, w: [w0, w1], color ('body' = the
// fighter's), edge, layer: 'back' | 'front', grav (×), lift (px/s² upwards), back (push behind the body), glow }.
const CLOTH = new WeakMap();    // fighter -> { t, strands: [[{ x, y, ox, oy }]] }; ghosts and previews get their own

function clothAnchor(f, st) {
  const [i, j, t] = st.at, a = f.P[i], b = f.P[j], s = f.scale;
  return { x: lerp(a.x, b.x, t) + (st.dx || 0) * f.face * s, y: lerp(a.y, b.y, t) + (st.dy || 0) * s };
}
function clothState(f, outfit, now) {
  let c = CLOTH.get(f);
  if (!c || c.key !== outfit.key) {
    c = { key: outfit.key, t: now, strands: outfit.strands.map(st => clothFresh(f, st)) };
    CLOTH.set(f, c);
  }
  const dt = now - c.t;
  c.t = now;
  if (dt < 0 || dt > .25) c.strands = outfit.strands.map(st => clothFresh(f, st));   // rewound or jumped: re-hang
  else if (dt > 0) outfit.strands.forEach((st, k) => clothStep(f, st, c.strands[k], Math.min(dt, 1 / 30)));
  return c;
}
// A freshly hung strand: straight down and a little behind the body.
function clothFresh(f, st) {
  const a = clothAnchor(f, st), seg = st.len * f.scale / st.n, pts = [];
  for (let k = 0; k <= st.n; k++) {
    const x = a.x - f.face * k * seg * .35, y = a.y + k * seg * .9;
    pts.push({ x, y, ox: x, oy: y });
  }
  return pts;
}
function clothStep(f, st, pts, dt) {
  const a = clothAnchor(f, st), seg = st.len * f.scale / st.n;
  const g = (typeof PHYS === 'object' ? PHYS.gravity : 2200) * .55 * (st.grav ?? 1) - (st.lift || 0);
  const fx = (typeof PHYS === 'object' ? PHYS.windX * .4 : 0) - f.face * (st.back || 0);
  pts[0].x = a.x; pts[0].y = a.y;
  for (let k = 1; k < pts.length; k++) {
    const p = pts[k], vx2 = (p.x - p.ox) * .94, vy2 = (p.y - p.oy) * .94;
    p.ox = p.x; p.oy = p.y;
    p.x += vx2 + fx * dt * dt; p.y += vy2 + g * dt * dt;
  }
  for (let it = 0; it < 3; it++) for (let k = 1; k < pts.length; k++) {
    const p = pts[k - 1], q = pts[k], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, s = (d - seg) / d;
    if (k === 1) { q.x -= dx * s; q.y -= dy * s; } else { p.x += dx * s * .5; p.y += dy * s * .5; q.x -= dx * s * .5; q.y -= dy * s * .5; }
  }
  const floor = !f.preview && typeof MAP === 'object' && MAP && MAP.floor;
  if (floor) for (const p of pts) if (p.y > floor - 2) p.y = floor - 2;
}
// Draws a strand as a ribbon that widens from w0 to w1.
function clothRibbon(c, pts, st, f) {
  const left = [], right = [], n = pts.length - 1, s = f.scale;
  pts.forEach((p, k) => {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n, k + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const w = lerp(st.w[0], st.w[1], k / n) * s / 2;
    left.push([p.x - dy / d * w, p.y + dx / d * w]); right.unshift([p.x + dy / d * w, p.y - dx / d * w]);
  });
  const fill = st.color === 'body' ? f.color : st.color, edge = st.edge === 'body' ? f.color : st.edge;
  const draw = () => poly(c, left.concat(right), fill, edge || null, 2 * s);
  if (st.glow) glow(c, fill, 12, draw); else draw();
}

// Outfit drawing, called by the renderer before the body (back layer) and after it (front layer).
function outfitDraw(c, f, look, layer, now) {
  const o = OUTFITS[look && look.outfit];
  if (!o || o.key === 'none') return;
  c.save(); c.lineCap = c.lineJoin = 'round';
  try {
    if (o.strands.length) {
      const cs = clothState(f, o, now);
      o.strands.forEach((st, k) => { if ((st.layer || 'back') === layer) clothRibbon(c, cs.strands[k], st, f); });
    }
    if (o[layer]) o[layer](c, f, f.P, f.scale, now);
  } catch (e) { report(e, 'outfit ' + o.key); }
  c.restore();
}

// A segment's frame for armour pieces: origin a, unit u (a->b), normal n, length.
function limbFrame(P, i, j) {
  const a = P[i], b = P[j], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x: a.x, y: a.y, ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len, len,
    at: (d, o) => [a.x + dx / len * d - dy / len * o, a.y + dy / len * d + dx / len * o] };
}
const outfitBelt = (c, f, color, buckle, w = 6) => {
  const sp = limbFrame(f.P, 1, 2), s = f.scale, k = sp.len - 6 * s;
  line(c, { x: sp.at(k, -11 * s)[0], y: sp.at(k, -11 * s)[1] }, { x: sp.at(k, 11 * s)[0], y: sp.at(k, 11 * s)[1] }, color, w * s);
  if (buckle) circle(c, sp.at(k, 0)[0], sp.at(k, 0)[1], 5 * s, buckle, '#00000066', 1.5);
};
const outfitPad = (c, f, color, edge) => {          // shoulder pads at the top of the spine
  const sp = limbFrame(f.P, 1, 2), s = f.scale;
  for (const side of [-1, 1]) {
    const [x, y] = sp.at(5 * s, side * 12 * s);
    c.beginPath(); c.ellipse(x, y, 10 * s, 6.5 * s, Math.atan2(sp.uy, sp.ux), 0, TAU);
    c.fillStyle = color; c.fill(); c.strokeStyle = edge; c.lineWidth = 1.5 * s; c.stroke();
  }
};
const outfitPlate = (c, f, color, edge) => {         // a chest plate over the upper spine
  const sp = limbFrame(f.P, 1, 2), s = f.scale;
  poly(c, [sp.at(2 * s, -11 * s), sp.at(2 * s, 11 * s), sp.at(sp.len * .62, 8 * s), sp.at(sp.len * .72, 0), sp.at(sp.len * .62, -8 * s)], color, edge, 1.5 * s);
};

// ---------- the outfits ----------
const NECK = [1, 1, 0], HIP = [2, 2, 0];
defLook(OUTFITS, 'none', { name: 'No outfit', icon: '—', strands: [] });
defLook(OUTFITS, 'scarf', { name: 'Long Scarf', icon: '🧣', desc: 'A long scarf that streams behind every dash.',
  strands: [{ at: NECK, dy: 4, n: 7, len: 70, w: [8, 6], color: 'body', edge: '#ffffff55', back: 260, lift: 300 }],
  front(c, f, P, s) { circle(c, P[1].x, P[1].y + 2 * s, 7 * s, f.color, '#ffffff88', 2 * s); } });
defLook(OUTFITS, 'cape', { name: 'Hero Cape', icon: '🦸', desc: 'Every hero needs one. Flaps in the wind.',
  strands: [{ at: NECK, n: 6, len: 78, w: [16, 30], color: '#e63946', edge: '#ffd84a', back: 220 }],
  front(c, f, P, s) { circle(c, P[1].x, P[1].y, 4.5 * s, '#ffd84a'); } });
defLook(OUTFITS, 'sash', { name: 'Ninja Sash', icon: '🥷', desc: 'A dark sash with two ribbon tails.',
  strands: [{ at: [1, 2, .9], n: 5, len: 46, w: [5, 3], color: '#2b2d42', edge: '#ff3d5a', back: 300, lift: 250 },
    { at: [1, 2, .9], dy: 4, n: 5, len: 38, w: [4, 2], color: '#2b2d42', edge: '#ff3d5a', back: 260, lift: 200 }],
  front(c, f) { outfitBelt(c, f, '#2b2d42', '#ff3d5a'); } });
defLook(OUTFITS, 'champ', { name: 'Champion Belt', icon: '🥇', desc: 'Heavy gold. Proof you were once the best.',
  strands: [], front(c, f) { outfitBelt(c, f, '#c79a1e', '#ffe27a', 8); } });
defLook(OUTFITS, 'samurai', { name: 'Lacquer Armour', icon: '🏯', desc: 'Lacquered plates that clack as you move.',
  strands: [0, 1, 2].map(k => ({ at: [1, 2, .95], dx: (k - 1) * 8, n: 3, len: 30, w: [10, 12], color: '#b3202e', edge: '#2b0a0e', layer: 'front', grav: 1.6 })),
  front(c, f) { outfitPad(c, f, '#b3202e', '#2b0a0e'); outfitPlate(c, f, '#7c121c', '#2b0a0e'); } });
defLook(OUTFITS, 'knight', { name: 'Knight Plate', icon: '🛡', desc: 'Polished plate and a short tabard.',
  strands: [{ at: [1, 2, .9], n: 3, len: 34, w: [14, 12], color: 'body', edge: '#d9e2ff', layer: 'front', grav: 1.4 }],
  front(c, f) { outfitPlate(c, f, '#c9d1e8', '#6b7392'); outfitPad(c, f, '#e3e8f7', '#6b7392'); } });
defLook(OUTFITS, 'mantle', { name: 'Royal Mantle', icon: '👑', desc: 'Velvet and fur, fit for a throne.',
  strands: [{ at: NECK, n: 6, len: 86, w: [22, 38], color: '#5b2a86', edge: '#f8f0ff', back: 160, grav: 1.2 }],
  front(c, f, P, s) { circle(c, P[1].x, P[1].y, 9 * s, '#f8f0ff'); circle(c, P[1].x, P[1].y, 4 * s, '#ffd84a'); } });
defLook(OUTFITS, 'cloak', { name: 'Wanderer Cloak', icon: '🧥', desc: 'Frayed at the hem from a thousand roads.',
  strands: [{ at: NECK, n: 7, len: 92, w: [20, 26], color: '#2f3a2f', edge: '#596b4f', back: 140 }],
  back(c, f, P, s) { circle(c, P[0].x - f.face * 3 * s, P[0].y - 2 * s, 17 * s, '#2f3a2f'); } });
defLook(OUTFITS, 'ribbons', { name: 'Spirit Ribbons', icon: '🎐', desc: 'Glowing ribbons drift from both wrists.',
  strands: [{ at: [4, 4, 0], n: 8, len: 80, w: [4, 1], color: 'body', back: 120, lift: 900, glow: true },
    { at: [6, 6, 0], n: 8, len: 80, w: [4, 1], color: '#ffffff', back: 120, lift: 900, glow: true }] });
defLook(OUTFITS, 'kilt', { name: 'Battle Kilt', icon: '🏴', desc: 'Pleats that swing with every kick.',
  strands: [-2, -1, 0, 1, 2].map(k => ({ at: HIP, dx: k * 4.5, n: 3, len: 30, w: [8, 9], color: k % 2 ? '#2a6f4a' : '#c0392b', edge: '#14261a', layer: 'front' })),
  front(c, f) { outfitBelt(c, f, '#14261a', '#c9a227'); } });
defLook(OUTFITS, 'tail', { name: 'Fox Tail', icon: '🦊', desc: 'Fluffy, bouncy, and very proud of itself.',
  strands: [{ at: HIP, dy: -6, n: 6, len: 60, w: [10, 16], color: '#ff8a2e', edge: '#fff3e0', back: 380, lift: 1500 }] });
defLook(OUTFITS, 'banner', { name: 'War Banner', icon: '🚩', desc: 'A clan flag on a back pole. Hard to miss.',
  strands: [{ at: [1, 1, 0], dx: -10, dy: -44, n: 5, len: 46, w: [16, 14], color: 'body', edge: '#ffffff88', back: 420, lift: 600 }],
  back(c, f, P, s) { lineXY(c, P[2].x - f.face * 8 * s, P[2].y, P[1].x - f.face * 10 * s, P[1].y - 48 * s, '#8a6a43', 3.5 * s); } });
defLook(OUTFITS, 'jester', { name: 'Jester Motley', icon: '🃏', desc: 'Secret: show off and win.', hidden: true,
  strands: [{ at: NECK, n: 4, len: 34, w: [6, 2], color: '#ffd84a', back: 200, lift: 400 }, { at: NECK, n: 4, len: 30, w: [6, 2], color: '#b98cff', back: 160, lift: 300 }],
  front(c, f, P, s) {
    for (let k = -2; k <= 2; k++) poly(c, [[P[1].x + k * 6 * s, P[1].y], [P[1].x + (k + .5) * 6 * s, P[1].y + 9 * s], [P[1].x + (k + 1) * 6 * s, P[1].y]], k % 2 ? '#ffd84a' : '#b98cff');
  } });

// ---------- weapon skins: recolour a weapon's own drawing, then add a small overlay ----------
// The weapon draw function gets a proxy of the context whose fill/stroke/shadow colours pass through the skin's
// palette (by brightness), so every weapon (old or new) takes any skin without knowing about it.
function skinParse(str) {
  let m = /^#([0-9a-f]{3,8})$/i.exec(str);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split('').map(x => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length > 6 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  m = /^rgba?\(([^)]+)\)$/.exec(str);
  if (!m) return null;
  const v = m[1].split(',').map(Number);
  return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
}
const skinMix = (stops, t) => {      // stops: hex colours spread evenly from dark (t=0) to light (t=1)
  const x = clamp(t, 0, 1) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), a = skinParse(stops[i]), b = skinParse(stops[i + 1]);
  return [0, 1, 2].map(k => Math.round(lerp(a[k], b[k], x - i)));
};
function skinColor(skin, str) {
  const cache = skin.cache || (skin.cache = new Map());
  if (cache.has(str)) return cache.get(str);
  const c = skinParse(str);
  let out = str;
  if (c) {
    const lum = (c[0] * .3 + c[1] * .59 + c[2] * .11) / 255, rgb = skin.map ? skin.map(lum, c) : skinMix(skin.stops, lum);
    out = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${c[3]})`;
  }
  if (cache.size < 400) cache.set(str, out);
  return out;
}
const SKIN_CTX = new WeakMap();      // real context -> { proxy, skin }
function skinCtx(c, skin) {
  if (!skin) return c;
  let e = SKIN_CTX.get(c);
  if (!e) {
    const fns = {};
    e = { skin };
    e.proxy = new Proxy(c, {
      get(t, k) { const v = t[k]; return typeof v === 'function' ? (fns[k] || (fns[k] = v.bind(t))) : v; },
      set(t, k, v) { t[k] = typeof v === 'string' && /Style$|Color$/.test(k) ? skinColor(e.skin, v) : v; return true; },
    });
    SKIN_CTX.set(c, e);
  }
  e.skin = skin;
  return e.proxy;
}
// The skin a fighter shows on weapon w (skins are chosen per weapon category; the off-hand follows the main weapon).
function skinFor(f, look) {
  const skins = look && look.skins, key = skins && f.w && skins[f.w.cat];
  return key && WSKINS[key] && key !== 'none' ? WSKINS[key] : null;
}
// Draws one weapon rig with its skin: recoloured draw, then the skin's overlay along the weapon.
function skinDrawWeapon(c, f, rig, view, look) {
  const skin = skinFor(f, look);
  hook(rig.w, 'draw', skinCtx(c, skin), f, view);
  if (!skin || !skin.over) return;
  c.save();
  try { skin.over(c, view, (typeof performance !== 'undefined' ? performance.now() / 1000 : 0) + f.id); } catch (e) { report(e, 'skin ' + skin.key); }
  c.restore();
}
const skinSpark = (c, x, y, r, color) => poly(c, [[x, y - r], [x + r * .3, y - r * .3], [x + r, y], [x + r * .3, y + r * .3], [x, y + r], [x - r * .3, y + r * .3], [x - r, y], [x - r * .3, y - r * .3]], color);

defLook(WSKINS, 'none', { name: 'Original', icon: '◻', stops: ['#000000', '#ffffff'] });
defLook(WSKINS, 'gold', { name: 'Gilded', icon: '🟨', stops: ['#4a3208', '#b8862a', '#ffe27a', '#fff8d8'],
  over(c, s, t) { const d = (t * .7 % 1) * s.L, p = s.at(d, 0); skinSpark(c, p.x, p.y, 5 * s.k, '#fffbe6'); } });
defLook(WSKINS, 'crystal', { name: 'Crystal', icon: '💎', stops: ['#3a3fa8', '#7fb5ff', '#d9f6ff', '#ffffff'],
  over(c, s, t) { c.globalAlpha = .5 + .3 * Math.sin(t * 4); for (let k = 1; k < 4; k++) { const p = s.at(s.L * k / 4, 0); skinSpark(c, p.x, p.y, 3 * s.k, '#e8fbff'); } } });
defLook(WSKINS, 'neon', { name: 'Neon Line', icon: '🟪', map: (l, c) => (c[0] > c[2] ? [255, 60 + l * 120 | 0, 220] : [60 + l * 120 | 0, 240, 255]),
  over(c, s) { glow(c, '#ff5ad1', 14, () => line(c, s.h, s.t, rgba('#ffffff', .55), 2 * s.k)); } });
defLook(WSKINS, 'pixel', { name: '8-Bit', icon: '👾', map: l => skinParse(['#0f380f', '#306230', '#8bac0f', '#c4dc5a'][Math.min(3, l * 4 | 0)]),
  over(c, s, t) { for (let k = 0; k < 4; k++) { const p = s.at(s.L * ((k / 4 + t * .35) % 1), (k % 2 ? 5 : -5) * s.k); c.fillStyle = '#c4dc5a'; c.fillRect(p.x - 2, p.y - 2, 4, 4); } } });
defLook(WSKINS, 'frost', { name: 'Frostbite', icon: '🧊', stops: ['#1b4f7a', '#68b6e8', '#e8fbff'],
  over(c, s, t) { for (let k = 0; k < 3; k++) { const u = (t * .5 + k / 3) % 1, p = s.at(s.L * (1 - k * .25), 0); circle(c, p.x + Math.sin(t * 3 + k) * 6, p.y + u * 18, 1.8 * s.k, rgba('#ffffff', 1 - u)); } } });
defLook(WSKINS, 'lava', { name: 'Molten', icon: '🌋', stops: ['#2a0500', '#a61b00', '#ff5a00', '#ffd23a'],
  over(c, s, t) { for (let k = 0; k < 3; k++) { const u = (t * .9 + k / 3) % 1, p = s.at(s.L * (.4 + k * .2), 0); circle(c, p.x, p.y + u * 22, 2.2 * s.k * (1 - u), '#ffb03a'); } } });
defLook(WSKINS, 'void', { name: 'Voidglass', icon: '🌌', stops: ['#05000c', '#2a0c4d', '#9a4dff', '#e7d1ff'],
  over(c, s, t) { const p = s.at(s.L * .8, 0); circle(c, p.x, p.y, (5 + Math.sin(t * 5) * 2) * s.k, null, rgba('#c08cff', .7), 1.5); } });
defLook(WSKINS, 'candy', { name: 'Candy Stripe', icon: '🍭', map: l => (l < .5 ? [255, 92, 160] : [255, 240, 246]),
  over(c, s) { for (let k = 1; k < 6; k++) { const a = s.at(s.L * k / 6, -4 * s.k), b = s.at(s.L * k / 6 + 5 * s.k, 4 * s.k); line(c, a, b, '#ff3d8a', 2 * s.k); } } });

// ---------- K.O. effects: the K.O.er's flourish on top of the neon shatter ----------
// Particles move by game time (pauses freeze them, the kill-cam replays them slowed) like the shatter pieces.
let KO_PARTS = [];
const KOFX_MAX = 260;
function koFxSpawn(key, x, y, color) {
  const def = KOFX[key];
  if (!def || !def.spawn || G_STATE.sim) return;
  if (FX_RECORD) FX_RECORD('koFx', [key, x, y, color]);
  const add = o => KO_PARTS.push(Object.assign({ x, y, vx: 0, vy: 0, g: 0, t0: G_STATE.t, last: G_STATE.t, life: 1.4, size: 6, color, rot: 0, va: 0, kind: key }, o));
  def.spawn(add, x, y, color);
  if (KO_PARTS.length > KOFX_MAX) KO_PARTS.splice(0, KO_PARTS.length - KOFX_MAX);
}
on('boot', () => { if (typeof KC_FX === 'object') KC_FX.koFx = koFxSpawn; });
on('roundStart', () => { KO_PARTS = []; });
on('ko', (V, K) => {
  if (!K || K === V || V.summon) return;
  const key = lookOf(K).ko;
  if (key && key !== 'none') koFxSpawn(key, V.P[2].x, V.P[2].y - 20, K.color);
});
function koFxDraw(c) {
  if (!KO_PARTS.length) return;
  const now = G_STATE.t;
  KO_PARTS = KO_PARTS.filter(p => p.t0 <= now + 1e-6 && now - p.t0 < p.life + (p.delay || 0));
  c.save();
  for (const p of KO_PARTS) {
    const dt = clamp(now - p.last, 0, .05), age = now - p.t0 - (p.delay || 0);
    p.last = now;
    if (age < 0) continue;
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.va * dt;
    if (p.burst && age >= p.burst && !p.popped) { p.popped = true; koFxFirework(p); }
    c.globalAlpha = clamp(1 - age / p.life, 0, 1) * (p.popped ? 0 : 1);
    if (c.globalAlpha > 0) KOFX[p.kind].draw(c, p, age);
  }
  c.restore();
}
function koFxFirework(p) {
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * TAU, sp = rnd(160, 260);
    KO_PARTS.push({ kind: 'fireworks', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 260, t0: G_STATE.t, last: G_STATE.t, life: .9, size: 3, color: k % 2 ? p.color : '#ffffff', rot: 0, va: 0 });
  }
}
const koHeart = (c, x, y, s, color) => {
  c.beginPath(); c.moveTo(x, y + s * .9);
  c.bezierCurveTo(x - s * 1.6, y - s * .2, x - s * .6, y - s * 1.3, x, y - s * .4);
  c.bezierCurveTo(x + s * .6, y - s * 1.3, x + s * 1.6, y - s * .2, x, y + s * .9);
  c.fillStyle = color; c.fill();
};
defLook(KOFX, 'none', { name: 'Shatter only', icon: '✦' });
defLook(KOFX, 'confetti', { name: 'Confetti', icon: '🎊',
  spawn(add) { for (let k = 0; k < 40; k++) add({ vx: rnd(-320, 320), vy: rnd(-620, -260), g: 700, life: rnd(1.4, 2.2), size: rnd(4, 7), va: rnd(-12, 12), color: pick(['#ff5ad1', '#ffd84a', '#5ef2ff', '#9dff5a', '#ff8a2e']) }); },
  draw(c, p) { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); c.restore(); } });
defLook(KOFX, 'fireworks', { name: 'Fireworks', icon: '🎆',
  spawn(add, x, y) { for (let k = 0; k < 4; k++) add({ vx: rnd(-140, 140), vy: rnd(-760, -560), g: 520, life: .75, burst: rnd(.5, .7), delay: k * .14, size: 3, color: pick(['#ff5ad1', '#ffd84a', '#5ef2ff', '#9dff5a']) }); },
  draw(c, p) { glow(c, p.color, 10, () => circle(c, p.x, p.y, p.size, p.color)); } });
defLook(KOFX, 'pixels', { name: 'Pixel Pop', icon: '👾',
  spawn(add, x, y, color) { for (let k = 0; k < 34; k++) add({ x: x + rnd(-24, 24), y: y + rnd(-40, 30), vx: rnd(-260, 260), vy: rnd(-460, -80), g: 1100, life: rnd(.8, 1.4), size: pick([5, 7, 9]), color: k % 3 ? color : '#ffffff' }); },
  draw(c, p) { c.fillStyle = p.color; c.fillRect(Math.round(p.x / 4) * 4, Math.round(p.y / 4) * 4, p.size, p.size); } });
defLook(KOFX, 'lightning', { name: 'Thunderclap', icon: '⚡',
  spawn(add, x, y) { for (let k = 0; k < 3; k++) add({ x: x + rnd(-40, 40), y, life: .45, delay: k * .09, seed: Math.random() * 99, color: '#d9f6ff' }); },
  draw(c, p) {
    const pts = [];
    for (let k = 0; k <= 8; k++) pts.push([p.x + Math.sin(p.seed + k * 2.1) * 26 * (k > 0 && k < 8), p.y - 620 + k * 80]);
    glow(c, '#7fd8ff', 22, () => { c.strokeStyle = p.color; c.lineWidth = 4; c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); });
  } });
defLook(KOFX, 'hearts', { name: 'Hearts', icon: '💖',
  spawn(add) { for (let k = 0; k < 14; k++) add({ vx: rnd(-90, 90), vy: rnd(-220, -120), life: rnd(1.4, 2), size: rnd(6, 11), va: rnd(-1, 1), color: pick(['#ff5a9a', '#ff9ad1', '#ff3d5a']) }); },
  draw(c, p, age) { koHeart(c, p.x + Math.sin(age * 5 + p.size) * 8, p.y, p.size, p.color); } });
defLook(KOFX, 'stars', { name: 'Star Burst', icon: '⭐',
  spawn(add) { for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; add({ vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, g: 300, life: 1, size: rnd(5, 9), va: 8, color: k % 2 ? '#ffd84a' : '#fff6c8' }); } },
  draw(c, p) { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); hatStar(c, 0, 0, p.size / 2, p.color); c.restore(); } });
defLook(KOFX, 'ghost', { name: 'Spooked', icon: '👻',
  spawn(add, x, y) { add({ vy: -90, life: 2, size: 22, color: '#e8f0ff' }); for (let k = 0; k < 6; k++) add({ x: x + rnd(-30, 30), vy: rnd(-60, -30), life: 1.6, size: 4, color: '#b98cff' }); },
  draw(c, p, age) {
    if (p.size < 10) { circle(c, p.x, p.y, p.size, p.color); return; }
    const s = p.size, x = p.x + Math.sin(age * 4) * 10, y = p.y;
    c.beginPath(); c.arc(x, y, s, Math.PI, 0); c.lineTo(x + s, y + s);
    for (let k = 3; k >= 0; k--) c.lineTo(x - s + k * s / 1.5, y + s - (k % 2 ? 6 : 0));
    c.closePath(); c.fillStyle = rgba(p.color, .85); c.fill();
    circle(c, x - 7, y - 3, 3, '#0b0c18'); circle(c, x + 7, y - 3, 3, '#0b0c18');
  } });
defLook(KOFX, 'bubbles', { name: 'Bubble Pop', icon: '🫧',
  spawn(add) { for (let k = 0; k < 18; k++) add({ vx: rnd(-70, 70), vy: rnd(-200, -80), life: rnd(1, 1.8), size: rnd(5, 13), color: '#9fe8ff' }); },
  draw(c, p) { circle(c, p.x, p.y, p.size, rgba(p.color, .15), p.color, 1.5); circle(c, p.x - p.size * .35, p.y - p.size * .35, p.size * .2, '#ffffff'); } });
defLook(KOFX, 'disco', { name: 'Disco Fever', icon: '🪩', hidden: true,
  spawn(add, x, y) { for (let k = 0; k < 8; k++) add({ life: 1.6, rot: k / 8 * TAU, va: 3, size: 160, color: ['#ff5ad1', '#5ef2ff', '#ffd84a', '#9dff5a'][k % 4] }); add({ life: 1.6, size: 14, color: '#e0e6ff', va: 6 }); },
  draw(c, p) {
    if (p.size < 40) { circle(c, p.x, p.y, p.size, p.color, '#ffffff', 2); return; }
    c.globalAlpha *= .35; poly(c, [[p.x, p.y], [p.x + Math.cos(p.rot - .08) * p.size, p.y + Math.sin(p.rot - .08) * p.size], [p.x + Math.cos(p.rot + .08) * p.size, p.y + Math.sin(p.rot + .08) * p.size]], p.color);
  } });

// ---------- taunts and victory poses (arm springs) ----------
// A pose gives targets for the back hand (P4) and weapon hand (P6) relative to the neck, in body px (x follows
// facing); `hop` makes the fighter bounce. Taunts pick one of the TAUNT_POSES; victories use the look's pose.
defLook(POSES, 'cheer', { name: 'Cheer', icon: '🙌', hands: t => [[-14, -58 - Math.sin(t * 10) * 6], [16, -58 + Math.sin(t * 10) * 6]], hop: .7 });
defLook(POSES, 'flex', { name: 'Flex', icon: '💪', hands: () => [[-30, -26], [32, -26]] });
defLook(POSES, 'wave', { name: 'Wave', icon: '👋', hands: t => [[-12, 26], [28 + Math.sin(t * 12) * 14, -52]] });
defLook(POSES, 'point', { name: 'Point', icon: '👉', hands: () => [[-10, 30], [58, -14]] });
defLook(POSES, 'shrug', { name: 'Shrug', icon: '🤷', hands: t => [[-36, -6 - Math.abs(Math.sin(t * 6)) * 8], [36, -6 - Math.abs(Math.sin(t * 6)) * 8]] });
defLook(POSES, 'dab', { name: 'Dab', icon: '🕺', hands: () => [[-42, -36], [30, -4]] });
defLook(POSES, 'salute', { name: 'Salute', icon: '🫡', hands: () => [[-8, 34], [12, -26]] });
defLook(POSES, 'bounce', { name: 'Bunny Hop', icon: '🐰', hands: () => [[-18, -40], [18, -40]], hop: .45 });
const TAUNT_POSES = ['wave', 'shrug', 'flex', 'dab'];
const TAUNT = { time: .9, cd: 3.5, safe: 300, meter: 6 };

function poseApply(f, pose, t) {
  const P = f.P, neck = P[1], s = f.scale, hands = pose.hands(t);
  [[4, 3], [6, 5]].forEach(([h, e], k) => {
    const [x, y] = hands[k], tx = neck.x + x * f.face * s, ty = neck.y + y * s;
    P[h].fx += (tx - P[h].x) * 420 - vx(P[h]) * 18; P[h].fy += (ty - P[h].y) * 420 - vy(P[h]) * 18 - PHYS.gravity;
    P[e].fx += ((neck.x + tx) / 2 - P[e].x) * 120; P[e].fy += ((neck.y + ty) / 2 - P[e].y) * 120 - PHYS.gravity * .5;
  });
  if (pose.hop && f.grounded && t % pose.hop < DT * 1.5) for (const p of P) kick(p, 0, -420);
}

// Taunt key: a short pose; finishing it with no foe within TAUNT.safe px (and untouched) earns a sliver of super.
function tauntStart(f) {
  if (!f.alive || f.mem.taunt || (f.mem.tauntCd || 0) > G_STATE.t || !canAct(f) || f.mount || f.holding || f.ult) return false;
  f.mem.taunt = { t: 0, pose: pick(TAUNT_POSES), hit: false };
  f.mem.tauntCd = G_STATE.t + TAUNT.cd;
  if (!aiBrain(f)) float(f.P[0].x, f.P[0].y - 44, pick(['Come on!', 'Too easy!', 'Is that all?', '¯\\_(ツ)_/¯', 'Catch me!']), f.color, 16);   // CPUs speak through their speech bubbles instead (67)
  emit('taunt', f);
  return true;
}
function tauntStep(f, dt) {
  const tt = f.mem.taunt;
  if (f.inp.taunt) tauntStart(f);
  if (!tt) return;
  tt.t += dt;
  const moved = Math.abs(f.inp.mx) > .3 || f.inp.attack || f.inp.jump || f.inp.blockHeld;
  if (tt.hit || moved || !f.alive) { f.mem.taunt = null; return; }
  poseApply(f, POSES[tt.pose], tt.t);
  if (tt.t < TAUNT.time) return;
  f.mem.taunt = null;
  const c = chest(f), near = enemiesOf(f).some(e => e.alive && dist(chest(e), c) < TAUNT.safe);
  if (near) return;
  gainSuper(f, TAUNT.meter);
  float(c.x, c.y - 70, '+SUPER', '#ffd84a', 15);
  emit('tauntDone', f);
}
on('damage', (B, amt, o) => { if (B.mem && B.mem.taunt && o && o.src && o.src !== B) B.mem.taunt.hit = true; });

// Winners strike their victory pose through the K.O. delay and behind the results screen.
function victoryStep(f) {
  if (!f.alive || G_STATE.winner < 0 || f.team !== G_STATE.winner) return;
  const pose = POSES[lookOf(f).pose] || POSES.cheer;
  poseApply(f, pose, G_STATE.t);
}

on('mapStep', dt => {
  if (G_STATE.lock > 0) { for (const f of F) f.inp.taunt = false; return; }   // no queued taunts from the start freeze
  for (const f of F) {
    if (f.summon) continue;
    if (G_STATE.ending || G_STATE.state === 'over') { victoryStep(f); continue; }
    tauntStep(f, dt);
    f.inp.taunt = false;
  }
});
