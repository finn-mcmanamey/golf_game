/* ===== stroke and boat physics =====
   One stroke: press to catch, hold to drive the handle from the catch (h = 0) to the finish (h = 1),
   release to recover. The slide comes back on its own at the speed the chosen stroke rate needs; catching
   just as it arrives is a perfect catch. Perfect strokes build "swing": the boat runs more freely. */

// Input for one tick, packed into one small integer so races can be recorded and replayed.
const IN = { DRIVE: 1, LEFT: 2, RIGHT: 4, PUSH: 8 };
const RATE_MIN = 16, RATE_MAX = 46;
const packInput = (bits, rate) => bits | (clamp(rate, RATE_MIN, RATE_MAX) - RATE_MIN) << 4;
const inputRate = v => (v >> 4) + RATE_MIN;

function makeBoat(cls, lane, crewName) {
  const c = BOAT_CLASSES[cls];
  return {
    cls, lane, crewName, crew: c.crew,
    x: 0, z: laneZ(lane), yaw: 0, v: 0,
    h: 0, phase: 'front', phaseT: 0, held: false,
    rate: 24, energy: 1, swing: 0, strokes: 0, strokeQ: 0, quality: [],
    lastBits: 0, finishTime: null, events: [], steerOut: 0, splash: 0,
    stats: { perfect: 0, good: 0, off: 0, crabs: 0, buoys: 0 },
  };
}

// Seconds the slide takes to come forward at a given stroke rate, after a nominal drive.
const recoveryTime = rate => Math.max(0.45, 60 / rate - 1 / TUNE.driveSpeed);

function gradeCatch(b, timingError) {
  const e = Math.abs(timingError);
  const grade = e <= TUNE.perfectWindow ? 'perfect' : e <= TUNE.goodWindow ? 'good' : timingError < 0 ? 'early' : 'late';
  b.catchEff = grade === 'perfect' ? 1 : grade === 'good' ? 0.96 : 0.86;
  b.catchGrade = grade;
  b.events.push({ type: 'catch', grade, error: timingError });
}

function endStroke(b, releaseGrade) {
  const clean = b.catchGrade === 'perfect' && releaseGrade === 'clean';
  const ok = (b.catchGrade === 'perfect' || b.catchGrade === 'good') && releaseGrade !== 'crab';
  b.swing = clean ? Math.min(1, b.swing + TUNE.swingGain) : ok ? Math.min(1, b.swing + TUNE.swingGain * 0.35) : Math.max(0, b.swing - 0.4);
  if (b.catchGrade === 'perfect') b.stats.perfect++; else if (b.catchGrade === 'good') b.stats.good++; else b.stats.off++;
  b.strokes++;
  b.events.push({ type: 'release', grade: releaseGrade, swing: b.swing });
}

function startRecovery(b) {
  b.phase = 'recover';
  b.phaseT = 0;
  b.recSpeed = 1 / recoveryTime(b.rate);
}

// Advances one boat by one tick. `input` is a packed integer; `course` supplies wind and current.
function stepBoat(b, input, course, race) {
  const dt = TUNE.dt, cls = BOAT_CLASSES[b.cls], n = b.crew;
  const drive = (input & IN.DRIVE) !== 0, push = (input & IN.PUSH) !== 0;
  const steer = ((input & IN.RIGHT) ? 1 : 0) - ((input & IN.LEFT) ? 1 : 0);
  b.rate = inputRate(input);
  b.phaseT += dt;
  let force = 0;

  // Energy fades the pressure a tired crew can put on.
  const fatigue = b.energy < 0.22 ? 0.45 + 2.5 * b.energy : 1;
  const pressure = (push && b.energy > 0.02 ? TUNE.pushPower : 1) * fatigue;

  if (b.phase === 'crab') {
    if (b.phaseT > 1.1) startRecovery(b);
  } else if (b.phase === 'drive') {
    if (!drive) {
      endStroke(b, b.h >= TUNE.cleanRelease ? 'clean' : 'short');
      startRecovery(b);
    } else if (b.h < 1) {
      const h0 = b.h;
      b.h = Math.min(1, b.h + TUNE.driveSpeed * (push ? 1.08 : 1) * dt);
      const hm = (h0 + b.h) / 2, curve = 6 * hm * (1 - hm); // averages 1 over the drive
      const steerK = steer !== 0 ? TUNE.steerCost : 1;
      force = TUNE.peakForce * (2 / 3) * curve * n * pressure * b.catchEff * (1 + TUNE.swingBonus * b.swing) * steerK;
    } else if (b.phaseT > 0 && (b.overT = (b.overT || 0) + dt) > TUNE.crabTime) {
      // Blade left in the water past the finish: it digs in and stops the boat.
      b.v *= 0.45;
      b.swing = 0;
      b.stats.crabs++;
      b.strokes++;
      b.phase = 'crab';
      b.phaseT = 0;
      b.events.push({ type: 'release', grade: 'crab', swing: 0 });
    }
  } else if (b.phase === 'recover' || b.phase === 'front') {
    if (b.phase === 'recover') {
      b.h = Math.max(0, b.h - b.recSpeed * dt);
      if (b.h === 0) { b.phase = 'front'; b.phaseT = 0 }
    }
    const pressed = drive && !(b.lastBits & IN.DRIVE);
    if (pressed && race.started) {
      // Timing error: negative means the catch came before the slide reached the front.
      const err = b.phase === 'recover' ? -b.h / b.recSpeed : b.phaseT;
      gradeCatch(b, b.strokes === 0 ? 0 : err);
      b.phase = 'drive';
      b.phaseT = 0;
      b.overT = 0;
      b.splash = 1;
    }
  }
  b.lastBits = input & 15;

  // Energy: harder and faster costs more; easy paddling recovers.
  const working = b.phase !== 'front' || b.phaseT < 0.6;
  const r = b.rate / 30;
  b.energy = clamp(b.energy - dt * ((working ? TUNE.drain * r * r * r * pressure * pressure : 0) - TUNE.regen), 0, 1);

  // Boat speed: crew force against water drag, plus wind on the crew and riggers.
  const drag = TUNE.drag * cls.dragK * b.v * Math.abs(b.v);
  const air = course.wind.along - b.v;
  const wind = TUNE.windDrag * Math.sqrt(n) * air * Math.abs(air) * 0.25;
  const mass = TUNE.mass * n + 15 * n;
  b.v += (force - drag + wind) / mass * dt;
  if (b.v < 0) b.v *= 0.98;

  // Steering: pulling harder on one side turns the boat, mostly while the blades are in.
  const grip = b.phase === 'drive' ? 1 : 0.25;
  b.steerOut = steer;
  b.yaw += (steer * TUNE.steerRate * grip * Math.min(1, b.v / 3) / Math.sqrt(n) + course.wind.cross * 0.0012 - b.yaw * TUNE.yawDamp * 0.05) * dt;
  b.yaw = clamp(b.yaw, -0.25, 0.25);
  const prevX = b.x;
  b.x += (b.v + course.current) * dt;
  b.z += (b.v * b.yaw + course.wind.cross * TUNE.crossDrift) * dt;

  // Oars clipping the lane buoys slow the boat and nudge it back.
  const off = b.z - laneZ(b.lane);
  if (Math.abs(off) > TUNE.buoyLimit) {
    b.v *= 1 - 1.4 * dt;
    b.yaw -= Math.sign(off) * 0.25 * dt;
    b.z = laneZ(b.lane) + Math.sign(off) * Math.min(Math.abs(off), TUNE.buoyLimit + 0.6);
    if (!b.onBuoys) { b.stats.buoys++; b.events.push({ type: 'buoy' }) }
    b.onBuoys = true;
  } else b.onBuoys = false;

  if (b.finishTime == null && b.x >= course.distance) {
    b.finishTime = race.t - dt + (course.distance - prevX) / (b.x - prevX) * dt;
    b.events.push({ type: 'finish', time: b.finishTime });
  }
  if (b.splash > 0) b.splash = Math.max(0, b.splash - dt * 3);
}
