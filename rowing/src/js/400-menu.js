/* ===== menus: race setup, results and pause ===== */

const DISTANCES = [250, 500, 1000, 2000];

function segmented(id, items, current, onPick) {
  const el = $(id);
  el.innerHTML = '';
  for (const [value, label] of items) {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', value === current);
    b.onclick = () => { AU.init(); AU.play('ui'); if (game.state === 'menu') setTimeout(() => MUSIC.start(), 50); onPick(value); [...el.children].forEach(c => c.classList.toggle('on', c === b)) };
    el.appendChild(b);
  }
}

const KIND_LABEL = { head: ' (head race)', erg: ' (indoor erg)', knockout: ' (match race)' };
// Head races also come in a long, 4 km version: a procession down the river, like the real thing.
function distanceChoices() {
  const list = settings.kind === 'head' ? [...DISTANCES, 4000] : DISTANCES;
  if (!list.includes(settings.distance)) settings.distance = 2000;
  segmented('segDist', list.map(d => [d, d >= 1000 ? d / 1000 + ' km' : d + ' m']), settings.distance, v => { settings.distance = v; menuChanged() });
}

const currentOpts = () => ({ seed: settings.seed, distance: settings.distance, cls: settings.kind === 'erg' ? '1x' : settings.cls, difficulty: settings.difficulty, lane: 2, kind: settings.kind });

function buildMenu() {
  if (!settings.seed) settings.seed = 1 + Math.floor(Math.random() * 99999);
  segmented('segKind', [['regatta', 'Regatta'], ['head', 'Head race'], ['erg', 'Indoor erg']], settings.kind, v => { settings.kind = v; distanceChoices(); menuChanged() });
  distanceChoices();
  segmented('segCls', Object.entries(BOAT_CLASSES).map(([k, c]) => [k, k]), settings.cls, v => { settings.cls = v; menuChanged() });
  segmented('segDiff', FIELD_ORDER.map(k => [k, DIFFICULTY[k].label]), settings.difficulty, v => { settings.difficulty = v; menuChanged() });
  segmented('segQuality', QUALITY_LABELS.map((l, i) => [i, l]), settings.quality, v => { settings.quality = v; R.quality = v; saveSettings() });
  segmented('segAssist', [[true, 'Assisted'], [false, 'Manual']], settings.assist, v => { settings.assist = v; saveSettings() });
  segmented('segCue', [[true, 'On'], [false, 'Off']], settings.cue, v => { settings.cue = v; saveSettings() });
  segmented('segPlan', Object.entries(PLANS_UI).map(([k, p]) => [k, p.label]), settings.plan, v => { settings.plan = v; saveSettings() });
  segmented('segRole', [['row', 'Row'], ['cox', 'Cox']], settings.role, v => { settings.role = v; saveSettings() });
  segmented('segMusic', [[true, 'On'], [false, 'Off']], settings.music, v => { settings.music = v; saveSettings(); v ? MUSIC.start() : MUSIC.stop() });
  segmented('segCalm', [[false, 'Full'], [true, 'Reduced']], settings.calm, v => { settings.calm = v; saveSettings(); applyAccess() });
  segmented('segText', [[false, 'Normal'], [true, 'Large']], settings.bigText, v => { settings.bigText = v; saveSettings(); applyAccess() });
  applyAccess();
  segmented('segVoice', [[false, 'Text'], [true, 'Spoken']], settings.voice, v => { settings.voice = v; saveSettings() });
  $('seedIn').value = settings.seed;
  $('seedIn').onchange = () => { settings.seed = clamp(parseInt($('seedIn').value) || 1, 1, 999999); menuChanged() };
  $('btnRnd').onclick = () => { settings.seed = 1 + Math.floor(Math.random() * 99999); $('seedIn').value = settings.seed; menuChanged() };
  $('btnRace').onclick = () => startRace(currentOpts());
  $('btnGhost').onclick = () => {
    const o = currentOpts(), pb = getPB(o.distance, o.cls, o.kind);
    if (pb) { const d = decodeRace(pb.code); startRace(d.opts, d.inputs) }
  };
  $('btnDaily').onclick = () => startRace(dailyOpts(), null, 'daily');
  $('btnLearn').onclick = startLearning;
  $('btnTraining').onclick = startTraining;
  $('btnWelcome').onclick = startLearning;
  $('btnBoathouse').onclick = () => openBoathouse();
  $('bhClose').onclick = () => { $('boathouse').classList.add('hide'); $('menu').classList.remove('hide'); closeShowroom() };
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
  $('venue').textContent = c.kind === 'erg' ? `${c.name} · six rowing machines, one big screen` : `${c.name}${c.bends ? ' · winding river, crews start 8 s apart' : ''} · ${{ alpine: 'Mountains · ', city: 'City · ' }[c.theme] || ''}${c.rain ? 'Rain · ' : c.night ? 'Evening, under lights · ' : ''}${windLabel(c.wind)}${c.current ? ` · ${c.current > 0 ? 'following' : 'opposing'} stream` : ''}`;
  // Erg races are always singles, so look records up with the options a race would really use.
  const o = currentOpts(), pb = getPB(o.distance, o.cls, o.kind);
  $('pbLine').textContent = pb ? `Your best over ${o.distance} m in the ${BOAT_CLASSES[o.cls].name.toLowerCase()}${KIND_LABEL[o.kind] || ''}: ${fmtTime(pb.time)} (${pb.venue})` : '';
  $('btnGhost').classList.toggle('hide', !pb);
  renderCareer();
  renderCup();
  const streak = STORE.get('dailyStreak', { n: 0, day: 0 }), today = localDay();
  const best = STORE.get('daily-' + dailyOpts().seed, null);
  $('dailySub').textContent = best ? `Today's best ${fmtTime(best)}` + (streak.n > 1 && streak.day >= today - 1 ? ` · ${streak.n}-day streak` : '') : 'Same race for everyone today';
  $('welcome').classList.toggle('hide', STORE.get('history', []).length > 0 || STORE.get('learned', false));
  showPreview(currentOpts());
}

// After a race, one suggestion for what to try next.
function nextChallenge(race, place) {
  const o = race.opts, i = FIELD_ORDER.indexOf(o.difficulty);
  if (place === 1 && i < FIELD_ORDER.length - 1) return `Next: try a ${DIFFICULTY[FIELD_ORDER[i + 1]].label} field.`;
  if (place === 1) return o.kind === 'regatta' ? 'Next: take on a head race down a winding river.' : 'Next: chase your own ghost with "Race your best".';
  if (race.player.stats.off > race.player.strokes / 3) return 'Next: steadier catches. Try Learn to row, or turn on the catch beep.';
  return place <= 3 ? 'So close. Save a power ten for the last 250 m.' : 'Next: try the Classic rate plan, and keep energy for the finish.';
}

// The daily regatta: same course, boat and field for everyone today.
// Today's date as a day number, in the player's own time zone (the daily race and the streak both use it).
const localDay = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) };

function dailyOpts() {
  const day = localDay();
  return { seed: hashSeed(day, 0xDA1) % 999999 + 1, distance: 1000, cls: CLASS_KEYS[day % 4], difficulty: 'national', lane: 2 };
}

function checkFriendLink() {
  const m = location.hash.match(/r=([A-Za-z0-9_-]+)/);
  if (!m) return;
  try {
    const { opts, inputs } = decodeRace(m[1]);
    const check = withDefaultTune(() => simulateRace(opts, inputs));
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
  const finished = p.finishTime != null, counts = finished && !game.tuned && !tuneEdited() && !['duel', 'replay', 'learn', 'training'].includes(game.mode);
  if (!finished) pbNote = ' · did not finish';
  else if (game.tuned || tuneEdited()) pbNote = ' · tuned physics, not recorded';
  else if (game.mode === 'duel') pbNote = ' · duel';
  else if (game.mode === 'replay' || practiceMode()) pbNote = practiceMode() ? ' · practice' : ' · replay';
  else if (!pb || p.finishTime < pb.time) {
    savePB(opts.distance, opts.cls, opts.kind, { time: p.finishTime, code, venue: race.course.name, date: Date.now() });
    pbNote = pb ? ` · new personal best (was ${fmtTime(pb.time)})` : ' · first personal best';
  }
  if (counts && game.mode === 'daily') {
    postDaily(race, code);
    const key = 'daily-' + opts.seed, best = STORE.get(key, null);
    if (!best || p.finishTime < best) STORE.set(key, p.finishTime);
    // A streak counts days in a row with a daily regatta finished.
    const today = localDay(), s = STORE.get('dailyStreak', { n: 0, day: 0 });
    if (s.day !== today) STORE.set('dailyStreak', { n: s.day === today - 1 ? s.n + 1 : 1, day: today });
  }
  $('resSub').textContent = `${fmtTime(p.finishTime)} · ${race.course.name}, ${opts.distance} m ${BOAT_CLASSES[opts.cls].name.toLowerCase()}${pbNote}`;
  $('resTable').innerHTML = order.map((b, i) => `<tr class="${b === p ? 'me' : ''}"><td>${i + 1}</td><td>${race.course.bends ? 'Start ' + (b.startAt / 8 + 1) : 'Lane ' + (b.lane + 1)}</td><td>${displayName(b)}</td>
    <td class="t">${b.finishTime != null ? fmtTime(b.finishTime) : '–'}</td><td class="t">${i && b.finishTime != null ? '+' + (b.finishTime - win).toFixed(2) : ''}</td></tr>`).join('')
    + (race.ghost?.finishTime ? `<tr><td></td><td></td><td>Ghost</td><td class="t">${fmtTime(race.ghost.finishTime)}</td><td class="t">${(race.ghost.finishTime - p.finishTime >= 0 ? '+' : '') + (race.ghost.finishTime - p.finishTime).toFixed(2)}</td></tr>` : '');
  const s = p.stats, strokes = Math.max(1, s.perfect + s.good + s.off);
  $('resChart').innerHTML = splitChart(race, order[0]) + timingChart();
  $('resBoard').innerHTML = '';
  renderBoard();   // fills the results board for a daily, with working buttons
  $('nextUp').textContent = game.mode === 'training' ? trainingSummary() : counts ? nextChallenge(race, place) : '';
  $('resStats').textContent = `${p.strokes} strokes · average rate ${(p.strokes / p.finishTime * 60).toFixed(1)} · ${Math.round(s.perfect / strokes * 100)}% perfect catches`
    + (s.crabs ? ` · ${s.crabs} crab${s.crabs > 1 ? 's' : ''}` : '') + (s.buoys ? ` · hit the buoys ${s.buoys}×` : '');
  if (race.course.bends && place === 1 && counts) celebrate();
  const careerNote = game.mode === 'career' ? (counts ? careerResult(race, place) : 'Not counted for the season: tuned physics or unfinished.')
    : game.mode === 'cup' ? (counts ? cupResult(race) : 'Not counted for the cup: tuned physics or unfinished.') : '';
  if (counts) recordHistory(race, place);
  const badges = counts ? checkBadges(race, place) : [];
  if (badges.length) setTimeout(() => toast('Badge earned: ' + badges.map(b => b.name).join(', '), 3200), 600);
  $('careerNote').textContent = careerNote;
  $('careerNote').classList.toggle('hide', !careerNote);
  $('btnAgain').textContent = game.mode === 'career' || game.mode === 'cup' && !cup.out && !cup.won ? 'Next race' : game.mode === 'cup' ? 'Enter a new cup' : 'Race again';
  // A duel's code only holds player 1's strokes, so it can't be replayed or shared.
  // Duel and practice codes can't be re-rowed (a code holds one crew in a full field), so no replay or link.
  for (const id of ['btnReplay', 'btnShare']) $(id).classList.toggle('hide', !!race.player2 || practiceMode());
  $('results').classList.remove('hide');
  $('hud').classList.add('hide');
  AU.play(place === 1 ? 'win' : 'finish');
}

async function shareRace() {
  const url = location.href.split('#')[0] + '#r=' + game.lastCode;
  try { await navigator.clipboard.writeText(url); toast('Race link copied: a friend can race your ghost') }
  catch (e) { prompt('Copy this race link', url) }
}
