/* ===== the commentator: a lower-third ticker calling the race like television =====
   Watches the race (never changes it) and says something when the story changes. */

const comm = { leader: null, lastT: -99, lastLine: '', said: new Set(), excite: 0 };

function resetCommentary() { Object.assign(comm, { leader: null, lastT: -99, lastLine: '', excite: 0, introLane: -1, warnT: -99 }); comm.said.clear() }

const who = b => `${displayName(b)}${race.course.bends ? '' : ` in lane ${b.lane + 1}`}`;

function comment(text, urgent = false) {
  if (!urgent && race.t - comm.lastT < 4) return;
  comm.lastT = race.t;
  const el = $('ticker');
  el.textContent = text;
  el.classList.remove('roll');
  void el.offsetWidth;
  el.classList.add('roll');
  comm.excite = 1;
}

// Other crews' moments: called with each bot event before it is cleared.
function commentEvent(b, e) {
  if (e.type === 'release' && e.grade === 'crab') comment(`Oh no, a crab for ${who(b)}! That will cost them.`, true);
}

// Before the start: introduce the crew in the lane the camera is passing.
function introduceCrews(race) {
  if (race.started || race.boats.length < 3 || race.course.kind !== 'regatta' || race.t >= race.attentionAt - 0.4) return;
  const f = clamp((race.t - race.t0) / (race.attentionAt - 0.4 - race.t0), 0, 0.999), lane = Math.floor(f * LANES);
  const b = race.boats.find(x => x.lane === lane);
  if (!b || comm.introLane === lane) return;
  comm.introLane = lane;
  const el = $('ticker');
  el.textContent = `Lane ${lane + 1} · ${displayName(b)}${b === race.player && displayName(b) !== 'You' ? ' (you)' : b.isRival ? ' · your rival' : ''}`;
  el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll');
}

function updateCommentary(race) {
  if (!race.started || race.player2 && race.player2.finishTime != null && race.player.finishTime != null) return;
  if (race.course.kind === 'boatrace') boatRaceCalls(race);
  const D = race.course.distance, order = [...race.boats].sort((a, b) => placeOf(race, a) - placeOf(race, b));
  const lead = order[0], second = order[1];
  comm.excite = Math.max(0, comm.excite - 0.01);
  if (race.t > 3 && !comm.said.has('start')) {
    comm.said.add('start');
    const r = race.boats.find(b => b.isRival);
    comment(r ? `They're away! All eyes on the rivalry: ${displayName(race.player)} against ${r.crewName}.` : `They're away cleanly at ${race.course.name}!`, true);
  }
  if (!lead || !second || race.order) return;   // bumps have their own story: bumpEvent calls it
  if (lead.finishTime != null) {
    if (!comm.said.has('result')) {
      comm.said.add('result');
      const margin = second.finishTime != null ? second.finishTime - lead.finishTime : 9;
      comment(margin < 0.2 ? `Photo finish! ${who(lead)} by the width of a bow ball!` : `${who(lead)} take it in ${fmtTime(lead.finishTime)}!`, true);
    }
    return;
  }
  if (comm.leader && comm.leader !== lead && race.t > 8) comment(`${who(lead)} ${lead === race.player ? 'hit the front!' : 'take the lead!'}`);
  comm.leader = lead;
  const gap = (lead.x - second.x) / Math.max(1, lead.v);
  if (D - lead.x < 150 && gap < 0.4 && !comm.said.has('close')) { comm.said.add('close'); comment(`It's neck and neck between ${displayName(lead)} and ${displayName(second)}!`, true) }
  if (R.wet > 0.5 && !race.course.rain && !comm.said.has('shower')) { comm.said.add('shower'); comment('And here comes the rain! A squall sweeping down the course.') }
  if (lead.x > D / 2 && !comm.said.has('half')) { comm.said.add('half'); comment(`Halfway: ${who(lead)} lead by ${gap.toFixed(1)} seconds.`) }
}
