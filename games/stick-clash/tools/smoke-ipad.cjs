// Smoke tests for the iPad / device layer (92-device, 80-audio, 84-quality, 86-photo, 89-gif, 89-replays, the touch
// seat in 93-pads and the per-seat one-button mode in 92-access). Called by tools/smoke.cjs; also runs on its own
// (`node tools/smoke-ipad.cjs`, after `node build.mjs`). Chromium only, with iPad-shaped contexts (Safari UA, touch,
// 2x) driven through CDP touch events:
// - touch controls follow the latest input (touch / key / pad) and SETTINGS.touchMode; typing never hides them;
// - a trackpad iPad still counts as a touch device; audio unlocks on a touch or a click; the announcer warms up on the
//   next real key or tap after a pad start (an iOS-like speech engine that only starts inside a gesture);
// - fullscreen refusal toasts (and no button where fullscreen is unavailable); the rotate card pauses in portrait but
//   never in Split View; the "turn sound on" strip for pad-only starts; the lobby's touch seat;
// - MP4-first export naming, the GIF export without MediaRecorder, the GIF encoder and the filter bake;
// - the benchmark picks and stores a tier (and leaves Custom alone); one-button mode on seat P3 only.
// - the iPad/WebKit audit fixes: the benchmark waits for a real gesture and judges a capped (30 fps) clock by render
//   time; 'gesture' only from pointerup/touchend/click/keydown and the announcer's warm-up retries; no page zoom
//   (gesture events, pinch resizes); the stick ring under the thumb and the edge insets; Apple Pencil as touch; save
//   codes without DecompressionStream (inflater vectors + fuzz); captureStream failing -> GIF; wake-lock toggle.
// - v4 touch sets at 1024x768, 1194x834 and 1366x1024: Advanced buttons 44+ px (48+ on the inner ring), 6+ px apart and
//   inside their set, alone and in table mode; P2's set below the HUD with its own (working) pause button.
// Screenshots: tmp/smoke/ipad-*.png.
const path = require('path');
const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'dist', 'stick-clash.html');
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ipad = (w, h, extra) => Object.assign({ viewport: { width: w, height: h }, screen: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: IPAD_UA }, extra);
const DEVICES = {
  ipadPro11: ipad(1194, 834),
  ipad10: ipad(1180, 820),
  ipad129: ipad(1366, 1024),
  ipad97: ipad(1024, 768),                                // the smallest 4:3 iPad screen
  portrait: ipad(834, 1194),
  splitView: ipad(507, 834, { screen: { width: 1194, height: 834 } }),
  trackpad: ipad(1194, 834, { isMobile: false }),
  ipadFast: ipad(1194, 834, { deviceScaleFactor: 1 }),   // 1x: real-time steps (kill-cam frames, benchmark) run at a usable rate headless
  phone: ipad(844, 390),                                   // a landscape phone: the short screen where the stick offset showed most
};
// A 30 fps display clock (Safari in a cross-origin iframe before the first tap): every requestAnimationFrame batch
// fires 1/30 s apart with timestamps exactly 1/30 s apart, however long the frames take on this machine.
const RAF_30 = () => {
  const P = 1000 / 30, queue = [], cancelled = new Set();
  let ts = 0, timer = 0, id = 0;
  const tick = () => {
    timer = 0; ts = ts ? ts + P : performance.now();
    for (const [n, cb] of queue.splice(0)) {
      if (cancelled.delete(n)) continue;
      try { cb(ts); } catch (e) { setTimeout(() => { throw e; }); }
    }
  };
  window.requestAnimationFrame = cb => { queue.push([++id, cb]); if (!timer) timer = setTimeout(tick, P); return id; };
  window.cancelAnimationFrame = n => { cancelled.add(n); };
};
// zlib streams made by node's zlib, one per deflate block type (stored, fixed Huffman, dynamic Huffman).
const INFLATE_VECTORS = [
  { name: 'stored', b64: 'eAEBMgDN/1N0aWNrIENsYXNoIHNhdmUgY29kZSB2ZWN0b3IgMTIzNDU2Nzg5MCAxMjM0NTY3ODkwpPwOoQ==', text: 'Stick Clash save code vector 1234567890 1234567890' },
  { name: 'fixed', b64: 'eNoLLslMzlZwzkkszlAoTixLVUjOT0lVKEtNLskvUjA0MjYxNTO3sDRAYgIApPwOoQ==', text: 'Stick Clash save code vector 1234567890 1234567890' },
  { name: 'dynamic', b64: 'eNpljUFqwzAQRe/y1yLETiBUd+gNZqPKcqxa0qQeyaUY3z1IppS2s5p5w/9vwwrdKWTo7nb+GYUZeoNkb2cbjEyntT89Fh59cNDYCJZ9EoK+XvpOEZxZkhsI+qWmCZJNru+NMHNdul4RPo/MTRECi7h6XPYd6o9JXM4+3eVQvQXmSNCEyd8ngiJ8FBN8/mrQlMwNZi52euXB/cYmJS7JuqXhlb11hP/O6FI5fPG7YnWLFGkl0TwaGvj9aB38ODaSeIkm1MZ9fwKFkWvg',
    text: '{"v":1,"t":1700000000000,"k":{"stickclash.v2.profile":"{\\"coins\\":4321,\\"earned\\":9000,\\"stats\\":{\\"kos\\":12,\\"wins\\":7,\\"losses\\":3}}","stickclash.v2.settings":"{\\"bloom\\":\\"high\\",\\"quality\\":\\"auto\\",\\"touchMode\\":\\"auto\\",\\"announcer\\":\\"voice\\"}","stickclash.v2.menu":"{\\"mode\\":\\"versus\\",\\"map\\":\\"dojo\\",\\"diff\\":\\"normal\\"}"}}' },
];
const CALM = () => { for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; f.inp.mx = 0; f.inp.attackHeld = false; } };

async function open(browser, device, init) {
  const ctx = await browser.newContext(Object.assign({}, DEVICES[device]));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto(URL);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(() => { window.touchVisible = () => !document.getElementById('touch').hidden; });   // page-side helper
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tap = async (x, y) => { await touch('touchStart', [{ x, y, id: 1 }]); await touch('touchEnd', []); };
  const pageErrors = () => page.evaluate(() => SC.errors.map(e => e.msg));
  // An element's client rect with its centre.
  const box = sel => page.evaluate(q => { const r = document.querySelector(q).getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; }, sel);
  // A point on the title screen with nothing tappable under it (the demo side), for taps that must not open a menu.
  const emptySpot = () => page.evaluate(() => {
    for (const [fx, fy] of [[.86, .5], [.78, .3], [.9, .78], [.66, .62]]) {
      const x = Math.round(innerWidth * fx), y = Math.round(innerHeight * fy), t = document.elementFromPoint(x, y);
      if (t && !t.closest('button, a, input, select, textarea, [tabindex], .toast')) return { x, y };
    }
    return { x: Math.round(innerWidth * .86), y: Math.round(innerHeight * .5) };
  });
  return { ctx, page, errors, touch, tap, pageErrors, box, emptySpot };
}
const shot = (SHOTS, name) => path.join(SHOTS, `ipad-${name}.png`);

// After the GIF export of (10): MediaRecorder is back but captureStream throws, so the video route must fall back.
async function captureFallback(page) {
  const r = await page.evaluate(() => {
    window.MediaRecorder = window.__MR;
    for (const m of document.querySelectorAll('.fx-modal')) if (m.fxClose) m.fxClose();
    const H = SC.highlights.HL, before = SC.export.how();
    H.lastExport = null;
    HTMLCanvasElement.prototype.captureStream = function () { throw new DOMException('capture blocked here', 'NotSupportedError'); };
    const started = SC.highlights.export(H.clips[0]);
    return { before, started, noCapture: !!H.noCapture, after: SC.export.how(), gifRec: !!(H.rec && H.rec.gif) };
  });
  await page.waitForFunction(() => SC.highlights.HL.lastExport, null, { timeout: 40000 }).catch(() => {});
  Object.assign(r, await page.evaluate(() => ({ exp: SC.highlights.HL.lastExport, hint: (document.querySelector('.fx-modal .hint') || {}).textContent || '' })));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#highlights [data-key^="hl-export"]'), null, { timeout: 5000 }).catch(() => {});
  r.label = await page.evaluate(() => (document.querySelector('#highlights [data-key^="hl-export"]') || {}).textContent || '');
  return r;
}

async function run(browser, { check, rows, SHOTS }) {
  const allErrors = [];
  let stepKey = '', exportFallback = null;
  const step = async (key, fn) => {
    stepKey = key;
    let ok = false, note = '';
    try { const r = await fn(); ok = r === true || (r && r.ok); note = (r && r.note) || ''; } catch (e) { note = e.message; }
    check(ok, `ipad ${key}: ${note || 'failed'}`);
    rows.push({ kind: 'ipad', key, ok: !!ok, note });
  };
  // Opens a device, runs the body, closes it; any page or console error is collected for the final check.
  const withDevice = async (device, body, init) => {
    const d = await open(browser, device, init);
    try { return await body(d); } finally {
      allErrors.push(...d.errors.map(e => `[${stepKey}] ${device}: ${e}`));
      try { allErrors.push(...(await d.pageErrors()).map(e => `[${stepKey}] ${device} SC: ${e}`)); } catch (e) { /* page gone */ }
      await d.ctx.close();
    }
  };

  // (1) Auto: shown after a touch, hidden after a key, back after a touch; 'off' and 'on' force it.
  await step('touch rule follows the latest input', () => withDevice('ipadPro11', async ({ page, tap }) => {
    await page.evaluate(() => { ROTATE_SKIPPED = true; MENU.map = 'dojo'; MENU.mode = 'versus'; });
    await page.tap('#menu .go');
    await page.evaluate(CALM);
    await page.waitForTimeout(400);
    const a = await page.evaluate(() => ({ vis: touchVisible(), last: DEVICE.lastInput, state: SC.G.state }));
    await page.screenshot({ path: shot(SHOTS, 'play-1194x834') });
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(60);
    const b = await page.evaluate(() => ({ vis: touchVisible(), last: DEVICE.lastInput }));
    await tap(900, 500);                                   // the controls are hidden: this lands on the arena
    await page.waitForTimeout(60);
    const c = await page.evaluate(() => ({ vis: touchVisible(), last: DEVICE.lastInput }));
    const d = await page.evaluate(() => { SETTINGS.touchMode = 'off'; updateTouchUI(); return touchVisible(); });
    await page.evaluate(() => { SETTINGS.touchMode = 'on'; updateTouchUI(); });
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(60);
    const e = await page.evaluate(() => { const v = touchVisible(); SETTINGS.touchMode = 'auto'; updateTouchUI(); return v; });
    const ok = a.vis && a.last === 'touch' && a.state === 'play' && !b.vis && b.last === 'key' && c.vis && c.last === 'touch' && !d && e;
    return { ok, note: JSON.stringify({ a, b, c, off: d, on: e }) };
  }, () => { try { localStorage.clear(); } catch (e) { /* none */ } }));

  // (2) Typing in a text field is not keyboard play: the controls stay for the touch player.
  await step('typing a name keeps the touch controls', () => withDevice('ipadPro11', async ({ page, tap }) => {
    await tap(700, 700);
    const field = await page.evaluate(() => {
      openScreen('creator', 'menu');
      if (document.querySelector('[data-key="cr-name"]')) return '[data-key="cr-name"]';
      openScreen('transfer', 'settings');                   // fallback: the save-code box (94-savecode)
      return '[data-key="xfer-in"]';
    });
    await page.focus(field);
    await page.keyboard.type('Zoe');   // no WASD letters: the menu's key navigation reads those even in a field (95-ui)
    const typed = await page.evaluate(() => DEVICE.lastInput);
    await page.evaluate(() => { ROTATE_SKIPPED = true; SC.start({ mode: 'versus', map: 'dojo' }); });
    await page.waitForTimeout(100);
    const vis = await page.evaluate(() => touchVisible());
    return { ok: typed === 'touch' && vis, note: `field ${field}, lastInput ${typed}, visible ${vis}` };
  }));

  // (3) An iPad with a trackpad: still a touch device; a touch brings the controls up.
  await step('trackpad context still counts as touch', () => withDevice('trackpad', async ({ page, tap }) => {
    const dev = await page.evaluate(() => ({ touch: DEVICE.touch, isTouch: IS_TOUCH, points: navigator.maxTouchPoints }));
    await page.evaluate(() => { ROTATE_SKIPPED = true; MENU.map = 'dojo'; MENU.mode = 'versus'; startFromMenu(); });
    await page.evaluate(CALM);
    await page.waitForTimeout(100);
    await tap(900, 500);
    await page.waitForTimeout(60);
    const vis = await page.evaluate(() => touchVisible());
    return { ok: dev.touch && vis, note: JSON.stringify(dev) + ` visible ${vis}` };
  }));

  // (4) Audio unlocks on a touch (touchend / pointer) and on a click; the click warms speech up once (one try for its
  // pointerup + click) and the warm-up settles: speech started, or (headless Chromium has no voices) the synth fallback.
  await step('audio unlocks on touch and click', async () => {
    const t = await withDevice('ipadPro11', async ({ page, tap }) => {
      const before = await page.evaluate(() => AC === null);
      await tap(700, 700);
      const after = await page.evaluate(() => AC !== null);
      return { before, after };
    });
    const c = await withDevice('ipadPro11', async ({ page }) => {
      await page.mouse.click(700, 700);
      await page.waitForFunction(() => ANN.warmed || ANN.fallback, null, { timeout: 3000 }).catch(() => {});
      return page.evaluate(() => ({ ac: AC !== null, tries: ANN.warmTries, warmed: ANN.warmed, fallback: ANN.fallback, mode: SC.announcer.mode() }));
    });
    const ok = t.before && t.after && c.ac && c.tries === 1 && (c.warmed || (c.fallback && c.mode === 'synth'));
    return { ok, note: JSON.stringify({ touch: t, click: c }) };
  });

  // (5) Fullscreen refused (as inside an embedded viewer): a toast, no error; no button where it is unavailable.
  await step('fullscreen refusal toasts', async () => {
    const r = await withDevice('ipadPro11', async ({ page }) => {
      await page.evaluate(() => { Element.prototype.requestFullscreen = function () { return Promise.reject(new DOMException('denied', 'NotAllowedError')); }; });
      const has = await page.locator('#menu [data-key="fullscreen"]').count();
      await page.click('#menu [data-key="fullscreen"]');
      await page.waitForTimeout(120);
      const toastText = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
      const errs = await page.evaluate(() => SC.errors.length);
      return { has, toastText, errs };
    });
    const absent = await withDevice('ipadPro11', async ({ page }) => (await page.locator('[data-key="fullscreen"]').count()) === 0,
      () => { Object.defineProperty(document, 'fullscreenEnabled', { get: () => false }); Object.defineProperty(document, 'webkitFullscreenEnabled', { get: () => false }); });
    return { ok: r.has === 1 && /Fullscreen not allowed/.test(r.toastText) && r.errs === 0 && absent, note: `toast "${r.toastText}", absent ${absent}` };
  });

  // (6) Portrait pauses behind the rotate card; a Split View window (narrow on a wide screen) does neither.
  await step('rotate card: portrait yes, split view no', async () => {
    const start = async ({ page }) => {
      await page.evaluate(() => { MENU.map = 'dojo'; MENU.mode = 'versus'; });
      await page.tap('#menu .go');
      await page.waitForTimeout(200);
      return page.evaluate(() => ({ rotate: !document.getElementById('rotate').hidden, state: SC.G.state, full: deviceFullWidth(), screen: screen.width, inner: innerWidth }));
    };
    const p = await withDevice('portrait', start), s = await withDevice('splitView', start);
    return { ok: p.rotate && p.state === 'paused' && !s.rotate && s.state === 'play', note: JSON.stringify({ portrait: p, split: s }) };
  });

  // (7) A match started from a gamepad (no tap or key yet): the sound strip shows, a key removes it.
  // Headless Chromium starts an AudioContext 'running' with no gesture; Safari keeps it 'suspended', which is the case here.
  await step('sound strip for pad-only starts', () => withDevice('ipadPro11', async ({ page }) => {
    await page.evaluate(() => { ROTATE_SKIPPED = true; MENU.map = 'dojo'; MENU.mode = 'versus'; emit('pad', 'jump', 0); startFromMenu(); });
    await page.evaluate(CALM);
    await page.waitForTimeout(150);
    const shown = await page.evaluate(() => ({ bar: !!document.getElementById('soundbar'), last: DEVICE.lastInput, acState: AC && AC.state, touch: touchVisible() }));
    await page.screenshot({ path: shot(SHOTS, 'soundbar-1194x834') });
    // A pad's (untrusted) presses are no gesture: "Round one" went to the voice, which ignored it like iOS does.
    const pad = await page.evaluate(() => ({ tries: ANN.warmTries, warmed: ANN.warmed, fallback: ANN.fallback, round: (ANN.log.find(l => /^Round/.test(l.text)) || {}).how }));
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(80);
    const gone = await page.evaluate(() => !document.getElementById('soundbar'));
    // The next real key or tap warms the voice up: it starts, and the announcer keeps the voice.
    const key = await page.evaluate(() => ({ tries: ANN.warmTries, warmed: ANN.warmed, fallback: ANN.fallback, mode: SC.announcer.mode(), ignored: __speech.ignored, spoke: __speech.spoke }));
    const ok = shown.bar && shown.last === 'pad' && !shown.touch && gone && pad.tries === 0 && !pad.warmed && !pad.fallback && pad.round === 'voice'
      && key.tries === 1 && key.warmed && !key.fallback && key.mode === 'voice' && key.ignored >= 1 && key.spoke >= 1;
    return { ok, note: JSON.stringify({ shown, gone, pad, key }) };
  }, () => {
    const Base = window.AudioContext; window.AudioContext = class extends Base { get state() { return 'suspended'; } };
    // iOS-like speech (WebKit): speak() is silently ignored until one call is made while a real tap or key is being
    // dispatched; that lifts the restriction for the page. (Playwright's evaluate counts as user activation, so the
    // page's own activation flag can't tell a pad start from a tap: the stub watches trusted events itself.)
    window.__speech = { ignored: 0, spoke: 0, gesture: false, unlocked: false };
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(type, e => {
      if (!e.isTrusted || (type === 'keydown' && e.code === 'Escape')) return;
      __speech.gesture = true; setTimeout(() => { __speech.gesture = false; });
    }, true);
    const engine = { speaking: false, pending: false, cancel() {}, getVoices: () => [],
      speak(u) {
        if (__speech.gesture) __speech.unlocked = true;
        if (!__speech.unlocked) { __speech.ignored++; return; }
        __speech.spoke++; setTimeout(() => { if (u.onstart) u.onstart({}); if (u.onend) u.onend({}); }, 10);
      } };
    Object.defineProperty(window, 'speechSynthesis', { value: engine, configurable: true, writable: true });
  }));

  // (8) The lobby's touch seat: joins once, shows as "Touch screen", and drives TOUCH_SLOT in the match.
  await step('lobby touch seat', () => withDevice('ipadPro11', async ({ page }) => {
    await page.evaluate(() => { MENU.mode = 'ffa'; MENU.map = 'dojo'; LOBBY.list = []; openScreen('maps', 'modes'); openScreen('join', 'maps'); });
    const btn = await page.locator('[data-key="join-touch"]').count();
    await page.click('[data-key="join-touch"]');
    await page.waitForTimeout(60);
    const twice = await page.evaluate(() => { lobbyJoin({ touch: true, label: 'Touch screen' }); return LOBBY.list.filter(j => j.touch).length; });
    await page.evaluate(() => lobbyJoin({ keys: 0 }));
    await page.waitForTimeout(60);
    const card = await page.evaluate(() => ({ text: document.querySelector('.join-card').textContent, chip: !!document.querySelector('[data-key="join-one-0"]'), n: LOBBY.list.length }));
    await page.screenshot({ path: shot(SHOTS, 'lobby-1194x834') });
    await page.evaluate(() => { ROTATE_SKIPPED = true; lobbyStart(); });
    await page.waitForTimeout(200);
    const match = await page.evaluate(() => ({ state: SC.G.state, joined: JOINED && JOINED.length, slot: TOUCH_SLOT, touch: touchVisible() }));
    await page.evaluate(() => { LOBBY.list = []; toMenu(); });
    const ok = btn === 1 && twice === 1 && /Touch screen/.test(card.text) && card.chip && card.n === 2 && match.state === 'play' && match.joined === 2 && match.slot === 0 && match.touch;
    return { ok, note: JSON.stringify({ btn, twice, card: card.n, match }) };
  }));

  // (9) The thumb arc fits a 12.9" screen; the Settings screen has the new groups.
  await step('arc fits 1366x1024 and settings groups', () => withDevice('ipad129', async ({ page }) => {
    await page.evaluate(() => { ROTATE_SKIPPED = true; MENU.map = 'dojo'; MENU.mode = 'versus'; });
    await page.tap('#menu .go');
    await page.evaluate(CALM);
    await page.waitForTimeout(400);
    const inView = await page.evaluate(() => touchVisible() && [...document.querySelectorAll('#touch .tarc button:not([hidden])')].every(b => {
      const r = b.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
    const big = await page.evaluate(() => document.querySelector('#touch [data-act="attack"]').getBoundingClientRect().width);
    await page.screenshot({ path: shot(SHOTS, 'play-1366x1024') });
    await page.evaluate(() => { toMenu(); openScreen('settings', 'menu'); });
    await page.waitForTimeout(100);
    const groups = await page.evaluate(() => ({
      perf: !!document.querySelector('[data-group="perf"]'), touchMode: !!document.querySelector('[data-key="Touch controls-auto"]'),
      silent: !!document.querySelector('[data-key="Sound in silent mode-play"]'), oneBtn: !!document.querySelector('[data-key="onebtn-2"]'),
      wake: !!document.querySelector('[data-key="Keep screen awake"]'), fps: !!document.querySelector('[data-key="FPS counter"]'),
      now: (document.querySelector('[data-key="perf-now"]') || {}).textContent }));
    await page.evaluate(() => document.querySelector('[data-group="perf"]').scrollIntoView());
    await page.screenshot({ path: shot(SHOTS, 'settings-1366x1024') });
    const ok = inView && big >= 100 && Object.values(groups).every(Boolean) && /Now: \d+ fps/.test(groups.now);
    return { ok, note: `attack ${Math.round(big)}px, inView ${inView}, ${JSON.stringify(groups)}` };
  }));

  // (10) Export: MP4 is preferred and named .mp4; without MediaRecorder a clip becomes a GIF; encoder and bake units.
  await step('export: mp4 naming, GIF path, encoder, bake', () => withDevice('ipadFast', async ({ page }) => {
    const units = await page.evaluate(async () => {
      const keep = MediaRecorder.isTypeSupported;
      MediaRecorder.isTypeSupported = t => t === 'video/mp4';
      const mime = SC.export.mime(), out = { mime, name: SC.export.name(mime), how: SC.export.how() };
      MediaRecorder.isTypeSupported = keep;
      const g = SC.gif(8, 8, 10); g.addFrame(new ImageData(8, 8)); g.addFrame(new ImageData(8, 8));
      const blob = g.finish();
      out.gifHead = await new Response(blob.slice(0, 6)).text(); out.gifFrames = g.frames;
      const id = new ImageData(1, 1); id.data.set([255, 0, 0, 255]);
      SC.photo.bake(id, 'grayscale(1) contrast(1.4) brightness(.95)');
      out.bake = [...id.data].slice(0, 3);
      return out;
    });
    // A clip: a real-time duel, a forced K.O. once the kill-cam has history, then the results.
    await page.keyboard.press('KeyX');
    await page.evaluate(() => { SC.start({ mode: 'watch', winScore: 1, map: 'neon', weapons: ['katana', 'battle-axe'] }); SC.G.lock = 0; });
    await page.waitForTimeout(2500);
    await page.evaluate(() => damage(SC.F[1], 9999, { src: SC.F[0], kind: 'melee', nx: 1, ny: 0 }));
    await page.waitForFunction(() => SC.highlights.HL.clips.length > 0, null, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => SC.G.state === 'over', null, { timeout: 30000 }).catch(() => {});
    const clips = await page.evaluate(() => SC.highlights.HL.clips.length);
    const started = await page.evaluate(() => { toMenu(); window.__MR = window.MediaRecorder; window.MediaRecorder = undefined; return { how: SC.export.how(), ok: SC.highlights.export(SC.highlights.HL.clips[0]) }; });
    await page.waitForFunction(() => SC.highlights.HL.lastExport, null, { timeout: 40000 }).catch(() => {});
    const exp = await page.evaluate(() => SC.highlights.HL.lastExport);
    const modal = await page.evaluate(() => ({ img: !!document.querySelector('.fx-modal img.fx-preview'), download: !!document.querySelector('.fx-modal [data-key="fx-download"]'),
      share: !!document.querySelector('.fx-modal [data-key="fx-share"]'), hint: (document.querySelector('.fx-modal .hint') || {}).textContent }));
    await page.screenshot({ path: shot(SHOTS, 'export-1194x834') });
    await page.keyboard.press('Escape');
    exportFallback = await captureFallback(page);
    const ok = units.mime === 'video/mp4' && /\.mp4$/.test(units.name) && units.how === 'video' && units.gifHead === 'GIF89a' && units.gifFrames === 2
      && units.bake[0] === units.bake[1] && units.bake[1] === units.bake[2] && clips >= 1 && started.how === 'gif' && started.ok
      && exp && exp.type === 'image/gif' && exp.size > 1000 && modal.img && modal.download && /GIF/.test(modal.hint);
    return { ok, note: JSON.stringify({ units, clips, started, exp, modal: { img: modal.img, download: modal.download, share: modal.share } }) };
  }));

  // (10b) A browser whose canvas capture or recorder throws (MediaRecorder present): the clip is made as a GIF.
  await step('export: captureStream throwing -> GIF', async () => {
    const f = exportFallback || {};
    const ok = f.before === 'video' && f.started && f.noCapture && f.after === 'gif' && f.gifRec && f.exp && f.exp.type === 'image/gif'
      && f.exp.size > 1000 && f.exp.fallback === 'gif' && /Video capture is not available/.test(f.hint || '') && f.label === '⬇ Export GIF';
    return { ok, note: JSON.stringify(f) };
  });

  // (11) The benchmark: a tier, stored, applied under Auto; a Custom mix is left alone.
  await step('benchmark picks and stores a tier', () => withDevice('ipadFast', async ({ page }) => {
    const r = await page.evaluate(async () => {
      SETTINGS.quality = 'auto';
      const res = await SC.perf.run(.6);
      const out = { tier: res && res.tier, inconclusive: res && res.inconclusive, stored: (store.get('bench') || {}).tier, bloom: SETTINGS.bloom,
        expect: res && SC.perf.tiers[res.tier] && SC.perf.tiers[res.tier].bloom, state: SC.G.state, demo: SC.G.demo, fps: res && res.stats && res.stats.high && res.stats.high.fps };
      SETTINGS.quality = 'custom'; SETTINGS.bloom = 'low';
      const again = await SC.perf.run(.6);
      out.custom = { tier: again && again.tier, bloom: SETTINGS.bloom, quality: SETTINGS.quality };
      SETTINGS.quality = 'auto';
      return out;
    });
    const ok = ['high', 'medium', 'low'].includes(r.tier) && r.stored === r.tier && r.bloom === r.expect && r.state === 'menu' && r.demo
      && r.custom.bloom === 'low' && r.custom.quality === 'custom';
    return { ok, note: JSON.stringify(r) };
  }));

  // (12) One-button mode on seat P3 only, with a touch seat in the lobby config (SC.start accepts `joined`).
  await step('one-button mode on P3 only', () => withDevice('ipadFast', async ({ page }) => {
    const r = await page.evaluate(async () => {
      SETTINGS.oneButtonSlots = [2]; ROTATE_SKIPPED = true;
      SC.start({ mode: 'ffa', fighters: 4, map: 'dojo', joined: [{ keys: 0 }, { keys: 1 }, { touch: true }] });
      SC.G.lock = 0;
      for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; }
      // Every foe far to the right: the auto-walker must head that way (a foe already in reach would mean mx 0).
      SC.F.forEach((f, i) => moveFighter(f, (i === 2 ? 150 : 950 + i * 60) - f.P[2].x, 0));
      let moved = false;
      for (let k = 0; k < 20 && !moved; k++) { await new Promise(res => setTimeout(res, 50)); if (SC.F[2].inp.mx > 0) moved = true; }
      const out = { on2: oneButtonOn(2), on0: oneButtonOn(0), moved, slot: TOUCH_SLOT, joined: JOINED && JOINED.length,
        humans: SC.F.filter(f => f.ctrl === 'human').map(f => f.slot).join(), touch: touchVisible() };
      SETTINGS.oneButtonSlots = []; saveSettings();
      return out;
    });
    const ok = r.on2 && !r.on0 && r.moved && r.slot === 2 && r.joined === 3 && r.humans === '0,1,2' && r.touch;
    return { ok, note: JSON.stringify(r) };
  }));

  // (13) Audit 1: no benchmark before a real gesture. A stored Low measured under a 30 fps cap is measured once more on
  // a later launch, a second after the next real tap (automation is what blocks it everywhere else: switched off here).
  await step('benchmark waits for a real gesture', () => withDevice('ipadFast', async ({ page, touch, emptySpot }) => {
    await page.waitForTimeout(3000);
    const idle = await page.evaluate(() => ({ block: SC.perf.autoBlock(), can: SC.perf.canAutoRun(), stored: localStorage.getItem('stickclash.v2.bench'), job: !!SC.perf.PERF.job }));
    await page.evaluate(() => localStorage.setItem('stickclash.v2.bench', JSON.stringify({ tier: 'low', fps: 30, ms: 4, fpsLow: 30, msLow: 3,
      capped: true, capFps: 30, when: Date.now(), ua: navigator.userAgent, ver: VERSION })));
    await page.reload();
    await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
    await page.evaluate(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }));
    const launch = await page.evaluate(() => ({ stale: SC.perf.stale(), block: SC.perf.autoBlock() }));
    const spot = await emptySpot();
    await touch('touchStart', [{ x: spot.x, y: spot.y, id: 1 }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(250);
    const soon = await page.evaluate(() => ({ block: SC.perf.autoBlock(), job: !!SC.perf.PERF.job }));
    await page.waitForFunction(() => SC.perf.PERF.autoDone, null, { timeout: 4000 }).catch(() => {});
    const started = await page.evaluate(() => ({ job: !!SC.perf.PERF.job, done: SC.perf.PERF.autoDone }));
    await page.waitForFunction(() => !SC.perf.PERF.job, null, { timeout: 30000 }).catch(() => {});
    const after = await page.evaluate(() => { const b = store.get('bench') || {}; return { tier: b.tier, again: b.again, stale: SC.perf.stale(), block: SC.perf.autoBlock(), state: SC.G.state, demo: SC.G.demo }; });
    const ok = idle.block === 'no gesture yet' && !idle.can && idle.stored === null && !idle.job && launch.stale === 'capped' && launch.block === 'no gesture yet'
      && soon.block === 'too soon after the gesture' && !soon.job && started.done && ['high', 'medium', 'low'].includes(after.tier) && after.again === true
      && after.stale === '' && after.block === 'done this session' && after.state === 'menu' && after.demo;
    return { ok, note: JSON.stringify({ idle, launch, soon, started, after }) };
  }));

  // (14) Audit 1: a 30 fps clock (stubbed requestAnimationFrame) is detected; the tier then comes from render time only.
  await step('capped clock judged by render time', () => withDevice('ipadFast', async ({ page }) => {
    const r = await page.evaluate(async () => {
      SETTINGS.quality = 'auto';
      const res = await SC.perf.run(.6), s = res && res.stats, b = store.get('bench') || {};
      const byMs = s ? (s.high.ms <= 9 ? 'high' : s.low.ms <= 11 ? 'medium' : 'low') : null;
      return { tier: res && res.tier, byMs, capped: res && res.capped, capFps: res && res.capFps, stored: [b.tier, b.capped, b.capFps].join(),
        ms: s && ['off', 'low', 'high'].map(k => s[k].ms).join('/'), caps: s && ['off', 'low', 'high'].map(k => s[k].cap).join('/') };
    });
    await page.evaluate(() => openScreen('settings', 'menu'));
    const last = await page.evaluate(() => (document.querySelector('[data-key="perf-last"]') || {}).textContent || '');
    const u = await page.evaluate(() => {
      const C = SC.perf.cap, T = SC.perf.tier, P = 1000 / 30, rep = (v, n) => new Array(n).fill(v);
      const light = { off: { fps: 30, ms: 2 }, low: { fps: 30, ms: 4 }, high: { fps: 30, ms: 6 } };
      return { all30: C(rep(P, 60), 5), jitter30: C(rep(P, 60).map((g, i) => g + (i % 3) - 1), 5), mixed: C(rep(P, 30).concat(rep(P / 2, 30)), 5),
        busy30: C(rep(P, 60), 25), tiny60: C(rep(P / 2, 60), 2), busy60: C(rep(P / 2, 60), 10), fast: C(rep(8.3, 60), 3), few: C(rep(P, 5), 5),
        capped: T(light, true), uncapped: T(light, false), mid: T({ low: { fps: 30, ms: 10 }, high: { fps: 30, ms: 12 } }, true) };
    });
    const ok = r.capped === true && r.capFps === 30 && r.tier === r.byMs && r.stored === `${r.tier},true,30` && /measured while the display was limited to 30 fps/.test(last)
      && u.all30 === 30 && u.jitter30 === 30 && u.mixed === 0 && u.busy30 === 0 && u.tiny60 === 60 && u.busy60 === 0 && u.fast === 0 && u.few === 0
      && u.capped === 'high' && u.uncapped === 'low' && u.mid === 'medium';
    return { ok, note: JSON.stringify({ r, last: last.slice(0, 140), u }) };
  }, RAF_30));

  // (15) Audit 4: 'gesture' comes from pointerup / touchend / click / keydown only (trusted, not Esc); audio is still
  // created on pointerdown.
  await step('gesture only from pointerup, touchend, click, keydown', () => withDevice('ipadPro11', async ({ page, touch, emptySpot }) => {
    await page.evaluate(() => { window.__g = []; on('gesture', e => __g.push(e.type)); });
    const spot = await emptySpot();
    await touch('touchStart', [{ x: spot.x, y: spot.y, id: 1 }]);
    await page.waitForTimeout(40);
    const down = await page.evaluate(() => ({ g: __g.join(), ac: AC !== null }));
    await touch('touchEnd', []);
    await page.waitForTimeout(80);
    const up = await page.evaluate(() => __g.slice());
    const fake = await page.evaluate(() => {
      const n = __g.length;
      for (const ev of [new PointerEvent('pointerup', { bubbles: true }), new MouseEvent('click', { bubbles: true }), new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true })]) document.body.dispatchEvent(ev);
      return __g.length - n;
    });
    const n0 = await page.evaluate(() => __g.length);
    await page.keyboard.press('Escape');
    const esc = (await page.evaluate(() => __g.length)) - n0;
    await page.keyboard.press('KeyX');
    const key = await page.evaluate(() => __g[__g.length - 1]);
    const ok = down.g === '' && down.ac && up.includes('pointerup') && up.every(t => ['pointerup', 'touchend', 'click'].includes(t)) && fake === 0 && esc === 0 && key === 'keydown';
    return { ok, note: JSON.stringify({ down, up, fake, esc, key }) };
  }));

  // (16) Audit 4: the speech warm-up retries after 'not-allowed' until the utterance starts; a cancelled warm-up is no
  // failure; an engine that stays silent after a sure gesture hands the announcer to the synth voice.
  await step('announcer warm-up retries, then falls back', () => withDevice('ipadPro11', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const A = SC.announcer.ANN, wait = ms => new Promise(res => setTimeout(res, ms));
      let calls = 0, answer = 'deny';
      const engine = { speaking: false, pending: false, cancel() {}, getVoices: () => [],
        speak(u) { calls++; const a = answer; setTimeout(() => { if (a === 'deny') u.onerror({ error: 'not-allowed' }); else if (a === 'ok') u.onstart({}); }, 20); } };
      Object.defineProperty(window, 'speechSynthesis', { value: engine, configurable: true, writable: true });
      const reset = () => { clearTimeout(A.warmTimer); Object.assign(A, { warmed: false, fallback: false, warmTries: 0, warmAt: -1e9, warmTimer: 0 }); };
      reset(); SETTINGS.announcer = 'voice';
      SC.announcer.warm();
      await wait(100);
      const denied = { warmed: A.warmed, fallback: A.fallback, timer: !!A.warmTimer, mode: SC.announcer.mode() };
      answer = 'ok';
      await wait(450);                                          // the next tap: a new try
      SC.announcer.warm();
      await wait(100);
      const started = { warmed: A.warmed, fallback: A.fallback, calls, tries: A.warmTries, mode: SC.announcer.mode() };
      reset(); answer = 'silent';
      SC.announcer.warm();
      annWarmError({ error: 'canceled' });                      // a newer line cut the warm-up off: not a failure
      const cancelled = A.fallback;
      await wait(2300);
      const silent = { fallback: A.fallback, warmed: A.warmed, mode: SC.announcer.mode() };
      const broken = [annSpeechBroken({ error: 'synthesis-failed' }), annSpeechBroken({ error: 'canceled' }), annSpeechBroken({ error: 'not-allowed' })].join();
      return { denied, started, cancelled, silent, broken };
    });
    const ok = !r.denied.warmed && !r.denied.fallback && !r.denied.timer && r.denied.mode === 'voice' && r.started.warmed && !r.started.fallback
      && r.started.calls === 2 && r.started.tries === 2 && r.started.mode === 'voice' && r.cancelled === false && r.silent.fallback && !r.silent.warmed
      && r.silent.mode !== 'voice' && r.broken === 'true,false,false';
    return { ok, note: JSON.stringify(r) };
  }));

  // (17) Audit 3: no page zoom. Safari's gesture events are cancelled except in a text field; a pinch step's
  // visual-viewport resize (scale 2) lays nothing out; the menus' touch-action stops pinch and double-tap zoom.
  await step('no page zoom: gesture events and pinch resizes', () => withDevice('ipadPro11', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms)), D = SC.device;
      const fire = (type = 'gesturestart') => { const e = new Event(type, { bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return e.defaultPrevented; };
      const add = (tag, props) => document.body.appendChild(Object.assign(document.createElement(tag), props));
      const out = { events: D.pinchEvents.join(), menu: fire(), change: fire('gesturechange'), end: fire('gestureend') };
      const text = add('input', { type: 'text' }), area = add('textarea', {}), range = add('input', { type: 'range' });
      text.focus(); out.text = fire(); area.focus(); out.area = fire(); range.focus(); out.slider = fire();
      out.touch = { menu: getComputedStyle(document.getElementById('menu')).touchAction, range: getComputedStyle(range).touchAction };
      const camp = el('div', { class: 'camp-map' }, el('canvas', { class: 'camp-canvas' }));
      UI_ROOT.append(camp); out.touch.camp = getComputedStyle(camp.firstChild).touchAction; camp.remove();
      text.remove(); area.remove(); range.remove();
      const n0 = D.relayouts, s0 = D.pinchSkips;
      Object.defineProperty(visualViewport, 'scale', { get: () => 2, configurable: true });
      visualViewport.dispatchEvent(new Event('resize'));
      await wait(450);
      out.pinched = { skips: D.pinchSkips - s0, relayouts: D.relayouts - n0 };
      delete visualViewport.scale;
      visualViewport.dispatchEvent(new Event('resize'));
      await wait(450);
      out.unpinched = { relayouts: D.relayouts - n0, scale: visualViewport.scale };
      return out;
    });
    const ok = r.events === 'gesturestart,gesturechange,gestureend' && r.menu && r.change && r.end && !r.text && !r.area && r.slider
      && r.touch.menu === 'pan-x pan-y' && r.touch.range === 'manipulation' && r.touch.camp === 'manipulation'
      && r.pinched.skips === 1 && r.pinched.relayouts === 0 && r.unpinched.relayouts >= 1 && r.unpinched.scale === 1;
    return { ok, note: JSON.stringify(r) };
  }));

  // (18, 19) Audit 2 + 5: the stick ring is drawn under the thumb (not 14% lower), the knob follows it, and the idle ring
  // rests on screen inside the zone, which keeps 24 px clear of the left edge and the bottom (swipe-back, Dock).
  for (const [device, size] of [['phone', '844x390'], ['ipadPro11', '1194x834']]) {
    await step(`stick under the thumb ${size}`, () => withDevice(device, async ({ page, touch, box }) => {
      await page.evaluate(() => { ROTATE_SKIPPED = true; MENU.map = 'dojo'; MENU.mode = 'versus'; });
      await page.tap('#menu .go');
      await page.evaluate(CALM);
      await page.waitForTimeout(300);
      const view = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, vis: touchVisible() }));
      const zone = await box('#touch .tzone-l'), right = await box('#touch .tzone-r'), idle = await box('#touch .tstick');
      const x = Math.round(zone.l + zone.w * .5), y = Math.round(zone.t + zone.h * .55);
      await touch('touchStart', [{ x, y, id: 1 }]);
      await page.waitForTimeout(40);
      const live = await box('#touch .tstick');
      await touch('touchMove', [{ x: x + 15, y, id: 1 }]);
      await page.waitForTimeout(40);
      const held = await box('#touch .tstick'), knob = await box('#touch .tstick i');
      await page.screenshot({ path: shot(SHOTS, `stick-${size}`) });
      await touch('touchEnd', []);
      await page.waitForTimeout(60);
      const rest = await box('#touch .tstick');
      const near = (a, b) => Math.abs(a - b) <= 4;
      const checks = {
        visible: view.vis, ring: near(live.cx, x) && near(live.cy, y), stays: near(held.cx, x) && near(held.cy, y), knob: near(knob.cx, x + 15) && near(knob.cy, y),
        insets: zone.l >= 24 && view.h - zone.b >= 24 && view.h - right.b >= 24,
        idleOnScreen: idle.l >= 0 && idle.t >= 0 && idle.r <= view.w && idle.b <= view.h,
        idleInZone: idle.l >= zone.l && idle.t >= zone.t && idle.b <= zone.b && idle.r <= zone.r,
        backToRest: Math.abs(rest.l - idle.l) <= 1 && Math.abs(rest.t - idle.t) <= 1,
      };
      const failed = Object.keys(checks).filter(k => !checks[k]);
      return { ok: !failed.length, note: `failed [${failed}] touch ${x},${y} ring ${live.cx.toFixed(1)},${live.cy.toFixed(1)} zone ${JSON.stringify(zone)} idle ${JSON.stringify(idle)}` };
    }));
  }

  // (20) Audit 6 + 9: an Apple Pencil is the touch screen (device input, photo-mode pinch with a finger); the photo bar
  // talks touch and collapses to a tappable "Tools" chip.
  await step('pen counts as touch; photo Tools chip', () => withDevice('ipadPro11', async ({ page }) => {
    await page.evaluate(() => { ROTATE_SKIPPED = true; SC.start({ mode: 'versus', map: 'dojo' }); });
    await page.waitForTimeout(100);
    await page.keyboard.press('KeyD');
    const r = await page.evaluate(() => {
      const fire = (type, init) => cv.dispatchEvent(new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true }, init)));
      const out = { key: DEVICE.lastInput };
      fire('pointerdown', { pointerType: 'mouse', pointerId: 1, clientX: 600, clientY: 400 }); fire('pointerup', { pointerType: 'mouse', pointerId: 1 });
      out.mouse = DEVICE.lastInput;
      fire('pointerdown', { pointerType: 'pen', pointerId: 7, clientX: 600, clientY: 400 }); fire('pointerup', { pointerType: 'pen', pointerId: 7 });
      out.pen = DEVICE.lastInput;
      setState('paused'); photoEnter();
      const z0 = PHOTO.z;
      fire('pointerdown', { pointerType: 'touch', pointerId: 11, clientX: 500, clientY: 400 });
      fire('pointerdown', { pointerType: 'pen', pointerId: 12, clientX: 700, clientY: 400 });
      fire('pointermove', { pointerType: 'pen', pointerId: 12, clientX: 800, clientY: 400 });   // fingers 200 -> 300 px apart
      out.zoom = +(PHOTO.z / z0).toFixed(2);
      fire('pointerup', { pointerType: 'pen', pointerId: 12 }); fire('pointerup', { pointerType: 'touch', pointerId: 11 });
      out.hint = document.querySelector('.photo-bar .hint').textContent;
      return out;
    });
    await page.click('[data-photo="tools"]');
    const chip = await page.evaluate(() => { const b = document.querySelector('.photo-bar [data-photo="show"]'), rc = b.getBoundingClientRect();
      return { min: PHOTO.bar.classList.contains('min'), text: b.textContent, shown: rc.width > 20 && getComputedStyle(b).display !== 'none' }; });
    await page.screenshot({ path: shot(SHOTS, 'photo-tools-chip') });
    await page.tap('.photo-bar [data-photo="show"]');
    const reopened = await page.evaluate(() => { const open = !PHOTO.bar.classList.contains('min'), hidden = getComputedStyle(document.querySelector('.photo-bar [data-photo="show"]')).display === 'none'; photoExit(); return open && hidden; });
    const ok = r.key === 'key' && r.mouse === 'key' && r.pen === 'touch' && r.zoom >= 1.4 && /pinch/.test(r.hint) && !/Tab/.test(r.hint)
      && chip.min && chip.shown && /Tools/.test(chip.text) && !/Tab/.test(chip.text) && reopened;
    return { ok, note: JSON.stringify({ r, chip, reopened }) };
  }));

  // (21) Audit 7: save codes on a browser without DecompressionStream. The inflater against node zlib vectors (stored,
  // fixed, dynamic blocks), a real save and a 200-code fuzz compressed by CompressionStream('deflate') (repeats for
  // long back-references, one over 64 KB for many blocks), hand-made stored blocks over 64 KB, damaged input; then a
  // 'z' code imported through readSaveCode and the Transfer screen with DecompressionStream deleted.
  await step('save codes without DecompressionStream', () => withDevice('ipadFast', async ({ page }) => {
    const r = await page.evaluate(async vectors => {
      const enc = new TextEncoder(), dec = new TextDecoder(), inflate = SC.savecode.inflate;
      const zip = async bytes => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
      const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
      const out = { vectors: vectors.map(v => dec.decode(inflate(Uint8Array.from(atob(v.b64), c => c.charCodeAt(0)))) === v.text).join() };
      saveSettings();                                   // a fresh page has saved nothing yet (v4 writes no quests at boot)
      const real = enc.encode(JSON.stringify({ v: 1, t: Date.now(), k: saveKeysNow() }));
      out.real = real.length > 50 && same(inflate(await zip(real)), real);
      let seed = 20261014;
      const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296, pick = a => a[Math.floor(rand() * a.length)];
      const words = Array.from({ length: 48 }, (_, i) => 'k' + i.toString(36).repeat(1 + i % 6));
      const value = () => {
        const k = rand();
        if (k < .3) return pick(words);
        if (k < .45) return Math.round(rand() * 1e6) / 100;
        if (k < .6) return { [pick(words)]: rand() < .5, n: Math.floor(rand() * 999), tag: pick(words) };
        if (k < .72) return Array.from({ length: Math.floor(rand() * 8) }, () => Math.floor(rand() * 300));
        if (k < .8) return pick(words).repeat(2 + Math.floor(rand() * 400));
        return String.fromCharCode(...Array.from({ length: 1 + Math.floor(rand() * 40) }, () => 32 + Math.floor(rand() * 2000)));
      };
      const save = size => { const list = []; let n = 0; while (n < size) { const v = value(); list.push(v); n += JSON.stringify(v).length; }
        return enc.encode(JSON.stringify({ v: 1, t: Math.floor(rand() * 1e12), k: { 'stickclash.v2.fuzz': JSON.stringify(list), 'stickclash.v2.misc': JSON.stringify(pick(words)) } })); };
      let pass = 0, maxLen = 0;
      const bad = [];
      for (let i = 0; i < 200; i++) {
        const bytes = save(i === 199 ? 90000 : Math.floor(rand() * rand() * 24000));
        maxLen = Math.max(maxLen, bytes.length);
        let back = null;
        try { back = inflate(await zip(bytes)); } catch (e) { bad.push(i + ': ' + e.message); continue; }
        if (same(back, bytes)) pass++; else bad.push(i + ': differs');
      }
      out.fuzz = { pass, maxLen, bad: bad.slice(0, 3) };
      // Stored blocks by hand: zlib header, blocks of at most 65535 raw bytes, Adler-32 (not checked by the inflater).
      const raw = new Uint8Array(150000).map((_, i) => (Math.imul(i, 2654435761) >>> 24) & 255), parts = [Uint8Array.of(0x78, 0x01)];
      for (let o = 0; o < raw.length; o += 65535) {
        const n = Math.min(65535, raw.length - o), last = o + n >= raw.length ? 1 : 0;
        parts.push(Uint8Array.of(last, n & 255, n >> 8, ~n & 255, (~n >> 8) & 255), raw.subarray(o, o + n));
      }
      parts.push(new Uint8Array(4));
      const stored = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
      parts.reduce((o, p) => { stored.set(p, o); return o + p.length; }, 0);
      out.storedBlocks = same(inflate(stored), raw);
      const cut = (await zip(real)).subarray(0, 12);   // damaged inputs must throw, never hang or return junk silently
      let threw = 0;
      for (const b of [cut, Uint8Array.of(0x78, 0x9c, 0xff, 0xff, 0, 0, 0, 0), Uint8Array.of(1, 2, 3)]) { try { inflate(b); } catch (e) { threw++; } }
      out.damagedThrows = threw;
      const code = await makeSaveCode(), keep = window.DecompressionStream;
      delete window.DecompressionStream;
      out.ds = typeof DecompressionStream;
      try { const data = await readSaveCode(code); out.imported = code.startsWith('SC1z.') && JSON.stringify(data.k) === JSON.stringify(saveKeysNow()); }
      catch (e) { out.imported = 'error: ' + e.message; }
      window.__DS = keep;
      return out;
    }, INFLATE_VECTORS);
    await page.evaluate(() => { XFER.code = ''; XFER.input = ''; XFER.preview = null; openScreen('transfer', 'settings'); });
    await page.waitForFunction(() => /^SC1z\./.test((document.querySelector('[data-key="xfer-out"]') || {}).value || ''), null, { timeout: 5000 }).catch(() => {});
    const code = await page.evaluate(() => document.querySelector('[data-key="xfer-out"]').value);
    await page.fill('[data-key="xfer-in"]', code);
    await page.click('[data-key="xfer-check"]');
    await page.waitForSelector('.xfer-preview', { timeout: 5000 }).catch(() => {});
    const ui = await page.evaluate(() => ({ preview: !!document.querySelector('.xfer-preview'), msg: document.querySelector('#transfer .xfer-msg').textContent, ds: typeof DecompressionStream }));
    await page.evaluate(() => { window.DecompressionStream = window.__DS; XFER.preview = null; XFER.msg = ''; });
    const ok = r.vectors === 'true,true,true' && r.real && r.fuzz.pass === 200 && r.fuzz.maxLen > 65536 && r.storedBlocks && r.damagedThrows === 3
      && r.ds === 'undefined' && r.imported === true && ui.preview && ui.ds === 'undefined' && !ui.msg;
    return { ok, note: JSON.stringify({ r, ui }) };
  }));

  // (22) Audit 9: no "Keep screen awake" toggle where the browser has no wake lock (iPad Safari before 16.4).
  await step('wake-lock toggle only with the API', async () => {
    const r = await withDevice('ipadPro11', async ({ page }) => page.evaluate(() => {
      openScreen('settings', 'menu');
      return { api: !!navigator.wakeLock, toggle: !!document.querySelector('[data-key="Keep screen awake"]'), touchMode: !!document.querySelector('[data-key="Touch controls-auto"]') };
    }), () => { delete Navigator.prototype.wakeLock; });
    return { ok: !r.api && !r.toggle && r.touchMode, note: JSON.stringify(r) };
  });

  // (23) Audit 10: WebKit details in the page: no phone-number links, prefixed CSS next to the standard properties.
  await step('WebKit meta and CSS details', () => withDevice('phone', async ({ page }) => {
    const r = await page.evaluate(() => {
      const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n'), col = document.querySelector('.title-col');
      return { meta: (document.querySelector('meta[name="format-detection"]') || {}).content, sizeAdjust: /html \{ -webkit-text-size-adjust: 100%; \}/.test(css),
        drag: /img \{ -webkit-user-drag: none; \}/.test(css), backdrop: /-webkit-backdrop-filter: blur\(6px\); backdrop-filter: blur\(6px\)/.test(css),
        select: /-webkit-user-select: auto; user-select: auto/.test(css), colTop: col ? Math.round(col.getBoundingClientRect().top) : null };
    });
    const ok = r.meta === 'telephone=no' && r.sizeAdjust && r.drag && r.backdrop && r.select && r.colTop >= 0;
    return { ok, note: JSON.stringify(r) };
  }));

  // (24) v4 thumb arc: Advanced buttons big enough and never touching, in one set and in table mode's two (whose top
  // set starts below the HUD); P2's own pause button, turned with its set, pauses the fight.
  for (const [device, size] of [['ipad97', '1024x768'], ['ipadPro11', '1194x834'], ['ipad129', '1366x1024']]) {
    await step(`touch arc spacing ${size}`, () => withDevice(device, async ({ page, tap }) => {
      const sets = {};
      for (const table of [false, true]) sets[table ? 'table' : 'one'] = await page.evaluate(table => {
        ROTATE_SKIPPED = true; SETTINGS.touchMode = 'on'; SETTINGS.tableMode = table; setScheme(0, 'advanced'); setScheme(1, 'advanced');
        SC.start({ mode: 'pvp', map: 'dojo' }); SC.G.lock = 0;
        if (table) touchSeats(0, 1);
        updateTouchUI();
        const V = SC.view.VIEW, hudB = (V.hudY + V.hudH) / V.dpr, vis = e => e.offsetParent !== null;
        return [...document.querySelectorAll('#touch .tset')].filter(vis).map(box => {
          const r = box.getBoundingClientRect(), b = [...box.querySelectorAll('.tarc button')].filter(vis).map(e => ({ act: e.dataset.act, q: e.getBoundingClientRect() }));
          let gap = 1e9;
          for (const x of b) for (const y of b) if (x !== y) gap = Math.min(gap, Math.hypot(x.q.x + x.q.width / 2 - y.q.x - y.q.width / 2, x.q.y + x.q.height / 2 - y.q.y - y.q.height / 2) - (x.q.width + y.q.width) / 2);
          const p2 = box.querySelector('.tpause2');
          return { n: b.length, gap: +gap.toFixed(1), small: Math.round(Math.min(...b.map(x => x.q.width))),
            inner: Math.round(Math.min(...b.filter(x => /skill|dash|block/.test(x.act)).map(x => x.q.width))),
            outside: b.filter(x => x.q.left < r.left - 1 || x.q.right > r.right + 1 || x.q.top < r.top - 1 || x.q.bottom > r.bottom + 1).map(x => x.act),
            belowHud: r.top >= hudB, pause: p2 && vis(p2) ? (q => [q.x + q.width / 2, q.y + q.height / 2, q.top >= hudB])(p2.getBoundingClientRect()) : null };
        });
      }, table);
      const p2 = sets.table[1] && sets.table[1].pause;
      if (p2) await tap(Math.round(p2[0]), Math.round(p2[1]));
      await page.waitForTimeout(150);
      const paused = await page.evaluate(() => SC.G.state);
      await page.screenshot({ path: shot(SHOTS, `touch-arc-${size}`) });
      const all = sets.one.concat(sets.table);
      const ok = sets.one.length === 1 && sets.table.length === 2 && all.every(t => t.n === 10 && t.gap >= 6 && t.small >= 44 && t.inner >= 48 && !t.outside.length)
        && sets.table[1].belowHud && p2 && p2[2] && paused === 'paused';
      return { ok, note: JSON.stringify({ sets, paused }) };
    }));
  }

  // (24) Nothing above logged an error in any context.
  await step('no console or page errors', async () => ({ ok: !allErrors.length, note: allErrors.join(' | ') }));
}
module.exports = { run };

if (require.main === module) {
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  const fails = [], rows = [], SHOTS = path.join(ROOT, 'tmp', 'smoke');
  require('fs').mkdirSync(SHOTS, { recursive: true });
  (async () => {
    const browser = await chromium.launch();
    try { await run(browser, { check: (ok, what) => { if (!ok) fails.push(what); return ok; }, rows, SHOTS }); }
    catch (e) { fails.push('crashed: ' + e.stack); }
    finally { await browser.close(); }
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: (r.note || '').slice(0, 160) })));
    if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
    console.log('IPAD SMOKE OK');
  })();
}
