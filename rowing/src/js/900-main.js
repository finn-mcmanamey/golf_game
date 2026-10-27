/* ===== main loop: fixed 60 Hz simulation, drawing at whatever rate the screen runs ===== */

const game = { state: 'menu', mode: 'race', acc: 0, last: 0, time: 0, fastForward: false, lastCode: '', finishShown: false };
let race = null;

function showPreview(opts) {
  race = makeRace(opts);
  if (gl) setScene(race.course, opts.cls);
}

function startRace(opts, ghostInputs = null, mode = 'race') {
  AU.init();
  game.mode = mode;
  game.opts = opts;
  game.ghostInputs = ghostInputs;
  race = makeRace({ ...opts, ghostInputs });
  if (gl) setScene(race.course, opts.cls);
  targetRate = 36;
  catchTimes.length = 0;
  splitHistory.length = 0;
  game.acc = 0;
  game.fastForward = false;
  game.finishShown = false;
  game.cue = null;
  cam.mode = settings.camera;
  $('btnCam').textContent = CAMERA_LABEL[cam.mode];
  game.state = 'race';
  for (const id of ['menu', 'results', 'pause']) $(id).classList.add('hide');
  $('hud').classList.remove('hide');
}

const restartRace = () => startRace(game.opts, game.ghostInputs, game.mode);

function toMenu() {
  game.state = 'menu';
  for (const id of ['results', 'pause', 'hud']) $(id).classList.add('hide');
  $('menu').classList.remove('hide');
  menuChanged();
}

function togglePause() {
  if (game.state === 'race') { game.state = 'paused'; $('pause').classList.remove('hide') }
  else if (game.state === 'paused') { game.state = 'race'; $('pause').classList.add('hide'); game.last = performance.now() }
}

function cycleCamera() {
  const label = nextCamera();
  settings.camera = cam.mode;
  saveSettings();
  $('btnCam').textContent = label;
  toast(label + ' camera', 900);
}

function cycleQuality() {
  settings.quality = R.quality = (R.quality + 1) % QUALITY_LABELS.length;
  saveSettings();
  toast('Graphics: ' + QUALITY_LABELS[R.quality], 900);
}

// Frame rate, smoothed, so it's easy to see what a graphics setting costs.
const fpsMeter = { avg: 60, shown: 0 };
function updateFps(dt) {
  if (dt > 0) fpsMeter.avg += (1 / dt - fpsMeter.avg) * 0.05;
  if (game.time - fpsMeter.shown > 0.5) { fpsMeter.shown = game.time; $('fps').textContent = Math.round(fpsMeter.avg) + ' fps' }
}

// Turns what just happened on the water into sound and on-screen feedback.
function handleEvents() {
  for (const b of race.boats) {
    if (b !== race.player) { b.events.length = 0; continue }
    for (const e of b.events) {
      if (e.type === 'catch') {
        AU.play('catch');
        catchTimes.push(race.t);
        if (catchTimes.length > 8) catchTimes.shift();
        if (b.strokes > 0) { if (e.grade === 'perfect') AU.play('perfect'); showGrade(e.grade) }
      } else if (e.type === 'release') {
        AU.play('release', 0.8);
        if (e.grade === 'crab') { showGrade('crab'); AU.play('crab'); cam.shake = 1 }
        else if (e.grade === 'short') showGrade('short');
      } else if (e.type === 'buoy') { showGrade('buoy'); AU.play('buoy') }
      else if (e.type === 'finish') {
        AU.play('finish');
        game.finishShown = true;
        game.finishMsgUntil = game.time + 3;
      }
    }
    b.events.length = 0;
  }
  if (race.ghost) race.ghost.events.length = 0;
}

// Start sequence: crews introduced, "Attention", then the horn.
function startSequence() {
  const t = race.t;
  let msg = '';
  if (t < race.attentionAt) msg = t < race.attentionAt - 1.2 ? race.course.name : 'Sit ready';
  else if (t < 0) msg = 'Attention';
  else if (t < 1.1) msg = 'GO!';
  if (game.cue !== msg) {
    if (msg === 'Attention') AU.play('attention');
    if (msg === 'GO!') AU.play('go');
    game.cue = msg;
  }
  if (game.finishShown && game.time < game.finishMsgUntil) msg = `${ordinal(placeOf(race, race.player))} · ${fmtTime(race.player.finishTime)}`;
  else if (race.player.finishTime != null) msg = '';
  setStartMsg(msg);
}

function frame(now) {
  const dt = Math.min(0.1, (now - (game.last || now)) / 1000);
  game.last = now;
  game.time += dt;

  if (game.state === 'race' && race) {
    game.acc += dt * (game.fastForward ? 8 : 1);
    let steps = 0;
    while (game.acc >= TUNE.dt && steps++ < 400) {
      game.acc -= TUNE.dt;
      rememberPoses([...race.boats, race.ghost]);
      stepRace(race, readInput());
      handleEvents();
      if (race.falseStart) {
        toast('False start! Wait for the horn.', 2200);
        restartRace();
        break;
      }
      if (race.done) break;
    }
    frameBlend.alpha = clamp(game.acc / TUNE.dt, 0, 1);
    startSequence();
    const p = race.player, d = race.course.distance;
    AU.ambient(p.v, smooth(d - 400, d, p.x) * (p.finishTime != null ? 0.6 : 1));
    if (race.done) { game.state = 'results'; showResults(race) }
    if (game.state === 'race') updateHud(race);
  }

  if (gl && race) {
    if (game.state === 'menu') menuCamera(dt);
    else updateCamera(race.player, race.t, dt);
    renderFrame(race, game.time, dt);
    updateFps(dt);
  }
  requestAnimationFrame(frame);
}

// On the menu the camera drifts slowly along the start, showing off the venue.
function menuCamera(dt) {
  const t = game.time * 0.05;
  const eye = [-60 + Math.sin(t) * 40, 12 + Math.sin(t * 0.7) * 3, 70], at = [20 + Math.sin(t) * 30, 0, -10];
  const k = 1 - Math.exp(-dt * 2);
  for (let i = 0; i < 3; i++) { cam.eye[i] += (eye[i] - cam.eye[i]) * k; cam.at[i] += (at[i] - cam.at[i]) * k }
  cam.fov = 0.85;
}

$('btnAgain').onclick = () => restartRace();
$('btnMenu').onclick = toMenu;
$('btnShare').onclick = shareRace;
$('btnResume').onclick = togglePause;
$('btnRestart').onclick = () => { $('pause').classList.add('hide'); restartRace() };
$('btnQuit').onclick = toMenu;
$('btnCam').onclick = e => { e.stopPropagation(); cycleCamera() };
$('btnPause').onclick = e => { e.stopPropagation(); togglePause() };
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'race') togglePause() });

if (gl) {
  buildMenu();
  requestAnimationFrame(frame);
}
