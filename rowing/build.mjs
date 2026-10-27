// Assembles src/ into one self-contained dist/index.html, the same way Voxel Links does.
// Files are concatenated in filename order, so the numeric prefix is the load order.
// Slices numbered below 100 are the headless simulation: test/sim.test.mjs runs them in Node with no DOM.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

process.chdir(fileURLToPath(new URL('.', import.meta.url)));

const cat = (dir, ext) => readdirSync(dir).filter(f => f.endsWith(ext)).sort()
  .map(f => readFileSync(`${dir}/${f}`, 'utf8')).join('\n');

function build() {
  const js = cat('src/js', '.js');
  try { new vm.Script(js, { filename: 'regatta.js' }) } catch (e) { return console.error('syntax error:', e.message), false }
  const html = readFileSync('src/index.html', 'utf8')
    .replace('{{styles}}', () => cat('src/styles', '.css'))
    .replace('{{script}}', () => js);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  console.log(`built rowing/dist/index.html (${Math.round(html.length / 1024)} KB)`);
  return true;
}

if (!build() && !process.argv.includes('--dev')) process.exit(1);

if (process.argv.includes('--dev')) {
  let t;
  watch('src', { recursive: true }, () => { clearTimeout(t); t = setTimeout(build, 50) });
  createServer((_, res) => res.writeHead(200, { 'content-type': 'text/html' }).end(readFileSync('dist/index.html')))
    .listen(5174, () => {
      const url = 'http://localhost:5174';
      console.log(url, '(rebuilds on save, refresh to see changes)');
      if (process.argv.includes('--open'))
        exec(`${{ darwin: 'open', win32: 'start ""' }[process.platform] ?? 'xdg-open'} ${url}`);
    });
}
