# Voxel Links: how to develop this code

@legacy/CLAUDE.md

The guide above sets how to work with the person developing this game. This file sets how the code is built.

## Build and run

- `npm run build` joins `src/` into `dist/index.html`. It must pass before any commit.
- `/play` builds and opens the game. In the cloud it updates the published artifact; locally it runs `npm run dev -- --open`.
- `dist/` is generated. Never edit or commit it.

## Structure rules

- `src/js/*.js` are ordered slices of **one classic script** sharing global scope. Never convert them to ES modules
  or separate `<script src>` tags: `vqWorker` in `160-people.js` builds a Worker from the inline script's own text.
- Load order is filename order. A new feature gets a new file with an in-between prefix, e.g. `545-caddie-chat.js`.
- Top-level code must only use names defined in earlier files. Functions may reference anything.
- CSS goes in `src/styles/`, markup in `src/index.html`.
- The worker runs the game script headless, with no DOM, WebGL or libraries. Nothing at load time may assume they exist.

## Determinism: the one rule that must never break

Round codes, ghosts, clips and the verifier re-simulate shots from their inputs, so physics, course generation
and bots must give identical results on every machine.

- Never change behaviour for an existing course version (`W.cv`). New rules go behind a new version.
- Scored code uses the game's own maths (`MM`, see `withMath` in `000-math.js`) and seeded random numbers,
  never `Math.random` or raw `Math.sin`, `Math.pow` etc.
- Anything visual (camera, effects, golfer, libraries like Three.js) is **drawing only**: it may read game state,
  never write it.

## Writing new code

- New code should be readable: clear names, short functions, a one-line comment saying *why*.
  The existing code is dense; don't copy that style, and don't reformat old code just to tidy it.
- Constants that tune gameplay belong in `TUNE` (see `400-tuning-panel.js`) so the F8 panel can adjust them.
- Settings and saves go through the existing store (`010-saves.js`), never raw `localStorage`.
- Keep changes small and focused: one feature or fix per branch.

## Checking a change

1. `npm run build` passes.
2. Play it with `/play`: load a hole, take a few shots, finish the hole.
3. For anything touching physics, generation or rules, replay an old round code and a ghost to confirm
   they still verify.
4. Check the browser console for errors.

## Git workflow

- `main` always builds and plays. Work on a branch named `feature/…`, `fix/…` or `experiment/…`.
- Commit each working step with a plain-English message saying what and why.
- Merge to `main` through a pull request once the checks above pass, then delete the branch.
