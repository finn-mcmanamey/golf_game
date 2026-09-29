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

## Using 3D libraries

The game draws with hand-written WebGL. Libraries can add richer visuals on top. Try each one on an
`experiment/…` branch first.

| Library | Good for |
|---------|----------|
| [Three.js](https://threejs.org) | Rigged human golfer, `.glb` models (clubhouse, cart, wildlife), lights and shadows |
| Three.js `GLTFLoader` + `AnimationMixer` | Loading models and playing swing or celebration animations |
| [postprocessing](https://github.com/pmndrs/postprocessing) (or Three's `EffectComposer`) | Bloom at sunset, hole-in-one fireworks glow, slow-motion depth of field |
| [React Three Fiber](https://r3f.docs.pmnd.rs) + [drei](https://github.com/pmndrs/drei) | Separate tools such as a course editor in `tools/`, where UI and 3D share state |
| R3F native + `expo-gl` | A future phone version with React Native and Expo |

Free models and animations: [Kenney](https://kenney.nl), [Quaternius](https://quaternius.com),
[Poly Pizza](https://poly.pizza), [Mixamo](https://www.mixamo.com) (rigged humans and golf swings).

### How to add one

1. `npm install three` (or the library), plus `esbuild` as a dev dependency.
2. Write an entry file in `src/vendor/`, e.g. `import * as THREE from 'three'; window.THREE = THREE;`
   importing only what's needed, and bundle it with `esbuild --bundle --format=iife --minify`.
3. Extend `build.mjs` to inline the bundle as its **own** `<script>` placed before the game script.
   The game script must stay separate and unchanged in form so `vqWorker` still finds it.
4. Draw on a transparent canvas layered over the game canvas, copying the game camera's view and projection
   each frame from the renderer in `100-renderer.js`. The game's own canvas stays in charge of the course.
5. Put models in `assets/` and embed them (base64) at build time, so `dist/index.html` stays one file.

### Rules for any library

- **Drawing only.** Libraries never touch ball flight, scoring, course generation or bots, or old replays break.
  Never use a physics engine for the ball.
- **Guard it.** Code that uses a library only runs on screen, after load, and checks it exists
  (`typeof THREE !== 'undefined'`). The round-checking worker runs without it.
- **Watch the size.** Note the bundle size in the pull request. Prefer tree-shaken imports and small `.glb` files.
- **Keep a fallback.** If the library fails to load, the original golfer and scene still draw.

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
