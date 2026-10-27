/* ===== cox and coach calls: the race read back to you in short shouts =====
   Drawing-side only: it watches the race and never changes it. */

const calls = { said: new Set(), last: 0, place: 0, swingCalled: false, pushing: false };

function resetCalls() {
  calls.said.clear();
  calls.last = -99;
  calls.place = 0;
  calls.swingCalled = false;
  calls.pushing = false;
}

function say(text, key = text, gap = 2.5) {
  if (key && calls.said.has(key)) return;
  if (game.time - calls.last < gap) return;
  calls.said.add(key);
  calls.last = game.time;
  const el = $('call');
  el.innerHTML = `<small>${BOAT_CLASSES[race.player.cls].cox ? 'Cox' : 'Coach'}</small>${text}`;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  if (settings.voice && window.speechSynthesis) {
    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''));
    u.rate = 1.25; u.pitch = 1.1; u.volume = 0.8;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
}

function updateCalls(race) {
  const p = race.player, D = race.course.distance, left = D - p.x;
  if (race.order && race.started) bumpCalls(race);
  if (!race.started || p.finishTime != null || p.out) return;
  const place = placeOf(race, p);
  if (p.strokes === 1) say('Go! Wind it up!', 'go', 0);
  if (p.strokes === 12) say('Lengthen… and settle.', 'settle');
  if (p.x > D * 0.25 && D >= 1000) say('Quarter done. Stay long.', 'q1');
  if (p.x > D * 0.5 && !race.order) say(place === 1 ? 'Halfway and leading. Keep it clean!' : `Halfway. Lane ${leaderLane(race)} leads, go after them!`, 'half');
  if (left < 250 && D > 250) say('Last 250! Take it up!', 'l250', 0.5);
  if (left < 100) say('Everything! Empty the tank!', 'l100', 0.5);
  if (p.swing >= 0.99 && !calls.swingCalled) { calls.swingCalled = true; say("That's swing! Let it run.", null) }
  if (p.swing < 0.4) calls.swingCalled = false;
  const pushing = (p.lastBits & IN.PUSH) !== 0;
  if (pushing && !calls.pushing) say('Power ten, on this one!', null, 1.5);
  calls.pushing = pushing;
  if (p.energy < 0.18) say('Breathe! Hold the length!', 'tired');
  // Head races: a crew that started behind and is now on your stern.
  if (race.course.bends) {
    const hunter = race.boats.find(b => b !== p && b.startAt > 0 && b.finishTime == null && p.x - b.x > 0 && p.x - b.x < 18);
    if (hunter) say(`${hunter.crewName} on our stern! Hold them off!`, 'hunt-' + hunter.lane, 3);
  }
  if (calls.place && p.strokes > 15 && !race.order) {
    const ahead = race.boats.filter(b => b !== p && b.finishTime == null).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (place < calls.place && ahead) say(`We've got ${ahead.crewName}! Keep moving!`, null, 3);
    else if (place > calls.place && ahead) say(`${ahead.crewName} coming through. Respond!`, null, 3);
  }
  calls.place = place;
}

const leaderLane = race => 1 + [...race.boats].sort((a, b) => b.x - a.x)[0].lane;
