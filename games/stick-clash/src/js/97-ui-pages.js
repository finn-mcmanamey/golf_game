// 97-ui-pages.js: settings, controls (key rebinding + gamepad help), how to play, shop, trophies & stats, the pause
// menu and the results screen, plus the wiring that shows the right panel for each game state.

// ---------- settings ----------
// Changes made from the pause menu also reach the running match where that makes sense (speed, items, kill-cam).
function setSetting(key, value) {
  SETTINGS[key] = value;
  saveSettings();
  const cfg = G_STATE.cfg;
  if (cfg && !G_STATE.demo) {
    Object.assign(cfg, { speed: SETTINGS.speed, orbs: SETTINGS.items !== 'off', orbRate: ITEM_RATES[SETTINGS.items] || 1, killcam: !!SETTINGS.killcam });
    // The match mutators (79) edited these same fields at match start and won't run again on a restart: put them back.
    if (mutActive('speed')) cfg.speed *= 1.5;
    if (mutActive('orbstorm')) { cfg.orbs = true; cfg.orbRate *= 3; }
  }
}

SCREENS.settings = () => {
  const S = SETTINGS, set = k => v => setSetting(k, v);
  const group = (title, ...fields) => el('section', { class: 'set-group' }, el('h3', { text: title }), fields);
  const body = el('div', { class: 'set-grid' },
    group('Match',
      stepper('Rounds to win', S.rounds, 1, 9, set('rounds')),
      segField('Health', [[.5, '×0.5'], [.75, '×0.75'], [1, '×1'], [1.5, '×1.5'], [2, '×2']], S.hpMul, set('hpMul')),
      segField('Game speed', [[.75, '75%'], [1, '100%'], [1.25, '125%'], [1.5, '150%']], S.speed, set('speed')),
      segField('Power-up orbs', [['off', 'Off'], ['low', 'Few'], ['normal', 'Normal'], ['high', 'Lots']], S.items, set('items')),
      diffPicker(),
      el('p', { class: 'hint', text: 'Rounds apply to duel modes (others set their own). Rounds and health take effect from the next match.' })),
    group('Effects',
      toggleField('Kill-cam replays', S.killcam, set('killcam'), 'Replay the deciding K.O. in slow motion.'),
      toggleField('Screen shake', S.shake, set('shake')),
      toggleField('Damage numbers', S.dmgNumbers, set('dmgNumbers')),
      toggleField('Camera follow', CAM.follow, v => { CAM.follow = v; store.set('camera', v); }, 'Zoom in on the action.'),
      segField('Particles', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], S.particles, set('particles'))),
    group('Sound',
      toggleField('Sound', !MUTED, v => setMuted(!v), 'M mutes at any time.'),
      sliderField('Master volume', S.master, set('master')),
      sliderField('Effects volume', S.sfx, set('sfx')),
      sliderField('Music volume', S.music, set('music'))));
  const reset = uiButton('Reset to defaults', () => {
    Object.assign(SETTINGS, SETTING_DEFAULTS); saveSettings();
    CAM.follow = true; store.set('camera', true); MENU.diff = 'normal';   // choices kept outside SETTINGS
    MENU.mutators = []; store.set('weather', 'random'); saveMenu();
    if (MUTED) setMuted(false);
    if (typeof setSetting === 'function') setSetting('rounds', SETTINGS.rounds);   // pushes the reset speed and items into a running match
    refreshScreen();
  });
  return sheet('Settings', body, [reset, el('button', { class: 'go', onclick: () => { uiSfx('click'); goBack(); } }, 'Done')]);
};

// ---------- controls ----------
SCREENS.controls = () => {
  const grid = el('div', { class: 'binds' }, el('span'), el('h3', { text: 'Player 1' }), el('h3', { text: 'Player 2' }));
  for (const a of BIND_ACTIONS) {
    grid.append(el('span', { text: ACTION_LABELS[a] }));
    for (const slot of [0, 1]) {
      const btn = el('button', { class: 'key', 'data-key': `bind-${slot}-${a}`, text: keyLabel(BINDS[slot][a]) });
      btn.onclick = () => {
        bindStopListening();                     // only one key listens at a time
        btn.textContent = 'Press a key…'; btn.classList.add('listening'); uiSfx('click');
        captureNextKey(code => bindCaptured(slot, a, code));
      };
      grid.append(btn);
    }
  }
  const pads = readPadList();
  const padRows = [['Stick / D-pad', 'Move'], ['A', 'Jump (again in the air: double jump; at a wall: wall jump)'], ['X', 'Attack'], ['B', 'Skill 1'],
    ['Y', 'Skill 2'], ['RB', 'Dash'], ['LT (hold)', 'Block · tap it just before a hit to parry'], ['RT', 'Grab, press again to throw'],
    ['LB', 'Throwable'], ['R3 · Back', 'Super (when the meter is full)'], ['D-pad ↑', 'Taunt (from a safe distance: a little super)'], ['Start', 'Pause'], ['In menus', 'D-pad moves, A selects, B goes back']];
  const padCard = el('section', { class: 'set-group' }, el('h3', { text: 'Gamepads' }),
    el('p', { class: 'hint', text: pads.length ? `Connected: ${pads.map(p => p.id.replace(/\s*\(.*\)/, '')).join(', ')}` : 'No gamepad found. Plug one in and press a button.' }),
    el('dl', { class: 'pad-map' }, padRows.map(([k, v]) => [el('dt', {}, el('kbd', { text: k })), el('dd', { text: v })])),
    el('p', { class: 'hint', text: 'With one player, P1 answers to both key sets and every gamepad. With two, pad 1 is P1 and pad 2 is P2.' }));
  const keysCard = el('section', { class: 'set-group' }, el('h3', { text: 'Keyboard' }),
    el('p', { class: 'hint', text: 'Click a key, then press the new one (Esc cancels). Double-tap left or right to dash. Block + attack also grabs. Esc or P pauses, M mutes (both reserved).' }),
    grid);
  return sheet('Controls', el('div', { class: 'set-grid two' }, keysCard, padCard),
    [uiButton('Reset keys', () => { resetBinds(); refreshScreen(); }), el('button', { class: 'go', onclick: () => { uiSfx('click'); goBack(); } }, 'Done')]);
};

// A key pressed while a bind button listens. Ignored if the Controls screen is gone; pause/mute keys are refused.
function bindCaptured(slot, action, code) {
  if (UI.screen !== 'controls' || !PANELS.controls || PANELS.controls.hidden) return;
  if (RESERVED_KEYS.has(code) && code !== 'Escape') { uiSfx('deny'); toast(`${keyLabel(code)} is reserved`, 'P pauses and M mutes. Pick another key.', '⌨', '#ff8a2e'); }
  else if (code !== 'Escape') setBind(slot, action, code);
  refreshScreen();
}
// Cancels a pending rebind and puts the listening button's label back.
function bindStopListening() {
  cancelKeyCapture();
  REMAP.listen = null;             // the gamepad remap grid listens too; leaving any screen stops it
  // Only the keyboard grid has 'bind-<slot>-<action>' keys; the pad grid ('pad-<action>') is rebuilt by its own screen.
  for (const b of document.querySelectorAll('.binds:not(.padbinds) .key.listening')) {
    const [, slot, action] = b.dataset.key.split('-');
    if (!BINDS[+slot]) continue;
    b.classList.remove('listening'); b.textContent = keyLabel(BINDS[+slot][action]);
  }
}
// Clicking anywhere else (Done, Back, another tab) stops listening.
addEventListener('pointerdown', e => { if (KEY_CAPTURE && !(e.target.closest && e.target.closest('.key.listening'))) bindStopListening(); }, true);

// ---------- how to play ----------
SCREENS.howto = () => {
  const k = (s, a) => el('kbd', { text: keyLabel(BINDS[s][a]) });
  const card = (icon, title, ...kids) => el('section', { class: 'help-card' }, el('h3', {}, el('span', { text: icon }), title), kids);
  const orbs = listOf(ORBS).map(o => el('li', {}, el('b', { style: { color: o.color, borderColor: o.color }, text: o.icon }), el('span', {}, el('strong', { text: o.name }), ' ' + (o.desc || ''))));
  const body = el('div', { class: 'help-grid' },
    card('🎯', 'The goal', el('p', { text: 'Knock out your rival to win the round. Win enough rounds to take the match. Falling into a pit or off the edge is a ring-out. If time runs out, whoever has more health left wins.' })),
    card('🕹', 'Moving',
      el('p', {}, 'P1: ', k(0, 'left'), k(0, 'right'), ' move, ', k(0, 'jump'), ' jump (tap for a hop, again in the air for a double jump), ', k(0, 'dash'), ' or double-tap to dash.'),
      el('p', {}, 'P2: ', k(1, 'left'), k(1, 'right'), ' move, ', k(1, 'jump'), ' jump, ', k(1, 'dash'), ' dash.')),
    card('⚔', 'Fighting',
      el('p', {}, 'Attack (', k(0, 'attack'), ' / ', k(1, 'attack'), ') swings your weapon. Damage comes from speed: a fast tip hits hard, a slow nudge does nothing. Head hits deal 1.5×. Two weapons meeting at speed clash and bounce apart.'),
      el('p', { text: 'Guns and magic aim at the nearest foe on their own. Watch your ammo and reload bar in the corner.' })),
    card('✦', 'Skills',
      el('p', {}, 'Each fighter carries two skills (', k(0, 'skill1'), k(0, 'skill2'), ' / ', k(1, 'skill1'), k(1, 'skill2'), '). The icons under your health bar fill up as the cooldown recovers.')),
    card('◆', 'Block and parry',
      el('p', {}, 'Hold ', k(0, 'block'), ' / ', k(1, 'block'), ' to raise your guard: hits from the front only chip you, but each one drains the stamina bar under your health. Empty it and your guard breaks (you are stunned).'),
      el('p', { text: 'Raise the guard just before a hit lands (a fresh press, not held) to PARRY: no damage, stamina back, and the attacker is staggered. A parried shot flies back at the shooter.' })),
    card('✋', 'Grab and throw',
      el('p', {}, 'Up close, press ', k(0, 'grab'), ' / ', k(1, 'grab'), ' (or block + attack) to grab. Grabs go straight through a guard. Press again to throw them the way you are holding: they tumble like a rag doll. Grabbed? Mash any button to break free.')),
    card('🧱', 'Walls',
      el('p', { text: 'In the air, hold toward a wall to slide down it slowly, and press jump to kick off it. Works on the arena edges and on tall blocks.' })),
    card('♜', 'Classes',
      el('p', { text: 'Pick a class in the loadout. Each changes health, speed and weight and adds a passive:' }),
      el('ul', { class: 'orb-list' }, listOf(CLASSES).map(c => el('li', {}, el('b', { style: { color: c.color, borderColor: c.color }, text: c.icon }),
        el('span', {}, el('strong', { text: c.name }), ' ' + c.passive))))),
    card('★', 'Super and ultimates',
      el('p', {}, 'Dealing and taking damage fills the gold super meter. When it glows, press ', k(0, 'super'), ' / ', k(1, 'super'), ' to unleash your weapon type\'s ultimate:'),
      el('ul', { class: 'orb-list' }, Object.keys(ULTIMATES).map(cat => el('li', {}, el('b', { style: { color: ULTIMATES[cat].color, borderColor: ULTIMATES[cat].color }, text: CAT_ICONS[cat] || '★' }),
        el('span', {}, el('strong', { text: ULTIMATES[cat].name }), ' ' + (CAT_NAMES[cat] || cat)))))),
    card('⬆', 'Weapon levels',
      el('p', { text: 'Your weapon levels up as it deals damage, for the rest of the match: Lv2 reaches further and hits harder, Lv3 hits harder still and leaves an elemental trail that burns, chills, shocks or poisons.' })),
    card('●', 'Throwables',
      el('p', {}, 'Pick two in the loadout; each can be thrown once a round with ', k(0, 'throw'), ' / ', k(1, 'throw'), '. They are lobbed at the nearest foe.'),
      el('ul', { class: 'orb-list' }, listOf(THROWABLES).map(t => el('li', {}, el('b', { style: { color: t.color, borderColor: t.color }, text: t.icon }),
        el('span', {}, el('strong', { text: t.name }), ' ' + t.desc))))),
    card('✊', 'Disarms and supply drops',
      el('p', { text: 'A big hit can knock the weapon out of a hand. It lands on the ground for anyone to take: walk over it bare-handed, or press grab next to it to swap. Fight on with your fists; after 5 seconds a supply crate with a random weapon parachutes in next to you.' })),
    card('◉', 'Power-up orbs', el('p', { text: 'Glowing orbs appear on floors and platforms. Walk through one to grab it. Elemental orbs fuse with your weapon for the round (a flaming chainsaw!). Rare mount orbs give you a hoverboard, mech suit, jetpack or dragon for a few seconds.' }), el('ul', { class: 'orb-list' }, orbs)),
    card('🌋', 'Arenas', el('p', { text: 'Lava, spikes and electric floors hurt. Bottomless arenas have no floor, so knockback can win the round. Moving platforms carry you; you can jump up through thin ledges.' })),
    card('💡', 'Tips', el('ul', {},
      el('li', { text: 'Jump and swing: an airborne spin carries extra speed.' }),
      el('li', { text: 'Dash out of trouble, then turn and strike while they recover.' }),
      el('li', { text: 'Heavy weapons hit hard but swing slowly. Light ones combo.' }),
      el('li', { text: 'Coins from every match buy hats and colours in the Shop.' }))));
  return sheet('How to play', body, [el('button', { class: 'go', onclick: () => { uiSfx('click'); goBack(); } }, 'Got it')]);
};

// ---------- shop ----------
const SHOP = { tab: 'hats' };
SCREENS.shop = () => {
  const lo = menuLoadout(0);
  const tabs = el('div', { class: 'seg sub-tabs', role: 'tablist' }, [['hats', 'Hats'], ['colors', 'Colour packs']].map(([k, t]) =>
    el('button', { 'aria-pressed': String(SHOP.tab === k), 'data-key': 'shop-' + k, onclick: () => { SHOP.tab = k; uiSfx('click'); refreshScreen(); } }, t)));
  const wear = key => { lo.hat = key; saveMenu(); uiSfx('click'); refreshScreen(); };
  const hats = listOf(HATS).filter(h => h.key !== 'none').sort((a, b) => (a.price || 0) - (b.price || 0) || a.order - b.order).map(h => {
    const owned = ownsHat(h.key), c = uiCanvas(110, 96), asking = LO.confirm === 'hat:' + h.key, worn = lo.hat === h.key;
    drawHatIcon(c, h.key, lo.color);
    return el('button', { class: 'tile shop-tile' + (owned ? ' owned' : ' locked') + (worn ? ' sel' : '') + (asking ? ' asking' : ''), 'data-key': 'hat-' + h.key,
      onclick: () => owned ? wear(worn ? 'none' : h.key) : tryBuy('hat', h.key, () => wear(h.key)) },
    c, el('span', { text: h.name }),
    el('em', { class: 'price', text: owned ? (worn ? 'Wearing' : 'Owned · wear') : asking ? `Buy for ${h.price}?` : `🪙 ${h.price}` }));
  });
  const packs = COLOR_PACKS.filter(p => p.price > 0).map(p => {
    const owned = ownsPack(p.key), asking = LO.confirm === 'pack:' + p.key;
    return el('button', { class: 'tile pack-tile' + (owned ? ' owned' : ' locked') + (asking ? ' asking' : ''), 'data-key': 'pack-' + p.key,
      onclick: () => owned ? (uiSfx('click'), toast(p.name + ' is yours', 'Pick its colours in Loadout → Style.', '🎨', p.colors[0])) : tryBuy('pack', p.key) },
    el('span', { class: 'swatches' }, p.colors.map(c => el('i', { style: { background: c } }))),
    el('span', { text: p.name }),
    el('em', { class: 'price', text: owned ? 'Owned' : asking ? `Buy for ${p.price}?` : `🪙 ${p.price}` }));
  });
  const intro = el('p', { class: 'hint', text: 'Earn coins by playing: more for wins, harder CPUs, tournaments and trophies. Every weapon, skill and arena is free; the shop is just for style.' });
  return sheet('Shop', [intro, tabs, el('div', { class: 'tile-grid shop-grid' }, SHOP.tab === 'hats' ? hats : packs)], null);
};

// ---------- trophies and stats ----------
const STATS_TAB = { tab: 'trophies' };
function fmtTime(s) { const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${Math.floor(s % 60)}s`; }

SCREENS.stats = () => {
  const tabs = el('div', { class: 'seg sub-tabs', role: 'tablist' }, [['trophies', 'Trophies'], ['stats', 'Stats']].map(([k, t]) =>
    el('button', { 'aria-pressed': String(STATS_TAB.tab === k), 'data-key': 'st-' + k, onclick: () => { STATS_TAB.tab = k; uiSfx('click'); refreshScreen(); } }, t)));
  return sheet('Trophies & Stats', [tabs, STATS_TAB.tab === 'trophies' ? trophyGrid() : statsGrid()], null);
};

function trophyGrid() {
  const list = Object.values(ACHIEVEMENTS).sort((a, b) => (achDone(b.key) - achDone(a.key)) || a.order - b.order);
  const done = list.filter(a => achDone(a.key)).length;
  return el('div', {},
    el('p', { class: 'trophy-sum' }, el('b', { text: `${done} / ${list.length}` }), ' trophies unlocked'),
    el('div', { class: 'trophy-grid' }, list.map(a => {
      const need = achNeed(a), cur = Math.min(need, achProgress(a)), got = achDone(a.key);
      return el('div', { class: 'trophy' + (got ? ' got' : ''), tabindex: '0' },
        el('span', { class: 'tr-icon', text: a.icon }),
        el('div', {}, el('strong', { text: a.name }), el('small', { text: a.desc }),
          got ? el('em', { text: `Unlocked ${new Date(PROFILE.ach[a.key]).toLocaleDateString()}` })
            : el('div', { class: 'tr-prog' }, el('b', { style: { '--v': (cur / need * 100).toFixed(0) + '%' } }), el('span', { text: need > 1 ? `${Math.floor(cur)}/${need}` : '' }))),
        el('span', { class: 'tr-coins', text: `+${a.coins}` }));
    })));
}

function statsGrid() {
  const s = PROFILE.stats, fav = Object.entries(s.weaponUse).sort((a, b) => b[1] - a[1])[0];
  const tile = (label, value) => el('div', { class: 'stat-tile', tabindex: '0' }, el('b', { text: String(value) }), el('span', { text: label }));
  const rate = s.matches ? Math.round(s.wins / s.matches * 100) + '%' : '–';
  return el('div', {},
    el('div', { class: 'stat-grid' },
      tile('Matches', s.matches), tile('Wins', s.wins), tile('Win rate', rate), tile('Rounds won', s.roundsWon),
      tile('K.O.s', s.kos), tile('Ring-outs', s.ringouts), tile('Damage dealt', s.dmg.toLocaleString()), tile('Hits', s.hits.toLocaleString()),
      tile('Head hits', s.headHits), tile('Best combo', s.bestCombo), tile('Biggest hit', s.bigHit), tile('Skills used', s.skills),
      tile('Orbs grabbed', s.orbs), tile('Tournaments', s.tourneys), tile('Best wave', s.bestWave), tile('Time fighting', fmtTime(s.playTime)),
      tile('Coins earned', PROFILE.earned.toLocaleString()), tile('Favourite weapon', fav && WEAPONS[fav[0]] ? WEAPONS[fav[0]].name : '–')),
    el('h3', { class: 'sub', text: 'Wins against the CPU' }),
    el('div', { class: 'stat-grid' }, Object.keys(AI_LEVELS).map(k => tile(capital(k), s.cpuWins[k] || 0))));
}

// ---------- pause ----------
function buildPause() {
  const g = G_STATE, mode = g.mode || {};
  const score = g.score.length === 2 ? `${g.score[0]} – ${g.score[1]}` : g.score.join(' · ');
  return el('div', { class: 'card pause-card' },
    el('h2', { text: 'Paused' }),
    el('p', { class: 'tag', text: `${mode.name || ''} · Round ${g.round} · ${score}` }),
    el('div', { class: 'menu-list' },
      el('button', { class: 'go', onclick: () => { uiSfx('click'); setState('play'); } }, 'Resume'),
      uiButton('Restart match', () => startMatch(g.cfg)),
      uiButton('Settings', () => openScreen('settings', 'pause')),
      uiButton('Controls', () => openScreen('controls', 'pause')),
      uiButton('Quit to menu', toMenu)));
}

// ---------- results ----------
// Per roster slot across the whole match: damage, hits, KOs (from the round log) plus best combo and biggest hit.
function matchStats() {
  return G_STATE.roster.map((r, i) => {
    const s = { name: r.name, color: r.color, team: r.team, human: r.ctrl === 'human', dmg: 0, hits: 0, kos: 0, weapon: '',
      combo: MATCH_TRACK.combo[i] || 0, big: MATCH_TRACK.bigHit[i] || 0 };
    for (const round of G_STATE.log) {
      const f = round.fighters[i];
      if (f) { s.dmg += f.dmg; s.hits += f.hits; s.kos += f.kos; s.weapon = WEAPONS[f.wkey] ? WEAPONS[f.wkey].name : s.weapon; }
    }
    return s;
  });
}

function resultsTable() {
  const rows = matchStats(), best = Math.max(...rows.map(r => r.dmg));
  const th = t => el('th', { text: t });
  return el('div', { class: 'res-wrap' }, el('table', { class: 'res-table' },
    el('thead', {}, el('tr', {}, th('Fighter'), th('Damage'), th('Hits'), th('K.O.s'), th('Best combo'), th('Big hit'))),
    el('tbody', {}, rows.map(r => el('tr', {},
      el('td', {}, el('div', { class: 'res-who' }, el('i', { style: { background: r.color } }), el('b', { style: { color: r.color }, text: r.name }),
        r.dmg === best && best > 0 ? el('span', { class: 'mvp', text: 'MVP' }) : null, el('small', { text: r.weapon }))),
      el('td', { text: r.dmg }), el('td', { text: r.hits }), el('td', { text: r.kos }), el('td', { text: r.combo > 1 ? r.combo + '×' : '–' }),
      el('td', { text: r.big || '–' }))))));
}

function rewardBox() {
  const rw = settleMatch();
  if (!rw) return null;
  const unlocked = MATCH_TRACK.unlocked.map(k => ACHIEVEMENTS[k]).filter(Boolean);
  return el('div', { class: 'reward' },
    el('div', { class: 'reward-total' }, el('span', { class: 'coin-big', 'aria-hidden': 'true' }), el('b', { text: `+${rw.coins}` }), ' coins', coinBadge()),
    el('ul', {}, rw.lines.map(([why, n]) => el('li', {}, why, el('span', { text: `+${n}` }))),
      unlocked.map(a => el('li', { class: 'ach' }, `${a.icon} Trophy: ${a.name}`, el('span', { text: `+${a.coins}` })))));
}

function scoreLine() {
  const sc = G_STATE.score;
  if (G_STATE.mode && G_STATE.mode.noScore) return null;   // the mode's own result lines say who won (Juggernaut)
  if (sc.length !== 2) return el('p', { class: 'res-score small', text: sc.map((s, t) => `${teamName(t)} ${s}`).join(' · ') });
  return el('p', { class: 'res-score' }, el('b', { style: { color: teamColor(0) }, text: sc[0] }), el('span', { text: '–' }), el('b', { style: { color: teamColor(1) }, text: sc[1] }));
}

function buildResults() {
  const res = G_STATE.result || { title: 'Match over', lines: [] }, color = res.color || '#ffd84a';
  return el('div', { class: 'card wide results-card', style: { '--rc': color } },
    el('h2', { style: { color }, text: res.title }),
    scoreLine(),
    (res.lines || []).length ? el('div', { class: 'results-lines' }, res.lines.map(t => el('span', { text: t }))) : null,
    resultsTable(),
    rewardBox(),
    el('div', { class: 'row' },
      el('button', { class: 'go', onclick: () => { uiSfx('fight'); startMatch(G_STATE.cfg); } }, 'Rematch'),
      uiButton('Menu', toMenu),
      changeSetupButton()));
}
// Modes without loadout pickers (Weapon Roulette rolls everything) offer the arena screen instead.
function changeSetupButton() {
  if (!modePickers(G_STATE.mode)) return uiButton('Change arena', () => { UI.next = 'maps'; UI.back.maps = 'modes'; toMenu(); });
  return uiButton('Change loadout', () => { UI.next = 'loadout'; UI.back.loadout = 'modes'; LO.picker = 0; toMenu(); });
}

function toMenu() { startMatch(demoConfig()); }

// ---------- wiring ----------
applySettings();   // here, not in 75-cosmetics: the audio slice (80) must have loaded first
for (const name of ['menu', 'pause', 'over']) makePanel(name);

function syncPanels(state) {
  if (state === 'menu') { const next = UI.next || 'menu'; UI.next = null; openScreen(next); }
  else if (state === 'paused') { PANELS.pause.replaceChildren(buildPause()); UI.screen = 'pause'; showPanel('pause'); }
  else if (state === 'over') { PANELS.over.replaceChildren(buildResults()); UI.screen = 'over'; showPanel('over'); }
  else showPanel(null);
}
on('state', syncPanels);
on('boot', () => syncPanels(G_STATE.state));
