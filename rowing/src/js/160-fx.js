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
  drawStartLights(mb, course);
  drawCrowd(mb, time, course);
  drawBirds(mb, time, course);
  if (course.rain && R.quality > 0) drawRain(mb, time);
}

// A small flock wheeling over the course: each bird two flapping wings and a body.
function drawBirds(mb, time, course) {
  const cx = cam.at[0] + 40, dark = [0.15, 0.17, 0.2];
  for (let i = 0; i < 7; i++) {
    const a = time * 0.12 + i * 0.35, r = 60 + i * 4;
    const x = cx + Math.cos(a) * r, z = Math.sin(a) * r * 0.6 - 20, y = 28 + Math.sin(time * 0.7 + i) * 3;
    const flap = Math.sin(time * 9 + i * 1.7) * 0.5, dir = [-Math.sin(a), 0, Math.cos(a) * 0.6];
    const side = norm3(cross3(dir, [0, 1, 0]));
    mb.box(x, y, z, 0.4, 0.15, 0.4, dark);
    for (const s of [-1, 1]) mb.beam([x, y, z], [x + side[0] * s * 0.9, y + flap, z + side[2] * s * 0.9], 0.3, 0.05, dark);
  }
}

// Rain: thin falling streaks in a box around the camera.
function drawRain(mb, time) {
  const col = [1.5, 1.55, 1.65];
  for (let i = 0; i < 300; i++) {
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
