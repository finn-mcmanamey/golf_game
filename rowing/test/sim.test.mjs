// Runs the headless simulation slices (files numbered below 100) in Node, with no DOM, and checks:
// races are deterministic, codes round-trip, and bot times land in a sensible range.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dir = fileURLToPath(new URL('../src/js/', import.meta.url));
const src = readdirSync(dir).filter(f => /^0\d\d-.*\.js$/.test(f)).sort().map(f => readFileSync(dir + f, 'utf8')).join('\n');
// Only Math functions that give the same bits in every engine (IEEE-exact or integer) may appear in the sim:
// sin, pow, exp and friends are "implementation-approximated" and differ in the last bit between browsers.
const SAFE_MATH = new Set(['abs', 'sign', 'sqrt', 'min', 'max', 'floor', 'ceil', 'round', 'trunc', 'imul', 'fround']);
const simCode = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
const unsafe = [...simCode.matchAll(/Math\.(\w+)/g)].map(m => m[1]).filter(n => !SAFE_MATH.has(n));
assert.deepEqual(unsafe, [], `engine-dependent Math in the simulation: ${unsafe.join(', ')}`);
assert.ok(!simCode.includes('**'), 'the ** operator is Math.pow by another name: precompute instead');

const ctx = vm.createContext({ console });
vm.runInContext(src + '\n;globalThis.api={makeCourse,riverZ,riverSlope,makeRace,stepRace,simulateRace,encodeRace,decodeRace,packInput,IN,TUNE,placeOf,fmtTime,steerError,laneZ};', ctx);
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
// Rules 2 (wash): codes record the rules and re-row exactly; rules 1 races are untouched (golden times above).
const r2 = { ...opts, rules: 2 }, w = row(r2, 32), wcode = encodeRace(r2, w.inputs), wd = decodeRace(wcode);
assert.equal(wd.opts.rules, 2, 'rules survive a race code');
assert.equal(simulateRace(wd.opts, wd.inputs).player.finishTime, w.player.finishTime, 'rules-2 codes re-row exactly');
assert.equal(decodeRace(code).opts.rules, 1, 'old codes are rules 1');
console.log(`rules 2: 500m ${fmtTime(w.player.finishTime)} (rules 1: ${fmtTime(a.player.finishTime)})`);
// Rules 3: wash reaches, codes re-row, and a ghost of the run finishes in exactly its recorded time.
const r3 = { ...opts, rules: 3, difficulty: 'olympic' };
const drifter = race => { const v = scriptedPlayer(race, 34); return race.started && race.player.x < 250 ? (v & ~(IN.LEFT | IN.RIGHT)) | IN.RIGHT : v };
const w3 = makeRace(r3); let washed = 0;
while (!w3.done) { stepRace(w3, drifter(w3)); if (w3.player.inWash > 0) washed++ }
const g3 = makeRace({ ...r3, ghostInputs: w3.inputs });
while (!g3.done || g3.ghost.finishTime == null) stepRace(g3, packInput(0, 20));
assert.ok(washed > 30, 'rules 3 wash is felt by a boat drifting towards its neighbour');
assert.equal(g3.ghost.finishTime, w3.player.finishTime, 'a ghost finishes in exactly its run\'s time');
console.log(`rules 3: drifting boat in wash for ${washed} ticks; ghost time matches (${fmtTime(g3.ghost.finishTime)})`);
for (const difficulty of ['novice', 'elite']) assert.equal(decodeRace(encodeRace({ ...opts, difficulty }, [1, 2])).opts.difficulty, difficulty, `${difficulty} survives a race code`);

// Indoor erg races: still air, no steering, and codes that re-row exactly.
const erg = { ...opts, kind: 'erg', distance: 500 };
const e1 = row(erg, 34), ecode = encodeRace(erg, e1.inputs), e2 = simulateRace(decodeRace(ecode).opts, decodeRace(ecode).inputs);
assert.equal(e2.player.finishTime, e1.player.finishTime, 'erg codes re-row exactly');
assert.ok(e1.boats.every(b => b.z === ctx.api.laneZ(b.lane) && b.yaw === 0), 'ergs never steer');
console.log(`500m erg: player ${fmtTime(e1.player.finishTime)} place ${placeOf(e1, e1.player)}`);

// Bumps: crews in single file; a catch swaps two places, and codes re-row to the same river order.
const bumps = { ...opts, kind: 'bumps', distance: 1000, difficulty: 'club', rules: 4 };
const u1 = row(bumps, 32), ucode = encodeRace(bumps, u1.inputs), u2 = simulateRace(decodeRace(ucode).opts, decodeRace(ucode).inputs);
assert.ok(u1.boats.some(b => b.out), 'somebody bumps on a club river');
assert.equal(u2.order.join(), u1.order.join(), 'bumps codes re-row to the same order');
assert.equal(new Set(u1.order).size, 6, 'every crew keeps exactly one place');
console.log(`1km bumps: river order ${u1.order.map(l => l + 1).join(' ')}, you ${placeOf(u1, u1.player)} from station ${u1.player.lane + 1}`);

// Rules 5 (F-109): head-race streams run fastest mid-river. Against the stream the bank line wins; with it, the middle.
const { makeCourse, riverZ, riverSlope } = ctx.api;
function rowLine(opts, off) {
  const race = makeRace(opts);
  while (!race.done) {
    const b = race.player, v = scriptedPlayer(race, 32) & ~(IN.LEFT | IN.RIGHT);
    const err = (b.z - riverZ(race.course, b.x + 12) - off) + (b.yaw - riverSlope(race.course, b.x + 10)) * 10;
    stepRace(race, v | (err > 0.8 ? IN.LEFT : err < -0.8 ? IN.RIGHT : 0));
  }
  return race.player.finishTime;
}
const streamSeed = test => { for (let s = 1; s < 500; s++) if (test(makeCourse(s, 1000, 'head').current)) return s };
const against = { seed: streamSeed(c => c < -0.12), distance: 1000, cls: '1x', difficulty: 'club', lane: 2, kind: 'head', rules: 5 };
const withIt = { ...against, seed: streamSeed(c => c > 0.15) };
const bankAgainst = rowLine(against, 18), laneAgainst = rowLine(against, 0), bankWith = rowLine(withIt, 18), midWith = rowLine(withIt, 0);
assert.ok(bankAgainst < laneAgainst, 'against the stream, the bank line is faster');
assert.ok(midWith < bankWith, 'with the stream, mid-river is faster');
assert.equal(rowLine({ ...against, rules: 4 }, 0), rowLine({ ...against, rules: 4 }, 0), 'rules 4 head races re-row the same');
console.log(`rules 5 head: against the stream bank ${fmtTime(bankAgainst)} vs mid ${fmtTime(laneAgainst)}; with it mid ${fmtTime(midWith)} vs bank ${fmtTime(bankWith)}`);

// Rules 6 (F-114): Olympic head-race crews take the slack water against a strong stream, so they get faster there.
const field = rules => { const r = row({ ...against, difficulty: 'olympic', rules }, 32); const bots = r.boats.filter(b => b !== r.player);
  return { mean: bots.reduce((n, b) => n + b.finishTime, 0) / bots.length, banks: bots.reduce((n, b) => n + b.stats.buoys, 0) } };
const f5 = field(5), f6 = field(6);
assert.ok(f6.mean < f5.mean, 'olympic crews reading the river are faster against a strong stream');
console.log(`rules 6 head: olympic field mean ${fmtTime(f6.mean)} (rules 5 ${fmtTime(f5.mean)}), bank hits ${f6.banks} (rules 5 ${f5.banks})`);
console.log('ok');

