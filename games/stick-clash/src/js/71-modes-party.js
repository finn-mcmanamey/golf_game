// 71-modes-party.js: v3 party modes built on 70-modes' helpers: Capture the Flag, Soccer, Hot Potato, Gun Game and
// Juggernaut. Shared party helpers (team rosters, side spawns, respawns, scoreboards) live at the top and are used
// by 72-modes-survive too. Every mode ends its matches on its own (goals, captures, a weapon ladder, points or a
// clock), so SC.sim always reaches the results screen.

// ---------- shared party helpers ----------
const PARTY_TEAMS = [{ name: 'BLUE', color: '#4ab8ff', shades: ['#4ab8ff', '#5ef2ff', '#7dffcf', '#b98cff'] },
  { name: 'RED', color: '#ff4a6a', shades: ['#ff4a6a', '#ff8a2e', '#ff5ad1', '#ffd84a'] }];
// Mode HUD row: below the fighter cards and the round label, whatever the card layout.
const PARTY_HUD_Y = 150;
const PARTY_OPEN_MAPS = ['dojo', 'neon', 'frost', 'temple', 'moon', 'desert', 'bounce'];

// The menu's arena when it has a floor (party objectives sit on the ground), else one of the open arenas.
function partyMap(cfg, prefer = PARTY_OPEN_MAPS) {
  const chosen = MAPS[cfg.map];
  if (chosen && chosen.floor != null) return cfg.map;
  const ok = prefer.filter(k => MAPS[k]);
  return ok.length ? pick(ok) : randomKey(MAPS, m => m.floor != null) || randomKey(MAPS);
}

// You plus n-1 CPUs split into two teams (team 0 = yours). CPUs wear their team's shades.
function partyTeamRoster(cfg, n) {
  const names = shuffle(MODE_NAMES.slice()), half = Math.ceil(n / 2), roster = [humanEntry(cfg, 0, 0, 0, 'YOU')];
  for (let i = 1; i < n; i++) {
    const team = i < half ? 0 : 1, k = team ? i - half : i;
    roster.push(modeEntry({ team, ...themeLoadout(pick(MODE_THEMES)), color: PARTY_TEAMS[team].shades[k % 4], hat: modeHat(),
      name: names[i].toUpperCase() }));
  }
  return roster;
}
// You plus n-1 CPUs, everyone on their own team.
function partyFfaRoster(cfg, n, extra = {}) {
  const names = shuffle(MODE_NAMES.slice()), roster = [Object.assign(humanEntry(cfg, 0, 0, 0, 'YOU'), extra)];
  for (let i = 1; i < n; i++) roster.push(modeEntry(Object.assign({ team: i, ...themeLoadout(pick(MODE_THEMES)), color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    hat: modeHat(), name: names[i].toUpperCase() }, extra)));
  return roster;
}
const partyCrowd = (cfg, mode) => clamp(cfg.fighters || mode.crowd[2], mode.crowd[0], mode.crowd[1]);
const partyFloor = () => MAP.floor ?? 600;

// A spot on the team's own side of the arena (team 0 left, team 1 right), spread out by slot.
function partySideSpot(team, slot) {
  const x = team ? W - 100 - (slot % 4) * 55 : 100 + (slot % 4) * 55;
  return [x, groundBelow(x, partyFloor() - 4) ?? partyFloor()];
}
// The map spawn farthest from every living foe (free-for-all respawns).
function partySafeSpot(f) {
  let best = MAP.spawns[0], bd = -1;
  for (const sp of MAP.spawns) {
    const d = Math.min(...F.filter(o => o.alive && o.team !== f.team).map(o => Math.abs(o.P[2].x - sp[0])), 1e4);
    if (d > bd) { bd = d; best = sp; }
  }
  return best;
}
// Teleports a fighter so its feet stand at (x, y).
function partyPlace(f, x, y) {
  moveFighter(f, x - f.P[2].x, y - feetY(f));
  for (const p of f.P) { p.ox = p.x; p.oy = p.y; }
  f.face = x < W / 2 ? 1 : -1;
}
// Builds a fresh copy of roster fighter `old.id` at (x, y) and swaps it into F. `over` overrides roster fields.
function partyRespawn(old, x, y, over = {}) {
  const r = G_STATE.roster[old.id];
  const f = makeFighter(Object.assign({}, r, { id: old.id, x, y, face: x < W / 2 ? 1 : -1, weapon: resolveWeapon(r.weapon),
    skills: old.skills, autopilot: old.autopilot, cls: resolveClass(r.cls || 'none'), throws: resolveThrows(r.throws) }, over));
  f.inv = 1.2;                                                      // brief spawn protection
  applyMatchHp(f);                                                  // the Settings health multiplier (75)
  F = F.map(o => o === old ? f : o);
  const c = chest(f);
  ring(c.x, c.y, 80, f.color, .4, 5); burst(c.x, c.y, f.color, 20, 300);
  return f;
}
// Counts down run.dead[id] and calls spawn(old) when a fighter's timer runs out.
function partyTickRespawns(run, dt, spawn) {
  for (const id in run.dead) {
    if ((run.dead[id] -= dt) > 0) continue;
    delete run.dead[id];
    const old = F.find(f => f.id === +id && !f.summon);
    if (old && !old.alive) spawn(old);
  }
}
// A hazard owned by a mode (rising lava, boss traps). It rides PROJ as a zone (stepped, drawn over the arena and
// cleared each round) instead of joining MAP.hazards, whose order some arenas' scripts rely on.
function partyHazard(o) {
  const hz = Object.assign({ kind: 'lava', dps: 20, tick: .25 }, o), wait = new Map();
  skillZone({ owner: null, x: 0, y: 0, life: 1e9, kind: 'mode-hazard', hz,
    onStep(z, dt) {
      for (const f of F) {
        if (!f.alive) continue;
        const t = (wait.get(f) || 0) - dt;
        if (t > 0) { wait.set(f, t); continue; }
        wait.set(f, 0);
        if ([2, 8, 10, 0].some(j => inRect(f.P[j].x, f.P[j].y, hz))) { wait.set(f, hz.tick); touchHazard(f, hz, hz.tick); }
      }
    },
    draw(ctx) { (HAZARD_DRAW[hz.kind] || HAZARD_DRAW.default)(ctx, hz, G_STATE.t); } });
  return hz;
}
const partyLive = () => G_STATE.lock <= 0 && !G_STATE.ending && G_STATE.state !== 'over';
const partyTeamName = t => PARTY_TEAMS[t] ? PARTY_TEAMS[t].name : 'TEAM ' + (t + 1);
// Ends the round and replaces the core banner with the mode's own words.
function partyEnd(team, reason, title, sub, color) {
  endRound(team, reason);
  banner(title, sub, TUNE.koDelay * .9, color);
}
// "Respawning in 2" lines for the fighters on the clock.
function partyDrawRespawns(ctx, run, y) {
  let k = 0;
  for (const id in run.dead) {
    const r = G_STATE.roster[id];
    if (r && r.ctrl === 'human') modeText(ctx, `${r.name} respawns in ${Math.ceil(run.dead[id])}`, W / 2, y + 20 * k++, 14, r.color, 'center', '600 ' + FONT_BODY);
  }
}
// Team scoreboard: "BLUE 2 ◆ 1 RED" with a caption under it.
function partyDrawTeamScore(ctx, a, b, caption) {
  const y = PARTY_HUD_Y;
  modePanel(ctx, W / 2 - 150, y - 22, 300, 44, 'rgba(255,255,255,.25)');
  modeText(ctx, `${PARTY_TEAMS[0].name} ${a}`, W / 2 - 20, y, 22, PARTY_TEAMS[0].color, 'right');
  modeText(ctx, '◆', W / 2, y, 14, '#c9cdee');
  modeText(ctx, `${b} ${PARTY_TEAMS[1].name}`, W / 2 + 20, y, 22, PARTY_TEAMS[1].color, 'left');
  if (caption) modeText(ctx, caption, W / 2, y + 36, 15, '#ff8a2e', 'center', '600 ' + FONT_BODY);
}
// Ranked list of fighters by a per-id score (gun game, juggernaut): top left of the HUD, or under the centre
// row when the HUD is narrow (phones).
function partyDrawBoard(ctx, rows) {
  const narrow = VIEW.hudW < 900, x = narrow ? W / 2 - 107 : (W - VIEW.hudW) / 2 + 40, y = narrow ? PARTY_HUD_Y + 50 : PARTY_HUD_Y;
  modePanel(ctx, x - 8, y - 16, 230, rows.length * 20 + 14, 'rgba(255,255,255,.2)');
  rows.forEach((r, i) => {
    modeText(ctx, `${i + 1}. ${r.name}`, x, y + i * 20, 13, r.color, 'left', '600 ' + FONT_BODY);
    modeText(ctx, r.text, x + 214, y + i * 20, 13, '#ffffff', 'right', '600 ' + FONT_BODY);
  });
}
function teamWinResults(won, lines) {
  return { title: won ? 'Your team wins!' : 'The other team wins', color: won ? PARTY_TEAMS[0].color : PARTY_TEAMS[1].color, won, lines };
}

// ---------- Capture the Flag ----------
const CTF_GOAL = 3, CTF_RESPAWN = 3, CTF_RETURN = 10, CTF_TOUCH = 50;

defMode('ctf', {
  name: 'Capture the Flag', icon: '⚑', order: 76,
  desc: `Two teams, two flags. Grab theirs and run it home. First to ${CTF_GOAL} captures; KOs respawn.`,
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 1, roundLimit: 180, customRounds: true, crowd: [4, MAX_FIGHTERS, 4],
  setup(cfg) {
    return { roster: partyTeamRoster(cfg, partyCrowd(cfg, this) & ~1), map: partyMap(cfg), run: { caps: [0, 0], dead: {} } };
  },
  roundLabel() { return `CAPTURE THE FLAG · FIRST TO ${CTF_GOAL}`; },
  holdRound() { return true; },
  roundOver() { return 'match'; },
  onRoundStart() {
    const run = modeRun();
    run.flags = [0, 1].map(team => { const [x, y] = ctfHome(team); return { team, hx: x, hy: y, x, y, carrier: null, dropT: 0, home: true }; });
    let slot = [0, 0];
    for (const f of F) { const [x, y] = partySideSpot(f.team, slot[f.team]++ + 1); partyPlace(f, x, y); }
    banner('CAPTURE THE FLAG', `FIRST TO ${CTF_GOAL}`, 2, '#ffd84a');
  },
  onKO(v) { if (!v.summon) modeRun().dead[v.id] = CTF_RESPAWN; },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive() || !run.flags) return;
    partyTickRespawns(run, dt, old => { const [x, y] = partySideSpot(old.team, old.id); partyRespawn(old, x, y); });
    for (const flag of run.flags) ctfStepFlag(run, flag, dt);
    if (G_STATE.roundT >= G_STATE.roundLimit) {
      const [a, b] = run.caps, win = a === b ? -1 : a > b ? 0 : 1;
      partyEnd(win, 'time', 'TIME!', win < 0 ? 'DRAW' : partyTeamName(win) + ' WINS', win < 0 ? null : PARTY_TEAMS[win].color);
    }
  },
  aiGoal(f) { return ctfAiGoal(f); },
  drawWorld(ctx) { const run = modeRun(); if (run.flags) for (const fl of run.flags) ctfDrawFlag(ctx, fl); },
  hud(ctx) {
    const run = modeRun(), mine = run.flags && run.flags[0];
    const cap = !mine ? '' : mine.carrier ? 'YOUR FLAG IS TAKEN!' : !mine.home ? 'Your flag is down: touch it to return it' : '';
    partyDrawTeamScore(ctx, run.caps[0], run.caps[1], cap);
    partyDrawRespawns(ctx, run, PARTY_HUD_Y + 60);
  },
  results() {
    const [a, b] = modeRun().caps;
    return a === b ? { title: 'Draw!', color: '#ffd84a', lines: [`Captures ${a} – ${b}.`] } : teamWinResults(a > b, [`Captures ${a} – ${b} (${levelName(modeDiff())}).`]);
  },
});

const ctfHome = team => [team ? W - 70 : 70, partyFloor()];
const ctfNear = (f, x, y) => f.alive && !f.summon && Math.hypot(f.P[2].x - x, f.P[2].y - (y - 60)) < CTF_TOUCH + 20 * f.scale;
const ctfCarried = f => (modeRun().flags || []).find(fl => fl.carrier === f);

function ctfStepFlag(run, flag, dt) {
  const c = flag.carrier;
  if (c) {
    if (!c.alive || !F.includes(c)) return ctfDrop(flag, c);
    flag.x = c.P[1].x - c.face * 14; flag.y = feetY(c) - 20;
    const [hx, hy] = ctfHome(c.team);
    if (ctfNear(c, hx, hy)) ctfCapture(run, flag, c);
    return;
  }
  if (!flag.home) {                                                  // lying on the ground: falls, times out
    flag.y = Math.min(flag.y + 600 * dt, groundBelow(flag.x, flag.y - 10) ?? partyFloor());
    if ((flag.dropT += dt) >= CTF_RETURN) return ctfReturn(flag, 'RETURNED');
  }
  for (const f of F) {
    if (!ctfNear(f, flag.x, flag.y) || f.heldBy) continue;
    if (f.team === flag.team) { if (!flag.home) return ctfReturn(flag, 'SAVED BY ' + f.name); continue; }
    if (ctfCarried(f)) continue;
    flag.carrier = f; flag.home = false;
    float(f.P[0].x, f.P[0].y - 50, 'FLAG TAKEN!', PARTY_TEAMS[f.team].color, 24); sfx('orb');
    return;
  }
}
function ctfDrop(flag, c) {
  flag.carrier = null; flag.dropT = 0;
  float(flag.x, flag.y - 60, 'FLAG DROPPED', PARTY_TEAMS[flag.team].color, 22);
}
function ctfReturn(flag, text) {
  Object.assign(flag, { x: flag.hx, y: flag.hy, carrier: null, home: true, dropT: 0 });
  float(flag.x, flag.y - 90, text, PARTY_TEAMS[flag.team].color, 22); ring(flag.x, flag.y - 40, 70, PARTY_TEAMS[flag.team].color, .4, 4);
}
function ctfCapture(run, flag, f) {
  run.caps[f.team]++;
  ctfReturn(flag, 'CAPTURED');
  sfx('cheer'); shake(10); flashScreen(PARTY_TEAMS[f.team].color, .15);
  if (run.caps[f.team] >= CTF_GOAL) partyEnd(f.team, 'flag', 'CAPTURED!', partyTeamName(f.team) + ' WINS', PARTY_TEAMS[f.team].color);
  else banner('CAPTURE!', `${f.name} · ${run.caps[0]} – ${run.caps[1]}`, 1.6, PARTY_TEAMS[f.team].color);
}

// CPU roles: carriers run home, the first of each team (by id) attacks, the rest guard or chase the thief.
function ctfAiGoal(f) {
  const run = modeRun();
  if (!run.flags) return null;
  const mine = run.flags[f.team], theirs = run.flags[1 - f.team], [hx, hy] = ctfHome(f.team);
  if (theirs.carrier === f) return { x: hx, y: hy, w: 30 };
  if (mine.carrier) return { x: mine.carrier.P[2].x, y: feetY(mine.carrier), w: 30 };
  const mates = F.filter(o => o.team === f.team && !o.summon && o.alive), attacker = mates.indexOf(f) % 2 === 0;
  if (!mine.home && !attacker) return { x: mine.x, y: mine.y, w: 30 };
  if (attacker && !theirs.carrier) return { x: theirs.x, y: theirs.y, w: 30 };
  if (attacker) return null;                                          // our runner has it: escort by fighting
  return { x: hx + (f.team ? -110 : 110), y: hy, w: 300 };              // guard the base, fight whoever comes
}

function ctfDrawFlag(ctx, fl) {
  const col = PARTY_TEAMS[fl.team].color, t = G_STATE.t, base = fl.hx;
  glow(ctx, col, 14, () => lineXY(ctx, base - 48, fl.hy - 2, base + 48, fl.hy - 2, col, 4));   // the capture pad
  const x = fl.x, y = fl.y, top = y - 92;
  lineXY(ctx, x, y, x, top, '#e8ebff', 3);
  const wave = k => Math.sin(t * 7 + k * 2) * 5, dir = fl.team ? -1 : 1;
  glow(ctx, col, 12, () => poly(ctx, [[x, top], [x + dir * 44, top + 8 + wave(1)], [x + dir * 40, top + 22 + wave(2)], [x, top + 30]], col, '#ffffff', 1.5));
  if (fl.carrier) circle(ctx, x, top - 8, 4 + Math.sin(t * 10) * 1.5, '#ffffff');
}

// ---------- Soccer ----------
const SOC_GOAL = 3, SOC_R = 30, SOC_MOUTH = 170, SOC_DEPTH = 62, SOC_RESPAWN = 2.5;

defMode('soccer', {
  name: 'Soccer', icon: '⚽', order: 76.5,
  desc: `A giant physics ball and two goals. Kick it, whack it, shoot it or blast it in. First to ${SOC_GOAL} goals.`,
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 1, roundLimit: 150, customRounds: true, crowd: [2, MAX_FIGHTERS, 4], noDisarm: true,
  setup(cfg) {
    return { roster: partyTeamRoster(cfg, partyCrowd(cfg, this)), map: partyMap(cfg, ['dojo', 'neon', 'temple', 'frost']), run: { goals: [0, 0], dead: {} } };
  },
  roundLabel() { return `SOCCER · FIRST TO ${SOC_GOAL}`; },
  holdRound() { return true; },
  roundOver() { return 'match'; },
  onRoundStart() {
    const run = modeRun();
    let slot = [0, 0];
    for (const f of F) { const [x, y] = partySideSpot(f.team, slot[f.team]++ + 1); partyPlace(f, x + (f.team ? -60 : 60), y); f.dmgTakenMul = .6; }
    socKickoff(run);
    banner('SOCCER', `FIRST TO ${SOC_GOAL}`, 2, '#ffd84a');
  },
  onKO(v) { if (!v.summon) modeRun().dead[v.id] = SOC_RESPAWN; },
  onStep(dt) {
    const run = modeRun();
    if (!run.ball || G_STATE.state === 'over') return;
    if (G_STATE.lock > 0 || G_STATE.ending) return;
    partyTickRespawns(run, dt, old => { const [x, y] = partySideSpot(old.team, old.id); const f = partyRespawn(old, x, y); f.dmgTakenMul = .6; });
    socStepBall(run, dt);
    socCpuTouches(run);
    socCheckGoal(run);
    if (G_STATE.roundT >= G_STATE.roundLimit) {
      const [a, b] = run.goals, win = a === b ? -1 : a > b ? 0 : 1;
      partyEnd(win, 'time', 'FULL TIME', win < 0 ? 'DRAW' : partyTeamName(win) + ' WINS', win < 0 ? null : PARTY_TEAMS[win].color);
    }
  },
  aiGoal(f) { return socAiGoal(f); },
  drawWorld(ctx) { socDrawGoals(ctx); socDrawBall(ctx, modeRun().ball); },
  hud(ctx) { const run = modeRun(); partyDrawTeamScore(ctx, run.goals[0], run.goals[1], ''); partyDrawRespawns(ctx, run, PARTY_HUD_Y + 40); },
  results() {
    const [a, b] = modeRun().goals;
    return a === b ? { title: 'Draw!', color: '#ffd84a', lines: [`Goals ${a} – ${b}.`] } : teamWinResults(a > b, [`Goals ${a} – ${b} (${levelName(modeDiff())}).`]);
  },
});
// Explosions shove the ball too.
on('explode', (x, y, radius) => {
  const run = G_STATE.mode && G_STATE.mode.key === 'soccer' && modeRun(), b = run && run.ball;
  if (!b) return;
  const d = Math.hypot(b.x - x, b.y - y);
  if (d > radius + b.r) return;
  const k = 1100 * (1 - d / (radius + b.r)) / Math.max(1, d);
  b.vx += (b.x - x) * k; b.vy += (b.y - y) * k - 200;
});

function socKickoff(run) {
  run.ball = { x: W / 2, y: 180, vx: 0, vy: 0, r: SOC_R, spin: 0, hold: 1, still: 0 };
}
// The ball: gravity, drag, bounces off the floor, walls and platforms, and is pushed by bodies, weapons and shots.
function socStepBall(run, dt) {
  const b = run.ball;
  if (b.hold > 0) { b.hold -= dt; return; }                               // a short hover after kickoff
  b.vy += PHYS.gravity * .5 * dt;
  const drag = 1 - .35 * dt;
  b.vx *= drag; b.vy *= drag;
  b.x += b.vx * dt; b.y += b.vy * dt;
  b.spin += b.vx * dt / b.r;
  socCollideWorld(b);
  for (const f of F) if (f.alive) socPushByFighter(b, f);
  socPushByShots(b);
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 1500) { b.vx *= 1500 / sp; b.vy *= 1500 / sp; }
  b.still = sp < 25 ? b.still + dt : 0;
  if (b.still > 7 || b.y > H + 200) socKickoff(run);                      // stuck or lost: drop a new one
}
function socCollideWorld(b) {
  const fl = partyFloor(), r = b.r;
  if (b.y + r > fl) { b.y = fl - r; if (b.vy > 0) b.vy = -b.vy * .62; b.vx *= .992; }
  if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * .7; }
  if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx) * .7; }
  if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy) * .6; }
  for (const s of MAP.solids) socCollideRect(b, s);
  for (const bar of socBars()) socCollideRect(b, bar);
}
const socBars = () => [{ x: 0, y: partyFloor() - SOC_MOUTH - 10, w: SOC_DEPTH, h: 10 }, { x: W - SOC_DEPTH, y: partyFloor() - SOC_MOUTH - 10, w: SOC_DEPTH, h: 10 }];
// Circle against a box: push out along the shortest way and bounce. One-way platforms only catch it from above.
function socCollideRect(b, s) {
  const cx = clamp(b.x, s.x, s.x + s.w), cy = clamp(b.y, s.y, s.y + s.h);
  let dx = b.x - cx, dy = b.y - cy;
  const d = Math.hypot(dx, dy);
  if (d >= b.r || (s.oneWay && (b.vy < 0 || b.y > s.y))) return;
  if (d < 1e-3) { dx = 0; dy = -1; } else { dx /= d; dy /= d; }
  b.x = cx + dx * b.r; b.y = cy + dy * b.r;
  const vn = b.vx * dx + b.vy * dy;
  if (vn < 0) { b.vx -= 1.65 * vn * dx; b.vy -= 1.65 * vn * dy; }
  b.vx += (s.dx || 0) / DT * .1;
}
// Body parts and weapon points moving into the ball pass their speed on (weapons hit harder).
function socPushByFighter(b, f) {
  const n = f.P.length;
  for (let j = 0; j < n; j++) {
    if (j === 1 || j === 3 || j === 5 || j === 7 || j === 9) continue;   // joints in the middle of limbs
    const p = f.P[j], weapon = j >= 11, pr = (weapon ? 6 : j === 0 ? 14 : 7) * f.scale;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
    if (d >= b.r + pr || d < 1e-3) continue;
    const nx = dx / d, ny = dy / d, rel = (vx(p) - b.vx) * nx + (vy(p) - b.vy) * ny;
    b.x = p.x + nx * (b.r + pr); b.y = p.y + ny * (b.r + pr);
    if (rel > 0) {
      const k = (weapon ? 1.25 : .95) * Math.min(1.6, f.scale);
      b.vx += nx * rel * k; b.vy += ny * rel * k - (weapon ? 60 : 30);
      b.lastTouch = f;
    }
  }
}
function socPushByShots(b) {
  for (const p of PROJ) {
    if (p.dead || p.zone || !(p.r > 0) || Math.hypot(p.x - b.x, p.y - b.y) > b.r + p.r) continue;
    const k = clamp((p.dmg || 6) / 10, .4, 2.5) * .45;
    b.vx += p.vx * k; b.vy += p.vy * k - 80;
    if (!p.explode) { p.dead = true; burst(p.x, p.y, p.color, 6, 200, { life: .2 }); }
    if (p.owner) b.lastTouch = p.owner;
  }
}
// CPUs swing at the ball when it's in reach on the side of the goal they attack, and hop over it from the wrong side.
function socCpuTouches(run) {
  const b = run.ball;
  for (const f of F) {
    if (!f.alive || !aiBrain(f) || f.summon) continue;
    const dir = f.team ? -1 : 1, dx = b.x - f.P[2].x, near = Math.abs(dx) < aiReach(f) * .8 && Math.abs(b.y - f.P[2].y) < 140;
    if (near && dx * dir > 0 && f.atkCd <= 0) { f.inp.attack = true; f.face = dir; }
    if (Math.abs(dx) < 70 && dx * dir < 0 && f.grounded && b.y > partyFloor() - 3 * b.r) f.inp.jump = true;
  }
}
function socCheckGoal(run) {
  const b = run.ball, mouth = partyFloor() - SOC_MOUTH;
  if (b.y < mouth) return;
  const side = b.x < SOC_DEPTH - b.r * .3 ? 0 : b.x > W - SOC_DEPTH + b.r * .3 ? 1 : -1;
  if (side < 0) return;
  const team = 1 - side;                                    // a ball in the left goal scores for the right team
  run.goals[team]++;
  ring(b.x, b.y, 120, PARTY_TEAMS[team].color, .5, 6); burst(b.x, b.y, PARTY_TEAMS[team].color, 40, 600);
  sfx('cheer'); shake(14); flashScreen(PARTY_TEAMS[team].color, .18);
  const who = b.lastTouch && b.lastTouch.team === team ? b.lastTouch.name : 'OWN GOAL';
  if (run.goals[team] >= SOC_GOAL) partyEnd(team, 'goal', 'GOAL!', partyTeamName(team) + ' WINS', PARTY_TEAMS[team].color);
  else banner('GOAL!', `${who} · ${run.goals[0]} – ${run.goals[1]}`, 1.6, PARTY_TEAMS[team].color);
  socKickoff(run);
}

// The teammate nearest the ball goes for it (lining up behind it); the others hold a spot between ball and goal.
function socAiGoal(f) {
  const b = modeRun().ball;
  if (!b) return null;
  const dir = f.team ? -1 : 1, mates = F.filter(o => o.alive && o.team === f.team && !o.summon);
  const chaser = mates.reduce((a, o) => Math.abs(o.P[2].x - b.x) < Math.abs(a.P[2].x - b.x) ? o : a, f);
  const fy = groundBelow(clamp(b.x, 40, W - 40), b.y - 10) ?? partyFloor();
  if (chaser === f || mates.length < 2) return { x: clamp(b.x - dir * (b.r + 10), 40, W - 40), y: Math.min(fy, partyFloor()), w: 24 };
  const own = f.team ? W - SOC_DEPTH : SOC_DEPTH;
  return { x: lerp(own, b.x, .45), y: partyFloor(), w: 160 };
}

function socDrawGoals(ctx) {
  const fl = partyFloor(), top = fl - SOC_MOUTH;
  [0, 1].forEach(side => {
    const col = PARTY_TEAMS[side].color, x0 = side ? W - SOC_DEPTH : 0, x1 = x0 + SOC_DEPTH, post = side ? x0 : x1;
    ctx.fillStyle = rgba(col, .08); ctx.fillRect(x0, top, SOC_DEPTH, SOC_MOUTH);
    ctx.strokeStyle = rgba('#ffffff', .18); ctx.lineWidth = 1;
    for (let y = top + 14; y < fl; y += 14) lineXY(ctx, x0, y, x1, y, rgba('#ffffff', .14), 1);
    for (let x = x0 + 12; x < x1; x += 12) lineXY(ctx, x, top, x, fl, rgba('#ffffff', .14), 1);
    glow(ctx, col, 14, () => { lineXY(ctx, post, fl, post, top - 10, col, 6); lineXY(ctx, x0, top - 5, x1, top - 5, col, 6); });
  });
}
function socDrawBall(ctx, b) {
  if (!b) return;
  glow(ctx, '#ffffff', 14, () => circle(ctx, b.x, b.y, b.r, '#f2f4ff', '#1a1d33', 3));
  for (let k = 0; k < 5; k++) {                                   // spinning patches
    const a = b.spin + k * TAU / 5;
    circle(ctx, b.x + Math.cos(a) * b.r * .58, b.y + Math.sin(a) * b.r * .58, b.r * .2, '#1a1d33');
  }
  circle(ctx, b.x, b.y, b.r * .22, '#ff5ad1');
  if (b.hold > 0) modeText(ctx, '▼', b.x, b.y - b.r - 18 + Math.sin(G_STATE.t * 8) * 4, 18, '#ffd84a');
}

// ---------- Hot Potato ----------
const POT_FUSE = [9, 13], POT_BLAST = 150, POT_SPLASH = 40, POT_TAKEN = .2;

defMode('potato', {
  name: 'Hot Potato', icon: '💣', order: 77,
  desc: 'One fighter carries a ticking bomb. Hit or grab someone to pass it on before it blows. Last one standing scores; first to 2.',
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 2, roundLimit: 90, customRounds: true, crowd: [3, MAX_FIGHTERS, 4],
  setup(cfg) { return { roster: partyFfaRoster(cfg, partyCrowd(cfg, this)), map: partyMap(cfg), winScore: 2, run: {} }; },
  onRoundStart() {
    const run = modeRun();
    for (const f of F) f.dmgTakenMul = POT_TAKEN;                      // plain hits only sting: the bomb decides
    run.holder = null; run.from = null; run.passT = 0;
    potGive(run, pick(F.filter(f => !f.summon)), null);
    banner('HOT POTATO', 'PASS THE BOMB!', 1.8, '#ff8a2e');
  },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive() || !run.holder) return;
    run.passT -= dt;
    if (!run.holder.alive || !F.includes(run.holder)) { potGive(run, potRandom(null), null); return; }
    if ((run.fuse -= dt) <= 0) potExplode(run);
  },
  aiGoal(f) { return potAiGoal(f); },
  drawWorld(ctx) { const run = modeRun(); if (run.holder && run.holder.alive) potDrawBomb(ctx, run.holder, run.fuse); },
  hud(ctx) {
    const run = modeRun(), h = run.holder;
    if (!h || !h.alive) return;
    modePanel(ctx, W / 2 - 160, PARTY_HUD_Y - 21, 320, 42, rgba('#ff8a2e', .7));
    modeText(ctx, `💣 ${h.name}`, W / 2 - 140, PARTY_HUD_Y, 18, h.color, 'left');
    modeText(ctx, run.fuse.toFixed(1), W / 2 + 140, PARTY_HUD_Y, 22, run.fuse < 3 ? '#ff4a6a' : '#ffd84a', 'right');
  },
  results() {
    const s = G_STATE.score, best = s.indexOf(Math.max(...s)), won = best === 0;
    return { title: won ? 'You survived the potato!' : `${G_STATE.roster[best].name} wins`, color: G_STATE.roster[best].color, won,
      lines: [`Rounds won: ${G_STATE.roster.map((r, i) => `${r.name} ${s[i]}`).join(' · ')}.`] };
  },
});
const potRandom = except => pick(F.filter(f => f.alive && !f.summon && f !== except)) || null;
function potGive(run, f, from) {
  if (!f) { run.holder = null; return; }
  if (!run.holder || run.fuse == null || run.fuse <= 0) run.fuse = rnd(...POT_FUSE);   // a pass keeps the fuse burning
  run.holder = f; run.from = from; run.passT = .6;
  for (const o of F) if (o.status.haste && o !== f && o.mem.potHaste) removeStatus(o, 'haste');
  addStatus(f, 'haste', 30, 1); f.mem.potHaste = true;                         // the holder runs faster to catch someone
  const c = chest(f);
  float(c.x, c.y - 80, from ? 'TAG! YOU\'RE IT' : 'YOU\'RE IT', '#ff8a2e', 24); ring(c.x, c.y, 60, '#ff8a2e', .35, 4);
  sfx('orb', .7);
}
function potPass(A, B) {
  const run = modeRun();
  if (run.holder !== A || !B || !B.alive || B.summon || B === A || run.passT > 0 || (B === run.from && run.passT > -.6)) return;
  potGive(run, B, A);
}
on('damage', (B, amt, o) => {
  if (!G_STATE.mode || G_STATE.mode.key !== 'potato' || !o || !o.src || o.kind === 'status' || o.kind === 'hazard') return;
  potPass(o.src.summon ? o.src.owner : o.src, B);
});
on('grab', (A, B) => { if (G_STATE.mode && G_STATE.mode.key === 'potato') potPass(A, B); });
function potExplode(run) {
  const f = run.holder, c = chest(f);
  explode(c.x, c.y, POT_BLAST, POT_SPLASH, null, { team: -1, color: '#ff8a2e', kb: 800 });
  run.holder = null;
  if (f.alive) knockout(f, run.from, { kind: 'bomb' });
  if (aliveTeams().length > 1) potGive(run, potRandom(f), null);
}
// The holder chases the nearest fighter; everyone else keeps away from the holder (and fights when it's far).
function potAiGoal(f) {
  const run = modeRun(), h = run.holder;
  if (!h || !h.alive) return null;
  if (h === f) {
    const t = nearestEnemy(f);
    return t ? { x: t.P[2].x, y: feetY(t), w: 20 } : null;
  }
  const dx = f.P[2].x - h.P[2].x;
  if (Math.abs(dx) > 380 && Math.abs(f.P[2].y - h.P[2].y) < 300) return null;
  let tx = f.P[2].x + (Math.sign(dx) || 1) * 260;
  if (tx < 80 || tx > W - 80) tx = h.P[2].x < W / 2 ? W - 120 : 120;                  // cornered: break past to the other side
  return { x: tx, y: partyFloor(), w: 40 };
}
function potDrawBomb(ctx, f, fuse) {
  const t = G_STATE.t, x = f.P[0].x, y = f.P[0].y - 44 * f.scale, pulse = fuse < 3 ? 1 + .15 * Math.sin(t * 30) : 1;
  glow(ctx, fuse < 3 ? '#ff4a6a' : '#ff8a2e', 16, () => circle(ctx, x, y, 13 * pulse, '#1a1d33', '#ff8a2e', 2.5));
  lineXY(ctx, x + 6, y - 10, x + 12, y - 18, '#c9cdee', 2.5);
  circle(ctx, x + 12, y - 18, 3 + Math.random() * 2, Math.sin(t * 40) > 0 ? '#ffd84a' : '#ff4a6a');
  modeText(ctx, Math.ceil(fuse), x, y + 1, 12, '#ffffff');
}

// ---------- Gun Game ----------
const GG_LADDER = [['minigun', 'ranged'], ['shotgun', 'ranged'], ['revolver', 'ranged'], ['laser', 'magic'], ['katana', 'blade'],
  ['battle-axe', 'heavy'], ['frying-pan', 'exotic']];
const GG_RESPAWN = 1.5;

defMode('gungame', {
  name: 'Gun Game', icon: '🔫', order: 77.5,
  desc: `Every KO moves you up a ${GG_LADDER.length}-weapon ladder, ending on a frying pan. First KO with the last weapon wins.`,
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 1, roundLimit: 200, customRounds: true, crowd: [2, MAX_FIGHTERS, 4], noDisarm: true,
  setup(cfg) {
    const ladder = GG_LADDER.map(([k, cat]) => modeWeapon([k], [cat]));
    return { roster: partyFfaRoster(cfg, partyCrowd(cfg, this), { weapon: ladder[0] }), map: partyMap(cfg), run: { ladder, lvl: {}, dead: {} } };
  },
  roundLabel() { return 'GUN GAME'; },
  holdRound() { return true; },
  roundOver() { return 'match'; },
  onRoundStart() {
    const run = modeRun();
    for (const f of F) run.lvl[f.id] = 0;
    banner('GUN GAME', `${run.ladder.length} WEAPONS TO GLORY`, 2, '#ffd84a');
  },
  onKO(v, killer) {
    const run = modeRun();
    if (v.summon) return;
    run.dead[v.id] = GG_RESPAWN;
    const k = killer && (killer.summon ? killer.owner : killer);
    if (k && k !== v && k.alive) ggAdvance(run, k);
  },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive()) return;
    for (const p of PROJ) if (p.kind === 'pickup') p.dead = true;           // dropped weapons would skip the ladder
    partyTickRespawns(run, dt, old => { const sp = partySafeSpot(old); partyRespawn(old, sp[0], sp[1], { weapon: run.ladder[run.lvl[old.id] || 0] }); });
    if (G_STATE.roundT >= G_STATE.roundLimit) { const top = ggLeader(run); partyEnd(top.team, 'time', 'TIME!', top.name + ' WINS', top.color); }
  },
  hud(ctx) {
    const run = modeRun(), n = run.ladder.length;
    const rows = F.filter(f => !f.summon).sort((a, b) => (run.lvl[b.id] || 0) - (run.lvl[a.id] || 0)).slice(0, 4)
      .map(f => ({ name: f.name, color: f.color, text: `${(run.lvl[f.id] || 0) + 1}/${n}` }));
    partyDrawBoard(ctx, rows);
    const me = modePlayer();
    if (me) { const l = run.lvl[0] || 0, next = run.ladder[l + 1]; modeText(ctx, next ? `Next: ${WEAPONS[next].name}` : 'FINAL WEAPON!', W / 2, PARTY_HUD_Y, 16, next ? '#c9cdee' : '#ffd84a', 'center', '600 ' + FONT_BODY); }
  },
  results() {
    const run = modeRun(), top = ggLeader(run), won = top.id === 0;
    return { title: won ? 'Gun Game champion!' : `${top.name} wins`, color: top.color, won,
      lines: [`${top.name} reached weapon ${Math.min(run.lvl[top.id] + 1, run.ladder.length)} of ${run.ladder.length}.`, `Your weapon: ${(run.lvl[0] || 0) + 1} of ${run.ladder.length}.`] };
  },
});
function ggAdvance(run, k) {
  const lvl = run.lvl[k.id] = (run.lvl[k.id] || 0) + 1;
  if (lvl >= run.ladder.length) { run.lvl[k.id] = run.ladder.length - 1; run.champ = k.id; partyEnd(k.team, 'ladder', 'GUN GAME', k.name + ' WINS', k.color); return; }
  equipWeapon(k, run.ladder[lvl]);
  const c = chest(k);
  float(c.x, c.y - 80, WEAPONS[run.ladder[lvl]].name.toUpperCase(), k.color, 22); ring(c.x, c.y, 70, k.color, .35, 4);
  if (lvl === run.ladder.length - 1) banner('FINAL WEAPON', k.name, 1.4, '#ffd84a');
}
function ggLeader(run) {
  const list = F.filter(f => !f.summon);
  if (run.champ != null) return list.find(f => f.id === run.champ) || list[0];
  return list.reduce((a, f) => (run.lvl[f.id] || 0) > (run.lvl[a.id] || 0) ? f : a, list[0]);
}

// ---------- Juggernaut ----------
const JUG_GOAL = 5, JUG_SCALE = 1.6, JUG_HP = 1.6, JUG_RESPAWN = 2;

defMode('juggernaut', {
  name: 'Juggernaut', icon: '🗿', order: 78,
  desc: `One giant against everyone. KO the Juggernaut to become it. Points for KOs as the giant and for felling it; first to ${JUG_GOAL}.`,
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 1, roundLimit: 150, customRounds: true, crowd: [3, MAX_FIGHTERS, 5],
  setup(cfg) {
    const roster = partyFfaRoster(cfg, partyCrowd(cfg, this));
    roster.forEach(r => { r.team = 0; });
    return { roster, map: partyMap(cfg), run: { pts: {}, dead: {}, jugg: null, next: null } };
  },
  roundLabel() { return 'JUGGERNAUT'; },
  holdRound() { return true; },
  roundOver() { return 'match'; },
  onRoundStart() {
    const run = modeRun();
    for (const f of F) run.pts[f.id] = 0;
    run.next = { id: pick(F.filter(f => !f.summon)).id, at: null };
    jugCrown(run);
    banner('JUGGERNAUT', 'TAKE DOWN THE GIANT', 2, '#ffd84a');
  },
  onKO(v, killer) {
    const run = modeRun();
    if (v.summon) return;
    const k = killer && (killer.summon ? killer.owner : killer);
    if (v.id === run.jugg) {
      run.jugg = null;
      const heir = k && k !== v && k.alive ? k : potRandom(v);
      if (k && k !== v) jugScore(run, k, 1);
      if (heir) run.next = { id: heir.id };
    } else if (k && k.id === run.jugg) jugScore(run, k, 1);
    run.dead[v.id] = JUG_RESPAWN;
  },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive()) return;
    if (run.next) jugCrown(run);
    partyTickRespawns(run, dt, old => { const sp = partySafeSpot(old); G_STATE.roster[old.id].team = 0; partyRespawn(old, sp[0], sp[1], { team: 0, scale: 1 }); });
    if (G_STATE.roundT >= G_STATE.roundLimit) { const top = jugLeader(run); partyEnd(top.team, 'time', 'TIME!', top.name + ' WINS', top.color); }
  },
  drawWorld(ctx) {
    const j = F.find(f => f.id === modeRun().jugg && f.alive);
    if (j) modeText(ctx, '♛', j.P[0].x, j.P[0].y - 60 * j.scale + Math.sin(G_STATE.t * 4) * 4, 30, '#ffd84a');
  },
  hud(ctx) {
    const run = modeRun(), j = F.find(f => f.id === run.jugg && f.alive);
    const rows = F.filter(f => !f.summon).sort((a, b) => run.pts[b.id] - run.pts[a.id]).slice(0, 4)
      .map(f => ({ name: (f.id === run.jugg ? '♛ ' : '') + f.name, color: f.color, text: `${run.pts[f.id]} / ${JUG_GOAL}` }));
    partyDrawBoard(ctx, rows);
    if (j) modeBigBar(ctx, W / 2 - 200, PARTY_HUD_Y - 4, 400, j.hp / j.maxHp, j.color, `JUGGERNAUT: ${j.name}`);
    partyDrawRespawns(ctx, run, PARTY_HUD_Y + (VIEW.hudW < 900 ? 150 : 44));
  },
  results() {
    const run = modeRun(), top = jugLeader(run), won = top.id === 0;
    return { title: won ? 'Unstoppable!' : `${top.name} wins`, color: top.color, won,
      lines: [`Points: ${G_STATE.roster.map((r, i) => `${r.name} ${run.pts[i] || 0}`).join(' · ')}.`] };
  },
});
// Turns fighter run.next.id into the giant on team 1, where it stands (everyone else is team 0).
function jugCrown(run) {
  const old = F.find(f => f.id === run.next.id && !f.summon);
  run.next = null;
  if (!old) return;
  for (const r of G_STATE.roster) r.team = 0;
  G_STATE.roster[old.id].team = 1;
  for (const f of F) f.team = 0;
  const x = clamp(old.P[2].x, 80, W - 80), y = old.alive ? feetY(old) : partySafeSpot(old)[1];
  delete run.dead[old.id];
  const g = partyRespawn(old, x, y, { team: 1, scale: JUG_SCALE, hpMul: JUG_HP, cls: 'none', weapon: old.alive ? old.wkey : G_STATE.roster[old.id].weapon });
  g.kbMul = .55; g.inv = 1.5; run.jugg = g.id;
  banner('NEW JUGGERNAUT', g.name, 1.4, '#ffd84a'); shake(12);
}
function jugScore(run, f, n) {
  run.pts[f.id] = (run.pts[f.id] || 0) + n;
  if (run.pts[f.id] >= JUG_GOAL && !G_STATE.ending) { run.champ = f.id; partyEnd(f.team, 'points', 'JUGGERNAUT', f.name + ' WINS', f.color); }
}
function jugLeader(run) {
  const list = F.filter(f => !f.summon);
  if (run.champ != null) return list.find(f => f.id === run.champ) || list[0];
  return list.reduce((a, f) => (run.pts[f.id] || 0) > (run.pts[a.id] || 0) ? f : a, list[0]);
}
