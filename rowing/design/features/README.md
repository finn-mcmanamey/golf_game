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
| F-103 | Board around you: your row ±2 under the top 3 | idea | P1 | Fair | F-004 | Lead: ICIS 2021 local leaderboards; "race the ghost just above you" button |
| F-104 | Streak shield: 1 per 7 days in a row, max 2, used automatically | idea | P2 | Fair | F-004 | Lead: Duolingo streak freeze; cut first |
| F-105 | Sim maths guard: test fails on any engine-dependent Math call in sim files | shipped | P1 | Fair | F-002 | Verified finding (trigfills, ECMAScript) |
| F-106 | Game speed 75% (accessibility) | idea | P2 | Feel | F-101 | Lead: GAG "adjust game speed"; runs the sim slower in real time, codes unchanged; not counted for records |
