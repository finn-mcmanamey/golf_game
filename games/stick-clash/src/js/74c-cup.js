// 74c-cup.js (v6): Clash Cup (a knockout bracket of both players and CPU rivals) and what the v6 two-player modes share.

// ---------- META: one screen { cls, build(), key(slot, 'left'|'right'|'ok'), tick(dt) } at a time over the frozen fight ----------
// Like 79's vote it waits for 94's controls card; registered before 79, it comes before the vote.
const META = { on: null, info: null, el: null, armAt: 0, dirty: true, confetti: null };
const META_ARM = 450, META_OK = ['attack', 'jump', 'dash'];   // ms before a new screen takes keys mashed in the fight
const META_PREFS = Object.assign({ cupSize: 8, draftP2: 'human', nightLen: 8 }, store.getObj('meta6'));
const META_MODES = {}, META_RESULTS = [];   // key -> { opts, cfg, panel, help: [icon, title, text] }; fn(card) -> new card

function metaOpen(screen) {
  if (META.on !== screen || META.info !== G_STATE.info) META.armAt = performance.now() + META_ARM;
  Object.assign(META, { on: screen, info: G_STATE.info, dirty: true });
  BANNER = null;
}
function metaClose() {
  META.on = null;
  if (G_STATE.override === metaHold) G_STATE.override = null;
  for (const f of F) clearPresses(f);   // keys pressed on it must not fire in the fight
  metaRender();
}
const metaStale = () => META.on && META.info !== G_STATE.info;   // its match was left
function metaHold(dt) {
  if (!META.on || metaStale()) { META.on = null; G_STATE.override = null; }
  else if (G_STATE.state === 'play') { hook(META.on, 'tick', dt); metaRender(); }
}
const metaLive = () => !!META.on && !metaStale() && G_STATE.state === 'play' && G_STATE.override === metaHold;
on('mapStep', dt => {
  if (!META.on) return;
  if (metaStale()) return metaClose();
  G_STATE.lock = Math.max(G_STATE.lock, 1);
  G_STATE.override = G_STATE.override || metaHold;
  if (G_STATE.sim) hook(META.on, 'tick', dt);   // headless runs; frames tick in metaHold
});
function metaRender() {
  const live = metaLive();
  if (!META.el) { if (!live) return; document.body.append(META.el = el('div', { role: 'dialog' })); }
  META.el.hidden = !live;
  if (!live || !META.dirty) return;
  META.dirty = false;
  META.el.className = 'overlay meta';
  try { META.el.replaceChildren(META.on.build()); } catch (e) { report(e, 'meta ' + META.on.cls); }
}
on('state', () => { META.dirty = true; metaRender(); });
function metaKey(s, act) {
  if (!act || !metaLive() || performance.now() < META.armAt) return;
  hook(META.on, 'key', s, act);
  META.dirty = true; metaRender();
}
const metaAct = (code, b) => !b ? '' : code === b.left ? 'left' : code === b.right ? 'right' : META_OK.some(a => b[a] === code) ? 'ok' : '';
addEventListener('keydown', e => {
  if (metaLive() && !e.repeat) for (const s of [0, 1]) { const act = metaAct(e.code, keySets()[s]); if (act) { e.preventDefault(); metaKey(s, act); } }
});
on('pad', (a, s) => metaKey(Math.max(0, s), a === 'left' || a === 'right' ? a : META_OK.includes(a) ? 'ok' : ''));
// A button (left/right choose, ok presses) and a player's key hints.
const metaBtn = (text, cur, act, cls) => el('button', { tabindex: '-1', class: (cls || '') + (cur ? ' cur' : ''),
  onclick: e => { e.currentTarget.blur(); if (performance.now() >= META.armAt) { act(); META.dirty = true; metaRender(); } } }, text);
function metaHow(s, verb, okOnly) {
  const k = ['left', 'right', 'attack'].map(a => keyHint(s, a));
  return el('div', { class: 'kr meta-how' }, k[2] && [okOnly ? null : [keyCap(k[0]), keyCap(k[1]), el('span', { text: 'choose ·' })], keyCap(k[2]), el('span', { text: verb })]);
}
const metaWho = e => el('b', { style: { color: e.color }, text: e.name });
const metaSeg = (label, key, opts) => segField(label, opts, META_PREFS[key], v => { META_PREFS[key] = v; store.set('meta6', META_PREFS); });

// One result in the two players' head-to-head record (73's rules).
function metaSettle(names, winSlot) {
  if (G_STATE.cfg.autopilot || duoLow(names[0]) === duoLow(names[1])) return null;
  const rec = duoRec(names[0], names[1], true), side = winSlot < 0 ? -1 : duoSide(rec, names[winSlot]);
  for (const n of names) rec.n[duoSide(rec, n)] = n;
  rec.total++;
  if (side >= 0) rec.w[side]++;
  rec.streak = side < 0 ? [-1, 0] : [side, rec.streak[0] === side ? rec.streak[1] + 1 : 1];
  rec.last = (rec.last + (side < 0 ? 'd' : 'ab'[side])).slice(-10);
  duoSave();
  return rec;
}
// Confetti on a champion's results; none with reduced flashes or motion.
function metaConfetti(colors) {
  if (SETTINGS.reduceFlash || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return el('div', { class: 'meta-confetti', 'aria-hidden': 'true' }, Array.from({ length: 70 }, (_, i) => el('i', { style: { left: rnd(0, 100).toFixed(1) + '%',
    '--c': colors[i % colors.length], '--d': rnd(0, 2.4).toFixed(2) + 's', '--t': rnd(2.8, 4.6).toFixed(2) + 's', '--x': rndi(-90, 90) + 'px', '--r': rndi(-720, 720) + 'deg' } })));
}

// ---------- menu hooks ----------
on('boot', () => {
  const maps = SCREENS.maps, howto = SCREENS.howto, cfg = menuCfg, results = buildResults, pad = padSlot, strip = stripSlot;
  SCREENS.maps = () => {
    const node = maps(), m = META_MODES[MENU.mode], body = node.querySelector('.sheet-body');
    if (!m || !body) return node;
    const sec = el('section', { class: 'meta-opts' }, m.opts()), duo = body.querySelector('.duo-panel');
    duo ? duo.after(sec) : body.prepend(sec);
    if (m.panel) m.panel(node);
    return node;
  };
  menuCfg = () => {   // pickerless modes still bring the players' colours and looks
    const c = cfg(), m = META_MODES[c.mode];
    return m ? Object.assign(c, m.cfg(), c.loadouts.length ? null : { loadouts: [0, 1].map(i => loadoutForMatch(i)) }) : c;
  };
  SCREENS.howto = () => {
    const node = howto(), grid = node.querySelector('.help-grid');
    for (const { help: h } of Object.values(META_MODES)) grid.insertBefore(el('section', { class: 'help-card' }, el('h3', {}, el('span', { text: h[0] }), h[1]), el('p', { text: h[2]() })), grid.lastElementChild);
    return node;
  };
  buildResults = () => {
    let card = results();
    for (const fn of META_RESULTS) { try { card = fn(card) || card; } catch (e) { report(e, 'meta results'); } }
    return card;
  };
  // A P2-only tie: pads and the key strip go to P2 (90 and 94 mean P1 when one human plays).
  padSlot = (gp, n, solo) => solo && !JOINED && cupSoloP2() ? 1 : pad(gp, n, solo);
  stripSlot = k => !cupSoloP2() ? strip(k) : k === 1 && strip(0) >= 0 ? 1 : -1;
  defSfx('cup-win', v => { [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .32, 'triangle', .1 * v, i * .09)); noiseSweep(.5, 2000, 9000, .05 * v, 'highpass', .3); });
  defSfx('meta-step', v => { tone(660, 990, .07, 'square', .05 * v); tone(990, 1320, .09, 'triangle', .05 * v, .05); });
  on('state', now => {   // after 97 has built the results panel
    const layer = now === 'over' && META.confetti && metaConfetti(META.confetti);
    META.confetti = null;
    if (layer) PANELS.over.append(layer);
  });
});

// ---------- Clash Cup ----------
const CUP_SEEDS = { 4: [1, 4, 3, 2], 8: [1, 8, 4, 5, 3, 6, 7, 2] };   // bracket order by seed
const CUP_LEVELS = [1, 1, 0, 0, -1, -1];   // CPU seeds 3-8 around the CPU level
const CUP_STAGES = ['Final', 'Semifinal', 'Quarterfinal'];   // by rounds left

defMode('cup', {
  name: 'Clash Cup', icon: '🥇', order: 24, players: [2, 2], cpu: true, pickers: 2, labels: ['Player 1', 'Player 2'], duo: 'versus', winScore: 2,
  desc: 'A knockout cup of 4 or 8: both of you plus CPU rivals, best of 3 a tie. Meet in the Rivalry Match and it counts in your record.',
  setup(cfg) { const cup = cupNew(cfg); return { roster: cupRoster(cup, cupNext(cup)), winScore: cup.win, run: { cup } }; },
  onRoundStart() { if (modeRun().cup.phase === 'bracket') metaOpen(CUP_SCREEN); },
  roundOver() {
    const cup = modeRun().cup, sc = G_STATE.score;
    if (Math.max(...sc) < cup.win) return 'next';
    cupDecide(cup, cupNext(cup), sc.slice(), cup.phase);
    const t = cupNext(cup);
    if (!t) { cup.phase = 'done'; return 'match'; }
    Object.assign(cup, { phase: 'bracket', pick: 0 });
    G_STATE.roster = cupRoster(cup, t); G_STATE.score = [0, 0]; G_STATE.round = 0;   // afterRound adds one
    return 'next';
  },
  hud(ctx) { if (modeRun().cup.phase === 'watch') modeText(ctx, 'WATCHING · EITHER PLAYER\'S ATTACK SKIPS', W / 2, H - 22, 14, '#c9cdee', 'center', '600 ' + FONT_BODY); },
  results() {
    const cup = modeRun().cup, fin = cupFinal(cup), champ = cup.ent[fin.w], won = champ.ctrl === 'human', nm = i => cup.ent[i].name, riv = cup.riv;
    const lines = [`Final: ${nm(fin.a)} ${fin.sc[0]} – ${fin.sc[1]} ${nm(fin.b)}.`];
    if (riv && riv.rec && riv.t !== fin) lines.push(`Rivalry Match won by ${nm(riv.t.w)} · head-to-head ${duoLine(riv.rec, ...duoNames(G_STATE.cfg))}.`);
    lines.push(`${cup.size} fighters · CPUs ${levelName(modeDiff())}.`);
    return { title: `${champ.name} wins the cup!`, color: champ.color, won, tournament: won, lines };
  },
});
const cupOn = () => G_STATE.mode && G_STATE.mode.key === 'cup' && modeRun().cup;
const cupSoloP2 = () => !!cupOn() && humanCount() === 1 && G_STATE.roster.some(r => r.ctrl === 'human' && r.slot === 1);
const cupFinal = cup => cup.rounds[cup.rounds.length - 1][0];
const cupStage = (cup, t) => CUP_STAGES[cup.rounds.length - 1 - t.r];
const cupRivalry = (cup, t) => t.a >= 0 && t.b >= 0 && cup.ent[t.a].ctrl === 'human' && cup.ent[t.b].ctrl === 'human';
const cupNext = cup => cup.rounds.flat().find(t => t.w < 0 && t.a >= 0 && t.b >= 0) || null;

// Entrants: the players (seeds 1-2, meeting only in the final) and named CPU rivals (67) with their own gear.
function cupNew(cfg) {
  const size = cfg.cupSize === 4 ? 4 : 8, names = duoNames(cfg);
  const ent = [0, 1].map(s => Object.assign(humanEntry(cfg, s, s, s, names[s]), { seed: s + 1 })), near = c => ent.slice(0, 2).some(h => aiColorNear(c, h.color));
  for (const [k, p] of aiPersonaDraw(size - 2).entries()) {
    const e = aiPersonaEntry(modeEntry({ name: 'CPU', aiLevel: aiShift(cfg.diff || 'normal', size === 8 ? CUP_LEVELS[k] : 0), seed: k + 3 }), p, { gear: 'force', caps: false });
    if (near(e.color)) e.color = pick(MODE_COLORS.filter(c => !near(c))) || e.color;
    ent.push(e);
  }
  ent.forEach((e, i) => { e.i = i; rollRandomOnce(e); });   // random picks hold for the whole cup
  const slots = CUP_SEEDS[size].map(s => s - 1), rounds = [];
  for (let n = size / 2, r = 0; n >= 1; n /= 2, r++) rounds.push(Array.from({ length: n }, (_, m) => ({ r, m, a: r ? -1 : slots[2 * m], b: r ? -1 : slots[2 * m + 1], w: -1, sc: null })));
  return { size, win: 2, ent, rounds, phase: 'bracket', pick: 0, riv: null, auto: 0 };   // best of 3
}
// A tie's roster: fresh copies in 92's palette; 73's handicap only in the Rivalry Match.
function cupRoster(cup, t) {
  const R = [t.a, t.b].map((i, team) => Object.assign({}, cup.ent[i], { team, wxp: {}, superKeep: 0 }));
  if (typeof cbApply === 'function') cbApply(R);
  if (cupOn()) { if (cupRivalry(cup, t)) delete G_STATE.info.duoHcap; else G_STATE.info.duoHcap = null; }
  return R;
}
// A quick result: round odds from the level gap (a level up wins ~3 rounds in 4).
function cupSimTie(cup, t, sc = [0, 0]) {
  const lv = i => AI_ORDER.indexOf(cup.ent[i].aiLevel || 'normal'), p = 1 / (1 + Math.pow(3, lv(t.b) - lv(t.a)));
  while (Math.max(...sc) < cup.win) sc[chance(p) ? 0 : 1]++;
  return sc;
}
// Sends the winner on; the Rivalry Match counts in the players' record (so 73's duoSettle skips the cup).
function cupDecide(cup, t, sc, how) {
  Object.assign(t, { sc, how, w: sc[0] > sc[1] ? t.a : t.b });
  const up = cup.rounds[t.r + 1];
  if (up) up[t.m >> 1][t.m & 1 ? 'b' : 'a'] = t.w;
  if (cupRivalry(cup, t) && !cup.riv) {
    cup.riv = { t, rec: metaSettle(duoNames(G_STATE.cfg), cup.ent[t.w].slot) };
    if (cup.riv.rec) G_STATE.info.duoRec = cup.riv.rec;
  }
  if (how === 'sim') sfx('meta-step');
}
// After a tie settled off the field: the next tie's fighters step in, or the cup ends.
function cupAfter(cup) {
  const t = cupNext(cup) || cupFinal(cup), done = !cupNext(cup);
  Object.assign(cup, { pick: 0, phase: done ? 'done' : 'bracket' });
  if (done) metaClose();
  G_STATE.roster = cupRoster(cup, t); G_STATE.score = done ? t.sc.slice() : [0, 0]; G_STATE.round = 1;
  newRound();
  if (done) endMatch();
}
function cupChoose(act) {
  const cup = modeRun().cup, t = cupNext(cup);
  if (!t || !act) return;
  if (act === 'sim') { cupDecide(cup, t, cupSimTie(cup, t), 'sim'); return cupAfter(cup); }
  Object.assign(cup, { phase: act, watchAt: performance.now() + 600 });
  metaClose();
  G_STATE.lock = TUNE.startLock;
  const riv = cupRivalry(cup, t), [a, b] = [t.a, t.b].map(i => cup.ent[i].name.toUpperCase());
  banner(riv ? 'RIVALRY MATCH' : cupStage(cup, t).toUpperCase() + (cup.rounds[t.r].length > 1 ? ' ' + (t.m + 1) : ''), `${a} VS ${b}`, 1.8, riv ? '#ffd84a' : null);
  sfx('round');
}
// Watching a CPU tie: either player's OK key settles the rest.
function cupSkip() {
  const cup = cupOn(), t = cup && cupNext(cup);
  if (!t || cup.phase !== 'watch' || performance.now() < cup.watchAt || G_STATE.state !== 'play') return;
  cupDecide(cup, t, cupSimTie(cup, t, G_STATE.score.slice()), 'watch');
  cupAfter(cup);
}
addEventListener('keydown', e => { if (!e.repeat && [0, 1].some(s => metaAct(e.code, keySets()[s]) === 'ok')) cupSkip(); });
on('pad', a => { if (META_OK.includes(a)) cupSkip(); });

// The bracket screen: the ties so far, the next one lit.
function cupButtons(cup) {
  const t = cupNext(cup);
  return !t ? [] : cup.ent[t.a].ctrl === 'human' || cup.ent[t.b].ctrl === 'human' ? [['fight', 'Fight! ▸']] : [['sim', 'Quick result ▸'], ['watch', 'Watch it']];
}
const CUP_SCREEN = {
  cls: 'cup',
  key(s, act) {
    const cup = modeRun().cup, b = cupButtons(cup);
    if (act === 'ok') cupChoose((b[cup.pick] || [])[0]);
    else if (b.length > 1) { cup.pick = (cup.pick + 1) % b.length; uiSfx('nav'); }
  },
  tick(dt) {   // autopilot runs (tests) press the first button
    const cup = modeRun().cup;
    if (G_STATE.cfg.autopilot && (cup.auto += dt) > .6) { cup.auto = 0; cupChoose((cupButtons(cup)[0] || [])[0]); }
  },
  build() {
    const cup = modeRun().cup, t = cupNext(cup), riv = t && cupRivalry(cup, t);
    const tag = i => el('em', { text: cup.ent[i].ctrl === 'human' ? 'P' + (cup.ent[i].slot + 1) : levelName(cup.ent[i].aiLevel) });
    return el('div', { class: 'card meta-card' },
      el('header', { class: 'meta-head' }, el('h2', { text: '🥇 Clash Cup' }), el('span', { text: `${cup.size} fighters · best of ${cup.win * 2 - 1} · either player's keys` })),
      cupView(cup, t),
      t && el('p', { class: 'cup-next' + (riv ? ' riv' : '') }, el('small', { text: (riv ? 'Rivalry match · ' : 'Next · ') + cupStage(cup, t) }),
        metaWho(cup.ent[t.a]), tag(t.a), ' vs ', metaWho(cup.ent[t.b]), tag(t.b)),
      el('div', { class: 'meta-btns' }, cupButtons(cup).map(([act, label], k) => metaBtn(label, k === cup.pick, () => cupChoose(act), k ? null : 'go'))),
      el('div', { class: 'meta-keys' }, metaHow(0, 'OK'), el('span', { text: 'Esc pause' }), metaHow(1, 'OK')));
  },
};
// A column per round, then the champion; players in their colours, losers struck through.
function cupView(cup, next) {
  const row = (t, i, k) => {
    const e = cup.ent[i], hum = e && e.ctrl === 'human';
    return el('div', { class: 'cup-e' + (hum ? ' hum' : '') + (t.w < 0 ? '' : t.w === i ? ' win' : ' out'), style: e ? { '--pc': e.color } : null, title: e && e.title },
      el('small', { text: e ? e.seed : '' }), el('b', { text: e ? e.name : '?' }), hum ? el('em', { text: 'P' + (e.slot + 1) }) : null, el('span', { text: t.sc ? t.sc[k] : '' }));
  };
  const col = (title, kids) => el('div', { class: 'cup-col' }, el('h4', { text: title }), el('div', {}, kids)), champ = cup.ent[cupFinal(cup).w];
  return el('div', { class: 'cup-tree', style: { '--n': cup.rounds.length + 1 } },
    cup.rounds.map((list, r) => col(CUP_STAGES[cup.rounds.length - 1 - r] + (list.length > 1 ? 's' : ''), list.map(t =>
      el('div', { class: 'cup-m' + (t === next ? ' next' : '') + (cupRivalry(cup, t) ? ' riv' : '') }, row(t, t.a, 0), row(t, t.b, 1))))),
    col('Champion', el('div', { class: 'cup-champ' + (champ ? ' won' : ''), style: champ ? { '--pc': champ.color } : null }, el('b', { text: '🏆' }), el('span', { text: champ ? champ.name : '?' }))));
}
// The champion's card shows the bracket, not the per-slot table (slots change every tie).
META_RESULTS.push(card => {
  const cup = cupOn(), wrap = card.querySelector('.res-wrap');
  if (!cup || cupFinal(cup).w < 0) return;
  if (wrap) wrap.replaceWith(el('div', { class: 'cup-res' }, cupView(cup, null)));
  META.confetti = [cup.ent[cupFinal(cup).w].color, '#ffd84a', '#ffffff', '#5ef2ff', '#ff5ad1'];
  sfx('cup-win');
});

META_MODES.cup = {
  opts: () => [metaSeg('Bracket', 'cupSize', [[4, '4 fighters'], [8, '8 fighters']])],
  cfg: () => ({ cupSize: META_PREFS.cupSize }),
  help: ['🥇', 'Clash Cup', () => 'A knockout bracket of 4 or 8: you two plus CPU rivals, best of 3 a tie. Either player presses attack ' +
    'on the bracket to go on; CPU ties get a quick result, or Watch it (attack skips). You two meeting is the Rivalry Match: it counts in your record.'],
};
