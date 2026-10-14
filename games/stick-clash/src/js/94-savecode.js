// 94-savecode.js: Settings → Transfer progress. Every saved key (localStorage keys starting 'stickclash') becomes one
// copyable code: JSON { v, t, k: { key: raw } } → deflate (CompressionStream, when the browser has it) → base64url,
// written as SC<version><z|p>.<data>.<fnv-1a checksum of the JSON>. Importing checks the code, previews what will
// change and asks for a confirm (no window.confirm: embedded viewers block it), then replaces the saves and reloads.
// Older (v3) codes still import: the parts v4 dropped (coins, shop unlocks, track XP, quests) are stripped first.
// A browser without DecompressionStream (iPadOS 16.0–16.3) unpacks 'z' codes with the small inflater at the end.

const SAVE_CODE_V = 1, SAVE_KEY_PREFIX = 'stickclash';
const SAVE_NAMES = { settings: 'Settings', profile: 'Trophies & stats', prog: 'Codex, secrets & title', presets: 'Fighter presets', picks: 'Favourite weapons',
  binds: 'Keys', padmap: 'Gamepad buttons', ranked: 'Ranked', quest: 'Campaign', challenges: 'Challenges', menu: 'Menu choices', highlights: 'Highlights',
  bench: 'Performance test', duo: '2-player records', controls: 'Control schemes' };
const XFER = { code: '', preview: null, msg: '', input: '' };

const fnv1a = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h.toString(16).padStart(8, '0'); };
const toB64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function codecPipe(bytes, Stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate'))).arrayBuffer()); }

function saveKeysNow() {
  const out = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(SAVE_KEY_PREFIX)) out[k] = localStorage.getItem(k); } } catch (e) { /* no storage */ }
  return out;
}
async function makeSaveCode() {
  const json = JSON.stringify({ v: SAVE_CODE_V, t: Date.now(), k: saveKeysNow() }), raw = new TextEncoder().encode(json);
  const zip = typeof CompressionStream === 'function';
  return `SC${SAVE_CODE_V}${zip ? 'z' : 'p'}.${toB64u(zip ? await codecPipe(raw, CompressionStream) : raw)}.${fnv1a(json)}`;
}
// The kind of value each known save must hold (o = object, a = array, n = number, b = boolean, s = string), the
// numbers that must be finite and the maps that must be objects. A hand-edited code with the wrong shapes is refused.
const SAVE_SHAPES = { settings: 'o', profile: 'o', prog: 'o', presets: 'a', picks: 'o', binds: 'a', padmap: 'a', ranked: 'o', quest: 'o',
  challenges: 'o', menu: 'o', highlights: 'a', wins: 'o', muted: 'b', camera: 'b', weather: 's', tourneyBest: 'n', survivalBest: 'n',
  bossBest: 'n', zombieBest: 'n', bench: 'o', duo: 'o', controls: 'o' };
const SAVE_MAPS = { profile: ['stats', 'ach', 'flags'], prog: ['secrets', 'codex'], duo: ['pairs'] };
function saveShapeCheck(key, value) {
  const short = key.replace(/^stickclash\.(v\d+\.)?/, ''), want = SAVE_SHAPES[short];
  if (!want) return;
  const kind = Array.isArray(value) ? 'a' : value === null ? 'x' : typeof value === 'object' ? 'o' : typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : typeof value === 'string' ? 's' : 'x';
  const num = (o, ks) => ks.every(k => o[k] === undefined || (typeof o[k] === 'number' && Number.isFinite(o[k])));
  const maps = (o, ks) => ks.every(k => o[k] === undefined || (!!o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])));
  const ok = kind === want && maps(value, SAVE_MAPS[short] || []) && (short !== 'ranked' || num(value, ['pts', 'best', 'wins', 'losses', 'streak']));
  if (!ok) throw new Error(`The code holds a ${SAVE_NAMES[short] || short} save in the wrong shape, so it can’t be imported.`);
}
// Returns the decoded save object or throws an Error with a message for the player.
async function readSaveCode(text) {
  const m = String(text).replace(/\s+/g, '').match(/^SC(\d+)([zp])\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/);
  if (!m) throw new Error('That isn’t a Stick Clash code. Copy the whole code, from SC to the end.');
  if (+m[1] > SAVE_CODE_V) throw new Error('This code comes from a newer version of the game.');
  let json;
  try { const bytes = fromB64u(m[3]); json = new TextDecoder().decode(m[2] === 'z' ? await saveUnzip(bytes) : bytes); }
  catch (e) { throw new Error('The code is damaged or cut short.'); }
  if (fnv1a(json) !== m[4]) throw new Error('The code is damaged or cut short (checksum mismatch).');
  const data = JSON.parse(json), keys = data && data.k;
  if (!keys || typeof keys !== 'object') throw new Error('The code has no saves in it.');
  saveStripV3(keys);                                // a v3 code: coins, shop unlocks, track XP and quests are dropped (75)
  for (const [k, v] of Object.entries(keys)) {
    if (!k.startsWith(SAVE_KEY_PREFIX) || typeof v !== 'string') throw new Error('The code holds something that isn’t a save.');
    saveShapeCheck(k, JSON.parse(v));               // every save is JSON: a broken one throws (caught by the caller)
  }
  return data;
}

// What the import changes, key by key, plus headline numbers (trophies, matches, rank) before → after.
function savePreview(data) {
  const now = saveKeysNow(), next = data.k, rows = [];
  for (const k of new Set([...Object.keys(now), ...Object.keys(next)])) {
    const st = !(k in now) ? 'new' : !(k in next) ? 'removed' : now[k] === next[k] ? 'same' : 'changed';
    const short = k.replace(/^stickclash\.(v\d+\.)?/, '');
    if (st !== 'same') rows.push({ name: SAVE_NAMES[short] || short, st });
  }
  const num = (src, key, f) => { try { return f(JSON.parse(src[SAVE_KEY_PREFIX + '.v2.' + key])); } catch (e) { return '—'; } };
  const facts = [['Trophies', 'profile', p => Object.keys(p.ach || {}).filter(k => ACHIEVEMENTS[k]).length], ['Matches', 'profile', p => (p.stats || {}).matches || 0],
    ['Rank', 'ranked', r => typeof rankOf === 'function' ? rankOf(r.pts).label : r.pts]].map(([label, key, f]) => [label, num(now, key, f), num(next, key, f)]);
  return { rows, facts, when: data.t ? new Date(data.t).toLocaleString() : '?', data };
}

function applySaveCode(data) {
  try {
    for (const k of Object.keys(saveKeysNow())) if (!(k in data.k)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(data.k)) localStorage.setItem(k, v);
  } catch (e) { XFER.msg = 'Could not write the saves: ' + e.message; refreshScreen(); return; }
  profileDirty = progDirty = false;   // 75 and 79 save dirty stores on pagehide: that must not undo the import
  location.reload();
}

// Copies inside the click (clipboard needs the gesture); if that is refused, selects the text for Ctrl+C / long-press.
function copySaveCode(area) {
  const fallback = () => { area.focus(); area.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* blocked */ }
    XFER.msg = ok ? 'Copied.' : 'Selected: press Ctrl+C (or long-press → Copy).'; showXferMsg(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(area.value).then(() => { XFER.msg = 'Copied to the clipboard.'; showXferMsg(); }, fallback);
  else fallback();
}
const showXferMsg = () => { const m = document.querySelector('#transfer .xfer-msg'); if (m) m.textContent = XFER.msg; };

async function checkSaveCode(text) {
  XFER.input = text;
  try { XFER.preview = savePreview(await readSaveCode(text)); XFER.msg = ''; }
  catch (e) { XFER.preview = null; XFER.msg = e instanceof SyntaxError ? 'The code is damaged.' : e.message; }
  refreshScreen();
}

function xferPreviewCard(p) {
  const list = p.rows.length ? p.rows.map(r => el('li', { class: 'xfer-' + r.st }, el('b', { text: r.st }), ' ' + r.name)) : [el('li', { text: 'Nothing would change.' })];
  return el('section', { class: 'set-group xfer-preview' }, el('h3', { text: 'Check before importing' }),
    el('p', { class: 'hint', text: `Code made ${p.when}. Your current progress on this device will be replaced.` }),
    el('dl', { class: 'xfer-facts' }, p.facts.map(([k, a, b]) => [el('dt', { text: k }), el('dd', { text: `${a} → ${b}` })])),
    el('ul', { class: 'xfer-rows' }, list),
    el('div', { class: 'access-links' },
      uiButton('Cancel', () => { XFER.preview = null; refreshScreen(); }, null, { 'data-key': 'xfer-cancel' }),
      uiButton('Replace my progress', () => applySaveCode(p.data), 'danger', { 'data-key': 'xfer-confirm' })));
}

function transferScreen() {   // registered at boot by 93-pads
  const out = el('textarea', { class: 'xfer-code', readonly: true, rows: 4, 'aria-label': 'Your save code', 'data-key': 'xfer-out', text: XFER.code || 'Making your code…' });
  const inp = el('textarea', { class: 'xfer-code', rows: 4, placeholder: 'Paste a code here (starts with SC1)', 'aria-label': 'Code to import', 'data-key': 'xfer-in', text: XFER.input });
  if (!XFER.code) makeSaveCode().then(c => { XFER.code = c; out.value = c; }, e => { out.value = 'Could not make a code: ' + e.message; });
  const body = el('div', { class: 'set-grid two' },
    el('section', { class: 'set-group' }, el('h3', { text: 'Export' }),
      el('p', { class: 'hint', text: 'This code holds all your progress: trophies, stats, ranked, campaign, challenges, codex, presets, settings and controls.' }),
      out, el('div', { class: 'access-links' }, uiButton('Copy code', () => copySaveCode(out), null, { 'data-key': 'xfer-copy' }),
        uiButton('New code', () => { XFER.code = ''; refreshScreen(); }))),
    el('section', { class: 'set-group' }, el('h3', { text: 'Import' }),
      el('p', { class: 'hint', text: 'Paste a code from another device. You will see what changes before anything is replaced.' }),
      inp, uiButton('Check code', () => checkSaveCode(inp.value), null, { 'data-key': 'xfer-check' })),
    XFER.preview ? xferPreviewCard(XFER.preview) : null);
  return sheet('Transfer progress', el('div', {}, el('p', { class: 'xfer-msg', role: 'status', text: XFER.msg }), body),
    [el('button', { class: 'go', onclick: () => { XFER.preview = null; XFER.msg = ''; XFER.code = ''; XFER.input = ''; uiSfx('click'); goBack(); } }, 'Done')]);
}

// ---------- unpacking without DecompressionStream ----------
// CompressionStream('deflate') writes a zlib stream (RFC 1950: a 2-byte header, raw deflate, an Adler-32 trailer).
async function saveUnzip(bytes) {
  if (typeof DecompressionStream === 'function') return codecPipe(bytes, DecompressionStream);
  return inflateZlib(bytes);
}
function inflateZlib(bytes) {
  if (bytes.length < 6 || (bytes[0] & 15) !== 8 || (bytes[1] & 32) || ((bytes[0] << 8) | bytes[1]) % 31) throw new Error('not a zlib stream');
  return inflateRaw(bytes.subarray(2, bytes.length - 4));   // the trailer's checksum is not needed: the code carries its own
}

// A small RFC 1951 inflater (after zlib's "puff"): stored, fixed-Huffman and dynamic-Huffman blocks. Bits are read
// least-significant first; Huffman codes are decoded one bit at a time from canonical code-length counts.
// Lengths (3..258) and distances (1..32768) are a base plus extra bits; each base follows from the extra-bit counts.
const INF_LEN_EXTRA = Array.from({ length: 29 }, (_, i) => (i < 8 || i === 28 ? 0 : (i - 4) >> 2));
const INF_DIST_EXTRA = Array.from({ length: 30 }, (_, i) => (i < 4 ? 0 : (i - 2) >> 1));
const infBases = (extra, first) => extra.map((_, i) => extra.slice(0, i).reduce((b, e) => b + (1 << e), first));
const INF_LEN_BASE = infBases(INF_LEN_EXTRA, 3).map((b, i) => (i === 28 ? 258 : b));
const INF_DIST_BASE = infBases(INF_DIST_EXTRA, 1);
const INF_CODE_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
const INF_MAX_OUT = 16 << 20;   // saves are a few KB: a pasted "code" that unpacks past this is refused, not obeyed
let INF_FIXED = null;           // the fixed-Huffman tables, built on first use

function infFail(why) { throw new Error('inflate: ' + why); }
// The reader: input bytes, a bit buffer and the growing output.
const infState = src => ({ src, pos: 0, buf: 0, cnt: 0, out: new Uint8Array(Math.max(1024, src.length * 4)), len: 0 });
// The next n bits, least significant first.
function infBits(s, n) {
  while (s.cnt < n) {
    if (s.pos >= s.src.length) infFail('unexpected end');
    s.buf |= s.src[s.pos++] << s.cnt; s.cnt += 8;
  }
  const v = s.buf & ((1 << n) - 1);
  s.buf >>>= n; s.cnt -= n;
  return v;
}
function infPut(s, byte) {
  if (s.len === s.out.length) {
    if (s.len >= INF_MAX_OUT) infFail('too big');
    const grown = new Uint8Array(s.out.length * 2); grown.set(s.out); s.out = grown;
  }
  s.out[s.len++] = byte;
}

// A canonical Huffman code from its code lengths: how many codes of each length, and the symbols in code order.
function inflateTable(lengths) {
  const count = new Uint16Array(16), offs = new Uint16Array(16), symbol = new Uint16Array(lengths.length);
  for (const l of lengths) count[l]++;
  count[0] = 0;
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
  lengths.forEach((l, sym) => { if (l) symbol[offs[l]++] = sym; });
  return { count, symbol };
}
// One symbol: the codes of one length are consecutive numbers, so a bit at a time finds the length and the symbol.
function infDecode(s, h) {
  let code = 0, first = 0, index = 0;
  for (let len = 1; len < 16; len++) {
    code |= infBits(s, 1);
    const n = h.count[len];
    if (code - first < n) return h.symbol[index + code - first];
    index += n; first = (first + n) << 1; code <<= 1;
  }
  return infFail('bad code');
}

// A stored block: skip to the byte boundary, then a length, its complement and that many raw bytes.
function infStored(s) {
  s.buf = 0; s.cnt = 0;   // only the current byte's leftover bits are ever buffered here
  const src = s.src, p = s.pos;
  if (p + 4 > src.length) infFail('unexpected end');
  const len = src[p] | (src[p + 1] << 8), nlen = src[p + 2] | (src[p + 3] << 8);
  if (len !== (~nlen & 0xffff) || p + 4 + len > src.length) infFail('bad stored block');
  for (let i = 0; i < len; i++) infPut(s, src[p + 4 + i]);
  s.pos = p + 4 + len;
}
function infFixedTables() {
  if (!INF_FIXED) INF_FIXED = { lit: inflateTable(Array.from({ length: 288 }, (_, i) => (i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8))),
    dist: inflateTable(new Array(30).fill(5)) };
  return INF_FIXED;
}
// A dynamic block starts with its own codes: a code for the code lengths, then the run-length coded lengths.
function infDynamicTables(s) {
  const nlit = infBits(s, 5) + 257, ndist = infBits(s, 5) + 1, ncode = infBits(s, 4) + 4, order = new Array(19).fill(0);
  for (let i = 0; i < ncode; i++) order[INF_CODE_ORDER[i]] = infBits(s, 3);
  const lengthCode = inflateTable(order), lens = [];
  while (lens.length < nlit + ndist) {
    const sym = infDecode(s, lengthCode);
    if (sym < 16) { lens.push(sym); continue; }
    if (sym === 16 && !lens.length) infFail('repeat with no length');
    const [value, times] = sym === 16 ? [lens[lens.length - 1], 3 + infBits(s, 2)] : sym === 17 ? [0, 3 + infBits(s, 3)] : [0, 11 + infBits(s, 7)];
    for (let k = 0; k < times; k++) lens.push(value);
  }
  if (lens.length > nlit + ndist) infFail('too many lengths');
  return { lit: inflateTable(lens.slice(0, nlit)), dist: inflateTable(lens.slice(nlit)) };
}
// Literal bytes and (length, distance) copies of earlier output, until the end-of-block symbol.
function infCodes(s, { lit, dist }) {
  for (let sym = infDecode(s, lit); sym !== 256; sym = infDecode(s, lit)) {
    if (sym < 256) { infPut(s, sym); continue; }
    const li = sym - 257;
    if (li >= 29) infFail('bad length');
    const len = INF_LEN_BASE[li] + infBits(s, INF_LEN_EXTRA[li]), di = infDecode(s, dist);
    if (di >= 30) infFail('bad distance');
    const back = INF_DIST_BASE[di] + infBits(s, INF_DIST_EXTRA[di]);
    if (back > s.len) infFail('distance too far back');
    for (let k = 0; k < len; k++) infPut(s, s.out[s.len - back]);
  }
}
function inflateRaw(src) {
  const s = infState(src);
  let last = 0;
  do {
    last = infBits(s, 1);
    const type = infBits(s, 2);
    if (type === 0) infStored(s);
    else if (type === 3) infFail('bad block type');
    else infCodes(s, type === 1 ? infFixedTables() : infDynamicTables(s));
  } while (!last);
  return s.out.subarray(0, s.len);
}

on('boot', () => { if (window.SC) window.SC.savecode = { make: makeSaveCode, read: readSaveCode, unzip: saveUnzip, inflate: inflateZlib, inflateRaw }; });
