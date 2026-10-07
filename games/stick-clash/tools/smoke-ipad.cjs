// Smoke tests for the iPad / device layer (92-device, 80-audio, 84-quality, 86-photo, 89-gif, 89-replays, the touch
// seat in 93-pads and the per-seat one-button mode in 92-access). Called by tools/smoke.cjs; also runs on its own
// (`node tools/smoke-ipad.cjs`, after `node build.mjs`). Chromium only, with iPad-shaped contexts (Safari UA, touch,
// 2x) driven through CDP touch events:
// - touch controls follow the latest input (touch / key / pad) and SETTINGS.touchMode; typing never hides them;
// - a trackpad iPad still counts as a touch device; audio unlocks on a touch or a click; the announcer warms up once;
// - fullscreen refusal toasts (and no button where fullscreen is unavailable); the rotate card pauses in portrait but
//   never in Split View; the "turn sound on" strip for pad-only starts; the lobby's touch seat;
// - MP4-first export naming, the GIF export without MediaRecorder, the GIF encoder and the filter bake;
// - the benchmark picks and stores a tier (and leaves Custom alone); one-button mode on seat P3 only.
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
  portrait: ipad(834, 1194),
  splitView: ipad(507, 834, { screen: { width: 1194, height: 834 } }),
  trackpad: ipad(1194, 834, { isMobile: false }),
  ipadFast: ipad(1194, 834, { deviceScaleFactor: 1 }),   // 1x: real-time steps (kill-cam frames, benchmark) run at a usable rate headless
};
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
  return { ctx, page, errors, touch, tap, pageErrors };
}
const shot = (SHOTS, name) => path.join(SHOTS, `ipad-${name}.png`);

async function run(browser, { check, rows, SHOTS }) {
  const allErrors = [];
  let stepKey = '';
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

  // (4) Audio unlocks on a touch (touchend / pointer) and on a click; the announcer warms speech up once.
  await step('audio unlocks on touch and click', async () => {
    const t = await withDevice('ipadPro11', async ({ page, tap }) => {
      const before = await page.evaluate(() => AC === null);
      await tap(700, 700);
      const after = await page.evaluate(() => AC !== null);
      return { before, after };
    });
    const c = await withDevice('ipadPro11', async ({ page }) => {
      await page.mouse.click(700, 700);
      return page.evaluate(() => ({ ac: AC !== null, warmed: ANN.warmed, mode: SETTINGS.announcer }));
    });
    return { ok: t.before && t.after && c.ac && c.warmed, note: JSON.stringify({ touch: t, click: c }) };
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
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(60);
    const gone = await page.evaluate(() => !document.getElementById('soundbar'));
    return { ok: shown.bar && shown.last === 'pad' && !shown.touch && gone, note: JSON.stringify(shown) + ` gone ${gone}` };
  }, () => { const Base = window.AudioContext; window.AudioContext = class extends Base { get state() { return 'suspended'; } }; }));

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
    const started = await page.evaluate(() => { toMenu(); window.MediaRecorder = undefined; return { how: SC.export.how(), ok: SC.highlights.export(SC.highlights.HL.clips[0]) }; });
    await page.waitForFunction(() => SC.highlights.HL.lastExport, null, { timeout: 40000 }).catch(() => {});
    const exp = await page.evaluate(() => SC.highlights.HL.lastExport);
    const modal = await page.evaluate(() => ({ img: !!document.querySelector('.fx-modal img.fx-preview'), download: !!document.querySelector('.fx-modal [data-key="fx-download"]'),
      share: !!document.querySelector('.fx-modal [data-key="fx-share"]'), hint: (document.querySelector('.fx-modal .hint') || {}).textContent }));
    await page.screenshot({ path: shot(SHOTS, 'export-1194x834') });
    await page.keyboard.press('Escape');
    const ok = units.mime === 'video/mp4' && /\.mp4$/.test(units.name) && units.how === 'video' && units.gifHead === 'GIF89a' && units.gifFrames === 2
      && units.bake[0] === units.bake[1] && units.bake[1] === units.bake[2] && clips >= 1 && started.how === 'gif' && started.ok
      && exp && exp.type === 'image/gif' && exp.size > 1000 && modal.img && modal.download && /GIF/.test(modal.hint);
    return { ok, note: JSON.stringify({ units, clips, started, exp, modal: { img: modal.img, download: modal.download, share: modal.share } }) };
  }));

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

  // (18) Nothing above logged an error in any context.
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
