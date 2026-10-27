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

function makeCourse(seed, distance) {
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
  };
}

function windLabel(w) {
  if (w.speed < 0.4) return 'Calm';
  const a = Math.abs(w.along) > Math.abs(w.cross) ? (w.along > 0 ? 'tail' : 'head') : 'cross';
  const strength = w.speed < 2 ? 'Light' : w.speed < 4 ? 'Fresh' : 'Strong';
  return `${strength} ${a}wind ${w.speed.toFixed(1)} m/s`;
}
