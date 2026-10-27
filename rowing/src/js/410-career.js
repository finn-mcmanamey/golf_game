/* ===== the season: four regattas, each a heat and a final, with promotion through three tiers ===== */

const TIERS = ['club', 'national', 'olympic'];
const TIER_DISTANCE = { club: 500, national: 1000, olympic: 2000 };
const SEASON_BOATS = ['1x', '2x', '4x', '8+'];
const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' };

const careerDefault = () => ({ seed: 1 + Math.floor(Math.random() * 99999), tier: 0, regatta: 0, stage: 'heat', medals: [], seasons: 0 });
let career = STORE.get('career', null);

function careerOpts() {
  const tier = TIERS[career.tier], regSeed = hashSeed(career.seed, career.seasons, career.regatta) % 999999 + 1;
  return {
    // The heat and final share a venue; the final gets a different draw (seed) so it is a new race.
    seed: career.stage === 'final' ? regSeed + 1 : regSeed,
    distance: TIER_DISTANCE[tier], cls: SEASON_BOATS[career.regatta], difficulty: tier, lane: career.stage === 'final' ? 2 : 3,
  };
}

function renderCareer() {
  if (!career) { $('careerT').innerHTML = 'Row a season of four regattas. Make the final, win medals, move up from club to olympic.'; $('btnCareer').textContent = 'Start a season'; renderMedals(); return }
  const o = careerOpts(), venue = makeCourse(o.seed, o.distance).name;
  const vs = career.vsRival || [0, 0];
  $('careerT').innerHTML = `<b>${DIFFICULTY[TIERS[career.tier]].label} season ${career.seasons + 1}</b> · Regatta ${career.regatta + 1} of 4: ${venue} · ${BOAT_CLASSES[o.cls].name}, ${o.distance} m<br>Rival: <b>${rivalName()}</b> · you ${vs[0]}–${vs[1]} them`;
  $('btnCareer').textContent = career.stage === 'heat' ? 'Row the heat' : 'Row the final';
  renderMedals();
}

function renderMedals() {
  const m = career?.medals || [];
  $('medals').innerHTML = m.length ? m.slice(-12).map(x => `<i class="medal ${MEDAL[x.place]}" title="${x.tier} · ${x.venue} · ${x.cls}">${x.place}</i>`).join('') : '';
}

// Your rival for the season: the same crew turns up at every regatta, in the lane beside yours.
const rivalName = () => CREW_NAMES[hashSeed(career.seed, career.seasons, 0x41) % CREW_NAMES.length];
const rivalBoat = race => race.boats.find(b => b.lane === race.player.lane - 1);

function startCareerRace() {
  if (!career) { career = careerDefault(); STORE.set('career', career) }
  startRace(careerOpts(), null, 'career');
  // A name only: the rival rows with the field's own skill, so race codes still re-row exactly.
  const r = rivalBoat(race);
  if (r) {
    // If the draw already gave another crew the rival's name, swap names so nobody appears twice.
    const twin = race.boats.find(b => b !== r && b.crewName === rivalName());
    if (twin) twin.crewName = r.crewName;
    r.crewName = rivalName();
    r.isRival = true;
  }
}

// Called from the results screen: moves the season on and says what happened.
function careerResult(race, place) {
  let note;
  const r = rivalBoat(race);
  if (r?.isRival) {
    career.vsRival = career.vsRival || [0, 0];
    career.vsRival[placeOf(race, race.player) < placeOf(race, r) ? 0 : 1]++;
  }
  if (career.stage === 'heat') {
    if (place <= 3) { career.stage = 'final'; note = `${ordinal(place)} in the heat: through to the final!` }
    else { note = `${ordinal(place)} in the heat: out of this regatta.`; nextRegatta() }
  } else {
    if (place <= 3) career.medals.push({ place, tier: TIERS[career.tier], venue: race.course.name, cls: race.opts.cls });
    note = place <= 3 ? `${MEDAL[place][0].toUpperCase() + MEDAL[place].slice(1)} medal!` : `${ordinal(place)} in the final.`;
    note += ' ' + nextRegatta();
  }
  STORE.set('career', career);
  return note;
}

function nextRegatta() {
  career.stage = 'heat';
  if (++career.regatta < 4) return '';
  // Season over: two medals at this tier earns promotion.
  const tier = TIERS[career.tier], won = career.medals.filter(m => m.tier === tier && m.season === undefined).length;
  career.medals.forEach(m => { if (m.tier === tier) m.season = career.seasons });
  career.regatta = 0;
  career.seasons++;
  career.vsRival = [0, 0];   // a new season brings a new rival
  if (won >= 2 && career.tier < TIERS.length - 1) { career.tier++; return `Season over: promoted to ${DIFFICULTY[TIERS[career.tier]].label}!` }
  return won >= 2 ? 'Season over: champions of the top tier!' : 'Season over. Two medals next season earns promotion.';
}
