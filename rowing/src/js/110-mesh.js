/* ===== mesh builder: boxes and beams become triangles =====
   Vertices are interleaved: position (3), normal (3), colour (3). */

class MeshBuilder {
  constructor(capacity = 4096) { this.data = new Float32Array(capacity * 9); this.n = 0 }

  reset() { this.n = 0 }

  vertex(p, nrm, c) {
    if ((this.n + 1) * 9 > this.data.length) {
      const bigger = new Float32Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    const d = this.data, i = this.n++ * 9;
    d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2];
    d[i + 3] = nrm[0]; d[i + 4] = nrm[1]; d[i + 5] = nrm[2];
    d[i + 6] = c[0]; d[i + 7] = c[1]; d[i + 8] = c[2];
  }

  // A flat four-sided face, corners in counter-clockwise order seen from the front.
  quad(a, b, c, d, nrm, col) {
    this.vertex(a, nrm, col); this.vertex(b, nrm, col); this.vertex(c, nrm, col);
    this.vertex(a, nrm, col); this.vertex(c, nrm, col); this.vertex(d, nrm, col);
  }

  // A box centred on c with half-extent vectors ax, ay, az (they need not line up with the world axes).
  cuboid(c, ax, ay, az, col, skipBottom = false) {
    const P = (sx, sy, sz) => [c[0] + ax[0] * sx + ay[0] * sy + az[0] * sz, c[1] + ax[1] * sx + ay[1] * sy + az[1] * sz, c[2] + ax[2] * sx + ay[2] * sy + az[2] * sz];
    const nx = norm3(ax), ny = norm3(ay), nz = norm3(az), neg = v => [-v[0], -v[1], -v[2]];
    const top = col.length === 6 ? [col[3], col[4], col[5]] : col;
    this.quad(P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1), nx, col);
    this.quad(P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), P(-1, -1, -1), neg(nx), col);
    this.quad(P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), ny, top);
    if (!skipBottom) this.quad(P(-1, -1, 1), P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), neg(ny), col);
    this.quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), nz, col);
    this.quad(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), neg(nz), col);
  }

  // An upright box from its centre and full sizes.
  box(x, y, z, sx, sy, sz, col) { this.cuboid([x, y, z], [sx / 2, 0, 0], [0, sy / 2, 0], [0, 0, sz / 2], col) }

  // A box stretched between two points, w wide and h tall; `up` sets which way is "tall".
  beam(a, b, w, h, col, up = [0, 1, 0]) {
    const d = sub3(b, a), len = Math.hypot(d[0], d[1], d[2]);
    if (len < 1e-5) return;
    const f = scale3(d, 1 / len);
    let side = cross3(f, up);
    if (Math.hypot(side[0], side[1], side[2]) < 1e-4) side = cross3(f, [1, 0, 0]);
    side = norm3(side);
    const u = cross3(side, f);
    this.cuboid(scale3(add3(a, b), 0.5), scale3(f, len / 2), scale3(u, h / 2), scale3(side, w / 2), col);
  }

  upload(buffer, usage) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * 9), usage);
    return this.n;
  }
}

// Scenery split into slices along the course, so only the slices near the camera are drawn.
// Each face goes to the slice holding its first corner.
const CHUNK = 150;
class ChunkedMesh extends MeshBuilder {
  constructor() { super(16); this.chunks = new Map() }

  quad(a, b, c, d, nrm, col) {
    const key = Math.floor(a[0] / CHUNK);
    let m = this.chunks.get(key);
    if (!m) this.chunks.set(key, m = new MeshBuilder(8192));
    m.quad(a, b, c, d, nrm, col);
  }

  // One buffer for all slices, with each slice's range so it can be drawn on its own.
  upload(buffer, usage) {
    const keys = [...this.chunks.keys()].sort((a, b) => a - b);
    const total = keys.reduce((n, k) => n + this.chunks.get(k).n, 0), all = new Float32Array(total * 9);
    const ranges = [];
    let at = 0;
    for (const k of keys) {
      const m = this.chunks.get(k);
      all.set(m.data.subarray(0, m.n * 9), at * 9);
      ranges.push({ x0: k * CHUNK, x1: (k + 1) * CHUNK, first: at, count: m.n });
      at += m.n;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, all, usage);
    return ranges;
  }
}

function bindLitAttribs(buffer) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const a = LIT.a;
  gl.enableVertexAttribArray(a.aP); gl.vertexAttribPointer(a.aP, 3, gl.FLOAT, false, 36, 0);
  gl.enableVertexAttribArray(a.aN); gl.vertexAttribPointer(a.aN, 3, gl.FLOAT, false, 36, 12);
  gl.enableVertexAttribArray(a.aC); gl.vertexAttribPointer(a.aC, 3, gl.FLOAT, false, 36, 24);
}

const hex = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
