/* ===== bumps week: four days of bumps, each starting where the last one finished =====
   The same six crews all week. Bump every day and you win your blades; get bumped every day and it's spoons. */

const WEEK_DAYS = 4;
let week = STORE.get('bumpsWeek', null);

function newWeek() {
  const seed = 1 + Math.floor(Math.random() * 99999), rng = makeRng(hashSeed(seed, 0xB1));
  const names = CREW_NAMES.slice(), order = [];
  for (let i = 0; i < LANES - 1; i++) order.push(names.splice((rng() * names.length) | 0, 1)[0]);
  order.splice(LANES - 2, 0, 'You');   // you start fifth on the river: room to climb, one crew to fear
  return { seed, day: 0, order, results: [] };
}

const weekStation = () => week.order.indexOf('You');   // 0 is the head of the river
const weekOver = () => !week || week.day >= WEEK_DAYS;

function weekOpts() {
  return { seed: hashSeed(week.seed, week.day, 0xB4) % 999999 + 1, distance: settings.distance >= 2000 ? 2000 : 1000, cls: settings.cls,
    difficulty: settings.difficulty, lane: weekStation(), kind: 'bumps', rules: RULES_LATEST };
}

function startWeekRace() {
  if (weekOver()) { week = newWeek(); STORE.set('bumpsWeek', week) }
  startRace(weekOpts(), null, 'week');
  // Each station keeps its crew's name all week, so rivalries carry over from day to day.
  for (const b of race.boats) if (b !== race.player) b.crewName = week.order[b.lane];
}

// After a day: the river's new order becomes tomorrow's start.
function weekResult(race) {
  const from = weekStation() + 1, to = placeOf(race, race.player);
  week.order = race.order.map(lane => week.order[lane]);
  week.results.push(from - to);
  week.day++;
  STORE.set('bumpsWeek', week);
  const day = `Day ${week.day}: ${bumpOutcome(race, race.player).replace('!', '')}, now ${ordinal(to)} on the river.`;
  if (!weekOver()) return `${day} ${WEEK_DAYS - week.day} day${WEEK_DAYS - week.day > 1 ? 's' : ''} to go.`;
  const ups = week.results.filter(r => r > 0).length, downs = week.results.filter(r => r < 0).length;
  if (ups === WEEK_DAYS) STORE.set('blades', STORE.get('blades', 0) + 1);
  const moved = to < 5 ? `up ${5 - to} from where you started` : to > 5 ? 'down one from where you started' : 'right where you started';
  return `${day} ${ups === WEEK_DAYS ? 'Blades! You bumped every day.' : downs === WEEK_DAYS ? 'Spoons: bumped every day. Next year!' : `Week over: ${moved}.`}`;
}

function renderWeek() {
  const blades = STORE.get('blades', 0);
  if (weekOver()) {
    $('weekT').innerHTML = `<b>Bumps week</b> · four days on the river, start where you finished${blades ? ` · blades won ${blades}×` : ''}`;
    $('btnWeek').textContent = week ? 'Start a new week' : 'Start bumps week';
    return;
  }
  const marks = week.results.map(r => r > 0 ? '↑' + r : r < 0 ? '↓' + -r : '=').join(' ');
  $('weekT').innerHTML = `<b>Bumps week</b> · day ${week.day + 1} of ${WEEK_DAYS} · you start ${ordinal(weekStation() + 1)}, chasing <b>${week.order[weekStation() - 1] || 'nobody: head of the river!'}</b>${marks ? `<br>${marks}` : ''}`;
  $('btnWeek').textContent = `Row day ${week.day + 1}`;
}

$('btnWeek').onclick = startWeekRace;
