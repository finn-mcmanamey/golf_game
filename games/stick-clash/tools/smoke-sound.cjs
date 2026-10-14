// Smoke tests for the v4 sound pass (80-audio, 80b-weapon-sfx, 81-music, 83b-voices).
// Called by tools/smoke.cjs; also runs on its own (`node tools/smoke-sound.cjs`, after `node build.mjs`). About a minute:
// - weapons: every weapon resolves to its own swing and hit recipe (valid layers), no two share one, and the
//   distinctive weapons have hand-made signatures;
// - a real-time fight: hits, swings, shots and grunts all go through sfx (so the kill-cam replays them); grunts keep
//   the per-fighter gap and the cap of a few at once; none in SC.sim; a suspended AudioContext plays (and queues)
//   nothing, and the music carries on once it resumes;
// - music: the scheduler plays lead notes for the menu tune and one arena of each art style, on that style's
//   instrument, resting through the first verse (the final round comes in at once, an octave up);
// - Settings → Sound: "Voice grunts" and "Voice volume" exist, persist through a reload, and off silences grunts;
// - no AudioContext at all: the page boots and plays a match to its results without errors;
// - an 8-fighter brawl never has more than AUDIO_MAX_VOICES sources playing.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
// Weapons the player asked to hear by name: each needs its own signature, not a category fallback.
const SIGNATURES = ['frying-pan', 'bat', 'chainsaw', 'lollipop', 'boxing-gloves', 'whip', 'nunchaku', 'katana', 'greatsword',
  'rapier', 'war-fan', 'hammer', 'scythe', 'plasma-staff', 'plasma', 'shotgun', 'minigun', 'sniper', 'rocket', 'crossbow',
  'longbow', 'kunai', 'boomerang', 'laser', 'flamethrower', 'cryo', 'storm-staff', 'wand', 'void-orb', 'slingshot', 'bubble', 'confetti'];
const STYLE_ARENAS = { neon: 'neon', ink: 'dojo', pixel: 'moon', paper: 'candy', chalk: 'spikepit' };

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
// A real key press: browsers only start WebAudio after a user gesture.
async function startAudio(page) {
  await page.keyboard.press('KeyX');
  await page.waitForFunction(() => !window.AudioContext || (AC && AC.state === 'running'), null, { timeout: 3000 }).catch(() => {});
}

async function testRecipes(browser, { check, rows }) {
  const { page, errors } = await openPage(browser);
  const r = await page.evaluate(sigs => {
    const keys = Object.keys(SC.reg.WEAPONS), seen = { s: new Map(), h: new Map() }, dupes = [], bad = [];
    for (const k of keys) {
      const rec = SC.sound.recipe(k);
      for (const part of ['s', 'h']) {
        const id = JSON.stringify(rec[part]);
        if (!rec[part].length) bad.push(`${k}.${part} empty`);
        for (const l of rec[part]) if (!/^(n[bhl]|t[stqw]|m|h[wn])$/.test(l[0]) || l.slice(1).some(x => !Number.isFinite(x) || x < 0)) bad.push(`${k}.${part} ${JSON.stringify(l)}`);
        if (seen[part].has(id)) dupes.push(`${k}.${part} = ${seen[part].get(id)}.${part}`); else seen[part].set(id, k);
      }
    }
    return { n: keys.length, dupes, bad, missing: sigs.filter(k => !SC.sound.WSND[k] || !SC.reg.WEAPONS[k]), errors: SC.errors.map(e => e.msg) };
  }, SIGNATURES);
  const ok = check(r.n >= 60, `sound recipes: only ${r.n} weapons`)
    & check(!r.bad.length, `sound recipes: bad layers ${r.bad.join(' | ')}`)
    & check(!r.dupes.length, `sound recipes: shared recipes ${r.dupes.join(', ')}`)
    & check(!r.missing.length, `sound recipes: no signature for ${r.missing.join(', ')}`)
    & check(!r.errors.length && !errors.length, `sound recipes: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'sound', key: 'weapon recipes', ok: !!ok, note: `${r.n} weapons, ${SIGNATURES.length} signatures` });
  await page.close();
}

// A real-time CPU brawl with katana, hammer, nunchaku and minigun: every sfx name is captured on its way to the kill-cam.
// The melee fighters are also told to attack now and then, so swings happen even if guns keep them at bay.
async function testFight(browser, { check, rows }) {
  const { page, errors } = await openPage(browser);
  await startAudio(page);
  await page.evaluate(() => {
    window.__names = [];
    const keep = SFX_RECORD;
    SFX_RECORD = (n, v) => { __names.push(n); if (keep) keep(n, v); };
    SC.start({ mode: 'watch', map: 'neon', fighters: 4, hpMul: .5, weapons: ['katana', 'hammer', 'nunchaku', 'minigun'] });
    VOX.log.length = 0;
    window.__swing = setInterval(() => { for (const i of [0, 1, 2]) SC.press(i, 'attack'); }, 300);
  });
  await page.waitForTimeout(9000);
  await page.evaluate(() => clearInterval(__swing));
  const r = await page.evaluate(() => {
    const N = __names, has = re => N.filter(n => re.test(n)).length, ko = new Set(['waah']);
    // gaps between one fighter's grunts (a K.O. may cut in), and the most lines sounding at once
    const gaps = [], len = e => VOX_LINES[e.line].reduce((s, y) => s + y[1], .1) + (/yay|hoho/.test(e.line) ? .6 : 0);
    const L = VOX.log.slice();
    L.forEach((e, i) => { const prev = L.slice(0, i).reverse().find(p => p.id === e.id); if (prev && !ko.has(e.line)) gaps.push(e.t - prev.t); });
    const most = Math.max(0, ...L.filter(e => !ko.has(e.line)).map(e => L.filter(p => !ko.has(p.line) && p.t <= e.t && p.t + len(p) > e.t).length));
    return { ac: AC && AC.state, swings: has(/^ws:(katana|hammer|nunchaku)$/), shots: has(/^ws:minigun$/), hits: has(/^wh:/), body: has(/^hit$/),
      grunts: has(/^vox:/), lines: [...new Set(L.map(e => e.line))], minGap: Math.min(9, ...gaps), most, errors: SC.errors.map(e => e.msg) };
  });
  // SC.sim: the same fight headless makes no grunts at all. A clean match: no party mini-game (one idles every CPU, so
  // a quick round 1 left a round 2 without a single hit) and no replay; hits are counted over every round played.
  const sim = await page.evaluate(() => {
    SC.start({ mode: 'watch', map: 'neon', fighters: 4, weapons: ['hammer', 'hammer', 'battle-axe', 'battle-axe'], minigames: false, killcam: false });
    const n0 = VOX.log.length, names = __names.length;
    SC.sim(15);
    const L = SC.G.log, logged = L.some(r => r.round === SC.G.round);
    const hits = L.reduce((s, r) => s + r.fighters.reduce((a, f) => a + f.hits, 0), 0) + (logged ? 0 : SC.F.reduce((s, f) => s + f.stats.hits, 0));
    return { grunts: VOX.log.length - n0, vox: __names.slice(names).filter(n => /^vox:/.test(n)).length, hits };
  });
  const ok = check(r.ac === 'running', `sound fight: AudioContext ${r.ac}`)
    & check(r.swings > 0 && r.shots > 0 && r.hits > 0 && r.body > 0, `sound fight: swings ${r.swings} shots ${r.shots} weapon hits ${r.hits} body hits ${r.body}`)
    & check(r.grunts > 0, `sound fight: no grunts through sfx (log ${r.lines.join(',')})`)
    & check(r.minGap >= .34, `sound fight: a fighter grunted again after ${r.minGap.toFixed(2)} s`)
    & check(r.most <= 3, `sound fight: ${r.most} grunts at once`)
    & check(sim.hits > 0 && sim.grunts === 0 && sim.vox === 0, `sound sim: ${sim.grunts} grunts logged, ${sim.vox} vox sfx in SC.sim (${sim.hits} hits)`)
    & check(!r.errors.length && !errors.length, `sound fight: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'sound', key: 'fight through sfx', ok: !!ok,
    note: `swings ${r.swings}, shots ${r.shots}, hits ${r.hits}, grunts ${r.grunts} (${r.lines.join(' ')}), min gap ${r.minGap.toFixed(2)} s, ${r.most} at once` });

  // The limits on their own: one fighter can't grunt twice within the gap; no more than VOX.max at once; a K.O. always.
  const lim = await page.evaluate(async () => {
    SC.start({ mode: 'watch', map: 'neon', fighters: 8 });
    SC.G.state = 'paused';
    VOX.busy.length = 0; VOX.last = new WeakMap();
    const said = SC.F.map(f => voxSay(f, 'hurt')), again = voxSay(SC.F[0], 'hurt'), ko = voxSay(SC.F[1], 'ko');
    VOX.busy.length = 0;
    const blocked = voxSay(SC.F[0], 'hurt');
    await new Promise(res => setTimeout(res, 400));
    return { said: said.filter(Boolean).length, again, ko, blocked, later: voxSay(SC.F[0], 'hurt') };
  });
  const ok2 = check(lim.said === 3 && !lim.again && lim.ko, `sound grunt cap: ${JSON.stringify(lim)}`)
    & check(!lim.blocked && lim.later, `sound grunt gap: ${JSON.stringify(lim)}`);
  rows.push({ kind: 'sound', key: 'grunt limits', ok: !!ok2, note: `${lim.said} of 8 at once` });

  // A suspended context (Safari after a call, a tab put away) queues every sound to play at once on resume: none are
  // made then (no new voices, no held drones), the kill-cam still hears them, and the music schedules again after.
  const susp = await page.evaluate(async () => {
    await AC.suspend();
    const v0 = AUDIO_VOICES, n0 = __names.length;
    SC.start({ mode: 'watch', map: 'dojo', weapons: ['chainsaw', 'minigun'], killcam: false, minigames: false }); SC.G.lock = 0;
    await new Promise(r => setTimeout(r, 1200));
    const out = { state: AC.state, added: AUDIO_VOICES - v0, held: Object.keys(AUDIO_HELD).length, heard: __names.length - n0 };
    const next = MUSIC.next;
    await AC.resume(); await new Promise(r => setTimeout(r, 600));
    return Object.assign(out, { music: +(MUSIC.next - next).toFixed(2), after: AC.state });
  });
  const ok3 = check(susp.state === 'suspended' && susp.added <= 0 && !susp.held && susp.heard > 0 && susp.after === 'running' && susp.music > 0, `sound suspended: ${JSON.stringify(susp)}`);
  rows.push({ kind: 'sound', key: 'suspended context', ok: !!ok3, note: `${susp.heard} sounds recorded, ${susp.added} new voices while suspended; music scheduled ${susp.music} s further after resume` });
  await page.close();
}

async function testMusic(browser, { check, rows }) {
  const { page, errors } = await openPage(browser);
  await startAudio(page);
  const r = await page.evaluate(arenas => {
    if (!AC || !musicNodes()) return { noAudio: true };
    // Count the lead's notes without making sound: the scheduler runs for real, the synth calls are stubbed.
    const keep = { musicNote, musicNoise, musicKick, musicTom, musicSnare }, notes = [];
    Object.assign(window, { musicNoise() {}, musicKick() {}, musicTom() {}, musicSnare() {} });
    window.musicNote = (out, t, hz, dur, o) => { if (Object.values(MUSIC_LEADS).includes(o)) notes.push([hz, o]); };
    const play = (th, lift = 0) => {
      MUSIC.leads = 0; MUSIC_DYN.lift = lift; notes.length = 0;
      const bars = new Set();
      for (let s = 0; s < 256; s++) { const n = MUSIC.leads; musicStep(AC.currentTime + 1, s, th); if (MUSIC.leads > n) bars.add(s >> 4); }
      return { n: MUSIC.leads, style: MUSIC.leadStyle, bars: bars.size, intro: [0, 1, 2, 3].some(b => bars.has(b)), pitches: new Set(notes.map(x => Math.round(x[0]))).size,
        top: Math.max(...notes.map(x => x[0])), inst: [...new Set(notes.map(x => Object.keys(MUSIC_LEADS).find(k => MUSIC_LEADS[k] === x[1])))] };
    };
    const out = { menu: play(MUSIC_THEMES.menu) };
    for (const [style, map] of Object.entries(arenas)) {
      SC.start({ mode: 'watch', map }); SC.G.state = 'paused';
      out[style] = play(MUSIC_THEMES[musicArenaTheme(map)]);
    }
    out.final = play(MUSIC_THEMES[musicArenaTheme('neon')], 2);
    Object.assign(window, keep); MUSIC_DYN.lift = 0;
    out.errors = SC.errors.map(e => e.msg);
    return out;
  }, STYLE_ARENAS);
  if (!check(!r.noAudio, 'sound music: no AudioContext in this browser')) return page.close();
  const expect = Object.assign({ menu: 'chalk' }, Object.fromEntries(Object.keys(STYLE_ARENAS).map(s => [s, s])));
  for (const [key, style] of Object.entries(expect)) {
    const m = r[key], inst = style === 'ink' || style === 'chalk' ? [style, 'pluck'] : [style];
    const ok = check(m.n >= 12 && m.pitches >= 4, `sound music ${key}: ${m.n} lead notes, ${m.pitches} pitches`)
      & check(m.style === style && m.inst.every(i => inst.includes(i)), `sound music ${key}: played on ${m.inst.join('+')} (style ${m.style}, want ${style})`)
      & check(!m.intro && m.bars <= 12, `sound music ${key}: lead in ${m.bars}/16 bars, intro ${m.intro} (it should rest)`);
    rows.push({ kind: 'sound', key: `music ${key}`, ok: !!ok, note: `${m.n} notes in ${m.bars} bars, ${m.pitches} pitches, ${m.inst.join('+')}` });
  }
  const ok = check(r.final.intro && r.final.top > r.neon.top * 1.5, `sound music final round: intro ${r.final.intro}, top ${r.final.top} vs ${r.neon.top}`)
    & check(!r.errors.length && !errors.length, `sound music: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'sound', key: 'music final round', ok: !!ok, note: `${r.final.n} notes, top ${Math.round(r.final.top)} Hz` });
  await page.close();
}

async function testSettings(browser, { check, rows, SHOTS }) {
  const { page, errors } = await openPage(browser);
  // Headless Chromium on file:// sometimes loses what a page's first document stored when it reloads (see smoke-2p's
  // secondDoc), so the settings are saved from a second document.
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await startAudio(page);
  await page.evaluate(() => openScreen('settings', 'menu'));
  const labels = await page.evaluate(() => [...document.querySelectorAll('#settings .lbl')].map(e => e.textContent));
  await page.click('#settings [data-key="Voice grunts"]');
  await page.$eval('#settings input[data-key="Voice volume"]', el => { el.value = 40; el.dispatchEvent(new Event('input', { bubbles: true })); });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'sound-settings.png') });
  await page.reload();
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await startAudio(page);
  await page.evaluate(() => openScreen('settings', 'menu'));
  const after = await page.evaluate(() => ({ voices: SETTINGS.voices, vol: SETTINGS.voiceVol,
    toggle: document.querySelector('#settings [data-key="Voice grunts"]').getAttribute('aria-checked'),
    slider: +document.querySelector('#settings input[data-key="Voice volume"]').value }));
  // Off: a real-time fight makes no grunts at all.
  await page.evaluate(() => { toMenu(); SC.start({ mode: 'watch', map: 'neon', fighters: 4, hpMul: .5, weapons: ['hammer', 'hammer', 'katana', 'katana'] }); VOX.log.length = 0; });
  await page.waitForTimeout(4000);
  const off = await page.evaluate(() => ({ log: VOX.log.length, said: voxSay(SC.F[0], 'ko'), hits: SC.F.reduce((s, f) => s + f.stats.hits, 0), errors: SC.errors.map(e => e.msg) }));
  const ok = check(labels.includes('Voice grunts') && labels.includes('Voice volume'), `sound settings: rows missing (${labels.join(', ')})`)
    & check(after.voices === false && after.toggle === 'false' && Math.abs(after.vol - .4) < 1e-9 && after.slider === 40, `sound settings: not kept through a reload ${JSON.stringify(after)}`)
    & check(off.hits > 0 && off.log === 0 && !off.said, `sound settings: grunts with voices off ${JSON.stringify(off)}`)
    & check(!off.errors.length && !errors.length, `sound settings: errors ${off.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'sound', key: 'Voice grunts setting', ok: !!ok, note: `off + 40% kept after reload; ${off.hits} hits, 0 grunts` });
  await page.close();
}

// No WebAudio (and no speech): boots, plays a match to its results, grunts are still logged, nothing errors.
async function testNoAudio(browser, { check, rows }) {
  const { page, errors } = await openPage(browser, () => {
    delete window.AudioContext; delete window.webkitAudioContext; delete window.speechSynthesis; delete window.SpeechSynthesisUtterance;
  });
  await page.keyboard.press('KeyX');
  await page.evaluate(() => { SC.start({ mode: 'watch', winScore: 1, map: 'dojo', weapons: ['chainsaw', 'flamethrower'] }); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { for (const f of SC.F) f.hp = 18; });
  await page.waitForFunction(() => SC.G.state === 'over', null, { timeout: 60000 }).catch(() => {});
  const r = await page.evaluate(() => ({ state: SC.G.state, ac: !!AC, grunts: VOX.log.length, errors: SC.errors.map(e => e.msg) }));
  const ok = check(r.state === 'over' && !r.ac, `sound no-audio: state ${r.state}, AudioContext ${r.ac}`)
    & check(!r.errors.length && !errors.length, `sound no-audio: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'sound', key: 'no AudioContext', ok: !!ok, note: `match to results, ${r.grunts} grunts logged` });
  await page.close();
}

// Eight fighters in real time with sound: the voice count never passes the cap (audioVoice is wrapped to watch it).
async function testBrawl(browser, { check, rows }) {
  const { page, errors } = await openPage(browser);
  await startAudio(page);
  await page.evaluate(() => {
    window.__peak = 0;
    const count = audioVoice;
    window.audioVoice = src => { count(src); __peak = Math.max(__peak, AUDIO_VOICES); };
    SC.start({ mode: 'watch', map: 'caldera', fighters: 8, hpMul: .6 });
  });
  await page.waitForTimeout(10000);
  const r = await page.evaluate(() => ({ peak: __peak, cap: AUDIO_MAX_VOICES, ac: AC && AC.state, grunts: VOX.log.length, errors: SC.errors.map(e => e.msg) }));
  const ok = check(r.peak > 10 && r.peak <= r.cap, `sound brawl: peak ${r.peak} voices (cap ${r.cap}, AudioContext ${r.ac})`)
    & check(!r.errors.length && !errors.length, `sound brawl: errors ${r.errors.concat(errors).join(' | ')}`);
  rows.push({ kind: 'sound', key: '8-fighter voices', ok: !!ok, note: `peak ${r.peak} of ${r.cap}, ${r.grunts} grunts` });
  await page.close();
}

async function run(browser, ctx) {
  for (const t of [testRecipes, testFight, testMusic, testSettings, testNoAudio, testBrawl]) {
    try { await t(browser, ctx); } catch (e) { ctx.check(false, `sound ${t.name} crashed: ${e.message}`); }
  }
}
module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const browser = await chromium.launch(), failures = [], rows = [], SHOTS = path.join(ROOT, 'tmp', 'smoke');
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    const t0 = Date.now();
    require('fs').mkdirSync(SHOTS, { recursive: true });
    try { await run(browser, { check, rows, SHOTS }); } finally { await browser.close(); }
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`SOUND FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`SOUND OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
