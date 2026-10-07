// 86-photo.js: photo mode. From the pause menu: the fight stays frozen while a free camera pans (drag, WASD/arrows)
// and zooms (wheel, +/-), the HUD hides, a filter (neon, noir, sepia, vapor) and a frame can be added, and the view is
// saved as a PNG. It runs as G_STATE.state 'photo' with G_STATE.override set, so the world never steps.
// Touch: one finger pans, two fingers pinch to zoom. Saving hands the PNG to hlDeliver (89): Share… where the
// browser has a share sheet, Download, and a preview to long-press, because embedded viewers block downloads.
// Safari has no canvas filter, so the chosen filter is baked per pixel there (photoBakeFilter).

const PHOTO_FILTERS = {
  none: { name: 'None', css: '' },
  neon: { name: 'Neon', css: 'saturate(1.9) contrast(1.12) brightness(1.06)' },
  noir: { name: 'Noir', css: 'grayscale(1) contrast(1.4) brightness(.95)' },
  sepia: { name: 'Sepia', css: 'sepia(.9) contrast(1.05) brightness(1.02)' },
  vapor: { name: 'Vapor', css: 'hue-rotate(-28deg) saturate(1.5) contrast(1.05)' },
};
const PHOTO_FRAMES = ['none', 'neon', 'polaroid', 'cinema'];
const PHOTO = { on: false, x: W / 2, y: H / 2, z: 1, hud: false, filter: 'none', frame: 'none', keys: new Set(),
  drag: null, bar: null, saved: null, last: null, bake: '' };
const PHOTO_PTS = new Map();   // pointerId -> { x, y }: fingers (or the mouse) down on the picture

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
  PHOTO.bake = '';
  if (css) { if ('filter' in g) g.filter = css; else PHOTO.bake = css; }   // Safari: no canvas filter, bake it below
  g.drawImage(cv, VIEW.vx, VIEW.vy, vw, vh, 0, 0, vw, vh);
  const b = BLOOM.cv;
  if (b && b.style.display !== 'none') {
    const sx = b.width / cv.width;
    g.globalCompositeOperation = 'screen';
    g.drawImage(b, VIEW.vx * sx, VIEW.vy * sx, vw * sx, vh * sx, 0, 0, vw, vh);
  }
  if (PHOTO.bake) {
    try { const id = g.getImageData(0, 0, vw, vh); photoBakeFilter(id, PHOTO.bake); g.putImageData(id, 0, 0); } catch (e) { report(e, 'photo filter'); }
  }
  const name = 'stick-clash-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
  const done = blob => {
    PHOTO.last = { w: vw, h: vh, bytes: blob ? blob.size : 0, name };
    if (!blob) return fxModal('Could not save', el('p', { text: 'This browser could not turn the picture into a PNG.' }));
    hlDeliver(blob, name, 'png');   // 89-replays: share sheet, download and preview
  };
  try { out.toBlob(done, 'image/png'); } catch (e) { report(e, 'photo save'); done(null); }
}

// ---------- baking a CSS filter into pixels ----------
// Each filter function is a 3x4 colour matrix (3 rows: r g b in, plus an offset); they multiply in CSS order.
const PHOTO_IDENT = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
function photoFilterMatrix(name, v) {
  const m = PHOTO_IDENT();
  if (name === 'brightness') { m[0] = m[5] = m[10] = v; }
  else if (name === 'contrast') { m[0] = m[5] = m[10] = v; m[3] = m[7] = m[11] = .5 - .5 * v; }
  else if (name === 'saturate') {
    const s = v;
    return [.213 + .787 * s, .715 - .715 * s, .072 - .072 * s, 0, .213 - .213 * s, .715 + .285 * s, .072 - .072 * s, 0, .213 - .213 * s, .715 - .715 * s, .072 + .928 * s, 0];
  } else if (name === 'grayscale') {
    const k = 1 - v;
    return [.2126 + .7874 * k, .7152 - .7152 * k, .0722 - .0722 * k, 0, .2126 - .2126 * k, .7152 + .2848 * k, .0722 - .0722 * k, 0, .2126 - .2126 * k, .7152 - .7152 * k, .0722 + .9278 * k, 0];
  } else if (name === 'sepia') {
    const k = 1 - v;
    return [.393 + .607 * k, .769 - .769 * k, .189 - .189 * k, 0, .349 - .349 * k, .686 + .314 * k, .168 - .168 * k, 0, .272 - .272 * k, .534 - .534 * k, .131 + .869 * k, 0];
  } else if (name === 'hue-rotate') {
    const c = Math.cos(v), s = Math.sin(v);
    return [.213 + c * .787 - s * .213, .715 - c * .715 - s * .715, .072 - c * .072 + s * .928, 0,
      .213 - c * .213 + s * .143, .715 + c * .285 + s * .14, .072 - c * .072 - s * .283, 0,
      .213 - c * .213 - s * .787, .715 - c * .715 + s * .715, .072 + c * .928 + s * .072, 0];
  }
  return m;
}
// B after A (B rows x A's 3x3 part; B's rows also take A's offset).
function photoMatrixMul(B, A) {
  const out = PHOTO_IDENT();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    let v = c === 3 ? B[r * 4 + 3] : 0;
    for (let k = 0; k < 3; k++) v += B[r * 4 + k] * A[k * 4 + c];
    out[r * 4 + c] = v;
  }
  return out;
}
// Parses 'saturate(1.9) contrast(1.12) hue-rotate(-28deg) …' into one matrix and applies it to every pixel in place.
function photoBakeFilter(imageData, css) {
  let M = PHOTO_IDENT();
  for (const [, name, num, unit] of String(css || '').matchAll(/([a-z-]+)\(\s*(-?[\d.]+)(deg|rad|turn|%)?\s*\)/g)) {
    let v = parseFloat(num);
    if (unit === '%') v /= 100; else if (unit === 'deg') v *= Math.PI / 180; else if (unit === 'turn') v *= TAU;
    M = photoMatrixMul(photoFilterMatrix(name, v), M);
  }
  const d = imageData.data, k = 1 / 255;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] * k, g = d[i + 1] * k, b = d[i + 2] * k;
    d[i] = clamp((M[0] * r + M[1] * g + M[2] * b + M[3]) * 255, 0, 255);
    d[i + 1] = clamp((M[4] * r + M[5] * g + M[6] * b + M[7]) * 255, 0, 255);
    d[i + 2] = clamp((M[8] * r + M[9] * g + M[10] * b + M[11]) * 255, 0, 255);
  }
  return imageData;
}

// Starts a download; silently does nothing where downloads are blocked (the caller also shows a preview).
function fxDownload(url, name) {
  try {
    const a = el('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
  } catch (e) { /* blocked: the preview is the fallback */ }
}

// A small dialog above everything (photo previews, export results). Closes on Esc, Enter or a click outside, and on
// any of its buttons: actions = [{ text, cls, key, onclick, keep }] (keep: the dialog stays open after that click).
function fxModalActions(title, actions, ...body) {
  const close = () => { if (!wrap.isConnected) return; wrap.remove(); removeEventListener('keydown', onKey, true); wrap.dispatchEvent(new Event('fxclose')); };
  const onKey = e => { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  const buttons = (actions || []).map(a => el('button', { class: a.cls || null, 'data-key': a.key || null,
    onclick: () => { try { if (a.onclick) a.onclick(); } finally { if (!a.keep) close(); } } }, a.text));
  const wrap = el('div', { class: 'fx-modal', onclick: e => { if (e.target === wrap) close(); } },
    el('div', { class: 'card' }, el('h2', { text: title }), body, buttons.length ? el('div', { class: 'fx-actions' }, buttons) : null));
  wrap.fxClose = close;
  document.body.append(wrap);
  addEventListener('keydown', onKey, true);
  const first = wrap.querySelector('.go') || buttons[0];
  if (first) first.focus();
  return wrap;
}
function fxModal(title, ...body) { return fxModalActions(title, [{ text: 'OK', cls: 'go' }], ...body); }
function fxModalClose(wrap) { if (wrap && typeof wrap.fxClose === 'function') wrap.fxClose(); }

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

// Drag to pan, wheel to zoom (anywhere but the toolbar); two fingers pinch to zoom and pan around their midpoint.
const photoOnPicture = e => PHOTO.on && !(PHOTO.bar && PHOTO.bar.contains(e.target)) && !(e.target && e.target.closest && e.target.closest('.fx-modal'));
addEventListener('pointerdown', e => {
  if (!photoOnPicture(e)) return;
  PHOTO_PTS.set(e.pointerId, { x: e.clientX, y: e.clientY });
  PHOTO.drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointermove', e => {
  const prev = PHOTO_PTS.get(e.pointerId);
  if (!PHOTO.on || !prev) return;
  const k = VIEW.dpr / (VIEW.s * PHOTO.z), dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  const other = e.pointerType === 'touch' ? [...PHOTO_PTS].find(([id]) => id !== e.pointerId) : null;
  if (other) {   // pinch: the distance to the other finger sets the zoom, their midpoint drags the view
    const o = other[1], before = Math.hypot(prev.x - o.x, prev.y - o.y), after = Math.hypot(e.clientX - o.x, e.clientY - o.y);
    PHOTO.x -= dx / 2 * k; PHOTO.y -= dy / 2 * k;
    if (before > 8 && after > 8) photoZoom(after / before);
  } else { PHOTO.x -= dx * k; PHOTO.y -= dy * k; }
  prev.x = e.clientX; prev.y = e.clientY;
  PHOTO.drag = { x: e.clientX, y: e.clientY };
});
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, e => { PHOTO_PTS.delete(e.pointerId); if (!PHOTO_PTS.size) PHOTO.drag = null; });
addEventListener('blur', () => { PHOTO_PTS.clear(); PHOTO.drag = null; });
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
  // Safari's own pinch (page zoom) must not fire while two fingers zoom the picture.
  addEventListener('gesturestart', e => { if (PHOTO.on) e.preventDefault(); }, { passive: false });
  if (window.SC) window.SC.photo = { state: PHOTO, enter: photoEnter, exit: photoExit, save: photoSave, bake: photoBakeFilter };
});
