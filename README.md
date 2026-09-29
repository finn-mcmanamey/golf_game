# Voxel Links

A voxel golf game in plain HTML, CSS and JavaScript. It renders with raw WebGL and needs no libraries or dependencies.

## Run it

In Claude Code, just type `/play`: it builds the game and opens it in a new tab.

Requires Node 20+.

```sh
npm run dev     # builds, serves http://localhost:5173, rebuilds on every save
npm run dev -- --open   # same, and opens it in your browser
npm run build   # writes dist/index.html, the whole game in one file
```

`dist/index.html` is the thing you share: open it directly, host it anywhere, or paste it into a Claude artifact.

## Layout

```
src/
  index.html      page markup with {{styles}} and {{script}} placeholders
  styles/*.css    concatenated in filename order into the <style> tag
  js/*.js         concatenated in filename order into one <script> tag
legacy/           the earlier single-file prototype, for reference
build.mjs         the build (about 30 lines, no dependencies)
```

### How the JS files work

The `js/` files are **not** modules. They are slices of one script, joined in order, so every top-level
name is visible to every file. The three-digit prefix is the load order.

- A new file goes in with a number between its neighbours, e.g. `545-my-feature.js`.
- Code that runs at load time must come after the things it uses. Functions can be called from anywhere.
- Keep it one script. `vqWorker` in `160-people.js` starts a Web Worker from the page's own script text
  to verify rounds, so splitting into `<script src>` tags or ES modules would break it.

| Range   | What's there |
|---------|--------------|
| 000–060 | maths, saves, utils, config, mesh, terrain, course generation |
| 070–110 | physics, audio, weather, renderer, minimap |
| 120–170 | round codec and verifier, game core, career, look and sound, multiplayer, bug key |
| 180–390 | engine polish: drops, HUD, input, camera, putting, trees, lighting |
| 400–510 | tuning panel, course version 7, ghosts, moments, options, front page |
| 520–580 | the island, validated flight, hidden holes, links, highlights, leaders |
| 590–640 | particles, round flow, swing input, input handlers |
