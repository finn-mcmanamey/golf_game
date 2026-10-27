/* ===== courses: a seed becomes a venue with its own water, wind and banks =====
   x runs down the course from the start (0) to the finish line; z runs across the lanes; y is up. */

const LANE_W = 13.5;   // regatta lanes are 13.5 m wide
const LANES = 6;

// dragK grows as crew^0.79, so bigger boats are faster but not proportionally (precomputed: no Math.pow in the sim).
const BOAT_CLASSES = {
  '1x': { name: 'Single scull', crew: 1, length: 8.2, sculls: true, dragK: 1 },
  '2x': { name: 'Double scull', crew: 2, length: 10.2, sculls: true, dragK: 1.729 },
  '4x': { name: 'Quad scull', crew: 4, length: 13.4, sculls: true, dragK: 2.99 },
  '8+': { name: 'Eight', crew: 8, length: 17.6, sculls: false, cox: true, dragK: 5.6 },
};

const VENUE_A = ['Mill', 'Heron', 'Willow', 'Kingfisher', 'Silver', 'Otter', 'Alder', 'Swan', 'Cedar', 'Brook', 'Lantern', 'Copper'];
const VENUE_B = ['Lake', 'Reach', 'Water', 'Basin', 'Mere', 'Broad', 'River', 'Loch'];

const laneZ = lane => (lane - (LANES - 1) / 2) * LANE_W;

function makeCourse(seed, distance, kind = 'regatta') {
  const rng = makeRng(hashSeed(seed, 0xC0));
  // Wind: a strength and a direction, as along-course (tailwind +) and cross-course parts, without trigonometry.
  const windSpeed = rng() < 0.2 ? 0 : 0.5 + rng() * rng() * 5.5;
  const along = windSpeed * (rng() * 2 - 1);
  const cross = Math.sqrt(Math.max(0, windSpeed * windSpeed - along * along)) * (rng() < 0.5 ? -1 : 1);
  return {
    seed, distance,
    name: VENUE_A[(rng() * VENUE_A.length) | 0] + ' ' + VENUE_B[(rng() * VENUE_B.length) | 0],
    wind: { speed: windSpeed, along, cross },
    current: rng() < 0.6 ? 0 : (rng() - 0.35) * 0.4,
    timeOfDay: rng(),            // 0 dawn … 1 dusk, drawing only
    season: (rng() * 4) | 0,     // drawing only
    sceneSeed: hashSeed(seed, 0x5CE),
    rain: makeRng(hashSeed(seed, 0x2A1))() < 0.18,   // drawing only; its own stream so older values are unchanged
    kind, ...(kind === 'head' ? riverFor(seed, distance) : {}),
    // Indoors on rowing machines: still air, no stream (the draws above still happen, so seeds line up).
    ...(kind === 'erg' ? { wind: { speed: 0, along: 0, cross: 0 }, current: 0, rain: false, name: 'Indoor ' + VENUE_A[seed % VENUE_A.length] + ' Arena' } : {}),
  };
}

/* ----- head races: a winding river instead of a straight lake -----
   The river's centre line is a smooth curve through seeded offsets every RIVER_STEP metres
   (Catmull-Rom: plain arithmetic, so every machine agrees). Regatta courses have no bends. */
const RIVER_STEP = 180, RIVER_X0 = -540;

function riverFor(seed, distance) {
  const rng = makeRng(hashSeed(seed, 0x417)), bends = [];
  let z = 0;
  for (let x = RIVER_X0; x < distance + 900; x += RIVER_STEP) {
    bends.push(x < 60 ? 0 : z);
    // Straight water at the start and the finish, bends in between.
    const step = (rng() * 2 - 1) * 55;
    if (x >= 60 && x < distance - 400) z = clamp(z + step, -90, 90);
  }
  return { bends, halfW: 30 };
}

function riverZ(course, x) {
  const b = course.bends;
  if (!b) return 0;
  const f = (x - RIVER_X0) / RIVER_STEP, i = clamp(Math.floor(f), 1, b.length - 3), t = clamp(f - i, 0, 1);
  const p0 = b[i - 1], p1 = b[i], p2 = b[i + 1], p3 = b[i + 2];
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
}

// The river's direction at x, as sideways metres per metre downstream.
function riverSlope(course, x) {
  const b = course.bends;
  if (!b) return 0;
  const f = (x - RIVER_X0) / RIVER_STEP, i = clamp(Math.floor(f), 1, b.length - 3), t = clamp(f - i, 0, 1);
  const p0 = b[i - 1], p1 = b[i], p2 = b[i + 1], p3 = b[i + 2];
  return 0.5 * ((p2 - p0) + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t + 3 * (3 * p1 - p0 - 3 * p2 + p3) * t * t) / RIVER_STEP;
}

// Where a crew wants to be: its lane centre on a regatta course, its own line down the river in a head race.
const targetZ = (course, b, ahead = 0) => course.bends ? riverZ(course, b.x + ahead) + (b.lane - 2.5) * 3.5 : laneZ(b.lane);

// How far a boat is off its line, looking a little ahead: positive means steer left.
function steerError(course, b) {
  return course.bends ? (b.z - targetZ(course, b, 12)) + (b.yaw - riverSlope(course, b.x + 10)) * 10 : (b.z - laneZ(b.lane)) + b.yaw * 10;
}

function windLabel(w) {
  if (w.speed < 0.4) return 'Calm';
  const a = Math.abs(w.along) > Math.abs(w.cross) ? (w.along > 0 ? 'tail' : 'head') : 'cross';
  const strength = w.speed < 2 ? 'Light' : w.speed < 4 ? 'Fresh' : 'Strong';
  return `${strength} ${a}wind ${w.speed.toFixed(1)} m/s`;
}
