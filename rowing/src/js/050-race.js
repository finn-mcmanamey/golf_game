/* ===== a race: six lanes, a start sequence, a finish line =====
   The player's inputs are recorded tick by tick from the moment the race is created, so the same seed and inputs
   rebuild the same race exactly (race codes and ghosts). */

function makeRace(opts) {
  const { seed, distance, cls, difficulty, lane = 2, ghostInputs = null, solo = false, kind = 'regatta' } = opts;
  const course = makeCourse(seed, distance, kind);
  const rng = makeRng(hashSeed(seed, 0x57A));
  const names = CREW_NAMES.slice();
  const boats = [], brains = [];
  for (let l = 0; l < LANES; l++) {
    if (solo && l !== lane) continue;   // practice: just you on the water
    const name = l === lane ? 'You' : names.splice((rng() * names.length) | 0, 1)[0];
    boats.push(makeBoat(cls, l, name, seed, l === lane ? 0.035 : DIFFICULTY[difficulty].crewSd));
    brains.push(l === lane ? null : makeBrain(seed, l, difficulty));
  }
  if (course.bends) {
    // Head race: you go first; the other crews follow at 8-second intervals, each on its own line.
    let k = 1;
    for (const b of boats) { b.z = targetZ(course, b); if (b.lane !== lane) b.startAt = 8 * k++ }
  }
  let ghost = null;
  if (ghostInputs) { ghost = makeBoat(cls, lane, 'Ghost', seed, 0.035); ghost.isGhost = true; ghost.z = targetZ(course, ghost) }
  return {
    opts, course, boats, brains, ghost, ghostInputs,
    player: boats.find(b => b.lane === lane),
    tick: 0,
    t: -(4 + rng() * 2.5),        // seconds until the start
    attentionAt: -(1.2 + rng() * 1.6),  // "Attention!" comes a varying time before the horn, so nobody can anticipate it
    started: false, inputs: [], done: false, falseStart: false, finishOrder: [],
  };
}

function stepRace(race, playerInput) {
  const dt = TUNE.dt;
  race.t += dt;
  const wasStarted = race.started;
  race.started = race.t >= 0;
  if (race.started && !wasStarted) race.startTick = race.tick;
  // Before the horn the blade stays still; holding the drive after "Attention" is a false start.
  if (!race.started) {
    if ((playerInput & IN.DRIVE) && race.t > race.attentionAt) race.falseStart = true;
    playerInput &= ~(IN.DRIVE | IN.PUSH);
  }
  race.inputs.push(playerInput);
  for (let i = 0; i < race.boats.length; i++) {
    const b = race.boats[i];
    if (b.finishTime != null && b.x > race.course.distance + 40) { b.v *= 0.99; b.x += b.v * dt; continue }
    const input = b === race.player ? playerInput : botInput(race.brains[b.lane], b, race);
    stepBoat(b, b.finishTime != null ? packInput(0, 18) : input, race.course, race);
    if (b.finishTime != null && !race.finishOrder.includes(b)) race.finishOrder.push(b);
  }
  if (race.ghost) {
    const g = race.ghost, gi = race.ghostInputs;
    if (g.finishTime == null) stepBoat(g, race.tick < gi.length ? gi[race.tick] : packInput(0, 18), race.course, race);
    else { g.v *= 0.99; g.x += g.v * dt }
  }
  race.tick++;
  const p = race.player;
  const allIn = race.boats.every(b => b.finishTime != null);
  if (p.finishTime != null && (allIn || race.t > p.finishTime + (race.course.bends ? 70 : 25))) race.done = true;
  if (race.t > 60 * 20) race.done = true;  // safety net
}

// Place: finished crews by time; the rest by distance (or, in a head race, by the time they're on course for).
function placeOf(race, boat) {
  const D = race.course.distance;
  const score = b => b.finishTime != null ? b.finishTime : race.course.bends
    ? 1e6 + (b.x > 20 ? (race.t - b.startAt) * D / b.x : 1e5 + b.startAt) : 1e6 - b.x;
  const me = score(boat);
  return 1 + race.boats.filter(b => b !== boat && score(b) < me).length;
}

// Re-rows a race from its recorded inputs without drawing anything: used to verify codes and build ghosts.
function simulateRace(opts, inputs) {
  const race = makeRace({ ...opts, ghostInputs: null });
  for (let i = 0; i < inputs.length && !race.done; i++) stepRace(race, inputs[i]);
  return race;
}
