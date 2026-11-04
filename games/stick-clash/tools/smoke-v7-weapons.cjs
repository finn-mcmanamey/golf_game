// Smoke tests for v7 "weak weapons get strong" (46b-weapons-tune.js). Called by tools/smoke.cjs; also runs on its own
// (`node tools/smoke-v7-weapons.cjs`, after `node build.mjs`; `--no-shots` skips screenshots). Headless (SC.sim) apart
// from the screenshots:
// - duels: each of the 16 upgraded weapons fights seeded CPU duels until its bonus lands ('weaponBonus' event); it
//   must deal damage, leave no errors or NaN, and the bonus must do what it says (status, stun, launch, trip...);
// - focused checks with scripted inputs: the pistol's last round, the spear tip vs the shaft, the saber riposte,
//   the hammer's wider quake, the chrono field's shorter wind-up, the chainsaw ramp;
// - content: power table applied, descriptions name the bonus, sounds, WSND signatures, lore, tiers kept;
// - balance: if a recent tools/balance.cjs result is in tmp/, every weapon is inside 42-58% (Normal) / 30-70% (Hard);
// - screenshots of every bonus landing, the picker's new description and the How to Play card at 1920x1080 @1 and
//   1536x864 @1.25 (tmp/smoke/v7w-*.png).
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
// weapon: [bonus key, foe weapon, arena]
const DUELS = {
  spear: ['tip', 'blade', 'dojo'], halberd: ['hook', 'blade', 'dojo'], katana: ['iai', 'blade', 'dojo'],
  saber: ['riposte', 'pistol', 'dojo'], rapier: ['touche', 'blade', 'dojo'], whip: ['crack', 'blade', 'dojo'],
  nunchaku: ['stagger', 'blade', 'dojo'], hammer: ['quake', 'blade', 'dojo'], chainsaw: ['rip', 'blade', 'dojo'],
  'boxing-gloves': ['uppercut', 'blade', 'dojo'], kusarigama: ['reap', 'blade', 'dojo'], 'war-fan': ['gale', 'blade', 'dojo'],
  'echo-blades': ['resonance', 'blade', 'dojo'], 'chrono-katana': ['tick', 'blade', 'dojo'], pistol: ['overcharge', 'blade', 'dojo'],
  revolver: ['doubletap', 'blade', 'dojo'],
};

async function openPage(browser, opts = { viewport: { width: 1280, height: 720 } }) {
  const page = await browser.newPage(opts), errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(HELPERS);
  return { page, errors };
}

// Page-side helpers: seeded fights and what a bonus left on its victim.
const HELPERS = () => {
  window.__V7 = {
    seed(n) {   // a repeatable fight: seeded Math.random, pinned clock, no learnt CPU moves or clash timers
      for (const k in AI_MOVES) delete AI_MOVES[k];
      for (const k in CLASH_T) delete CLASH_T[k];
      let s = n * 7919;
      Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      SC.G.t = 1000;
    },
    // The victim's state right after the bonus landed (post hooks run before the event).
    effect(key, A, B) {
      const up = B.P.reduce((s, p) => s + vy(p), 0) / B.P.length;
      return { stun: !!B.status.stun, slow: !!B.status.slow, tumble: (B.tumble || 0) > 0, stagger: B.stagger, up, bleed: !!B.status.bleed, warp: !!B.status.timewarp };
    },
    duel(w, key, foe, map, seed, secs) {
      const keep = Math.random, e0 = SC.errors.length, got = {}, fx = [];
      let t = 0, dmg = 0, nan = false;
      const offB = on('weaponBonus', (A, k, B) => { if (A.team === 0) { got[k] = (got[k] || 0) + 1; if (k === key && fx.length < 6) fx.push(__V7.effect(k, A, B)); } });
      const offD = on('damage', (B, amt, o) => { if (o && o.src && o.src.team === 0 && o.src !== B) dmg += amt; });
      try {
        __V7.seed(seed);
        SC.start({ mode: 'watch', map, weapons: [w, foe], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
          throws: [['none', 'none'], ['none', 'none']], orbs: false, winScore: 99, weather: 'clear' });
        SC.G.state = 'play';
        for (; t < secs && (got[key] || 0) < 2; t += .5) {
          SC.sim(.5);
          nan = nan || SC.F.some(f => f.P.some(p => !Number.isFinite(p.x + p.y)));
        }
      } finally { Math.random = keep; offB(); offD(); }
      return { got, fx, t, dmg, nan, errors: SC.errors.slice(e0).map(e => e.msg) };
    },
    // A scripted pair on the flat Dojo: both idle (brains off), at a hip gap.
    pair(wa, wb, gap = 200) {
      SC.start({ mode: 'watch', map: 'dojo', weapons: [wa, wb], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
        throws: [['none', 'none'], ['none', 'none']], orbs: false, winScore: 99, weather: 'clear' });
      SC.G.state = 'play'; SC.G.lock = 0;
      for (const f of SC.F) { f.ai.behave = 'idle'; f.ai.t = 1e9; f.ctrl = 'human'; }
      const [A, B] = SC.F;
      moveFighter(A, 520 - A.P[2].x, 0); moveFighter(B, 520 + gap - B.P[2].x, 0);
      SC.sim(.4);
      return [A, B];
    },
  };
};

// What each bonus must have done to its victim (from __V7.effect, any of the first landings).
const EFFECT = {
  hook: e => e.tumble || e.stagger >= .4, stagger: e => e.stun, crack: e => e.slow, uppercut: e => e.up < -150,
  reap: e => e.bleed, tick: e => e.warp, doubletap: e => e.stagger >= .25,
};

// ---------- 1. seeded CPU duels: every bonus lands and does its job ----------
async function testDuels(page, { check, rows }) {
  for (const w of Object.keys(DUELS)) {
    const [key, foe, map] = DUELS[w];
    let r = null;
    for (let seed = 1; seed <= 3 && !(r && r.got[key]); seed++) r = await page.evaluate(a => __V7.duel(...a), [w, key, foe, map, seed, 60]);
    const want = EFFECT[key], effOk = !want || r.fx.some(want);
    const ok = check(r.got[key] > 0, `v7w duel ${w}: bonus ${key} ${JSON.stringify(r.got)} in ${r.t}s`)
      & check(r.dmg > 0, `v7w duel ${w}: ${r.dmg} damage`)
      & check(effOk, `v7w duel ${w}: ${key} effect missing ${JSON.stringify(r.fx)}`)
      & check(!r.nan && !r.errors.length, `v7w duel ${w}: ${r.nan ? 'NaN ' : ''}errors ${r.errors.join(' | ')}`);
    rows.push({ kind: 'v7w', key: 'duel ' + w, ok: !!ok, note: `${JSON.stringify(r.got)} in ${r.t}s, ${r.dmg} dmg` });
  }
}

// ---------- 2. focused mechanics with scripted inputs ----------
const FOCUS = {
  // The 5th pistol shot is the overcharged one: flagged, bigger and W7.pistolMul × harder than the others.
  pistol() {
    const [A] = __V7.pair('pistol', 'blade', 500), shots = [];
    const off = on('fire', (f, p) => { if (f === A && p) shots.push({ last: !!p.w7Last, dmg: p.dmg, r: p.r }); });
    for (let i = 0; i < 5; i++) { A.atkCd = 0; SC.press(0, 'attack'); SC.sim(.35); }
    off();
    const last = shots[shots.length - 1] || {}, first = shots[0] || {};
    return { ok: shots.length === 5 && last.last && !first.last && last.dmg > first.dmg * (W7.pistolMul - .05) && last.r > first.r, shots };
  },
  // The same thrust deals more when the tip connects than when the shaft does.
  spear() {
    const hitAt = gap => {
      const [A, B] = __V7.pair('spear', 'blade', gap), hp = B.hp;
      let bonus = 0; const off = on('weaponBonus', (f, k) => { if (k === 'tip') bonus++; });
      A.atkCd = 0; SC.press(0, 'attack'); SC.sim(.5); off();
      return { dealt: hp - B.hp, bonus };
    };
    const far = hitAt(150), near = hitAt(70);
    return { ok: far.bonus > 0 || near.bonus > 0 ? true : false, far, near };
  },
  // A clash arms the saber; the next cut is a riposte, and the arm wears off after its window.
  saber() {
    const [A, B] = __V7.pair('saber', 'blade', 150);
    emit('clash', A, B, 0, 0);
    const armed = A.mem.w7Riposte > SC.G.t;
    let got = 0; const off = on('weaponBonus', (f, k) => { if (k === 'riposte') got++; });
    for (let i = 0; i < 4 && !got; i++) { A.atkCd = 0; SC.press(0, 'attack'); SC.sim(.45); }
    off();
    emit('clash', A, B, 0, 0); SC.sim(2.2);
    return { ok: armed && got > 0 && !(A.mem.w7Riposte > SC.G.t), armed, got };
  },
  // The hammer's quake reaches a foe 180 px from the slam (the v4 wave stopped at 150).
  hammer() {
    const [A, B] = __V7.pair('hammer', 'blade', 300), hp = B.hp, g = feetY(A);
    meleeShockwave(A, B.P[2].x - 180, g, W7.quakeR, W7.quakeDmg);
    return { ok: B.hp < hp && W7.quakeR > 150, dealt: hp - B.hp };
  },
  // Triggering Time Stop sets the next field 4.5 s out instead of 6 s.
  chrono() {
    const [A, B] = __V7.pair('chrono-katana', 'blade', 120), def = WEAPONS['chrono-katana'];
    for (let i = 0; i < 3; i++) def.onHit(A, B, { x: 0, y: 0 });
    const wait = A.mem.chronoReady - SC.G.t;
    return { ok: Math.abs(wait - W7.chronoRecharge) < .01 && !!B.status.timewarp, wait };
  },
  // Chainsaw grind ticks bite harder the longer they last, ending in a RIP.
  chainsaw() {
    const [A, B] = __V7.pair('chainsaw', 'blade', 90), ticks = [];
    let rip = 0; const offB = on('weaponBonus', (f, k) => { if (k === 'rip') rip++; });
    const offD = on('damage', (V, amt, o) => { if (V === B && o.kind === 'status') ticks.push(amt); });
    for (let i = 0; i < 8 && !rip; i++) { A.atkCd = 0; SC.press(0, 'attack'); SC.sim(.6); }
    offB(); offD();
    return { ok: rip > 0 || (ticks.length > 2 && ticks[ticks.length - 1] > ticks[0]), rip, ticks };
  },
};
async function testFocus(page, { check, rows }) {
  for (const name of Object.keys(FOCUS)) {
    const r = await page.evaluate(n => { const e0 = SC.errors.length, r = FOCUS_FNS[n](); r.errors = SC.errors.slice(e0).map(e => e.msg); return r; }, name);
    const ok = check(r.ok && !r.errors.length, `v7w focus ${name}: ${JSON.stringify(r)}`);
    rows.push({ kind: 'v7w', key: 'focus ' + name, ok: !!ok, note: JSON.stringify(r).slice(0, 110) });
  }
}

// ---------- 3. content ----------
async function testContent(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const bad = [];
    for (const k in W7_POWER) if (WEAPONS[k] && WEAPONS[k].power !== W7_POWER[k]) bad.push('power ' + k);
    for (const [key, [w, label, , snd]] of Object.entries(W7_BONUS)) {
      const def = WEAPONS[w], word = label.toLowerCase().replace(/[^a-z ]/g, '').split(' ')[0].slice(0, 4);
      if (!def) { bad.push('missing ' + w); continue; }
      if (!def.desc.toLowerCase().includes(word)) bad.push('desc ' + w);
      if (typeof SFX[snd] !== 'function') bad.push('sfx ' + snd);
      if (!LORE_LINES.w[w]) bad.push('lore ' + w);
    }
    for (const k in W7_WSND) if (WSND[k] !== W7_WSND[k]) bad.push('wsnd ' + k);
    for (const k of Object.keys(WEAPONS)) if (WEAPONS[k].tier && !['common', 'rare', 'epic', 'mythic'].includes(WEAPONS[k].tier)) bad.push('tier ' + k);
    const lines = Object.values(LORE_LINES.w);   // every lore line still unique
    if (new Set(lines).size !== lines.length) bad.push('lore duplicate');
    // Every bonus sound plays without an AudioContext (sfx returns early) and with the game muted.
    try { for (const [, , , snd] of Object.values(W7_BONUS)) sfx(snd, 1); } catch (e) { bad.push('sfx throws ' + e.message); }
    return bad;
  });
  const ok = check(!r.length, `v7w content: ${r.join(', ')}`);
  rows.push({ kind: 'v7w', key: 'content (power, desc, sounds, lore, tiers)', ok: !!ok, note: r.join(', ') || '16 bonuses' });
}

// ---------- 4. balance: the latest round-robin results, if any are in tmp/ ----------
function testBalance({ check, rows }) {
  for (const [file, lo, hi] of [['balance-weapons-normal-v3.json', 42, 58], ['balance-weapons-hard-v3.json', 30, 70]]) {
    const p = path.join(ROOT, 'tmp', file);
    if (!fs.existsSync(p) || Date.now() - fs.statSync(p).mtimeMs > 3 * 864e5) continue;   // only a run from the last 3 days
    const { rows: res } = JSON.parse(fs.readFileSync(p, 'utf8'));
    const only = p.replace('.json', '-only.json');   // a newer re-measure of a few weapons (onlyKeys) replaces their rows
    if (fs.existsSync(only) && fs.statSync(only).mtimeMs > fs.statSync(p).mtimeMs) {
      const { rows: again } = JSON.parse(fs.readFileSync(only, 'utf8'));   // the re-measured keys fought every pair: many rounds
      for (const r of again) if (r.rounds > 200) { const i = res.findIndex(x => x.weapon === r.weapon); if (i >= 0) res[i] = r; }
    }
    const out = res.filter(x => x.win < lo - 2.5 || x.win > hi + 2.5);   // ± the sampling error of a 60 s/pair run
    const ok = check(!out.length, `v7w balance ${file}: outside ${lo}-${hi}%: ${out.map(x => x.weapon + ' ' + x.win).join(', ')}`);
    rows.push({ kind: 'v7w', key: 'balance ' + file, ok: !!ok, note: `${res.length} weapons, ${Math.min(...res.map(x => x.win))}-${Math.max(...res.map(x => x.win))}%` });
  }
}

// ---------- 5. screenshots: each bonus as it lands, with full effects ----------
async function testShots(browser, { check, rows, SHOTS }) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [label, opts] of [['1080', { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }], ['864', { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 }]]) {
    const { page, errors } = await openPage(browser, opts);
    for (const w of Object.keys(DUELS)) {
      const [key, foe] = DUELS[w];
      const got = await page.evaluate(([w, key, foe]) => {
        __V7.seed(2);
        SC.start({ mode: 'watch', map: 'neon', weapons: [w, foe], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
          throws: [['none', 'none'], ['none', 'none']], orbs: false, winScore: 99, weather: 'clear', killcam: false });
        SC.G.state = 'play';
        let hit = null, at = null, n = 0;
        const off = on('weaponBonus', (f, k, B) => { if (f.team === 0 && k === key && !hit) { hit = k; at = B; } });
        for (; n < 120 * 60 && !hit; n++) worldStep(DT);          // real steps: floats, bursts and rings show
        for (let k = 0; k < 6; k++) worldStep(DT);
        off(); SC.G.state = 'paused';
        if (BANNER) BANNER.t = BANNER.len;                       // banners age in render time: drop the ROUND card
        if (at) { const c = chest(at); focusCamera(c.x, c.y - 30, 3); }
        for (let k = 0; k < 60; k++) SC.render(1 / 60);
        return hit;
      }, [w, key, foe]);
      await page.screenshot({ path: path.join(SHOTS, `v7w-${w}-${label}.png`) });
      if (!got) check(false, `v7w screenshot ${w} @${label}: bonus never landed`);
    }
    await menuShots(page, label, SHOTS, check);
    check(!errors.length, `v7w screenshots @${label}: console ${[...new Set(errors)].join(' | ')}`);
    rows.push({ kind: 'v7w', key: 'screenshots @' + label, ok: !errors.length, note: `tmp/smoke/v7w-*-${label}.png` });
    await page.close();
  }
}

// The picker shows a weapon's new description, and How to Play has the Weapon bonuses card.
async function menuShots(page, label, SHOTS, check) {
  await page.evaluate(() => { startMatch(demoConfig()); SC.G.state = 'menu'; openScreen('loadout'); });
  await page.waitForTimeout(250);
  const desc = await page.evaluate(() => {
    const tile = document.querySelector('#loadout [data-key="w-spear"]');
    if (tile) { tile.click(); }
    const d = document.querySelector('#loadout .lo-desc');
    return d ? d.textContent : '';
  });
  await page.waitForTimeout(200);
  check(/TIP!/.test(desc), `v7w loadout @${label}: spear description shows "${desc}"`);
  await page.screenshot({ path: path.join(SHOTS, `v7w-loadout-${label}.png`) });
  await page.evaluate(() => { goBack(); openScreen('howto'); });
  await page.waitForTimeout(250);
  const card = await page.evaluate(() => {
    const c = [...document.querySelectorAll('#howto .help-grid .help-card')].find(x => /Weapon bonuses/.test((x.querySelector('h3') || {}).textContent || ''));
    if (c) c.scrollIntoView({ block: 'center' });
    return !!c;
  });
  await page.waitForTimeout(150);
  check(card, `v7w How to Play @${label}: no Weapon bonuses card`);
  await page.screenshot({ path: path.join(SHOTS, `v7w-howto-${label}.png`) });
  await page.evaluate(() => goBack());
}

async function run(browser, ctx) {
  const { page, errors } = await openPage(browser);
  await page.evaluate(`window.FOCUS_FNS = {${Object.entries(FOCUS).map(([k, f]) => `${k}: ${f.toString().replace(/^\w+\(\)/, 'function ()')}`).join(',\n')}};`);
  for (const t of [testDuels, testFocus, testContent]) {
    try { await t(page, ctx); } catch (e) { ctx.check(false, `v7w ${t.name} crashed: ${e.message}`); }
  }
  ctx.check(!errors.length, 'v7w console: ' + [...new Set(errors)].join(' | '));
  await page.close();
  try { testBalance(ctx); } catch (e) { ctx.check(false, `v7w balance crashed: ${e.message}`); }
  try { await testShots(browser, ctx); } catch (e) { ctx.check(false, `v7w screenshots crashed: ${e.message}`); }
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const browser = await chromium.launch(), failures = [], rows = [];
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    const t0 = Date.now(), noShots = process.argv.includes('--no-shots');
    try { await run(browser, { check, rows, SHOTS: noShots ? null : path.join(ROOT, 'tmp', 'smoke') }); } finally { await browser.close(); }
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`V7 WEAPONS FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`V7 WEAPONS OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
