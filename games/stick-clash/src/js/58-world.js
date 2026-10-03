// 58-world.js: world systems every arena shares.
// - Weather: one per match (rain, snow, fog, wind, night), picked on the arena screen. It changes physics, not just looks:
//   rain and snow cut friction and grip, wind gusts push fighters and shots, fog hides far foes from CPU gunners.
// - Darkness and lights: night, haunted-house blackouts and tunnels share one shade layer with holes cut by lights;
//   fighters and weapons glow through it.
// - Breakables: crates, glass panes and pillars (solids with `brk`). Hits, shots, blasts and fast bodies break them;
//   platforms that rest on them (`restsOn: id`) collapse.
// - worldFrame(f, phase, enter): the hook 99-main calls around a fighter's brain and drive, so an arena can re-orient
//   a fighter (the asteroid's radial gravity) without touching the core.
// Core hooks used: emit('mapStepPre'/'mapStep') in worldStep, MAP.collide in collidePoint, worldDrawTop in render.

// ---------- weather ----------
// friction/grip multiply the arena's own values; gust = wind strength (px/s²); sight = fog radius; dark = shade alpha.
const WEATHER = {
  clear: { name: 'Clear', icon: '☀', desc: 'No weather' },
  rain: { name: 'Rain', icon: '🌧', desc: 'Wet, slick footing', friction: .5, grip: .65 },
  snow: { name: 'Snow', icon: '❄', desc: 'Icy, slippery ground', friction: .25, grip: .4 },
  fog: { name: 'Fog', icon: '🌫', desc: 'You only see what is close', sight: 380 },
  wind: { name: 'Wind', icon: '🌬', desc: 'Gusts push fighters and shots', gust: 1350 },
  night: { name: 'Night', icon: '🌙', desc: 'Dark arena, glowing fighters', dark: .74 },
};
const WX_KEYS = Object.keys(WEATHER);
// key: this round's weather. pick: the match's roll. ann: the round-start announcement.
const WX = { key: 'clear', def: WEATHER.clear, cfg: null, pick: 'clear', gust: {}, baseWind: 0, ann: null };

// Arenas opt out with weather: false, or allow a list (e.g. ['night', 'fog']). Arenas with their own gusts skip wind.
function wxAllowed(map, key) {
  if (key === 'clear') return true;
  if (map.weather === false) return false;
  if (Array.isArray(map.weather)) return map.weather.includes(key);
  return !(key === 'wind' && map.ownWind);
}

function wxRoll(choice) {
  if (choice === 'random') return chance(.3) ? 'clear' : pick(WX_KEYS.filter(k => k !== 'clear'));
  return WEATHER[choice] ? choice : 'clear';
}

// The match's weather for this round's arena: a random pick that this arena can't have is re-rolled among the ones it can.
function wxForRound(map) {
  if (wxAllowed(map, WX.pick)) return WX.pick;
  if (WX.cfg && WX.cfg.weather === 'random') return pick(WX_KEYS.filter(k => wxAllowed(map, k)));
  return 'clear';
}

on('roundStart', () => {
  const cfg = G_STATE.cfg || {};
  if (WX.cfg !== cfg) { WX.cfg = cfg; WX.pick = wxRoll(cfg.weather ?? (cfg.demo ? 'random' : 'clear')); }
  WX.key = MAP ? wxForRound(MAP) : 'clear';
  WX.def = WEATHER[WX.key];
  WX.gust = {};
  WX.baseWind = PHYS.windX;
  PHYS.friction *= WX.def.friction || 1;
  WX.ann = WX.key === 'clear' ? null : { text: `${WX.def.icon}  ${WX.def.name.toUpperCase()}`, sub: WX.def.desc, t: 3.2 };
  brkReset();
});

// Before the arena's own step: undo last step's weather wind and grip so arenas that never set them don't stack it.
on('mapStepPre', () => {
  if (WX.def.gust) PHYS.windX = WX.baseWind;
  if (WX.def.grip) for (const f of F) f.grip = null;
});

on('mapStep', dt => {
  if (!MAP) return;
  const d = WX.def;
  if (d.grip) for (const f of F) f.grip = (f.grip ?? 1) * d.grip;
  if (d.gust) wxStepWind(dt);
  if ((d.friction || 0) < 1 && d.friction) wxSplash(dt);
  if (WX.ann) WX.ann.t -= dt;
  brkStep(dt);
});

// Gusts reuse the arena gust machine (warning, ramp, blow); shots drift with them too.
function wxStepWind(dt) {
  const base = PHYS.windX;
  mapStepWind(WX.gust, dt, { calm: [2.5, 5], first: [1, 3], warn: 1, blow: [1.5, 2.6], power: WX.def.gust, base });
  const push = (PHYS.windX - base) * .45 * dt;
  for (const p of PROJ) if (!p.zone && !p.dead && p.kind !== 'pickup') p.vx += push;
}

// Puddle splashes (rain) and snow puffs (snow) under running feet. Effects are skipped in SC.sim.
function wxSplash(dt) {
  const col = WX.key === 'snow' ? '#ffffff' : '#9fd4ff';
  for (const f of F) {
    if (!f.alive || !f.grounded || Math.abs(vx(f.P[2])) < 220 || !chance(dt * 7)) continue;
    burst(f.P[2].x, feetY(f), col, 4, 160, { life: .35, grav: 1, size: 2 });
  }
}

// Fog: a CPU can't see a foe beyond the fog's sight, so a gunner holds fire until it closes in.
function wxFogBrain(f) {
  const foe = f.ai && f.ai.foe;
  if (!foe || !foe.alive || dist(foe.P[2], f.P[2]) <= WX.def.sight) return;
  if (f.w.ranged) { f.inp.attack = false; f.inp.attackHeld = false; }
  f.inp.dash = 0;
}

// Called by worldStep around each fighter's brain ('think') and drive ('drive'); enter = before, !enter = after.
function worldFrame(f, phase, enter) {
  if (!MAP) return;
  if (MAP.frame) hook(MAP, 'frame', f, phase, enter);
  if (phase === 'think' && !enter && WX.key === 'fog') wxFogBrain(f);
}

// ---------- arena screen: weather picker (95-ui calls these) ----------
const WX_MENU = ['random', ...WX_KEYS];
function wxMenuPick() { const k = store.get('weather', 'random'); return WX_MENU.includes(k) ? k : 'random'; }
const wxLabel = k => k === 'random' ? '🎲 Random' : `${WEATHER[k].icon} ${WEATHER[k].name}`;
function wxPicker() {
  const cur = wxMenuPick(), i = WX_MENU.indexOf(cur);
  const set = d => { store.set('weather', WX_MENU[(i + d + WX_MENU.length) % WX_MENU.length]); uiSfx('click'); refreshScreen(); };
  const tip = cur === 'random' ? 'A random weather each match (or clear skies)' : WEATHER[cur].desc;
  return el('div', { class: 'field wx-field', title: tip }, el('span', { class: 'lbl', text: 'Weather' }),
    el('div', { class: 'stepper' },
      el('button', { 'aria-label': 'Previous weather', 'data-key': 'weather-prev', onclick: () => set(-1) }, '‹'),
      el('output', { text: wxLabel(cur), style: { minWidth: '6.5em' } }),
      el('button', { 'aria-label': 'Next weather', 'data-key': 'weather-next', onclick: () => set(1) }, '›')));
}

// ---------- drawing: weather, shade, lights ----------
function worldDrawTop(ctx, t) {
  if (!MAP) return;
  const k = WX.key;
  if (k === 'rain') wxDrawRain(ctx, t);
  else if (k === 'snow') wxDrawSnow(ctx, t);
  else if (k === 'wind') { mapDrawWind(ctx, WX.gust, t, '#d8f0ff'); wxDrawLeaves(ctx, t); }
  const dark = Math.max(WX.def.dark || 0, MAP.dark || 0);
  if (dark > .02) worldDrawDark(ctx, dark, t);
  if (k === 'fog') wxDrawFog(ctx, t);
  if (k === 'night') wxDrawMoon(ctx, t);
  wxDrawAnnounce(ctx);
}

function wxDrawRain(ctx, t) {
  const slant = clamp(PHYS.windX / 1500, -1, 1) * 16 - 3;
  ctx.strokeStyle = 'rgba(170,205,255,.32)'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let k = 0; k < 120; k++) {
    const sp = 900 + mapHash(k) * 500, x = mapWrap(mapHash(k + 3) * 1400 + slant * t * 45, 1400) - 60;
    const y = mapWrap(mapHash(k + 7) * 820 + t * sp, 820) - 50;
    ctx.moveTo(x, y); ctx.lineTo(x + slant, y + 22);
  }
  ctx.stroke();
  const surf = wxSurfaces();                       // ripples in puddles on the ground and ledges
  ctx.strokeStyle = 'rgba(170,215,255,.45)'; ctx.lineWidth = 1;
  for (let k = 0; k < 14; k++) {
    const s = surf[k % surf.length], ph = mapWrap(t * 1.4 + mapHash(k + 40), 1);
    const x = s.x + 12 + mapHash(k + 50 + Math.floor(t * 1.4 + mapHash(k + 40))) * (s.w - 24);
    ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(x, s.y + 2, 4 + ph * 16, 1.5 + ph * 3, 0, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Tops anyone can stand on: the floor and live platforms (for puddles and snow caps).
function wxSurfaces() {
  const out = MAP.solids.filter(s => !mapParked(s) && s.w > 30 && s.y > 0 && s.y < H).map(s => ({ x: s.x, y: s.y, w: s.w }));
  if (MAP.floor != null) out.push({ x: 0, y: MAP.floor, w: W });
  return out.length ? out : [{ x: 0, y: H - 20, w: W }];
}

function wxDrawSnow(ctx, t) {
  ctx.fillStyle = 'rgba(245,250,255,.85)';
  for (const s of wxSurfaces()) { ctx.beginPath(); ctx.roundRect(s.x - 2, s.y - 4, s.w + 4, 6, 3); ctx.fill(); }
  mapParticles(ctx, t, 110, { vx: PHYS.windX * .04 + 12, vy: 75, sway: 26, size: 2.6, color: '#ffffff', alpha: .9, seed: 31, shape: 'circle' });
}

function wxDrawLeaves(ctx, t) {
  const g = WX.gust;
  mapParticles(ctx, t, 26, { vx: 60 + (g.k || 0) * 900 * (g.dir || 1), vy: 30, sway: 40, size: 4, color: '#9fdc7a', alpha: .7, seed: 77, shape: 'petal' });
}

function wxDrawFog(ctx, t) {
  worldDrawShade(ctx, '#8d99ad', .84, wxViewers().map(f => { const c = chest(f); return { x: c.x, y: c.y, r: WX.def.sight * .85, a: 1 }; }));
  ctx.fillStyle = 'rgba(200,210,225,.08)';          // drifting fog banks
  for (let k = 0; k < 6; k++) {
    const x = mapWrap(mapHash(k) * W + t * (18 + k * 6), W + 600) - 300, y = 120 + mapHash(k + 9) * 480;
    ctx.beginPath(); ctx.ellipse(x, y, 260, 50, 0, 0, TAU); ctx.fill();
  }
}

// Whose eyes the fog and announcements follow: real players, or everyone when only CPUs fight.
function wxViewers() {
  const live = F.filter(f => f.alive && !f.summon), humans = live.filter(f => f.ctrl === 'human' && !f.autopilot);
  return humans.length ? humans : live;
}

function wxDrawMoon(ctx, t) {
  glow(ctx, '#dfe8ff', 30, () => circle(ctx, 1130, 92, 30, '#eef3ff'));
  circle(ctx, 1142, 84, 26, 'rgba(10,14,30,.85)');
}

function wxDrawAnnounce(ctx) {
  const a = WX.ann;
  if (!a || a.t <= 0) return;
  ctx.save(); setArenaTransform();
  ctx.globalAlpha = clamp(a.t, 0, 1) * clamp((3.2 - a.t) * 4, 0, 1);
  const y = H - 92;
  ctx.fillStyle = 'rgba(8,10,24,.78)'; ctx.beginPath(); ctx.roundRect(W / 2 - 220, y - 30, 440, 64, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(160,200,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#e8f2ff'; ctx.font = `24px ${FONT_DISPLAY}`; ctx.fillText(a.text, W / 2, y + 2);
  ctx.font = `15px ${FONT_BODY}`; ctx.fillStyle = 'rgba(200,220,255,.85)'; ctx.fillText(a.sub, W / 2, y + 23);
  ctx.restore();
}

// One quarter-resolution layer covering the arena (plus the shake margin): filled with shade, then lights cut holes.
// The shade is soft, so the low resolution doesn't show, and it keeps the cost of a dark frame small.
const WORLD_SHADE_K = .25, WORLD_SHADE_W = 1360 * WORLD_SHADE_K, WORLD_SHADE_H = 800 * WORLD_SHADE_K;
let WORLD_SHADE = null;
function worldDrawShade(ctx, color, alpha, holes) {
  const c = WORLD_SHADE || (WORLD_SHADE = document.createElement('canvas'));
  if (c.width !== WORLD_SHADE_W) { c.width = WORLD_SHADE_W; c.height = WORLD_SHADE_H; c.g = c.getContext('2d'); }
  const g = c.g, k = WORLD_SHADE_K;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, c.width, c.height); g.fillStyle = rgba(color, alpha); g.fillRect(0, 0, c.width, c.height);
  g.setTransform(k, 0, 0, k, 40 * k, 40 * k);       // world (-40..1320, -40..760) -> layer pixels
  g.globalCompositeOperation = 'destination-out';
  for (const L of holes) {
    if (!(L.r > 0) || !Number.isFinite(L.x + L.y)) continue;
    const gr = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r), a = L.a ?? 1;
    gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(.55, `rgba(0,0,0,${a * .7})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(c, -40, -40, 1360, 800);
}

function worldDrawDark(ctx, dark, t) {
  worldDrawShade(ctx, '#03040c', dark, worldLights(t));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';      // fighters glow in their own colour
  for (const f of F) if (f.alive) { const c = chest(f); mapGlow(ctx, c.x, c.y, 80 * f.scale, f.color, .3 * dark); }
  ctx.restore();
  if (!MAP.lights && WX.key === 'night') for (const L of wxLamps()) wxDrawLamp(ctx, L.x, L.y + 30, t);
}

// Everything that lights the dark: fighters, blades, shots, orbs, glowing hazards, the arena's own lamps.
function worldLights(t) {
  const out = [];
  for (const f of F) {
    if (!f.alive) continue;
    const c = chest(f), tp = f.P[f.tip];
    out.push({ x: c.x, y: c.y, r: 150 * f.scale, a: .9 }, { x: tp.x, y: tp.y, r: 70, a: .6 });
  }
  for (const p of PROJ) if (!p.dead && !p.zone) out.push({ x: p.x, y: p.y, r: 60, a: .7 });
  for (const o of ORB_LIST) out.push({ x: o.x, y: o.y, r: 80, a: .7 });
  for (const hz of MAP.hazards) {
    if (!hz.dps || mapParked(hz) || hz.w > 1400) continue;
    out.push({ x: hz.x + hz.w / 2, y: hz.y + Math.min(hz.h, 80) / 2, r: Math.max(90, Math.min(hz.w, 400) * .75), a: .65 });
  }
  const own = MAP.lights ? hook(MAP, 'lights', t) : (WX.key === 'night' ? wxLamps() : null);
  if (own) out.push(...own);
  return out;
}

// Night on an arena without its own lamps: a lantern hangs under the middle of each wide platform.
function wxLamps() {
  return MAP.solids.filter(s => !mapParked(s) && s.w >= 120 && s.y > 120 && s.y < H - 40).slice(0, 5)
    .map(s => ({ x: s.x + s.w / 2, y: s.y - 30, r: 190, a: .75 }));
}
function wxDrawLamp(ctx, x, y, t) {
  lineXY(ctx, x, y - 30, x, y - 14, '#3a3a4a', 2);
  glow(ctx, '#ffd38a', 18, () => { ctx.fillStyle = `rgba(255,214,140,${.85 + .15 * Math.sin(t * 7 + x)})`; ctx.fillRect(x - 5, y - 14, 10, 12); });
}

// ---------- breakables ----------
// A breakable is a solid block: { brk: 'crate'|'glass'|'pillar', hp?, id?, look?: { fill, edge, debris } }.
// body: the speed (px/s) a fighter must hit it with to do damage by smashing into it.
const BRK_KINDS = {
  crate: { hp: 26, body: 1000, fill: '#6e4a2a', edge: '#ffb45a', debris: ['#b07a42', '#5a3a1e'], sfx: 'brkWood' },
  glass: { hp: 8, body: 520, fill: 'rgba(160,225,255,.2)', edge: '#bff4ff', debris: ['#e6fbff', '#8fdcff'], sfx: 'brkGlass' },
  pillar: { hp: 55, body: 1400, fill: '#4a4458', edge: '#c9b8ff', debris: ['#9a90a8', '#4a4458'], sfx: 'brkStone' },
};
// Breakable solid def for a map's solids list. Its collision box sinks BRK_SINK px into whatever it stands on: a block
// whose bottom only touches the ground leaves a seam that a fighter lying flat can slide into.
const BRK_SINK = 14;
function brkSolid(kind, x, y, w, h, o) { return Object.assign({ x, y, w, h: h + BRK_SINK, vis: h, oneWay: false, brk: kind, draw: brkDraw }, o); }
const brkVisH = s => s.vis || s.h;
const brkKind = s => BRK_KINDS[s.brk] || BRK_KINDS.crate;

function brkReset() {
  if (!MAP) return;
  MAP.brkList = MAP.solids.filter(s => s.brk || s.restsOn);
  for (const s of MAP.brkList) if (s.brk) { s.maxHp = s.hp = s.hp ?? brkKind(s).hp; s.hits = {}; }
}

function brkStep(dt) {
  const list = MAP.brkList;
  if (!list || !list.length) return;
  for (const s of list) if (s.falling != null) brkFall(s, dt);
  const live = list.filter(s => s.brk && !s.broken);
  if (!live.length) return;
  for (const s of live) s.flash = Math.max(0, (s.flash || 0) - dt);
  for (const f of F) if (f.alive) brkFighter(f, live);
  for (const p of PROJ) if (!p.zone && !p.dead && p.r >= 0 && p.kind !== 'pickup') brkShot(p, live);
}

const brkNear = (s, x, y, pad) => x > s.x - pad && x < s.x + s.w + pad && y > s.y - pad && y < s.y + s.h + pad;
const brkSpeed = p => Math.hypot(vx(p), vy(p));

// Weapons swung into it, and bodies slammed into it (speed from this step or the last: the hit itself stops them).
function brkFighter(f, live) {
  const m = f.mem, body = Math.max(brkSpeed(f.P[2]), brkSpeed(f.P[0])), bodyV = Math.max(body, m.brkBody || 0);
  m.brkBody = body;
  const tips = rigsOf(f).map((r, i) => { const v = brkSpeed(f.P[r.tip]), best = Math.max(v, (m.brkTip || [])[i] || 0); return { p: f.P[r.tip], v: best, cur: v, w: r.w }; });
  m.brkTip = tips.map(o => o.cur);
  for (const s of live) {
    if ((s.hits[f.id] || 0) > G_STATE.t) continue;
    const k = brkKind(s);
    for (const tp of tips) {
      if (tp.v < TUNE.minHit || !brkNear(s, tp.p.x, tp.p.y, 10)) continue;
      brkHit(s, clamp(tp.v / 70, 3, 18) * (tp.w.dmg || 1), tp.p.x, tp.p.y, f);
      break;
    }
    if (!s.broken && bodyV > k.body && [0, 2].some(j => brkNear(s, f.P[j].x, f.P[j].y, 18))) brkHit(s, (bodyV - k.body * .6) / 14, f.P[2].x, f.P[2].y, f);
  }
}

function brkShot(p, live) {
  const nx = p.x + p.vx * DT * 1.5, ny = p.y + p.vy * DT * 1.5;
  for (const s of live) {
    if (p.brkHit === s || !(brkNear(s, nx, ny, p.r || 4) || brkNear(s, p.x, p.y, p.r || 4))) continue;
    p.brkHit = s;
    brkHit(s, p.explode ? 4 : Math.max(4, p.dmg || 8), p.x, p.y, p.owner);
  }
}

on('explode', (x, y, r) => {
  if (!MAP || !MAP.brkList) return;
  for (const s of MAP.brkList) {
    if (!s.brk || s.broken) continue;
    const d = Math.hypot(x - clamp(x, s.x, s.x + s.w), y - clamp(y, s.y, s.y + s.h));
    if (d < r) brkHit(s, 14 + 46 * (1 - d / r), x, y, null);
  }
});

function brkHit(s, dmg, x, y, by) {
  if (s.broken) return;
  s.hp -= dmg; s.flash = .12;
  if (by) s.hits[by.id] = G_STATE.t + .3;
  const k = brkKind(s), look = s.look || k;
  burst(x, y, look.debris[0], 5, 220, { life: .4, grav: 1, size: 2 });
  if (s.hp <= 0) brkBreak(s); else sfx(k.sfx, .45);
}

// Shatter: debris flies, the block is gone for the round, and whatever rested on it falls.
function brkBreak(s) {
  const k = brkKind(s), look = s.look || k, cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  s.broken = true;
  for (const c of look.debris) burst(cx, cy, c, Math.min(26, 8 + (s.w * s.h) / 300), 420, { life: .9, grav: 1, size: 4 });
  shake(s.brk === 'glass' ? 3 : 6); sfx(k.sfx, 1);
  for (const o of ORB_LIST) if (o.solid === s) o.solid = null;
  mapPark(s);
  for (const t of MAP.brkList) {
    const rest = [].concat(t.restsOn || []);
    if (s.id && rest.includes(s.id) && t.falling == null && !t.broken) t.falling = 0;
  }
}

// A collapsing platform drops (carrying whoever stands on it), lands on the floor or leaves a bottomless arena.
function brkFall(s, dt) {
  if (mapParked(s)) { s.falling = null; return; }
  s.move = null;                                   // a swaying solid stops following its path once it falls
  const h = s.oneWay ? 14 : brkVisH(s), g = brkGround(s, s.y + h);
  s.falling += 1800 * dt;
  s.dy = s.falling * dt; s.y += s.dy;
  if (g != null && s.y + h >= g) {
    s.dy -= s.y + h - g; s.y = g - h; s.falling = null;
    burst(s.x + s.w / 2, g, '#bbbbaa', 14, 260); shake(5); sfx('mapCrumble', .8);
  } else if (s.y > H + 120) { s.falling = null; mapPark(s); }
}

// The first surface under a falling solid's bottom: the floor or another live solid it overlaps.
function brkGround(s, bottom) {
  let g = MAP.floor;
  for (const o of MAP.solids) {
    if (o === s || mapParked(o) || o.x >= s.x + s.w || o.x + o.w <= s.x || o.y < bottom - 2) continue;
    if (g == null || o.y < g) g = o.y;
  }
  return g;
}

// Drawing: wood crate, glass pane or fluted pillar, with cracks that grow as it weakens.
function brkDraw(ctx, s, t) {
  if (s.broken || mapParked(s)) return;
  const k = brkKind(s), look = s.look || k, hurt = 1 - (s.hp ?? k.hp) / (s.maxHp || k.hp);
  ctx.save();
  s = Object.assign({}, s, { h: brkVisH(s) });     // draw only the visible part (the sunk base is hidden in the ground)
  if (s.brk === 'glass') brkDrawGlass(ctx, s, look);
  else if (s.brk === 'pillar') brkDrawPillar(ctx, s, look);
  else brkDrawCrate(ctx, s, look);
  if (hurt > .05) brkDrawCracks(ctx, s, hurt);
  if (s.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${s.flash * 4})`; ctx.fillRect(s.x, s.y, s.w, brkVisH(s)); }
  ctx.restore();
}

function brkDrawCrate(ctx, s, c) {
  ctx.fillStyle = c.fill; ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = rgba(c.edge, .55); ctx.lineWidth = 3; ctx.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
  ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(s.x + 4, s.y + 4); ctx.lineTo(s.x + s.w - 4, s.y + s.h - 4); ctx.moveTo(s.x + s.w - 4, s.y + 4); ctx.lineTo(s.x + 4, s.y + s.h - 4);
  ctx.stroke();
  glowLine(ctx, s.x, s.y, s.x + s.w, s.y, c.edge, 2);
}

function brkDrawGlass(ctx, s, c) {
  ctx.fillStyle = c.fill; ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.strokeStyle = rgba(c.edge, .8); ctx.lineWidth = 2; ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.beginPath();
  const d = Math.min(s.w, s.h) * .6;
  ctx.moveTo(s.x + s.w * .2, s.y + s.h * .2 + d * .5); ctx.lineTo(s.x + s.w * .2 + d * .5, s.y + s.h * .2); ctx.stroke();
}

function brkDrawPillar(ctx, s, c) {
  ctx.fillStyle = c.fill; ctx.fillRect(s.x + 3, s.y, s.w - 6, s.h);
  ctx.fillStyle = rgba(c.edge, .25);
  for (let x = s.x + 8; x < s.x + s.w - 6; x += 8) ctx.fillRect(x, s.y + 10, 2, s.h - 20);
  ctx.fillStyle = c.fill; ctx.fillRect(s.x - 3, s.y, s.w + 6, 9); ctx.fillRect(s.x - 3, s.y + s.h - 9, s.w + 6, 9);
  glowLine(ctx, s.x - 3, s.y, s.x + s.w + 3, s.y, c.edge, 2);
}

function brkDrawCracks(ctx, s, hurt) {
  ctx.strokeStyle = s.brk === 'glass' ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
  const n = Math.ceil(hurt * 6), cx = s.x + s.w * .5, cy = s.y + s.h * .45;
  for (let k = 0; k < n; k++) {
    const a = mapHash(k + s.x) * TAU, L = (.3 + mapHash(k * 3 + s.y) * .5) * Math.min(s.w, s.h) * (.4 + hurt);
    ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * L * .5 + 3, cy + Math.sin(a) * L * .5); ctx.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
  }
  ctx.stroke();
}

on('boot', () => {
  if (typeof defSfx !== 'function') return;
  defSfx('brkWood', v => { noise(.25, 700, .6 * v, 'bandpass'); thump(160, 60, .18, .5 * v); });
  defSfx('brkGlass', v => { noise(.35, 5200, .5 * v, 'highpass'); metal(2600, .3, .12 * v); metal(3400, .25, .08 * v, .04); });
  defSfx('brkStone', v => { noise(.5, 260, .8 * v, 'lowpass'); thump(90, 40, .3, .6 * v); });
});
