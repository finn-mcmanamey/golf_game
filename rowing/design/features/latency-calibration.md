# Latency calibration
id: F-101 · status: shipped · priority: P0 hook · pillars: Feel, Fair · depends on: F-001 · depended on by: F-106 · version: 2

## Summary
A 10-tap test measures how late this device's sound and screen reach you, plus your thumb. The catch cue (tone, catch-zone light) then arrives that much *earlier*, so it lands on the beat you actually feel. Bluetooth earbuds stop costing perfects.

## Why
Timing is the whole game: perfect is ±`perfectWindow` (75 ms). Output latency varies by device, from tens of ms on wired output to a few hundred on Bluetooth (*lead*: web.dev AudioContext.outputLatency). A cue that is 150 ms late makes "perfect" impossible to learn by ear on that device. Without calibration, the board measures headphones, not rowing.

## The twist
Like a rhythm game's audio offset, except **the judge never moves**. Most rhythm games shift the hit window. Here the simulation and race codes stay identical on every device, and only the *cues* (sound, light, the drawn rower) are pulled earlier. Calibration can never make a code re-row differently. It is not a difficulty setting and not an auto-assist.

## Rules
- **Test:** 10 clicks at `CAL_BEAT` intervals, scheduled on the AudioContext clock. The player taps (any key, touch or pad A) on each click. A tap within ±`CAL_ACCEPT` of a click pairs with it. Taps 1–2 are discarded as warm-up. Taps are timed by their event timestamps against the clicks mapped once onto the page clock. The audio clock moves in blocks (coarse in some browsers), which biased an early build by +60 ms.
- **Result:** offset = median of the paired (tap − click) values, clamped to [0, `CAL_MAX`]. Fewer than `CAL_MIN_TAPS` paired taps: "Didn't catch that, try again", and the offset is unchanged.
- **Use:**
  - The cue tone plays when the slide's time-to-front ≤ offset (instead of = 0).
  - `#catchZone.ready` lights at time-to-front < 0.25 s + offset.
  - Drawing extrapolates the stroke-seat pose by the offset.
  - Nothing below file 100 reads it.
- **Storage:** `settings.latencyMs` (default 0), through the existing store. Reload keeps it. Re-run any time from the pause menu and settings.
- **Edge cases:**
  - Mid-race test: not offered (the pause menu button is disabled while racing).
  - Audio blocked or suspended: the test can't start, and a toast says so.
  - Duel and replay: cues use the same offset.
  - Erg mode: same.

## Numbers
| Quantity | Start | Rationale |
|---|---|---|
| `CAL_BEAT` | 600 ms | 100 bpm: slow enough to anticipate, like stroke rate 33 |
| `CAL_CLICKS` | 10 | about 6 s of clicks; 8 used after warm-up |
| `CAL_ACCEPT` | ±300 ms | half a beat: a tap always pairs with its nearest click |
| `CAL_MIN_TAPS` | 6 | the median of at least 6 resists one fumbled tap |
| `CAL_MAX` | 300 ms | above this, the device or the tapping is broken |

Derived: test length = 10 × 600 ms = 6.0 s, plus a 1 s lead-in = 7 s. That is inside the first-60-seconds budget (brief), leaving about 50 s for the first race start. A median of 8 taps with a human spread of about ±30 ms gives an offset good to roughly ±15 ms, well inside the 75 ms perfect window.
Tuning lever: if players report the cue feels early after calibrating, scale the applied offset by 0.8 before touching `CAL_BEAT`.

## Interactions
- Changes the cue in `300-hud.js` and the catch light. Changes nothing in the sim, so F-002 codes, ghosts and the board (F-004) are unaffected by design.
- F-106 (game speed) would scale beat times, but the offset stays in real ms.

## Player experience
- **First encounter:** a card on the menu ("Tune timing to this device · 7 s") until it has been run once. Also in settings.
- **Decision:** none in the test itself. Afterwards, whether to trust the cue or the boat.
- **Failure:** an inconsistent tapper gets "try again". It costs 7 s.
- **Retellable moment:** "I calibrated and went from 60% to 85% perfect on my AirPods."

## Feedback and feel
- Each click is a 1.2 kHz tick, with a ring that pulses on the beat.
- Each paired tap flashes green (|Δ| < 75 ms) or amber.
- The result shows "Your device + thumb: 132 ms". The cue moves at once, with no restart.

## Acceptance
1. A synthetic tapper 120 ms late on every click gives an offset of 120 ± 5 ms.
2. With the offset set, the cue tone fires before the slide reaches the front, by the offset.
3. A race code rowed with offset 0 and with offset 200 re-rows to the identical time (the sim is untouched).
4. Fewer than 6 paired taps leaves the stored offset unchanged.

## Open questions
- Separate audio and visual offsets? Recommendation: one number now; split only if players report the light and the tone disagreeing.

Changelog: v1 initial. v2 taps timed by event timestamp, not the audio clock (a 120 ms tapper measured 180 ms before, 120 ms after).
