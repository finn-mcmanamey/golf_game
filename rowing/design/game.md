# Voxel Regatta — Design Brief (next phase)

Assumptions (taken, not asked: the request said to proceed without stopping)
- Platform: browser (desktop keyboard, phone touch) plus the iPhone WebView app. One button, sessions of 1–6 minutes.
- Players: Finn and friends, solo-first, with async competition (daily board, ghosts, race links) and occasional live races.
- Scope: polish and depth on the existing game, with no new art pipeline. Everything stays in the single file, and the simulation stays deterministic.
- Evidence: a deep-research pass (cited sources below) verified only one claim. Scored maths must avoid engine-dependent `Math` functions. The other leads came from search snippets that could not be fetched (the network policy blocked the source hosts), so they are marked *lead* and treated as hypotheses.

## Pitch
Like a rhythm game, except the beat is your own boat. The stroke you just rowed sets when the next catch is due, so tempo is both the skill and the strategy. Every race is a shareable, re-rowable code.

## Player fantasy
You are the stroke of a crew, and you feel the boat run under you. You choose when to take it up and when to hold your length, and whether the crew ahead is catchable.

## Pillars (ranked, each with a tie-break)
1. **Feel**: the catch is fair to the millisecond. Feel beats Content: no new mode ships while timing feels off on someone's device.
2. **Fair competition**: codes re-row exactly, and the board is verified. Fair beats Convenient: a feature that can't be verified doesn't count for records.
3. **Rowing truth**: tactics come from real racing (bumps, heads, Henley). Truth beats Spectacle, unless truth is boring for more than 10 s.

## Not this
- **No stats, upgrades or gear progression.** Speed comes only from rowing well, or the ghost and the board stop meaning anything.
- **No login rewards.** The reason to come back is an unfinished plan (a bumps week, a season, today's board), not a pay-out.
- **No physics engine, and no raw `Math.sin`/`pow`/`exp` in scored code.** Engines differ in the last bit, and a chaotic simulation magnifies that (verified: trigfills README, ECMAScript "implementation-approximated").

## Core loop
- **Seconds:** read the slide, time the catch, then judge the release. This builds swing, and swing feeds speed.
- **Minutes:** a race. Choose the rate, the pushes and the steering line, against energy. The result feeds PBs, the board and campaign state.
- **Days:** today's daily, the next bumps day, the next season regatta. Each leaves an open result to beat tomorrow.

## Systems map (what this phase adds)
| System | Produces | Consumes | Modifies |
|---|---|---|---|
| Latency calibration (F-101) | a per-device offset | a 10-tap test | when cues are shown and heard (drawing only) |
| Share card (F-102) | a spoiler-free result text | the race result, the daily seed | gets more people playing today's daily |
| Board around you (F-103) | the 2 rows above and below you | verified rows | which ghost you chase next |
| Streak shield (F-104) | 1 shield per 7-day streak (max 2) | missed days | keeps the daily streak (F-102 shows it) |

Combos:
- Calibration plus the cue lets a phone player on Bluetooth earbuds hit perfects at the same rate as on the laptop. That makes the board's times comparable.
- The board around you plus ghosts: "race the time just above yours" is always a close race, never an impossible one.
- The share card plus the streak shield: the share line carries 🔥 streak days, and a shield keeps a sick day from erasing the streak you've been showing.

Loops:
- **Positive:** streak → share → more players → a bigger board. Capped by one daily per day.
- **Negative:** the board around you only ever shows nearby times. That keeps a beginner's target reachable, and it's what protects them from quitting.

## Session and psychology
- **Motivation:** primary *mastery* (timing, rate strategy); secondary *social/status* (board, codes).
- **First 60 s:** the calibration prompt (10 taps, about 8 s) then straight into Learn to Row. The first decision comes at the first stroke: rate up or settle.
- **Stopping points:** the end of a race, a bumps day, a season regatta.
- **Reason to return:** tomorrow's daily, with the streak at stake, and the next bumps day.
- **Mastery:**
  - 1 min: rows clean strokes.
  - 1 h: holds 90% perfect catches at rate 32 and paces the energy.
  - 10 h: wins at Olympic level by timing pushes into the wash and using the bumps whistles.
- **Failure:** a lost race costs nothing but the result. A crab costs about 1.5 s and is always the player's own timing, which is why calibration (F-101) has to come first.
- **Retellable moment:** the bump on day 4 that wins blades, after being on three whistles for 200 m.

## Scope
- **MVP of this phase:** F-101 calibration, F-102 share card.
- **v1:** F-103 board around you, F-104 streak shield, F-105 a sim-maths guard test.
- **Later:** F-106 slower game speed (an accessibility *lead*). **Cut first:** F-104.

## Features
See [features/README.md](features/README.md).

## Open decisions
1. **Should calibration also move the judging window?** Recommendation: no. It shifts only cues and drawing, so codes and the board stay valid and identical across devices.
2. **Should the share card show the time, or only place and catches?** Recommendation: show the time. The daily course is identical for everyone, so the time is the result. Codes stay out of the card, so it gives away nothing about the route.
3. **Can a streak shield be used on the day it's earned?** Recommendation: no. It's earned on day 7 and consumed automatically on the next missed day.

## Sources
- Verified: trigfills README (https://github.com/strainer/trigfills); ECMAScript spec, Math functions "implementation-approximated".
- Leads, unverified (fetch blocked): Duolingo streak experiments (blog.duolingo.com/improving-the-streak); ICIS 2021 local-vs-global leaderboards (aisel.aisnet.org/icis2021/user_behaivors/user_behaivors/19); Rhythm Quest calibration devlog (ddrkirby.com/rhythm-quest/devlog/10.html); web.dev AudioContext.outputLatency; WebKit bug 215745 (rAF at 30 fps in iOS Low Power Mode); CUCBC "How bumps work"; Game Accessibility Guidelines (adjustable game speed); TechCrunch on Wordle's spoiler-free share.
