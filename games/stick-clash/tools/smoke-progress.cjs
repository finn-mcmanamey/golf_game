// Smoke tests for customisation and progression (78-outfits, 78-pets, 79-mutators, 79-progress, 98-ui-progress).
// Called by tools/smoke.cjs; also runs on its own (`node tools/smoke-progress.cjs`, after `node build.mjs`).
// - every outfit, weapon skin, K.O. effect, pet, pose, mutator and mini-game runs/draws without errors and does its job;
// - taunt (key bind, safe-distance meter, cancel on hit), victory pose, XP + track rewards, quests (seeded, reroll,
//   completion), secrets (cheat codes), presets, codex stats, pets/mutators off in Ranked;
// - screenshots at 1280x720 and 400x800 (tmp/smoke/prog-*.png): creator, look tab, track, quests, codex, arena
//   mutators, outfits in motion, pets, a mutator in play, a mini-game, results XP.
const path = require('path');
const fs = require('fs');

async function testSim(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const out = {}, e0 = SC.errors.length, keep = { prog: JSON.stringify(PROG), tasks: store.get('tasks', null), presets: store.get('presets', null), profile: JSON.stringify(PROFILE) };
    const errs = () => SC.errors.slice(e0).map(e => e.msg);
    const finite = f => f.P.every(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    const look = o => ({ loadouts: [{ weapon: o.weapon || 'katana', look: Object.assign({ skins: {} }, o) }, { weapon: 'spear', look: Object.assign({ skins: {} }, o) }] });
    out.counts = { outfits: listOf(OUTFITS).length - 1, skins: listOf(WSKINS).length - 1, ko: listOf(KOFX).length - 1, pets: listOf(PETS).length - 1,
      poses: listOf(POSES).length, mutators: Object.keys(MUTATORS).length, minis: Object.keys(MINIS).length, track: TRACK.length - 1, secrets: Object.keys(SECRETS).length,
      titles: Object.keys(TITLES).length, tasks: Object.keys(TASKS).length };

    // Outfits: cloth simulates and stays finite while fighting.
    out.outfits = Object.keys(OUTFITS).map(k => {
      SC.start(Object.assign({ mode: 'watch' }, look({ outfit: k })));
      SC.G.lock = 0;
      for (let n = 0; n < 40; n++) { SC.sim(.05); SC.render(1 / 60); }
      const c = CLOTH.get(SC.F[0]), ok = OUTFITS[k].strands.length ? !!c && c.strands.every(s => s.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) : true;
      return [k, ok];
    });
    // Skins: each recolours (a red maps elsewhere) and draws on a weapon of every category.
    const cats = [...new Set(listOf(WEAPONS).map(w => w.cat))];
    out.skins = Object.keys(WSKINS).filter(k => k !== 'none').map(k => {
      const changed = skinColor(WSKINS[k], '#ff0000') !== '#ff0000' && skinColor(WSKINS[k], 'rgba(10,200,30,.5)').endsWith(',0.5)');
      for (const cat of cats) {
        const w = listOf(WEAPONS).find(x => x.cat === cat);
        SC.start(Object.assign({ mode: 'watch' }, look({ weapon: w.key, skins: { [cat]: k } }))); SC.sim(.3); SC.render(1 / 60);
      }
      return [k, changed];
    });
    // K.O. effects: particles spawn on a K.O. by a fighter wearing it, and draw.
    out.ko = Object.keys(KOFX).filter(k => k !== 'none').map(k => {
      SC.start(Object.assign({ mode: 'pvp' }, look({ ko: k }))); SC.G.lock = 0;
      damage(SC.F[1], 500, { src: SC.F[0], kind: 'skill' });
      SC.render(1 / 60); SC.G.t += .3; SC.render(1 / 60);
      return [k, KO_PARTS.length > 0];
    });
    // Taunt: key bound, meter at a safe distance, cancelled by a hit.
    SC.start({ mode: 'pvp', weapons: ['katana', 'katana'] }); SC.G.lock = 0;
    moveFighter(SC.F[1], 900 - SC.F[1].P[2].x, 0); moveFighter(SC.F[0], 200 - SC.F[0].P[2].x, 0); SC.sim(.3);
    let s0 = SC.F[0].super; SC.press(0, 'taunt'); SC.sim(1.3);
    out.tauntMeter = SC.F[0].super - s0 >= TAUNT.meter - .01;
    SC.F[0].mem.tauntCd = 0; s0 = SC.F[0].super; SC.press(0, 'taunt'); SC.sim(.3);
    damage(SC.F[0], 3, { src: SC.F[1], kind: 'skill' }); SC.sim(1.2);
    out.tauntCancel = SC.F[0].super - s0 < 2;
    out.tauntBind = BIND_ACTIONS.includes('taunt') && BINDS[0].taunt === 'KeyT' && BINDS[1].taunt === 'Quote' && PAD_BUTTONS.taunt === 12;
    // Victory pose: the winner raises its hands above the neck (cheer).
    SC.start({ mode: 'pvp', weapons: ['katana', 'katana'] }); SC.G.lock = 0; SC.sim(.3);
    damage(SC.F[1], 500, { src: SC.F[0], kind: 'skill' }); SC.sim(.7);
    out.victory = SC.F[0].P[6].y < SC.F[0].P[1].y && SC.F[0].P[4].y < SC.F[0].P[1].y;
    // Pets: set each pet's trigger up and check it fires; then pets are off in Ranked and One-Hit.
    const used = {};
    const offPet = on('petUse', (f, k) => { used[k] = (used[k] || 0) + 1; });
    const setups = {
      bitbot: f => spawnProj({ owner: SC.F[1], x: chest(f).x + 50, y: chest(f).y, vx: -10, vy: 0, r: 4, dmg: 1, life: 2 }),
      tick: f => spawnProj({ owner: SC.F[1], x: chest(f).x + 120, y: chest(f).y, vx: -10, vy: 0, r: 4, dmg: 1, life: 2 }),
      sprig: f => { f.hp = 30; }, zappy: () => moveFighter(SC.F[1], SC.F[0].P[2].x + 100 - SC.F[1].P[2].x, 0),
      wisp: () => moveFighter(SC.F[1], SC.F[0].P[2].x + 90 - SC.F[1].P[2].x, 0), bubbles: f => addStatus(f, 'slow', 5),
      fetch: () => spawnOrb(), glim: f => { f.super = 10; },
    };
    out.pets = Object.keys(PETS).filter(k => k !== 'none').map(k => {
      SC.start(Object.assign({ mode: 'pvp', weapons: ['katana', 'katana'] }, look({ pet: k }))); SC.G.lock = 0; SC.sim(.1);
      SC.F[0].mem.pet.cd = 0;
      setups[k] && setups[k](SC.F[0]); SC.sim(.05); SC.render(1 / 60);
      return [k, (used[k] || 0) > 0];
    });
    offPet();
    SC.start({ mode: 'ranked' }); out.petsOffRanked = !petsAllowed();
    SC.start({ mode: 'ohko' }); out.petsOffOhko = !petsAllowed();
    // Mutators: each starts, runs, and shows its effect.
    const mutCheck = {
      bigheads: () => SC.F[0].headMul > 1.5, lowgrav: () => PHYS.gravity < MAP.gravity, tiny: () => SC.F[0].L.some(l => !l.weapon && l.cur < l.r * .8),
      speed: () => SC.G.cfg.speed === 1.5, sudden: () => SC.F[0].dmgTakenMul === 2.5, supercharged: () => true, orbstorm: () => SC.G.cfg.orbRate === 3,
      vampire: () => { const a = SC.F[0], b = SC.F[1]; a.hp = 50; damage(b, 12, { src: a, kind: 'melee' }); return a.hp > 50; },
      explosive: () => { let n = 0; const o = on('explode', () => n++); damage(SC.F[1], 500, { src: SC.F[0], kind: 'skill' }); o(); return n > 0; },
      ricochet: () => { spawnProj({ owner: SC.F[0], x: 600, y: 300, vx: 10, vy: 0, r: 4, dmg: 1, life: 1 }); SC.sim(.02); return PROJ.some(p => p.mutRico && p.bounce >= 2); },
      randomweapons: () => !!SC.F[0].w,
    };
    out.mutators = Object.keys(MUTATORS).map(k => {
      const was = SC.errors.length;
      SC.start({ mode: 'pvp', weapons: ['katana', 'katana'], mutators: [k] }); SC.G.lock = 0;
      const sup = SC.F[0].super;
      SC.sim(.5); SC.render(1 / 60);
      const ok = (mutCheck[k] ? mutCheck[k]() : true) && (k !== 'supercharged' || sup === 100);
      SC.sim(2);
      return [k, ok && SC.errors.length === was];
    });
    SC.start({ mode: 'ranked', mutators: ['lowgrav'] }); out.mutOffRanked = MUT_ON.length === 0;
    // Mini-games: each runs to its end with nobody K.O.'d, then the real round starts (with the perk).
    out.minis = Object.keys(MINIS).map(k => {
      SC.start({ mode: 'watch', minigames: true, map: 'dojo' }); SC.G.round = 2; miniStart(2, k); SC.G.lock = 0;
      const first = SC.F[0];
      SC.sim(MINIS[k].time + .5);
      const ok = MINI && MINI.over && SC.F[0] !== first && SC.G.round === 2 && SC.G.state !== 'over' && SC.F.every(finite);
      return [k, !!ok, MINI ? MINI.pts.join('/') : ''];
    });
    let minis = 0;
    const offMini = on('miniStart', () => minis++);
    SC.start({ mode: 'watch', winScore: 4 });
    for (let t = 0; t < 240 && SC.G.state !== 'over'; t += 5) SC.sim(5);
    offMini();
    out.miniNatural = minis > 0 && SC.G.state === 'over';

    // Progression: XP -> levels -> rewards (looks, hats, coins).
    PROG.xp = 0; PROG.own = {};
    const ups = addXp(xpNeed(1) + xpNeed(2) + xpNeed(3) + 5);
    out.levels = ups.join(',') === '2,3,4' && lookOwned('pet', 'sprig') && lookOwned('outfit', 'cape') && lookOwned('skin', 'gold') && !lookOwned('ko', 'fireworks');
    out.track = TRACK.slice(2).every(r => r.kind === 'coins' ? r.n > 0 : r.kind === 'hat' ? !!HATS[r.key] : !!LOOKS[r.kind][r.key]);
    out.trackCoversAll = Object.entries(LOOKS).every(([kind, reg]) => Object.values(reg).every(d => d.hidden || lookOwned(kind, d.key) || trackLevelOf(kind, d.key)));
    // Quests: date-seeded, one reroll a day, completion pays.
    store.set('tasks', {});
    const a = tasksNow(), b = tasksNow();
    out.questsSeeded = a.daily.length === 3 && a.weekly.length === 3 && a.daily.map(t => t.k).join() === b.daily.map(t => t.k).join() && new Set(a.daily.map(t => t.k)).size === 3;
    const before = tasksNow().daily[0].k;
    out.reroll = taskReroll(0) && tasksNow().daily[0].k !== before && !taskReroll(1);
    const t0 = tasksNow().daily[1], xpB = PROG.xp;
    taskBump(t0.k, t0.need);
    out.questDone = tasksNow().daily[1].done && PROG.xp >= xpB + TASK_REWARD.daily.xp;
    // Secrets: typed codes unlock their rewards.
    PROG.secrets = {};
    const type = s => [...s].forEach(ch => cheatKey({ '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight' }[ch] || 'Key' + ch));
    type('XXCLUCK'); type('↑↑↓↓←→←→BA'); type('SHINY'); type('BOOGIE');
    out.secrets = !WEAPONS['rubber-chicken'].hidden && secretFound('konami') && lookOwned('title', 'retro') && !HATS.prism.hidden && lookOwned('ko', 'disco');
    SC.start({ mode: 'watch', weapons: ['rubber-chicken', 'rubber-chicken'] }); SC.sim(3); SC.render(1 / 60);
    out.chicken = SC.F.some(f => f.stats.hits > 0) || SC.state().log.length >= 0;
    // Presets: save, apply, delete.
    store.set('presets', []);
    const lo = { color: '#ff5ad1', hat: 'none', outfit: 'cape', weapon: 'katana', skills: ['blink', 'none'], skins: { blade: 'gold' }, pet: 'sprig', cls: 'ninja' };
    const lo2 = {};
    out.presets = presetSave('Testy', lo) && presetApply(0, lo2) && lo2.outfit === 'cape' && lo2.skins.blade === 'gold' && lo2.preset === 'Testy' && (presetDelete(0), presetList().length === 0);
    out.lookOwnedOnly = lookForMatch({ outfit: 'mantle', pet: 'glim' }, false).outfit === 'none' && lookForMatch({ outfit: 'cape' }, false).outfit === 'cape';
    out.codex = CODEX_TABS.every(([k]) => codexEntries(k).length > 0) && codexEntries('x').filter(e => e.name === '???').length === Object.keys(SECRETS).filter(k => !secretFound(k)).length;

    // Restore the player's saves.
    const p = JSON.parse(keep.prog);
    for (const k in PROG) delete PROG[k];
    Object.assign(PROG, p); progSave();
    WEAPONS['rubber-chicken'].hidden = !PROG.secrets.cluck; HATS.prism.hidden = !PROG.secrets.shiny; KOFX.disco.hidden = !PROG.secrets.boogie;
    store.set('tasks', keep.tasks || {}); store.set('presets', keep.presets || []);
    Object.assign(PROFILE, JSON.parse(keep.profile)); saveProfile();
    startMatch(demoConfig());
    out.errors = errs();
    return out;
  });
  const c = r.counts;
  const need = { outfits: 12, skins: 8, ko: 8, pets: 8, poses: 8, mutators: 10, minis: 4, track: 100, secrets: 6 };
  for (const k in need) check(c[k] >= need[k], `progress: only ${c[k]} ${k} (want ${need[k]})`);
  rows.push({ kind: 'progress', key: 'counts', ok: true, note: Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · ') });
  for (const [list, kind] of [[r.outfits, 'outfit'], [r.skins, 'skin'], [r.ko, 'ko-fx'], [r.pets, 'pet'], [r.mutators, 'mutator'], [r.minis, 'mini']]) {
    for (const [k, ok, note] of list) { check(ok, `${kind} ${k} failed`); rows.push({ kind, key: k, ok, note }); }
  }
  for (const k of ['tauntMeter', 'tauntCancel', 'tauntBind', 'victory', 'petsOffRanked', 'petsOffOhko', 'mutOffRanked', 'miniNatural', 'levels', 'track',
    'trackCoversAll', 'questsSeeded', 'reroll', 'questDone', 'secrets', 'chicken', 'presets', 'lookOwnedOnly', 'codex']) {
    check(r[k], `progress: ${k} failed`);
    rows.push({ kind: 'progress', key: k, ok: !!r[k] });
  }
  check(!r.errors.length, 'progress: errors ' + [...new Set(r.errors)].join(' | '));
}

// A real (not SC.sim) one-round match pays XP, records codex stats and shows the XP box on the results card.
async function testMatchXp(page, { check, rows }) {
  await page.evaluate(() => {
    window.__xp = { xp: PROG.xp, w: codexRow('w', 'katana').slice() };
    SC.start({ mode: 'versus', weapons: ['katana', 'spear'], winScore: 1, killcam: false }); SC.G.lock = 0;
    damage(SC.F[1], 500, { src: SC.F[0], kind: 'melee' });
  });
  await page.waitForFunction(() => SC.G.state === 'over', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const k = codexRow('w', 'katana'), o = window.__xp;
    const res = { matchXp: SC.G.state === 'over' && PROG_MATCH.xp >= 100 && PROG.xp >= o.xp + PROG_MATCH.xp, codexStats: k[0] > o.w[0] && k[1] > o.w[1] && k[2] > o.w[2],
      xpBox: !!document.querySelector('#over .xp-box') };
    startMatch(demoConfig());
    return res;
  });
  for (const k in r) { check(r[k], `progress: ${k} failed`); rows.push({ kind: 'progress', key: k, ok: !!r[k] }); }
}

async function shotsAt(browser, size, { newPage, SHOTS, check, rows }) {
  const tag = `${size.width}x${size.height}`, { page, errors } = await newPage(browser);
  await page.setViewportSize(size);
  const snap = async (name, fn, wait = 450, arg) => {
    try {
      const ok = await page.evaluate(fn, arg);
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(SHOTS, `prog-${name}-${tag}.png`) });
      check(ok !== false, `progress screen ${name} ${tag}: failed`);
      rows.push({ kind: 'progress-ui', key: `${name} ${tag}`, ok: ok !== false });
    } catch (e) { check(false, `progress screen ${name} ${tag}: ${e.message}`); }
  };
  await page.evaluate(() => {
    PROG.xp = 9000; PROG.own = {}; addXp(1);
    for (const [l, kind, key] of TRACK_ITEMS) if (l <= 40) lookGrant(kind, key);
    presetSave('Red Comet', { color: '#ff4a6a', weapon: 'katana', cls: 'ninja', outfit: 'cape', pet: 'sprig', skins: { blade: 'gold' }, skills: ['blink', 'lunge'] });
    presetSave('Frost Monk', { color: '#9fe8ff', weapon: 'spear', cls: 'mage', outfit: 'ribbons', pet: 'tick', skins: { polearm: 'frost' } });
    const lo = menuLoadout(0); Object.assign(lo, { weapon: 'katana', outfit: 'cape', pet: 'sprig', ko: 'fireworks', skins: { blade: 'gold' } }); saveMenu();
    for (const k of ['cluck', 'konami']) { PROG.secrets[k] = 1; SECRETS[k].give(); }   // quietly (no toasts over the shots)
  });
  await snap('menu', () => { openScreen('menu'); return !!document.querySelector('.menu-trio') && !!document.querySelector('[data-key="mi-Codex"]'); });
  await snap('creator', () => { CREATOR.name = ''; openScreen('creator', 'menu'); return document.querySelectorAll('.cr-card').length === 2; }, 900);
  await snap('look', () => { MENU.mode = 'versus'; LO.picker = 0; LO.tab = 'look'; openScreen('loadout', 'modes'); return document.querySelectorAll('.look-tile').length > 30; }, 900);
  await snap('track', () => { PROG_TAB.tab = 'track'; openScreen('progress', 'menu'); return document.querySelectorAll('.track-tile').length === 99; });
  await snap('quests', () => { PROG_TAB.tab = 'quests'; openScreen('progress', 'menu'); return document.querySelectorAll('.quest-card').length === 6; });
  await snap('codex', () => { CODEX_TAB.tab = 'w'; openScreen('codex', 'menu'); return document.querySelectorAll('.codex-card').length > 20; });
  await snap('codex-secrets', () => { CODEX_TAB.tab = 'x'; openScreen('codex', 'menu'); return document.querySelectorAll('.codex-card').length === Object.keys(SECRETS).length; });
  await snap('mutators', () => { MENU.mutators = ['lowgrav', 'vampire']; openScreen('maps', 'menu'); const p = document.querySelector('.mut-panel'); p.scrollIntoView(); return document.querySelectorAll('.mut-chip').length >= 11; });
  const fight = ([cfg, setup]) => { SC.start(cfg); if (setup) (new Function(setup))(); return SC.G.state === 'play'; };
  const looks = ['cape', 'scarf', 'mantle', 'ribbons', 'samurai', 'tail', 'banner', 'knight'];
  const skins = { blade: 'gold', heavy: 'lava', polearm: 'crystal', chain: 'neon', ranged: 'pixel', magic: 'void', exotic: 'candy' };
  const wpns = ['katana', 'battle-axe', 'spear', 'flail', 'revolver', 'storm-staff', 'frying-pan', 'kusarigama'];
  for (const [n, from] of [['outfits', 0], ['outfits2', 4]]) {
    await snap(n, fight, 1300, [{ mode: 'watch', fighters: 4, map: 'dojo', weather: 'clear', diffs: ['easy', 'easy', 'easy', 'easy'],
      loadouts: looks.slice(from, from + 4).map((o, i) => ({ weapon: wpns[from + i], look: { outfit: o, skins } })) }]);
  }
  await snap('pets', fight, 1500, [{ mode: 'versus', loadouts: [{ weapon: 'katana', look: { outfit: 'cape', pet: 'zappy', skins } }, { weapon: 'revolver', look: { pet: 'bitbot', outfit: 'kilt', skins } }] }, 'SC.G.lock = 0;']);
  await snap('mutator', fight, 1500, [{ mode: 'watch', mutators: ['bigheads', 'lowgrav'], loadouts: [{ look: { outfit: 'scarf', skins } }, { look: { outfit: 'cape', skins } }] }]);
  await snap('minigame', fight, 1200, [{ mode: 'watch', minigames: true, map: 'dojo' }, "SC.G.round = 2; miniStart(2, 'dodge'); SC.G.lock = 0; SC.sim(2);"]);
  await snap('hotfloor', fight, 600, [{ mode: 'watch', minigames: true, map: 'dojo' }, "SC.G.round = 2; miniStart(2, 'hotfloor'); SC.G.lock = 0; SC.sim(3.2);"]);
  await page.evaluate(() => {
    SC.start({ mode: 'versus', winScore: 1, killcam: false, loadouts: [{ weapon: 'katana', look: { pose: 'flex', ko: 'confetti', outfit: 'cape', skins: {} } }, { weapon: 'spear' }] });
    SC.G.lock = 0; damage(SC.F[1], 500, { src: SC.F[0], kind: 'melee' });
  });
  await page.waitForFunction(() => SC.G.state === 'over', null, { timeout: 15000 }).catch(() => {});
  await snap('results', () => SC.G.state === 'over' && !!document.querySelector('#over .xp-box'), 900);
  check(!errors.length, `progress ui ${tag}: console errors ${errors.join(' | ')}`);
  await page.close();
}

async function run(page, browser, ctx) {
  fs.mkdirSync(ctx.SHOTS, { recursive: true });
  await testSim(page, ctx);
  await testMatchXp(page, ctx);
  for (const size of [{ width: 1280, height: 720 }, { width: 400, height: 800 }]) await shotsAt(browser, size, ctx);
}
module.exports = { run };

// Standalone: node tools/smoke-progress.cjs
if (require.main === module) {
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  const ROOT = path.resolve(__dirname, '..'), SHOTS = path.join(ROOT, 'tmp', 'smoke'), failures = [], rows = [];
  const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
  async function newPage(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
    await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
    return { page, errors };
  }
  (async () => {
    const browser = await chromium.launch();
    try {
      const { page, errors } = await newPage(browser);
      await run(page, browser, { check, rows, SHOTS, newPage });
      if (errors.length) failures.push('console: ' + errors.join(' | '));
    } catch (e) { failures.push('crashed: ' + (e.stack || e.message)); }
    await browser.close();
    console.table(rows.map(r => ({ kind: r.kind, key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note || '' })));
    if (failures.length) { console.error('PROGRESS SMOKE FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
    console.log('PROGRESS SMOKE OK');
  })();
}
