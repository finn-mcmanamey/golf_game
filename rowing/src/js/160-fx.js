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
