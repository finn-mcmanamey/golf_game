// Runs the headless simulation slices (files numbered below 100) in Node, with no DOM, and checks:
// races are deterministic, codes round-trip, and bot times land in a sensible range.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dir = fileURLToPath(new URL('../src/js/', import.meta.url));
const src = readdirSync(dir).filter(f => /^0\d\d-.*\.js$/.test(f)).sort().map(f => readFileSync(dir + f, 'utf8')).join('\n');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\n;globalThis.api={makeRace,stepRace,simulateRace,encodeRace,decodeRace,packInput,IN,TUNE,placeOf,fmtTime};', ctx);
const { makeRace, stepRace, simulateRace, encodeRace, decodeRace, packInput, IN, placeOf, fmtTime } = ctx.api;

// A scripted "player" that rows like a decent human, so tests cover the player's path too.
function scriptedPlayer(race, rate = 32) {
  const b = race.player;
  let bits = 0;
  if (b.phase === 'drive') bits = b.h < 0.95 ? IN.DRIVE : 0;
  else if (!(b.lastBits & IN.DRIVE) && (b.phase === 'front' || b.h / b.recSpeed < 0.03)) bits = IN.DRIVE;
  return packInput(bits, rate);
}

function row(opts, rate) {
  const race = makeRace(opts);
  while (!race.done) stepRace(race, scriptedPlayer(race, rate));
  return race;
}

const opts = { seed: 12345, distance: 500, cls: '1x', difficulty: 'national', lane: 2 };
const t0 = performance.now();
const a = row(opts, 32), b = row(opts, 32);
const ms = performance.now() - t0;
assert.equal(a.player.finishTime, b.player.finishTime, 'same inputs give the same time');
assert.deepEqual(a.boats.map(x => x.finishTime), b.boats.map(x => x.finishTime), 'bots are deterministic');

const code = encodeRace(opts, a.inputs);
const dec = decodeRace(code);
assert.deepEqual(dec.inputs, a.inputs, 'code round-trips the inputs');
const re = simulateRace(dec.opts, dec.inputs);
assert.equal(re.player.finishTime, a.player.finishTime, 're-rowing a code reproduces the time');

console.log(`500m 1x national, player at 32: ${fmtTime(a.player.finishTime)} place ${placeOf(a, a.player)} · code ${code.length} chars · 2 races in ${ms.toFixed(0)} ms`);
for (const d of ['club', 'national', 'olympic']) for (const cls of ['1x', '8+']) {
  const r = row({ ...opts, difficulty: d, cls, distance: 2000 }, 30);
  const times = r.boats.filter(x => x !== r.player).map(x => x.finishTime).sort((x, y) => x - y);
  console.log(`2000m ${cls} ${d.padEnd(8)} bots ${fmtTime(times[0])} … ${fmtTime(times[times.length - 1])} · player@30 ${fmtTime(r.player.finishTime)} (${r.player.stats.perfect}/${r.player.strokes} perfect, energy ${r.player.energy.toFixed(2)})`);
}
console.log('ok');
