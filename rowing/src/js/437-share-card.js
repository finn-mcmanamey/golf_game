/* ===== daily share card (F-102): one spoiler-free line to paste anywhere, Wordle style =====
   Time, rank on today's board, catch quality as five dots, and the streak. No race code: the ghost stays opt-in. */

function dailyCard(race, place) {
  const p = race.player, s = p.stats, strokes = Math.max(1, s.perfect + s.good + s.off);
  const pct = Math.round(s.perfect / strokes * 100), filled = Math.round(pct / 20);
  // Rank against today's verified board, counting this run even before its own row has posted.
  const others = verifiedRows().filter(r => r.id !== board.uid);
  // The board only loads the fastest BOARD_ROWS; slower than all of a full board, the exact rank isn't known.
  const ahead = others.filter(r => r.dailyTime < p.finishTime).length, beyond = board.rows.length >= BOARD_ROWS && ahead === others.length;
  const rank = !others.length ? `${ordinal(place)} of ${race.boats.length}` : beyond ? `${BOARD_ROWS}+ today` : `${1 + ahead}/${others.length + 1} today`;
  const streak = STORE.get('dailyStreak', { n: 0, day: 0 }), fire = streak.day === localDay() && streak.n > 1 ? ` · 🔥${streak.n}` : '';
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  // A link only when this page is one people can open (not inside a sandboxed frame or the app).
  const link = location.protocol === 'https:' && window.top === window ? '\n' + location.href.split('#')[0] : '';
  return `Voxel Regatta daily, ${date} · ${fmtTime(p.finishTime)} · ${rank} · ${'●'.repeat(filled)}${'○'.repeat(5 - filled)} ${pct}% perfect${fire}${link}`;
}

async function shareCard() {
  const text = game.mode === 'week' ? weekCard() : dailyCard(race, placeOf(race, race.player));
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });   // the phone's share sheet
    else { await navigator.clipboard.writeText(text); toast('Result copied: paste it anywhere') }
  } catch (e) { if (e.name !== 'AbortError') prompt('Copy your result', text) }
}

$('btnCard').onclick = shareCard;
