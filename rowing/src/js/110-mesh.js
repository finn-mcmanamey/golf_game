/* ===== mesh builder: boxes and beams become triangles =====
   Vertices are interleaved: position (3), normal (3), colour (3). */

// Box corners are numbered by sign: bit 4 = +x side, bit 2 = +y side, bit 1 = +z side.
// Faces in order +x, −x, +y (top), −y (bottom), +z, −z, each listed counter-clockwise from outside.
const CORNERS = new Float64Array(24), UP_Y = [0, 1, 0], QUAD_ORDER = [0, 1, 2, 0, 2, 3];
const FACE_AXIS = [0, 0, 1, 1, 2, 2], FACE_SIGN = [1, -1, 1, -1, 1, -1];
const FACE_CORNERS = [4, 6, 7, 5,  1, 3, 2, 0,  2, 3, 7, 6,  1, 0, 4, 5,  1, 5, 7, 3,  4, 0, 2, 6];

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
    this.solid(c[0], c[1], c[2], ax[0], ax[1], ax[2], ay[0], ay[1], ay[2], az[0], az[1], az[2], col, skipBottom);
  }

  // An upright box from its centre and full sizes.
  box(x, y, z, sx, sy, sz, col) { this.solid(x, y, z, sx / 2, 0, 0, 0, sy / 2, 0, 0, 0, sz / 2, col) }

  // A box stretched between two points, w wide and h tall; `up` sets which way is "tall".
  beam(a, b, w, h, col, up = UP_Y) {
    let fx = b[0] - a[0], fy = b[1] - a[1], fz = b[2] - a[2];
    const len = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (len < 1e-5) return;
    fx /= len; fy /= len; fz /= len;
    // side = f × up (or f × x when f points straight up), then u = side × f
    let sx = fy * up[2] - fz * up[1], sy = fz * up[0] - fx * up[2], sz = fx * up[1] - fy * up[0];
    let sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (sl < 1e-4) { sx = 0; sy = fz; sz = -fy; sl = Math.sqrt(sy * sy + sz * sz) }
    sx /= sl; sy /= sl; sz /= sl;
    const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx, hl = len / 2, hh = h / 2, hw = w / 2;
    this.solid((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, fx * hl, fy * hl, fz * hl, ux * hh, uy * hh, uz * hh, sx * hw, sy * hw, sz * hw, col);
  }

  // The workhorse: writes a box's 36 vertices straight into the buffer with no temporary arrays,
  // since boats and crews are rebuilt every frame. `col` may carry a sixth-to-ninth value: a separate top colour.
  solid(cx, cy, cz, ax, ay, az, bx, by, bz, qx, qy, qz, col, skipBottom = false) {
    if ((this.n + 36) * 9 > this.data.length) {
      const bigger = new Float32Array(Math.max(this.data.length * 2, (this.n + 36) * 9));
      bigger.set(this.data);
      this.data = bigger;
    }
    const C = CORNERS;
    for (let k = 0; k < 8; k++) {
      const sx = k & 4 ? 1 : -1, sy = k & 2 ? 1 : -1, sz = k & 1 ? 1 : -1;
      C[k * 3] = cx + ax * sx + bx * sy + qx * sz;
      C[k * 3 + 1] = cy + ay * sx + by * sy + qy * sz;
      C[k * 3 + 2] = cz + az * sx + bz * sy + qz * sz;
    }
    const la = Math.sqrt(ax * ax + ay * ay + az * az) || 1, lb = Math.sqrt(bx * bx + by * by + bz * bz) || 1, lq = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1;
    const N = [ax / la, ay / la, az / la, bx / lb, by / lb, bz / lb, qx / lq, qy / lq, qz / lq];
    const top = col.length === 6 ? 3 : 0, d = this.data;
    for (let f = 0; f < 6; f++) {
      if (skipBottom && f === 3) continue;
      const axis = FACE_AXIS[f], sign = FACE_SIGN[f], ci = f === 2 ? top : 0;
      const nx = N[axis * 3] * sign, ny = N[axis * 3 + 1] * sign, nz = N[axis * 3 + 2] * sign;
      for (let v = 0; v < 6; v++) {
        const k = FACE_CORNERS[f * 4 + QUAD_ORDER[v]] * 3, i = this.n++ * 9;
        d[i] = C[k]; d[i + 1] = C[k + 1]; d[i + 2] = C[k + 2];
        d[i + 3] = nx; d[i + 4] = ny; d[i + 5] = nz;
        d[i + 6] = col[ci]; d[i + 7] = col[ci + 1]; d[i + 8] = col[ci + 2];
      }
    }
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

  chunkAt(x) {
    const key = Math.floor(x / CHUNK);
    let m = this.chunks.get(key);
    if (!m) this.chunks.set(key, m = new MeshBuilder(8192));
    return m;
  }

  quad(a, b, c, d, nrm, col) { this.chunkAt(a[0]).quad(a, b, c, d, nrm, col) }

  // Whole boxes go to the slice holding their centre.
  solid(cx, ...rest) { this.chunkAt(cx).solid(cx, ...rest) }

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
