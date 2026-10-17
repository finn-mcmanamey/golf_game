# Stick Clash v4: architecture contract

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
- **Size budget:** the build prints every slice's size and **fails above 1.5 MB** (`SIZE_BUDGET` in build.mjs). v3 core
  is ~750 KB, which leaves ~790 KB for all v3 content. Music, voices and art stay procedural: no samples, images or
  model files. Check the printed table after your change and mention your slice's size in your report.
- `node tools/smoke.cjs` (≈5 min, 517 checks; `--quick` for shorter sims) must pass before you report done. See "Testing" below.
  Tuning tools (all headless, run `node build.mjs` first; latest results in `tmp/balance.md`):
  `node tools/balance.cjs [secsPerPair=120] [diff] [workers] [onlyKeys]` (weapon round robin, ~4.5 min; `V3=1` gives both sides the same random class and throwables per segment),
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
| `22-moves.js` | core (v3) | per-fighter v3 state, guard/parry/guard break, grab/throw/escape, wall slide/jump, dispatch to the other v3 slices |
| `24-classes.js` | core (v3) | the six classes (`defClass`) and `applyClass` |
| `30-combat.js` | core | `strike`, `damage`, KO, clashes, projectiles, explosions, hazards, ring-outs, orb runtime |
| `32-arms.js` | core (v3) | bare fists, disarm, weapon pickups and supply crates (they ride `PROJ`) |
| `33-power.js` | core (v3) | super meter, weapon levels, the 8 ultimates (`defUltimate`), the cut-in |
| `34-throwables.js` | core (v3) | throwables (`defThrowable`), aimed lobs |
| `35-effects.js` | core | particles, floating text, rings, beams, shake, hit-stop, slow-mo, flash |
| `36-shatter.js` | core (v3) | neon limb shatter on every K.O. (drawing only, replayed by the kill-cam) |
| `40-weapons-melee.js` | weapons-melee | melee weapon defs |
| `45-weapons-ranged.js` | weapons-ranged | ranged and magic weapon defs |
| `50-skills.js`, `51-skills-elements.js`, `52-skills-control.js` | skills | skill defs, skill helpers and their statuses |
| `55-orbs.js` | core, then skills may extend | power-up orb defs |
| `56-fusion.js`, `57-mounts.js` | core (v3) | elements + elemental orbs (`defElement`), mounts + mount orbs (`defMount`) |
| `60-maps.js` | maps | map defs |
| `58-world.js` | maps (v3) | weather, darkness + lights, breakables (`brkSolid`), the `worldFrame` hook |
| `59-styles.js` | art (v4) | arena art styles (`defStyle`): the style proxy, fighter/effect drawers, cached backdrops, the pixel layer, the "Arena art" setting |
| `63-maps-v3.js`, `64-maps-v3b.js` | maps (v3) | the 8 v3 arenas; 64 also adds breakables and weather rules to older arenas |
| `65-ai.js` | ai | CPU brain |
| `66-ai-moves.js` | core (v3), ai may extend | how CPUs use guard, parry, grabs, throwables, ultimates, walls, pickups, mounts |
| `70-modes.js` | modes | game mode defs |
| `71-modes-party.js`, `72-modes-survive.js` | modes (v3) | party helpers + CTF, Soccer, Hot Potato, Gun Game, Juggernaut; Zombie Horde, Battle Royale, Lava Rising |
| `73-modes-ranked.js` | modes (v3) | the Ranked ladder, `rankBadge()` for the title screen, rank-up celebration (CSS `styles/73-ranked.css`) |
| `74-boss-phases.js` | modes (v3) | `bossPhases` (multi-phase bosses, also for the campaign) and Boss Rush's phases |
| `73-duo.js`, `74-tagteam.js`, `79-silly.js` | modes (v4) | two players on one device: names, head-to-head records, handicap, round length, quick rematch, the 2-player setup panel; Tag Team; the silly-rules vote (CSS `styles/73-duo.css`). Co-op Waves is a Survival variant in 70, the co-op quest node is in 76/98 |
| `76-campaign.js`, `77-challenges.js`, `98-campaign-ui.js` | campaign (v3) | the trial engine, Mythic Quest (24 nodes, realm bosses, skill tree), 31 challenges; world map, dialogue and lists (CSS `styles/98-campaign.css`) |
| `75-cosmetics.js` | ui | hats, colour packs, settings, the v4 save migration, lifetime stats and achievements (trophies) |
| `78-outfits.js`, `78-pets.js` | cosmetics (v3) | outfits (cloth), weapon skins, K.O. effects, taunts + victory poses; helper pets |
| `79-lore.js`, `79-mutators.js`, `79-progress.js` | cosmetics (v3) | the Codex's hand-written lore (`LORE_LINES`, by registry key); match mutators + party mini-games; titles, secrets/cheat codes (`cheatKey`, `cheatEnter`), codex stats, presets |
| `98-ui-progress.js` | cosmetics (v3) | Look tab, presets, Fighter Creator (title picker), title-menu entries + title badge, Codex (with the Secrets tab's code box), arena mutators (CSS `styles/98-progress.css`, `styles/98-codex.css`) |
| `80-audio.js`, `80b-weapon-sfx.js`, `81-music.js`, `83b-voices.js` | juice (v4 sound) | sound effects (WebAudio synth, buses, panning), a sound per weapon, the procedural music with lead melodies, silly voice grunts |
| `87-juice.js` | juice | game feel: punch zoom, K.O. chroma/vignette, landing dust, speed streaks, heartbeat, hit colours, extra settings |
| `85-render.js` | core, juice extends | camera, world drawing, fighters, HUD, banners |
| `88-killcam.js` | juice | K.O. instant replay (ring-buffer snapshots, slow-motion playback, letterbox) |
| `82-announcer.js`, `83-crowd.js` | juice (v3) | synth announcer callouts (speechSynthesis or formant synth); procedural crowd bed + reactions |
| `84-postfx.js`, `86-photo.js`, `89-replays.js` | juice (v3) | bloom (WebGL, 2D fallback), dynamic lights, impacts, juice level; photo mode; highlight clips + WebM export (CSS `styles/84-fx.css`) |
| `84-quality.js`, `89-gif.js` | juice (v3.1) | Performance settings (quality presets) and GIF export of highlight clips: see each slice's header comment |
| `92-device.js` | input (v3.1) | the device layer: touch mode Auto/On/Off (`inputSeen`), the rotate card, fullscreen + landscape lock, viewport changes (CSS `styles/92-device.css`); see the slice header |
| `90-input.js` | core, juice extends | keyboard + rebinding, gamepads, touch |
| `91-touch.js`, `92-access.js`, `93-pads.js`, `94-savecode.js` | input (v3) | touch stick/gestures/button arc; accessibility; pad remap + join lobby; save codes (CSS `styles/92-access.css`) |
| `94-controls-card.js` | input (v4) | key strips, the controls card, the Controls settings group and the table-mode switches (CSS `styles/94-controls.css`); the schemes, Compact 2P and touch sets live in 90/91 |
| `95-ui.js`, `96-ui-loadout.js`, `97-ui-pages.js` | ui | menu framework + title/modes/arenas; loadout with live previews and the weapon picker (search, favourites, Recent); settings, controls, help, trophies & stats, pause, results (CSS in `src/styles/95-ui.css`, `96-loadout-v3.css`) |
| `99-main.js` | core | match/round flow, world step, main loop, boot, `window.SC` |

Owners edit only their own slices. If you need a hook in a core slice, make a **small additive edit** (re-read the file
first; never restructure or reformat others' code) and mention it in your report. New features may get a new slice with
an in-between number (e.g. `52-skills-extra.js`) if you own the area.

## Core API (globals)

### Constants, tuning, helpers (`00-core.js`)

```js
W = 1280, H = 720, DT = 1/120, TAU, VERSION, DEFAULT_COLORS (8 neon colours, one per slot), MAX_FIGHTERS (8), FONT_DISPLAY, FONT_BODY
TUNE            // feel constants: speed, accelGround, accelAir, jumpVel, riseGrav, fallGrav, cutGrav, coyote, buffer,
                // dashVel/dashCd/dashTime, minHit, hitCd, dmgDiv, maxHit, headMul, kbMul, kbMax, staggerPerDmg,
                // hitstopMin, roundLimit, koDelay, startLock. Change only with SC.sim measurements.
                // v4 hit feel: hitstopLow/hitstopMax (freeze for a hitstopMin..maxHit hit), hitstopKO; kbHeavyFrom,
                // kbHeavy, kbLaunch (heavy hits knock harder and pop the victim up).
TUNE_SILLY, TUNE_CLASSIC   // v4 body profile (TUNE starts with TUNE_SILLY; Object.assign(TUNE, TUNE_CLASSIC) = the v3 feel):
                // headLift/neckLift/hipLift, headSpring, spineK (neck bobble), armFlail, armTrail, legScramble,
                // tumbleMin/tumbleSpin/tumbleLift/tumbleTime, getUp (pop back up when lying, sitting or sunk on the hip),
                // koSpin/koPop/koBounce (36-shatter pieces). tools/smoke-feel.cjs checks it.
clamp, lerp, rnd(a,b), rndi(a,b), pick(arr), chance(p), shuffle(arr), dist(a,b), angleTo(a,b), inRect(x,y,rect,pad)
segSeg(ax,ay,bx,by, cx,cy,dx,dy)   // closest points of two segments -> { d, s, t, px, py, qx, qy } (ONE shared object,
                                   // reused by the next call: read it at once and copy what you keep)
vx(p), vy(p)                       // verlet point velocity (px/s)
kick(p, vx, vy)                    // add velocity;  setVel(p, vx, vy) sets it
rgba('#rrggbb', a)                 // cached colour string
store.get(key, fallback), store.set(key, value)   // localStorage under 'stickclash.v2.', never throws
onFlush(fn), flushSaves()          // slices with unsaved changes register a flusher (it checks its own dirty flag);
                                   // 99-main flushes on pagehide AND visibilitychange -> hidden, because iOS Safari
                                   // suspends or kills a backgrounded tab without a pagehide (profile, codex counters)
touchUI()                          // true while the on-screen controls are in use: hints say "Tap", not "Press"
report(err, where)                 // log an error (console + SC.errors); tests fail on any
hook(def, 'method', ...args)       // call an optional content method with errors contained (this = def)
on(event, fn) -> unsubscribe, off(event, fn), emit(event, ...args)
line(ctx,a,b,color,w)  lineXY(ctx,x1,y1,x2,y2,color,w)  circle(ctx,x,y,r,fill,stroke,lw)  poly(ctx,pts,fill,stroke,lw)
glow(ctx, color, blur, () => { ...draw... })    // neon glow (shadowBlur) around what fn draws, scaled by GLOW_SCALE
GLOW_SCALE                         // 1 | .5 | 0: Safari draws canvas shadows slowly, so the quality tier (High / Medium /
                                   // Low, via SETTINGS.quality or the SETTINGS.particles level 84-quality applies)
                                   // scales every glow; at 0 no shadow is set at all. 85-render's glowApply sets it
                                   // (wrapped into applySettings). Direct shadowBlur uses should multiply by it too.
```

**Events** (`on(name, fn)`): `boot`, `state(now, before)`, `matchStart(cfg)`, `roundStart(round)`,
`roundEnd(winnerTeam, reason)`, `matchOver(result)`, `damage(target, amount, opts)`, `hit(attacker, target, hit)`,
`ko(victim, killer, opts)` (opts.kind `'ringout'` for falls), `clash(A, B, x, y)`, `block(target, src)`, `attack(f)`,
`fire(f, proj)`, `jump(f)`, `dash(f)`, `skill(f, key)`, `status(f, name, secs)`, `orb(f, orb)`,
`explode(x, y, radius, owner)`, `mute(muted)`, `pad(action, slot)` (gamepad button edges), `escape(event)`.
v3: `parry(B, A)`, `guardBreak(f)`, `grab(A, B)`, `throw(A, B)`, `grabEscape(B, A)` (B broke out of A's grab),
`wallJump(f)`, `disarm(B, A, wkey)`,
`pickup(f, item)`, `levelUp(f, lvl)`, `ultimate(f, cat)`, `throwable(f, key, proj)`, `mount(f, key)`,
`dismount(f, key, why)`, `element(f, key)`, `shatter(f)`.

### Registries and `def*`

```js
WEAPONS, SKILLS, MAPS, MODES, ORBS, HATS, STATUS     // plain objects keyed by id
CLASSES, THROWABLES, MOUNTS, ULTIMATES, ELEMENTS     // v3 (see "v3 fighting depth" below)
defWeapon(key, def)  defSkill(key, def)  defMap(key, def)  defMode(key, def)
defOrb(key, def)     defHat(key, def)    defStatus(key, def)
defClass(key, def)   defThrowable(key, def)  defMount(key, def)  defUltimate(cat, def)  defElement(key, def)
listOf(reg)          // visible (not hidden) defs sorted by `order`
randomKey(reg, filter?)
```

`def*` merges defaults, stores `key` on the def and validates. Problems (bad key, duplicate key, missing required
function, unknown weapon `cat`…) are reported as errors, so the smoke test fails loudly but the game still runs.
Every def may set `hidden: true` (kept out of menus and random picks, e.g. off-hand halves, boss-only gear) and `order`.

### World state

```js
F          // fighters this round (2–8), index = roster index = f.id; summoned decoys (f.summon) are appended after
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
  ai: {}, stats: { dmgDealt, dmgTaken, hits, kos, skills, jumps, shots, dashes,
                   blocks, parries, grabs, throws, wallJumps, ults, thrown, disarms, pickups },   // v3 counters
  // v3 (22-moves initFightingDepth; read them, change them only through the APIs below):
  cls, clsKey,                             // class def + key ('none' = classless)
  stamina, maxStamina, blocking, guardBroken,  // guard
  heldBy, holding,                         // grabs (fighter refs)
  wallT, wallDir, wallSliding,             // walls
  super (0..100), ult ({ key, t, dur } while an ultimate runs),
  lvl (1..3), lvlDmg, reachMul, wxp,       // weapon level of the weapon held; wxp = { wkey: damage dealt } per match
  throws: [key|null, key|null], throwN: [n, n],   // throwables and how many are left this round
  element (key|null), mount ({ key, t, hp, ... } | null), shatterT (game time of the K.O. shatter, 0 = intact),
  inp also has blockHeld (held), grab, throw, super, mash (one step) }
```

Body points: 0 head, 1 neck, 2 hip, 3/4 back elbow/hand, 5/6 weapon elbow/hand, 7/8 and 9/10 knee/foot.
`scale` > 1 makes a boss: body, reach and hp grow (`maxHp = 100 × hpMul × scale`), knockback shrinks.

Helpers: `makeFighter(opts)` (v3 opts: `cls`, `throws`, `wxp`, `superKeep`), `equipWeapon(f, key)` (swap weapons mid-round), `rigsOf(f)`, `moveFighter(f, dx, dy)`
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

v4 hit feel: the freeze is `hitstopFor(amt, ko, deciding)` (35-effects): 0 below `TUNE.hitstopMin` (9), then 35→120 ms
up to `maxHit`, 190 ms for a K.O. blow (220 ms if it decides the round: `koDecides(B)`, at most one team left standing
unless the mode's `koEndsRound(B)` says no, as Tag Team does while a partner waits; the zoom, 87's slow-mo and chroma,
the announcer, the crowd and the highlight tags ask it too). `heavyShare(amt)` (0 below `kbHeavyFrom`, 1 at
`maxHit`) adds up to `kbHeavy` × knockback and `kbLaunch` px/s of pop-up, gives a surviving victim its air jump back
(so ledge launches are recoverable) and, from `tumbleMin` damage, `tumbleKick`: a spin round the hip and loose balance
for `f.tumble` s (not for riders, held fighters, bosses or a `swingArmor` swing). Guns: shots and blasts from a ranged
weapon also get `GUN_POWER` (45, 1.12); shields turn a shot with chance `shotBlock(block)` = block^1.7.

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
HUD band (v3.1): on a landscape screen taller than 16:9 (4:3 iPads) the letterbox strip above the viewport is
`VIEW.band`; `hudLayout()` (from `resize` and every `roundStart`, since the card rows depend on the roster) measures the
HUD block (`VIEW.hudH = hudBlockPx()`, the same row maths as `drawHUD`) and puts it in the band (`VIEW.hudY =
max(0, vy − hudH)`); whatever doesn't fit still overlaps the top of the viewport by `VIEW.hudOver` px (0 on a 12.9"
iPad, ~45 on an 11", the whole block on 16:9). The `MUTED (M)` note sits at the viewport's bottom corner.
`ctx` is the 2D context; its backing store follows the **resolution step** of 84-quality's ladder (v4.1, see
"Adaptive resolution" under "v4.1 graphics"): up to the screen's own pixels while frames keep up, step 3 being the old
~2.3 MP cap; CSS scales it to the window. `VIEW.inset` (v3.2) is the top
safe-area inset in canvas px, measured by a hidden probe (`#safe-probe`, `padding-top: env(safe-area-inset-top)`): a
home-screen (standalone) app has the status bar over the page, so `hudLayout` keeps `VIEW.hudY` below it in both
orientations (`hudOver` grows by whatever that pushes into the viewport). Every `getContext('2d')` in the UI and
render code checks for `null` (WebKit returns it when canvas memory is exhausted) and skips the drawing. The camera (`CAM`) follows living fighters with a gentle zoom (≤1.24) and never shows outside
the arena; it is drawing-only. One exception (v3.1): the strip of the viewport under the HUD (`VIEW.hudOver`, `topPad`
in arena units) is not usable height, so `updateCamera` zooms as if the viewport were that much shorter and, when
fighters are near the arena's top, lets the view rise above y = 0 by at most `topPad` so they sit under the HUD instead
of behind it. v4: that rise never pushes the lowest living fighter's feet below the view; when a high fighter and the
floor can't both fit, it zooms out by up to 6% (`CAM_OUT`), then the floor wins. Focus zooms (ultimate cut-in,
deciding K.O., kill-cam) keep their own framing. `bannerFit` shrinks each banner line to fit `W - 80` and splits a
subtitle that would drop below 56 px into two lines; with reduced motion (`SETTINGS.reduceFlash` or the system
setting) banners skip the pop-in zoom. The viewport is first filled with `mapSkyTop(MAP)` (`skyTopLive` recorded by `mapSky`, else the map's
`skyTop`, else `palette.sky1`), and `mapSky` / `drawStdBackground` paint a whole screen above the arena, so nothing
black shows there. `SC.view = { VIEW, CAM }` is the test hook. `focusCamera(x, y, secs)`, `banner(text, subText, seconds, color)`,
`drawStdBackground(ctx, map, t)`, `drawGridFloor(ctx, floorY, fill, gridColor, edgeColor)`, `glowLine(...)`,
`HAZARD_DRAW[kind](ctx, hz, t)` (built-in kinds: `lava`, `acid`, `spikes`, `electric`, `default`).
Fighters launched out of view get an arrow at the screen edge. Name tags and status icons sit above the hat:
`hatReach(key)` measures each hat's height once from its drawn pixels (cached), so new hats need no extra field.
The HUD names a fighter's off-hand weapon only when it isn't `hidden` (twin halves, gloves, staff ends).
`render` also calls `kcRecord()` (kill-cam snapshot), `juiceDrawWorld(ctx, dt)` (before fighters),
`juiceDrawScreen(ctx, dt)` (after the screen overlays) and `kcDrawOverlay(ctx)` (last). The HUD hides during a replay.
v4: `ctx` is a `let` (`CTX_MAIN` is the canvas's own context): the world pass (`drawWorld`) runs inside `artWorld`, which
points `ctx` at the arena's art-style proxy (see "Art styles"); it is `CTX_MAIN` again before the HUD. Draw world content
through `ctx` (or the context you are handed), never by holding on to a context, and never assume `ctx === CTX_MAIN`.

### Art styles (`59-styles.js`, v4; drawing only)

Each arena has an art style (`defMap(key, { style })`, default `'neon'`): **neon** (the classic glow + bloom), **ink**
(black brush on rice paper, one accent colour: Dojo, Jungle Temple), **pixel** (a chunky low-res world: Moon Base, Robo
Factory), **paper** (layered card with soft shadows: Candy Land, Giant's Kitchen) and **chalk** (pastel chalk on slate:
Spike Pit, Haunted Graveyard). Settings → Effects → **Arena art**: `SETTINGS.arenaArt` `'arena'` (default) |
`'neon'` (neon everywhere). `artStyleOf(map)` / `artNow()` (current `MAP`) / `artIs(key)` give the active style.
- **The style proxy.** `artWorld(draw)` runs 85's world pass with `ctx = artProxy(realCtx, style)`: every `fillStyle`,
  `strokeStyle`, `shadowColor` and gradient stop set on it goes through `style.map(rgba, use, hsl, alpha)`, so weapons,
  hats, outfits, skins (78's proxy wraps this one), statuses, projectiles, pets and mode drawings take the style with no
  code of their own. `artRaw(c)` unwraps it (draw unmapped, e.g. warnings); `artMono(c, colour)` paints one colour.
  ink/paper/chalk set `GLOW_SCALE` to 0 for the pass and turn bloom and the additive lights off (84); pixel keeps a
  small glow. Bodies: `style.body` (85's `artBody`); platform edges and slabs: `style.edge` / `style.slab` (85's
  `glowLine`, 60's `mapSlab`); 35-effects' particles: `style.dot`; impacts (84): `style.spark` / `flash` / `ring` via
  `artImpact`; `style.fxLife` makes flashes linger; paper adds card shadows (`artSurfaces`, `artWeaponShadow`).
- **Backdrops.** An arena may add `art: { top, bg(g, m), live(c, m, t) }` and start its `drawBg` with
  `if (artBg(ctx, this, t)) return;`. `bg` is drawn once into one reused offscreen canvas (`artBackdrop`, rebuilt on a
  resize or an arena/style change; arena thumbnails draw it directly), `live` adds the moving or gameplay bits every frame
  through the proxy (lanterns, vines and dart faces, steam, torches, bats), `top` is the colour above the arena.
  Helpers: `inkPaper`, `inkStroke`, `inkWash`, `inkSun`, `inkGround`, `paperBackdrop(g, draw)` (the arena's own drawing
  in card with shadows and cut edges), `chalkBoard`, `chalkLine`, `chalkHatch`, `artArc`. Hazards and platforms keep their
  geometry; `mapDrawWarn` warnings use the style's `warn` colour, unmapped.
- **pixel.** The world is drawn into one canvas about a quarter of the viewport's CSS size (`ART_PIXEL` = 4), resized
  only when the view changes, then scaled up with image smoothing off; colours snap to the 216 web-safe colours
  (fighters keep theirs). Text drawn there (damage numbers, name tags, warnings) is queued and redrawn crisp on top.
- **Readability.** Dark text outlines (35's floating labels, 70's `modeText`) are drawn through `artRaw(ctx)`, since
  chalk would turn them into light grain. Ink fighters and their weapons get a thin paper `halo` so they read against
  dark ink (the Dojo gate). `style.frame` colours the letterbox bands around the arena (ink paper, paper card, chalk
  wood; neon and pixel keep near-black).
- Jitter and textures (chalk grain, paper fibres) are seeded (`artHash`, `artRng`) so nothing flickers; chalk grain
  patterns are cached per colour. Test hooks: `SC.styles = { STYLES, ART, of(mapKey), reset(), layer() }`;
  `node tools/smoke-styles.cjs` (also run by smoke.cjs) renders every styled arena with 2 and 8 fighters at 1280x720 and
  1194x834 (`tmp/smoke/style-*.png`), checks the pixel layer, the setting, a kill-cam and a photo save, and that each
  style renders in at most 1.5x neon's time on the same arena (measured: 0.5-0.8x, since bloom and glow are off).

### Audio (`80-audio.js`, `81-music.js`)

`sfx(name, volume, always)` plays a synthesized sound (silent in the menu demo, in `SC.sim`, when muted and while the
AudioContext isn't running: `audioLive()`; `audioBusy()` is true then too, so no voice queues up to burst out on resume);
`sfxAt(name, x, volume)` pans it by where `x` is on screen. Everything is a no-op where WebAudio is missing.
Built-in names: hit, clash, ko, orb, jump, land, swing, dash, shoot, boom, skill, block, reload, shatter, blink, slam,
round, fight, click, heartbeat, cheer, replay. A name `family:arg` calls `SFX.family(vol, arg)`, so sounds that need a
weapon key or a pitch still record and replay as `(name, vol)` in the kill-cam: `ws:<weapon>` (swing or shot) and
`wh:<weapon>` (hit) from `80b-weapon-sfx.js`, `vox:<line>:<Hz>:<delay>` grunts from `83b-voices.js`.
Content slices add their own at boot: melee `pan saw crack punch zap gust quake`,
ranged `gun-*` (revolver, shotgun, minigun, sniper, rocket, twang, laser, plasma, flame, ice, zap, wand, void, ...),
skills (lunge, fireball, thunder, well, push, heal, ...), maps, and the menus (`nav back unlock chime deny`).
Check `defSfx` names before adding one: duplicates are reported as errors.
Add sounds with `defSfx(name, vol => { ... })` using `tone(f0, f1, dur, type, vol, delay)`,
`noise(dur, freq, vol, filterType, delay)`, `noiseSweep(dur, f0, f1, vol, filterType, delay, q)` (whooshes),
`metal(freq, dur, vol, delay)` (clangs) and `thump(f0, f1, dur, vol, delay)` (kicks, impacts). Slices that load before
80 register sounds inside `on('boot', ...)`. Weapons/skills can name their own: `ranged.sfx`, `skill.sfx`, and a weapon's
`hitSfx` replaces its `wh:` hit sound. The crowd cheers on every K.O.
Mix: tone/noise → `SFX_BUS` → `MASTER` → compressor; music → `MUSIC_BUS`. `AUDIO_MIX` + `applyAudioMix()` set the bus
levels (Settings sliders); mute zeroes `MASTER`. Voices are capped (`AUDIO_MAX_VOICES`); effects check
`audioBusy()`, which leaves `AUDIO_MUSIC_ROOM` voices free for the music (music checks `audioBusy(0)`). `AUDIO_PITCH` < 1
pitches all effects down (the replay uses .8; hit-stop drops it up to 10%).
**v4 sound:**
- **Weapons** (`80b-weapon-sfx.js`): `WSND` holds hand-made recipes; every other weapon uses `WSND_CAT[category]`, set by
  mass and reach at a pitch hashed from its key, so all 60 differ. The `attack`, `fire` and `damage` events play them.
  Held drones (chainsaw, minigun, flamethrower) use `audioHold(id, secs, …)`, which keeps playing while re-triggered
  and fades once it stops.
- **Punchier hits:** hits of about 13+ damage add a crack and a deeper thump; from about 17 `musicDuck(depth)` dips the
  music for ~0.3 s.
- **Grunts** (`83b-voices.js`, on 82's formant synth): oof/ow (big hits), waah (K.O.), hup (some jumps), hyah (heavy
  swings, skills), yay/hoho (round winners). Pitch comes from class and size plus a per-fighter offset; 0.35 s per
  fighter and 3 at once. Off in `SC.sim` and the demo, logged in `VOX.log`. Settings `voices` and `voiceVol`.
  Test hook: `SC.sound`.
Music (`81-music.js`): an original synthwave loop with a calm `menu` and a driving `fight` theme (`MUSIC_THEMES`, chords
as semitones), switched on bar lines by game state. It starts after the first key or tap, follows `SETTINGS.musicOn`,
muffles while paused / slow-mo / replaying, and adds hats when someone is low or at match point.

### v3 audio and visual effects (`81`–`84`, `86`, `89`; all drawing/sound only)

- **Music** (81): `MUSIC_ARENAS[mapKey]` = `[bpm, root, scale, verse degrees, chorus degrees, drums, bass, arp, lead wave,
  pad wave, swing]` gives every arena its own track (`musicArenaTheme(key)` builds and caches `MUSIC_THEMES['map:' + key]`;
  arenas without a row get a style rolled from their key). Grooves are 16-step strings in `MUSIC_DRUMS`. `musicIntensity()`
  (low health, match point, final round, `bossPhase`, last 10 s) eases into `MUSIC_DYN.level`, which adds 16th hats (.25),
  an octave bass + counter line (.45), snare rolls + crashes (.7); the final round modulates up 2 semitones.
  v4 lead melodies: a theme's `mel` holds the tune per form section as `[step, semitones, 16ths]` triples (hand-written
  for `menu`; `musicMelody()` seeds one per arena: a call ending open, an answer landing on the root). The lead rests
  for the first 4 bars of each loop (an octave up and at once in the final round). Its instrument comes from
  `MUSIC_LEADS[theme.leadStyle || art style]`: neon saw, ink flute/koto, pixel square, paper marimba, chalk whistle.
- **Announcer** (82): `announce(text, prio)` (silent in demo/sim, logged in `ANN.log` even without audio). Calls: round /
  "Final round" / a mode's `roundLabel`, "Fight!" when the start lock ends, "K.O.!", "Perfect!", "Close call!", "Double
  K.O.!", "Time!", "Ring out!", "Ultimate!", "Parry!" (a human involved), "Phase two", "You win!" / "You lose!" / "Game!".
  `SETTINGS.announcer` `'voice'` (speechSynthesis, low pitch) | `'synth'` (formant synth via WebAudio) | `'off'`; `annVol`.
- **Crowd** (83): `crowdReact(kind, vol, hype)` with kinds `ooh gasp boo clap roar` (sfx `crowd-*`), a murmur bed that
  swells with `CROWD.hype`; `SETTINGS.crowd` (also gates the K.O. cheer in 80).
- **Post-fx** (84): `SETTINGS.bloom` `off|low|high`: the frame is copied to a small canvas, uploaded to WebGL (threshold,
  separable blur, output on `#bloom`, blended with CSS `mix-blend-mode: screen`). No hardware WebGL (or software
  rendering) → a 2D glow (tiny self-multiplied copy screened back). Steps 4-6 of the v4.1 resolution ladder step bloom
  down (High→Low→half rate→off) when frames are slow; the old bloom governor is gone. `SETTINGS.lights`: additive glows for `fire`, `explode`, projectiles, burning fighters, glowing
  weapons/elements/Lv3, ultimates and lava/acid. `postfxImpact(x, y, nx, ny, amt, color, id)` (on every direct hit ≥ 5;
  recorded for the kill-cam) = direction sparks, flash, shockwave, squash-and-stretch (`postfxSquash` in `drawFighter`).
  `SETTINGS.juice` `calm|normal|chaos` scales particles/shake (wraps `applySettings`), slow-mo, flashes (chaos adds
  confetti and chroma kicks). `fxFlashMul()` honours `SETTINGS.reduceFlash`. Effects run on game time (freeze in pause).
  `render` calls `postfxFrame(dt)` once the arena (world, screen overlays, off-screen arrows) is drawn and **before**
  the HUD, banners and cut-ins, so the HUD never glows.
- **Photo mode** (86): pause → "Photo mode" (state `'photo'` + `G_STATE.override`): free camera (`photoCamera()` at the
  top of `updateCamera`), filters (CSS on `#c`/`#bloom`, baked with `ctx.filter` on save), frames, HUD toggle (hiding the
  HUD also hides name tags, status icons, speech bubbles and off-screen arrows: `photoHidesHud()`), PNG via
  `toBlob` + download + a preview dialog (`fxModal`) because embedded viewers may block downloads. Chromium's `toBlob`
  encodes only in idle time, which a redraw every frame starves (1–7 s for 1280x720): while a PNG encodes
  (`photoBusy()`) photo mode skips redraws (~0.1 s), and the button says "Saving…" after 1 s.
- **Highlights** (89): every real K.O. is scored and its kill-cam history copied (`hlFlush`, also forced by `kcReset` /
  `kcStart`); the best 5 per session stay in memory, the all-time top 5 summaries in `store 'highlights'`. The title
  menu's Highlights screen replays a clip through `kcStart` and exports WebM: `hlRecordFrame()` (called at the end of
  `render`) copies each finished frame into a 1280x720 canvas recorded by `captureStream` + `MediaRecorder`,
  with the game audio when WebAudio runs. Test hooks: `SC.announcer`, `SC.postfx`, `SC.photo`, `SC.highlights`.
  `node tools/smoke-fx.cjs` covers all of it (also run by smoke.cjs); `node tools/fx-perf.cjs` measures frame rates.

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
- v3: P1 F block (hold), C grab/throw, R throwable, X super; P2 `,` block, L grab, `;` throwable, Enter super.
  Block + attack also grabs. Saved v2 binds keep their keys; a new action whose default key is taken starts unbound.
- Gamepads: stick/d-pad move, A jump, X attack, B skill 1, Y skill 2, RB dash, LT block (hold), RT grab, LB throwable,
  R3 (or Back) super, Start pause. `PAD_BUTTONS` are the defaults; `PAD_MAPS[slot]` is each player's map, remapped on
  the Gamepad buttons screen (93-pads, from Controls or Settings; swaps, store `padmap` = changes only, Reset per
  player; Start and d-pad left/right are fixed). Pads are tracked by browser index; with two humans pad 1 drives P1 and
  pad 2 P2. Plugging a pad in toasts which player it drives; unplugging one mid-fight pauses.
- **Join lobby** (93-pads, "Local players…" on the arena screen of `crowd` modes): A joins a pad, B leaves, Start
  begins; a key of either keyboard set joins that set. `cfg.joined` = `[{ pad } | { keys }]` in join order (only with
  2+ players); every mode's `setup` is wrapped at boot so CPU seats become humans P1..Pn (team with the fewest humans
  first) and `JOINED` maps player n to its own pad/keys only (`padSlot`, `bindsFor`). Up to 8.
- **Rumble/haptics**: `feel(f, strength, ms, style)` on hits (both sides), K.O.s, parries, guard breaks and ultimates:
  `padRumble` (dual-rumble × `SETTINGS.rumble`) for that player's pads, and for a touch player `nativeHaptic(style)` →
  `window.StickClashNative.haptic` (iOS app, expo-haptics styles) or `navigator.vibrate`, rate-limited (90 ms).
- Touch-first devices (coarse pointer) get on-screen controls during play; they hide once a hardware key is pressed.
  91-touch: a floating stick where the left thumb lands (analog `TSETS[i].mx`; push up = jump, pull down =
  `SETTINGS.touchDown` block/grab/off), right-side gestures (`touchSwipe`: tap attack, swipe up jump, sideways dash,
  down grab) and the action buttons on two arcs around Attack (incl. taunt), sized/faded by `touchSize`/`touchAlpha`,
  relaid on resize (`touchLayout`). Multitouch: each finger is its own pointer. The skill buttons show the skill icons
  and a cooldown sweep (CSS `90-touch.css`, `92-access.css`). Esc/P pause, M mute. Switching tabs pauses.
- **v4 controls** (90-input, 91-touch, 94-controls-card; Settings → Controls): a scheme per player slot (`CTL.schemes`,
  store `controls` = `{ schemes: [P1..P8], layout }`, `schemeOf(slot)`, `setScheme`). **Advanced** = every action.
  **Simple** = move, jump, attack, one skill button (`skill1`; the super instead while the meter is full, HUD hint
  `★Q` / `SUPER · Q`, touch ★), block by holding back from an attacking foe (grounded; `simpleThreat`) or the block key,
  dash by double-tap; grab, throwables, skill 2 and taunt are ignored (`SIMPLE_OFF` in `pressAction`) and in play the
  fighter carries one skill and no throwables; an attack drops the guard (block + attack never grabs). With no grab
  key, a Simple player catches a Jungle Temple vine by touching it in mid-air (`jungleAutoCatch`, 63), and Training's
  key hint leaves out 3 (skill 2). With no save at
  all a new player starts on Simple; any existing save starts on Advanced (written to `controls` at once). CPUs,
  `SC.press` and trials are unaffected (`schemeOf` is Advanced in `mode.quest`: campaign nodes and challenges are built
  around throwables, grabs and two skills). **Compact 2P** (`CTL.layout`, `setKeyLayout`): P1 A/D move, W jump, S block, F attack,
  G skill; P2 ←/→, ↑, ↓ block, `.` attack, `/` skill and `,` skill 2 (its old block key; `COMPACT_KEYS`); the other
  actions keep their binds unless a core key took them. `keySets()` is what the two key sets do now (use it, not `BINDS`, to read keys: the loadout's
  `pickerKey(i, act)`, How to Play, the vote). `keyHint` names the player's own device: a key, a pad button (`padName`)
  or nothing on the touch screen (94's `ctlDevices`, which keeps each slot's last device in `SLOT_DEV` so one player's
  keys don't relabel a pad player). One-character key caps (`keyCap`, class `k1`) are wider and bold. In a fight every bound
  key is `preventDefault`ed; `/` `'` `.` always (Firefox quick find). **Key strips** (`SETTINGS.keyStrips`): each
  keyboard player's keys at their side (set 1 left, set 2 right), at match start and after 5 s idle, faded 3 s into
  play. **Controls card** (`SETTINGS.controlsCard`): before the first fight of a page session, only the schemes and
  devices in use (keys, pad buttons, a touch diagram; P2's turned in table mode); the fight waits behind it
  (`G_STATE.override`) until any key, pad button or tap; also "Controls card" in the pause menu. It never opens by
  itself under `navigator.webdriver` (like the benchmark): tests override it or call `SC.controls.card(hold)`.
  `cardAfter(fn, cfg)` runs fn once the card is gone (at once if it isn't open or about to open for that match start):
  73's first handicap toast waits for it instead of sitting behind its scrim. Key strips need a human in the roster.
  **Touch sets** (`TSETS[i]` = `{ slot, held, mx, box, stick }`; `TOUCH_SLOT` mirrors set 0): **table mode**
  (`SETTINGS.tableMode`, Settings → Touch, or "Both on this iPad: Table mode" beside Fight! for 2-player and party
  modes on touch screens; the lobby then takes two touch seats) gives P2 a copy of the set turned 180° in the top half,
  below the HUD block (`VIEW.hudY + hudH`), while P1's set takes the bottom half; each half drives only its player
  (`touchSeats`, set by 93-pads' `touchSeatsUpdate`). Set 1's stick: up/down are its player's own, sideways follows
  the screen. Haptics go to whichever touch player it was. Table mode needs a tablet: 92's `tableFits()` (the window's
  short side ≥ 700 CSS px) gates both switches, and `tableOn()` gates set 1's seat and the lobby's second touch seat,
  so a saved "on" does nothing on a phone. While set 1 drives a player, a hardware key or pad press doesn't hide the
  sets (92's `touchWanted`). Switching table mode off with two touch seats in the lobby frees the second
  (`lobbyTouchTrim`, with a toast that Player n needs a keyboard or pad).
  Advanced buttons are spread along each ring by arc length with size floors (48 px inner ring and block, 44 px outer
  ring) and at least ~7 px between any two, for one set and for both table-mode sets; a ring widens until its last
  button clears the screen edge. Simple sets keep their 59/59/44 px. P2's set has its own pause (`.tpause.tpause2`,
  added after P1's so `#touch .tpause` is still P1's). On coarse pointers, menu controls are at least 44 px.
- **Accessibility** (92-access, Settings → Accessibility): `cbPalette` (deutan/protan/tritan colours for fighters and
  `PARTY_TEAMS`, plus shape markers + health-bar patterns via `accessCardMark`/`accessTagMark` in 85-render),
  `reduceFlash` (flashes ×.35, shake ×.25, arenas don't strobe: drawing code checks `SETTINGS.reduceFlash`),
  `oneButton` (`oneButtonDrive(f)` from `readHuman`: auto-move/jump, press attack, hold block, double-tap super/skill)
  and `practiceSpeed` (`accessSpeedMul()` in `advance`: one human, never Ranked; also a slider in the pause menu).
- **Save codes** (94-savecode, Settings → Transfer progress): `makeSaveCode()` / `readSaveCode(text)` /
  `savePreview(data)`: every `stickclash*` localStorage key as `SC1z.<base64url deflate>.<fnv1a>` (`p` = plain when
  CompressionStream is missing); import previews, confirms in-page, replaces the keys and reloads. An older (v3) code
  is stripped of what v4 dropped (`saveStripV3`, 75) before its shapes are checked (`SAVE_SHAPES` / `SAVE_MAPS`, incl.
  `duo` with its `pairs` map and `controls`).

API: `BINDS[slot][action]`, `setBind(slot, action, code)`, `resetBinds()`, `keyLabel(code)`, `keyHint(slot, action)`,
`captureNextKey(cb)`, `togglePause()`, `readHuman(f)`, `pollPads()`, `setPadBind(slot, action, button)`,
`resetPadMap(slot)`, `feel(f, ...)`, `nativeHaptic(style)`, v4: `keySets()`, `schemeOf(slot)`, `setScheme(slot, v)`,
`setKeyLayout(v)`, `TSETS`, `touchSeats(a, b)`. Tests: `node tools/smoke-access.cjs` and `node tools/smoke-controls.cjs`
(both run by smoke.cjs; the second covers schemes, Compact 2P, key strips, the card and table mode).

### Menus, settings and progression (`75-cosmetics.js`, `95`–`97-ui`)

- Menu screens are built by `SCREENS[name]()` into `#<name>` panels; `openScreen(name, backTo)`, `goBack()`,
  `refreshScreen()`. Drawn tiles (weapon icons, hat heads, the Codex's weapon icons) come from `uiTile(id, w, h, cls,
  draw)` (96-ui-loadout, v3.2): a cache keyed by id, size and pixel ratio that hands back the same canvas element on
  every rebuild, so a tap on the loadout no longer redraws ~55 icons; it empties itself past `UI_TILE_MAX` entries.
  Wording follows the controls: `touchUI()` picks "Tap…" over "Press…" / "Hover…" (kill-cam skip hint, skill info). Arrow keys/WASD and the gamepad d-pad move focus spatially, Enter/A presses, Esc/B goes back.
  `toast(title, sub, icon, color)` shows a notification (hidden while a kill-cam replay plays; on the results card at the
  top, newest only, clear of its buttons). Test hooks the smoke test relies on: `#menu .go` (Quick Fight),
  `#menu button` "Controls", `#controls .binds`/`.go`, `#pause .go` (Resume), `#over h2`, first `#over button:not(.go)` = Menu.
  On the results card a toast shows only in the gap above the card; otherwise it waits until the card closes (97 wraps
  `toast`; the card lists the match's trophies anyway), so none covers its title or score. A card taller than the
  screen scrolls with its button row pinned to its bottom edge (`styles/97-results.css`). Arrows / d-pad skip
  `tabindex="-1"` controls (`focusables`); a pad's Y in a menu emits `menuAlt` (the focused control's second action).
- The results screen only takes a fresh confirm: pad A / Enter / Space must be seen released for 300 ms after a 1.2 s
  grace (`UI_FRESH` in 95-ui), so holding or mashing from the fight never starts a Rematch; mouse/touch clicks are unaffected.
- The menu's cfg also carries `winScore` (only for modes whose `winScore` is the default 5 and that don't set
  `customRounds: true`), `hpMul` (applied to every fighter at `roundStart` by `applyMatchHp(f)` in 75, which the
  respawn helpers `partyRespawn` (71) and `kothRespawn` (70) also call; `matchHpMul()` is 1 for the demo and for modes
  whose `run` carries health over), `speed` (game speed, read in `advance`),
  `orbs`/`orbRate` (item frequency, read in `stepOrbs`) and `killcam` (false = the player turned replays off;
  `SETTINGS.killcam` mirrors it).
- `SETTINGS` also has `hitFx`, `killcamAll`, `heartbeat` and `musicOn` (defaults added by `87-juice.js`, which also adds
  their controls to the Settings screen).
- `SETTINGS` (saved as `settings`) feeds `FX.shakeMul`, `FX.partMul` (particle count), `FX.dmgNumbers` and
  `AUDIO_MIX { master, sfx, music }` via `applySettings()`. Sound effects play through `SFX_BUS`; **music must connect
  to `MUSIC_BUS`** so the music slider works.
- **v4: no economy.** There are no coins, shop, track, XP or quests: every hat, colour pack and look is free from the
  start, and a `hidden` def (the secret weapon, hat, K.O. effect, outfit and titles) stays out of every list until its
  secret is found (`secretShow`, 79). `PROFILE` (saved as `profile`) = `{ ach, flags, stats }`: trophies and lifetime
  stats. `defAchievement(key, { name, desc, icon, need, progress(stats) })` (all play-based, ≥ 28), `unlockAchievement(key)`,
  `checkAchievements()` (also once at boot, so a migrated save gets the trophies it already qualifies for).
  `recordMatch()` counts a finished match once (the results card and `matchOver` both ask) and returns `{ won }` or
  null: only matches with a real (non-autopilot) human count; `mode.practice: true` (and `training`) count toward
  nothing. A mode's `results()` may add `won` (boolean), `tournament: true` or `waves: n`; otherwise the score and
  `G_STATE.info.run.cleared` decide. New trophies of the match are listed on the results card (`trophyBox`, 97).
  (`accessRewardMul()` is gone from 92-access.)
- **Save migration** (75, at load, before `PROFILE`/`PROG` are read): `saveMigrateV4()` strips `SAVE_V3_DROPS` from a v3
  save (`profile`: coins, earned, hats, packs, stats.purchases; `prog`: xp, own, seen; the whole `tasks` key) and keeps
  everything else; `SAVE_MIGRATED` makes the boot toast "Everything is unlocked". `saveStripV3(keys)` does the same to
  a `{ fullKey: json }` map (94's imported codes). Fixture: `tools/fixtures/save-v3.2.json` (made by playing v3.2).
- **Weapon picker** (96): store `picks` = `{ fav: [[P1], [P2]], recent: [[P1], [P2]] }` (`PICKS`, `favToggle`,
  `pickPlayer(i)`: human pickers are P1/P2, a CPU picker shows P1's lists). The weapon a real player carries into a
  match joins their Recent row (on `matchStart`, which fires after round 1's fighters exist; six, newest first). The
  search box filters tiles in place (`weaponFilter` over each cell's `data-find`: name, key, category, description,
  traits) and keeps `LO.query` across rebuilds; the menu's key navigation ignores text fields (`typingIn`), so WASD
  type. `moveFocus` measures the sideways offset to a target's nearest edge, so wide controls are reachable by d-pad.
  Each tile's ☆ is out of the arrow / d-pad order (`tabindex="-1"`): F or a pad's Y favourites the tile in focus
  (`favFocused`; the `.w-tip` hint says so off touch screens).

### Customisation and progression (`78`–`79`, `98-ui-progress`)

- **Look**: a roster entry may carry `look: { outfit, skins: { cat: key }, ko, pet, pose }` (the menu fills it from the
  loadout through `loadoutOf`/`loadoutForMatch`; `SC.start({ loadouts: [{ look: {...} }] })` in tests). `lookOf(f)` reads it
  (a decoy uses its owner's). Registries `OUTFITS`, `WSKINS`, `KOFX`, `POSES`, `PETS`, `TITLES` use `defLook(reg, key, def)`
  (`hidden` = secret). Drawing only, except pets and taunts.
- **Outfits**: `strands` (verlet ribbons hung from body points, `layer` back/front) plus optional `back`/`front(c, f, P, s, t)`
  pieces. The renderer calls `outfitDraw(ctx, f, look, 'back'|'front', t)` around the body; cloth state is a WeakMap per
  fighter object, so previews and kill-cam ghosts get their own.
- **Weapon skins**: chosen per weapon category. `skinDrawWeapon(ctx, f, rig, view, look)` hands the weapon's own `draw`
  a context proxy that maps every fill/stroke/shadow colour through the skin's palette (by brightness), then draws the
  skin's `over(ctx, s, t)` sparkle. New weapons need nothing extra.
- **K.O. effects**: the K.O.er's `look.ko` plays `koFxSpawn(key, x, y, color)` on top of the shatter (game-time particles,
  recorded for the kill-cam as `KC_FX.koFx`).
- **Taunt** (`inp.taunt`; P1 T, P2 `'`, pad d-pad up): `TAUNT.time` s pose; finished with no foe within `TAUNT.safe` px
  and untouched = `+TAUNT.meter` super (events `taunt`, `tauntDone`). Winners hold `look.pose` through the K.O. delay
  and behind the results.
- **Pets**: `defPet(key, { cd, ready(f, pet) -> target|false, use(f, pet, target), draw(c, x, y, t) })`, state in
  `f.mem.pet`, event `petUse(f, key)`. `petsAllowed()` is false in `ranked`, `ohko`, `mode.noPets` or `cfg.pets === false`.
- **Mutators**: `cfg.mutators: [keys]` (arena screen). `defMutator(key, { match(cfg), round(), fighter(f), step(dt),
  ko(V, K), hit(B, amt, o), secret })`. Off in ranked, campaign and challenge. Big Heads sets `f.headMul` (render only).
  `fighter` hooks run once per fighter (`mutFighter`), also for fighters entering mid-round (71's `partyEnterRules`).
- **Mini-games**: from round 2, every other round of versus/pvp/watch/team/ffa/roulette/tournament may open with a
  10-15 s mini-game (`cfg.minigames` true/false, else `SETTINGS.minigames` auto = watch and party modes). Nobody can
  be K.O.'d (damage x.01 with `f.quietHits` so no damage numbers pop, health refilled, fallers return); `miniFinish`
  then calls `newRound()` and the winner gets a
  small perk. `defMini(key, { time, score, start(m), step(m, dt), draw(c, m) /* world */, hud(c, m) })`; events
  `miniStart(key)`, `miniEnd(key, winner)`.
- **Progress** (store `prog` = `{ title, secrets, codex }`): `lookUsable(kind, key)` (exists and not hidden), the title
  worn (`PROG.title`, picked in the Fighter Creator, shown on the title screen's badge). Codex rows and the feats that
  unlock secrets are settled once per counted match (on `matchOver`). Secrets: `SECRETS` (codes typed on the title screen via `cheatKey`, typed into
  the Codex's Secrets tab via `cheatEnter(text)` (letters and ↑↓←→, returns the matched key), or feats),
  `secretUnlock(key)`. Codex stats: `codexRow(kind, key)` = [uses, wins, K.O.s]. Codex lore: `codexLore(kind, key,
  name, cat)` returns the hand-written `LORE_LINES[kind][key]` (79-lore: kinds w s c m b r p x, two sentences each,
  bosses by campaign node id, realms by `CAMP_REALMS[i].key`; `SC.lore` in tests) and falls back to its generator for
  entries without one. Presets (store `presets`):
  `presetSave/presetApply/presetDelete`.
- Tests: `node tools/smoke-progress.cjs` (also run by `tools/smoke.cjs`): the looks, pets, mutators and mini-games, no
  economy left (functions, fields, screens, and no coin/XP/Shop/Track/Quest text on any screen), every cosmetic free and
  the secrets hidden until found, ≥ 28 trophies, a match counted once, Ranked settled once, the v3.2 fixture migrating
  and importing as a code, and the weapon picker (search by keyboard, d-pad and touch, favourites, Recent).

## v3 fighting depth (core layer: every mode, arena and CPU gets it)

All of this is on for every fighter in every mode unless noted. A content agent normally only *uses* it; to opt out,
see "Hooks for modes" below.

### Moves (`22-moves.js`)

- **Guard:** `inp.blockHeld` raises it (`f.blocking`) while the fighter can act, isn't mounted, holding someone or in an
  ultimate, and has stamina. `damage()` calls `guardHit(B, A, o, x, y, amount)` for direct hits: from the front
  (`guardFront`: push direction, or the projectile's velocity) a guard lets `BLOCK.chip[kind]` through (melee .2, proj
  .2, skill .5, explode .6) and knockback × .35, and costs stamina. A hit within `BLOCK.parryWin` (.15 s) of a *fresh*
  guard (not re-raised within .3 s) is a **parry**: 0 damage, +30 stamina, +10 super, the melee attacker is stunned
  .65 s, a projectile is reflected (`o.proj`). Blasts (`o.blast`) can't be parried. Stamina at 0 = **guard break**
  (1.1 s stun). `o.unblockable` skips the guard (grab throws use it).
- **Grab:** `inp.grab`, or `inp.attack` while blocking. `tryGrab(A)` takes the nearest grabbable foe within
  `GRAB.reach` (not mounted, ragdolled, in an ultimate, a summon or much bigger; a foe in reach whose only problem is
  its size, `scale > 1.3×` yours, floats "TOO BIG" instead, so bosses stay ungrabbable but not silently). The holder carries the foe
  (`carryHeld`) and throws on attack/grab (or after `GRAB.hold` s): 9 damage (kind skill, unblockable), the foe flies
  and gets the `ragdoll` status (limp, can't act). The held fighter breaks free after `GRAB.mash` presses
  (`inp.mash` or any action key; left/right taps count too).
- **Walls:** airborne against the arena edge (`MAP.walls`) or the side of a solid (`oneWay: false`, `h >= 50`):
  `f.wallT` (coyote) and `f.wallDir`; pressing into it caps the fall at `WALL.slide`; jump then calls `wallJump(f)`
  instead of the air jump.
- `drawFighterUnder(f)` / `drawFighterOver(f)` are the render hooks (guard arc, element glow, Lv3 trail, mounts,
  ultimates).

### Classes (`24-classes.js`)

```js
defClass('ninja', { name, icon, color, desc, passive, order,
  hp: 1.05, speed: 1.14, mass: .9 /* knockback taken = mass^-0.8 */, stamina: .9, dmg: 1 /* all damage */,
  melee: 1 /* melee only */, cd: 1 /* skill cooldowns */, ammo: 1, reload: 1 /* reload speed */, dash: 1 /* distance */,
  dashCd: 1, airJumps: 0, disarm: 1, superGain: 1, throwBonus: 0, onDash(f) {} })
```
Roster entries take `cls` ('random' is rolled once per match). Bosses (scale > 1.05) default to `'none'`. Tune with
`node tools/class-balance.cjs [segments] [secs] [diff] [workers]` (mirror random loadouts, sides swapped, every pair);
`CLASSES='{"tank":{"hp":1.1}}'` tries numbers without editing. Measured at Normal after the v3 integration pass
(Brute melee 1.12 → 1.08, Ninja hp 1.05 → 1.08): every class 44–53 %, every pair 40–60 % (target 35–65 %).

### Disarm, pickups, supply crates (`32-arms.js`)

A melee hit (or a shot of 14+) deals `damage` → chance `clamp((dmg - 12) / 40, 0, .45)` × Brute bonus × head 1.3 to
`disarm(B, A, o)`: the weapon becomes a pickup and B gets the hidden `fists` weapon. Pickups are `PROJ` zones
(`kind: 'pickup'`, `pickup: 'weapon' | 'crate'`, `wkey`), so they are stepped, drawn, kill-cam recorded and cleared
each round. Bare-handed fighters take them by touch; anyone can press grab beside one to swap (`armsGrabKey`). After
`ARMS.crateAfter` (5 s) bare-handed, `dropCrate(f)` parachutes a random weapon down beside them. A K.O.'d fighter's
weapon drops too. Helpers: `spawnPickup(kind, wkey, x, y, vx, vy, o)`, `pickupsLive()`, `isBare(f)`, `dropCrate(f, wkey?)`.
Mode opt-out: `noDisarm: true`.

### Super meter, weapon levels, ultimates (`33-power.js`)

- Meter: `gainSuper(f, n)`; damage dealt × .55, taken × .4 (indirect × .2), parry +10. It carries over between rounds
  (`roster[i].superKeep`). About one ultimate per fighter every two rounds at Normal.
- Levels: damage dealt with a weapon (melee, proj, explode; not skills or mounts) adds to `f.wxp[wkey]` for the
  whole match (reset each match). `LEVELS.xp` [0, 55, 140] → Lv2 (+15 % melee reach, +10 % damage), Lv3 (+25 %, +20 %,
  plus `LEVEL_ELEMENT[cat]` as a weak element on every hit and a sparkle trail).
- Ultimates: `defUltimate(cat, { name, color, time, ai: { range }, use(f, u), step(f, dt, u), end(f, u), draw(ctx, f, u) })`.
  `useUltimate(f)` (super key) picks `ULTIMATES[f.w.cat]` (blade for shields). Ultimate damage is kind `'skill'`
  (projectiles set `dmgKind: 'skill'`). The cut-in band is drawn by `powerDrawScreen` and recorded for the kill-cam.
  Helpers: `ultHit(f, e, amount, o)`, `ultFoes(f, x, y, r)`, `ultHover(f)`.

### Throwables (`34-throwables.js`)

`defThrowable(key, { name, icon, color, desc, throw(f, aim) -> proj, ai: { min, max, when(f, foe, d) } })`; `aim` =
`{ x, y, vx, vy, foe }` from `throwAim(f)` (an arc onto the nearest visible foe). Roster `throws: [k, k]` (each once per
round; 'random' allowed), `throwNext(f)` on the throw key. Build projectiles with `thrBase(f, aim, o)`: kind
`'throwable'`, `dmgKind`/`blastKind: 'skill'` (never weapon-scaled).

### Elements and combo weapons (`56-fusion.js`)

`defElement(key, { name, adj, icon, color, status, hit(A, B, dealt, o) })` (`o.weak` = Lv3 dose). `fuseElement(f, key)`
(the elemental orbs call it) sets `f.element` for the round; every direct weapon hit then calls the element's `hit`.
`weaponLabel(f)` gives "Flaming Chainsaw" (HUD, kill-cam caption). Damage with `o.elemental` or `o.fromMount` never
triggers elements (no chains).

### Mounts (`57-mounts.js`)

`defMount(key, { name, icon, color, desc, time, hp, speedMul, takenMul, kbMul, auto, fly, onMount(f, m),
drive(f, dt, m, grounded), attack(f, m), draw(ctx, f, m, layer 'under'|'over'), onEnd(f, m), ai: { range, style, fly } })`.
`mount(f, key)` / `dismount(f, why)`; each mount def automatically gets an orb `mount-<key>` (weight .2). One hit of
`MOUNT_BIG` (18) or the mount's `hp` worn down knocks the rider off. Mounted fighters can't guard, grab, be grabbed,
be disarmed or use ultimates. `mountMul(f, 'speed'|'taken'|'kb')`, `mountHit(f, e, amount, o)`.

### Limb shatter (`36-shatter.js`)

Every K.O. sets `f.shatterT` and bursts the body into neon pieces (drawing only, moved by game time, so pauses freeze
them and replays slow them). The renderer skips a K.O.'d fighter with `shatterT > 0`. The burst is recorded as a
kill-cam event (`KC_FX.shatter`), and the kill-cam snapshot keeps `blocking`, `element`, `mount` and `ult` per frame.

### CPUs (`66-ai-moves.js`)

Per-level knobs merged into `AI_LEVELS`: `guard`, `block`, `parry`, `grab`, `mash`, `hold`, `throw`, `super`, `wall`,
`loot`, `vine` (v3.1: chance per leap over the Jungle Temple's pit to catch a vine, `jungleCpuVines` in 63-maps-v3,
run from the map's think frame; the CPU pumps toward its goal and lets go on the forward swing; event `vine(f)`). `aiReach(f)` / `aiStyle(f)` include weapon levels and the mount's own attack. Measured per round (2 CPUs):

| level | parries | grabs | throwables | ultimates | wall jumps | disarms | guard blocks |
|---|---|---|---|---|---|---|---|
| Easy | .3 | .1 | .1 | .7 | .2 | .5 | 2.3 |
| Normal | 1.1 | .3 | .5 | 1.1 | .9 | .4 | 2.4 |
| Hard | 1.5 | .4 | 2.1 | 1.3 | 4.7 | .3 | 3.5 |
| Insane | 1.6 | 1.1 | 3.0 | 1.3 | 2.6 | .2 | 5.5 |

(6 matches × 90 s of CPU vs CPU per level on random arenas, random loadouts; rounds last 10–15 s.)

### Eight fighters

`MAX_FIGHTERS` = 8 (rosters are capped). `spawnPoint(i)` uses the map's spawns, then stands extra fighters beside
them on the same ground (out of hazards). The HUD switches to compact cards (4 per row) for 5–8 fighters; strikes and
clashes skip pairs that are clearly out of reach (`outOfReach`), so 8 CPUs cost ~0.3 ms per physics step. A mode
sets `crowd: [min, max, default]` to get a "Fighters" stepper on the arena screen; it arrives as `cfg.fighters`
(`watch` and `ffa` use it).

### Hooks for modes (what later agents need)

- A roster entry may set `cls` ('random' | key | 'none') and `throws: [k, k]` (or `['none', 'none']`); `modeEntry`
  gives CPUs a random class and random throwables, and bosses (scale > 1.05) none.
- `mode.noDisarm: true` turns disarms off. A mode can strip other parts per fighter in `onRoundStart`
  (`f.throwN = [0, 0]`, `f.super = 0`, `f.maxStamina`...).
- Scoring a mode on K.O.s still uses `onKO`; the body shatters on its own. Respawning modes build a new fighter with
  `makeFighter(Object.assign({}, roster[id], {...}))` like King of the Hill does (it keeps class, throwables and levels).
- New arenas: tall solid blocks (`oneWay: false`, `h >= 50`) are wall-jumpable; pickups and crates land on any
  floor or platform; flying mounts stay below y 170 (`MOUNT_TOP`).
- New weapon categories need a `defUltimate` for the category (or they fall back to the blade's) and an entry in
  `LEVEL_ELEMENT`.

### Party modes, ranked and multi-phase bosses (`71`–`74`)

- Party helpers (71): `partyTeamRoster(cfg, n)` / `partyFfaRoster(cfg, n, extra)` (you + CPUs), `partyMap(cfg, prefer)`
  (the menu's arena if it has a floor), `partySideSpot(team, slot)`, `partySafeSpot(f)`, `partyPlace(f, x, y)`,
  `partyRespawn(old, x, y, over)` (rebuilds roster fighter `old.id` and swaps it into F; it and 70's `kothRespawn` give
  the newcomer `partyEnterRules(f)`: Settings health, round length and handicap, the match mutators, this round's silly
  rule, each once), `partyTickRespawns(run, dt,
  spawn)` (counts down `run.dead[id]`), `partyEnd(team, reason, title, sub, color)` (endRound + the mode's banner),
  `partyHazard(o)`: a hazard owned by a mode (`{ kind, x, y, w, h, dps, tick, launch, status }`, mutate its x/y/w/h live).
  It rides PROJ as a zone instead of joining `MAP.hazards`, because arena scripts may index their own hazards.
  Mode HUD rows start at `PARTY_HUD_Y` (below the cards and the round label in every layout).
- Every party mode ends on its own (captures, goals, a ladder, points, waves or a clock) and CPUs play the objective
  through `aiGoal` (flag runs, ball chasing, fleeing the bomb, the storm, climbing above lava) plus a few per-step nudges
  in `onStep` (CPUs swing at the ball, shamblers grab, bloaters burst). `tools/smoke.cjs` requires each to reach its
  results headless (`PARTY_MODES`).
- Ranked (73): saved as `store 'ranked'` = `{ pts, best, wins, losses, streak }`. `rankOf(pts)` → `{ tier, div, label
  ('Gold II'), color, icon, into, floor, gm }`; 100 points per division, 3 divisions per tier, Grandmaster from
  `RANK_GM` (1800). Win +25 (+5 per streak step, max +15), loss −18 (never below the tier floor). `rankOpponent(pts)`
  scales the CPU's level (`RANK_TIERS[t].levels[div]`), health and class. Autopilot matches don't save.
  `results()` adds `rankUp: true`, which makes the results card glow and toasts. A match is settled once per run
  (`rankSettleRun(run, won)` keeps the result on `run.rankResult`): `abandon` (quit, restart, pagehide) records a loss,
  and a later `results()` or second abandon reuses it.
- **Leaving the page** (99-main, v3.2): `pagehide` abandons a live match (Ranked: a loss) and `flushSaves()`. iOS may
  park the page in the back/forward cache instead of unloading it, so `pageshow` with `event.persisted` after such an
  abandon sends the game back to the title menu (`startMatch(demoConfig())`, with a toast) instead of letting the
  dropped match play on and settle again. `visibilitychange` → hidden also calls `flushSaves()` (the tab may never
  get a pagehide), while 90-input pauses the fight.
- **iPad Safari details** (v3.2): the `gesture` event (80-audio) fires only for trusted `pointerup`, `touchend`,
  `click` and non-Esc `keydown`: iOS doesn't count `pointerdown` as a user activation for speech, and both the
  announcer's warm-up (82: `annWarm` retries each tap until an utterance starts, then falls back to the synth voice
  via `ANN.fallback`) and the automatic benchmark (84-quality: `perfAutoBlock()` explains why it may not run yet)
  wait for one. The benchmark treats frame gaps pinned at 33.3 ms as a capped clock (`perfCapFps`; Safari caps an
  untapped cross-origin iframe and Low Power Mode at 30 fps) and then judges the tier by render time only. `.tstick`
  is a direct child of `#touch`, so 91-touch places it in viewport coordinates under the finger; the touch zones keep
  24 px (or the safe area) clear of the left and bottom edges for Safari's swipe-back and the Dock. 92-device cancels
  Safari's `gesture*` events outside text fields (iOS ignores `user-scalable=no`) and skips visual-viewport resizes
  while the page is pinched (`DEVICE.pinchSkips`). Save codes made with `CompressionStream('deflate')` are zlib
  streams; without `DecompressionStream` (iPadOS 16.0–16.3) 94-savecode unpacks them with its own inflater
  (`SC.savecode.inflate`). A video export whose `captureStream`/recorder throws becomes a GIF (`HL.noCapture`).
  `tools/webkit-check.py` runs the built game in a real WebKit engine (WebKitGTK's MiniBrowser via WebKitWebDriver
  on Xvfb; `apt-get install webkit2gtk-driver`).
- **`bossPhases(bosses, phases)`** (74): `bosses` is a fighter or an array (their combined health counts). `phases` =
  `[{ at: .5, name, sub, color, fx: [[kind, opts], ...], enter(ctl), step(ctl, dt) }, ...]`. When the health fraction
  falls to `at`, it shows a banner (name/sub), shakes, shoves nearby foes, gives the boss 1 s of `inv`, then runs the
  fx: periodic ones (`rain`, `quake`) replace the previous phase's; arena ones (`adds`, `hazard`, `platforms`, `wind`,
  `buff`) stay. Kinds and options are listed at the top of `74-boss-phases.js`; add more with
  `BOSS_PHASE_FX.kind = (ctl, o) => stepFn | null`. Returns `ctl` (`{ bosses, phases, idx (phases entered), data }`),
  also stored as `f.mem.phases` (`bossPhaseCtl(f)`). Adds are summons that vanish when their boss falls. It drives
  itself through a zone in PROJ, so call it at `onRoundStart` (after the fighters exist); it ends with the round.
  `bossPhaseMarks(ctx, x, y, w, f)` notches the thresholds on a `modeBigBar`. Event: `bossPhase(ctl, n)` (n = 2 at the
  first threshold). Helpers: `bossSummonAdd(boss, o, k)`, `bossAddHazard(kind, x, w, o)`, `bossStrike(boss, o)`,
  `bossQuake(f, o)`.

### Two players on one device (v4: `73-duo.js`, `74-tagteam.js`, `79-silly.js`)

- **The 2-player setup** is the arena screen of a mode with `duo: 'versus'` (pvp, tagteam) or `'coop'` (coop,
  coopwaves): `duoPanel` (prepended, CSS `order: -1`) holds the P1/P2 name fields, the pair's record and, for versus,
  Handicap and Silly rules. 94-controls-card adds Table mode to the same screen's `.quick-set`; 73 adds Round length.
- **Match cfg** (sent by 95 `menuCfg` through `duoMenuCfg`): `roundLen` ('short' | 'normal' | 'long': health and the
  round limit ×0.7 / ×1 / ×1.6; party modes, i.e. `customRounds`, default Short; off in campaign, challenge, ranked and
  training), `handicap` (bool) and `silly` ('vote' | 'off') for `duo: 'versus'` modes only, `names` (tests). **A cfg
  without them plays exactly as before**
  (SC.start, tools, the demo). `duoHpApply(f)` applies round length and handicap once per fighter (round start, the
  respawn helpers, tag-ins); health carried over (`'hp' in run`) is left alone, as with `matchHpMul`.
- **Records** (store `duo` = `{ names, hcap, silly, told, pairs }`): `duoPair()` names the two players of a match between
  two humans and nobody else in a `duo: 'versus'` mode (lobby party modes never count, vote or handicap);
  `duoSettle()` counts it once (the results card and `matchOver` both ask; never autopilot). `duoLoad` checks every saved
  pair (`duoRepair`: bad counts and lists reset, a pair without two names dropped), and `duoResultsLine` ("Head-to-head:
  …") never lets a failing record keep the results card from showing.
  `pairs[key]` = `{ n: names sorted, w: wins, last: last 10 winners 'a'|'b'|'d', streak: [side, n], total, wave }`.
  `duoHandicap(rec)`: whoever won more of the last 10 starts with 5 % less health per win of lead, at most 30 % (a "♥ −N%"
  tag on the HUD card via 85's `duoBadge`, a toast the first time). Shown on the setup, the results card
  (`duoResultsLine`) and Trophies & Stats → Rivals.
- **Quick rematch**: results button "Rematch · new weapons", R, or a pad's Start: `quickRematch()` restarts the same cfg
  with every loadout on a random weapon nobody just used (not for quest modes or modes without pickers).
- **Silly rules vote** (79-silly): before each round of a 2-human duel with `cfg.silly === 'vote'` (not a party
  mini-game round), both players pick one of three rules (`SILLY` defs + `SILLY_MUTS`, the round-safe 79 mutators) with
  their own left/right + attack/jump keys (`keySets()`, in `JOINED`'s seat order), a pad's d-pad + A, or a tap on their side (P2's side faces
  them in table mode). The world waits frozen (`G_STATE.override = sillyHold`), and the vote shows only from then on
  (`sillyLive`): after 94's controls card and once table mode's touch seats are known (each side's rules in one row,
  under the HUD); key strips wait for it. The hints are key caps, pad buttons or "Tap a rule". The timer (`SILLY_TIME`) picks for
  anyone who hasn't; a split is drawn. `SILLY_ON` runs the rule's hooks for that round only; `sillyFighter(f)` applies
  it to fighters that join mid-round. Giant Heads also sets `f.headHit`, which grows the head's hurt radius (20's `hurtR`)
  to match its drawing for that round.
- **Tag Team** (`tagteam` P1 vs P2, `tagcpu` vs the CPU; 4 loadout pickers, `pickerOwner` maps them to P1/P2 lists): only
  the fighter on the field is in the roster; partners wait in `run.tag`. A K.O. with a partner left schedules `tagIn`
  (`TAG_DELAY`, then `partyRespawn` at the side's spawn with `TAG_GUARD` s of protection); `holdRound` + `onStep` end a
  round when a side has nobody left (time-out: partners left + health share). `koEndsRound` keeps a K.O. with a partner
  waiting a mid-round one (`koDecides`). The partner takes its player's colour (the outgoing roster entry's, so a
  colour-blind palette holds), and the mode's HUD row (`PARTY_HUD_Y`) shows each side's fighters left in that colour.
- **Co-op Waves** (`coopwaves`, 70): Survival for two (`survivalWave(n, diff, color, duo)` adds a grunt or a tougher boss;
  Survival's `run.hp` is per hero, 0 = K.O.'d, back up with `SURV_HEAL` next wave); best run per pair (`rec.wave`);
  `noScore` (the waves cleared are the result).
- **Co-op quest** (76/98): `cfg.coop` adds Player 2 as hero 1 (`questHero(cfg, me, 1)`, spawn 4); a lone foe gets ×1.4
  health, a group one more member (`questCoopFoes`); `questHeroes()` / `questLead()` replace player 1 in the trial
  rules, overrides and stars. Foes skip spawn 4 (Player 2's). The node card's "Play this node with 2 players" opens the
  campaign's loadout on Player 2's picker (`CAMP_UI.coopPick`; `MODES.campaign` pickers, labels and loadoutLabel are
  getters), whose Fight ▸ walks to the node and starts it with `CAMP_UI.coop`; `campCoopLoadouts()` reads picker 1 as
  Player 2's own loadout (MENU.loadouts is shared by index), never as the Versus CPU's.
- Tests: `node tools/smoke-2p.cjs` (also run by smoke.cjs); screenshots `tmp/smoke/2p-*.png` at 1280x720 and 1194x834.

### Campaign and challenges (`76-campaign.js`, `77-challenges.js`, `98-campaign-ui.js`)

- **Trial engine** (76): a campaign node and a challenge are the same plain-data *spec* (see the comment at the top of
  76): `foes` (`[name, weapon, level, { skills, scale, hp, cls, color, boss, kb, throws, behave, dmg, ringSave }]`),
  `map`, `wx`, `mods` (`QUEST_MODS`: dark, slick, lowgrav, haste, embers, hail), `me` (overrides on the player's own
  loadout: weapon, skills, cls, throws, hp, throwN, super, superMul, ringSave), `goal` (`win` | `survive` | `count`),
  `rules` (noBlock, noJump, noSkill, noAttack, maxTaken, limit) and `st` (star conditions). Both modes are hidden
  `QUEST_MODE`s with `holdRound`: `questStep` ends the round itself. Losing the hero is a loss, except a **trade** (the
  hero and the last foe K.O.'d in the same step) on a plain `win` goal, which counts as a win.
- Boss options: `boss: true` (big HP bar, `kb` = its knockback taken, default .6), `dmg` (× damage it deals, via
  `f.dmgCls`; the Warlord uses .7 because his size already adds reach and swing speed) and `ringSave: share` (knocked off
  the arena, the boss is lifted back above its spawn for that share of its max health instead of a ring-out K.O.: the
  Storm Lord can't be cheesed off Sky Islands). Nodes may set `heroSave: n` (Lumen catches the hero n times per fight
  for 20 % of their health: Eye of the Storm uses 2). Both go through the core hook `f.ringSave(f)` → true in
  `checkRingOuts` (30), and `questLift` in 76.
- **Campaign**: `CAMP_REALMS` (4), `CAMP_NODES` (24: fight, side, mini, boss; `to` opens the next nodes),
  `QUEST_PHASES` (bossPhases scripts; extra fx kinds `ashWave`, `gale`, `eclipse`... registered on `BOSS_PHASE_FX`; the
  gale eases to a fifth near a downwind drop, `galeGrip`). The hero's health by node kind is `CAMP_HERO_HP`. Saved as
  `store 'quest'` = `{ stars, at, seen, tree }`; stars are skill points for `CAMP_TREE` (3 branches × 4 skills, 21
  points in all, applied by `campApplyTree` at round start, campaign fights only). Autopilot matches never save.
- **Challenges** (77): 31 specs in `CHALLENGES`, saved as `store 'challenges'` = `{ id: stars }`.
- **UI** (98-campaign-ui): the world map (`SCREENS.campaign`), dialogue (`campDialogue`), `skilltree`, `challenges`.
  The map canvas (v3.2) is capped at `CAMP_MAX_PIXELS` (2.3 MP, like the arena) and redraws only when
  `campInvalidate()` marked it dirty (the walker moving, `campSelect`, a dialogue opening or closing, a resize), at
  most `CAMP_FPS` (30) times a second; an idle map draws nothing (`CAMP_UI.draws` counts draws for the tests).
  Test hook `SC.quest = { nodes(), challenges(), start(kind, id, extra), win(), run(), dialogue() }`;
  `tools/smoke-quest.cjs` runs every node and challenge. Win rates of the late nodes for an autopilot (Normal) hero with
  no / mid / full skill tree are in `tmp/balance.md` (bench: `tmp/lead2/camp.cjs`).

## v4.1 graphics (sharper, richer, same file size)

Drawing only: no game state, physics, hitboxes or timing changed. The shipped file did not grow (1,503,614 B against
v4's 1,504,328 B): new drawing code was paid for by consolidating repeated code into shared helpers.

### Rendering (`85-render.js`)

`ctx`'s backing store follows the **resolution step** of 84-quality's ladder (below): up to the screen's own pixels while
frames keep up, step 3 being the old cap (~2.3 MP, at most 2x). `MAX_CANVAS_PIXELS` is gone (`RES_PX[3]`). `resize(step)`
sizes the canvas for `RES.shown`; `step === 1` means the ladder changed the step, anything else (the window, a rotation,
92-device, tests) is a real resize, which also redraws the backdrop cache once, 400 ms after the last one. Either sets a
30-frame cool-down for the governor. New `VIEW` fields: `glowK` = dpr ÷ step-3 dpr (the render wrap multiplies
`GLOW_SCALE` by it, because `shadowBlur` counts canvas pixels: glows keep their size at every step), and `w3 x h3` = the
step-3 canvas size, which fixed-size effect buffers use (bloom, the K.O. colour split), so a step never reallocates them
or changes their cost. `screenToWorld` was removed (unused).
Shared hazards: `HAZARD_DRAW.spikes(ctx, hz, t)` has Spike Pit's old look (steel spikes of two heights, glowing tips in
`hz.color`, a faint glow; agent B removes `spikeDraw`); `drawLiquid` draws a fainter wave rolling the other way behind the glowing
one and an additive highlight along its crest; `drawGridFloor`'s grid fades toward the horizon (a gradient of the floor
colour over the floor's top half, cheaper in software rendering than a gradient on the lines; its `fill` must be hex);
the default `drawSolid` is 60's `mapSlab(ctx, s, palette.solid, move ? accent : line)`; `drawStdBackground` is
`mapSky` + `mapStars` + `drawGridFloor` (a bottomless map gets a `mapGlow` at the bottom). HUD helpers: `hudBadge` (a dark
disc, ring and icon: skills, class, throwables, mount, statuses), `hudHealth` (the full and compact health bars) and
`hudGrid(n)` (the card grid, shared by `drawHUD` and `hudBlockPx`).

### Adaptive resolution (`84-quality.js`)

One ladder, cheapest last: steps 0-3 give the canvas 6, 4, 3 and 2.3 MP (`RES_PX`), each capped at `devicePixelRatio`
(only step 3 also at 2x, the old formula exactly); 4-6 step bloom down (High -> Low, half rate, off: `BLOOM.tier` 1-3,
set by `resApply` every frame); 7 is an emergency 1.6 MP. `resNext` skips steps that change nothing on this screen (same
canvas scale and bloom level). The tier sets the start and ceiling steps (`RES_TIERS`): High 0/0, Medium 1/0, Low 3/3,
no benchmark yet 1/0 (`resTier`, called by `perfApplyTier`).
- **Measured:** the frame gap the render wrap already sees (an average, `RES.avg`), only in `'play'` with `dt > 0` and the
  governor on: never in a pause, the kill-cam, photo mode, results, the menu demo or the benchmark.
- **Down:** an average over 20 ms for 45 frames (150 before a bloom step) dives one step, judged on the mean of its next
  60 frames. A dive's step at least 12% faster than where the dive began stays. iOS snaps to 60/30 fps, so a smaller
  gain shows as none: a step with no gain carries on to the end of its group (pixel steps to 3, bloom steps to 6); past
  that, the dive is undone (back to its start) and dives hold for 30 s, then for the session. A steady 30 fps is
  measured like any rate, never assumed to be a cap.
- **Up:** 4 s of play under 17.5 ms climbs one pixel step; bloom stays down for the session (`RES.floor`). 50-57 fps is a
  dead band. A climb undone within 30 s (slow again) doubles the wait (up to 60 s); when the climb to the same step is
  undone twice, the step it fell back to becomes the session's ceiling.
- Changes land at the start of the next render (`resApply`; a resized canvas is blank until redrawn), then 30 frames
  settle; a hidden tab coming back settles too (`visibilitychange`).
- **Pins** (`resStep`): the benchmark measures at step 3 with full bloom (the tier thresholds keep their meaning), photo
  mode draws at step 0 (sharper PNGs) and is back on the governor's step on exit, a highlight export records at step 3.
- **Tests:** under `navigator.webdriver` the governor is off and the canvas is step 3, so every older test sees the old
  canvas. `SC.res = { RES, force(step | null), auto(on), feed(gapMs, n) }`: force a step, switch the governor on (from
  the tier's start, nothing learned) or feed it frame gaps. `tools/smoke-res.cjs` covers it (also run by smoke.cjs).
- Memory: a 2732x2048 canvas at step 0 on a 12.9" iPad; the bloom buffers and the K.O. scratch stay at their step-3 size.

### Post-fx (`84-postfx.js`)

The bloom governor is gone: steps 4-6 of the resolution ladder do that job (above). The bright pass weighs
`.6 · max channel + .4 · luma`, so saturated colours (pure blue) no longer bloom like white. The bloom copy uses medium
image smoothing above step 3 (where it shrinks the canvas most and thin lines shimmered); at step 3 and below it keeps
low smoothing (medium costs 2-3 ms a frame in Chromium's software rendering; in WebKit it measured no extra cost, so it
is kept there). The 2D fallback glow reuses `bloomCopy(8)`, and the WebGL path sizes its targets from its copy. Neon's
(and pixel's) impacts are drawn by `artImpact` too, with `PFX_NEON`'s spark, flash and ring (additive, so the drawing
order doesn't matter).

### Particles (`35-effects.js`)

Particles batch by colour and 8 alpha steps (was 4). In neon, moving particles are velocity streaks: 1/80 s of travel,
at most 4 sizes long (a huge hit's sparks would otherwise be long lines, and a streak's cost grows with its length), one
stroke per group at the group's mean size, butt ends (round ends cost about 2.5x as much in software rendering).
Particles that have nearly stopped (resting on the floor) stay squares; each colour keeps 16 lists (squares, then
streaks, by alpha).
The art styles keep their own shapes (59's proxy turns each `rect` into the style's `dot`).
A particle with `soft: 1` is drawn as a swelling, fading `postfxSprite` (87's landing dust). `fxCompact(list, keep)`
takes an optional filter (84-postfx's `fxCompactBy` was folded into it).

### Game feel (`87-juice.js`)

The K.O. colour split is a true split: the red copy and the cyan copy (shifted over an unshifted one, so its edge stays
filled) are combined in one scratch canvas (a quarter of the step-3 pixels, two halves tall) and laid over the frame
once with normal blending: no brightening, one full-screen pass instead of two. Hard landings throw soft dust puffs
(sprites that swell and fade). `juiceSettingsExtras` now also adds 59's "Arena art" row (Effects) and 84's Performance
group, the only Settings wrapper of the effect slices.

### Art styles (`59-styles.js`)

- `artBackdrop(m, st)`: its scale `ART.k` comes from the session ceiling's step (84-quality; step 3 when the governor is
  off), rounded up to .25, at most 4.2 MP (2.4 MP on Low), so resolution steps never redraw it; a real resize redraws it
  once, 400 ms after the last one (the old image is drawn stretched meanwhile). `ART.cache.n` counts the redraws.
- `artWorld`: `ART.tier` is the quality tier's glow scale (`GLOW_SCALE` without `VIEW.glowK`); the pixel layer draws with
  it (its size doesn't follow the step), and paper's card shadows blur by `3 · z · ART.tier` (Low: hard shadows).
- The pixel layer's pixels are a whole number of canvas pixels (even blocks at any step).
- Chalk grain stays a 64px tile at pattern scale 1: a 128px tile at scale .5 was crisper when zoomed in, but cost about
  10% of a chalk arena's frame in software rendering (Spike Pit), so it was cut. The pattern cache drops its oldest
  entry past 200 instead of clearing.
- `artColor` gives glowless styles (ink, paper, chalk, mono) transparent shadows itself; their `map`s no longer do.

### GLOW_SCALE

Inside `render` it also carries `VIEW.glowK`. The direct `shadowBlur` uses in 22-moves (guard arc), 33-power (Lv3
sparks), 36-shatter (limb pieces) and 56-fusion (element glow) multiply by it now (61-maps-hazard's is agent B's).

### Testing (resolution)

`node tools/smoke-res.cjs` (also run by smoke.cjs): forced steps at 1366x1024@2 and 844x390@3 (canvas sizes, glowK,
bloom tiers, skipped steps, fixed bloom buffers), the governor (down, no-gain carry-on, undo and hold, gain stops a dive,
climb, doubled wait, ceiling, dead band), holds and pins (pause, results, photo, export, kill-cam, benchmark) and the
backdrop cache (no redraw across steps, one redraw 400 ms after a resize). `tools/fx-perf.cjs` flags: `--map`,
`--size WxH@dpr`, `--step`, `--rows`, `--bench N`, `--free` (unthrottled frames), `--sync` (render time including
raster), `--json`. `tools/webkit-check.py` also renders every arena at step 0, runs an `SC.res.feed` dive and times the
bloom copy's smoothing.

### Map toolkit (`60-maps.js`)

```js
mapPen(c, color, width)          // strokeStyle + lineWidth + beginPath (shared shorthand, every arena slice uses it)
mapRect(c, color, x, y, w, h)    // fillStyle + fillRect          mapBrush(c, color)  // fillStyle + beginPath
mapSeg(c, x1, y1, x2, y2)        // moveTo + lineTo               mapEdge(c, s, color, w) // glowLine along a solid's top
mapSign(ctx, text, x, y, size, color, blur)   // big warning text; its glow goes through glow() (quality tiers)
mapVGrad(c2, x, y, w, h, colors) // vertical gradient, stops evenly spaced top to bottom (mapGrad builds a real one)
mapGround(c2, floorY, fill | stops, edge, width = 3, deco)   // the ground: fill, deco(), depth falloff, lit lip, edge
mapFar(c2, d, draw, m)           // parallax decoration layer at depth d (see below)
mapHaze(c2, horizonY, h, color, alpha)        // haze between depth layers, thickening down to the horizon
mapSun(c2, x, y, r, stops, bandColor, t)      // banded sun; t slides the bands (0 = still, for a cached layer)
mapSkyline(c2, baseY, n, seed, hMax, body, windowColor?, t)   // seeded towers (40 px skirt), slowly switching windows
mapSoft(c2, y0, y1, draw)        // dense soft decoration at quarter resolution (see below)
mapPuff(c2, x, y, rx, ry, color, alpha)       // one soft puff: 84's postfxSprite stretched to an ellipse (hex colour)
mapClouds(c2, t, { y, n, sp, rx, ry, col, a, puffs, seed })   // a drifting, wrapping row of puffy clouds
mapSmoke(c2, t, x, y, { n, rate, r0, r1, h, sway, drift, col, a })   // a rising plume (CALDERA_SMOKE: Caldera + Eruption)
```
- **Strips.** `mapVGrad` draws a vertical gradient from a cached 1x64 canvas stretched over the rect (`MAP_STRIPS`):
  on a software-rendered canvas (measured in headless Chromium) that is about a tenth of a gradient fill (0.3 vs 3.5 ms
  for a full-screen sky) and looks the same. `mapSky`, `mapGround`, `mapHaze`, `mapSun` and `mapSlab` use it. Style proxies (`artRaw(c2) !== c2`,
  the pixel layer, paper/ink/chalk backdrop builds) and the neon look of a styled arena (`MAP.style` set) keep a real
  gradient: styles are timed against that neon look (smoke-styles), so it must not get cheaper.
- `mapSlab` (same signature) adds a soft contact shadow under the slab and a bevel (lit top fading to a dark base).
  ink/paper/chalk still use their own `style.slab`.
- `mapParticles` takes `x0`/`x1` (a horizontal band) and draws in three alpha groups, one path and one fill (or
  stroke) each, instead of one fill per speck.
- `mapGround` replaced the copied floor fills: `deco()` is the arena's own floor detail (planks, seams, belts), drawn
  before the falloff so it fades with depth. Pass `edge = null` for split edges (Spike Pit, Robo Factory).

### Parallax and the world-lock rule
`mapFar(c2, d, draw, m)` shifts a decoration layer by `((CAM.x - W/2)·d, (CAM.y - H/2)·d/2)`, so it moves less than
the world. Only on the live canvas (`c2 === ctx`, or mapSoft's layer): arena thumbnails draw it flat; the kill-cam and
photo mode set `CAM`, so it follows them. With `m`, `draw` must be static: it is drawn once into 59's single backdrop
cache through `artBackdrop({ key: m.key + '~', art: { bg: draw } }, STYLES.neon)` (a style proxy draws it live).
**World-lock rule:** anything a fighter can stand on, touch, be hurt by, grab or must read stays in world space and is
never shifted: solids, hazards and their warnings, walls, vines, pads, zones, breakables and whatever holds them up
(Storm's tower and billboard), the floor line and ground, the planets. Only decoration behind all of it may move, and
any layer that reaches the horizon runs 40 px below the floor (its "skirt"), so the shift never opens a gap.
Depths used: Neon City sun/towers .25, lit windows .12; Foundry gears .2, chimneys .1; Caldera volcano and plume .2;
Sky Islands clouds .35/.2/.1, isles .3; Rainbow Bounce stars .25, rainbow .2, balloons .15; Asteroid nebulae and deep
stars .15 (cached); Storm clouds .3/.2/.1, city in rain haze .15.
**When to cache (`m`).** The cached layer is drawn scaled every frame (camera zoom and parallax are never a whole
pixel), which a software-rasterised canvas pays per covered pixel: about 4.3 ms for a full 1280x720 view in headless
Chromium, against 0.4 ms for a 1:1 blit. Only a layer that costs more than that live is worth caching. Measured with
`arena-perf --vs` (cached vs live, same fights): Asteroid -8% (three large nebula glows: cached), Neon City +1%,
Foundry +5%, Caldera +10%, Rainbow Bounce +16% (cheap after the strips: drawn live).

`mapSoft(c2, y0, y1, draw)` draws `draw(g)` at quarter resolution into 58's layer canvas (`worldLayer()`), then lays
rows y0..y1 over the arena in one stretched draw: overlapping soft puffs cost a sixteenth. `mapFar` inside it still
shifts (the layer is tagged `live`). Thumbnails and style proxies draw straight onto their canvas. Used by the Storm's
cloud deck and Sky Islands' clouds.

### World (`58-world.js`)
- Rain: `wxRain(ctx, t)` draws two depth layers (fine, faint, slower streaks behind; long ones in front) slanting with
  `PHYS.windX`; the rain weather and the Storm Rooftop share it. Snow falls in two depth layers (three fills each).
- Shade layer: `worldLayer()` is the quarter-resolution canvas; `worldDrawShade(ctx, color, alpha, holes, paint)`.
  A light (`{ x, y, r, a, c }`) with a hex colour `c` also tints its pool (an additive postfxGlow into the layer, so it
  costs next to nothing; styles with additive light only): lanterns, lava and acid, shots. `paint(g)` adds soft extras in
  world units after the holes: the fog weather's banks, and a map's `mist(g, t)` hook.
- Darkness (`MAP.dark` or night) in chalk arenas uses a slate shade; the fighters' own additive glow is drawn only for
  styles with additive light (neon, pixel), like 84's lights.
- Map fields: `lights(t)` entries may carry `c` (colour); `mist(g, t)` paints into the dark layer (Haunted Graveyard's
  fog banks). The Haunted Graveyard now uses `dark: .8` + `lights()` + `mist()` instead of its own darkness canvas.

### Arenas
- Spike Pit's spikes use `HAZARD_DRAW.spikes` (85); its own `spikeDraw` is gone.
- Neon City: no random skyline array or `skyTop` (it paints with `mapSky`); its sun is a banded `mapSun`.
- The Storm billboard and the tunnel / eruption / gust / fruit warnings draw through `mapSign` (no raw shadowBlur).

### Interfaces between the map, style and render slices
- `mapSlab(ctx, s, fill, edge, alpha)` keeps its signature; 85's default `drawSolid` gets the shadow and bevel by
  delegating to it. `mapGround` / `mapVGrad` are there for `drawStdBackground` too.
- `artBackdrop(m, st)` is called with a stand-in map `{ key, art: { bg } }` and `STYLES.neon`: it must keep reading only
  `m.key`, `m.art.bg` and `st.key` (whatever it sizes the cache from).
- `postfxSprite(color)` / `postfxGlow` are called with `#rrggbb` colours only (puffs, fog banks, coloured pools).
- 85's `glowLine` and `drawGridFloor` and `HAZARD_DRAW.spikes` are called unchanged (Neon City and the Foundry keep
  `drawGridFloor`; Spike Pit's hazard has no `draw` of its own any more).
- Arena thumbnails stay flat. The Haunted Graveyard's thumbnail no longer shows the darkness (it comes from the shade
  layer in `worldDrawTop`, which thumbnails don't draw).

### Testing (arenas)
`node tools/arena-perf.cjs` (standalone, not in smoke.cjs) times every arena with 8 fighters, the Eruption mid-eruption
and Neon City in each weather: median ms per frame over a frozen scene, each frame read back so rasterising counts.
A scene repeats exactly: `Math.random` is seeded and `G_STATE.t` pinned before `SC.start` (game time is never reset
between matches, and fights drift with it), so two builds render the same fight.
`--vs other.html` measures a second build alternately in the same browser (the reliable way to compare: absolute
times drift by several % between runs); `--base file.json` compares with a saved run; `--styles` adds smoke-styles'
styled-vs-neon ratios. Wrap it in the shared lock when another agent measures too.

## v4.1.1 fixes (laptop play)

- **Dash off Shift:** the default dash keys are Space (P1) and Enter (P2), and P2's super is backslash: on Windows,
  Shift pressed five times opens the Sticky Keys box and steals the keyboard mid-fight. `loadBinds` moves saved binds
  that still hold the old defaults (`ShiftLeft`, `ShiftRight`, P2 super `Enter`) once (`store` key `bindsV` = 2), only
  where the new key is free; a player's own choices stay. Results screens already ignore a held or mashed Enter/Space.
- **Railings** (`rail: true` solids, only the Pirate Ship's two posts): `collideSolid` pushes points only toward
  mid-arena, so a limp body can't hook itself over the 12px post and fighters climb back aboard from outside (fewer
  ring-outs on that map). **Broken swaying crates** clear `s.move` before parking, so they no longer ride their sway
  path back as an invisible solid that flung bodies through the deck. smoke-feel replays four Pirate seeds that left a
  CPU down 4.7-9.8 s (all now under 2 s).
- **Resolution governor:** a slowdown within 30 s of a climb (was 3 s) counts as that climb failing, so borderline
  screens settle (a random 18% vsync-miss case went from 14 switches in 5 minutes to 4; smoke-res checks it).

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
  guard: 1,          // v4: × chip and stamina cost when blocking with it; its parry window × (2 − guard) (broadsword .5)
  swingArmor: 1,     // v4: × knockback taken (and no tumble) while it swings (greatsword .3)
  deflect: false,    // v4: shots touching it mid-swing fly back at the shooter (energy saber)
  arc: '', sig: '',  // v4 blades: swing arc and signature move, for tools and the Codex
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
Melee helpers (40): `spinAttack(f, power, pivot)` (pivot 1 neck = overhead, 2 hip = wide low sweep, 5 elbow = forearm
flick), `meleeThrust(f, power, rig, lunge)`, `meleeLater(f, secs, fn)` + `meleeLaterStep` in the def's `onStep` (timed
follow-ups: flurries, wind-ups), `meleeStreak(A, B, key, secs)` (hits in a row). The v4 blade table (reach, speed,
damage, signature) is in `tmp/balance.md`.

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

v3 map fields (all optional; `58-world.js` reads them):
- `weather: false | ['night', 'fog', ...]` which weathers suit the arena (default: all); `ownWind: true` skips weather gusts.
- `dark` (0..1, set it in `onStep`) shades the arena: lights cut holes, fighters glow. `lights(t)` returns
  `[{ x, y, r, a }]` lamps for that shade (night weather adds lanterns to arenas without `lights`).
- `collide(p, friction)` extra collision shapes, called from `collidePoint` for every point (the asteroid's planets).
- `groundBelow(x, y)` (v3.1) answers `groundBelow` (10-physics) first for curved ground: return the surface height, `null`
  over a drop, or `undefined` to fall back to the flat rules (the asteroid returns its planets' tops, except while
  `astroFrame` holds the brain's flat floor at 1e5), so blinks, crates, mines, mount landings and the blade ultimate's
  dash find real ground.
- `style` / `art` (v4): the arena's art style and styled backdrop (see "Art styles").
- `skyTop` (v3.1): the colour above the arena's top edge, shown when the camera rises under the HUD (`mapSkyTop`,
  85-render). Maps that paint their sky with `mapSky` need nothing: it records `MAP.skyTopLive` every frame (so the
  Eruption's hot sky still matches); the others (Neon City, Haunted Mansion, Giant's Kitchen) name one; `palette.sky1`
  is the last resort.
- `frame(f, phase, enter)` called around each fighter's brain (`'think'`) and drive (`'drive'`): `enter` before, then
  after. Use it to adjust CPU inputs after the brain (tunnel shelter, dart hops, planet hopping) or to re-orient a
  fighter (the asteroid turns the world about the fighter's hip so "down" points at its planet, then turns it back).
- Breakables: `brkSolid(kind, x, y, w, h, { id, hp, look: { fill, edge, debris } })` with kind `crate | glass | pillar`.
  Melee hits, shots, blasts and fast bodies damage them; a solid with `restsOn: id` (or a list) collapses when that
  breakable breaks (falls until it lands, or leaves a bottomless arena). Their collision box sinks 14 px into the
  ground (`BRK_SINK`); also make blocks that sit on other blocks overlap them, or a fighter lying flat slides into the seam.

### World: weather (`58-world.js`)

`WEATHER` = clear, rain (friction ×.5, grip ×.65), snow (×.25, ×.4), fog (CPU gunners can't see past 380 px; the
view fogs beyond the players), wind (warned gusts up to 1350 px/s² on fighters, shots drift), night (shade .74).
One is rolled per match from `cfg.weather` (`'random'` | `'clear'` | a key; missing = clear, the menu demo = random)
and re-rolled for a round whose arena can't have it. The arena screen has a Weather stepper (saved as `weather`,
sent as `menuCfg().weather`); the round start shows a banner. `WX.key` is the live weather. Hooks in the core:
`emit('mapStepPre')` / `emit('mapStep')` around the map's `onStep`, `worldFrame` around `think`/`drive` in
`worldStep`, `MAP.collide` in `collidePoint` and `worldDrawTop(ctx, t)` after the map's `drawFg`.

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
  koEndsRound(victim) { return false; },                  // optional: this K.O. can't end the round (Tag Team's partner)
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
v4 human-like slips (`AI_SLIPS`, merged in): `whiff` (swing out of reach), `mistime` (a guard late or dropped early, in
`aiGuard`), `wrongDash`, `badJump` (hop in front of a foe about to swing), `hesitate` (freeze .15–.4 s), `jitter` (±
share of `react`), `parryErr` (s of parry timing error, `aiParry`). Each slip calls `aiSlip(f, kind)` (`f.ai.slips`,
event `aiSlip`). Tuned to ~16 / 8 / 3.5 / 1.3 slips a minute (Easy → Insane). Rivals with `flourish` ('taunt', 'hop',
'bow') show off for a moment after scoring a K.O. (`aiFlourish`, 67).
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

### CPU rivals, adaptive difficulty, habits (`67-ai-persona.js`, `68-ai-adapt.js`)

- **Personas** (10 rivals: torque, mirage, vale, dazzle, tamsin, grizz, magpie, fenn, ivo, skitter): a roster entry with
  `persona: key` plays that style. `aiPersonaEntry(entry, key | 'random' | 'none', { gear: 'force'|'fill'|false, color,
  avoidColor, hat, caps, keepName, avoid })` sets name, title, look and favourite weapon/class/skills/throwables;
  `aiPersona(key)` → def `{ name, title, color, hat, cls, weapons, cats, skills, throws, mul, add, act, lines }`,
  `aiPersonaKeys()`, `aiPersonaDraw(n)` (distinct keys), `aiPersonaOf(f)`. Used by Versus (the loadout's Rival row,
  `cfg.loadouts[1].persona`), Ranked, Tournament and FFA; `watch` only with `cfg.personas` (tests), so the bot ladder
  and balance tools run without them. Knobs flow through `aiTuned(f)` → `f.ai.L` (what `aiLevel(f)` returns;
  `aiBaseLevel(f)` is the raw level).
- **Adaptive difficulty** (`SETTINGS.adaptive`, default on; one human only, never Ranked/practice): `AI_ADAPT.v` (-1..1)
  blends a CPU's knobs toward the neighbour level by at most `AI_ADAPT.max` (.4) of the gap.
- **Habits**: per match, a human's jump-ins, dash-ins, guarding and one-skill spam are counted (`AI_HAB`); after
  `AI_HABIT.need` (3) CPUs counter them with a per-level chance and say "READ YOU!". Only humans are read.
- **Bubbles**: `aiSay(f, text, force)`, `aiTalk(f, kind)` (kinds hi, ko, parry, combo, low, win, taunt), rate-limited,
  off with `SETTINGS.taunts`. `node tools/ai-persona.cjs [secs] [personas|adapt|habits|all]` measures all of it.
- **Rival balance**: each rival with its own favourite gear wins 49–60 % of rounds against a plain Normal CPU with random
  gear (`tmp/lead2/persona.cjs`, ~350 rounds each; `PATCH='{"torque":{"cls":"none"}}'` tries changes). Gear matters more
  than the knobs: a Brute with a heavy weapon ran ~70 %, so Torque is a Trickster and Fenn classless; `react` (> 1 =
  slower reads) is the cleanest knob for toning a style down without changing it. v4: Vale (Zoner) ran 64–69 % with the
  gun buffs; react ×1.25 and attack ×.8 bring it to ~58 % (`tmp/balance.md`).

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

- Movement (v4 silly profile): top speed reached in 0.13 s, stop in ~0.19 s (≈36 px of wobble-slide), turn in
  ~0.17 s; the head sways ~4.6 px standing (v3 1.7) and ~13 px when stopping (v3 9.6). Full jump ~212 px (apex
  0.33 s, lands 0.68 s), tap = short hop ~115 px, double jump ~384 px, dash ~194 px. Limits: top speed ≤ 0.2 s, stop
  ≤ 0.25 s.
- Damage: a typical melee hit deals ~7–8 (heavy or head hits up to 26 before rage/status multipliers); 100 hp.
- Rounds (CPU vs CPU, random loadouts): median 8–15 s per arena at Normal, 9–18 s at Easy, longer for gun-vs-gun.
  Humans miss more than bots, so real matches land in the 10–30 s target.
- Fighters stay upright 86–99 % of the time (v4 silly profile: 75–92 % per arena, 87 % on average; the Space Asteroid
  is lowest; the limit is 70 % everywhere).
- Weapons: every visible weapon wins 40–60 % (hard limits 35–65 %) of its round-robin rounds at Normal, where the
  shipped `power` values were tuned. Hard shifts a few slow-projectile guns down and instant ones up (≈34–68 %):
  Hard CPUs dodge 58 % of shots, so tune at Normal and check Hard stays inside 30–70 %.
- Classes: every class 40–60 % overall and every pair 35–65 % in `tools/class-balance.cjs` at Normal.
- v3 pacing (2 CPUs, per round): about one ultimate per fighter every two rounds, a disarm every 2–3 rounds, a parry
  or two from Normal up, and every throwable used within a few rounds. Measure with the `on(...)` events.
- Skills: every skill should help its carrier against a skill-less mirror (impact ≈52–68 %) and land 40–60 % in
  random-loadout fights; the CPU should use each one about once or twice a round.
- Difficulty: each level beats the one below it in ~65–85 % of rounds (Easy→Normal→Hard→Insane; v4: 79 / 75 / 72 %).
Keep new content near these numbers (a new weapon should land between 40 % and 60 % in `tools/balance.cjs`;
adjust its `power` first, its mechanics second).

## Determinism

Not required (no replays from codes). Use `Math.random` freely. The kill-cam should record snapshots.

## Testing: `window.SC`

```js
SC.reg            // { WEAPONS, SKILLS, MAPS, MODES, ORBS, HATS, STATUS, CLASSES, THROWABLES, MOUNTS, ULTIMATES, ELEMENTS }
SC.start(cfg)     // start a match without the menu (default mode 'watch'). Shorthands: weapons: ['blade', 'spear'],
                  // skills: [['blink', 'slam'], ['none', 'none']], hats: ['crown', 'none'], classes: ['ninja', 'none'],
                  // throws: [['grenade', 'mine'], ['none', 'none']], fighters: 8 (watch / ffa); autopilot: true lets
                  // the CPU brain drive human fighters. Returns SC.state().
SC.sim(seconds)   // run fixed steps synchronously: no drawing, sound, effects, hit-stop or slow-mo
SC.state()        // { state, mode, map, round, score, roundT, ending, winner, t, log, result,
                  //   fighters: [{ id, name, team, ctrl, hp, maxHp, alive, x, y, upright, wkey, skills, status, stats, nan,
                  //   cls, stamina, super, lvl, element, mount, throws, throwN, blocking, held }],
                  //   projectiles, orbs, errors }
SC.render(dt)     // draw one frame now
SC.press(i, 'jump'|'attack'|'skill1'|'skill2'|'dash'|'grab'|'throw'|'super'|'mash')   SC.move(i, mx)   // drive fighter i
SC.hold(i, 'block'|'jump'|'attack', on)                    // hold a button (inputs persist in sim)
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
- v3: every **class** (a CPU fight; its numbers apply), **throwable** (thrown at a foe: it must hurt or affect it),
  **mount** (ridden at a foe, timer and big-hit dismount), **ultimate** (super key with a weapon of the category) and
  **element** (fused hit applies it); guard chip/parry/projectile parry/guard break, grab + throw, mash escape,
  block + attack grab, wall slide + jump, disarm + pickup, chance disarms, supply crate, weapon levels to Lv3, super
  meter, class passives, 8-fighter spawns on every arena + step cost, an 8-fighter FFA;
- v3 screens: an 8-fighter brawl, mounted fighters, an ultimate cut-in, the shatter in the kill-cam replay, the
  loadout's Class and Throwables tabs and How to Play (`tmp/smoke/v3-*.png`);
- the real UI: menu → Fight → keyboard (both key sets in 1P, block/grab/throw/super keys) → pause/resume → results →
  menu → controls panel, double-tap dash, a mocked gamepad (incl. LT block), and touch buttons (incl. block, super,
  throwable, grab) on a phone-sized touch screen.
- v3.1 (`tools/smoke-world.cjs`, also alone): the HUD band and camera on iPad Pro 11" and 12.9" layouts (fighters on the
  Kitchen shelf stay under the HUD; `tmp/smoke/ipad-hud-*.png`), the sky fill above the arena (no letterbox pixels in
  the viewport with both fighters on the Asteroid's top planet), the Codex's code box, practice-speed results (counted,
  no reward box), the lore table (every key, all lines unique), the asteroid's `groundBelow` + Phase Step, CPU vines and the
  "TOO BIG" label. `tools/smoke-ipad.cjs` (touch mode, fullscreen, performance) runs when present.
- v3.2 (`tools/smoke-world.cjs` too): a hidden tab flushes dirty saves, a Ranked match abandoned by pagehide and then
  restored from the bfcache ends at the menu with the rank moved once, `GLOW_SCALE` through `glow()` and the settings,
  the campaign map's canvas cap and no idle redraws (`tmp/smoke/ipad-campaign-*.png`), the loadout tile cache, the
  Codex arrows not focusing the input, the HUD's stubbed safe-area inset, and "Tap to skip" on touch.
- v4 feel (`tools/smoke-feel.cjs`, also alone): upright ≥ 70 % under `TUNE_SILLY` on six arenas (nobody down 4 s+) and
  floppier than `TUNE_CLASSIC`; hit-stop 0 for light hits, growing with damage, longest on the K.O.; heavy hits knock
  harder, launch and tumble; a short guns-vs-melee round robin within 30–70 %; every blade's reach and speed distinct
  (no two within 10 % on both); every CPU level slips (Easy most) and still beats the level below.
It prints a table and exits non-zero on any failure. Screenshots: `tmp/smoke/`.
