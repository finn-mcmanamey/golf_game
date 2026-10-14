// Smoke tests for the v4 arena art styles (59-styles: ink, pixel, paper, chalk; neon stays the default look).
// Called by tools/smoke.cjs; also runs on its own (`node tools/smoke-styles.cjs`, after `node build.mjs`).
// - every styled arena (defMap `style`) renders with 2 and 8 fighters at 1280x720 and 1194x834: no errors, no NaN,
//   the right style active; screenshots tmp/smoke/style-<style>-<arena>-<w>x<h>-<n>.png;
// - the pixel layer: smoothing off, a size from the viewport that stays put, no canvases made per frame;
// - Settings → Effects → "Arena art": "Neon everywhere" restores neon (saved), "Per arena" brings the styles back;
// - a kill-cam replay and a photo-mode PNG save in styled arenas; the arena thumbnails draw in style;
// - render time per style with 8 fighters vs neon on the same arena (limit 1.5x).
// - readability: floating labels keep a plain dark outline in chalk (not light chalk grain); ink fighters and their
//   weapons leave a paper halo when drawn over solid ink (the Dojo's gate); light styles fill the letterbox in style.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const EXPECT = { dojo: 'ink', jungle: 'ink', moon: 'pixel', factory: 'pixel', candy: 'paper', kitchen: 'paper', spikepit: 'chalk', graveyard: 'chalk' };
const PERF_LIMIT = 1.5;

async function openPage(browser, size = { width: 1280, height: 720 }) {
  const page = await browser.newPage({ viewport: size }), errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  return { page, errors };
}

// Starts a CPU match on an arena with n fighters, simulates a little (checking for NaN) and draws a few frames.
const START = `(map, n, secs) => {
  const e0 = SC.errors.length;
  SC.start({ mode: 'watch', map, fighters: n });
  SC.G.lock = 0;
  let nan = false;
  for (let t = 0; t < secs && !nan; t += .5) { SC.sim(.5); nan = SC.F.some(f => f.P.some(p => !Number.isFinite(p.x + p.y))); }
  SC.G.state = 'paused'; BANNER = null;
  for (let k = 0; k < 4; k++) SC.render(1 / 60);
  return { nan, style: SC.styles.ART.style && SC.styles.ART.style.key, of: SC.styles.of(map), errors: SC.errors.slice(e0).map(e => e.msg), n: SC.F.length };
}`;

async function testArenas(browser, { check, rows, SHOTS }) {
  for (const size of [{ width: 1280, height: 720 }, { width: 1194, height: 834 }]) {
    const { page, errors } = await openPage(browser, size);
    const styled = await page.evaluate(() => Object.values(SC.reg.MAPS).filter(m => m.style && m.style !== 'neon').map(m => [m.key, m.style]));
    const tag = `${size.width}x${size.height}`;
    check(Object.keys(EXPECT).every(k => styled.some(([m, s]) => m === k && s === EXPECT[k])), `styles: arena mapping ${JSON.stringify(styled)}`);
    for (const [map, style] of styled) {
      for (const n of [2, 8]) {
        const r = await page.evaluate(`(${START})(${JSON.stringify(map)}, ${n}, 2)`);
        await page.waitForTimeout(60);
        await page.screenshot({ path: path.join(SHOTS, `style-${style}-${map}-${tag}-${n}.png`) });
        const ok = check(!r.errors.length && !errors.length, `style ${map} ${tag} x${n}: errors ${r.errors.concat(errors).join(' | ')}`)
          & check(!r.nan, `style ${map} ${tag} x${n}: NaN positions`)
          & check(r.style === style && r.of === style, `style ${map} ${tag}: drew in ${r.style} (expected ${style})`)
          & check(r.n >= n, `style ${map} x${n}: only ${r.n} fighters`);
        rows.push({ kind: 'style', key: `${style} ${map} ${tag} x${n}`, ok: !!ok });
      }
    }
    await page.close();
  }
}

// The pixel layer: smoothing off, ~1/4 of the viewport's CSS size, the same canvas every frame, nothing allocated.
async function testPixelLayer(browser, { check, rows }) {
  const { page, errors } = await openPage(browser);
  const r = await page.evaluate(`(${START})('moon', 8, 1)`);
  const L = await page.evaluate(() => {
    const make = document.createElement.bind(document);
    let made = 0;
    document.createElement = (tag, o) => { if (String(tag).toLowerCase() === 'canvas') made++; return make(tag, o); };
    const before = SC.styles.layer();
    for (let k = 0; k < 60; k++) SC.render(1 / 60);
    document.createElement = make;
    return { before, after: SC.styles.layer(), made, css: [innerWidth, innerHeight] };
  });
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.waitForTimeout(150);
  const L2 = await page.evaluate(() => { for (let k = 0; k < 5; k++) SC.render(1 / 60); return SC.styles.layer(); });
  const ok = check(L.after && L.after.smooth === false, `style pixel: layer smoothing ${L.after && L.after.smooth}`)
    & check(L.before.sizes === L.after.sizes && L.before.w === L.after.w && L.before.h === L.after.h, `style pixel: layer size changed over frames ${JSON.stringify(L)}`)
    & check(Math.abs(L.after.w - 320) <= 2 && Math.abs(L.after.h - 180) <= 2, `style pixel: layer ${L.after.w}x${L.after.h} for a 1280x720 view`)
    & check(L.made === 0, `style pixel: ${L.made} canvases made in 60 frames`)
    & check(L2.sizes === L.after.sizes + 1 && Math.abs(L2.w - 250) <= 2, `style pixel: resize gave ${JSON.stringify(L2)}`)
    & check(!r.errors.length && !errors.length, `style pixel layer: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'style', key: 'pixel layer', ok: !!ok, note: `${L.after.w}x${L.after.h}, then ${L2.w}x${L2.h}` });
  await page.close();
}

// No style keeps making canvases once warmed up (chalk patterns and backdrops are cached).
async function testNoAllocs(browser, { check, rows }) {
  const { page } = await openPage(browser);
  const res = await page.evaluate(`(async () => {
    const out = {};
    for (const map of ['dojo', 'candy', 'graveyard', 'spikepit']) {
      (${START})(map, 8, 1);
      for (let k = 0; k < 30; k++) SC.render(1 / 60);
      const make = document.createElement.bind(document);
      let made = 0;
      document.createElement = (tag, o) => { if (String(tag).toLowerCase() === 'canvas') made++; return make(tag, o); };
      for (let k = 0; k < 60; k++) SC.render(1 / 60);
      document.createElement = make;
      out[map] = made;
    }
    return out;
  })()`);
  const bad = Object.entries(res).filter(([, n]) => n > 2);
  const ok = check(!bad.length, `style caches: canvases made per 60 frames ${JSON.stringify(res)}`);
  rows.push({ kind: 'style', key: 'cached textures', ok: !!ok, note: JSON.stringify(res) });
  await page.close();
}

// Settings → Effects → Arena art: Neon everywhere (saved) restores the neon look; Per arena brings the styles back.
async function testSetting(browser, { check, rows, SHOTS }) {
  const { page, errors } = await openPage(browser);
  await page.evaluate(() => openScreen('settings', 'menu'));
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll('#settings .lbl')).map(e => e.textContent));
  await page.click('#settings [data-key="Arena art-neon"]');
  const neon = await page.evaluate(`(() => { const r = (${START})('dojo', 4, 1); return Object.assign(r, { saved: store.getObj('settings').arenaArt
 }); })()`);
  await page.screenshot({ path: path.join(SHOTS, 'style-neon-everywhere.png') });
  await page.evaluate(() => { toMenu(); openScreen('settings', 'menu'); });
  await page.click('#settings [data-key="Arena art-arena"]');
  const back = await page.evaluate(`(${START})('dojo', 4, 1)`);
  const thumbs = await page.evaluate(() => { SC.styles.reset(); return ['dojo', 'moon', 'candy', 'graveyard'].map(k => (mapThumb(k) || '').length); });
  const ok = check(labels.includes('Arena art'), `style setting: no "Arena art" in Settings (${labels.join(', ')})`)
    & check(neon.style === 'neon' && neon.of === 'neon' && neon.saved === 'neon', `style setting: neon everywhere gave ${JSON.stringify(neon)}`)
    & check(back.style === 'ink', `style setting: per arena gave ${back.style}`)
    & check(thumbs.every(n => n > 1000), `style thumbnails: ${thumbs}`)
    & check(!neon.errors.length && !back.errors.length && !errors.length, `style setting: errors ${neon.errors.concat(back.errors, errors).join(' | ')}`);
  rows.push({ kind: 'style', key: 'Arena art setting', ok: !!ok });
  await page.close();
}

// A K.O. replayed by the kill-cam in a chalk arena, and photo mode saving a PNG in an ink arena.
async function testKillcamPhoto(browser, { check, rows, SHOTS }) {
  const { page, errors } = await openPage(browser);
  await page.evaluate(() => { startMatch({ mode: 'versus', map: 'spikepit' }); SC.G.lock = 0; for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; } });
  await page.waitForTimeout(2200);
  await page.evaluate(() => { SC.G.score[0] = SC.G.winScore - 1; damage(SC.F[1], 999, { src: SC.F[0], kind: 'melee', nx: 1, ny: -.3 }); });
  const played = await page.waitForFunction(() => KC.play && KC.play.clock > KC.play.ko.t + .15, null, { timeout: 9000 }).then(() => true).catch(() => false);
  const kc = await page.evaluate(() => ({ state: SC.G.state, style: SC.styles.ART.style.key }));
  await page.screenshot({ path: path.join(SHOTS, 'style-chalk-killcam.png') });
  await page.evaluate(() => SC.killcam.skip());
  await page.evaluate(() => { toMenu(); SC.start({ mode: 'versus', map: 'dojo' }); SC.G.lock = 0; SC.sim(1.5); SC.setState('paused'); });
  await page.click('#pause [data-key="photo"]');
  await page.click('[data-photo="filter-sepia"]').catch(() => {});
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(SHOTS, 'style-ink-photo.png') });
  await page.click('[data-photo="save"]');
  await page.waitForFunction(() => SC.photo.state.last, null, { timeout: 5000 }).catch(() => {});
  const saved = await page.evaluate(() => SC.photo.state.last);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const err = await page.evaluate(() => SC.errors.map(e => e.msg));
  const ok = check(played && kc.state === 'killcam' && kc.style === 'chalk', `style kill-cam: ${JSON.stringify(kc)} played ${played}`)
    & check(saved && saved.bytes > 1000, `style photo: PNG not saved (${JSON.stringify(saved)})`)
    & check(!err.length && !errors.length, `style kill-cam/photo: errors ${err.concat(errors).join(' | ')}`);
  rows.push({ kind: 'style', key: 'kill-cam + photo', ok: !!ok, note: saved ? `${saved.w}x${saved.h} ${(saved.bytes / 1024).toFixed(0)} KB` : '' });
  await page.close();
}

// Readability fixes: chalk label outlines unmapped, the ink halo around bodies and weapons, a styled letterbox.
async function testReadability(browser, { check, rows }) {
  const { page, errors } = await openPage(browser);
  const r = await page.evaluate(() => {
    SC.start({ mode: 'versus', map: 'spikepit', weapons: ['katana', 'katana'] }); SC.G.state = 'paused'; SC.G.lock = 0; BANNER = null;
    float(640, 300, 'PARRY!', '#9fe8ff', 30);
    const seen = [], st = CanvasRenderingContext2D.prototype.strokeText;
    CanvasRenderingContext2D.prototype.strokeText = function (t, ...a) { if (t === 'PARRY!') seen.push(this.strokeStyle); return st.call(this, t, ...a); };
    try { SC.render(1 / 60); } finally { CanvasRenderingContext2D.prototype.strokeText = st; }
    // Ink: a fighter and its katana drawn over solid ink (as in front of the torii gate) must leave paper pixels.
    SC.start({ mode: 'versus', map: 'dojo', weapons: ['katana', 'katana'] }); SC.G.state = 'paused'; SC.G.lock = 0;
    const f = SC.F[0], c = document.createElement('canvas'), g = c.getContext('2d'), keep = ctx;
    c.width = c.height = 260;
    const paper = () => { const d = g.getImageData(0, 0, 260, 260).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 190 && d[i + 2] > 160) n++; return n; };
    g.fillStyle = ART_INK; g.fillRect(0, 0, 260, 260); g.translate(130 - f.P[2].x, 150 - f.P[2].y);
    STYLES.ink.body(g, f, f.color, f.scale, 1);
    const body = paper();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillRect(0, 0, 260, 260); g.restore();
    ART.style = STYLES.ink; ctx = artProxy(g, STYLES.ink);
    try { artWeaponShadow(f, f.main, weaponView(f, f.main)); } finally { ctx = keep; }
    return { seen: seen.map(x => typeof x === 'string' ? x : 'pattern'), body, weapon: paper(), errors: SC.errors.map(e => e.msg) };
  });
  await page.setViewportSize({ width: 1194, height: 834 });   // 4:3: a letterbox band under the arena
  await page.waitForTimeout(150);
  r.frame = await page.evaluate(() => ['spikepit', 'neon'].map(map => {
    SC.start({ mode: 'versus', map }); SC.G.state = 'paused'; SC.render(1 / 60);
    return [...CTX_MAIN.getImageData(0, cv.height - 1, 1, 1).data.slice(0, 3)].join();
  }));
  const ok = check(r.seen.length > 0 && r.seen.every(x => x === '#07080f'), `style chalk: label outline drawn with ${r.seen.join()}`)
    & check(r.body > 150 && r.weapon > 40, `style ink: halo paper pixels body ${r.body}, weapon ${r.weapon}`)
    & check(r.frame[0] === '58,42,30' && r.frame[1] === '5,6,12', `style letterbox: chalk ${r.frame[0]}, neon ${r.frame[1]}`)
    & check(!r.errors.length && !errors.length, `style readability: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'style', key: 'readability (chalk text, ink halo, frame)', ok: !!ok, note: JSON.stringify({ seen: r.seen, body: r.body, weapon: r.weapon }) });
  await page.close();
}

// Render time with 8 fighters in each styled arena, against the same arena forced to neon (alternating blocks).
async function testPerf(browser, { check, rows }) {
  const { page, errors } = await openPage(browser);
  const res = await page.evaluate(`(() => {
    // Each frame is read back (one pixel, through a tiny canvas) so the measured time includes the rasterising that
    // the browser would otherwise defer: neon's bloom reads the canvas anyway, the other styles don't.
    const fc = document.createElement('canvas'), fg = fc.getContext('2d', { willReadFrequently: true }), cv = document.getElementById('c');
    fc.width = fc.height = 1;
    const out = {}, time = n => { const t0 = performance.now(); for (let k = 0; k < n; k++) { SC.render(1 / 60); fg.drawImage(cv, 0, 0, 1, 1); fg.getImageData(0, 0, 1, 1); } return performance.now() - t0; };
    for (const [map, style] of Object.entries(${JSON.stringify(EXPECT)})) {
      (${START})(map, 8, 1.5);
      let styled = 0, neon = 0;
      for (const art of ['arena', 'neon']) { SETTINGS.arenaArt = art; time(8); }   // warm both (the backdrop cache, bloom)
      for (let b = 0; b < 6; b++) { SETTINGS.arenaArt = 'arena'; styled += time(8); SETTINGS.arenaArt = 'neon'; neon += time(8); }
      SETTINGS.arenaArt = 'arena';
      out[map] = { style, styled: styled / 48, neon: neon / 48 };
    }
    return out;
  })()`);
  const by = {};
  for (const [map, r] of Object.entries(res)) {
    const k = r.styled / r.neon;
    if (!by[r.style] || k > by[r.style].k) by[r.style] = { k, map, styled: r.styled, neon: r.neon };
  }
  for (const [style, b] of Object.entries(by)) {
    const ok = check(b.k <= PERF_LIMIT, `style ${style}: render ${b.styled.toFixed(2)} ms vs neon ${b.neon.toFixed(2)} ms on ${b.map} (x${b.k.toFixed(2)} > ${PERF_LIMIT})`);
    rows.push({ kind: 'style', key: `perf ${style}`, ok: !!ok, note: `worst ${b.map}: ${b.styled.toFixed(2)} vs ${b.neon.toFixed(2)} ms (x${b.k.toFixed(2)})` });
  }
  check(!errors.length, `style perf: errors ${errors.join(' | ')}`);
  await page.close();
  return res;
}

async function run(browser, ctx) {
  fs.mkdirSync(ctx.SHOTS, { recursive: true });
  await testArenas(browser, ctx);
  await testPixelLayer(browser, ctx);
  await testNoAllocs(browser, ctx);
  await testSetting(browser, ctx);
  await testKillcamPhoto(browser, ctx);
  await testReadability(browser, ctx);
  return testPerf(browser, ctx);
}
module.exports = { run, perf: testPerf };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const failures = [], rows = [], SHOTS = path.join(ROOT, 'tmp', 'smoke');
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    const browser = await chromium.launch();
    try { const perf = await run(browser, { check, rows, SHOTS }); console.log(JSON.stringify(perf)); }
    catch (e) { failures.push('crashed: ' + (e.stack || e.message)); }
    finally { await browser.close(); }
    console.table(rows.map(r => ({ kind: r.kind, key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note || '' })));
    if (failures.length) { console.error('\nSTYLES FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
    console.log(`\nSTYLES OK: ${rows.length} checks`);
  })();
}
