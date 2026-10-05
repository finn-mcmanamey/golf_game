// Regression checks for the v3 review fixes (review3 / review3b): gamepad remap leaving, Juggernaut scores, Mech Suit
// balance, the HUD backing plate, plus the smaller flow fixes (mutators surviving a setting change, Ranked quits,
// Esc inside pause sub-screens, per-mode mutator opt-outs, save-shape hardening, weather card placement).
// Called by tools/smoke.cjs; also runs alone (`node tools/smoke-fixes.cjs`, after `node build.mjs`).
const path = require('path');
const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'dist', 'stick-clash.html');

async function open(browser, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, opts));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto(URL);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  return { ctx, page, errors };
}

async function run(_page, browser, { check, rows }) {
  const step = async (key, fn) => {
    let ok = false, note = '';
    try { const r = await fn(); ok = r === true || (r && r.ok); note = r && r.note || ''; } catch (e) { note = e.message; }
    check(ok, `fix ${key}: ${note || 'failed'}`);
    rows.push({ kind: 'fix', key, ok: !!ok, note });
  };
  const { ctx, page, errors } = await open(browser);

  // F1: stop listening on the pad remap grid by leaving the screen: no throw, one click goes back, nothing stays visible.
  await step('F1 pad remap: leaving while listening', async () => {
    const e0 = errors.length;
    await page.evaluate(() => openScreen('controls', 'menu'));
    await page.click('[data-key="padmap-open"]');
    await page.click('[data-key="pad-jump"]');
    const listening = await page.evaluate(() => REMAP.listen);
    await page.click('#padmap .go');
    const r = await page.evaluate(() => ({ ui: UI.screen, vis: [...document.querySelectorAll('#ui .overlay')].filter(p => !p.hidden).map(p => p.id).join('+'), listen: REMAP.listen }));
    return { ok: listening === 'jump' && r.ui === 'controls' && r.vis === 'controls' && r.listen === null && errors.length === e0, note: JSON.stringify(r) + errors.slice(e0).join('|') };
  });
  // F6: Controls opens although getGamepads() throws (iframes without the gamepad permission).
  await step('F6 controls with getGamepads throwing', async () => {
    const r = await page.evaluate(() => {
      const keep = navigator.getGamepads; navigator.getGamepads = () => { throw new Error('SecurityError'); };
      try { openScreen('controls', 'menu'); return { ui: UI.screen, kids: PANELS.controls.children.length }; } finally { navigator.getGamepads = keep; openScreen('menu'); }
    });
    return r.ui === 'controls' && r.kids > 0;
  });

  // F3: Juggernaut keeps a finite score and shows no "NaN" on the results screen.
  await step('F3 juggernaut score is finite', async () => {
    const r = await page.evaluate(() => {
      const bad = [];
      for (let k = 0; k < 6; k++) {
        SC.start({ mode: 'juggernaut', autopilot: true, fighters: 4 + (k % 4), diff: 'hard' });
        let s; for (let t = 0; t < 200; t += 5) { s = SC.sim(5); if (s.state === 'over') break; }
        if (s.state !== 'over' || !s.score.every(Number.isFinite)) bad.push({ k, state: s.state, score: s.score });
      }
      const txt = document.querySelector('#over') ? document.querySelector('#over').textContent : '';
      return { bad, nan: /NaN/.test(txt) };
    });
    return { ok: !r.bad.length && !r.nan, note: JSON.stringify(r) };
  });

  // Mech Suit: a mounted fighter should be roughly even with an unmounted one, not a near-guaranteed kill.
  await step('Mech Suit is not overpowered', async () => {
    const r = await page.evaluate(() => {
      let w = 0, l = 0, d = 0; const N = 16;
      for (let k = 0; k < N; k++) {
        SC.start({ mode: 'watch', map: ['neon', 'foundry', 'frost'][k % 3], weapons: ['blade', 'blade'], classes: ['none', 'none'], diff: 'normal', winScore: 99, weather: 'clear', orbs: 0 });
        SC.G.state = 'play'; SC.sim(1.7);
        const A = SC.F[k % 2], B = SC.F[1 - k % 2]; mount(A, 'mech');
        for (let s = 0; s < 60 * 9; s++) { SC.sim(1 / 60); if (!A.alive || !B.alive) break; }
        if (!B.alive && A.alive) w++; else if (!A.alive && B.alive) l++; else d++;
      }
      return { w, l, d, rate: (w + d / 2) / N, taken: MOUNTS.mech.takenMul, time: MOUNTS.mech.time };
    });
    return { ok: r.rate <= .8 && r.taken >= .7 && r.time <= 7, note: JSON.stringify(r) };
  });

  // HUD: every card gets a dark rounded backing plate (readable on bright arenas); persona chips are opaque.
  await step('HUD backing plate is drawn (8 fighters, candy)', async () => {
    const r = await page.evaluate(() => {
      const plates = []; const orig = CanvasRenderingContext2D.prototype.fill;
      CanvasRenderingContext2D.prototype.fill = function (...a) { if (this.fillStyle === 'rgba(8, 9, 22, 0.55)') plates.push(1); return orig.apply(this, a); };
      try { SC.start({ mode: 'ffa', map: 'candy', fighters: 8, autopilot: true }); SC.sim(2); SC.render(1 / 60); SC.render(1 / 60); }
      finally { CanvasRenderingContext2D.prototype.fill = orig; }
      return { fills: plates.length, plateFn: typeof hudPlatePath === 'function' };
    });
    return r.plateFn && r.fills >= 1;
  });

  // Weather card: drawn by the HUD (top centre), not over the floor, and never in the menu demo.
  await step('weather card moved to the HUD', async () => {
    const r = await page.evaluate(() => ({ fn: wxDrawAnnounce.length, len: WX_ANN_LEN }));
    return r.fn === 3 && r.len <= 2;
  });

  // F2: a settings change from the pause menu keeps Speed x1.5 and Orb Storm.
  await step('F2 setting change keeps mutators', async () => {
    const r = await page.evaluate(() => {
      SC.start({ mode: 'versus', autopilot: true, mutators: ['speed', 'orbstorm'], speed: 1, orbRate: 1 });
      setSetting('shake', false); setSetting('shake', true);
      return { speed: G_STATE.cfg.speed, orbRate: G_STATE.cfg.orbRate };
    });
    return r.speed === 1.5 && r.orbRate === 3;
  });
  // F4: a hidden quest mode never gets saved as the menu's mode.
  await step('F4 quest mode is not saved in the menu', async () => {
    const r = await page.evaluate(() => { const keep = MENU.mode; MENU.mode = 'campaign'; saveMenu(); const saved = store.get('menu', {}).mode; MENU.mode = keep; saveMenu(); return saved; });
    return r !== 'campaign' && r !== 'challenge';
  });
  // F5: quitting a started Ranked match counts as a loss.
  await step('F5 ranked quit counts as a loss', async () => {
    const r = await page.evaluate(() => {
      store.set('ranked', { pts: 0, best: 0, wins: 0, losses: 0, streak: 0 });
      SC.start({ mode: 'ranked' }); SC.sim(4);
      toMenu();
      return rankLoad().losses;
    });
    return r === 1;
  });
  // F7: Esc inside Settings opened from pause goes back to the pause menu instead of resuming.
  await step('F7 Esc in pause > Settings goes back', async () => {
    await page.evaluate(() => SC.start({ mode: 'versus' }));
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape'); await page.click('#pause >> text=Settings'); await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    const r = await page.evaluate(() => ({ st: SC.G.state, ui: UI.screen }));
    return r.st === 'paused' && r.ui === 'pause';
  });
  // F8: per-mode mutator opt-outs.
  await step('F8 mutators the mode refuses are dropped', async () => {
    const r = await page.evaluate(() => {
      SC.start({ mode: 'gungame', autopilot: true, mutators: ['randomweapons', 'lowgrav'] });
      const gg = MUT_ON.map(m => m.key);
      SC.start({ mode: 'tournament', autopilot: true, mutators: ['speed', 'tiny'] });
      return { gg, tr: MUT_ON.map(m => m.key) };
    });
    return { ok: r.gg.join() === 'lowgrav' && r.tr.join() === 'tiny', note: JSON.stringify(r) };
  });
  // F9: Reset to defaults also unmutes and clears the weather and mutator picks.
  await step('F9 reset unmutes and clears picks', async () => {
    await page.evaluate(() => { setMuted(true); store.set('weather', 'rain'); MENU.mutators = ['tiny']; openScreen('settings', 'menu'); });
    await page.click('text=Reset to defaults');
    const r = await page.evaluate(() => ({ muted: MUTED, wx: store.get('weather', 'x'), mut: (MENU.mutators || []).length }));
    return r.muted === false && r.wx === 'random' && r.mut === 0;
  });
  // F10: wrong-shaped saves can't freeze or break the game.
  await step('F10 save shapes are checked', async () => {
    const r = await page.evaluate(async () => {
      const out = {};
      SETTINGS.speed = 'fast'; SETTINGS.rounds = 99; SETTINGS.master = 'loud'; cleanSettings();
      out.speed = SETTINGS.speed; out.rounds = SETTINGS.rounds; out.master = SETTINGS.master;
      store.set('presets', 'x'); out.presets = presetList().length;
      store.set('highlights', [1, 'x']); out.hl = typeof store.getArr === 'function' && store.getArr('highlights').length;
      store.set('profile', { coins: 'lots', stats: { cpuWins: null } }); const p = loadProfile(); out.coins = p.coins; out.cpuWins = typeof p.stats.cpuWins;
      try { saveShapeCheck('stickclash.v2.profile', { coins: 'lots' }); out.code = 'accepted'; } catch (e) { out.code = 'refused'; }
      store.set('presets', []); store.set('highlights', []); store.set('profile', JSON.parse(JSON.stringify(PROFILE)));
      return out;
    });
    return { ok: r.speed === 1 && r.rounds === 9 && r.master === .9 && r.presets === 0 && r.coins === 0 && r.cpuWins === 'object' && r.code === 'refused', note: JSON.stringify(r) };
  });
  // Contrast: the faint text colour reads at 4.5:1 or better on the panel background.
  await step('faint text contrast >= 4.5', async () => {
    const r = await page.evaluate(() => {
      const hex = getComputedStyle(document.documentElement).getPropertyValue('--faint').trim();
      const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
      const a = lum(hex), b = lum('#0b0d1c');
      return { hex, cr: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
    return { ok: r.cr >= 4.5, note: JSON.stringify(r) };
  });
  await step('no console errors', async () => {
    const e = errors.filter(m => !/SecurityError/.test(m));
    return { ok: !e.length, note: e.join(' | ').slice(0, 300) };
  });
  await ctx.close();
}

module.exports = { run };
if (require.main === module) {
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  (async () => {
    const failures = [], rows = [], browser = await chromium.launch();
    await run(null, browser, { check: (ok, w) => { if (!ok) failures.push(w); return ok; }, rows });
    await browser.close();
    console.table(rows);
    if (failures.length) { console.error('FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
    console.log('fixes OK');
  })();
}
