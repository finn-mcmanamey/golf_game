# Voxel Regatta: how this code is built

The repo's top-level `CLAUDE.md` (and the guide it links) still applies: how to talk to the person, git habits,
one feature per branch. This file adds what is specific to the rowing game. See `README.md` for the layout.

## Build and check

- `npm run build:rowing` must pass before any commit. `npm run test:rowing` must pass too.
- `rowing/dist/` is generated. Never edit or commit it.

## Structure rules

- `src/js/*.js` are ordered slices of **one classic script**. Load order is filename order; a new feature gets a
  new file with an in-between number. Top-level code may only use names from earlier files.
- Files numbered **below 100 are the simulation**. They must run in Node with no DOM, WebGL or `window`
  (the test loads exactly those files). Anything that touches the page goes at 100 or above.

## Determinism

- The simulation uses only `+ − × ÷`, `Math.sqrt`, `Math.abs`, `Math.sign`, comparisons and `makeRng`.
  No `Math.random`, no trigonometry, no `Math.pow`. Precompute constants instead (see `dragK`).
- New random draws get their own stream (`makeRng(hashSeed(seed, NEW_TAG))`) so existing values don't shift.
- Drawing may read race state, never write it. Per-boat drawing memory lives in `visualState`.
- The golden times in `test/sim.test.mjs` must not change. New physics goes behind a new **rules version**
  (`RULES_LATEST` in `050-race.js`): check `race.opts.rules` before applying it. New races get the latest rules;
  codes and ghosts carry the rules they were rowed under (code version 3 stores it). A new race `kind` works too.

## Writing new code

- Readable names, short functions, one-line comments saying why.
- Feel constants go in `TUNE` (`010-tune.js`) so the F8 panel can adjust them.
- Settings and records go through `STORE` (`105-store.js`), never raw `localStorage`.
