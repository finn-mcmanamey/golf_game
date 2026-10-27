/* ===== heads-up display: stroke meter, numbers, standings and the course strip ===== */

const GRADE_TEXT = {
  perfect: ['PERFECT', 'var(--good)'], good: ['GOOD', '#a3e635'], early: ['EARLY', 'var(--warn)'], late: ['LATE', 'var(--warn)'],
  short: ['SHORT STROKE', 'var(--warn)'], crab: ['CAUGHT A CRAB!', 'var(--bad)'], buoy: ['ON THE BUOYS', 'var(--bad)'], bank: ['INTO THE BANK!', 'var(--bad)'], wash: ['IN THEIR WASH: MOVE OVER', 'var(--warn)'],
};

let toastTimer = 0;
function toast(text, ms = 1800) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

function showGrade(kind, extra = '') {
  const el = $('grade'), [text, colour] = GRADE_TEXT[kind];
  el.textContent = text + extra;
  el.style.color = colour;
  el.classList.remove('pop');
  void el.offsetWidth;   // restart the animation
  el.classList.add('pop');
}

function setStartMsg(text) {
  const el = $('startMsg');
  if (el.textContent !== text) el.textContent = text;
  el.classList.toggle('on', !!text);
}

// Average split over the last few seconds, as rowers read it: time per 500 m.
const splitHistory = [];
function currentSplit(boat, t) {
  splitHistory.push([t, boat.x]);
  while (splitHistory.length > 2 && splitHistory[0][0] < t - 4) splitHistory.shift();
  const [t0, x0] = splitHistory[0], dx = boat.x - x0;
  return dx > 0.5 ? 500 * (t - t0) / dx : null;
}

function updateHud(race) {
  updateStrain(race);
  const p = race.player, D = race.course.distance, t = Math.max(0, race.t);
  $('clockT').textContent = fmtTime(p.finishTime ?? p.out?.t ?? t).slice(0, -1);
  $('togoT').textContent = race.order && (p.out || p.finishTime != null) ? bumpOutcome(race, p)
    : p.finishTime != null ? `Finished · ${ordinal(placeOf(race, p))}` : `${Math.max(0, Math.ceil(D - p.x))} m to go${race.order ? whistleMarks() : ''}`;
  $('rateT').textContent = p.strokes ? Math.round(liveRate(p, race.t)) : p.rate;
  $('rateTarget').textContent = `target ${p.rate}`;
  $('splitT').textContent = race.started ? fmtSplit(currentSplit(p, race.t)) : '–:––';
  $('speedT').textContent = Math.max(0, p.v).toFixed(1);
  const e = $('energyB');
  e.style.width = (p.energy * 100).toFixed(1) + '%';
  e.style.background = p.energy < 0.22 ? 'var(--bad)' : p.energy < 0.45 ? 'var(--warn)' : 'var(--good)';
  $('swingB').style.width = (p.swing * 100).toFixed(1) + '%';
  $('rateTarget').textContent = p.finishTime != null || p.out ? 'paddling' : coxing() ? `target ${p.rate} · tens ${coxState.tens}` : `target ${p.rate}`;

  // Slide meter: handle position, glowing catch zone as the slide comes forward.
  const h = $('handle');
  h.style.left = (4 + p.h * 92) + '%';
  h.classList.toggle('drive', p.phase === 'drive');
  const toFront = p.phase === 'recover' ? p.h / p.recSpeed : p.phase === 'front' ? 0 : 9;
  $('catchZone').classList.toggle('ready', race.started && toFront < 0.25);

  catchCue(p);
  if (p.inWash > 0.3 && !hudWash) showGrade('wash');
  hudWash = p.inWash > 0.3;
  updateStandings(race);
  updateCourseStrip(race);
  updateWind(race.course.wind);
}

const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');

// Stroke rate as measured from the last few catches (what a cox box shows), not just the target.
const catchTimes = [];
function liveRate(p, t) {
  if (catchTimes.length < 2) return p.rate;
  const n = Math.min(4, catchTimes.length - 1), span = catchTimes[catchTimes.length - 1] - catchTimes[catchTimes.length - 1 - n];
  return span > 0 ? 60 * n / span : p.rate;
}

let standingsTick = 0;
function updateStandings(race) {
  if (standingsTick++ % 6) return;   // a few updates a second is plenty
  const boats = [...race.boats].sort((a, b) => placeOf(race, a) - placeOf(race, b));
  const leader = boats[0], D = race.course.distance;
  $('standings').innerHTML = boats.map((b, i) => {
    // Head races are against the clock: show each crew's projected time, or when it starts.
    const gap = race.order ? bumpStatus(race, b) : b.finishTime != null ? fmtTime(b.finishTime)
      : race.course.kind === 'head' ? (race.t < b.startAt ? `starts ${Math.ceil(b.startAt - race.t)}s` : b.x > 20 ? '≈' + fmtTime((race.t - b.startAt) * D / b.x).slice(0, -3) : '…')
      : i === 0 ? 'lead' : '+' + ((leader.x - b.x) / Math.max(1, leader.v)).toFixed(1) + 's';
    const sw = '#' + coloursFor(b).shirt.toString(16).padStart(6, '0');
    return `<div class="${b === race.player ? 'me' : ''}"><span>${i + 1}</span><i class="sw" style="background:${sw}"></i><span>${displayName(b)}${b.isRival ? ' ⚔' : ''}</span><span class="gap">${gap}</span></div>`;
  }).join('');
}

function updateCourseStrip(race) {
  const el = $('courseBar'), D = race.course.distance;
  if (el.childElementCount !== race.boats.length + (race.ghost ? 1 : 0) + 1) {
    el.innerHTML = '<span class="line" style="left:100%"></span>' + race.boats.map(() => '<i></i>').join('') + (race.ghost ? '<i></i>' : '');
  }
  const dots = el.querySelectorAll('i');
  [...race.boats, race.ghost].filter(Boolean).forEach((b, i) => {
    const d = dots[i];
    d.style.left = clamp(b.x / D, 0, 1) * 100 + '%';
    d.style.top = (b.isGhost ? race.player.lane : b.lane) * 6 + 'px';
    d.style.background = b.isGhost ? 'rgba(255,255,255,.4)' : '#' + coloursFor(b).shirt.toString(16).padStart(6, '0');
    d.className = b === race.player ? 'me' : '';
  });
}

/* ----- splits: the time each boat passes every marker, for the results chart ----- */
const splits = { every: 100, times: new Map() };

function resetSplits() { splits.times.clear() }

function recordSplits(race) {
  const D = race.course.distance;
  splits.every = D <= 500 ? 50 * Math.max(1, D / 250) : 250;
  for (const b of race.boats) {
    let list = splits.times.get(b);
    if (!list) splits.times.set(b, list = []);
    const next = (list.length + 1) * splits.every;
    if (next <= D && b.x >= next) list.push(race.t - b.startAt);
  }
}

// Pace per segment (time per 500 m) for you and the winner, drawn as two lines.
function splitChart(race, winner) {
  const me = race.player, seg = splits.every, n = Math.round(race.course.distance / seg);
  const pace = b => (splits.times.get(b) || []).map((t, i, a) => (t - (i ? a[i - 1] : 0)) * 500 / seg);
  const mine = pace(me), theirs = winner === me ? [] : pace(winner);
  const all = [...mine, ...theirs].filter(v => v < 600);
  if (all.length < 2) return '';
  const lo = Math.min(...all) - 2, hi = Math.max(...all) + 2, W = 520, H = 120, pad = 30;
  const X = i => pad + i * (W - pad * 2) / Math.max(1, n - 1), Y = v => 10 + (v - lo) / (hi - lo) * (H - 30);
  const line = (vals, cls) => `<polyline class="${cls}" points="${vals.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/>`
    + vals.map((v, i) => `<circle class="${cls}" cx="${X(i)}" cy="${Y(v)}" r="3"/>`).join('');
  const labels = Array.from({ length: n }, (_, i) => `<text x="${X(i)}" y="${H - 4}">${(i + 1) * seg}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart"><text x="2" y="${Y(lo + 2) + 4}" class="ax">${fmtSplit(lo + 2)}</text>
    <text x="2" y="${Y(hi - 2) + 4}" class="ax">${fmtSplit(hi - 2)}</text>${labels}${theirs.length ? line(theirs, 'w') : ''}${line(mine, 'me')}</svg>
    <div class="legend"><span class="me">You</span>${theirs.length ? `<span class="w">${winner.crewName}</span>` : ''}<span>pace per 500 m at each marker · higher is faster</span></div>`;
}

// A soft tick the moment the slide reaches the front: rowing by ear, the way a cox box beeps the rhythm.
let cuePhase = '', hudWash = false;
function catchCue(p) {
  if (settings.cue && cuePhase === 'recover' && p.phase === 'front') AU.play('cue');
  cuePhase = p.phase;
}

// Player 2's own small stroke meter in a duel.
function updateHud2(race) {
  const p = race.player2, el = $('p2');
  el.classList.toggle('hide', !p);
  if (!p) return;
  $('p2handle').style.left = (4 + p.h * 92) + '%';
  $('p2handle').classList.toggle('drive', p.phase === 'drive');
  $('p2stats').textContent = `rate ${p.rate} · ${p.v.toFixed(1)} m/s · energy ${Math.round(p.energy * 100)}%`;
}

// Wind arrow: the course runs left to right, so a tailwind points right and a crosswind up or down.
function updateWind(w) {
  const el = $('windT');
  if (el.dataset.w === String(w.speed)) return;
  el.dataset.w = String(w.speed);
  const ang = Math.atan2(w.cross, w.along) * 180 / Math.PI;
  el.innerHTML = w.speed < 0.4 ? 'Calm' : `<svg viewBox="0 0 20 20" style="transform:rotate(${ang}deg)"><path d="M2 10h12M10 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>${w.speed.toFixed(1)} m/s ${windLabel(w).split(' ')[1].replace('wind', '')}`;
}
