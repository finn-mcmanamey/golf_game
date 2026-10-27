/* ===== input: keyboard, mouse and touch become one packed input per tick ===== */

const keys = new Set();
const touchState = { drive: false, left: false, right: false, push: false };
let targetRate = 34, targetRate2 = 36;

function changeRate(d) {
  targetRate = clamp(targetRate + d, RATE_MIN + 2, RATE_MAX - 2);
  AU.play('tick');
}

// Autopilot rows clean strokes on its own: used by the demo behind the menu and by automated checks.
function autoRow(b) {
  let bits = 0;
  if (b.phase === 'drive') bits = b.h < 0.95 ? IN.DRIVE : 0;
  else if (!(b.lastBits & IN.DRIVE) && (b.phase === 'front' || b.h / b.recSpeed < 0.03)) bits = IN.DRIVE;
  return bits | assistSteer(b);
}

// In a duel the arrow keys, Enter and right Shift belong to player 2; otherwise they're spare keys for player 1.
function readInput() {
  const duel = !!race.player2;
  let bits = game.autopilot && race.started ? autoRow(race.player) : 0;
  if (keys.has('Space') || keys.has('Mouse') || touchState.drive) bits |= IN.DRIVE;
  if (keys.has('KeyA') || (!duel && keys.has('ArrowLeft')) || touchState.left) bits |= IN.LEFT;
  if (keys.has('KeyD') || (!duel && keys.has('ArrowRight')) || touchState.right) bits |= IN.RIGHT;
  if (assistOn() && !(bits & (IN.LEFT | IN.RIGHT)) && race) bits |= assistSteer(race.player);
  if (keys.has('ShiftLeft') || (!duel && keys.has('ShiftRight')) || touchState.push) bits |= IN.PUSH;
  if (coxing()) bits = coxInput(bits);   // coxing: the crew rows, you steer and call
  return packInput(bits, targetRate);
}

function readInput2() {
  if (!race.player2) return 0;
  let bits = 0;
  if (keys.has('Enter') || keys.has('NumpadEnter')) bits |= IN.DRIVE;
  if (keys.has('ArrowLeft')) bits |= IN.LEFT;
  if (keys.has('ArrowRight')) bits |= IN.RIGHT;
  if (assistOn() && !(bits & (IN.LEFT | IN.RIGHT))) bits |= assistSteer(race.player2);
  if (keys.has('ShiftRight')) bits |= IN.PUSH;
  return packInput(bits, targetRate2);
}

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  AU.init();
  if (!e.repeat) onKey(e.code);
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  // In a race Enter is a game key (player 2's drive), never a press of whichever button last had focus.
  if ((e.code === 'Enter' || e.code === 'NumpadEnter') && game.state === 'race') e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); Object.keys(touchState).forEach(k => touchState[k] = false) });

function onKey(code) {
  if (code === 'Space' && game.state === 'race' && coxing()) return callPowerTen();
  if ((code === 'Escape' || code === 'KeyP') && (game.state === 'race' || game.state === 'paused')) return togglePause();
  if (game.state !== 'race') return;
  const duel = !!race.player2;
  if (code === 'KeyW' || (!duel && code === 'ArrowUp')) changeRate(2);
  if (code === 'KeyS' || (!duel && code === 'ArrowDown')) changeRate(-2);
  if (duel && code === 'ArrowUp') targetRate2 = clamp(targetRate2 + 2, RATE_MIN + 2, RATE_MAX - 2);
  if (duel && code === 'ArrowDown') targetRate2 = clamp(targetRate2 - 2, RATE_MIN + 2, RATE_MAX - 2);
  if (code === 'KeyC') cycleCamera();
  if (code === 'KeyG') cycleQuality();
  if (code === 'Enter' && race.player.finishTime != null && !race.player2) game.fastForward = true;
}

// Learn to row teaches steering, so the assist is off there whatever the setting says.
const assistOn = () => settings.assist && game.mode !== 'learn';

// Steering assist nudges the boat back to the lane centre when the player isn't steering.
// It only produces ordinary steering inputs, so recorded races replay exactly.
function assistSteer(b) {
  const err = steerError(race.course, b);
  return err > 0.8 ? IN.LEFT : err < -0.8 ? IN.RIGHT : 0;
}

// Touch and mouse: holding anywhere on the water drives; the buttons steer, set the rate and push.
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touchy');

// Only the finger that started the drive ends it, so tapping a button with the other thumb mid-stroke is safe.
let driveFinger = null;
const driveDown = e => {
  if (game.state !== 'race' || e.target.closest('button')) return;
  if (coxing()) return callPowerTen();   // when coxing, a tap on the water calls a power ten
  AU.init();
  if (e.pointerType === 'mouse') keys.add('Mouse'); else { touchState.drive = true; driveFinger = e.pointerId }
};
const driveUp = e => {
  if (e.pointerType === 'mouse') keys.delete('Mouse');
  else if (e.pointerId === driveFinger) { touchState.drive = false; driveFinger = null }
};
canvas.addEventListener('pointerdown', driveDown);
$('hud').addEventListener('pointerdown', driveDown);
addEventListener('pointerup', driveUp);
addEventListener('pointercancel', driveUp);

function holdButton(id, key) {
  const el = $(id);
  const set = on => e => { e.preventDefault(); e.stopPropagation(); touchState[key] = on; el.classList.toggle('on', on) };
  el.addEventListener('pointerdown', set(true));
  el.addEventListener('pointerup', set(false));
  el.addEventListener('pointerleave', set(false));
  el.addEventListener('pointercancel', set(false));
}
holdButton('tLeft', 'left');
holdButton('tRight', 'right');
holdButton('tPush', 'push');
$('tUp').addEventListener('pointerdown', e => { e.stopPropagation(); changeRate(2) });
$('tDn').addEventListener('pointerdown', e => { e.stopPropagation(); changeRate(-2) });
