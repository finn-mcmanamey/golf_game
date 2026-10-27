/* ===== the boathouse: your crew's colours, race history and badges ===== */

const SWATCHES = [0xffd23a, 0xd8352a, 0x2a5db0, 0x3aa35a, 0x7a2a8a, 0xff8a2a, 0x0f8a8a, 0xe07ab0, 0xffffff, 0x1a1a1a];
const crew = Object.assign({ club: 'You', shirt: 0xffd23a, blade: 0xffd23a, tip: 0x1a1a1a }, STORE.get('crew', {}));

// Your colours replace the default yellow on your boat.
function applyCrewColours() {
  Object.assign(PLAYER_COLOURS, { shirt: crew.shirt, blade: [crew.blade, crew.tip] });
}
applyCrewColours();

const displayName = b => b === race?.player && !race.player2 ? crew.club : b.crewName;

/* ----- history ----- */
function recordHistory(race, place) {
  const p = race.player, o = race.opts, s = p.stats, strokes = Math.max(1, s.perfect + s.good + s.off);
  const h = STORE.get('history', []);
  h.unshift({ date: Date.now(), kind: o.kind || 'regatta', distance: o.distance, cls: o.cls, diff: o.difficulty, time: p.finishTime,
    place, venue: race.course.name, seed: o.seed, perfect: Math.round(s.perfect / strokes * 100), mode: game.mode, code: game.lastCode });
  STORE.set('history', h.slice(0, 50));
}

/* ----- badges: each checks the race that just finished ----- */
const BADGES = [
  { id: 'first', name: 'First strokes', how: 'Finish a race', test: () => true },
  { id: 'win', name: 'Winner', how: 'Win a race', test: c => c.place === 1 },
  { id: 'clean', name: 'Clean sheet', how: 'Every catch perfect in a race of 250 m or more', test: c => c.p.stats.off === 0 && c.p.stats.good === 0 && c.p.strokes > 20 },
  { id: 'photo', name: 'Photo finish', how: 'Win by less than 0.2 s', test: c => c.place === 1 && c.margin < 0.2 },
  { id: 'comeback', name: 'Comeback', how: 'Win after being last at halfway', test: c => c.place === 1 && c.lastAtHalf },
  { id: 'crab', name: 'Crab survivor', how: 'Win despite catching a crab', test: c => c.place === 1 && c.p.stats.crabs > 0 },
  { id: 'eight', name: 'Engine room', how: 'Win in an eight', test: c => c.place === 1 && c.o.cls === '8+' },
  { id: 'river', name: 'River pilot', how: 'Finish a head race without touching the bank', test: c => c.o.kind === 'head' && c.p.stats.buoys === 0 },
  { id: 'olympic', name: 'Olympian', how: 'Win against an olympic field', test: c => c.place === 1 && c.o.difficulty === 'olympic' },
  { id: 'distance', name: 'Full distance', how: 'Row 2000 m', test: c => c.o.distance >= 2000 },
  { id: 'sprint', name: 'Sprinter', how: 'Single scull 500 m under 1:30', test: c => c.o.cls === '1x' && c.o.distance === 500 && c.p.finishTime < 90 },
  { id: 'bump', name: 'Bumped up', how: 'Catch the crew ahead in a bumps race', bumps: true, test: c => c.p.out?.up },
  { id: 'blades', name: 'Blades', how: 'Bump up two places in one bumps race', bumps: true, test: c => c.p.lane + 1 - c.place >= 2 },
  { id: 'medals', name: 'Medal haul', how: 'Win three season medals', test: () => (career?.medals.length || 0) >= 3 },
];

function checkBadges(race, place) {
  if (game.mode === 'replay' || game.mode === 'duel' || tuneEdited()) return [];
  const p = race.player, order = [...race.boats].sort((a, b) => placeOf(race, a) - placeOf(race, b));
  const c = { p, o: race.opts, place, margin: order.length > 1 && place === 1 ? order[1].finishTime - p.finishTime : 9, lastAtHalf: game.lastAtHalf };
  const got = STORE.get('badges', {}), fresh = BADGES.filter(b => !got[b.id] && (b.id === 'first' || !b.bumps === (c.o.kind !== 'bumps')) && b.test(c));
  for (const b of fresh) got[b.id] = Date.now();
  STORE.set('badges', got);
  return fresh;
}

/* ----- the boathouse screen ----- */
function openBoathouse(tab = 'crew') {
  $('boathouse').classList.remove('hide');
  $('menu').classList.add('hide');
  openShowroom();
  segmented('bhTabs', [['crew', 'Crew'], ['history', 'History'], ['badges', 'Badges']], tab, renderBoathouse);
  renderBoathouse(tab);
}

function renderBoathouse(tab) {
  const el = $('bhBody');
  if (tab === 'crew') {
    const sw = (key) => SWATCHES.map(c => `<button class="sw${crew[key] === c ? ' on' : ''}" data-k="${key}" data-c="${c}" style="background:#${c.toString(16).padStart(6, '0')}" aria-label="colour"></button>`).join('');
    el.innerHTML = `<div class="row"><label>Club name</label><input id="clubIn" maxlength="14" value="${crew.club.replace(/"/g, '')}"></div>
      <div class="row"><label>Shirts</label><div class="swatches">${sw('shirt')}</div></div>
      <div class="row"><label>Blades</label><div class="swatches">${sw('blade')}</div></div>
      <div class="row"><label>Blade tips</label><div class="swatches">${sw('tip')}</div></div>
      <div class="bladePreview" style="background:linear-gradient(90deg,#${crew.blade.toString(16).padStart(6, '0')} 70%,#${crew.tip.toString(16).padStart(6, '0')} 70%)"></div>
      <div class="row"><label>Show</label><div class="seg" id="segShow"></div></div>`;
    segmented('segShow', Object.keys(BOAT_CLASSES).map(k => [k, BOAT_CLASSES[k].name]), showroom.cls, v => { showroom.cls = v; openShowroom() });
    $('clubIn').oninput = () => { crew.club = $('clubIn').value.trim() || 'You'; STORE.set('crew', crew) };
    el.querySelectorAll('.sw').forEach(b => b.onclick = () => { crew[b.dataset.k] = +b.dataset.c; STORE.set('crew', crew); applyCrewColours(); AU.play('ui'); renderBoathouse('crew') });
  } else if (tab === 'history') {
    const h = STORE.get('history', []);
    if (!h.length) { el.innerHTML = '<p class="sub">No races yet. Your last 50 races will be listed here.</p>'; return }
    el.innerHTML = totalsLine(h) + historySpark(h) + `<table class="hist">${h.slice(0, 20).map(r => `<tr><td>${new Date(r.date).toLocaleDateString()}</td>
      <td>${{ head: 'Head ', erg: 'Erg ', knockout: 'Match ', boatrace: 'Boat Race ', bumps: 'Bumps ' }[r.kind] || ''}${r.distance} m ${r.cls}</td><td>${DIFFICULTY[r.diff]?.label || ''}</td><td>${r.venue}</td>
      <td class="t">${fmtTime(r.time)}</td><td class="t">${ordinal(r.place)}</td><td class="t">${r.perfect}%</td>
      <td>${r.code ? `<button class="sec mini" data-code="${r.code}" title="Race against this run">Race it</button>` : ''}</td></tr>`).join('')}</table>`;
    el.querySelectorAll('[data-code]').forEach(b => b.onclick = () => raceHistoryGhost(b.dataset.code));
  } else {
    const got = STORE.get('badges', {});
    el.innerHTML = `<div class="badges">${BADGES.map(b => `<div class="badge${got[b.id] ? ' got' : ''}"><b>${b.name}</b><span>${b.how}</span></div>`).join('')}</div>
      <p class="sub small">${Object.keys(got).length} of ${BADGES.length} earned</p>`;
  }
}

// Any past run with a code can be raced as a ghost, on the same course and against the same field.
function raceHistoryGhost(code) {
  try {
    const { opts, inputs } = decodeRace(code);
    $('boathouse').classList.add('hide');
    showroom.on = false;   // startRace sets up its own scene
    startRace(opts, inputs);
  } catch (e) { toast('That run could not be loaded.') }
}

// Lifetime totals from the history (the last 50 races).
function totalsLine(h) {
  const km = h.reduce((n, r) => n + r.distance, 0) / 1000, wins = h.filter(r => r.place === 1).length;
  const streak = streakNow().n;   // a lapsed streak shows nothing
  return `<p class="totals"><b>${h.length}</b> races · <b>${wins}</b> wins · <b>${km.toFixed(1)}</b> km rowed${streak ? ` · daily streak <b>${streak}</b>` : ''}</p>`;
}

// Pace per 500 m over recent races of the most-rowed event, oldest to newest.
function historySpark(h) {
  const key = r => `${r.kind}-${r.distance}-${r.cls}`, counts = {};
  h.forEach(r => counts[key(r)] = (counts[key(r)] || 0) + 1);
  const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const runs = h.filter(r => key(r) === top).slice(0, 20).reverse(), paces = runs.map(r => r.time * 500 / r.distance);
  if (paces.length < 2) return '';
  const lo = Math.min(...paces), hi = Math.max(...paces) + 0.01, W = 520, H = 70;
  const pts = paces.map((v, i) => `${10 + i * (W - 20) / (paces.length - 1)},${8 + (v - lo) / (hi - lo) * (H - 16)}`).join(' ');
  const [k, d, c] = top.split('-');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart"><polyline class="me" points="${pts}"/></svg>
    <div class="legend"><span>${k === 'head' ? 'Head race ' : ''}${d} m ${c}: pace per 500 m, last ${paces.length} races · best ${fmtSplit(lo)} · higher is faster</span></div>`;
}
