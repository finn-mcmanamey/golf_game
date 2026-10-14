// 94-controls-card.js: shows each player their controls (90-input's schemes and layouts, v4).
// - Key strips (SETTINGS.keyStrips): each keyboard player's keys at their side, at match start and when idle.
// - Controls card (SETTINGS.controlsCard): before the first fight of a session, only the schemes and devices in use;
//   the fight waits behind it until any key, pad button or tap. Also in the pause menu. Like the benchmark
//   (84-quality) it never opens by itself under test automation: SC.controls.card() opens it.
// - Settings → Controls, table mode (Settings → Touch, beside Fight! on touch screens), Compact 2P keys on Controls.

const CTL_DEFAULTS = { keyStrips: true, controlsCard: true };
for (const k in CTL_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = CTL_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = CTL_DEFAULTS[k];
}
const SCHEME_NAMES = { simple: 'Simple', advanced: 'Advanced' };

// ---------- what each player presses ----------
// The rows per scheme, and their labels (★: a Simple player's skill key fires the full super).
const CTL_ROWS = { simple: ['left', 'jump', 'attack', 'skill1', 'block', 'dash'],
  advanced: ['left', 'jump', 'attack', 'skill1', 'skill2', 'block', 'grab', 'throw', 'super', 'taunt', 'dash'] };
const CTL_LABELS = { left: 'move', skill1: 'skill 1', skill2: 'skill 2', block: 'block (hold)', grab: 'grab / throw', throw: 'throwable', dash: 'dash · or tap twice' };
const ctlLabel = (a, scheme) => scheme === 'simple' && { skill1: 'skill · ★ super when full', block: 'block · or hold back' }[a] || CTL_LABELS[a] || a;
// Key caps of keyboard set k; an action without a key (unbound, or taken by Compact 2P) is left out.
function ctlKeyRows(k, scheme) {
  const b = keySets()[k] || {};
  return CTL_ROWS[scheme].filter(a => b[a]).map(a => [a === 'left' ? [b.left, b.right].map(c => keyLabel(c, true)) : [keyLabel(b[a], true)], ctlLabel(a, scheme)]);
}
function ctlPadRows(slot, scheme) {
  const m = padMapFor(slot);
  return CTL_ROWS[scheme].map(a => [[a === 'left' ? 'Stick' : padName(m[a])], ctlLabel(a, scheme)]);
}
// The keyboard set a human slot plays on (P1 alone shows the first).
const ctlKeySet = slot => JOINED ? (JOINED[slot] || {}).keys : humanCount() <= 1 ? 0 : slot;
// What a human slot plays on now: its touch set, a pad, or else its keys.
function ctlDevices(slot) {
  const touch = TSETS.some(s => s.slot === slot && (!s.i || tableActive())) && touchWanted();
  const pad = readPadList().some((gp, n) => padSlot(gp, n, humanCount() <= 1) === slot);
  return { touch, pad, keys: [0, 1].includes(ctlKeySet(slot)) && !touch && (!pad || (SLOT_DEV[slot] || DEVICE.lastInput) === 'key') };
}
// A key cap; one-character caps (". , / A ←") get a wider, bolder face so a lone dot stays readable.
const keyCap = t => el('kbd', { class: t.length === 1 ? 'k1' : null, text: t });
const ctlRowEls = rows => rows.map(([keys, label]) => el('div', { class: 'kr' }, keys.map(keyCap), el('span', { text: label })));

// ---------- key strips ----------
const STRIP_PLAY = 3000, STRIP_IDLE = 5000;   // ms of play before a strip fades; ms idle before it shows again
const STRIPS = [0, 1].map(k => ({ k, el: null, sig: '', since: null, last: 0, tap: 0 }));
// The human slot on keyboard set k when a strip should show (-1 = none).
function stripSlot(k) {
  const g = G_STATE;
  if (g.state !== 'play' || g.demo || g.override || VOTE.open || SETTINGS.keyStrips === false || g.cfg.autopilot || !humanCount()) return -1;   // 79's vote first
  const slot = JOINED ? JOINED.findIndex(j => j.keys === k) : humanCount() <= 1 ? (k ? -1 : 0) : g.roster.some(r => r.ctrl === 'human' && r.slot === k) ? k : -1;
  return slot >= 0 && ctlDevices(slot).keys ? slot : -1;
}
function stripFill(s, slot) {
  const scheme = schemeOf(slot), rows = ctlKeyRows(s.k, scheme), r = G_STATE.roster.find(x => x.ctrl === 'human' && x.slot === slot) || {};
  const sig = [slot, scheme, r.color, r.name, JSON.stringify(rows)].join('|');   // a rematch may rename the player
  if (!s.el) { s.el = el('div', { class: 'kstrip kstrip-' + (s.k ? 'r' : 'l'), 'aria-hidden': 'true' }); document.body.append(s.el); }
  if (sig === s.sig) return;
  s.sig = sig;
  s.el.style.setProperty('--kc', r.color || '#eef0ff');
  s.el.replaceChildren(el('b', { text: `${r.name || 'P' + (slot + 1)} · ${SCHEME_NAMES[scheme]}` }), ...ctlRowEls(rows));
}
// Shown until the player has played STRIP_PLAY ms, and again after STRIP_IDLE ms without their keys.
function stripTick() {
  const now = performance.now();
  for (const s of STRIPS) {
    const slot = stripSlot(s.k);
    if (slot < 0) { if (s.el) s.el.classList.remove('on'); continue; }
    stripFill(s, slot);
    const b = keySets()[s.k];
    if (now - s.tap < 250 || BIND_ACTIONS.some(a => b[a] && KEYS.has(b[a]))) { s.last = now; if (s.since == null) s.since = now; }
    else if (now - s.last > STRIP_IDLE) s.since = null;
    s.el.classList.toggle('on', s.since == null || now - s.since < STRIP_PLAY);
  }
}
addEventListener('keydown', e => { for (const s of STRIPS) if (BIND_ACTIONS.some(a => (keySets()[s.k] || {})[a] === e.code)) s.tap = performance.now(); }, true);
on('matchStart', () => { for (const s of STRIPS) Object.assign(s, { since: null, last: performance.now() }); });
setInterval(() => { try { stripTick(); } catch (e) { report(e, 'key strips'); } }, 150);

// ---------- controls card ----------
const CARD = { el: null, seen: false, at: 0, hold: null, after: [] };
const CARD_ICONS = { attack: '⚔', jump: '▲', skill1: '✦', skill2: '✧', dash: '»', block: '◆', throw: '●', grab: '✋', super: '★', taunt: '✌' };
// One section per player and device; players with the same pad buttons and scheme share one.
function cardSections() {
  const out = [], add = (key, sec) => { const same = out.find(o => o.key === key); if (same) same.who.push(sec.who[0]); else out.push(Object.assign(sec, { key })); };
  for (const r of G_STATE.roster) {
    if (r.ctrl !== 'human') continue;
    const slot = r.slot || 0, scheme = schemeOf(slot), d = ctlDevices(slot), sec = o => Object.assign({ who: [r.name], color: r.color, scheme }, o);
    if (d.touch) add('t' + slot, sec({ dev: 'Touch', flip: TSETS[1].slot === slot && tableActive() }));
    if (d.pad) { const rows = ctlPadRows(slot, scheme); add('p' + scheme + JSON.stringify(rows), sec({ dev: 'Gamepad', rows })); }
    if (d.keys) add('k' + slot, sec({ dev: CTL.layout === 'compact' ? 'Keyboard · Compact 2P' : 'Keyboard', rows: ctlKeyRows(ctlKeySet(slot), scheme) }));
  }
  return out;
}
function cardSection(s) {
  return el('section', { class: 'cc-sec' + (s.flip ? ' flip' : ''), style: { '--kc': s.color }, 'data-dev': s.dev.split(' ')[0].toLowerCase() },
    el('h3', {}, s.who.join(' · '), el('small', { text: ` ${s.dev} · ${SCHEME_NAMES[s.scheme]}` })),
    s.rows ? el('div', { class: 'cc-keys' }, ctlRowEls(s.rows)) : cardTouch(s.scheme));
}
// The touch set in miniature (91-touch's TOUCH_ARC around Attack), with what the stick and gestures do.
function cardTouch(scheme) {
  const simple = scheme === 'simple', dot = (act, r, deg, sz) => {
    const a = (simple && act === 'skill1' ? 122 : deg) * Math.PI / 180;
    return el('i', { text: CARD_ICONS[act], style: { width: sz + 'px', height: sz + 'px', right: 26 - Math.cos(a) * r - sz / 2 + 'px', bottom: 26 + Math.sin(a) * r - sz / 2 + 'px' } });
  };
  const arc = TOUCH_ARC.filter(([act]) => !simple || act === 'jump' || act === 'skill1').map(([act, ring, deg]) => dot(act, ring * 28 + 16, deg, ring === 1 ? 24 : 18));
  return el('div', { class: 'cc-touch' }, el('div', { class: 'cc-screen' }, el('b', { class: 'cc-stick' }), dot('attack', 0, 0, 34), arc),
    el('p', { class: 'hint', text: `Left: drag to move, up to jump, ${simple ? 'hold back from an attack' : 'down'} to block. Right: tap = attack, swipe = jump / dash.` }));
}
// hold: the fight waits (frozen, G_STATE.override) behind the card; from the pause menu it just closes again.
function cardShow(hold) {
  cardClose();
  const node = el('div', { class: 'overlay cc', role: 'dialog', 'aria-label': 'Controls' }, el('div', { class: 'card wide' },
    el('h2', { text: 'Controls' }), el('div', { class: 'cc-grid' }, cardSections().map(cardSection)),
    el('p', { class: 'cc-go', text: (touchUI() ? 'Tap' : 'Press any key, button or tap') + (hold ? ' to fight' : ' to close') })));
  node.addEventListener('pointerup', cardDone);
  document.body.append(node);
  Object.assign(CARD, { el: node, at: performance.now(), hold: hold ? () => {} : null });
  if (hold) G_STATE.override = CARD.hold;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // Enter or Space must not press a menu button
}
// Any input closes it after a short grace, so the press that opened it doesn't close it again.
function cardDone() { if (CARD.el && performance.now() - CARD.at > 350) cardClose(); }
function cardClose() {
  if (!CARD.el) return;
  CARD.el.remove(); CARD.el = null;
  UI_PAD.armAt = performance.now() + 300;          // the pad button that closed it must not also press a menu button
  for (const fn of CARD.after.splice(0)) fn();     // held notices (cardAfter)
  if (CARD.hold && G_STATE.override === CARD.hold) {
    G_STATE.override = null;
    for (const f of F) clearPresses(f);
    banner('ROUND ' + G_STATE.round, 'FIGHT!', 1.6);   // the start banner played out behind the card
  }
  CARD.hold = null;
}
addEventListener('keydown', e => {
  if (!CARD.el) return;
  e.preventDefault(); e.stopImmediatePropagation();   // capture phase: the key reaches neither the fight nor the menus
  if (!e.repeat) cardDone();
}, true);
on('pad', () => cardDone());
on('state', now => { if (now !== 'play' && now !== 'paused') cardClose(); });
// Whether this match start opens the card (a session's first fight with a human).
const cardDue = cfg => !(CARD.seen || G_STATE.demo || G_STATE.override || cfg.autopilot || SETTINGS.controlsCard === false || navigator.webdriver
  || !G_STATE.roster.some(r => r.ctrl === 'human'));
on('matchStart', cfg => {
  if (!cardDue(cfg)) return;
  CARD.seen = true;
  cardShow(true);
});
// Runs fn now, or after the card if it is open or about to open (cfg: this match start).
function cardAfter(fn, cfg) { if (CARD.el || (cfg && cardDue(cfg))) CARD.after.push(fn); else fn(); }

// ---------- settings, Controls screen, arena screen, pause menu ----------
function ctlSettingsGroup() {
  const seats = Array.from({ length: MAX_FIGHTERS }, (_, i) => segField('P' + (i + 1), [['simple', 'Simple'], ['advanced', 'Advanced']], CTL.schemes[i], v => setScheme(i, v)));
  return el('section', { class: 'set-group', 'data-group': 'controls' }, el('h3', { text: 'Controls' }), el('div', { class: 'ctl-seats' }, seats),
    el('small', { class: 'hint', text: 'Simple: move, jump, attack, one skill (★ super when full); hold back from an attack to block. Advanced: all (trials always).' }),
    segField('Key layout', [['standard', 'Standard'], ['compact', 'Compact 2P']], CTL.layout, setKeyLayout),
    el('small', { class: 'hint', text: 'Compact 2P, one laptop: P1 A D move, W jump, S block, F attack, G skill; P2 ← → ↑ ↓ . / likewise, comma = skill 2.' }),
    toggleField('Key strips', SETTINGS.keyStrips !== false, v => setSetting('keyStrips', v)),
    toggleField('Show controls card', SETTINGS.controlsCard !== false, v => setSetting('controlsCard', v), 'Before the first fight; also in the pause menu.'));
}
function tableSet(v) { setSetting('tableMode', v); lobbyTouchTrim(); touchSeatsUpdate(); }
const TABLE_HINT = "Both on one iPad lying flat: a full touch set each, P2's turned to face them.";
// Compact 2P (chosen in Settings): the key grid shows the keys in use; the fixed ones can't be rebound there.
function ctlControlsExtra(node) {
  if (CTL.layout !== 'compact') return;
  for (const b of node.querySelectorAll('[data-key^="bind-"]')) {
    const [, slot, a] = b.dataset.key.split('-');
    b.textContent = keyLabel(keySets()[slot][a]);
    if (a in COMPACT_KEYS[slot]) Object.assign(b, { disabled: true, title: 'Fixed by Compact 2P' });
  }
}
on('boot', () => {
  padsWrapScreen('settings', node => {
    node.querySelector('.set-grid').insertBefore(ctlSettingsGroup(), node.querySelector('[data-group="access"]'));
    const touch = node.querySelector('[data-group="devices"]');
    if (touch && DEVICE.touch && tableFits()) touch.insertBefore(toggleField('Table mode', !!SETTINGS.tableMode, tableSet, TABLE_HINT), touch.querySelector('.access-links'));
  });
  padsWrapScreen('controls', ctlControlsExtra);
  // The 2-player setup and party lobbies on a touch screen: a quick switch beside Fight!.
  padsWrapScreen('maps', node => {
    const mode = MODES[MENU.mode] || {}, quick = node.querySelector('.quick-set');
    if (!quick || !DEVICE.touch || !tableFits() || !((mode.players || [])[0] >= 2 || mode.crowd)) return;
    quick.append(el('button', { class: 'link', 'aria-pressed': String(!!SETTINGS.tableMode), 'data-key': 'table-mode', title: TABLE_HINT,
      onclick: () => { tableSet(!SETTINGS.tableMode); uiSfx('click'); refreshScreen(); } }, (SETTINGS.tableMode ? '✓ ' : '') + 'Both on this iPad: Table mode'));
  });
  const pause = buildPause;
  buildPause = () => {
    const node = pause(), list = node.querySelector('.menu-list'), btn = uiButton('Controls card', () => cardShow(false), null, { 'data-key': 'pause-card' });
    const ctl = list && [...list.children].find(b => b.textContent === 'Controls');
    if (ctl) ctl.after(btn); else if (list) list.append(btn);
    return node;
  };
  if (window.SC) window.SC.controls = { card: cardShow, cardOpen: () => !!CARD.el };   // test hooks (the rest are globals)
});
