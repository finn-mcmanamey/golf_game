// 74d-draft.js (v6): Draft Duel. Both players draft from one pool on one screen (74c's META), in snake order: 3 weapons
// each (one per round), 2 skills, 1 class; then a best-of-3 duel with the kits. A CPU can take Player 2's seat.
const DRAFT_POOL = { w: 8, s: 6, c: 3 }, DRAFT_ORDER = 'wwwwwwsssscc';   // pool sizes; what pick i drafts
const DRAFT_SNAKE = [0, 1, 1, 0];   // who makes pick i
const DRAFT_TIME = 20, DRAFT_THINK = .9, DRAFT_DONE = 1.6;   // s: a pick, a CPU's think, the kits on show
const DRAFT_KIND = { w: ['Weapons', '3 each, one per round'], s: ['Skills', '2 each'], c: ['Classes', '1 each'] };
const DRAFT_TIER = { common: 0, rare: 1, epic: 2, mythic: 3 };

defMode('draft', {
  name: 'Draft Duel', icon: '🃏', order: 25, players: [1, 2], cpu: true, pickers: 0, labels: ['Player 1', 'Player 2'], duo: 'versus', winScore: 2,
  desc: 'Take turns drafting weapons, skills and classes from one shared pool, then duel best of 3 with your picks: a new weapon each round.',
  setup(cfg) {
    const names = duoNames(cfg), cpu = cfg.draftP2 === 'cpu', p1 = humanEntry(cfg, 0, 0, 0, names[0]);
    const p2 = cpu ? aiPersonaEntry(modeEntry({ ...loadoutOf(cfg, 1), team: 1, name: 'CPU' }), 'random', { gear: false, caps: false, avoidColor: p1.color })
      : humanEntry(cfg, 1, 1, 1, names[1]);
    return { roster: [p1, p2], run: { draft: draftNew(cpu), drafted: false } };
  },
  onRoundStart() {
    if (!modeRun().drafted) return metaOpen(DRAFT_SCREEN);
    const w = G_STATE.roster.map(r => (WEAPONS[r.weapon] || {}).name || '?');
    banner('ROUND ' + G_STATE.round, `${w[0]} vs ${w[1]}`.toUpperCase(), 1.8);
  },
  roundOver() {
    const d = modeRun().draft;
    if (G_STATE.score.some(s => s >= G_STATE.winScore)) return 'match';
    G_STATE.roster.forEach((r, s) => { r.weapon = d.kits[s].w[G_STATE.round % 3]; });   // next round, next weapon
    return 'next';
  },
  results() {
    const d = modeRun().draft, sc = G_STATE.score, R = G_STATE.roster, top = sc[0] === sc[1] ? -1 : sc[0] > sc[1] ? 0 : 1;
    const kit = s => `${R[s].name}: ${d.kits[s].w.map(k => WEAPONS[k].name).join(' → ')} · ${d.kits[s].s.map(k => SKILLS[k].name).join(' + ')} · ${CLASSES[d.kits[s].c[0]].name}`;
    return { title: top < 0 ? 'Draw!' : `${R[top].name} wins the draft!`, color: top < 0 ? '#ffd84a' : R[top].color,
      lines: [`Final score ${sc[0]} – ${sc[1]} after ${roundsText(G_STATE.round)}.`, kit(0), kit(1)] };
  },
});

// The pool: 8 weapons of 8 categories (every style on offer), 6 skills, 3 classes.
function draftNew(cpu) {
  const w = [], keys = reg => shuffle(listOf(reg).map(d => d.key));
  for (const cat of shuffle(WEAPON_CATS.slice())) { const k = randomKey(WEAPONS, d => d.cat === cat); if (k && w.length < DRAFT_POOL.w) w.push(k); }
  for (const k of keys(WEAPONS)) if (w.length < DRAFT_POOL.w && !w.includes(k)) w.push(k);
  return { pool: { w, s: keys(SKILLS).slice(0, DRAFT_POOL.s), c: keys(CLASSES).slice(0, DRAFT_POOL.c) }, by: {},
    kits: [0, 1].map(() => ({ w: [], s: [], c: [] })), i: 0, cur: [0, DRAFT_POOL.w - 1], t: DRAFT_TIME, think: 0, done: 0, cpu,
    throws: resolveThrows(['random', 'random']) };   // not drafted: the same for both
}
const draftKind = d => DRAFT_ORDER[d.i];
const draftTurn = d => DRAFT_SNAKE[d.i % 4];
const draftOver = d => d.i >= DRAFT_ORDER.length;
const draftFree = (d, k) => !(draftKind(d) + ':' + k in d.by);
const draftBot = (d, s) => !!G_STATE.cfg.autopilot || (s === 1 && d.cpu);
// Moves player s's cursor to the next free card that way.
function draftMove(d, s, dir, quiet) {
  const list = d.pool[draftKind(d)] || [], n = list.length;
  for (let k = 1; k <= n; k++) {
    const i = ((d.cur[s] + dir * k) % n + n) % n;
    if (draftFree(d, list[i])) { d.cur[s] = i; if (!quiet) uiSfx('nav'); return; }
  }
}
// Player s takes card idx: only on their turn, only a free card.
function draftPick(d, s, idx) {
  const kind = draftKind(d), key = kind && d.pool[kind][idx];
  if (!key || draftTurn(d) !== s || !draftFree(d, key)) return uiSfx('deny');
  d.by[kind + ':' + key] = s; d.kits[s][kind].push(key);
  Object.assign(d, { i: d.i + 1, t: DRAFT_TIME, think: 0 });
  sfx('draft-pick');
  if (draftOver(d)) sfx('meta-step');
  else if (draftKind(d) !== kind) d.cur = [0, d.pool[draftKind(d)].length - 1];   // new phase: cursors at either end
  else for (const p of [0, 1]) if (!draftFree(d, d.pool[kind][d.cur[p]])) draftMove(d, p, 1, true);
  META.dirty = true;
}
// A CPU's pick: rarer weapons, skills that suit its weapons (70's themes), any class; with some whim.
function draftChoice(d, s) {
  const kind = draftKind(d), cats = d.kits[s].w.map(k => WEAPONS[k].cat);
  const fit = k => kind === 'w' ? DRAFT_TIER[weaponTier(WEAPONS[k])] * .6 : kind === 's' ? MODE_THEMES.filter(t => t.cats.some(c => cats.includes(c)) && t.skills.includes(k)).length : 0;
  let best = -1, top = -Infinity;
  d.pool[kind].forEach((k, i) => { const v = draftFree(d, k) ? fit(k) + Math.random() * 1.5 : -Infinity; if (v > top) { top = v; best = i; } });
  return best;
}
// The kits go to the fighters, who come back fresh for round 1.
function draftFinish(d) {
  modeRun().drafted = true;
  G_STATE.roster.forEach((r, s) => Object.assign(r, { weapon: d.kits[s].w[0], skills: d.kits[s].s.slice(), cls: d.kits[s].c[0], throws: d.throws.slice() }));
  metaClose();
  newRound();
}

const DRAFT_SCREEN = {
  cls: 'draft',
  key(s, act) {
    const d = modeRun().draft;
    if (d.cpu) s = 0;   // one human: both key sets drive Player 1, as in a fight
    if (draftOver(d) || draftBot(d, s)) return;
    if (act === 'ok') draftPick(d, s, d.cur[s]);
    else draftMove(d, s, act === 'left' ? -1 : 1);
  },
  tick(dt) {
    const d = modeRun().draft, s = draftTurn(d);
    if (draftOver(d)) { if ((d.done += dt) >= DRAFT_DONE) draftFinish(d); return; }
    if (draftBot(d, s)) {   // a CPU thinks, then picks
      if ((d.think += dt) >= (G_STATE.cfg.autopilot ? .15 : DRAFT_THINK)) draftPick(d, s, d.cur[s] = draftChoice(d, s));
    } else if ((d.t -= dt) <= 0) {   // time's up: the cursor's card
      if (!draftFree(d, d.pool[draftKind(d)][d.cur[s]])) draftMove(d, s, 1, true);
      draftPick(d, s, d.cur[s]);
    }
    const bar = META.el && META.el.querySelector('.dr-time');
    if (bar) bar.style.setProperty('--t', clamp(d.t / DRAFT_TIME, 0, 1));
  },
  build() {
    const d = modeRun().draft, R = G_STATE.roster, kind = draftKind(d) || 'c', s = draftTurn(d), done = draftOver(d);
    return el('div', { class: 'card meta-card' },
      el('header', { class: 'meta-head' }, el('h2', { text: '🃏 Draft Duel' }),
        el('span', { text: done ? 'Draft complete' : `${DRAFT_KIND[kind][0]}: ${DRAFT_KIND[kind][1]} · pick ${d.i + 1} of ${DRAFT_ORDER.length}` })),
      done ? el('p', { class: 'dr-turn' }, el('b', { text: 'Kits locked in. Fight!' }))
        : el('p', { class: 'dr-turn', style: { '--pc': R[s].color } }, el('span', {}, el('b', { text: R[s].name }), draftBot(d, s) ? ' is choosing…' : '’s pick'),
          el('i', { class: 'dr-time', style: { '--t': clamp(d.t / DRAFT_TIME, 0, 1) } })),
      el('div', { class: 'dr-body' }, draftKit(d, 0), el('div', { class: 'dr-pool dr-' + kind }, d.pool[kind].map((k, i) => draftCard(d, kind, k, i, done))), draftKit(d, 1)),
      el('div', { class: 'meta-keys' }, metaHow(0, 'pick'), el('span', { text: 'Snake order · Esc pause' }), d.cpu ? el('span') : metaHow(1, 'pick')));
  },
};
// A pool card: icon, name, what it does; each player's cursor in their colour, then the taker's name.
function draftCard(d, kind, k, i, done) {
  const def = { w: WEAPONS, s: SKILLS, c: CLASSES }[kind][k], by = d.by[kind + ':' + k], R = G_STATE.roster, tier = kind === 'w' && weaponTier(def), turn = draftTurn(d);
  const art = kind === 'w' ? uiTile('dr|' + k, 132, 54, null, c => drawWeaponIcon(c, k, '#e8ecff')) : el('span', { class: 'dr-glyph', style: { color: def.color }, text: def.icon });
  const sub = kind === 'w' ? `${CAT_ICONS[def.cat] || ''} ${CAT_NAMES[def.cat] || def.cat}${tier !== 'common' ? ' · ' + TIER_INFO[tier].name : ''}` : kind === 's' ? `${def.cd} s cooldown` : def.passive;
  return el('div', { class: 'dr-card' + (by != null ? ' taken' : '') + (done ? '' : (d.cur[0] === i ? ' c0' : '') + (d.cur[1] === i && (!d.cpu || turn === 1) ? ' c1' : '')),
    style: { '--c0': R[0].color, '--c1': R[1].color, '--by': by != null ? R[by].color : null },
    onclick: () => { if (!done && by == null && !draftBot(d, turn) && performance.now() >= META.armAt) { d.cur[turn] = i; draftPick(d, turn, i); metaRender(); } } },
  art, el('b', { text: def.name }), el('small', { text: sub, style: tier && tier !== 'common' ? { color: TIER_INFO[tier].color } : null }),
  el('p', { text: def.desc || '' }), by != null ? el('em', { text: R[by].name }) : null);
}
// A player's side: their kit so far, lit on their turn.
function draftKit(d, s) {
  const r = G_STATE.roster[s], k = d.kits[s];
  const item = (reg, key, tag) => el('p', { class: key ? 'got' : null }, tag ? el('i', { text: tag }) : null, key ? (reg === WEAPONS ? '' : reg[key].icon + ' ') + reg[key].name : '—');
  return el('aside', { class: 'dr-kit' + (!draftOver(d) && draftTurn(d) === s ? ' on' : ''), style: { '--pc': r.color } }, el('h3', { text: r.name }),
    el('small', { text: d.cpu && s ? 'CPU · ' + levelName(modeDiff()) : 'Player ' + (s + 1) }),
    el('h4', { text: 'Weapons' }), [0, 1, 2].map(i => item(WEAPONS, k.w[i], 'R' + (i + 1))),
    el('h4', { text: 'Skills' }), [0, 1].map(i => item(SKILLS, k.s[i])), el('h4', { text: 'Class' }), item(CLASSES, k.c[0]));
}

META_MODES.draft = {
  opts: () => [metaSeg('Player 2', 'draftP2', [['human', 'Human'], ['cpu', 'CPU']])],
  cfg: () => ({ draftP2: META_PREFS.draftP2 }),
  help: ['🃏', 'Draft Duel', () => 'Draft from one pool in snake order (P1, P2, P2, P1…): 3 weapons each (one per round), 2 skills, 1 class. ' +
    'Move your cursor with left/right, take a card with attack (20 s a pick), then fight best of 3. Player 2 can be a CPU.'],
};
on('boot', () => defSfx('draft-pick', v => { noise(.05, 3200, .07 * v, 'highpass'); tone(520, 780, .09, 'square', .045 * v); tone(1040, 1560, .12, 'triangle', .05 * v, .04); }));
