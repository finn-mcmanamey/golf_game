/* ===== stream flecks: foam drifting with a head race's stream, fast mid-river and slow by the banks (F-109) =====
   Drawing only. The drift is exaggerated so the difference reads at a glance; it shows where the kind water is. */

const flecks = [];
const FLECK_DRIFT = 6;   // drawn drift is this many times the real stream, so the eye can see it

function drawStreamFlecks(mb, dt, course) {
  if (course.kind !== 'head' || !course.current || !(race?.opts.rules >= 5)) return;
  if (flecks.course !== course) {
    flecks.length = 0; flecks.course = course;
    const rng = makeRng(course.sceneSeed ^ 0xF1E);
    for (let i = 0; i < 140; i++) flecks.push({ x: cam.at[0] + rng() * 160 - 60, off: (rng() * 2 - 1) * 0.92 });
  }
  const foam = [1.15, 1.15, 1.12], x0 = cam.at[0];
  for (const f of flecks) {
    const speed = course.current * (TUNE.streamMid - TUNE.streamDrop * f.off * f.off) * FLECK_DRIFT;
    f.x += speed * dt;   // in the world, so they move with the water, not the camera
    // Flecks live in a window around the camera, wrapping so the river always has some.
    if (f.x - x0 > 100) f.x -= 160; else if (f.x - x0 < -60) f.x += 160;
    const x = f.x, z = riverZ(course, x) + f.off * course.halfW;
    mb.box(x, 0.03, z, 0.5, 0.02, 0.18, foam);
  }
}

/* ----- how much your line gained from the stream, for the results (read-only) ----- */
const streamLine = { race: null, metres: 0 };

// Each step: the extra metres the stream carried you on your line, against rowing mid-river.
function recordStreamLine(race) {
  const p = race.player, c = race.course;
  if (c.kind !== 'head' || !c.current || !(race.opts.rules >= 5) || !race.started || p.finishTime != null) return;
  if (streamLine.race !== race) Object.assign(streamLine, { race, metres: 0 });
  streamLine.metres += (streamAt(c, p, race) - c.current * TUNE.streamMid) * TUNE.dt;
}

// "line gained 0.8 s vs mid-river", or nothing when the stream played no part.
function streamLineNote(race) {
  if (streamLine.race !== race || Math.abs(streamLine.metres) < 0.5) return '';
  const secs = streamLine.metres / Math.max(1, race.course.distance / race.player.finishTime);
  return ` · stream: your line ${secs > 0 ? 'gained' : 'lost'} ${Math.abs(secs).toFixed(1)} s vs mid-river`;
}
