// 77-challenges.js: 31 challenge levels with 1-3 stars, run by the trial engine in 76-campaign.js (same spec format:
// foes, map, wx, mods, me, goal, rules, st). Progress is saved through `store` as 'challenges' = { id: stars }.
// The list screen is in 98-campaign-ui.js.

const NO_SKILLS = 'none';
const CHALLENGES = [
  { id: 'pan', name: 'Pan Handler', icon: '🍳', desc: 'Win armed with nothing but the frying pan.',
    me: { weapon: 'frying-pan' }, foes: [['Sous Chef', 'katana', 'normal']], map: ['kitchen', 'dojo'], st: ['time', 40, 'hp', .5] },
  { id: 'grenadier', name: 'Grenadier', icon: '💣', desc: 'K.O. 3 foes with throwables. You carry four of each.',
    me: { skills: NO_SKILLS, throws: ['grenade', 'cluster'], throwN: 4, superMul: .01, hp: 1.5 }, foes: [['Target', 'bat', 'easy', { hp: .4 }], ['Target', 'spear', 'easy', { hp: .4 }]],
    map: 'dojo', goal: { kind: 'count', stat: 'throwKos', n: 3 }, st: ['time', 70, 'time', 40] },
  { id: 'laststand', name: 'Last Stand', icon: '🛡', desc: 'Survive 60 seconds against three Hard CPUs. Keep moving!', me: { hp: 3 },
    foes: [['Raider', 'random', 'hard'], ['Raider', 'random', 'hard'], ['Raider', 'random', 'hard']], map: 'neon',
    goal: { kind: 'survive', secs: 60 }, st: ['hp', .25, 'hp', .5] },
  { id: 'noblock', name: 'Hands Down', icon: '🙌', desc: 'Beat two CPUs without blocking once.',
    foes: [['Duelist', 'saber', 'normal'], ['Duelist', 'mace', 'easy']], map: 'dojo', rules: { noBlock: true }, st: ['hp', .35, 'time', 45] },
  { id: 'ringboss', name: 'Over the Edge', icon: '🌀', desc: 'Ring a giant out of the Sky Bridge. It is far too tough to K.O.',
    foes: [['Cloud Giant', 'hammer', 'normal', { scale: 1.6, hp: 4, boss: true, kb: 1.2 }]], map: ['sky', 'pirate'],
    goal: { kind: 'count', stat: 'ringouts', n: 1 }, st: ['time', 45, 'time', 25] },
  { id: 'parry', name: 'Perfect Timing', icon: '⏱', desc: 'Parry 5 attacks: raise your guard just as the blow lands.',
    foes: [['Sparring Master', 'katana', 'normal', { hp: 3 }]], map: 'dojo', goal: { kind: 'count', stat: 'parries', n: 5 }, st: ['time', 60, 'time', 35] },
  { id: 'grounded', name: 'Grounded', icon: '🦶', desc: 'Win without jumping.', rules: { noJump: true },
    foes: [['Lancer', 'spear', 'normal']], map: 'neon', st: ['hp', .4, 'time', 40] },
  { id: 'noskill', name: 'Bare Basics', icon: '◻', desc: 'Beat a Hard CPU with no skills at all.',
    me: { skills: NO_SKILLS }, foes: [['Veteran', 'broadsword', 'hard']], map: 'dojo', st: ['hp', .3, 'time', 45] },
  { id: 'glass', name: 'Glass Cannon', icon: '🥂', desc: 'Win with only 30% of your health.',
    me: { hp: .3 }, foes: [['Bruiser', 'bat', 'normal']], map: 'neon', st: ['hp', .5, 'time', 35] },
  { id: 'giant', name: 'Giant Slayer', icon: '🗿', desc: 'Topple a giant nearly twice your size.',
    foes: [['Colossus', 'greatsword', 'normal', { scale: 1.9, hp: 1, boss: true }]], map: 'dojo', st: ['hp', .4, 'time', 60] },
  { id: 'fists', name: 'Knuckle Duster', icon: '🥊', desc: 'Boxing gloves against a swordsman.',
    me: { weapon: 'boxing-gloves' }, foes: [['Swordsman', 'broadsword', 'normal']], map: 'dojo', st: ['hp', .4, 'time', 40] },
  { id: 'sniper', name: 'Long Shot', icon: '🎯', desc: 'Win with the sniper rifle on a bottomless sky.',
    me: { weapon: 'sniper' }, foes: [['Skirmisher', 'twin-daggers', 'easy'], ['Skirmisher', 'spear', 'easy']], map: ['sky', 'pirate'], st: ['hp', .4, 'time', 50] },
  { id: 'suplex', name: 'Suplex City', icon: '🤼', desc: 'Grab and throw foes 4 times.',
    me: { hp: 1.5 }, foes: [['Wrestler', 'boxing-gloves', 'easy', { hp: 2 }]], map: 'dojo', goal: { kind: 'count', stat: 'throws', n: 4 }, st: ['time', 50, 'time', 25] },
  { id: 'disarm', name: 'Butterfingers', icon: '🫳', desc: 'Knock the weapon out of a foe\'s hands twice.',
    me: { weapon: 'battle-axe', cls: 'brute', hp: 1.5 }, foes: [['Fencer', 'rapier', 'easy', { hp: 2 }]], map: 'dojo',
    goal: { kind: 'count', stat: 'disarms', n: 2 }, st: ['time', 60, 'time', 30] },
  { id: 'super', name: 'Supercharged', icon: '⚡', desc: 'Unleash 2 ultimates. Your meter starts full and fills fast.',
    me: { super: 100, superMul: 3 }, foes: [['Sparring Bot', 'bat', 'easy', { hp: 2 }]], map: 'neon',
    goal: { kind: 'count', stat: 'ults', n: 2 }, st: ['time', 40, 'time', 20] },
  { id: 'lava', name: 'Floor Is Lava', icon: '🌋', desc: 'Win in the caldera while cinders rain down.',
    foes: [['Fire Dancer', 'flame-sword', 'easy', { hp: .6 }], ['Fire Dancer', 'whip', 'easy', { hp: .6 }]], map: ['caldera', 'eruption'], mods: ['embers'], st: ['hp', .4, 'time', 50] },
  { id: 'skate', name: 'Ice Skater', icon: '⛸', desc: 'Win on Frost Peak in a snowstorm.',
    foes: [['Skater', 'frost-blade', 'normal']], map: 'frost', wx: 'snow', st: ['hp', .4, 'time', 45] },
  { id: 'blackout', name: 'Lights Out', icon: '🌑', desc: 'Win in near total darkness.',
    me: { hp: 1.2 }, foes: [['Lurker', 'scythe', 'normal', { hp: .7 }], ['Lurker', 'kunai', 'easy', { hp: .7 }]], map: ['mansion', 'graveyard'], mods: ['dark'], st: ['hp', .4, 'time', 50] },
  { id: 'swarm', name: 'The Swarm', icon: '🐝', desc: 'Defeat six foes at once.',
    me: { hp: 1.6 }, foes: Array.from({ length: 6 }, (_, i) => ['Drone', ['bat', 'spear', 'saber', 'mace', 'pistol', 'whip'][i], 'easy', { hp: .35 }]), map: 'neon',
    st: ['hp', .35, 'time', 60] },
  { id: 'walls', name: 'Wall Runner', icon: '🧗', desc: 'Wall jump 6 times (jump off the arena edges in mid-air).',
    foes: [['Spectator', 'bat', 'easy', { hp: 2, behave: 'roam' }]], map: 'dojo', goal: { kind: 'count', stat: 'wallJumps', n: 6 }, st: ['time', 40, 'time', 20] },
  { id: 'speed', name: 'Lightning Round', icon: '⏩', desc: 'Win within 20 seconds.', rules: { limit: 20 },
    foes: [['Rookie', 'bat', 'easy']], map: 'neon', st: ['time', 14, 'time', 9] },
  { id: 'flawless', name: 'Untouchable', icon: '✨', desc: 'Win while taking less than 25 damage.', rules: { maxTaken: 25 },
    foes: [['Challenger', 'saber', 'normal']], map: 'dojo', st: ['hp', .85, 'time', 40] },
  { id: 'tanks', name: 'Tank Buster', icon: '🪨', desc: 'Beat two Hard tanks.',
    foes: [['Bulwark', 'mace', 'hard', { cls: 'tank' }], ['Bulwark', 'kite-shield', 'hard', { cls: 'tank' }]], map: 'foundry', st: ['hp', .3, 'time', 70] },
  { id: 'mirror', name: 'Mirror Match', icon: '🪞', desc: 'Beat a Hard copy of yourself, same weapon and skills.', mirror: true,
    foes: [['Reflection', 'random', 'hard']], map: 'neon', st: ['hp', .35, 'time', 50] },
  { id: 'pirates', name: 'Boarding Party', icon: '🏴', desc: 'Repel three sky pirates from the deck.',
    me: { hp: 1.3 }, foes: [['Pirate', 'saber', 'easy', { hp: .55 }], ['Pirate', 'saber', 'easy', { hp: .55 }], ['Pirate', 'pistol', 'easy', { hp: .55 }]], map: ['pirate', 'sky'], st: ['hp', .35, 'time', 55] },
  { id: 'moonwalk', name: 'Moonwalk', icon: '🌙', desc: 'Win with the hammer in extra low gravity.',
    me: { weapon: 'hammer' }, foes: [['Astronaut', 'laser', 'normal']], map: 'moon', mods: ['lowgrav'], st: ['hp', .4, 'time', 50] },
  { id: 'bubble', name: 'Bubble Trouble', icon: '🫧', desc: 'Win with the bubble blaster against two foes.',
    me: { weapon: 'bubble', hp: 1.3 }, foes: [['Prankster', 'bat', 'easy', { hp: .6 }], ['Prankster', 'whip', 'easy', { hp: .6 }]], map: 'neon', st: ['hp', .4, 'time', 55] },
  { id: 'sugar', name: 'Sugar Rush', icon: '🍭', desc: 'Lollipop vs hasty candy goblins.',
    me: { weapon: 'lollipop' }, foes: [['Gumdrop', 'twin-daggers', 'easy', { hp: .6 }], ['Gumdrop', 'nunchaku', 'easy', { hp: .6 }]], map: ['candy', 'neon'], mods: ['haste'],
    st: ['hp', .4, 'time', 50] },
  { id: 'twins', name: 'Double Trouble', icon: '👯', desc: 'Two mini-bosses at once.',
    me: { hp: 1.4 }, foes: [['Ash Twin', 'flame-sword', 'normal', { scale: 1.25, hp: .65, boss: true }], ['Frost Twin', 'frost-blade', 'normal', { scale: 1.25, hp: .65, boss: true }]],
    map: 'dojo', st: ['hp', .3, 'time', 80] },
  { id: 'bombsquad', name: 'Bomb Squad', icon: '🧨', desc: 'Win without attacking: throwables and skills only.', rules: { noAttack: true },
    me: { throws: ['grenade', 'sticky'], throwN: 4, skills: ['fireball', 'lightning'] }, foes: [['Dummy Knight', 'mace', 'easy', { hp: .8 }]],
    map: 'dojo', st: ['hp', .4, 'time', 45] },
  { id: 'insane', name: 'The Final Exam', icon: '🎓', desc: 'Beat an Insane CPU, one on one.',
    foes: [['Grandmaster', 'random', 'insane']], map: 'neon', st: ['hp', .3, 'time', 50] },
];
const CHAL_BY_ID = Object.fromEntries(CHALLENGES.map(c => [c.id, c]));

function chalSave() { return Object.assign({}, store.getObj('challenges')); }
const chalStarTotal = s => CHALLENGES.reduce((t, c) => t + (s[c.id] || 0), 0);

// The challenge as a trial spec; a mirror match copies the player's own loadout onto the foe.
function chalSpec(c, cfg) {
  const spec = Object.assign({ goal: { kind: 'win' }, rules: {}, st: ['hp', .35, 'time', 40] }, c);
  if (c.mirror) {
    const lo = loadoutOf(cfg, 0);
    spec.foes = [[c.foes[0][0], lo.weapon, c.foes[0][2], { skills: lo.skills.map(k => k || 'random'), cls: lo.cls }]];
  }
  return spec;
}

defMode('challenge', Object.assign({}, QUEST_MODE, {
  name: 'Challenges', icon: '🏅', desc: 'Short trials with special goals and rules. Earn up to 3 stars each.',
  setup(cfg) {
    const c = CHAL_BY_ID[cfg.challenge] || CHALLENGES[0], spec = chalSpec(c, cfg);
    if (cfg.weather == null || cfg.weather === 'random') cfg.weather = c.wx || 'clear';
    return { roster: questRoster(cfg, spec, '#ff5ad1'), map: questMap(c.map, ['dojo', 'neon']), winScore: 1, roundLimit: 999,
      run: questNewRun(spec, 'challenge', c.id) };
  },
  roundLabel() { const c = CHAL_BY_ID[modeRun().id]; return c ? c.name.toUpperCase() : ''; },
  onRoundStart() {
    questRoundStart();
    const c = CHAL_BY_ID[modeRun().id];
    banner(c.name.toUpperCase(), c.desc.toUpperCase(), 2.2, '#ff5ad1');
  },
  results() { return chalSettle(modeRun(), !!G_STATE.cfg.autopilot); },
}));

function chalSettle(run, dryRun) {
  const c = CHAL_BY_ID[run.id], o = questOutcome(run), s = chalSave(), before = s[c.id] || 0;
  if (o.won) s[c.id] = Math.max(before, o.stars);
  if (!dryRun) store.set('challenges', s);
  QUEST_PENDING.last = { kind: 'challenge', id: c.id, won: o.won };
  const lines = [o.won ? `${questStarStr(o.stars)}  in ${Math.round(o.t)} s with ${Math.round(o.hp * 100)}% health` : 'Challenge failed. Try again!',
    `Stars: ${questStarRules(c.st).map(questStarText).join(' · ')}`, `Challenge stars: ${chalStarTotal(s)} / ${CHALLENGES.length * 3}`];
  if (o.won && o.stars > before && before) lines.splice(1, 0, `New best: ${questStarStr(o.stars)}`);
  return { title: o.won ? `${c.name}: ${o.stars > 1 ? (o.stars > 2 ? 'Perfect!' : 'Great!') : 'Cleared!'}` : `${c.name}: failed`,
    color: o.won ? '#ffd84a' : '#ff4a6a', won: o.won, stars: o.stars, lines };
}
