/* ===== smooth motion: boats drawn between simulation ticks =====
   The race steps at a fixed 60 Hz; screens may refresh at 90 or 120 Hz. Drawing blends the last two ticks,
   so motion stays smooth without the simulation ever depending on the frame rate. */

const lastTick = new WeakMap();
const frameBlend = { alpha: 1 };

// Called just before each simulation step: remembers where every boat was.
function rememberPoses(boats) {
  for (const b of boats) if (b) lastTick.set(b, { x: b.x, z: b.z, yaw: b.yaw, h: b.h, phase: b.phase });
}

function pose(b) {
  const p = lastTick.get(b), a = frameBlend.alpha;
  // Blending the handle across a catch or release would show it sliding the wrong way, so phases snap.
  if (!p) return { x: b.x, z: b.z, yaw: b.yaw, h: b.h };
  return { x: lerp(p.x, b.x, a), z: lerp(p.z, b.z, a), yaw: lerp(p.yaw, b.yaw, a), h: p.phase === b.phase ? lerp(p.h, b.h, a) : b.h };
}
