/* ===== the Boat Race: two eights, side by side, all the way down a winding river =====
   A match race on the head-race river. You take the Surrey station; your rivals, the Dark Blues, take Middlesex. */

function startBoatRace(distance = 2000) {   // shorter only for tests
  const seed = 1 + Math.floor(Math.random() * 99999);   // a new stretch of river each year
  startRace({ seed, distance, cls: '8+', difficulty: settings.difficulty, lane: 2, kind: 'boatrace' }, null, 'boatrace');
  const rival = race.boats.find(b => b !== race.player);
  if (rival) Object.assign(rival, { crewName: 'Dark Blues', colours: { hull: 0xf4f1e8, shirt: 0x1b2f6b, blade: [0x1b2f6b, 0x1b2f6b] } });   // name and kit: drawing only
}

function boatRaceResult(race, place) {
  const rival = race.boats.find(b => b !== race.player), p = race.player;
  const winner = place === 1 ? p : rival, speed = race.course.distance / Math.max(1, winner.finishTime ?? race.t);
  // 'By a distance' is the Boat Race's own verdict for a crew still far from the line when the winner finishes.
  const margin = rival.finishTime != null && p.finishTime != null ? byVerdict(Math.abs(rival.finishTime - p.finishTime), speed, BOAT_CLASSES['8+'].length) : 'by a distance';
  if (place !== 1) return `The Dark Blues win ${margin}. There's always next year.`;
  STORE.set('boatRaceWins', STORE.get('boatRaceWins', 0) + 1);
  return `You win the Boat Race ${margin}!`;
}

function renderBoatRace() {
  const wins = STORE.get('boatRaceWins', 0);
  $('boatRaceT').innerHTML = `<b>The Boat Race</b> · two eights, side by side down a winding river, 2 km${wins ? ` · won ${wins}×` : ''}`;
}

// The Boat Race's own commentary: the start, and the umpire warning a crew that strays into the other's water.
function boatRaceCalls(race) {
  if (race.t > 3 && !comm.said.has('start')) { comm.said.add('start'); comment('The Boat Race is under way! Surrey station for you, Middlesex for the Dark Blues.', true) }
  const [a, b] = race.boats;
  if (!b || a.finishTime != null || b.finishTime != null || race.t - comm.warnT < 6) return;
  if (Math.abs(a.z - b.z) > 7 || Math.abs(a.x - b.x) > BOAT_CLASSES[a.cls].length) return;
  comm.warnT = race.t;
  // The crew further off its own line is the one warned.
  const off = Math.abs(a.z - targetZ(race.course, a)) > Math.abs(b.z - targetZ(race.course, b)) ? a : b;
  comment(`The umpire warns ${off === race.player ? 'you' : 'the Dark Blues'}: move away, the blades are about to clash!`, true);
}

$('btnBoatRace').onclick = startBoatRace;
