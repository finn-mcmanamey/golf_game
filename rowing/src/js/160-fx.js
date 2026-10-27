/* ===== effects: catch spray, birds and rain =====
   Pure decoration, rebuilt every frame into the boats' mesh. */

const spray = [];   // droplets thrown up as blades bite: { p, v, life }

function addSpray(p, strength) {
  for (let i = 0; i < 5 * strength; i++) {
    spray.push({ p: [p[0], 0.05, p[2]], v: [(Math.random() - 0.7) * 1.4, 1.2 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2], life: 0.5 + Math.random() * 0.3 });
  }
  if (spray.length > 400) spray.splice(0, spray.length - 400);
}

function drawFx(mb, dt, time, course) {
  const white = [1.3, 1.35, 1.4];
  for (let i = spray.length - 1; i >= 0; i--) {
    const d = spray[i];
    d.life -= dt;
    if (d.life <= 0 || d.p[1] < -0.05) { spray.splice(i, 1); continue }
    d.v[1] -= 9.8 * dt;
    for (let k = 0; k < 3; k++) d.p[k] += d.v[k] * dt;
    const s = 0.05 + d.life * 0.06;
    mb.box(d.p[0], d.p[1], d.p[2], s, s, s, white);
  }
  drawFlags(mb, time, course);
  if (course.night && !course.rain) drawLamps(mb, course);
  drawStartLights(mb, course);
  drawLaunch(mb, dt, time, course);
  drawFireworks(mb, dt, course);
  if (['regatta', 'head', 'knockout', 'bumps'].includes(course.kind)) drawSwans(mb, dt, time, course);
  drawCrowd(mb, time, course);
  drawBankParty(mb, dt, time, course);
  drawBirds(mb, time, course);
  if (R.wet > 0.05 && R.quality > 0) drawRain(mb, time, R.wet);
}

// A small flock wheeling over the course: each bird two flapping wings and a body.
function drawBirds(mb, time, course) {
  const cx = cam.at[0] + 40, dark = [0.15, 0.17, 0.2];
  for (let i = 0; i < 7; i++) {
    const a = time * 0.12 + i * 0.35, r = 60 + i * 4;
    const x = cx + Math.cos(a) * r, z = Math.sin(a) * r * 0.6 - 20, y = Math.max(28, cam.eye[1] + 18) + Math.sin(time * 0.7 + i) * 3;   // always well above the camera
    const flap = Math.sin(time * 9 + i * 1.7) * 0.5, dir = [-Math.sin(a), 0, Math.cos(a) * 0.6];
    const side = norm3(cross3(dir, [0, 1, 0]));
    mb.box(x, y, z, 0.4, 0.15, 0.4, dark);
    for (const s of [-1, 1]) mb.beam([x, y, z], [x + side[0] * s * 0.9, y + flap, z + side[2] * s * 0.9], 0.3, 0.05, dark);
  }
}

// Rain: thin falling streaks in a box around the camera.
function drawRain(mb, time, amount = 1) {
  const col = [1.5, 1.55, 1.65];
  for (let i = 0; i < 300 * amount; i++) {
    const rx = ((i * 7.31) % 1), rz = ((i * 3.77) % 1), fall = ((time * 1.4 + i * 0.137) % 1);
    const x = cam.eye[0] + (rx - 0.5) * 50 + (cam.at[0] - cam.eye[0]) * 0.4;
    const z = cam.eye[2] + (rz - 0.5) * 50 + (cam.at[2] - cam.eye[2]) * 0.4;
    const y = 18 * (1 - fall);
    if (Math.hypot(x - cam.eye[0], y - cam.eye[1], z - cam.eye[2]) < 7) continue;   // too close: would look like a pole
    mb.beam([x, y, z], [x + 0.08, y - 0.7, z], 0.015, 0.015, col);
  }
}

// Flags stream with the wind, so you can read it from the water. Poles sit on the start and finish gantries and the banks.
function drawFlags(mb, time, course) {
  const w = course.wind, len = Math.hypot(w.along, w.cross);
  const dir = len > 0.2 ? [w.along / len, 0, w.cross / len] : [0.2, 0, 0.98];
  const droop = clamp(1 - len / 4, 0.1, 0.9), pole = [0.85, 0.85, 0.85], cloth = [hex(0xd8352a), hex(0xffd23a), hex(0x2a5db0)];
  const D = course.distance, rz = x => riverZ(course, x), bank = course.bends ? course.halfW + 3 : BANK_Z + 3;
  for (let x = 0; x <= D; x += 125) for (const side of [-1, 1]) {
    if (Math.abs(x - cam.at[0]) > 260) continue;
    const base = [x, 0, rz(x) + side * bank];
    mb.box(base[0], 3.5, base[2], 0.12, 7, 0.12, pole);
    // A flag of three segments: each flutters a little more than the last.
    let p = [base[0], 6.8, base[2]];
    for (let k = 0; k < 3; k++) {
      const flap = Math.sin(time * (4 + len) + k * 1.3 + x) * (0.15 + 0.1 * k) * (1 - droop * 0.5);
      const q = [p[0] + dir[0] * 0.55 - dir[2] * flap, p[1] - droop * 0.35, p[2] + dir[2] * 0.55 + dir[0] * flap];
      mb.beam(p, q, 0.04, 0.7, cloth[(x / 125 + (side > 0 ? 1 : 0)) % 3]);
      p = q;
    }
  }
}

// Start lights on the start gantry: red at "Attention", green at the horn.
function drawStartLights(mb, course) {
  if (!race || Math.abs(cam.at[0]) > 200) return;
  const t = race.t, x = -BOAT_CLASSES[race.opts.cls].length - 8.7, z0 = riverZ(course, 0);
  const red = t >= race.attentionAt && t < 0, green = t >= 0 && t < 4;
  for (const dz of [-2.5, 2.5]) {
    mb.box(x + 0.1, 6.6, z0 + dz, 0.4, 1.0, 1.0, [0.08, 0.08, 0.1]);
    mb.box(x - 0.15, 6.6, z0 + dz, 0.2, 0.7, 0.7, red ? [3, 0.3, 0.2] : green ? [0.3, 3, 0.5] : [0.25, 0.25, 0.25]);
  }
}

// The front rows of the grandstand stand and wave as the leaders come into the last 300 m.
function drawCrowd(mb, time, course) {
  const D = course.distance;
  if (!race || Math.abs(cam.at[0] - D) > 320) return;
  const lead = Math.max(...race.boats.map(b => b.x)), rise = smooth(D - 300, D - 60, lead) * (lead > D + 60 ? 0.4 : 1);
  if (rise <= 0) return;
  const z0 = -(SC.bank + 6) + SC.rz(D), skin = hex(0xe0b590);
  for (let x = D - 160, i = 0; x < D - 20; x += 2.4, i++) for (let row = 0; row < 2; row++) {
    const y = 0.8 + row * 0.9 + 1.4, z = z0 - row * 1.4, wave = Math.sin(time * 8 + i * 0.9 + row) * 0.25 * rise;
    mb.beam([x, y, z], [x + wave, y + 0.55 * rise, z + 0.1], 0.08, 0.08, skin);
  }
}

// Night: floodlight towers along both banks near the camera, and a white light on each bow.
function drawLamps(mb, course) {
  const rz = x => riverZ(course, x), bank = course.bends ? course.halfW + 5 : BANK_Z + 5, glow = [4, 3.6, 2.6];
  const x0 = Math.floor((cam.at[0] - 300) / 60) * 60;
  for (let x = Math.max(-120, x0); x < cam.at[0] + 300 && x < course.distance + 120; x += 60) for (const side of [-1, 1]) {
    const z = rz(x) + side * bank;
    mb.box(x, 6, z, 0.3, 12, 0.3, [0.3, 0.3, 0.32]);
    mb.box(x, 12.2, z - side * 0.4, 1.6, 0.6, 0.6, glow);
  }
  for (const b of race.boats) mb.box(b.x + 0.1, 0.32, b.z, 0.12, 0.12, 0.12, [6, 6, 5]);
}

// The umpire's launch: a motorboat following the field down the middle, umpire standing with a white flag.
const launch = { x: -60, v: 0 };
function drawLaunch(mb, dt, time, course) {
  if (!race || race.order) return;   // no umpire's launch on a bumps river
  const rowing = race.boats.filter(b => b.finishTime == null);
  const target = rowing.length ? rowing.reduce((n, b) => n + b.x, 0) / rowing.length - 32 : launch.x;
  launch.v += clamp((target - launch.x) * 0.6 - launch.v, -4, 4) * dt;
  launch.x += launch.v * dt;
  if (race.t < 0 || launch.x < -80) launch.x = Math.min(launch.x, -50);
  const x = launch.x, z = riverZ(course, x) + (course.bends ? 0 : (race.boats.length === 2 ? 0 : LANE_W * 0.5)), bob = Math.sin(time * 3) * 0.04;
  const hull = [0.92, 0.92, 0.9], trim = hex(0x1f3d72);
  mb.box(x, 0.35 + bob, z, 7, 0.7, 2.4, hull);
  mb.box(x + 3.8, 0.4 + bob, z, 1.2, 0.5, 1.4, hull);
  mb.box(x, 0.58 + bob, z, 7.1, 0.12, 2.5, trim);   // a band round the hull, below the white deck
  mb.box(x - 1, 1.5 + bob, z, 1.6, 1.3, 1.8, [0.3, 0.45, 0.6]);   // cabin
  // The umpire, flag raised.
  mb.box(x + 1.4, 1.4 + bob, z + 0.4, 0.45, 0.9, 0.35, hex(0x203040));
  mb.box(x + 1.4, 2.05 + bob, z + 0.4, 0.3, 0.3, 0.3, hex(0xe0b590));
  mb.beam([x + 1.6, 1.8 + bob, z + 0.6], [x + 2.2, 3.0 + bob, z + 0.7], 0.04, 0.04, [0.4, 0.3, 0.2]);
  mb.box(x + 2.5, 2.8 + bob + Math.sin(time * 6) * 0.05, z + 0.7, 0.6, 0.4, 0.03, [1.4, 1.4, 1.4]);
}

// Fireworks over the finish when you win: rockets burst into coloured sparks that fall and fade.
const fireworks = { until: 0, next: 0, sparks: [] };
const FIREWORK_COLOURS = [[3, 0.8, 0.5], [0.6, 2.6, 0.9], [0.7, 1.2, 3], [3, 2.6, 0.6], [2.6, 0.8, 2.6]];

function celebrate(seconds = 7) { fireworks.until = game.time + seconds; fireworks.next = game.time }

function drawFireworks(mb, dt, course) {
  if (game.time < fireworks.until && game.time >= fireworks.next) {
    fireworks.next = game.time + 0.35 + Math.random() * 0.5;
    // Over the far bank, behind the grandstand: where the TV and finish cameras look.
    const x = course.distance - 40 + Math.random() * 80, z = riverZ(course, course.distance) - 45 - Math.random() * 35, y = 14 + Math.random() * 14;
    const col = FIREWORK_COLOURS[(Math.random() * FIREWORK_COLOURS.length) | 0];
    for (let i = 0; i < 60; i++) {
      // A random direction on a sphere, scaled for a round burst.
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = 9 + Math.random() * 3;
      fireworks.sparks.push({ p: [x, y, z], v: [r * Math.cos(a) * s, u * s, r * Math.sin(a) * s], life: 1.6 + Math.random() * 0.6, col });
    }
    AU.tone(90, 40, 0.5, 0.25, 'sine', 0.05); AU.hiss(2000, 0.5, 0.6, 0.2, 'bandpass', 0.05);
  }
  for (let i = fireworks.sparks.length - 1; i >= 0; i--) {
    const s = fireworks.sparks[i];
    s.life -= dt;
    if (s.life <= 0) { fireworks.sparks.splice(i, 1); continue }
    s.v[1] -= 6 * dt;
    for (let k = 0; k < 3; k++) { s.v[k] *= 1 - 1.2 * dt; s.p[k] += s.v[k] * dt }
    const size = 0.25 + s.life * 0.2, fade = Math.min(1, s.life);
    mb.box(s.p[0], s.p[1], s.p[2], size, size, size, s.col.map(c => c * fade));
  }
}

// Swans by the banks: they paddle gently, and hurry towards the bank when a crew comes close.
const swans = [];
function drawSwans(mb, dt, time, course) {
  if (!swans.length || swans.course !== course) {
    swans.length = 0; swans.course = course;
    const rng = makeRng(course.sceneSeed ^ 0x5A4);
    for (let i = 0; i < 10; i++) {
      const x = rng() * course.distance, side = rng() < 0.5 ? -1 : 1;
      swans.push({ x, off: side * (course.bends ? course.halfW - 6 : BANK_Z - 6 - rng() * 4), dir: rng() < 0.5 ? 1 : -1 });
    }
  }
  const white = [1.25, 1.25, 1.2], orange = hex(0xff8a2a), black = [0.1, 0.1, 0.1];
  for (const s of swans) {
    if (Math.abs(s.x - cam.at[0]) > 220) continue;
    const near = race.boats.some(b => Math.abs(b.x - s.x) < 25 && Math.abs(b.z - riverZ(course, s.x) - s.off) < 12);
    const edge = (course.bends ? course.halfW : BANK_Z) - 2;
    s.off += Math.sign(s.off) * (near ? 1.2 : 0) * dt;
    s.off = Math.sign(s.off) * Math.min(Math.abs(s.off), edge);
    s.x += s.dir * 0.25 * dt;
    const x = s.x, z = riverZ(course, x) + s.off, bob = Math.sin(time * 1.5 + x) * 0.03;
    mb.box(x, 0.2 + bob, z, 0.9, 0.35, 0.5, white);
    mb.beam([x + s.dir * 0.35, 0.3 + bob, z], [x + s.dir * 0.45, 0.9 + bob, z], 0.12, 0.12, white);
    mb.box(x + s.dir * 0.58, 0.88 + bob, z, 0.22, 0.12, 0.12, orange);
    mb.box(x + s.dir * 0.46, 0.94 + bob, z, 0.08, 0.08, 0.14, black);
  }
}
