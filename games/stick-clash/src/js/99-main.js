// 99-main.js: match and round flow, the fixed-step world update, the main loop, boot, and the window.SC test API.

// ---------- match flow ----------
// cfg: { mode, map ('random' | key), diff, loadouts: [{ weapon, skills, hat, color }], orbs, winScore, autopilot, demo }
function normalizeCfg(cfg = {}) {
  const out = Object.assign({ mode: 'versus', map: 'random', diff: 'normal', loadouts: [], orbs: true }, cfg);
  if (!MODES[out.mode]) { report(new Error(`unknown mode "${out.mode}"`), 'startMatch'); out.mode = Object.keys(MODES)[0]; }
  return out;
}

function demoConfig() {
  return { mode: 'watch', map: 'random', diff: 'hard', demo: true, loadouts: [{ weapon: 'random' }, { weapon: 'random' }] };
}

function setState(s) {
  const before = G_STATE.state;
  if (before === s) return;
  G_STATE.state = s;
  emit('state', s, before);
}

const teamMembers = team => G_STATE.roster.filter(r => r.team === team);
function teamName(team) {
  const m = teamMembers(team);
  return m.length === 1 ? m[0].name : 'Team ' + (team + 1);
}
function teamColor(team) { const m = teamMembers(team); return m.length ? m[0].color : '#ffffff'; }

function buildRoster(info) {
  const roster = (info && Array.isArray(info.roster) ? info.roster : []).slice(0, MAX_FIGHTERS).map((r, i) => Object.assign({
    ctrl: 'cpu', slot: 0, team: i, weapon: 'random', skills: ['random', 'random'], color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    hat: 'none', scale: 1, hpMul: 1, name: 'CPU ' + (i + 1),
    cls: (r.scale || 1) > 1.05 ? 'none' : 'random', throws: ['random', 'random'],   // v3: bosses stay classless
  }, r, { wxp: {}, superKeep: 0 }));                                                   // weapon levels + meter: per match
  if ((info.roster || []).length > MAX_FIGHTERS) report(new Error(`roster capped at ${MAX_FIGHTERS} fighters`), G_STATE.mode.key + '.setup');
  if (roster.length >= 2) return roster;
  report(new Error('mode setup must return at least 2 roster entries'), G_STATE.mode.key + '.setup');
  return [0, 1].map(i => ({ ctrl: 'cpu', slot: 0, team: i, weapon: 'random', skills: ['random', 'random'], color: DEFAULT_COLORS[i], hat: 'none', scale: 1, hpMul: 1, name: 'CPU ' + (i + 1) }));
}

function startMatch(cfg) {
  abandonMatch();                  // leaving a Ranked match unfinished (restart, quit) counts as a loss
  cfg = normalizeCfg(cfg);
  const mode = MODES[cfg.mode];
  Object.assign(G_STATE, { cfg, mode, demo: !!cfg.demo, round: 1, result: null, log: [] });
  const info = hook(mode, 'setup', cfg) || {};
  G_STATE.info = info;
  G_STATE.roster = buildRoster(info);
  if (!mode.rerollRandom) for (const r of G_STATE.roster) rollRandomOnce(r);
  G_STATE.teams = Math.max(...G_STATE.roster.map(r => r.team)) + 1;
  G_STATE.score = Array(G_STATE.teams).fill(0);
  G_STATE.winScore = cfg.winScore || info.winScore || mode.winScore || 5;
  G_STATE.roundLimit = info.roundLimit || mode.roundLimit || TUNE.roundLimit;
  clearFx(); BANNER = null;
  setState(cfg.demo ? 'menu' : 'play');
  newRound();
  emit('matchStart', cfg);
}

// Tells the running mode its match is being dropped before a result (modes may hook 'abandon').
function abandonMatch() {
  if (G_STATE.mode && !G_STATE.demo && G_STATE.state !== 'over') hook(G_STATE.mode, 'abandon');
}
addEventListener('pagehide', abandonMatch);   // closing the tab mid-match too

// A 'random' weapon or skill is rolled once per match, so the player keeps what they just learned between rounds.
// Modes with rerollRandom: true (Weapon Roulette) roll again every round.
function rollRandomOnce(r) {
  if (r.weapon === 'random') r.weapon = resolveWeapon('random');
  if (Array.isArray(r.skills) && r.skills.includes('random')) r.skills = resolveSkills(r.skills);
  if (r.cls === 'random') r.cls = resolveClass('random');
  if (Array.isArray(r.throws) && r.throws.includes('random')) r.throws = resolveThrows(r.throws);
}
function resolveWeapon(key) { return key && key !== 'random' && WEAPONS[key] ? key : randomKey(WEAPONS); }
function resolveSkills(keys) {
  const out = [], list = keys || ['random', 'random'];
  for (const k of list.slice(0, 2)) {
    if (k === 'random') out.push(randomKey(SKILLS, s => !out.includes(s.key)));
    else out.push(k && SKILLS[k] ? k : null);
  }
  return out;
}
function resolveMap() {
  const k = G_STATE.info.map || G_STATE.cfg.map;
  return MAPS[k] ? MAPS[k] : MAPS[randomKey(MAPS)];
}

function newRound() {
  MAP = instantiateMap(resolveMap());
  applyMapPhysics(MAP);
  PROJ = []; resetOrbs(); clearFx();
  F = G_STATE.roster.map((r, i) => {
    const sp = spawnPoint(r.spawn ?? i);
    if (!r.wxp) r.wxp = {};
    return makeFighter(Object.assign({}, r, { id: i, x: sp[0], y: sp[1], face: sp[0] < W / 2 ? 1 : -1,
      weapon: resolveWeapon(r.weapon), skills: resolveSkills(r.skills), autopilot: !!G_STATE.cfg.autopilot && r.ctrl === 'human',
      cls: resolveClass(r.cls || 'none'), throws: resolveThrows(r.throws) }));
  });
  Object.assign(G_STATE, { lock: TUNE.startLock, koT: 0, ending: false, roundT: 0, winner: null, endReason: '' });
  banner('ROUND ' + G_STATE.round, 'FIGHT!', 1.6);
  sfx('round');
  hook(G_STATE.mode, 'onRoundStart');
  emit('roundStart', G_STATE.round);
}

// Spawn i of the current map. Maps define 4; fighters past that stand beside an existing spawn, on the same ground
// and out of hazards (falling back to sharing the spot when there is no room, e.g. a narrow bottomless ledge).
function spawnPoint(i) {
  const sp = MAP.spawns, n = sp.length;
  if (i < n) return sp[i];
  const base = sp[i % n], lap = Math.ceil((i + 1) / n) - 1;
  for (const off of [lap * 70, -lap * 70, lap * 130, -lap * 130]) {
    const x = clamp(base[0] + off, 60, W - 60), g = groundBelow(x, base[1] - 40);
    if (g != null && Math.abs(g - base[1]) < 30 && !MAP.hazards.some(hz => inRect(x, g - 10, hz, 20))) return [x, g];
  }
  return base;
}

// The team with the most health left (as a fraction) wins a round that runs out of time.
function healthLeader() {
  let best = -1, bestV = -1;
  for (let t = 0; t < G_STATE.teams; t++) {
    const v = F.filter(f => f.team === t && f.alive).reduce((s, f) => s + f.hp / f.maxHp, 0);
    if (v > bestV + 1e-9) { best = t; bestV = v; } else if (Math.abs(v - bestV) < 1e-9) best = -1;
  }
  return best;
}

function checkRoundEnd() {
  if (G_STATE.ending || !F.length) return;
  if (hook(G_STATE.mode, 'holdRound') === true) return;   // the mode ends rounds itself (e.g. King of the Hill respawns)
  const teams = aliveTeams(), timeUp = G_STATE.roundT >= G_STATE.roundLimit;
  if (teams.length > 1 && !timeUp) return;
  if (teams.length > 1) endRound(healthLeader(), 'time');
  else endRound(teams.length ? teams[0] : -1, teams.length ? 'ko' : 'draw');
}

function endRound(winner, reason) {
  Object.assign(G_STATE, { ending: true, winner, endReason: reason, koT: TUNE.koDelay });
  for (const f of F) if (!f.summon && G_STATE.roster[f.id]) G_STATE.roster[f.id].superKeep = f.super;   // the meter carries over
  if (winner >= 0 && winner < G_STATE.score.length) G_STATE.score[winner]++;   // party modes may crown a team beyond the scored ones (Juggernaut's giant)
  G_STATE.log.push({ round: G_STATE.round, winner, reason, time: G_STATE.roundT, map: MAP.key,
    fighters: F.filter(f => !f.summon).map(f => ({ wkey: f.wkey, skills: f.skills.slice(), dmg: f.stats.dmgDealt, hits: f.stats.hits, kos: f.stats.kos,
      skillsUsed: f.stats.skills, shots: f.stats.shots, upright: f.aliveT ? f.upT / f.aliveT : 1, alive: f.alive })) });
  if (G_STATE.log.length > 200) G_STATE.log.shift();
  const sub = winner >= 0 ? teamName(winner) + (teamMembers(winner).length > 1 ? ' win' : ' wins') : 'Nobody wins';
  banner(reason === 'time' ? 'TIME!' : reason === 'draw' ? 'DRAW' : 'K.O.', sub.toUpperCase(), TUNE.koDelay * .9, null);
  emit('roundEnd', winner, reason);
}

function afterRound() {
  let next = hook(G_STATE.mode, 'roundOver', G_STATE.winner, G_STATE.endReason);
  if (next !== 'next' && next !== 'match') next = G_STATE.score.some(s => s >= G_STATE.winScore) ? 'match' : 'next';
  if (next === 'next') { G_STATE.round++; newRound(); return; }
  endMatch();
}

function endMatch() {
  if (G_STATE.demo) { startMatch(demoConfig()); return; }   // the attract demo loops forever
  G_STATE.result = hook(G_STATE.mode, 'results') || defaultResults();
  G_STATE.ending = false;
  setState('over');
  emit('matchOver', G_STATE.result);
}

function defaultResults() {
  const best = G_STATE.score.indexOf(Math.max(...G_STATE.score));
  return { title: teamName(best) + (teamMembers(best).length > 1 ? ' win!' : ' wins!'), color: teamColor(best),
    lines: [`Final score ${G_STATE.score.join(' – ')} after ${G_STATE.round} rounds.`] };
}

// ---------- world step ----------
// One fixed physics step. Order: map -> brains -> drive -> physics -> combat -> world -> effects -> round flow.
function worldStep(dt) {
  G_STATE.t += dt;
  const flowing = G_STATE.state === 'play' || G_STATE.state === 'menu';
  if (G_STATE.lock > 0) {
    G_STATE.lock = Math.max(0, G_STATE.lock - dt);
    if (G_STATE.lock === 0 && flowing) sfx('fight');
  } else if (!G_STATE.ending && flowing) G_STATE.roundT += dt;
  updateMap(dt);
  emit('mapStepPre', dt);                  // 58-world: weather resets wind/grip before the arena's own step
  hook(MAP, 'onStep', dt, MAP.t);
  emit('mapStep', dt);                     // 58-world: weather, breakables
  if (flowing) hook(G_STATE.mode, 'onStep', dt);   // not behind the results screen (re-spins, boss tricks)
  // worldFrame (58-world) lets an arena re-orient a fighter's frame around its brain and drive (radial gravity).
  for (const f of F) if (f.alive && (f.ctrl !== 'human' || f.autopilot)) { worldFrame(f, 'think', true); think(f, dt); worldFrame(f, 'think', false); }
  for (const f of F) { worldFrame(f, 'drive', true); drive(f, dt); clearPresses(f); tickFighter(f, dt); worldFrame(f, 'drive', false); }
  for (const f of F) { integrate(f); solve(f); }
  if (G_STATE.lock <= 0) { clashAll(); strikeAll(); }
  stepProjectiles(dt); stepHazards(dt); stepOrbs(dt); checkRingOuts();
  fxStep(dt);
  if (!flowing) return;
  if (G_STATE.ending) { if ((G_STATE.koT -= dt) <= 0) afterRound(); }
  else checkRoundEnd();
}

// ---------- main loop ----------
let lastNow = 0, stepAcc = 0;

// Runs fixed steps for the real time that passed (slowed during slow-mo, frozen during hit-stop).
function advance(dt) {
  if (FX.hitstop > 0) { FX.hitstop -= dt; return; }
  let rate = 1;
  if (FX.slow > 0) { FX.slow -= dt; rate = FX.slowRate; }
  const speed = (!G_STATE.demo && G_STATE.cfg && G_STATE.cfg.speed || 1) * accessSpeedMul();   // menu speed x practice speed (92)
  stepAcc += dt * rate * speed;
  let n = 0;
  // Stop as soon as an override takes over mid-frame: a kill-cam that starts on matchOver swaps F for replay ghosts,
  // and stepping physics or the CPU brain on those ghosts corrupted them (NaN points).
  while (stepAcc >= DT && n < 10 && !G_STATE.override) { worldStep(DT); stepAcc -= DT; n++; }
  if (n >= 10) stepAcc = 0;      // too far behind (tab was hidden): drop the backlog
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastNow ? Math.min(.05, (now - lastNow) / 1000) : 1 / 60;
  lastNow = now;
  try {
    pollPads();
    for (const f of F) if (f.ctrl === 'human' && !f.autopilot) readHuman(f);
    // G_STATE.override (e.g. a kill-cam replay) takes over the update while set.
    if (typeof G_STATE.override === 'function') G_STATE.override(dt);
    else if (G_STATE.state !== 'paused' && MAP) advance(dt);
    render(G_STATE.state === 'paused' ? 0 : dt);
  } catch (e) { report(e, 'frame'); }
}

// ---------- boot ----------
function validateContent() {
  for (const [name, reg] of [['weapon', WEAPONS], ['map', MAPS], ['mode', MODES]]) {
    if (!listOf(reg).length) report(new Error(`no visible ${name} is registered`), 'boot');
  }
  for (const w of Object.values(WEAPONS)) if (w.offhand && !WEAPONS[w.offhand]) report(new Error(`offhand "${w.offhand}" not found`), `defWeapon('${w.key}')`);
  for (const m of Object.values(MAPS)) for (const sp of m.spawns) {
    if (!Array.isArray(sp) || !(sp[0] >= 0 && sp[0] <= W)) report(new Error('spawn must be [x, y] inside the arena'), `defMap('${m.key}')`);
  }
}

function boot() {
  validateContent();
  startMatch(demoConfig());
  emit('boot');
  cleanSettings();   // settings other slices added at boot get the same checks
  requestAnimationFrame(frame);
}

// ---------- test / debug API ----------
// SC.start(cfg) also accepts shorthands: weapons: ['blade', 'spear'], skills: [['blink', 'slam'], ...], hats: [...]
// v3 shorthands: classes: ['ninja', 'tank'], throws: [['grenade', 'mine'], ...], fighters: 8 (watch / ffa).
function testCfg(cfg = {}) {
  const c = Object.assign({ mode: 'watch' }, cfg);
  const n = Math.max(2, (c.weapons || []).length, (c.skills || []).length, (c.loadouts || []).length, (c.classes || []).length,
    (c.throws || []).length, c.fighters || 0);
  c.loadouts = Array.from({ length: n }, (_, i) => Object.assign({}, (cfg.loadouts || [])[i],
    c.weapons && c.weapons[i] ? { weapon: c.weapons[i] } : null,
    c.skills && c.skills[i] ? { skills: c.skills[i] } : null,
    c.hats && c.hats[i] ? { hat: c.hats[i] } : null,
    c.classes && c.classes[i] ? { cls: c.classes[i] } : null,
    c.throws && c.throws[i] ? { throws: c.throws[i] } : null));
  return c;
}

function fighterSummary(f) {
  return { id: f.id, name: f.name, team: f.team, ctrl: f.ctrl, hp: f.hp, maxHp: f.maxHp, alive: f.alive,
    x: f.P[2].x, y: f.P[2].y, upright: f.aliveT ? f.upT / f.aliveT : 1, wkey: f.wkey, skills: f.skills.slice(),
    status: Object.keys(f.status), stats: Object.assign({}, f.stats), nan: f.P.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)),
    cls: f.clsKey, stamina: f.stamina, super: f.super, lvl: f.lvl, element: f.element, mount: f.mount && f.mount.key,
    throws: f.throws.slice(), throwN: f.throwN.slice(), blocking: f.blocking, held: !!f.heldBy };
}

window.SC = {
  version: VERSION,
  reg: { WEAPONS, SKILLS, MAPS, MODES, ORBS, HATS, STATUS, CLASSES, THROWABLES, MOUNTS, ULTIMATES, ELEMENTS },
  errors: ERRORS, TUNE,
  get F() { return F; },
  get G() { return G_STATE; },
  start(cfg) { startMatch(testCfg(cfg)); return SC.state(); },
  // Runs the game headless for `seconds` of game time (no drawing, no sound, no hit-stop or slow-mo).
  sim(seconds = 1) {
    const was = G_STATE.sim;
    G_STATE.sim = true;
    try {
      const n = Math.round(seconds / DT);
      for (let k = 0; k < n; k++) worldStep(DT);
    } catch (e) { report(e, 'sim'); }
    finally { G_STATE.sim = was; FX.hitstop = 0; FX.slow = 0; }
    return SC.state();
  },
  state() {
    const g = G_STATE;
    return { state: g.state, mode: g.mode && g.mode.key, map: MAP && MAP.key, round: g.round, score: g.score.slice(),
      roundT: g.roundT, ending: g.ending, winner: g.winner, t: g.t, log: g.log.slice(), result: g.result,
      fighters: F.map(fighterSummary), projectiles: PROJ.length, orbs: ORB_LIST.length, errors: ERRORS.map(e => e.msg) };
  },
  render(dt = 1 / 60) { render(dt); },
  // Presses an action for fighter i (one step): 'jump' | 'attack' | 'skill1' | 'skill2' | 'dash' | 'grab' | 'throw' |
  // 'super' | 'mash'; or sets mx with move(i, dir); hold(i, 'block' | 'jump' | 'attack', on) holds a button.
  press(i, action) { const f = F[i]; if (f) { if (action === 'dash') f.inp.dash = f.face; else f.inp[action] = true; } },
  move(i, mx) { const f = F[i]; if (f) f.inp.mx = mx; },
  hold(i, action, on = true) { const f = F[i]; if (f) f.inp[action === 'block' ? 'blockHeld' : action + 'Held'] = !!on; },
  setState,
};

boot();
