// 91-touch.js: touch movement, gestures and the button layout for 90-input's on-screen controls. They drive the
// touch player (TOUCH_SLOT in 90-input: P1, or the seat that joined with touch in the lobby).
// - Floating stick (left zone): appears where the thumb lands. Its x drives P1's mx (analog, through TOUCH_AXIS);
//   pushing up presses jump (flick up again in the air for a double jump); pulling down holds SETTINGS.touchDown.
// - Gestures (right zone, outside the buttons): tap = attack, swipe up = jump, sideways = dash that way, down = grab.
// - Thumb arc: the action buttons sit on two arcs around Attack in the bottom-right corner, sized by
//   SETTINGS.touchSize and faded by SETTINGS.touchAlpha, laid out again on resize and rotation.
// - One-button mode for P1 (92-access): the whole screen is the one button.

const TOUCH_DEFAULTS = { touchSize: 1, touchAlpha: .8, touchDown: 'block', touchSwipe: true };
for (const k in TOUCH_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = TOUCH_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = TOUCH_DEFAULTS[k];
}

// ---------- the floating stick ----------
const STICK = { id: null, x0: 0, y0: 0, up: false, down: null, R: 56 };
const STICK_DEAD = .16, STICK_UP = -.55, STICK_DOWN = .6, STICK_GAIN = 1.35;   // gain: 75% of the way = full speed
const STICK_EL = TOUCH_EL && TOUCH_EL.querySelector('.tstick');

function stickDown(e) {
  if (STICK.id !== null || oneButtonOn(TOUCH_SLOT)) return;
  e.preventDefault();
  initAudio();
  STICK.id = e.pointerId; STICK.x0 = e.clientX; STICK.y0 = e.clientY;
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
  STICK_EL.classList.add('live');
  stickMove(e);
}

// The base follows a thumb that runs past the rim, so reversing direction never needs a long drag back.
function stickMove(e) {
  if (e.pointerId !== STICK.id) return;
  let dx = e.clientX - STICK.x0, dy = e.clientY - STICK.y0;
  const len = Math.hypot(dx, dy), R = STICK.R;
  if (len > R) { STICK.x0 = e.clientX - dx / len * R; STICK.y0 = e.clientY - dy / len * R; dx = dx / len * R; dy = dy / len * R; }
  const nx = dx / R, ny = dy / R;
  TOUCH_AXIS.mx = Math.abs(nx) < STICK_DEAD ? 0 : clamp(nx * STICK_GAIN, -1, 1);
  stickVertical(ny);
  STICK_EL.style.transform = `translate(${STICK.x0 - R}px, ${STICK.y0 - R}px)`;
  STICK_EL.firstChild.style.transform = `translate(${dx}px, ${dy}px)`;
}

// Up and down have a little hysteresis so a thumb resting near the line doesn't flicker the action.
function stickVertical(ny) {
  if (!STICK.up && ny < STICK_UP) { STICK.up = true; touchHold('jump'); }
  else if (STICK.up && ny > STICK_UP + .15) { STICK.up = false; touchRelease('jump'); }
  const act = SETTINGS.touchDown === 'off' ? null : SETTINGS.touchDown;
  if (!STICK.down && act && ny > STICK_DOWN) { STICK.down = act; touchHold(act); }
  else if (STICK.down && ny < STICK_DOWN - .15) { touchRelease(STICK.down); STICK.down = null; }
}

function stickUp(e) {
  if (e.pointerId !== STICK.id) return;
  if (STICK.up) touchRelease('jump');
  if (STICK.down) touchRelease(STICK.down);
  Object.assign(STICK, { id: null, up: false, down: null });
  TOUCH_AXIS.mx = 0;
  STICK_EL.classList.remove('live');
  STICK_EL.style.transform = ''; STICK_EL.firstChild.style.transform = '';
}

// ---------- right-side gestures ----------
const SWIPE = new Map();             // pointerId -> { x, y, t, done }
const SWIPE_MIN = 34, TAP_MAX = 22, TAP_MS = 320;

function swipeDown(e) {
  e.preventDefault();
  initAudio();
  if (oneButtonOn(TOUCH_SLOT)) { touchHold('attack'); SWIPE.set(e.pointerId, { one: true }); return; }
  SWIPE.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), done: false });
}
// A swipe acts the moment it is long enough, not when the finger lifts.
function swipeMove(e) {
  const s = SWIPE.get(e.pointerId);
  if (!s || s.one || s.done || SETTINGS.touchSwipe === false) return;
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
  s.done = true;
  if (Math.abs(dy) > Math.abs(dx)) pressAction(TOUCH_SLOT, dy < 0 ? 'jump' : 'grab');
  else touchDash(Math.sign(dx));
  nativeHaptic('selection');
}
function swipeUp(e) {
  const s = SWIPE.get(e.pointerId);
  SWIPE.delete(e.pointerId);
  if (!s) return;
  if (s.one) { touchRelease('attack'); return; }
  const tap = !s.done && Math.hypot(e.clientX - s.x, e.clientY - s.y) < TAP_MAX && performance.now() - s.t < TAP_MS;
  if (tap && e.type === 'pointerup') pressAction(TOUCH_SLOT, 'attack');
}
function touchDash(dir) {
  if (G_STATE.state !== 'play') return;
  for (const f of humansIn(TOUCH_SLOT)) f.inp.dash = dir || f.face;
}

function bindTouchZones() {
  if (!TOUCH_EL || !STICK_EL) return;
  const left = TOUCH_EL.querySelector('.tzone-l'), right = TOUCH_EL.querySelector('.tzone-r');
  left.addEventListener('pointerdown', stickDown);
  left.addEventListener('pointermove', stickMove);
  for (const ev of ['pointerup', 'pointercancel']) left.addEventListener(ev, stickUp);
  right.addEventListener('pointerdown', swipeDown);
  right.addEventListener('pointermove', swipeMove);
  for (const ev of ['pointerup', 'pointercancel']) right.addEventListener(ev, swipeUp);
}
bindTouchZones();

// ---------- layout: the thumb arc ----------
// [action, ring (1 inner, 2 outer), angle in degrees: 180 = left of Attack, 90 = straight above it]
const TOUCH_ARC = [['jump', 1, 182], ['skill1', 1, 146], ['skill2', 1, 115], ['dash', 1, 86],
  ['block', 2, 172], ['throw', 2, 150], ['grab', 2, 133], ['super', 2, 116], ['taunt', 2, 99]];

function touchLayout() {
  if (!TOUCH_EL || TOUCH_EL.hidden) return;
  const k = clamp(+SETTINGS.touchSize || 1, .7, 1.4), one = oneButtonOn(TOUCH_SLOT);
  const tall = innerHeight > innerWidth;                 // portrait: a little smaller so the arc clears the stick
  const lim = Math.min(innerWidth, innerHeight) >= 760 ? 104 : 92;   // tablets: thumbs sit further from the corner
  const big = clamp(Math.min(innerWidth, innerHeight) * .2, 58, lim) * k * (tall ? .88 : 1), pad = Math.max(14, big * .2);
  const size = { big, mid: big * .74, small: big * .56 }, rings = { 1: big * 1.45, 2: big * 2.45 };
  const cx = pad + big / 2;                               // Attack's centre, from the bottom-right corner
  TOUCH_EL.classList.toggle('one', one);
  TOUCH_EL.style.setProperty('--to', clamp(+SETTINGS.touchAlpha || .8, .2, 1));
  STICK.R = big * .72;
  if (STICK_EL) STICK_EL.style.setProperty('--sr', STICK.R + 'px');
  touchPlace('attack', one ? big * 1.6 : big, one ? pad * 2 : cx, one ? pad * 2 : cx);
  for (const [act, ring, deg] of TOUCH_ARC) {
    const s = act === 'jump' ? size.big : ring === 1 || act === 'block' ? size.mid : size.small, a = deg * Math.PI / 180;
    touchPlace(act, s, cx - Math.cos(a) * rings[ring], cx + Math.sin(a) * rings[ring]);
  }
}
// Puts a button's centre (right, bottom) px from the bottom-right corner.
function touchPlace(act, s, right, bottom) {
  const b = touchButton(act);
  if (!b) return;
  Object.assign(b.style, { width: s + 'px', height: s + 'px', right: (right - s / 2) + 'px', bottom: (bottom - s / 2) + 'px',
    fontSize: Math.round(s * .34) + 'px' });
}
addEventListener('resize', touchLayout);
