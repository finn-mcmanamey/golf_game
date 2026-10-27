/* ===== gamepads: A drives, stick or d-pad steers, bumpers set the rate, right trigger pushes =====
   Read once per tick into the same touchState the touch buttons use, so everything else is unchanged. */

const pad = { prev: [], connected: false };

addEventListener('gamepadconnected', () => { pad.connected = true; toast('Controller connected: A to drive, bumpers for rate, RT to push', 2600) });
addEventListener('gamepaddisconnected', () => { pad.connected = false });

function pollGamepad() {
  if (!pad.connected || !navigator.getGamepads) return;
  const gp = [...navigator.getGamepads()].find(Boolean);
  if (!gp) return;
  const b = i => !!gp.buttons[i]?.pressed, was = i => !!pad.prev[i];
  const pressed = i => b(i) && !was(i);
  const stick = gp.axes[0] || 0;
  touchState.drive = b(0);
  touchState.left = b(14) || stick < -0.4;
  touchState.right = b(15) || stick > 0.4;
  touchState.push = b(7) || (gp.buttons[7]?.value ?? 0) > 0.5;
  if (game.state === 'race') {
    if (pressed(5)) changeRate(2);
    if (pressed(4)) changeRate(-2);
    if (pressed(3)) cycleCamera();
    if (pressed(0) && coxing()) callPowerTen();
  }
  if (pressed(9)) togglePause();
  if (pressed(0) && game.state === 'results') restartRace();
  pad.prev = gp.buttons.map(x => x.pressed);
}
