// 92-access.js: accessibility options (Settings → Accessibility).
// - SETTINGS.cbPalette ('off' | 'deutan' | 'protan' | 'tritan'): safe fighter/team colours plus a shape marker on
//   each HUD card (and a health-bar pattern) and above each head, so nobody relies on colour alone.
// - SETTINGS.reduceFlash (default: the OS reduce-motion preference): flashes x.35, shake x.25, no strobing arenas
//   (60-61, 63-64 read it); 84-postfx and 87-juice also tone down bloom, K.O. flashes and chroma.
// - SETTINGS.oneButtonSlots (seats 0-7; the v3.0 SETTINGS.oneButton 'p1' | 'p2' | 'both' still counts): walks to the
//   nearest foe and hops by itself; the one button (attack or jump) attacks, hold = block, double-tap = super if
//   full, else a skill, else a throwable. Toggled per seat in Settings or on the lobby cards (93-pads).
// - SETTINGS.practiceSpeed (.25..1): slows solo play (one human), never Ranked.

const ACCESS_DEFAULTS = { cbPalette: 'off', oneButton: 'off', oneButtonSlots: [], practiceSpeed: 1, rumble: .8, haptics: true,
  reduceFlash: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches };
for (const k in ACCESS_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = ACCESS_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = ACCESS_DEFAULTS[k];
}
// cleanSettings (75) only checks the kind of value: the seat list must also hold whole numbers 0-7, nothing else.
function accessCleanSlots() {
  const v = SETTINGS.oneButtonSlots;
  SETTINGS.oneButtonSlots = Array.isArray(v) ? [...new Set(v.filter(n => Number.isInteger(n) && n >= 0 && n < MAX_FIGHTERS))].sort((a, b) => a - b) : [];
}
accessCleanSlots();

// ---------- colour-blind palettes and markers ----------
// Eight colours each, bright enough for the dark arenas. Deutan/protan avoid red-green pairs (Okabe-Ito based);
// tritan avoids blue-green and yellow-violet pairs. The first two are the two teams.
const CB_PALETTES = {
  deutan: ['#56b4e9', '#ffb000', '#f2f2f2', '#d982b8', '#f0e442', '#3f7bff', '#d55e00', '#9be7ff'],
  protan: ['#56b4e9', '#f0e442', '#f2f2f2', '#d982b8', '#ffb000', '#3f7bff', '#a35c00', '#9be7ff'],
  tritan: ['#ff4a6a', '#2ee6ff', '#f2f2f2', '#ff9ec4', '#00b386', '#a0a0a0', '#ff8a2e', '#8c5cff'],
};
const CB_SHAPES = ['circle', 'triangle', 'square', 'diamond', 'star', 'cross', 'hexagon', 'ring'];
const CB_PARTY_ORIG = typeof PARTY_TEAMS !== 'undefined' ? PARTY_TEAMS.map(t => ({ color: t.color, shades: t.shades.slice() })) : [];
const cbPalette = () => CB_PALETTES[SETTINGS.cbPalette] || null;
const cbOn = () => !!cbPalette();

// Party team colours (flags, goals, zones) follow the palette; restored when it is turned off.
function cbPatchTeams() {
  const pal = cbPalette();
  CB_PARTY_ORIG.forEach((o, t) => {
    PARTY_TEAMS[t].color = pal ? pal[t] : o.color;
    PARTY_TEAMS[t].shades = pal ? [pal[t], pal[t], pal[t], pal[t]] : o.shades.slice();
  });
}
// In team modes everyone on a team shares its colour and marker; otherwise each fighter has its own.
const cbTeamMode = roster => new Set(roster.map(r => r.team)).size < roster.length;
function cbApply(roster) {
  const pal = cbPalette();
  if (!pal) return;
  const teams = cbTeamMode(roster);
  roster.forEach((r, i) => { r.color = pal[(teams ? r.team : i) % pal.length]; });
}
function cbMarkIndex(f) {
  const id = f.summon && f.owner ? f.owner.id : f.id;
  return (G_STATE.roster.length && cbTeamMode(G_STATE.roster) ? f.team : id) % CB_SHAPES.length;
}

// A white shape with a dark rim, radius r, centred on (x, y).
function cbShape(c2, i, x, y, r) {
  const shape = CB_SHAPES[i % CB_SHAPES.length], pts = (n, rot, k = 1) => Array.from({ length: n }, (_, j) => {
    const a = rot + j * TAU / n, rr = k !== 1 && j % 2 ? r * k : r;
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
  });
  c2.save();
  c2.fillStyle = '#ffffff'; c2.strokeStyle = 'rgba(7,8,15,.9)'; c2.lineWidth = 2; c2.lineJoin = 'round';
  c2.beginPath();
  if (shape === 'circle') c2.arc(x, y, r, 0, TAU);
  else if (shape === 'ring') { c2.arc(x, y, r, 0, TAU); c2.arc(x, y, r * .45, 0, TAU, true); }
  else if (shape === 'square') c2.rect(x - r * .85, y - r * .85, r * 1.7, r * 1.7);
  else if (shape === 'cross') for (const [w, h] of [[r * 2, r * .7], [r * .7, r * 2]]) c2.rect(x - w / 2, y - h / 2, w, h);
  else {
    const p = shape === 'triangle' ? pts(3, -Math.PI / 2) : shape === 'diamond' ? pts(4, 0) : shape === 'star' ? pts(10, -Math.PI / 2, .45) : pts(6, 0);
    p.forEach(([px, py], j) => (j ? c2.lineTo(px, py) : c2.moveTo(px, py))); c2.closePath();
  }
  c2.stroke(); c2.fill('evenodd');
  c2.restore();
}
// Health-bar pattern: plain, stripes, dots or bars, so two similar colours still look different.
function cbPattern(c2, kind, x, y, w, h) {
  c2.fillStyle = 'rgba(7,8,15,.32)';
  if (kind === 1) for (let k = -h; k < w; k += 9) { c2.beginPath(); c2.moveTo(x + k, y + h); c2.lineTo(x + k + h, y); c2.lineTo(x + k + h + 3, y); c2.lineTo(x + k + 3, y + h); c2.fill(); }
  else if (kind === 2) for (let k = 4; k < w; k += 8) for (let j = 3; j < h; j += 6) c2.fillRect(x + k, y + j, 2, 2);
  else if (kind === 3) for (let k = 3; k < w; k += 10) c2.fillRect(x + k, y, 3, h);
}
// Called by drawCard / drawCompactCard (85-render) right after the health bar is filled.
function accessCardMark(f, x, y, w, h, right) {
  if (!cbOn()) return;
  const i = cbMarkIndex(f), fw = w * clamp(f.hp / f.maxHp, 0, 1);
  ctx.save(); ctx.beginPath(); ctx.rect(right ? x + w - fw : x, y, fw, h); ctx.clip();
  cbPattern(ctx, i % 4, x, y, w, h);
  ctx.restore();
  cbShape(ctx, i, right ? x + w - h * .6 : x + h * .6, y + h / 2, h * .36);
}
// Called by drawTags (85-render): the marker floats above every fighter's head.
function accessTagMark(f, x, y) {
  if (!cbOn() || G_STATE.demo || fighterAlpha(f) < .3) return;
  cbShape(ctx, cbMarkIndex(f), x, y - 34, 7);
}

// ---------- reduce flashing ----------
const accessBaseFlash = flashScreen;
flashScreen = function (color, alpha = .3) { accessBaseFlash(color, SETTINGS.reduceFlash ? alpha * .35 : alpha); };
const accessBaseApply = applySettings;
applySettings = function () {
  accessBaseApply();
  if (typeof FX !== 'undefined' && SETTINGS.reduceFlash) FX.shakeMul *= .25;
};

// ---------- practice speed ----------
// The slowest speed used during this match: coins and XP scale by it (accessRewardMul, read by 75/79).
const ACCESS_MATCH = { minSpeed: 1 };
on('matchStart', () => { ACCESS_MATCH.minSpeed = 1; });
// Read by advance() (99-main) on top of the menu's game speed. Solo play only (one human), never Ranked or the demo.
function accessSpeedMul() {
  const g = G_STATE, s = +SETTINGS.practiceSpeed || 1;
  if (s >= 1 || g.demo || !g.mode || g.mode.key === 'ranked' || humanCount() !== 1) return 1;
  const m = clamp(s, .25, 1);
  if (m < ACCESS_MATCH.minSpeed) ACCESS_MATCH.minSpeed = m;
  return m;
}
// A slowed-down match still earns something: 20% at quarter speed, the full reward at normal speed.
function accessRewardMul() { return .2 + .8 * clamp(ACCESS_MATCH.minSpeed, 0, 1); }

// ---------- one-button mode ----------
const ONE = Array.from({ length: MAX_FIGHTERS }, () => ({ held: false, downAt: 0, upAt: 0, taps: 0, jumpUntil: 0, stuck: 0 }));
const ONE_HOLD_MS = 230, ONE_DOUBLE_MS = 300;
function oneButtonOn(slot) {
  const list = SETTINGS.oneButtonSlots;
  if (Array.isArray(list) && list.includes(slot)) return true;
  const v = SETTINGS.oneButton;        // the v3.0 setting, still honoured
  return v === 'both' ? slot <= 1 : v === 'p1' ? slot === 0 : v === 'p2' ? slot === 1 : false;
}
// Flips one-button mode for one seat; the v3.0 'p1' / 'p2' / 'both' value is first turned into seats.
function accessToggleSlot(slot) {
  const legacy = { p1: [0], p2: [1], both: [0, 1] }[SETTINGS.oneButton] || [];
  const list = new Set([...(Array.isArray(SETTINGS.oneButtonSlots) ? SETTINGS.oneButtonSlots : []), ...legacy]);
  if (list.has(slot)) list.delete(slot); else list.add(slot);
  if (SETTINGS.oneButton !== 'off') setSetting('oneButton', 'off');
  setSetting('oneButtonSlots', [...list].sort((a, b) => a - b));
  if (typeof touchLayout === 'function') touchLayout();
}
function accessClearSlots() {
  if (SETTINGS.oneButton !== 'off') setSetting('oneButton', 'off');
  setSetting('oneButtonSlots', []);
  if (typeof touchLayout === 'function') touchLayout();
}
// Runs after readHuman read the real buttons: turns them into the one button and drives everything else.
function oneButtonDrive(f, now = performance.now()) {
  const st = ONE[f.slot] || ONE[0], inp = f.inp, down = inp.attackHeld || inp.jumpHeld;
  inp.jump = false;                                   // jumping is automatic
  if (down && !st.held) oneButtonPress(f, st, now);
  if (!down && st.held) st.upAt = now;
  st.held = down;
  inp.blockHeld = down && now - st.downAt > ONE_HOLD_MS;
  inp.attackHeld = down && !inp.blockHeld;
  oneAutoMove(f, st, now);
  inp.jumpHeld = now < st.jumpUntil;
}
// A press attacks; a second one right after a short tap is the special (super, a skill or a throwable).
function oneButtonPress(f, st, now) {
  const double = st.taps === 1 && now - st.upAt < ONE_DOUBLE_MS && st.upAt - st.downAt < ONE_HOLD_MS;
  st.downAt = now;
  if (f.heldBy) { f.inp.mash = true; return; }
  if (!double) { f.inp.attack = true; st.taps = 1; return; }
  st.taps = 0; f.inp.attack = false;
  const skill = [0, 1].find(k => f.skills[k] && f.skillCd[k] <= 0);
  if (f.super >= 100) f.inp.super = true;
  else if (skill !== undefined) f.inp['skill' + (skill + 1)] = true;
  else if (f.throwN[0] + f.throwN[1] > 0) f.inp.throw = true;
}

// Walk to fighting range of the nearest foe; hop onto a platform it stands on, over a blocker or across a hazard.
function oneAutoMove(f, st, now) {
  const inp = f.inp, foe = nearestEnemy(f, false);
  if (!foe || f.heldBy || G_STATE.lock > 0) { inp.mx = 0; return; }
  const x = f.P[2].x, dx = foe.P[2].x - x, dy = foe.P[2].y - f.P[2].y, dir = Math.sign(dx) || f.face;
  const reach = f.w.ranged ? 260 : 40 + (f.tip != null && f.P[f.tip] ? dist(f.P[6], f.P[f.tip]) : 30);
  inp.mx = Math.abs(dx) > reach ? dir : f.w.ranged && Math.abs(dx) < 120 ? -dir : 0;
  if (!f.grounded || now < st.jumpUntil) return;
  const feet = feetY(f), ahead = x + dir * 60;
  const noFloor = inp.mx && groundBelow(ahead, feet - 20) == null;
  const hazard = inp.mx && MAP.hazards.some(hz => inRect(ahead, feet - 6, hz, 8));
  st.stuck = inp.mx && Math.abs(vx(f.P[2])) < 40 ? st.stuck + 1 : 0;
  if (noFloor && dy > -40) inp.mx = 0;                // don't walk off a ledge unless the foe is up there
  if ((dy < -90 && Math.abs(dx) < 300) || hazard || st.stuck > 14 || (noFloor && dy <= -40)) oneJump(f, st, now);
}
function oneJump(f, st, now) { f.inp.jump = true; st.jumpUntil = now + 260; st.stuck = 0; }

// ---------- settings screen ----------
// A percent slider with its own range (sliderField in 95-ui is always 0-100%).
function accessRange(label, value, min, max, onset, hint) {
  const out = el('output', { text: Math.round(value * 100) + '%' });
  const input = el('input', { type: 'range', min, max, step: 5, value: Math.round(value * 100), 'aria-label': label, 'data-key': label,
    oninput: e => { out.textContent = e.target.value + '%'; onset(e.target.value / 100); } });
  return el('div', { class: 'field' }, el('span', { class: 'lbl', text: label }), el('div', { class: 'slider' }, input, out),
    hint ? el('small', { class: 'hint', text: hint }) : null);
}
const accessSet = k => v => { setSetting(k, v); if (typeof touchLayout === 'function') touchLayout(); };

// One-button mode as a chip per seat (any mix of P1..P8) plus Off.
function accessOneButtonField() {
  const seats = Array.from({ length: MAX_FIGHTERS }, (_, i) => i), any = seats.some(oneButtonOn);
  const chip = (key, on, text, act) => el('button', { 'aria-pressed': String(on), 'data-key': key, onclick: () => { act(); uiSfx('click'); refreshScreen(); } }, text);
  return el('div', { class: 'field' }, el('span', { class: 'lbl', text: 'One-button mode' }),
    el('div', { class: 'seg', role: 'group', 'aria-label': 'One-button mode' },
      chip('onebtn-off', !any, 'Off', accessClearSlots),
      seats.map(i => chip('onebtn-' + i, oneButtonOn(i), 'P' + (i + 1), () => accessToggleSlot(i)))));
}

function accessSettingsGroups() {
  const S = SETTINGS, set = accessSet;
  return [
    el('section', { class: 'set-group', 'data-group': 'access' }, el('h3', { text: 'Accessibility' }),
      segField('Colour-blind palette', [['off', 'Off'], ['deutan', 'Deutan'], ['protan', 'Protan'], ['tritan', 'Tritan']], S.cbPalette, set('cbPalette')),
      el('small', { class: 'hint', text: 'Safe team and fighter colours, plus a shape marker on every HUD card and above each fighter. From the next match.' }),
      toggleField('Reduce flashing', !!S.reduceFlash, set('reduceFlash'), 'Softer flashes, little shake, no strobing lightning or flickering lights.'),
      accessOneButtonField(),
      el('small', { class: 'hint', text: 'Per player: walks and jumps for you. Press = attack, hold = block, double-tap = super or skill. Also on the lobby cards.' }),
      accessRange('Practice speed', S.practiceSpeed, 25, 100, set('practiceSpeed'), 'Slows the game in solo modes and Training. Never in Ranked.')),
    el('section', { class: 'set-group', 'data-group': 'devices' }, el('h3', { text: 'Touch, pads & progress' }),
      sliderField('Rumble & haptics', S.rumble, set('rumble')),
      toggleField('Phone haptics', S.haptics !== false, set('haptics'), 'Taps you feel on hits, K.O.s and parries (phones and the app).'),
      accessRange('Touch button size', S.touchSize, 70, 140, set('touchSize')),
      accessRange('Touch button opacity', S.touchAlpha, 20, 100, set('touchAlpha')),
      segField('Stick pulled down', [['block', 'Block'], ['grab', 'Grab'], ['off', 'Nothing']], S.touchDown, set('touchDown')),
      toggleField('Swipe gestures', S.touchSwipe !== false, set('touchSwipe'), 'Right side: tap attacks, swipe up jumps, sideways dashes, down grabs.'),
      el('div', { class: 'access-links' },
        uiButton('Gamepad buttons…', () => openScreen('padmap', UI.screen)),
        uiButton('Transfer progress…', () => openScreen('transfer', UI.screen)))),
  ];
}

// The pause card gets a speed slider whenever practice speed can apply (Training and other solo matches).
function accessPauseExtras(card) {
  const g = G_STATE;
  if (!g.mode || g.mode.key === 'ranked' || humanCount() !== 1) return card;
  const list = card.querySelector('.menu-list');
  if (list) list.after(accessRange('Game speed', SETTINGS.practiceSpeed, 25, 100, accessSet('practiceSpeed')));
  return card;
}

on('boot', () => {
  accessCleanSlots();
  if (typeof SCREENS === 'undefined' || typeof SCREENS.settings !== 'function') return;
  const build = SCREENS.settings;
  SCREENS.settings = () => {
    const node = build();
    try { node.querySelector('.set-grid').append(...accessSettingsGroups()); } catch (e) { report(e, 'access settings'); }
    return node;
  };
  const pause = buildPause;
  buildPause = () => accessPauseExtras(pause());
});
