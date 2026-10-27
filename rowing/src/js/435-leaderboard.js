/* ===== the daily leaderboard: shared between everyone who opens the published game =====
   Each player writes only their own row (the db rules enforce it). Every row carries its race code, and the
   page re-rows each code before showing it: a time that the code doesn't reproduce never appears. */

const board = { db: null, uid: null, rows: [], verified: new Map(), unsub: null };

async function connectBoard() {
  if (!window.claude?.use) return;   // a plain browser or the iPhone app: no shared board
  const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  if (!db || !user) return;
  board.db = db;
  board.uid = await user.id();
  watchDailyBoard();
}

// Subscribe once to today's entries; re-render when anyone posts.
function watchDailyBoard() {
  if (!board.db || board.unsub) return;
  const seed = dailyOpts().seed;
  board.unsub = board.db.collection('scores').where('dailySeed', '==', seed).orderBy('dailyTime').limit(30)
    .onSnapshot(snap => { board.rows = snap.docs.map(d => ({ id: d.id, ...d.data() })); verifyRows(seed) }, () => { board.unsub = null });
}

// Re-row each new code (one per frame, so the page stays smooth) and keep only rows that check out.
function verifyRows(seed) {
  const todo = board.rows.filter(r => !board.verified.has(r.dailyCode));
  const step = () => {
    const r = todo.shift();
    if (!r) return renderBoard();
    let ok = false;
    try {
      const { opts, inputs } = decodeRace(r.dailyCode), race = simulateRace(opts, inputs);
      ok = opts.seed === seed && race.player.finishTime != null && Math.abs(race.player.finishTime - r.dailyTime) < 0.005;
    } catch (e) { ok = false }
    board.verified.set(r.dailyCode, ok);
    requestAnimationFrame(step);
  };
  step();
}

function verifiedRows() { return board.rows.filter(r => board.verified.get(r.dailyCode)) }

function renderBoard() {
  const rows = verifiedRows(), el = $('dailyBoard');
  if (!el) return;
  el.classList.toggle('hide', !rows.length);
  el.innerHTML = `<b>Today's leaderboard</b>` + rows.slice(0, 10).map((r, i) =>
    `<div class="${r.id === board.uid ? 'me' : ''}"><span>${i + 1}</span><span>${escapeHtml(r.name || 'Rower')}</span><span class="t">${fmtTime(r.dailyTime)}</span></div>`).join('');
  const rb = $('resBoard');
  if (rb && game.mode === 'daily') rb.innerHTML = el.innerHTML;
}

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// After a daily regatta: post the time if it beats this player's posted time for today.
async function postDaily(race, code) {
  if (!board.db || !board.uid) return;
  const seed = race.opts.seed, mine = board.rows.find(r => r.id === board.uid);
  if (mine && mine.dailySeed === seed && mine.dailyTime <= race.player.finishTime) return;
  try {
    await board.db.doc('scores/' + board.uid).set({ name: crew.club.slice(0, 14), dailySeed: seed, dailyTime: race.player.finishTime, dailyCode: code, at: Date.now() });
    toast("Posted to today's leaderboard", 1800);
  } catch (e) { /* a viewer who can't write simply isn't on the board */ }
}

connectBoard();
