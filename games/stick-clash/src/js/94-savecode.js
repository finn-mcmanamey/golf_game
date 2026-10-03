// 94-savecode.js: Settings → Transfer progress. Every saved key (localStorage keys starting 'stickclash') becomes one
// copyable code: JSON { v, t, k: { key: raw } } → deflate (CompressionStream, when the browser has it) → base64url,
// written as SC<version><z|p>.<data>.<fnv-1a checksum of the JSON>. Importing checks the code, previews what will
// change and asks for a confirm (no window.confirm: embedded viewers block it), then replaces the saves and reloads.

const SAVE_CODE_V = 1, SAVE_KEY_PREFIX = 'stickclash';
const SAVE_NAMES = { settings: 'Settings', profile: 'Coins, unlocks & stats', prog: 'Progress track', tasks: 'Quests', presets: 'Fighter presets',
  binds: 'Keys', padmap: 'Gamepad buttons', ranked: 'Ranked', quest: 'Campaign', challenges: 'Challenges', menu: 'Menu choices', highlights: 'Highlights' };
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
// Returns the decoded save object or throws an Error with a message for the player.
async function readSaveCode(text) {
  const m = String(text).replace(/\s+/g, '').match(/^SC(\d+)([zp])\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/);
  if (!m) throw new Error('That isn’t a Stick Clash code. Copy the whole code, from SC to the end.');
  if (+m[1] > SAVE_CODE_V) throw new Error('This code comes from a newer version of the game.');
  if (m[2] === 'z' && typeof DecompressionStream !== 'function') throw new Error('This browser can’t unpack compressed codes. Try another browser.');
  let json;
  try { const bytes = fromB64u(m[3]); json = new TextDecoder().decode(m[2] === 'z' ? await codecPipe(bytes, DecompressionStream) : bytes); }
  catch (e) { throw new Error('The code is damaged or cut short.'); }
  if (fnv1a(json) !== m[4]) throw new Error('The code is damaged or cut short (checksum mismatch).');
  const data = JSON.parse(json), keys = data && data.k;
  if (!keys || typeof keys !== 'object') throw new Error('The code has no saves in it.');
  for (const [k, v] of Object.entries(keys)) {
    if (!k.startsWith(SAVE_KEY_PREFIX) || typeof v !== 'string') throw new Error('The code holds something that isn’t a save.');
    JSON.parse(v);                                  // every save is JSON: a broken one throws (caught by the caller)
  }
  return data;
}

// What the import changes, key by key, plus headline numbers (coins, level, rank) before → after.
function savePreview(data) {
  const now = saveKeysNow(), next = data.k, rows = [];
  for (const k of new Set([...Object.keys(now), ...Object.keys(next)])) {
    const st = !(k in now) ? 'new' : !(k in next) ? 'removed' : now[k] === next[k] ? 'same' : 'changed';
    const short = k.replace(/^stickclash\.(v\d+\.)?/, '');
    if (st !== 'same') rows.push({ name: SAVE_NAMES[short] || short, st });
  }
  const num = (src, key, f) => { try { return f(JSON.parse(src[SAVE_KEY_PREFIX + '.v2.' + key])); } catch (e) { return '—'; } };
  const facts = [['Coins', 'profile', p => p.coins], ['Track XP', 'prog', p => p.xp],
    ['Rank', 'ranked', r => typeof rankOf === 'function' ? rankOf(r.pts).label : r.pts]].map(([label, key, f]) => [label, num(now, key, f), num(next, key, f)]);
  return { rows, facts, when: data.t ? new Date(data.t).toLocaleString() : '?', data };
}

function applySaveCode(data) {
  try {
    for (const k of Object.keys(saveKeysNow())) if (!(k in data.k)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(data.k)) localStorage.setItem(k, v);
  } catch (e) { XFER.msg = 'Could not write the saves: ' + e.message; refreshScreen(); return; }
  profileDirty = false;               // 75-cosmetics saves a dirty profile on pagehide: it must not undo the import
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
      el('p', { class: 'hint', text: 'This code holds all your progress: coins, unlocks, track, quests, campaign, ranked, settings and controls.' }),
      out, el('div', { class: 'access-links' }, uiButton('Copy code', () => copySaveCode(out), null, { 'data-key': 'xfer-copy' }),
        uiButton('New code', () => { XFER.code = ''; refreshScreen(); }))),
    el('section', { class: 'set-group' }, el('h3', { text: 'Import' }),
      el('p', { class: 'hint', text: 'Paste a code from another device. You will see what changes before anything is replaced.' }),
      inp, uiButton('Check code', () => checkSaveCode(inp.value), null, { 'data-key': 'xfer-check' })),
    XFER.preview ? xferPreviewCard(XFER.preview) : null);
  return sheet('Transfer progress', el('div', {}, el('p', { class: 'xfer-msg', role: 'status', text: XFER.msg }), body),
    [el('button', { class: 'go', onclick: () => { XFER.preview = null; XFER.msg = ''; XFER.code = ''; XFER.input = ''; uiSfx('click'); goBack(); } }, 'Done')]);
}
