// 74-boss-phases.js: multi-phase bosses. bossPhases(boss, phases) watches a boss's health (or a group's combined
// health) and, as it falls past each phase's `at` fraction (e.g. .5 then .25), shows a phase banner, shakes the
// arena and switches on the phase's effects: new attack patterns (rain, quakes, buffs) replace the previous
// phase's, and arena changes (adds, hazards, moving platforms, wind) stay. Boss Rush (70-modes) uses it; the
// campaign can too:
//
//   onRoundStart() {
//     const boss = F.find(f => f.isBoss);
//     bossPhases(boss, [
//       { at: .5, name: 'PHASE 2', sub: 'The ground cracks!', color: '#ff8a2e', fx: [['hazard', { kind: 'lava' }], ['quake', { every: 5 }]] },
//       { at: .25, name: 'FINAL PHASE', fx: [['adds', { n: 2 }], ['rain', { every: 1 }], ['buff', {}]], enter(ctl) {}, step(ctl, dt) {} },
//     ]);
//   }
//
// fx kinds (BOSS_PHASE_FX, add more with BOSS_PHASE_FX.myKind = (ctl, o) => stepFnOrNull):
//   adds     { n: 2, weapon, hpMul: .35, level: 'normal', name, color }   summoned helpers (vanish when the boss falls)
//   hazard   { kind: 'lava'|'spikes'|'electric', where: 'edges'|'center', w: 170, dps }   floor hazards appear
//   platforms{ dx: 90, dy: 0, period: 4 }                                 still platforms start sliding (or two appear)
//   wind     { x: -300 }                                                   a steady wind (PHYS.windX)
//   buff     { statuses: ['rage', 'haste'], secs: 60 }                    the boss powers up
//   rain     { every: 1.2, dmg: 10, radius: 70, color, status, warn: .9 } marked strikes fall from the sky (periodic)
//   quake    { every: 5, dmg: 9, range: 380 }                              ground shockwave around the boss (periodic)
// Periodic fx belong to their phase; entering the next phase stops them. The controller lives on every boss as
// f.mem.phases (bossPhaseCtl(f)); bossPhaseMarks(ctx, x, y, w, f) draws the thresholds on a boss health bar.

let BOSS_ADD_SEQ = 0;

function bossPhases(bosses, phases, opts = {}) {
  const list = (Array.isArray(bosses) ? bosses : [bosses]).filter(Boolean);
  if (!list.length || !Array.isArray(phases)) return null;
  const ctl = { bosses: list, phases: phases.slice().sort((a, b) => b.at - a.at), idx: 0, t: 0, active: [], data: {}, opts, done: false };
  for (const f of list) f.mem.phases = ctl;
  skillZone({ owner: null, x: 0, y: 0, life: 1e9, kind: 'boss-phases', onStep: (z, dt) => bossPhaseTick(ctl, z, dt) });
  return ctl;
}
const bossPhaseCtl = f => (f && f.mem && f.mem.phases) || null;
// Combined health fraction of the controller's bosses (0 when all have fallen).
function bossPhaseFrac(ctl) {
  let hp = 0, max = 0;
  for (const f of ctl.bosses) { max += f.maxHp; if (f.alive) hp += Math.max(0, f.hp); }
  return max ? hp / max : 0;
}

function bossPhaseTick(ctl, z, dt) {
  if (ctl.done) return;
  const alive = ctl.bosses.filter(f => f.alive && F.includes(f));
  if (!alive.length) { bossPhaseEnd(ctl); z.dead = true; return; }
  if (G_STATE.lock > 0 || G_STATE.ending) return;
  ctl.t += dt;
  const frac = bossPhaseFrac(ctl);
  while (ctl.idx < ctl.phases.length && frac <= ctl.phases[ctl.idx].at) bossPhaseEnter(ctl, ctl.phases[ctl.idx++]);
  for (const step of ctl.active) step(dt, alive);
  const cur = ctl.phases[ctl.idx - 1];
  if (cur) hook(cur, 'step', ctl, dt);
}

function bossPhaseEnter(ctl, ph) {
  const color = ph.color || ctl.bosses[0].color, n = ctl.idx;
  banner(ph.name || `PHASE ${n + 1}`, ph.sub || '', 2.2, color);
  flashScreen(color, .25); shake(20); sfx('slam');
  for (const f of ctl.bosses) if (f.alive) {
    f.inv = Math.max(f.inv || 0, 1);                                   // a moment to read the change
    const c = chest(f);
    ring(c.x, c.y, 200, color, .6, 8); burst(c.x, c.y, color, 40, 520);
    for (const e of enemiesOf(f)) if (e.alive && dist(chest(e), c) < 220) {   // a shove (no damage) clears space
      const dir = Math.sign(e.P[2].x - c.x) || 1;
      for (const p of e.P) kick(p, dir * 520, -300);
    }
  }
  ctl.active = [];
  for (const [kind, o] of ph.fx || []) {
    const fn = BOSS_PHASE_FX[kind];
    if (!fn) { report(new Error(`unknown boss phase fx "${kind}"`), 'bossPhases'); continue; }
    try { const step = fn(ctl, o || {}); if (typeof step === 'function') ctl.active.push(step); } catch (e) { report(e, 'bossPhases.' + kind); }
  }
  hook(ph, 'enter', ctl);
  emit('bossPhase', ctl, n + 1);
}
// All bosses down: helpers vanish, the wind dies.
function bossPhaseEnd(ctl) {
  ctl.done = true; ctl.active = [];
  for (const c of F) if (c.summon && c.alive && ctl.bosses.includes(c.owner)) decoyDismiss(c);
  if (ctl.data.wind) PHYS.windX = MAP.windX || 0;
}
// A boss's own helpers vanish when it falls, even if its twin fights on.
on('ko', v => {
  if (!bossPhaseCtl(v)) return;
  for (const c of F) if (c.summon && c.alive && c.owner === v) decoyDismiss(c);
});

// ---------- phase effects ----------
const BOSS_PHASE_FX = {
  adds(ctl, o) {
    const boss = ctl.bosses.find(f => f.alive) || ctl.bosses[0];
    for (let k = 0; k < (o.n || 2); k++) bossSummonAdd(boss, o, k);
  },
  hazard(ctl, o) {
    const fl = MAP.floor;
    if (fl == null) return;
    const w = o.w || 170, kind = o.kind || 'spikes';
    const spans = o.where === 'center' ? [[W / 2 - w / 2, w]] : [[0, w], [W - w, w]];
    for (const [x, sw] of spans) bossAddHazard(kind, x, sw, o);
  },
  platforms(ctl, o) {
    const still = MAP.solids.filter(s => !s.move && !s.crumble && !s.brk && s.w < 420 && s.y > 120);
    if (!still.length) {                                                 // a bare arena gets two drifting ledges
      for (const x of [260, W - 420]) MAP.solids.push({ x, y: 470, w: 160, h: 14, oneWay: true, x0: x, y0: 470, dx: 0, dy: 0 });
      still.push(...MAP.solids.slice(-2));
    }
    still.forEach((s, k) => {
      const period = o.period || 4;
      s.move = { dx: (o.dx ?? 90) * (k % 2 ? -1 : 1), dy: o.dy || 0, period, phase: -TAU * MAP.t / period };
      ring(s.x + s.w / 2, s.y, s.w / 2, ctl.phases[0].color || '#ffffff', .4, 3);
    });
  },
  wind(ctl, o) { ctl.data.wind = true; PHYS.windX = o.x ?? -280; },
  buff(ctl, o) {
    for (const f of ctl.bosses) if (f.alive) for (const s of o.statuses || ['rage', 'haste']) addStatus(f, s, o.secs || 60, 1, f);
  },
  rain(ctl, o) {
    let t = o.first ?? .6;
    return (dt, alive) => {
      if ((t -= dt) > 0) return;
      t = (o.every || 1.2) * rnd(.8, 1.2);
      bossStrike(pick(alive), o);
    };
  },
  quake(ctl, o) {
    let t = o.first ?? 1.5;
    return (dt, alive) => {
      if ((t -= dt) > 0) return;
      t = (o.every || 5) * rnd(.85, 1.15);
      for (const f of alive) if (canAct(f) && f.grounded) bossQuake(f, o);
    };
  },
};

// A summoned helper beside the boss: an ordinary CPU fighter that vanishes (no score) when hurt to 0 or when the boss falls.
function bossSummonAdd(boss, o, k) {
  const side = k % 2 ? 1 : -1, x = clamp(boss.P[2].x + side * (90 + 40 * k), 60, W - 60);
  const y = groundBelow(x, feetY(boss) - 60) ?? feetY(boss);
  const c = makeFighter({ id: 200 + (BOSS_ADD_SEQ++ % 800), team: boss.team, ctrl: 'cpu', weapon: o.weapon && WEAPONS[o.weapon] ? o.weapon : boss.wkey,
    skills: [], color: o.color || skillMixColor(boss.color, '#ffffff', .35), name: o.name || 'MINION', hat: 'none', hpMul: o.hpMul || .35,
    aiLevel: o.level || 'normal', face: -side, x, y, cls: 'none', throws: [] });
  c.summon = true; c.owner = boss; c.superMul = 1e-6;
  F = F.concat([c]);
  const cc = chest(c);
  ring(cc.x, cc.y, 70, c.color, .4, 4); burst(cc.x, cc.y, c.color, 24, 320);
  return c;
}
// A floor hazard strip (a mode hazard: see partyHazard in 71-modes-party).
function bossAddHazard(kind, x, w, o = {}) {
  const fl = MAP.floor, h = kind === 'spikes' ? 18 : kind === 'electric' ? 24 : 26;
  const presets = { spikes: { dps: 14, launch: 760 }, lava: { dps: 20, launch: 620, status: ['burn', 2, 1] }, electric: { dps: 10, status: ['slow', .8, 1] } };
  const hz = partyHazard(Object.assign({ kind, x, y: fl - h + (kind === 'lava' ? 8 : 0), w, h, tick: .3 }, presets[kind] || { dps: 12 }, o.dps ? { dps: o.dps } : null));
  burst(x + w / 2, fl, kind === 'lava' ? '#ff6a2a' : '#c9cde6', 24, 360);
  return hz;
}
// A marked strike: a warning circle on the ground (CPUs step out of it), then a blast from the sky.
function bossStrike(boss, o) {
  const foes = enemiesOf(boss).filter(e => e.alive), aim = foes.length && chance(.7) ? pick(foes).P[2].x + rnd(-60, 60) : rnd(80, W - 80);
  const x = clamp(aim, 50, W - 50), gy = groundBelow(x, 60) ?? (MAP.floor ?? H - 60), r = o.radius || 70, color = o.color || boss.color;
  skillZone({ owner: boss, x, y: gy, life: o.warn || .9, danger: r, color,
    draw(ctx, z) {
      const k = z.t / z.life, fy = lerp(-60, z.y, k * k);
      ctx.globalAlpha = .35 + .4 * k; circle(ctx, z.x, z.y - 4, r * (.4 + .6 * k), null, color, 3); ctx.globalAlpha = 1;
      glow(ctx, color, 14, () => circle(ctx, z.x, fy, 10 + 6 * k, color, '#ffffff', 2));
    },
    onExpire(z) { explode(z.x, z.y - 10, r, o.dmg || 10, boss, { kind: 'skill', color, status: o.status, kb: 520 }); } });
}
function bossQuake(f, o) {
  const c = chest(f), range = o.range || 380;
  ring(c.x, feetY(f), range, f.color, .5, 8); shake(14); sfx('slam');
  for (const e of enemiesOf(f)) if (e.alive && e.grounded && Math.abs(e.P[2].x - c.x) < range) {
    damage(e, o.dmg || 9, { src: f, kind: 'skill', nx: Math.sign(e.P[2].x - c.x) || 1, ny: -1, kb: 520, color: f.color });
  }
}

// Phase thresholds as notches on a boss bar at (x, y) of width w (16 px tall, as modeBigBar draws it).
function bossPhaseMarks(ctx, x, y, w, f) {
  const ctl = bossPhaseCtl(f);
  if (!ctl) return;
  ctl.phases.forEach((ph, i) => {
    const px = x + w * ph.at, passed = i < ctl.idx;
    lineXY(ctx, px, y - 4, px, y + 20, passed ? '#ffffff' : rgba('#ffffff', .6), 3);
    modeText(ctx, '◆', px, y - 8, 10, passed ? (ph.color || '#ffffff') : '#8a8fbf');
  });
}

// ---------- Boss Rush phases (one set per boss in BOSSES order) ----------
const BOSS_RUSH_PHASES = [
  [{ at: .5, name: 'CRACKED EARTH', sub: 'Spikes burst from the floor', color: '#ff8a2e', fx: [['hazard', { kind: 'spikes' }], ['quake', { every: 4.5 }]] },
    { at: .25, name: 'AVALANCHE', sub: 'Rocks rain from above', color: '#ff8a2e', fx: [['rain', { every: 1.1, dmg: 10, color: '#ffb067' }], ['buff', { statuses: ['rage'] }]] }],
  [{ at: .5, name: 'STORM FRONT', sub: 'The platforms come loose', color: '#5ef2ff', fx: [['platforms', { dx: 110 }], ['rain', { every: 1.5, dmg: 8, radius: 55, color: '#9fe8ff', status: ['slow', 1, 1] }]] },
    { at: .25, name: 'OVERLOAD', sub: 'Volt Widow calls her sparks', color: '#5ef2ff', fx: [['adds', { n: 2, weapon: 'pistol', name: 'SPARK', color: '#9fe8ff' }], ['hazard', { kind: 'electric' }], ['buff', { statuses: ['haste'] }]] }],
  [{ at: .5, name: 'FROZEN GUARD', sub: 'Ice knights rise', color: '#9fe8ff', fx: [['adds', { n: 2, weapon: 'frost-blade', name: 'ICE KNIGHT', color: '#c8f4ff' }]] },
    { at: .25, name: 'BLIZZARD', sub: 'Hail and a howling wind', color: '#9fe8ff', fx: [['wind', { x: -320 }], ['rain', { every: .9, dmg: 8, radius: 60, color: '#e8fbff', status: ['slow', 1.5, 1] }]] }],
  [{ at: .5, name: 'SCORCHED EARTH', sub: 'Lava floods the edges', color: '#ff4a1a', fx: [['hazard', { kind: 'lava', w: 190 }]] },
    { at: .25, name: 'INFERNO', sub: 'Meteors fall', color: '#ff4a1a', fx: [['rain', { every: .8, dmg: 10, color: '#ff8a2e', status: ['burn', 2, 1] }], ['buff', { statuses: ['rage'] }]] }],
  [{ at: .5, name: 'NEON SURGE', sub: 'The Tyrant calls its guard', color: '#ff5ad1', fx: [['adds', { n: 2, name: 'NEON GUARD' }], ['platforms', { dx: 0, dy: 70, period: 3 }]] },
    { at: .25, name: 'FINAL FORM', sub: 'Everything at once', color: '#ff5ad1', fx: [['buff', { statuses: ['rage', 'haste'] }], ['rain', { every: 1, dmg: 11 }], ['hazard', { kind: 'spikes', w: 150 }]] }],
];
// Called by Boss Rush at each boss's round start: all of this boss's fighters share one health pool for phases.
function bossRushPhases(i) {
  const bosses = F.filter(f => f.isBoss);
  return BOSS_RUSH_PHASES[i] ? bossPhases(bosses, BOSS_RUSH_PHASES[i]) : null;
}
