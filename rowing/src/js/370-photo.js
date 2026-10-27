/* ===== photo mode: freeze the race and fly the camera around your boat ===== */

const photo = { on: false, yaw: 0.6, pitch: 0.35, dist: 18, drag: null };

function togglePhoto() {
  if (game.state !== 'race' && !photo.on) return;
  photo.on = !photo.on;
  game.state = photo.on ? 'photo' : 'race';
  document.body.classList.toggle('photo', photo.on);
  if (!photo.on) game.last = performance.now();
  else AU.ambient(0, 0, 0, 0);   // the frozen moment is silent
  toast(photo.on ? 'Photo mode: drag to look around, scroll to zoom, F to carry on' : 'Back to the race', 1600);
}

function photoCamera() {
  const p = pose(race.player), L = BOAT_CLASSES[race.player.cls].length;
  const at = [p.x - L / 2, 0.8, p.z], cp = Math.cos(photo.pitch);
  cam.at = at;
  cam.eye = [at[0] - Math.cos(photo.yaw) * cp * photo.dist, Math.max(0.4, at[1] + Math.sin(photo.pitch) * photo.dist), at[2] + Math.sin(photo.yaw) * cp * photo.dist];
  cam.fov = 0.8;
}

canvas.addEventListener('pointerdown', e => { if (photo.on) photo.drag = { x: e.clientX, y: e.clientY } });
addEventListener('pointermove', e => {
  if (!photo.on || !photo.drag) return;
  photo.yaw += (e.clientX - photo.drag.x) * 0.006;
  photo.pitch = clamp(photo.pitch + (e.clientY - photo.drag.y) * 0.004, -0.05, 1.4);
  photo.drag = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { photo.drag = null });
addEventListener('wheel', e => { if (photo.on) photo.dist = clamp(photo.dist * (e.deltaY > 0 ? 1.1 : 0.9), 4, 120) }, { passive: true });
addEventListener('keydown', e => { if (e.code === 'KeyF' && (game.state === 'race' || photo.on)) togglePhoto() });
