// 84-quality.js: performance tiers. A short benchmark (SC.perf.run) plays a busy 8-fighter demo behind the title
// screen with bloom off, low and high and measures frames and render time; the result picks a quality tier (bloom,
// particles, lights) while SETTINGS.quality is 'auto'. Settings → Performance shows a live fps/ms readout, the last
// result, a "Run benchmark" button and an FPS counter toggle. Measuring and drawing only: nothing here changes a fight.

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
// last: the saved result { tier, fps, ms, when, ua, ver }; samples: recent render times (ms) for the live readout.
const PERF = { on: false, samples: [], last: store.getObj('bench'), applying: false, job: null, fps: 0, ms: 0, win: { t0: 0, n: 0 } };

// Called by the render wrap after every frame: a rolling half-second window feeds the readout and the FPS counter.
function perfSample(ms) {
  const w = PERF.win, now = performance.now();
  PERF.samples.push(ms);
  if (PERF.samples.length > 90) PERF.samples.shift();
  w.n++;
  if (!w.t0) w.t0 = now;
  else if (now - w.t0 >= 500) { PERF.fps = Math.round(w.n * 1000 / (now - w.t0)); PERF.ms = perfMedian(PERF.samples); w.t0 = now; w.n = 0; }
  if (PERF.job) { try { perfJobFrame(ms); } catch (e) { report(e, 'benchmark'); perfFinish(true); } }
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
// Resolves with { tier, stats: { off|low|high: { fps, ms } }, inconclusive }; null when it cannot run now (only behind
// the title menu, while the attract demo plays). Phases end after seconds/3 and at least PERF_MIN_FRAMES frames each.
function perfRun(seconds = 2) {
  if (PERF.job) return PERF.job.promise;
  if (G_STATE.state !== 'menu' || !G_STATE.demo) return Promise.resolve(null);
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  const job = { promise, resolve, seconds: clamp(+seconds || 2, .3, 10), phase: -1, phases: ['off', 'low', 'high'], res: {},
    t0: performance.now(), keep: { bloom: SETTINGS.bloom, tier: BLOOM.tier }, hidden: false, modal: null, watchdog: 0 };
  PERF.job = job; PERF.on = true;
  BLOOM.tier = 0;   // measure the real cost of each level, not what the governor left behind
  job.modal = fxModalActions('Measuring performance…', [],
    el('p', { class: 'hint', text: 'A busy brawl runs for a moment to pick the effects level for this device. Change it any time in Settings → Performance.' }));
  startMatch({ mode: 'ffa', fighters: 8, demo: true, map: 'caldera', diff: 'hard' });
  job.watchdog = setTimeout(() => perfFinish(true), (job.seconds * 3 + 8) * 1000);
  return promise;
}

// One frame of the benchmark: keep the scene busy, then count frames and render times per bloom phase.
function perfJobFrame(ms) {
  const job = PERF.job, now = performance.now();
  if (G_STATE.state !== 'menu' || !G_STATE.demo) return perfFinish(true, true);   // the player started something: stop quietly
  if (document.hidden) job.hidden = true;
  for (let k = 0; k < 3; k++) burst(rnd(120, W - 120), rnd(100, H - 160), pick(DEFAULT_COLORS), 14, 480, { life: .7 });
  for (let k = 0; k < 2; k++) postfxImpact(rnd(120, W - 120), rnd(100, H - 160), rnd(-1, 1), rnd(-1, 1), 22, pick(DEFAULT_COLORS), null);
  if (job.phase < 0) { if (now - job.t0 >= 400) perfPhase(job, 0); return; }   // warm-up: shaders, caches, fonts
  const ph = job.res[job.phases[job.phase]];
  ph.frames++; ph.ms.push(ms);
  if (now - ph.t0 < job.seconds / 3 * 1000 || ph.frames < PERF_MIN_FRAMES) return;
  ph.wall = now - ph.t0;
  if (job.phase < 2) perfPhase(job, job.phase + 1); else perfFinish(false);
}
function perfPhase(job, i) {
  job.phase = i;
  SETTINGS.bloom = job.phases[i];
  job.res[job.phases[i]] = { t0: performance.now(), frames: 0, ms: [], wall: 0 };
}

function perfTier(s) {
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
  let ok = !aborted && !job.hidden;
  for (const q of job.phases) {
    const r = job.res[q];
    if (!r || !r.wall || r.frames < PERF_MIN_FRAMES) { ok = false; continue; }
    stats[q] = { fps: Math.round(r.frames * 1000 / r.wall), ms: +perfMedian(r.ms).toFixed(2) };
  }
  const tier = ok ? perfTier(stats) : null, when = Date.now();
  if (ok) {
    PERF.last = { tier, fps: stats.high.fps, ms: stats.high.ms, fpsLow: stats.low.fps, msLow: stats.low.ms, when, ua: navigator.userAgent, ver: VERSION };
    store.set('bench', PERF.last);
    if (SETTINGS.quality === 'auto') perfApplyTier(tier);
  }
  if (job.modal) fxModalClose(job.modal);
  if (!quiet) { startMatch(demoConfig()); refreshScreen(); }
  job.resolve({ tier, stats, inconclusive: !ok, when });
}

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
  return `Last result: ${capital(L.tier)} (${L.fps} fps · ${L.ms} ms with bloom High, ${L.fpsLow ?? '?'} fps with Low)${when}`;
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
  if (window.SC) window.SC.perf = { run: perfRun, PERF, tiers: PERF_TIERS, apply: perfApplyTier, tier: perfTier };
  // First visit, or a new browser or game version: measure once the title has settled. Never under test automation.
  setTimeout(() => {
    const L = PERF.last, stale = !L.tier || L.ua !== navigator.userAgent || L.ver !== VERSION;
    if (stale && SETTINGS.quality === 'auto' && G_STATE.state === 'menu' && G_STATE.demo && !navigator.webdriver) perfRun(2);
  }, 1500);
});
