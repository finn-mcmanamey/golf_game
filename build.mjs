// Assembles src/ into one self-contained dist/index.html.
// The game must ship as a single inline <script>: the round verifier builds a Worker from that script's own text.
// Files are concatenated in filename order, so the numeric prefix is the load order.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import vm from 'node:vm';

// Three.js and the golfer model, bundled into their own <script> placed before the game script (see CLAUDE.md "Using 3D libraries").
// If the packages are not installed (no `npm install` yet) the page builds without them and the classic golfer draws.
async function vendor() {
  try {
    const { build } = await import('esbuild');
    const out = await build({ entryPoints: ['src/vendor/three-entry.js'], bundle: true, format: 'iife', minify: true, legalComments: 'none', write: false });
    const glb = readFileSync('assets/golfer.glb').toString('base64');
    const js = out.outputFiles[0].text + `window.GOLFER_GLB="${glb}";`;
    return '<script>' + js.replace(/<\/script/gi, '<\\/script') + '</script>';
  } catch (e) { console.warn('3D golfer left out:', e.message.split('\n')[0]); return '' }
}

const cat = (dir, ext) => readdirSync(dir).filter(f => f.endsWith(ext)).sort()
  .map(f => readFileSync(`${dir}/${f}`, 'utf8')).join('');

async function build() {
  const js = cat('src/js', '.js'), three = await vendor();
  try { new vm.Script(js, { filename: 'game.js' }) } catch (e) { return console.error('syntax error:', e.message) }
  const html = readFileSync('src/index.html', 'utf8')
    .replace('{{styles}}', () => cat('src/styles', '.css'))
    .replace('{{vendor}}', () => three)
    .replace('{{script}}', () => js);
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  console.log(`built dist/index.html (${Math.round(html.length / 1024)} KB)`);
}

build();

if (process.argv.includes('--dev')) {
  let t;
  watch('src', { recursive: true }, () => { clearTimeout(t); t = setTimeout(build, 50) });
  createServer((_, res) => res.writeHead(200, { 'content-type': 'text/html' }).end(readFileSync('dist/index.html')))
    .listen(5173, () => {
      const url = 'http://localhost:5173';
      console.log(url, '(rebuilds on save, refresh to see changes)');
      if (process.argv.includes('--open'))
        exec(`${{ darwin: 'open', win32: 'start ""' }[process.platform] ?? 'xdg-open'} ${url}`);
    });
}
