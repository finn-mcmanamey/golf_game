# Voxel Links

See README.md for layout. Key rules:

- `src/js/*.js` are ordered slices of ONE classic script sharing global scope. Never convert them to ES modules or separate `<script src>` tags: `vqWorker` builds a Worker from the inline script's text.
- Load order = filename order. Insert new files with an in-between numeric prefix.
- `npm run build` must pass (it syntax-checks the joined script). Output is `dist/index.html`.
- Course versions (`W.cv`) must stay deterministic: old versions replay stored round codes byte-for-byte. Gate new rules behind a new version rather than changing old ones.
