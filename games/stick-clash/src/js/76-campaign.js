// 76-campaign.js: the solo "Mythic Quest" campaign (4 realms, 24 nodes, realm bosses with bossPhases), its light
// skill tree, and the trial engine it shares with the challenge levels (77-challenges.js).
//
// A trial spec (campaign node or challenge) is plain data:
//   foes:  [[name, weapon, level, { skills, scale, hp, cls, color, boss, kb, throws, behave, dmg, ringSave }], ...]   (team 1, together;
//          behave: 'roam' = moves but never attacks)
//   map:   key or [keys] (first registered wins)   wx: weather key   mods: ['dark', 'slick', ...] (QUEST_MODS)
//   me:    { weapon, skills, cls, throws, hp, throwN, super, superMul }   overrides on the player's own loadout
//   goal:  { kind: 'win' } | { kind: 'survive', secs } | { kind: 'count', stat, n }   (stats: QUEST_STAT_NAMES)
//   rules: { noBlock, noJump, noSkill, noAttack, maxTaken, limit }   breaking one fails the trial
//   st:    star conditions [kind, value, kind, value]: ★ for clearing, +★ per condition met ('hp' fraction left,
//          'time' seconds or less)
// Test hook: SC.quest (wired at boot in 98-campaign-ui) lists every node/challenge and can force a win.

// ---------- trial engine ----------
const QUEST_STAT_NAMES = { parries: 'Parries', throws: 'Grab throws', disarms: 'Disarms', ults: 'Ultimates', wallJumps: 'Wall jumps',
  kos: 'K.O.s', ringouts: 'Ring-outs', throwKos: 'Throwable K.O.s' };
const QUEST_RULE_TEXT = { noBlock: 'No blocking', noJump: 'No jumping', noSkill: 'No skills', noAttack: 'No attacks' };
const QUEST_PENDING = { post: null, last: null };     // the UI reads these after a match (post-fight dialogue)

const questRun = () => modeRun().spec ? modeRun() : null;
const questIsMe = f => !!f && f.id === 0 && !f.summon && !!questRun();
const questSkills = s => !s ? ['random', 'random'] : s === 'none' ? [null, null] : s.map(k => SKILLS[k] ? k : 'random');
function questMap(want, fallback) {
  for (const k of [].concat(want || [], fallback || [])) if (MAPS[k]) return k;
  return randomKey(MAPS);
}

// The player: their own menu loadout with the trial's overrides.
function questHero(cfg, me = {}) {
  const r = humanEntry(cfg, 0, 0, 0, 'YOU');
  if (me.weapon && WEAPONS[me.weapon]) r.weapon = me.weapon;
  if (me.skills) r.skills = questSkills(me.skills);
  if (me.cls) r.cls = me.cls;
  if (me.throws) r.throws = me.throws;
  if (me.hp) r.hpMul = me.hp;
  return r;
}
function questFoe([name, weapon, level, o = {}], i, color, shift) {
  const scale = o.scale || 1;
  return modeEntry({ team: 1, name: name.toUpperCase(), weapon: modeWeapon([weapon], o.cats), skills: questSkills(o.skills),
    color: o.color || color, hat: o.hat || 'none', scale, hpMul: o.hp || 1, aiLevel: aiShift(level || 'normal', shift || 0),
    spawn: i + 1, cls: o.cls || (scale > 1.05 ? 'none' : 'random'), throws: o.throws || ['random', 'random'], isBoss: !!o.boss, qKb: o.kb, qBehave: o.behave, qRing: o.ringSave, qDmg: o.dmg });
}
function questRoster(cfg, spec, color) {
  const shift = DIFF_SHIFT[cfg.diff] || 0;
  return [questHero(cfg, spec.me), ...spec.foes.map((f, i) => questFoe(f, i, color, shift))];
}
function questNewRun(spec, kind, id) { return { spec, kind, id, t: 0, count: {}, taken: 0, dead: {}, broke: null, force: false }; }

// Arena modifiers: start(run) once per round, step(run, dt) every step.
const QUEST_MODS = {
  dark: { step() { MAP.dark = Math.max(MAP.dark || 0, .82); } },                       // lit only by fighters and blades
  slick: { start() { PHYS.friction *= .3; } },
  lowgrav: { start() { PHYS.gravity *= .6; } },
  haste: { start() { for (const f of F) if (f.team !== 0) addStatus(f, 'haste', 999, 1, f); } },
  embers: { step: (run, dt) => questSkyfall(run, dt, { color: '#ff8a2e', status: ['burn', 2, 1] }) },
  hail: { step: (run, dt) => questSkyfall(run, dt, { color: '#e8fbff', status: ['slow', 1.2, 1] }) },
};
// Marked strikes falling on the player every few seconds (owned by a living foe).
function questSkyfall(run, dt, o) {
  if ((run.fallT = (run.fallT ?? 2) - dt) > 0) return;
  run.fallT = rnd(2.2, 3.2);
  const foe = F.find(f => f.team !== 0 && f.alive);
  if (foe) bossStrike(foe, Object.assign({ dmg: 6, radius: 55, warn: 1 }, o));
}

function questRoundStart() {
  const run = questRun();
  if (!run) return;
  Object.assign(run, { t: 0, count: {}, taken: 0, dead: {}, broke: null, force: false });
  for (const f of F) questTag(f);
  const me = modePlayer(), m = run.spec.me || {};
  if (me && m.throwN) me.throwN = me.throws.map(k => k ? m.throwN : 0);
  if (me && m.super) me.super = m.super;
  if (me && m.ringSave) { run.saves = m.ringSave; me.ringSave = questHeroSave; }
  if (me && m.superMul) me.superMul = (me.superMul || 1) * m.superMul;
  for (const k of run.spec.mods || []) if (QUEST_MODS[k] && QUEST_MODS[k].start) QUEST_MODS[k].start(run);
}
// Bosses come back from the roster (fresh fighters after a respawn too).
function questTag(f) {
  const r = G_STATE.roster[f.id];
  if (!r || f.summon) return;
  if (r.qBehave) f.ai.behave = r.qBehave;
  if (r.isBoss) { f.isBoss = true; f.kbMul = r.qKb ?? .6; }
  if (r.qRing) f.ringSave = questRingSave;
  if (r.qDmg) f.dmgCls = (f.dmgCls || 1) * r.qDmg;     // o.dmg: a big boss's damage dealt (its size already adds reach and speed)
}
// A boss with ringSave: o.ringSave in its spec rides the wind back up when knocked off the arena: the fall costs it
// that share of its health (a K.O. if that's all it had left) instead of ending the fight at once.
function questRingSave(f) {
  const r = G_STATE.roster[f.id];
  return questLift(f, (r && r.qRing) || .2, 'THE STORM RETURNS', `${f.name} rides the wind back`);
}
// The hero's version (node heroSave: n): Lumen catches you n times per fight on an arena with a bottomless drop.
function questHeroSave(f) {
  const run = questRun();
  if (!run || !(run.saves > 0) || !questLift(f, .2, 'LUMEN CATCHES YOU', run.saves > 1 ? 'Careful at the edges!' : 'That was the last time!')) return false;
  run.saves--;
  return true;
}
// Puts a fallen fighter back above its spawn for `share` of its max health; false when that would K.O. it anyway.
function questLift(f, share, title, sub) {
  const cost = Math.round(f.maxHp * share);
  if (f.hp <= cost) return false;
  const sp = spawnPoint(f.id), h = f.P[2];
  moveFighter(f, sp[0] - h.x, sp[1] - 260 - h.y);
  for (const p of f.P) setVel(p, 0, 0);
  damage(f, cost, { src: recentAttacker(f), kind: 'ringout', small: true });
  f.inv = Math.max(f.inv || 0, 1);
  const c = chest(f);
  ring(c.x, c.y, 90, f.color, .5, 5); burst(c.x, c.y, f.color, 30, 380);
  banner(title, `${sub} · −${cost}`, 1.2, f.color);
  sfx('gust');
  return true;
}

function questStep(dt) {
  const run = questRun(), me = modePlayer();
  if (!run || G_STATE.lock > 0 || G_STATE.ending) return;
  run.t += dt;
  for (const k of run.spec.mods || []) if (QUEST_MODS[k] && QUEST_MODS[k].step) QUEST_MODS[k].step(run, dt);
  if (run.force) return questEnd(0, 'goal');
  const rules = run.spec.rules || {}, goal = run.spec.goal || { kind: 'win' };
  if (!me || !me.alive) {
    // A trade (you and the last foe K.O.'d in the same instant) still wins a plain "defeat them" fight.
    const trade = me && goal.kind !== 'survive' && goal.kind !== 'count' && !run.broke && !F.some(f => f.team !== 0 && f.alive && !f.summon);
    return questEnd(trade ? 0 : 1, 'ko');
  }
  if (rules.noBlock && me.blocking) run.broke = 'You blocked!';
  if (rules.maxTaken && run.taken > rules.maxTaken) run.broke = `You took ${Math.round(run.taken)} damage!`;
  if (run.broke) return questFail(run.broke);
  const foesUp = F.some(f => f.team !== 0 && f.alive && !f.summon);
  if (goal.kind === 'survive' && run.t >= goal.secs) return questEnd(0, 'survived');
  if (goal.kind === 'count') {
    if ((run.count[goal.stat] || 0) >= goal.n) return questEnd(0, 'goal');
    questRespawnFoes(run, dt);
  } else if (!foesUp) return questEnd(0, 'ko');
  if (run.t >= (rules.limit || 180)) questFail(rules.limit ? 'Too slow!' : 'Out of time');
}
function questEnd(team, reason) {
  endRound(team, reason);
  if (team === 0 && reason !== 'ko') banner(reason === 'survived' ? 'SURVIVED!' : 'GOAL!', 'YOU WIN', TUNE.koDelay * .9, '#9dff5a');
}
function questFail(why) {
  endRound(1, 'failed');
  banner('FAILED', why.toUpperCase(), TUNE.koDelay * .9, '#ff4a6a');
}
// Count goals keep foes coming: a fallen foe returns at the safest spawn after a moment.
function questRespawnFoes(run, dt) {
  for (const f of F) {
    if (f.team === 0 || f.alive || f.summon) continue;
    if ((run.dead[f.id] = (run.dead[f.id] ?? 1.4) - dt) > 0) continue;
    delete run.dead[f.id];
    const [x, y] = partySafeSpot(f);
    questTag(partyRespawn(f, x, y));
  }
}

// ---------- trial events (rules and counted goals) ----------
const questCount = (stat, n = 1) => { const run = questRun(); if (run) run.count[stat] = (run.count[stat] || 0) + n; };
const questBreak = (rule, why) => { const run = questRun(); if (run && (run.spec.rules || {})[rule] && !run.broke) run.broke = why; };
on('parry', B => { if (questIsMe(B)) questCount('parries'); });
on('throw', A => { if (questIsMe(A)) questCount('throws'); });
on('disarm', (B, A) => { if (questIsMe(A)) questCount('disarms'); });
on('ultimate', f => { if (questIsMe(f)) questCount('ults'); });
on('wallJump', f => { if (questIsMe(f)) questCount('wallJumps'); });
on('jump', f => { if (questIsMe(f)) questBreak('noJump', 'You jumped!'); });
on('skill', f => { if (questIsMe(f)) questBreak('noSkill', 'You used a skill!'); });
on('attack', f => { if (questIsMe(f)) questBreak('noAttack', 'You attacked!'); });
on('damage', (B, amt, o = {}) => {
  const run = questRun();
  if (!run || G_STATE.lock > 0) return;
  if (questIsMe(B)) run.taken += amt;
  // Throwable damage: their shots and blasts are kind 'skill'; grab throws (unblockable) and skills are excluded.
  const me = o.src, thr = o.proj ? o.proj.kind === 'throwable' : o.blast && o.kind === 'skill';
  if (questIsMe(me) && B.team !== 0 && thr && !o.unblockable) B.mem.qThrT = G_STATE.t;
});
on('ko', (v, k, o = {}) => {
  if (!questRun() || v.team === 0 || v.summon) return;
  questCount('kos');
  if (o.kind === 'ringout') questCount('ringouts');
  if (v.mem.qThrT && G_STATE.t - v.mem.qThrT < 2.5) questCount('throwKos');
});

// ---------- stars and HUD ----------
function questStarRules(st) {
  const out = [];
  for (let i = 0; i + 1 < (st || []).length; i += 2) out.push([st[i], st[i + 1]]);
  return out;
}
const questStarText = ([kind, v]) => kind === 'hp' ? `Finish with ${Math.round(v * 100)}% health` : `Clear in ${v} s or less`;
const questStarStr = n => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
// Outcome of the finished match: won, health left, time, stars.
function questOutcome(run) {
  const me = modePlayer(), won = G_STATE.winner === 0, hp = me && me.alive ? me.hp / me.maxHp : 0;
  const met = questStarRules(run.spec.st).filter(([k, v]) => k === 'hp' ? hp >= v - 1e-6 : run.t <= v).length;
  return { won, hp, t: run.t, stars: won ? Math.min(3, 1 + met) : 0 };
}
function questGoalText(spec, run) {
  const g = spec.goal || { kind: 'win' };
  if (g.kind === 'survive') return `SURVIVE  ${Math.max(0, Math.ceil(g.secs - (run ? run.t : 0)))} s`;
  if (g.kind === 'count') return `${QUEST_STAT_NAMES[g.stat].toUpperCase()}  ${Math.min(g.n, run ? run.count[g.stat] || 0 : 0)} / ${g.n}`;
  return spec.foes.length > 1 ? 'DEFEAT ALL FOES' : 'DEFEAT YOUR FOE';
}
function questRulesText(spec) {
  const r = spec.rules || {}, out = Object.keys(QUEST_RULE_TEXT).filter(k => r[k]).map(k => QUEST_RULE_TEXT[k]);
  if (r.maxTaken) out.push(`Take under ${r.maxTaken} damage`);
  if (r.limit) out.push(`${r.limit} s limit`);
  return out.join(' · ');
}
function questHud(ctx) {
  const run = questRun();
  if (!run) return;
  modeText(ctx, questGoalText(run.spec, run), W / 2, PARTY_HUD_Y, 18, '#ffd84a');
  const rules = questRulesText(run.spec);
  if (rules) modeText(ctx, rules, W / 2, PARTY_HUD_Y + 22, 13, '#ff8aa0', 'center', '600 ' + FONT_BODY);
  const bosses = F.filter(f => f.isBoss && !f.summon);
  if (!bosses.length) return;
  const w = Math.min(760, VIEW.hudW - 80), x = (W - w) / 2, hp = bosses.reduce((s, f) => s + Math.max(0, f.alive ? f.hp : 0), 0);
  modeBigBar(ctx, x, H - 46, w, hp / bosses.reduce((s, f) => s + f.maxHp, 0), bosses[0].color, bosses[0].name);
  bossPhaseMarks(ctx, x, H - 46, w, bosses[0]);
}

// Shared mode fields; each mode adds setup, onRoundStart and results.
const QUEST_MODE = { quest: true, hidden: true, players: [1, 1], cpu: false, pickers: 1, labels: ['You'], winScore: 1, customRounds: true,
  roundLimit: 999, aiArmor: false, holdRound: () => true, onStep: questStep, hud: questHud };   // aiArmor: bench numbers match a human's fight

// ---------- realm boss attacks (new bossPhases fx kinds) ----------
// A periodic fx: fire(boss, o) on a living, able boss every o.every seconds.
function questPeriodic(o, fire) {
  let t = o.first ?? 1.2;
  return (dt, alive) => {
    if ((t -= dt) > 0) return;
    t = (o.every || 5) * rnd(.85, 1.15);
    const b = pick(alive);
    if (b && canAct(b)) fire(b, o);
  };
}
// Ash Titan: a wall of fire rolls along the ground toward the foe (jump it).
BOSS_PHASE_FX.ashWave = (ctl, o) => questPeriodic(o, questFireWave);
function questFireWave(boss, o) {
  const foe = nearestEnemy(boss), dir = foe ? Math.sign(foe.P[2].x - boss.P[2].x) || 1 : boss.face, hit = new Set();
  sfx('slam'); shake(8);
  skillZone({ owner: boss, x: boss.P[2].x, y: feetY(boss), life: 2.4, danger: 70,
    onStep(z, dt) {
      z.x += dir * (o.speed || 520) * dt;
      for (const e of enemiesOf(boss)) if (e.alive && !hit.has(e) && Math.abs(e.P[2].x - z.x) < 34 && feetY(e) > z.y - 64) {
        hit.add(e);
        damage(e, o.dmg || 10, { src: boss, kind: 'skill', nx: dir, ny: -1, kb: 560, status: ['burn', 2, 1], color: '#ff6a2a' });
      }
    },
    draw(ctx, z) {
      for (let k = 0; k < 5; k++) {
        const h = 40 + 18 * Math.sin(z.t * 20 + k * 1.7), x = z.x - dir * k * 9;
        glow(ctx, '#ff6a2a', 16, () => poly(ctx, [{ x: x - 12, y: z.y }, { x: x + dir * 4, y: z.y - h }, { x: x + 12, y: z.y }], k ? '#ff8a2e' : '#ffe94a', null));
      }
    } });
}
// Frost Queen: an expanding ring of frost; anyone it catches on the ground is chilled solid for a moment.
BOSS_PHASE_FX.frostRing = (ctl, o) => questPeriodic(o, (boss) => {
  const c = chest(boss), r = o.radius || 300;
  ring(c.x, c.y, r, '#9fe8ff', .6, 7); burst(c.x, c.y, '#e8fbff', 36, 520); sfx('shatter');
  for (const e of enemiesOf(boss)) if (e.alive && dist(chest(e), c) < r) {
    damage(e, o.dmg || 7, { src: boss, kind: 'skill', status: e.grounded ? ['freeze', .8, 1] : ['slow', 1.5, 1], color: '#9fe8ff' });
  }
});
BOSS_PHASE_FX.slick = () => { PHYS.friction *= .25; };      // the floor turns to glass (resets next round)
// Storm Lord: a warned gale shoves every foe toward one edge for a couple of seconds (ring-outs on open arenas).
BOSS_PHASE_FX.gale = (ctl, o) => {
  ctl.data.gale = 0;
  const fire = questPeriodic(o, () => {
    ctl.data.galeDir = chance(.5) ? 1 : -1; ctl.data.gale = o.secs || 2.2;
    banner('GALE!', ctl.data.galeDir > 0 ? 'WIND FROM THE WEST ▶' : '◀ WIND FROM THE EAST', 1.2, '#b98cff');
    sfx('gust');
  });
  return (dt, alive) => {
    fire(dt, alive);
    if (ctl.data.gale <= 0) return;
    ctl.data.gale -= dt;
    for (const e of enemiesOf(alive[0])) {
      if (!e.alive) continue;
      // Near a drop on the downwind side the gust eases to a fifth: it shoves you to the brink, a hit has to do the rest.
      const k = galeGrip(e, ctl.data.galeDir) ? 1 : .2;
      for (const p of e.P) kick(p, ctl.data.galeDir * (o.force || 1100) * k * dt, 0);
    }
  };
};
// True when there is ground 150 px downwind of a fighter standing (or hovering just above it) on an open arena.
function galeGrip(f, dir) {
  if (MAP.walls) return true;
  const x = f.P[2].x + dir * 150, g = groundBelow(x, feetY(f) - 30);
  return g != null && g < feetY(f) + 120;
}
// The Warlord: the dark deepens and he steps out of the shadows behind his foe, mid-swing.
BOSS_PHASE_FX.eclipse = (ctl, o) => {
  const fire = questPeriodic(o, boss => {
    ctl.data.night = 2.6;
    const t = nearestEnemy(boss);
    if (!t) return;
    const x = clamp(t.P[2].x - t.face * 100, 60, W - 60), y = groundBelow(x, t.P[2].y - 40);
    if (y == null) return;
    burst(chest(boss).x, chest(boss).y, '#6a4aff', 24, 360);
    moveFighter(boss, x - boss.P[2].x, y - 4 - feetY(boss));
    boss.face = Math.sign(t.P[2].x - x) || 1; boss.inp.attack = true;
    sfx('blink');
  });
  return (dt, alive) => {
    fire(dt, alive);
    if ((ctl.data.night || 0) > 0) { ctl.data.night -= dt; MAP.dark = Math.max(MAP.dark || 0, .95); }
  };
};

const QUEST_PHASES = {
  mini: [{ at: .5, name: 'ENRAGED', sub: 'It fights harder now', color: '#ff4a6a', fx: [['buff', { statuses: ['rage'], secs: 40 }]] }],
  ash: [
    { at: .5, name: 'MOLTEN CORE', sub: 'His cracks spill fire', color: '#ff6a2a', fx: [['ashWave', { every: 4.2 }], ['hazard', { kind: 'lava', w: 140 }]] },
    { at: .25, name: 'CINDERSTORM', sub: 'Ash rains from the sky', color: '#ff4a1a',
      fx: [['ashWave', { every: 2.8 }], ['rain', { every: 1.1, dmg: 9, color: '#ff8a2e', status: ['burn', 2, 1] }], ['buff', { statuses: ['rage'] }]] }],
  frost: [
    { at: .6, name: "WINTER'S BITE", sub: 'The floor turns to glass', color: '#9fe8ff', fx: [['slick', {}], ['frostRing', { every: 5 }]] },
    { at: .3, name: 'ETERNAL WINTER', sub: 'Ice wraiths answer her call', color: '#c8f4ff',
      fx: [['adds', { n: 2, weapon: 'frost-blade', name: 'ICE WRAITH', color: '#c8f4ff' }], ['frostRing', { every: 3.6 }],
        ['rain', { every: 1.4, dmg: 7, radius: 55, color: '#e8fbff', status: ['slow', 1.2, 1] }]] }],
  storm: [
    { at: .55, name: 'GATHERING GALE', sub: 'Hold on to something!', color: '#b98cff', fx: [['gale', { every: 6, force: 1050 }]] },
    { at: .25, name: 'EYE OF THE STORM', sub: 'Lightning rides the wind', color: '#ffe94a',
      fx: [['gale', { every: 4.2, force: 1200 }], ['rain', { every: 1.1, dmg: 8, color: '#ffe94a', status: ['stun', .4, 1] }], ['platforms', { dx: 70 }]] }],
  warlord: [
    { at: .66, name: 'SHADOW LEGION', sub: 'The Warlord calls his shades', color: '#8a6aff',
      fx: [['adds', { n: 2, weapon: 'scythe', name: 'SHADE', color: '#6a4aff' }], ['eclipse', { every: 6.5 }]] },
    { at: .33, name: 'ENDLESS NIGHT', sub: 'Nothing left but fury', color: '#ff4a6a',
      fx: [['eclipse', { every: 3.8 }], ['buff', { statuses: ['rage', 'haste'] }], ['rain', { every: 1.2, dmg: 10, color: '#b98cff' }]] }],
};

// ---------- the campaign ----------
const CAMP_REALMS = [
  { key: 'ember', name: 'Ember Wastes', color: '#ff6a2a', foe: '#ff8a2e', maps: ['caldera', 'foundry', 'desert', 'eruption'] },
  { key: 'frost', name: 'Frostspire', color: '#9fe8ff', foe: '#9fe8ff', maps: ['frost', 'temple', 'moon', 'dojo'] },
  { key: 'sky', name: 'Sky Citadel', color: '#c9a8ff', foe: '#ffd84a', maps: ['sky', 'pirate', 'train', 'asteroid'] },
  { key: 'shadow', name: 'Shadow Depths', color: '#8a6aff', foe: '#b98cff', maps: ['graveyard', 'mansion', 'factory', 'jungle'] },
];
const LUMEN = 'LUMEN';    // the lantern spirit who guides the player
// Node: id, r (realm), x/y (map position 0-100), kind: fight | side | mini | boss, to (nodes it opens), foes, map, wx,
// mods, par (3★ time), heroHp, phases (QUEST_PHASES key), pre/post dialogue [[speaker, line], ...].
const CAMP_NODES = [
  { id: 'e1', r: 0, x: 5, y: 76, kind: 'fight', name: 'Cinder Road', to: ['e2'], map: 'desert', par: 40,
    foes: [['Cinder Imp', 'twin-daggers', 'easy', { hp: .45 }], ['Cinder Imp', 'saber', 'easy', { hp: .45 }]],
    pre: [[LUMEN, 'Wake up, little Wick! The Great Candle has gone dark.'],
      [LUMEN, 'The Warlord stole its four flames and gave them to his generals. Without them, the world goes cold.'],
      [LUMEN, 'Your spark still burns. Walk with me: the Ember Wastes come first.']],
    post: [[LUMEN, 'Ha! Those imps scattered like sparks. On to the Slag Bridge.']] },
  { id: 'e2', r: 0, x: 10, y: 52, kind: 'fight', name: 'Slag Bridge', to: ['e3', 'es'], map: 'foundry', par: 35,
    foes: [['Slag Brute', 'hammer', 'easy', { hp: 1.1, skills: ['slam', 'tremor'] }]],
    pre: [['SLAG BRUTE', 'Nobody crosses the bridge. Titan\'s orders.'], [LUMEN, 'He swings slow. Make him miss!']] },
  { id: 'es', r: 0, x: 4, y: 26, kind: 'side', name: 'Smoke Hollow', to: [], map: 'spikepit', mods: ['embers'], par: 45,
    foes: [['Smoke Imp', 'kunai', 'easy', { hp: .4 }], ['Smoke Imp', 'grenade', 'easy', { hp: .4 }], ['Smoke Imp', 'slingshot', 'easy', { hp: .4 }]],
    pre: [[LUMEN, 'A hollow full of smoke. We don\'t have to go in...'], [LUMEN, '...but the imps there hoard stars. Mind the falling cinders.']] },
  { id: 'e3', r: 0, x: 15, y: 32, kind: 'fight', name: 'Glass Dunes', to: ['e4'], map: 'desert', wx: 'wind', par: 45,
    foes: [['Dune Raider', 'revolver', 'easy', { hp: .6 }], ['Dune Raider', 'spear', 'easy', { hp: .6 }]],
    pre: [[LUMEN, 'The dunes sing when the wind blows. Listen for gunfire.']] },
  { id: 'e4', r: 0, x: 19, y: 60, kind: 'mini', name: 'Magma Gate', to: ['e5'], map: 'caldera', phases: 'mini', par: 50,
    foes: [['Pyre Warden', 'flame-sword', 'easy', { scale: 1.25, hp: .9, boss: true, skills: ['fireball', 'meteor'] }]],
    pre: [['PYRE WARDEN', 'The Gate burns for one master. Turn back, Wick.']] },
  { id: 'e5', r: 0, x: 22, y: 28, kind: 'boss', name: 'Ashen Throne', to: ['f1'], map: ['eruption', 'caldera'], phases: 'ash', par: 80,
    foes: [['Ash Titan', 'greatsword', 'easy', { scale: 1.7, hp: .85, boss: true, color: '#ff4a1a', skills: ['slam', 'meteor'] }]],
    pre: [['ASH TITAN', 'Little flame. I will add you to my fire.'], [LUMEN, 'His armour cracks when he\'s hurt. When it does, watch the floor!']],
    post: [[LUMEN, 'The Ember Flame is ours! Feel that? The Candle flickered.'], [LUMEN, 'Next, Frostspire. Dress warmly. Well... fight warmly.']] },

  { id: 'f1', r: 1, x: 29, y: 72, kind: 'fight', name: 'Frozen Steps', to: ['f2'], map: 'frost', wx: 'snow', par: 40,
    foes: [['Frost Imp', 'spear', 'easy', { hp: .45 }], ['Frost Imp', 'frost-blade', 'easy', { hp: .45 }]],
    pre: [[LUMEN, 'Frostspire. The Queen froze her own heart so nothing could ever melt it.'], [LUMEN, 'Her servants are just as chilly.']] },
  { id: 'f2', r: 1, x: 33, y: 46, kind: 'fight', name: 'Hall of Icicles', to: ['f3', 'fs'], map: 'temple', wx: 'snow', par: 40,
    foes: [['Ice Acolyte', 'cryo', 'normal', { hp: .9, skills: ['frost-nova', 'chrono'] }]],
    pre: [['ICE ACOLYTE', 'Silence in the Hall. The Queen is sleeping.']] },
  { id: 'fs', r: 1, x: 30, y: 20, kind: 'side', name: 'Yeti Den', to: [], map: 'frost', wx: 'snow', par: 50,
    foes: [['Yeti', 'boxing-gloves', 'normal', { scale: 1.4, hp: .85, color: '#e8fbff', skills: ['slam', 'frenzy'] }]],
    pre: [[LUMEN, 'Something big lives in that cave. Something... furry.']] },
  { id: 'f3', r: 1, x: 38, y: 64, kind: 'fight', name: 'Silent Glacier', to: ['f4'], map: 'moon', wx: 'snow', mods: ['slick', 'hail'], par: 50,
    foes: [['Glacier Guard', 'halberd', 'normal', { hp: .6 }], ['Ice Archer', 'longbow', 'easy', { hp: .5 }]],
    pre: [[LUMEN, 'The glacier is slick as glass, and hail is falling. Keep your feet!']] },
  { id: 'f4', r: 1, x: 43, y: 40, kind: 'mini', name: 'Rime Stair', to: ['f5'], map: 'dojo', wx: 'snow', phases: 'mini', par: 55,
    foes: [['Rime Knight', 'frost-blade', 'normal', { scale: 1.3, hp: .8, boss: true, skills: ['frost-nova', 'parry'] }]],
    pre: [['RIME KNIGHT', 'I have guarded this stair for a hundred winters. One more will not hurt.']] },
  { id: 'f5', r: 1, x: 47, y: 66, kind: 'boss', name: 'Crystal Court', to: ['s1'], map: 'frost', wx: 'snow', phases: 'frost', par: 85,
    foes: [['Frost Queen', 'frost-blade', 'normal', { scale: 1.45, hp: .8, boss: true, color: '#c8f4ff', skills: ['frost-nova', 'chrono'] }]],
    pre: [['FROST QUEEN', 'Such a warm little thing. You will make a lovely statue.'], [LUMEN, 'When the floor turns to glass, don\'t stop moving!']],
    post: [['FROST QUEEN', '...I remember warmth. Take the flame. Go.'], [LUMEN, 'Two flames! Up now, to the Sky Citadel.']] },

  { id: 's1', r: 2, x: 54, y: 76, kind: 'fight', name: 'Cloud Docks', to: ['s2'], map: 'pirate', par: 45,
    foes: [['Sky Pirate', 'saber', 'normal', { hp: .6 }], ['Sky Pirate', 'pistol', 'easy', { hp: .6 }]],
    pre: [[LUMEN, 'The islands float on stolen wind. One wrong step and it\'s a long way down.'], [LUMEN, 'Of course, the same goes for them.']] },
  { id: 's2', r: 2, x: 57, y: 50, kind: 'fight', name: 'Windward Bridge', to: ['s3', 'ss'], map: 'sky', wx: 'wind', par: 40,
    foes: [['Bridge Keeper', 'spear', 'normal', { skills: ['repulse', 'grapple'] }]],
    pre: [['BRIDGE KEEPER', 'Toll for the bridge is one Wick. Pay up!']] },
  { id: 'ss', r: 2, x: 53, y: 24, kind: 'side', name: 'Star Rock', to: [], map: ['asteroid', 'moon'], par: 50,
    foes: [['Star Drifter', 'void-orb', 'normal', { hp: .6 }], ['Star Drifter', 'boomerang', 'easy', { hp: .6 }]],
    pre: [[LUMEN, 'A rock adrift among the stars. Up and down are... more of a suggestion there.']] },
  { id: 's3', r: 2, x: 63, y: 32, kind: 'fight', name: 'Sky Rail', to: ['s4'], map: ['train', 'sky'], par: 45,
    foes: [['Gale Archer', 'crossbow', 'normal', { hp: .6 }], ['Gale Dancer', 'war-fan', 'normal', { hp: .6 }]],
    pre: [[LUMEN, 'A train that runs between the islands. Hold on tight!']] },
  { id: 's4', r: 2, x: 67, y: 60, kind: 'mini', name: 'Thunder Spire', to: ['s5'], map: 'storm', phases: 'mini', par: 55,
    foes: [['Thunder Sentinel', 'storm-staff', 'normal', { scale: 1.3, hp: .9, boss: true, skills: ['lightning', 'blink'] }]],
    pre: [['THUNDER SENTINEL', 'Intruder detected. Storm protocol engaged.']] },
  { id: 's5', r: 2, x: 72, y: 34, kind: 'boss', name: 'Eye of the Storm', to: ['d1'], map: 'sky', phases: 'storm', par: 85, heroSave: 2,
    foes: [['Storm Lord', 'trident', 'normal', { scale: 1.5, hp: .9, boss: true, kb: .9, ringSave: .25, color: '#ffe94a', skills: ['lightning', 'repulse'] }]],
    pre: [['STORM LORD', 'I am the wind that knocks you off the edge of the world!'], [LUMEN, 'Stay off the edges when the gale blows. Or push HIM off!']],
    post: [[LUMEN, 'Three flames! Only the Warlord\'s own is left.'], [LUMEN, 'He waits in the Shadow Depths. It\'s dark down there: let your weapon light the way.']] },

  { id: 'd1', r: 3, x: 79, y: 72, kind: 'fight', name: 'Gloom Gate', to: ['d2'], map: 'graveyard', mods: ['dark'], par: 50,
    foes: [['Shade', 'scythe', 'normal', { hp: .5 }], ['Shade', 'whip', 'normal', { hp: .5 }]],
    pre: [[LUMEN, 'So dark... I can\'t shine down here. Your blade is our only light now.']] },
  { id: 'd2', r: 3, x: 83, y: 48, kind: 'fight', name: 'Whispering Halls', to: ['d3', 'ds'], map: 'mansion', mods: ['dark'], par: 45,
    foes: [['Whisperer', 'void-orb', 'hard', { skills: ['vanish', 'decoy'] }]],
    pre: [['WHISPERER', 'Whispers, whispers... a Wick walks in our halls...']] },
  { id: 'ds', r: 3, x: 79, y: 22, kind: 'side', name: 'Lost Mine', to: [], map: 'factory', mods: ['dark'], par: 55,
    foes: [['Lost Miner', 'battle-axe', 'normal', { hp: .5 }], ['Lost Miner', 'chainsaw', 'normal', { hp: .5 }]],
    pre: [[LUMEN, 'An old mine. Its lanterns went out long ago. Careful.']] },
  { id: 'd3', r: 3, x: 88, y: 66, kind: 'fight', name: 'Rootcaverns', to: ['d4'], map: 'jungle', mods: ['dark'], par: 55,
    foes: [['Root Stalker', 'kusarigama', 'normal', { hp: .55 }], ['Root Stalker', 'boomerang', 'normal', { hp: .55 }]],
    pre: [[LUMEN, 'Roots older than the Candle itself. Something is watching from them.']] },
  { id: 'd4', r: 3, x: 92, y: 40, kind: 'mini', name: 'Gloam Door', to: ['d5'], map: 'station', mods: ['dark'], phases: 'mini', par: 60,
    foes: [['Gloamguard', 'sword-shield', 'normal', { scale: 1.3, hp: .9, boss: true, skills: ['parry', 'repulse'] }]],
    pre: [['GLOAMGUARD', 'The Warlord\'s door stays shut. Forever.']] },
  { id: 'd5', r: 3, x: 96, y: 66, kind: 'boss', name: 'The Unlit Throne', to: [], map: 'neon', mods: ['dark'], phases: 'warlord', par: 95, final: true,
    foes: [['The Warlord', 'double-axe', 'hard', { scale: 1.55, hp: .8, dmg: .7, boss: true, color: '#b98cff', skills: ['frenzy', 'vanish'] }]],
    pre: [['THE WARLORD', 'Four flames, one candle and a little stick. Did you think it would be easy?'], [LUMEN, 'This is it. For every Wick!']],
    post: [[LUMEN, 'Look! The Great Candle burns again!'], [LUMEN, 'Light returns to every realm. Well walked, little Wick.'],
      [LUMEN, 'When you want more, the Challenges are waiting on the title screen.']] },
];
const CAMP_BY_ID = Object.fromEntries(CAMP_NODES.map(n => [n.id, n]));
const CAMP_PARENTS = {};
for (const n of CAMP_NODES) for (const k of n.to) (CAMP_PARENTS[k] = CAMP_PARENTS[k] || []).push(n.id);
const CAMP_KINDS = { fight: { icon: '⚔', label: 'Battle' }, side: { icon: '✦', label: 'Side quest' }, mini: { icon: '☠', label: 'Mini-boss' },
  boss: { icon: '♛', label: 'Realm boss' } };

// The lone hero's health by node kind (a node may set heroHp): fights are often one against two.
const CAMP_HERO_HP = { fight: 1.3, side: 1.3, mini: 1.4, boss: 1.6 };
// A node as a trial spec (the star rules: health and the node's par time).
function campSpec(n) {
  return { foes: n.foes, map: n.map, wx: n.wx, mods: n.mods, me: { hp: n.heroHp || CAMP_HERO_HP[n.kind], ringSave: n.heroSave }, goal: { kind: 'win' }, rules: {},
    st: ['hp', n.kind === 'boss' ? .3 : .4, 'time', n.par || 45] };
}

// ---------- saved progress ----------
// store 'quest' = { stars: { nodeId: 0-3 }, at: nodeId (where the walker stands), seen: { nodeId: 1 }, tree: { skillId: 1 } }
function campSave() {
  const s = Object.assign({ stars: {}, at: CAMP_NODES[0].id, seen: {}, tree: {} }, store.getObj('quest'));
  for (const k of ['stars', 'seen', 'tree']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
  if (!CAMP_BY_ID[s.at]) s.at = CAMP_NODES[0].id;
  return s;
}
const campCleared = (id, s) => (s.stars[id] || 0) > 0;
const campUnlocked = (id, s) => id === CAMP_NODES[0].id || (CAMP_PARENTS[id] || []).some(p => campCleared(p, s));
const campStarTotal = s => CAMP_NODES.reduce((t, n) => t + (s.stars[n.id] || 0), 0);
const campSpent = s => CAMP_SKILLS.filter(k => s.tree[k.id]).reduce((t, k) => t + k.cost, 0);
const campPoints = s => campStarTotal(s) - campSpent(s);
// The realm the player has reached (the highest one with an unlocked node).
const campRealmAt = s => Math.max(0, ...CAMP_NODES.filter(n => campUnlocked(n.id, s)).map(n => n.r));

// ---------- skill tree (campaign fights only) ----------
const CAMP_TREE = [
  { name: 'Vitality', icon: '♥', color: '#9dff5a', skills: [
    { id: 'v1', name: 'Tough Skin', desc: '+15% health', cost: 1, apply: f => campHp(f, 1.15) },
    { id: 'v2', name: 'Iron Guard', desc: '+30% guard stamina', cost: 1, apply: f => { f.maxStamina = f.stamina = Math.round(f.maxStamina * 1.3); } },
    { id: 'v3', name: 'Stone Hide', desc: 'Take 10% less damage', cost: 2, apply: f => { f.dmgTakenMul = (f.dmgTakenMul || 1) * .9; } },
    { id: 'v4', name: 'Titan Blood', desc: '+20% more health', cost: 3, apply: f => campHp(f, 1.2) }] },
  { name: 'Power', icon: '⚔', color: '#ff8a2e', skills: [
    { id: 'p1', name: 'Keen Edge', desc: '+8% damage', cost: 1, apply: f => { f.dmgCls = (f.dmgCls || 1) * 1.08; } },
    { id: 'p2', name: 'Swift Feet', desc: '+8% run speed', cost: 1, apply: f => { f.spdMul = (f.spdMul || 1) * 1.08; } },
    { id: 'p3', name: 'Battle Fury', desc: '+10% more damage', cost: 2, apply: f => { f.dmgCls = (f.dmgCls || 1) * 1.1; } },
    { id: 'p4', name: 'Opening Surge', desc: 'Start every fight with half a super meter', cost: 3, apply: f => { f.super = Math.max(f.super, 50); } }] },
  { name: 'Focus', icon: '✦', color: '#5ef2ff', skills: [
    { id: 'c1', name: 'Quick Mind', desc: 'Skill cooldowns 12% shorter', cost: 1, apply: f => { f.skillCdMul = (f.skillCdMul || 1) * .88; } },
    { id: 'c2', name: 'Charged', desc: 'Super meter fills 25% faster', cost: 1, apply: f => { f.superMul = (f.superMul || 1) * 1.25; } },
    { id: 'c3', name: 'Fleet Dash', desc: 'Dash recovers 20% sooner', cost: 2, apply: f => { f.dashCdMul = (f.dashCdMul || 1) * .8; } },
    { id: 'c4', name: 'Deep Pockets', desc: '+1 of each throwable, cooldowns 10% shorter', cost: 3,
      apply: f => { f.throwN = f.throwN.map((n, i) => f.throws[i] ? n + 1 : n); f.skillCdMul = (f.skillCdMul || 1) * .9; } }] },
];
const CAMP_SKILLS = CAMP_TREE.flatMap(b => b.skills);
function campHp(f, k) { f.maxHp = Math.round(f.maxHp * k); f.hp = f.hpShow = f.maxHp; }
// A skill can be bought when owned skills before it in its branch are owned and points allow.
function campCanBuy(id, s) {
  const b = CAMP_TREE.find(t => t.skills.some(k => k.id === id)), i = b.skills.findIndex(k => k.id === id);
  return !s.tree[id] && b.skills.slice(0, i).every(k => s.tree[k.id]) && campPoints(s) >= b.skills[i].cost;
}
function campBuy(id) {
  const s = campSave();
  if (!campCanBuy(id, s)) return false;
  s.tree[id] = 1; store.set('quest', s);
  return true;
}
function campRespec() { const s = campSave(); s.tree = {}; store.set('quest', s); }
function campApplyTree(f) {
  const s = campSave();
  for (const k of CAMP_SKILLS) if (s.tree[k.id]) { try { k.apply(f); } catch (e) { report(e, 'skill tree ' + k.id); } }
}

defMode('campaign', Object.assign({}, QUEST_MODE, {
  name: 'Mythic Quest', icon: '🗺', desc: 'Relight the Great Candle: four realms, four bosses.',
  setup(cfg) {
    const node = CAMP_BY_ID[cfg.node] || CAMP_BY_ID[campSave().at] || CAMP_NODES[0], spec = campSpec(node), realm = CAMP_REALMS[node.r];
    if (cfg.weather == null || cfg.weather === 'random') cfg.weather = node.wx || 'clear';   // read by 58-world at round start
    return { roster: questRoster(cfg, spec, realm.foe), map: questMap(node.map, realm.maps), winScore: 1, roundLimit: 999,
      run: questNewRun(spec, 'campaign', node.id) };
  },
  roundLabel() { const n = CAMP_BY_ID[modeRun().id]; return n ? n.name.toUpperCase() : ''; },
  onRoundStart() {
    questRoundStart();
    const node = CAMP_BY_ID[modeRun().id], me = modePlayer();
    if (me) campApplyTree(me);
    const bosses = F.filter(f => f.isBoss);
    if (bosses.length && QUEST_PHASES[node.phases]) bossPhases(bosses, QUEST_PHASES[node.phases]);
    banner(node.name.toUpperCase(), `${CAMP_REALMS[node.r].name.toUpperCase()} · ${CAMP_KINDS[node.kind].label.toUpperCase()}`, 2, CAMP_REALMS[node.r].color);
  },
  results() { return campSettle(modeRun(), !!G_STATE.cfg.autopilot); },
}));

// Saves a finished node (unless dryRun) and reports stars, skill points and what it unlocked.
function campSettle(run, dryRun) {
  const node = CAMP_BY_ID[run.id], o = questOutcome(run), s = campSave(), before = s.stars[node.id] || 0;
  const open0 = new Set(CAMP_NODES.filter(n => campUnlocked(n.id, s)).map(n => n.id));
  if (o.won) { s.stars[node.id] = Math.max(before, o.stars); s.at = node.id; }
  const opened = CAMP_NODES.filter(n => campUnlocked(n.id, s) && !open0.has(n.id)), gained = Math.max(0, o.stars - before);
  if (!dryRun) { store.set('quest', s); QUEST_PENDING.post = o.won && before === 0 && node.post ? node.id : null; }
  QUEST_PENDING.last = { kind: 'campaign', id: node.id, won: o.won };
  const lines = [o.won ? `${questStarStr(o.stars)}  in ${Math.round(o.t)} s with ${Math.round(o.hp * 100)}% health` : `${node.name} stands. Try again, Wick!`];
  if (gained) lines.push(`+${gained} skill point${gained > 1 ? 's' : ''} (${campPoints(s)} to spend)`);
  if (opened.length) lines.push('Unlocked: ' + opened.map(n => n.name).join(', '));
  const title = !o.won ? 'Defeated' : node.final ? 'THE CANDLE BURNS AGAIN!' : node.kind === 'boss' ? `${node.foes[0][0]} falls!` : `${node.name} cleared!`;
  return { title, color: o.won ? CAMP_REALMS[node.r].color : '#ff8a2e', won: o.won, stars: o.stars, lines };
}
