// Copies the built game (rowing/dist/index.html) into a module the app can import.
// Run `npm run build:rowing` at the repo root first.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
writeFileSync(new URL('../game-html.js', import.meta.url), `export default ${JSON.stringify(html)};\n`);
console.log(`game-html.js: ${Math.round(html.length / 1024)} KB`);
