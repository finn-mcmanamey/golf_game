/* ===== cox mode: in a crew boat, steer and call the race while the crew rows =====
   The crew's strokes are made here, in the input layer, and recorded like a player's, so replays stay exact.
   You steer, set the rate, and have three power tens to call: each one lasts ten strokes. */

const COX_TENS = 3;
const coxState = { tens: COX_TENS, tenUntil: -1, planned: 0, lastStroke: -1, pressed: false };

const coxing = () => settings.role === 'cox' && race && BOAT_CLASSES[race.player.cls].crew > 1 && !race.player2 && game.mode !== 'learn' && !game.replay;

function resetCox() { Object.assign(coxState, { tens: COX_TENS, tenUntil: -1, planned: 0, lastStroke: -1, pressed: false }) }

// The crew rows like good club athletes: each catch a little early or late, a clean release.
function crewStroke(b) {
  if (b.strokes !== coxState.lastStroke) {
    coxState.lastStroke = b.strokes;
    coxState.planned = (Math.random() + Math.random() + Math.random() - 1.5) * 0.09;
  }
  if (b.phase === 'drive') return b.h < 0.94 ? IN.DRIVE : 0;
  if (b.lastBits & IN.DRIVE) return 0;
  const err = b.phase === 'recover' ? -b.h / b.recSpeed : b.phaseT;
  return b.strokes === 0 || err >= coxState.planned ? IN.DRIVE : 0;
}

// Called instead of the rowing keys when coxing: the crew's stroke plus your steering and calls.
function coxInput(bits) {
  const b = race.player;
  bits &= IN.LEFT | IN.RIGHT;
  if (race.started) bits |= crewStroke(b);
  if (b.strokes < coxState.tenUntil && b.energy > 0.03) bits |= IN.PUSH;
  return bits;
}

function callPowerTen() {
  if (!coxing() || !race.started || coxState.tens <= 0 || race.player.strokes < coxState.tenUntil) return;
  coxState.tens--;
  coxState.tenUntil = race.player.strokes + 10;
  say(`Power ten… on this one! (${coxState.tens} left)`, null, 0);
  AU.play('attention');
}
