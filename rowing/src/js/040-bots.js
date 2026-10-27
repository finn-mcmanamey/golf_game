/* ===== bot crews: they row with the same physics and the same inputs a player has =====
   Each bot draws its timing errors from its own seeded stream, so a race replays identically. */

const DIFFICULTY = {
  club:     { label: 'Club',     sd: 0.10, cruise: 28, start: 38, sprint: 34, push: 0.4, slack: 0.05, crewSd: 0.05 },
  national: { label: 'National', sd: 0.065, cruise: 31, start: 41, sprint: 37, push: 0.6, slack: 0.03, crewSd: 0.035 },
  olympic:  { label: 'Olympic',  sd: 0.04, cruise: 33, start: 43, sprint: 40, push: 0.85, slack: 0.015, crewSd: 0.022 },
};

// Race plans give each crew a personality: flyers go out hard, sprinters save it for the end.
const PLANS = [
  { name: 'steady', startStrokes: 8, cruiseAdj: 0, sprintAt: 0.22 },
  { name: 'flyer', startStrokes: 16, cruiseAdj: 1, sprintAt: 0.15 },
  { name: 'sprinter', startStrokes: 6, cruiseAdj: -1, sprintAt: 0.32 },
];

const CREW_NAMES = ['Leander', 'Tideway', 'Northbank', 'Heron RC', 'Isis', 'Kingston', 'Mortlake', 'Thames', 'Tyrian', 'Clydesdale',
  'Quintin', 'Molesey', 'Agecroft', 'Nottingham', 'Durham', 'Vesta', 'Furnivall', 'Marlow', 'Henley', 'Walton'];

function makeBrain(seed, lane, difficulty) {
  const rng = makeRng(hashSeed(seed, lane, 0xB07));
  const d = DIFFICULTY[difficulty];
  return {
    rng, d,
    plan: PLANS[(rng() * PLANS.length) | 0],
    cruise: d.cruise + ((rng() * 3) | 0) - 1,
    plannedErr: null, releaseAt: 0.95, lastStrokes: -1,
  };
}

// Net energy used per second at a rate (same formula as the physics, at normal pressure).
const energyUse = rate => { const r = rate / 30; return TUNE.drain * r * r * r - TUNE.regen };

function botRate(br, b, course) {
  const left = 1 - b.x / course.distance;
  if (b.strokes < br.plan.startStrokes) return br.d.start;
  let rate = br.cruise + br.plan.cruiseAdj;
  if (left < br.plan.sprintAt) rate = Math.max(rate, br.d.sprint + (left < 0.08 ? 2 : 0));
  // Pace: drop the rate until the energy left lasts to the line, keeping a small reserve.
  const timeLeft = left * course.distance / Math.max(b.v, 3);
  while (rate > br.cruise - 6 && energyUse(rate) * timeLeft > b.energy - 0.04) rate--;
  return rate;
}

function botInput(br, b, race) {
  const rate = botRate(br, b, race.course);
  if (race.t < b.startAt) return packInput(0, rate);
  let bits = 0;
  // Choose this stroke's timing error and release point once per stroke.
  if (br.lastStrokes !== b.strokes) {
    br.lastStrokes = b.strokes;
    br.plannedErr = gauss(br.rng, br.d.sd);
    br.releaseAt = br.rng() < br.d.slack ? 1.15 : 0.9 + br.rng() * 0.1;
  }
  if (b.phase === 'drive') {
    const over = b.h >= 1 ? (b.overT || 0) : 0;
    if (b.h < br.releaseAt && !(b.h >= 1 && over > (br.releaseAt - 1) * 2)) bits |= IN.DRIVE;
  } else if (b.phase === 'recover' || b.phase === 'front') {
    const toFront = b.phase === 'recover' ? b.h / b.recSpeed : -b.phaseT;
    // A catch needs a fresh press, so only press once the last drive has been let go.
    if (!(b.lastBits & IN.DRIVE) && (b.strokes === 0 || -toFront >= br.plannedErr)) bits |= IN.DRIVE;
  }
  // Steer back towards the lane centre, looking a little ahead.
  const err = steerError(race.course, b);
  if (err > 0.5) bits |= IN.LEFT; else if (err < -0.5) bits |= IN.RIGHT;
  const left = 1 - b.x / race.course.distance;
  if (left < br.plan.sprintAt * 0.6 && b.energy > 0.12 && br.rng() < br.d.push) bits |= IN.PUSH;
  return packInput(bits, rate);
}
