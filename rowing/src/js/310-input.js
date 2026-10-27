/* ===== input: keyboard, mouse and touch become one packed input per tick ===== */

const keys = new Set();
const touchState = { drive: false, left: false, right: false, push: false };
let targetRate = 34;

function changeRate(d) {
  targetRate = clamp(targetRate + d, RATE_MIN + 2, RATE_MAX - 2);
  AU.play('tick');
}

function readInput() {
  let bits = 0;
  if (keys.has('Space') || keys.has('Mouse') || touchState.drive) bits |= IN.DRIVE;
  if (keys.has('KeyA') || keys.has('ArrowLeft') || touchState.left) bits |= IN.LEFT;
  if (keys.has('KeyD') || keys.has('ArrowRight') || touchState.right) bits |= IN.RIGHT;
  if (settings.assist && !(bits & (IN.LEFT | IN.RIGHT)) && race) bits |= assistSteer(race.player);
  if (keys.has('ShiftLeft') || keys.has('ShiftRight') || touchState.push) bits |= IN.PUSH;
  return packInput(bits, targetRate);
}

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  AU.init();
  if (!e.repeat) onKey(e.code);
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); Object.keys(touchState).forEach(k => touchState[k] = false) });

function onKey(code) {
  if (game.state !== 'race') return;
  if (code === 'KeyW' || code === 'ArrowUp') changeRate(2);
  if (code === 'KeyS' || code === 'ArrowDown') changeRate(-2);
  if (code === 'KeyC') cycleCamera();
  if (code === 'KeyG') cycleQuality();
  if (code === 'Escape' || code === 'KeyP') togglePause();
  if (code === 'Enter' && race.player.finishTime != null) game.fastForward = true;
}

// Steering assist nudges the boat back to the lane centre when the player isn't steering.
// It only produces ordinary steering inputs, so recorded races replay exactly.
function assistSteer(b) {
  const err = (b.z - laneZ(b.lane)) + b.yaw * 10;
  return err > 0.8 ? IN.LEFT : err < -0.8 ? IN.RIGHT : 0;
}

// Touch and mouse: holding anywhere on the water drives; the buttons steer, set the rate and push.
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touchy');

const driveDown = e => {
  if (game.state !== 'race' || e.target.closest('button')) return;
  AU.init();
  if (e.pointerType === 'mouse') keys.add('Mouse'); else touchState.drive = true;
};
const driveUp = e => { if (e.pointerType === 'mouse') keys.delete('Mouse'); else touchState.drive = false };
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
