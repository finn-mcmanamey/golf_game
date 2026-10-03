// Smoke test: builds the game, loads it in headless Chromium and checks EVERY registered weapon, skill, map, mode,
// orb, hat and status (so new content is covered automatically), the core systems, and the menu -> match -> results
// flow. Prints a compact table and exits non-zero on any failure.
//   node tools/smoke.cjs            full run (screenshots of every map go to tmp/smoke/)
//   node tools/smoke.cjs --quick    shorter simulations
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const QUICK = process.argv.includes('--quick');
const SHOTS = path.join(ROOT, 'tmp', 'smoke');
const SECS = QUICK ? 12 : 25;
const failures = [];
const rows = [];

function check(ok, what) { if (!ok) failures.push(what); return ok; }

function build() {
  try { execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { stdio: 'inherit' }); }
  catch { console.error('build failed'); process.exit(1); }
}

// ---------- page-side helpers (serialised into the page) ----------
const PAGE_HELPERS = `
window.__T = {
  // Totals over finished rounds (G.log) plus the round in progress.
  collect() {
    const L = SC.G.log, logged = L.length && L[L.length - 1].round === SC.G.round;
    const cur = logged ? [] : SC.F.map(f => ({ dmg: f.stats.dmgDealt, hits: f.stats.hits, skillsUsed: f.stats.skills, shots: f.stats.shots, upright: f.aliveT ? f.upT / f.aliveT : 1 }));
    const all = L.flatMap(r => r.fighters).concat(cur);
    const sum = k => all.reduce((s, f) => s + (f[k] || 0), 0);
    return { rounds: L.length, dmg: sum('dmg'), hits: sum('hits'), skills: sum('skillsUsed'), shots: sum('shots'),
      upright: all.length ? sum('upright') / all.length : 1, avgT: L.length ? L.reduce((s, r) => s + r.time, 0) / L.length : 0 };
  },
  nan() { return SC.F.some(f => f.P.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) || PROJ.some(p => !Number.isFinite(p.x)); },
  // Simulates in chunks, checking for NaN and running an optional per-chunk action; renders a frame at the end.
  run(cfg, secs, each) {
    const e0 = SC.errors.length;
    SC.start(cfg);
    let nan = false;
    for (let t = 0; t < secs && !nan; t += 1) { if (each) each(); SC.sim(1); nan = __T.nan(); }
    for (let k = 0; k < 3; k++) SC.render(1 / 60);
    return Object.assign(__T.collect(), { nan, errors: SC.errors.slice(e0).map(e => e.msg), state: SC.G.state });
  },
};`;

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource|ERR_|fonts\.g/.test(m.text())) return;   // offline font requests are fine
    errors.push(m.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(PAGE_HELPERS);
  return { page, errors };
}

// ---------- registry coverage ----------
async function testWeapons(page) {
  const res = await page.evaluate(secs => {
    const firstMap = Object.keys(SC.reg.MAPS).find(k => !SC.reg.MAPS[k].hidden);
    return Object.keys(SC.reg.WEAPONS).map(k => {
      const r = __T.run({ mode: 'watch', map: firstMap, weapons: [k, k], skills: [['none', 'none'], ['none', 'none']] }, secs);
      return Object.assign(r, { key: k, ranged: !!SC.reg.WEAPONS[k].ranged });
    });
  }, SECS);
  for (const r of res) {
    const ok = check(!r.errors.length, `weapon ${r.key}: errors ${r.errors.join(' | ')}`)
      & check(!r.nan, `weapon ${r.key}: NaN positions`)
      & check(r.dmg > 0, `weapon ${r.key}: no damage dealt in ${SECS}s`)
      & check(r.upright >= .55, `weapon ${r.key}: fighters upright only ${(r.upright * 100).toFixed(0)}%`)
      & check(!r.ranged || r.shots > 0, `weapon ${r.key}: ranged weapon never fired`);
    rows.push({ kind: 'weapon', key: r.key, ok: !!ok, ...summary(r) });
  }
}

async function testSkills(page) {
  const res = await page.evaluate(secs => {
    return Object.keys(SC.reg.SKILLS).map(k => {
      // Both fighters carry the skill; we also press it every second so it is exercised even if the AI never wants it.
      const r = __T.run({ mode: 'watch', weapons: ['blade', 'blade'], skills: [[k, 'none'], ['none', k]] }, secs,
        () => { SC.press(0, 'skill1'); SC.press(1, 'skill2'); });
      return Object.assign(r, { key: k });
    });
  }, SECS);
  for (const r of res) {
    const ok = check(!r.errors.length, `skill ${r.key}: errors ${r.errors.join(' | ')}`)
      & check(!r.nan, `skill ${r.key}: NaN positions`)
      & check(r.skills > 0, `skill ${r.key}: never used successfully`)
      & check(r.upright >= .5, `skill ${r.key}: fighters upright only ${(r.upright * 100).toFixed(0)}%`);
    rows.push({ kind: 'skill', key: r.key, ok: !!ok, ...summary(r) });
  }
}

async function testMaps(page) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const keys = await page.evaluate(() => Object.keys(SC.reg.MAPS));
  for (const k of keys) {
    const r = await page.evaluate(([k, secs]) => {
      const out = __T.run({ mode: 'watch', map: k, weapons: ['random', 'random'] }, secs);
      const hat = Object.keys(SC.reg.HATS).find(h => h !== 'none');
      SC.start({ mode: 'watch', map: k, weapons: ['random', 'random'], hats: [hat, hat] });
      SC.sim(3.2); BANNER = null;
      for (let i = 0; i < 40; i++) SC.render(1 / 60);
      return Object.assign(out, { key: k, map: SC.state().map });
    }, [k, SECS]);
    await page.screenshot({ path: path.join(SHOTS, `map-${k}.png`) });
    const ok = check(!r.errors.length, `map ${k}: errors ${r.errors.join(' | ')}`)
      & check(r.map === k, `map ${k}: match did not load it`)
      & check(!r.nan, `map ${k}: NaN positions`)
      & check(r.dmg > 0, `map ${k}: no damage dealt`)
      & check(r.upright >= .5, `map ${k}: fighters upright only ${(r.upright * 100).toFixed(0)}%`);
    rows.push({ kind: 'map', key: k, ok: !!ok, ...summary(r) });
  }
}

async function testModes(page) {
  const res = await page.evaluate(secs => Object.keys(SC.reg.MODES).map(k => {
    // autopilot: the CPU brain drives human fighters too, so every mode can be simulated.
    const e0 = SC.errors.length;
    // Training's dummy stands still, and on a few arenas (a high ledge, a spike pit) the autopilot can't reach it in
    // time: run it on the open Dojo so "no damage" means a real bug, not an unlucky map.
    const map = k === 'training' && SC.reg.MAPS.dojo ? 'dojo' : 'random';
    const r = __T.run({ mode: k, autopilot: true, map }, secs);
    const fighters = SC.F.length;
    SC.sim(240);
    const over = SC.G.state === 'over', result = SC.G.result;
    return Object.assign(r, { key: k, fighters, over, title: result && result.title, errors: SC.errors.slice(e0).map(e => e.msg) });
  }), SECS);
  for (const r of res) {
    const ok = check(!r.errors.length, `mode ${r.key}: errors ${r.errors.join(' | ')}`)
      & check(r.fighters >= 2, `mode ${r.key}: fewer than 2 fighters`)
      & check(!r.nan, `mode ${r.key}: NaN positions`)
      & check(r.dmg > 0, `mode ${r.key}: no damage dealt`)
      & check(!r.over || !!r.title, `mode ${r.key}: match ended without a results title`);
    rows.push({ kind: 'mode', key: r.key, ok: !!ok, ...summary(r), note: r.over ? 'finished: ' + r.title : 'still running after 240s' });
  }
}

async function testOrbsHatsStatuses(page) {
  const res = await page.evaluate(() => {
    const out = [];
    const e = () => SC.errors.length;
    for (const k of Object.keys(SC.reg.ORBS)) {
      const e0 = e();
      SC.start({ mode: 'watch', weapons: ['blade', 'blade'] }); SC.sim(1.2);
      const o = spawnOrb(k), f = SC.F[0], c = chest(f);
      let grabbed = false;
      if (o) { o.solid = null; o.x = c.x; o.y = c.y; SC.sim(.05); grabbed = o.taken; }
      SC.sim(2); SC.render();
      out.push({ kind: 'orb', key: k, ok: !!o && grabbed && e() === e0, note: !o ? 'no spawn spot' : grabbed ? '' : 'not grabbed', errors: SC.errors.slice(e0).map(x => x.msg) });
    }
    for (const k of Object.keys(SC.reg.HATS)) {
      const e0 = e();
      SC.start({ mode: 'watch', weapons: ['blade', 'blade'], hats: [k, k] }); SC.sim(1); SC.render(); SC.render();
      out.push({ kind: 'hat', key: k, ok: e() === e0, errors: SC.errors.slice(e0).map(x => x.msg) });
    }
    for (const k of Object.keys(SC.reg.STATUS)) {
      const e0 = e();
      SC.start({ mode: 'watch', weapons: ['blade', 'blade'] }); SC.sim(1.2);
      const s = addStatus(SC.F[0], k, 2, 1, SC.F[1]);
      SC.render(); SC.sim(1); SC.render(); SC.sim(1.5);
      out.push({ kind: 'status', key: k, ok: !!s && e() === e0 && !__T.nan(), errors: SC.errors.slice(e0).map(x => x.msg) });
    }
    return out;
  });
  for (const r of res) {
    check(r.ok, `${r.kind} ${r.key}: ${r.note || ''} ${r.errors.join(' | ')}`);
    rows.push({ kind: r.kind, key: r.key, ok: r.ok, note: r.note || '' });
  }
}

// ---------- core systems (test-only content is registered at runtime, hidden from menus) ----------
async function testCore(page) {
  const res = await page.evaluate(() => {
    const out = {};
    const DT = 1 / 120;
    const quiet = () => { SC.G.state = 'paused'; SC.G.lock = 0; };   // freeze the real-time loop and round flow
    defMap('t-pit', { hidden: true, floor: null, walls: false, orbs: false,
      solids: [{ x: 200, y: 600, w: 880, h: 40, oneWay: false }, { x: 560, y: 420, w: 160, move: { dx: 200, dy: 0, period: 4 } }],
      hazards: [{ kind: 'spikes', x: 900, y: 580, w: 80, h: 20, dps: 40 }], spawns: [[400, 600], [800, 600]] });
    defWeapon('t-shield', { hidden: true, cat: 'shield', len: 40, mass: 1, dmg: .2, width: 10, block: 1, draw() {} });
    defWeapon('t-dual', { hidden: true, cat: 'blade', len: 60, offhand: 't-shield', draw() {} });
    // Idle humans (no autopilot) so positions only change when the test moves them.
    defMode('t-teams', { hidden: true, setup: () => ({ roster: [
      { team: 0, weapon: 'blade', ctrl: 'human' }, { team: 0, weapon: 'spear', ctrl: 'human', slot: 1 },
      { team: 1, weapon: 'hammer', scale: 1.6, hpMul: 1.5, ctrl: 'human' }, { team: 1, weapon: 'pistol', ctrl: 'human', slot: 1 }] }) });
    const place = (f, x) => { moveFighter(f, x - f.P[2].x, 650 - feetY(f)); f.P.forEach(p => { p.ox = p.x; p.oy = p.y; }); };
    const kos = [];
    on('ko', (v, k, o) => kos.push(o.kind || 'melee'));

    // Ring-out: a fighter dropped into the void is KO'd.
    SC.start({ mode: 'pvp', map: 't-pit', weapons: ['blade', 'blade'] }); quiet();
    moveFighter(SC.F[1], 100 - SC.F[1].P[2].x, 0); SC.sim(3);
    out.ringout = !SC.F[1].alive && kos.includes('ringout');

    // Moving platform carries a fighter standing on it.
    SC.start({ mode: 'pvp', map: 't-pit', weapons: ['blade', 'blade'] }); quiet(); SC.sim(.1);
    const plat = MAP.solids[1], f0 = SC.F[0];
    moveFighter(f0, plat.x + plat.w / 2 - f0.P[2].x, plat.y - feetY(f0) - 2); f0.P.forEach(p => { p.ox = p.x; p.oy = p.y; });
    const px0 = plat.x, fx0 = f0.P[2].x; SC.sim(1.2);
    out.carry = Math.abs((f0.P[2].x - fx0) - (plat.x - px0)) < 40 && Math.abs(plat.x - px0) > 60 && Math.abs(feetY(f0) - plat.y) < 12;

    // Hazard hurts.
    SC.start({ mode: 'pvp', map: 't-pit', weapons: ['blade', 'blade'] }); quiet();
    moveFighter(SC.F[1], 940 - SC.F[1].P[2].x, 0); SC.sim(.6);
    out.hazard = SC.F[1].hp < SC.F[1].maxHp;

    // Projectiles: explode, homing, bounce, pierce, and a shield deflect.
    SC.start({ mode: 't-teams', map: 'neon' }); quiet(); SC.sim(.2);
    const [a, b, boss, d] = SC.F;
    out.teams = enemiesOf(a).length === 2 && alliesOf(a).length === 1 && nearestEnemy(a).team === 1;
    out.boss = boss.maxHp === 240 && boss.scale === 1.6;
    const hp0 = boss.hp, bc = chest(boss);
    spawnProj({ owner: a, x: bc.x - 30, y: bc.y, vx: 900, vy: 0, explode: 120, dmg: 20 }); SC.sim(.2);
    out.explode = boss.hp < hp0;
    const dc = chest(d), hp1 = d.hp;
    spawnProj({ owner: a, x: dc.x, y: dc.y - 300, vx: 0, vy: -600, homing: 12, dmg: 5, life: 3 }); SC.sim(1.5);
    out.homing = d.hp < hp1;
    const bp = spawnProj({ owner: a, x: 640, y: 600, vx: 0, vy: 900, bounce: 2, life: 2, dmg: 1 }); SC.sim(.15);
    out.bounce = bp.bounce < 2;
    place(boss, 700); place(d, 840); place(a, 200); place(b, 120); SC.sim(.6);
    const pp = spawnProj({ owner: a, x: 560, y: 610, vx: 1400, vy: 0, pierce: 3, dmg: 2, life: 1 });
    SC.sim(.4);
    out.pierce = pp.hits.length >= 2;

    SC.start({ mode: 'pvp', map: 'neon', weapons: ['t-dual', 'pistol'] }); quiet(); SC.sim(.5);
    const s = SC.F[0];
    out.offhand = !!s.off && s.off.w.key === 't-shield';
    const sh = s.P[s.off.tip], hand = s.P[s.off.hand], mx = (sh.x + hand.x) / 2, my = (sh.y + hand.y) / 2;
    const dp = spawnProj({ owner: SC.F[1], x: mx + 24, y: my, vx: -1500, vy: 0, dmg: 5 }); SC.sim(DT * 4);
    out.deflect = dp.team === s.team;

    // Statuses: freeze stops actions and shatters on a hit; giant grows the weapon.
    addStatus(s, 'freeze', 2); out.freeze = !canAct(s);
    damage(s, 5, { src: SC.F[1], kind: 'melee' }); out.shatter = !s.status.freeze;
    const len0 = s.main.links[0].cur; addStatus(s, 'giant', 3); SC.sim(1);
    out.giant = s.main.links[0].cur > len0 * 1.3;

    // Ranged weapons fire, use ammo, and reload.
    const g = SC.F[1], ammo0 = g.ammo;
    SC.press(1, 'attack'); SC.sim(.1);
    out.fires = g.ammo === ammo0 - 1;
    for (let k = 0; k < 10; k++) { g.atkCd = 0; SC.press(1, 'attack'); SC.sim(DT * 2); }
    out.reload = g.reload > 0 || g.ammo === g.w.ranged.ammo;

    // Auto weapons keep firing while the attack key is held.
    defWeapon('t-auto', { hidden: true, cat: 'ranged', len: 40, ranged: { auto: true, cooldown: .08, ammo: 30, reload: 1 }, draw() {} });
    SC.start({ mode: 'pvp', map: 'neon', weapons: ['t-auto', 'blade'] }); quiet(); SC.sim(.3);
    SC.F[0].inp.attackHeld = true; SC.sim(.6);
    out.autoFire = SC.F[0].stats.shots >= 5;

    // Double jump and dash.
    SC.start({ mode: 'pvp', map: 'neon', weapons: ['blade', 'blade'] }); quiet(); SC.sim(.5);
    const j = SC.F[0], y0 = j.P[2].y;
    j.inp.jumpHeld = true;
    SC.press(0, 'jump'); SC.sim(.3); SC.press(0, 'jump'); SC.sim(.05);
    out.doubleJump = j.airJumps === 0 && j.P[2].y < y0 - 150;
    SC.sim(1.5); const x0 = j.P[2].x; SC.press(0, 'dash'); SC.sim(.4);
    out.dash = Math.abs(j.P[2].x - x0) > 120;
    out.errors = SC.errors.map(e => e.msg);
    return out;
  });
  const errs = res.errors; delete res.errors;
  for (const [k, v] of Object.entries(res)) {
    check(v, `core ${k}: failed`);
    rows.push({ kind: 'core', key: k, ok: !!v });
  }
  check(!errs.length, 'core: errors ' + errs.join(' | '));
}

// ---------- the real UI: menu -> match -> pause -> results -> menu ----------
// Phone-sized touch device: on-screen buttons appear during play and drive P1.
// Input checks measure P1's movement, so the CPU goes idle (no decisions, no reflex shooting) and can't stun, freeze,
// slow, shoot or pull P1 mid-check.
const CALM_CPUS = () => { for (const f of SC.F) if (f.ctrl === 'cpu') { f.ai.behave = 'idle'; f.ai.t = 1e9; f.inp.mx = 0; f.inp.attackHeld = false; } };

async function testTouch(browser) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.screenshot({ path: path.join(SHOTS, 'touch-menu.png') });
  await page.tap('#menu .go');
  await page.evaluate(CALM_CPUS);
  await page.waitForTimeout(1500);
  const visible = await page.isVisible('#touch');
  const x0 = await page.evaluate(() => SC.F[0].P[2].x);
  const box = await page.locator('#touch [data-act="right"]').boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
  }
  const moved = (await page.evaluate(() => SC.F[0].P[2].x)) - x0;
  await page.screenshot({ path: path.join(SHOTS, 'touch-play.png') });
  const ok = check(visible, 'touch: buttons hidden on a touch device') & check(moved > 40, 'touch: right button did not move P1')
    & check(!errors.length, 'touch: errors ' + errors.join(' | '));
  rows.push({ kind: 'ui', key: 'touch controls', ok: !!ok });
  await ctx.close();
}

async function testUI(browser) {
  const { page, errors } = await newPage(browser);
  const step = async (name, fn) => { try { const ok = await fn(); check(ok, `ui ${name}: failed`); rows.push({ kind: 'ui', key: name, ok: !!ok }); } catch (e) { check(false, `ui ${name}: ${e.message}`); rows.push({ kind: 'ui', key: name, ok: false }); } };
  await step('menu visible', async () => page.isVisible('#menu .go'));
  await page.screenshot({ path: path.join(SHOTS, 'ui-menu.png') });
  await step('fight starts a match', async () => {
    await page.click('#menu .go');
    await page.evaluate(CALM_CPUS);
    await page.waitForTimeout(300);
    return page.evaluate(() => SC.G.state === 'play' && SC.F.some(f => f.ctrl === 'human'));
  });
  await page.waitForTimeout(1300);   // let "ROUND 1 / FIGHT!" finish
  await step('keyboard moves P1', async () => {
    const x0 = await page.evaluate(() => SC.F[0].P[2].x);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(450); await page.keyboard.up('KeyD');
    const x1 = await page.evaluate(() => SC.F[0].P[2].x);
    return x1 - x0 > 60;
  });
  // Reads P1's input while the key is held (the arena is random: on ice, turning around takes most of the hold).
  await step('P1 also answers the arrow keys in 1P', async () => {
    const x0 = await page.evaluate(() => SC.F[0].P[2].x);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(200);
    const mx = await page.evaluate(() => SC.F[0].inp.mx);
    await page.waitForTimeout(250); await page.keyboard.up('ArrowLeft');
    return mx < 0 && (await page.evaluate(() => SC.F[0].P[2].x)) - x0 < -15;
  });
  await step('attack key swings', async () => {
    await page.keyboard.press('KeyS'); await page.waitForTimeout(60);
    return page.evaluate(() => SC.F[0].swingT > 0 || SC.F[0].atkCd > 0 || SC.F[0].stats.shots > 0);   // fast guns' cooldown is < 60ms
  });
  await page.screenshot({ path: path.join(SHOTS, 'ui-play.png') });
  await step('escape pauses', async () => {
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    return (await page.evaluate(() => SC.G.state === 'paused')) && page.isVisible('#pause');
  });
  await page.screenshot({ path: path.join(SHOTS, 'ui-pause.png') });
  await step('resume', async () => {
    await page.click('#pause .go'); await page.waitForTimeout(150);
    return page.evaluate(() => SC.G.state === 'play');
  });
  await step('results after the match', async () => {
    await page.evaluate(() => { SC.G.score[0] = SC.G.winScore - 1; SC.G.lock = 0; damage(SC.F[1], 999, { src: SC.F[0], kind: 'melee' }); SC.sim(4); });
    await page.waitForTimeout(300);
    return (await page.evaluate(() => SC.G.state === 'over')) && page.isVisible('#over h2');
  });
  await page.screenshot({ path: path.join(SHOTS, 'ui-results.png') });
  await step('back to menu', async () => {
    await page.click('#over button:not(.go)'); await page.waitForTimeout(200);
    return (await page.evaluate(() => SC.G.state === 'menu')) && page.isVisible('#menu .go');
  });
  await step('controls panel', async () => {
    await page.click('#menu button:has-text("Controls")'); await page.waitForTimeout(100);
    const vis = await page.isVisible('#controls .binds');
    await page.screenshot({ path: path.join(SHOTS, 'ui-controls.png') });
    await page.click('#controls .go');
    return vis && page.isVisible('#menu .go');
  });
  await step('double-tap dashes', async () => {
    await page.evaluate(() => { startMatch({ mode: 'versus' }); SC.G.lock = 0; });
    await page.evaluate(CALM_CPUS);
    await page.keyboard.press('KeyD'); await page.waitForTimeout(90); await page.keyboard.press('KeyD'); await page.waitForTimeout(150);
    return page.evaluate(() => SC.F[0].stats.dashes > 0);
  });
  await step('gamepad moves and jumps', async () => {
    await page.evaluate(() => {
      window.__pad = { index: 0, id: 'mock pad', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
      navigator.getGamepads = () => [window.__pad];
      window.__x0 = SC.F[0].P[2].x; __pad.axes[0] = 1;
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => { __pad.axes[0] = 0; __pad.buttons[0].pressed = true; });
    await page.waitForTimeout(120);
    const r = await page.evaluate(() => ({ moved: SC.F[0].P[2].x - __x0, jumps: SC.F[0].stats.jumps }));
    await page.evaluate(() => { __pad.buttons[0].pressed = false; navigator.getGamepads = () => []; });
    return r.moved > 60 && r.jumps > 0;
  });
  await step('no console errors', async () => !errors.length && !(await page.evaluate(() => SC.errors.length)));
  if (errors.length) failures.push('ui console: ' + errors.join(' | '));
  await page.close();
}

function summary(r) {
  return { rounds: r.rounds, avgT: r.avgT ? r.avgT.toFixed(1) : '', hits: r.hits, dmg: r.dmg, upright: Math.round(r.upright * 100) + '%' };
}

(async () => {
  const t0 = Date.now();
  build();
  const browser = await chromium.launch();
  try {
    const { page, errors } = await newPage(browser);
    check(!(await page.evaluate(() => SC.errors.length)), 'boot: errors ' + (await page.evaluate(() => SC.errors.map(e => e.msg).join(' | '))));
    await testWeapons(page);
    await testSkills(page);
    await testMaps(page);
    await testModes(page);
    await testOrbsHatsStatuses(page);
    await testCore(page);
    if (errors.length) failures.push('console: ' + [...new Set(errors)].join(' | '));
    await page.close();
    await testUI(browser);
    await testTouch(browser);
  } catch (e) {
    failures.push('smoke crashed: ' + (e.stack || e.message));
  } finally {
    await browser.close();
  }
  console.table(rows.map(r => ({ kind: r.kind, key: r.key, ok: r.ok ? 'ok' : 'FAIL', rounds: r.rounds ?? '', avgT: r.avgT ?? '', hits: r.hits ?? '', dmg: r.dmg ?? '', upright: r.upright ?? '', note: r.note ?? '' })));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (failures.length) {
    console.error(`\nSMOKE FAILED (${failures.length}) in ${secs}s:\n - ` + failures.join('\n - '));
    process.exit(1);
  }
  console.log(`\nSMOKE OK: ${rows.length} checks in ${secs}s. Screenshots in tmp/smoke/`);
})();
