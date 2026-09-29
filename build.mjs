// Assembles src/ into one self-contained dist/index.html.
// The game must ship as a single inline <script>: the round verifier builds a Worker from that script's own text.
// Files are concatenated in filename order, so the numeric prefix is the load order.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import vm from 'node:vm';

const cat = (dir, ext) => readdirSync(dir).filter(f => f.endsWith(ext)).sort()
  .map(f => readFileSync(`${dir}/${f}`, 'utf8')).join('');

function build() {
  const js = cat('src/js', '.js');
  try { new vm.Script(js, { filename: 'game.js' }) } catch (e) { return console.error('syntax error:', e.message) }
  const html = readFileSync('src/index.html', 'utf8')
    .replace('{{styles}}', () => cat('src/styles', '.css'))
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
    .listen(5173, () => console.log('http://localhost:5173 (rebuilds on save, refresh to see changes)'));
}
