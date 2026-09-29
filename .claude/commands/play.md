---
description: Build the game with npm and open it in a new browser tab
allowed-tools: Bash(npm run build), Bash(npm run dev*), Artifact
---

Build Voxel Links and show it to Finn in a new tab. Explain each step in one plain sentence as you go (see CLAUDE.md).

1. Run `npm run build`. If it fails, show the error, explain in simple words what it means, and stop.
2. Open the game:
   - **In a cloud / web session** (Finn can't reach `localhost`): publish `dist/index.html` with the Artifact tool,
     updating the existing artifact: pass `url: https://claude.ai/artifact/R2rEwVLscx5SNgyrmWLef9`
     (read it first if this conversation hasn't) and keep its capabilities (`db`, `user`, `downloads`: the game's saves).
     Updating keeps one link for Finn and keeps his saved progress.
     Give Finn the link and say it opens the game in a new tab. The game saves progress inside the artifact.
   - **On Finn's own computer**: run `npm run dev -- --open` in the background. It serves
     http://localhost:5173, opens it in the browser, and rebuilds on every save (refresh the tab to see changes).
3. Finish with one line on what to try, e.g. "Play a hole, then tell me what you'd like to change."
