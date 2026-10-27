/* ===== menus: race setup, results and pause ===== */

const DISTANCES = [250, 500, 1000, 2000];

function segmented(id, items, current, onPick) {
  const el = $(id);
  el.innerHTML = '';
  for (const [value, label] of items) {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', value === current);
    b.onclick = () => { AU.init(); AU.play('ui'); onPick(value); [...el.children].forEach(c => c.classList.toggle('on', c === b)) };
    el.appendChild(b);
  }
}

const currentOpts = () => ({ seed: settings.seed, distance: settings.distance, cls: settings.kind === 'erg' ? '1x' : settings.cls, difficulty: settings.difficulty, lane: 2, kind: settings.kind });

function buildMenu() {
  if (!settings.seed) settings.seed = 1 + Math.floor(Math.random() * 99999);
  segmented('segKind', [['regatta', 'Regatta'], ['head', 'Head race'], ['erg', 'Indoor erg']], settings.kind, v => { settings.kind = v; menuChanged() });
  segmented('segDist', DISTANCES.map(d => [d, d + ' m']), settings.distance, v => { settings.distance = v; menuChanged() });
  segmented('segCls', Object.entries(BOAT_CLASSES).map(([k, c]) => [k, k]), settings.cls, v => { settings.cls = v; menuChanged() });
  segmented('segDiff', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]), settings.difficulty, v => { settings.difficulty = v; menuChanged() });
  segmented('segQuality', QUALITY_LABELS.map((l, i) => [i, l]), settings.quality, v => { settings.quality = v; R.quality = v; saveSettings() });
  segmented('segAssist', [[true, 'Assisted'], [false, 'Manual']], settings.assist, v => { settings.assist = v; saveSettings() });
  segmented('segCue', [[true, 'On'], [false, 'Off']], settings.cue, v => { settings.cue = v; saveSettings() });
  segmented('segCalm', [[false, 'Full'], [true, 'Reduced']], settings.calm, v => { settings.calm = v; saveSettings(); applyAccess() });
  segmented('segText', [[false, 'Normal'], [true, 'Large']], settings.bigText, v => { settings.bigText = v; saveSettings(); applyAccess() });
  applyAccess();
  segmented('segVoice', [[false, 'Text'], [true, 'Spoken']], settings.voice, v => { settings.voice = v; saveSettings() });
  $('seedIn').value = settings.seed;
  $('seedIn').onchange = () => { settings.seed = clamp(parseInt($('seedIn').value) || 1, 1, 999999); menuChanged() };
  $('btnRnd').onclick = () => { settings.seed = 1 + Math.floor(Math.random() * 99999); $('seedIn').value = settings.seed; menuChanged() };
  $('btnRace').onclick = () => startRace(currentOpts());
  $('btnGhost').onclick = () => {
    const pb = getPB(settings.distance, settings.cls, settings.kind);
    if (pb) { const d = decodeRace(pb.code); startRace(d.opts, d.inputs) }
  };
  $('btnDaily').onclick = () => startRace(dailyOpts(), null, 'daily');
  $('btnLearn').onclick = startLearning;
  $('btnBoathouse').onclick = () => openBoathouse();
  $('bhClose').onclick = () => $('boathouse').classList.add('hide');
  $('btnDuel').onclick = () => startRace({ ...currentOpts(), duel: true }, null, 'duel');
  $('btnCareer').onclick = startCareerRace;
  $('btnCup').onclick = startCupRace;
  $('btnSound').onclick = () => { settings.sound = !settings.sound; AU.init(); AU.setOn(settings.sound); saveSettings(); soundLabel() };
  soundLabel();
  checkFriendLink();
  menuChanged();
}

// Reduced motion stills animations and camera shake; large text scales the whole interface.
function applyAccess() {
  document.body.classList.toggle('calm', !!settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.body.classList.toggle('bigText', !!settings.bigText);
}

const soundLabel = () => { $('btnSound').textContent = settings.sound ? '🔊 Sound on' : '🔇 Sound off' };

function menuChanged() {
  saveSettings();
  const c = makeCourse(settings.seed, settings.distance, settings.kind);
  $('venue').textContent = c.kind === 'erg' ? `${c.name} · six rowing machines, one big screen` : `${c.name}${c.bends ? ' · winding river, crews start 8 s apart' : ''} · ${c.rain ? 'Rain · ' : c.night ? 'Evening, under lights · ' : ''}${windLabel(c.wind)}${c.current ? ` · ${c.current > 0 ? 'following' : 'opposing'} stream` : ''}`;
  const pb = getPB(settings.distance, settings.cls, settings.kind);
  $('pbLine').textContent = pb ? `Your best over ${settings.distance} m in the ${BOAT_CLASSES[settings.cls].name.toLowerCase()}${settings.kind === 'head' ? ' (head race)' : ''}: ${fmtTime(pb.time)} (${pb.venue})` : '';
  $('btnGhost').classList.toggle('hide', !pb);
  renderCareer();
  renderCup();
  showPreview(currentOpts());
}

// The daily regatta: same course, boat and field for everyone today.
function dailyOpts() {
  const d = new Date(), day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  return { seed: hashSeed(day, 0xDA1) % 999999 + 1, distance: 1000, cls: CLASS_KEYS[day % 4], difficulty: 'national', lane: 2 };
}

function checkFriendLink() {
  const m = location.hash.match(/r=([A-Za-z0-9_-]+)/);
  if (!m) return;
  try {
    const { opts, inputs } = decodeRace(m[1]);
    const check = simulateRace(opts, inputs);
    const c = check.course;
    $('friendT').textContent = `A friend rowed ${fmtTime(check.player.finishTime)} over ${opts.distance} m (${opts.cls}) on ${c.name}.`;
    $('friend').classList.remove('hide');
    $('btnFriend').onclick = () => startRace(opts, inputs, 'friend');
  } catch (e) { toast('That race link could not be read.') }
}

function showResults(race) {
  const p = race.player, opts = race.opts;
  const order = [...race.boats].sort((a, b) => placeOf(race, a) - placeOf(race, b));
  const win = order[0].finishTime, place = order.indexOf(p) + 1;
  const p2 = race.player2;
  $('resTitle').textContent = p2 ? (placeOf(race, p) < placeOf(race, p2) ? 'Player 1 wins the duel!' : 'Player 2 wins the duel!')
    : place === 1 ? 'Winner!' : `${ordinal(place)} place`;
  const code = encodeRace(opts, race.inputs);
  game.lastCode = code;
  const pb = getPB(opts.distance, opts.cls, opts.kind);
  let pbNote = '';
  const finished = p.finishTime != null, counts = finished && !game.tuned && !tuneEdited() && !['duel', 'replay', 'learn'].includes(game.mode);
  if (!finished) pbNote = ' · did not finish';
  else if (game.tuned || tuneEdited()) pbNote = ' · tuned physics, not recorded';
  else if (game.mode === 'duel') pbNote = ' · duel';
  else if (game.mode === 'replay' || game.mode === 'learn') pbNote = game.mode === 'learn' ? ' · practice' : ' · replay';
  else if (!pb || p.finishTime < pb.time) {
    savePB(opts.distance, opts.cls, opts.kind, { time: p.finishTime, code, venue: race.course.name, date: Date.now() });
    pbNote = pb ? ` · new personal best (was ${fmtTime(pb.time)})` : ' · first personal best';
  }
  if (counts && game.mode === 'daily') {
    const key = 'daily-' + opts.seed, best = STORE.get(key, null);
    if (!best || p.finishTime < best) STORE.set(key, p.finishTime);
  }
  $('resSub').textContent = `${fmtTime(p.finishTime)} · ${race.course.name}, ${opts.distance} m ${BOAT_CLASSES[opts.cls].name.toLowerCase()}${pbNote}`;
  $('resTable').innerHTML = order.map((b, i) => `<tr class="${b === p ? 'me' : ''}"><td>${i + 1}</td><td>${race.course.bends ? 'Start ' + (b.startAt / 8 + 1) : 'Lane ' + (b.lane + 1)}</td><td>${displayName(b)}</td>
    <td class="t">${b.finishTime != null ? fmtTime(b.finishTime) : '–'}</td><td class="t">${i && b.finishTime != null ? '+' + (b.finishTime - win).toFixed(2) : ''}</td></tr>`).join('')
    + (race.ghost?.finishTime ? `<tr><td></td><td></td><td>Ghost</td><td class="t">${fmtTime(race.ghost.finishTime)}</td><td class="t">${(race.ghost.finishTime - p.finishTime >= 0 ? '+' : '') + (race.ghost.finishTime - p.finishTime).toFixed(2)}</td></tr>` : '');
  const s = p.stats, strokes = Math.max(1, s.perfect + s.good + s.off);
  $('resChart').innerHTML = splitChart(race, order[0]) + timingChart();
  $('resStats').textContent = `${p.strokes} strokes · average rate ${(p.strokes / p.finishTime * 60).toFixed(1)} · ${Math.round(s.perfect / strokes * 100)}% perfect catches`
    + (s.crabs ? ` · ${s.crabs} crab${s.crabs > 1 ? 's' : ''}` : '') + (s.buoys ? ` · hit the buoys ${s.buoys}×` : '');
  const careerNote = game.mode === 'career' ? (counts ? careerResult(race, place) : 'Not counted for the season: tuned physics or unfinished.')
    : game.mode === 'cup' ? (counts ? cupResult(race) : 'Not counted for the cup: tuned physics or unfinished.') : '';
  if (counts) recordHistory(race, place);
  const badges = counts ? checkBadges(race, place) : [];
  if (badges.length) setTimeout(() => toast('Badge earned: ' + badges.map(b => b.name).join(', '), 3200), 600);
  $('careerNote').textContent = careerNote;
  $('careerNote').classList.toggle('hide', !careerNote);
  $('btnAgain').textContent = game.mode === 'career' || game.mode === 'cup' && !cup.out && !cup.won ? 'Next race' : 'Race again';
  // A duel's code only holds player 1's strokes, so it can't be replayed or shared.
  // Duel and practice codes can't be re-rowed (a code holds one crew in a full field), so no replay or link.
  for (const id of ['btnReplay', 'btnShare']) $(id).classList.toggle('hide', !!race.player2 || game.mode === 'learn');
  $('results').classList.remove('hide');
  $('hud').classList.add('hide');
  AU.play(place === 1 ? 'win' : 'finish');
}

async function shareRace() {
  const url = location.href.split('#')[0] + '#r=' + game.lastCode;
  try { await navigator.clipboard.writeText(url); toast('Race link copied: a friend can race your ghost') }
  catch (e) { prompt('Copy this race link', url) }
}
