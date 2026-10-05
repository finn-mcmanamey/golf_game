// 73-modes-ranked.js: the Ranked ladder vs CPUs. Seven tiers (Bronze to Grandmaster); every tier below
// Grandmaster has three divisions (III, II, I) of 100 points. A win gains points (more on a streak), a loss costs
// some (never below the floor of the tier you have reached). Opponents scale with rank: difficulty, health, class
// and loadout. Saved through `store` as 'ranked'. Also: rankBadge() for the title screen and a rank-up celebration.

const RANK_TIERS = [
  { name: 'Bronze', color: '#d08a4a', icon: '◆', levels: ['easy', 'easy', 'easy'], hp: .85 },
  { name: 'Silver', color: '#c9d2e8', icon: '◆', levels: ['easy', 'normal', 'normal'], hp: .9 },
  { name: 'Gold', color: '#ffd84a', icon: '✦', levels: ['normal', 'normal', 'normal'], hp: .95 },
  { name: 'Platinum', color: '#7dffcf', icon: '✦', levels: ['normal', 'hard', 'hard'], hp: 1 },
  { name: 'Diamond', color: '#5ef2ff', icon: '❖', levels: ['hard', 'hard', 'hard'], hp: 1.05 },
  { name: 'Master', color: '#b98cff', icon: '♛', levels: ['hard', 'insane', 'insane'], hp: 1.1 },
  { name: 'Grandmaster', color: '#ff4a6a', icon: '♛', levels: ['insane'], hp: 1.2 },
];
const RANK_DIV = 100, RANK_DIVS = 3, RANK_WIN = 25, RANK_LOSS = 18, RANK_STREAK = 5, RANK_STREAK_MAX = 15;
const RANK_GM = (RANK_TIERS.length - 1) * RANK_DIVS * RANK_DIV;           // points where Grandmaster starts
const RANK_ROMAN = ['III', 'II', 'I'];

function rankLoad() {
  const r = Object.assign({ pts: 0, best: 0, wins: 0, losses: 0, streak: 0 }, store.getObj('ranked'));
  for (const k of ['pts', 'best', 'wins', 'losses', 'streak']) r[k] = numOr(r[k]);
  return r;
}

// { tier, div (0 = III), label 'Gold II', color, icon, into (points into the division), floor (tier floor) }
function rankOf(pts) {
  pts = Math.max(0, pts | 0);
  if (pts >= RANK_GM) { const t = RANK_TIERS[RANK_TIERS.length - 1]; return { tier: RANK_TIERS.length - 1, div: 0, label: t.name, color: t.color, icon: t.icon, into: pts - RANK_GM, floor: RANK_GM, gm: true }; }
  const tier = Math.floor(pts / (RANK_DIV * RANK_DIVS)), div = Math.floor(pts / RANK_DIV) % RANK_DIVS, t = RANK_TIERS[tier];
  return { tier, div, label: `${t.name} ${RANK_ROMAN[div]}`, color: t.color, icon: t.icon, into: pts % RANK_DIV, floor: tier * RANK_DIV * RANK_DIVS };
}
// A higher step on the ladder (tier first, then division)?
const rankAbove = (a, b) => a.tier > b.tier || (a.tier === b.tier && a.div > b.div);

// The CPU you face at `pts`: its level, health and gear grow with the rank.
function rankOpponent(pts, playerColor) {
  const r = rankOf(pts), t = RANK_TIERS[r.tier], level = t.levels[Math.min(r.div, t.levels.length - 1)];
  const theme = pick(MODE_THEMES), lo = themeLoadout(theme), name = pick(MODE_NAMES);
  const op = modeEntry({ team: 1, ...lo, name: name.toUpperCase(), color: modeColor(playerColor), hat: r.tier >= 5 && HATS.crown ? 'crown' : modeHat(),
    aiLevel: level, hpMul: t.hp, cls: r.tier < 1 ? 'none' : resolveClass('random'), rankTitle: `${r.label} ${theme.title}` });
  aiPersonaEntry(op, 'random', { gear: 'force', avoidColor: playerColor, hat: r.tier < 5 });   // a named rival (67)
  op.rankTitle = `${r.label} ${op.title}`;
  return op;
}

defMode('ranked', {
  name: 'Ranked', icon: '🏅', order: 15,
  desc: 'Climb from Bronze to Grandmaster against CPUs that get tougher with your rank. Best of 3. Wins gain points, losses cost them.',
  players: [1, 1], cpu: false, pickers: 1, labels: ['You'], winScore: 2, customRounds: true,
  setup(cfg) {
    const me = humanEntry(cfg, 0, 0, 0, 'YOU'), save = rankLoad();
    const op = rankOpponent(save.pts, me.color);
    return { roster: [me, op], winScore: 2, run: { start: save.pts, title: op.rankTitle } };
  },
  roundLabel() { return `${rankOf(modeRun().start).label.toUpperCase()} · R${G_STATE.round}`; },
  // Once the first FIGHT! has begun the match is on the record: quitting or restarting settles it as a loss.
  onStep() { if (G_STATE.lock <= 0) modeRun().live = true; },
  abandon() {
    const run = modeRun();
    if (!run.live || run.settled || G_STATE.cfg.autopilot) return;
    run.settled = true;
    rankSettle(false, false);
  },
  onRoundStart() { if (G_STATE.round === 1) banner(rankOf(modeRun().start).label.toUpperCase(), 'RANKED MATCH', 1.8, rankOf(modeRun().start).color); },
  hud(ctx) { rankDrawBar(ctx, rankOf(modeRun().start), W / 2, H - 26); },
  results() {
    modeRun().settled = true;
    const won = G_STATE.score[0] > G_STATE.score[1], r = rankSettle(won, !!G_STATE.cfg.autopilot);
    const sign = r.delta >= 0 ? '+' : '';
    const title = r.up ? `RANK UP: ${r.after.label}!` : r.down ? `Down to ${r.after.label}` : won ? 'Ranked win!' : 'Ranked loss';
    return { title, color: r.up ? r.after.color : won ? '#9dff5a' : '#ff8a2e', won, rankUp: r.up,
      lines: [`${G_STATE.roster[1].name} the ${modeRun().title}: ${G_STATE.score[0]} – ${G_STATE.score[1]}.`,
        `${sign}${r.delta} points → ${r.after.label}${r.after.gm ? ` (${r.after.into} pts)` : ` (${r.after.into}/${RANK_DIV})`}${r.streak > 1 ? ` · ${r.streak} win streak` : ''}.`,
        `Season: ${r.save.wins} W – ${r.save.losses} L · best ${rankOf(r.save.best).label}.`] };
  },
});

// Applies a match result to the saved rank (unless it was an autopilot test) and reports what changed.
function rankSettle(won, dryRun) {
  const save = rankLoad(), before = rankOf(save.pts);
  let delta;
  if (won) { save.streak = Math.max(1, save.streak + 1); delta = RANK_WIN + Math.min(RANK_STREAK_MAX, (save.streak - 1) * RANK_STREAK); save.wins++; }
  else { save.streak = 0; delta = -Math.min(RANK_LOSS, save.pts - before.floor); save.losses++; }   // tier floors protect you
  save.pts = Math.max(0, save.pts + delta);
  save.best = Math.max(save.best, save.pts);
  const after = rankOf(save.pts);
  if (!dryRun) store.set('ranked', save);
  return { delta, before, after, save, streak: save.streak, up: rankAbove(after, before), down: rankAbove(before, after) };
}

// In-match: the rank chip and division progress along the bottom.
function rankDrawBar(ctx, r, x, y) {
  const w = 220;
  modeText(ctx, `${r.icon} ${r.label}`, x - w / 2 - 12, y, 14, r.color, 'right');
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x - w / 2, y - 4, w, 8);
  ctx.fillStyle = r.color; ctx.fillRect(x - w / 2, y - 4, w * clamp(r.gm ? 1 : r.into / RANK_DIV, 0, 1), 8);
}

// Title screen badge (95-ui places it): your rank and division points; click to play Ranked.
function rankBadge() {
  if (typeof document === 'undefined') return null;
  const save = rankLoad(), r = rankOf(save.pts);
  const b = el('button', { class: 'rank-badge', title: 'Play Ranked', style: { '--rk': r.color },
    onclick: () => { MENU.mode = 'ranked'; saveMenu(); uiSfx('click'); openScreen('loadout', 'menu'); } },
  el('span', { class: 'rk-icon', text: r.icon }),
  el('span', { class: 'rk-text' }, el('b', { text: r.label }), el('small', { text: r.gm ? `${r.into} pts` : `${r.into}/${RANK_DIV} · ${save.wins}W ${save.losses}L` })));
  return b;
}

// Rank-up celebration: a toast, a fanfare and a glowing results card (CSS in styles/73-ranked.css).
on('state', s => {
  const res = G_STATE.result;
  if (s !== 'over' || !res || !res.rankUp || typeof document === 'undefined') return;
  setTimeout(() => {
    const card = document.querySelector('#over .results-card');
    if (card) card.classList.add('rank-up');
    toast('Rank up!', res.title.replace(/^RANK UP: /, ''), '🏅', res.color);
    sfx('cheer', 1, true);
  }, 0);
});
