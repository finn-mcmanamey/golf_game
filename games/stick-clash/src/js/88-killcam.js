// 88-killcam.js: instant replay of the K.O. that decides the match (or of every round-ending K.O. when
// SETTINGS.killcamAll is on), in slow motion with letterbox bars and a REPLAY tag. Any key, tap or pad button skips.
//
// Recording: while a real match is playing, kcRecord() (called by the renderer each frame) stores a snapshot of every
// fighter (points + numeric fields + statuses), projectile, orb and moving platform about 70 times a game-second,
// in a ring buffer of the last few seconds. Effects (burst, ring, beam, float, flash, shake) and sounds are recorded
// as timed events through FX_RECORD / SFX_RECORD, so sparks and hit sounds replay in sync.
//
// Playback: the replay never touches the real fighters. It swaps the globals the renderer reads (F, PROJ, ORB_LIST,
// MAP) for "ghosts" (Object.create(real) with the recorded fields on top), interpolates between snapshots, and puts
// everything back when it ends. 99-main runs G_STATE.override instead of the world step while it plays.
// When: a deciding K.O. replays on 'matchOver' (before the results show); with killcamAll, other K.O.s replay on the
// next 'roundStart' (the new round waits behind the replay).

const KC_KEEP = 4.5;          // seconds of history kept in the ring buffer
const KC_BEFORE = 1.9;        // replay starts this long before the K.O....
const KC_AFTER = .75;         // ...and ends this long after it
const KC_GAP = 1 / 72;        // minimum game time between snapshots
const KC_SKIP_GRACE = .45;    // real seconds before input can skip (mashing attack at the K.O. shouldn't skip at once)

const KC = { frames: [], events: [], lastKO: null, pending: null, play: null };

// ---------- recording ----------
const kcLive = () => G_STATE.state === 'play' && !G_STATE.sim && !G_STATE.demo && !KC.play && !!MAP;
// After a round-ending K.O. keep recording only the short tail the replay shows.
const kcRecording = () => kcLive() && (!G_STATE.ending || !KC.lastKO || G_STATE.t <= KC.lastKO.t + KC_AFTER + .05);

function kcNums(obj) {
  const out = {};
  for (const k in obj) { const v = obj[k]; if (typeof v === 'number') out[k] = v; }
  return out;
}

function kcSnapFighter(f) {
  const pts = new Float32Array(f.P.length * 2);
  f.P.forEach((p, j) => { pts[j * 2] = p.x; pts[j * 2 + 1] = p.y; });
  const status = {};
  for (const k in f.status) status[k] = Object.assign({}, f.status[k]);
  return { ref: f, pts, nums: kcNums(f), status, alive: f.alive, grounded: f.grounded };
}

function kcSnapshot() {
  const movers = [];
  for (const o of MAP.solids.concat(MAP.hazards)) if (o.move) movers.push([o, o.x, o.y]);
  return { t: G_STATE.t, map: MAP, mapT: MAP.t, fighters: F.map(kcSnapFighter), movers,
    projs: PROJ.map(p => ({ ref: p, nums: kcNums(p), tr: p.tr ? p.tr.slice() : [] })),
    orbs: ORB_LIST.map(o => ({ ref: o, x: o.x, y: o.y, t: o.t })) };
}

function kcRecord() {
  if (!kcRecording()) return;
  const last = KC.frames[KC.frames.length - 1];
  if (last && G_STATE.t - last.t < KC_GAP && G_STATE.t >= last.t) return;
  if (last && G_STATE.t < last.t) KC.frames.length = 0;      // time went backwards: a fresh match
  KC.frames.push(kcSnapshot());
  const cut = G_STATE.t - KC_KEEP;
  while (KC.frames.length && KC.frames[0].t < cut) KC.frames.shift();
  while (KC.events.length && KC.events[0].t < cut) KC.events.shift();
}

function kcEvent(kind, args) {
  if (kcRecording()) KC.events.push({ t: G_STATE.t, kind, args: Array.from(args) });
}
FX_RECORD = kcEvent;
SFX_RECORD = (name, vol) => kcEvent('sfx', [name, vol]);

function kcReset() { KC.frames.length = 0; KC.events.length = 0; KC.lastKO = null; KC.pending = null; }

on('ko', (victim, killer, o) => {
  if (G_STATE.sim || G_STATE.demo || victim.summon) return;
  const c = chest(victim);
  KC.lastKO = { t: G_STATE.t, victim, killer, x: c.x, y: c.y, ringout: !!o && o.kind === 'ringout' };
});

on('roundEnd', (winner, reason) => {
  const ko = KC.lastKO, cfg = G_STATE.cfg || {};
  if (G_STATE.sim || G_STATE.demo || cfg.killcam === false || reason !== 'ko' || !ko || G_STATE.t - ko.t > .3) return;
  if (KC.frames.length < 20 || ko.t - KC.frames[0].t < .8) return;   // too little history to be worth a replay
  KC.pending = ko;
});

on('matchOver', () => { if (KC.pending && !G_STATE.sim) kcStart('over'); });
on('roundStart', () => {
  if (KC.pending && SETTINGS.killcamAll && !G_STATE.sim && G_STATE.state === 'play') kcStart('play');
  else kcReset();
});
on('matchStart', () => { kcAbort(); kcReset(); });

// ---------- playback ----------
function kcStart(resume) {
  const ko = KC.pending, frames = KC.frames;
  KC.pending = null;
  if (!ko || frames.length < 2) return;
  const t0 = Math.max(frames[0].t, ko.t - KC_BEFORE), t1 = Math.min(frames[frames.length - 1].t, ko.t + KC_AFTER);
  const map = frames[0].map, movers = [];
  for (const m of new Set([MAP, map])) if (m) for (const o of m.solids.concat(m.hazards)) movers.push([o, o.x, o.y]);
  KC.play = { ko, t0, t1, clock: t0, real: 0, endT: 0, resume, frame: 0, ev: KC.events.findIndex(e => e.t >= t0),
    ghosts: new Map(), focused: false,
    saved: { F, PROJ, ORB_LIST, MAP, t: G_STATE.t, banner: BANNER, movers, map, mapT: map.t } };
  if (KC.play.ev < 0) KC.play.ev = KC.events.length;
  clearFx(); BANNER = null; CAM.focusT = 0;
  G_STATE.override = kcUpdate;
  setState('killcam');
  AUDIO_PITCH = .8;
  sfx('replay');
  kcApply();
}

// Stops the replay and puts the real world back exactly as it was.
function kcStop() {
  const P = KC.play;
  if (!P) return;
  const s = P.saved;
  F = s.F; PROJ = s.PROJ; ORB_LIST = s.ORB_LIST; MAP = s.MAP; G_STATE.t = s.t;
  for (const [o, x, y] of s.movers) { o.x = x; o.y = y; }
  s.map.t = s.mapT;
  BANNER = P.resume === 'play' ? s.banner : null;
  if (BANNER) BANNER.t = 0;
  kcAbort();
  clearFx(); CAM.focusT = 0;
  setState(P.resume);
  kcReset();
}

// Drops the replay without restoring anything (a new match has already replaced the world).
function kcAbort() {
  if (!KC.play) return;
  KC.play = null;
  if (G_STATE.override === kcUpdate) G_STATE.override = null;
  AUDIO_PITCH = 1;
}

// Replay speed around the K.O.: brisk run-up, slow-motion through the blow, then brisk again.
function kcRate(d) {
  if (d < -.55) return .7;
  if (d < -.3) return lerp(.7, .24, (d + .55) / .25);
  if (d < .22) return .24;
  return lerp(.24, .7, clamp((d - .22) / .2, 0, 1));
}

// Runs each real frame instead of the world step (G_STATE.override).
function kcUpdate(dt) {
  const P = KC.play;
  if (!P) return;
  P.real += dt;
  const gdt = Math.min(dt * kcRate(P.clock - P.ko.t), P.t1 - P.clock);
  P.clock += Math.max(0, gdt);
  kcFireEvents(P.clock);
  fxStep(Math.max(0, gdt));
  kcApply(Math.max(0, gdt));
  if (!P.focused && P.clock >= P.ko.t - .3) {   // zoom in on the blow for the slow-motion part
    P.focused = true;
    focusCamera(P.ko.x, P.ko.y, 2.4);
  }
  if (P.clock >= P.t1 && (P.endT += dt) > .45) kcStop();
}

const KC_FX = { burst, float, ring, beam, flashScreen, shake, sfx };
function kcFireEvents(clock) {
  const P = KC.play, list = KC.events;
  while (P.ev < list.length && list[P.ev].t <= clock) {
    const e = list[P.ev++], fn = KC_FX[e.kind];
    if (fn) fn(...e.args);
  }
}

// Shows the recorded world at the replay clock: ghosts of every fighter, projectile and orb, interpolated.
function kcApply(gdt = 0) {
  const P = KC.play, frames = KC.frames;
  while (P.frame < frames.length - 2 && frames[P.frame + 1].t <= P.clock) P.frame++;
  const a = frames[P.frame], b = frames[Math.min(P.frame + 1, frames.length - 1)];
  const k = b.t > a.t ? clamp((P.clock - a.t) / (b.t - a.t), 0, 1) : 0;
  MAP = a.map; MAP.t = lerp(a.mapT, b.mapT, k); G_STATE.t = P.clock;
  a.movers.forEach(([o, x, y], i) => { const m = b.movers[i]; o.x = m && m[0] === o ? lerp(x, m[1], k) : x; o.y = m && m[0] === o ? lerp(y, m[2], k) : y; });
  F = a.fighters.map(sa => kcGhostFighter(sa, b.fighters.find(sb => sb.ref === sa.ref), k, gdt));
  const nextProj = new Map(b.projs.map(sp => [sp.ref, sp]));
  PROJ = a.projs.map(sp => kcGhostProj(sp, nextProj.get(sp.ref), k));
  ORB_LIST = a.orbs.map(o => Object.assign(Object.create(o.ref), { x: o.x, y: o.y, t: o.t }));
}

function kcGhostFighter(sa, sb, k, gdt) {
  const P = KC.play, real = sa.ref;
  let g = P.ghosts.get(real);
  if (!g) P.ghosts.set(real, g = Object.assign(Object.create(real), { trail: [], P: [] }));
  Object.assign(g, sa.nums);
  g.status = sa.status; g.alive = sa.alive; g.grounded = sa.grounded;
  const n = sa.pts.length / 2, useB = sb && sb.pts.length === sa.pts.length;
  if (g.P.length !== n) g.P = Array.from({ length: n }, () => ({ x: 0, y: 0, ox: 0, oy: 0, fresh: true }));
  for (let j = 0; j < n; j++) {
    const p = g.P[j], x = useB ? lerp(sa.pts[j * 2], sb.pts[j * 2], k) : sa.pts[j * 2], y = useB ? lerp(sa.pts[j * 2 + 1], sb.pts[j * 2 + 1], k) : sa.pts[j * 2 + 1];
    // ox/oy give the ghost a velocity (used by trails and streaks): the replay's movement per game second.
    const s = gdt > 1e-4 && !p.fresh ? DT / gdt : 0;
    p.ox = x - (x - p.x) * s; p.oy = y - (y - p.y) * s; p.x = x; p.y = y; p.fresh = false;
  }
  return g;
}

function kcGhostProj(sa, sb, k) {
  const g = Object.assign(Object.create(sa.ref), sa.nums, { tr: sa.tr });
  if (sb) { g.x = lerp(sa.nums.x, sb.nums.x, k); g.y = lerp(sa.nums.y, sb.nums.y, k); }
  return g;
}

// ---------- skipping ----------
function kcSkip() {
  if (KC.play && KC.play.real > KC_SKIP_GRACE) kcStop();
}
// Registered before 90-input's key handler, so the key that skips doesn't also pause or attack.
addEventListener('keydown', e => {
  if (!KC.play || e.code === 'KeyM') return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (!e.repeat) kcSkip();
});
addEventListener('pointerdown', () => kcSkip());
on('pad', () => kcSkip());

// ---------- overlay: letterbox, REPLAY tag, caption ----------
let KC_SCANLINES = null;
function kcScanlines(c2) {
  if (KC_SCANLINES || typeof document === 'undefined') return KC_SCANLINES;
  const p = document.createElement('canvas');
  p.width = 4; p.height = 4;
  const g = p.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 0, 4, 1);
  KC_SCANLINES = c2.createPattern(p, 'repeat');
  return KC_SCANLINES;
}

function kcDrawOverlay(c2) {
  const P = KC.play;
  if (!P) return;
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const bar = 72 * ease(P.real / .35) * (1 - ease(P.endT / .45));
  const pat = kcScanlines(c2);
  if (pat) { c2.fillStyle = pat; c2.fillRect(0, 0, W, H); }
  c2.fillStyle = 'rgba(4,5,12,.96)';
  c2.fillRect(0, 0, W, bar); c2.fillRect(0, H - bar, W, bar);
  if (bar < 40) return;
  const top = bar - 36, bottom = H - bar + 40;
  kcDrawTag(c2, top);
  kcDrawCaption(c2, bottom);
  const prog = clamp((P.clock - P.t0) / (P.t1 - P.t0 || 1), 0, 1);   // progress line along the top bar
  c2.fillStyle = 'rgba(255,255,255,.12)'; c2.fillRect(0, bar - 3, W, 3);
  c2.fillStyle = '#ff4a6a'; c2.fillRect(0, bar - 3, W * prog, 3);
  if (P.endT > 0) { c2.fillStyle = `rgba(5,6,12,${clamp(P.endT / .45, 0, 1) * .9})`; c2.fillRect(0, 0, W, H); }
  if (P.real < .25) { c2.fillStyle = `rgba(255,255,255,${(1 - P.real / .25) * .35})`; c2.fillRect(0, 0, W, H); }
}

function kcDrawTag(c2, y) {
  const P = KC.play, slow = kcRate(P.clock - P.ko.t);
  c2.textBaseline = 'middle'; c2.textAlign = 'left';
  if (Math.floor(P.real * 2.4) % 2 === 0) circle(c2, 42, y, 8, '#ff2d55');
  c2.font = `26px ${FONT_DISPLAY}`; c2.fillStyle = '#ffffff';
  glow(c2, '#ff2d55', 16, () => c2.fillText('REPLAY', 60, y + 1));
  c2.textAlign = 'right'; c2.font = `600 16px ${FONT_BODY}`; c2.fillStyle = slow < .5 ? '#ffd84a' : '#9096c2';
  c2.fillText(slow < .5 ? 'SLOW MOTION  ×' + slow.toFixed(2) : '×' + slow.toFixed(2), W - 36, y);
}

// "CPU 1 knocks out CPU 2 with Reaver Axe" (names in their colours), or "CPU 2 falls out" for a lone ring-out.
function kcDrawCaption(c2, y) {
  const { ko } = KC.play, v = ko.victim, k = ko.killer && ko.killer !== v ? ko.killer : null;
  const name = `22px ${FONT_DISPLAY}`, plain = `600 18px ${FONT_BODY}`;
  c2.textBaseline = 'middle'; c2.textAlign = 'left';
  let x = 40;
  const word = (text, color, font) => { c2.font = font; c2.fillStyle = color; c2.fillText(text, x, y); x += c2.measureText(text).width + 10; };
  if (k) {
    word(k.name, k.color, name);
    const you = k.name === 'YOU';   // "YOU knock out", "CPU knocks out"
    word(ko.ringout ? (you ? 'ring out' : 'rings out') : (you ? 'knock out' : 'knocks out'), '#ff4a6a', plain);
    word(v.name, v.color, name);
    if (!ko.ringout && k.w && k.w.name) { word('with', '#9096c2', plain); word(k.w.name, '#ffffff', name); }
  } else {
    word(v.name, v.color, name);
    word(ko.ringout ? 'falls out of the arena' : 'is knocked out', '#ff4a6a', plain);
  }
  c2.textAlign = 'right'; c2.font = `600 14px ${FONT_BODY}`; c2.fillStyle = 'rgba(200,205,240,.6)';
  if (KC.play.real > KC_SKIP_GRACE) c2.fillText('Press any key to skip', W - 36, y);
}

// Test hooks: SC.killcam.state() and SC.killcam.skip().
on('boot', () => {
  if (window.SC) window.SC.killcam = { state: () => ({ playing: !!KC.play, frames: KC.frames.length, events: KC.events.length, pending: !!KC.pending }), skip: kcStop };
});
