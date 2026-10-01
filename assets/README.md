# Assets

`golfer.glb` is the realistic golfer used by `src/js/360-golfer3d.js`.

- Source: "X Bot" from the three.js examples (`examples/models/gltf/Xbot.glb`), originally an Adobe Mixamo character.
  Mixamo characters are free to use in your own games and projects.
- Made smaller with `node tools/shrink-golfer.mjs Xbot.glb assets/golfer.glb 0.45`:
  animations removed (the swing is posed in code), 45% of the triangles kept, numbers stored in fewer bytes.
- `build.mjs` embeds it as base64 so `dist/index.html` stays one file.
