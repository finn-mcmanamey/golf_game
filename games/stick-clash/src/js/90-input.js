// 90-input.js: keyboard (rebindable, saved via store), gamepads and touch buttons, turned into each human fighter's
// f.inp. Held things (move, jump held, attack held) are read every frame; presses (jump, attack, skills, dash) are
// one-shot flags. When only one human is playing, slot 0 answers to both key sets and every gamepad.
// v3: per-player gamepad maps (remapped in 93-pads), up to 8 players from the join lobby (JOINED), the touch stick's
// analog axis (91-touch), one-button mode (92-access) and rumble + native haptics scaled by SETTINGS.rumble.
// v4: a control scheme per player (CTL, below), the Compact 2P key layout (keySets) and one touch set per touch seat
// (TSETS; table mode, 91-touch). CPUs never read any of this.

const BIND_ACTIONS = ['left', 'right', 'jump', 'attack', 'skill1', 'skill2', 'dash', 'block', 'grab', 'throw', 'super', 'taunt'];
const ACTION_LABELS = { left: 'Move left', right: 'Move right', jump: 'Jump', attack: 'Attack', skill1: 'Skill 1', skill2: 'Skill 2', dash: 'Dash',
  block: 'Block (hold)', grab: 'Grab / throw', throw: 'Throwable', super: 'Super', taunt: 'Taunt' };
// v3 actions sit next to each hand: P1 F block, C grab, R throwable, X super; P2 , block, L grab, ; throwable, Enter super.
const DEFAULT_BINDS = [
  { left: 'KeyA', right: 'KeyD', jump: 'KeyW', attack: 'KeyS', skill1: 'KeyQ', skill2: 'KeyE', dash: 'ShiftLeft',
    block: 'KeyF', grab: 'KeyC', throw: 'KeyR', super: 'KeyX', taunt: 'KeyT' },
  { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', attack: 'ArrowDown', skill1: 'Period', skill2: 'Slash', dash: 'ShiftRight',
    block: 'Comma', grab: 'KeyL', throw: 'Semicolon', super: 'Enter', taunt: 'Quote' },
];
// Standard gamepad layout: A jump, B skill 1, X attack, Y skill 2, LB throwable, RB dash, LT block (hold), RT grab,
// R3 (right stick click) super, Start pause, d-pad move. These are the defaults; PAD_MAPS holds each player's own map.
const PAD_BUTTONS = { jump: 0, skill1: 1, attack: 2, skill2: 3, throw: 4, dash: 5, block: 6, grab: 7, super: 11, pause: 9, left: 14, right: 15, taunt: 12 };   // taunt: d-pad up
const DOUBLE_TAP_MS = 260;

let BINDS = loadBinds();
const KEYS = new Set();            // key codes currently held
// Touch sets (91-touch): 0 = #touch's markup, 1 = table mode's copy. slot: its player (-1 = nobody); held: actions held
// on its buttons; mx: its stick's x. TOUCH_SLOT mirrors set 0's slot (P1 or the lobby's touch seat).
const TSETS = [0, 1].map(i => ({ i, slot: i ? -1 : 0, held: new Set(), mx: 0 }));
let TOUCH_SLOT = 0;
let PADS = [];                     // per connected pad: { slot, held: {action: bool}, axis }
const TAPS = Array.from({ length: MAX_FIGHTERS }, () => ({}));   // last left/right press per slot, for double-tap dash
const SLOT_DEV = [];   // per slot: 'key' | 'pad' last pressed, so one player's keys don't relabel a pad player (94)
// Players who joined in the party lobby (93-pads), in join order: [{ pad: gamepad index } | { keys: 0 | 1 }].
// While set, player n is driven only by its own entry. null = the classic rules (pad n -> P(n+1), both key sets in 1P).
let JOINED = null;
let KEY_CAPTURE = null;            // set by the rebinding UI: the next key goes to this callback

// Saved binds from before v3 lack the new actions: their defaults are added unless that key is already taken.
function loadBinds() {
  const raw = store.get('binds', null);
  const keep = (b, ok) => b && typeof b === 'object' ? Object.fromEntries(Object.entries(b).filter(([a, v]) => BIND_ACTIONS.includes(a) && ok(v))) : {};
  const saved = Array.isArray(raw) ? raw.map(b => keep(b, v => v === null || typeof v === 'string')) : null;   // wrong-shaped saves are ignored
  const out = DEFAULT_BINDS.map((b, i) => Object.assign({}, b, saved && saved[i]));
  if (!saved) return out;
  out.forEach((b, i) => {
    for (const a of BIND_ACTIONS) {
      if (saved[i] && saved[i][a] !== undefined) continue;          // the player's own choice stays
      if (out.some((o, j) => BIND_ACTIONS.some(x => (j !== i || x !== a) && o[x] === b[a]))) b[a] = null;
    }
  });
  return out;
}
// Binds a key; if it was used elsewhere, the two actions swap keys so nothing is left unbound.
function setBind(slot, action, code) {
  const old = BINDS[slot][action];
  for (const b of BINDS) for (const a of BIND_ACTIONS) if (b[a] === code) b[a] = old;
  BINDS[slot][action] = code;
  saveBinds();
}
function resetBinds() { BINDS = DEFAULT_BINDS.map(b => ({ ...b })); saveBinds(); }
function saveBinds() { KEYSETS = null; store.set('binds', BINDS); }
function captureNextKey(cb) { KEY_CAPTURE = cb; }
// Stops listening for a rebind (the Controls screen was left or rebuilt) so the next key isn't silently bound.
function cancelKeyCapture() { KEY_CAPTURE = null; }
// Keys with a fixed job everywhere (pause, mute): they can't be bound to fighter actions.
const RESERVED_KEYS = new Set(['Escape', 'KeyP', 'KeyM']);

// ---------- control schemes and the key layout (v4) ----------
// Advanced = every action. Simple = move, jump, attack, one skill button (the super while the meter is full), block by
// holding back from an attacking foe (or the block key), dash by double-tap; grab, throwables, skill 2 and taunt off.
const SIMPLE_OFF = new Set(['grab', 'throw', 'skill2', 'taunt']);
// Compact 2P: both players' core keys on one laptop keyboard; other actions keep their binds unless a core key took them.
// P2's skill 2 moves to Comma (its free block key): Slash is the core skill key here.
const COMPACT_KEYS = [
  { left: 'KeyA', right: 'KeyD', jump: 'KeyW', block: 'KeyS', attack: 'KeyF', skill1: 'KeyG' },
  { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', block: 'ArrowDown', attack: 'Period', skill1: 'Slash', skill2: 'Comma' },
];
let KEYSETS = null;                // keySets() cache: dropped when the binds or the layout change
// Store 'controls' = { schemes: [P1..P8], layout }. Without one: Simple for a brand-new player (no save at all), else
// Advanced, written at once so later loads keep it.
const CTL = ctlLoad();
function ctlLoad() {
  const raw = store.getObj('controls'), list = Array.isArray(raw.schemes) ? raw.schemes : null;
  let fresh = true;
  try { fresh = !Object.keys(localStorage).some(k => k.startsWith(STORE_PREFIX)); } catch (e) { /* no storage */ }
  const ok = v => v === 'simple' || v === 'advanced', def = fresh ? 'simple' : 'advanced';
  const c = { schemes: Array.from({ length: MAX_FIGHTERS }, (_, i) => list && ok(list[i]) ? list[i] : def), layout: raw.layout === 'compact' ? 'compact' : 'standard' };
  if (!list) store.set('controls', c);
  return c;
}
// In force: trials (mode.quest) are built around every move, so they always use Advanced.
const schemeOf = slot => G_STATE.mode && G_STATE.mode.quest ? 'advanced' : CTL.schemes[slot] || 'advanced';
const simpleOn = slot => schemeOf(slot) === 'simple';
function setScheme(slot, v) { CTL.schemes[slot] = v; store.set('controls', CTL); if (typeof touchLayout === 'function') touchLayout(); }
function setKeyLayout(v) { CTL.layout = v; KEYSETS = null; store.set('controls', CTL); }
// What each keyboard set's keys do now: the binds, or under Compact 2P the fixed core keys plus the other binds.
function keySets() {
  if (KEYSETS) return KEYSETS;
  if (CTL.layout !== 'compact') return (KEYSETS = BINDS);
  const core = new Set(COMPACT_KEYS.flatMap(Object.values));
  return (KEYSETS = BINDS.map((b, i) => Object.assign(Object.fromEntries(BIND_ACTIONS.map(a => [a, core.has(b[a]) ? null : b[a]])), COMPACT_KEYS[i])));
}

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
// Key sets a slot listens to: in one-human modes, slot 0 accepts both.
function bindsFor(slot) {
  const S = keySets();
  if (JOINED) { const j = JOINED[slot]; return j && j.keys != null ? [S[j.keys]] : []; }
  return humanCount() <= 1 && slot === 0 ? S : [S[slot]].filter(Boolean);
}
const keySlots = () => JOINED ? JOINED.map((_, i) => i) : [0, 1];
const humansIn = slot => F.filter(f => f.ctrl === 'human' && !f.autopilot && f.slot === slot);
// Short label for an action (HUD skill icons, full super meter) in the player's device: key, pad button, none on touch.
// A Simple player's skill button fires the full super: the meter names it and the skill icon's label gets a star.
function keyHint(slot, action) {
  const name = hintNamer(slot);
  if (!name) return '';
  if (!simpleOn(slot)) return name(action);
  if (SIMPLE_OFF.has(action)) return '';
  const skill = name('skill1'), f = humansIn(slot)[0];
  return action === 'super' ? skill : action === 'skill1' && f && f.super >= 100 ? '★' + skill : name(action);
}
// Names actions by the slot's keys or pad buttons (94's ctlDevices); null on the touch screen.
function hintNamer(slot) {
  const d = typeof ctlDevices === 'function' ? ctlDevices(slot) : { keys: true }, b = keySets()[JOINED ? (JOINED[slot] || {}).keys : slot];
  if (d.touch) return null;
  if (d.pad && !d.keys) return typeof padName === 'function' ? a => padName(padMapFor(slot)[a]) : null;
  return b ? a => keyLabel(b[a], true) : null;
}

function togglePause() {
  if (G_STATE.state === 'play') setState('paused');
  else if (G_STATE.state === 'paused') setState('play');
}

// One-shot press of an action for every human fighter on that slot (a Simple player's off actions do nothing).
function pressAction(slot, act) {
  if (slot < 0 || G_STATE.state !== 'play') return;   // slot -1: the touch screen drives nobody in this lobby
  const simple = simpleOn(slot);
  if (simple && SIMPLE_OFF.has(act)) return;
  if (act === 'left' || act === 'right') {   // double-tap a direction to dash
    for (const f of humansIn(slot)) if (f.heldBy) f.inp.mash = true;     // wiggling counts toward escaping a grab
    const t = TAPS[slot], now = performance.now(), dash = t.act === act && now - t.at < DOUBLE_TAP_MS;
    t.act = act; t.at = dash ? 0 : now;
    if (!dash) return;
  }
  for (const f of humansIn(slot)) {
    if (act === 'left') f.inp.dash = -1;
    else if (act === 'right') f.inp.dash = 1;
    else if (act === 'dash') f.inp.dash = Math.sign(f.inp.mx) || f.face;
    else if (simple && act === 'skill1' && f.super >= 100) f.inp.super = true;   // Simple's one skill button
    else if (act in f.inp) f.inp[act] = true;
  }
}

// Game keys never reach the browser in a fight (arrows scroll, Tab moves focus, letters start find-as-you-type); "/",
// "'" and "." (Firefox quick find) are held back everywhere outside text fields.
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab']), FIND_KEYS = new Set(['Slash', 'Quote', 'Period']);
const keyBound = code => keySets().some(b => BIND_ACTIONS.some(a => b[a] === code));
function onKeyDown(e) {
  if (KEY_CAPTURE) { e.preventDefault(); const cb = KEY_CAPTURE; KEY_CAPTURE = null; cb(e.code); return; }
  const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName), plain = !e.ctrlKey && !e.metaKey && !e.altKey;
  if (!typing && plain && (FIND_KEYS.has(e.code) || G_STATE.state === 'play' && (GAME_KEYS.has(e.code) || keyBound(e.code)))) e.preventDefault();
  if (e.repeat) return;              // before pause/mute: holding Esc or M must not toggle them on and off
  if (e.code === 'Escape' || (e.code === 'KeyP' && !typing)) {
    // Inside Settings/Controls opened from the pause menu, Esc goes back one level like the Back button does.
    if (G_STATE.state === 'paused' && UI.screen !== 'pause' && PANELS[UI.screen] && !PANELS[UI.screen].hidden) goBack();
    else togglePause();
    emit('escape', e); return;
  }
  if (e.code === 'KeyM' && !typing) { toggleMute(); return; }
  KEYS.add(e.code);
  if (G_STATE.state !== 'play') return;
  for (const slot of keySlots()) for (const b of bindsFor(slot)) for (const a of BIND_ACTIONS) if (b[a] === e.code) { SLOT_DEV[slot] = 'key'; pressAction(slot, a); }
}
addEventListener('keydown', onKeyDown);
addEventListener('keyup', e => KEYS.delete(e.code));
addEventListener('blur', () => { KEYS.clear(); touchClear(); });
// Switching tabs mid-fight pauses instead of letting the CPU win while you're away.
document.addEventListener('visibilitychange', () => { if (document.hidden && G_STATE.state === 'play' && humanCount() > 0) setState('paused'); });

function heldAction(slot, act) {
  if (bindsFor(slot).some(b => b[act] && KEYS.has(b[act]))) return true;
  if (TSETS.some(s => s.slot === slot && s.held.has(act))) return true;
  return PADS.some(p => p.slot === slot && p.held[act]);
}

// Called every frame for each human fighter (not during SC.sim, so tests can drive f.inp directly).
function readHuman(f) {
  let mx = (heldAction(f.slot, 'right') ? 1 : 0) - (heldAction(f.slot, 'left') ? 1 : 0);
  for (const p of PADS) if (p.slot === f.slot && Math.abs(p.axis) > .3 && !mx) mx = p.axis;
  for (const s of TSETS) if (s.slot === f.slot && !mx) mx = s.mx;
  f.inp.mx = clamp(mx, -1, 1);
  f.inp.jumpHeld = heldAction(f.slot, 'jump');
  f.inp.attackHeld = heldAction(f.slot, 'attack');
  f.inp.blockHeld = heldAction(f.slot, 'block');
  if (simpleOn(f.slot)) simpleDrive(f);
  if (oneButtonOn(f.slot)) oneButtonDrive(f);   // 92-access: auto-move, the one button attacks / blocks / skills
}

// Simple: holding back from an attacking foe raises the guard (grounded); an attack drops it, so block + attack never
// grabs. In play the fighter keeps one skill and no throwables, so the HUD shows only what works.
function simpleDrive(f) {
  const inp = f.inp;
  if (G_STATE.state === 'play' && (f.skills[1] || f.throws[0] || f.throws[1])) {
    if (!f.skills[0]) { f.skills[0] = f.skills[1]; f.skillCd[0] = f.skillCd[1]; }
    f.skills[1] = null; f.throws = [null, null]; f.throwN = [0, 0];
  }
  if (!inp.blockHeld && f.grounded && Math.abs(inp.mx) > .3) inp.blockHeld = simpleThreat(f, Math.sign(inp.mx));
  if (inp.attack) inp.blockHeld = false;
}
const SIMPLE_ATK = new WeakMap();  // fighter -> game time of its last attack
on('attack', f => SIMPLE_ATK.set(f, G_STATE.t));
// An attack coming from behind the way the fighter walks (dir): a foe in reach that just swung or fired, an ultimate,
// or a shot flying at it.
function simpleThreat(f, dir) {
  const x = f.P[2].x, y = f.P[2].y, near = (ox, oy, r) => (ox - x) * dir < 0 && Math.abs(ox - x) < r && Math.abs(oy - y) < 160;
  for (const o of F) if (o.alive && o.team !== f.team && near(o.P[2].x, o.P[2].y, 280) && (o.ult || G_STATE.t - (SIMPLE_ATK.get(o) ?? -9) < .45)) return true;
  return PROJ.some(p => p.owner && p.team !== f.team && p.dmg > 0 && near(p.x, p.y, 360) && p.vx * (x - p.x) > 0);
}

// ---------- gamepads ----------
// Pads are tracked by their browser index, so unplugging one doesn't scramble the others' held buttons.
// In two-human modes the first connected pad drives P1 and the second P2; with one human every pad drives P1.
const PAD_ALT = { super: [8] };   // Back / View also fires the super
const PAD_DEADZONE = .3;
let PAD_HELD = new Map();          // gamepad index -> { action: held } from the last poll
let PAD_POLL_STATE = null;         // game state at the last poll

function readPadList() {
  try { return navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []; } catch (e) { return []; }
}
// Each player's pad map: the defaults plus their saved changes from the remapping screen (store 'padmap').
let PAD_MAPS = loadPadMaps();
function loadPadMaps() {
  const raw = store.get('padmap', null);
  const keep = b => b && typeof b === 'object' ? Object.fromEntries(Object.entries(b).filter(([a, v]) => a in PAD_BUTTONS && Number.isInteger(v) && v >= 0 && v < 32)) : {};
  return Array.from({ length: MAX_FIGHTERS }, (_, i) => Object.assign({}, PAD_BUTTONS, Array.isArray(raw) ? keep(raw[i]) : {}));
}
const padMapFor = slot => PAD_MAPS[slot] || PAD_BUTTONS;
const padPressed = (gp, i) => { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > .5); };
// An alternative button (Back for super) only counts while the player hasn't given it another job.
function padButtonDown(gp, action, slot = 0) {
  const map = padMapFor(slot), used = Object.values(map);
  const alt = (PAD_ALT[action] || []).filter(i => !used.includes(i));
  return [map[action], ...alt].some(i => padPressed(gp, i));
}
// Which player a pad drives: its place in the join lobby (-1 = didn't join), else the classic rules.
function padSlot(gp, n, solo) {
  if (JOINED) return JOINED.findIndex(j => j.pad === gp.index);
  return solo ? 0 : Math.min(n, Math.max(1, humanCount() - 1));
}

// A pad the browser could not map to the standard layout has its buttons anywhere: say so once, with the fix.
const PAD_WARNED = new Set();
function padLayoutCheck(gp) {
  if (PAD_WARNED.has(gp.index) || typeof gp.mapping !== 'string' || gp.mapping === 'standard') return;
  PAD_WARNED.add(gp.index);
  if (typeof toast === 'function') toast('Unknown button layout', 'Remap in Settings → Gamepad buttons', '🎮', '#ff8a2e');
}

function pollPads() {
  const list = readPadList(), solo = humanCount() <= 1, seen = new Map();
  // On the first poll after a state change, buttons already down are not fresh presses: A on "Resume" must not
  // also make the fighter jump, and A used to skip the kill-cam must not act again on the next screen.
  const changed = PAD_POLL_STATE !== null && PAD_POLL_STATE !== G_STATE.state;
  PAD_POLL_STATE = G_STATE.state;
  PADS = list.map((gp, n) => {
    padLayoutCheck(gp);
    const old = PAD_HELD.get(gp.index) || {}, held = {};
    const slot = padSlot(gp, n, solo);
    for (const a in PAD_BUTTONS) {
      held[a] = padButtonDown(gp, a, Math.max(slot, 0));
      if (held[a] && !old[a] && !changed) {
        if (a === 'pause') togglePause();
        else if (slot >= 0) { SLOT_DEV[slot] = 'pad'; pressAction(slot, a); }
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
  const slot = padSlot(e.gamepad, Math.max(n, 0), humanCount() <= 1);
  const who = slot < 0 ? 'nobody yet (join in the lobby)' : 'Player ' + (slot + 1);
  if (typeof toast === 'function') toast('Gamepad connected', `${padLabel(e.gamepad)} → ${who}`, '🎮', '#5ef2ff');
});
addEventListener('gamepaddisconnected', e => {
  PAD_HELD.delete(e.gamepad.index);
  if (typeof toast === 'function') toast('Gamepad disconnected', padLabel(e.gamepad), '🎮', '#ff8a2e');
  if (G_STATE.state === 'play' && humanCount() > 0) setState('paused');
});

// Rumble the pads of a human fighter (strength 0..1, scaled by SETTINGS.rumble). Silently does nothing where
// vibration isn't supported.
function padRumble(f, strength, ms) {
  const k = SETTINGS.rumble ?? .8;
  if (G_STATE.sim || f.ctrl !== 'human' || f.autopilot || !PADS.length || k <= 0) return;
  const all = readPadList(), s = clamp(strength * k, 0, 1);
  for (const p of PADS) {
    if (p.slot !== f.slot) continue;
    const gp = all.find(g => g.index === p.id), act = gp && gp.vibrationActuator;
    if (!act || !act.playEffect) continue;
    try {
      const r = act.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: clamp(s * .7, 0, 1) });
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* unsupported */ }
  }
}

// Phone haptics: the iOS app's bridge (StickClashNative.haptic, expo-haptics styles light/medium/heavy/soft/rigid/
// success/warning/error/selection), else navigator.vibrate. Rate-limited so a combo doesn't become one long buzz;
// results (success/error) always get through.
const HAPTIC = { at: 0, gap: 90 };
const HAPTIC_MS = { light: 10, selection: 8, soft: 12, medium: 20, rigid: 18, heavy: 35, success: 40, warning: 30, error: 60 };
function nativeHaptic(style) {
  if (SETTINGS.haptics === false || (SETTINGS.rumble ?? .8) <= 0) return;
  const now = performance.now();
  if (style !== 'success' && style !== 'error' && now - HAPTIC.at < HAPTIC.gap) return;
  HAPTIC.at = now;
  const native = window.StickClashNative;
  try {
    if (native && typeof native.haptic === 'function') native.haptic(style);
    else if ((typeof DEVICE !== 'undefined' ? DEVICE.touch : IS_TOUCH) && navigator.vibrate) navigator.vibrate(HAPTIC_MS[style] || 20);
  } catch (e) { /* best effort */ }
}
// One place for "this player felt something": pad rumble for that player, phone haptics for the touch player.
function feel(f, strength, ms, style) {
  if (!f || G_STATE.sim || G_STATE.demo || f.ctrl !== 'human' || f.autopilot) return;
  padRumble(f, strength, ms);
  if (style && TSETS.some(s => s.slot === f.slot)) nativeHaptic(style);   // whichever touch player it was
}
on('damage', (B, amt, o) => {
  if (!o || o.small) return;
  feel(B, clamp(amt / 25, .2, 1), 70 + amt * 5, amt >= 18 ? 'heavy' : 'medium');
  if (o.src && o.src !== B) feel(o.src, clamp(amt / 50, .08, .4), 50, 'light');   // a lighter buzz for landing the hit
});
on('ko', (victim, killer) => {
  feel(victim, 1, 380, 'error');
  if (killer && killer !== victim) feel(killer, .6, 200, 'success');
});
on('parry', (B, A) => { feel(B, .55, 120, 'rigid'); feel(A, .35, 90, 'warning'); });
on('guardBreak', f => feel(f, .7, 220, 'warning'));
on('ultimate', f => feel(f, 1, 520, 'heavy'));

// ---------- touch ----------
// Shown during play when touch controls are wanted (92-device: SETTINGS.touchMode; Auto = a coarse pointer until a key
// or pad is used, and any touch brings them back). Without 92-device: a coarse pointer until a hardware key is pressed.
// Movement is the floating stick and the right side takes swipes (91-touch); these are the action buttons.
const TOUCH_EL = document.getElementById('touch');
const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let TOUCH_KEYBOARD = false;          // fallback without 92-device: a hardware key was pressed, hide the buttons

// Holds a touch action of set s while it is pressed (presses once on the way down). Shared with the stick and swipes.
function touchHold(s, act) { if (!s.held.has(act)) { s.held.add(act); pressAction(s.slot, act); } }
function touchRelease(s, act) { s.held.delete(act); }
// Points the touch sets at their players (93-pads, at match start): set 1 only drives someone in table mode.
function touchSeats(a, b) { TOUCH_SLOT = TSETS[0].slot = a; TSETS[1].slot = b; }
// Lets go of everything on the touch sets (or only set i): hidden controls never keep a finger down.
function touchClear(i) {
  for (const s of TSETS.filter(t => i == null || t.i === i)) {
    s.held.clear(); s.mx = 0;
    if (s.stick) { Object.assign(s.stick, { id: null, up: false, down: null }); s.swipe.clear(); }
    if (s.box) for (const b of s.box.querySelectorAll('.on, .live')) b.classList.remove('on', 'live');
  }
}

function bindTouchButton(btn, s) {
  const act = btn.dataset.act;
  let held = false;                  // one finger per button: the button is held until that finger lifts
  const release = () => { if (!held) return; held = false; touchRelease(s, act); btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    initAudio();
    if (typeof inputSeen === 'function') inputSeen('touch');   // 92-device: the player is on the touch screen
    if (act === 'pause') { togglePause(); return; }
    held = true; btn.classList.add('on');
    touchHold(s, act);
    nativeHaptic('selection');
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, release);
}

function updateTouchUI() {
  if (!TOUCH_EL) return;
  const want = typeof touchWanted === 'function' ? touchWanted() : IS_TOUCH && !TOUCH_KEYBOARD;
  TOUCH_EL.hidden = !(want && TOUCH_SLOT >= 0 && G_STATE.state === 'play' && humanCount() > 0);
  if (TOUCH_EL.hidden) touchClear();
  touchLayout();                     // 91-touch: sets, size, opacity and the thumb arc for the current screen
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
  // A Split View / Stage Manager window is narrow without being a turned phone: 92-device checks the full width.
  const show = IS_TOUCH && PORTRAIT.matches && fighting && !ROTATE_SKIPPED && humanCount() > 0 && (typeof deviceFullWidth !== 'function' || deviceFullWidth());
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

// Skill buttons show their player's skill icons and fill up as the cooldown runs (CSS reads --cd and --sc); a Simple
// player's skill button is the super (★, glowing) while the meter is full.
function updateTouchSkills() {
  if (!TOUCH_EL || TOUCH_EL.hidden) return;
  for (const s of TSETS) if (s.box && s.box.isConnected) touchSkillsOf(s);
}
function touchSkillsOf(s) {
  const f = F.find(x => x.ctrl === 'human' && !x.autopilot && x.slot === s.slot), btn = a => s.box.querySelector(`button[data-act="${a}"]`);
  const sup = !!f && simpleOn(s.slot) && f.super >= 100;
  for (let k = 0; k < 2; k++) {
    const b = btn('skill' + (k + 1)), def = f && SKILLS[f.skills[k]], star = sup && !k;
    if (!b) continue;
    b.hidden = !def && !star;
    b.classList.toggle('ready', star);
    if (!def && !star) continue;
    const icon = star ? '★' : def.icon;
    if (b.textContent !== icon) b.textContent = icon;
    b.style.setProperty('--sc', star ? '#ffd84a' : def.color);
    b.style.setProperty('--cd', star ? 0 : clamp(f.skillCd[k] / def.cd, 0, 1).toFixed(3));
    b.setAttribute('aria-label', star ? 'Super' : def.name);
  }
  updateTouchV3(f, btn);
}
// Super lights up when the meter is full; the throwable button shows the next throwable and how many are left.
function updateTouchV3(f, btn) {
  const sup = btn('super'), thr = btn('throw');
  if (sup) sup.classList.toggle('ready', !!f && f.super >= 100);
  if (!thr) return;
  const slot = f ? (f.throwN[0] > 0 ? 0 : f.throwN[1] > 0 ? 1 : -1) : -1, def = f && THROWABLES[f.throws[slot < 0 ? 0 : slot]];
  thr.dataset.n = String(f ? f.throwN[0] + f.throwN[1] : 0);
  if (def) { if (thr.textContent !== def.icon) thr.textContent = def.icon; thr.style.setProperty('--sc', def.color); }
}
setInterval(() => { try { updateTouchSkills(); } catch (e) { report(e, 'touch skills'); } }, 100);
