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
    if ((kind === 'knockout' || kind === 'boatrace') && l !== lane && l !== lane + 1) continue;   // a match race: two crews side by side
    const name = l === lane ? (duel ? 'Player 1' : 'You') : names.splice((rng() * names.length) | 0, 1)[0];
    const human = l === lane || (duel && l === lane + 1);   // a duel puts a second human crew in the next lane
    boats.push(makeBoat(cls, l, duel && l === lane + 1 ? 'Player 2' : name, seed, human ? 0.035 : DIFFICULTY[difficulty].crewSd));
    brains[l] = human ? null : makeBrain(seed, l, difficulty);   // indexed by lane, since some lanes may be empty
  }
  if (kind === 'head') {
    // Head race: you go first; the other crews follow at 8-second intervals, each on its own line.
    let k = 1;
    for (const b of boats) { b.z = targetZ(course, b); if (b.lane !== lane) b.startAt = 8 * k++ }
  }
  if (kind === 'boatrace') for (const b of boats) b.z = targetZ(course, b);   // side by side, a wide gap for the eights' oars
  // Bumps: one line of crews with clear water between them; the crew at the head of the river starts furthest on.
  if (kind === 'bumps') {
    const form = makeRng(hashSeed(seed, 0xB0B));   // crews on form or off it, so bumps happen all down the river
    for (const b of boats) {
      b.x = (LANES - 1 - b.lane) * BUMP_GAP * BOAT_CLASSES[cls].length;
      b.z = targetZ(course, b);
      if (brains[b.lane]) brains[b.lane].cruise += ((form() * 5) | 0) - 2;
    }
  }
  // A ghost re-rows its own race unseen alongside this one (same field, same wash), so it matches its code exactly.
  let ghost = null, ghostRace = null;
  if (ghostInputs) {
    ghostRace = makeRace({ ...opts, ghostInputs: null, duel: false });
    ghost = ghostRace.player;
    ghost.crewName = 'Ghost';
    ghost.isGhost = true;
  }
  const race = {
    opts, course, boats, brains, ghost, ghostInputs, ghostRace,
    player: boats.find(b => b.lane === lane),
    player2: duel ? boats.find(b => b.lane === lane + 1) : null,
    tick: 0,
    t: -(4 + rng() * 2.5),        // seconds until the start (t0 remembers it, for the start-line camera)
    attentionAt: -(1.2 + rng() * 1.6),  // "Attention!" comes a varying time before the horn, so nobody can anticipate it
    started: false, inputs: [], done: false, falseStart: false, finishOrder: [],
    order: kind === 'bumps' ? boats.map(b => b.lane) : null,   // bumps: lanes from the head of the river down
  };
  race.t0 = race.t;
  return race;
}

// Rules versions: each one changes the physics, so a race keeps the rules it was rowed under forever.
//  1: the original physics.
//  2: wash from crews in the next lane (its reach was too short to matter; kept exactly for races rowed under it).
//  3: wash that reaches: felt as soon as you drift from your lane centre towards a faster crew just ahead.
//  4: bumps crews push when a bump is close (ahead or behind). Other kinds row exactly as under rules 3.
const RULES_LATEST = 4;
const WASH = { 2: { reach: 9.5, span: 2.5, drag: () => TUNE.washDrag }, 3: { reach: LANE_W - 0.5, span: 3, drag: () => TUNE.washDrag3 } };
WASH[4] = WASH[3];

// Wash: a faster crew just ahead in the next lane leaves rough water. Felt when the boats drift towards each
// other, so it rewards holding the middle of your lane. Computed for every boat before any moves.
function washFor(race, b, w) {
  let wash = 0;
  for (const o of race.boats) {
    if (o === b || Math.abs(o.lane - b.lane) !== 1 || o.v <= b.v) continue;
    const behind = o.x - BOAT_CLASSES[o.cls].length - b.x, side = Math.abs(o.z - b.z);
    if (behind > -2 && behind < 25 && side < w.reach) wash = Math.max(wash, clamp((w.reach - side) / w.span, 0, 1) * (1 - behind / 25));
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
  const w = WASH[race.opts.rules || 1], wash = w && race.course.kind === 'regatta' ? race.boats.map(b => washFor(race, b, w)) : null;
  for (let i = 0; i < race.boats.length; i++) {
    const b = race.boats[i];
    if (wash && wash[i] > 0) { b.v *= 1 - w.drag() * wash[i] * TUNE.dt; b.inWash = wash[i] } else b.inWash = 0;
    if (b.out) { pullOver(b, race.course, dt); continue }
    if (b.finishTime != null && b.x > race.course.distance + 40) { b.v *= 0.99; b.x += b.v * dt; continue }
    const input = b === race.player ? playerInput : b === race.player2 ? player2Input : botInput(race.brains[b.lane], b, race);
    stepBoat(b, b.finishTime != null ? packInput(0, 18) : input, race.course, race);
    if (b.finishTime != null && !race.finishOrder.includes(b)) race.finishOrder.push(b);
  }
  if (race.order) checkBumps(race);
  if (race.ghostRace) {
    const g = race.ghost, gi = race.ghostInputs;
    if (g.finishTime == null) stepRace(race.ghostRace, race.tick < gi.length ? gi[race.tick] : packInput(0, 18));
    else { g.v *= 0.99; g.x += g.v * dt }
    for (const b of race.ghostRace.boats) b.events.length = 0;
  }
  race.tick++;
  const p = race.player;
  const allIn = race.boats.every(b => b.finishTime != null || b.out);
  if (race.player2 && race.player2.finishTime == null && !race.player2.out && race.t < 1200) return;   // a duel ends when both humans are home
  const home = p.out ? p.out.t : p.finishTime;
  // A bumps race runs until every crew is home or out: the river's order isn't settled before then.
  if (home != null && (allIn || !race.order && race.t > home + (race.course.kind === 'head' ? 70 : 25))) race.done = true;
  if (race.t > 60 * 20) race.done = true;  // safety net
}

// Place: finished crews by time; the rest by distance (or, in a head race, by the time they're on course for).
function placeOf(race, boat) {
  if (race.order) return 1 + race.order.indexOf(boat.lane);
  const D = race.course.distance;
  const score = b => b.finishTime != null ? b.finishTime : race.course.kind === 'head'
    ? 1e6 + (b.x > 20 ? (race.t - b.startAt) * D / b.x : 1e5 + b.startAt) : 1e6 - b.x;
  const me = score(boat);
  return 1 + race.boats.filter(b => b !== boat && score(b) < me).length;
}

/* ----- bumps: catch the crew ahead before the crew behind catches you ----- */
const BUMP_GAP = 2.5;   // bow to bow, in boat lengths: a length and a half of clear water

const bumpRacing = b => !b.out && b.finishTime == null;
// The nearest crew ahead (or behind) in the starting line still racing; boats are listed in lane order.
const bumpAhead = (race, b) => race.boats.filter(o => o.lane < b.lane && bumpRacing(o)).pop();
const bumpBehind = (race, b) => race.boats.find(o => o.lane > b.lane && bumpRacing(o));
// Clear water between a chaser's bow and the stern ahead, in metres.
const bumpGap = (chaser, target) => target.x - BOAT_CLASSES[target.cls].length - chaser.x;

// Bots dig in when a bump is close: chasing within a length, or defending in the last half length.
function bumpPressure(race, b) {
  const t = bumpAhead(race, b), h = bumpBehind(race, b), len = BOAT_CLASSES[b.cls].length;
  return (t && bumpGap(b, t) < len) || (h && bumpGap(h, b) < len * 0.5);
}

// A bump: the chaser's bow reaches the stern of the nearest crew ahead still racing. Both pull over and swap places.
function checkBumps(race) {
  for (const c of race.boats) {
    if (!bumpRacing(c)) continue;
    const t = bumpAhead(race, c);
    if (!t || bumpGap(c, t) > 0) continue;
    c.out = { t: race.t, up: true, side: 9 };
    t.out = { t: race.t, up: false, side: -9 };
    const o = race.order, i = o.indexOf(c.lane), j = o.indexOf(t.lane);
    o[i] = t.lane; o[j] = c.lane;
    c.events.push({ type: 'bump', up: true, other: t });
    t.events.push({ type: 'bump', up: false, other: c });
  }
}

// A bumped (or bumping) crew stops rowing, drifts to a halt and moves over to let the others by.
function pullOver(b, course, dt) {
  b.v *= 1 - 0.8 * dt;
  b.x += b.v * dt;
  b.z += (riverZ(course, b.x) + b.out.side - b.z) * dt;
  b.yaw *= 1 - 2 * dt;
  b.rate = 18;
}

// Re-rows a race from its recorded inputs without drawing anything: used to verify codes and build ghosts.
function simulateRace(opts, inputs) {
  const race = makeRace({ ...opts, ghostInputs: null });
  for (let i = 0; i < inputs.length && !race.done; i++) stepRace(race, inputs[i]);
  return race;
}
