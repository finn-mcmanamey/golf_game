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

// Henley verdicts: a side-by-side margin called in boat lengths, as the umpire would, with the seconds after it.
// `speed` is the race's average speed (m/s) and `len` the boat's length (m).
function byVerdict(secs, speed, len) {
  const lengths = secs * speed / len, feet = Math.round(secs * speed * 3.28);
  if (secs === 0) return 'in a dead heat';   // finish times are interpolated, so anything else had a winner
  const call = lengths > 5 ? 'easily' : lengths < 0.05 ? 'by a canvas' : lengths < 0.2 ? `by ${feet} feet`
    : lengths < 0.875 ? `by ${['¼', '⅓', '½', '⅔', '¾'][[0.25, 1 / 3, 0.5, 2 / 3, 0.75].reduce((k, f, i, a) => Math.abs(f - lengths) < Math.abs(a[k] - lengths) ? i : k, 0)]} length`
    : (() => { const q = Math.round(lengths * 4) / 4, whole = Math.floor(q), frac = ['', '¼', '½', '¾'][Math.round((q - whole) * 4)]; return `by ${whole}${frac} length${q > 1 ? 's' : ''}` })();
  return `${call} (${secs.toFixed(secs < 0.01 ? 3 : 2)} s)`;
}

function cupResult(race) {
  const opp = race.boats.find(b => b !== race.player), won = placeOf(race, race.player) === 1;
  // If the loser was still rowing when the race was called, estimate the gap from where they were.
  const D = race.course.distance, behind = opp.finishTime == null ? race.t - race.player.finishTime + (D - opp.x) / Math.max(1, opp.v) : 0;
  const round = CUP_ROUNDS[cup.round].name, margin = opp.finishTime != null ? Math.abs(opp.finishTime - race.player.finishTime) : behind;
  cup.history.push({ round, opp: opp.crewName, won, margin });
  let note;
  const winner = won ? race.player : opp, by = byVerdict(margin, race.course.distance / Math.max(1, winner.finishTime ?? race.t), BOAT_CLASSES[race.opts.cls].length);
  if (!won) { cup.out = true; note = `Beaten by ${opp.crewName} in the ${round.toLowerCase()}, ${by}. Out of the cup.` }
  else if (cup.round === CUP_ROUNDS.length - 1) { cup.won = true; note = `You win the Voxel Cup! Beat ${opp.crewName} ${by}.`; STORE.set('cupWins', STORE.get('cupWins', 0) + 1) }
  else { cup.round++; note = `Won the ${round.toLowerCase()} ${by}. Next: the ${CUP_ROUNDS[cup.round].name.toLowerCase()} against ${cupOpponent(cup.round)}.` }
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

// A finished cup run as one line to share: who you beat, and where it ended.
function cupCard() {
  const runs = cup.history.map(h => `${h.won ? '✓' : '✗'} ${h.opp}`).join(' '), last = cup.history[cup.history.length - 1];
  return `Voxel Cup · ${runs} · ${cup.won ? '🏆 won the cup!' : `out in the ${last.round.toLowerCase()}`}`;
}
