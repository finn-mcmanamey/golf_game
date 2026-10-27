# Stream lines (head races)
id: F-109 · status: shipped · priority: P2 depth · pillars: Truth, Feel · depends on: F-003 · version: 2

## Summary
On a head-race river the stream isn't uniform. It runs fastest in the middle and slackest by the banks. Against the stream, hugging a bank gains seconds but risks hitting it. With the stream, the middle is fastest.

## Why
Today the stream is one number for the whole river, so steering only ever means "stay on your line". The 10-hour mastery promise in the brief needs a decision a practised player can exploit and a beginner can ignore.

## The twist
Like racing lines in a driving game, except the fast line moves with the stream's direction: the same river is raced differently on a following-stream day and an opposing-stream day. It is **not** a new control. It uses the existing steering, and with the assist on you simply keep your line.

## Rules
- Rules version 5, head races only (`race.opts.rules >= 5 && course.kind === 'head'`). Older rules, and every other kind, are unchanged.
- The stream a boat feels is `current × (TUNE.streamMid − TUNE.streamDrop × off²)`, where `off` = the boat's distance from the river's centre line ÷ `halfW`, clamped to 1.
- Bots keep their lines, so the line is a player skill.
- **Discovery:** on head races with any stream, the venue line says "fastest mid-river" (following) or "slacker by the banks" (opposing), and the cox calls it once after the start.

## Numbers
| Quantity | Start | Rationale |
|---|---|---|
| `TUNE.streamMid` | 1.2 | mid-river runs 20% above the course's stream |
| `TUNE.streamDrop` | 1.25 | at off 0.9 (the bank-hit limit is 26.8 / 30 m) the stream is 1.2 − 1.25 × 0.81 ≈ 0.19 of the course's: near-slack, as on a real river |

Derived:
- The player's head-race line is close to mid-river (off ≈ 0.06), so the default line feels the full 1.2× stream.
- Crossing to an outer line costs about 1 s of steering over 1000 m (measured under rules 4: 189.75 s mid against 190.94 s at 18 m).
- An 18 m line (off 0.6) feels 1.2 − 1.25 × 0.36 = 0.75×, so it's 0.45 × |current| slacker than mid. Against the strongest stream (−0.14 m/s) that's 0.063 m/s, about 1.4% or about 2.7 s per 1000 m before the crossing cost.

Measured (1x, club, 1000 m, scripted rower):

| Course stream | Mid | 18 m | 21 m |
|---|---|---|---|
| −0.125 (strong, against) | 192.72 | 191.91 | 191.61, 4 bank hits |
| −0.077 (mild, against) | 188.31 | 188.20 | 188.18, 3 bank hits |
| +0.174 (with) | 180.14 | 183.37 | 184.40 |

So the bank pays only on strong opposing days, and the middle is clearly right with the stream.
Tuning lever: if the bank line feels pointless, raise `streamDrop` toward 1.4 (keeping mid − drop × 0.81 ≥ 0) before touching `streamMid`.

## Interactions
- Bank hits (existing) are the risk, and wind cross-drift pushes boats off the line.
- The steering assist pulls toward the lane line, so it gives up the gain. That's intended: assist is the floor, manual steering is the ceiling.

## Acceptance
1. A rules-4 head race and every other race kind re-row exactly as before (golden times unchanged).
2. Under rules 5 with a strong opposing stream (< −0.12), a scripted boat holding an 18 m line finishes faster than the same boat mid-river.
3. With a following stream, mid-river is faster than an 18 m line.

Changelog: v1 initial. v2 drop 0.6 → 1.25, mid 1.15 → 1.2: at 0.6 the crossing cost (about 1 s) beat the gain, so the middle always won and there was no decision.
