/* ===== TUNE: every constant that shapes how rowing feels =====
   The F8 panel edits these live. Races rowed with edited values are marked and never saved as records. */

const TUNE_DEFAULTS = Object.freeze({
  dt: 1 / 60,              // simulation step (s)
  driveSpeed: 1.3,         // slide lengths per second during the drive
  peakForce: 345,          // propulsive force at mid-drive for one sculler (N)
  drag: 3.0,               // hull drag coefficient per sculler (N per (m/s)²)
  mass: 100,               // boat + one sculler (kg)
  perfectWindow: 0.075,    // catch timing that counts as perfect (s either side)
  goodWindow: 0.17,        // catch timing that counts as good (s)
  cleanRelease: 0.88,      // slide position from which a release is clean
  crabTime: 0.32,          // holding the blade in past the finish this long catches a crab (s)
  swingGain: 0.18,         // swing earned by a perfect stroke
  swingBonus: 0.07,        // extra efficiency at full swing
  drain: 0.0093,           // energy used per second at rate 30, normal pressure
  regen: 0.011,            // energy recovered per second
  pushPower: 1.22,         // pressure while pushing (Shift)
  steerRate: 0.11,         // yaw rate from full steering on the drive (rad/s)
  steerCost: 0.9,          // propulsion kept while steering hard
  yawDamp: 0.9,            // how quickly the boat straightens on its own
  windDrag: 1.6,           // push from wind on the crew (N per (m/s)²)
  crossDrift: 0.02,        // sideways drift per m/s of crosswind
  washDrag: 0.22,          // speed lost per second sitting in a faster crew's wash (rules 2+)
  buoyLimit: 3.3,          // lateral distance from lane centre where the oars hit the buoys (m)
});
const TUNE = { ...TUNE_DEFAULTS };
const tuneEdited = () => Object.keys(TUNE).some(k => TUNE[k] !== TUNE_DEFAULTS[k]);
