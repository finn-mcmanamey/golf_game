/* ===== the daily leaderboard: shared between everyone who opens the published game =====
   Each player writes only their own row (the db rules enforce it). Every row carries its race code, and the
   page re-rows each code before showing it: a time that the code doesn't reproduce never appears. */

const board = { db: null, uid: null, rows: [], verified: new Map(), unsub: null };

async function connectBoard() {
  if (!window.claude?.use) return;   // a plain browser or the iPhone app: no shared board
  try {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    if (!db || !user) return;
    board.db = db;
    board.uid = await user.id();
    watchDailyBoard();
    setInterval(watchDailyBoard, 60000);   // past midnight, move on to the new day's board
  } catch (e) { /* no shared board this visit */ }
}

// Subscribe once to today's entries; re-render when anyone posts.
function watchDailyBoard() {
  const seed = dailyOpts().seed;
  if (!board.db || board.unsub && board.seed === seed) return;
  board.unsub?.();
  board.seed = seed;
  board.rows = [];
  board.unsub = board.db.collection('scores').where('dailySeed', '==', seed).orderBy('dailyTime').limit(30)
    .onSnapshot(snap => { board.rows = snap.docs.map(d => ({ id: d.id, ...d.data() })); verifyRows(seed) }, () => { board.unsub = null });
}

// Re-row each new code (one per frame, so the page stays smooth) and keep only rows that check out.
// A row is checked as the pair (code, claimed time): reusing someone's honest code with a better time fails.
const rowKey = r => r.dailySeed + '|' + r.dailyCode + '|' + r.dailyTime;   // the day is part of what was checked

function verifyRows(seed) {
  const todo = board.rows.filter(r => !board.verified.has(rowKey(r)));
  const step = () => {
    const r = todo.shift();
    if (!r) return renderBoard();
    let ok = false;
    try {
      // The code must be today's daily exactly (course, distance, boat, field, lane, rules) and reproduce the time.
      const { opts, inputs } = decodeRace(r.dailyCode), want = { kind: 'regatta', ...dailyOpts() };
      const same = ['seed', 'distance', 'cls', 'difficulty', 'lane', 'kind', 'rules'].every(k => opts[k] === want[k]);
      const race = same && withDefaultTune(() => simulateRace(opts, inputs));
      ok = same && race.player.finishTime != null && Math.abs(race.player.finishTime - r.dailyTime) < 0.005;
    } catch (e) { ok = false }
    board.verified.set(rowKey(r), ok);
    requestAnimationFrame(step);
  };
  step();
}

// Today's daily with the fastest verified run as a ghost. Still counts as a daily for your own time.
function raceLeader(e) {
  e?.stopPropagation();
  const top = verifiedRows()[0];
  if (!top) return;
  const { opts, inputs } = decodeRace(top.dailyCode);
  $('results').classList.add('hide');
  startRace(opts, inputs, 'daily');
}

// Verified rows, each race code shown once (a copied code earns nothing): the earliest poster keeps it.
function verifiedRows() {
  const seen = new Set();
  return board.rows.filter(r => board.verified.get(rowKey(r)))
    .sort((a, b) => a.dailyTime - b.dailyTime || (a.at || Infinity) - (b.at || Infinity))   // no posting time: last in line
    .filter(r => !seen.has(r.dailyCode) && seen.add(r.dailyCode));
}

function renderBoard() {
  const rows = verifiedRows(), el = $('dailyBoard');
  if (!el) return;
  el.classList.toggle('hide', !rows.length);
  el.innerHTML = `<b>Today's leaderboard</b>` + rows.slice(0, 10).map((r, i) =>
    `<div class="${r.id === board.uid ? 'me' : ''}"><span>${i + 1}</span><span>${escapeHtml(r.name || 'Rower')}</span><span class="t">${fmtTime(r.dailyTime)}</span></div>`).join('')
    + (rows.length && rows[0].id !== board.uid ? `<button class="sec mini raceLeader">Race ${escapeHtml(rows[0].name || 'the leader')}'s ghost</button>` : '');
  const rb = $('resBoard');
  if (rb && game.mode === 'daily') rb.innerHTML = el.innerHTML;
  document.querySelectorAll('.raceLeader').forEach(b => b.onclick = raceLeader);
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// After a daily regatta: post the time if it beats this player's posted time for today.
async function postDaily(race, code) {
  if (!board.db || !board.uid) return;
  const seed = race.opts.seed;
  if (seed !== dailyOpts().seed) return;   // only today's daily goes on today's board
  // Read this player's own row directly (it may not be in the top 30) so a slower time never replaces a faster one.
  let mine = null;
  try { const d = await board.db.doc('scores/' + board.uid).get(); mine = d.exists ? d.data() : null } catch (e) { return }
  if (mine && mine.dailySeed === seed && mine.dailyTime <= race.player.finishTime) return;
  try {
    await board.db.doc('scores/' + board.uid).set({ name: crew.club.slice(0, 14), dailySeed: seed, dailyTime: race.player.finishTime, dailyCode: code, at: Date.now() });
    toast("Posted to today's leaderboard", 1800);
  } catch (e) { /* a viewer who can't write simply isn't on the board */ }
}

connectBoard();
