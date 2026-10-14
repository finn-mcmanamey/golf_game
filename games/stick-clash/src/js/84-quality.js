// 84-quality.js: performance tiers. A short benchmark (SC.perf.run) plays a busy 8-fighter demo behind the title
// screen with bloom off, low and high and measures frames and render time; the result picks a quality tier (bloom,
// particles, lights) while SETTINGS.quality is 'auto'. Settings → Performance shows a live fps/ms readout, the last
// result, a "Run benchmark" button and an FPS counter toggle. Measuring and drawing only: nothing here changes a fight.
// It runs by itself only a second after a real tap or key, with the page in front, on the title screen's demo: Safari
// caps requestAnimationFrame at 30 fps in a cross-origin iframe until the first tap (and in Low Power Mode), which used
// to lock iPads into Low. A capped clock is detected from the frame intervals (perfCapFps) and the tier is then judged
// by render time alone; a Low measured under a cap is measured once more on a later launch.

const QUALITY_DEFAULTS = { quality: 'auto', fpsCounter: false };
for (const k in QUALITY_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = QUALITY_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = QUALITY_DEFAULTS[k];
}
SETTING_CHOICES.quality = ['auto', 'high', 'medium', 'low', 'custom'];

const PERF_TIERS = {
  high: { bloom: 'high', particles: 'high', lights: true },
  medium: { bloom: 'low', particles: 'medium', lights: true },
  low: { bloom: 'off', particles: 'low', lights: false },
};
const PERF_MIN_FRAMES = 20;   // a phase with fewer frames (hidden tab, stalled loop) proves nothing
const PERF_AUTO_DELAY = 1000;  // ms between a real gesture and an automatic run (the 30 fps iframe cap lifts on the tap)
// last: the saved result { tier, fps, ms, fpsLow, msLow, capped, capFps, again, when, ua, ver }; samples: recent render
// times (ms) for the live readout; gestureAt: the latest real tap or key; autoDone: the session's automatic run happened.
const PERF = { on: false, samples: [], last: store.getObj('bench'), applying: false, job: null, fps: 0, ms: 0, win: { t0: 0, n: 0 },
  gestureAt: 0, autoTimer: 0, autoDone: false, remeasure: false };

// Called by the render wrap after every frame: a rolling half-second window feeds the readout and the FPS counter.
// dt is the frame loop's step (s), the gap between requestAnimationFrame timestamps: the display's own clock, which
// shows a frame cap without the jitter of render times.
function perfSample(ms, dt) {
  const w = PERF.win, now = performance.now(), gap = dt > 0 ? dt * 1000 : 0;
  PERF.samples.push(ms);
  if (PERF.samples.length > 90) PERF.samples.shift();
  w.n++;
  if (!w.t0) w.t0 = now;
  else if (now - w.t0 >= 500) { PERF.fps = Math.round(w.n * 1000 / (now - w.t0)); PERF.ms = perfMedian(PERF.samples); w.t0 = now; w.n = 0; }
  if (PERF.job) { try { perfJobFrame(ms, gap); } catch (e) { report(e, 'benchmark'); perfFinish(true); } }
}
function perfMedian(list) {
  if (!list.length) return 0;
  const s = list.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
}

// A small fps / render-time label in the bottom-left corner (SETTINGS.fpsCounter).
function perfDrawFps(c2) {
  const s = VIEW.dpr, txt = `${PERF.fps} fps · ${PERF.ms.toFixed(1)} ms`;
  c2.save();
  c2.setTransform(1, 0, 0, 1, 0, 0);
  c2.font = `${Math.round(12 * s)}px ${FONT_BODY}`; c2.textAlign = 'left'; c2.textBaseline = 'bottom';
  const w = c2.measureText(txt).width + 12 * s, x = 10 * s, y = cv.height - 10 * s;
  c2.fillStyle = 'rgba(5,6,12,.72)'; c2.fillRect(x - 6 * s, y - 16 * s, w, 19 * s);
  c2.fillStyle = PERF.fps >= 55 ? '#9dff5a' : PERF.fps >= 30 ? '#ffd84a' : '#ff4a6a';
  c2.fillText(txt, x, y);
  c2.restore();
}

// ---------- the benchmark ----------
// Resolves with { tier, stats: { off|low|high: { fps, ms, cap } }, inconclusive, capped, capFps }; null when it cannot run
// now (only behind the title menu, while the attract demo plays). Phases end after seconds/3 and at least PERF_MIN_FRAMES
// frames each. Explicit calls (the Settings button, tests) run anywhere the demo plays, also under test automation.
function perfRun(seconds = 2) {
  if (PERF.job) return PERF.job.promise;
  if (G_STATE.state !== 'menu' || !G_STATE.demo) return Promise.resolve(null);
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  const job = { promise, resolve, seconds: clamp(+seconds || 2, .3, 10), phase: -1, phases: ['off', 'low', 'high'], res: {},
    t0: performance.now(), keep: { bloom: SETTINGS.bloom, tier: BLOOM.tier }, hidden: false, modal: null, watchdog: 0,
    again: PERF.remeasure };   // again: this run re-measures a Low that was taken under a frame cap (never twice)
  PERF.remeasure = false;
  PERF.job = job; PERF.on = true;
  BLOOM.tier = 0;   // measure the real cost of each level, not what the governor left behind
  job.modal = fxModalActions('Measuring performance…', [],
    el('p', { class: 'hint', text: 'A busy brawl runs for a moment to pick the effects level for this device. Change it any time in Settings → Performance.' }));
  startMatch({ mode: 'ffa', fighters: 8, demo: true, map: 'caldera', diff: 'hard' });
  job.watchdog = setTimeout(() => perfFinish(true), (job.seconds * 3 + 8) * 1000);
  return promise;
}

// One frame of the benchmark: keep the scene busy, then count frames, render times and frame gaps per bloom phase.
function perfJobFrame(ms, gap) {
  const job = PERF.job, now = performance.now();
  if (G_STATE.state !== 'menu' || !G_STATE.demo) return perfFinish(true, true);   // the player started something: stop quietly
  if (document.hidden) job.hidden = true;
  for (let k = 0; k < 3; k++) burst(rnd(120, W - 120), rnd(100, H - 160), pick(DEFAULT_COLORS), 14, 480, { life: .7 });
  for (let k = 0; k < 2; k++) postfxImpact(rnd(120, W - 120), rnd(100, H - 160), rnd(-1, 1), rnd(-1, 1), 22, pick(DEFAULT_COLORS), null);
  if (job.phase < 0) { if (now - job.t0 >= 400) perfPhase(job, 0); return; }   // warm-up: shaders, caches, fonts
  const ph = job.res[job.phases[job.phase]];
  ph.frames++; ph.ms.push(ms);
  if (gap > 0) ph.gaps.push(gap);
  if (now - ph.t0 < job.seconds / 3 * 1000 || ph.frames < PERF_MIN_FRAMES) return;
  ph.wall = now - ph.t0;
  if (job.phase < 2) perfPhase(job, job.phase + 1); else perfFinish(false);
}
function perfPhase(job, i) {
  job.phase = i;
  SETTINGS.bloom = job.phases[i];
  job.res[job.phases[i]] = { t0: performance.now(), frames: 0, ms: [], gaps: [], wall: 0 };
}

// A capped clock shows as frame gaps pinned to one interval: at least 90% within 2 ms of 1/30 s (Safari in a
// cross-origin iframe before the first tap, Low Power Mode), or of 1/60 s while a frame renders in a few ms (the clock,
// not the drawing, sets the pace). A render that itself takes most of 1/30 s explains its 33 ms gaps: not a cap.
// Returns the capped rate (30 or 60), or 0 when the frames came as fast as they were drawn.
const PERF_CAP_TOL = 2, PERF_CAP_SHARE = .9, PERF_CAP_TINY_MS = 4, PERF_CAP_BUSY_MS = 20;
function perfCapFps(gaps, ms) {
  if (!gaps || gaps.length < PERF_MIN_FRAMES) return 0;
  const share = target => gaps.filter(g => Math.abs(g - target) <= PERF_CAP_TOL).length / gaps.length;
  if (ms < PERF_CAP_BUSY_MS && share(1000 / 30) >= PERF_CAP_SHARE) return 30;
  if (ms <= PERF_CAP_TINY_MS && share(1000 / 60) >= PERF_CAP_SHARE) return 60;
  return 0;
}

// capped: the frame rate was limited by the clock, so only the render time says what the device can do.
function perfTier(s, capped) {
  if (capped) return s.high.ms <= 9 ? 'high' : s.low.ms <= 11 ? 'medium' : 'low';
  if (s.high.fps >= 55 && s.high.ms <= 9) return 'high';
  if (s.low.fps >= 50 && s.low.ms <= 11) return 'medium';
  return 'low';
}

function perfFinish(aborted, quiet) {
  const job = PERF.job;
  if (!job) return;
  PERF.job = null; PERF.on = false;
  clearTimeout(job.watchdog);
  SETTINGS.bloom = job.keep.bloom; BLOOM.tier = job.keep.tier;
  const stats = {};
  let ok = !aborted && !job.hidden, capFps = 0;
  for (const q of job.phases) {
    const r = job.res[q];
    if (!r || !r.wall || r.frames < PERF_MIN_FRAMES) { ok = false; continue; }
    const ms = +perfMedian(r.ms).toFixed(2), cap = perfCapFps(r.gaps, ms);
    stats[q] = { fps: Math.round(r.frames * 1000 / r.wall), ms, cap };
    capFps = capFps || cap;
  }
  const capped = capFps > 0, tier = ok ? perfTier(stats, capped) : null, when = Date.now();
  if (ok) {
    PERF.last = { tier, fps: stats.high.fps, ms: stats.high.ms, fpsLow: stats.low.fps, msLow: stats.low.ms, capped, capFps, again: !!job.again,
      when, ua: navigator.userAgent, ver: VERSION };
    store.set('bench', PERF.last);
    if (SETTINGS.quality === 'auto') perfApplyTier(tier);
  }
  if (job.modal) fxModalClose(job.modal);
  if (!quiet) { startMatch(demoConfig()); refreshScreen(); }
  job.resolve({ tier, stats, inconclusive: !ok, when, capped, capFps });
}

// ---------- running by itself ----------
// Which stored result needs measuring (again): none yet, another browser or game version ('stale'), or a Low taken
// under a frame cap ('capped': measured once more on a later launch, never in a loop). '' = the result stands.
function perfStale() {
  const L = PERF.last;
  if (!L.tier || L.ua !== navigator.userAgent || L.ver !== VERSION) return 'stale';
  if (L.tier === 'low' && L.capped && !L.again) return 'capped';
  return '';
}
// Why the benchmark may not start by itself right now ('' = it may): only once a session, only while the result is
// stale, only PERF_AUTO_DELAY after a real tap or key with the page in front and the title demo playing, and never
// under test automation (SC.perf.run still works there when called).
function perfAutoBlock(now = performance.now()) {
  if (PERF.job) return 'running';
  if (PERF.autoDone) return 'done this session';
  if (!perfStale()) return 'result is fresh';
  if (SETTINGS.quality !== 'auto') return 'quality set by hand';
  if (!PERF.gestureAt) return 'no gesture yet';
  if (now - PERF.gestureAt < PERF_AUTO_DELAY) return 'too soon after the gesture';
  if (document.visibilityState !== 'visible' || !document.hasFocus()) return 'page not in front';
  if (G_STATE.state !== 'menu' || !G_STATE.demo) return 'not in the menu demo';
  if (typeof UI !== 'undefined' && UI.screen !== 'menu') return 'not on the title screen';
  if (navigator.webdriver) return 'test automation';
  return '';
}
const perfCanAutoRun = now => !perfAutoBlock(now);
// Every real gesture (80-audio: pointerup, touchend, click, keydown) re-arms the one-second timer.
function perfGesture() {
  PERF.gestureAt = performance.now();
  clearTimeout(PERF.autoTimer);
  PERF.autoTimer = setTimeout(perfAutoTry, PERF_AUTO_DELAY + 50);
}
function perfAutoTry() {
  PERF.autoTimer = 0;
  if (perfAutoBlock()) return;
  PERF.autoDone = true;
  PERF.remeasure = perfStale() === 'capped';
  perfRun(2);
}
on('gesture', perfGesture);

// Sets bloom, particles and lights for a tier without flipping the quality setting to Custom (the setSetting wrap).
function perfApplyTier(tier) {
  const t = PERF_TIERS[tier];
  if (!t) return;
  PERF.applying = true;
  try { Object.assign(SETTINGS, t); saveSettings(); } finally { PERF.applying = false; }
}

// ---------- Settings → Performance ----------
const perfNowText = () => `Now: ${PERF.fps} fps · ${PERF.ms.toFixed(1)} ms`;
function perfLastText() {
  const L = PERF.last;
  if (!L.tier) return 'No benchmark yet.';
  const when = L.when ? ' · ' + new Date(L.when).toLocaleDateString() : '';
  const cap = L.capped ? ` · measured while the display was limited to ${L.capFps || 30} fps` : '';
  return `Last result: ${capital(L.tier)} (${L.fps} fps · ${L.ms} ms with bloom High, ${L.fpsLow ?? '?'} fps with Low)${cap}${when}`;
}
function perfSettingsGroup() {
  const S = SETTINGS, canRun = G_STATE.state === 'menu' && G_STATE.demo && !PERF.job;
  const now = el('output', { class: 'perf-now hint', 'data-key': 'perf-now', text: perfNowText() });
  const tick = setInterval(() => { if (!now.isConnected) clearInterval(tick); else now.textContent = perfNowText(); }, 250);
  const pickQuality = v => {
    setSetting('quality', v);
    if (PERF_TIERS[v]) perfApplyTier(v);
    else if (v === 'auto') { if (PERF.last.tier) perfApplyTier(PERF.last.tier); else if (canRun) perfRun(2); }
  };
  return el('section', { class: 'set-group', 'data-group': 'perf' }, el('h3', { text: 'Performance' }),
    segField('Quality', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['custom', 'Custom']], S.quality, pickQuality),
    el('small', { class: 'hint', text: 'Auto sets bloom, particles and lights from the benchmark; changing one of them by hand switches to Custom.' }),
    el('div', { class: 'access-links' },
      uiButton('Run benchmark', () => { perfRun(2).then(() => refreshScreen()); }, null,
        { 'data-key': 'perf-run', disabled: canRun ? null : true, title: canRun ? '' : 'Runs from the title menu' }), now),
    el('small', { class: 'hint', 'data-key': 'perf-last', text: perfLastText() }),
    toggleField('FPS counter', !!S.fpsCounter, v => setSetting('fpsCounter', v), 'Frames per second and render time in the corner.'));
}

on('boot', () => {
  // Every frame goes through here: timing for the readout and the benchmark, then the optional counter.
  const perfBase = render;   // 85-render's declaration: reassignable, like applySettings in 84-postfx
  render = function (dt) {
    const t0 = performance.now();
    perfBase(dt);
    perfSample(performance.now() - t0, dt);
    if (SETTINGS.fpsCounter) perfDrawFps(ctx);
  };
  // A hand change to one of the tier settings means the player wants their own mix.
  const perfBaseSet = setSetting;
  setSetting = function (key, value) {
    perfBaseSet(key, value);
    if (!PERF.applying && (key === 'bloom' || key === 'particles' || key === 'lights') && SETTINGS.quality !== 'custom') { SETTINGS.quality = 'custom'; saveSettings(); }
  };
  if (typeof SCREENS !== 'undefined' && typeof SCREENS.settings === 'function') {
    const build = SCREENS.settings;
    SCREENS.settings = () => {
      const node = build();
      try { node.querySelector('.set-grid').append(perfSettingsGroup()); } catch (e) { report(e, 'perf settings'); }
      return node;
    };
  }
  if (window.SC) window.SC.perf = { run: perfRun, PERF, tiers: PERF_TIERS, apply: perfApplyTier, tier: perfTier, cap: perfCapFps,
    canAutoRun: perfCanAutoRun, autoBlock: perfAutoBlock, stale: perfStale };
  // The automatic run waits for a real gesture (perfGesture): before one, Safari's frame cap would measure 'low'.
});
