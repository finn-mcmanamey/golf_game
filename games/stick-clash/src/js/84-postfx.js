// 84-postfx.js: drawing-only visual effects on top of the renderer. Nothing here changes a fight.
// - Bloom (SETTINGS.bloom 'off' | 'low' | 'high'): each frame the 2D game canvas is copied into a WebGL texture,
//   bright parts are kept, blurred at a fraction of the resolution and drawn on an overlay canvas (#bloom) that the
//   browser blends onto the game with mix-blend-mode: screen. Without WebGL a 2D fallback adds a cheaper glow.
// - Dynamic lights (SETTINGS.lights): muzzle flashes, explosions, projectiles, fire, sabers, elements, ultimates and
//   lava cast additive glows on the scene.
// - Better impacts: hit-direction spark streaks, a bright impact flash, shockwave rings and a squash-and-stretch of
//   the body that was hit. Recorded for the kill-cam, so they replay in sync.
// - Juice level (SETTINGS.juice 'calm' | 'normal' | 'chaos') scales particles, shake, slow-mo and flashes;
//   SETTINGS.reduceFlash (accessibility, when present) tones flashes and bloom down further.
// The renderer calls postfxSquash(ctx, f) in drawFighter, postfxDrawWorld(ctx) after the world and postfxFrame(dt)
// once the arena is finished, before the HUD (so the HUD never glows).

const POSTFX_DEFAULTS = { bloom: 'low', lights: true, juice: 'normal' };
for (const k in POSTFX_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = POSTFX_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = POSTFX_DEFAULTS[k];
}

// ---------- juice level ----------
const JUICE_LEVELS = {
  calm: { part: .5, shake: .4, slow: .5, flash: .45, sparks: .6, chaos: false },
  normal: { part: 1, shake: 1, slow: 1, flash: 1, sparks: 1, chaos: false },
  chaos: { part: 1.6, shake: 1.5, slow: 1.35, flash: 1, sparks: 1.8, chaos: true },
};
const fxJuice = () => JUICE_LEVELS[SETTINGS.juice] || JUICE_LEVELS.normal;
// How strong flashes may be: the juice level, cut hard by the reduce-flashing accessibility flag.
const fxFlashMul = () => (SETTINGS.reduceFlash ? .3 : 1) * fxJuice().flash;

// Settings feed FX.partMul / FX.shakeMul in applySettings (75); the juice level multiplies on top of them.
const postfxBaseApply = applySettings;
applySettings = function () {
  postfxBaseApply();
  if (typeof FX === 'undefined') return;
  const j = fxJuice();
  FX.partMul *= j.part; FX.shakeMul *= j.shake;
};

// ---------- world-space effects (game-time based: they freeze in pause and slow down in slow-mo) ----------
const PFX = { lights: [], sparks: [], flashes: [], waves: [], squash: new Map(), sprites: new Map(), impactsThisFrame: 0 };
const POSTFX_GLOW = /saber|flame|frost|plasma|storm|wand|void|laser|cryo/;
const postfxAge = e => G_STATE.t - e.t0;

function postfxClear() { PFX.lights.length = PFX.sparks.length = PFX.flashes.length = PFX.waves.length = 0; PFX.squash.clear(); }
on('state', (now, before) => { if (now === 'killcam' || before === 'killcam') postfxClear(); });
on('roundStart', postfxClear);

// A timed light: muzzle flash, blast...
function postfxLight(x, y, r, color, life, a = 1) {
  if (G_STATE.sim || SETTINGS.lights === false) return;
  PFX.lights.push({ x, y, r, color, life, a, t0: G_STATE.t });
  if (PFX.lights.length > 40) PFX.lights.shift();
}

// A big hit: spark streaks along the hit direction, a flash, a shockwave ring and a squash of the body.
function postfxImpact(x, y, nx, ny, amt, color, id) {
  if (G_STATE.sim || ++PFX.impactsThisFrame > 10) return;
  if (FX_RECORD) FX_RECORD('impact', arguments);
  const j = fxJuice(), n = Math.round((3 + amt * .45) * j.sparks * (PARTICLE_MULS[SETTINGS.particles] || 1)), base = Math.atan2(ny, nx);
  for (let k = 0; k < n; k++) {
    const a = base + rnd(-.55, .55), v = rnd(500, 1300) * (.7 + Math.min(amt, 30) / 40), life = rnd(.1, .22);
    PFX.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, t0: G_STATE.t, c: k % 3 ? color : '#ffffff' });
  }
  if (PFX.sparks.length > 260) PFX.sparks.splice(0, PFX.sparks.length - 260);
  PFX.flashes.push({ x, y, r: (16 + amt * 2.2) * (j.chaos ? 1.3 : 1), color, life: j.chaos ? .14 : .1, t0: G_STATE.t, a: base });
  if (amt >= 14) PFX.waves.push({ x, y, r: 40 + amt * 3.2, color, life: .32, t0: G_STATE.t });
  if (id != null) PFX.squash.set(id, { t0: G_STATE.t, nx, ny, k: clamp(amt / 70, .06, .22) * (j.chaos ? 1.4 : 1) });
  postfxLight(x, y, 60 + amt * 4, color, .12, .9);
  if (j.chaos && amt >= 20 && typeof JUICE !== 'undefined') JUICE.chroma = Math.max(JUICE.chroma, .35 * fxFlashMul());
}

const postfxDirect = o => o && (o.kind === 'melee' || o.kind === 'proj' || o.kind === 'explode' || o.kind === 'skill');
on('damage', (B, amt, o) => {
  if (G_STATE.sim || !postfxDirect(o) || o.small || amt < 5) return;
  const c = chest(B), x = o.x ?? c.x, y = o.y ?? c.y;
  let nx = o.nx, ny = o.ny;
  if (nx == null || (!nx && !ny)) { const s = o.src ? chest(o.src) : { x: x - 1, y }; nx = c.x - s.x; ny = c.y - s.y; }
  const L = Math.hypot(nx, ny) || 1;
  postfxImpact(x, y, nx / L, ny / L, amt, hitColor(B), B.id);
});
on('fire', (f, p) => {
  if (!p || G_STATE.sim) return;
  postfxLight(p.x, p.y, 110, f.w.color || '#ffd890', .07, 1);
});
on('explode', (x, y, radius) => postfxLight(x, y, Math.max(140, radius * 2.4), '#ffb050', .45, 1.2));
on('ko', (v) => {
  if (G_STATE.sim || v.summon || !fxJuice().chaos || G_STATE.demo) return;
  const c = chest(v);   // chaos: confetti on every K.O.
  for (const col of ['#ffd84a', '#ff5ad1', '#2ee6ff', '#9dff5a']) burst(c.x, c.y, col, 10, 520, { life: 1.2, grav: 600 });
});

// ---------- squash and stretch (called by drawFighter inside its save/restore) ----------
const POSTFX_SQUASH_T = .2;
function postfxSquash(c2, f) {
  const s = PFX.squash.get(f.id);
  if (!s) return;
  const e = postfxAge(s);
  if (e < 0 || e > POSTFX_SQUASH_T) { if (e > POSTFX_SQUASH_T) PFX.squash.delete(f.id); return; }
  const p = e / POSTFX_SQUASH_T, a = s.k * Math.sin(p * TAU) * (1 - p);   // squash along the hit, then stretch back
  const c = chest(f), ang = Math.atan2(s.ny, s.nx);
  c2.translate(c.x, c.y); c2.rotate(ang); c2.scale(1 - a, 1 + a * .6); c2.rotate(-ang); c2.translate(-c.x, -c.y);
}

// ---------- drawing (world space, after the weather/darkness layer) ----------
function postfxDrawWorld(c2) {
  PFX.impactsThisFrame = 0;
  FX.flashA = Math.min(FX.flashA, .9 * fxFlashMul());       // calm / reduced flashing: cap full-screen flashes
  c2.save();
  c2.globalCompositeOperation = 'lighter';
  if (SETTINGS.lights !== false) postfxDrawLights(c2);
  postfxDrawWaves(c2);
  postfxDrawSparks(c2);
  postfxDrawFlashes(c2);
  c2.restore();
}

// A soft round light sprite per colour (white-hot centre fading out), drawn scaled.
function postfxSprite(color) {
  let s = PFX.sprites.get(color);
  if (s || typeof document === 'undefined') return s;
  s = document.createElement('canvas'); s.width = s.height = 64;
  const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(color, .9)); gr.addColorStop(.25, rgba(color, .45)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  if (PFX.sprites.size > 120) PFX.sprites.clear();
  PFX.sprites.set(color, s);
  return s;
}
function postfxGlow(c2, x, y, r, color, a) {
  const s = postfxSprite(color);
  if (!s || a <= .01) return;
  c2.globalAlpha = clamp(a, 0, 1);
  c2.drawImage(s, x - r, y - r, r * 2, r * 2);
}

function postfxDrawLights(c2) {
  const t = G_STATE.t, flick = k => .85 + .15 * Math.sin(t * 23 + k * 7.1) * Math.sin(t * 9 + k);
  for (const l of PFX.lights) { const e = postfxAge(l); if (e >= 0 && e < l.life) postfxGlow(c2, l.x, l.y, l.r * (1 + e / l.life * .3), l.color, l.a * .55 * (1 - e / l.life)); }
  fxCompactBy(PFX.lights, l => postfxAge(l) < l.life && postfxAge(l) > -1);
  let n = 0;
  for (const p of PROJ) {
    if (p.zone || !(p.r > 0) || !p.color || ++n > 30) continue;
    postfxGlow(c2, p.x, p.y, 34 + p.r * 7, p.color, .32);
  }
  for (const f of F) postfxFighterLights(c2, f, flick);
  for (const hz of MAP.hazards) {
    if (hz.kind !== 'lava' && hz.kind !== 'acid') continue;
    const col = hz.color || (hz.kind === 'lava' ? '#ff6a2a' : '#8dff4a');
    for (let x = hz.x + 60, k = 0; x < hz.x + hz.w; x += 150, k++) postfxGlow(c2, x, hz.y + 6, 150, col, .22 * flick(k));
  }
}

function postfxFighterLights(c2, f, flick) {
  if (!f.alive) return;
  const c = chest(f);
  if (f.status.burn) postfxGlow(c2, c.x, c.y, 120, '#ff8a2e', .35 * flick(f.id));
  if (f.ult && ULTIMATES[f.ult.key]) postfxGlow(c2, c.x, c.y, 190, ULTIMATES[f.ult.key].color || f.color, .35 * flick(f.id + 3));
  const glowW = POSTFX_GLOW.test(f.wkey) || f.element || f.lvl >= 3;
  if (!glowW) return;
  const tip = f.P[f.tip], hand = f.P[f.main.hand], col = f.element && ELEMENTS[f.element] ? ELEMENTS[f.element].color : f.w.color || f.color;
  postfxGlow(c2, (tip.x + hand.x) / 2, (tip.y + hand.y) / 2, 95, col, .3 * flick(f.id + 1));
}

function postfxDrawWaves(c2) {
  for (const w of PFX.waves) {
    const e = postfxAge(w), k = e / w.life;
    if (k < 0 || k > 1) continue;
    const r = w.r * (.2 + .8 * Math.sqrt(k));
    c2.globalAlpha = (1 - k) * .8;
    circle(c2, w.x, w.y, r, null, w.color, 6 * (1 - k) + 1);
    c2.globalAlpha = (1 - k) * .45;
    circle(c2, w.x, w.y, r * .82, null, '#ffffff', 2);
  }
  fxCompactBy(PFX.waves, w => postfxAge(w) < w.life && postfxAge(w) > -1);
}

function postfxDrawSparks(c2) {
  c2.lineCap = 'round';
  for (const s of PFX.sparks) {
    const e = postfxAge(s);
    if (e < 0 || e > s.life) continue;
    const slow = 1 - e / s.life * .6, x = s.x + s.vx * e * slow, y = s.y + s.vy * e * slow + 900 * e * e;
    c2.globalAlpha = 1 - e / s.life;
    lineXY(c2, x, y, x - s.vx * .025, y - s.vy * .025, s.c, 2.2);
  }
  fxCompactBy(PFX.sparks, s => postfxAge(s) < s.life && postfxAge(s) > -1);
}

function postfxDrawFlashes(c2) {
  for (const f of PFX.flashes) {
    const e = postfxAge(f), k = e / f.life;
    if (k < 0 || k > 1) continue;
    const r = f.r * (.6 + k * .6), a = (1 - k) * fxFlashMul();
    postfxGlow(c2, f.x, f.y, r * 1.6, f.color, a);
    postfxGlow(c2, f.x, f.y, r * .7, '#ffffff', a);
    c2.globalAlpha = a;
    for (let q = 0; q < 4; q++) {      // a four-point star, turned to the hit direction
      const ang = f.a + q * Math.PI / 2, L = r * (q % 2 ? .8 : 1.6);
      lineXY(c2, f.x, f.y, f.x + Math.cos(ang) * L, f.y + Math.sin(ang) * L, '#ffffff', 3 * (1 - k) + 1);
    }
  }
  fxCompactBy(PFX.flashes, f => postfxAge(f) < f.life && postfxAge(f) > -1);
}

// Keeps the entries that pass `keep`, in place.
function fxCompactBy(list, keep) {
  let n = 0;
  for (let i = 0; i < list.length; i++) if (keep(list[i])) list[n++] = list[i];
  list.length = n;
}

// ---------- bloom ----------
const BLOOM = { gl: null, cv: null, mode: 'none', failed: false, progs: null, src: null, fb: [], w: 0, h: 0,
  small: null, half: null, allowSoftware: false, ms: 0, dtAvg: 1 / 60, slowFrames: 0, tier: 0, frame: 0 };
const BLOOM_Q = { low: { ds: 4, thr: .6, k: .8, passes: 1 }, high: { ds: 3, thr: .55, k: 1.05, passes: 2 } };

const BLOOM_VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const BLOOM_FS = {
  bright: 'precision mediump float;uniform sampler2D t;uniform vec2 px;uniform float thr;varying vec2 uv;void main(){' +
    'vec3 c=(texture2D(t,uv+px*vec2(-1.,-1.)).rgb+texture2D(t,uv+px*vec2(1.,-1.)).rgb+texture2D(t,uv+px*vec2(-1.,1.)).rgb+texture2D(t,uv+px).rgb)*.25;' +
    'float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(thr,thr+.3,l),1.);}',
  blur: 'precision mediump float;uniform sampler2D t;uniform vec2 px;varying vec2 uv;void main(){' +
    'vec3 c=texture2D(t,uv).rgb*.227+(texture2D(t,uv+px*1.385).rgb+texture2D(t,uv-px*1.385).rgb)*.316' +
    '+(texture2D(t,uv+px*3.231).rgb+texture2D(t,uv-px*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}',
  out: 'precision mediump float;uniform sampler2D t;uniform float thr;varying vec2 uv;void main(){gl_FragColor=vec4(texture2D(t,uv).rgb*thr,1.);}',
};

// Wanted quality right now ('off' | 'low' | 'high'); the frame governor (bloomGovern) may step it down.
function bloomWanted() {
  const q = SETTINGS.bloom || 'off';
  if (q === 'off' || BLOOM.tier >= 3) return 'off';
  return q === 'high' && BLOOM.tier >= 1 ? 'low' : q;
}

function bloomInit() {
  if (BLOOM.gl || BLOOM.failed) return !!BLOOM.gl;
  try {
    const c = document.createElement('canvas');
    c.id = 'bloom'; c.setAttribute('aria-hidden', 'true');
    // failIfMajorPerformanceCaveat: software-rendered WebGL (no GPU) is slower than the 2D glow, so it gets that.
    const gl = c.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
      preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: !BLOOM.allowSoftware });
    if (!gl || (!BLOOM.allowSoftware && bloomSoftware(gl))) throw new Error('no hardware WebGL');
    BLOOM.progs = {};
    for (const k in BLOOM_FS) BLOOM.progs[k] = bloomProgram(gl, BLOOM_FS[k]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    BLOOM.src = bloomTexture(gl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    c.addEventListener('webglcontextlost', e => { e.preventDefault(); BLOOM.gl = null; BLOOM.failed = true; c.remove(); });
    cv.after(c);
    BLOOM.gl = gl; BLOOM.cv = c; BLOOM.mode = 'webgl';
    return true;
  } catch (e) {
    BLOOM.failed = true; BLOOM.mode = '2d';      // no WebGL: the 2D glow below takes over
    return false;
  }
}

// True for known software rasterisers (where the browser didn't already refuse the context).
function bloomSoftware(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return !!ext && /swiftshader|llvmpipe|software|basic render/i.test(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
}

function bloomProgram(gl, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, BLOOM_VS], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('bloom shader: ' + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('bloom link failed');
  return { p, t: gl.getUniformLocation(p, 't'), px: gl.getUniformLocation(p, 'px'), thr: gl.getUniformLocation(p, 'thr') };
}

function bloomTexture(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  return t;
}

// Two half/quarter-resolution render targets, rebuilt when the canvas size or quality changes.
function bloomTargets(gl, w, h) {
  if (BLOOM.w === w && BLOOM.h === h) return;
  for (const f of BLOOM.fb) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); }
  BLOOM.fb = [0, 1].map(() => {
    const tex = bloomTexture(gl), fb = gl.createFramebuffer();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { fb, tex };
  });
  BLOOM.w = w; BLOOM.h = h; BLOOM.cv.width = w; BLOOM.cv.height = h;
}

function bloomPass(gl, prog, srcTex, target, px, thr) {
  gl.useProgram(prog.p);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
  gl.viewport(0, 0, BLOOM.w, BLOOM.h);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.uniform1i(prog.t, 0);
  if (prog.px) gl.uniform2f(prog.px, px[0], px[1]);
  if (prog.thr) gl.uniform1f(prog.thr, thr);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Threshold + blur + output, all on the GPU. Returns false when WebGL isn't usable.
function bloomRenderGL(q) {
  if (!bloomInit()) return false;
  const gl = BLOOM.gl, P = BLOOM.progs, Q = BLOOM_Q[q];
  bloomTargets(gl, Math.max(1, Math.ceil(cv.width / Q.ds)), Math.max(1, Math.ceil(cv.height / Q.ds)));
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const half = bloomCopy(Q.ds);            // uploading a small copy is far cheaper than the full canvas
  gl.bindTexture(gl.TEXTURE_2D, BLOOM.src);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, half);
  const [A, B] = BLOOM.fb, tx = 1 / BLOOM.w, ty = 1 / BLOOM.h;
  bloomPass(gl, P.bright, BLOOM.src, A, [.5 / half.width, .5 / half.height], Q.thr);
  for (let k = 1; k <= Q.passes; k++) {
    bloomPass(gl, P.blur, A.tex, B, [tx * k, 0]);
    bloomPass(gl, P.blur, B.tex, A, [0, ty * k]);
  }
  bloomPass(gl, P.out, A.tex, null, null, Q.k * (SETTINGS.reduceFlash ? .6 : 1));
  return true;
}

// A 1/ds-size copy of the game canvas (still well above the ~128x128 size under which browsers keep a canvas on the
// CPU, which would force a slow read-back).
function bloomCopy(ds) {
  const h = BLOOM.half || (BLOOM.half = document.createElement('canvas'));
  const w = Math.max(1, Math.ceil(cv.width / ds)), hh = Math.max(1, Math.ceil(cv.height / ds));
  if (h.width !== w || h.height !== hh) { h.width = w; h.height = hh; }
  const g = h.getContext('2d');
  g.globalCompositeOperation = 'copy';
  g.drawImage(cv, 0, 0, w, hh);
  return h;
}

// The 2D fallback: a tiny copy of the frame, multiplied by itself (keeps only bright colours), screened back on top.
function bloomRender2D(q) {
  const k = BLOOM_Q[q].k * (SETTINGS.reduceFlash ? .6 : 1) * .55;
  const s = BLOOM.small || (BLOOM.small = document.createElement('canvas'));
  const sw = Math.max(1, Math.round(cv.width / 8)), sh = Math.max(1, Math.round(cv.height / 8));
  if (s.width !== sw || s.height !== sh) { s.width = sw; s.height = sh; }
  const g = s.getContext('2d');
  g.globalCompositeOperation = 'copy'; g.drawImage(cv, 0, 0, sw, sh);
  g.globalCompositeOperation = 'multiply'; g.drawImage(s, 0, 0); g.drawImage(s, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = k;
  ctx.drawImage(s, 0, 0, cv.width, cv.height);
  ctx.restore();
}

// Called by render() once the arena is drawn, before the HUD (so the HUD never glows).
function postfxFrame(dt) {
  if (typeof document === 'undefined') return;
  const t0 = performance.now(), q = bloomWanted();
  bloomGovern(dt, q);
  let shown = false;
  BLOOM.frame++;
  if (q !== 'off' && BLOOM.gl && BLOOM.tier >= 2 && BLOOM.frame % 2 && dt > 0) shown = true;   // half rate: keep the last glow
  else if (q !== 'off') {
    try { shown = bloomRenderGL(q); } catch (e) { report(e, 'bloom'); BLOOM.failed = true; BLOOM.gl = null; }
    if (!shown) { bloomRender2D(q); BLOOM.mode = '2d'; }
  }
  if (BLOOM.cv) BLOOM.cv.style.display = shown ? '' : 'none';
  BLOOM.ms += (performance.now() - t0 - BLOOM.ms) * .05;
}

// Keeps the frame rate up: while bloom is on and frames stay slow (< 50 fps) for ~3 s, step down for this session:
// High -> Low, then glow at half rate, then off. (Software-rendered WebGL, e.g. without a GPU, needs this.)
function bloomGovern(dt, q) {
  if (!(dt > 0) || G_STATE.state !== 'play' || q === 'off') { BLOOM.slowFrames = 0; return; }
  BLOOM.dtAvg += (dt - BLOOM.dtAvg) * .05;
  BLOOM.slowFrames = BLOOM.dtAvg > 1 / 50 ? BLOOM.slowFrames + 1 : 0;
  if (BLOOM.slowFrames < 180) return;
  BLOOM.tier = q === 'high' && BLOOM.tier < 1 ? 1 : BLOOM.tier + 1;
  BLOOM.slowFrames = 0; BLOOM.dtAvg = 1 / 60;
}

on('boot', () => {
  if (window.SC) window.SC.postfx = { bloom: BLOOM, pfx: PFX, juice: fxJuice, impact: postfxImpact };
});
