/* ===== race codes: a whole race in a short string =====
   A code holds the race settings and the player's inputs, run-length packed. Anyone can re-row it and get the
   same time, which is what makes ghosts and shared results trustworthy. */

const CLASS_KEYS = Object.keys(BOAT_CLASSES), DIFF_KEYS = Object.keys(DIFFICULTY), KIND_KEYS = ['regatta', 'head', 'erg', 'knockout'];
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function packVarints(nums) {
  const bytes = [];
  for (let n of nums) { while (n >= 128) { bytes.push((n & 127) | 128); n >>>= 7 } bytes.push(n) }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const v = bytes[i] << 16 | (bytes[i + 1] ?? 0) << 8 | (bytes[i + 2] ?? 0);
    out += B64[v >> 18 & 63] + B64[v >> 12 & 63] + (i + 1 < bytes.length ? B64[v >> 6 & 63] : '') + (i + 2 < bytes.length ? B64[v & 63] : '');
  }
  return out;
}

function unpackVarints(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i += 4) {
    const c = [0, 1, 2, 3].map(k => B64.indexOf(str[i + k] ?? 'A'));
    if (c.some(x => x < 0)) throw new Error('bad code');
    const v = c[0] << 18 | c[1] << 12 | c[2] << 6 | c[3];
    bytes.push(v >> 16 & 255);
    if (i + 2 < str.length) bytes.push(v >> 8 & 255);
    if (i + 3 < str.length) bytes.push(v & 255);
  }
  const nums = [];
  for (let i = 0, n = 0, s = 0; i < bytes.length; i++) {
    n |= (bytes[i] & 127) << s; s += 7;
    if (!(bytes[i] & 128)) { nums.push(n >>> 0); n = 0; s = 0 }
  }
  return nums;
}

function encodeRace(opts, inputs) {
  const runs = [];
  for (let i = 0; i < inputs.length;) {
    let j = i; while (j < inputs.length && inputs[j] === inputs[i]) j++;
    runs.push(inputs[i], j - i); i = j;
  }
  // Version 2 adds the kind of race; regatta races keep writing version 1 so older builds can read them.
  const kind = KIND_KEYS.indexOf(opts.kind || 'regatta');
  const head = kind ? [2, opts.seed, opts.distance, CLASS_KEYS.indexOf(opts.cls), DIFF_KEYS.indexOf(opts.difficulty), opts.lane, kind]
    : [1, opts.seed, opts.distance, CLASS_KEYS.indexOf(opts.cls), DIFF_KEYS.indexOf(opts.difficulty), opts.lane];
  return 'VR' + packVarints(head.concat(runs));
}

function decodeRace(code) {
  code = String(code).trim().replace(/^.*[#?]r=/, '');
  if (!code.startsWith('VR')) throw new Error('not a regatta code');
  const n = unpackVarints(code.slice(2));
  if (n[0] !== 1 && n[0] !== 2) throw new Error('code from a newer version');
  const opts = { seed: n[1], distance: n[2], cls: CLASS_KEYS[n[3]], difficulty: DIFF_KEYS[n[4]], lane: n[5], kind: n[0] === 2 ? KIND_KEYS[n[6]] : 'regatta' };
  if (!opts.cls || !opts.difficulty || !opts.kind) throw new Error('bad code');
  const inputs = [];
  for (let i = n[0] === 2 ? 7 : 6; i + 1 < n.length; i += 2) for (let k = 0; k < n[i + 1]; k++) inputs.push(n[i]);
  return { opts, inputs };
}
