/* ===== cameras: TV side view, chase, aerial and the rower's own view (facing backwards, as rowers do) ===== */

const CAMERAS = ['tv', 'chase', 'aerial', 'rower'];
const CAMERA_LABEL = { tv: 'TV', chase: 'Chase', aerial: 'Aerial', rower: "Rower's eye" };
const cam = { mode: 'tv', eye: [0, 10, 40], at: [0, 0, 0], fov: 0.9, shake: 0 };

function cameraTarget(boat, mode, raceT) {
  const L = BOAT_CLASSES[boat.cls].length, mid = boat.x - L / 2, lead = Math.min(8, boat.v * 1.2);
  if (raceT < 0 && mode !== 'rower') {
    // Before the start: a slow pan along the start line.
    const k = clamp(-raceT / 6, 0, 1);
    return { eye: [mid - 30 - k * 20, 6 + k * 6, boat.z + 26 + k * 14], at: [mid + 4, 0.5, boat.z - 4], fov: 0.8 };
  }
  switch (mode) {
    case 'chase': return { eye: [mid - L / 2 - 6, 3, boat.z + 2.2], at: [mid + 6, 0.9, boat.z], fov: 0.95 };
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

function updateCamera(boat, raceT, dt) {
  const t = cameraTarget(boat, cam.mode, raceT);
  const k = cam.mode === 'rower' ? 1 : 1 - Math.exp(-dt * 4);
  for (let i = 0; i < 3; i++) { cam.eye[i] += (t.eye[i] - cam.eye[i]) * k; cam.at[i] += (t.at[i] - cam.at[i]) * k }
  cam.fov += (t.fov - cam.fov) * k;
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 2);
    cam.eye[1] += (Math.random() - 0.5) * cam.shake * 0.4;
  }
}

function nextCamera() {
  cam.mode = CAMERAS[(CAMERAS.indexOf(cam.mode) + 1) % CAMERAS.length];
  return CAMERA_LABEL[cam.mode];
}
