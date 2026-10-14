// 91-touch.js: touch movement, gestures and the button layout of each touch set (TSETS in 90-input). Table mode
// (SETTINGS.tableMode, two touch seats) adds set 1, a copy of #touch's set turned 180° in the top half for a player
// across a flat iPad; set 0 takes the bottom half. Only the controls turn: the arena and HUD stay as they are.
// - Floating stick (left zone): where the thumb lands; its x is the player's analog mx (s.mx), up presses jump, down
//   holds SETTINGS.touchDown. Set 1's up/down are its player's own; sideways follows the screen (the arena isn't turned).
// - Gestures (right zone, outside the buttons): tap = attack, swipe up = jump, sideways = dash that way, down = grab.
// - Thumb arc: the buttons on two arcs around Attack in the set's bottom-right corner (SETTINGS.touchSize, touchAlpha);
//   a Simple player gets only Attack, Jump and the skill. One-button mode (92-access): the whole set is the button.

const TOUCH_DEFAULTS = { touchSize: 1, touchAlpha: .8, touchDown: 'block', touchSwipe: true, tableMode: false };
for (const k in TOUCH_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = TOUCH_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = TOUCH_DEFAULTS[k];
}
const STICK_DEAD = .16, STICK_UP = -.55, STICK_DOWN = .6, STICK_GAIN = 1.35;   // gain: 75% of the way = full speed
const SWIPE_MIN = 34, TAP_MAX = 22, TAP_MS = 320;

// ---------- the two sets ----------
function tsetBind(s, box) {
  Object.assign(s, { box, rot: s.i === 1, rect: null, swipe: new Map(), stickEl: box.querySelector('.tstick'),
    stick: { id: null, x0: 0, y0: 0, up: false, down: null, R: 56, zone: null } });
  const wire = (sel, evs, fn) => { const node = box.querySelector(sel); for (const ev of evs.split(' ')) node.addEventListener(ev, e => fn(s, e)); };
  wire('.tzone-l', 'pointerdown', stickDown); wire('.tzone-l', 'pointermove', stickMove); wire('.tzone-l', 'pointerup pointercancel', stickUp);
  wire('.tzone-r', 'pointerdown', swipeDown); wire('.tzone-r', 'pointermove', swipeMove); wire('.tzone-r', 'pointerup pointercancel', swipeUp);
  for (const b of box.querySelectorAll('button[data-act]')) bindTouchButton(b, s);
}
// Set 1: a pristine copy of set 0's markup, turned by CSS (.tset2), on the page only in table mode; its own pause
// button (.tpause2) turns with it, so P2 never reaches across the table.
let TSET_COPY = null;
function tsetInit() {
  const box = TOUCH_EL && TOUCH_EL.querySelector('.tset');
  if (!box) return;
  TSET_COPY = box.cloneNode(true);
  TSET_COPY.classList.add('tset2');
  tsetBind(TSETS[0], box);
  const pause = TOUCH_EL.querySelector('.tpause');
  if (pause) { bindTouchButton(pause, TSETS[0]); TSET_COPY.append(Object.assign(pause.cloneNode(true), { className: 'tpause tpause2' })); }
}
tsetInit();
function tsetSecond(on) {
  const s = TSETS[1];
  if (on && !s.box && TSET_COPY) tsetBind(s, TSET_COPY);
  if (!s.box || on === s.box.isConnected) return;
  if (on) TOUCH_EL.append(s.box); else { s.box.remove(); touchClear(1); }   // after P1's pause: '#touch .tpause' stays P1's
}
// A pointer's position in the set's own frame (rect: measured when the finger lands; set 1 runs the other way).
function tsetPoint(s, e) {
  const r = s.rect, x = e.clientX - r.left, y = e.clientY - r.top;
  return s.rot ? [r.width - x, r.height - y] : [x, y];
}

// ---------- the floating stick (in its set's box, placed at the finger's local coordinates) ----------
function stickDown(s, e) {
  const st = s.stick;
  if (st.id !== null || oneButtonOn(s.slot)) return;
  e.preventDefault();
  initAudio();
  s.rect = s.box.getBoundingClientRect();
  st.id = e.pointerId; [st.x0, st.y0] = tsetPoint(s, e);
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
  s.stickEl.classList.add('live');
  stickMove(s, e);
}
// The base follows a thumb that runs past the rim, so reversing direction never needs a long drag back.
function stickMove(s, e) {
  const st = s.stick;
  if (e.pointerId !== st.id) return;
  const [px, py] = tsetPoint(s, e), R = st.R;
  let dx = px - st.x0, dy = py - st.y0;
  const len = Math.hypot(dx, dy);
  if (len > R) { st.x0 = px - dx / len * R; st.y0 = py - dy / len * R; dx = dx / len * R; dy = dy / len * R; }
  const nx = (s.rot ? -dx : dx) / R;                     // sideways in screen terms
  s.mx = Math.abs(nx) < STICK_DEAD ? 0 : clamp(nx * STICK_GAIN, -1, 1);
  stickVertical(s, dy / R);
  s.stickEl.style.transform = `translate(${st.x0 - R}px, ${st.y0 - R}px)`;
  s.stickEl.firstChild.style.transform = `translate(${dx}px, ${dy}px)`;
}

// Up and down have a little hysteresis so a thumb resting near the line doesn't flicker the action.
function stickVertical(s, ny) {
  const st = s.stick, act = SETTINGS.touchDown === 'off' ? null : SETTINGS.touchDown;
  if (!st.up && ny < STICK_UP) { st.up = true; touchHold(s, 'jump'); }
  else if (st.up && ny > STICK_UP + .15) { st.up = false; touchRelease(s, 'jump'); }
  if (!st.down && act && ny > STICK_DOWN) { st.down = act; touchHold(s, act); }
  else if (st.down && ny < STICK_DOWN - .15) { touchRelease(s, st.down); st.down = null; }
}

function stickUp(s, e) {
  const st = s.stick;
  if (e.pointerId !== st.id) return;
  if (st.up) touchRelease(s, 'jump');
  if (st.down) touchRelease(s, st.down);
  Object.assign(st, { id: null, up: false, down: null });
  s.mx = 0;
  s.stickEl.classList.remove('live');
  stickRest(s);
}

// Parks the idle ring in the left zone's bottom corner (inside the edge inset) so a thumb landing on it is in the zone.
function stickRest(s) {
  const st = s.stick, z = st.zone, R = st.R;
  if (!s.stickEl || st.id !== null) return;
  const x = z ? z.x + 4 : 28, y = z ? z.y + z.h - 16 - 2 * R : innerHeight - 40 - 2 * R;
  s.stickEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  s.stickEl.firstChild.style.transform = '';
}

// ---------- right-side gestures ----------
function swipeDown(s, e) {
  e.preventDefault();
  initAudio();
  if (oneButtonOn(s.slot)) { touchHold(s, 'attack'); s.swipe.set(e.pointerId, { one: true }); return; }
  s.rect = s.box.getBoundingClientRect();
  const [x, y] = tsetPoint(s, e);
  s.swipe.set(e.pointerId, { x, y, t: performance.now(), done: false });
}
// A swipe acts the moment it is long enough, not when the finger lifts.
function swipeMove(s, e) {
  const w = s.swipe.get(e.pointerId);
  if (!w || w.one || w.done || SETTINGS.touchSwipe === false) return;
  const [x, y] = tsetPoint(s, e), dx = x - w.x, dy = y - w.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
  w.done = true;
  if (Math.abs(dy) > Math.abs(dx)) pressAction(s.slot, dy < 0 ? 'jump' : 'grab');
  else touchDash(s, Math.sign(s.rot ? -dx : dx));
  nativeHaptic('selection');
}
function swipeUp(s, e) {
  const w = s.swipe.get(e.pointerId);
  s.swipe.delete(e.pointerId);
  if (!w) return;
  if (w.one) { touchRelease(s, 'attack'); return; }
  const [x, y] = tsetPoint(s, e);
  const tap = !w.done && Math.hypot(x - w.x, y - w.y) < TAP_MAX && performance.now() - w.t < TAP_MS;
  if (tap && e.type === 'pointerup') pressAction(s.slot, 'attack');
}
function touchDash(s, dir) {
  if (G_STATE.state !== 'play') return;
  for (const f of humansIn(s.slot)) f.inp.dash = dir || f.face;
}

// ---------- layout: table mode and the thumb arc ----------
// [action, ring (1 inner, 2 outer), angle in degrees: 180 = left of Attack, 90 = straight above it]
const TOUCH_ARC = [['jump', 1, 182], ['skill1', 1, 146], ['skill2', 1, 115], ['dash', 1, 86],
  ['block', 2, 172], ['throw', 2, 150], ['grab', 2, 133], ['super', 2, 116], ['taunt', 2, 99]];
// Two touch seats on one flat iPad: 93-pads gives set 1 a player only with SETTINGS.tableMode on.
const tableActive = () => !!TOUCH_EL && !TOUCH_EL.hidden && TSETS[1].slot >= 0 && !!SETTINGS.tableMode;

function touchLayout() {
  if (!TOUCH_EL || !TSETS[0].box) return;
  const table = tableActive(), live = table ? TSETS : [TSETS[0]];
  tsetSecond(table);
  if (TOUCH_EL.hidden) return;
  TOUCH_EL.classList.toggle('table', table);
  tableBoxes(table);
  for (const s of live) s.rect = s.box.getBoundingClientRect();
  // Both sets get the same sizes, from the smaller box: a fair fight across the table.
  const m = Math.min(...live.map(s => Math.min(s.rect.width, s.rect.height)));
  TOUCH_EL.style.setProperty('--to', clamp(+SETTINGS.touchAlpha || .8, .2, 1));
  for (const s of live) touchLayoutSet(s, m, !table && innerHeight > innerWidth);
}
// P1's set fills the bottom half; P2's, turned 180°, the top half from just below the HUD cards (VIEW, 85-render).
function tableBoxes(on) {
  const H = innerHeight, mid = Math.round(H / 2), hudB = Math.round((VIEW.hudY + VIEW.hudH) / VIEW.dpr), top = on ? Math.min(mid - 140, hudB + 8) : 0;
  Object.assign(TSETS[0].box.style, on ? { top: mid + 'px', height: H - mid + 'px' } : { top: '', height: '' });
  if (!on) return;
  Object.assign(TSETS[1].box.style, { top: top + 'px', height: mid - top + 'px' });
  TSETS[1].box.style.setProperty('--hud', Math.max(0, hudB - top) + 'px');   // phones: P2's pause clears the HUD
}
// m: the shorter side of the smallest live set box; tall: a portrait screen (a little smaller so the arc clears the stick).
function touchLayoutSet(s, m, tall) {
  const k = clamp(+SETTINGS.touchSize || 1, .7, 1.4), one = oneButtonOn(s.slot), simple = simpleOn(s.slot) && !one;
  const lim = m >= 760 ? 104 : 92;                       // tablets: thumbs sit further from the corner
  const big = clamp(m * .2, 58, lim) * k * (tall ? .88 : 1), pad = Math.max(14, big * .2);
  const cx = pad + big / 2;                               // Attack's centre, from the set's bottom-right corner
  s.box.classList.toggle('one', one);
  s.box.classList.toggle('simple', simple);
  s.stick.R = big * .72;
  s.stickEl.style.setProperty('--sr', s.stick.R + 'px');
  const zone = s.box.querySelector('.tzone-l');
  s.stick.zone = zone && !one ? { x: zone.offsetLeft, y: zone.offsetTop, h: zone.offsetHeight } : null;
  stickRest(s);
  touchPlace(s, 'attack', one ? big * 1.6 : big, one ? pad * 2 : cx, one ? pad * 2 : cx);
  for (const [act, sz, right, bottom] of simple ? touchSimpleArc(big, cx) : touchArc(big, cx, pad)) touchPlace(s, act, sz, right, bottom);
}

// A spot `deg` round a ring of radius R about Attack (180 = left of it, 90 = above), as [right, bottom] px.
const ringAt = (cx, R, deg) => [cx - Math.cos(deg * Math.PI / 180) * R, cx + Math.sin(deg * Math.PI / 180) * R];
// Simple's three buttons are already far apart: they keep v4.0's sizes and spots.
const touchSimpleArc = (big, cx) => [['jump', big, ...ringAt(cx, big * 1.45, 182)], ['skill1', big * .74, ...ringAt(cx, big * 1.45, 122)]];

// Advanced: thumbs need 44 px targets with clear gaps, so sizes have floors and rings are spaced by arc length.
const TOUCH_GAP = 8, TOUCH_MIN = { mid: 48, small: 44 };   // px; the gap keeps 6+ after rounding
function touchArc(big, cx, pad) {
  const mid = Math.max(TOUCH_MIN.mid, big * .74), small = Math.max(TOUCH_MIN.small, big * .56);
  const ring = n => TOUCH_ARC.filter(r => r[1] === n).map(([act, , deg]) => [act, act === 'jump' ? big : n === 1 || act === 'block' ? mid : small, deg]);
  const inner = touchRing(ring(1), big * 1.45, cx, pad);
  const outer = touchRing(ring(2), Math.max(big * 2.45, inner.R + big / 2 + mid / 2 + TOUCH_GAP), cx, pad);   // no inner/outer pair can touch
  return inner.spots.concat(outer.spots);
}
// [act, size, deg] from the first deg on, TOUCH_GAP apart; the ring widens until its last button clears the right edge.
function touchRing(list, R, cx, pad) {
  for (let tries = 0; ; tries++, R *= 1.03) {
    let deg = list[0][2];
    const spots = list.map(([act, sz], i) => {
      if (i) deg -= 2 * Math.asin(Math.min(1, ((list[i - 1][1] + sz) / 2 + TOUCH_GAP) / (2 * R))) * 180 / Math.PI;
      return [act, sz, ...ringAt(cx, R, deg)];
    });
    const [, sz, right] = spots[spots.length - 1];
    if (right - sz / 2 >= pad || tries > 40) return { R, spots };
  }
}
// Puts a button's centre (right, bottom) px from its set's bottom-right corner.
function touchPlace(s, act, sz, right, bottom) {
  const b = s.box.querySelector(`button[data-act="${act}"]`);
  if (!b) return;
  Object.assign(b.style, { width: sz + 'px', height: sz + 'px', right: (right - sz / 2) + 'px', bottom: (bottom - sz / 2) + 'px',
    fontSize: Math.round(sz * .34) + 'px' });
}
addEventListener('resize', touchLayout);
on('roundStart', touchLayout);   // the HUD block (and so table mode's top set) can change height with the roster
