// 86-photo.js: photo mode. From the pause menu: the fight stays frozen while a free camera pans (drag, WASD/arrows)
// and zooms (wheel, +/-), the HUD hides, a filter (neon, noir, sepia, vapor) and a frame can be added, and the view is
// saved as a PNG. It runs as G_STATE.state 'photo' with G_STATE.override set, so the world never steps.
// Downloads are blocked inside some embedded viewers (e.g. the artifact viewer), so the saved picture is also shown
// in a preview the player can right-click or long-press to save.

const PHOTO_FILTERS = {
  none: { name: 'None', css: '' },
  neon: { name: 'Neon', css: 'saturate(1.9) contrast(1.12) brightness(1.06)' },
  noir: { name: 'Noir', css: 'grayscale(1) contrast(1.4) brightness(.95)' },
  sepia: { name: 'Sepia', css: 'sepia(.9) contrast(1.05) brightness(1.02)' },
  vapor: { name: 'Vapor', css: 'hue-rotate(-28deg) saturate(1.5) contrast(1.05)' },
};
const PHOTO_FRAMES = ['none', 'neon', 'polaroid', 'cinema'];
const PHOTO = { on: false, x: W / 2, y: H / 2, z: 1, hud: false, filter: 'none', frame: 'none', keys: new Set(),
  drag: null, bar: null, saved: null, last: null };

const photoHidesHud = () => PHOTO.on && !PHOTO.hud;

function photoEnter() {
  if (G_STATE.state !== 'paused') return;
  Object.assign(PHOTO, { on: true, x: CAM.x, y: CAM.y, z: CAM.z, saved: { x: CAM.x, y: CAM.y, z: CAM.z } });
  PHOTO.keys.clear();
  G_STATE.override = photoUpdate;
  setState('photo');
  photoBar().hidden = false;
  photoApplyFilter();
}

function photoExit() {
  if (!PHOTO.on) return;
  photoCleanup();
  setState('paused');
}

// Puts everything back (also when something else moved the game out of photo mode).
function photoCleanup() {
  PHOTO.on = false;
  if (G_STATE.override === photoUpdate) G_STATE.override = null;
  if (PHOTO.saved) Object.assign(CAM, PHOTO.saved);
  if (PHOTO.bar) { PHOTO.bar.hidden = true; PHOTO.bar.classList.remove('min'); }
  PHOTO.filter = 'none'; photoApplyFilter();
}
on('state', (now, before) => { if (before === 'photo' && PHOTO.on) photoCleanup(); });

// Replaces the world step while photo mode is on: only the free camera moves.
function photoUpdate(dt) {
  const k = PHOTO.keys, pan = 520 * dt / PHOTO.z;
  if (k.has('left')) PHOTO.x -= pan;
  if (k.has('right')) PHOTO.x += pan;
  if (k.has('up')) PHOTO.y -= pan;
  if (k.has('down')) PHOTO.y += pan;
  if (k.has('in')) photoZoom(Math.exp(dt * 1.6));
  if (k.has('out')) photoZoom(Math.exp(-dt * 1.6));
}

function photoZoom(f) { PHOTO.z = clamp(PHOTO.z * f, VIEW.zMin, 4); }

// Called at the top of updateCamera (85): returns true while photo mode owns the camera.
function photoCamera() {
  if (!PHOTO.on) return false;
  PHOTO.z = Math.max(PHOTO.z, VIEW.zMin);
  const hw = W / (2 * PHOTO.z), hh = VIEW.hv / (2 * PHOTO.z);
  PHOTO.x = clamp(PHOTO.x, hw, W - hw); PHOTO.y = clamp(PHOTO.y, hh, H - hh);
  Object.assign(CAM, { x: PHOTO.x, y: PHOTO.y, z: PHOTO.z, punch: 0 });
  return true;
}

// ---------- filters and frames ----------
function photoApplyFilter() {
  const css = (PHOTO_FILTERS[PHOTO.filter] || PHOTO_FILTERS.none).css;
  cv.style.filter = css;
  const b = document.getElementById('bloom');
  if (b) b.style.filter = css;
}

// Screen-space extras that belong in the picture: the vapor gradient and the chosen frame.
function photoDrawScreen(c2) {
  if (!PHOTO.on) return;
  const y0 = VIEW.top, h = VIEW.hv;
  if (PHOTO.filter === 'vapor') {
    const g = c2.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, 'rgba(255,90,209,.22)'); g.addColorStop(1, 'rgba(46,230,255,.18)');
    c2.save(); c2.globalCompositeOperation = 'screen'; c2.fillStyle = g; c2.fillRect(0, y0, W, h); c2.restore();
  }
  if (PHOTO.frame === 'cinema') { c2.fillStyle = '#000'; c2.fillRect(0, y0, W, h * .12); c2.fillRect(0, y0 + h * .88, W, h * .12); }
  else if (PHOTO.frame === 'polaroid') photoPolaroid(c2, y0, h);
  else if (PHOTO.frame === 'neon') {
    c2.lineWidth = 6;
    glow(c2, '#ff5ad1', 22, () => { c2.strokeStyle = '#ff5ad1'; c2.strokeRect(18, y0 + 18, W - 36, h - 36); });
    photoCaption(c2, W - 40, y0 + h - 40, 'right', '#2ee6ff');
  }
}
function photoPolaroid(c2, y0, h) {
  c2.fillStyle = '#f4f1e8';
  c2.fillRect(0, y0, W, 22); c2.fillRect(0, y0, 22, h); c2.fillRect(W - 22, y0, 22, h); c2.fillRect(0, y0 + h - 86, W, 86);
  photoCaption(c2, W / 2, y0 + h - 42, 'center', '#2a2d3e');
}
function photoCaption(c2, x, y, align, color) {
  c2.font = `24px ${FONT_DISPLAY}`; c2.textAlign = align; c2.textBaseline = 'middle'; c2.fillStyle = color;
  const map = MAP && MAP.name ? ' · ' + MAP.name.toUpperCase() : '';
  c2.fillText('STICK CLASH' + map, x, y);
}

// ---------- saving ----------
// Renders a fresh frame (bloom included, drawn in the same task so the WebGL canvas can still be read), crops the
// arena viewport, bakes the filter in and offers it as a PNG download plus an on-screen preview.
function photoSave() {
  render(0);
  const vw = Math.round(VIEW.vw), vh = Math.round(VIEW.vh), out = document.createElement('canvas');
  out.width = vw; out.height = vh;
  const g = out.getContext('2d'), css = (PHOTO_FILTERS[PHOTO.filter] || PHOTO_FILTERS.none).css;
  if (css && 'filter' in g) g.filter = css;
  g.drawImage(cv, VIEW.vx, VIEW.vy, vw, vh, 0, 0, vw, vh);
  const b = BLOOM.cv;
  if (b && b.style.display !== 'none') {
    const sx = b.width / cv.width;
    g.globalCompositeOperation = 'screen';
    g.drawImage(b, VIEW.vx * sx, VIEW.vy * sx, vw * sx, vh * sx, 0, 0, vw, vh);
  }
  const name = 'stick-clash-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
  const done = blob => {
    PHOTO.last = { w: vw, h: vh, bytes: blob ? blob.size : 0, name };
    if (!blob) return fxModal('Could not save', el('p', { text: 'This browser could not turn the picture into a PNG.' }));
    const url = URL.createObjectURL(blob);
    fxDownload(url, name);
    fxModal('Photo saved', el('img', { src: url, alt: 'Your photo', class: 'fx-preview' }),
      el('p', { class: 'hint', text: 'If no download started (some embedded viewers block downloads), right-click or long-press the picture and save it.' }));
  };
  try { out.toBlob(done, 'image/png'); } catch (e) { report(e, 'photo save'); done(null); }
}

// Starts a download; silently does nothing where downloads are blocked (the caller also shows a preview).
function fxDownload(url, name) {
  try {
    const a = el('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
  } catch (e) { /* blocked: the preview is the fallback */ }
}

// A small dialog above everything (photo previews, export results). Closes on its button, Esc or a click outside.
function fxModal(title, ...body) {
  const close = () => { wrap.remove(); removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  const wrap = el('div', { class: 'fx-modal', onclick: e => { if (e.target === wrap) close(); } },
    el('div', { class: 'card' }, el('h2', { text: title }), body, el('button', { class: 'go', onclick: close }, 'OK')));
  document.body.append(wrap);
  addEventListener('keydown', onKey, true);
  wrap.querySelector('.go').focus();
  return wrap;
}

// ---------- toolbar ----------
function photoBar() {
  if (PHOTO.bar) return PHOTO.bar;
  const seg = (label, list, key, names) => el('div', { class: 'pb-seg' }, el('span', { text: label }), list.map(v => el('button', {
    'data-photo': key + '-' + v, onclick: () => { PHOTO[key] = v; photoApplyFilter(); photoSyncBar(); } }, names ? names(v) : capital(v))));
  PHOTO.bar = el('div', { class: 'photo-bar', hidden: true },
    seg('Filter', Object.keys(PHOTO_FILTERS), 'filter', v => PHOTO_FILTERS[v].name),
    seg('Frame', PHOTO_FRAMES, 'frame'),
    el('div', { class: 'pb-seg' },
      el('button', { 'data-photo': 'zoom-out', onclick: () => photoZoom(1 / 1.25) }, '−'),
      el('button', { 'data-photo': 'zoom-in', onclick: () => photoZoom(1.25) }, '+'),
      el('button', { 'data-photo': 'hud', onclick: () => { PHOTO.hud = !PHOTO.hud; photoSyncBar(); } }, 'HUD')),
    el('div', { class: 'pb-seg' },
      el('button', { class: 'go', 'data-photo': 'save', onclick: photoSave }, '📷 Save PNG'),
      el('button', { 'data-photo': 'tools', onclick: photoToggleBar }, 'Hide tools'),
      el('button', { 'data-photo': 'exit', onclick: photoExit }, 'Done')),
    el('p', { class: 'hint', text: 'Drag or WASD/arrows to pan · wheel or +/− to zoom · 1–5 filter · F frame · H HUD · Tab tools · Enter save · Esc back' }));
  PHOTO.bar.addEventListener('click', e => { if (PHOTO.bar.classList.contains('min') && e.target === PHOTO.bar) photoToggleBar(); });
  document.body.append(PHOTO.bar);
  photoSyncBar();
  return PHOTO.bar;
}
// Collapses the toolbar to a small chip so it doesn't cover the shot (Tab or a click on the chip brings it back).
function photoToggleBar() { if (PHOTO.bar) PHOTO.bar.classList.toggle('min'); }
function photoSyncBar() {
  if (!PHOTO.bar) return;
  for (const b of PHOTO.bar.querySelectorAll('[data-photo]')) {
    const [k, v] = b.dataset.photo.split('-');
    b.classList.toggle('sel', (k === 'filter' || k === 'frame') ? PHOTO[k] === v : k === 'hud' && PHOTO.hud);
  }
}

// ---------- input (registered before 90-input, so photo keys never reach the game or the menus) ----------
const PHOTO_KEYS = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down', Equal: 'in', NumpadAdd: 'in', KeyE: 'in', Minus: 'out', NumpadSubtract: 'out', KeyQ: 'out' };
addEventListener('keydown', e => {
  if (!PHOTO.on || e.target.closest && e.target.closest('.fx-modal')) return;
  if (e.code === 'KeyM') return;          // mute still works
  e.preventDefault(); e.stopImmediatePropagation();
  if (PHOTO_KEYS[e.code]) PHOTO.keys.add(PHOTO_KEYS[e.code]);
  if (e.repeat) return;
  const filters = Object.keys(PHOTO_FILTERS), digit = /^Digit([1-5])$/.exec(e.code);
  if (digit) { PHOTO.filter = filters[digit[1] - 1]; photoApplyFilter(); photoSyncBar(); }
  else if (e.code === 'KeyF') { PHOTO.frame = PHOTO_FRAMES[(PHOTO_FRAMES.indexOf(PHOTO.frame) + 1) % PHOTO_FRAMES.length]; photoSyncBar(); }
  else if (e.code === 'KeyH') { PHOTO.hud = !PHOTO.hud; photoSyncBar(); }
  else if (e.code === 'Tab') photoToggleBar();
  else if (e.code === 'Enter' || e.code === 'KeyP') photoSave();
  else if (e.code === 'Escape' || e.code === 'Backspace') photoExit();
}, true);
addEventListener('keyup', e => { if (PHOTO_KEYS[e.code]) PHOTO.keys.delete(PHOTO_KEYS[e.code]); });

// Drag to pan, wheel to zoom (anywhere but the toolbar).
addEventListener('pointerdown', e => {
  if (!PHOTO.on || (PHOTO.bar && PHOTO.bar.contains(e.target)) || e.target.closest('.fx-modal')) return;
  PHOTO.drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointermove', e => {
  if (!PHOTO.on || !PHOTO.drag) return;
  const k = VIEW.dpr / (VIEW.s * PHOTO.z);
  PHOTO.x -= (e.clientX - PHOTO.drag.x) * k; PHOTO.y -= (e.clientY - PHOTO.drag.y) * k;
  PHOTO.drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { PHOTO.drag = null; });
addEventListener('wheel', e => { if (PHOTO.on) photoZoom(Math.exp(-e.deltaY * .0015)); }, { passive: true });
on('pad', a => { if (PHOTO.on && (a === 'pause' || a === 'skill1')) photoExit(); });

// ---------- pause menu button ----------
on('boot', () => {
  if (typeof buildPause !== 'function') return;
  const base = buildPause;
  buildPause = function () {
    const node = base();
    const list = node.querySelector && node.querySelector('.menu-list');
    if (list) list.insertBefore(uiButton('📷 Photo mode', photoEnter, null, { 'data-key': 'photo' }), list.children[1] || null);
    return node;
  };
  if (window.SC) window.SC.photo = { state: PHOTO, enter: photoEnter, exit: photoExit, save: photoSave };
});
