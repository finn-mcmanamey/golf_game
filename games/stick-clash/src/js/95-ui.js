// 95-ui.js: the menu framework (DOM builder, screens, keyboard + gamepad navigation, toasts, coin badge) and the
// title, mode-select and arena-select screens. The loadout screen is in 96-ui-loadout.js; settings, controls, help,
// shop, stats, pause and results are in 97-ui-pages.js. Panels follow G_STATE.state via on('state') (wired in 97).

const UI_ROOT = document.getElementById('ui');
const CAT_NAMES = { blade: 'Blades', heavy: 'Heavy', polearm: 'Polearms', chain: 'Chains', fist: 'Fists', ranged: 'Ranged',
  magic: 'Magic', exotic: 'Exotic', shield: 'Shields' };
const CAT_ICONS = { blade: '🗡', heavy: '🪓', polearm: '🔱', chain: '⛓', fist: '👊', ranged: '🏹', magic: '✨', exotic: '🌀', shield: '🛡' };
const MENU = Object.assign({ mode: 'versus', map: 'random', diff: 'normal', loadouts: [] }, store.get('menu', {}));
const PANELS = {};
const UI = { screen: 'menu', next: null, back: {} };   // current menu screen, a screen to open after the next state change

// Tiny DOM builder: el('button', { class: 'go', text: 'Fight', onclick: fn }, ...children)
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style' && typeof v === 'object') for (const sk in v) e.style.setProperty(sk.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), v[sk]);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) e.append(kid);
  return e;
}
function saveMenu() { store.set('menu', MENU); }
const capital = s => s ? s[0].toUpperCase() + s.slice(1) : '';

// ---------- panels ----------
function makePanel(name) {
  PANELS[name] = el('div', { class: 'overlay', id: name, hidden: true });
  UI_ROOT.append(PANELS[name]);
  return PANELS[name];
}
const activePanel = () => Object.values(PANELS).find(p => !p.hidden) || null;

function showPanel(name) {
  bindStopListening();             // leaving or rebuilding a screen cancels a pending key rebind (97-ui-pages)
  for (const k in PANELS) PANELS[k].hidden = k !== name;
  const p = PANELS[name];
  if (!p) return;
  p.scrollTop = 0;
  const first = p.querySelector('[data-autofocus]') || p.querySelector('.sheet-body .sel') || p.querySelector('.sheet-body button') || p.querySelector('.go, button');
  if (first && !IS_TOUCH) first.focus({ preventScroll: true });
}

// Opens a menu screen: SCREENS[name]() builds its content into the panel of the same name.
const SCREENS = {};
function openScreen(name, backTo) {
  if (!SCREENS[name]) return;
  if (backTo) UI.back[name] = backTo;
  if (!PANELS[name]) makePanel(name);
  UI.screen = name;
  PANELS[name].replaceChildren(SCREENS[name]());
  showPanel(name);
}
function goBack() {
  const name = UI.screen, to = UI.back[name] || 'menu';
  uiSfx('back');
  if (to === 'pause') { PANELS.pause.replaceChildren(buildPause()); UI.screen = 'pause'; showPanel('pause'); return; }
  openScreen(to);
}
// Rebuilds the screen in place, keeping the focused element (by its data-key) and scroll position.
function refreshScreen() {
  const p = PANELS[UI.screen];
  if (!p || p.hidden) return;
  const key = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.key;
  const body = p.querySelector('.sheet-body'), scroll = body ? body.scrollTop : 0;
  p.replaceChildren(SCREENS[UI.screen]());
  if (p.firstChild) p.firstChild.classList.add('still');   // no pop-in animation when only the contents changed
  const nb = p.querySelector('.sheet-body');
  if (nb) nb.scrollTop = scroll;
  const again = key && p.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (again) again.focus({ preventScroll: true });
}

// ---------- shared pieces ----------
function coinBadge() {
  return el('span', { class: 'coins', title: 'Coins: earn them in matches, spend them in the Shop' }, el('i', { 'aria-hidden': 'true' }), el('b', { text: PROFILE.coins.toLocaleString() }));
}
on('coins', total => { for (const b of document.querySelectorAll('.coins b')) b.textContent = total.toLocaleString(); });

// A full-screen sheet: header (back, title, coins), scrolling body, footer buttons.
function sheet(title, body, footer, opts = {}) {
  return el('div', { class: 'sheet' + (opts.cls ? ' ' + opts.cls : '') },
    el('header', { class: 'sheet-head' },
      el('button', { class: 'back', 'aria-label': 'Back', onclick: goBack }, '◂ Back'),
      el('h2', {}, title),
      opts.headExtra || null,
      coinBadge()),
    el('div', { class: 'sheet-body' }, body),
    footer ? el('footer', { class: 'sheet-foot' }, footer) : null);
}
function uiButton(text, onclick, cls, extra = {}) {
  return el('button', Object.assign({ class: cls || null, onclick: e => { uiSfx('click'); onclick(e); } }, extra), text);
}

// ---------- title screen ----------
function quickSummary() {
  const mode = MODES[MENU.mode] || {}, map = MAPS[MENU.map];
  const parts = [mode.name || 'Duel'];
  if (mode.cpu) parts.push(capital(MENU.diff) + ' CPU');
  parts.push(map ? map.name : 'Random arena');
  if (modeUsesRounds(mode)) parts.push(`First to ${SETTINGS.rounds}`);
  return parts.join(' · ');
}

SCREENS.menu = () => {
  const item = (label, sub, onclick, cls) => el('button', { class: 'menu-item' + (cls ? ' ' + cls : ''), onclick: () => { uiSfx('click'); onclick(); } },
    el('span', { class: 'mi-label', text: label }), sub ? el('small', { text: sub }) : null);
  const done = Object.keys(ACHIEVEMENTS).filter(achDone).length;
  return el('div', { class: 'title-wrap' },
    el('div', { class: 'title-col' },
      el('h1', { class: 'logo' }, el('span', { class: 'a' }, 'Stick'), el('span', { class: 'b' }, 'Clash')),
      el('p', { class: 'tag', text: 'Wobbly neon duels with floppy weapons.' }),
      el('nav', { class: 'menu-list', 'aria-label': 'Main menu' },
        item('Quick Fight', quickSummary(), startFromMenu, 'go'),
        item('Play', 'Pick a mode, loadout and arena', () => openScreen('modes', 'menu')),
        typeof questMenuItems === 'function' ? questMenuItems(item) : null,   // Mythic Quest + Challenges (98-campaign-ui)
        item('Shop', `${ownedHats().length - 1}/${listOf(HATS).length - 1} hats · colour packs`, () => openScreen('shop', 'menu')),
        item('Trophies & Stats', `${done}/${Object.keys(ACHIEVEMENTS).length} trophies`, () => openScreen('stats', 'menu')),
        item('Settings', 'Rounds, speed, effects, sound', () => openScreen('settings', 'menu')),
        item('Controls', 'Keys, rebinding, gamepads', () => openScreen('controls', 'menu')),
        item('How to Play', 'Moves, skills, orbs, tips', () => openScreen('howto', 'menu'))),
      el('div', { class: 'title-foot' }, coinBadge(), typeof rankBadge === 'function' ? rankBadge() : null, el('span', { class: 'hint', text: IS_TOUCH ? `v${VERSION}` : `↑↓ choose · Enter select · Esc back · v${VERSION}` }))));
};

// ---------- mode select ----------
const MODE_ICONS = { versus: '⚔', pvp: '👥', watch: '📺', tournament: '🏆', survival: '🌊', bossrush: '👹', team: '🤝', coop: '🎮',
  ffa: '💥', training: '🎯', ohko: '⚡', roulette: '🎰', koth: '⛰' };
function modeIcon(m) { return m.icon || MODE_ICONS[m.key] || '★'; }
function modePlayers(m) {
  const [a, b] = m.players || [1, 1];
  if (!b) return 'Spectate';
  return a === b ? `${a} player${a > 1 ? 's' : ''}` : `${a}–${b} players`;
}

SCREENS.modes = () => {
  const grid = el('div', { class: 'mode-grid' }, listOf(MODES).map(m => el('button', {
    class: 'mode-card' + (m.key === MENU.mode ? ' sel' : ''), 'data-key': 'mode-' + m.key,
    onclick: () => { MENU.mode = m.key; saveMenu(); uiSfx('click'); openScreen(modePickers(m) ? 'loadout' : 'maps', 'modes'); },
  },
  el('span', { class: 'mode-icon', 'aria-hidden': 'true', text: modeIcon(m) }),
  el('strong', { text: m.name }),
  el('p', { text: m.desc || '' }),
  el('span', { class: 'chips' }, el('em', { text: modePlayers(m) }), m.cpu ? el('em', { text: 'vs CPU' }) : null))));
  return sheet('Choose a mode', grid, null);
};
const modePickers = m => clamp(m && m.pickers != null ? m.pickers : 2, 0, 4);

// ---------- arena select ----------
const MAP_THUMBS = {};
// Renders a map's backdrop, hazards and platforms into a small image (cached). MAP is swapped for the duration so
// map drawBg code that reads the live map still works; it all happens synchronously between frames.
function mapThumb(key) {
  if (MAP_THUMBS[key]) return MAP_THUMBS[key];
  const def = MAPS[key], c = document.createElement('canvas');
  c.width = 320; c.height = 180;
  const g = c.getContext('2d'), saved = MAP;
  try {
    MAP = instantiateMap(def);
    g.scale(c.width / W, c.height / H);
    if (typeof MAP.drawBg === 'function') hook(MAP, 'drawBg', g, 3); else drawStdBackground(g, MAP, 3);
    for (const hz of MAP.hazards) drawHazard(g, hz, MAP, 3);
    for (const s of MAP.solids) drawSolid(g, s, MAP, 3);
    hook(MAP, 'drawFg', g, 3);
  } catch (e) { report(e, 'map thumbnail ' + key); }
  finally { MAP = saved; }
  return (MAP_THUMBS[key] = c.toDataURL('image/jpeg', .82));
}

// Thumbnails are drawn one per idle moment after boot so the arena screen opens instantly.
function warmMapThumbs() {
  const todo = listOf(MAPS).map(m => m.key).filter(k => !MAP_THUMBS[k]);
  const next = () => { const k = todo.shift(); if (!k) return; mapThumb(k); later(next); };
  const later = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 60));
  later(next);
}
on('boot', warmMapThumbs);

function mapTile(key, name, desc, img) {
  return el('button', { class: 'map-card' + (MENU.map === key ? ' sel' : ''), 'data-key': 'map-' + key, title: desc,
    onclick: () => { MENU.map = key; saveMenu(); uiSfx('click'); refreshScreen(); } },
  img ? el('img', { src: img, alt: '', loading: 'lazy' }) : el('span', { class: 'map-random', 'aria-hidden': 'true', text: '🎲' }),
  el('strong', { text: name }), el('small', { text: desc }));
}

SCREENS.maps = () => {
  const mode = MODES[MENU.mode] || {};
  const grid = el('div', { class: 'map-grid' },
    mapTile('random', 'Random', 'A different arena every round.', null),
    listOf(MAPS).map(m => mapTile(m.key, m.name, m.desc || '', mapThumb(m.key))));
  const quick = el('div', { class: 'quick-set' },
    modeUsesRounds(mode) ? stepper('Rounds to win', SETTINGS.rounds, 1, 9, v => { SETTINGS.rounds = v; saveSettings(); })
      : el('p', { class: 'hint', text: `${mode.name} sets its own rounds.` }),
    mode.cpu ? diffPicker() : null,
    wxPicker(),                                   // weather (58-world)
    mode.crowd ? stepper('Fighters', crowdSize(mode), mode.crowd[0], mode.crowd[1], v => { (MENU.crowd = MENU.crowd || {})[mode.key] = v; saveMenu(); }) : null,
    uiButton('All settings…', () => openScreen('settings', 'maps'), 'link'));
  // The quick settings live in the footer beside Fight!, so they're visible without scrolling past the arenas.
  return sheet('Choose an arena', grid,
    [uiButton('◂ Back', goBack, 'foot-back'), quick, el('button', { class: 'go', 'data-autofocus': '', onclick: startFromMenu }, 'Fight!')]);
};

// How many fighters a crowd mode (mode.crowd = [min, max, default]) starts with: the menu's choice or its default.
function crowdSize(mode) {
  if (!mode || !mode.crowd) return undefined;
  const [lo, hi, def] = mode.crowd, v = (MENU.crowd || {})[mode.key];
  return clamp(v || def || lo, lo, hi);
}

// CPU level as a segmented control (levels come from AI_LEVELS so new ones appear automatically).
function diffPicker() {
  return segField('CPU level', Object.keys(AI_LEVELS).map(k => [k, capital(k)]), MENU.diff, v => { MENU.diff = v; saveMenu(); });
}

// ---------- small form controls (shared with the settings screen) ----------
function segField(label, options, value, onpick) {
  const group = el('div', { class: 'seg', role: 'group', 'aria-label': label }, options.map(([v, text]) =>
    el('button', { 'aria-pressed': String(v === value), 'data-key': label + '-' + v,
      onclick: () => { onpick(v); uiSfx('click'); refreshScreen(); } }, text)));
  return el('div', { class: 'field' }, el('span', { class: 'lbl', text: label }), group);
}
function stepper(label, value, min, max, onset) {
  const set = v => { onset(clamp(v, min, max)); uiSfx('click'); refreshScreen(); };
  return el('div', { class: 'field' }, el('span', { class: 'lbl', text: label }),
    el('div', { class: 'stepper' },
      el('button', { 'aria-label': 'Less', 'data-key': label + '-minus', disabled: value <= min || null, onclick: () => set(value - 1) }, '−'),
      el('output', { text: String(value) }),
      el('button', { 'aria-label': 'More', 'data-key': label + '-plus', disabled: value >= max || null, onclick: () => set(value + 1) }, '+')));
}
function toggleField(label, value, onset, hint) {
  return el('div', { class: 'field' }, el('span', { class: 'lbl', text: label }),
    el('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!value), 'data-key': label,
      onclick: () => { onset(!value); uiSfx('click'); refreshScreen(); } }, el('i'), el('span', { text: value ? 'On' : 'Off' })),
    hint ? el('small', { class: 'hint', text: hint }) : null);
}
function sliderField(label, value, onset) {
  const out = el('output', { text: Math.round(value * 100) + '%' });
  const input = el('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(value * 100), 'aria-label': label, 'data-key': label,
    oninput: e => { const v = e.target.value / 100; out.textContent = e.target.value + '%'; onset(v); } });
  input.addEventListener('change', () => uiSfx('click'));
  return el('div', { class: 'field' }, el('span', { class: 'lbl', text: label }), el('div', { class: 'slider' }, input, out));
}

// ---------- starting a match from the menu ----------
// The "rounds to win" setting only applies to plain duels; modes with their own round rules (ladders, waves, teams of 3...) keep them.
const modeUsesRounds = m => !!m && !m.customRounds && (m.winScore ?? 5) === 5;
function menuCfg() {
  const mode = MODES[MENU.mode] || listOf(MODES)[0], n = modePickers(mode);
  if (!MODES[MENU.mode]) MENU.mode = mode.key;
  return {
    mode: mode.key, map: MENU.map, diff: AI_LEVELS[MENU.diff] ? MENU.diff : 'normal',
    loadouts: Array.from({ length: n }, (_, i) => loadoutForMatch(i)),
    winScore: modeUsesRounds(mode) ? SETTINGS.rounds : undefined, hpMul: SETTINGS.hpMul, speed: SETTINGS.speed, fighters: crowdSize(mode),
    orbs: SETTINGS.items !== 'off', orbRate: ITEM_RATES[SETTINGS.items] || 1, killcam: !!SETTINGS.killcam,
    weather: wxMenuPick(),                        // 58-world: 'random' | 'clear' | a WEATHER key
    mutators: typeof mutatorsPicked === 'function' ? mutatorsPicked() : [],   // 79-mutators (picked on the arena screen)
    joined: joinCfg(mode),                        // 93-pads: local players from the join lobby (crowd modes)
  };
}
function loadoutForMatch(i) {
  const lo = menuLoadout(i);
  const hat = lo.hat === 'random' ? randomKey(HATS, h => h.key !== 'none') : lo.hat;
  return { weapon: lo.weapon, hat, color: lo.color, skills: lo.skills.map(k => k === 'none' ? null : k), cls: lo.cls,
    throws: lo.throws.map(k => k === 'none' ? null : k), persona: lo.persona,   // persona: the CPU rival (67)
    look: typeof lookForMatch === 'function' ? lookForMatch(lo, isCpuPicker(i)) : undefined };   // outfit, skins, pet... (98-ui-progress)
}
// The saved loadout for picker i, filled with defaults (humans keep owned hats/colours only).
function menuLoadout(i) {
  const cpuSide = isCpuPicker(i);
  const lo = MENU.loadouts[i] = MENU.loadouts[i] || {};   // edited in place: screens hold on to this object
  const defaults = { weapon: 'random', skills: ['random', 'random'], hat: cpuSide ? 'random' : 'none', color: DEFAULT_COLORS[i % 4],
    cls: 'random', throws: ['random', 'random'] };
  for (const k in defaults) if (lo[k] == null) lo[k] = defaults[k];
  if (!Array.isArray(lo.skills)) lo.skills = ['random', 'random'];
  if (!Array.isArray(lo.throws)) lo.throws = ['random', 'random'];
  if (lo.cls !== 'random' && !CLASSES[lo.cls]) lo.cls = 'random';
  if (lo.hat === 'random' && !cpuSide) lo.hat = 'none';
  if (lo.hat !== 'random' && (!HATS[lo.hat] || !ownsHat(lo.hat))) lo.hat = 'none';
  if (!/^#[0-9a-f]{6}$/i.test(lo.color || '') || !ownsColor(lo.color)) lo.color = DEFAULT_COLORS[i % 4];
  return lo;
}
// Whether picker i of the current mode is a CPU (from the mode's labels, e.g. ['You', 'CPU']).
function isCpuPicker(i) {
  const mode = MODES[MENU.mode] || {}, label = String((mode.labels || [])[i] || '');
  return /cpu|bot|rival|boss|enemy|dummy/i.test(label) || (mode.players && mode.players[1] === 0);
}

function startFromMenu() {
  initAudio();
  uiSfx('fight');
  saveMenu();
  startMatch(menuCfg());
}

// ---------- keyboard and gamepad navigation ----------
const NAV_DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
const menusActive = () => G_STATE.state !== 'play' && G_STATE.state !== 'killcam' && !!activePanel();

function focusables(panel) {
  return [...panel.querySelectorAll('button, input, select, [tabindex="0"]')].filter(e => !e.disabled && e.offsetParent !== null);
}
// Moves focus to the nearest control in a direction (spatial navigation), so arrows work on grids and lists alike.
function moveFocus(dir) {
  const panel = activePanel();
  if (!panel) return;
  const list = focusables(panel), cur = document.activeElement;
  if (!list.length) return;
  if (!panel.contains(cur) || cur === document.body) { list[0].focus(); return; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const e of list) {
    if (e === cur) continue;
    const b = e.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const along = (bx - ax) * dir[0] + (by - ay) * dir[1], perp = Math.abs((bx - ax) * dir[1] - (by - ay) * dir[0]);
    if (along <= 4) continue;
    const score = along + perp * 2.2;
    if (score < bestScore) { bestScore = score; best = e; }
  }
  if (!best) return;
  best.focus({ preventScroll: true });
  best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  uiSfx('nav');
}

addEventListener('keydown', e => {
  if (KEY_CAPTURE || e.defaultPrevented || !menusActive() || e.altKey || e.ctrlKey || e.metaKey) return;
  const dir = NAV_DIRS[e.code];
  if (dir) {
    if (e.target && e.target.type === 'range' && dir[0]) return;   // left/right adjust sliders
    e.preventDefault();
    moveFocus(dir);
  } else if (e.code === 'Enter' && !e.repeat && G_STATE.state === 'menu' && UI.screen === 'menu' && !/^(BUTTON|INPUT)$/.test(e.target.tagName)) {
    startFromMenu();
  } else if (e.code === 'Backspace' && G_STATE.state === 'menu' && UI.screen !== 'menu') { e.preventDefault(); goBack(); }
});
on('escape', e => {
  if (!e || e.code !== 'Escape') return;
  if (G_STATE.state === 'menu' && UI.screen !== 'menu') goBack();
});

// Gamepads in menus: d-pad / stick moves focus (with key-repeat), A presses, B goes back. Start pauses (90-input).
// The pad is read every frame, even during play, so a button already held when a menu appears (A mashed as the last
// K.O. lands, or A used to skip the kill-cam) only counts after it is released and pressed again.
const UI_PAD = { held: {}, repeatAt: 0, armAt: 0 };
// A fresh screen ignores pad presses for a moment: a player still mashing A from the fight (or the kill-cam skip)
// must see the results before Rematch can be pressed.
on('state', now => { UI_PAD.armAt = performance.now() + (now === 'over' ? 1200 : 200); });
// The results screen also needs a *fresh* confirm: pad A, Enter or Space count only after being seen released for
// UI_QUIET ms once the screen has armed, and key repeats never count. So a button held from the fight (or the kill-cam
// skip) can be held forever, and mashing can go on as long as it likes, without starting a Rematch.
const UI_CONFIRM_KEYS = new Set(['Enter', 'NumpadEnter', 'Space']), UI_QUIET = 300;
const UI_FRESH = { padUpAt: 0, keyUpAt: new Map(), blocked: new Set() };   // when each input was last seen going up
on('state', now => {
  if (now !== 'over') return;
  UI_FRESH.padUpAt = 0;              // the pad must be seen up after arming (read in uiPadLoop)
  UI_FRESH.keyUpAt = new Map([...UI_CONFIRM_KEYS].filter(k => !KEYS.has(k)).map(k => [k, UI_PAD.armAt]));
});
const uiFreshSince = t => !!t && performance.now() >= UI_PAD.armAt && performance.now() - t >= UI_QUIET;
addEventListener('keydown', e => {
  if (G_STATE.state !== 'over' || !UI_CONFIRM_KEYS.has(e.code)) return;
  const ok = !e.repeat && uiFreshSince(UI_FRESH.keyUpAt.get(e.code));
  UI_FRESH.keyUpAt.delete(e.code);   // pressed: it must go up (and stay up) again before the next one counts
  if (ok) return;
  e.preventDefault(); e.stopImmediatePropagation(); UI_FRESH.blocked.add(e.code);   // not fresh: no button click
}, true);
addEventListener('keyup', e => {
  if (UI_FRESH.blocked.delete(e.code)) e.preventDefault();            // Space clicks on keyup: block that too
  if (G_STATE.state === 'over') UI_FRESH.keyUpAt.set(e.code, Math.max(performance.now(), UI_PAD.armAt));
}, true);
function uiPadRead() {
  const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(Boolean) : null;
  if (!gp) return null;
  const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  return { up: btn(12) || ay < -.6, down: btn(13) || ay > .6, left: btn(14) || ax < -.6, right: btn(15) || ax > .6, a: btn(0), b: btn(1) };
}
function uiPadLoop(now) {
  requestAnimationFrame(uiPadLoop);
  let now2 = null;
  try { now2 = uiPadRead(); } catch (e) { now2 = null; }
  if (!now2) { UI_PAD.held = {}; return; }
  const was = UI_PAD.held;
  UI_PAD.held = now2;
  if (!menusActive()) return;
  const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const k in dirs) {
    if (now2[k] && !was[k]) { moveFocus(dirs[k]); UI_PAD.repeatAt = now + 380; }
    else if (now2[k] && now >= UI_PAD.repeatAt) { moveFocus(dirs[k]); UI_PAD.repeatAt = now + 120; }
  }
  if (now < UI_PAD.armAt) return;
  if (!now2.a && !UI_FRESH.padUpAt) UI_FRESH.padUpAt = now;     // A seen released (after arming)
  const fresh = G_STATE.state !== 'over' || uiFreshSince(UI_FRESH.padUpAt);
  if (now2.a) UI_FRESH.padUpAt = 0;
  if (now2.a && !was.a && fresh) uiPadPress();
  else if (now2.b && !was.b) uiPadBack();
}
// B: back one screen in the menus; in the pause menu it backs out of Settings/Controls, then resumes.
function uiPadBack() {
  if (G_STATE.state === 'menu' && UI.screen !== 'menu') goBack();
  else if (G_STATE.state === 'paused') { if (UI.screen !== 'pause') goBack(); else setState('play'); }
}
function uiPadPress() {
  const panel = activePanel(), cur = document.activeElement;
  if (panel && panel.contains(cur) && cur.click) cur.click();
  else if (panel) { const first = focusables(panel)[0]; if (first) first.focus(); }
}
requestAnimationFrame(uiPadLoop);

// ---------- toasts (achievements, purchases) ----------
const TOASTS = el('div', { class: 'toasts', 'aria-live': 'polite' });
UI_ROOT.append(TOASTS);
function toast(title, sub, icon = '★', color = '#ffd84a') {
  const t = el('div', { class: 'toast', style: { '--tc': color } },
    el('span', { class: 'toast-icon', 'aria-hidden': 'true', text: icon }),
    el('div', {}, el('strong', { text: title }), sub ? el('small', { text: sub }) : null));
  TOASTS.append(t);
  while (TOASTS.children.length > 3) TOASTS.firstChild.remove();
  setTimeout(() => t.classList.add('out'), 3600);
  setTimeout(() => t.remove(), 4100);
}
// Toasts stay out of the kill-cam replay (the results screen lists the match's new trophies anyway).
on('state', now => { TOASTS.style.visibility = now === 'killcam' ? 'hidden' : ''; });
// On the results screen new trophies are listed in the reward box instead of toasting over the buttons.
on('achievement', a => { if (G_STATE.state === 'over') return; toast('Trophy unlocked: ' + a.name, `${a.desc}  +${a.coins} coins`, a.icon); uiSfx('unlock'); });

defSfx('nav', () => tone(620, 700, .03, 'triangle', .025));
defSfx('back', () => tone(700, 480, .06, 'triangle', .05));
defSfx('unlock', () => { tone(660, 660, .1, 'square', .05); tone(880, 880, .1, 'square', .05, .1); tone(1320, 1320, .25, 'triangle', .07, .2); });
defSfx('coin', () => { tone(1250, 1250, .05, 'square', .04); tone(1650, 1650, .18, 'square', .04, .06); });
defSfx('deny', () => tone(220, 160, .14, 'square', .05));
