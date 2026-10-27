/* ===== the venue: banks, trees, buoys, start and finish, built once per course ===== */

const BANK_Z = 3 * LANE_W + 14;   // where the water meets the grass on each side of a regatta lake

// The scene being built: how wide the water is and where its centre line runs (it bends on a river).
const SC = { bank: BANK_Z, rz: () => 0 };

// Value noise for scenery shapes (drawing only, so ordinary Math is fine here).
function makeNoise2(seed) {
  const h = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 0.013) * 43758.5453; return s - Math.floor(s) };
  const n = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(h(ix, iy), h(ix + 1, iy), u), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), u), v);
  };
  return (x, y) => n(x, y) * 0.6 + n(x * 2.1, y * 2.1) * 0.3 + n(x * 4.3, y * 4.3) * 0.1;
}

// An evening regatta: moonlight, a deep blue sky with stars, and floodlights along the banks.
const NIGHT = { sun: norm3([0.3, 0.6, 0.5]), sunCol: [0.6, 0.66, 0.85], sky: [0.08, 0.12, 0.26], horizon: [0.12, 0.16, 0.3],
  ground: [0.2, 0.2, 0.24], deep: [0.03, 0.05, 0.1], cloud: 0.15, stars: 1 };

// Light and colour for a time of day: 0 is dawn, 0.5 midday, 1 dusk.
function lightingFor(course) {
  const t = course.timeOfDay, high = Math.sin(Math.PI * t);
  const elev = 0.12 + 0.8 * high, az = lerp(-1.1, 1.1, t);
  const warm = 1 - smooth(0.25, 0.7, high);
  const sun = norm3([Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev)]);
  const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const season = [[0x6fae4a, 0x8fc65a], [0x5e9e3c, 0x79b649], [0x9a9a3c, 0xc08a3a], [0x8a9a7a, 0xb8c0b0]][course.season];
  return {
    sun,
    sunCol: mix3([1.0, 0.97, 0.9], [1.0, 0.62, 0.35], warm),
    sky: mix3([0.32, 0.55, 0.86], [0.38, 0.42, 0.66], warm),
    horizon: mix3([0.74, 0.84, 0.92], [0.98, 0.72, 0.55], warm),
    ground: mix3([0.36, 0.4, 0.3], [0.36, 0.3, 0.28], warm),
    deep: mix3([0.08, 0.2, 0.26], [0.1, 0.13, 0.2], warm),
    bank: shade(hex(season[0]), 0.45),
    grass: season.map(hex),
    cloud: 0.25 + ((course.sceneSeed % 100) / 100) * 0.5,
    ...(course.night && !course.rain ? NIGHT : {}),
  };
}

// 3×5 block letters for gantries and distance boards.
const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  S: '111100111001111', T: '111010010010010', A: '010101111101101', R: '110101110101101', F: '111100110100100',
  I: '111010010010111', N: '101111111111101', H: '101101111101101', M: '101111111101101', ' ': '000000000000000',
};

// Writes text as blocks on a plane facing ±z, starting at (x, y), each block `s` metres.
function voxelText(mb, text, x, y, z, s, col, facing = 1) {
  let cx = x - (text.length * 4 - 1) * s / 2 * facing;
  for (const ch of text) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
      if (g[r * 3 + c] === '1') mb.box(cx + (c + 0.5) * s * facing, y + (4.5 - r) * s, z, s * 0.92, s * 0.92, s * 0.5, col);
    cx += 4 * s * facing;
  }
}

function buildScene(course, cls) {
  if (course.kind === 'erg') return buildHall(course);
  if (course.kind === 'showroom') return buildShowroom();
  const mb = new ChunkedMesh();
  SC.bank = course.bends ? course.halfW + 1 : BANK_Z;
  SC.rz = x => riverZ(course, x);
  const BANK = SC.bank, rz = SC.rz;
  const L = lightingFor(course), rng = makeRng(course.sceneSeed), noise = makeNoise2(course.sceneSeed % 1000);
  const x0 = -260, x1 = course.distance + 380, bankDepth = 156;

  // Banks: voxel columns that rise gently away from the water into hills.
  const heightAt = (x, az) => {
    const away = az - BANK;
    if (away < 0) return -1;
    if (coast) return away < 42 ? Math.round((0.3 + away * 0.03) * 2) / 2 : Math.round((5 + noise(x * 0.02, az * 0.02) * 9 + smooth(42, 140, away) * 10) * 2) / 2;   // beach, then low cliffs rising inland
    const hills = noise(x * 0.012, az * 0.012) * 26 * smooth(10, 120, away);
    return Math.round((0.5 + away * 0.03 + hills) * 2) / 2;
  };
  // Fine 6 m blocks near the water where the camera looks closely; 12 m blocks further back.
  const rows = [];
  for (let az = BANK; az < BANK + bankDepth;) { const size = az < BANK + 48 ? 6 : 12; rows.push({ az, size }); az += size }
  // On the coast the near side (towards the TV camera) is open sea: no land there at all.
  const coast = course.theme === 'coast', landSides = coast ? [-1] : [-1, 1];
  for (const side of landSides) rows.forEach(({ az, size }, i) => {
    for (let x = x0; x < x1; x += size) {
      const hgt = heightAt(x, az), ra = rz(x), rb = rz(x + size);   // the strip follows the river's bends
      const g = noise(x * 0.05 + 7, az * 0.05);
      const sand = i === 0 || coast && az < BANK + 42, rock = false;
      const col = sand ? shade(hex(0xd9c79a), 0.9 + g * 0.2) : rock ? shade(hex(0x8a8478), 0.85 + g * 0.3) : shade(g > 0.5 ? L.grass[1] : L.grass[0], 0.85 + g * 0.3);
      const xa = x, xb = x + size, near = side * az, far = side * (az + size);
      const za = Math.min(near, far), zb = Math.max(near, far);
      mb.quad([xa, hgt, za + ra], [xa, hgt, zb + ra], [xb, hgt, zb + rb], [xb, hgt, za + rb], [0, 1, 0], col);
      const sideCol = i === 0 ? shade(hex(0x7a6448), 0.9 + g * 0.2) : coast ? shade(hex(0xb0a690), 0.85 + g * 0.2) : shade(col, 0.72);   // pale chalk cliffs on the coast
      // Sides only where the neighbour is lower, so hidden faces are never drawn.
      const nx = heightAt(x + size, az), px = heightAt(x - size, az), outer = heightAt(x, az + size);
      const inner = i === 0 ? -1.2 : Math.min(heightAt(x, rows[i - 1].az), heightAt(x + size / 2, rows[i - 1].az));
      if (nx < hgt) mb.quad([xb, nx, za + rb], [xb, hgt, za + rb], [xb, hgt, zb + rb], [xb, nx, zb + rb], [1, 0, 0], sideCol);
      if (px < hgt) mb.quad([xa, px, zb + ra], [xa, hgt, zb + ra], [xa, hgt, za + ra], [xa, px, za + ra], [-1, 0, 0], sideCol);
      const zi = side > 0 ? za : zb, zo = side > 0 ? zb : za;
      if (inner < hgt) mb.quad([xa, inner, zi + ra], [xa, hgt, zi + ra], [xb, hgt, zi + rb], [xb, inner, zi + rb], [0, 0, -side], sideCol);
      if (outer < hgt) mb.quad([xb, outer, zo + rb], [xb, hgt, zo + rb], [xa, hgt, zo + ra], [xa, outer, zo + ra], [0, 0, side], sideCol);
    }
  });

  // Trees, in clumps where the noise says woodland.
  for (let x = x0; x < x1; x += 7) for (const side of landSides) for (let k = 0; k < 3; k++) {
    if (coast && rng() < 0.6) continue;   // windswept: fewer trees on the clifftops
    const az = BANK + 8 + rng() * (bankDepth - 14);
    const wood = noise(x * 0.01 + 50, az * 0.01 + side * 9);
    if (rng() > wood * wood * 0.55) continue;
    const tx = x + rng() * 7, tz = side * az + rz(tx), ty = heightAt(tx, az);
    if (course.distance - 220 < tx && tx < course.distance + 40 && side < 0 && az < BANK + 40) continue; // grandstand space
    if (course.theme === 'city' && az > BANK + 20 && rng() < 0.6) building(mb, tx, ty, tz, rng, course.night);
    else tree(mb, tx, ty, tz, rng, L, course.theme === 'alpine');
  }

  // Far hills: stepped blocks that fade into the haze.
  for (let x = x0 - 400; x < x1 + 400; x += 48) for (const side of landSides) {
    const tall = course.theme === 'alpine' ? 4 : 1, peak = (8 + noise(x * 0.006, side * 3) * 34) * tall;
    const z = side * (BANK + bankDepth + 30 + rng() * 60 + (tall > 1 ? 80 : 0)) + rz(x);
    if (course.theme === 'city') { skyline(mb, x, z, rng, course.night); continue }
    if (tall > 1) { mountain(mb, x, z, peak, L); continue }
    for (let k = 0; k < 3; k++) {
      const hgt = peak * (1 - k * 0.3), w = (52 - k * 14) * (tall > 1 ? 1.6 : 1);
      // Alpine peaks get rock and snow on their upper steps.
      const col = tall > 1 && k === 2 ? [1.25, 1.25, 1.3] : tall > 1 && k === 1 ? shade(hex(0x8a8f99), 0.9) : shade(L.grass[0], 0.62 + k * 0.08);
      mb.box(x, hgt / 2 - 1, z + side * k * -6, w, hgt, 40 - k * 10, col);
    }
  }

  buildCourseFurniture(mb, course, cls, L, rng);
  return { mb, L };
}

function tree(mb, x, y, z, rng, L, alpine = false) {
  const trunk = hex(0x6b4a2b), pine = rng() < (alpine ? 0.85 : 0.35);
  const leaf = shade(pine ? hex(0x2f6a3a) : L.grass[(rng() * 2) | 0], 0.75 + rng() * 0.25);
  const h = 3 + rng() * 4;
  mb.box(x, y + h / 2, z, 0.7, h, 0.7, trunk);
  if (pine) for (let i = 0; i < 3; i++) { const w = 4.2 - i * 1.3; mb.box(x, y + h + i * 1.8 - 0.6, z, w, 2, w, shade(leaf, 1 + i * 0.06)) }
  else {
    const w = 3.5 + rng() * 2.5;
    mb.box(x, y + h + w * 0.35, z, w, w * 0.8, w, leaf);
    mb.box(x + (rng() - 0.5) * 2, y + h + w * 0.8, z + (rng() - 0.5) * 2, w * 0.65, w * 0.6, w * 0.65, shade(leaf, 1.1));
  }
}

// Alpine venues: stepped voxel peaks, green at the foot, grey rock above, snow on the top.
function mountain(mb, x, z, peak, L) {
  const tiers = 8, base = 90 + peak * 0.5, step = peak / tiers;
  for (let k = 0; k < tiers; k++) {
    const w = base * (1 - k / tiers), f = k / tiers;
    const col = f > 0.7 ? [1.25, 1.25, 1.3] : f > 0.4 ? shade(hex(0x8a8f99), 0.85 + f * 0.2) : shade(L.grass[0], 0.6 + f * 0.3);
    mb.box(x, step * (k + 0.5) - 1, z, w, step, w * 0.8, col);
  }
}

// City venues: blocks of flats and offices beyond the banks, windows lit in the evening.
const BUILDING_COLOURS = [0xc9b8a0, 0xa8b0bb, 0xd9cdb8, 0x8f8a84, 0xb86a4a, 0xe6e2d8];
function building(mb, x, y, z, rng, night) {
  const w = 6 + rng() * 6, d = 6 + rng() * 6, h = 8 + rng() * rng() * 30, col = hex(BUILDING_COLOURS[(rng() * BUILDING_COLOURS.length) | 0]);
  mb.box(x, y + h / 2, z, w, h, d, col);
  mb.box(x, y + h + 0.3, z, w + 0.4, 0.6, d + 0.4, shade(col, 0.7));
  const lit = night ? [3, 2.6, 1.6] : [0.35, 0.45, 0.55];
  for (let fy = y + 2; fy < y + h - 1; fy += 3) for (const s of [-1, 1]) mb.box(x, fy, z + s * (d / 2 + 0.02), w * 0.8, 0.9, 0.05, lit);
}

function skyline(mb, x, z, rng, night) {
  for (let i = 0; i < 3; i++) {
    const h = 25 + rng() * 70, w = 10 + rng() * 14;
    mb.box(x + (i - 1) * 16, h / 2 - 1, z + (rng() - 0.5) * 30, w, h, w, shade(hex(0x8f9aa8), night ? 0.5 : 0.8 + rng() * 0.2));
  }
}

function buildCourseFurniture(mb, course, cls, L, rng) {
  const D = course.distance, white = [0.95, 0.95, 0.95], red = hex(0xff3b2a), yellow = hex(0xffc21a), buoyWhite = [1.2, 1.2, 1.2];
  // Lane buoys every 12.5 m; the last 250 m are red, the first 100 m white.
  if (course.bends) return riverFurniture(mb, course, cls, L, rng);
  for (let l = 0; l <= LANES; l++) {
    const z = laneZ(l) - LANE_W / 2;
    for (let x = 0; x <= D; x += 12.5) {
      const col = x > D - 250 ? shade(red, 1.4) : x < 100 ? buoyWhite : (x / 12.5) % 2 ? shade(yellow, 1.4) : buoyWhite;
      mb.box(x, 0.12, z, 0.32, 0.34, 0.32, col);
    }
  }
  // Start pontoons with a boat holder for each lane.
  for (let l = 0; l < LANES; l++) {
    const z = laneZ(l), sx = -BOAT_CLASSES[cls].length;
    mb.box(sx - 3, 0.2, z, 4, 0.5, 3, hex(0x8a7a62));
    mb.box(sx - 1.6, 0.9, z, 0.5, 0.9, 0.5, hex(0x2b4f8a));
    mb.box(sx - 1.6, 1.5, z, 0.3, 0.3, 0.3, hex(0xe0b590));
    voxelText(mb, String(l + 1), sx - 4.2, 0.5, z, 0.22, white, 1);
  }
  // Start and finish gantries spanning the lanes.
  const span = LANES * LANE_W + 6;
  gantry(mb, -BOAT_CLASSES[cls].length - 8, span, 'START', hex(0x2a5db0));
  gantry(mb, D, span, 'FINISH', red);
  // Distance boards on both banks every 250 m.
  for (let x = 250; x < D; x += 250) for (const side of course.theme === 'coast' ? [-1] : [-1, 1]) {
    const z = side * (SC.bank + 2) + SC.rz(x);
    mb.box(x, 2.6, z, 0.4, 5.2, 0.4, hex(0x444444));
    mb.box(x, 5.2, z, 7.5, 3, 0.4, D - x <= 500 ? red : hex(0x1f3d72));
    voxelText(mb, String(D - x), x, 4.25, z - side * 0.3, 0.35, white, -side);
  }
  grandstand(mb, D, rng);
  if (course.theme === 'coast') lighthouse(mb, D + 140, -(SC.bank + 40));
  else boathouses(mb, rng);
}

// A striped lighthouse on the headland beyond the finish.
function lighthouse(mb, x, z) {
  const red = hex(0xd8352a), white = [1.15, 1.15, 1.1];
  mb.box(x, 14, z, 7, 2, 7, hex(0x8a8478));
  for (let i = 0; i < 6; i++) mb.box(x, 16 + i * 2.5 + 1.25, z, 4.6 - i * 0.3, 2.5, 4.6 - i * 0.3, i % 2 ? red : white);
  mb.box(x, 32.5, z, 3.2, 2, 3.2, [3, 2.8, 1.8]);
  mb.box(x, 34, z, 3.8, 1, 3.8, red);
}

function gantry(mb, x, span, label, col, zc = 0) {
  const h = 7.5, z = span / 2;
  for (const s of [-1, 1]) mb.box(x, h / 2, zc + s * z, 0.8, h, 0.8, [0.9, 0.9, 0.9]);
  mb.box(x, h, zc, 1.2, 1.2, span + 1, col);
  // Letters on the face that crews see as they come down the course.
  voxelTextOnX(mb, label, x - 0.65, h - 0.85, zc, 0.34, [1, 1, 1], 1);
}

// Letters laid out along z, for faces that look down the course.
function voxelTextOnX(mb, text, x, y, z0, s, col, facing) {
  let cz = z0 - (text.length * 4 - 1) * s / 2 * facing;
  for (const ch of text) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++)
      if (g[r * 3 + c] === '1') mb.box(x, y + (4.5 - r) * s, cz + (c + 0.5) * s * facing, s * 0.5, s * 0.92, s * 0.92, col);
    cz += 4 * s * facing;
  }
}

function grandstand(mb, D, rng) {
  const z0 = -(SC.bank + 6) + SC.rz(D), shirts = [0xd8352a, 0x2a5db0, 0xf2c230, 0xffffff, 0x3aa35a, 0xe07ab0, 0x222222, 0xff8a2a];
  for (let row = 0; row < 6; row++) {
    const y = 0.8 + row * 0.9, z = z0 - row * 1.4;
    mb.box(D - 90, y - 0.4, z, 150, 0.8, 1.4, hex(0x9a9a9a));
    for (let x = D - 162; x < D - 18; x += 1.2) {
      if (rng() < 0.25) continue;
      const c = hex(shirts[(rng() * shirts.length) | 0]);
      mb.box(x, y + 0.45, z, 0.6, 0.7, 0.5, c);
      mb.box(x, y + 0.95, z, 0.35, 0.35, 0.35, hex(rng() < 0.5 ? 0xe0b590 : 0x8d5a3a));
    }
  }
  mb.box(D - 90, 8.5, z0 - 4, 152, 0.5, 10, hex(0xf3f3f3));
  // Finish tower for the judges.
  mb.box(D, 4, z0 - 2, 5, 8, 5, hex(0xe8e2d0));
  mb.box(D, 7.2, z0 + 0.6, 4.4, 1.4, 0.2, hex(0x203040));
  mb.box(D, 8.3, z0 - 2, 6, 0.6, 6, hex(0x9a3a2a));
}

function boathouses(mb, rng) {
  const z0 = SC.bank + 10 + SC.rz(-200), walls = [0xe8e2d0, 0xc9d6e8, 0xe8cfc0, 0xd6e8c9];
  for (let i = 0; i < 4; i++) {
    const x = -220 + i * 26, w = 18 + rng() * 5, d = 14, h = 6 + rng() * 2;
    mb.box(x, h / 2, z0 + d / 2, w, h, d, hex(walls[i]));
    for (let k = 0; k < 4; k++) mb.box(x, h + 0.5 + k * 0.8, z0 + d / 2, w + 1 - k * 0, 0.8, d - k * 3.5, hex(0x8a3a2a));
    mb.box(x, 1.6, z0 - 0.05, w * 0.7, 3.2, 0.2, hex(0x3a2a20));
    mb.box(x, 0.15, z0 - 6, w * 0.8, 0.3, 12, hex(0x8a7a62));
  }
}

// A head-race river: marker buoys along both edges of the stream, start and finish across the water.
function riverFurniture(mb, course, cls, L, rng) {
  const D = course.distance, w = course.halfW - 2.6, red = hex(0xff3b2a), white = [1.2, 1.2, 1.2];
  for (let x = 0; x <= D; x += 20) for (const side of [-1, 1]) {
    const z = riverZ(course, x) + side * w;
    mb.box(x, 0.15, z, 0.45, 0.45, 0.45, (x / 20) % 2 ? shade(red, 1.4) : white);
  }
  const span = course.halfW * 2 + 4;
  gantry(mb, -BOAT_CLASSES[cls].length - 8, span, 'START', hex(0x2a5db0), riverZ(course, 0));
  gantry(mb, D, span, 'FINISH', red, riverZ(course, D));
  for (let x = 500; x < D; x += 500) for (const side of [-1, 1]) {
    const z = side * (SC.bank + 2) + SC.rz(x);
    mb.box(x, 2.6, z, 0.4, 5.2, 0.4, hex(0x444444));
    mb.box(x, 5.2, z, 7.5, 3, 0.4, hex(0x1f3d72));
    voxelText(mb, String(D - x), x, 4.25, z - side * 0.3, 0.35, white, -side);
  }
  for (const f of [0.32, 0.68]) bridge(mb, D * f, course, rng);
  grandstand(mb, D, rng);
  boathouses(mb, rng);
}

// A stone footbridge across the river: arches over the water, railings, and a few people watching from it.
function bridge(mb, x, course, rng) {
  const z0 = riverZ(course, x), half = course.halfW + 8, stone = hex(0xa89f8c), dark = shade(stone, 0.75);
  mb.box(x, 7.4, z0, 5, 0.8, half * 2, stone);                                    // deck
  for (const s of [-1, 1]) mb.box(x + s * 2.3, 8.3, z0, 0.3, 1, half * 2, dark);  // railings
  // Arches: stepped blocks hanging under the deck, leaving the water clear below 4.5 m.
  for (let z = -half; z <= half; z += 2) {
    const t = Math.abs(z) / half, drop = 0.6 + t * t * 2.4;
    mb.box(x, 7 - drop / 2, z0 + z, 4.8, drop, 2.05, stone);
  }
  for (const s of [-1, 1]) mb.box(x, 3.5, z0 + s * (course.halfW + 6), 5, 7, 4, dark);   // abutments on the banks
  for (let i = 0; i < 8; i++) {
    const z = z0 + (rng() * 2 - 1) * course.halfW * 0.9, side = rng() < 0.5 ? -1.6 : 1.6;
    mb.box(x + side, 8.3, z, 0.5, 0.9, 0.4, hex([0xd8352a, 0x2a5db0, 0xf2c230, 0x3aa35a][i % 4]));
    mb.box(x + side, 9, z, 0.32, 0.32, 0.32, hex(0xe0b590));
  }
}
