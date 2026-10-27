/* ===== gamepads: A drives, stick or d-pad steers, bumpers set the rate, right trigger pushes =====
   Read once per tick into the same touchState the touch buttons use, so everything else is unchanged. */

const pad = { prev: [], connected: false };
const padState = { drive: false, left: false, right: false, push: false };   // separate from touch, so neither overwrites the other

addEventListener('gamepadconnected', () => { pad.connected = true; toast('Controller connected: A to drive, bumpers for rate, RT to push', 2600) });
addEventListener('gamepaddisconnected', () => { pad.connected = false; pad.prev = []; Object.keys(padState).forEach(k => padState[k] = false) });

function pollGamepad() {
  if (!pad.connected || !navigator.getGamepads) return;
  const gp = [...navigator.getGamepads()].find(Boolean);
  if (!gp) return;
  const b = i => !!gp.buttons[i]?.pressed, was = i => !!pad.prev[i];
  const pressed = i => b(i) && !was(i);
  const stick = gp.axes[0] || 0;
  padState.drive = b(0);
  padState.left = b(14) || stick < -0.4;
  padState.right = b(15) || stick > 0.4;
  padState.push = b(7) || (gp.buttons[7]?.value ?? 0) > 0.5;
  if (game.state === 'race') {
    if (pressed(5)) changeRate(2);
    if (pressed(4)) changeRate(-2);
    if (pressed(3)) cycleCamera();
    if (pressed(0) && coxing()) callPowerTen();
  }
  if (pressed(9)) togglePause();
  if (pressed(0) && game.state === 'results' && game.time - (game.resultsAt || 0) > 1.2) restartRace();   // not the stroke that was still going
  pad.prev = gp.buttons.map(x => x.pressed);
}
