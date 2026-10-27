// Difficulty check: human-like rowers (catch timing scattered by sd seconds) race each field; prints average places.
// Use it after tuning bots or physics: npm run test:rowing keeps codes exact, this keeps the game fair.
//   node rowing/test/balance.mjs
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const dir = new URL('../src/js/', import.meta.url).pathname;
const src = readdirSync(dir).filter(f => /^0\d\d-/.test(f)).sort().map(f => readFileSync(dir + f, 'utf8')).join('\n');
const ctx = vm.createContext({});
vm.runInContext(src + ';globalThis.api={makeRace,stepRace,packInput,IN,placeOf,steerError}', ctx);
const { makeRace, stepRace, packInput, IN, placeOf, steerError } = ctx.api;
// A human-like rower: catch timing scattered with spread sd (seconds), release a bit variable, plan-style rates.
function human(sd, seed) {
  let r = seed, planned = 0, last = -1;
  const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  return race => {
    const b = race.player, f = b.x / race.course.distance;
    const rate = f < 0.08 ? 40 : f > 0.8 ? 38 : 33;
    if (b.strokes !== last) { last = b.strokes; planned = (rnd() + rnd() + rnd() - 1.5) * 2 * sd }
    let bits = 0;
    if (b.phase === 'drive') bits = b.h < 0.9 + rnd() * 0.08 ? IN.DRIVE : 0;
    else if (!(b.lastBits & IN.DRIVE)) { const err = b.phase === 'recover' ? -b.h / b.recSpeed : b.phaseT; if (b.strokes === 0 || err >= planned) bits = IN.DRIVE }
    const e = steerError(race.course, b); if (e > 0.8) bits |= IN.LEFT; else if (e < -0.8) bits |= IN.RIGHT;
    return packInput(bits, rate);
  };
}
for (const sd of [0.05, 0.08, 0.11, 0.15]) {
  const line = [];
  for (const d of ['novice','club', 'national', 'elite', 'olympic']) {
    let places = 0, n = 12;
    for (let s = 1; s <= n; s++) {
      const race = makeRace({ seed: s * 7919, distance: 500, cls: '1x', difficulty: d, lane: 2, rules: 3 }), h = human(sd, s);
      while (!race.done) stepRace(race, h(race));
      places += placeOf(race, race.player);
    }
    line.push(`${d} avg place ${(places / n).toFixed(1)}`);
  }
  console.log(`timing spread ${sd}s: ${line.join(' · ')}`);
}
