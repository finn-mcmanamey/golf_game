# Voxel Regatta

A voxel rowing game built the same way as Voxel Links: plain HTML, CSS and JavaScript, hand-written WebGL,
no libraries, one self-contained `dist/index.html`.

## Run it

```sh
npm run build:rowing   # writes rowing/dist/index.html
npm run dev:rowing     # serves http://localhost:5174 and rebuilds on save
npm run test:rowing    # checks the race simulation in Node (no browser needed)
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
| C | TV button | camera: TV, chase, aerial, rower's eye |
| G, F8, Esc | | graphics, tuning panel, pause |

Modes: single races, **head races** on a winding river, a **season** of heats and finals, the **daily regatta**,
**learn to row**, a two-player **duel**, ghosts of your best race, and shareable race links.

## Layout

```
rowing/
  build.mjs          joins src/ into dist/index.html (about 40 lines)
  src/index.html     markup with {{styles}} and {{script}}
  src/styles/        CSS
  src/js/            slices of one script, joined in filename order
  test/sim.test.mjs  runs the simulation slices headless
```

| Files | What they are |
|---|---|
| `000`–`060` | **The simulation**: seeded courses, stroke physics, bots, races, race codes. Runs in Node with no DOM. |
| `100`–`160` | Drawing: WebGL shaders, meshes, scenery, boats and crews, cameras, effects |
| `105`, `210` | Saves and sound |
| `300`–`340` | HUD, input, cox calls, tuning panel, learn to row |
| `400`–`420` | Menus, season mode, boathouse |
| `900` | The main loop |

## The one rule: races must replay exactly

A race code is the race settings plus every input, tick by tick. Ghosts, replays and shared links re-row it,
so the simulation (files numbered below 100) must give the same numbers on every machine:

- Only `+ − × ÷`, `Math.sqrt` and the seeded `makeRng`. No `Math.random`, `Math.sin`, `Math.pow`.
- Drawing code reads race state and never writes it.
- Never change how an existing race kind behaves. `test/sim.test.mjs` pins exact finish times for fixed seeds:
  if a change moves them, put the new behaviour behind a new race kind or code version instead.
