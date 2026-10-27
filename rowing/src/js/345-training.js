/* ===== training pieces: a coach sets three pieces at target rates, with easy paddling between =====
   Scored on holding the rate and clean catches. A solo practice outing, so it isn't recorded as a race. */

const PIECES = [
  { from: 50, to: 300, rate: 28, name: 'Piece 1 · steady state' },
  { from: 450, to: 700, rate: 34, name: 'Piece 2 · race pace' },
  { from: 850, to: 1100, rate: 40, name: 'Piece 3 · sprint' },
];
const training = { done: new Set(), scores: [], piece: -1, strokes: 0, onRate: 0, perfect: 0, lastStrokes: 0 };
const practiceMode = () => game.mode === 'learn' || game.mode === 'training';

function startTraining() {
  Object.assign(training, { done: new Set(), scores: [], piece: -1, strokes: 0, onRate: 0, perfect: 0, lastStrokes: 0 });
  startRace({ seed: settings.seed, distance: 1150, cls: settings.kind === 'erg' ? '1x' : settings.cls, difficulty: 'club', lane: 2, solo: true }, null, 'training');
  showCoachPanel('Paddle up to the first piece. Hold the rate the coach asks for.');
}

function showCoachPanel(html) {
  const el = $('lesson');
  el.innerHTML = `<small>Coach · training</small>${html}`;
  el.classList.remove('hide');
}

// Called every frame: which piece we're in, and how the current one is going.
function updateTraining(race) {
  if (game.mode !== 'training' || !race.started) return;
  const p = race.player, i = PIECES.findIndex(pc => p.x >= pc.from && p.x < pc.to);
  if (i !== training.piece) {
    if (training.piece >= 0 && !training.done.has(training.piece)) finishPiece();
    training.piece = i;
    Object.assign(training, { strokes: 0, onRate: 0, perfect: 0, lastStrokes: p.strokes });
    if (i >= 0) { AU.play('attention'); showCoachPanel(`<b>${PIECES[i].name}</b>: rate ${PIECES[i].rate}, ${PIECES[i].to - PIECES[i].from} m. Go!`) }
    else showCoachPanel(training.scores.length < PIECES.length ? 'Easy paddling. Get your breath back.' : 'Session done. Paddle home!');
  }
  if (i >= 0 && p.strokes > training.lastStrokes) {
    // One more stroke in the piece: was it at the asked rate (within 2), and was the catch clean?
    training.lastStrokes = p.strokes;
    training.strokes++;
    if (Math.abs(liveRate(p, race.t) - PIECES[i].rate) <= 2) training.onRate++;
    if (p.catchGrade === 'perfect') training.perfect++;
    const pc = PIECES[i], left = Math.max(0, Math.round(pc.to - p.x));
    showCoachPanel(`<b>${pc.name}</b>: rate ${pc.rate} · you're at ${Math.round(liveRate(p, race.t))} · ${left} m to go`);
  }
}

function finishPiece() {
  const n = Math.max(1, training.strokes), rate = training.onRate / n, clean = training.perfect / n;
  const score = Math.round((rate * 0.6 + clean * 0.4) * 100);
  training.scores.push(score);
  training.done.add(training.piece);   // each piece scores once, even if the boat drifts back into it
  toast(`${PIECES[training.piece].name.split(' · ')[0]}: ${score}/100 · on rate ${Math.round(rate * 100)}% · clean ${Math.round(clean * 100)}%`, 3600);
}

function trainingSummary() {
  if (game.mode !== 'training' || !training.scores.length) return '';
  const avg = Math.round(training.scores.reduce((a, b) => a + b, 0) / training.scores.length);
  const best = STORE.get('trainingBest', 0);
  if (avg > best) STORE.set('trainingBest', avg);
  return `Training score ${avg}/100 (pieces ${training.scores.join(' · ')})${avg > best ? ' · your best session yet!' : ` · best ${best}`}`;
}
