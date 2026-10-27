/* ===== bumps racing on screen: whistles from the bank, gaps, and how your crew came out of it =====
   The race itself (single file, catching the crew ahead) lives in 050-race.js; this only reads it. */

const bumpLen = b => BOAT_CLASSES[b.cls].length;
const bumpTarget = bumpAhead, bumpHunter = bumpBehind;

// The bank party's whistles, as on a real bumps river: one at a length and a half, two at a length, three at half.
function whistles(gap, len) { return gap < len * 0.5 ? 3 : gap < len ? 2 : gap < len * 1.5 ? 1 : 0 }

const bumpCall = { ahead: 0, behind: 0 };
function bumpCalls(race) {
  const p = race.player;
  if (p.strokes < 2) bumpCall.ahead = bumpCall.behind = 0;   // a fresh race
  const home = p.out?.t ?? p.finishTime;
  // Your race is over but the river's isn't: speed through the rest of the division.
  if (home != null && race.t > home + 4 && !race.player2) game.fastForward = true;
  if (home != null) return;
  const t = bumpTarget(race, p), h = bumpHunter(race, p);
  const ahead = t ? whistles(bumpGap(p, t), bumpLen(p)) : 0, behind = h ? whistles(bumpGap(h, p), bumpLen(p)) : 0;
  if (ahead > bumpCall.ahead) {
    blowWhistle(ahead);
    say(['', `One whistle! We're closing on ${t.crewName}!`, 'Two whistles! Power ten, now!', 'Three whistles! Go for the bump!'][ahead], null, 0);
  } else if (behind > bumpCall.behind) {
    blowWhistle(behind);
    say(['', `${h.crewName} are coming. Hold them!`, `${h.crewName} on two whistles! Push away!`, 'Three whistles behind! Power ten, hold them!'][behind], null, 0);
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

/* ----- the bank party: a coach on a bike for each crew, riding the towpath alongside (drawing only) ----- */
const bikes = new WeakMap();   // boat -> { x, v, ph }

function drawBankParty(mb, dt, time, course) {
  if (!race?.order) return;
  drawCannon(mb, course);
  const dark = [0.12, 0.12, 0.14], skin = hex(0xe0b590), steel = [0.6, 0.62, 0.66];
  for (const b of race.boats) {
    let k = bikes.get(b);
    if (!k || k.race !== race) bikes.set(b, k = { race, x: b.x - 4, v: 0, ph: b.lane });
    // Ride level with the crew's stern; a bumped crew's coach brakes and stops with them.
    const want = b.out ? 0 : clamp((b.x - 4 - k.x) * 0.8 + b.v, 0, 9);
    k.v += (want - k.v) * Math.min(1, dt * 2);
    k.x += k.v * dt;
    k.ph += k.v * dt / 0.35;
    if (Math.abs(k.x - cam.at[0]) > 160) continue;
    const x = k.x, z = riverZ(course, x) - course.halfW - 2 - (b.lane % 3) * 0.8, y = 0.5;
    const shirt = hex(coloursFor(b).shirt), c = Math.cos(k.ph) * 0.17, s = Math.sin(k.ph) * 0.17;
    for (const wx of [x - 0.55, x + 0.55]) mb.box(wx, y + 0.35, z, 0.7, 0.7, 0.06, dark);
    mb.beam([x - 0.55, y + 0.35, z], [x + 0.35, y + 1.05, z], 0.05, 0.05, steel);
    mb.beam([x - 0.1, y + 0.95, z], [x + 0.55, y + 0.35, z], 0.05, 0.05, steel);
    // Rider: legs on the pedals, body leaning to the bars, head turned to the water.
    mb.beam([x - 0.15, y + 1.1, z], [x + c, y + 0.4 + s, z - 0.1], 0.1, 0.1, dark);
    mb.beam([x - 0.15, y + 1.1, z], [x - c, y + 0.4 - s, z + 0.1], 0.1, 0.1, dark);
    mb.beam([x - 0.15, y + 1.1, z], [x + 0.25, y + 1.7, z], 0.36, 0.26, shirt);
    mb.box(x + 0.3, y + 1.95, z - 0.03, 0.26, 0.28, 0.26, skin);
  }
}

// The starting gun on the towpath beside the line of crews, and its smoke drifting off after the start.
function drawCannon(mb, course) {
  const x = (LANES - 1) * BUMP_GAP * bumpLen(race.player) * 0.5, z = riverZ(course, x) - course.halfW - 3, iron = [0.15, 0.15, 0.17];
  if (Math.abs(x - cam.at[0]) > 200) return;
  mb.box(x, 0.8, z, 1.4, 0.35, 0.35, iron);
  for (const dx of [-0.35, 0.35]) mb.box(x + dx, 0.65, z, 0.5, 0.5, 0.08, [0.35, 0.22, 0.12]);
  const age = race.t;
  if (age < 0 || age > 5) return;
  for (let i = 0; i < 9; i++) {
    const s = 0.6 + age * (0.6 + (i % 3) * 0.25), g = 1.1 * (1 - age / 5);
    mb.box(x + 0.9 + age * (0.8 + (i % 4) * 0.5), 1 + age * 0.5 + (i % 3) * 0.6, z + ((i * 7) % 5 - 2) * 0.3 * (1 + age), s, s, s, [g, g, g * 1.02]);
  }
}

// The rules in one line, for a player's first few bumps races.
function bumpsTip() {
  const n = STORE.get('bumpsTips', 0);
  if (n >= 3) return;
  STORE.set('bumpsTips', n + 1);
  const push = matchMedia('(pointer: coarse)').matches ? 'the push button' : 'Shift';
  setTimeout(() => toast(`Bumps: touch the stern of the crew ahead before the crew behind touches yours. Whistles call the gap; ${push} is a power ten.`, 6000), 300);
}
