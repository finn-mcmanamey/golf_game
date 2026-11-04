// 74e-party-night.js (v6): Party Night, 5, 8 or 12 events from the two-player modes and mini-games (v6's new ones too),
// each its own match marked cfg.night; its results card becomes a scoreboard, then a podium. Silly rules: twists (79).
const NIGHT_LENS = [5, 8, 12], NIGHT_WIN = 3, NIGHT_PLAY = 1, NIGHT_TWIST = .35;
// Mode events: [fighters, first to, name]; the two players take seats, CPUs fill the rest.
const NIGHT_MODES = { pvp: [2, 2, 'Duel'], ohko: [2, 3], roulette: [2, 3], koth: [2, 1], tagteam: [2, 2], soccer: [4, 1], ctf: [4, 1],
  potato: [4, 2], gungame: [4, 1], juggernaut: [4, 1], lava: [3, 2], royale: [4, 1], blitz: [4, 1], rift: [3, 2] };
const NIGHT_NEW = ['volley', 'paint', 'tower', 'coinrush', 'lastplatform'];   // v6 modes, if present (v6 mini-games join anyway)
let NIGHT = null, NIGHT_ID = 0;   // { id, base cfg, names, list of events, i, pts, wins, log, scored, done, champ, rec }

defMode('night', {
  name: 'Party Night', icon: '🎉', order: 26, players: [2, 2], cpu: true, pickers: 0, labels: ['Player 1', 'Player 2'], duo: 'versus',
  customRounds: true, winScore: 1, holdRound: () => true,
  desc: 'A playlist of 5, 8 or 12 random party modes and mini-games. 3 points a win, 1 for taking part; the final event counts double.',
  setup(cfg) {
    const names = duoNames(cfg);
    if (!('nightSilly' in cfg)) cfg.nightSilly = cfg.silly;   // twists replace 79's vote (kept for a restart)
    cfg.silly = 'off';
    NIGHT = { id: ++NIGHT_ID, base: cfg, names, list: nightPlaylist(clamp(Math.round(cfg.nightLen) || 8, 3, 12), cfg.nightSilly === 'vote'),
      i: -1, pts: [0, 0], wins: [0, 0, 0], log: [], scored: -1, done: false, auto: 0 };
    return { roster: [0, 1].map(s => humanEntry(cfg, s, s, s, names[s])) };
  },
  onRoundStart() { metaOpen(NIGHT_SCREEN); },
});
const nightOf = () => NIGHT && G_STATE.cfg && G_STATE.cfg.night === NIGHT.id ? NIGHT : null;   // the night this match is an event of
const nightColor = (N, s) => ((N.base.loadouts || [])[s] || {}).color || DEFAULT_COLORS[s];
function nightEvent(kind, key) {   // a mode's blurb talks of a CPU: its first sentence and the party's target
  const m = kind === 'mini' ? MINIS[key] : MODES[key], c = NIGHT_MODES[key] || [m.crowd ? Math.min(4, m.crowd[2] || m.crowd[0]) : 2, 0];
  const desc = kind === 'mini' ? m.how : String(m.desc).split(/(?<=[.!?])\s/)[0] + (c[1] > 1 ? ` First to ${c[1]}.` : '');
  return { kind, key, name: c[2] || m.name, icon: kind === 'mini' ? m.icon : modeIcon(m), desc, n: c[0], first: c[1] };
}
// Modes open and close the night, mini-games (2 in 5) between; no repeats until the pool runs out.
function nightPlaylist(n, silly) {
  const modes = Object.keys(NIGHT_MODES).concat(NIGHT_NEW.filter(k => !MINIS[k])).filter(k => MODES[k] && !MODES[k].hidden);
  const minis = listOf(MINIS).map(d => d.key), nMini = minis.length ? Math.min(Math.round(n * .4), n - 2) : 0;
  const deal = (keys, k, kind) => Array.from({ length: k }, (_, i) => nightEvent(kind, keys[i % keys.length]));
  const m = deal(shuffle(modes), n - nMini, 'mode'), list = [m[0], ...shuffle(m.slice(1, -1).concat(deal(shuffle(minis), nMini, 'mini'))), m[m.length - 1]];
  for (const ev of list) if (silly && ev.kind === 'mode' && chance(NIGHT_TWIST)) ev.twist = randomKey(SILLY);
  list[list.length - 1].x2 = true;
  return list;
}
// Event i as its own match on the night's settings, both players on random gear.
function nightPlay(i) {
  const N = NIGHT, ev = N && N.list[i];
  if (!ev) return;
  Object.assign(N, { i, auto: 0 });
  const mode = MODES[ev.kind === 'mini' ? 'nightmini' : ev.key], own = mode.pickerOwner || [0, 1];
  const lo = [0, 1].map(s => Object.assign({}, (N.base.loadouts || [])[s], { weapon: 'random', skills: ['random', 'random'], cls: 'random', throws: ['random', 'random'] }));
  nightWrap(mode);
  metaClose();
  startMatch(Object.assign({}, N.base, { mode: mode.key, mini: ev.key, night: N.id, names: N.names, fighters: ev.n, winScore: ev.first || undefined,
    minigames: false, loadouts: Array.from({ length: Math.max(2, modePickers(mode)) }, (_, k) => lo[own[k] ?? Math.min(k, 1)]) }));
}
// Player 2 takes a CPU seat on another team, as in 93's lobby; wrapped when first played, so late modes count.
function nightWrap(mode) {
  if (mode.nightWrapped) return;
  const base = mode.setup;
  mode.setup = function (cfg) {
    const info = base.call(this, cfg), R = info && info.roster, lo = cfg.loadouts || [];
    if (!cfg.night || !Array.isArray(R) || !R.some(r => r.ctrl === 'human')) return info;
    if (R.filter(r => r.ctrl === 'human').length < 2) {
      const p1 = R.find(r => r.ctrl === 'human'), cpus = R.filter(r => r.ctrl !== 'human' && !((r.scale || 1) > 1.05)), seat = cpus.find(r => r.team !== p1.team) || cpus[0];
      if (seat) Object.assign(seat, { ctrl: 'human', slot: 1, persona: null, aiLevel: undefined, title: undefined });
    }
    for (const r of R) if (r.ctrl === 'human' && r.slot < 2) Object.assign(r, { name: cfg.names[r.slot], color: (lo[r.slot] || {}).color || r.color, hat: (lo[r.slot] || {}).hat || r.hat, look: (lo[r.slot] || {}).look });
    if (typeof cbApply === 'function') cbApply(R);
    return info;
  };
  mode.nightWrapped = true;
}
on('matchStart', cfg => {
  if (!NIGHT || cfg.mode === 'night') return;
  if (cfg.night !== NIGHT.id) NIGHT = null;   // any other match ends the night
  else G_STATE.info.duoRec = null;   // an event is not a head-to-head match (the night is)
});

// Who won the event: roster ids, the players among them (slots) and a name for the card.
function nightResult(N) {
  const R = G_STATE.roster, run = modeRun(), sc = G_STATE.score, key = G_STATE.mode.key, all = R.map((r, i) => i);
  let ids = [];
  if (key === 'nightmini') ids = run.win >= 0 ? [run.win] : [];
  else if (key === 'juggernaut') { const best = Math.max(...all.map(i => run.pts[i] || 0)); ids = all.filter(i => (run.pts[i] || 0) === best); }   // its giant swaps teams
  else { const top = Math.max(...sc), t = sc.indexOf(top); ids = top > 0 && sc.filter(s => s === top).length === 1 ? all.filter(i => R[i].team === t) : []; }
  if (key === 'juggernaut' && ids.length > 1) ids = [];
  const slots = [...new Set(ids.filter(i => R[i].ctrl === 'human' && R[i].slot < 2).map(i => R[i].slot))];
  return { slots, who: slots.length === 1 ? N.names[slots[0]] : ids.length === 1 ? R[ids[0]].name : ids.length ? teamName(R[ids[0]].team) : '' };
}
// Scores the event once (97 builds the card before matchOver): 3 for a win, 1 for taking part.
function nightScore(N) {
  if (N.scored === N.i) return;
  N.scored = N.i;
  const ev = N.list[N.i], res = nightResult(N), mul = ev.x2 ? 2 : 1;
  const gain = [0, 1].map(s => (res.slots.includes(s) ? NIGHT_WIN : NIGHT_PLAY) * mul);
  gain.forEach((g, s) => { N.pts[s] += g; });
  N.wins[res.slots.length === 1 ? res.slots[0] : 2]++;
  N.log.push({ ev, res, gain, line: ((G_STATE.result || {}).lines || [])[0] || '' });
  if (N.i < N.list.length - 1) return;
  N.done = true;
  N.champ = N.pts[0] === N.pts[1] ? -1 : N.pts[0] > N.pts[1] ? 0 : 1;
  N.rec = metaSettle(N.names, N.champ);
}
on('matchOver', () => { const N = nightOf(); if (N) nightScore(N); });

const NIGHT_SCREEN = {
  cls: 'night',
  key(s, act) { if (act === 'ok') nightPlay(0); },
  tick(dt) { if (G_STATE.cfg.autopilot && (NIGHT.auto += dt) > .5) nightPlay(0); },   // autopilot runs (tests) start by themselves
  build() {
    const N = NIGHT;
    return el('div', { class: 'card meta-card' },
      el('header', { class: 'meta-head' }, el('h2', { text: '🎉 Party Night' }), el('span', { text: `${N.names[0]} vs ${N.names[1]} · ${N.list.length} events` })),
      el('p', { class: 'night-rules', text: `Win an event: ${NIGHT_WIN} points. Take part: ${NIGHT_PLAY}. The final event counts double. Most points takes the podium.` }),
      nightStrip(N, true), el('div', { class: 'meta-btns' }, metaBtn("Let's party ▸", true, () => nightPlay(0), 'go')),
      el('div', { class: 'meta-keys' }, metaHow(0, 'start', true), el('span', { text: 'Either player starts · Esc pause' }), metaHow(1, 'start', true)));
  },
};
// The playlist: done events in the winner's colour, the next lit; `full` adds names (the opening screen).
function nightStrip(N, full) {
  return el('ol', { class: 'night-list' + (full ? ' full' : '') }, N.list.map((ev, i) => {
    const log = N.log[i], w = log && log.res.slots.length === 1 ? log.res.slots[0] : -1;
    const tag = (ev.kind === 'mini' ? 'Mini-game' : 'Party mode') + (ev.twist ? ' + ' + SILLY[ev.twist].name : '') + (ev.x2 ? ' · ×2' : '');
    return el('li', { class: (log ? 'done' : i === N.log.length ? 'now' : '') + (ev.x2 ? ' x2' : ''), style: w >= 0 ? { '--pc': nightColor(N, w) } : null, title: `${ev.name}: ${ev.desc}` },
      el('span', { text: ev.icon }), full && el('b', { text: ev.name }), full && el('small', { text: tag }));
  }));
}
const nightCard = (color, ...kids) => el('div', { class: 'card wide results-card', style: { '--rc': color } }, kids);
const nightRow = (go, act) => el('div', { class: 'row' }, el('button', { class: 'go', 'data-autofocus': '', onclick: () => { uiSfx('fight'); act(); } }, go), uiButton('Menu', toMenu));
function nightBoard(N) {
  const last = N.log[N.log.length - 1], ev = last.ev, next = N.list[N.i + 1], won = last.res.slots, color = won.length === 1 ? nightColor(N, won[0]) : '#ffd84a';
  return nightCard(color, el('p', { class: 'night-ev', text: `Event ${N.i + 1} of ${N.list.length} · ${ev.icon} ${ev.name}${ev.x2 ? ' · double points' : ''}` }),
    el('h2', { style: { color }, text: won.length === 1 ? `${N.names[won[0]]} wins!` : last.res.who ? `${last.res.who} takes it` : 'Draw!' }),
    last.line && el('p', { class: 'hint', text: last.line }),
    el('div', { class: 'night-score' }, [0, 1].map(s => el('div', { style: { '--pc': nightColor(N, s) } }, el('b', { text: N.pts[s] }), el('span', { text: N.names[s] }), el('em', { text: '+' + last.gain[s] })))),
    nightStrip(N),
    el('p', { class: 'night-next' + (next.x2 ? ' x2' : '') }, el('small', { text: next.x2 ? 'Final event · double points' : 'Next up' }),
      el('b', { text: `${next.icon} ${next.name}` + (next.twist ? ` + ${SILLY[next.twist].icon} ${SILLY[next.twist].name}` : '') }), el('span', { text: next.desc })),
    trophyBox(), nightRow('Next event ▸', () => nightPlay(N.i + 1)));
}
function nightPodium(N) {
  const top = N.champ, color = top >= 0 ? nightColor(N, top) : '#ffd84a', first = s => top < 0 || s === top;
  const step = s => el('div', { class: 'night-step' + (first(s) ? ' p1' : ''), style: { '--pc': nightColor(N, s) } }, el('span', { text: first(s) ? '👑' : '🥈' }),
    el('b', { text: N.names[s] }), el('strong', { text: N.pts[s] + ' pts' }));
  const lines = [`${N.list.length} events: ${N.names[0]} won ${N.wins[0]}, ${N.names[1]} ${N.wins[1]}` + (N.wins[2] ? `, CPUs and draws ${N.wins[2]}.` : '.'),
    N.rec && 'Head-to-head: ' + duoLine(N.rec, ...N.names)].filter(Boolean);
  META.confetti = [nightColor(N, 0), nightColor(N, 1), '#ffd84a', '#ffffff', '#ff5ad1'];
  sfx('cup-win');
  return nightCard(color, el('p', { class: 'night-ev', text: '🎉 Party Night · final standings' }),
    el('h2', { style: { color }, text: top >= 0 ? `${N.names[top]} wins Party Night!` : 'A shared crown!' }),
    el('div', { class: 'night-podium' }, (top === 1 ? [0, 1] : [1, 0]).map(step)),
    el('div', { class: 'results-lines' }, lines.map(t => el('span', { text: t }))), nightStrip(N), trophyBox(), nightRow('Rematch · new playlist', () => startMatch(N.base)));
}
META_RESULTS.push(() => { const N = nightOf(); if (N) { nightScore(N); return N.done ? nightPodium(N) : nightBoard(N); } });

// One mini-game as an event (hidden: Party Night only).
defMode('nightmini', {
  name: 'Party mini-game', icon: '🎲', hidden: true, players: [2, 2], cpu: false, pickers: 0, winScore: 1, roundLimit: 600, customRounds: true,
  holdRound: () => true, roundOver: () => 'match', roundLabel: () => 'MINI-GAME',
  setup(cfg) { const n = duoNames(cfg); return { roster: [humanEntry(cfg, 0, 0, 0, n[0]), humanEntry(cfg, 1, 1, 1, n[1])], run: { key: MINIS[cfg.mini] ? cfg.mini : 'sumo', win: -1 } }; },
  onRoundStart() {   // the round after it shows the result, with the mini-game's stats (79 rebuilt the fighters)
    const run = modeRun();
    if (run.started) { run.done = true; G_STATE.lock = 60; F.forEach((f, i) => Object.assign(f.stats, run.stats[i])); }
  },
  onStep() {   // not at round start: 79 clears MINI on matchStart, which comes later
    const run = modeRun(), r = G_STATE.roster[run.win];
    if (!run.started) { run.started = true; miniStart(G_STATE.round, run.key); }
    else if (run.done && !G_STATE.ending) partyEnd(r ? r.team : -1, 'mini', r ? r.name.toUpperCase() + ' WINS' : 'DRAW', MINIS[run.key].name.toUpperCase(), r ? r.color : null);
  },
  results() {
    const run = modeRun(), r = G_STATE.roster[run.win];
    return { title: r ? `${r.name} wins ${MINIS[run.key].name}!` : 'Draw!', color: r ? r.color : '#ffd84a', lines: [MINIS[run.key].how] };
  },
});
on('miniEnd', (key, f) => { if (G_STATE.mode.key === 'nightmini') Object.assign(modeRun(), { win: f && !f.summon ? f.id : -1, stats: F.map(o => o.stats) }); });

on('boot', () => {
  const md = miniDraw, qr = quickRematch;
  miniDraw = c => { md(c); nightHud(c); };   // right after every mode's own HUD (85 drawHUD)
  quickRematch = () => { const N = nightOf(); if (!N) qr(); else if (N.done) startMatch(N.base); };   // R: never one event again
  on('roundStart', () => {   // after 79-silly's reset: the event's twist holds for every round of it
    const N = nightOf(), ev = N && N.list[N.i], rule = ev && ev.twist && SILLY[ev.twist];
    if (!rule) return;
    SILLY_ON = rule; VOTE.map = MAP;
    hook(rule, 'round'); F.forEach(sillyFighter);
  });
});
function nightHud(c) {
  const N = nightOf(), ev = N && N.list[N.i], x = (W - VIEW.hudW) / 2 + 26;
  if (!ev || G_STATE.state === 'over') return;
  modeText(c, `🎉 ${N.i + 1}/${N.list.length} · ${N.names[0]} ${N.pts[0]} – ${N.pts[1]} ${N.names[1]}` + (ev.x2 ? ' · FINAL ×2' : '') + (ev.twist ? ' · ' + SILLY[ev.twist].name.toUpperCase() : ''),
    x, H - 24, 14, ev.x2 ? '#ffd84a' : '#c9cdee', 'left', '600 ' + FONT_BODY);
}
META_MODES.night = {
  opts: () => [metaSeg('Events', 'nightLen', NIGHT_LENS.map(n => [n, n + ' events']))],
  cfg: () => ({ nightLen: META_PREFS.nightLen }),
  panel(node) {   // 73's panel: no handicap tonight; its silly vote means twists
    const opts = node.querySelector('.duo-opts'), vote = node.querySelector('[data-key="Silly rules-vote"]');
    if (opts) opts.firstElementChild.remove();
    if (vote) vote.textContent = 'Twists';
  },
  help: ['🎉', 'Party Night', () => `5, 8 or 12 random party modes and mini-games. Win one: ${NIGHT_WIN} points; take part: ${NIGHT_PLAY}. ` +
    'The final counts double. Silly rules on Twists give some events a silly rule. The champion counts in your head-to-head record.'],
};
