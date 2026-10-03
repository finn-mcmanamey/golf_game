// 72-modes-survive.js: v3 survival party modes: Zombie Horde (co-op waves), Battle Royale (shrinking safe zone,
// supply drops) and Lava Rising (the floor climbs, new platforms appear). Uses the party helpers of 71-modes-party.

// ---------- Zombie Horde ----------
// Zombie kinds: shambler (slow, grabs), runner (fast, frail), bloater (bursts when close or killed), brute (the
// giant of the last wave). Up to ZOM_SLOTS zombies are up at once; the rest of the wave waits in a queue.
const ZOM_WAVES = [
  ['shambler', 'shambler', 'shambler', 'shambler'],
  ['shambler', 'runner', 'shambler', 'runner', 'shambler'],
  ['shambler', 'bloater', 'runner', 'shambler', 'runner', 'bloater'],
  ['runner', 'bloater', 'shambler', 'runner', 'bloater', 'shambler', 'runner'],
  ['brute', 'shambler', 'runner', 'bloater', 'runner', 'shambler'],
];
const ZOM_SLOTS = 4, ZOM_SPAWN_GAP = 1.1, ZOM_HEAL = 40;
const ZOM_KINDS = {
  shambler: { name: 'SHAMBLER', color: '#7dff6a', hpMul: .5, speed: .55, level: 'easy', grab: true },
  runner: { name: 'RUNNER', color: '#c8ff3a', hpMul: .3, speed: 1.15, level: 'normal' },
  bloater: { name: 'BLOATER', color: '#b6ff9a', hpMul: .45, speed: .5, level: 'easy', scale: 1.25, burst: true },
  brute: { name: 'GRAVE BRUTE', color: '#3aff9a', hpMul: .8, speed: .8, level: 'normal', scale: 1.7, weapon: ['hammer', 'mace'] },
};

// The zombies' rotten claws (hidden: only zombies use them).
defWeapon('zombie-claws', { name: 'Rotten Claws', cat: 'fist', hidden: true, desc: 'Zombie swipes.',
  len: 22, mass: .7, dmg: .7, width: 8, kb: .9, lift: .5, cd: .55,
  ai: { range: 80, style: 'melee' },
  attack(f) { meleeThrust(f, .9, f.main); },
  draw(ctx, f, s) {
    for (const o of [-4, 0, 4]) lineXY(ctx, s.t.x, s.t.y, s.at(s.L + 8 * s.k, o * s.k).x, s.at(s.L + 8 * s.k, o * s.k).y, '#d9ffcc', 2 * s.k);
    circle(ctx, s.t.x, s.t.y, 5 * s.k, s.color, '#07080f', 1.2);
  } });

function zomEntry(kind) {
  const z = ZOM_KINDS[kind];
  return modeEntry({ team: 1, name: z.name, color: z.color, hat: 'none', scale: z.scale || 1, hpMul: z.hpMul, aiLevel: z.level, cls: 'none',
    weapon: z.weapon ? modeWeapon(z.weapon, ['heavy']) : 'zombie-claws', skills: [null, null], throws: ['none', 'none'], zkind: kind });
}

defMode('zombies', {
  name: 'Zombie Horde', icon: '🧟', order: 78.5,
  desc: `Team up with a CPU ally against ${ZOM_WAVES.length} waves of shambling, sprinting and bursting zombies, then their brute.`,
  players: [1, 1], cpu: true, pickers: 2, labels: ['You', 'Ally (CPU)'], winScore: 1, roundLimit: 150, customRounds: true, noDisarm: true, aiArmor: false,
  setup(cfg) {
    const me = humanEntry(cfg, 0, 0, 0, 'YOU'), ally = modeEntry({ ...loadoutOf(cfg, 1), team: 0, name: 'ALLY', color: '#5ef2ff' });
    const map = MAPS[cfg.map] && MAPS[cfg.map].floor != null ? cfg.map : MAPS.graveyard ? 'graveyard' : partyMap(cfg);
    return { roster: [me, ally, ...zomWaveRoster(1)], map, run: { wave: 1, cleared: 0, kills: 0, queue: [], spawnT: 0 } };
  },
  roundLabel() { return `WAVE ${modeRun().wave}/${ZOM_WAVES.length}`; },
  holdRound() { return true; },
  onRoundStart() {
    const run = modeRun(), plan = ZOM_WAVES[run.wave - 1];
    run.queue = plan.slice(ZOM_SLOTS); run.spawnT = ZOM_SPAWN_GAP; run.total = plan.length; run.left = plan.length;
    G_STATE.winScore = 0;
    for (const f of F) if (f.team === 1) zomRise(f);
    for (const f of F) if (f.team === 0 && run.hp && run.hp[f.id] != null) f.hp = f.hpShow = Math.min(f.maxHp, run.hp[f.id] + ZOM_HEAL);
    banner('WAVE ' + run.wave, run.wave === ZOM_WAVES.length ? 'THE BRUTE AWAKENS' : `${plan.length} ZOMBIES`, 1.8, '#7dff6a');
  },
  onKO(v) {
    const run = modeRun();
    if (v.team !== 1 || v.summon) return;
    run.kills++; run.left--;
    if (ZOM_KINDS[v.zkind] && ZOM_KINDS[v.zkind].burst) zomBurst(v);
  },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive()) return;
    zomRefill(run, dt);
    for (const f of F) if (f.alive && f.team === 1) zomStep(f);
    const players = F.filter(f => f.team === 0 && !f.summon);
    if (!players.some(f => f.alive)) return partyEnd(1, 'overrun', 'OVERRUN', 'THE HORDE WINS', '#7dff6a');
    if (run.left <= 0 || G_STATE.roundT >= G_STATE.roundLimit) partyEnd(0, 'wave', 'WAVE CLEARED', `${run.wave}/${ZOM_WAVES.length}`, '#5ef2ff');
  },
  roundOver(winner) {
    const run = modeRun();
    if (winner !== 0) return 'match';
    run.cleared++;
    run.hp = {};
    for (const f of F) if (f.team === 0 && !f.summon) run.hp[f.id] = f.alive ? f.hp : 20;   // fallen allies get back up
    if (++run.wave > ZOM_WAVES.length) return 'match';
    G_STATE.roster = G_STATE.roster.slice(0, 2).concat(zomWaveRoster(run.wave));
    return 'next';
  },
  hud(ctx) {
    const run = modeRun();
    modeText(ctx, `Zombies left ${Math.max(0, run.left)}  ·  Destroyed ${run.kills}`, W / 2, PARTY_HUD_Y, 16, '#7dff6a', 'center', '600 ' + FONT_BODY);
  },
  results() {
    const run = modeRun(), all = run.cleared >= ZOM_WAVES.length, best = Math.max(store.get('zombieBest', 0), run.cleared);
    if (!G_STATE.cfg.autopilot) store.set('zombieBest', best);
    return all ? { title: 'HORDE DESTROYED!', color: '#7dff6a', won: true, waves: run.cleared, lines: [`All ${ZOM_WAVES.length} waves cleared. ${run.kills} zombies put back to rest.`] }
      : { title: 'Overrun', color: '#7dff6a', won: false, waves: run.cleared, lines: [`You held out for ${run.cleared} wave${run.cleared === 1 ? '' : 's'} and destroyed ${run.kills} zombies.`, `Best: ${best} waves.`] };
  },
});

// The first ZOM_SLOTS zombies of wave n as roster entries (more fill their slots as they fall).
const zomWaveRoster = n => ZOM_WAVES[n - 1].slice(0, ZOM_SLOTS).map(zomEntry);

// Gives a freshly built zombie its gait and kind, and lifts it out of the ground away from the players.
function zomRise(f) {
  const kind = ZOM_KINDS[G_STATE.roster[f.id].zkind] || ZOM_KINDS.shambler;
  f.zkind = G_STATE.roster[f.id].zkind;
  f.spdMul = kind.speed; f.superMul = 1e-6; f.kbMul = kind.scale > 1.5 ? .6 : 1.15;
  const players = F.filter(o => o.team === 0 && o.alive);
  let x = rnd(80, W - 80);
  for (let k = 0; k < 8 && players.some(p => Math.abs(p.P[2].x - x) < 260); k++) x = rnd(80, W - 80);
  partyPlace(f, x, groundBelow(x, partyFloor() - 4) ?? partyFloor());
  burst(x, partyFloor(), '#7dff6a', 18, 260, { grav: 1 });
}
// Replaces fallen zombies with the next ones in the queue, one every ZOM_SPAWN_GAP seconds.
function zomRefill(run, dt) {
  if (!run.queue.length || (run.spawnT -= dt) > 0) return;
  const dead = F.find(f => f.team === 1 && !f.alive && !f.summon && f.shatterT && G_STATE.t - f.shatterT > .8);
  if (!dead) return;
  run.spawnT = ZOM_SPAWN_GAP;
  G_STATE.roster[dead.id] = zomEntry(run.queue.shift());
  zomRise(partyRespawn(dead, dead.P[2].x, partyFloor(), { weapon: G_STATE.roster[dead.id].weapon }));
}
// Per-step zombie habits: shamblers lunge for grabs, bloaters burst beside a living player.
function zomStep(f) {
  const kind = ZOM_KINDS[f.zkind];
  if (!kind) return;
  const foe = nearestEnemy(f), d = foe ? dist(chest(foe), chest(f)) : 1e9;
  if (kind.grab && d < 70 && !f.holding && f.grabCd <= 0 && chance(.02)) f.inp.grab = true;
  if (kind.burst && d < 80 * f.scale) knockout(f, null, { kind: 'burst' });
}
function zomBurst(f) {
  const c = chest(f);
  explode(c.x, c.y, 130, 18, f, { color: '#9dff5a', status: ['poison', 3, 1], kb: 700, kind: 'skill' });
}

// ---------- Battle Royale ----------
// The safe zone is a column [cx - half, cx + half]. It holds for ROYALE_FIRST seconds, then shrinks in stages toward
// a random centre; outside it costs health (more each stage). Supply crates parachute into the zone.
const ROYALE_STAGES = [560, 400, 270, 170, 95], ROYALE_FIRST = 6, ROYALE_EVERY = 9, ROYALE_SHRINK = 5;
const ROYALE_DROP = 9, ROYALE_DPS = [4, 6, 9, 13, 18, 24], ROYALE_TAKEN = .3;

defMode('royale', {
  name: 'Battle Royale', icon: '🌀', order: 79,
  desc: 'Eight fighters, one winner. A storm closes in from the edges and supply drops fall inside the safe zone.',
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 1, roundLimit: 150, customRounds: true, crowd: [4, MAX_FIGHTERS, MAX_FIGHTERS],
  setup(cfg) { return { roster: partyFfaRoster(cfg, partyCrowd(cfg, this)), map: partyMap(cfg, ['neon', 'temple', 'frost', 'moon', 'desert', 'dojo', 'bounce']), run: { out: [] } }; },
  roundLabel() { const n = F.filter(f => f.alive && !f.summon).length; return `${n} LEFT`; },
  roundOver() { return 'match'; },
  onRoundStart() {
    const run = modeRun();
    for (const f of F) f.dmgTakenMul = ROYALE_TAKEN;                   // tougher fighters: the storm gets its say
    Object.assign(run, { out: [], stage: 0, cx: W / 2, half: W / 2 + 40, from: null, to: null, shrinkT: 0, nextT: ROYALE_FIRST, dropT: ROYALE_DROP, hurtT: 0 });
    banner('BATTLE ROYALE', 'LAST ONE STANDING', 2, '#b98cff');
  },
  onKO(v) { if (!v.summon) modeRun().out.push(v.id); },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive()) return;
    royaleZoneStep(run, dt);
    royaleHurt(run, dt);
    royaleCrates(run, dt);
  },
  aiGoal(f) { return royaleAiGoal(f); },
  drawWorld(ctx) { royaleDrawStorm(ctx, modeRun()); },
  hud(ctx) {
    const run = modeRun();
    const msg = run.to ? 'THE STORM IS CLOSING' : run.stage >= ROYALE_STAGES.length ? 'FINAL ZONE' : `Storm closes in ${Math.ceil(run.nextT)}`;
    modeText(ctx, msg, W / 2, PARTY_HUD_Y, 16, run.to ? '#ff5ad1' : '#c9cdee', 'center', '600 ' + FONT_BODY);
  },
  results() {
    const run = modeRun(), n = G_STATE.roster.length, idx = run.out.indexOf(0), place = idx < 0 ? 1 : n - idx;
    const win = F.find(f => f.alive && !f.summon) || F[0], won = place === 1;
    return { title: won ? 'LAST ONE STANDING!' : `#${place} of ${n}`, color: won ? '#ffd84a' : win.color, won,
      lines: [won ? `You outlasted ${n - 1} fighters.` : `${win.name} won the royale.`, `Zone stage ${Math.min(run.stage, ROYALE_STAGES.length)} of ${ROYALE_STAGES.length}.`] };
  },
});
const royaleOutside = (run, f) => Math.abs(f.P[2].x - run.cx) > run.half;

function royaleZoneStep(run, dt) {
  if (run.to) {                                             // shrinking: slide toward the target over ROYALE_SHRINK s
    run.shrinkT += dt;
    const k = clamp(run.shrinkT / ROYALE_SHRINK, 0, 1);
    run.cx = lerp(run.from.cx, run.to.cx, k); run.half = lerp(run.from.half, run.to.half, k);
    if (k >= 1) { run.to = null; run.stage++; run.nextT = ROYALE_EVERY; }
    return;
  }
  if (run.stage >= ROYALE_STAGES.length || (run.nextT -= dt) > 0) return;
  const half = ROYALE_STAGES[run.stage], room = Math.max(0, run.half - half);
  run.from = { cx: run.cx, half: run.half };
  run.to = { cx: clamp(run.cx + rnd(-room, room) * .7, half + 20, W - half - 20), half };
  run.shrinkT = 0;
  banner('STORM INCOMING', 'MOVE TO THE SAFE ZONE', 1.4, '#ff5ad1'); sfx('round');
}
function royaleHurt(run, dt) {
  if ((run.hurtT -= dt) > 0) return;
  run.hurtT = .5;
  const dps = ROYALE_DPS[Math.min(run.stage, ROYALE_DPS.length - 1)];
  for (const f of F) if (f.alive && royaleOutside(run, f)) {
    const c = chest(f);
    damage(f, dps * .5, { kind: 'hazard', x: c.x, y: c.y, color: '#ff5ad1', small: true });
  }
}
// Supply drops: a weapon crate (also +25 health) inside the zone; anyone can take it by touch.
function royaleCrates(run, dt) {
  if ((run.dropT -= dt) <= 0) {
    run.dropT = ROYALE_DROP;
    const x = clamp(run.cx + rnd(-run.half, run.half) * .8, 60, W - 60), g = groundBelow(x, 80);
    if (g != null) { spawnPickup('crate', randomKey(WEAPONS) || 'blade', x, -40, 0, 120, { landY: g, ang: 0, va: 0, royale: true }); float(x, 120, 'SUPPLY DROP', '#ffd84a', 20); }
  }
  for (const p of PROJ) {
    if (!p.royale || p.dead || !p.rest) continue;
    const f = F.find(o => o.alive && !o.summon && !o.mount && pickupTouch(o, p));
    if (f) { takePickup(f, p); heal(f, 25); }
  }
}
// Outside the zone: run in. Hurt and a crate nearby: fetch it. Otherwise fight.
function royaleAiGoal(f) {
  const run = modeRun();
  if (run.half == null) return null;
  const target = run.to || run;
  if (Math.abs(f.P[2].x - target.cx) > target.half - 40) return { x: target.cx, y: groundBelow(target.cx, f.P[2].y - 200) ?? partyFloor(), w: Math.max(60, target.half) };
  if (f.hp > f.maxHp * .7) return null;
  const crate = PROJ.find(p => p.royale && !p.dead && Math.abs(p.x - f.P[2].x) < 320);
  return crate ? { x: crate.x, y: crate.landY ?? crate.y, w: 24 } : null;
}
function royaleDrawStorm(ctx, run) {
  if (run.half == null) return;
  const l = run.cx - run.half, r = run.cx + run.half, t = G_STATE.t;
  for (const [x0, x1] of [[-40, l], [r, W + 40]]) {
    if (x1 <= x0) continue;
    ctx.fillStyle = rgba('#3a0a4a', .45 + .05 * Math.sin(t * 3)); ctx.fillRect(x0, -40, x1 - x0, H + 80);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, -40, x1 - x0, H + 80); ctx.clip();
    for (let y = -40 + (t * 260) % 60; y < H + 40; y += 60) lineXY(ctx, x0, y, x1, y + 40, rgba('#ff5ad1', .22), 2);   // driving storm rain
    ctx.restore();
  }
  glow(ctx, '#ff5ad1', 16, () => { if (l > 0) lineXY(ctx, l, 0, l, H, '#ff5ad1', 3); if (r < W) lineXY(ctx, r, 0, r, H, '#ff5ad1', 3); });
  if (run.to) for (const x of [run.to.cx - run.to.half, run.to.cx + run.to.half]) lineXY(ctx, x, 0, x, H, rgba('#ffffff', .25), 1);
}

// ---------- Lava Rising ----------
// The lava creeps up (faster as the round goes on); fresh platforms appear above it every few seconds.
const LAVA_TAKEN = .45, LAVA_WAIT = 3, LAVA_SPEED = [8, 15], LAVA_TOP = 90, LAVA_PLAT_EVERY = 3.2;

defMode('lava', {
  name: 'Lava Rising', icon: '🌋', order: 79.5,
  desc: 'The floor is lava, and it keeps rising. Climb the platforms that appear and knock rivals down. Last one up scores; first to 2.',
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 2, roundLimit: 90, customRounds: true, crowd: [2, MAX_FIGHTERS, 4],
  setup(cfg) { return { roster: partyFfaRoster(cfg, partyCrowd(cfg, this)), map: partyMap(cfg, ['neon', 'frost', 'temple', 'dojo', 'moon']), winScore: 2, run: {} }; },
  onRoundStart() {
    const run = modeRun();
    run.lava = partyHazard({ kind: 'lava', x: -40, y: partyFloor() + 30, w: W + 80, h: H, dps: 40, tick: .2, launch: 560, color: '#ff6a2a',
      status: ['burn', 1.5, 1] });
    for (const f of F) f.dmgTakenMul = LAVA_TAKEN;                     // blows mostly knock: the lava does the killing
    run.wait = LAVA_WAIT; run.platT = 0;
    banner('LAVA RISING', 'CLIMB!', 1.8, '#ff6a2a');
  },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive() || !run.lava) return;
    if ((run.wait -= dt) > 0) return;
    const k = clamp(G_STATE.roundT / 60, 0, 1), lv = run.lava;
    lv.y = Math.max(LAVA_TOP, lv.y - lerp(LAVA_SPEED[0], LAVA_SPEED[1], k) * dt);
    lv.h = H + 200 - lv.y;
    if ((run.platT -= dt) <= 0) { run.platT = LAVA_PLAT_EVERY; lavaPlatform(lv.y); }
  },
  aiGoal(f) { return lavaAiGoal(f); },
  hud(ctx) {
    const run = modeRun();
    if (run.wait > 0 && G_STATE.lock <= 0) modeText(ctx, `The lava rises in ${Math.ceil(run.wait)}`, W / 2, PARTY_HUD_Y, 16, '#ff8a2e', 'center', '600 ' + FONT_BODY);
  },
  results() {
    const s = G_STATE.score, best = s.indexOf(Math.max(...s)), won = best === 0;
    return { title: won ? 'King of the volcano!' : `${G_STATE.roster[best].name} wins`, color: G_STATE.roster[best].color, won,
      lines: [`Rounds won: ${G_STATE.roster.map((r, i) => `${r.name} ${s[i]}`).join(' · ')}.`] };
  },
});
// A new one-way platform a jump or two above the lava, away from the last one.
function lavaPlatform(lavaY) {
  const y = Math.max(LAVA_TOP + 40, lavaY - rnd(170, 260)), w = rnd(150, 230);
  const x = clamp(rnd(60, W - 60 - w), 40, W - w - 40);
  if (y < LAVA_TOP + 30 || MAP.solids.some(s => Math.abs(s.y - y) < 60 && x < s.x + s.w + 40 && x + w > s.x - 40)) return;
  MAP.solids.push({ x, y, w, h: 14, oneWay: true, x0: x, y0: y, dx: 0, dy: 0, lava: true });
  ring(x + w / 2, y, w / 2, '#ffd84a', .5, 4); burst(x + w / 2, y, '#ffd84a', 16, 260);
}
// When the lava gets close, climb to the nearest platform comfortably above it.
function lavaAiGoal(f) {
  const lv = modeRun().lava;
  if (!lv) return null;
  const fy = feetY(f);
  if (lv.y - fy > 240) return null;
  let best = null, bs = Infinity;
  for (const s of MAP.solids) {
    if (s.y > lv.y - 110 || s.y < 50 || s.w < 60) continue;
    const score = Math.abs(s.x + s.w / 2 - f.P[2].x) + Math.max(0, fy - s.y - 300) * 4 + Math.max(0, s.y - fy) * .5;
    if (score < bs) { bs = score; best = s; }
  }
  return best ? { x: best.x + best.w / 2, y: best.y, w: best.w - 20 } : null;
}
