// Checks for the v3.1 world and content work: the HUD in the letterbox band and the camera rising under it on 4:3
// iPads, the sky fill above the arena, the Codex's secret-code entry, practice-speed rewards, the hand-written
// codex lore, the asteroid's curved ground, CPU vines on the Jungle Temple and the "TOO BIG" grab label.
// Called by tools/smoke.cjs; also runs alone (`node tools/smoke-world.cjs`, after `node build.mjs`).
const path = require('path');
const fs = require('fs');
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

// Page-side helpers (serialised): freeze the loop, stand fighters somewhere, measure.
const HELPERS = `
window.__W = {
  quiet() { SC.G.state = 'paused'; SC.G.lock = 0; },
  // Puts fighter f with its feet at (x, y), standing still.
  put(f, x, y) { moveFighter(f, x - f.P[2].x, y - feetY(f)); for (const p of f.P) { p.ox = p.x; p.oy = p.y; } },
  // Canvas y of a fighter's head through the current camera.
  headY(f) { const { VIEW, CAM } = SC.view; return VIEW.cy + (f.P[0].y - CAM.y) * VIEW.s * CAM.z; },
  // How many sampled viewport pixels still show the letterbox colour (#05060c).
  voidPixels() {
    const { VIEW } = SC.view, vw = Math.floor(VIEW.vw), vh = Math.floor(VIEW.vh);
    const d = ctx.getImageData(Math.floor(VIEW.vx), Math.floor(VIEW.vy), vw, vh).data;
    let bad = 0, n = 0;
    for (let y = 0; y < vh; y += 4) for (let x = 0; x < vw; x += 4) { const i = (y * vw + x) * 4; n++; if (d[i] === 5 && d[i + 1] === 6 && d[i + 2] === 12) bad++; }
    return { bad, n };
  },
};`;

async function run(browser, { check, rows, SHOTS }) {
  const step = async (key, fn) => {
    let ok = false, note = '';
    try { const r = await fn(); ok = r === true || (r && r.ok); note = r && r.note || ''; } catch (e) { note = e.message; }
    check(ok, `world ${key}: ${note || 'failed'}`);
    rows.push({ kind: 'world', key, ok: !!ok, note });
  };
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  // (7) 4:3 iPads: the HUD lives in the band above the arena and never covers fighters on the Kitchen shelf.
  const pads = [['ipad-11', 1194, 834, false], ['ipad-12.9', 1366, 1024, true]];
  for (const [name, width, height, fullyInBand] of pads) {
    const { ctx, page, errors } = await open(browser, { viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await page.evaluate(HELPERS);
    await step(`HUD band ${name}`, async () => {
      const r = await page.evaluate(() => {
        SC.start({ mode: 'watch', map: 'kitchen', weather: 'clear', weapons: ['blade', 'blade'] }); __W.quiet();
        SC.F.forEach((f, i) => __W.put(f, 560 + i * 150, 320));   // both on the shelf { x: 480, y: 320, w: 300 }
        for (let k = 0; k < 60; k++) SC.render(1 / 30);
        const { VIEW, CAM } = SC.view;
        return { heads: SC.F.map(__W.headY), hudY: VIEW.hudY, hudH: VIEW.hudH, vy: VIEW.vy, over: VIEW.hudOver, camY: +CAM.y.toFixed(1), z: +CAM.z.toFixed(2), cv: [cv.width, cv.height] };
      });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `ipad-hud-${name}.png`) });
      const below = r.heads.every(y => y > r.hudY + r.hudH + 4), inBand = !fullyInBand || r.hudY + r.hudH <= r.vy + 2;
      return { ok: below && inBand && !errors.length, note: JSON.stringify(r) + (errors.length ? ' ' + errors.join('|') : '') };
    });
    // (8) The sky fills the viewport above the arena when the camera rises under the HUD (top planet of the asteroid).
    await step(`void fill ${name}`, async () => {
      const r = await page.evaluate(() => {
        SC.start({ mode: 'watch', map: 'asteroid', weapons: ['blade', 'blade'] }); __W.quiet();
        SC.F.forEach((f, i) => __W.put(f, 640 + (i ? 26 : -26), 57));   // planet 4 (640, 105) r 48: its top is y 57
        for (let k = 0; k < 90; k++) SC.render(1 / 30);
        const { VIEW, CAM } = SC.view, v = __W.voidPixels();
        return Object.assign(v, { camY: +CAM.y.toFixed(1), hh: +(VIEW.hv / (2 * CAM.z)).toFixed(1), over: VIEW.hudOver, sky: mapSkyTop(MAP) });
      });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `ipad-void-${name}.png`) });
      return { ok: r.bad === 0 && r.n > 1000 && (r.over === 0 || r.camY < r.hh), note: JSON.stringify(r) };
    });
    await step(`no errors ${name}`, async () => ({ ok: !errors.length && !(await page.evaluate(() => SC.errors.length)), note: errors.join(' | ').slice(0, 300) }));
    await ctx.close();
  }

  const { ctx, page, errors } = await open(browser);
  await page.evaluate(HELPERS);
  await step('void fill 16:9', async () => {
    const r = await page.evaluate(() => {
      SC.start({ mode: 'watch', map: 'asteroid', weapons: ['blade', 'blade'] }); __W.quiet();
      SC.F.forEach((f, i) => __W.put(f, 640 + (i ? 26 : -26), 57));
      for (let k = 0; k < 90; k++) SC.render(1 / 30);
      const { VIEW, CAM } = SC.view, v = __W.voidPixels();
      return Object.assign(v, { camY: +CAM.y.toFixed(1), hh: +(VIEW.hv / (2 * CAM.z)).toFixed(1), heads: SC.F.map(__W.headY).map(Math.round), hud: VIEW.hudY + VIEW.hudH });
    });
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'void-asteroid-1280.png') });
    return { ok: r.bad === 0 && r.camY < r.hh, note: JSON.stringify(r) };
  });

  // (9) Secrets entry in the Codex: typing CLUCK and pressing "Try code" unlocks the chicken.
  await step('codex code entry', async () => {
    await page.evaluate(() => {
      window.__keep = { secrets: JSON.stringify(PROG.secrets), chicken: WEAPONS['rubber-chicken'].hidden };
      delete PROG.secrets.cluck; WEAPONS['rubber-chicken'].hidden = true; progSave();
      CODEX_TAB.tab = 'x'; openScreen('codex', 'menu');
    });
    await page.click('[data-key="cx-code"]');
    await page.keyboard.type('SHINYX');                                   // S and Y are menu-navigation keys: they must still type
    const typed = await page.evaluate(() => document.querySelector('[data-key="cx-code"]').value);
    await page.fill('[data-key="cx-code"]', 'CLUCK');
    await page.click('[data-key="cx-try"]');
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => {
      const out = { found: secretFound('cluck'), card: [...document.querySelectorAll('#codex .codex-card strong')].some(s => s.textContent === 'Rubber Chicken'),
        shown: !WEAPONS['rubber-chicken'].hidden, lore: [...document.querySelectorAll('#codex .codex-card .cx-lore')].some(e => /championship/.test(e.textContent)) };
      PROG.secrets = JSON.parse(__keep.secrets); WEAPONS['rubber-chicken'].hidden = __keep.chicken; progSave();
      openScreen('menu');
      return out;
    });
    return { ok: typed === 'SHINYX' && r.found && r.card && r.shown && r.lore, note: `typed ${typed} ` + JSON.stringify(r) };
  });

  // (13) Practice speed pays less: coins and XP x .4 at 25 % speed, and both boxes say so.
  await step('practice-speed reward', async () => {
    const skip = await page.evaluate(() => typeof accessRewardMul !== 'function');
    if (skip) return { ok: true, note: 'skipped: accessRewardMul not defined yet (92-access)' };
    // The last blow lands through the real stepper (advance, not SC.sim: the match counts), driven synchronously so a
    // starved frame loop can't stall the K.O. delay at quarter speed; the results screen then settles coins and XP.
    const r = await page.evaluate(() => {
      const keep = { speed: SETTINGS.practiceSpeed, prog: JSON.stringify(PROG), profile: JSON.stringify(PROFILE) };
      SETTINGS.practiceSpeed = .25;
      SC.start({ mode: 'versus', weapons: ['blade', 'blade'], killcam: false }); SC.G.lock = 0;
      advance(1 / 60);                                        // a real-time step records the slowed speed for this match
      SC.G.score[0] = SC.G.winScore - 1; damage(SC.F[1], 999, { src: SC.F[0], kind: 'melee' });
      for (let i = 0; i < 6000 && SC.G.state !== 'over'; i++) advance(.05);
      const rw = MATCH_TRACK.reward || {}, sum = (rw.lines || []).reduce((s, [, n]) => s + n, 0);
      const out = { state: SC.G.state, mul: rw.mul, coins: rw.coins, want: Math.round(sum * .4), pm: PROG_MATCH.mul, xp: PROG_MATCH.xp,
        boxes: !!document.querySelector('#over .reward .reward-mul') && !!document.querySelector('#over .xp-box .reward-mul') };
      SETTINGS.practiceSpeed = keep.speed;
      Object.assign(PROG, JSON.parse(keep.prog)); progSave(); Object.assign(PROFILE, JSON.parse(keep.profile)); saveProfile();
      startMatch(demoConfig());
      return out;
    });
    return { ok: r.state === 'over' && r.mul === .4 && r.coins === r.want && r.pm === .4 && r.boxes, note: JSON.stringify(r) };
  });

  // (14) Lore: every registry key has a hand-written entry, all unique, no template holes.
  await step('codex lore', async () => {
    const r = await page.evaluate(() => {
      const L = SC.lore, lines = [], bad = [], missing = [];
      for (const kind in L) for (const k in L[kind]) { const t = L[kind][k]; lines.push(t); if (typeof t !== 'string' || t.length < 60 || /\{\w+\}/.test(t)) bad.push(kind + ':' + k); }
      const need = { w: Object.keys(WEAPONS), s: Object.keys(SKILLS), c: Object.keys(CLASSES), m: Object.keys(MAPS), p: Object.keys(PETS),
        b: CAMP_NODES.filter(n => n.kind === 'boss' || n.kind === 'mini').map(n => n.id), r: CAMP_REALMS.map(r => r.key), x: Object.keys(SECRETS) };
      for (const kind in need) for (const k of need[kind]) if (!/^t-/.test(k) && !(L[kind] && L[kind][k])) missing.push(kind + ':' + k);
      const sentences = lines.flatMap(t => t.split(/(?<=[.!?])\s+/));
      return { n: lines.length, unique: new Set(lines).size === lines.length, uniqueSentences: new Set(sentences).size === sentences.length, missing, bad,
        katana: codexLore('w', 'katana', 'Katana', 'blade') === L.w.katana, boss: codexEntries('b').length === 8 && codexEntries('r').length === 4, kb: Math.round(JSON.stringify(L).length / 1024) };
    });
    return { ok: r.unique && r.uniqueSentences && !r.missing.length && !r.bad.length && r.katana && r.boss && r.n >= 140, note: JSON.stringify(r) };
  });

  // (15) Asteroid: Phase Step lands on a planet's surface, and groundBelow answers with the curved top.
  await step('asteroid ground + blink', async () => {
    const r = await page.evaluate(() => {
      SC.start({ mode: 'watch', map: 'asteroid', weapons: ['blade', 'blade'], skills: [['blink', 'none'], ['blink', 'none']] }); __W.quiet();
      for (const f of SC.F) f.ai.behave = 'idle';
      __W.put(SC.F[0], 205, 245); __W.put(SC.F[1], 640, 335);   // small left planet's top, big planet's top
      SC.F[0].face = 1; SC.F[1].face = -1;
      const x0 = SC.F[0].P[2].x;
      SC.press(0, 'skill1'); SC.sim(1 / 60);
      const surf = f => { const fx = f.P[10].x, fy = feetY(f); return Math.min(...ASTRO_PLANETS.map(p => Math.abs(Math.hypot(fx - p.x, fy - p.y) - p.r))); };
      return { moved: Math.abs(SC.F[0].P[2].x - x0) > 60, dist: SC.F.map(f => +surf(f).toFixed(1)), nan: SC.F.some(f => f.P.some(p => !Number.isFinite(p.x + p.y))),
        g: MAP.groundBelow(640, 0), gBig: +groundBelow(640, 300).toFixed(1), gVoid: groundBelow(400, 100), errors: SC.errors.length };
    });
    return { ok: r.moved && r.dist.every(d => d < 40) && !r.nan && r.g === 57 && r.gBig === 335 && r.gVoid === null && !r.errors, note: JSON.stringify(r) };
  });

  // (16) Jungle Temple: an Insane CPU crossing the pit catches a vine (chance forced to 1).
  await step('CPU vines', async () => {
    const r = await page.evaluate(() => {
      const keep = AI_LEVELS.insane.vine; AI_LEVELS.insane.vine = 1;
      let count = 0, tries = 0, rounds = 0;
      const off = on('vine', f => { if (f.ctrl === 'cpu') count++; });
      // Rounds keep flowing (state 'play'): after a K.O. the pair respawns on opposite steps and must cross again.
      for (; tries < 4 && !count; tries++) {
        SC.start({ mode: 'watch', map: 'jungle', diff: 'insane', weather: 'clear', weapons: ['blade', 'katana'], winScore: 99 }); SC.G.lock = 0;
        __W.put(SC.F[0], 290, 560); __W.put(SC.F[1], 990, 560);   // each on its own step, the spike pit between them
        SC.sim(1 / 60);
        for (const f of SC.F) if (f.ai.L) f.ai.L.vine = 1;
        SC.sim(30);
        rounds += SC.G.log.length;
      }
      off(); AI_LEVELS.insane.vine = keep;
      const out = { count, tries, rounds, errors: SC.errors.length, nan: SC.F.some(f => f.P.some(p => !Number.isFinite(p.x + p.y))) };
      startMatch(demoConfig());
      return out;
    });
    return { ok: r.count >= 1 && !r.errors && !r.nan, note: JSON.stringify(r) };
  });

  // (17) Grabbing a boss says TOO BIG instead of doing nothing.
  await step('TOO BIG label', async () => {
    const r = await page.evaluate(() => {
      if (!MODES['t-big']) defMode('t-big', { hidden: true, setup: () => ({ roster: [
        { team: 0, weapon: 'blade', ctrl: 'human', cls: 'none' }, { team: 1, weapon: 'hammer', scale: 1.7, ctrl: 'human', cls: 'none' }] }) });
      SC.start({ mode: 't-big', map: 'dojo' }); __W.quiet();
      __W.put(SC.F[0], 600, 650); __W.put(SC.F[1], 660, 650); SC.F[0].face = 1;   // the giant's hip is level with P1's chest
      SC.press(0, 'grab'); worldStep(DT);                      // a real step (not SC.sim), so the label is spawned
      const out = { label: FLOATS.some(t => t.text === 'TOO BIG'), held: !!SC.F[1].heldBy, cd: SC.F[0].grabCd > 0, scale: SC.F[1].scale };
      startMatch(demoConfig());
      return out;
    });
    return { ok: r.label && !r.held && r.cd && r.scale === 1.7, note: JSON.stringify(r) };
  });

  await step('no console errors', async () => ({ ok: !errors.length && !(await page.evaluate(() => SC.errors.length)), note: errors.join(' | ').slice(0, 300) }));
  await ctx.close();
}

module.exports = { run };
if (require.main === module) {
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  (async () => {
    const failures = [], rows = [], browser = await chromium.launch();
    await run(browser, { check: (ok, w) => { if (!ok) failures.push(w); return ok; }, rows, SHOTS: path.join(ROOT, 'tmp', 'smoke') });
    await browser.close();
    console.table(rows);
    if (failures.length) { console.error('FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
    console.log('world OK');
  })();
}
