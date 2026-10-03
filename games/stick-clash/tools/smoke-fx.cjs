// Smoke tests for the audio/visual slices: announcer (82), crowd (83), per-arena + dynamic music (81), bloom, lights
// and impacts (84), photo mode (86) and highlight replays + video export (89).
// Called by tools/smoke.cjs; also runs on its own (`node tools/smoke-fx.cjs`, after `node build.mjs`).
// - a real-time CPU duel with NO AudioContext and NO speechSynthesis: callouts are logged, a highlight is captured;
// - the same with audio: synth announcer, crowd reactions, every arena's music theme scheduled at full intensity;
// - bloom off / low / high with WebGL, and the 2D fallback with WebGL blocked;
// - photo mode from the pause menu: every filter and frame, PNG save, back to pause;
// - the Highlights screen: play a clip through the kill-cam and export it as WebM (MediaRecorder).
// Screenshots: tmp/smoke/fx-*.png.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

async function openPage(browser, init) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  if (init) await page.addInitScript(init);
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  return { page, errors };
}

// Plays a CPU duel to one point in real time (low health so it ends quickly) and waits for the results.
async function playToResults(page) {
  await page.evaluate(() => { SC.start({ mode: 'watch', winScore: 1, map: 'neon', weapons: ['katana', 'battle-axe'] }); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { for (const f of SC.F) f.hp = 18; });
  await page.waitForFunction(() => SC.G.state === 'over', null, { timeout: 60000 }).catch(() => {});
  return page.evaluate(() => SC.G.state);
}

async function testNoAudio(browser, { check, rows }) {
  const { page, errors } = await openPage(browser, () => {
    delete window.AudioContext; delete window.webkitAudioContext; delete window.speechSynthesis; delete window.SpeechSynthesisUtterance;
  });
  await page.keyboard.press('KeyX');
  const state = await playToResults(page);
  const r = await page.evaluate(() => ({
    ann: SC.announcer.log.map(a => a.text), mode: SC.announcer.mode(), clips: SC.highlights.HL.clips.length,
    roar: crowdReact('roar'), crowd: CROWD.log.slice(), errors: SC.errors.map(e => e.msg),
    themes: Object.keys(SC.reg.MAPS).map(k => { const th = MUSIC_THEMES[musicArenaTheme(k)]; return [th.bpm, th.root, th.drums, th.bass, th.arp, th.lead, th.a.join()].join('|'); }),
  }));
  const distinct = new Set(r.themes).size;
  const ok = check(state === 'over', `fx no-audio: match never finished (${state})`)
    & check(r.ann.includes('Round one') && r.ann.includes('Fight!'), `fx no-audio: no round/fight callouts (${r.ann.join(', ')})`)
    & check(r.ann.some(t => /K\.O\.|Time|Game|You/.test(t)), `fx no-audio: no K.O./result callout (${r.ann.join(', ')})`)
    & check(r.mode === 'none', `fx no-audio: announcer mode ${r.mode}`)
    & check(r.roar && r.crowd.includes('roar'), 'fx no-audio: crowd reaction not logged')
    & check(distinct === r.themes.length, `fx music: only ${distinct}/${r.themes.length} distinct arena styles`)
    & check(r.clips >= 1, 'fx no-audio: no highlight clip captured')
    & check(!r.errors.length && !errors.length, `fx no-audio: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'fx', key: 'no-audio duel', ok: !!ok, note: `${r.ann.length} calls, ${distinct} arena themes, ${r.clips} clip` });
  await page.close();
}

async function testAudio(browser, { check, rows, SHOTS }) {
  const { page, errors } = await openPage(browser);
  await page.keyboard.press('KeyX');
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    Object.assign(SC.postfx.bloom, { allowSoftware: true, failed: false });   // headless WebGL is software (SwiftShader): test the shader path anyway
    const out = { ac: !!AC };
    SC.start({ mode: 'watch', fighters: 4 });
    SC.G.lock = 0;
    SETTINGS.announcer = 'synth';
    out.said = SC.announcer.say('K.O.!', 3) && SC.announcer.say('Perfect!', 3);
    out.mode = SC.announcer.mode();
    out.crowd = ['ooh', 'gasp', 'boo', 'clap', 'roar'].map(k => { CROWD.last = {}; return crowdReact(k); }).every(Boolean);
    SETTINGS.announcer = 'voice';
    out.errors = SC.errors.map(e => e.msg);
    return out;
  });
  // The theme switches on the next bar line (a menu bar is ~2.6 s).
  await page.waitForFunction(() => /^map:/.test(MUSIC.theme || ''), null, { timeout: 8000 }).catch(() => {});
  const theme = await page.evaluate(() => MUSIC.theme);
  // Every arena's theme for one bar at full intensity (all layers), muted so the audio thread isn't flooded.
  const musicErr = await page.evaluate(() => {
    if (!AC || !musicNodes()) return [];
    const e0 = SC.errors.length;
    MUSIC_DYN.level = 1;
    try {
      for (const k of Object.keys(SC.reg.MAPS)) { const th = MUSIC_THEMES[musicArenaTheme(k)]; for (let s = 0; s < 16; s++) musicStep(AC.currentTime + 2, s, th); }
    } catch (e) { return [e.message]; } finally { MUSIC_DYN.level = 0; }
    return SC.errors.slice(e0).map(e => e.msg);
  });
  r.errors.push(...musicErr);
  const ok = check(r.said && r.crowd, 'fx audio: announcer or crowd call refused')
    & check(!r.ac || /^map:/.test(theme || ''), `fx audio: arena music not playing (${theme})`)
    & check(!r.errors.length && !errors.length, `fx audio: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'fx', key: 'audio', ok: !!ok, note: `AudioContext ${r.ac}, announcer ${r.mode}, theme ${theme}` });
  await testBloom(page, { check, rows, SHOTS, errors });
  await page.close();
}

// Freezes one 8-fighter frame and screenshots it with bloom off / low / high, plus a lighting + impact moment.
async function testBloom(page, { check, rows, SHOTS, errors }) {
  await page.evaluate(() => { SC.start({ mode: 'watch', fighters: 8, map: 'caldera' }); SC.G.lock = 0; SC.sim(2.5); SC.G.state = 'paused'; });
  const modes = {};
  for (const q of ['off', 'low', 'high']) {
    modes[q] = await page.evaluate(q => { SETTINGS.bloom = q; SC.render(1 / 60); const b = document.getElementById('bloom');
      return { mode: SC.postfx.bloom.mode, shown: !!b && b.style.display !== 'none' }; }, q);
    await page.screenshot({ path: path.join(SHOTS, `fx-bloom-${q}.png`) });
  }
  await page.evaluate(() => {
    SETTINGS.juice = 'chaos'; SETTINGS.bloom = 'high';
    const [a, b] = SC.F, c = chest(b);
    postfxImpact(c.x, c.y, 1, -.2, 26, '#ff5ad1', b.id); postfxLight(chest(a).x, chest(a).y, 200, '#ffb050', 1, 1.2);
    explode(c.x + 120, c.y, 90, 0, null, { kind: 'skill' });
    SC.G.t += .03; SC.render(1 / 60);
  });
  await page.screenshot({ path: path.join(SHOTS, 'fx-lighting.png') });
  const err = await page.evaluate(() => { SETTINGS.juice = 'normal'; SETTINGS.bloom = 'low'; return SC.errors.map(e => e.msg); });
  const ok = check(!modes.off.shown, 'fx bloom: overlay shown with bloom off')
    & check(modes.low.mode === 'webgl' && modes.high.mode === 'webgl', `fx bloom: WebGL path did not run (${modes.high.mode})`)
    & check(modes.low.mode !== 'webgl' || modes.low.shown, 'fx bloom: WebGL overlay hidden at low')
    & check(!err.length && !errors.length, `fx bloom: errors ${err.concat(errors).join(' | ')}`);
  rows.push({ kind: 'fx', key: 'bloom', ok: !!ok, note: `path ${modes.high.mode}` });
}

async function testBloomFallback(browser, { check, rows, SHOTS }) {
  const { page, errors } = await openPage(browser, () => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, o) { return /webgl/.test(kind) ? null : get.call(this, kind, o); };
  });
  const r = await page.evaluate(() => {
    SETTINGS.bloom = 'high'; SC.start({ mode: 'watch', fighters: 4, map: 'neon' }); SC.G.lock = 0; SC.sim(1.5); SC.G.state = 'paused';
    SC.render(1 / 60); SC.render(1 / 60);
    return { mode: SC.postfx.bloom.mode, errors: SC.errors.map(e => e.msg) };
  });
  await page.screenshot({ path: path.join(SHOTS, 'fx-bloom-2d.png') });
  const ok = check(r.mode === '2d', `fx bloom fallback: mode ${r.mode}`)
    & check(!r.errors.length && !errors.length, `fx bloom fallback: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'fx', key: 'bloom 2D fallback', ok: !!ok });
  await page.close();
}

async function testPhoto(browser, { check, rows, SHOTS }) {
  const { page, errors } = await openPage(browser);
  await page.evaluate(() => { SC.start({ mode: 'versus', map: 'candy' }); SC.G.lock = 0; SC.sim(1.5); SC.setState('paused'); });
  await page.click('#pause [data-key="photo"]');
  const entered = await page.evaluate(() => SC.G.state);
  await page.click('[data-photo="zoom-in"]');
  const shots = [];
  for (const f of ['neon', 'noir', 'sepia', 'vapor']) {
    await page.click(`[data-photo="filter-${f}"]`);
    await page.click(`[data-photo="frame-${f === 'noir' ? 'cinema' : f === 'sepia' ? 'polaroid' : 'neon'}"]`);
    await page.waitForTimeout(80);
    await page.screenshot({ path: path.join(SHOTS, `fx-photo-${f}.png`) }); shots.push(f);
  }
  await page.mouse.move(640, 300); await page.mouse.down(); await page.mouse.move(540, 330); await page.mouse.up();
  await page.click('[data-photo="save"]');
  await page.waitForFunction(() => SC.photo.state.last, null, { timeout: 5000 }).catch(() => {});
  const saved = await page.evaluate(() => SC.photo.state.last);
  await page.keyboard.press('Enter');          // closes the preview
  await page.keyboard.press('Escape');         // leaves photo mode
  const r = await page.evaluate(() => ({ state: SC.G.state, override: !!SC.G.override, filter: document.getElementById('c').style.filter, errors: SC.errors.map(e => e.msg) }));
  const ok = check(entered === 'photo', `fx photo: state ${entered}`)
    & check(saved && saved.bytes > 1000, `fx photo: PNG not saved (${JSON.stringify(saved)})`)
    & check(r.state === 'paused' && !r.override && !r.filter, `fx photo: exit left ${JSON.stringify(r)}`)
    & check(!r.errors.length && !errors.length, `fx photo: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'fx', key: 'photo mode', ok: !!ok, note: saved ? `${saved.w}x${saved.h} ${(saved.bytes / 1024).toFixed(0)} KB` : '' });
  await page.close();
}

async function testHighlights(browser, { check, rows, SHOTS }) {
  const { page, errors } = await openPage(browser);
  await page.keyboard.press('KeyX');
  await playToResults(page);
  await page.click('#over [data-key="hl-open"]').catch(() => {});
  await page.waitForTimeout(400);
  const screen = await page.evaluate(() => ({ open: !!document.querySelector('#highlights .hl-card'), clips: SC.highlights.HL.clips.length }));
  await page.screenshot({ path: path.join(SHOTS, 'fx-highlights.png') });
  await page.click('#highlights .hl-card .go').catch(() => {});
  await page.waitForTimeout(500);
  const played = await page.evaluate(() => SC.G.state);
  await page.screenshot({ path: path.join(SHOTS, 'fx-highlight-replay.png') });
  await page.waitForFunction(() => SC.G.state === 'menu', null, { timeout: 20000 }).catch(() => {});
  const back = await page.evaluate(() => ({ state: SC.G.state, screen: UI.screen, demo: SC.G.demo }));
  const why = await page.evaluate(() => SC.highlights.support());
  await page.click('#highlights [data-key^="hl-export"]').catch(() => {});
  await page.waitForFunction(() => SC.highlights.HL.lastExport, null, { timeout: 25000 }).catch(() => {});
  const exp = await page.evaluate(() => SC.highlights.HL.lastExport);
  const err = await page.evaluate(() => SC.errors.map(e => e.msg));
  const ok = check(screen.open && screen.clips >= 1, `fx highlights: screen ${JSON.stringify(screen)}`)
    & check(played === 'killcam', `fx highlights: play gave state ${played}`)
    & check(back.state === 'menu' && back.screen === 'highlights' && back.demo, `fx highlights: after replay ${JSON.stringify(back)}`)
    & check(exp && (exp.size > 1000 || (why && exp.error)), `fx highlights: export ${JSON.stringify(exp)}`)
    & check(!err.length && !errors.length, `fx highlights: errors ${err.concat(errors).join(' | ')}`);
  rows.push({ kind: 'fx', key: 'highlights', ok: !!ok, note: exp && exp.size ? `webm ${(exp.size / 1024).toFixed(0)} KB` : (exp && exp.error) || '' });
  await page.close();
}

// The Settings screen shows the new controls.
async function testSettings(browser, { check, rows }) {
  const { page, errors } = await openPage(browser);
  await page.evaluate(() => openScreen('settings', 'menu'));
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll('#settings .lbl')).map(e => e.textContent));
  const need = ['Juice', 'Bloom glow', 'Dynamic lights', 'Announcer', 'Announcer volume', 'Crowd'];
  await page.click('#settings [data-key="Juice-chaos"]');
  const juice = await page.evaluate(() => ({ juice: SETTINGS.juice, part: FX.partMul }));
  await page.click('#settings [data-key="Juice-normal"]');
  const missing = need.filter(n => !labels.includes(n));
  const ok = check(!missing.length, `fx settings: missing ${missing.join(', ')}`)
    & check(juice.juice === 'chaos' && juice.part > 1, `fx settings: chaos juice not applied ${JSON.stringify(juice)}`)
    & check(!errors.length, `fx settings: errors ${errors.join(' | ')}`);
  rows.push({ kind: 'fx', key: 'settings', ok: !!ok });
  await page.close();
}

async function run(browser, ctx) {
  fs.mkdirSync(ctx.SHOTS, { recursive: true });
  await testNoAudio(browser, ctx);
  await testAudio(browser, ctx);
  await testBloomFallback(browser, ctx);
  await testPhoto(browser, ctx);
  await testHighlights(browser, ctx);
  await testSettings(browser, ctx);
}
module.exports = { run };

// Standalone: node tools/smoke-fx.cjs
if (require.main === module) {
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  const SHOTS = path.join(ROOT, 'tmp', 'smoke'), failures = [], rows = [];
  const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
  (async () => {
    const browser = await chromium.launch();
    try { await run(browser, { check, rows, SHOTS }); } catch (e) { failures.push('smoke-fx crashed: ' + (e.stack || e.message)); }
    await browser.close();
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note || '' })));
    if (failures.length) { console.error('FX SMOKE FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
    console.log('FX SMOKE OK');
  })();
}
