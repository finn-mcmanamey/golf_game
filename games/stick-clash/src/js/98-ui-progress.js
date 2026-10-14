// 98-ui-progress.js: screens for the v3 customisation: the loadout's Look tab (outfit, weapon skin, pet, K.O. effect,
// victory pose), preset chips, the Fighter Creator (with the title picker), the Codex, mutators on the arena screen,
// the mini-game setting, title-screen menu items and cheat-code typing. v4: every look is free from the start; the
// secret ones appear once found. Look fields live flat on each menu loadout (lo.outfit, lo.skins = { cat: key }, ...).

const LOOK_DEFAULT = { outfit: 'none', ko: 'none', pet: 'none', pose: 'cheer' };
const LOOK_TAB = { cat: null };

// ---------- loadout -> match look ----------
// Unknown (or still secret) looks fall back to the default; a CPU picker may leave the outfit on 'random'.
function lookForMatch(lo, cpu) {
  const out = { skins: {} };
  for (const kind in LOOK_DEFAULT) {
    const v = lo[kind] || (cpu && kind === 'outfit' ? 'random' : LOOK_DEFAULT[kind]);
    if (v === 'random') out[kind] = randomKey(LOOKS[kind], d => d.key !== 'none');
    else out[kind] = lookUsable(kind, v) ? v : LOOK_DEFAULT[kind];
  }
  for (const cat in lo.skins || {}) if (lookUsable('skin', lo.skins[cat])) out.skins[cat] = lo.skins[cat];
  return out;
}
const lookForPreview = lo => lookForMatch(Object.assign({}, lo, { outfit: lo.outfit === 'random' ? 'none' : lo.outfit }), false);
function lookPreviewPet(g, f, look, t) {
  const def = PETS[look.pet];
  if (def && def.key !== 'none') petDrawOne(g, def, f.P[1].x - 46, f.P[1].y - 34 + Math.sin(t * 3) * 4, t);
}
// The attract demo dresses its CPUs at random so the title screen shows the outfits off.
on('matchStart', () => {
  if (!G_STATE.demo) return;
  for (const r of G_STATE.roster) r.look = r.look || lookForMatch({ outfit: 'random', skins: { [WEAPONS[r.weapon] ? WEAPONS[r.weapon].cat : 'blade']: randomKey(WSKINS) } }, true);
});

// ---------- tiles ----------
function lookTile(kind, def, selected, onpick) {
  return el('button', { class: 'tile look-tile' + (selected ? ' sel' : ''), 'data-key': `${kind}-${def.key}`, title: def.desc || def.name, onclick: () => onpick(def.key) },
    el('span', { class: 'big-icon', text: def.icon }), el('span', { text: def.name }));
}
function lookSection(title, kind, lo, cpu, extra) {
  const set = v => { lo[kind] = v; saveMenu(); uiSfx('click'); refreshScreen(); };
  const cur = lo[kind] || (cpu && kind === 'outfit' ? 'random' : LOOK_DEFAULT[kind]);
  const tiles = listOf(LOOKS[kind]).map(d => lookTile(kind, d, cur === d.key, set));
  if (cpu && kind === 'outfit') tiles.unshift(el('button', { class: 'tile look-tile' + (cur === 'random' ? ' sel' : ''), 'data-key': 'outfit-random', onclick: () => set('random') },
    el('span', { class: 'big-icon', text: '🎲' }), el('span', { text: 'Random' })));
  return [el('h4', { text: title }), extra || null, el('div', { class: 'tile-grid look-grid' }, tiles)];
}
// Weapon skins are chosen per weapon category (the selected weapon's, or any category from the chips).
function skinSection(lo, cpu) {
  const w = WEAPONS[lo.weapon], cats = WEAPON_CATS.filter(c => listOf(WEAPONS).some(x => x.cat === c));
  const cat = LOOK_TAB.cat && cats.includes(LOOK_TAB.cat) ? LOOK_TAB.cat : w ? w.cat : cats[0];
  lo.skins = lo.skins || {};
  const chips = el('div', { class: 'cat-chips' }, cats.map(c => el('button', { 'aria-pressed': String(c === cat), 'data-key': 'skincat-' + c,
    onclick: () => { LOOK_TAB.cat = c; uiSfx('click'); refreshScreen(); } }, `${CAT_ICONS[c] || ''} ${CAT_NAMES[c] || c}${lo.skins[c] && lo.skins[c] !== 'none' ? ' ✓' : ''}`)));
  const set = v => { lo.skins[cat] = v; saveMenu(); uiSfx('click'); refreshScreen(); };
  return [el('h4', { text: `Weapon skin · ${CAT_NAMES[cat] || cat}` }), chips,
    el('div', { class: 'tile-grid look-grid' }, listOf(WSKINS).map(d => lookTile('skin', d, (lo.skins[cat] || 'none') === d.key, set)))];
}
function lookTab(i, lo) {
  const cpu = isCpuPicker(i);
  return el('div', { class: 'tab-body' },
    el('p', { class: 'hint', text: 'Outfits sway with real cloth physics. Every look is yours to mix and match; secret ones appear once found.' }),
    lookSection('Outfit', 'outfit', lo, cpu), skinSection(lo, cpu),
    lookSection('Pet', 'pet', lo, cpu, el('p', { class: 'hint', text: 'Pets help a little on a cooldown. They sit out Ranked and One-Hit.' })),
    lookSection('K.O. effect', 'ko', lo, cpu), lookSection('Victory pose', 'pose', lo, cpu));
}

// Preset chips above the loadout: one tap applies a saved fighter.
function presetBar(i, lo) {
  const list = presetList();
  return el('div', { class: 'preset-bar' }, el('span', { class: 'lbl', text: 'Presets' }),
    list.map((p, k) => el('button', { class: 'preset-chip' + (lo.preset === p.name ? ' sel' : ''), 'data-key': 'preset-' + k, style: { '--pc': p.color || '#fff' },
      onclick: () => { presetApply(k, lo); saveMenu(); uiSfx('click'); refreshScreen(); } }, el('i'), p.name)),
    uiButton(list.length ? 'Creator…' : 'Fighter Creator…', () => { CREATOR.picker = i; openScreen('creator', 'loadout'); }, 'link'));
}

// ---------- Fighter Creator ----------
const CREATOR = { picker: 0, name: '', edit: -1 };
SCREENS.creator = () => {
  const i = CREATOR.picker, lo = menuLoadout(i), list = presetList();
  if (!CREATOR.name) CREATOR.name = lo.preset || 'My Fighter';
  const name = el('input', { class: 'cr-name', type: 'text', maxlength: 18, value: CREATOR.name, 'aria-label': 'Preset name', 'data-key': 'cr-name',
    oninput: e => { CREATOR.name = e.target.value; } });
  const save = (idx) => {
    if (!presetSave(CREATOR.name.trim() || 'Fighter', lo, idx)) { uiSfx('deny'); toast('Preset slots full', `Delete one first (max ${PRESET_MAX}).`, '💾', '#ff8a2e'); return; }
    lo.preset = CREATOR.name.trim() || 'Fighter'; saveMenu(); uiSfx('chime'); toast('Preset saved', lo.preset, '💾', '#5dff9a'); refreshScreen();
  };
  const at = list.findIndex(p => p.name === lo.preset);
  const pane = el('div', { class: 'lo-preview cr-pane' },
    liveCanvas(300, 280, 'lo-canvas', (g, t, cw, ch) => drawLoadoutPreview(g, t, cw, ch, lo)),
    el('label', { class: 'field' }, el('span', { class: 'lbl', text: 'Name' }), name),
    el('div', { class: 'row' }, uiButton('Save as new', () => save(-1), 'go'), at >= 0 ? uiButton(`Update "${list[at].name}"`, () => save(at)) : null),
    uiButton('Edit weapon, skills, class…', () => { LO.picker = i; LO.tab = 'weapon'; openScreen('loadout', 'creator'); }),
    titlePicker());
  const cards = el('div', { class: 'cr-list' }, list.length ? list.map((p, k) => presetCard(p, k, lo)) : el('p', { class: 'hint', text: 'No presets yet. Dress your fighter, name it, and save.' }));
  return sheet('Fighter Creator', [el('div', { class: 'lo-grid cr-grid', style: { '--pc': lo.color } }, pane,
    el('div', { class: 'lo-pick' }, el('h4', { text: `Saved fighters (${list.length}/${PRESET_MAX})` }), cards, lookTab(i, lo)))], null, { cls: 'sheet-loadout' });
};
function presetCard(p, k, lo) {
  const w = WEAPONS[p.weapon], o = OUTFITS[p.outfit], pet = PETS[p.pet];
  return el('div', { class: 'cr-card' + (lo.preset === p.name ? ' sel' : ''), style: { '--pc': p.color || '#fff' } },
    el('i'), el('div', {}, el('strong', { text: p.name }),
      el('small', { text: [w ? w.name : 'Random weapon', CLASSES[p.cls] ? CLASSES[p.cls].name : null, o && o.key !== 'none' ? o.name : null, pet && pet.key !== 'none' ? pet.name : null].filter(Boolean).join(' · ') })),
    uiButton('Use', () => { presetApply(k, lo); CREATOR.name = p.name; saveMenu(); refreshScreen(); }, 'go', { 'data-key': 'cr-use-' + k }),
    uiButton('✕', () => { presetDelete(k); refreshScreen(); }, 'cr-del', { 'aria-label': 'Delete ' + p.name, 'data-key': 'cr-del-' + k }));
}
// Every title is free; the two secret ones join the list once found. The title-screen badge shows the one worn.
function titlePicker() {
  return segFieldWrap('Title', listOf(TITLES).map(t => [t.key, t.name]), PROG.title, v => { PROG.title = v; progSave(); });
}
const segFieldWrap = (...a) => { const f = segField(...a); f.classList.add('wrap-seg'); return f; };

// ---------- Codex ----------
const CODEX_TAB = { tab: 'w' };
const CODEX_TABS = [['w', 'Weapons'], ['s', 'Skills'], ['c', 'Classes'], ['m', 'Arenas'], ['b', 'Bosses'], ['r', 'Realms'], ['p', 'Pets'], ['x', 'Secrets']];
SCREENS.codex = () => {
  const tabs = el('div', { class: 'cat-chips codex-tabs', role: 'tablist' }, CODEX_TABS.map(([k, t]) =>
    el('button', { 'aria-pressed': String(CODEX_TAB.tab === k), 'data-key': 'cx-' + k, onclick: () => { CODEX_TAB.tab = k; uiSfx('click'); refreshScreen(); } }, t)));
  const entries = codexEntries(CODEX_TAB.tab);
  const entry = CODEX_TAB.tab === 'x' ? codexCodeEntry() : null;   // type a secret code here (phones have no title-screen keyboard)
  return sheet('Codex', [tabs, entry, el('div', { class: 'trophy-grid codex-grid' }, entries.map(codexCard))], null);
};
// The Secrets tab's code box: letters and the four arrows go through cheatEnter (79); Enter or "Try code" submits.
const CODEX_ENTRY = { text: '' };
function codexCodeEntry() {
  const status = el('p', { class: 'hint cx-status' });
  const input = el('input', { class: 'cx-input', type: 'text', maxlength: 16, autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false',
    value: CODEX_ENTRY.text, placeholder: 'CODE', 'aria-label': 'Secret code', 'data-key': 'cx-code',
    oninput: e => { CODEX_ENTRY.text = e.target.value; },
    // The menu's key navigation (WASD, arrows, Backspace) must not act while typing; Escape still goes back.
    onkeydown: e => { if (e.key === 'Enter') tryCode(); if (e.key !== 'Escape') e.stopPropagation(); } });
  function tryCode() {
    const text = input.value.trim(), known = Object.keys(SECRETS).filter(secretFound), k = text && cheatEnter(text);
    if (k && !known.includes(k)) { CODEX_ENTRY.text = ''; refreshScreen(); return; }   // secretUnlock showed the toast
    uiSfx('deny');
    status.textContent = k ? `Already found: ${SECRETS[k].name}.` : text ? 'Nothing happened. The hints below may help.' : 'Type a code first.';
  }
  // The arrow buttons add their character without opening the on-screen keyboard: they never take the focus (the
  // mousedown is cancelled), and they only move the caret when the box is already being typed in.
  const arrow = ch => uiButton(ch, () => {
    const typing = document.activeElement === input, len = input.value.length;
    const at = typing && input.selectionStart != null ? input.selectionStart : len, to = typing && input.selectionEnd != null ? input.selectionEnd : len;
    input.value = CODEX_ENTRY.text = (input.value.slice(0, at) + ch + input.value.slice(to)).slice(0, 16);
    if (typing) { const pos = Math.min(at + 1, input.value.length); input.setSelectionRange(pos, pos); }
  }, 'cx-arrow', { 'aria-label': 'Arrow ' + ch, 'data-key': 'cx-arrow-' + { '↑': 'up', '↓': 'down', '←': 'left', '→': 'right' }[ch], onmousedown: e => e.preventDefault() });
  return el('section', { class: 'set-group cx-entry' }, el('h3', { text: 'Enter a code' }),
    el('div', { class: 'cx-row' }, input, el('div', { class: 'cx-arrows' }, ['↑', '↓', '←', '→'].map(arrow)), uiButton('Try code', tryCode, 'go', { 'data-key': 'cx-try' })),
    status);
}
function codexEntries(tab) {
  const reg = (kind, list, icon, lore = kind) => list.map(d => ({ name: d.name, icon: icon(d), text: d.desc || '', lore: codexLore(lore, d.key, d.name, d.cat), stats: codexRow(kind, d.key),
    weapon: kind === 'w' ? d.key : null, palette: kind === 'm' ? d.palette : null }));
  if (tab === 'w') return reg('w', listOf(WEAPONS), d => CAT_ICONS[d.cat] || '⚔');
  if (tab === 's') return reg('s', listOf(SKILLS), d => d.icon);
  if (tab === 'c') return reg('c', listOf(CLASSES), d => d.icon);
  if (tab === 'm') return reg('m', listOf(MAPS), () => '🏟');
  if (tab === 'p') return reg('p', listOf(PETS).filter(d => d.key !== 'none'), d => d.icon);
  if (tab === 'b') return (typeof CAMP_NODES === 'object' ? CAMP_NODES : []).filter(n => n.kind === 'boss' || n.kind === 'mini').map(n => {
    const row = codexRow('b', n.id), boss = n.foes && n.foes[0] ? n.foes[0][0] : n.name, realm = CAMP_REALMS[n.r] || {};
    return { name: boss, icon: n.kind === 'boss' ? '👑' : '☠', text: `${n.kind === 'boss' ? 'Realm boss' : 'Mini-boss'} of ${realm.name || 'the realms'} · ${n.name}`,
      lore: row[0] ? codexLore('b', n.id, n.name) : 'Face this foe in the Mythic Quest to learn more.', stats: row, labels: ['Fought', 'Beaten'] };
  });
  if (tab === 'r') return (typeof CAMP_REALMS === 'object' ? CAMP_REALMS : []).map((r, i) => {
    const s = typeof campSave === 'function' ? campSave() : { stars: {} }, nodes = CAMP_NODES.filter(n => n.r === i);
    const cleared = nodes.filter(n => (s.stars || {})[n.id] > 0).length;
    return { name: r.name, icon: ['🔥', '❄', '☁', '🌑'][i] || '🗺', text: `${cleared}/${nodes.length} places cleared`, lore: codexLore('r', r.key, r.name),
      stats: [cleared, nodes.reduce((a, n) => a + ((s.stars || {})[n.id] || 0), 0)], labels: ['Cleared', 'Stars'] };
  });
  return Object.entries(SECRETS).map(([k, s]) => secretFound(k)   // found: the code (or feat) stays on the card and its lore joins it
    ? { name: s.name, icon: '🗝', text: `${s.reward} · ${s.code ? 'Code: ' + s.code : s.hint}`, lore: codexLore('x', k, s.name), found: true }
    : { name: '???', icon: '❔', text: 'Not found yet.', lore: 'Hint: ' + s.hint, hidden: true });
}
// A weapon shows its own drawing (the loadout's icon), an arena a swatch of its own sky; everything else keeps its emoji.
function codexIcon(e) {
  if (e.weapon && WEAPONS[e.weapon]) {   // the drawn tiles are cached and reused across rebuilds (uiTile, 96-ui-loadout)
    try { return uiTile(`cx|${e.weapon}`, 64, 34, 'cx-weapon', c => drawWeaponIcon(c, e.weapon, '#9fb4ff')); }
    catch (err) { return el('span', { class: 'tr-icon', text: e.icon }); }
  }
  if (e.palette && e.palette.sky1) return el('span', { class: 'tr-icon cx-swatch', style: { background: `linear-gradient(${e.palette.sky1}, ${e.palette.sky2 || e.palette.sky1} 70%, ${e.palette.ground || e.palette.sky2})`, borderColor: e.palette.line || '' } });
  return el('span', { class: 'tr-icon', text: e.icon });
}
function codexCard(e) {
  const labels = e.labels || ['Used', 'Won', 'K.O.s'];
  return el('div', { class: 'trophy codex-card' + (e.hidden ? '' : ' got'), tabindex: '0' },
    codexIcon(e),
    el('div', {}, el('strong', { text: e.name }), e.text ? el('small', { text: e.text }) : null, el('em', { class: 'cx-lore', text: e.lore }),
      e.stats ? el('div', { class: 'cx-stats' }, labels.map((l, k) => el('span', {}, l + ' ', el('b', { text: String(e.stats[k] || 0) })))) : null));
}

// ---------- arena screen: mutators; settings: mini-games ----------
const mutVisible = m => !m.secret || secretFound(m.secret);
function mutatorsPicked() {
  const mode = MODES[MENU.mode] || {};
  if (MUT_OFF_MODES.has(mode.key)) return [];
  return (MENU.mutators || []).filter(k => MUTATORS[k] && mutVisible(MUTATORS[k]) && !mutBlocked(mode.key, k));
}
function mutatorPanel() {
  const mode = MODES[MENU.mode] || {}, on = new Set(MENU.mutators || []);
  const toggle = k => { on.has(k) ? on.delete(k) : on.add(k); MENU.mutators = [...on]; saveMenu(); uiSfx('click'); refreshScreen(); };
  if (MUT_OFF_MODES.has(mode.key)) return el('section', { class: 'mut-panel' }, el('h4', { text: 'Mutators' }), el('p', { class: 'hint', text: `${mode.name} plays without mutators.` }));
  return el('section', { class: 'mut-panel' }, el('h4', { text: `Mutators${on.size ? ` · ${mutatorsPicked().length} on` : ''}` }),
    el('div', { class: 'mut-grid' }, listOf(MUTATORS).filter(m => mutVisible(m) && !mutBlocked(mode.key, m.key)).map(m => el('button', { class: 'mut-chip', 'aria-pressed': String(on.has(m.key)), 'data-key': 'mut-' + m.key,
      title: m.desc, onclick: () => toggle(m.key) }, el('b', { text: m.icon }), el('strong', { text: m.name })))));
}
function miniSettingField() {
  return segField('Party mini-games', [['auto', 'Party modes'], ['on', 'Always'], ['off', 'Off']], SETTINGS.minigames || 'auto', v => setSetting('minigames', v));
}

// ---------- title screen: menu items, title badge, cheat codes ----------
// The Fighter Creator gets its own row above Trophies & Stats and the Codex sits beside How to Play, so the title menu
// keeps its rows (it must still fit a 720 px screen).
function progMenuItems(list) {
  const item = (label, sub, onclick) => el('button', { class: 'menu-item', 'data-key': 'mi-' + label, onclick: () => { uiSfx('click'); onclick(); } },
    el('span', { class: 'mi-label', text: label }), el('small', { text: sub }));
  const creator = item('Fighter Creator', `${presetList().length}/${PRESET_MAX} presets · outfits, pets, titles`, () => { CREATOR.picker = 0; CREATOR.name = ''; openScreen('creator', 'menu'); });
  const trophies = progMenuRow(list, /^Trophies/);
  if (trophies) trophies.before(creator); else list.append(creator);
  const howto = progMenuRow(list, /^How to Play/), codex = item('Codex', `${Object.keys(PROG.secrets).length}/${Object.keys(SECRETS).length} secrets`, () => openScreen('codex', 'menu'));
  if (!howto) { list.append(codex); return; }
  const pair = howto.classList.contains('menu-pair') ? howto : el('div', { class: 'menu-pair' });
  if (pair !== howto) { howto.replaceWith(pair); pair.append(howto); }
  pair.append(codex);
}
// The row holding the menu item whose label matches: its pair, or the item itself.
function progMenuRow(list, re) {
  const label = [...list.querySelectorAll('.mi-label')].find(l => re.test(l.textContent)), host = label && label.closest('.menu-item');
  return host && host.parentNode.classList.contains('menu-pair') ? host.parentNode : host;
}
on('boot', () => {
  const wrap = (name, fn) => { const build = SCREENS[name]; SCREENS[name] = () => { const node = build(); try { fn(node); } catch (e) { report(e, 'progress ui ' + name); } return node; }; };
  wrap('menu', node => {
    const list = node.querySelector('.menu-list');
    if (list) progMenuItems(list);
    const foot = node.querySelector('.title-foot'), title = TITLES[PROG.title];
    if (foot && title && !title.hidden) foot.insertBefore(el('button', { class: 'title-badge', 'data-key': 'title-badge', title: 'Your title: change it in the Fighter Creator',
      onclick: () => { uiSfx('click'); CREATOR.picker = 0; CREATOR.name = ''; openScreen('creator', 'menu'); } }, el('span', { 'aria-hidden': 'true', text: title.icon }), el('b', { text: title.name })), foot.children[1] || null);
  });
  wrap('maps', node => { const body = node.querySelector('.sheet-body'); if (body) body.prepend(mutatorPanel()); });   // above the arenas: easy to find on phones
  wrap('settings', node => { const g = [...node.querySelectorAll('.set-group')].find(x => /Match/.test(x.querySelector('h3').textContent)); if (g) g.insertBefore(miniSettingField(), g.lastChild); });
  if (UI.screen === 'menu' && G_STATE.state === 'menu') refreshScreen();
});
addEventListener('keydown', e => {
  if (e.repeat || G_STATE.state !== 'menu' || UI.screen !== 'menu' || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (cheatKey(e.code)) refreshScreen();
});
