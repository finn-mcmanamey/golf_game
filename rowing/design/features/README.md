# Feature registry

Build order follows `Depends on`. Status: idea → spec'd → approved → building → shipped, or cut.

| ID | Feature | Status | Pri | Pillars | Depends on | Spec / note |
|----|---------|--------|-----|---------|------------|-------------|
| F-001 | One-button rowing (catch timing, release, crab, swing, energy) | shipped | P0 | Feel | — | 030-physics.js |
| F-002 | Race codes, ghosts, replays (deterministic sim, rules versions) | shipped | P0 | Fair | F-001 | 050/060 |
| F-003 | Regatta, head race, erg, cup, season | shipped | P1 | Truth | F-001 | 400–415 |
| F-004 | Daily regatta + verified leaderboard + streak | shipped | P1 | Fair | F-002 | 435-leaderboard.js |
| F-005 | Bumps, bumps week, Boat Race | shipped | P1 | Truth | F-003 | 418/419/445 |
| F-006 | Live races, cheers | shipped | P2 | Fair | F-002 | 440-live.js |
| F-101 | Latency calibration: cues move, judging doesn't | shipped | P0 | Feel | F-001 | features/latency-calibration.md |
| F-102 | Daily share card: spoiler-free result line with streak | shipped | P1 | Fair | F-004 | Copies "Voxel Regatta daily · 4:07.3 · 3rd/12 · 92% ●●●●○ · 🔥5"; no code, no link to the ghost (ghosts stay opt-in) |
| F-103 | Board around you: your row ±2 under the top 3 | shipped | P1 | Fair | F-004 | Lead: ICIS 2021 local leaderboards; "race the ghost just above you" button |
| F-104 | Streak shield: 1 per 7 days in a row, max 2, used automatically | shipped | P2 | Fair | F-004 | Lead: Duolingo streak freeze; cut first |
| F-105 | Sim maths guard: test fails on any engine-dependent Math call in sim files | shipped | P1 | Fair | F-002 | Verified finding (trigfills, ECMAScript). Checked: 8 races (every kind, rules 1/3/4) finish bit-identically in V8 and QuickJS; a raw sin/exp/pow control also matched there, so that pair of engines doesn't show the drift |
| F-106 | Game speed 75% (accessibility) | shipped | P2 | Feel | F-101 | Lead: GAG "adjust game speed"; runs the sim slower in real time, codes unchanged; not counted for records |
| F-107 | Codes that travel: bare code when the link can't be opened; paste box on the menu | shipped | P1 | Fair | F-002 | Artifact pages run in a sandboxed frame whose URL friends can't open |
| F-108 | Timestamped presses: each 60 Hz step reads the drive as of its own moment | shipped | P0 | Feel | F-001 | At 30 fps (iOS Low Power Mode, lead: WebKit 215745) a press used to land up to 33 ms late; recorded inputs unchanged |
| F-109 | Stream lines: head-race streams fastest mid-river, slack by the banks (rules 5) | shipped | P2 | Truth | F-003 | features/stream-lines.md |
| F-110 | Stream flecks: foam drifting at the local stream speed on rules-5 head races | shipped | P3 | Truth | F-109 | 162-stream-fx.js; drawing only, drift ×6 so it reads |
| F-111 | Henley verdicts: match-race margins called in lengths (canvas, feet, ¾ length, easily) | shipped | P3 | Truth | F-003 | 415-cup.js byVerdict; lead: HRR glossary |
| F-112 | Learn to Row names this device's controls (keys or on-screen buttons) | shipped | P1 | Feel | F-001 | Phone players were told to press W, A, D and Shift |
| F-113 | Idle frame cap: menus and results draw at most 30 fps | shipped | P3 | Feel | — | Battery and heat on phones; races still draw every frame |
| F-114 | Rivals read the river: Elite/Olympic head crews take the slack water against a strong stream (rules 6) | shipped | P2 | Truth | F-109 | 040-bots.js riverLine; olympic field −0.5 s/km against a −0.125 stream, no bank hits |
| F-115 | Daily formats by weekday: erg Wednesdays, head race weekends (rules 6), regatta otherwise | shipped | P1 | Fair | F-004, F-109 | From day 20754 (28 Oct 2026) so no board changed mid-day; rules pinned per format |
| F-116 | Cross-browser replay test in CI (Firefox, WebKit) | idea | P1 | Fair | F-002 | Only Chromium is installed here; V8 vs QuickJS already match. Needs browsers or a CI runner |
| F-117 | Bumps daily with a place-based board | idea | P2 | Fair | F-005, F-115 | Bumps results are places, not times; the board would rank bumps made, then distance |
| F-118 | Crew selection: pick seats with trade-offs (power vs timing spread) | idea | P2 | Truth | F-001 | Must stay a choice, not an upgrade (brief: no stat progression); behind a rules version |
| F-119 | Second research pass once fetch works | idea | P1 | — | — | Re-run the five questions; the source hosts were blocked by the network policy this time |
