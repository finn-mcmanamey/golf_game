/* ===== main loop: fixed 60 Hz simulation, drawing at whatever rate the screen runs ===== */

const game = { autopilot: location.hash.includes('autopilot'), state: 'menu', mode: 'race', acc: 0, last: 0, time: 0, fastForward: false, lastCode: '', finishShown: false };
let race = null;

function showPreview(opts) {
  race = makeRace(opts);
  if (gl && !showroom.on) setScene(race.course, opts.cls);   // the showroom restores this scene when it closes
}

function startRace(opts, ghostInputs = null, mode = 'race') {
  AU.init();
  game.mode = mode;
  game.opts = opts;
  game.ghostInputs = ghostInputs;
  race = makeRace({ ...opts, ghostInputs });
  if (gl) setScene(race.course, opts.cls);
  targetRate = targetRate2 = 36;
  catchTimes.length = 0;
  splitHistory.length = 0;
  game.acc = 0;
  game.fastForward = false;
  game.finishShown = false;
  game.cue = null;
  game.replay = null;
  game.tuned = false;
  game.lastAtHalf = false;
  game.halfSeen = false;
  resetCalls();
  resetSplits();
  resetCoaching();
  resetCommentary();
  resetCox();
  resetPlan();
  if (mode !== 'replay' && coxing()) toast('You are the cox: steer, set the rate, and press Space (or tap) for a power ten. Three to call.', 4200);
  $('replayTag').classList.toggle('hide', mode !== 'replay');
  $('lesson').classList.add('hide');
  tuneChanged();
  cam.mode = settings.camera;
  $('btnCam').textContent = CAMERA_LABEL[cam.mode];
  MUSIC.stop();
  game.state = 'race';
  for (const id of ['menu', 'results', 'pause']) $(id).classList.add('hide');
  $('hud').classList.remove('hide');
}

const restartRace = () => game.mode === 'career' ? startCareerRace() : game.mode === 'cup' ? startCupRace() : game.mode === 'replay' ? watchReplay() : game.mode === 'learn' ? startLearning() : game.mode === 'training' ? startTraining() : startRace(game.opts, game.ghostInputs, game.mode);

function toMenu() {
  game.state = 'menu';
  for (const id of ['results', 'pause', 'hud']) $(id).classList.add('hide');
  $('menu').classList.remove('hide');
  menuChanged();
  MUSIC.start();
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

// If the device can't keep up early in a race, step the graphics down once (it remembers, like choosing it yourself).
function autoQuality() {
  if (game.state !== 'race' || game.autoQualityDone || STORE.get('autoQualityDone', false) || game.autopilot || R.quality === 0 || race.t < 4 || race.t > 12) return;
  if (fpsMeter.avg < 32) {
    game.autoQualityDone = true;
    STORE.set('autoQualityDone', true);   // once per device: if the first step didn't help, more steps won't either
    settings.quality = R.quality = R.quality - 1;
    saveSettings();
    toast(`Graphics set to ${QUALITY_LABELS[R.quality]} to keep it smooth (change it in Settings)`, 3000);
  }
}

// Frame rate, smoothed, so it's easy to see what a graphics setting costs.
const fpsMeter = { avg: 60, shown: 0 };
function updateFps(dt) {
  if (dt > 0) fpsMeter.avg += (1 / dt - fpsMeter.avg) * 0.05;
  autoQuality();
  if (game.time - fpsMeter.shown > 0.5) { fpsMeter.shown = game.time; $('fps').textContent = Math.round(fpsMeter.avg) + ' fps' }
}

// A haptic tap: through the iPhone app when the game runs inside it (rowing/app), otherwise the browser's vibration.
function buzz(kind) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(kind);
  else navigator.vibrate?.(kind === 'perfect' ? 12 : 40);
}

// Turns what just happened on the water into sound and on-screen feedback.
function handleEvents() {
  for (const b of race.boats) {
    if (b !== race.player) { for (const e of b.events) commentEvent(b, e); b.events.length = 0; continue }
    for (const e of b.events) {
      learnEvent(e);
      if (e.type === 'catch' && b.strokes > 0) coachCatch(e);
      if (e.type === 'catch') {
        AU.play('catch');
        catchTimes.push(race.t);
        if (catchTimes.length > 8) catchTimes.shift();
        if (b.strokes > 0) { if (e.grade === 'perfect') { AU.play('perfect'); buzz('perfect') } showGrade(e.grade) }
      } else if (e.type === 'release') {
        AU.play('release', 0.8);
        if (e.grade === 'crab') { showGrade('crab'); AU.play('crab'); buzz('crab'); cam.shake = 1 }
        else if (e.grade === 'short') showGrade('short');
      } else if (e.type === 'buoy' || e.type === 'bank') { showGrade(e.type); AU.play('buoy'); if (e.type === 'bank') cam.shake = 0.6 }
      else if (e.type === 'finish') {
        AU.play(placeOf(race, b) === 1 ? 'cheer' : 'finish');
        buzz('finish');
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
    const slow = game.replay && photoFinishSlowdown(race);
    simulate(dt * (game.fastForward ? 8 : slow || 1), () => game.replay ? (game.replay[race.tick] ?? packInput(0, 18)) : readInput(), false, readInput2);
    frameBlend.alpha = clamp(game.acc / TUNE.dt, 0, 1);
    startSequence();
    const p = race.player, d = race.course.distance;
    AU.ambient(p.v, Math.min(1, smooth(d - 400, d, p.x) * (p.finishTime != null ? 0.6 : 1) + comm.excite * 0.5), race.course.rain ? 1 : 0, p.phase === 'recover' && race.started ? 1 : 0);
    if (race.done) { game.state = 'results'; game.replay ? showReplayEnd() : showResults(race) }
    if (!game.halfSeen && race.player.x > race.course.distance / 2) { game.halfSeen = true; game.lastAtHalf = placeOf(race, race.player) === race.boats.length && race.boats.length > 1 }
    if (game.state === 'race') { updateHud(race); updateHud2(race); drawForceCurve(); updateCommentary(race); if (!game.replay && !practiceMode()) updateCalls(race); updateLearning(race); updateTraining(race) }
  } else if ((game.state === 'menu' || game.state === 'results') && race) {
    // Behind the menu a demo race rows itself; after a race the field rows on past the line.
    simulate(dt, () => packInput(race.started ? autoRow(race.player) : 0, 35), true);
    frameBlend.alpha = clamp(game.acc / TUNE.dt, 0, 1);
    if (game.state === 'menu' && race.done) showPreview(currentOpts());
  }

  if (gl && showroom.on) {
    animateShowroom(dt, game.time);
    renderFrame(showroom.race, game.time, dt);
  } else if (gl && race) {
    if (game.state === 'menu') menuCamera(dt);
    else if (photo.on) photoCamera();
    else {
      // Wide shots frame both crews in a duel or match race; on-board shots stay with your boat.
      const pair = (race.player2 || race.course.kind === 'knockout') && !['rower', 'chase'].includes(cam.mode);
      updateCamera(pair ? duelCameraBoat(race) : race.player, race.t, dt);
    }
    renderFrame(race, game.time, dt);
    updateFps(dt);
  }
  requestAnimationFrame(frame);
}

// Steps the race at 60 Hz for the time that has passed. `quiet` skips sound and on-screen feedback.
function simulate(dt, inputFor, quiet = false, input2For = () => 0) {
  game.acc += dt;
  let steps = 0;
  while (game.acc >= TUNE.dt && steps++ < 400) {
    game.acc -= TUNE.dt;
    rememberPoses([...race.boats, race.ghost]);
    stepRace(race, inputFor(), input2For());
    if (!quiet && tuneEdited()) game.tuned = true;   // tuned at any moment means this race isn't a record
    recordSplits(race);
    if (!quiet) sampleForce(race.player);
    if (quiet) { for (const b of race.boats) b.events.length = 0; if (race.ghost) race.ghost.events.length = 0 }
    else handleEvents();
    if (race.falseStart && !quiet) {
      toast('False start! Wait for the horn.', 2200);
      restartRace();
      break;
    }
    if (race.done && !quiet) break;
  }
}

// In a replay, the last metres of a close finish play in slow motion.
function photoFinishSlowdown(race) {
  const p = race.player, left = race.course.distance - p.x;
  if (left > 25 || left < -3) return 0;
  const close = race.boats.some(b => b !== p && Math.abs(b.x - p.x) < Math.max(1.5, p.v * 0.6));
  return close ? 0.25 : 0;
}

function watchReplay() {
  const { opts, inputs } = decodeRace(game.lastCode);
  if (game.mode !== 'replay') game.beforeReplay = { mode: game.mode, opts: game.opts, ghostInputs: game.ghostInputs };
  startRace(opts, null, 'replay');
  game.replay = inputs;
  cam.mode = 'tv';
  toast('Replay', 1200);
}

function showReplayEnd() {
  game.replay = null;
  Object.assign(game, game.beforeReplay || { mode: 'race' });
  $('hud').classList.add('hide');
  $('results').classList.remove('hide');
}

// In a duel or a match race the camera frames both crews: it follows a point between them.
function duelCameraBoat(race) {
  const other = race.player2 || race.boats.find(x => x !== race.player) || race.player;
  const a = pose(race.player), b = pose(other);
  return { ...race.player, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 - 3, yaw: 0 };
}

// On the menu the camera drifts slowly along the start, showing off the venue.
function menuCamera(dt) {
  if (race.started || race.course.kind === 'erg') {
    const lead = race.boats.reduce((a, b) => b.x > a.x ? b : a);
    updateCamera(lead, race.t, dt);
    return;
  }
  const t = game.time * 0.05;
  const eye = [-60 + Math.sin(t) * 40, 12 + Math.sin(t * 0.7) * 3, 70], at = [20 + Math.sin(t) * 30, 0, -10];
  const k = 1 - Math.exp(-dt * 2);
  for (let i = 0; i < 3; i++) { cam.eye[i] += (eye[i] - cam.eye[i]) * k; cam.at[i] += (at[i] - cam.at[i]) * k }
  cam.fov = 0.85;
}

$('btnAgain').onclick = () => restartRace();
$('btnReplay').onclick = watchReplay;
$('btnMenu').onclick = toMenu;
$('btnShare').onclick = shareRace;
$('btnResume').onclick = togglePause;
$('btnRestart').onclick = () => { $('pause').classList.add('hide'); restartRace() };
$('btnQuit').onclick = toMenu;
$('btnCam').onclick = e => { e.stopPropagation(); cycleCamera() };
$('btnPause').onclick = e => { e.stopPropagation(); togglePause() };
$('btnPhoto').onclick = e => { e.stopPropagation(); togglePhoto() };
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'race') togglePause() });

if (gl) {
  buildMenu();
  requestAnimationFrame(frame);
}
