// 00-core.js: constants, maths helpers, storage, event bus, error log, content registries (def*) and world state.
// Everything here is plain data and functions; no DOM access at load time.

const W = 1280, H = 720, DT = 1 / 120;      // logical arena size and fixed physics step
const VERSION = '3.0.0';
const TAU = Math.PI * 2;
// One neon colour per fighter slot (up to MAX_FIGHTERS); the first four are the classic player colours.
const DEFAULT_COLORS = ['#2ee6ff', '#ff8a2e', '#9dff5a', '#ff5ad1', '#ffd84a', '#b98cff', '#7dffcf', '#ff4a6a'];
const MAX_FIGHTERS = 8;                     // roster cap for party modes (HUD, spawns and perf are sized for it)
const FONT_DISPLAY = 'Bungee, Impact, "Arial Black", sans-serif';
const FONT_BODY = '"Chakra Petch", system-ui, sans-serif';

// Feel tuning in one place. Measured with SC.sim (see tools/smoke.cjs); change with care.
const TUNE = {
  speed: 430,          // top run speed px/s
  accelGround: 19,     // how fast run speed is reached/lost on the ground (1/s); higher = snappier start/stop
  accelAir: 7,         // air control
  kneeDrive: .6,       // share of the run drive the knees get (keeps the legs from dragging)
  jumpVel: 1380,       // take-off speed (full jump clears ~210px: enough for the standard 180px ledges)
  airJumpMul: .9,      // double jump strength
  riseGrav: .7,        // extra gravity while rising (fraction of g): less hang time, also tames launches
  fallGrav: 1.1,       // extra gravity while falling: snappier arcs
  cutGrav: 2.5,        // extra gravity while rising with jump released: tap = short hop (~115px)
  coyote: .09,         // seconds you can still jump after walking off a ledge
  buffer: .13,         // seconds a jump/attack/skill press is remembered until it can happen
  dashVel: 1080, dashCd: .8, dashTime: .17,
  minHit: 430,         // weapon speed (px/s, relative) needed to deal damage
  hitCd: .3,           // one weapon can't hit the same target again for this long
  dmgDiv: 86,          // damage = (speed - minHit + 60) / dmgDiv * weapon.dmg  (~7-8 per typical hit)
  maxHit: 26,          // cap per melee hit: no cheap one-shots
  headMul: 1.5,
  kbMul: .5, kbMax: 720, // knockback from hit speed
  staggerPerDmg: .014, staggerMax: .38,
  hitstopMin: 10,      // damage that triggers a hit-stop freeze (longer for bigger hits)
  roundLimit: 60,      // seconds before a round is decided on remaining health
  koDelay: 2.4,        // seconds between the deciding KO and the next round
  startLock: 1.1,      // seconds of "ROUND N / FIGHT!" before anyone can act
};

// ---------- maths ----------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[Math.random() * arr.length | 0];
const chance = p => Math.random() < p;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
// Verlet points store their previous position; velocity is the difference.
const vx = p => (p.x - p.ox) / DT, vy = p => (p.y - p.oy) / DT;
const kick = (p, x, y) => { p.ox -= x * DT; p.oy -= y * DT; };
const setVel = (p, x, y) => { p.ox = p.x - x * DT; p.oy = p.y - y * DT; };
const inRect = (x, y, r, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// Closest distance between two segments (Ericson), with the parameter along each and the two closest points.
// Called thousands of times a step (every weapon segment against every body part), so it fills one shared result
// object instead of allocating: read the fields right away and copy anything you keep.
const SEGSEG_OUT = { d: 0, s: 0, t: 0, px: 0, py: 0, qx: 0, qy: 0 };
function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy, rx = ax - cx, ry = ay - cy;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  let s = 0, t = 0;
  if (a < 1e-9 && e < 1e-9) { s = t = 0; }
  else if (a < 1e-9) { t = clamp(f / e, 0, 1); }
  else {
    const c = d1x * rx + d1y * ry;
    if (e < 1e-9) { s = clamp(-c / a, 0, 1); }
    else {
      const b = d1x * d2x + d1y * d2y, den = a * e - b * b;
      s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const px = ax + d1x * s, py = ay + d1y * s, qx = cx + d2x * t, qy = cy + d2y * t, o = SEGSEG_OUT;
  o.d = Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy)); o.s = s; o.t = t; o.px = px; o.py = py; o.qx = qx; o.qy = qy;
  return o;
}

// '#rrggbb' (or '#rgb') + alpha -> 'rgba(...)' (cached; used a lot while drawing). Other colour strings pass through.
// Alpha is rounded to 1/64 steps (invisible on screen) so fading colours hit the cache instead of making new strings.
const RGBA_STEPS = 64;
const RGBA_CACHE = new Map();     // hex -> array of strings by alpha step
function rgba(hex, a) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  const i = Math.round(clamp(+a || 0, 0, 1) * RGBA_STEPS);
  let row = RGBA_CACHE.get(hex);
  if (!row) {
    if (RGBA_CACHE.size > 400) RGBA_CACHE.clear();
    RGBA_CACHE.set(hex, row = new Array(RGBA_STEPS + 1));
  }
  if (!row[i]) {
    const n = parseInt(hex.slice(1).length === 3 ? hex.slice(1).replace(/./g, c => c + c) : hex.slice(1), 16);
    row[i] = `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${+(i / RGBA_STEPS).toFixed(4)})`;
  }
  return row[i];
}

// ---------- error log ----------
// Errors from content hooks are caught and logged here instead of crashing the match. Tests assert it stays empty.
const ERRORS = [];
function report(err, where) {
  const msg = (where ? where + ': ' : '') + (err && err.message ? err.message : String(err));
  const old = ERRORS.find(e => e.msg === msg);
  if (old) { old.count++; return; }
  ERRORS.push({ msg, count: 1, stack: err && err.stack ? String(err.stack).split('\n').slice(0, 5).join('\n') : '' });
  if (ERRORS.length > 80) ERRORS.splice(0, ERRORS.length - 80);
  console.error('[Stick Clash] ' + msg, err);
}
// Calls an optional method on a content def (weapon, skill, map, mode...) with errors contained.
function hook(def, name, ...args) {
  const fn = def && def[name];
  if (typeof fn !== 'function') return undefined;
  try { return fn.apply(def, args); } catch (e) { report(e, `${def.key || def.kind || '?'}.${name}`); return undefined; }
}

// ---------- storage ----------
const STORE_PREFIX = 'stickclash.v2.';
const store = {
  get(key, fallback) {
    try { const raw = localStorage.getItem(STORE_PREFIX + key); return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); } catch { /* private mode */ } },
  // Typed reads: a save written by another version or edited by hand may hold the wrong kind of value, so every
  // load site asks for the shape it needs and gets a safe default otherwise.
  getObj(key) { const v = this.get(key, null); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; },
  getArr(key) { const v = this.get(key, null); return Array.isArray(v) ? v : []; },
  getNum(key, fallback = 0) { const v = this.get(key, null); return typeof v === 'number' && Number.isFinite(v) ? v : fallback; },
  getBool(key, fallback = false) { const v = this.get(key, null); return typeof v === 'boolean' ? v : fallback; },
};
// A finite number from anything (else the fallback).
const numOr = (v, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;

// ---------- event bus ----------
// Events: matchStart(cfg) roundStart(round) roundEnd(winnerTeam, reason) matchOver(result) state(now, before)
// damage(target, amount, opts) hit(attacker, target, hit) ko(victim, killer, opts) clash(A, B, x, y) block(target, src)
// attack(f) fire(f, proj) jump(f) dash(f) skill(f, key) status(f, name, secs) orb(f, orb)
// v3: parry(B, A) guardBreak(f) grab(A, B) throw(A, B) grabEscape(B, A) wallJump(f) disarm(B, A, wkey) pickup(f, item)
// levelUp(f, lvl) ultimate(f, cat) throwable(f, key, proj) mount(f, key) dismount(f, key) element(f, key) shatter(f)
const BUS = {};
function on(ev, fn) { (BUS[ev] = BUS[ev] || []).push(fn); return () => off(ev, fn); }
function off(ev, fn) { const l = BUS[ev]; if (l && l.includes(fn)) l.splice(l.indexOf(fn), 1); }
function emit(ev, ...args) {
  const l = BUS[ev];
  if (!l) return;
  for (const fn of l.slice()) { try { fn(...args); } catch (e) { report(e, `on('${ev}')`); } }
}

// ---------- registries ----------
const WEAPONS = {}, SKILLS = {}, MAPS = {}, MODES = {}, ORBS = {}, HATS = {}, STATUS = {};
const CLASSES = {}, THROWABLES = {}, MOUNTS = {}, ULTIMATES = {}, ELEMENTS = {};   // v3 fighting depth
const WEAPON_CATS = ['blade', 'heavy', 'polearm', 'chain', 'fist', 'ranged', 'magic', 'exotic', 'shield'];

function defError(kind, key, msg) { report(new Error(msg), `def${kind}('${key}')`); }

// Shared registration: validates the key, merges defaults, checks required fields. Returns the stored def.
function register(reg, kind, key, def, defaults, required) {
  if (typeof key !== 'string' || !/^[a-z0-9_-]+$/i.test(key)) { defError(kind, key, 'key must be a short id like "fire-axe"'); return null; }
  if (!def || typeof def !== 'object') { defError(kind, key, 'definition must be an object'); return null; }
  if (reg[key]) defError(kind, key, 'duplicate key; the later definition wins');
  const out = Object.assign({}, defaults, def, { key });
  for (const r of required) if (typeof out[r] !== 'function') defError(kind, key, `missing required function "${r}"`);
  reg[key] = out;
  return out;
}

function defWeapon(key, def) {
  const w = register(WEAPONS, 'Weapon', key, def, {
    name: key, cat: 'blade', desc: '', len: 80, mass: 1, dmg: 1, width: 5, chain: 0, stiff: .25, lift: 1.1,
    twoHanded: false, offhand: null, block: 0, ranged: null, cd: null, kb: 1, armor: 1, power: 1, hidden: false, color: '#dfe6ff',
  }, ['draw']);
  if (!w) return null;
  if (!WEAPON_CATS.includes(w.cat)) defError('Weapon', key, `unknown cat "${w.cat}" (use ${WEAPON_CATS.join(', ')})`);
  if (!(w.len > 0) || !(w.mass > 0)) defError('Weapon', key, 'len and mass must be > 0');
  if (w.ranged) w.ranged = Object.assign({ cooldown: .35, ammo: 6, reload: 1.4, auto: false, speed: 1400, spread: .03, recoil: 160, proj: {} }, w.ranged);
  if (w.cd == null) w.cd = Math.round((.5 + w.mass * .07) * 100) / 100;   // heavier weapons recover slower
  w.ai = Object.assign({ range: w.ranged ? 420 : w.len + 60, style: w.ranged ? 'ranged' : 'melee' }, def.ai);
  return w;
}

function defSkill(key, def) {
  const s = register(SKILLS, 'Skill', key, def, { name: key, icon: '✦', desc: '', cd: 6, color: '#ffd84a', hidden: false }, ['use']);
  if (!s) return null;
  s.ai = Object.assign({ when: () => Math.random() < .02 }, def.ai);
  if (typeof s.ai.when !== 'function') defError('Skill', key, 'ai.when must be a function');
  return s;
}

const DEFAULT_PALETTE = { sky1: '#0a0b1d', sky2: '#251744', ground: '#0c0d1a', line: '#8b7dff', accent: '#ff5ad1', solid: '#16183a' };
function defMap(key, def) {
  const m = register(MAPS, 'Map', key, def, {
    name: key, desc: '', gravity: 2200, friction: .18, drag: .996, windX: 0, floor: 650, walls: true,
    solids: [], hazards: [], spawns: [[330, 650], [950, 650], [520, 300], [760, 300]], orbs: true, maxOrbs: 2, hidden: false,
  }, []);
  if (!m) return null;
  m.palette = Object.assign({}, DEFAULT_PALETTE, def.palette);
  if (!Array.isArray(m.spawns) || !m.spawns.length) defError('Map', key, 'spawns must be a non-empty array of [x, y]');
  if (m.floor == null && !m.solids.length) defError('Map', key, 'a bottomless map needs solids to stand on');
  return m;
}

function defMode(key, def) {
  return register(MODES, 'Mode', key, def, {
    name: key, desc: '', players: [1, 1], cpu: true, pickers: 2, order: 50, hidden: false, winScore: 5,
  }, ['setup']);
}

function defOrb(key, def) {
  return register(ORBS, 'Orb', key, def, { name: key, icon: '?', color: '#ffffff', desc: '', weight: 1 }, ['grab']);
}

function defHat(key, def) {
  return register(HATS, 'Hat', key, def, { name: key, hidden: false }, ['draw']);
}

// Status effects (burn, freeze...). Built-ins live in 20-fighter.js; content may add more.
function defStatus(key, def) {
  return register(STATUS, 'Status', key, def, { name: key, icon: '•', color: '#ffffff', debuff: false, max: 30, immunity: 0 }, []);
}

// ---------- v3 fighting-depth registries (runtime in 22-moves, 24-classes, 33-power, 34-throwables, 56, 57) ----------
// Class: body and passive. Every number is a multiplier on the base fighter (1 = unchanged).
function defClass(key, def) {
  return register(CLASSES, 'Class', key, def, { name: key, icon: '◆', color: '#ffffff', desc: '', passive: '', hp: 1, speed: 1,
    mass: 1, stamina: 1, dmg: 1, cd: 1, ammo: 1, reload: 1, dash: 1, airJumps: 0, hidden: false }, []);
}
// Throwable: throw(f, aim) spawns its projectile from aim = { x, y, vx, vy, foe } and returns it.
function defThrowable(key, def) {
  const t = register(THROWABLES, 'Throwable', key, def, { name: key, icon: '●', color: '#ffffff', desc: '', hidden: false }, ['throw']);
  if (t) t.ai = Object.assign({ min: 120, max: 520, when: null }, def.ai);
  return t;
}
// Mount: a ridden power-up (hoverboard, mech...). drive(f, dt, m) moves it, attack(f, m) replaces the weapon swing.
function defMount(key, def) {
  const m = register(MOUNTS, 'Mount', key, def, { name: key, icon: '♞', color: '#ffffff', desc: '', time: 8, hp: 45, hidden: false }, ['draw']);
  if (m) m.ai = Object.assign({ range: 140, style: 'melee', fly: false }, def.ai);
  return m;
}
// Ultimate: one per weapon category, fired with a full super meter. use(f, u) (optional, false = can't now) starts
// it, step(f, dt, u) runs it every step for `time` seconds, end(f, u) and draw(ctx, f, u) are optional.
function defUltimate(cat, def) {
  const u = register(ULTIMATES, 'Ultimate', cat, def, { name: cat, color: '#ffd84a', time: 1, hidden: false }, ['step']);
  if (u) u.ai = Object.assign({ range: 260 }, def.ai);
  return u;
}
// Element fused into a weapon by an elemental orb: hit(A, B, dealt, o) runs on each direct hit with it.
function defElement(key, def) {
  return register(ELEMENTS, 'Element', key, def, { name: key, adj: key, icon: '✦', color: '#ffffff', hidden: false }, ['hit']);
}

// Visible entries of a registry (not hidden), in a stable order for menus and random picks.
function listOf(reg) {
  return Object.values(reg).filter(d => !d.hidden).sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
}
function randomKey(reg, filter) {
  const keys = listOf(reg).filter(d => !filter || filter(d)).map(d => d.key);
  return keys.length ? pick(keys) : null;
}

// ---------- world state ----------
let F = [];             // fighters in the current round (2-MAX_FIGHTERS)
let PROJ = [];          // live projectiles
let ORB_LIST = [];      // power-up orbs lying in the arena
let MAP = null;         // the current map: a runtime copy of a MAPS def with live solids/hazards
const PHYS = { gravity: 2200, friction: .18, drag: .996, windX: 0 };
// state: 'menu' (attract demo runs behind the menu) | 'play' | 'paused' | 'over' | 'killcam'
const G_STATE = {
  state: 'menu', cfg: null, mode: null, roster: [], round: 1, score: [], winScore: 5, teams: 2,
  t: 0, roundT: 0, roundLimit: 60, lock: 0, koT: 0, ending: false, winner: null, endReason: '', demo: true, result: null,
  sim: false, info: {}, log: [], override: null,
};

// ---------- canvas drawing helpers (all take the context explicitly) ----------
function line(ctx, a, b, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function lineXY(ctx, x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function circle(ctx, x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
// pts: [{x,y}] or [[x,y]]
function poly(ctx, pts, fill, stroke, lw = 2) {
  ctx.beginPath();
  pts.forEach((p, i) => { const x = p.x ?? p[0], y = p.y ?? p[1]; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
// Neon glow for whatever is drawn inside fn.
function glow(ctx, color, blur, fn) {
  ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur;
  try { fn(); } finally { ctx.restore(); }
}
