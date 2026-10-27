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
