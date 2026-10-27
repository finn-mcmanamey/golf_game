/* ===== the indoor arena for erg races: a sports hall, six rowing machines and a big screen ===== */

const ergZ = lane => (lane - (LANES - 1) / 2) * 2.6;

function buildHall(course) {
  const mb = new ChunkedMesh(), L = lightingFor({ ...course, timeOfDay: 0.5 });
  Object.assign(L, { sun: norm3([0.2, 1, 0.35]), sunCol: [0.95, 0.92, 0.85], sky: [0.62, 0.62, 0.66], ground: [0.42, 0.36, 0.3], horizon: [0.2, 0.22, 0.26], cloud: 0, stars: 0 });
  const wood = hex(0xc8955a), wall = hex(0x3b4a63), line = hex(0xe8e2d0);
  // Floor planks, walls and ceiling.
  for (let x = -22; x < 22; x += 2) mb.box(x + 1, -0.05, 1, 1.96, 0.1, 30, shade(wood, 0.92 + ((x / 2) & 1) * 0.08));
  mb.box(0, 0.003, 1, 44, 0.004, 0.08, line);
  mb.box(0, 6, -14, 44, 12, 0.4, wall);
  mb.box(0, 6, 16, 44, 12, 0.4, wall);
  mb.box(-22, 6, 1, 0.4, 12, 30, shade(wall, 0.9));
  mb.box(22, 6, 1, 0.4, 12, 30, shade(wall, 0.9));
  mb.box(0, 12, 1, 44, 0.4, 30, hex(0x2a3344));
  for (let x = -18; x <= 18; x += 6) for (let z = -8; z <= 10; z += 6) mb.box(x, 11.7, z, 3, 0.15, 0.6, [2.2, 2.2, 2]);   // lights
  // The big screen frame on the back wall; its race bars are drawn live in the effects pass.
  mb.box(0, 6.2, -13.7, 16.6, 6.6, 0.2, hex(0x111418));
  mb.box(0, 2.5, -13.6, 0.6, 1.2, 0.3, hex(0x111418));
  // Banners and a few spectators along the end wall.
  const banner = [0xd8352a, 0xffd23a, 0x2a5db0, 0x3aa35a];
  for (let i = 0; i < 8; i++) mb.box(-17.5 + i * 5, 10, -13.7, 3.2, 1.2, 0.1, hex(banner[i % 4]));
  const rng = makeRng(course.sceneSeed);
  for (let z = -10; z < 12; z += 1.1) for (let row = 0; row < 3; row++) {
    if (rng() < 0.3) continue;
    const x = -18 - row * 1.2, y = row * 0.5;
    mb.box(x, y + 0.5, z, 0.5, 0.9, 0.6, hex(SHIRTS[(rng() * SHIRTS.length) | 0]));
    mb.box(x, y + 1.15, z, 0.35, 0.35, 0.35, hex(rng() < 0.5 ? 0xe0b590 : 0x8d5a3a));
  }
  return { mb, L };
}

const SHIRTS = [0xd8352a, 0x2a5db0, 0xf2c230, 0xffffff, 0x3aa35a, 0xe07ab0, 0x222222, 0xff8a2a];

// A rowing machine and its rower: rail, flywheel, monitor, and the handle on its chain.
function drawErg(mb, boat, time) {
  const q = pose(boat), z = ergZ(boat.lane), lift = 0.18, col = coloursFor(boat);
  const P = (u, y, w) => [u, y + lift, z + w];
  const piece = (a, b, w, h, colour) => mb.beam(P(...a), P(...b), w, h, colour);
  const dark = [0.12, 0.13, 0.15], metal = [0.6, 0.62, 0.66];
  piece([-1.25, 0.05, 0], [1.3, 0.05, 0], 0.14, 0.08, dark);              // rail
  mb.box(-1.35, 0.3 + lift, z, 0.55, 0.75, 0.5, dark);                    // flywheel housing
  mb.box(-1.55, 0.05, z, 0.3, 0.1, 0.6, dark);
  piece([-1.15, 0.6, 0], [-0.95, 1.15, 0], 0.04, 0.04, metal);            // monitor arm
  mb.box(-0.92, 1.2 + lift, z, 0.08, 0.2, 0.26, [0.15, 0.6, 0.9]);
  const theta = lerp(1.0, -0.72, q.h), handleU = -0.88 * Math.sin(theta), handle = [handleU, 0.42, 0];
  piece([-1.1, 0.42, 0], handle, 0.02, 0.02, metal);                      // chain
  piece(add3(handle, [0, 0, -0.25]), add3(handle, [0, 0, 0.25]), 0.05, 0.05, dark);
  drawRower(mb, P, piece, 0, smooth(0, 0.62, q.h), smooth(0.25, 0.85, q.h), [handle], false, hex(col.shirt), hex(SKIN[boat.lane % SKIN.length]), hex(0x1d2330));
}

// The big screen: one bar per competitor, the virtual boats racing to the line.
function drawErgScreen(mb, race) {
  const D = race.course.distance, w = 15.4;
  race.boats.forEach((b, i) => {
    const y = 8.6 - i * 0.95, p = clamp(b.x / D, 0, 1), c = hex(coloursFor(b).shirt);
    mb.box(-w / 2 + 0.2 + p * (w - 0.4) / 2, y, -13.55, Math.max(0.05, p * (w - 0.4)), 0.55, 0.02, shade(c, 0.7));
    mb.box(-w / 2 + 0.2 + p * (w - 0.4), y, -13.5, 0.5, 0.65, 0.04, shade(c, 1.6));
  });
  mb.box(w / 2 - 0.1, 6.2, -13.5, 0.06, 6.2, 0.04, [2, 2, 2]);   // finish line on the screen
  const px = paceX(race);
  if (px != null) mb.box(-w / 2 + 0.2 + clamp(px / D, 0, 1) * (w - 0.4), 6.2, -13.45, 0.08, 6.2, 0.04, [0.4, 2.2, 2.6]);   // the pace line
}

function ergCamera(boat, mode) {
  const z = ergZ(boat.lane);
  switch (mode) {
    case 'chase': return { eye: [3.2, 2.4, z + 0.6], at: [-1.5, 0.8, z], fov: 0.9 };
    case 'aerial': return { eye: [6, 9, 8], at: [-1, 0, 0], fov: 1.0 };
    case 'rower': return { eye: [0.3, 1.45, z], at: [-6, 1.0, z], fov: 1.1 };
    default: return { eye: [5.5, 4.2, 12], at: [-1.2, 1.6, -2.5], fov: 0.95 };   // the whole row of machines and the screen
  }
}
