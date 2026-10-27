# Bumps daily
id: F-117 · status: spec'd · priority: P2 depth · pillars: Fair, Truth · depends on: F-005, F-115 · version: 1

## Summary
Fridays become a bumps day. Everyone starts third on the same river, and the board ranks where you finished on the river, then how early you made your bump.

## Why
The daily rotation (F-115) has no bumps day, because the board ranks by time and a bumped crew has no finish time. Bumps is the game's most retellable mode, so leaving it out of the daily leaves it out of the social loop.

## The twist
Like a time-trial leaderboard, except the score is a **river place**, with time only as the tie-break. Bumping early beats bumping late, and rowing over fast beats rowing over slow. It is not a new board: one sortable number fits the existing `dailyTime` field, so storage, ordering and verification stay as they are.

## Rules
- **Format:** Friday (`weekday === 5`) from a start day after it ships (the same rule as `DAILY_FORMATS_FROM`). Options: `{ kind: 'bumps', distance: 1000, lane: 2, difficulty: 'national', rules: 6, cls: CLASS_KEYS[day % 4] }`. You always start at station 3.
- **Score (lower is better)** = `place × BUMP_SCORE_PLACE` + tie-break:
  - **Made a bump:** the race time when you bumped (`p.out.t`).
  - **Rowed over:** `BUMP_SCORE_ROWED_OVER` + finish time.
  - **Bumped down:** `BUMP_SCORE_BUMPED` + (`BUMP_TIME_CAP` − the race time you were caught), since later is better.
  - Every tie-break stays below `BUMP_SCORE_PLACE`, so place always decides first.
- **Board:** shows "2nd · bump at 1:12" instead of a time. The share card reads "↑1 at 1:12 · 2nd on the river".
- **Verification:** re-row the code, recompute the score, and require an exact match (as times are now).
- **Edge cases:**
  - A row whose code doesn't re-row is rejected, as now.
  - A bumps code posted on a non-bumps day fails the options match, as now.
  - Streaks count a bumps daily like any other.

## Numbers
| Quantity | Start | Rationale |
|---|---|---|
| `BUMP_SCORE_PLACE` | 10 000 | larger than any tie-break (a 1000 m bumps race lasts under 400 s) |
| `BUMP_SCORE_ROWED_OVER` | 2 000 | ranks below every bump at the same place |
| `BUMP_SCORE_BUMPED` | 5 000 | ranks below rowing over at the same place |
| `BUMP_TIME_CAP` | 1 000 s | above any race time, so `cap − t` is always positive and below 1 000 |

Derived: a bump at 72 s from station 3 to 2nd scores 2 × 10 000 + 72 = 20 072. Rowing over at 3rd in 190 s scores 30 000 + 2 000 + 190 = 32 190. Being caught at 150 s and finishing 4th scores 40 000 + 5 000 + (1 000 − 150) = 45 850. Within a place the bands are bump 0–400, rowed over 2 000–2 400 and bumped 5 000–6 000, all under 10 000, so the order is always place first, then the kind of result, then time.
Tuning lever: if Friday boards fill with ties, move the difficulty up to Elite before touching the score.

## Interactions
- **F-115:** a new weekday branch.
- **F-102:** a card variant.
- **F-103:** the board window works unchanged, since it's still one sorted number.
- **F-104:** streaks are unchanged.

## Acceptance
1. A bumps daily row verifies only with its exact score.
2. A crew that bumps early ranks above one that bumps late from the same station.
3. Rowing over ranks above being bumped down at the same final place.

## Open questions
- Should the starting station rotate weekly? Recommendation: no, station 3 always, so Friday scores compare across weeks.

Changelog: v1 initial. Caught before writing code: the first draft's bumped-down tie-break (10 000 − t) overflowed into the next place.
