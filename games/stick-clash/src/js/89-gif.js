// 89-gif.js: a small animated GIF encoder for the highlight export where MediaRecorder is missing (iOS Safari inside
// some embedded viewers, older browsers). gifEncoder(w, h, fps) -> { addFrame(imageData), finish() -> Blob, frames }.
// Fixed 256-colour palette (a 6x6x6 colour cube plus 40 greys), 4x4 ordered dither, GIF89a with a NETSCAPE loop, one
// graphic control extension per frame and LZW (min code size 8, 12-bit codes) in 255-byte sub-blocks. Each frame is
// encoded as it is added, so finish() is instant. Drawing only: nothing here touches a fight.

const GIF_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];   // 4x4 ordered-dither thresholds
const GIF_HBITS = 13, GIF_HSIZE = 1 << GIF_HBITS, GIF_HMASK = GIF_HSIZE - 1;
const GIF_HKEYS = new Int32Array(GIF_HSIZE), GIF_HVALS = new Int16Array(GIF_HSIZE);   // (prefix, byte) -> code

function gifPalette() {
  const pal = new Uint8Array(768);
  for (let i = 0; i < 216; i++) { pal[i * 3] = Math.floor(i / 36) * 51; pal[i * 3 + 1] = Math.floor(i / 6) % 6 * 51; pal[i * 3 + 2] = i % 6 * 51; }
  for (let i = 0; i < 40; i++) { const v = Math.round(i * 255 / 39), o = (216 + i) * 3; pal[o] = pal[o + 1] = pal[o + 2] = v; }
  return pal;
}

// Nearest palette index per pixel with ordered dither; near-grey pixels take the finer grey ramp.
function gifQuantize(data, w, h, out) {
  for (let y = 0, i = 0, p = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++, p += 4) {
      const d = (GIF_BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16 - .5;   // -.47 .. +.47, a different offset per cell
      const r = data[p], g = data[p + 1], b = data[p + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) < 10) {
        out[i] = 216 + Math.max(0, Math.min(39, Math.round(((r + g + b) / 3 + d * 6.5) * 39 / 255)));
        continue;
      }
      const q = v => Math.max(0, Math.min(5, Math.round((v + d * 51) / 51)));
      out[i] = q(r) * 36 + q(g) * 6 + q(b);
    }
  }
}

// GIF-flavoured LZW (min code size 8): codes grow from 9 to 12 bits; a clear code resets the table when it fills.
function gifLzw(pixels) {
  const CLEAR = 256, EOI = 257, keys = GIF_HKEYS, vals = GIF_HVALS;
  const buf = new Uint8Array(Math.ceil(pixels.length * 1.6) + 64);
  let acc = 0, nbits = 0, n = 0;
  const put = (code, size) => {
    acc |= code << nbits; nbits += size;
    while (nbits >= 8) { buf[n++] = acc & 255; acc >>>= 8; nbits -= 8; }
  };
  let codeSize = 9, next = 258, prefix = pixels[0];
  put(CLEAR, 9);
  keys.fill(-1);
  for (let i = 1; i < pixels.length; i++) {
    const c = pixels[i], key = (prefix << 8) | c;
    let h = (Math.imul(key, 0x9E3779B1) >>> (32 - GIF_HBITS)) & GIF_HMASK;
    while (keys[h] !== -1 && keys[h] !== key) h = (h + 1) & GIF_HMASK;
    if (keys[h] === key) { prefix = vals[h]; continue; }
    put(prefix, codeSize);
    if (next >= (1 << codeSize) && codeSize < 12) codeSize++;   // the decoder widens at the same code
    if (next < 4096) { keys[h] = key; vals[h] = next++; }
    else { put(CLEAR, codeSize); keys.fill(-1); next = 258; codeSize = 9; }
    prefix = c;
  }
  put(prefix, codeSize);
  put(EOI, codeSize);
  if (nbits > 0) buf[n++] = acc & 255;
  return gifBlocks(buf, n);
}

// Splits the LZW bytes into 255-byte sub-blocks, each with its length in front, ending with a zero block.
function gifBlocks(buf, n) {
  const out = new Uint8Array(n + Math.ceil(n / 255) + 1);
  let o = 0;
  for (let i = 0; i < n; i += 255) {
    const k = Math.min(255, n - i);
    out[o++] = k; out.set(buf.subarray(i, i + k), o); o += k;
  }
  out[o++] = 0;
  return out.subarray(0, o);
}

const gifU16 = v => [v & 255, (v >> 8) & 255];
function gifHeader(w, h, pal) {
  // GIF89a, logical screen, global colour table flag + 8-bit colour + 256 entries (0xF7), background 0, no aspect.
  const head = Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...gifU16(w), ...gifU16(h), 0xF7, 0, 0);
  // NETSCAPE2.0 application extension: loop forever.
  const loop = Uint8Array.of(0x21, 0xFF, 11, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 3, 1, 0, 0, 0);
  return [head, pal, loop];
}
function gifFrame(w, h, idx, delay) {
  const gce = Uint8Array.of(0x21, 0xF9, 4, 0, ...gifU16(delay), 0, 0);                       // delay in 1/100 s
  const desc = Uint8Array.of(0x2C, 0, 0, 0, 0, ...gifU16(w), ...gifU16(h), 0, 8);             // image descriptor + LZW min code size
  return [gce, desc, gifLzw(idx)];
}

function gifEncoder(w, h, fps = 15) {
  const parts = gifHeader(w, h, gifPalette()), delay = Math.max(2, Math.round(100 / fps)), idx = new Uint8Array(w * h);
  let frames = 0;
  return {
    addFrame(img) { gifQuantize(img.data, w, h, idx); parts.push(...gifFrame(w, h, idx, delay)); frames++; },
    finish() { return new Blob([...parts, Uint8Array.of(0x3B)], { type: 'image/gif' }); },
    get frames() { return frames; },
  };
}
