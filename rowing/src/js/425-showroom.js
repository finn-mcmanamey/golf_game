/* ===== the showroom: your boat in the boathouse, in your colours, with your medals on the wall =====
   While the Boathouse screen is open, the 3D view switches to this little scene. */

const showroom = { on: false, race: null, angle: 0, cls: '1x' };

function openShowroom() {
  const boat = makeBoat(showroom.cls, 2, crew.club);
  boat.isShowroom = true;
  boat.x = BOAT_CLASSES[showroom.cls].length / 2;   // centred on the slip
  boat.z = 0;
  boat.phase = 'drive';
  showroom.race = { boats: [boat], player: boat, ghost: null, course: { kind: 'showroom', distance: 100, wind: { speed: 0.6, along: 0.4, cross: 0.4 }, sceneSeed: 7, timeOfDay: 0.5, season: 1 } };
  if (gl) setScene(showroom.race.course, showroom.cls);
  showroom.on = true;
}

function closeShowroom() {
  showroom.on = false;
  if (gl && race) setScene(race.course, race.opts.cls);
}

// The crew rows on the spot, so you can see blades and kit move.
function animateShowroom(dt, time) {
  const b = showroom.race.player, cycle = (time * 0.5) % 1;
  b.phase = cycle < 0.4 ? 'drive' : 'recover';
  b.h = cycle < 0.4 ? cycle / 0.4 : 1 - (cycle - 0.4) / 0.6;
  b.recSpeed = 1;
  // Swing gently in front of the boat with the medal wall behind it; aim right of the boat so it sits clear of the panel.
  showroom.angle += dt * 0.25;
  const a = Math.sin(showroom.angle) * 0.6, r = 12;
  cam.eye = [Math.sin(a) * r, 3.6, Math.cos(a) * r];
  const shift = innerWidth > 760 ? 4.5 : 0, right = [Math.cos(a), 0, -Math.sin(a)];
  cam.at = [right[0] * shift, 1.6, right[2] * shift - 1];
  cam.fov = 0.85;
}

// A boathouse interior: a strip of water between wooden pontoons, racks of boats and the medal wall.
function buildShowroom() {
  const mb = new ChunkedMesh(), L = lightingFor({ timeOfDay: 0.5, season: 1, sceneSeed: 7 });
  Object.assign(L, { sun: norm3([0.3, 1, 0.5]), sunCol: [1, 0.95, 0.85], sky: [0.55, 0.5, 0.45], horizon: [0.2, 0.17, 0.14], ground: [0.35, 0.28, 0.2], cloud: 0, stars: 0, deep: [0.04, 0.1, 0.12], bank: [0.2, 0.15, 0.1] });
  const wood = hex(0x9a6a3c), dark = hex(0x4a3422), white = [0.95, 0.95, 0.92];
  for (const s of [-1, 1]) for (let x = -14; x < 14; x += 1.2) mb.box(x, 0.2, s * 6, 1.15, 0.3, 6, shade(wood, 0.9 + ((x * 5) & 1) * 0.1));
  mb.box(0, 5, -9, 30, 10, 0.4, dark);
  mb.box(-14, 5, 0, 0.4, 10, 18, dark); mb.box(14, 5, 0, 0.4, 10, 18, dark);
  mb.box(0, 10, 0, 30, 0.4, 18, shade(dark, 0.8));
  for (let x = -12; x <= 12; x += 6) mb.box(x, 9.6, 0, 0.4, 0.4, 18, shade(dark, 0.6));
  // Racks of spare boats on the side walls.
  for (const s of [-1, 1]) for (let y = 2; y < 8; y += 2) {
    mb.box(s * 13.2, y, -4, 0.8, 0.2, 0.2, white); mb.box(s * 13.2, y, 4, 0.8, 0.2, 0.2, white);
    mb.box(s * 12.9, y + 0.3, 0, 0.35, 0.25, 11, hex([0xf4f1e8, 0xf2c230, 0x2b2f38][(y / 2 + (s > 0)) % 3]));
  }
  // Light strips.
  for (let x = -10; x <= 10; x += 10) mb.box(x, 9.7, 0, 4, 0.1, 0.5, [2.5, 2.4, 2.2]);
  return { mb, L };
}

// Medals and cups on the back wall: one disc per season medal, one cup per Voxel Cup win.
function drawMedalWall(mb, time) {
  const medals = career?.medals || [], cols = { 1: [1.6, 1.3, 0.3], 2: [1.2, 1.25, 1.35], 3: [1.1, 0.6, 0.3] };
  medals.slice(-16).forEach((m, i) => {
    const x = -9 + (i % 8) * 2.5, y = 7 - Math.floor(i / 8) * 2.2;
    mb.box(x, y + 0.6, -8.7, 0.12, 0.9, 0.05, hex([0xd8352a, 0x2a5db0, 0x3aa35a][i % 3]));
    mb.box(x, y, -8.6, 0.6, 0.6, 0.12, cols[m.place]);
  });
  for (let i = 0; i < Math.min(5, STORE.get('cupWins', 0)); i++) {
    const x = 6 + i * 1.6, gold = [1.6, 1.3, 0.3];
    mb.box(x, 2.6, -8.3, 1.2, 0.2, 0.6, shade(dark3, 1));
    mb.box(x, 3.1, -8.3, 0.25, 0.8, 0.25, gold);
    mb.box(x, 3.8, -8.3, 0.8, 0.7, 0.5, gold);
  }
}
const dark3 = [0.25, 0.2, 0.16];
