---
name: polish
description: Run /play, look at the game with screenshots, then loop - Finn asks for a UI change, Claude makes it, rebuilds, re-screenshots and republishes - until Finn says "I'm finished". Use when Finn wants to polish or tweak how the game looks.
---

# Polish loop

A back-and-forth for tweaking how Voxel Links looks. Follow CLAUDE.md: plain words, short replies, it's Finn's call.

## Start

1. Run `/play` (build and publish), and give Finn the link.
2. Take screenshots so you can see what he sees:
   `node .claude/skills/polish/view.mjs <scratchpad>/polish/before front tee:2206 card:2206`
   Views: `front`, `tee:<seed>[:<hole>]`, `card:<seed>`, `sheet:<tab>` (e.g. `sheet:pSettings`); add `@mobile` for a phone.
   Read each PNG. If it prints page errors, mention them.
3. In two or three lines, say what you notice (anything cramped, hard to read or off), then ask: "What would you like to change first?"

## Each round

1. **Change it.** Keep it small: one thing per round.
   - Look → `src/styles/`, layout → `src/index.html`, drawing → `src/js/` (drawing only, never game state).
   - Say in one sentence what you're changing and why.
2. **Check it.** `npm run build` must pass. If a round touched `src/js/`, re-run the replay check
   (`node .claude/skills/polish/verify.mjs verify`) so old rounds still verify.
3. **See it.** Screenshot the affected views into `<scratchpad>/polish/after` and Read them.
   Compare against the before shots and say plainly whether it worked.
4. **Show it.** Republish with the Artifact tool (same file and url as `/play`, omit `capabilities`)
   and tell Finn to reload the link.
5. Ask "What next?" If he's happy with this change, commit it (a save point) with a plain message,
   and copy `after/` over `before/` for the next round.

Screens under software GL look slightly different from a real GPU; trust Finn's eyes over the screenshot.

## Finish

When Finn says **"I'm finished"** (or similar):
1. Make sure the build passes and everything is committed, then push the branch.
2. Republish one last time.
3. Sum up in a few bullets what changed, and celebrate it.
