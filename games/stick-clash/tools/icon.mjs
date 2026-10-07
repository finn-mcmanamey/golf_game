// tools/icon.mjs: the Stick Clash icon drawn in code (two crossed sticks on a dark square), shared by the app icons
// (mobile/scripts/make-icons.mjs) and the page: build.mjs inlines iconTags() (an apple-touch-icon PNG for "Add to
// Home Screen" and an SVG favicon) at the <!--ICONS--> marker, so the game stays one offline file with no art files.
import { deflateSync } from 'node:zlib';

const BG = [16, 18, 26];
const STICK_A = [255, 92, 72];  // warm red, drawn on top
const STICK_B = [72, 170, 255]; // cool blue
const HALF = 0.055;             // half the stick width, in unit coordinates
const SEG_A = [0.24, 0.24, 0.76, 0.76], SEG_B = [0.76, 0.24, 0.24, 0.76];

// CRC32 table for PNG chunks.
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** Encodes RGB (alpha=false) or RGBA pixels from pixel(x, y) -> [r,g,b,a]. */
function png(size, pixel, alpha) {
  const bpp = alpha ? 4 : 3;
  const raw = Buffer.alloc(size * (size * bpp + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * bpp + 1);
    for (let x = 0; x < size; x++) {
      const p = pixel(x + 0.5, y + 0.5);
      for (let i = 0; i < bpp; i++) raw[row + 1 + x * bpp + i] = p[i];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Distance from point to segment, all in unit coordinates.
function segDist(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Returns coverage of two crossed sticks at unit coords (u, v), plus their colours. */
function sticks(u, v, aa) {
  const a = Math.min(1, Math.max(0, (HALF - segDist(u, v, SEG_A)) / aa + 0.5));
  const b = Math.min(1, Math.max(0, (HALF - segDist(u, v, SEG_B)) / aa + 0.5));
  return { a, b };
}

/** The icon as a PNG Buffer: opaque on the dark background, or (alpha) just the sticks on transparency. */
export function iconPng(size, alpha) {
  const aa = 1.5 / size;
  return png(size, (x, y) => {
    const { a, b } = sticks(x / size, y / size, aa);
    if (alpha) {
      // Transparent splash image: just the sticks, red over blue.
      return [...mix(STICK_B, STICK_A, a), Math.round(Math.max(a, b) * 255)];
    }
    return mix(mix(BG, STICK_B, b), STICK_A, a);
  }, alpha);
}

const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
const seg = ([ax, ay, bx, by]) => `M${ax * 100} ${ay * 100}L${bx * 100} ${by * 100}`;

/** The same crossed sticks as a small SVG (the favicon). */
export function iconSvg() {
  const w = HALF * 2 * 100;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='18' fill='${hex(BG)}'/>` +
    `<path d='${seg(SEG_B)}' stroke='${hex(STICK_B)}' stroke-width='${w}' stroke-linecap='round'/>` +
    `<path d='${seg(SEG_A)}' stroke='${hex(STICK_A)}' stroke-width='${w}' stroke-linecap='round'/></svg>`;
}

/** <link> tags for the page head: a 180 px apple-touch-icon (opaque, as iOS wants) and the SVG favicon, both inline. */
export function iconTags() {
  const svg = iconSvg().replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E');
  return `<link rel="apple-touch-icon" href="data:image/png;base64,${iconPng(180, false).toString('base64')}">\n` +
    `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${svg}">`;
}
