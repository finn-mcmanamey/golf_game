/* ===== Learn to row: a coach on the bank walks a new player through one skill at a time ===== */

const LESSONS = [
  { say: 'Hold <kbd>Space</kbd> (or touch and hold) to drive the blades through the water.', done: s => s.drives >= 1 },
  { say: 'Let go as the handle reaches the yellow <b>finish</b> zone. A clean release keeps the boat running.', done: s => s.clean >= 2 },
  { say: 'The slide comes forward on its own. Press again just as it reaches the green <b>catch</b> zone.', done: s => s.perfectRun >= 3 },
  { say: 'Three perfect strokes in a row build <b>swing</b>: the blue bar. Full swing makes the boat faster.', done: s => s.swing >= 0.95 },
  { say: 'Raise the stroke rate with <kbd>W</kbd> (lower it with <kbd>S</kbd>). Faster rates go quicker but burn energy.', done: s => s.rateUps >= 2 },
  { say: 'Steer with <kbd>A</kbd> and <kbd>D</kbd>. It works best while the blades are in the water.', done: s => s.steers >= 20 },
  { say: 'Hold <kbd>Shift</kbd> for a <b>power ten</b>. It drains energy fast: save it for the finish.', done: s => s.pushes >= 30 },
  { say: "You're ready. Try a 500 m race against a club field!", done: () => false },
];

const learn = { step: 0, s: null };

function startLearning() {
  learn.step = 0;
  learn.s = { drives: 0, clean: 0, perfectRun: 0, swing: 0, rateUps: 0, steers: 0, pushes: 0, rate: 0 };
  startRace({ seed: settings.seed, distance: 2000, cls: '1x', difficulty: 'club', lane: 2, solo: true }, null, 'learn');
  showLesson();
}

function showLesson() {
  const el = $('lesson');
  el.innerHTML = `<small>Coach · ${learn.step + 1} of ${LESSONS.length}</small>${LESSONS[learn.step].say}`;
  el.classList.remove('hide');
}

// Watches the player's strokes and moves on once each lesson is shown.
function updateLearning(race) {
  if (game.mode !== 'learn' || !race.started) return;
  const s = learn.s, p = race.player;
  s.swing = p.swing;
  if (p.rate > s.rate && s.rate) s.rateUps++;
  s.rate = p.rate;
  if (p.lastBits & (IN.LEFT | IN.RIGHT)) s.steers++;
  if (p.lastBits & IN.PUSH) s.pushes++;
  if (LESSONS[learn.step].done(s)) {
    learn.step++;
    AU.play('perfect');
    showLesson();
  }
}

function learnEvent(e) {
  if (game.mode !== 'learn') return;
  const s = learn.s;
  if (e.type === 'catch') { s.drives++; s.perfectRun = e.grade === 'perfect' ? s.perfectRun + 1 : 0 }
  if (e.type === 'release' && e.grade === 'clean') s.clean++;
}
