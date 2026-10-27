/* ===== strain: when the crew is nearly spent the screen edges darken and a heartbeat thumps =====
   Screen and sound only, so the player feels the energy bar instead of having to watch it. */

let heartNext = 0;

function updateStrain(race) {
  const p = race.player, done = p.finishTime != null || p.out || !race.started;
  const k = done ? 0 : clamp((0.3 - p.energy) / 0.25, 0, 1);
  $('strain').style.opacity = (k * 0.85).toFixed(2);
  // Faster and louder as the tank empties.
  if (k > 0 && game.time >= heartNext && !game.fastForward) { AU.play('heart', 0.4 + k * 0.6); heartNext = game.time + 0.95 - k * 0.4 }
}
