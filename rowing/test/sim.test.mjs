// Runs the headless simulation slices (files numbered below 100) in Node, with no DOM, and checks:
// races are deterministic, codes round-trip, and bot times land in a sensible range.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dir = fileURLToPath(new URL('../src/js/', import.meta.url));
const src = readdirSync(dir).filter(f => /^0\d\d-.*\.js$/.test(f)).sort().map(f => readFileSync(dir + f, 'utf8')).join('\n');
const ctx = vm.createContext({ console });
vm.runInContext(src + '\n;globalThis.api={makeRace,stepRace,simulateRace,encodeRace,decodeRace,packInput,IN,TUNE,placeOf,fmtTime,steerError};', ctx);
const { makeRace, stepRace, simulateRace, encodeRace, decodeRace, packInput, IN, placeOf, fmtTime } = ctx.api;

// A scripted "player" that rows like a decent human, so tests cover the player's path too.
function scriptedPlayer(race, rate = 32) {
  const b = race.player;
  let bits = 0;
  if (b.phase === 'drive') bits = b.h < 0.95 ? IN.DRIVE : 0;
  else if (!(b.lastBits & IN.DRIVE) && (b.phase === 'front' || b.h / b.recSpeed < 0.03)) bits = IN.DRIVE;
  const err = ctx.api.steerError(race.course, b);
  if (err > 0.8) bits |= IN.LEFT; else if (err < -0.8) bits |= IN.RIGHT;
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
// Head race: a winding river, crews starting at intervals, codes carrying the race kind.
const head = { ...opts, distance: 1000, kind: 'head', difficulty: 'national' };
const h = row(head, 34);
const hcode = encodeRace(head, h.inputs), hre = simulateRace(decodeRace(hcode).opts, decodeRace(hcode).inputs);
assert.equal(hre.player.finishTime, h.player.finishTime, 'head race codes re-row exactly');
assert.equal(decodeRace(code).opts.kind, 'regatta', 'version 1 codes are regattas');
const hb = h.boats.filter(x => x !== h.player);
console.log(`1000m head race: player ${fmtTime(h.player.finishTime)} place ${placeOf(h, h.player)}, banks hit ${h.player.stats.buoys}; bots ${hb.map(x => fmtTime(x.finishTime) + '/' + x.stats.buoys).join(' ')}`);
// Golden times: bot crews on fixed seeds must finish at exactly these times forever, or old codes and ghosts break.
// If a change moves them, it changed existing physics: put the new behaviour behind a new race kind or code version.
const GOLDEN = {
  regatta: [81.07620415927327, 80.07830460719995, null, 80.05322070198821, 80.01200601304154, 80.42661945102802],
  head: [81.25174211912491, 80.30195165229755, null, 80.50609055204312, 80.39322462011783, 81.13751777640593],
};
for (const kind of Object.keys(GOLDEN)) {
  const r = makeRace({ seed: 777, distance: 500, cls: '4x', difficulty: 'olympic', lane: 2, kind });
  while (!r.done) stepRace(r, packInput(0, 20));
  assert.equal(JSON.stringify(r.boats.map(b => b.finishTime)), JSON.stringify(GOLDEN[kind]), `golden ${kind} times unchanged`);
}
console.log('golden times unchanged');
console.log('ok');
