/* ===== the Voxel Cup: a knockout of side-by-side match races, Henley style =====
   Eight crews, three rounds. Each round's opponent is tougher; lose once and you're out. */

const CUP_ROUNDS = [
  { name: 'Quarter-final', difficulty: 'club' },
  { name: 'Semi-final', difficulty: 'national' },
  { name: 'Final', difficulty: 'elite' },
];
let cup = STORE.get('cup', null);

function newCup() {
  const seed = 1 + Math.floor(Math.random() * 99999), rng = makeRng(hashSeed(seed, 0xC09));
  const names = CREW_NAMES.slice(), crews = [];
  for (let i = 0; i < 7; i++) crews.push(names.splice((rng() * names.length) | 0, 1)[0]);
  // The draw: you meet crews[0] first; the other pairings play out between the bots.
  return { seed, crews, round: 0, out: false, won: false, history: [] };
}

// Who you meet in each round, decided by the other matches (a seeded coin weighted to the first-named crew).
function cupOpponent(round) {
  if (round === 0) return cup.crews[0];
  const rng = makeRng(hashSeed(cup.seed, round, 0x0B));
  const pool = round === 1 ? [cup.crews[1], cup.crews[2]] : [cup.crews[3], cup.crews[4], cup.crews[5], cup.crews[6]];
  return pool[(rng() * pool.length) | 0];
}

function cupOpts() {
  return { seed: hashSeed(cup.seed, cup.round, 0xCA) % 999999 + 1, distance: settings.distance >= 1000 ? 1000 : 500, cls: settings.cls,
    difficulty: CUP_ROUNDS[cup.round].difficulty, lane: 2, kind: 'knockout' };
}

function startCupRace() {
  if (!cup || cup.out || cup.won) { cup = newCup(); STORE.set('cup', cup) }
  startRace(cupOpts(), null, 'cup');
  // The opponent's name comes from the draw sheet; their speed comes from the round's field.
  const opp = race.boats.find(b => b !== race.player);
  if (opp) opp.crewName = cupOpponent(cup.round);
}

function cupResult(race) {
  const opp = race.boats.find(b => b !== race.player), won = placeOf(race, race.player) === 1;
  // If the loser was still rowing when the race was called, estimate the gap from where they were.
  const D = race.course.distance, behind = opp.finishTime == null ? race.t - race.player.finishTime + (D - opp.x) / Math.max(1, opp.v) : 0;
  const round = CUP_ROUNDS[cup.round].name, margin = opp.finishTime != null ? Math.abs(opp.finishTime - race.player.finishTime) : behind;
  cup.history.push({ round, opp: opp.crewName, won, margin });
  let note;
  if (!won) { cup.out = true; note = `Beaten by ${opp.crewName} in the ${round.toLowerCase()} by ${margin.toFixed(2)} s. Out of the cup.` }
  else if (cup.round === CUP_ROUNDS.length - 1) { cup.won = true; note = `You win the Voxel Cup! Beat ${opp.crewName} by ${margin.toFixed(2)} s.`; STORE.set('cupWins', STORE.get('cupWins', 0) + 1) }
  else { cup.round++; note = `Won the ${round.toLowerCase()} by ${margin.toFixed(2)} s. Next: the ${CUP_ROUNDS[cup.round].name.toLowerCase()} against ${cupOpponent(cup.round)}.` }
  STORE.set('cup', cup);
  return note;
}

function renderCup() {
  const wins = STORE.get('cupWins', 0);
  if (!cup || cup.out || cup.won) {
    $('cupT').innerHTML = `<b>The Voxel Cup</b> · eight crews, side-by-side knockout races${wins ? ` · won ${wins}×` : ''}`;
    $('btnCup').textContent = cup ? 'Enter a new cup' : 'Enter the cup';
    return;
  }
  const done = cup.history.map(h => `${h.won ? '✓' : '✗'} ${h.opp}`).join(' · ');
  $('cupT').innerHTML = `<b>The Voxel Cup</b> · ${CUP_ROUNDS[cup.round].name} against <b>${cupOpponent(cup.round)}</b>${done ? `<br>${done}` : ''}`;
  $('btnCup').textContent = 'Row the ' + CUP_ROUNDS[cup.round].name.toLowerCase();
}
