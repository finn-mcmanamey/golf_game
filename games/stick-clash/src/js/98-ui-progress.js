// 98-ui-progress.js: screens for the v3 customisation and progression: the loadout's Look tab (outfit, weapon skin,
// pet, K.O. effect, victory pose), preset chips, the Fighter Creator, Track & Quests, the Codex, mutators on the
// arena screen, the mini-game setting, XP on the results card, title-screen menu items and cheat-code typing.
// Look fields live flat on each menu loadout (lo.outfit, lo.skins = { cat: key }, lo.ko, lo.pet, lo.pose).

const LOOK_DEFAULT = { outfit: 'none', ko: 'none', pet: 'none', pose: 'cheer' };
const LOOK_TAB = { cat: null };

// ---------- loadout -> match look ----------
// Humans wear only what they own; a CPU picker may leave the outfit on 'random'.
function lookForMatch(lo, cpu) {
  const out = { skins: {} };
  for (const kind in LOOK_DEFAULT) {
    const v = lo[kind] || (cpu && kind === 'outfit' ? 'random' : LOOK_DEFAULT[kind]), reg = LOOKS[kind];
    if (v === 'random') out[kind] = randomKey(reg, d => d.key !== 'none');
    else out[kind] = reg[v] && (cpu || lookOwned(kind, v)) ? v : LOOK_DEFAULT[kind];
  }
  for (const cat in lo.skins || {}) if (WSKINS[lo.skins[cat]] && (cpu || lookOwned('skin', lo.skins[cat]))) out.skins[cat] = lo.skins[cat];
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
const trackLevelOf = (kind, key) => { const t = TRACK_ITEMS.find(([, k, v]) => k === kind && v === key); return t ? t[0] : null; };
function lookLockText(kind, key) {
  const lvl = trackLevelOf(kind, key);
  return lvl ? `🔒 Lv ${lvl}` : '🔒 Secret';
}
function lookTile(kind, def, selected, onpick, cpu) {
  const owned = cpu || lookOwned(kind, def.key);
  return el('button', { class: 'tile look-tile' + (selected ? ' sel' : '') + (owned ? '' : ' locked'), 'data-key': `${kind}-${def.key}`, title: def.desc || def.name,
    onclick: () => { if (!owned) { uiSfx('deny'); toast(def.name, `Unlocks on the progression track (${lookLockText(kind, def.key).slice(3)}).`, def.icon, '#5ef2ff'); return; } onpick(def.key); } },
  el('span', { class: 'big-icon', text: def.icon }), el('span', { text: def.name }),
  owned ? null : el('em', { class: 'price', text: lookLockText(kind, def.key) }));
}
function lookSection(title, kind, lo, cpu, extra) {
  const set = v => { lo[kind] = v; saveMenu(); uiSfx('click'); refreshScreen(); };
  const cur = lo[kind] || (cpu && kind === 'outfit' ? 'random' : LOOK_DEFAULT[kind]);
  const tiles = listOf(LOOKS[kind]).map(d => lookTile(kind, d, cur === d.key, set, cpu));
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
    el('div', { class: 'tile-grid look-grid' }, listOf(WSKINS).map(d => lookTile('skin', d, (lo.skins[cat] || 'none') === d.key, set, cpu)))];
}
function lookTab(i, lo) {
  const cpu = isCpuPicker(i);
  return el('div', { class: 'tab-body' },
    el('p', { class: 'hint', text: 'Outfits sway with real cloth physics. Earn more on the progression track (Track & Quests).' }),
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
    lo.preset = CREATOR.name.trim() || 'Fighter'; saveMenu(); uiSfx('coin'); toast('Preset saved', lo.preset, '💾', '#5dff9a'); refreshScreen();
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
function titlePicker() {
  const owned = listOf(TITLES).filter(t => lookOwned('title', t.key));
  return segFieldWrap('Title', owned.map(t => [t.key, t.name]), PROG.title, v => { PROG.title = v; progSave(); });
}
const segFieldWrap = (...a) => { const f = segField(...a); f.classList.add('wrap-seg'); return f; };

// ---------- Track & Quests ----------
const PROG_TAB = { tab: 'track' };
SCREENS.progress = () => {
  const tabs = el('div', { class: 'seg sub-tabs', role: 'tablist' }, [['track', 'Track'], ['quests', 'Quests']].map(([k, t]) =>
    el('button', { 'aria-pressed': String(PROG_TAB.tab === k), 'data-key': 'pg-' + k, onclick: () => { PROG_TAB.tab = k; uiSfx('click'); refreshScreen(); } }, t)));
  return sheet('Track & Quests', [levelBar(), tabs, PROG_TAB.tab === 'track' ? trackGrid() : questLists()], null);
};
function levelBar() {
  const L = trackLevel(PROG.xp), pct = L.need ? L.into / L.need * 100 : 100;
  return el('div', { class: 'lvl-bar' }, el('b', { class: 'lvl-num', text: `Lv ${L.lvl}` }),
    el('div', { class: 'lvl-track' }, el('i', { style: { width: pct.toFixed(1) + '%' } })),
    el('span', { text: L.need ? `${L.into} / ${L.need} XP` : 'MAX' }),
    el('em', { text: TITLES[PROG.title] ? TITLES[PROG.title].name : '' }));
}
function trackGrid() {
  const L = trackLevel(PROG.xp).lvl;
  const tiles = [];
  for (let l = 2; l <= TRACK_MAX; l++) {
    const r = TRACK[l], got = l <= L, cls = 'tile track-tile' + (got ? ' got' : '') + (l === L + 1 ? ' next' : '') + (r.kind !== 'coins' ? ' item' : '');
    tiles.push(el('div', { class: cls, tabindex: '0', 'data-key': 'lvl-' + l }, el('small', { text: 'Lv ' + l }),
      el('span', { class: 'big-icon', text: trackIcon(r) }), el('span', { text: trackRewardName(r).split(' · ')[0] })));
  }
  return el('div', {}, el('p', { class: 'hint', text: 'XP comes from every match, the Mythic Quest, challenges and quests. Every level pays out. The Shop still sells hats and colours for coins.' }),
    el('div', { class: 'tile-grid track-grid' }, tiles));
}
function questLists() {
  const s = tasksNow(), reroll = taskCanReroll();
  const card = (t, kind, k) => el('div', { class: 'trophy quest-card' + (t.done ? ' got' : ''), tabindex: '0' },
    el('span', { class: 'tr-icon', text: t.done ? '✅' : kind === 'daily' ? '📜' : '🗓' }),
    el('div', {}, el('strong', { text: taskText(t) }),
      el('div', { class: 'tr-prog' }, el('b', { style: { '--v': (t.n / t.need * 100).toFixed(0) + '%' } }), el('span', { text: `${t.n}/${t.need}` }))),
    el('div', { class: 'q-side' }, el('span', { class: 'tr-coins', text: `+${TASK_REWARD[kind].xp} XP` }),
      kind === 'daily' && !t.done && reroll ? uiButton('↻ Reroll', () => { taskReroll(k); refreshScreen(); }, 'q-reroll', { 'data-key': 'reroll-' + k }) : null));
  const until = d => { const h = Math.ceil((d - Date.now()) / 36e5); return h > 24 ? `${Math.ceil(h / 24)} days` : `${h} h`; };
  const now = new Date(), tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7 - (now.getDay() + 6) % 7);
  return el('div', { class: 'quest-wrap' },
    el('h4', { text: `Daily quests · new in ${until(tomorrow)}` + (reroll ? ' · one reroll left today' : '') }),
    el('div', { class: 'trophy-grid' }, s.daily.map((t, k) => card(t, 'daily', k))),
    el('h4', { text: `Weekly quests · new in ${until(monday)}` }),
    el('div', { class: 'trophy-grid' }, s.weekly.map((t, k) => card(t, 'weekly', k))),
    el('p', { class: 'hint', text: `Daily: +${TASK_REWARD.daily.xp} XP and ${TASK_REWARD.daily.coins} coins. Weekly: +${TASK_REWARD.weekly.xp} XP and ${TASK_REWARD.weekly.coins} coins. Only real matches count.` }));
}

// ---------- Codex ----------
const CODEX_TAB = { tab: 'w' };
const CODEX_TABS = [['w', 'Weapons'], ['s', 'Skills'], ['c', 'Classes'], ['m', 'Arenas'], ['b', 'Bosses'], ['r', 'Realms'], ['p', 'Pets'], ['x', 'Secrets']];
SCREENS.codex = () => {
  const tabs = el('div', { class: 'cat-chips codex-tabs', role: 'tablist' }, CODEX_TABS.map(([k, t]) =>
    el('button', { 'aria-pressed': String(CODEX_TAB.tab === k), 'data-key': 'cx-' + k, onclick: () => { CODEX_TAB.tab = k; uiSfx('click'); refreshScreen(); } }, t)));
  const entries = codexEntries(CODEX_TAB.tab);
  return sheet('Codex', [tabs, el('div', { class: 'trophy-grid codex-grid' }, entries.map(codexCard))], null);
};
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
      lore: row[0] ? codexLore('m', n.id, n.name) : 'Face this foe in the Mythic Quest to learn more.', stats: row, labels: ['Fought', 'Beaten'] };
  });
  if (tab === 'r') return (typeof CAMP_REALMS === 'object' ? CAMP_REALMS : []).map((r, i) => {
    const s = typeof campSave === 'function' ? campSave() : { stars: {} }, nodes = CAMP_NODES.filter(n => n.r === i);
    const cleared = nodes.filter(n => (s.stars || {})[n.id] > 0).length;
    return { name: r.name, icon: ['🔥', '❄', '☁', '🌑'][i] || '🗺', text: `${cleared}/${nodes.length} places cleared`, lore: codexLore('m', r.key, r.name),
      stats: [cleared, nodes.reduce((a, n) => a + ((s.stars || {})[n.id] || 0), 0)], labels: ['Cleared', 'Stars'] };
  });
  return Object.entries(SECRETS).map(([k, s]) => secretFound(k)
    ? { name: s.name, icon: '🗝', text: s.reward, lore: s.code ? `Code: ${s.code}` : s.hint, found: true }
    : { name: '???', icon: '❔', text: 'Not found yet.', lore: 'Hint: ' + s.hint, hidden: true });
}
// A weapon shows its own drawing (the loadout's icon), an arena a swatch of its own sky; everything else keeps its emoji.
function codexIcon(e) {
  if (e.weapon && WEAPONS[e.weapon]) {
    const c = uiCanvas(64, 34, 'cx-weapon');
    try { drawWeaponIcon(c, e.weapon, '#9fb4ff'); } catch (err) { return el('span', { class: 'tr-icon', text: e.icon }); }
    return c;
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

// ---------- results: XP and levels ----------
function xpBox() {
  if (!PROG_MATCH.done || !PROG_MATCH.xp) return null;
  const L = trackLevel(PROG.xp);
  return el('div', { class: 'reward xp-box' },
    el('div', { class: 'reward-total' }, el('b', { text: `+${PROG_MATCH.xp}` }), ' XP', el('span', { class: 'xp-lvl', text: `Lv ${L.lvl}` })),
    el('div', { class: 'lvl-track' }, el('i', { style: { width: (L.need ? L.into / L.need * 100 : 100).toFixed(1) + '%' } })),
    el('ul', {}, PROG_MATCH.lines.map(([why, n]) => el('li', {}, why, el('span', { text: `+${n}` }))),
      PROG_MATCH.ups.map(l => el('li', { class: 'ach' }, `${trackIcon(TRACK[l])} Level ${l}: ${trackRewardName(TRACK[l])}`, el('span', { text: '★' })))));
}
on('state', now => {
  if (now !== 'over' || !PANELS.over) return;
  progSettle();
  const card = PANELS.over.querySelector('.results-card'), row = card && card.querySelector(':scope > .row'), box = xpBox();
  if (card && box) card.insertBefore(box, row);
});

// ---------- title screen: menu items, level badge, cheat codes ----------
// The new items join existing rows (the title menu must still fit 720 px): Shop | Creator | Track, How to Play | Codex.
function progMenuItems(list) {
  const item = (label, sub, onclick) => el('button', { class: 'menu-item', 'data-key': 'mi-' + label, onclick: () => { uiSfx('click'); onclick(); } },
    el('span', { class: 'mi-label', text: label }), el('small', { text: sub }));
  const s = tasksNow(), done = s.daily.filter(t => t.done).length;
  progMenuJoin(list, /^Shop/, [item('Creator', `${presetList().length} presets`, () => { CREATOR.picker = 0; CREATOR.name = ''; openScreen('creator', 'menu'); }),
    item('Track', `Lv ${trackLevel(PROG.xp).lvl} · ${done}/3 daily`, () => openScreen('progress', 'menu'))]);
  progMenuJoin(list, /^How to Play/, [item('Codex', `${Object.keys(PROG.secrets).length}/${Object.keys(SECRETS).length} secrets`, () => openScreen('codex', 'menu'))]);
}
// Puts items beside the menu item whose label matches (in its row, or a new row at the end of the list).
function progMenuJoin(list, re, items) {
  const label = [...list.querySelectorAll('.mi-label')].find(l => re.test(l.textContent)), host = label && label.closest('.menu-item');
  if (!host) { list.append(...items); return; }
  let row = host.parentNode;
  if (!row.classList.contains('menu-pair')) { row = el('div', { class: 'menu-pair' }); host.replaceWith(row); row.append(host); }
  row.append(...items);
  if (row.children.length > 2) row.classList.add('menu-trio');
}
on('boot', () => {
  const wrap = (name, fn) => { const build = SCREENS[name]; SCREENS[name] = () => { const node = build(); try { fn(node); } catch (e) { report(e, 'progress ui ' + name); } return node; }; };
  wrap('menu', node => {
    const list = node.querySelector('.menu-list');
    if (list) progMenuItems(list);
    const foot = node.querySelector('.title-foot');
    if (foot) foot.insertBefore(el('button', { class: 'lvl-badge', 'data-key': 'lvl-badge', onclick: () => openScreen('progress', 'menu') },
      el('b', { text: 'Lv ' + trackLevel(PROG.xp).lvl }), el('span', { text: TITLES[PROG.title] ? TITLES[PROG.title].name : '' })), foot.children[1] || null);
  });
  wrap('maps', node => { const body = node.querySelector('.sheet-body'); if (body) body.prepend(mutatorPanel()); });   // above the arenas: easy to find on phones
  wrap('settings', node => { const g = [...node.querySelectorAll('.set-group')].find(x => /Match/.test(x.querySelector('h3').textContent)); if (g) g.insertBefore(miniSettingField(), g.lastChild); });
  if (UI.screen === 'menu' && G_STATE.state === 'menu') refreshScreen();
});
addEventListener('keydown', e => {
  if (e.repeat || G_STATE.state !== 'menu' || UI.screen !== 'menu' || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (cheatKey(e.code)) refreshScreen();
});
