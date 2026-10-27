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

const KIND_LABEL = { boatrace: ' (Boat Race)', bumps: ' (bumps)', head: ' (head race)', erg: ' (indoor erg)', knockout: ' (match race)' };
// Head races also come in a long, 4 km version: a procession down the river, like the real thing.
function distanceChoices() {
  const list = settings.kind === 'head' ? [...DISTANCES, 4000] : settings.kind === 'bumps' ? DISTANCES.slice(1) : DISTANCES;
  if (!list.includes(settings.distance)) settings.distance = 2000;
  segmented('segDist', list.map(d => [d, d >= 1000 ? d / 1000 + ' km' : d + ' m']), settings.distance, v => { settings.distance = v; menuChanged() });
}

const currentOpts = () => ({ seed: settings.seed, distance: settings.distance, cls: settings.kind === 'erg' ? '1x' : settings.cls, difficulty: settings.difficulty, lane: 2, kind: settings.kind });

function buildMenu() {
  if (!settings.seed) settings.seed = 1 + Math.floor(Math.random() * 99999);
  segmented('segKind', [['regatta', 'Regatta'], ['head', 'Head race'], ['bumps', 'Bumps'], ['erg', 'Indoor erg']], settings.kind, v => { settings.kind = v; distanceChoices(); menuChanged() });
  distanceChoices();
  segmented('segCls', Object.entries(BOAT_CLASSES).map(([k, c]) => [k, k]), settings.cls, v => { settings.cls = v; menuChanged() });
  segmented('segDiff', FIELD_ORDER.map(k => [k, DIFFICULTY[k].label]), settings.difficulty, v => { settings.difficulty = v; menuChanged() });
  segmented('segQuality', QUALITY_LABELS.map((l, i) => [i, l]), settings.quality, v => { settings.quality = v; R.quality = v; saveSettings() });
  segmented('segAssist', [[true, 'Assisted'], [false, 'Manual']], settings.assist, v => { settings.assist = v; saveSettings() });
  segmented('segCue', [[true, 'On'], [false, 'Off']], settings.cue, v => { settings.cue = v; saveSettings() });
  segmented('segPace', PACE_CHOICES, settings.pace, v => { settings.pace = v; saveSettings() });
  segmented('segPlan', Object.entries(PLANS_UI).map(([k, p]) => [k, p.label]), settings.plan, v => { settings.plan = v; saveSettings() });
  segmented('segRole', [['row', 'Row'], ['cox', 'Cox']], settings.role, v => { settings.role = v; saveSettings() });
  segmented('segMusic', [[true, 'On'], [false, 'Off']], settings.music, v => { settings.music = v; saveSettings(); v ? MUSIC.start() : MUSIC.stop() });
  segmented('segSpeed', [[1, 'Full'], [0.75, '75%']], settings.speed || 1, v => { settings.speed = v; saveSettings() });
  segmented('segOneBtn', [[false, 'Full timing'], [true, 'One button']], settings.oneButton, v => { settings.oneButton = v; saveSettings() });
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
  $('venue').textContent = c.kind === 'erg' ? `${c.name} · six rowing machines, one big screen` : `${c.name}${c.kind === 'bumps' ? ' · single file, catch the crew ahead before the crew behind catches you' : c.bends ? ' · winding river, crews start 8 s apart' : ''} · ${{ alpine: 'Mountains · ', city: 'City · ', coast: 'Coast · ' }[c.theme] || ''}${c.rain ? 'Rain · ' : c.night ? 'Evening, under lights · ' : ''}${windLabel(c.wind)}${c.current ? ` · ${c.current > 0 ? 'following' : 'opposing'} stream${c.bends && c.kind === 'head' ? (c.current > 0 ? ', fastest mid-river' : ', slacker by the banks') : ''}` : ''}`;
  // Erg races are always singles, so look records up with the options a race would really use.
  const o = currentOpts(), pb = getPB(o.distance, o.cls, o.kind);
  const here = STORE.get('history', []).filter(r => r.seed === o.seed && r.distance === o.distance && r.cls === o.cls && (r.kind || 'regatta') === o.kind);
  if (here.length) $('venue').textContent += ` · your best here ${fmtTime(Math.min(...here.map(r => r.time)))}`;
  $('pbLine').textContent = pb ? `Your best over ${o.distance} m in the ${BOAT_CLASSES[o.cls].name.toLowerCase()}${KIND_LABEL[o.kind] || ''}: ${fmtTime(pb.time)} (${pb.venue})` : '';
  $('btnGhost').classList.toggle('hide', !pb);
  renderCareer();
  renderCup();
  renderWeek();
  renderBoatRace();
  showCalCard();
  const streak = streakNow(), best = STORE.get('daily-' + dailyOpts().seed, null);
  const shields = streak.shields ? ` · ${'🛡'.repeat(streak.shields)}` : '';
  // Before today's row: the streak at stake is the reason to row; after it, today's best.
  $('dailySub').textContent = best ? `Today's best ${fmtTime(best)}` + (streak.n > 1 ? ` · ${streak.n}-day streak` : '') + shields
    : streak.n > 1 ? `🔥 ${streak.n}-day streak: row today to keep it${shields}` : `Today: ${dailyLabel(dailyOpts())}, same for everyone`;
  // Tomorrow's format, when it differs from today's: something to come back for.
  const next = dailyOptsFor(localDay() + 1);
  if (next.kind !== dailyOpts().kind) $('dailySub').textContent += ` · Tomorrow: ${dailyLabel(next)}`;
  $('welcome').classList.toggle('hide', STORE.get('history', []).length > 0 || STORE.get('learned', false));
  showPreview(currentOpts());
}

// After a race, one suggestion for what to try next.
function nextChallenge(race, place) {
  const o = race.opts, i = FIELD_ORDER.indexOf(o.difficulty);
  if (place === 1 && i < FIELD_ORDER.length - 1) { const next = DIFFICULTY[FIELD_ORDER[i + 1]].label; return `Next: try ${/^[AEIOU]/.test(next) ? 'an' : 'a'} ${next} field.` }
  if (place === 1) return o.kind === 'regatta' ? 'Next: take on a head race down a winding river.' : 'Next: chase your own ghost with "Race your best".';
  if (race.player.stats.off > race.player.strokes / 3) return 'Next: steadier catches. Try Learn to row, or turn on the catch beep.';
  return place <= 3 ? 'So close. Save a power ten for the last 250 m.' : 'Next: try the Classic rate plan, and keep energy for the finish.';
}

// The daily regatta: same course, boat and field for everyone today.
// Today's date as a day number, in the player's own time zone (the daily race and the streak both use it).
const localDay = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) };

// The daily streak, with shields (F-104): one per 7 days in a row, at most 2, each covering one missed day.
const STREAK_SHIELD_EVERY = 7, STREAK_SHIELDS_MAX = 2;
function streakNow() {
  const s = STORE.get('dailyStreak', { n: 0, day: 0 }), shields = s.shields || 0, missed = localDay() - s.day - 1;
  return { n: missed <= shields ? s.n : 0, shields, doneToday: s.day === localDay() };
}

// After a daily: extend the streak, spending shields on missed days if there are enough; returns shields spent.
function extendStreak() {
  const s = STORE.get('dailyStreak', { n: 0, day: 0 }), today = localDay();
  if (s.day === today) return 0;
  const missed = Math.max(0, today - s.day - 1), kept = s.n > 0 && missed <= (s.shields || 0);
  const n = kept ? s.n + 1 : 1, shields = Math.min(STREAK_SHIELDS_MAX, (kept ? (s.shields || 0) - missed : 0) + (n % STREAK_SHIELD_EVERY === 0 ? 1 : 0));
  STORE.set('dailyStreak', { n, day: today, shields });
  return kept ? missed : 0;
}

// The daily race (F-115): a regatta most days, indoors on Wednesdays, the river at weekends. Rules are pinned per
// format, so every row on a day's board was rowed under the same physics. Formats began the day after they shipped,
// so no day's board changed mid-day.
const DAILY_FORMATS_FROM = 20754;   // 28 Oct 2026, as a day number
function dailyOptsFor(day) {
  const base = { seed: hashSeed(day, 0xDA1) % 999999 + 1, distance: 1000, cls: CLASS_KEYS[day % 4], difficulty: 'national', lane: 2, rules: 3, kind: 'regatta' };
  if (day < DAILY_FORMATS_FROM) return base;
  const weekday = (day + 4) % 7;   // day 0 was a Thursday; 0 = Sunday
  if (weekday === 3) return { ...base, kind: 'erg', cls: '1x', distance: 500 };
  if (weekday === 0 || weekday === 6) return { ...base, kind: 'head', rules: 6 };   // streams and all
  return base;
}
const dailyOpts = () => dailyOptsFor(localDay());
const dailyLabel = o => `${{ regatta: 'Regatta', erg: 'Indoor erg', head: 'Head race' }[o.kind]} · ${o.distance >= 1000 ? o.distance / 1000 + ' km' : o.distance + ' m'} ${o.cls}`;

function checkFriendLink() {
  const m = location.hash.match(/r=([A-Za-z0-9_-]+)/);
  if (m) loadFriendCode(m[1]);
}

// A friend's race from a link or a pasted code (F-107): checked by re-rowing it, then offered as a ghost.
function loadFriendCode(code) {
  try {
    const { opts, inputs } = decodeRace(code);
    const check = withDefaultTune(() => simulateRace(opts, inputs));
    const c = check.course;
    $('friendT').textContent = check.order ? `A friend ${bumpOutcome(check, check.player).replace('!', '').toLowerCase()} in a ${opts.distance} m bumps race (${opts.cls}) on ${c.name}.`
      : `A friend rowed ${fmtTime(check.player.finishTime)} over ${opts.distance} m (${opts.cls}) on ${c.name}.`;
    $('friend').classList.remove('hide');
    $('btnFriend').onclick = () => startRace(opts, inputs, 'friend');
    return true;
  } catch (e) { toast('That race code could not be read.'); return false }
}

function showResults(race) {
  const p = race.player, opts = race.opts;
  const order = [...race.boats].sort((a, b) => placeOf(race, a) - placeOf(race, b));
  const win = order[0].finishTime;
  // In a live race the field is your friends, not the bots: count the crews already home ahead of you.
  const place = game.mode === 'live' ? 1 + [...live.remote.values()].filter(r => r.finishTime != null && r.finishTime < p.finishTime).length : order.indexOf(p) + 1;
  const p2 = race.player2;
  const bumps = !!race.order;
  $('resTitle').textContent = bumps && !p2 ? bumpOutcome(race, p) : p2 ? (placeOf(race, p) < placeOf(race, p2) ? 'Player 1 wins the duel!' : 'Player 2 wins the duel!')
    : place === 1 ? 'Winner!' : `${ordinal(place)} place`;
  const code = encodeRace(opts, race.inputs);
  game.lastCode = code;
  const pb = getPB(opts.distance, opts.cls, opts.kind);
  let pbNote = '';
  if (settings.oneButton) game.oneButtonUsed = true;
  const finished = p.finishTime != null || !!p.out, counts = finished && !game.oneButtonUsed && !game.slowed && !game.tuned && !tuneEdited() && !['duel', 'replay', 'learn', 'training', 'live'].includes(game.mode);
  if (!finished) pbNote = ' · did not finish';
  else if (game.oneButtonUsed) pbNote = ' · one-button rowing';
  else if (game.slowed) pbNote = ' · 75% speed, not recorded';
  else if (game.tuned || tuneEdited()) pbNote = ' · tuned physics, not recorded';
  else if (game.mode === 'duel') pbNote = ' · duel';
  else if (game.mode === 'replay' || practiceMode()) pbNote = practiceMode() ? ' · practice' : ' · replay';
  else if (!counts) pbNote = game.mode === 'live' ? ' · live race' : '';
  else if (bumps) pbNote = '';   // bumps are about places, not times
  else if (!pb || p.finishTime < pb.time) {
    savePB(opts.distance, opts.cls, opts.kind, { time: p.finishTime, code, venue: race.course.name, date: Date.now() });
    pbNote = pb ? ` · new personal best (was ${fmtTime(pb.time)})` : ' · first personal best';
  }
  if (counts && game.mode === 'daily') {
    postDaily(race, code);
    const key = 'daily-' + opts.seed, best = STORE.get(key, null);
    if (!best || p.finishTime < best) STORE.set(key, p.finishTime);
    // A streak counts days in a row with a daily regatta finished; shields cover missed days.
    const spent = extendStreak();
    if (spent) setTimeout(() => toast(`Streak shield used: your ${streakNow().n}-day streak lives on 🛡`, 3500), 900);
  }
  $('resSub').textContent = bumps ? `Started ${ordinal(p.lane + 1)} on the river, finished ${ordinal(place)} · ${race.course.name}` : `${fmtTime(p.finishTime)} · ${race.course.name}, ${opts.distance} m ${BOAT_CLASSES[opts.cls].name.toLowerCase()}${pbNote}`;
  $('resTable').innerHTML = order.map((b, i) => `<tr class="${b === p ? 'me' : ''}"><td>${i + 1}</td><td>${bumps ? 'Station ' + (b.lane + 1) : race.course.kind === 'boatrace' ? (b.lane === 2 ? 'Surrey' : 'Middlesex') : race.course.bends ? 'Start ' + (b.startAt / 8 + 1) : 'Lane ' + (b.lane + 1)}</td><td>${displayName(b)}</td>
    <td class="t">${bumps ? bumpStatus(race, b) : b.finishTime != null ? fmtTime(b.finishTime) : '–'}</td><td class="t">${bumps ? '' : i && b.finishTime != null ? '+' + (b.finishTime - win).toFixed(2) : ''}</td></tr>`).join('')
    + (race.ghost?.finishTime ? `<tr><td></td><td></td><td>Ghost</td><td class="t">${fmtTime(race.ghost.finishTime)}</td><td class="t">${(race.ghost.finishTime - p.finishTime >= 0 ? '+' : '') + (race.ghost.finishTime - p.finishTime).toFixed(2)}</td></tr>` : '');
  const s = p.stats, strokes = Math.max(1, s.perfect + s.good + s.off);
  $('resChart').innerHTML = (bumps ? '' : splitChart(race, order[0])) + timingChart();
  $('resBoard').innerHTML = game.mode === 'live' ? $('liveStand').innerHTML : '';
  renderBoard();   // fills the results board for a daily, with working buttons
  $('nextUp').textContent = game.mode === 'training' ? trainingSummary() : counts && !bumps ? nextChallenge(race, place) : '';
  $('resStats').textContent = `${p.strokes} strokes · average rate ${(p.strokes / (p.finishTime ?? p.out?.t ?? race.t) * 60).toFixed(1)} · ${Math.round(s.perfect / strokes * 100)}% perfect catches`
    + (s.crabs ? ` · ${s.crabs} crab${s.crabs > 1 ? 's' : ''}` : '') + (s.buoys ? ` · hit the ${race.course.bends ? 'bank' : 'buoys'} ${s.buoys}×` : '') + (p.finishTime != null ? streamLineNote(race) : '');
  if (race.course.kind === 'head' && place === 1 && counts) celebrate();
  // Say which rule kept a race out of a campaign, so a player on 75% speed knows why progress didn't move.
  const why = !finished ? 'unfinished' : game.slowed ? 'rowed at 75% speed' : game.oneButtonUsed ? 'one-button rowing' : 'tuned physics';
  const notCounted = what => `Not counted for the ${what}: ${why}.`;
  const careerNote = game.mode === 'career' ? (counts ? careerResult(race, place) : notCounted('season'))
    : game.mode === 'cup' ? (counts ? cupResult(race) : notCounted('cup'))
    : game.mode === 'boatrace' ? (counts ? boatRaceResult(race, place) : '')
    : game.mode === 'week' ? (counts ? weekResult(race) : notCounted('week')) : '';
  if (counts && !bumps) recordHistory(race, place);
  const badges = counts ? checkBadges(race, place) : [];
  if (badges.length) setTimeout(() => toast('Badge earned: ' + badges.map(b => b.name).join(', '), 3200), 600);
  $('careerNote').textContent = careerNote;
  if (game.mode === 'week') $('resChart').innerHTML += bumpsChart(week);
  $('careerNote').classList.toggle('hide', !careerNote);
  $('btnAgain').textContent = game.mode === 'live' ? 'Back to the lobby' : game.mode === 'career' || game.mode === 'cup' && !cup.out && !cup.won ? 'Next race' : game.mode === 'week' ? (weekOver() ? 'Start a new week' : `Row day ${week.day + 1}`) : game.mode === 'cup' ? 'Enter a new cup' : 'Race again';
  // A duel's code only holds player 1's strokes, so it can't be replayed or shared.
  // Duel and practice codes can't be re-rowed (a code holds one crew in a full field), so no replay or link.
  // Only results that count get a card: a daily that finished, the last day of a bumps week, or the end of a cup run.
  $('btnCard').classList.toggle('hide', !counts || !(game.mode === 'daily' && p.finishTime != null || game.mode === 'week' && weekOver() || game.mode === 'cup' && (cup.won || cup.out)));
  for (const id of ['btnReplay', 'btnShare']) $(id).classList.toggle('hide', !!race.player2 || practiceMode() || game.mode === 'live');
  $('results').classList.remove('hide');
  $('hud').classList.add('hide');
  AU.play(place === 1 ? 'win' : 'finish');
}

// A link when this page is one a friend can open; otherwise the bare code, which they paste into the menu (F-107).
async function shareRace() {
  const linkable = location.protocol === 'https:' && window.top === window;
  const text = linkable ? location.href.split('#')[0] + '#r=' + game.lastCode : game.lastCode;
  try { await navigator.clipboard.writeText(text); toast(linkable ? 'Race link copied: a friend can race your ghost' : "Race code copied: a friend pastes it into \"Race a friend's code\" on the menu", 3500) }
  catch (e) { prompt(linkable ? 'Copy this race link' : 'Copy this race code', text) }
}

$('btnCode').onclick = () => { if (loadFriendCode($('codeIn').value)) $('codeIn').value = '' };
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnCode').click() });
