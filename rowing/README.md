# Voxel Regatta

A voxel rowing game built the same way as Voxel Links: plain HTML, CSS and JavaScript, hand-written WebGL,
no libraries, one self-contained `dist/index.html`.

## Run it

```sh
npm run build:rowing   # writes rowing/dist/index.html
npm run dev:rowing     # serves http://localhost:5174 and rebuilds on save
npm run test:rowing    # checks the race simulation in Node (no browser needed)
node rowing/test/e2e.cjs   # plays one race per mode in headless Chromium (needs Playwright)
```

## How to play

Rowing is a rhythm: **hold** to drive the blades through the water, **let go** near the finish to recover,
and **press again** just as the slide reaches the front. That's a perfect catch. Perfect strokes in a row build
**swing**, which makes the boat run faster. Higher stroke rates go quicker but burn energy.

| Keyboard | Touch | Does |
|---|---|---|
| Space (hold) | hold anywhere | drive |
| W / S | − / + | stroke rate |
| A / D | ◀ / ▶ | steer |
| Shift | PUSH | power ten (drains energy) |
| C | TV button | camera: TV, director, chase, aerial, rower's eye |
| F | 📷 | photo mode: freeze, drag to orbit, scroll to zoom |
| G, F8, Esc | | graphics, tuning panel, pause |

Gamepads work too: A drives, the stick or d-pad steers, bumpers set the rate, RT pushes, Y changes camera, Start pauses.

The **rate plan** (menu) sets your stroke rate down the course for you: Classic (fast start, settle, sprint), Even,
or Manual. Pressing W/S takes over. Five fields, from Novice to Olympic; `test/balance.mjs` checks the steps between them.

Modes: single races, **head races** on a winding river, **indoor erg** races, the **Voxel Cup** knockout, a **season** of heats and finals, the **daily regatta**,
**learn to row**, a two-player **duel**, **cox mode** for crew boats (the crew rows; you steer, set the rate and call
three power tens), ghosts of your best race (or any race in your history),
shareable race links, and a Boathouse with a 3D showroom of your boat, colours, badges and history.

There's also an iPhone app wrapper in [`app/`](app/README.md): Expo plus a WebView, with real haptics.

## Layout

```
rowing/
  build.mjs          joins src/ into dist/index.html (about 40 lines)
  src/index.html     markup with {{styles}} and {{script}}
  src/styles/        CSS
  src/js/            slices of one script, joined in filename order
  test/sim.test.mjs  runs the simulation slices headless (determinism, codes, golden times)
  test/e2e.cjs       plays one race per mode in headless Chromium
  test/balance.mjs   races human-like rowers against each field
  app/               the iPhone app wrapper (Expo + WebView)
```

| Files | What they are |
|---|---|
| `000`–`060` | **The simulation**: seeded courses (lake, river, erg), stroke physics, bots, races, race codes. Runs in Node with no DOM. |
| `100`–`160` | Drawing: WebGL shaders, saves (`105`), meshes, smooth poses, scenery, erg hall, boats and crews, cameras, effects |
| `210`–`215` | Sound effects and menu music, all synthesised |
| `300`–`370` | HUD, input, cox and coach calls, commentary, tuning panel, learn to row, force curve, cox mode, race plans, photo mode |
| `400`–`430` | Menus and results, season, cup, boathouse, showroom, home-screen icon |
| `900` | The main loop |

## The one rule: races must replay exactly

A race code is the race settings plus every input, tick by tick. Ghosts, replays and shared links re-row it,
so the simulation (files numbered below 100) must give the same numbers on every machine:

- Only `+ − × ÷`, `Math.sqrt` and the seeded `makeRng`. No `Math.random`, `Math.sin`, `Math.pow`.
- Drawing code reads race state and never writes it.
- Never change how an existing race kind behaves. `test/sim.test.mjs` pins exact finish times for fixed seeds:
  if a change moves them, put the new behaviour behind a new race kind or code version instead.
