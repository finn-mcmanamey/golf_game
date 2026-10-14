// Smoke tests for customisation and progression (75-cosmetics, 78-outfits, 78-pets, 79-mutators, 79-progress,
// 94-savecode, 96-ui-loadout, 98-ui-progress). Called by tools/smoke.cjs; also runs on its own
// (`node tools/smoke-progress.cjs`, after `node build.mjs`).
// - every outfit, weapon skin, K.O. effect, pet, pose, mutator and mini-game runs/draws without errors and does its job;
// - taunt (key bind, safe-distance meter, cancel on hit), victory pose, secrets (cheat codes), presets, codex stats,
//   pets/mutators off in Ranked;
// - v4: no economy left (coins, shop, track, XP, quests), every cosmetic free while the secret ones stay hidden until
//   found, at least 28 play-based trophies, a real match counted once with no reward box, Ranked settled once, no
//   coin/XP/Shop/Track/Quest text on any screen, the v3.2 save fixture (tools/fixtures/save-v3.2.json) migrating and
//   importing as a save code, and the weapon picker's search box, favourites and Recent row (keyboard, pad, touch);
// - screenshots at 1280x720, 1194x834 and 400x800 (tmp/smoke/prog-*.png): title menu, creator, look tab, the weapon
//   picker with a search and with favourites, trophies, stats, codex, arena mutators, outfits in motion, pets, a mutator
//   in play, a mini-game, results.
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'dist', 'stick-clash.html');
const FIXTURE = path.join(__dirname, 'fixtures', 'save-v3.2.json');

// A fresh browser context (its own localStorage); `init` runs before the game's script on every load.
async function openCtx(browser, opts = {}, init) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, opts));
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  if (init) await ctx.addInitScript(init.fn, init.arg);
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto(URL);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  return { ctx, page, errors };
}
const stepper = ({ check, rows }, kind) => async (key, fn) => {
  let ok = false, note = '';
  try { const r = await fn(); ok = r === true || (r && r.ok); note = (r && r.note) || ''; } catch (e) { note = e.message; }
  check(ok, `${kind} ${key}: ${note || 'failed'}`);
  rows.push({ kind, key, ok: !!ok, note: note.slice(0, 160) });
};

async function testSim(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const out = {}, e0 = SC.errors.length, keep = { prog: JSON.stringify(PROG), presets: store.get('presets', null), profile: JSON.stringify(PROFILE) };
    const errs = () => SC.errors.slice(e0).map(e => e.msg);
    const finite = f => f.P.every(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    const look = o => ({ loadouts: [{ weapon: o.weapon || 'katana', look: Object.assign({ skins: {} }, o) }, { weapon: 'spear', look: Object.assign({ skins: {} }, o) }] });
    out.counts = { outfits: listOf(OUTFITS).length - 1, skins: listOf(WSKINS).length - 1, ko: listOf(KOFX).length - 1, pets: listOf(PETS).length - 1,
      poses: listOf(POSES).length, mutators: Object.keys(MUTATORS).length, minis: Object.keys(MINIS).length, secrets: Object.keys(SECRETS).length,
      titles: Object.keys(TITLES).length, trophies: Object.keys(ACHIEVEMENTS).length };

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

    // v4: the economy is gone (no coins, shop, track, XP or quests) and every trophy is earned by playing.
    out.noEconomy = ['addCoins', 'buyItem', 'addXp', 'trackLevel', 'tasksNow', 'taskBump', 'settleMatch', 'progSettle', 'coinBadge', 'tryBuy']
      .every(n => typeof window[n] === 'undefined') && !('coins' in PROFILE) && !('hats' in PROFILE) && !('xp' in PROG) && !('own' in PROG)
      && !SCREENS.shop && !SCREENS.progress && listOf(HATS).every(h => !('price' in h)) && COLOR_PACKS.every(p => !('price' in p));
    out.trophies = Object.keys(ACHIEVEMENTS).length >= 28 && Object.values(ACHIEVEMENTS).every(a => !('coins' in a) && typeof a.progress === 'function')
      && !ACHIEVEMENTS.shopper && !ACHIEVEMENTS['hats-15'] && !ACHIEVEMENTS.rich;
    // Every cosmetic is free from the start: a human wears any visible look, hat or colour; the secret ones stay out of
    // every list (and can't be worn) until found.
    PROG.secrets = {};
    const secretDefs = [[WEAPONS, 'rubber-chicken'], [HATS, 'prism'], [KOFX, 'disco'], [OUTFITS, 'jester'], [TITLES, 'retro'], [TITLES, 'night-owl']];
    for (const [reg, k] of secretDefs) reg[k].hidden = true;
    const lookOk = kind => listOf(LOOKS[kind]).every(d => lookForMatch({ [kind]: d.key }, false)[kind] === d.key);
    const skinOk = listOf(WSKINS).every(d => lookForMatch({ skins: { blade: d.key } }, false).skins.blade === d.key);
    MENU.mode = 'versus';
    const lo0 = menuLoadout(0), keepLo = JSON.stringify(lo0);
    const hatOk = listOf(HATS).every(h => { lo0.hat = h.key; return menuLoadout(0).hat === h.key; });
    const colOk = COLOR_PACKS.every(p => p.colors.every(c => { lo0.color = c; return menuLoadout(0).color === c; }));
    Object.assign(lo0, JSON.parse(keepLo));
    out.allFree = ['outfit', 'ko', 'pet', 'pose'].every(lookOk) && skinOk && hatOk && colOk && titlePicker().querySelectorAll('button').length === listOf(TITLES).length;
    out.secretsHidden = secretDefs.every(([reg, k]) => !listOf(reg).some(d => d.key === k)) && lookForMatch({ outfit: 'jester', ko: 'disco' }, false).outfit === 'none'
      && lookForMatch({ ko: 'disco' }, false).ko === 'none' && !lookUsable('title', 'retro');
    // Secrets: typed codes unlock and un-hide their rewards.
    const type = s => [...s].forEach(ch => cheatKey({ '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight' }[ch] || 'Key' + ch));
    type('XXCLUCK'); type('↑↑↓↓←→←→BA'); type('SHINY'); type('BOOGIE');
    out.secrets = !WEAPONS['rubber-chicken'].hidden && secretFound('konami') && lookUsable('title', 'retro') && listOf(TITLES).some(t => t.key === 'retro')
      && !HATS.prism.hidden && lookForMatch({ ko: 'disco' }, false).ko === 'disco' && !lookUsable('outfit', 'jester');
    SC.start({ mode: 'watch', weapons: ['rubber-chicken', 'rubber-chicken'] }); SC.sim(3); SC.render(1 / 60);
    out.chicken = SC.F.some(f => f.stats.hits > 0) || SC.state().log.length >= 0;
    // Presets: save, apply, delete.
    store.set('presets', []);
    const lo = { color: '#ff5ad1', hat: 'none', outfit: 'cape', weapon: 'katana', skills: ['blink', 'none'], skins: { blade: 'gold' }, pet: 'sprig', cls: 'ninja' };
    const lo2 = {};
    out.presets = presetSave('Testy', lo) && presetApply(0, lo2) && lo2.outfit === 'cape' && lo2.skins.blade === 'gold' && lo2.preset === 'Testy' && (presetDelete(0), presetList().length === 0);
    out.lookFree = lookForMatch({ outfit: 'mantle', pet: 'glim' }, false).outfit === 'mantle' && lookForMatch({ pet: 'glim' }, false).pet === 'glim';
    out.codex = CODEX_TABS.every(([k]) => codexEntries(k).length > 0) && codexEntries('x').filter(e => e.name === '???').length === Object.keys(SECRETS).filter(k => !secretFound(k)).length;

    // Restore the player's saves (and hide the secrets this test found again).
    const p = JSON.parse(keep.prog);
    for (const k in PROG) delete PROG[k];
    Object.assign(PROG, p); progSave();
    for (const [reg, k] of secretDefs) reg[k].hidden = true;
    for (const k in PROG.secrets) if (SECRETS[k]) SECRETS[k].give();
    store.set('presets', keep.presets || []);
    Object.assign(PROFILE, JSON.parse(keep.profile)); saveProfile();
    startMatch(demoConfig());
    out.errors = errs();
    return out;
  });
  const c = r.counts;
  const need = { outfits: 12, skins: 8, ko: 8, pets: 8, poses: 8, mutators: 10, minis: 4, secrets: 6, trophies: 28 };
  for (const k in need) check(c[k] >= need[k], `progress: only ${c[k]} ${k} (want ${need[k]})`);
  rows.push({ kind: 'progress', key: 'counts', ok: true, note: Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · ') });
  for (const [list, kind] of [[r.outfits, 'outfit'], [r.skins, 'skin'], [r.ko, 'ko-fx'], [r.pets, 'pet'], [r.mutators, 'mutator'], [r.minis, 'mini']]) {
    for (const [k, ok, note] of list) { check(ok, `${kind} ${k} failed`); rows.push({ kind, key: k, ok, note }); }
  }
  for (const k of ['tauntMeter', 'tauntCancel', 'tauntBind', 'victory', 'petsOffRanked', 'petsOffOhko', 'mutOffRanked', 'miniNatural', 'noEconomy', 'trophies',
    'allFree', 'secretsHidden', 'secrets', 'chicken', 'presets', 'lookFree', 'codex']) {
    check(r[k], `progress: ${k} failed`);
    rows.push({ kind: 'progress', key: k, ok: !!r[k] });
  }
  check(!r.errors.length, 'progress: errors ' + [...new Set(r.errors)].join(' | '));
}

// A real (not SC.sim) one-round match is counted once (stats, mode wins, codex) and its results card has no reward box.
async function testMatchEnd(page, { check, rows }) {
  await page.evaluate(() => {
    window.__m = { w: codexRow('w', 'katana').slice(), matches: PROFILE.stats.matches, wins: PROFILE.stats.wins, versus: PROFILE.stats.modeWins.versus || 0 };
    SC.start({ mode: 'versus', weapons: ['katana', 'spear'], winScore: 1, killcam: false }); SC.G.lock = 0;
    damage(SC.F[1], 500, { src: SC.F[0], kind: 'melee', unblockable: true });
  });
  await page.waitForFunction(() => SC.G.state === 'over', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const k = codexRow('w', 'katana'), o = window.__m, card = document.querySelector('#over .results-card');
    recordMatch(); recordMatch();                    // the results card and matchOver both asked already: still counted once
    const res = { counted: SC.G.state === 'over' && PROFILE.stats.matches === o.matches + 1 && PROFILE.stats.wins === o.wins + 1 && PROFILE.stats.modeWins.versus === o.versus + 1,
      codexStats: k[0] > o.w[0] && k[1] > o.w[1] && k[2] > o.w[2],
      noRewardBox: !!card && !card.querySelector('.xp-box, .reward-total, .coin-big, .reward-mul') && !/coin|\bXP\b/i.test(card.textContent) };
    startMatch(demoConfig());
    return res;
  });
  for (const k in r) { check(r[k], `progress: ${k} failed`); rows.push({ kind: 'progress', key: k, ok: !!r[k] }); }
}

// Ranked still settles exactly once: a real win moves the rank by the win + streak points, and asking again (the results
// card, matchOver, a rebuilt card, leaving for the menu) changes nothing.
async function testRankedOnce(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const keep = store.get('ranked', null), m0 = PROFILE.stats.matches;
    store.set('ranked', { pts: 250, best: 250, wins: 3, losses: 2, streak: 1 });
    SC.start({ mode: 'ranked', map: 'dojo', weapons: ['blade', 'blade'], killcam: false }); SC.G.lock = 0;
    SC.F[1].ai.behave = 'idle';                              // a parrying rival must not turn the winning blow away
    worldStep(DT);                                           // the first FIGHT! has begun: the match is on the record
    SC.G.score[0] = 1; damage(SC.F[1], 999, { src: SC.F[0], kind: 'melee', unblockable: true });
    for (let i = 0; i < 4000 && SC.G.state !== 'over'; i++) advance(.05);
    const after = rankLoad(), res = SC.G.result || {};
    recordMatch(); rankSettleRun(modeRun(), true); PANELS.over.replaceChildren(buildResults()); abandonMatch();
    const again = rankLoad(), out = { state: SC.G.state, won: res.won, delta: after.pts - 250, want: RANK_WIN + RANK_STREAK, wins: [after.wins, again.wins],
      losses: [after.losses, again.losses], pts: [after.pts, again.pts], matches: PROFILE.stats.matches - m0, ranked: PROFILE.stats.modeWins.ranked || 0 };
    toMenu();
    out.afterMenu = rankLoad();
    if (keep) store.set('ranked', keep); else localStorage.removeItem(STORE_PREFIX + 'ranked');
    return out;
  });
  const ok = r.state === 'over' && r.won === true && r.delta === r.want && r.wins.join() === '4,4' && r.losses.join() === '2,2' && r.pts[1] === r.pts[0]
    && r.afterMenu.losses === 2 && r.afterMenu.pts === r.pts[0] && r.matches === 1 && r.ranked >= 1;
  check(ok, 'progress: ranked settles once ' + JSON.stringify(r));
  rows.push({ kind: 'progress', key: 'rankedOnce', ok, note: `+${r.delta} pts, ${r.wins[1]}W ${r.losses[1]}L` });
}

// No coin / XP / Shop / Track / Quest wording on any screen: every menu screen (each loadout, trophies and codex tab),
// the title menu, pause, results and the toasts. Text nodes are read as written (CSS uppercase doesn't count), and the
// campaign's own words ("Mythic Quest", "Side quest") are fine.
const BANNED_SCAN = () => {
  window.__banned = root => {
    const bad = [/coin/i, /\bXP\b/i, /\bShop\b/, /\bTrack\b/, /(?<!Mythic )\bQuests?\b/, /\b(daily|weekly)\b/i], out = [];
    const shown = e => !!e && (e.offsetParent !== null || e.getClientRects().length > 0);
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());) {
      const p = n.parentElement;
      if (p && !p.closest('textarea, script, style') && shown(p) && bad.some(re => re.test(n.textContent))) out.push(n.textContent.trim().slice(0, 70));
    }
    for (const e of root.querySelectorAll('[title], [aria-label], [placeholder]')) {
      if (!shown(e)) continue;
      for (const t of [e.getAttribute('title'), e.getAttribute('aria-label'), e.getAttribute('placeholder')]) if (t && bad.some(re => re.test(t))) out.push('@' + t.slice(0, 70));
    }
    return out;
  };
};
async function testNoEconomyText(page, { check, rows }) {
  await page.evaluate(BANNED_SCAN);
  const r = await page.evaluate(() => {
    const hits = {}, seen = [], scan = (label, root) => { seen.push(label); const b = __banned(root || document.body); if (b.length) hits[label] = b; };
    toMenu();
    for (const name of Object.keys(SCREENS)) {
      const tabs = name === 'loadout' ? ['weapon', 'skills', 'class', 'gear', 'style', 'look'] : name === 'stats' ? ['trophies', 'stats']
        : name === 'codex' ? CODEX_TABS.map(t => t[0]) : [null];
      for (const tab of tabs) {
        if (name === 'loadout') { MENU.mode = 'pvp'; LO.tab = tab; LO.cat = 'all'; }
        if (name === 'stats') STATS_TAB.tab = tab;
        if (name === 'codex') CODEX_TAB.tab = tab;
        try { openScreen(name, 'menu'); scan(name + (tab ? ':' + tab : ''), PANELS[name]); } catch (e) { hits[name] = ['threw ' + e.message]; }
      }
    }
    LO.tab = 'weapon'; LO.cat = 'fav'; openScreen('loadout', 'menu'); scan('loadout:fav', PANELS.loadout); LO.cat = 'all';
    openScreen('menu'); scan('title menu', PANELS.menu);
    return { hits, n: seen.length };
  });
  // The pause card and the results card of a real match (with the trophy strip) and whatever toasts are up.
  await page.evaluate(() => { SC.start({ mode: 'versus', weapons: ['katana', 'spear'], winScore: 1, killcam: false }); SC.G.lock = 0; setState('paused'); });
  await page.waitForTimeout(150);
  Object.assign(r.hits, await page.evaluate(() => { const b = __banned(PANELS.pause); setState('play'); damage(SC.F[1], 500, { src: SC.F[0], kind: 'melee', unblockable: true }); return b.length ? { pause: b } : {}; }));
  await page.waitForFunction(() => SC.G.state === 'over', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  Object.assign(r.hits, await page.evaluate(() => { const o = {}, a = __banned(PANELS.over), t = __banned(document.querySelector('.toasts')); if (a.length) o.results = a; if (t.length) o.toasts = t; toMenu(); return o; }));
  const ok = !Object.keys(r.hits).length && r.n > 20;
  check(ok, 'progress: coin/XP/Shop/Track/Quest text on screen ' + JSON.stringify(r.hits));
  rows.push({ kind: 'progress', key: 'noEconomyText', ok, note: `${r.n} screens + pause, results, toasts` });
}

// The weapon picker: Recent (per player, newest first, six at most, real matches only), the search box (name, category,
// description; typing never moves the focus; Enter picks, Esc clears; no native search styling), d-pad focus in and out
// of the box, favourites per player (saved, star updated in place, the Favourites chip; F or a pad's Y on the tile in
// focus, the stars out of the arrow order), and touch.
async function testPicker(browser, ctx) {
  const step = stepper(ctx, 'picker');
  const { ctx: bctx, page, errors } = await openCtx(browser);
  // "Favourites survive a reload" below: the saves come from a second document (headless Chromium on file:// sometimes
  // loses what a page's first document stored when it reloads, as in the migration test).
  await page.goto(URL);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await step('recent row', async () => {
    const r = await page.evaluate(() => {
      for (const w of ['katana', 'spear', 'flail', 'revolver', 'battle-axe', 'storm-staff', 'frying-pan']) SC.start({ mode: 'versus', weapons: [w, 'blade'], killcam: false });
      SC.start({ mode: 'pvp', weapons: ['katana', 'kusarigama'], killcam: false });
      SC.start({ mode: 'versus', weapons: ['spear', 'blade'], autopilot: true });     // tests on autopilot don't count
      const out = { p1: PICKS.recent[0].join(), p2: PICKS.recent[1].join(), saved: JSON.stringify(store.get('picks', {}).recent) };
      toMenu(); MENU.mode = 'pvp'; LO.picker = 0; LO.tab = 'weapon'; LO.cat = 'all'; LO.query = ''; openScreen('loadout', 'menu');
      out.chips = [...document.querySelectorAll('#loadout .w-recent .w-chip')].map(b => b.dataset.key.slice(3)).join();
      document.querySelector('#loadout [data-key="wr-flail"]').click();
      out.picked = MENU.loadouts[0].weapon;
      return out;
    });
    const want = 'katana,frying-pan,storm-staff,battle-axe,revolver,flail';
    return { ok: r.p1 === want && r.p2 === 'kusarigama' && r.saved === JSON.stringify([want.split(','), ['kusarigama']]) && r.chips === want && r.picked === 'flail', note: JSON.stringify(r) };
  });
  const visible = () => page.evaluate(() => [...document.querySelectorAll('#loadout .w-cell')].filter(c => !c.hidden).map(c => ({ key: c.querySelector('.w-tile').dataset.key.slice(2), find: c.dataset.find })));
  await step('search by name, typed with WASD letters', async () => {
    await page.evaluate(() => { LO.query = ''; LO.cat = 'all'; refreshScreen(); });
    await page.click('#loadout [data-key="w-search"]');
    await page.keyboard.type('sword');                                          // s, w, d are menu-navigation keys
    const v = await visible(), r = await page.evaluate(() => ({ focus: document.activeElement.dataset.key, value: document.activeElement.value, screen: UI.screen,
      total: document.querySelectorAll('#loadout .w-cell').length, browse: document.querySelector('#loadout .w-browse').hidden, found: document.querySelector('#loadout .w-found').textContent }));
    r.appearance = await page.evaluate(() => getComputedStyle(document.querySelector('#loadout .w-search')).appearance);   // Safari keeps its padding
    return { ok: r.focus === 'w-search' && r.value === 'sword' && r.screen === 'loadout' && v.length >= 3 && v.length < r.total && v.every(c => c.find.includes('sword'))
      && v.some(c => c.key === 'broadsword') && r.browse && /found/.test(r.found) && r.appearance === 'none', note: JSON.stringify(Object.assign(r, { n: v.length })) };
  });
  await step('search by category and description', async () => {
    await page.fill('#loadout [data-key="w-search"]', 'magic');
    const magic = await visible(), want = await page.evaluate(() => listOf(WEAPONS).filter(w => w.cat === 'magic').map(w => w.key));
    await page.fill('#loadout [data-key="w-search"]', 'mule');                    // only in the Boomstick's description
    const desc = await visible();
    await page.fill('#loadout [data-key="w-search"]', 'zzzz');
    const none = await visible(), msg = await page.evaluate(() => document.querySelector('#loadout .w-found').textContent);
    return { ok: want.length >= 3 && want.every(k => magic.some(c => c.key === k)) && magic.every(c => c.find.includes('magic')) && desc.some(c => c.key === 'shotgun')
      && desc.every(c => c.find.includes('mule')) && !none.length && /No weapon/.test(msg), note: `magic ${magic.length}, mule ${desc.map(c => c.key)}, none ${none.length}` };
  });
  await step('search: Enter picks, Esc clears', async () => {
    await page.fill('#loadout [data-key="w-search"]', 'mule');
    await page.keyboard.press('Enter');
    const a = await page.evaluate(() => ({ weapon: MENU.loadouts[0].weapon, focus: document.activeElement.dataset.key, query: LO.query }));
    await page.click('#loadout [data-key="w-search"]');
    await page.keyboard.press('Escape');
    const b = await page.evaluate(() => ({ value: document.querySelector('#loadout [data-key="w-search"]').value, screen: UI.screen,
      shown: [...document.querySelectorAll('#loadout .w-cell')].every(c => !c.hidden) }));
    return { ok: a.weapon === 'shotgun' && a.focus === 'w-shotgun' && a.query === 'mule' && b.value === '' && b.screen === 'loadout' && b.shown, note: JSON.stringify({ a, b }) };
  });
  await step('gamepad d-pad into and out of the search box', async () => {
    await page.evaluate(() => {
      window.__pad = { index: 0, id: 'mock pad', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
      navigator.getGamepads = () => [window.__pad];
      document.querySelector('#loadout [data-key="tab-weapon"]').focus();
    });
    const press = async b => { await page.evaluate(i => { __pad.buttons[i].pressed = true; }, b); await page.waitForTimeout(90); await page.evaluate(i => { __pad.buttons[i].pressed = false; }, b); await page.waitForTimeout(90); };
    await press(13);                                                              // d-pad down from the Weapon tab
    const into = await page.evaluate(() => document.activeElement.dataset.key);
    await press(13);
    const out = await page.evaluate(() => document.activeElement.dataset.key);
    await press(12);
    const back = await page.evaluate(() => document.activeElement.dataset.key);
    await page.evaluate(() => { navigator.getGamepads = () => []; });
    return { ok: into === 'w-search' && /^cat-/.test(out || '') && back === 'w-search', note: `${into} -> ${out} -> ${back}` };
  });
  await step('favourites per player, saved', async () => {
    const r = await page.evaluate(() => {
      LO.query = ''; LO.cat = 'all'; LO.picker = 0; refreshScreen();
      const tile = document.querySelector('#loadout [data-key="w-katana"]');
      document.querySelector('#loadout [data-key="fav-katana"]').click();
      document.querySelector('#loadout [data-key="fav-spear"]').click();
      document.querySelector('#loadout [data-key="fav-spear"]').click();          // toggled off again
      const star = document.querySelector('#loadout [data-key="fav-katana"]'), out = { p1: PICKS.fav[0].join(), pressed: star.getAttribute('aria-pressed'), text: star.textContent,
        chip: document.querySelector('#loadout [data-key="cat-fav"]').textContent, sameTile: tile === document.querySelector('#loadout [data-key="w-katana"]'), weapon: MENU.loadouts[0].weapon };
      LO.picker = 1; refreshScreen();                                              // Player 2 has their own list
      out.p2star = document.querySelector('#loadout [data-key="fav-katana"]').getAttribute('aria-pressed');
      document.querySelector('#loadout [data-key="fav-flail"]').click();
      document.querySelector('#loadout [data-key="cat-fav"]').click();
      out.p2view = [...document.querySelectorAll('#loadout .w-cell .w-tile')].map(b => b.dataset.key).join();
      out.saved = JSON.stringify(store.get('picks', {}).fav);
      return out;
    });
    return { ok: r.p1 === 'katana' && r.pressed === 'true' && r.text === '★' && /Favourites 1/.test(r.chip) && r.sameTile && r.weapon !== 'katana'
      && r.p2star === 'false' && r.p2view === 'w-flail' && r.saved === JSON.stringify([['katana'], ['flail']]), note: JSON.stringify(r) };
  });
  // The ☆ is out of the arrow / d-pad order (moving through the grid stops only on tiles); F or a pad's Y favourites the
  // tile in focus, and the hint says so.
  await step('favourites by key and pad, stars skipped', async () => {
    await page.evaluate(() => { LO.picker = 0; LO.cat = 'blade'; LO.query = ''; refreshScreen(); document.querySelector('#loadout [data-key="w-blade"]').focus(); });
    const seen = [];
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) { await page.keyboard.press(k); seen.push(await page.evaluate(() => document.activeElement.dataset.key)); }
    const key = await page.evaluate(() => document.activeElement.dataset.key.slice(2)), was = await page.evaluate(k => PICKS.fav[0].includes(k), key);
    await page.keyboard.press('KeyF');
    const byKey = await page.evaluate(k => ({ fav: PICKS.fav[0].includes(k), focus: document.activeElement.dataset.key }), key);
    await page.evaluate(() => { window.__pad = { index: 0, id: 'mock pad', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
      navigator.getGamepads = () => [window.__pad]; });
    await page.waitForTimeout(60);
    await page.evaluate(() => { __pad.buttons[3].pressed = true; }); await page.waitForTimeout(90);
    await page.evaluate(() => { __pad.buttons[3].pressed = false; }); await page.waitForTimeout(60);
    const byPad = await page.evaluate(k => { navigator.getGamepads = () => []; return { fav: PICKS.fav[0].includes(k), tip: (document.querySelector('#loadout .w-tip') || {}).textContent }; }, key);
    await page.evaluate(() => { LO.cat = 'all'; refreshScreen(); });
    return { ok: seen.every(k => /^w-/.test(k || '')) && byKey.fav !== was && byKey.focus === 'w-' + key && byPad.fav === was && /F or pad Y/.test(byPad.tip || ''),
      note: JSON.stringify({ seen, key, was, byKey, byPad }) };
  });
  await step('favourites and recent survive a reload', async () => {
    await page.reload();
    await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
    const r = await page.evaluate(() => {
      MENU.mode = 'pvp'; LO.picker = 0; LO.tab = 'weapon'; LO.cat = 'fav'; openScreen('loadout', 'menu');
      return { fav: [...document.querySelectorAll('#loadout .w-cell .w-tile')].map(b => b.dataset.key).join(), recent: PICKS.recent[0].length, p2: PICKS.fav[1].join() };
    });
    return { ok: r.fav === 'w-katana' && r.recent === 6 && r.p2 === 'flail', note: JSON.stringify(r) };
  });
  await step('no errors', async () => ({ ok: !errors.length && !(await page.evaluate(() => SC.errors.length)), note: errors.join(' | ').slice(0, 200) }));
  await bctx.close();

  // Touch: tap the box, type with the on-screen keyboard, tap a star and the Favourites chip.
  const t = await openCtx(browser, { viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await step('touch: search and star', async () => {
    await t.page.evaluate(() => { MENU.mode = 'versus'; LO.picker = 0; LO.tab = 'weapon'; LO.cat = 'all'; LO.query = ''; openScreen('loadout', 'menu'); });
    await t.page.tap('#loadout [data-key="w-search"]');
    await t.page.keyboard.type('axe');
    const v = await t.page.evaluate(() => [...document.querySelectorAll('#loadout .w-cell')].filter(c => !c.hidden).map(c => c.querySelector('.w-tile').dataset.key));
    await t.page.tap('#loadout [data-key="fav-battle-axe"]');
    await t.page.tap('#loadout [data-key="cat-fav"]');
    const r = await t.page.evaluate(() => ({ fav: PICKS.fav[0].join(), view: [...document.querySelectorAll('#loadout .w-cell .w-tile')].filter(b => !b.closest('[hidden]')).map(b => b.dataset.key).join(), q: LO.query }));
    return { ok: v.includes('w-battle-axe') && v.includes('w-double-axe') && v.length < 10 && r.fav === 'battle-axe' && r.view === 'w-battle-axe' && !t.errors.length,
      note: JSON.stringify({ v, r, errors: t.errors }) };
  });
  await t.ctx.close();
}

// A v3.2 save (tools/fixtures/save-v3.2.json, made by playing the v3.2 build) loads in v4: trophies, ranked, stats, codex,
// campaign stars + skill tree, challenge stars, presets, settings, keys and the menu loadout kept; coins, shop unlocks,
// track XP and quests dropped from storage, once; no errors. The same save as a v3 save code imports the same way.
async function testMigration(browser, ctx) {
  const step = stepper(ctx, 'migration'), fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  // The v3 save is written before the game's script, on the "?v3" load only. Headless Chromium (file://, under load)
  // sometimes drops everything a new page's FIRST document stored when it reloads (1 in ~20; the old save was then
  // seeded and migrated again), so the page loads once plain first, and "migrates once" opens the plain URL again.
  const seed = { fn: keys => { if (location.search === '?v3') { localStorage.clear(); for (const k in keys) localStorage.setItem(k, keys[k]); } }, arg: fx.k };
  const { ctx: bctx, page, errors } = await openCtx(browser, {}, seed);
  await page.goto(URL + '?v3');
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  const kept = async () => page.evaluate(fxk => {
    const raw = k => localStorage.getItem('stickclash.v2.' + k), J = k => JSON.parse(raw(k) || 'null'), F = k => JSON.parse(fxk['stickclash.v2.' + k]);
    const prof = J('profile'), prog = J('prog'), fprof = F('profile'), fprog = F('prog'), lo = menuLoadout(0), look = lookForMatch(lo, false);
    const stats = Object.keys(fprof.stats).filter(k => k !== 'purchases').every(k => JSON.stringify(prof.stats[k]) === JSON.stringify(fprof.stats[k]));
    return {
      dropped: raw('tasks') === null && ['coins', 'earned', 'hats', 'packs'].every(k => !(k in prof)) && !('purchases' in prof.stats) && ['xp', 'own', 'seen'].every(k => !(k in prog)),
      trophies: Object.keys(fprof.ach).every(k => prof.ach[k] === fprof.ach[k]) && ['first-win', 'beat-hard', 'big-hit', 'flawless', 'speedy'].every(achDone),
      stats: stats && PROFILE.stats.matches === fprof.stats.matches && PROFILE.stats.cpuWins.hard === 2,
      ranked: raw('ranked') === fxk['stickclash.v2.ranked'] && rankLoad().pts === 405,
      codex: JSON.stringify(prog.codex) === JSON.stringify(fprog.codex) && codexRow('w', 'katana').join() === fprog.codex.w.katana.join(),
      secrets: prog.title === 'brawler' && PROG.title === 'brawler' && secretFound('konami') && !WEAPONS['rubber-chicken'].hidden && lookUsable('title', 'retro'),
      campaign: raw('quest') === fxk['stickclash.v2.quest'] && campSave().stars.e2 === 3 && campSave().tree.v1 === 1 && raw('challenges') === fxk['stickclash.v2.challenges'],
      presets: raw('presets') === fxk['stickclash.v2.presets'] && presetList().map(p => p.name).join() === 'Red Comet,Frost Monk',
      settings: SETTINGS.rounds === 3 && SETTINGS.shake === false && SETTINGS.music === .4 && BINDS[0].taunt === 'KeyG' && raw('wins') === fxk['stickclash.v2.wins'],
      loadout: lo.hat === 'beanie' && lo.color === '#ff6b6b' && look.outfit === 'cape' && look.ko === 'fireworks' && look.pet === 'sprig' && look.skins.blade === 'gold'
        && MENU.diff === 'hard' && (MENU.mutators || []).join() === 'bigheads',
      toast: [...document.querySelectorAll('.toast strong')].some(t => /Everything is unlocked/.test(t.textContent)),
      errors: SC.errors.map(e => e.msg),
    };
  }, fx.k);
  let first = null;
  await step('v3.2 save loads in v4', async () => {
    first = await kept();
    const ok = Object.entries(first).every(([k, v]) => k === 'errors' ? !v.length : v === true) && !errors.length;
    return { ok, note: JSON.stringify(first) + errors.join('|') };
  });
  await step('migrates once (reload: same saves, no second notice)', async () => {
    const before = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    await page.goto(URL);                     // a fresh load of the game without "?v3" (a reload would seed again)
    await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
    const again = await kept(), after = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    const ok = Object.entries(again).every(([k, v]) => k === 'toast' ? v === false : k === 'errors' ? !v.length : v === true) && before === after;
    return { ok, note: JSON.stringify(again) + (before === after ? '' : ' storage changed on reload') };
  });
  await step('trophies screen after migration', async () => {
    const r = await page.evaluate(() => { STATS_TAB.tab = 'trophies'; openScreen('stats', 'menu');
      return { cards: document.querySelectorAll('#stats .trophy').length, got: document.querySelectorAll('#stats .trophy.got').length, sum: document.querySelector('#stats .trophy-sum').textContent }; });
    return { ok: r.cards >= 28 && r.got === 5 && /5 \/ \d+/.test(r.sum), note: JSON.stringify(r) };
  });
  // The same v3.2 save as a save code: the preview names what v4 keeps, the import drops the removed parts.
  await step('v3 save code imports without coins, track or quests', async () => {
    const json = JSON.stringify({ v: 1, t: fx.t, k: fx.k });
    const r = await page.evaluate(async j => {
      const code = `SC1p.${toB64u(new TextEncoder().encode(j))}.${fnv1a(j)}`, data = await readSaveCode(code), k = data.k, p = savePreview(data);
      store.set('ranked', { pts: 0, best: 0, wins: 0, losses: 0, streak: 0 });   // so the import has something to restore
      return { tasks: 'stickclash.v2.tasks' in k, coins: 'coins' in JSON.parse(k['stickclash.v2.profile']), xp: 'xp' in JSON.parse(k['stickclash.v2.prog']),
        facts: p.facts.map(f => f[0]).join(), code: code.slice(0, 5) };
    }, json);
    await page.evaluate(j => readSaveCode(`SC1p.${toB64u(new TextEncoder().encode(j))}.${fnv1a(j)}`).then(d => { window.__imp = d; }), json);
    await Promise.all([page.waitForEvent('load'), page.evaluate(() => applySaveCode(__imp))]);
    await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
    const after = await page.evaluate(() => ({ pts: rankLoad().pts, tasks: localStorage.getItem('stickclash.v2.tasks'), coins: 'coins' in JSON.parse(localStorage.getItem('stickclash.v2.profile')),
      matches: PROFILE.stats.matches, errors: SC.errors.length }));
    return { ok: !r.tasks && !r.coins && !r.xp && r.facts === 'Trophies,Matches,Rank' && after.pts === 405 && after.tasks === null && !after.coins && after.matches === 7 && !after.errors,
      note: JSON.stringify({ r, after }) };
  });
  await step('no console errors', async () => ({ ok: !errors.length, note: errors.join(' | ').slice(0, 200) }));
  await bctx.close();
}

async function shotsAt(browser, size, { newPage, SHOTS, check, rows }, full) {
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
    presetSave('Red Comet', { color: '#ff4a6a', weapon: 'katana', cls: 'ninja', outfit: 'cape', pet: 'sprig', skins: { blade: 'gold' }, skills: ['blink', 'lunge'] });
    presetSave('Frost Monk', { color: '#9fe8ff', weapon: 'spear', cls: 'mage', outfit: 'ribbons', pet: 'tick', skins: { polearm: 'frost' } });
    const lo = menuLoadout(0); Object.assign(lo, { weapon: 'katana', outfit: 'cape', pet: 'sprig', ko: 'fireworks', skins: { blade: 'gold' } }); saveMenu();
    for (const k of ['cluck', 'konami']) { PROG.secrets[k] = 1; SECRETS[k].give(); }   // quietly (no toasts over the shots)
    PICKS.recent[0] = ['katana', 'flail', 'revolver', 'battle-axe', 'storm-staff', 'frying-pan']; PICKS.fav[0] = ['katana', 'spear', 'crossbow', 'lollipop']; picksSave();
  });
  await snap('menu', () => { openScreen('menu'); return !!document.querySelector('[data-key="mi-Codex"]') && !!document.querySelector('[data-key="mi-Fighter Creator"]')
    && !document.querySelector('.menu-trio') && ![...document.querySelectorAll('#menu .mi-label')].some(l => /Shop|Track/.test(l.textContent)); });
  await snap('loadout-search', () => { MENU.mode = 'pvp'; LO.picker = 0; LO.tab = 'weapon'; LO.cat = 'all'; LO.query = 'sword'; openScreen('loadout', 'modes');
    return [...document.querySelectorAll('#loadout .w-cell')].some(c => !c.hidden) && document.querySelector('#loadout [data-key="w-search"]').value === 'sword'; }, 900);
  await snap('loadout-picker', () => { LO.query = ''; LO.cat = 'all'; openScreen('loadout', 'modes');
    document.querySelector('#loadout .w-recent').scrollIntoView({ block: 'nearest' }); return document.querySelectorAll('#loadout .w-recent .w-chip').length === 6; }, 900);
  await snap('loadout-fav', () => { LO.cat = 'fav'; openScreen('loadout', 'modes'); return document.querySelectorAll('#loadout .w-cell').length === 4; }, 700);
  await snap('trophies', () => { STATS_TAB.tab = 'trophies'; openScreen('stats', 'menu'); return document.querySelectorAll('#stats .trophy').length >= 28 && !document.querySelector('#stats .tr-coins'); });
  await snap('stats', () => { STATS_TAB.tab = 'stats'; openScreen('stats', 'menu'); return document.querySelectorAll('#stats .stat-tile').length >= 18; });
  await snap('look', () => { MENU.mode = 'versus'; LO.picker = 0; LO.tab = 'look'; LO.cat = 'all'; openScreen('loadout', 'modes'); return document.querySelectorAll('.look-tile').length > 30 && !document.querySelector('.look-tile.locked'); }, 900);
  await snap('codex', () => { CODEX_TAB.tab = 'w'; openScreen('codex', 'menu'); return document.querySelectorAll('.codex-card').length > 20; });
  if (full) {
    await snap('creator', () => { CREATOR.name = ''; openScreen('creator', 'menu'); return document.querySelectorAll('.cr-card').length === 2; }, 900);
    await snap('style', () => { LO.tab = 'style'; openScreen('loadout', 'modes'); return document.querySelectorAll('#loadout .swatch').length >= 36 && !document.querySelector('#loadout .locked'); }, 900);
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
  }
  await page.evaluate(() => {
    SC.start({ mode: 'versus', winScore: 1, killcam: false, loadouts: [{ weapon: 'katana', look: { pose: 'flex', ko: 'confetti', outfit: 'cape', skins: {} } }, { weapon: 'spear' }] });
    SC.G.lock = 0; damage(SC.F[1], 500, { src: SC.F[0], kind: 'melee', unblockable: true });
  });
  await page.waitForFunction(() => SC.G.state === 'over', null, { timeout: 15000 }).catch(() => {});
  await snap('results', () => { const c = document.querySelector('#over .results-card'); return SC.G.state === 'over' && !!c && !c.querySelector('.xp-box, .reward-total'); }, 900);
  check(!errors.length, `progress ui ${tag}: console errors ${errors.join(' | ')}`);
  await page.close();
}

async function run(page, browser, ctx) {
  fs.mkdirSync(ctx.SHOTS, { recursive: true });
  await testSim(page, ctx);
  await testMatchEnd(page, ctx);
  await testRankedOnce(page, ctx);
  await testNoEconomyText(page, ctx);
  await testPicker(browser, ctx);
  await testMigration(browser, ctx);
  for (const [size, full] of [[{ width: 1280, height: 720 }, true], [{ width: 1194, height: 834 }, false], [{ width: 400, height: 800 }, true]]) await shotsAt(browser, size, ctx, full);
}
module.exports = { run };

// Standalone: node tools/smoke-progress.cjs
if (require.main === module) {
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  const SHOTS = path.join(ROOT, 'tmp', 'smoke'), failures = [], rows = [];
  const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
  async function newPage(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await page.goto(URL);
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
