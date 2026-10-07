// Draws the app icon and splash image procedurally (no third-party art):
// two crossed "sticks" on a dark background. Run with `npm run icons`.
// The drawing itself lives in ../../tools/icon.mjs, shared with the game page's inline icons.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { iconPng } from '../../tools/icon.mjs';

const ASSETS = fileURLToPath(new URL('../assets/', import.meta.url));

writeFileSync(ASSETS + 'icon.png', iconPng(1024, false)); // iOS icons must be opaque
writeFileSync(ASSETS + 'splash-icon.png', iconPng(512, true));
console.log('Wrote assets/icon.png and assets/splash-icon.png');
