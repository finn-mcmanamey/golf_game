/* ===== cameras: TV side view, chase, aerial and the rower's own view (facing backwards, as rowers do) ===== */

const CAMERAS = ['tv', 'director', 'chase', 'aerial', 'rower'];
const CAMERA_LABEL = { tv: 'TV', director: 'Director', chase: 'Chase', aerial: 'Aerial', rower: "Rower's eye" };
const cam = { mode: 'tv', eye: [0, 10, 40], at: [0, 0, 0], fov: 0.9, shake: 0 };

function cameraTarget(src, mode, raceT) {
  if (race?.course.kind === 'erg') return ergCamera(src, mode === 'director' ? ['tv', 'chase', 'aerial'][Math.floor(Math.max(0, raceT) / 6) % 3] : mode);
  const q = pose(src), boat = { ...src, x: q.x, z: q.z, yaw: q.yaw, h: q.h };
  const L = BOAT_CLASSES[boat.cls].length, mid = boat.x - L / 2, lead = Math.min(8, boat.v * 1.2);
  const intro = race && mode !== 'rower' && race.boats.length > 2 && !race.course.bends && race.course.kind === 'regatta' && raceT < race.attentionAt - 0.4;
  if (intro) {
    // Crews introduced lane by lane, sweeping from lane 1 across the start, as the TV coverage does.
    const span = race.attentionAt - 0.4 - race.t0, f = clamp((raceT - race.t0) / span, 0, 1), z = lerp(laneZ(0), laneZ(LANES - 1), f);
    return { eye: [mid - 4, 3, z + 13], at: [mid - 2, 0.8, z], fov: 0.7 };
  }
  if (raceT < 0 && mode !== 'rower') {
    // Before the start: a slow pan along the start line.
    const k = clamp(-raceT / 6, 0, 1);
    return { eye: [mid - 30 - k * 20, 6 + k * 6, boat.z + 26 + k * 14], at: [mid + 4, 0.5, boat.z - 4], fov: 0.8 };
  }
  if (mode === 'director') return directorShot(boat, raceT, L, mid, lead);
  switch (mode) {
    case 'chase': {
      // Behind the stern along the boat's heading, so bends swing into view.
      const cy = Math.cos(boat.yaw), sy = Math.sin(boat.yaw), back = L / 2 + 6, ahead = 6, mz = boat.z - sy * L / 2;
      return { eye: [mid - cy * back, 3, mz - sy * back + 2.2], at: [mid + cy * ahead, 0.9, mz + sy * ahead], fov: 0.95 };
    }
    case 'aerial': return { eye: [mid - 22, 38, boat.z + 22], at: [mid + 8 + lead, 0, boat.z], fov: 0.9 };
    case 'rower': {
      // Just in front of the stroke's face, looking astern the way a rower sees the race.
      const st = stationsFor(boat)[0], lean = lerp(-0.5, 0.42, smooth(0.25, 0.85, boat.h));
      const u = st.u + lerp(0.08, 0.78, smooth(0, 0.62, boat.h)) + Math.sin(lean) * 0.8 - 0.16;
      const cy = Math.cos(boat.yaw), sy = Math.sin(boat.yaw);
      const eye = [boat.x + cy * u, 0.36 + Math.cos(lean) * 0.8, boat.z + sy * u];
      return { eye, at: [eye[0] - cy * 10, 0.3, eye[2] - sy * 10], fov: 1.2 };
    }
    // TV: high on the far bank's side, so boats in nearer lanes pass below rather than in front.
    default: return { eye: [mid + lead - 3, 10, boat.z + 27], at: [mid + lead + 2, 0.4, boat.z - 2], fov: 0.66 };
  }
}

// As you cross the line, the TV director cuts to the finish camera for a moment.
function finishShot(boat) {
  const D = race.course.distance, since = boat.finishTime != null ? race.t - boat.finishTime - boat.startAt : -1;
  if (cam.mode !== 'tv' || race.course.kind === 'erg' || since < 0 || since > 3 || race.player2) return null;
  const z = riverZ(race.course, D);
  // Just past the line, so the finish post isn't in front of the lens.
  return { eye: [D + 1.6, 4.5, z + (race.course.bends ? race.course.halfW - 3 : LANES * LANE_W / 2 - 3)], at: [D + 1, 1.5, boat.z - 8], fov: 0.6 };   // inside the posts, over the outside lane
}

// The moment of a bump: a low cut from the water's edge, the two boats together, for a couple of seconds.
function bumpShot(boat) {
  const since = boat.out ? race.t - boat.out.t : -1;
  if (since < 0 || since > 2.8 || cam.mode === 'rower' || race.player2) return null;
  const x = boat.x - BOAT_CLASSES[boat.cls].length * 0.4, z = riverZ(race.course, x);
  return { eye: [x + 7, 1.3, z + 15], at: [x - 2, 0.5, z], fov: 0.75, cut: true };
}

// Director: cuts between angles every few seconds, like a broadcast. Bank cameras stay put while the boats pass.
const SHOTS = ['tv', 'aerial', 'bank', 'chase', 'tv', 'bow'];
function directorShot(boat, raceT, L, mid, lead) {
  const D = race.course.distance, left = D - boat.x;
  const shot = left < 60 && left > -5 ? 'bank' : SHOTS[Math.floor(Math.max(0, raceT) / 7) % SHOTS.length];
  if (shot === 'bank') {
    // A fixed camera on the bank ahead; the boats row past it.
    const at = Math.min(D, Math.floor((boat.x + 40) / 80) * 80 + 30), z = riverZ(race.course, at);
    return { eye: [at, 2.5, z + (race.course.bends ? race.course.halfW + 2 : BANK_Z - 2)], at: [mid, 0.6, boat.z], fov: 0.6, cut: true };
  }
  if (shot === 'bow') return { eye: [boat.x + 9, 1.6, boat.z + 4], at: [mid, 0.8, boat.z], fov: 0.8, cut: true };
  return { ...cameraTarget(boat, shot, raceT), cut: true };
}

function updateCamera(boat, raceT, dt) {
  const t = (race && (finishShot(race.player) || bumpShot(race.player))) || cameraTarget(boat, cam.mode, raceT);
  // A director's cut jumps straight to the new angle; other cameras glide.
  const cutNow = t.cut && Math.hypot(t.eye[0] - cam.eye[0], t.eye[1] - cam.eye[1], t.eye[2] - cam.eye[2]) > 15;
  const k = cam.mode === 'rower' || cutNow ? 1 : 1 - Math.exp(-dt * 4);
  for (let i = 0; i < 3; i++) { cam.eye[i] += (t.eye[i] - cam.eye[i]) * k; cam.at[i] += (t.at[i] - cam.at[i]) * k }
  cam.fov += (t.fov - cam.fov) * k;
  if (cam.shake > 0 && settings.calm) cam.shake = 0;   // reduced motion: no shaking
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 2);
    cam.eye[1] += (Math.random() - 0.5) * cam.shake * 0.4;
  }
}

function nextCamera() {
  cam.mode = CAMERAS[(CAMERAS.indexOf(cam.mode) + 1) % CAMERAS.length];
  return CAMERA_LABEL[cam.mode];
}
