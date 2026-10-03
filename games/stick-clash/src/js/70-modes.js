// 70-modes.js: game modes. setup(cfg) returns { roster, winScore?, roundLimit?, run? } where each roster entry is
// { ctrl: 'human'|'cpu', slot, team, weapon, skills, color, hat, scale, hpMul, name, aiLevel }. The match engine in
// 99-main.js runs rounds; a mode steers it with roundOver(winnerTeam, reason) -> 'next'|'match', onRoundStart(),
// onStep(dt), onKO(victim, killer, opts), hud(ctx), drawWorld(ctx), results() -> { title, color, lines[] },
// roundLabel() (HUD text instead of "ROUND n"), holdRound() (true = the mode decides when the round ends) and
// aiGoal(f) (a zone for CPUs to stand in). Per-match state lives in G_STATE.info.run (setup returns it as `run`).

// The menu's loadout for picker i (weapon/skills may be 'random'; resolved fresh every round).
function loadoutOf(cfg, i) {
  const lo = (cfg.loadouts || [])[i] || {};
  return { weapon: lo.weapon || 'random', skills: lo.skills || ['random', 'random'], hat: lo.hat, color: lo.color || DEFAULT_COLORS[i] };
}

// ---------- shared helpers ----------
const MODE_NAMES = ['Vex', 'Rook', 'Juno', 'Kestrel', 'Bram', 'Nyx', 'Talon', 'Sable', 'Orin', 'Pike', 'Ember', 'Quill',
  'Zara', 'Flint', 'Echo', 'Mako', 'Wren', 'Dax', 'Lumen', 'Brisk'];
const MODE_COLORS = ['#ff8a2e', '#9dff5a', '#ff5ad1', '#ffd84a', '#b98cff', '#5ef2ff', '#ff4a6a', '#7dffcf', '#ffffff'];
// Themed loadouts: a weapon category plus skills that suit it (missing keys are skipped, gaps filled at random).
const MODE_THEMES = [
  { title: 'Swordhand', cats: ['blade'], skills: ['lunge', 'parry', 'blink', 'glaive'] },
  { title: 'Bruiser', cats: ['heavy'], skills: ['slam', 'tremor', 'frenzy', 'uppercut'] },
  { title: 'Lancer', cats: ['polearm'], skills: ['lunge', 'grapple', 'repulse', 'snare'] },
  { title: 'Chain Dancer', cats: ['chain'], skills: ['grapple', 'magnet', 'gravity-well', 'blink'] },
  { title: 'Brawler', cats: ['fist'], skills: ['uppercut', 'frenzy', 'rocket', 'slam'] },
  { title: 'Gunslinger', cats: ['ranged'], skills: ['blink', 'vanish', 'decoy', 'snare'] },
  { title: 'Hexcaster', cats: ['magic'], skills: ['fireball', 'lightning', 'frost-nova', 'meteor', 'toxic'] },
  { title: 'Oddball', cats: ['exotic'], skills: ['bubble', 'chrono', 'decoy', 'magnet'] },
  { title: 'Bulwark', cats: ['shield'], skills: ['parry', 'mend', 'repulse', 'bubble'] },
];
const DIFF_SHIFT = { easy: -1, normal: 0, hard: 1, insane: 2 };
const modeDiff = () => (G_STATE.cfg && AI_LEVELS[G_STATE.cfg.diff] ? G_STATE.cfg.diff : 'normal');
const levelName = key => key ? key[0].toUpperCase() + key.slice(1) : '';

// First listed weapon that exists, else a random one from the categories, else any.
function modeWeapon(keys, cats) {
  for (const k of keys || []) if (WEAPONS[k]) return k;
  return randomKey(WEAPONS, w => !cats || cats.includes(w.cat)) || randomKey(WEAPONS);
}
function themeLoadout(theme) {
  const skills = shuffle((theme.skills || []).filter(k => SKILLS[k] && !SKILLS[k].hidden)).slice(0, 2);
  while (skills.length < 2) skills.push(randomKey(SKILLS, s => !skills.includes(s.key)));
  return { weapon: modeWeapon(null, theme.cats), skills };
}
// A rival colour that is easy to tell apart from `avoid` (the player's colour).
function modeColor(avoid) {
  const rgb = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) || 0);
  const far = c => !avoid || rgb(c).reduce((s, v, i) => s + (v - rgb(avoid)[i]) ** 2, 0) > 150 * 150;
  const list = MODE_COLORS.filter(far);
  return pick(list.length ? list : MODE_COLORS);
}
function modeHat() { return chance(.6) ? randomKey(HATS) || 'none' : 'none'; }

// A complete roster entry (rosters swapped mid-match skip buildRoster's defaults, so fill everything).
function modeEntry(o) {
  return Object.assign({ ctrl: 'cpu', slot: 0, team: 1, weapon: 'random', skills: ['random', 'random'], color: '#ff8a2e',
    hat: 'none', scale: 1, hpMul: 1, name: 'CPU', aiLevel: null }, o);
}
const humanEntry = (cfg, i, slot, team, name) => modeEntry({ ...loadoutOf(cfg, i), ctrl: 'human', slot, team, name });
const modeRun = () => (G_STATE.info && G_STATE.info.run) || {};
const modePlayer = () => F.find(f => f.id === 0);

// Rounded translucent panel for mode HUDs.
function modePanel(ctx, x, y, w, h, edge) {
  ctx.fillStyle = 'rgba(8,9,22,.82)'; ctx.strokeStyle = edge || 'rgba(139,125,255,.6)'; ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 12); else ctx.rect(x, y, w, h);
  ctx.fill(); ctx.stroke();
}
function modeText(ctx, text, x, y, size, color, align = 'center', font = FONT_DISPLAY) {
  ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(7,8,15,.9)';
  ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
}
// A big horizontal health bar (bosses, survival waves).
function modeBigBar(ctx, x, y, w, frac, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 3, y - 3, w + 6, 22);
  ctx.fillStyle = rgba(color, .25); ctx.fillRect(x, y, w, 16);
  glow(ctx, color, 12, () => { ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), 16); });
  for (let k = 1; k < 10; k++) { ctx.fillStyle = 'rgba(7,8,15,.55)'; ctx.fillRect(x + w * k / 10 - 1, y, 2, 16); }
  if (label) modeText(ctx, label, x, y - 14, 16, color, 'left');
}

// ---------- classic duels ----------
defMode('versus', {
  name: '1P vs CPU', desc: 'Duel the computer. First to 5 rounds wins.', order: 10,
  players: [1, 1], cpu: true, pickers: 2, labels: ['You', 'CPU'],
  setup(cfg) {
    return { roster: [humanEntry(cfg, 0, 0, 0, 'YOU'), modeEntry({ ...loadoutOf(cfg, 1), team: 1, name: 'CPU' })] };
  },
  results() {
    const res = duelResults(), diff = modeDiff(), wins = store.get('wins', {});
    if (G_STATE.score[0] > G_STATE.score[1] && !G_STATE.cfg.autopilot) { wins[diff] = (wins[diff] || 0) + 1; store.set('wins', wins); }
    res.lines.push('Matches won vs CPU: ' + AI_ORDER.map(k => `${levelName(k)} ${wins[k] || 0}`).join(' · '));
    return res;
  },
});

// Results for a 1P-vs-CPU duel (versus, one-hit KO, roulette, king of the hill).
function duelResults() {
  const won = G_STATE.score[0] > G_STATE.score[1], draw = G_STATE.score[0] === G_STATE.score[1];
  return { title: draw ? 'Draw!' : won ? 'You win!' : 'CPU wins', color: won || draw ? G_STATE.roster[0].color : G_STATE.roster[1].color,
    lines: [`Final score ${G_STATE.score[0]} – ${G_STATE.score[1]} after ${G_STATE.round} rounds (${levelName(modeDiff())}).`] };
}

defMode('pvp', {
  name: '2 Players', desc: 'Two players, one keyboard (or gamepads). First to 5.', order: 20,
  players: [2, 2], cpu: false, pickers: 2, labels: ['Player 1', 'Player 2'],
  setup(cfg) { return { roster: [humanEntry(cfg, 0, 0, 0, 'P1'), humanEntry(cfg, 1, 1, 1, 'P2')] }; },
});

defMode('watch', {
  name: 'CPU vs CPU', desc: 'Sit back and watch two bots brawl.', order: 30,
  players: [0, 0], cpu: true, pickers: 2, labels: ['CPU 1', 'CPU 2'], rerollRandom: true,   // fresh match-ups every round
  // cfg.diffs: optional per-side levels (used by tools/ai-bench.cjs to pit levels against each other)
  setup(cfg) {
    const lv = i => (cfg.diffs && AI_LEVELS[cfg.diffs[i]] ? cfg.diffs[i] : null);
    return { roster: [0, 1].map(i => modeEntry({ ...loadoutOf(cfg, i), team: i, name: lv(i) ? levelName(lv(i)) + ' CPU' : 'CPU ' + (i + 1), aiLevel: lv(i) })) };
  },
});

// ---------- Tournament: 8 themed challengers of rising skill, a giant champion last; two continues per run ----------
const TOURNEY_FIGHTS = 8, TOURNEY_WINS = 2, TOURNEY_INTRO = 2.3, TOURNEY_CONTINUES = 2;
// Challenger levels relative to the chosen difficulty: it never climbs more than one step above it
// (Normal: easy ×2, normal ×3, hard ×2, then a giant normal champion).
const TOURNEY_STEPS = [-1, -1, 0, 0, 0, 1, 1, 0];

function tourneyLadder(diff, playerColor) {
  const names = shuffle(MODE_NAMES.slice()), themes = shuffle(MODE_THEMES.slice());
  return TOURNEY_STEPS.map((step, i) => {
    const boss = i === TOURNEY_FIGHTS - 1, theme = themes[i % themes.length];
    const lo = boss ? { weapon: modeWeapon(['greatsword', 'hammer', 'halberd'], ['heavy', 'polearm']), skills: themeLoadout(MODE_THEMES[1]).skills } : themeLoadout(theme);
    return { name: boss ? 'Titan Kord' : names[i], title: boss ? 'The Champion' : theme.title, level: aiShift(diff, step), boss,
      color: boss ? '#ffd84a' : modeColor(playerColor), hat: boss ? (HATS.crown ? 'crown' : modeHat()) : modeHat(), ...lo };
  });
}
function tourneyEntry(op) {
  return modeEntry({ team: 1, name: op.name.toUpperCase(), weapon: op.weapon, skills: op.skills, color: op.color, hat: op.hat,
    aiLevel: op.level, scale: op.boss ? 1.6 : 1, hpMul: 1 });     // the giant's size already gives it 160 hp
}

defMode('tournament', {
  name: 'Tournament', desc: `Beat ${TOURNEY_FIGHTS} challengers of rising skill, the last a giant champion. Best of 3 each; two continues, then a loss ends the run.`,
  order: 40, players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: TOURNEY_WINS,
  setup(cfg) {
    const player = humanEntry(cfg, 0, 0, 0, 'YOU'), ladder = tourneyLadder(cfg.diff, player.color);
    return { roster: [player, tourneyEntry(ladder[0])], winScore: TOURNEY_WINS, run: { ladder, fight: 0, won: 0, intro: TOURNEY_INTRO, lost: false, continues: TOURNEY_CONTINUES } };
  },
  roundLabel() { const r = modeRun(); return `FIGHT ${r.fight + 1}/${TOURNEY_FIGHTS} · R${G_STATE.round}`; },
  onRoundStart() {
    const run = modeRun();
    if (run.intro > 0) { G_STATE.lock = TOURNEY_INTRO + TUNE.startLock; BANNER = null; }   // show the ladder first
  },
  onStep(dt) {
    const run = modeRun();
    if (!(run.intro > 0)) return;
    run.intro -= dt;
    if (run.intro <= 0) {
      const op = run.ladder[run.fight];
      banner(run.retry ? 'CONTINUE' : op.boss ? 'FINAL' : 'FIGHT ' + (run.fight + 1), op.name.toUpperCase(), 1.4, op.boss || run.retry ? '#ffd84a' : null);
    }
  },
  roundOver() {
    const run = modeRun(), s = G_STATE.score;
    if (s[1] >= TOURNEY_WINS) {
      if (run.continues <= 0) { run.lost = true; return 'match'; }
      run.continues--; run.retry = true;                            // spend the continue: replay the same fight
    } else if (s[0] < TOURNEY_WINS) return 'next';
    else {
      run.won++; run.retry = false;
      if (run.won >= TOURNEY_FIGHTS) return 'match';
      run.fight++;
      G_STATE.roster[1] = tourneyEntry(run.ladder[run.fight]);
    }
    run.intro = TOURNEY_INTRO;
    G_STATE.score = [0, 0]; G_STATE.round = 0;                     // afterRound adds one: the fight starts at round 1
    return 'next';
  },
  hud(ctx) {
    const run = modeRun();
    if (run.intro > 0) tourneyDrawLadder(ctx, run, 1);
    else tourneyDrawStrip(ctx, run);
  },
  results() {
    const run = modeRun(), op = run.ladder[run.fight], champ = run.won >= TOURNEY_FIGHTS;
    const best = Math.max(store.get('tourneyBest', 0), run.won);
    if (!G_STATE.cfg.autopilot) store.set('tourneyBest', best);
    return champ
      ? { title: 'CHAMPION!', color: '#ffd84a', won: true, tournament: true, lines: [`You beat all ${TOURNEY_FIGHTS} challengers, ${op.name} included.`, `Ladder difficulty: ${levelName(modeDiff())}.`] }
      : { title: 'Knocked out', color: op.color, won: false, lines: [`Fight ${run.fight + 1} of ${TOURNEY_FIGHTS}: ${op.name} the ${op.title} (${levelName(op.level)}) won ${G_STATE.score[1]} – ${G_STATE.score[0]}.`,
        `Challengers beaten: ${run.won}. Best run: ${best}.`] };
  },
});

// The ladder card shown between fights: every challenger, beaten ones crossed out, the next one pulsing.
function tourneyDrawLadder(ctx) {
  const run = modeRun(), n = TOURNEY_FIGHTS, w = 1060, h = 260, x = (W - w) / 2, y = 180, gap = w / n;
  modePanel(ctx, x, y, w, h, 'rgba(255,216,74,.7)');
  modeText(ctx, 'TOURNAMENT', W / 2, y + 34, 30, '#ffd84a');
  const left = run.continues ? `${run.continues} continue${run.continues === 1 ? '' : 's'} left` : 'no continues left';
  const cont = run.retry ? 'Rematch! ' + left : left;
  modeText(ctx, `Challenger ${run.fight + 1} of ${n}  ·  ${cont}`, W / 2, y + 66, 15, run.retry ? '#ffd84a' : '#c9cdee', 'center', '600 ' + FONT_BODY);
  run.ladder.forEach((op, i) => {
    const cx = x + gap * (i + .5), cy = y + 140, done = i < run.fight, now = i === run.fight;
    const r = (op.boss ? 30 : 22) * (now ? 1 + .08 * Math.sin(G_STATE.t * 8) : 1);
    if (i < n - 1) lineXY(ctx, cx + r, cy, cx + gap - 24, cy, done ? '#ffd84a' : 'rgba(255,255,255,.18)', 3);
    glow(ctx, now ? op.color : 'transparent', now ? 18 : 0, () => circle(ctx, cx, cy, r, done ? 'rgba(40,44,70,.9)' : rgba(op.color, .25), op.color, 3));
    modeText(ctx, op.boss ? '♛' : String(i + 1), cx, cy + 1, op.boss ? 26 : 18, done ? '#6b7099' : '#ffffff');
    if (done) lineXY(ctx, cx - r * .7, cy - r * .7, cx + r * .7, cy + r * .7, '#ff4a6a', 4);
    modeText(ctx, op.name, cx, cy + 50, 14, done ? '#6b7099' : op.color);
    modeText(ctx, op.title, cx, cy + 70, 12, '#9096c2', 'center', '600 ' + FONT_BODY);
    modeText(ctx, levelName(op.level), cx, cy + 88, 12, now ? '#ffd84a' : '#6b7099', 'center', '600 ' + FONT_BODY);
  });
}
// During a fight: a compact row of pips along the bottom.
function tourneyDrawStrip(ctx, run) {
  const n = TOURNEY_FIGHTS, x0 = W / 2 - (n - 1) * 14;
  for (let i = 0; i < n; i++) {
    const op = run.ladder[i], c = i < run.fight ? '#ffd84a' : i === run.fight ? op.color : 'rgba(255,255,255,.15)';
    circle(ctx, x0 + i * 28, H - 22, op.boss ? 8 : 6, c, i === run.fight ? '#ffffff' : null, 2);
  }
}

// ---------- Survival: endless waves that grow in number and skill; your health carries over ----------
const SURV_HEAL = 50;     // health back after each wave (a boss wave refills you completely)

// Wave n: grunts get one skill level tougher every 5 waves (starting a level below your difficulty), come in
// pairs and trios as waves go on (each weaker alone), and every 5th wave is a giant boss.
function survivalWave(n, diff, playerColor) {
  const boss = n % 5 === 0, count = boss ? 1 : [1, 1, 2, 1, 0, 2, 2, 3, 2][n - 1] || 3;
  const lv = clamp(Math.floor((n - 1) / 5) + (DIFF_SHIFT[diff] || 0) - 1 + (boss ? 1 : 0), 0, AI_ORDER.length - 1);
  const grow = 1 + Math.max(0, n - 10) * .05, hpMul = (count === 1 ? .7 : count === 2 ? .5 : .4) * grow;
  return Array.from({ length: count }, (_, i) => {
    const theme = pick(MODE_THEMES);
    return modeEntry({ team: 1, ...themeLoadout(theme), color: boss ? '#ff4a6a' : modeColor(playerColor), hat: modeHat(),
      name: boss ? 'WARDEN' : MODE_NAMES[(n * 3 + i) % MODE_NAMES.length].toUpperCase(), aiLevel: AI_ORDER[lv],
      scale: boss ? 1.4 : 1, hpMul: boss ? .9 * grow : hpMul, spawn: i + 1 });
  });
}

defMode('survival', {
  name: 'Survival', desc: 'Endless waves that keep getting tougher, with a boss every 5th. Your health carries over. How far can you go?',
  order: 50, players: [1, 1], cpu: true, pickers: 1, labels: ['You'], roundLimit: 150,
  setup(cfg) {
    const player = humanEntry(cfg, 0, 0, 0, 'YOU');
    return { roster: [player, ...survivalWave(1, cfg.diff, player.color)], run: { wave: 1, cleared: 0, hp: null } };
  },
  roundLabel() { return 'WAVE ' + modeRun().wave; },
  onRoundStart() {
    const run = modeRun(), p = modePlayer(), foes = F.filter(f => f.team === 1);
    G_STATE.winScore = 0;                                           // no round pips: the wave counter is the score
    if (p && run.hp != null) p.hp = p.hpShow = (run.wave - 1) % 5 === 0 ? p.maxHp : Math.min(p.maxHp, run.hp + SURV_HEAL);
    banner('WAVE ' + run.wave, run.wave % 5 === 0 ? 'BOSS WAVE!' : foes.length > 1 ? foes.length + ' ENEMIES' : 'FIGHT!', 1.8, run.wave % 5 === 0 ? '#ff4a6a' : null);
  },
  roundOver(winner, reason) {
    const run = modeRun(), p = modePlayer();
    if (!p || winner !== 0) return 'match';         // the round's winner decides (a time-out counts for the health leader)
    run.cleared++; run.wave++; run.hp = Math.max(1, p.hp);
    G_STATE.roster = [G_STATE.roster[0], ...survivalWave(run.wave, G_STATE.cfg.diff, G_STATE.roster[0].color)];
    return 'next';
  },
  hud(ctx) {
    const run = modeRun(), best = store.get('survivalBest', 0);
    modeText(ctx, `Cleared ${run.cleared}  ·  Best ${Math.max(best, run.cleared)}`, W / 2, H - 22, 14, '#c9cdee', 'center', '600 ' + FONT_BODY);
  },
  results() {
    const run = modeRun(), best = Math.max(store.get('survivalBest', 0), run.cleared);
    if (!G_STATE.cfg.autopilot) store.set('survivalBest', best);
    return { title: `${run.cleared} wave${run.cleared === 1 ? '' : 's'} survived`, color: run.cleared >= best && run.cleared ? '#ffd84a' : '#ff8a2e',
      lines: [`You fell on wave ${run.wave} (${levelName(modeDiff())}).`, run.cleared >= best && run.cleared ? 'New personal best!' : `Personal best: ${best} waves.`] };
  },
});

// ---------- Boss Rush: five giant bosses in a row, each with its own trick ----------
// special: quake (ground shockwave), blink (teleports behind you), chill (frost pulse), twins (two at once,
// the survivor enrages), enrage (gets angry and fast at half health).
const BOSS_HERO_HP = 1.4;
const BOSSES = [
  { name: 'Ironhide', title: 'The Iron Brute', color: '#ff8a2e', weapons: ['hammer', 'mace', 'battle-axe'], cats: ['heavy'],
    skills: ['slam', 'tremor'], scale: 1.6, hpMul: .95, level: 'easy', special: 'quake' },
  { name: 'Volt Widow', title: 'The Storm Caller', color: '#5ef2ff', weapons: ['storm-staff', 'laser', 'minigun'], cats: ['magic', 'ranged'],
    skills: ['lightning', 'blink'], scale: 1.35, hpMul: .95, level: 'easy', special: 'blink' },
  { name: 'Rimeheart', title: 'The Frozen Knight', color: '#9fe8ff', weapons: ['frost-blade', 'scythe', 'halberd'], cats: ['blade', 'polearm'],
    skills: ['frost-nova', 'chrono'], scale: 1.5, hpMul: 1, level: 'normal', special: 'chill' },
  { name: 'Ash & Cinder', title: 'The Burning Twins', color: '#ff4a1a', weapons: ['flame-sword', 'flamethrower'], cats: ['blade'],
    skills: ['fireball', 'meteor'], scale: 1.15, hpMul: .6, level: 'easy', special: 'twins', count: 2 },
  { name: 'Neon Tyrant', title: 'The Last Boss', color: '#ff5ad1', weapons: ['greatsword', 'halberd', 'double-axe'], cats: ['heavy', 'polearm'],
    skills: ['frenzy', 'meteor'], scale: 1.7, hpMul: .9, level: 'normal', special: 'enrage' },
];

function bossEntries(i, diff) {
  const b = BOSSES[i], n = b.count || 1, shift = DIFF_SHIFT[diff] || 0;
  const skills = b.skills.map(k => SKILLS[k] ? k : 'random');
  return Array.from({ length: n }, (_, k) => modeEntry({ team: 1, name: (n > 1 ? b.name.split(' & ')[k] : b.name).toUpperCase(),
    weapon: n > 1 ? modeWeapon([b.weapons[k]], b.cats) : modeWeapon(b.weapons, b.cats), skills, color: k ? '#ffb02e' : b.color,
    hat: 'none', scale: b.scale, hpMul: b.hpMul, aiLevel: aiShift(b.level, shift), spawn: k + 1 }));
}

defMode('bossrush', {
  name: 'Boss Rush', desc: 'Five giant bosses, each with its own trick. Extra health, refilled for every boss; one loss ends the run.',
  order: 55, players: [1, 1], cpu: true, pickers: 1, labels: ['You'], roundLimit: 120,
  setup(cfg) {
    const hero = Object.assign(humanEntry(cfg, 0, 0, 0, 'YOU'), { hpMul: BOSS_HERO_HP });   // the lone hero gets a bigger health pool
    return { roster: [hero, ...bossEntries(0, cfg.diff)], run: { boss: 0, t: 0 } };
  },
  roundLabel() { return `BOSS ${modeRun().boss + 1}/${BOSSES.length}`; },
  onRoundStart() {
    const run = modeRun(), b = BOSSES[run.boss];
    G_STATE.winScore = 0;
    run.fx = { timer: 5, warn: 0, enraged: false };
    for (const f of F) if (f.team === 1) { f.kbMul = .6; f.isBoss = true; }
    banner(b.name.toUpperCase(), 'FIGHT!', 2, b.color);   // the boss's name, as on its card and bar (title: in the bar)
  },
  onStep(dt) {
    const run = modeRun();
    if (G_STATE.lock > 0 || G_STATE.ending || run.boss >= BOSSES.length) return;
    run.t += dt;
    hook(BOSS_SPECIALS, BOSSES[run.boss].special, run.fx, dt);
  },
  roundOver(winner) {
    const run = modeRun();
    if (winner !== 0) return 'match';
    if (++run.boss >= BOSSES.length) { run.cleared = true; return 'match'; }
    G_STATE.roster = [G_STATE.roster[0], ...bossEntries(run.boss, G_STATE.cfg.diff)];
    return 'next';
  },
  hud(ctx) {
    const bosses = F.filter(f => f.isBoss), b = BOSSES[Math.min(modeRun().boss, BOSSES.length - 1)];
    const room = Math.min(840, VIEW.hudW - 60), w = bosses.length > 1 ? room / 2 - 20 : room - 60;   // narrower on small HUDs
    bosses.forEach((f, i) => {
      const x = bosses.length > 1 ? W / 2 - room / 2 + i * (room / 2 + 20) : (W - w) / 2;
      modeBigBar(ctx, x, H - 46, w, f.hp / f.maxHp, f.alive ? f.color : '#444a66',
        f.name + (modeRun().fx && modeRun().fx.enraged ? '  · ENRAGED' : bosses.length > 1 ? '' : '  · ' + b.title.toUpperCase()));
    });
    if (modeRun().fx && modeRun().fx.warn > 0) modeText(ctx, '! ' + b.special.toUpperCase() + ' !', W / 2, 140, 28, b.color);
  },
  results() {
    const run = modeRun(), b = BOSSES[Math.min(run.boss, BOSSES.length - 1)];
    const best = Math.max(store.get('bossBest', 0), run.boss);
    if (!G_STATE.cfg.autopilot) store.set('bossBest', best);
    return run.cleared
      ? { title: 'ALL BOSSES DOWN!', color: '#ffd84a', won: true, lines: [`Boss Rush cleared in ${Math.round(run.t)} s of fighting (${levelName(modeDiff())}).`] }
      : { title: 'Defeated', color: b.color, won: false, lines: [`${b.name}, ${b.title}, stopped you at boss ${run.boss + 1} of ${BOSSES.length}.`, `Bosses beaten: ${run.boss}. Best: ${best}.`] };
  },
});

// Boss tricks. Each gets the round's scratch state s = { timer, warn, enraged } and dt; a warning shows first.
const BOSS_SPECIALS = {
  key: 'boss-specials',
  quake(s, dt) {          // slams the ground: everyone standing nearby is hurt and thrown up
    bossTimed(s, dt, 7, f => {
      const c = chest(f);
      ring(c.x, feetY(f), 380, '#ff8a2e', .5, 8); shake(14); sfx('slam');
      for (const e of enemiesOf(f)) if (e.alive && e.grounded && Math.abs(e.P[2].x - c.x) < 380) {
        damage(e, 9, { src: f, kind: 'skill', nx: Math.sign(e.P[2].x - c.x) || 1, ny: -1, kb: 520, color: '#ff8a2e' });
      }
    });
  },
  blink(s, dt) {          // vanishes and reappears behind its target
    bossTimed(s, dt, 6, f => {
      const t = nearestEnemy(f);
      if (!t) return;
      const c0 = chest(f), x = clamp(t.P[2].x - t.face * 110, 60, W - 60), y = (groundBelow(x, t.P[2].y - 40) ?? feetY(t)) - 4;
      burst(c0.x, c0.y, '#5ef2ff', 24, 360);
      moveFighter(f, x - f.P[2].x, y - feetY(f));
      const c1 = chest(f);
      ring(c1.x, c1.y, 70, '#5ef2ff', .35, 4); sfx('blink');
    });
  },
  chill(s, dt) {          // a frost pulse that slows everyone close by
    bossTimed(s, dt, 8, f => {
      const c = chest(f);
      ring(c.x, c.y, 230, '#9fe8ff', .5, 6); burst(c.x, c.y, '#c8f4ff', 30, 420); sfx('shatter');
      for (const e of enemiesOf(f)) if (e.alive && dist(chest(e), c) < 230) damage(e, 6, { src: f, kind: 'skill', status: ['slow', 2.5], color: '#9fe8ff' });
    });
  },
  twins(s) {              // when one twin falls, the other burns with fury
    const bosses = F.filter(f => f.isBoss);
    if (s.enraged || bosses.every(f => f.alive)) return;
    s.enraged = true;
    for (const f of bosses) if (f.alive) bossEnrage(f, 'AVENGE!');
  },
  enrage(s) {             // at half health: rage + haste for the rest of the fight
    const f = F.find(b => b.isBoss && b.alive);
    if (s.enraged || !f || f.hp > f.maxHp * .5) return;
    s.enraged = true;
    bossEnrage(f, 'ENRAGED!');
  },
};
// Runs fn(boss) every `every` seconds, after a 0.8 s warning.
function bossTimed(s, dt, every, fn) {
  const f = F.find(b => b.isBoss && b.alive);
  if (!f) return;
  s.timer -= dt;
  if (s.timer <= .8 && s.warn <= 0 && s.timer > 0) { s.warn = .8; const c = chest(f); ring(c.x, c.y, 60, f.color, .8, 3); }
  if (s.warn > 0) s.warn -= dt;
  if (s.timer <= 0) { s.timer = every * rnd(.85, 1.15); s.warn = 0; if (canAct(f)) fn(f); }
}
function bossEnrage(f, text) {
  addStatus(f, 'rage', 30, 1, f); addStatus(f, 'haste', 30, 1, f);
  const c = chest(f);
  float(c.x, c.y - 90, text, '#ff4a6a', 34); ring(c.x, c.y, 140, '#ff4a6a', .5, 6); flashScreen('#ff4a6a', .18); shake(16);
}

// ---------- team and free-for-all ----------
function rivalEntries(n, team0, avoid) {
  return Array.from({ length: n }, (_, i) => modeEntry({ team: team0 + (team0 ? 0 : i), ...themeLoadout(pick(MODE_THEMES)), color: modeColor(avoid),
    hat: modeHat(), name: MODE_NAMES[rndi(0, MODE_NAMES.length - 1)].toUpperCase() }));
}

defMode('team', {
  name: 'Team 2v2', desc: 'You and a CPU partner against two rival CPUs. Your ally backs you up. First team to 3 rounds.',
  order: 60, players: [1, 1], cpu: true, pickers: 2, labels: ['You', 'Ally (CPU)'], winScore: 3,
  setup(cfg) {
    const me = humanEntry(cfg, 0, 0, 0, 'YOU'), ally = modeEntry({ ...loadoutOf(cfg, 1), team: 0, name: 'ALLY', color: '#9dff5a' });
    const rivals = rivalEntries(2, 1, null).map((r, i) => Object.assign(r, { color: ['#ff8a2e', '#ff5ad1'][i], name: 'RIVAL ' + (i + 1) }));
    return { roster: [me, ally, ...rivals], winScore: 3 };
  },
  results() { return teamResults('Your team wins!', 'The rivals win'); },
});

function teamResults(winText, loseText) {
  const won = G_STATE.score[0] > G_STATE.score[1];
  return { title: won ? winText : loseText, color: won ? G_STATE.roster[0].color : G_STATE.roster[2].color,
    lines: [`Final score ${G_STATE.score[0]} – ${G_STATE.score[1]} after ${G_STATE.round} rounds (${levelName(modeDiff())}).`] };
}

defMode('coop', {
  name: 'Co-op 2v2', desc: 'Player 1 and Player 2 team up against two CPUs. First team to 3 rounds.',
  order: 62, players: [2, 2], cpu: true, pickers: 2, labels: ['Player 1', 'Player 2'], winScore: 3,
  setup(cfg) {
    const rivals = rivalEntries(2, 1, null).map((r, i) => Object.assign(r, { color: ['#ff8a2e', '#ff5ad1'][i], name: 'RIVAL ' + (i + 1) }));
    return { roster: [humanEntry(cfg, 0, 0, 0, 'P1'), Object.assign(humanEntry(cfg, 1, 1, 0, 'P2'), { color: '#9dff5a' }), ...rivals], winScore: 3 };
  },
  results() { return teamResults('Players win!', 'The CPUs win'); },
});

defMode('ffa', {
  name: 'Free-for-All', desc: 'Four fighters, everyone for themselves. Last one standing takes the round. First to 3.',
  order: 65, players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 3,
  setup(cfg) {
    const me = humanEntry(cfg, 0, 0, 0, 'YOU'), names = shuffle(MODE_NAMES.slice());
    const cpus = [1, 2, 3].map(i => modeEntry({ team: i, ...themeLoadout(pick(MODE_THEMES)), color: DEFAULT_COLORS[i], hat: modeHat(), name: names[i].toUpperCase() }));
    return { roster: [me, ...cpus], winScore: 3 };
  },
  results() {
    const s = G_STATE.score, best = s.indexOf(Math.max(...s)), won = best === 0;
    return { title: won ? 'You rule the brawl!' : `${G_STATE.roster[best].name} wins the brawl`, color: G_STATE.roster[best].color,
      lines: [`Rounds won: ${G_STATE.roster.map((r, i) => `${r.name} ${s[i]}`).join(' · ')} (${levelName(modeDiff())}).`] };
  },
});

// ---------- Training: an unkillable dummy, a damage meter and instant loadout swaps ----------
// Keys (training only): 1 next weapon, 2 / 3 next skill 1 / 2, 4 dummy behaviour, 5 dummy weapon, 0 reset meter.
const TRAIN_BEHAVES = ['idle', 'roam', 'fight'];
const TRAIN_BEHAVE_NAMES = { idle: 'Standing', roam: 'Moving (no attacks)', fight: 'Fighting back' };

defMode('training', {
  name: 'Training', desc: 'An unkillable dummy, a damage meter and instant swaps: 1 weapon, 2/3 skills, 4 dummy mode, 5 dummy weapon.',
  order: 80, players: [1, 1], cpu: true, pickers: 2, labels: ['You', 'Dummy'], roundLimit: 1e7, winScore: 99, aiArmor: false,
  setup(cfg) {
    return { roster: [humanEntry(cfg, 0, 0, 0, 'YOU'), modeEntry({ ...loadoutOf(cfg, 1), team: 1, name: 'DUMMY', color: '#c9cdee', skills: [null, null] })],
      run: { behave: 'idle', hits: [], total: 0, best: 0, bestCombo: 0, last: 0, lastT: -9, dummyHitT: -9 } };
  },
  roundLabel() { return 'TRAINING'; },
  onRoundStart() { BANNER = null; trainApplyBehave(); G_STATE.lock = .3; G_STATE.winScore = 0; },
  onStep() {
    const run = modeRun(), p = modePlayer(), dummy = F.find(f => f.id === 1);
    for (const f of F) if (!f.summon && f.alive && trainOutOfBounds(f)) trainRespawn(f);
    if (dummy && dummy.alive && G_STATE.t - run.dummyHitT > 2.5 && dummy.hp < dummy.maxHp) dummy.hp = dummy.maxHp;   // refills after a breather
    if (p) run.bestCombo = Math.max(run.bestCombo, p.combo || 0);
  },
  hud(ctx) { trainDrawMeter(ctx); },
});

function trainApplyBehave() {
  const d = F.find(f => f.id === 1);
  if (d) d.ai.behave = modeRun().behave === 'fight' ? null : modeRun().behave;
}
const trainOutOfBounds = f => f.P[2].y > H + 120 || f.P[2].x < -120 || f.P[2].x > W + 120;
// Puts a fighter back at its spawn, still and safe, instead of a ring-out.
function trainRespawn(f) {
  const sp = MAP.spawns[f.id % MAP.spawns.length];
  moveFighter(f, sp[0] - f.P[2].x, sp[1] - 60 - feetY(f));
  for (const p of f.P) { p.ox = p.x; p.oy = p.y; }
  f.inv = .8;
  const c = chest(f);
  ring(c.x, c.y, 60, f.color, .4, 4);
}
// Damage meter: total, last hit, best hit, damage per second over the last 3 s, combos.
function trainDps(run) {
  const now = G_STATE.t, recent = run.hits.filter(h => now - h.t < 3);
  run.hits = recent;
  if (!recent.length) return 0;
  return recent.reduce((s, h) => s + h.amt, 0) / clamp(now - recent[0].t, 1, 3);
}
function trainDrawMeter(ctx) {
  const run = modeRun(), p = modePlayer(), x = 24, y = 104, w = 300;   // under the HUD, clear of the floor
  if (!run.hits) return;
  modePanel(ctx, x, y, w, 158);
  const rows = [['DPS (3 s)', trainDps(run).toFixed(1)], ['Last hit', run.last], ['Best hit', run.best], ['Total', run.total],
    ['Combo', `${p && p.comboT > 0 ? p.combo : 0}  (best ${run.bestCombo})`]];
  rows.forEach(([k, v], i) => {
    modeText(ctx, k, x + 16, y + 22 + i * 22, 13, '#9096c2', 'left', '600 ' + FONT_BODY);
    modeText(ctx, String(v), x + w - 16, y + 22 + i * 22, 15, '#ffffff', 'right');
  });
  modeText(ctx, `Dummy: ${TRAIN_BEHAVE_NAMES[run.behave]}`, x + 16, y + 140, 12, '#ffd84a', 'left', '600 ' + FONT_BODY);
  modeText(ctx, '1 weapon · 2/3 skills · 4 dummy · 5 dummy weapon · 0 reset', x + 16, y + 176, 12, 'rgba(201,205,238,.75)', 'left', '600 ' + FONT_BODY);   // under the meter, clear of the mute tag
}

// Cycles to the next visible key in a registry (null/none included for skills).
function trainNext(reg, current, withNone) {
  const keys = (withNone ? [null] : []).concat(listOf(reg).map(d => d.key));
  return keys[(keys.indexOf(current) + 1) % keys.length];
}
function trainKey(code) {
  const run = modeRun(), p = modePlayer(), d = F.find(f => f.id === 1);
  if (!p || !d) return false;
  const tag = (f, text, color) => float(f.P[0].x, f.P[0].y - 50, text, color || '#ffd84a', 20);
  if (code === 'Digit1') { const k = trainNext(WEAPONS, p.wkey); equipWeapon(p, k); G_STATE.roster[0].weapon = k; tag(p, WEAPONS[k].name); }
  else if (code === 'Digit2' || code === 'Digit3') {
    const slot = code === 'Digit2' ? 0 : 1, k = trainNext(SKILLS, p.skills[slot], true);
    p.skills[slot] = k; p.skillCd[slot] = 0; G_STATE.roster[0].skills = p.skills.slice();
    tag(p, k ? SKILLS[k].name : 'No skill', k ? SKILLS[k].color : '#9096c2');
  } else if (code === 'Digit4') {
    run.behave = TRAIN_BEHAVES[(TRAIN_BEHAVES.indexOf(run.behave) + 1) % TRAIN_BEHAVES.length];
    trainApplyBehave(); tag(d, TRAIN_BEHAVE_NAMES[run.behave]);
  } else if (code === 'Digit5') { const k = trainNext(WEAPONS, d.wkey); equipWeapon(d, k); G_STATE.roster[1].weapon = k; tag(d, WEAPONS[k].name, '#c9cdee'); }
  else if (code === 'Digit0') { Object.assign(run, { hits: [], total: 0, best: 0, bestCombo: 0, last: 0 }); tag(p, 'Meter reset', '#9096c2'); }
  else return false;
  sfx('click');
  return true;
}

// Nobody dies in training: a lethal blow refills health instead. The player's damage feeds the meter.
on('damage', (B, amt, o) => {
  if (!G_STATE.mode || G_STATE.mode.key !== 'training' || B.summon) return;
  const run = modeRun(), A = o && o.src;
  if (B.id === 1) run.dummyHitT = G_STATE.t;
  if (A && A.id === 0 && B.team !== A.team) {
    run.hits.push({ t: G_STATE.t, amt }); run.total += amt; run.last = amt; run.best = Math.max(run.best, amt);
  }
  if (B.hp <= 0) { B.hp = B.maxHp; float(B.P[0].x, B.P[0].y - 60, 'RESET', '#9096c2', 20); }
});

if (typeof addEventListener === 'function') {
  addEventListener('keydown', e => {
    if (e.repeat || !G_STATE.mode || G_STATE.mode.key !== 'training' || G_STATE.state !== 'play') return;
    if (BINDS.some(b => Object.values(b).includes(e.code))) return;     // the player rebound this key to a control
    if (trainKey(e.code)) e.preventDefault();
  });
}

// ---------- One-Hit KO: any solid blow is lethal ----------
// A melee blow, blast or skill of OHKO_MIN+ damage kills. Bullets and bolts only wound first (a wounded fighter
// drops to half health and the next solid hit of any kind kills), so a gun isn't a one-click win. Nobody can attack
// for OHKO_GRACE seconds after FIGHT: a short standoff to find your spacing.
const OHKO_MIN = 8, OHKO_GRACE = 1.2;

defMode('ohko', {
  name: 'One-Hit KO', desc: 'Every solid blow kills; bullets wound first. Patience, spacing and timing win. You vs CPU, first to 5.',
  order: 70, players: [1, 1], cpu: true, pickers: 2, labels: ['You', 'CPU'], winScore: 5, roundLimit: 30,
  setup(cfg) { return { roster: [humanEntry(cfg, 0, 0, 0, 'YOU'), modeEntry({ ...loadoutOf(cfg, 1), team: 1, name: 'CPU' })] }; },
  roundLabel() { return 'ONE HIT · R' + G_STATE.round; },
  results: duelResults,
  onStep() {
    const left = OHKO_GRACE - G_STATE.roundT;
    if (G_STATE.lock > 0 || left <= 0) return;
    for (const f of F) {                                              // hold every attack and skill until it ends
      f.atkCd = Math.max(f.atkCd, left);
      f.skillCd = f.skillCd.map(cd => Math.max(cd, left));
    }
  },
  hud(ctx) {
    const left = OHKO_GRACE - G_STATE.roundT;
    if (G_STATE.lock <= 0 && left > 0 && !G_STATE.ending) modeText(ctx, 'STANDOFF', W / 2, 150, 26, '#ffd84a');
  },
});
on('damage', (B, amt, o) => {
  if (!G_STATE.mode || G_STATE.mode.key !== 'ohko' || B.summon || !B.alive) return;
  const kind = (o && o.kind) || 'melee';
  if (amt < OHKO_MIN || kind === 'status' || kind === 'hazard' || kind === 'ringout') return;
  if (kind === 'proj' && !B.mem.ohkoWound) {                         // first bullet: a wound, not a kill
    B.mem.ohkoWound = true;
    B.hp = clamp(B.maxHp * .5, 1, Math.max(1, B.hp));
    float(B.P[0].x, B.P[0].y - 50, 'WOUNDED', '#ff8a2e', 22);
    return;
  }
  B.hp = 0;                                                          // damage() KOs right after this event
});

// ---------- Weapon Roulette: new random weapons every round, and a re-spin every 15 seconds ----------
const ROULETTE_EVERY = 15;

defMode('roulette', {
  name: 'Weapon Roulette', desc: `Random weapons every round, re-spun every ${ROULETTE_EVERY} s mid-fight. Adapt fast! First to 5.`,
  order: 72, players: [1, 1], cpu: true, pickers: 0, winScore: 5, rerollRandom: true,
  setup(cfg) {
    const skills = ['random', 'random'];
    return { roster: [modeEntry({ ctrl: 'human', slot: 0, team: 0, name: 'YOU', color: DEFAULT_COLORS[0], skills }),
      modeEntry({ team: 1, name: 'CPU', color: DEFAULT_COLORS[1], skills })], run: { spin: ROULETTE_EVERY } };
  },
  onRoundStart() { modeRun().spin = ROULETTE_EVERY; },
  results: duelResults,
  onStep(dt) {
    const run = modeRun();
    if (G_STATE.lock > 0 || G_STATE.ending || (run.spin -= dt) > 0) return;
    run.spin = ROULETTE_EVERY;
    for (const f of F) {
      if (!f.alive || f.summon) continue;
      equipWeapon(f, randomKey(WEAPONS, w => w.key !== f.wkey) || f.wkey);
      float(f.P[0].x, f.P[0].y - 60, f.w.name.toUpperCase(), f.color, 22);
      const c = chest(f);
      ring(c.x, c.y, 70, f.color, .35, 4);
    }
    banner('SPIN!', '', .8, '#ffd84a'); sfx('orb');
  },
  hud(ctx) {
    const run = modeRun(), frac = clamp(run.spin / ROULETTE_EVERY, 0, 1), x = W / 2, y = 92;
    circle(ctx, x, y, 17, 'rgba(8,9,22,.85)', 'rgba(255,216,74,.35)', 2);
    ctx.strokeStyle = run.spin < 3 ? '#ff4a6a' : '#ffd84a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
    modeText(ctx, String(Math.ceil(run.spin)), x, y + 1, 14, '#ffffff');
  },
});

// ---------- King of the Hill: score by holding the glowing zone; KOs respawn ----------
const KOTH_GOAL = 15, KOTH_MOVE = 14, KOTH_W = 250;   // wide enough that a fight for the zone happens inside it
// Respawn quickly so the hill is rarely empty (2.5 s left it empty ~50% of CPU play time). KOTH_TALL: the zone is the
// glowing column drawn above it (170 px), so a fighter jumping or knocked up inside it still holds.
// KOTH_KB_IN: knockback taken while standing in the zone, so one hit doesn't empty the hill.
const KOTH_RESPAWN = 1.2, KOTH_TALL = 170, KOTH_KB_IN = .5;

// Places the zone could be: on the floor and on wide, still platforms, away from hazards, bounce pads and
// anything else the map lists in `floorBusy` (e.g. conveyor belts): a zone there can't be held.
function kothSpots() {
  const spots = [], half = KOTH_W / 2;
  const onPad = (x, y) => (MAP.pads || []).some(pd => Math.abs(pd.y - y) < 12 && x + half > pd.x && x - half < pd.x + pd.w);
  const busy = (x, y) => y === MAP.floor && (MAP.floorBusy || []).some(b => x + half > b.x && x - half < b.x + b.w);
  const clear = (x, y) => !MAP.hazards.some(hz => inRect(x, y - 10, hz, half)) && !onPad(x, y) && !busy(x, y);
  if (MAP.floor != null) for (const x of [360, 640, 920]) if (clear(x, MAP.floor)) spots.push({ s: null, off: x, y: MAP.floor, w: KOTH_W });
  for (const s of MAP.solids) if (s.w >= 150 && s.y > 120 && !s.move && clear(s.x + s.w / 2, s.y)) spots.push({ s, off: s.w / 2, y: s.y, w: Math.min(KOTH_W, s.w - 10) });
  return spots.length ? spots : [{ s: null, off: W / 2, y: MAP.floor ?? 600, w: KOTH_W }];
}
const kothSpotX = z => z.s ? z.s.x + z.off : z.off;
// The zone's live position (it rides moving platforms).
function kothZone() {
  const z = modeRun().zone;
  if (!z) return null;
  return z.s ? { x: z.s.x + z.off, y: z.s.y, w: z.w } : { x: z.off, y: z.y, w: z.w };
}
function kothMoveZone(run) {
  const spots = kothSpots(), others = spots.filter(z => z !== run.zone && !(run.zone && z.s === run.zone.s && z.off === run.zone.off));
  // Hop to one of the two nearest other spots: a trek across the map left the hill empty for seconds after each move.
  const at = kothZone(), near = at ? others.map(o => ({ o, d: Math.hypot(kothSpotX(o) - at.x, o.y - at.y) })).sort((a, b) => a.d - b.d).slice(0, 2).map(e => e.o) : others;
  run.zone = pick(near.length ? near : spots);
  run.moveT = KOTH_MOVE;
  const z = kothZone();
  if (z) ring(z.x, z.y - 20, z.w * .6, '#ffd84a', .5, 4);
}
const kothInside = (f, z) => { if (!f.alive || f.summon || Math.abs(f.P[2].x - z.x) >= z.w / 2) return false;
  const up = z.y - feetY(f); return up > -24 && up < KOTH_TALL; };

function kothRespawn(old) {
  const r = G_STATE.roster[old.id], z = kothZone();
  // The nearest spawn at least 300 px from the zone (no spawning on the hill), else the farthest one.
  const spawns = MAP.spawns.slice(0, Math.max(2, G_STATE.roster.length)).sort((a, b) => Math.abs(a[0] - z.x) - Math.abs(b[0] - z.x));
  const sp = spawns.find(s => Math.abs(s[0] - z.x) >= 300) || spawns[spawns.length - 1];
  const f = makeFighter(Object.assign({}, r, { id: old.id, x: sp[0], y: sp[1], face: sp[0] < W / 2 ? 1 : -1, weapon: old.wkey,
    skills: old.skills, autopilot: old.autopilot }));
  f.inv = 1.2;                                        // brief spawn protection
  F = F.map(o => o === old ? f : o);
  const c = chest(f);
  ring(c.x, c.y, 80, f.color, .4, 5); burst(c.x, c.y, f.color, 20, 300);
}

defMode('koth', {
  name: 'King of the Hill', desc: `Stand in the glowing zone to score. It moves, and KOs respawn. First to ${KOTH_GOAL} takes the round.`,
  order: 75, players: [1, 1], cpu: true, pickers: 2, labels: ['You', 'CPU'], winScore: 2, roundLimit: 90,
  setup(cfg) {
    return { roster: [humanEntry(cfg, 0, 0, 0, 'YOU'), modeEntry({ ...loadoutOf(cfg, 1), team: 1, name: 'CPU' })], winScore: 2, run: { pts: [0, 0] } };
  },
  onRoundStart() { const run = modeRun(); run.pts = Array(G_STATE.teams).fill(0); run.dead = {}; kothMoveZone(run); },
  holdRound() { return true; },
  results: duelResults,
  aiGoal() { return kothZone(); },
  onKO(victim) { if (!victim.summon) modeRun().dead[victim.id] = KOTH_RESPAWN; },
  onStep(dt) {
    const run = modeRun(), z = kothZone();
    if (!z || G_STATE.ending || G_STATE.lock > 0 || G_STATE.state === 'over') return;
    for (const id in run.dead) if ((run.dead[id] -= dt) <= 0) { delete run.dead[id]; const old = F.find(f => f.id === +id); if (old && !old.alive) kothRespawn(old); }
    if ((run.moveT -= dt) <= 0) kothMoveZone(run);
    for (const f of F) if (!f.summon) f.kbMul = kothInside(f, z) ? KOTH_KB_IN : 1;
    const teams = [...new Set(F.filter(f => kothInside(f, z)).map(f => f.team))];
    run.holder = teams.length === 1 ? teams[0] : teams.length ? -2 : -1;    // -2 contested, -1 empty
    if (run.holder >= 0) run.pts[run.holder] += dt;
    const top = run.pts.indexOf(Math.max(...run.pts));
    if (run.pts[top] >= KOTH_GOAL) { endRound(top, 'zone'); banner('HILL TAKEN', teamName(top).toUpperCase(), TUNE.koDelay * .9, teamColor(top)); }
    else if (G_STATE.roundT >= G_STATE.roundLimit) {
      const tie = run.pts.filter(p => Math.abs(p - run.pts[top]) < .05).length > 1;
      endRound(tie ? -1 : top, 'time');
    }
  },
  drawWorld(ctx) {
    const z = kothZone(), run = modeRun();
    if (!z) return;
    const color = run.holder >= 0 ? teamColor(run.holder) : run.holder === -2 ? '#ffffff' : '#ffd84a', t = G_STATE.t;
    const g = ctx.createLinearGradient(0, z.y - KOTH_TALL, 0, z.y);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, .22 + .06 * Math.sin(t * 4)));
    ctx.fillStyle = g; ctx.fillRect(z.x - z.w / 2, z.y - KOTH_TALL, z.w, KOTH_TALL);
    glow(ctx, color, 16, () => lineXY(ctx, z.x - z.w / 2, z.y - 2, z.x + z.w / 2, z.y - 2, color, 5));
    for (const side of [-1, 1]) lineXY(ctx, z.x + side * z.w / 2, z.y, z.x + side * z.w / 2, z.y - KOTH_TALL, rgba(color, .5), 2);
    modeText(ctx, '♛', z.x, z.y - 140 + Math.sin(t * 3) * 5, 26, color);
  },
  hud(ctx) {
    const run = modeRun(), n = run.pts.length, w = 240, y = 94;
    run.pts.forEach((p, team) => {
      const x = n === 2 ? (team ? W / 2 + 20 : W / 2 - 20 - w) : W / 2 - w / 2;
      modeBigBar(ctx, x, y + (n === 2 ? 0 : team * 30), w, p / KOTH_GOAL, teamColor(team), null);
      modeText(ctx, p.toFixed(0), team ? x + w + 16 : x - 16, y + 8, 14, '#ffffff', team ? 'left' : 'right');
    });
    const st = run.holder === -2 ? 'CONTESTED!' : run.holder >= 0 ? 'KING OF THE HILL: ' + teamName(run.holder) : 'THE HILL IS EMPTY';
    modeText(ctx, st, W / 2, y + 38, 14, run.holder >= 0 ? teamColor(run.holder) : '#c9cdee');
    for (const id in run.dead) {
      const r = G_STATE.roster[id];
      if (r) modeText(ctx, `${r.name} respawns in ${Math.ceil(run.dead[id])}`, W / 2, y + 62 + id * 20, 13, r.color, 'center', '600 ' + FONT_BODY);
    }
  },
});
