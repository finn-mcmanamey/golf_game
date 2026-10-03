// Joins src/ into dist/stick-clash.html: the page shell, the inlined CSS and ONE classic script made of the
// ordered slices in src/js. Fails loudly (naming the slice and line) on syntax errors or clashing top-level names.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const JS_DIR = path.join(SRC, 'js');
const STYLE_DIR = path.join(SRC, 'styles');
const OUT = path.join(ROOT, 'dist', 'stick-clash.html');
const SIZE_BUDGET = 1.5 * 1024 * 1024;   // bytes: the whole game must stay one small offline file

function fail(msg) {
  console.error('\n BUILD FAILED\n ' + msg.split('\n').join('\n ') + '\n');
  process.exit(1);
}

// Pulls "file:line" out of a SyntaxError's stack so we can point at the exact spot.
function errorLine(err, filename) {
  const m = String(err.stack || '').match(new RegExp(filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(\\d+)'));
  return m ? +m[1] : null;
}

function readSlices() {
  const names = fs.readdirSync(JS_DIR).filter(n => n.endsWith('.js')).sort();
  if (!names.length) fail('no slices found in src/js');
  return names.map(name => ({ name, code: fs.readFileSync(path.join(JS_DIR, name), 'utf8').replace(/\r\n/g, '\n') }));
}

// Each slice must be valid on its own (strict mode) so errors are reported against the right file.
function checkSlice(s) {
  if (/^\s*(import|export)\s/m.test(s.code)) fail(`${s.name}: import/export is not allowed (one classic script only)`);
  if (/<\/script/i.test(s.code)) fail(`${s.name}: contains "</script", which would end the inline script early`);
  try {
    new vm.Script("'use strict';\n" + s.code, { filename: s.name });
  } catch (e) {
    const line = errorLine(e, s.name);
    fail(`${s.name}${line ? ':' + (line - 1) : ''}  ${e.message}`);
  }
}

// Top-level names live in one shared scope; a second `function draw()` in another slice would silently win.
function checkTopLevelNames(slices) {
  const seen = new Map(), dupes = [];
  const re = /^(?:async\s+)?(?:function\s*\*?\s*|const\s+|let\s+|var\s+|class\s+)([A-Za-z_$][\w$]*)/gm;
  for (const s of slices) {
    for (const m of s.code.matchAll(re)) {
      const name = m[1];
      if (seen.has(name) && seen.get(name) !== s.name) dupes.push(`"${name}" in ${seen.get(name)} and ${s.name}`);
      else seen.set(name, s.name);
    }
  }
  if (dupes.length) fail('duplicate top-level names (rename one of each pair):\n' + dupes.join('\n'));
}

function joinScript(slices) {
  let script = "'use strict';\n";
  const ranges = [];
  for (const s of slices) {
    script += `// ===== ${s.name} =====\n`;
    const start = script.split('\n').length;
    script += s.code.replace(/\s*$/, '') + '\n';
    ranges.push({ name: s.name, start, end: script.split('\n').length - 1 });
  }
  try {
    new vm.Script(script, { filename: 'joined.js' });
  } catch (e) {
    const line = errorLine(e, 'joined.js');
    const r = line && ranges.find(r => line >= r.start && line <= r.end);
    fail(`${r ? r.name + ':' + (line - r.start + 1) : 'joined script'}  ${e.message}`);
  }
  return script;
}

// Embeds the woff2 files listed in assets/fonts/fonts.txt (family|weight|file|unicode-range) so the game
// needs no network: Google Fonts fails offline and behind some proxies.
function fontFaces() {
  const dir = path.join(ROOT, 'assets', 'fonts'), list = path.join(dir, 'fonts.txt');
  if (!fs.existsSync(list)) return '';
  return fs.readFileSync(list, 'utf8').trim().split('\n').map(row => {
    const [family, weight, file, range] = row.split('|');
    const data = fs.readFileSync(path.join(dir, file)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
      `src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range};}`;
  }).join('\n') + '\n';
}

function readStyles() {
  let css = fontFaces() + fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');
  if (fs.existsSync(STYLE_DIR)) {
    for (const n of fs.readdirSync(STYLE_DIR).filter(n => n.endsWith('.css')).sort()) {
      css += `\n/* ===== styles/${n} ===== */\n` + fs.readFileSync(path.join(STYLE_DIR, n), 'utf8');
    }
  }
  return css;
}

const slices = readSlices();
slices.forEach(checkSlice);
checkTopLevelNames(slices);
const script = joinScript(slices);
let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
for (const marker of ['<!--STYLE-->', '<!--SCRIPT-->']) if (!html.includes(marker)) fail(`src/index.html is missing ${marker}`);
// Function replacers: a plain string would treat "$&" etc. inside the code as replacement patterns.
html = html.replace('<!--STYLE-->', () => '<style>\n' + readStyles() + '\n</style>');
html = html.replace('<!--SCRIPT-->', () => '<script>\n' + script + '</script>');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
reportSizes(html, slices);

// The game must stay one offline file under SIZE_BUDGET: everything (music, voice, art) is procedural.
// Prints every slice's size so content owners can see what they spend, and fails the build above the budget.
function reportSizes(out, list) {
  const total = Buffer.byteLength(out), kb = n => (n / 1024).toFixed(1);
  const cells = list.map(s => `${s.name.replace(/\.js$/, '').padEnd(22)}${kb(Buffer.byteLength(s.code)).padStart(6)}`);
  console.log('slice sizes (KB):');
  for (let i = 0; i < cells.length; i += 3) console.log('  ' + cells.slice(i, i + 3).join('   '));
  const css = Buffer.byteLength(readStyles());
  console.log(`  css + fonts ${kb(css)} KB`);
  const pct = (total / SIZE_BUDGET * 100).toFixed(0);
  console.log(`built dist/stick-clash.html  ${kb(total)} KB of ${kb(SIZE_BUDGET)} KB budget (${pct}%)  ` +
    `(${list.length} slices, ${script.split('\n').length} script lines)`);
  if (total > SIZE_BUDGET) fail(`output is ${kb(total)} KB, over the ${kb(SIZE_BUDGET)} KB budget: trim or make content procedural`);
}
