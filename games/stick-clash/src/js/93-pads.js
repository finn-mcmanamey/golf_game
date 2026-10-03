// 93-pads.js: gamepad button remapping per player and the "press A to join" lobby for party modes.
// - Remap (SCREENS.padmap, from Controls or Settings): pick a player, click an action, press a pad button. Two actions
//   never share a button (they swap). Saved as store 'padmap' (only the changes from PAD_BUTTONS); Reset per player.
// - Join lobby (SCREENS.join, from the arena screen of modes with a Fighters stepper): A joins a pad, B leaves,
//   Start (or Fight!) begins; a key of either keyboard set joins that set. Players are P1..P8 in join order, and
//   the match's CPU seats become those humans (filling the team with the fewest humans first).
// - Every mode's setup is wrapped at boot to apply the lobby (cfg.joined) and the colour-blind palette (92).

const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'];
const PAD_REMAP_ACTIONS = BIND_ACTIONS.filter(a => a !== 'left' && a !== 'right');
const PAD_FIXED = new Set([9, 14, 15, 16]);   // Start pauses; d-pad left/right move; Home belongs to the system
const padName = i => PAD_NAMES[i] || 'Button ' + i;

// ---------- remapping ----------
const REMAP = { slot: 0, listen: null, prev: null };

function savePadMaps() {
  store.set('padmap', PAD_MAPS.map(m => {
    const diff = {};
    for (const a in m) if (m[a] !== PAD_BUTTONS[a]) diff[a] = m[a];
    return diff;
  }));
}
// Gives `action` button `btn`; whatever had that button takes the action's old one.
function setPadBind(slot, action, btn) {
  const map = PAD_MAPS[slot], old = map[action];
  for (const a in map) if (map[a] === btn) map[a] = old;
  map[action] = btn;
  savePadMaps();
}
function resetPadMap(slot) { PAD_MAPS[slot] = Object.assign({}, PAD_BUTTONS); savePadMaps(); }

const padsDown = () => readPadList().map(gp => gp.buttons.map(b => !!b && (b.pressed || b.value > .5)));
function remapListen(action) {
  REMAP.listen = action; REMAP.prev = padsDown();   // buttons already down (A that clicked this) must be released first
  refreshScreen();
}
// Polled every frame while the remap screen listens: the first fresh button press on any pad is the new binding.
function remapPoll() {
  const now = padsDown(), prev = REMAP.prev || [];
  UI_PAD.armAt = performance.now() + 300;          // the menu's own A/B handling waits while we listen
  for (let p = 0; p < now.length; p++) {
    const i = now[p].findIndex((d, k) => d && !(prev[p] && prev[p][k]));
    if (i < 0) continue;
    if (PAD_FIXED.has(i)) { uiSfx('deny'); toast(padName(i) + ' is reserved', 'Start pauses; the d-pad moves.', '🎮', '#ff8a2e'); }
    else { setPadBind(REMAP.slot, REMAP.listen, i); uiSfx('click'); }
    REMAP.listen = null; refreshScreen();
    return;
  }
  REMAP.prev = now;
}

function padmapScreen() {
  if (REMAP.listen && UI.screen !== 'padmap') REMAP.listen = null;
  const slot = REMAP.slot, map = padMapFor(slot);
  const players = el('div', { class: 'seg', role: 'group', 'aria-label': 'Player' }, Array.from({ length: MAX_FIGHTERS }, (_, i) =>
    el('button', { 'aria-pressed': String(i === slot), 'data-key': 'padmap-p' + i, onclick: () => { REMAP.slot = i; REMAP.listen = null; uiSfx('click'); refreshScreen(); } }, 'P' + (i + 1))));
  const grid = el('div', { class: 'binds padbinds' }, PAD_REMAP_ACTIONS.map(a => [el('span', { text: ACTION_LABELS[a] }),
    el('button', { class: 'key' + (REMAP.listen === a ? ' listening' : ''), 'data-key': 'pad-' + a,
      onclick: () => remapListen(a) }, REMAP.listen === a ? 'Press a pad button…' : padName(map[a]))]));
  const pads = readPadList();
  const body = el('div', { class: 'set-grid' }, el('section', { class: 'set-group' }, el('h3', { text: 'Player' }), players,
    el('p', { class: 'hint', text: pads.length ? `Connected: ${pads.map(padLabel).join(', ')}` : 'No gamepad found. Plug one in and press a button.' }),
    el('p', { class: 'hint', text: 'Click an action, then press the button you want on any pad. The stick and d-pad always move; Start always pauses.' })),
    el('section', { class: 'set-group' }, el('h3', { text: `P${slot + 1} buttons` }), grid));
  return sheet('Gamepad buttons', body, [uiButton(`Reset P${slot + 1}`, () => { resetPadMap(slot); REMAP.listen = null; refreshScreen(); }),
    el('button', { class: 'go', onclick: () => { REMAP.listen = null; uiSfx('click'); goBack(); } }, 'Done')]);
}

// ---------- join lobby ----------
const LOBBY = { list: [], prev: new Map(), keyed: false };   // list: [{ pad: index, label } | { keys: 0 | 1 }]
const lobbyOpen = () => UI.screen === 'join' && PANELS.join && !PANELS.join.hidden;
const lobbyHas = pad => LOBBY.list.findIndex(j => j.pad === pad);

function lobbyJoin(entry) {
  if (LOBBY.list.length >= MAX_FIGHTERS) { uiSfx('deny'); return; }
  LOBBY.list.push(entry); uiSfx('unlock'); refreshScreen();
}
function lobbyLeave(k) { LOBBY.list.splice(k, 1); uiSfx('back'); refreshScreen(); }

// Pads: A joins, B leaves (or goes back if that pad hasn't joined), Start begins. Polled every frame while open.
function lobbyPoll() {
  UI_PAD.armAt = performance.now() + 300;          // keep the menu's single-pad A/B away from the lobby
  for (const gp of readPadList()) {
    const was = LOBBY.prev.get(gp.index) || [], now = gp.buttons.map(b => !!b && (b.pressed || b.value > .5));
    LOBBY.prev.set(gp.index, now);
    const fresh = i => now[i] && !was[i], k = lobbyHas(gp.index);
    if (fresh(0) && k < 0) lobbyJoin({ pad: gp.index, label: padLabel(gp) });
    else if (fresh(1)) { if (k >= 0) lobbyLeave(k); else goBack(); }
    else if (fresh(9) && k >= 0) lobbyStart();
  }
}
// Keyboards: any key of a set joins it (Esc still goes back through the menus).
addEventListener('keydown', e => {
  if (!lobbyOpen() || e.repeat) return;
  const set = BINDS.findIndex(b => BIND_ACTIONS.some(a => b[a] === e.code));
  if (set < 0 || LOBBY.list.some(j => j.keys === set)) return;
  e.preventDefault(); e.stopPropagation();
  lobbyJoin({ keys: set });
}, true);

function lobbyCard(i) {
  const j = LOBBY.list[i], color = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
  if (!j) return el('div', { class: 'join-card empty' }, el('b', { text: 'P' + (i + 1) }), el('span', { text: 'Press A to join' }));
  const how = j.keys != null ? `Keyboard (${keyLabel(BINDS[j.keys].left)} ${keyLabel(BINDS[j.keys].right)} …)` : j.label;
  return el('div', { class: 'join-card', style: { '--jc': color } }, el('b', { text: 'P' + (i + 1) }), el('span', { text: how }),
    uiButton('Leave', () => lobbyLeave(i), 'join-leave', { 'data-key': 'join-leave-' + i }));
}

function joinScreen() {
  const mode = MODES[MENU.mode] || {}, n = LOBBY.list.length;
  const grid = el('div', { class: 'join-grid', tabindex: '0', 'data-autofocus': '' }, Array.from({ length: MAX_FIGHTERS }, (_, i) => lobbyCard(i)));
  const hint = el('p', { class: 'hint', text: `${mode.name || 'Party'}: every pad presses A to join (B leaves, Start begins). A key from either keyboard set joins too. ` +
    'Empty seats are filled by CPUs.' });
  return sheet('Players', el('div', {}, hint, grid), [uiButton('◂ Back', goBack, 'foot-back'),
    uiButton('Clear', () => { LOBBY.list = []; refreshScreen(); }),
    el('button', { class: 'go', disabled: n ? null : true, onclick: lobbyStart }, n > 1 ? `Fight! (${n} players)` : 'Fight!')]);
}
function lobbyStart() { if (LOBBY.list.length) startFromMenu(); }

// The menu cfg's `joined` (95-ui menuCfg): only for crowd modes and only with two or more players.
function joinCfg(mode) { return mode && mode.crowd && LOBBY.list.length >= 2 ? LOBBY.list.map(j => Object.assign({}, j)) : undefined; }
const joinActive = (cfg, mode) => !!(cfg && Array.isArray(cfg.joined) && cfg.joined.length >= 2 && mode && mode.crowd && !cfg.demo);

// Turns CPU seats into the joined players. P1 keeps the mode's own human seat (if any).
function joinApply(roster, cfg) {
  const humansOn = t => roster.filter(r => r.ctrl === 'human' && r.team === t).length;
  let slot = 0;
  for (const r of roster) if (r.ctrl === 'human') Object.assign(r, { slot: slot++, name: 'P' + slot });
  while (slot < cfg.joined.length) {
    const cpus = roster.filter(r => r.ctrl !== 'human' && !((r.scale || 1) > 1.05));
    if (!cpus.length) break;
    const r = cpus.reduce((a, b) => humansOn(b.team) < humansOn(a.team) ? b : a);
    Object.assign(r, { ctrl: 'human', slot, name: 'P' + (slot + 1), persona: null, aiLevel: undefined });
    slot++;
  }
}

function padsWrapModes() {
  for (const m of Object.values(MODES)) {
    const base = m.setup;
    if (typeof base !== 'function' || base.padsWrapped) continue;
    m.setup = function (cfg) {
      cbPatchTeams();
      if (joinActive(cfg, this)) cfg.fighters = clamp(Math.max(cfg.fighters || 0, cfg.joined.length), this.crowd[0], this.crowd[1]);
      const info = base.call(this, cfg);
      if (info && Array.isArray(info.roster)) {
        if (joinActive(cfg, this)) joinApply(info.roster, cfg);
        cbApply(info.roster);
      }
      return info;
    };
    m.setup.padsWrapped = true;
  }
}
on('matchStart', cfg => { JOINED = joinActive(cfg, G_STATE.mode) ? cfg.joined : null; });

// ---------- wiring into the menus ----------
function padsPoll() {
  requestAnimationFrame(padsPoll);
  try {
    if (REMAP.listen && UI.screen === 'padmap' && PANELS.padmap && !PANELS.padmap.hidden) remapPoll();
    else if (lobbyOpen()) lobbyPoll();
  } catch (e) { report(e, 'pads poll'); }
}

function padsWrapScreen(name, extra) {
  const build = SCREENS[name];
  if (typeof build !== 'function') return;
  SCREENS[name] = () => {
    const node = build();
    try { extra(node); } catch (e) { report(e, 'pads ' + name); }
    return node;
  };
}
// Arena screen of a crowd mode: a "Players" button showing how many joined.
function padsMapsExtra(node) {
  const mode = MODES[MENU.mode], quick = node.querySelector('.quick-set');
  if (!mode || !mode.crowd || !quick) return;
  const n = LOBBY.list.length;
  quick.append(uiButton(n > 1 ? `Players: ${n} joined…` : 'Local players…', () => openScreen('join', 'maps'), 'link', { 'data-key': 'join-open' }));
}
function padsControlsExtra(node) {
  const card = [...node.querySelectorAll('.set-group')].find(g => /Gamepads/.test(g.textContent));
  if (card) card.append(uiButton('Remap buttons…', () => openScreen('padmap', 'controls'), null, { 'data-key': 'padmap-open' }));
}

on('boot', () => {
  padsWrapModes();
  if (typeof SCREENS === 'undefined') return;
  Object.assign(SCREENS, { padmap: padmapScreen, join: joinScreen, transfer: transferScreen });
  padsWrapScreen('maps', padsMapsExtra);
  padsWrapScreen('controls', padsControlsExtra);
  requestAnimationFrame(padsPoll);
});
