// 90-input.js: keyboard (rebindable, saved via store), gamepads and touch buttons, turned into each human fighter's
// f.inp. Held things (move, jump held, attack held) are read every frame; presses (jump, attack, skills, dash) are
// one-shot flags. When only one human is playing, slot 0 answers to both key sets and every gamepad.

const BIND_ACTIONS = ['left', 'right', 'jump', 'attack', 'skill1', 'skill2', 'dash'];
const ACTION_LABELS = { left: 'Move left', right: 'Move right', jump: 'Jump', attack: 'Attack', skill1: 'Skill 1', skill2: 'Skill 2', dash: 'Dash' };
const DEFAULT_BINDS = [
  { left: 'KeyA', right: 'KeyD', jump: 'KeyW', attack: 'KeyS', skill1: 'KeyQ', skill2: 'KeyE', dash: 'ShiftLeft' },
  { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', attack: 'ArrowDown', skill1: 'Period', skill2: 'Slash', dash: 'ShiftRight' },
];
// Standard gamepad layout: A jump, B skill 1, X attack, Y skill 2, RB dash, Start pause, d-pad move.
const PAD_BUTTONS = { jump: 0, skill1: 1, attack: 2, skill2: 3, dash: 5, pause: 9, left: 14, right: 15 };
const DOUBLE_TAP_MS = 260;

let BINDS = loadBinds();
const KEYS = new Set();            // key codes currently held
const TOUCH = new Set();           // actions held on the on-screen buttons (slot 0)
let PADS = [];                     // per connected pad: { slot, held: {action: bool}, axis }
const TAPS = [{}, {}];             // last left/right press per slot, for double-tap dash
let KEY_CAPTURE = null;            // set by the rebinding UI: the next key goes to this callback

function loadBinds() {
  const saved = store.get('binds', null);
  return DEFAULT_BINDS.map((b, i) => Object.assign({}, b, saved && saved[i]));
}
function saveBinds() { store.set('binds', BINDS); }
// Binds a key; if it was used elsewhere, the two actions swap keys so nothing is left unbound.
function setBind(slot, action, code) {
  const old = BINDS[slot][action];
  for (const b of BINDS) for (const a of BIND_ACTIONS) if (b[a] === code) b[a] = old;
  BINDS[slot][action] = code;
  saveBinds();
}
function resetBinds() { BINDS = DEFAULT_BINDS.map(b => ({ ...b })); saveBinds(); }
function captureNextKey(cb) { KEY_CAPTURE = cb; }
// Stops listening for a rebind (the Controls screen was left or rebuilt) so the next key isn't silently bound.
function cancelKeyCapture() { KEY_CAPTURE = null; }
// Keys with a fixed job everywhere (pause, mute): they can't be bound to fighter actions.
const RESERVED_KEYS = new Set(['Escape', 'KeyP', 'KeyM']);

// Punctuation keys get a name next to the symbol (a lone '.' in a key cap looks unbound); `short` keeps just the symbol.
function keyLabel(code, short) {
  if (!code) return '—';
  const PUNCT = { Period: '.', Comma: ',', Slash: '/', Semicolon: ';', Quote: "'", Backslash: '\\' };
  if (short && PUNCT[code]) return PUNCT[code];
  const named = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Space: 'Space', Period: '. dot', Comma: ', comma',
    Slash: '/ slash', Semicolon: '; semi', Quote: "' quote", Backslash: '\\ bksl', Enter: 'Enter', Backspace: 'Bksp', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']' };
  if (named[code]) return named[code];
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}

const humanCount = () => G_STATE.roster.filter(r => r.ctrl === 'human').length;
// Binding sets a slot listens to: in one-human modes, slot 0 accepts both.
const bindsFor = slot => humanCount() <= 1 && slot === 0 ? BINDS : [BINDS[slot]].filter(Boolean);
const humansIn = slot => F.filter(f => f.ctrl === 'human' && !f.autopilot && f.slot === slot);
// Short label of the key for an action (shown on HUD skill icons).
function keyHint(slot, action) { const b = BINDS[slot]; return b ? keyLabel(b[action], true) : ''; }

function togglePause() {
  if (G_STATE.state === 'play') setState('paused');
  else if (G_STATE.state === 'paused') setState('play');
}

// One-shot press of an action for every human fighter on that slot.
function pressAction(slot, act) {
  if (G_STATE.state !== 'play') return;
  if (act === 'left' || act === 'right') {   // double-tap a direction to dash
    const t = TAPS[slot], now = performance.now(), dash = t.act === act && now - t.at < DOUBLE_TAP_MS;
    t.act = act; t.at = dash ? 0 : now;
    if (!dash) return;
  }
  for (const f of humansIn(slot)) {
    if (act === 'left') f.inp.dash = -1;
    else if (act === 'right') f.inp.dash = 1;
    else if (act === 'dash') f.inp.dash = Math.sign(f.inp.mx) || f.face;
    else if (act in f.inp) f.inp[act] = true;
  }
}

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Slash', 'Quote', 'Tab']);
function onKeyDown(e) {
  if (KEY_CAPTURE) { e.preventDefault(); const cb = KEY_CAPTURE; KEY_CAPTURE = null; cb(e.code); return; }
  const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (GAME_KEYS.has(e.code) && !typing && G_STATE.state === 'play') e.preventDefault();
  if (e.repeat) return;              // before pause/mute: holding Esc or M must not toggle them on and off
  if (e.code === 'Escape' || (e.code === 'KeyP' && !typing)) { togglePause(); emit('escape', e); return; }
  if (e.code === 'KeyM' && !typing) { toggleMute(); return; }
  KEYS.add(e.code);
  if (G_STATE.state !== 'play') return;
  for (const slot of [0, 1]) for (const b of bindsFor(slot)) for (const a of BIND_ACTIONS) if (b[a] === e.code) pressAction(slot, a);
}
addEventListener('keydown', onKeyDown);
addEventListener('keyup', e => KEYS.delete(e.code));
addEventListener('blur', () => { KEYS.clear(); TOUCH.clear(); });
// Switching tabs mid-fight pauses instead of letting the CPU win while you're away.
document.addEventListener('visibilitychange', () => { if (document.hidden && G_STATE.state === 'play' && humanCount() > 0) setState('paused'); });

function heldAction(slot, act) {
  if (bindsFor(slot).some(b => b[act] && KEYS.has(b[act]))) return true;
  if (slot === 0 && TOUCH.has(act)) return true;
  return PADS.some(p => p.slot === slot && p.held[act]);
}

// Called every frame for each human fighter (not during SC.sim, so tests can drive f.inp directly).
function readHuman(f) {
  let mx = (heldAction(f.slot, 'right') ? 1 : 0) - (heldAction(f.slot, 'left') ? 1 : 0);
  for (const p of PADS) if (p.slot === f.slot && Math.abs(p.axis) > .3 && !mx) mx = p.axis;
  f.inp.mx = clamp(mx, -1, 1);
  f.inp.jumpHeld = heldAction(f.slot, 'jump');
  f.inp.attackHeld = heldAction(f.slot, 'attack');
}

// ---------- gamepads ----------
// Pads are tracked by their browser index, so unplugging one doesn't scramble the others' held buttons.
// In two-human modes the first connected pad drives P1 and the second P2; with one human every pad drives P1.
const PAD_ALT = { attack: [7], dash: [6], skill1: [4] };   // RT attacks, LT dashes, LB is skill 1 too
const PAD_DEADZONE = .3;
let PAD_HELD = new Map();          // gamepad index -> { action: held } from the last poll
let PAD_POLL_STATE = null;         // game state at the last poll

function readPadList() {
  try { return navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []; } catch (e) { return []; }
}
function padButtonDown(gp, action) {
  return [PAD_BUTTONS[action], ...(PAD_ALT[action] || [])].some(i => { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > .5); });
}

function pollPads() {
  const list = readPadList(), solo = humanCount() <= 1, seen = new Map();
  // On the first poll after a state change, buttons already down are not fresh presses: A on "Resume" must not
  // also make the fighter jump, and A used to skip the kill-cam must not act again on the next screen.
  const changed = PAD_POLL_STATE !== null && PAD_POLL_STATE !== G_STATE.state;
  PAD_POLL_STATE = G_STATE.state;
  PADS = list.map((gp, n) => {
    const old = PAD_HELD.get(gp.index) || {}, held = {};
    const slot = solo ? 0 : Math.min(n, 1);
    for (const a in PAD_BUTTONS) {
      held[a] = padButtonDown(gp, a);
      if (held[a] && !old[a] && !changed) {
        if (a === 'pause') togglePause();
        else pressAction(slot, a);
        emit('pad', a, slot);      // lets menus react to gamepad buttons
      }
    }
    seen.set(gp.index, held);
    const ax = gp.axes[0] || 0;
    return { id: gp.index, slot, held, axis: Math.abs(ax) > PAD_DEADZONE ? ax : 0 };
  });
  PAD_HELD = seen;
}

const padLabel = gp => (gp && gp.id ? gp.id.replace(/\s*\(.*\)/, '').slice(0, 40) : 'Gamepad') || 'Gamepad';
// Hot-plugging: say which player a new pad drives; losing a pad mid-fight pauses so nobody is left helpless.
addEventListener('gamepadconnected', e => {
  const n = readPadList().findIndex(gp => gp.index === e.gamepad.index);
  const who = humanCount() >= 2 ? 'Player ' + (Math.min(Math.max(n, 0), 1) + 1) : 'Player 1';
  if (typeof toast === 'function') toast('Gamepad connected', `${padLabel(e.gamepad)} → ${who}`, '🎮', '#5ef2ff');
});
addEventListener('gamepaddisconnected', e => {
  PAD_HELD.delete(e.gamepad.index);
  if (typeof toast === 'function') toast('Gamepad disconnected', padLabel(e.gamepad), '🎮', '#ff8a2e');
  if (G_STATE.state === 'play' && humanCount() > 0) setState('paused');
});

// Rumble the pads of a human fighter (strength 0..1). Silently does nothing where vibration isn't supported.
function padRumble(f, strength, ms) {
  if (G_STATE.sim || f.ctrl !== 'human' || f.autopilot || !PADS.length) return;
  const all = readPadList();
  for (const p of PADS) {
    if (p.slot !== f.slot) continue;
    const gp = all.find(g => g.index === p.id), act = gp && gp.vibrationActuator;
    if (!act || !act.playEffect) continue;
    try {
      const r = act.playEffect('dual-rumble', { duration: ms, strongMagnitude: clamp(strength, 0, 1), weakMagnitude: clamp(strength * .7, 0, 1) });
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* unsupported */ }
  }
}
on('damage', (B, amt, o) => {
  if (!o || o.small) return;
  padRumble(B, clamp(amt / 25, .2, 1), 70 + amt * 5);
  if (o.src && o.src !== B) padRumble(o.src, clamp(amt / 50, .08, .4), 50);   // a lighter buzz for landing the hit
});
on('ko', victim => padRumble(victim, 1, 380));

// ---------- touch ----------
// Shown only on touch-first devices (coarse pointer), during play, and hidden again once a keyboard is used.
const TOUCH_EL = document.getElementById('touch');
const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let TOUCH_KEYBOARD = false;          // a hardware key was pressed on a touch device: hide the buttons
const TOUCH_MOVES = ['left', 'right'];

function touchButton(act) { return TOUCH_EL && TOUCH_EL.querySelector(`button[data-act="${act}"]`); }

// The move button nearest a finger's x (so sliding from ◀ to ▶ switches direction without lifting).
function touchMoveAt(clientX) {
  let best = null, bestD = Infinity;
  for (const a of TOUCH_MOVES) {
    const b = touchButton(a), r = b && b.getBoundingClientRect();
    if (!r) continue;
    const d = Math.abs(clientX - (r.left + r.width / 2));
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

function bindTouchButton(btn) {
  const act = btn.dataset.act, isMove = TOUCH_MOVES.includes(act);
  let cur = null;                   // the action this finger holds right now
  const hold = a => {
    if (cur === a) return;
    release();
    cur = a; TOUCH.add(a);
    const b = touchButton(a); if (b) b.classList.add('on');
    pressAction(0, a);
  };
  const release = () => {
    if (!cur) return;
    TOUCH.delete(cur);
    const b = touchButton(cur); if (b) b.classList.remove('on');
    cur = null;
  };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    initAudio();
    if (e.pointerType === 'touch') { TOUCH_KEYBOARD = false; updateTouchUI(); }
    if (act === 'pause') { togglePause(); return; }
    if (isMove && btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ } }
    hold(act);
  });
  if (isMove) btn.addEventListener('pointermove', e => { if (cur) { const a = touchMoveAt(e.clientX); if (a) hold(a); } });
  for (const ev of ['pointerup', 'pointercancel', ...(isMove ? [] : ['pointerleave'])]) btn.addEventListener(ev, release);
}

function bindTouch() {
  if (!TOUCH_EL) return;
  for (const btn of TOUCH_EL.querySelectorAll('button[data-act]')) bindTouchButton(btn);
}
bindTouch();

function updateTouchUI() {
  if (!TOUCH_EL) return;
  TOUCH_EL.hidden = !(IS_TOUCH && !TOUCH_KEYBOARD && G_STATE.state === 'play' && humanCount() > 0);
  if (TOUCH_EL.hidden) { TOUCH.clear(); for (const b of TOUCH_EL.querySelectorAll('.on')) b.classList.remove('on'); }
}
on('state', updateTouchUI);

// ---------- portrait phones ----------
// A 16:9 arena on a portrait phone is a thin strip with an unreadable HUD: ask to rotate, and pause meanwhile.
const ROTATE_EL = document.getElementById('rotate');
const PORTRAIT = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait)') : null;
let ROTATE_SKIPPED = false;
function updateRotatePrompt() {
  if (!ROTATE_EL || !PORTRAIT) return;
  const fighting = G_STATE.state === 'play' || G_STATE.state === 'paused';
  const show = IS_TOUCH && PORTRAIT.matches && fighting && !ROTATE_SKIPPED && humanCount() > 0;
  ROTATE_EL.hidden = !show;
  // Deferred: this runs inside a 'state' event, and the other listeners must see that change finish first.
  if (show) setTimeout(() => { if (!ROTATE_EL.hidden && G_STATE.state === 'play') setState('paused'); }, 0);
}
if (ROTATE_EL) {
  ROTATE_EL.querySelector('.rotate-skip').addEventListener('click', () => {
    ROTATE_SKIPPED = true; ROTATE_EL.hidden = true;
    if (G_STATE.state === 'paused') setState('play');
  });
  on('state', updateRotatePrompt);
  if (PORTRAIT && PORTRAIT.addEventListener) PORTRAIT.addEventListener('change', updateRotatePrompt);
}
addEventListener('keydown', e => { if (IS_TOUCH && !e.repeat && !TOUCH_KEYBOARD && e.code !== 'Escape') { TOUCH_KEYBOARD = true; updateTouchUI(); } });

// Skill buttons show P1's skill icons and fill up as the cooldown runs (CSS reads --cd and --sc).
function updateTouchSkills() {
  if (!TOUCH_EL || TOUCH_EL.hidden) return;
  const f = F.find(x => x.ctrl === 'human' && !x.autopilot && x.slot === 0);
  for (let k = 0; k < 2; k++) {
    const btn = touchButton('skill' + (k + 1)), def = f && SKILLS[f.skills[k]];
    if (!btn) continue;
    btn.hidden = !def;
    if (!def) continue;
    if (btn.textContent !== def.icon) btn.textContent = def.icon;
    btn.style.setProperty('--sc', def.color);
    btn.style.setProperty('--cd', clamp(f.skillCd[k] / def.cd, 0, 1).toFixed(3));
    btn.setAttribute('aria-label', def.name);
  }
}
setInterval(() => { try { updateTouchSkills(); } catch (e) { report(e, 'touch skills'); } }, 100);
