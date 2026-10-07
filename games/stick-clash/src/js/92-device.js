// 92-device.js: the device layer. Everything here reads the game and only changes what is shown; nothing in a fight
// depends on it (the round-checking tools never see a DOM).
// - DEVICE: what the player is holding. Every real input (touch, key, pad) is reported through inputSeen(kind); the
//   on-screen controls (90-input / 91-touch) follow SETTINGS.touchMode: 'auto' shows them while the latest input was
//   a touch (or, before any input, on a coarse-pointer screen), 'on' / 'off' force them.
// - Rotate card: deviceFullWidth() keeps it (and its pause) away from Split View / Stage Manager windows; rotation
//   and visual-viewport changes re-run the layout twice (iOS reports stale sizes on the first event).
// - Fullscreen (title and pause menus, only where the browser allows it), landscape lock after it, a toast when an
//   embedded viewer refuses; a screen wake lock while a fight plays (SETTINGS.wakeLock).
// - #soundbar: a gamepad can start a match without the tap or key browsers need before sound may play; a tappable
//   strip says so until the first real gesture.

const DEVICE_DEFAULTS = { touchMode: 'auto', wakeLock: true };
for (const k in DEVICE_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = DEVICE_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = DEVICE_DEFAULTS[k];
}
SETTING_CHOICES.touchMode = ['auto', 'on', 'off'];

const DEVICE = {
  touch: navigator.maxTouchPoints > 0 || (typeof matchMedia === 'function' && matchMedia('(any-pointer: coarse)').matches),
  lastInput: null,   // 'touch' | 'key' | 'pad' | null (nothing seen yet)
  lastAt: 0,
  fs: false,         // in fullscreen now
  wake: null,        // the screen wake lock sentinel ('pending' while requested)
  fsFailAt: 0,       // when fullscreen was last refused (the promise and the error event both report it)
  lw: 0, lh: 0,      // window size at the last layout
};

// ---------- touch mode ----------
function touchWanted() {
  const m = SETTINGS.touchMode;
  if (m === 'on') return true;
  if (m === 'off') return false;
  if (JOINED && JOINED.some(j => j.touch)) return true;   // a lobby seat chose the touch screen
  return DEVICE.lastInput === 'touch' || (DEVICE.lastInput === null && IS_TOUCH);
}
// Every real input says what the player is holding; the on-screen controls appear or go when that changes.
function inputSeen(kind) {
  const before = touchWanted();
  DEVICE.lastInput = kind; DEVICE.lastAt = performance.now();
  if (touchWanted() !== before) updateTouchUI();
}
const deviceTyping = t => !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable === true);
const DEVICE_MODIFIERS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'CapsLock']);
// Capture phase, so a touch on the hidden controls' canvas and a key inside a menu both count.
addEventListener('pointerdown', e => { if (e.pointerType === 'touch') inputSeen('touch'); }, { capture: true, passive: true });
addEventListener('keydown', e => {
  // Typing a name or pasting a save code is not "playing on a keyboard": the controls stay for the touch player.
  if (e.code === 'Escape' || DEVICE_MODIFIERS.has(e.code) || deviceTyping(e.target)) return;
  inputSeen('key');
}, { capture: true, passive: true });
on('pad', () => inputSeen('pad'));

// ---------- rotate card and relayout ----------
// Split View / Stage Manager: a narrow window on a wide screen is not a turned phone, so no rotate card (and no pause).
const deviceFullWidth = () => !screen.width || innerWidth >= screen.width - 40;
function deviceRelayout() {
  if (innerWidth !== DEVICE.lw || innerHeight !== DEVICE.lh) { DEVICE.lw = innerWidth; DEVICE.lh = innerHeight; resize(); }
  updateRotatePrompt();
  touchLayout();
}
// iOS reports the old innerWidth / innerHeight on the first orientation event: lay out now and again a moment later.
function deviceRelayoutSoon() {
  try { deviceRelayout(); } catch (e) { report(e, 'relayout'); }
  setTimeout(() => { try { deviceRelayout(); } catch (e) { report(e, 'relayout'); } }, 350);
}
if (screen.orientation && typeof screen.orientation.addEventListener === 'function') screen.orientation.addEventListener('change', deviceRelayoutSoon);
if (window.visualViewport) visualViewport.addEventListener('resize', deviceRelayoutSoon);

// ---------- fullscreen ----------
const fullscreenAvailable = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fullscreenOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function fullscreenRefused() {
  const now = performance.now();
  if (now - DEVICE.fsFailAt < 1000) return;
  DEVICE.fsFailAt = now;
  toast('Fullscreen not allowed here', window.top !== window ? 'Open the game in its own tab for fullscreen.' : 'Your browser refused fullscreen.', '⛶');
}
function deviceLockLandscape() {
  try {
    const o = screen.orientation;
    if (o && typeof o.lock === 'function') { const p = o.lock('landscape'); if (p && p.catch) p.catch(() => {}); }
  } catch (e) { /* phones only, and only in fullscreen */ }
}
function enterFullscreen() {
  const root = document.documentElement, fn = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!fn) return fullscreenRefused();
  try {
    const p = fn.call(root, { navigationUI: 'hide' });   // success arrives as fullscreenchange (WebKit returns nothing)
    if (p && typeof p.then === 'function') p.then(null, fullscreenRefused);
  } catch (e) { fullscreenRefused(); }
}
function exitFullscreen() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (!fn) return;
  try { const p = fn.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* already out */ }
}
function toggleFullscreen() { if (fullscreenOn()) exitFullscreen(); else enterFullscreen(); }
const fullscreenLabel = () => (fullscreenOn() ? '⛶ Exit fullscreen' : '⛶ Fullscreen');
function fullscreenButton(cls) { return uiButton(fullscreenLabel(), toggleFullscreen, cls, { 'data-key': 'fullscreen' }); }
function fullscreenChanged() {
  DEVICE.fs = fullscreenOn();
  if (DEVICE.fs) deviceLockLandscape();   // phones: stay landscape while fullscreen
  for (const b of document.querySelectorAll('[data-key="fullscreen"]')) b.textContent = fullscreenLabel();
  deviceRelayoutSoon();
}
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, fullscreenChanged);
for (const ev of ['fullscreenerror', 'webkitfullscreenerror']) document.addEventListener(ev, fullscreenRefused);

// ---------- wake lock ----------
// Keeps the screen on while a fight plays (a pad or a slow one-button match may go seconds without a touch).
function wakeLockUpdate() {
  const want = G_STATE.state === 'play' && SETTINGS.wakeLock !== false && !document.hidden && !G_STATE.sim;
  const api = navigator.wakeLock;
  if (want && !DEVICE.wake && api && typeof api.request === 'function') {
    DEVICE.wake = 'pending';
    let p;
    try { p = api.request('screen'); } catch (e) { DEVICE.wake = null; return; }
    p.then(lock => {
      if (DEVICE.wake !== 'pending') { lock.release().catch(() => {}); return; }   // released again meanwhile
      DEVICE.wake = lock;
      lock.addEventListener('release', () => { if (DEVICE.wake === lock) DEVICE.wake = null; });
    }, () => { DEVICE.wake = null; });
  } else if (!want && DEVICE.wake) {
    const lock = DEVICE.wake;
    DEVICE.wake = null;
    if (lock !== 'pending' && lock.release) lock.release().catch(() => {});
  }
}
on('state', wakeLockUpdate);
document.addEventListener('visibilitychange', wakeLockUpdate);

// ---------- "turn sound on" strip ----------
// Browsers only unlock audio on a real tap or key. A match started from a gamepad had neither, so say what to do.
function soundbarShow() {
  if (document.getElementById('soundbar')) return;
  const bar = el('button', { id: 'soundbar', type: 'button', text: 'Tap the screen or press a key to turn sound on' });
  const gone = () => { bar.remove(); for (const ev of ['pointerup', 'click', 'keydown']) removeEventListener(ev, onInput, true); };
  const onInput = e => { if (e.type === 'keydown' && e.code === 'Escape') return; gone(); };   // Esc isn't a gesture for audio
  for (const ev of ['pointerup', 'click', 'keydown']) addEventListener(ev, onInput, true);
  bar.gone = gone;
  document.body.append(bar);
}
// 80-audio keeps AUDIO_NEED_GESTURE true until a context is running (also after Safari 'interrupted' it).
const soundLocked = () => typeof AUDIO_NEED_GESTURE !== 'undefined' && !AUDIO_FAILED && AUDIO_NEED_GESTURE;
on('state', now => {
  const bar = document.getElementById('soundbar');
  if (now !== 'play') { if (bar) bar.gone(); return; }
  if (G_STATE.sim || G_STATE.demo || DEVICE.lastInput !== 'pad' || !soundLocked()) return;
  soundbarShow();
});

// ---------- menus and settings ----------
function deviceSettingsExtras(node) {
  const S = SETTINGS, groups = node.querySelectorAll('.set-group');
  const touch = node.querySelector('[data-group="devices"]');
  if (touch) {
    const h = touch.querySelector('h3');
    const mode = segField('Touch controls', [['auto', 'Auto'], ['on', 'Always'], ['off', 'Off']], S.touchMode, v => { setSetting('touchMode', v); updateTouchUI(); });
    const hint = el('small', { class: 'hint', text: 'Auto shows the stick and buttons on a touch screen and hides them while you use a keyboard or gamepad.' });
    const wake = toggleField('Keep screen awake', S.wakeLock !== false, v => { setSetting('wakeLock', v); wakeLockUpdate(); }, 'Stops the screen dimming during a fight.');
    if (h) h.after(mode, hint, wake); else touch.prepend(mode, hint, wake);
    if (fullscreenAvailable()) { const links = touch.querySelector('.access-links'); if (links) links.prepend(fullscreenButton()); }
  }
  for (const g of groups) {
    const h = g.querySelector('h3');
    if (!h || h.textContent !== 'Sound') continue;
    g.append(segField('Sound in silent mode', [['play', 'Play'], ['respect', 'Respect switch']], S.silentSwitch, v => { setSetting('silentSwitch', v); audioApplySession(); }),
      el('small', { class: 'hint', text: 'iPhone and iPad: play sound even with the ringer switch on silent.' }));
  }
}

on('boot', () => {
  if (typeof SCREENS !== 'undefined') {
    const settings = SCREENS.settings, menu = SCREENS.menu;
    if (typeof settings === 'function') SCREENS.settings = () => {
      const node = settings();
      try { deviceSettingsExtras(node); } catch (e) { report(e, 'device settings'); }
      return node;
    };
    if (typeof menu === 'function') SCREENS.menu = () => {
      const node = menu();
      try { const foot = node.querySelector('.title-foot'); if (foot && fullscreenAvailable()) foot.append(fullscreenButton('fs-btn')); } catch (e) { report(e, 'device menu'); }
      return node;
    };
  }
  if (typeof buildPause === 'function') {
    const pause = buildPause;
    buildPause = function () {
      const node = pause();
      try { const list = node.querySelector('.menu-list'); if (list && fullscreenAvailable()) list.append(fullscreenButton()); } catch (e) { report(e, 'device pause'); }
      return node;
    };
  }
  if (window.SC) { DEVICE.touchWanted = touchWanted; window.SC.device = DEVICE; }
});
