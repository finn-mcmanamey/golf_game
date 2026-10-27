/* ===== bumps racing on screen: whistles from the bank, gaps, and how your crew came out of it =====
   The race itself (single file, catching the crew ahead) lives in 050-race.js; this only reads it. */

const bumpLen = b => BOAT_CLASSES[b.cls].length;
const stillRacing = b => !b.out && b.finishTime == null;

// The nearest crew ahead (or behind) in the starting line that is still racing.
function bumpTarget(race, b) { return race.boats.filter(o => o.lane < b.lane && stillRacing(o)).pop() }
function bumpHunter(race, b) { return race.boats.find(o => o.lane > b.lane && stillRacing(o)) }

// Clear water between a chaser's bow and the stern ahead, in metres.
const bumpGap = (chaser, target) => target.x - bumpLen(target) - chaser.x;

// The bank party's whistles, as on a real bumps river: one at a length and a half, two at a length, three at half.
function whistles(gap, len) { return gap < len * 0.5 ? 3 : gap < len ? 2 : gap < len * 1.5 ? 1 : 0 }

const bumpCall = { ahead: 0, behind: 0 };
function bumpCalls(race) {
  const p = race.player;
  if (p.strokes < 2) bumpCall.ahead = bumpCall.behind = 0;   // a fresh race
  if (p.out || p.finishTime != null) return;
  const t = bumpTarget(race, p), h = bumpHunter(race, p);
  const ahead = t ? whistles(bumpGap(p, t), bumpLen(p)) : 0, behind = h ? whistles(bumpGap(h, p), bumpLen(p)) : 0;
  if (ahead > bumpCall.ahead) {
    blowWhistle(ahead);
    say(['', `One whistle! We're closing on ${t.crewName}!`, 'Two whistles! Squeeze them!', 'Three whistles! Go for the bump!'][ahead], null, 0);
  } else if (behind > bumpCall.behind) {
    blowWhistle(behind);
    say(['', `${h.crewName} are coming. Hold them!`, `${h.crewName} on two whistles! Push away!`, 'Three whistles behind! Everything now!'][behind], null, 0);
  }
  bumpCall.ahead = ahead;
  bumpCall.behind = behind;
}

function blowWhistle(n) { for (let i = 0; i < n; i++) setTimeout(() => AU.play('whistle'), i * 220) }

// Standings column: clear water to the crew ahead, or how a crew's race ended.
function bumpStatus(race, b) {
  if (b.out) return b.out.up ? 'bumped ↑' : 'bumped ↓';
  if (b.finishTime != null) return 'rowed over';
  const t = bumpTarget(race, b);
  return t ? Math.max(0, Math.round(bumpGap(b, t))) + ' m' : b.lane === 0 ? 'head' : 'clear water';
}

// "Bumped up 2", "Rowed over" or "Bumped down": the start station against the final one.
function bumpOutcome(race, b) {
  const moved = b.lane + 1 - placeOf(race, b);
  return moved > 0 ? `Bumped up ${moved}!` : moved < 0 ? `Bumped down ${-moved}` : b.out ? 'Bumped' : 'Rowed over';
}

// Player events: the moment of a bump.
function bumpEvent(b, e) {
  if (e.up) comment(`${displayName(b)} bump ${e.other === race.player ? 'you' : displayName(e.other)}!`, true);
  if (b !== race.player) return;
  AU.play(e.up ? 'cheer' : 'crab');
  buzz(e.up ? 'finish' : 'crab');
  cam.shake = 0.5;
  game.finishShown = true;
  game.finishMsgUntil = game.time + 3;
  if (e.up && !game.replay) celebrate();
}
