/* ===== bumps week: four days of bumps, each starting where the last one finished =====
   The same six crews all week. Bump every day and you win your blades; get bumped every day and it's spoons. */

const WEEK_DAYS = 4;
let week = STORE.get('bumpsWeek', null);

function newWeek() {
  const seed = 1 + Math.floor(Math.random() * 99999), rng = makeRng(hashSeed(seed, 0xB1));
  const names = CREW_NAMES.slice(), order = [];
  for (let i = 0; i < LANES - 1; i++) order.push(names.splice((rng() * names.length) | 0, 1)[0]);
  order.splice(LANES - 2, 0, 'You');   // you start fifth on the river: room to climb, one crew to fear
  return { seed, day: 0, order, results: [], days: [order.slice()] };
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
  (week.days ||= []).push(week.order.slice());   // one river order per day, for the bumps chart
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
    $('weekChart').innerHTML = week ? bumpsChart(week) : '';   // the finished week stays on show until a new one starts
    return;
  }
  $('weekChart').innerHTML = bumpsChart(week);
  const marks = week.results.map(r => r > 0 ? '↑' + r : r < 0 ? '↓' + -r : '=').join(' ');
  $('weekT').innerHTML = `<b>Bumps week</b> · day ${week.day + 1} of ${WEEK_DAYS} · you start ${ordinal(weekStation() + 1)}, chasing <b>${week.order[weekStation() - 1] || 'nobody: head of the river!'}</b>${marks ? `<br>${marks}` : ''}`;
  $('btnWeek').textContent = `Row day ${week.day + 1}`;
}

// The bumps chart: each crew's place on the river day by day; lines cross where bumps happened.
function bumpsChart(w) {
  const days = w.days || [];
  if (days.length < 2) return '';
  const W = 240, H = 96, dx = (W - 70) / (days.length - 1), dy = (H - 12) / (LANES - 1);
  const pt = (d, name) => `${(6 + d * dx).toFixed(1)},${(6 + days[d].indexOf(name) * dy).toFixed(1)}`;
  const lines = days[0].map(name => {
    const me = name === 'You', y = 6 + days[days.length - 1].indexOf(name) * dy + 3;
    return `<polyline points="${days.map((_, d) => pt(d, name)).join(' ')}" fill="none" stroke="${me ? '#ffd23f' : '#8aa0b8'}" stroke-width="${me ? 3 : 1.5}"/>`
      + `<text x="${12 + (days.length - 1) * dx}" y="${y.toFixed(1)}" font-size="9" fill="${me ? '#ffd23f' : '#aab8c8'}">${escapeHtml(name)}</text>`;
  });
  return `<svg class="bumpsChart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Bumps chart">${lines.join('')}</svg>`;
}

$('btnWeek').onclick = startWeekRace;

// Returning players get one note about the new mode.
if (!STORE.get('seenBumps', false) && STORE.get('history', []).length) {
  STORE.set('seenBumps', true);
  setTimeout(() => toast('New: bumps racing! Pick Bumps under Event, or row a four-day bumps week.', 5000), 1200);
}
