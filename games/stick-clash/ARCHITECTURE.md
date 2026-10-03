# Stick Clash v2: architecture contract

Stick Clash is an **original** browser game: wobbly physics stickmen fighting with floppy weapons. It is inspired by the
stickman-duel genre, but every name, visual and sound must be our own. Never use the name "Supreme Duelist" or copy any
of its assets, names, UI or level layouts. Generic archetypes (sword, axe, bow, gun…) are fine with our own names and art.

The project lives in this folder (a scratchpad, not a git repo). It has nothing to do with the `golf_game` repository:
don't read, edit or follow rules from `/home/user/golf_game`. `v1-reference.html` is the old single-file v1.

## Build and test

- `src/index.html` is the page shell with `<!--STYLE-->` and `<!--SCRIPT-->` markers. It holds only the canvas `#c`,
  an empty `#ui` (95-ui builds every panel inside it) and the touch buttons `#touch`.
- `src/style.css`, then `src/styles/*.css` in filename order, are inlined at `<!--STYLE-->`. **Slice owners who need CSS
  add their own `src/styles/NN-name.css`** (e.g. `95-ui.css`) instead of editing `style.css`.
- `src/js/*.js` are **ordered slices of one classic script**, concatenated in filename order inside one
  `<script>'use strict';…</script>`. Never use ES modules, `import`/`export`, extra `<script src>` tags or external libs.
- `node build.mjs` writes `dist/stick-clash.html`. It syntax-checks every slice on its own and the joined script
  (failing with `slice:line`), refuses `</script` inside code, and **fails on duplicate top-level names across slices**
  (a second `function draw()` would silently replace the first). Prefix helpers with your feature, e.g. `axeSpin()`.
- `node tools/smoke.cjs` (≈20 s, `--quick` for shorter sims) must pass before you report done. See "Testing" below.
  Tuning tools (all headless, run `node build.mjs` first; latest results in `tmp/balance.md`):
  `node tools/balance.cjs [secsPerPair=120] [diff] [workers] [onlyKeys]` (weapon round robin, ~4.5 min),
  `node tools/skill-balance.cjs` (skill impact and random-loadout win rates), `node tools/map-balance.cjs` (round
  lengths per arena), `node tools/ai-bench.cjs` (difficulty matrix + every mode to a result), `node tools/feel.cjs`
  (movement numbers). `node tools/juice.cjs` checks the real-time kill-cam replay with and without WebAudio.
- Top-level code in a slice may only use names from earlier slices. Function bodies may reference anything.
- The output is one self-contained HTML file (works from file:// and as an artifact). Only optional Google Fonts
  (Bungee, Chakra Petch) are fetched, with fallbacks. Save data only through `store`.
- Put scratch files in `tmp/` (screenshots from the smoke test go to `tmp/smoke/`).

## File ownership (slices)

| Slice | Owner | Contents |
|---|---|---|
| `00-core.js` | core | constants, `TUNE`, maths, `store`, error log + `hook`, event bus, registries + `def*`, world state, draw helpers |
| `10-physics.js` | core | points, links, integrate, solve, map collision (floor, walls, solids, one-way, moving), `PHYS`, map runtime |
| `20-fighter.js` | core | `makeFighter`, body + weapon rigs, `drive` (move, jump, dash, attack, skills, ranged aim), teams, statuses |
| `30-combat.js` | core | `strike`, `damage`, KO, clashes, projectiles, explosions, hazards, ring-outs, orb runtime |
| `35-effects.js` | core | particles, floating text, rings, beams, shake, hit-stop, slow-mo, flash |
| `40-weapons-melee.js` | weapons-melee | melee weapon defs |
| `45-weapons-ranged.js` | weapons-ranged | ranged and magic weapon defs |
| `50-skills.js`, `51-skills-elements.js`, `52-skills-control.js` | skills | skill defs, skill helpers and their statuses |
| `55-orbs.js` | core, then skills may extend | power-up orb defs |
| `60-maps.js` | maps | map defs |
| `65-ai.js` | ai | CPU brain |
| `70-modes.js` | modes | game mode defs |
| `75-cosmetics.js` | ui | hats, colour palettes, progression (coins, unlocks, achievements, stats) |
| `80-audio.js`, `81-music.js` | juice | sound effects (WebAudio synth, buses, panning) and the procedural synthwave music |
| `87-juice.js` | juice | game feel: punch zoom, K.O. chroma/vignette, landing dust, speed streaks, heartbeat, hit colours, extra settings |
| `85-render.js` | core, juice extends | camera, world drawing, fighters, HUD, banners |
| `88-killcam.js` | juice | K.O. instant replay (ring-buffer snapshots, slow-motion playback, letterbox) |
| `90-input.js` | core, juice extends | keyboard + rebinding, gamepads, touch |
| `95-ui.js`, `96-ui-loadout.js`, `97-ui-pages.js` | ui | menu framework + title/modes/arenas; loadout with live previews; settings, controls, help, shop, trophies, pause, results (CSS in `src/styles/95-ui.css`) |
| `99-main.js` | core | match/round flow, world step, main loop, boot, `window.SC` |

Owners edit only their own slices. If you need a hook in a core slice, make a **small additive edit** (re-read the file
first; never restructure or reformat others' code) and mention it in your report. New features may get a new slice with
an in-between number (e.g. `52-skills-extra.js`) if you own the area.

## Core API (globals)

### Constants, tuning, helpers (`00-core.js`)

```js
W = 1280, H = 720, DT = 1/120, TAU, VERSION, DEFAULT_COLORS (4 neon colours), FONT_DISPLAY, FONT_BODY
TUNE            // feel constants: speed, accelGround, accelAir, jumpVel, riseGrav, fallGrav, cutGrav, coyote, buffer,
                // dashVel/dashCd/dashTime, minHit, hitCd, dmgDiv, maxHit, headMul, kbMul, kbMax, staggerPerDmg,
                // hitstopMin, roundLimit, koDelay, startLock. Change only with SC.sim measurements.
clamp, lerp, rnd(a,b), rndi(a,b), pick(arr), chance(p), shuffle(arr), dist(a,b), angleTo(a,b), inRect(x,y,rect,pad)
segSeg(ax,ay,bx,by, cx,cy,dx,dy)   // closest points of two segments -> { d, s, t, px, py, qx, qy } (ONE shared object,
                                   // reused by the next call: read it at once and copy what you keep)
vx(p), vy(p)                       // verlet point velocity (px/s)
kick(p, vx, vy)                    // add velocity;  setVel(p, vx, vy) sets it
rgba('#rrggbb', a)                 // cached colour string
store.get(key, fallback), store.set(key, value)   // localStorage under 'stickclash.v2.', never throws
report(err, where)                 // log an error (console + SC.errors); tests fail on any
hook(def, 'method', ...args)       // call an optional content method with errors contained (this = def)
on(event, fn) -> unsubscribe, off(event, fn), emit(event, ...args)
line(ctx,a,b,color,w)  lineXY(ctx,x1,y1,x2,y2,color,w)  circle(ctx,x,y,r,fill,stroke,lw)  poly(ctx,pts,fill,stroke,lw)
glow(ctx, color, blur, () => { ...draw... })    // neon glow (shadowBlur) around what fn draws
```

**Events** (`on(name, fn)`): `boot`, `state(now, before)`, `matchStart(cfg)`, `roundStart(round)`,
`roundEnd(winnerTeam, reason)`, `matchOver(result)`, `damage(target, amount, opts)`, `hit(attacker, target, hit)`,
`ko(victim, killer, opts)` (opts.kind `'ringout'` for falls), `clash(A, B, x, y)`, `block(target, src)`, `attack(f)`,
`fire(f, proj)`, `jump(f)`, `dash(f)`, `skill(f, key)`, `status(f, name, secs)`, `orb(f, orb)`,
`explode(x, y, radius, owner)`, `mute(muted)`, `pad(action, slot)` (gamepad button edges), `escape(event)`.

### Registries and `def*`

```js
WEAPONS, SKILLS, MAPS, MODES, ORBS, HATS, STATUS     // plain objects keyed by id
defWeapon(key, def)  defSkill(key, def)  defMap(key, def)  defMode(key, def)
defOrb(key, def)     defHat(key, def)    defStatus(key, def)
listOf(reg)          // visible (not hidden) defs sorted by `order`
randomKey(reg, filter?)
```

`def*` merges defaults, stores `key` on the def and validates. Problems (bad key, duplicate key, missing required
function, unknown weapon `cat`…) are reported as errors, so the smoke test fails loudly but the game still runs.
Every def may set `hidden: true` (kept out of menus and random picks, e.g. off-hand halves, boss-only gear) and `order`.

### World state

```js
F          // fighters this round (2–4), index = roster index = f.id; summoned decoys (f.summon) are appended after
           // them with ids from 100, so skip f.summon when mapping fighters to roster slots
PROJ       // live projectiles          ORB_LIST // orbs lying in the arena
MAP        // runtime copy of the current map def (live solids/hazards with x, y, dx, dy per step; MAP.t)
PHYS       // { gravity, friction, drag, windX } — copied from the map each round
G_STATE    // { state: 'menu'|'play'|'paused'|'over'|'killcam', cfg, mode (def), roster, round, score[team], winScore,
           //   teams, t (game time), roundT, roundLimit, lock (start-of-round freeze), ending, winner, endReason,
           //   koT, demo, result, log[] (per-round summaries), info (what mode.setup returned), sim (true in SC.sim),
           //   override (function(dt) that replaces the world update while set, e.g. a kill-cam replay) }
```

### Fighters (`20-fighter.js`)

```js
{ id, team, ctrl: 'human'|'cpu', slot, autopilot, color, hat, name, scale,
  P: [points], L: [links],                 // body points 0..10, then weapon points
  w, wkey, ws, tip, main,                  // main weapon def/key, its segments [[a,b]...], tip index, rig
  off,                                     // off-hand rig or null. A rig is { w, ws, tip, pts, hand, elbow, links }
  skills: [key|null, key|null], skillCd: [s, s],
  hp, maxHp, alive, face (±1), grounded, status: { name: { t, max, power, src } }, immune,
  ammo, reload, atkCd, airJumps, dashCd, stagger, swingT, aim (radians, ranged),
  inp: { mx, my, jump, jumpHeld, attack, attackHeld, skill1, skill2, dash },   // jump/attack/skill/dash: one step
  mem: {},                                 // per-round scratch for your weapon/skill: f.mem.myThing (mem.extraJumps adds jumps)
  dmgTakenMul, kbMul,                      // optional multipliers a mode may set (e.g. a tanky boss)
  ai: {}, stats: { dmgDealt, dmgTaken, hits, kos, skills, jumps, shots, dashes } }
```

Body points: 0 head, 1 neck, 2 hip, 3/4 back elbow/hand, 5/6 weapon elbow/hand, 7/8 and 9/10 knee/foot.
`scale` > 1 makes a boss: body, reach and hp grow (`maxHp = 100 × hpMul × scale`), knockback shrinks.

Helpers: `makeFighter(opts)`, `equipWeapon(f, key)` (swap weapons mid-round), `rigsOf(f)`, `moveFighter(f, dx, dy)`
(teleport, keeps velocity), `feetY(f)`, `chest(f)` → {x,y}, `enemiesOf(f)`, `alliesOf(f)`, `nearestEnemy(f, visibleOnly)`,
`aliveTeams()`, `heal(f, amount, showFloat)`, `canAct(f)`, `spinAttack(f, power)` (the default melee swing),
`fireRanged(f, overrides)` (fires the ranged weapon with ammo/reload/recoil), `useSkill(f, slot)`,
multipliers `moveMul(f)`, `cdMul(f)`, `dmgMul(f)`, `takenMul(f)`.

**Statuses**: `addStatus(f, name, seconds, power = 1, src = null)` (re-applying refreshes time and keeps the higher power),
`removeStatus(f, name)`, `hasStatus(f, name)`. Built-in: `burn` (6×power dps), `poison` (3.5×power dps), `freeze` (can't
act, next direct hit ×1.25 and shatters it), `stun` (can't act, wobbly), `slow` (×0.55 speed), `rage` (×1.35 damage,
faster), `haste` (×1.45 speed, faster attacks), `regen` (6×power hp/s), `invis` (faint; CPUs lose track beyond 190px),
`shield` (blocks the next `power` direct hits), `giant` (weapon grows 1.5×). `stun` and `freeze` give a short immunity
after they wear off (no stun-locks). Weapons add `bleed` (axe, kusarigama: damage over time), `pinned` (crossbow: legs
held in place, ~40 % movement) and `bubbled` (bubble blaster: floats helplessly up). Add more with
`defStatus(key, { name, icon, color, debuff, max, immunity, onAdd(f, s), tick(f, dt, s), onEnd(f, s) })`;
`tickDot(f, dt, s, dps, color)` deals damage over time in readable chunks.
A content status may also set `moveMul`, `cdMul`, `dmgMul`, `takenMul` (a number, or `(f, s) => number`; folded into
the multipliers below by `statusMul`) and `draw(ctx, f, s)` (world-space overlay on the fighter, e.g. flames).
Statuses from the skills pack: `berserk`, `timewarp` (×.45 speed, ×1.8 cooldowns), `phantom` (a decoy's lifetime),
and from the orbs: `lifesteal`, `overcharge` (×2 damage), `tiny` (body shrinks to ~62%), `airwalk` (+1 air jump), `thorns`.
Summoned helpers (Mirror Decoy) are ordinary fighters in `F` with `f.summon = true` and `f.owner`: they get no HUD card,
vanish instead of being KO'd (no score, no `ko` event) and disappear when their owner is KO'd.

### Combat (`30-combat.js`)

```js
damage(target, amount, { src, x, y, nx, ny, kb, head, kind, status: [name, secs, power], parts, color, small })
```
All health loss goes through `damage`. `kind`: `melee | proj | explode | skill` are **direct** (blocked by `shield`,
scaled by attacker `dmgMul` and target `takenMul`/armour, knockback along (nx, ny) with strength `kb`, combo counter,
hit-stop on big hits); `status | hazard | ringout` are indirect (small numbers, no knockback). Returns the damage dealt.
Kills call `knockout(victim, killer, opts)`; the last attacker within 5 s gets credit for hazard/pit/status deaths.
The attacker's weapon `power` (balance knob, default 1) multiplies `melee`, `proj` and `explode` damage it deals
(`weaponPower`); skills deal `kind: 'skill'` (also for skill explosions: pass `kind: 'skill'` to `explode`) so their
damage never depends on the weapon held. Combo text: hits within 0.1 s of the last counted one (pellets, kunai fans,
minigun bursts) are the same combo step, and "N HIT COMBO" shows from 3 hits. A direct hit taken resets the victim's
combo (a combo means hits without being hit back). Each fighter has one combo label, updated in place; with more than
two fighters CPUs only show milestones (5, 10, ...). Once a round is decided (`G_STATE.ending`), the winning team takes
no damage at all, so lava or a burn during the K.O. delay can't undo a win.

Melee: every step each weapon rig (main **and** off-hand) is tested against enemy bodies; contact faster than
`TUNE.minHit` hits for `(speed − minHit + 60) / dmgDiv × weapon.dmg` (× head bonus, capped). Weapons meeting at speed
**clash** (sparks, both bounce, no damage); `block` > 0 bounces harder.

```js
spawnProj({ owner, x, y, vx, vy, r: 4, dmg: 10, life: 2, grav: 0 /* × map gravity */, drag: 0 /* 1/s */, wind: 0,
  pierce: 0, bounce: 0, homing: 0 /* rad/s */, kind: 'bullet', color, trail: true, explode: 0 /* radius */,
  status: null, kb: null, solid: true /* hits walls/solids */, headMul: 1.25,
  draw(ctx, p) {}, onStep(p, dt) {}, onHit(p, target, dealt) {}, onBounce(p) {}, onExpire(p, why, target) {} })
explode(x, y, radius, dmg, owner, { team, status, color, kb, selfDamage, kind })   // radial falloff + knockback
```
Projectiles collide with enemy bodies, world (floor, walls, solid blocks, one-way tops from above) and enemy weapons
with `block` > 0 (chance = block; a block reflects the shot and it changes sides). An `explode` projectile deals its
damage through the blast only.

### Effects (`35-effects.js`, skipped during `SC.sim`)

```js
burst(x, y, color, n, speed, { life, grav, size })   float(x, y, text, color, size, key)   ring(x, y, r, color, life, width)
beam(x1, y1, x2, y2, color, width, life)   shake(amount)   hitstop(seconds)   slowmo(seconds, rate)   flashScreen(color, alpha)
```
`float` stacks a new label above any fresh label it would overlap, and shows nothing in the menu's attract demo. A `key`
replaces the live label with the same key (combo counters). At most `MAX_FLOATS` (8) labels live at once (the oldest small
ones go first), and labels are clamped inside the camera view. **Effect functions are for game code only**: never call
burst/beam/ring/float/shake from a weapon or hat `draw()` (it runs in menus and previews too); draw sparkles directly.
burst, float, ring, beam, shake and flashScreen report to `FX_RECORD(kind, args)` when set (the kill-cam records them, so
effects replay in sync). Game feel (`87-juice.js`, drawing only): `CAM.punch` (brief extra zoom, set on hits ≥ 12 and
K.O.s, decays in `updateCamera`), a chromatic split + vignette on K.O., a hit-stop on clashes, longer slow-mo and a
hit-stop on the deciding blow, dust on hard landings, speed streaks behind launched fighters, and a heartbeat vignette +
sound for a real player under 30 % health. `hitColor(B)` gives hit sparks their colour (`SETTINGS.hitFx`: `'sparks'`
= the fighter's colour, `'red'` = red with falling droplets).

### Rendering (`85-render.js`)

`VIEW` describes the layout: on a portrait screen the world viewport fills the width and is taller than 16:9 (the
camera's minimum zoom `VIEW.zMin` keeps it inside the arena), and the HUD is scaled by `VIEW.hudK` (from CSS pixels, so
15px HUD text stays ~11px on a phone) and laid out within `VIEW.hudW` arena units; mode HUDs should keep their content
centred within that width. Floating labels that overlap while drifting are nudged apart each step (`floatSeparate`).
`ctx` is the 2D context; its backing store is capped at ~2.3 megapixels (`MAX_CANVAS_PIXELS`) and CSS scales it up,
because the frame cost grows with pixels while the arena is a fixed 1280x720 drawing. The camera (`CAM`) follows living fighters with a gentle zoom (≤1.24) and never shows outside
the arena; it is drawing-only. `focusCamera(x, y, secs)`, `banner(text, subText, seconds, color)`,
`drawStdBackground(ctx, map, t)`, `drawGridFloor(ctx, floorY, fill, gridColor, edgeColor)`, `glowLine(...)`,
`HAZARD_DRAW[kind](ctx, hz, t)` (built-in kinds: `lava`, `acid`, `spikes`, `electric`, `default`).
Fighters launched out of view get an arrow at the screen edge. Name tags and status icons sit above the hat:
`hatReach(key)` measures each hat's height once from its drawn pixels (cached), so new hats need no extra field.
The HUD names a fighter's off-hand weapon only when it isn't `hidden` (twin halves, gloves, staff ends).
`render` also calls `kcRecord()` (kill-cam snapshot), `juiceDrawWorld(ctx, dt)` (before fighters),
`juiceDrawScreen(ctx, dt)` (after the screen overlays) and `kcDrawOverlay(ctx)` (last). The HUD hides during a replay.

### Audio (`80-audio.js`, `81-music.js`)

`sfx(name, volume, always)` plays a synthesized sound (silent in the menu demo, in `SC.sim` and when muted);
`sfxAt(name, x, volume)` pans it by where `x` is on screen. Everything is a no-op where WebAudio is missing.
Built-in names: hit, clash, ko, orb, jump, land, swing, dash, shoot, boom, skill, block, reload, shatter, blink, slam,
round, fight, click, heartbeat, cheer, replay, plus hit layers `hit-slash|thud|stab|whip|punch|clang|bullet|magic|weird`
and `swing-blade|swing-chain`. Content slices add their own at boot: melee `pan saw crack punch zap gust quake`,
ranged `gun-*` (revolver, shotgun, minigun, sniper, rocket, twang, laser, plasma, flame, ice, zap, wand, void, ...),
skills (lunge, fireball, thunder, well, push, heal, ...), maps, and the menus (`nav back unlock coin deny`).
Check `defSfx` names before adding one: duplicates are reported as errors.
Add sounds with `defSfx(name, vol => { ... })` using `tone(f0, f1, dur, type, vol, delay)`,
`noise(dur, freq, vol, filterType, delay)`, `noiseSweep(dur, f0, f1, vol, filterType, delay, q)` (whooshes),
`metal(freq, dur, vol, delay)` (clangs) and `thump(f0, f1, dur, vol, delay)` (kicks, impacts). Slices that load before
80 register sounds inside `on('boot', ...)`. Weapons/skills can name their own: `ranged.sfx`, `skill.sfx`, and a weapon's
`hitSfx` replaces the category layer that plays on its hits (blade → hit-slash, heavy → hit-thud, ...; projectiles →
hit-bullet, magic → hit-magic). The crowd cheers on every K.O.
Mix: tone/noise → `SFX_BUS` → `MASTER` → compressor; music → `MUSIC_BUS`. `AUDIO_MIX` + `applyAudioMix()` set the bus
levels (Settings sliders); mute zeroes `MASTER`. Voices are capped (`AUDIO_MAX_VOICES`). `AUDIO_PITCH` < 1 pitches all
effects down (the replay uses .8).
Music (`81-music.js`): an original synthwave loop with a calm `menu` and a driving `fight` theme (`MUSIC_THEMES`, chords
as semitones), switched on bar lines by game state. It starts after the first key or tap, follows `SETTINGS.musicOn`,
muffles while paused / slow-mo / replaying, and adds hats when someone is low or at match point.

### Kill-cam (`88-killcam.js`)

While a real (non-demo, non-sim) match plays, `kcRecord()` keeps ~4.5 s of snapshots (fighter points, numeric fields and
statuses, projectiles, orbs, moving solids) plus timed effect and sound events. A round-ending K.O. is replayed:
the match-deciding one on `matchOver` (before the results appear), any other one on the next `roundStart` when
`SETTINGS.killcamAll` is on; `cfg.killcam === false` turns replays off. Playback sets `G_STATE.state = 'killcam'` and
`G_STATE.override`, swaps `F`/`PROJ`/`ORB_LIST`/`MAP` for ghosts (`Object.create(real)` with the recorded fields) and
restores them afterwards, so the real world is never changed. Any key, tap or pad button skips (after .45 s).
`advance` stops stepping the moment `G_STATE.override` is set: a replay that starts inside a step (on `matchOver` or
`roundStart`) must not let the rest of that frame's steps run physics or the CPU brain on the ghosts.
`SC.killcam.state()` / `SC.killcam.skip()` are test hooks.

### Input (`90-input.js`)

Defaults (rebindable in Controls, saved via `store`):
- P1: A/D move, W jump (press again in the air to double jump; tap for a short hop), S attack, Q skill 1, E skill 2,
  Left Shift or double-tap A/D to dash.
- P2: arrows move/jump, ↓ attack, `.` skill 1, `/` skill 2, Right Shift or double-tap to dash.
- With one human, P1 also accepts the P2 keys and every gamepad.
- Gamepads: stick/d-pad move, A jump, X attack, B skill 1, Y skill 2, RB dash, Start pause.
- Gamepads also accept RT = attack, LT = dash, LB = skill 1. Pads are tracked by browser index; with two humans pad 1
  drives P1 and pad 2 P2. Plugging a pad in toasts which player it drives; unplugging one mid-fight pauses. Pads of the
  fighter being hit rumble (where supported).
- Touch-first devices (coarse pointer) get on-screen buttons during play; they hide once a hardware key is pressed.
  Sliding a finger from ◀ to ▶ switches direction; the skill buttons show the skill icons and a cooldown sweep
  (CSS in `src/styles/90-touch.css`). Esc/P pause, M mute. Switching tabs pauses.

API: `BINDS[slot][action]`, `setBind(slot, action, code)`, `resetBinds()`, `keyLabel(code)`, `keyHint(slot, action)`,
`captureNextKey(cb)`, `togglePause()`, `readHuman(f)`, `pollPads()`.

### Menus, settings and progression (`75-cosmetics.js`, `95`–`97-ui`)

- Menu screens are built by `SCREENS[name]()` into `#<name>` panels; `openScreen(name, backTo)`, `goBack()`,
  `refreshScreen()`. Arrow keys/WASD and the gamepad d-pad move focus spatially, Enter/A presses, Esc/B goes back.
  `toast(title, sub, icon, color)` shows a notification (hidden while a kill-cam replay plays). Test hooks the smoke test relies on: `#menu .go` (Quick Fight),
  `#menu button` "Controls", `#controls .binds`/`.go`, `#pause .go` (Resume), `#over h2`, first `#over button:not(.go)` = Menu.
- The results screen only takes a fresh confirm: pad A / Enter / Space must be seen released for 300 ms after a 1.2 s
  grace (`UI_FRESH` in 95-ui), so holding or mashing from the fight never starts a Rematch; mouse/touch clicks are unaffected.
- The menu's cfg also carries `winScore` (only for modes whose `winScore` is the default 5 and that don't set
  `customRounds: true`), `hpMul` (applied to every fighter at `roundStart`), `speed` (game speed, read in `advance`),
  `orbs`/`orbRate` (item frequency, read in `stepOrbs`) and `killcam` (false = the player turned replays off;
  `SETTINGS.killcam` mirrors it).
- `SETTINGS` also has `hitFx`, `killcamAll`, `heartbeat` and `musicOn` (defaults added by `87-juice.js`, which also adds
  their controls to the Settings screen).
- `SETTINGS` (saved as `settings`) feeds `FX.shakeMul`, `FX.partMul` (particle count), `FX.dmgNumbers` and
  `AUDIO_MIX { master, sfx, music }` via `applySettings()`. Sound effects play through `SFX_BUS`; **music must connect
  to `MUSIC_BUS`** so the music slider works.
- `PROFILE` (saved as `profile`): coins, owned hats/colour packs, lifetime stats, trophies. Hats take `price` (0 = free).
  `defAchievement(key, { name, desc, icon, coins, need, progress(stats) })`, `unlockAchievement(key)`, `addCoins(n)`.
  Only matches with a real (non-autopilot) human count; `mode.practice: true` (and `training`) earns nothing.
  A mode's `results()` may add `won` (boolean), `tournament: true` or `waves: n`; otherwise the score and
  `G_STATE.info.run` (`cleared` waves, tournament `won` count) decide the coin reward.

## Content defs

### Weapon

```js
defWeapon('katana', {
  name: 'Katana', cat: 'blade',   // blade | heavy | polearm | chain | fist | ranged | magic | exotic | shield
  desc: 'Fast, light, long edge.',
  len: 86, mass: .9, dmg: 1.05, width: 5,
  chain: 0,          // >0 = flexible chain of N links (flail, whip, nunchaku)
  stiff: .25,        // elbow->tip link stiffness for rigid weapons (0 = none)
  lift: 1.1,         // fraction of gravity holding the tip up (rigid melee weapons)
  twoHanded: false,  // back hand also grips the weapon (visual)
  offhand: null,     // key of a (usually hidden) weapon def held in the back hand: dual wield, sword + shield
  block: 0,          // 0..1: chance to deflect projectiles; also bounces attackers harder in clashes
  cd: null,          // attack cooldown (default .5 + mass × .07)
  kb: 1, armor: 1, speed: 1,   // knockback ×, damage taken × while held, run speed ×
  color: '#dfe6ff',  // used for muzzle flashes, projectiles and HUD accents
  power: 1,          // balance knob: × all melee/projectile/blast damage dealt with it (tuned with tools/balance.cjs)
  ranged: null,      // { cooldown, ammo, reload, auto, speed, spread, recoil, pellets, sfx, proj: {spawnProj options} }
  attack(f) {},      // optional: replaces the default spin (melee) or fireRanged (ranged). f.atkCd is already set to cd.
  onHit(A, B, hit) {},   // after a melee hit lands: hit = { x, y, nx, ny, rel, head, dmg, part, rig }
  onStep(f, dt) {}, onEquip(f) {}, onClash(f, other) {},
  draw(ctx, f, s) {},    // required (see below)
  ai: { range: 140, style: 'melee', think(f, foe, dist) {} },   // style: melee | ranged | kite
})
```

`draw(ctx, f, s)` gets `s = { h, t, ux, uy, nx, ny, L, k, scale, color, face, off, pts, at(d, o) }`: hand and tip points,
unit vector hand→tip and its normal, current length, thickness scale `k` (grows with scale and giant), every rig point
(`pts`, for chains), whether this is the off-hand, and `s.at(d, o)` = point `d` px along the weapon from the hand
(negative = behind the hand) and `o` px to the side. Multiply widths by `s.k`.

Melee weapons swing with the default spin unless `attack` is given. Ranged weapons aim the weapon arm at the nearest
visible enemy (with a little wobble) and fire along the barrel; `auto: true` keeps firing while attack is held.

### Skill

```js
defSkill('blink', { name: 'Phase Step', icon: '✦', color: '#b98cff', cd: 5, sfx: 'blink', desc: '…',
  use(f) { /* return false if it can't be used right now: no cooldown is spent */ },
  onStep(f, dt) {},      // every step, for fighters carrying it (keep state in f.mem)
  draw(ctx, f) {},       // world-space extras, drawn after the fighter
  ai: { when(f, foe, dist) { return dist > 300; } } })
```
Skill helpers (`50-skills.js`): `skillFoesNear(f, x, y, r)`, `skillHit(f, e, amount, opts)` (direct skill damage, knocked
away from the caster), `skillLaunch(f, vx, vy)`, `skillAim(f, speed)` → `{ x, y, vx, vy, foe }` from the weapon hand,
`skillEnemyShots(f, x, y, r)`, `skillReflect(proj, f)`, `skillGround(x, y)`, `skillOverPit(f)`, `skillSafeAhead(f, dir, px)`.
`skillZone({ owner, x, y, life, danger, onStep(z, dt), onExpire(z), draw(ctx, z) })` makes a lingering object (cloud,
well, mine, telegraph): it rides `PROJ` (so it is stepped, drawn and cleared each round) but never collides (`zone: true`,
r < 0). Give a harmful zone `danger: radiusPx` and enemy CPUs step out of it / won't walk in (each CPU notices a zone
with a chance that grows with its level's `dodge`).
Skills live in `50-skills.js` (movement/melee), `51-skills-elements.js` and `52-skills-control.js`.

### Map

```js
defMap('volcano', { name: 'Caldera', desc: '…',
  gravity: 2200, friction: .18, drag: .996, windX: 0,   // windX is an acceleration (px/s²) on fighters
  floor: 650,          // y of the ground; null = bottomless: falling below H+260 is a ring-out KO
  walls: true,         // false: fighters can be knocked out past the sides too
  solids: [{ x, y, w, h: 14, oneWay: true, move: { dx, dy, period, phase }, draw(ctx, s, t) {} }],
  hazards: [{ kind: 'lava', x, y, w, h, dps: 20, tick: .25, status: ['burn', 2, 1], launch: 1000, color,
              move: {...}, onTouch(f, hz) {}, draw(ctx, hz, t) {} }],
  spawns: [[330, 650], [950, 650], [520, 300], [760, 300]],   // [x, feetY]; fighter i uses spawns[i]
  orbs: true, maxOrbs: 2,
  palette: { sky1, sky2, ground, line, accent, solid },
  drawBg(ctx, t) {}, drawFg(ctx, t) {}, drawSolid(ctx, s, t) {}, drawHazard(ctx, hz, t) {}, onStep(dt, t) {} })
```
`floorBusy: [{ x, w }]` marks floor spans (e.g. conveyor belts) where King of the Hill must not put its zone; it also
avoids hazards and bounce `pads`.
One-way platforms catch a fighter only when its feet were above them (you jump up through them). Moving solids carry
whoever stands on them. A full jump rises ~210 px and a double jump ~385 px: keep ledges within those heights.
Hazards with `launch` pop fighters up and out instead of letting them sit in the damage.

### Mode

```js
defMode('tournament', { name: 'Tournament', desc: '…', order: 40,
  players: [1, 1],            // min, max humans (menu hint)
  cpu: true,                  // show the CPU level picker
  pickers: 2, labels: ['You', 'CPU'],   // loadout pickers the menu shows (cfg.loadouts[i])
  winScore: 5, roundLimit: 60,
  setup(cfg) { return { roster: [{ ctrl, slot, team, weapon, skills, color, hat, scale, hpMul, name, aiLevel, spawn }],
                        winScore, roundLimit, map } },   // required; weapon/skills may be 'random' (rolled once per
                                                         // match, or every round with rerollRandom: true)
  roundOver(winnerTeam, reason) { return 'next' | 'match'; },   // default: first team to winScore
  onRoundStart() {}, onStep(dt) {}, onKO(victim, killer, opts) {},   // onStep only runs while the match flows (not 'over')
  hud(ctx) {}, drawWorld(ctx) {},
  results() { return { title, color, lines: [] }; },      // called once when the match ends
  roundLabel() { return 'WAVE 3'; },                      // optional: HUD text instead of "ROUND n"
  holdRound() { return true; },                           // optional: the mode ends rounds itself via endRound(team, reason)
  aiGoal(f) { return { x, y, w }; },                      // optional: a zone CPUs should stand in (feet y)
  aiArmor: false,                                         // optional: CPUs skip the difficulty toughness factor
  rerollRandom: true })                                   // optional: re-roll 'random' weapons/skills every round
```
`loadoutOf(cfg, i)` returns the menu's loadout `{ weapon, skills, hat, color }` for picker `i`.
`cfg` = `{ mode, map ('random' | key), diff ('easy'|'normal'|'hard'|'insane'), loadouts: [...], orbs, winScore, autopilot, demo }`.
Per-match mode state goes in what setup returns as `run` (read it as `G_STATE.info.run`). To change opponents between
rounds (ladders, waves), replace entries of `G_STATE.roster` in `roundOver` before returning `'next'` (fill every field:
70-modes uses `modeEntry`). Roster entries take `aiLevel` (a key of `AI_LEVELS`) and `spawn` (index into map spawns).

### CPU brain (`65-ai.js`)

`AI_LEVELS` (easy, normal, hard, insane) holds every difficulty knob; `aiShift(level, steps)` moves along `AI_ORDER`.
Modes can set `f.ai.behave = 'idle'` (stands still) or `'roam'` (moves, never attacks). Melee attack choice is learned
per weapon at runtime (`AI_MOVES`: plain swing / jump + swing / dash + swing by distance), so new melee weapons need no
AI code; ranged weapons are aimed with lead and arc compensation. Weapon `ai.think` still runs (every step for ranged
weapons, so hold-to-charge works). `incoming(f)` returns an enemy projectile about to hit `f` (skills use it).
Each level also has `armor` (damage taken ×) and, for Hard/Insane, `gunArmor` (extra toughness for a CPU holding a
ranged weapon). **They apply only when both attacker and target are CPU brains** (`aiArmorMul(B, A)`, read live in
`damage`): they separate the bot ladder, but a human always fights a CPU with exactly the health bar shown.
Against humans the top levels are made harder by behaviour instead: `brawl` (Hard .85, Insane 1) presses a close melee foe
(stand at half reach, swing the moment it's in reach) instead of the spacing dance, which lost to a walk-in masher;
against a human gunner only `AI_GUNNER_CLOSE` of decisions may use dash/jump-in tactics, and `AI_RUSH_HUMAN` caps
dash-rushing (a human gunner has none of the CPU gunner's evasion reflexes; its per-decision chance is scaled by
reaction time so faster levels don't rush more often). A human's gunfire makes a melee CPU flinch (`AI_FLINCH`: chance
per landed shot or blast, then ~0.6 s of holding its approach with a small step back) and it judges each human shot
only once for dodging; neither applies between CPUs, so the ladder and weapon balance are untouched. With `aiGoal` (King of the Hill) a CPU outside
the zone always pushes in (armed, at full run, dashing when far on the same level, orbs ignored until it's on the zone,
no idle hesitation), fights from inside it when it holds it (`aiStayInZone`: no hops, no dash/jump tactics), and takes it
when no foe is up.
Reflexes in `aiSafety`: dodge hazards and warning markers, leap a damaging floor hazard (lava, spikes ≤ 420 px wide)
that lies between the CPU and where it is going (`aiLeapHazard`: jump, double jump, air dash), cross pits, recover from
falls, and avoid enemy skill zones (`aiAvoidZones`).
`node tools/ai-bench.cjs [secsPerPair] [modeCap] [matrix|modes|all]` prints the level-vs-level win matrix and runs
every mode to a result; `SC.start({ mode: 'watch', diffs: ['easy', 'insane'] })` pits two levels.

### Orb, hat

```js
defOrb('heal', { name: '+35 HP', icon: '+', color: '#5dff9a', desc: '…', weight: 1, grab(f, orb) { heal(f, 35, false); } })
defHat('crown', { name: 'Crown', draw(ctx, f, h) { /* origin = head centre, -y = up; h = { r, face, scale, color } */ } })
```

## How to add things (tested, working snippets)

**A melee weapon with an on-hit effect**
```js
defWeapon('frost-axe', {
  name: 'Frost Axe', cat: 'heavy', desc: 'Chilly chops that slow the foe.',
  len: 70, mass: 1.8, dmg: 1.2, width: 6, kb: 1.1,
  ai: { range: 125, style: 'melee' },
  onHit(A, B, hit) { addStatus(B, 'slow', 1.5, 1, A); },
  draw(ctx, f, s) {
    line(ctx, s.at(-14 * s.k), s.t, '#7a5a3a', 5 * s.k);                          // handle
    poly(ctx, [s.at(s.L - 4 * s.k), s.at(s.L - 26 * s.k, 22 * s.k), s.at(s.L + 6 * s.k, 18 * s.k)], '#9fe8ff', '#e8fbff', 2);
  },
});
```

**Dual wield** (the off-hand is its own hidden weapon def)
```js
defWeapon('dagger-left', { name: 'Dagger', cat: 'blade', hidden: true, len: 42, mass: .5, dmg: .7,
  draw(ctx, f, s) { line(ctx, s.h, s.t, '#dfe6ff', 4 * s.k); } });
defWeapon('twin-daggers', {
  name: 'Twin Daggers', cat: 'blade', desc: 'A blade in each hand. Fast, short, relentless.',
  len: 42, mass: .5, dmg: .7, offhand: 'dagger-left', cd: .4,
  ai: { range: 95, style: 'melee' },
  draw(ctx, f, s) { line(ctx, s.h, s.t, '#dfe6ff', 4 * s.k); },
});
```

**A ranged weapon** (several pellets per shot)
```js
defWeapon('scatter', {
  name: 'Scattergun', cat: 'ranged', desc: 'Five pellets per blast. Deadly up close.',
  len: 46, mass: 1, dmg: .3, color: '#ffb347', twoHanded: true,
  ranged: { cooldown: .7, ammo: 2, reload: 1.5, speed: 1300, spread: .18, pellets: 5, recoil: 260,
    proj: { dmg: 4, r: 3, life: .45, drag: 1.5 } },
  ai: { range: 260, style: 'ranged' },
  draw(ctx, f, s) { line(ctx, s.at(-10 * s.k), s.t, '#5b4a3a', 9 * s.k); line(ctx, s.at(8 * s.k), s.t, '#2a2d3e', 5 * s.k); },
});
```

**A skill**
```js
defSkill('frost-nova', {
  name: 'Frost Nova', icon: '❄', color: '#9fe8ff', cd: 9,
  desc: 'Freeze every foe within 160px for 1.2 seconds.',
  use(f) {
    const c = chest(f), foes = enemiesOf(f).filter(e => e.alive && dist(chest(e), c) < 160);
    if (!foes.length) return false;                 // nobody in range: don't spend the cooldown
    for (const e of foes) damage(e, 6, { src: f, kind: 'skill', status: ['freeze', 1.2] });
    ring(c.x, c.y, 160, this.color, .4, 5);
  },
  ai: { when: (f, foe, d) => d < 150 },
});
```

**A map** (bottomless, moving platform, hazard; no `drawBg`, so the palette backdrop is used)
```js
defMap('sky-bridge', {
  name: 'Sky Bridge', desc: 'Two ledges over a bottomless drop.',
  floor: null, walls: false,                        // falling off = ring-out
  gravity: 2000, windX: 120,
  palette: { sky1: '#071a2b', sky2: '#1f4a6b', line: '#5ef2ff', accent: '#ffd84a', solid: '#10283d' },
  solids: [
    { x: 120, y: 560, w: 380, h: 40, oneWay: false },
    { x: 780, y: 560, w: 380, h: 40, oneWay: false },
    { x: 560, y: 430, w: 160, move: { dx: 0, dy: 90, period: 4 } },
  ],
  hazards: [{ kind: 'electric', x: 300, y: 540, w: 80, h: 20, dps: 12, status: ['slow', .5] }],
  spawns: [[260, 560], [1020, 560], [420, 560], [860, 560]],
});
```

**A mode** (four fighters, free for all)
```js
defMode('ffa', {
  name: 'Free for All', desc: 'You against three CPUs. Last one standing scores.', order: 40,
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 3,
  setup(cfg) {
    const roster = [{ ...loadoutOf(cfg, 0), ctrl: 'human', slot: 0, team: 0, name: 'YOU' }];
    for (let i = 1; i < 4; i++) roster.push({ ctrl: 'cpu', team: i, name: 'CPU ' + i, weapon: 'random', skills: ['random', 'random'] });
    return { roster };
  },
});
```

## Feel targets (measured with SC.sim)

`node tools/feel.cjs` (movement), `node tools/balance.cjs` (weapons), `node tools/skill-balance.cjs` (skills),
`node tools/map-balance.cjs` (arenas) and `node tools/ai-bench.cjs` (difficulty) measure these; run them after changing
anything that affects feel or balance, and update `tmp/balance.md`.

- Movement: run ~470 px/s reached in 0.13 s, stop in ~0.18 s (≈35 px of wobble-slide), turn in ~0.27 s.
  Full jump ~214 px (apex 0.33 s, lands 0.68 s), tap = short hop ~117 px, double jump ~385 px, dash ~195 px.
- Damage: a typical melee hit deals ~7–8 (heavy or head hits up to 26 before rage/status multipliers); 100 hp.
- Rounds (CPU vs CPU, random loadouts): median 8–15 s per arena at Normal, 9–18 s at Easy, longer for gun-vs-gun.
  Humans miss more than bots, so real matches land in the 10–30 s target.
- Fighters stay upright 86–99 % of the time.
- Weapons: every visible weapon wins 40–60 % (hard limits 35–65 %) of its round-robin rounds at Normal, where the
  shipped `power` values were tuned. Hard shifts a few slow-projectile guns down and instant ones up (≈34–68 %):
  Hard CPUs dodge 58 % of shots, so tune at Normal and check Hard stays inside 30–70 %.
- Skills: every skill should help its carrier against a skill-less mirror (impact ≈52–68 %) and land 40–60 % in
  random-loadout fights; the CPU should use each one about once or twice a round.
- Difficulty: each level beats the one below it in ~65–80 % of rounds (Easy→Normal→Hard→Insane).
Keep new content near these numbers (a new weapon should land between 40 % and 60 % in `tools/balance.cjs`;
adjust its `power` first, its mechanics second).

## Determinism

Not required (no replays from codes). Use `Math.random` freely. The kill-cam should record snapshots.

## Testing: `window.SC`

```js
SC.reg            // { WEAPONS, SKILLS, MAPS, MODES, ORBS, HATS, STATUS }
SC.start(cfg)     // start a match without the menu (default mode 'watch'). Shorthands: weapons: ['blade', 'spear'],
                  // skills: [['blink', 'slam'], ['none', 'none']], hats: ['crown', 'none']; autopilot: true lets the
                  // CPU brain drive human fighters. Returns SC.state().
SC.sim(seconds)   // run fixed steps synchronously: no drawing, sound, effects, hit-stop or slow-mo
SC.state()        // { state, mode, map, round, score, roundT, ending, winner, t, log, result,
                  //   fighters: [{ id, name, team, ctrl, hp, maxHp, alive, x, y, upright, wkey, skills, status, stats, nan }],
                  //   projectiles, orbs, errors }
SC.render(dt)     // draw one frame now
SC.press(i, 'jump'|'attack'|'skill1'|'skill2'|'dash')   SC.move(i, mx)   // drive fighter i (inputs persist in sim)
SC.errors, SC.TUNE, SC.F, SC.G (= G_STATE), SC.setState(state)
```
Tip: to stop the real-time loop interfering while you script a test, set `SC.G.state = 'paused'` after `SC.start`
(round flow then pauses too) and `SC.G.lock = 0` to skip the round-start freeze.

`node tools/smoke.cjs` builds, loads the page (offline) and asserts no console/page errors, then:
- every **weapon** (mirror match), **skill** (both fighters carry it; it's also pressed every second), **map** and
  **mode** (humans on autopilot, run until the match ends) is simulated: no errors, no NaN, damage happens, fighters
  mostly upright, ranged weapons fire, skills get used, finished matches produce a results title;
- every **orb** is grabbed, every **hat** and **status** is applied and drawn;
- core systems: ring-out, moving-platform carry, hazards, teams, boss scale, explode/homing/bounce/pierce projectiles,
  off-hand + shield deflect, freeze/shatter, giant, firing/reload, auto-fire, double jump, dash;
- the real UI: menu → Fight → keyboard (both key sets in 1P) → pause/resume → results → menu → controls panel,
  double-tap dash, a mocked gamepad, and touch buttons on a phone-sized touch screen.
It prints a table and exits non-zero on any failure. Screenshots: `tmp/smoke/`.
