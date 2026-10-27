/* ===== a race: six lanes, a start sequence, a finish line =====
   The player's inputs are recorded tick by tick from the moment the race is created, so the same seed and inputs
   rebuild the same race exactly (race codes and ghosts). */

function makeRace(opts) {
  const { seed, distance, cls, difficulty, lane = 2, ghostInputs = null, solo = false, kind = 'regatta', duel = false } = opts;
  const course = makeCourse(seed, distance, kind);
  const rng = makeRng(hashSeed(seed, 0x57A));
  const names = CREW_NAMES.slice();
  const boats = [], brains = [];
  for (let l = 0; l < LANES; l++) {
    if (solo && l !== lane) continue;   // practice: just you on the water
    if (kind === 'knockout' && l !== lane && l !== lane + 1) continue;   // a match race: two crews side by side
    const name = l === lane ? (duel ? 'Player 1' : 'You') : names.splice((rng() * names.length) | 0, 1)[0];
    const human = l === lane || (duel && l === lane + 1);   // a duel puts a second human crew in the next lane
    boats.push(makeBoat(cls, l, duel && l === lane + 1 ? 'Player 2' : name, seed, human ? 0.035 : DIFFICULTY[difficulty].crewSd));
    brains[l] = human ? null : makeBrain(seed, l, difficulty);   // indexed by lane, since some lanes may be empty
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
    player2: duel ? boats.find(b => b.lane === lane + 1) : null,
    tick: 0,
    t: -(4 + rng() * 2.5),        // seconds until the start
    attentionAt: -(1.2 + rng() * 1.6),  // "Attention!" comes a varying time before the horn, so nobody can anticipate it
    started: false, inputs: [], done: false, falseStart: false, finishOrder: [],
  };
}

// Rules versions: each one changes the physics, so a race keeps the rules it was rowed under forever.
//  1: the original physics.  2: wash from crews in the next lane.
const RULES_LATEST = 2;

// Wash: a faster crew just ahead in the next lane leaves rough water. Only felt when both boats drift towards
// each other, so it rewards holding the middle of your lane. Computed for every boat before any moves.
function washFor(race, b) {
  let wash = 0;
  for (const o of race.boats) {
    if (o === b || Math.abs(o.lane - b.lane) !== 1 || o.v <= b.v) continue;
    const behind = o.x - BOAT_CLASSES[o.cls].length - b.x, side = Math.abs(o.z - b.z);
    if (behind > -2 && behind < 25 && side < 9.5) wash = Math.max(wash, clamp((9.5 - side) / 2.5, 0, 1) * (1 - behind / 25));
  }
  return wash;
}

function stepRace(race, playerInput, player2Input = 0) {
  const dt = TUNE.dt;
  race.t += dt;
  const wasStarted = race.started;
  race.started = race.t >= 0;
  if (race.started && !wasStarted) race.startTick = race.tick;
  // Before the horn the blade stays still; holding the drive after "Attention" is a false start.
  if (!race.started) {
    if (((playerInput | player2Input) & IN.DRIVE) && race.t > race.attentionAt) race.falseStart = true;
    playerInput &= ~(IN.DRIVE | IN.PUSH);
    player2Input &= ~(IN.DRIVE | IN.PUSH);
  }
  race.inputs.push(playerInput);
  const wash = (race.opts.rules || 1) >= 2 && race.course.kind === 'regatta' ? race.boats.map(b => washFor(race, b)) : null;
  for (let i = 0; i < race.boats.length; i++) {
    const b = race.boats[i];
    if (wash && wash[i] > 0) { b.v *= 1 - TUNE.washDrag * wash[i] * TUNE.dt; b.inWash = wash[i] } else b.inWash = 0;
    if (b.finishTime != null && b.x > race.course.distance + 40) { b.v *= 0.99; b.x += b.v * dt; continue }
    const input = b === race.player ? playerInput : b === race.player2 ? player2Input : botInput(race.brains[b.lane], b, race);
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
  if (race.player2 && race.player2.finishTime == null && race.t < 1200) return;   // a duel ends when both humans are home
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
