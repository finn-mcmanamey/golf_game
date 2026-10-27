'use strict';
/* ===== core helpers shared by the simulation and the screen =====
   The race simulation (files below 100) must give identical numbers on every machine, because race codes and
   ghosts are re-rowed from their inputs. It only uses + − × ÷, Math.sqrt and the seeded generator below:
   no Math.random, no Math.sin. Drawing code may use anything. */

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x) };

// Seeded random numbers (mulberry32): the same seed always gives the same sequence.
function makeRng(seed) {
  let a = seed | 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Mixes numbers into a new seed, so each bot or scenery layer gets its own independent stream.
function hashSeed(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) { h ^= p | 0; h = Math.imul(h, 16777619); h ^= h >>> 13 }
  return h >>> 0;
}

// A roughly bell-shaped random number with mean 0 and spread ~sd, built from uniforms only.
const gauss = (rng, sd) => (rng() + rng() + rng() - 1.5) * 2 * sd;

const fmtTime = s => {
  if (s == null || !isFinite(s)) return '–';
  const m = Math.floor(s / 60), r = s - m * 60;
  return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2);
};
const fmtSplit = s => s == null || !isFinite(s) || s > 599 ? '–:––' : fmtTime(s).slice(0, -1);
