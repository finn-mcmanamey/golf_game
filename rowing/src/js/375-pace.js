/* ===== the pace line: a glowing line across your lane moving at a target pace =====
   Your best for this event, or a set split per 500 m. Drawing only: it reads the clock, never the race. */

const PACE_CHOICES = [['off', 'Off'], ['pb', 'Your best'], [120, '2:00'], [110, '1:50'], [100, '1:40'], [90, '1:30']];

// Metres per second the line moves at, or null when there's no pace to show.
function paceSpeed(race) {
  if (settings.pace === 'off' || !race || race.player2 || game.mode === 'live') return null;
  if (settings.pace === 'pb') {
    const o = race.opts, pb = getPB(o.distance, o.cls, o.kind || 'regatta');
    return pb ? o.distance / pb.time : null;
  }
  return 500 / settings.pace;
}

function paceX(race) {
  const v = paceSpeed(race), t = race.t - (race.player.startAt || 0);
  return v && t > 0 ? Math.min(race.course.distance, v * t) : null;
}

function drawPaceLine(mb, race) {
  const x = paceX(race);
  if (x == null) return;
  const p = race.player, z = race.course.kind === 'erg' ? null : p.z;
  if (z == null) return;   // indoors the big screen shows it instead
  mb.box(x, 0.06, z, 0.25, 0.04, 7, [0.4, 2.2, 2.6]);
  mb.box(x, 0.5, z - 3.6, 0.15, 1, 0.15, [0.4, 2.2, 2.6]);
  mb.box(x, 0.5, z + 3.6, 0.15, 1, 0.15, [0.4, 2.2, 2.6]);
}

// "+1.4 s" behind the line or "−0.8 s" ahead of it, in time at your current speed.
function updatePaceHud(race) {
  const x = paceX(race), el = $('paceT');
  if (x == null || race.player.finishTime != null) { el.textContent = ''; return }
  const gap = (x - race.player.x) / Math.max(1, race.player.v);
  el.textContent = `${gap > 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)} s vs pace`;
  el.style.color = gap > 0 ? 'var(--warn)' : 'var(--good)';
}
