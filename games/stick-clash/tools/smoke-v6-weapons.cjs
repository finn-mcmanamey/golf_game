// Smoke tests for the v6 Party Arsenal (46-weapons-party.js). Called by tools/smoke.cjs; also runs on its own
// (`node tools/smoke-v6-weapons.cjs`, after `node build.mjs`). Headless (SC.sim) apart from the screenshots:
// - duels: each new weapon fights seeded CPU duels against a foe that lets its trick happen, until the trick lands
//   (counted from the 'weaponTrick' event). It must swing or fire, deal damage, and leave no errors or NaN;
// - round end: the moment a round is decided no trick state is left (floor zones, statuses, tethers, held states,
//   grip), and the next round starts clean;
// - focused checks of each mechanic with scripted inputs (racket return, glide + canopy, yo-yo out and back, paint
//   slide, snowman, soak + douse + lightning bonus, magnet rip + bend, pogo chain, chord, peel trip, tether + yank,
//   PILLOW FIGHT! banner), plus lore, sounds and the loadout picker;
// - screenshots of every trick at 1920x1080 @1 and 1536x864 @1.25 (tmp/smoke/v6w-*.png).
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const KEYS = ['tennis-racket', 'umbrella', 'yoyo', 'paint-roller', 'snowball', 'water-blaster', 'magnet-glove', 'pogo-hammer',
  'rock-guitar', 'banana', 'plunger-bow', 'pillow'];
// weapon: [foe weapon, arena, tricks that must land]
const DUELS = {
  'tennis-racket': ['pistol', 'dojo', ['ace']],
  umbrella: ['mortar', 'neon', ['glide']],
  yoyo: ['blade', 'dojo', ['yoyo-return', 'dog']],
  'paint-roller': ['blade', 'dojo', ['paint']],
  snowball: ['blade', 'dojo', ['snowman']],
  'water-blaster': ['blade', 'dojo', ['soak']],
  'magnet-glove': ['revolver', 'dojo', ['rip', 'bend']],
  'pogo-hammer': ['blade', 'dojo', ['bounce', 'quake']],
  'rock-guitar': ['blade', 'dojo', ['chord']],
  banana: ['blade', 'dojo', ['slip']],
  'plunger-bow': ['blade', 'dojo', ['tether', 'yank']],
  pillow: ['blade', 'sky', ['pillow-ko']],
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

// Page-side helpers: seeded fights, trick counting and a leftover-state probe.
const HELPERS = () => {
  window.__W = {
    tricks: {},
    seed(n) {   // a repeatable fight: seeded Math.random, pinned clock, no learnt CPU moves or clash timers
      for (const k in AI_MOVES) delete AI_MOVES[k];
      for (const k in CLASH_T) delete CLASH_T[k];
      let s = n * 7919;
      Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      SC.G.t = 1000;
    },
    // Trick state that must be gone once a round is decided.
    leftovers() {
      const out = [];
      for (const p of PROJ) if (!p.dead && PW_KINDS.has(p.kind)) out.push('proj:' + p.kind);
      for (const f of F) {
        for (const k of PW_STATUSES) if (f.status[k]) out.push(f.wkey + ':status:' + k);
        const m = f.mem;
        for (const k of ['yoyo', 'pwTether', 'magOn', 'umbOpen', 'gtrArmed', 'pogoAir']) if (m[k]) out.push(f.wkey + ':mem:' + k);
        if (m.pwGripSet != null) out.push(f.wkey + ':grip');
      }
      return out;
    },
    duel(w, foe, map, need, seed, secs) {
      const keep = Math.random, got = {}, e0 = SC.errors.length, ends = [], starts = [];
      const off = [on('weaponTrick', (f, key) => { if (f.team === 0) got[key] = (got[key] || 0) + 1; }),   // side 0 carries the weapon
        on('roundEnd', () => ends.push(__W.leftovers())), on('roundStart', () => starts.push(__W.leftovers()))];
      let t = 0, dmg = 0, acts = 0, nan = false;
      const offD = on('damage', (B, amt, o) => { if (o && o.src && o.src.team === 0 && o.src !== B) dmg += amt; });   // side 0, whatever it holds after a disarm
      try {
        __W.seed(seed);
        SC.start({ mode: 'watch', map, weapons: [w, foe], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
          throws: [['none', 'none'], ['none', 'none']], orbs: false, winScore: 99, weather: 'clear' });
        SC.G.state = 'play';
        const offA = on('attack', f => { if (f.wkey === w) acts++; }), offF = on('fire', f => { if (f.wkey === w) acts++; });
        for (; t < secs && !(need.every(k => got[k]) && ends.length); t += .5) {
          SC.sim(.5);
          nan = nan || SC.F.some(f => f.P.some(p => !Number.isFinite(p.x + p.y)));
        }
        offA(); offF(); offD();
      } finally { Math.random = keep; off.forEach(o => o()); }
      return { w, got, t, dmg, acts, nan, ends: ends.flat(), starts: starts.flat(), rounds: ends.length, errors: SC.errors.slice(e0).map(e => e.msg) };
    },
    // A scripted pair on the flat Dojo: both idle (brains off), at a hip gap.
    pair(wa, wb, gap = 200, map = 'dojo') {
      SC.start({ mode: 'watch', map, weapons: [wa, wb], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
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

// ---------- 1. seeded CPU duels: every weapon lands its trick, and round ends leave nothing behind ----------
async function testDuels(page, { check, rows }) {
  for (const w of KEYS) {
    const [foe, map, need] = DUELS[w];
    let r = null;
    for (let seed = 1; seed <= 3 && !(r && need.every(k => r.got[k]) && r.rounds); seed++) r = await page.evaluate(a => __W.duel(...a), [w, foe, map, need, seed, 90]);
    const landed = need.every(k => r.got[k]);
    const ok = check(landed, `v6w duel ${w}: tricks ${JSON.stringify(r.got)} (need ${need.join(', ')}) in ${r.t}s`)
      & check(r.acts > 0 && r.dmg > 0, `v6w duel ${w}: ${r.acts} swings/shots, ${r.dmg} damage`)
      & check(!r.nan && !r.errors.length, `v6w duel ${w}: ${r.nan ? 'NaN ' : ''}errors ${r.errors.join(' | ')}`)
      & check(r.rounds > 0 && !r.ends.length && !r.starts.length, `v6w duel ${w}: leftovers at round end ${r.ends.join(',')} / start ${r.starts.join(',')} (${r.rounds} rounds)`);
    rows.push({ kind: 'v6w', key: 'duel ' + w, ok: !!ok, note: `${JSON.stringify(r.got)} in ${r.t}s, ${r.rounds} rounds, ${r.dmg} dmg` });
  }
}

// ---------- 2. focused mechanics with scripted inputs ----------
const FOCUS = {
  // A shot reaching the strings during the swing window comes back faster, on the racket's side, at the shooter; the
  // same shot after the window has closed is not returned.
  racket() {
    const [A, B] = __W.pair('tennis-racket', 'pistol', 260);
    const serve = () => {
      const h = A.P[A.main.hand], t = A.P[A.tip], mx = (h.x + t.x) / 2 + 20, my = (h.y + t.y) / 2;
      return spawnProj({ owner: B, x: mx, y: my, vx: -1700, vy: 0, r: 4, dmg: 6, life: 1, kind: 'bullet' });
    };
    SC.press(0, 'attack'); SC.sim(1 / 120);
    const shot = serve(); SC.sim(1 / 60);
    const sp = Math.hypot(shot.vx, shot.vy);
    SC.sim(.6); A.atkCd = 0; SC.press(0, 'attack'); SC.sim(.35);
    const late = serve(); SC.sim(1 / 60);
    return { returned: shot.owner === A && shot.team === A.team, faster: sp > 1700 * 1.3, towardB: shot.vx > 0 || shot.hits.includes(B.id), late: late.owner === A };
  },
  // Gliding: a long slow fall you can steer; without it the same drop is much faster. Guard + canopy: a shell coming down
  // from behind is blocked (chip only), and a falling shot bounces off the open canopy.
  umbrella() {
    const fall = glide => {   // the same 380 px drop with and without the canopy: peak fall speed and time to land
      const [A] = __W.pair('umbrella', 'blade', 600);
      moveFighter(A, 0, -380); SC.sim(.05);
      SC.hold(0, 'attack', glide);
      let t = 0, top = 0, open = false;
      for (; t < 4 && !(t > .2 && A.grounded); t += 1 / 60) { SC.sim(1 / 60); top = Math.max(top, vy(A.P[2])); open = open || !!A.mem.umbOpen; }
      SC.hold(0, 'attack', false);
      return { vy: top, t, open };
    };
    const g = fall(true), n = fall(false);
    const [A, B] = __W.pair('umbrella', 'pistol', 300);
    SC.hold(0, 'block', true); SC.sim(.3);
    const hp0 = A.hp, c = chest(A);
    damage(A, 20, { src: B, kind: 'explode', x: c.x, y: c.y, nx: A.face * .45, ny: .9, kb: 300, blast: true });   // from above and behind
    const blocked = hp0 - A.hp;
    SC.hold(0, 'block', false); SC.sim(.4); A.hp = A.maxHp;
    const hp1 = A.hp; damage(A, 20, { src: B, kind: 'explode', x: c.x, y: c.y, nx: A.face * .45, ny: .9, kb: 300, blast: true });
    const open = hp1 - A.hp;
    SC.hold(0, 'block', true); SC.sim(.3);
    const t = A.P[A.tip], drop = spawnProj({ owner: B, x: t.x, y: t.y - 90, vx: 0, vy: 700, r: 5, dmg: 6, life: 2, kind: 'bullet' });
    SC.sim(.25);
    return { glideVy: Math.round(g.vy), fallVy: Math.round(n.vy), glideT: +g.t.toFixed(2), fallT: +n.t.toFixed(2), open: g.open, blocked, unguarded: open, bounced: drop.vy < 0 || drop.dead && drop.hits.length === 0 };
  },
  // A yo-yo flung at a foe hits on the way out and again on the way back; held on the floor it trips them.
  yoyo() {
    const [A, B] = __W.pair('yoyo', 'blade', 150);
    let hits = 0; const off = on('hit', a => { if (a === A) hits++; });
    SC.press(0, 'attack'); SC.sim(.6);
    const both = hits;
    B.hp = B.maxHp; moveFighter(B, A.P[2].x + 230 - B.P[2].x, 0); SC.sim(.3);
    let tripped = 0; const off2 = on('weaponTrick', (f, k) => { if (k === 'dog') tripped++; });
    SC.press(0, 'attack'); SC.hold(0, 'attack', true);
    for (let i = 0; i < 20 && !tripped; i++) { SC.sim(.1); B.inp.mx = -1; }
    SC.hold(0, 'attack', false); SC.sim(.5);
    off(); off2();
    return { hits: both, tripped, reset: A.main.links.every(l => !l.axR || Math.abs(l.r - l.axR) < 1e-6) };
  },
  // A stripe under a running foe: it keeps sliding long after it lets go, compared with dry floor.
  roller() {
    const slide = paint => {   // the foe runs in at full speed from dry floor, lets go on the stripe's start and drifts
      const [A, B] = __W.pair('paint-roller', 'blade', 260);
      const x = A.P[2].x;
      if (paint) { A.face = 1; A.grounded = true; rollerPaint(A); SC.sim(.3); }
      moveFighter(A, -320, 0); moveFighter(B, x - 150 - B.P[2].x, 0); SC.sim(.1);
      B.inp.mx = 1;
      for (let i = 0; i < 120 && B.P[2].x < x + 20; i++) SC.sim(1 / 120);
      B.inp.mx = 0;
      const x0 = B.P[2].x; SC.sim(.35);
      return { glide: Math.round(B.P[2].x - x0), zones: PROJ.filter(p => p.kind === 'paint' && !p.dead).length };
    };
    const wet = slide(true), dry = slide(false);
    return { wet: wet.glide, dry: dry.glide, zones: wet.zones };
  },
  // Three snowballs: chill stacks to 3, then a snowman (frozen); the snowman goes with the freeze.
  snowball() {
    const [A, B] = __W.pair('snowball', 'blade', 300);
    const stacks = [];
    for (let i = 0; i < 3; i++) { damage(B, 6, { src: A, kind: 'proj' }); snowChill(B, A); stacks.push(B.status.chilled ? B.status.chilled.n : B.status.snowman ? 's' : 0); }
    const snow = !!B.status.snowman && !!B.status.freeze;
    SC.sim(1.4);
    return { stacks, snow, after: !!B.status.snowman, slowMul: (() => { addStatus(B, 'chilled', 3, 1, A).n = 2; return +statusMul(B, 'moveMul').toFixed(2); })() };
  },
  // The stream soaks (putting out a burn), pushes, and a soaked foe takes +50% from a Storm Staff zap.
  water() {
    const [A, B] = __W.pair('water-blaster', 'storm-staff', 220);
    addStatus(B, 'burn', 4, 1, A);
    const x0 = B.P[2].x; SC.hold(0, 'attack', true);
    for (let i = 0; i < 8; i++) { SC.press(0, 'attack'); SC.sim(.1); }
    SC.hold(0, 'attack', false);
    const pushed = Math.round(B.P[2].x - x0), soaked = !!B.status.soaked, burning = !!B.status.burn;
    const [C, D] = __W.pair('storm-staff', 'blade', 220);
    addStatus(D, 'soaked', 3, 1, C); const wet = damage(D, 10, { src: C, kind: 'proj' }); D.hp = D.maxHp;
    removeStatus(D, 'soaked'); const dry = damage(D, 10, { src: C, kind: 'proj' });
    return { pushed, soaked, burning, wet, dry };
  },
  // Holding the magnet on an armed foe rips the weapon away; a bullet aimed at the wielder curves off.
  magnet() {
    const [A, B] = __W.pair('magnet-glove', 'katana', 260);
    SC.hold(0, 'attack', true); SC.sim(1.6); SC.hold(0, 'attack', false);
    const ripped = B.wkey === 'fists', drew = Math.round(260 - Math.abs(B.P[2].x - A.P[2].x));
    const [C, D] = __W.pair('magnet-glove', 'pistol', 300);
    SC.hold(0, 'attack', true); SC.sim(.3);
    const c = chest(C), shot = spawnProj({ owner: D, x: c.x + 250, y: c.y, vx: -1900, vy: 0, r: 4, dmg: 6, life: 1, kind: 'bullet' });
    const hp0 = C.hp; SC.sim(.3); SC.hold(0, 'attack', false);
    return { ripped, drew, bent: !!shot.bent, missed: C.hp === hp0 };
  },
  // A smash on the floor bounces the wielder up; landing sends a wave that hurts a foe nearby; a quick second smash chains.
  pogo() {
    const [A, B] = __W.pair('pogo-hammer', 'blade', 110);
    let bounces = 0, waves = 0, best = 1; const off = on('weaponTrick', (f, k) => { if (k === 'bounce') { bounces++; best = Math.max(best, f.mem.pogoN); } if (k === 'quake') waves++; });
    for (let i = 0; i < 40 && bounces < 2; i++) { if (A.atkCd <= 0 && A.grounded) SC.press(0, 'attack'); SC.sim(.05); }
    SC.sim(1.2); off();
    return { bounces, waves, chain: best };
  },
  // Four landed hits strike a chord; a held, released charge plays one at once.
  guitar() {
    const [A, B] = __W.pair('rock-guitar', 'blade', 120);
    let chords = 0; const off = on('weaponTrick', (f, k) => { if (k === 'chord') chords++; });
    for (let i = 0; i < 4; i++) hook(A.w, 'onHit', A, B, { x: B.P[1].x, y: B.P[1].y });
    const hp0 = B.hp; SC.sim(.4); const blasted = hp0 - B.hp;
    SC.hold(0, 'attack', true); SC.sim(.9); SC.hold(0, 'attack', false); SC.sim(.1);
    off();
    return { chords, blasted, recharge: +(A.mem.gtrReady - SC.G.t).toFixed(1) };
  },
  // A peel trips a foe who walks onto it (once), never its owner, and a fifth peel retires the oldest.
  banana() {
    const [A, B] = __W.pair('banana', 'blade', 300);
    bananaPeel(A, A.P[2].x + 150, feetY(A));
    const self = (() => { moveFighter(A, 150, 0); SC.sim(.3); return PROJ.some(p => p.kind === 'peel' && !p.dead); })();
    moveFighter(A, -150, 0);
    let slips = 0; const off = on('weaponTrick', (f, k) => { if (k === 'slip') slips++; });
    B.inp.mx = -1; SC.sim(1); B.inp.mx = 0; off();
    for (let i = 0; i < 5; i++) bananaPeel(A, 200 + i * 60, 640);
    return { selfSafe: self, slips, peels: PROJ.filter(p => p.kind === 'peel' && !p.dead).length };
  },
  // A tethered foe running away is held at the rope's length; attack yanks it back in.
  plunger() {
    const [A, B] = __W.pair('plunger-bow', 'blade', 200);
    const p = spawnProj(Object.assign({}, WEAPONS['plunger-bow'].ranged.proj, { owner: A, x: chest(B).x - 20, y: chest(B).y, vx: 900, vy: 0 }));
    SC.sim(.1);
    const s = B.status.tethered;
    B.inp.mx = 1; SC.sim(1.2);
    const held = s ? Math.round(Math.abs(B.P[2].x - A.P[2].x) - s.len) : null;
    const before = Math.abs(B.P[2].x - A.P[2].x);
    SC.press(0, 'attack'); SC.sim(.35); B.inp.mx = 0;
    return { tethered: !!s, len: s && Math.round(s.len), over: held, yanked: Math.round(before - Math.abs(B.P[2].x - A.P[2].x)), cleared: !B.status.tethered };
  },
  // A ring-out right after a pillow hit takes over the round-end banner.
  pillow() {
    const [A, B] = __W.pair('pillow', 'blade', 120, 'sky');
    damage(B, 3, { src: A, kind: 'melee', weapon: A.w, nx: 1, ny: 0, kb: 10 });   // a real pillow hit, then off the edge
    hook(A.w, 'onHit', A, B, { x: B.P[1].x, y: B.P[1].y });
    moveFighter(B, 0, 900); SC.sim(.3);
    return { banner: typeof BANNER === 'object' && BANNER ? BANNER.a : null, ko: !B.alive };
  },
};

async function testFocus(page, { check, rows }) {
  const want = {
    racket: r => r.returned && r.faster && r.towardB && !r.late,
    umbrella: r => r.open && r.glideVy < 240 && r.fallVy > r.glideVy * 2 && r.glideT > r.fallT * 2.5 && r.blocked < r.unguarded * .75 && r.bounced,
    yoyo: r => r.hits >= 2 && r.tripped > 0 && r.reset,
    roller: r => r.zones === 1 && r.wet > r.dry + 25,
    snowball: r => r.stacks[0] === 1 && r.stacks[1] === 2 && r.stacks[2] === 's' && r.snow && !r.after && r.slowMul < .8,
    water: r => r.soaked && !r.burning && r.pushed > 60 && r.wet >= Math.round(r.dry * 1.4),
    magnet: r => r.ripped && r.drew > 20 && r.bent && r.missed,
    pogo: r => r.bounces >= 2 && r.waves >= 1 && r.chain >= 2,
    guitar: r => r.chords >= 2 && r.blasted > 0 && r.recharge > 3,
    banana: r => r.selfSafe && r.slips === 1 && r.peels === 4,
    plunger: r => r.tethered && r.over < 25 && r.yanked > 40 && r.cleared,
    pillow: r => r.ko && r.banner === 'PILLOW FIGHT!',
  };
  for (const k in FOCUS) {
    const r = await page.evaluate(k => { const e0 = SC.errors.length; const out = FOCUS_FNS[k](); out.errors = SC.errors.slice(e0).map(e => e.msg); return out; }, k)
      .catch(e => ({ crash: e.message, errors: [] }));
    const ok = check(!r.crash && want[k](r) && !r.errors.length, `v6w ${k}: ${JSON.stringify(r)}`);
    rows.push({ kind: 'v6w', key: k, ok: !!ok, note: JSON.stringify(r).slice(0, 160) });
  }
}

// ---------- 3. lore, sounds, menus ----------
async function testContent(page, { check, rows }) {
  const r = await page.evaluate(keys => {
    const d = keys.map(k => WEAPONS[k]), rec = keys.map(k => SC.sound.recipe(k));
    return { defs: d.every(w => w && !w.hidden && w.tier && w.cat && w.desc.length > 120 && w.order && w.ai && w.ai.range),
      lore: keys.filter(k => !(LORE_LINES.w[k] && LORE_LINES.w[k].length >= 60)), wsnd: keys.filter(k => !WSND[k]),
      recipes: rec.every(x => x.s.length && x.h.length), sfx: ['pw-ace', 'pw-boing', 'pw-chord', 'pw-slip', 'pw-pillowfight', 'pw-yoink'].filter(n => !SFX[n]),
      listed: keys.filter(k => !listOf(WEAPONS).some(w => w.key === k)), cats: [...new Set(d.map(w => w.cat))] };
  }, KEYS);
  const ok = check(r.defs && !r.lore.length && !r.wsnd.length && r.recipes && !r.sfx.length && !r.listed.length, `v6w content: ${JSON.stringify(r)}`);
  rows.push({ kind: 'v6w', key: 'lore + sounds + listing', ok: !!ok, note: `cats ${r.cats.join(' ')}` });
  // Each new status put on the plain way (as smoke.cjs's status sweep and other content might): no errors, no NaN.
  const st = await page.evaluate(() => PW_STATUSES.map(k => {
    const e0 = SC.errors.length;
    SC.start({ mode: 'watch', weapons: ['blade', 'blade'] }); SC.sim(1.2);
    const s = addStatus(SC.F[0], k, 2, 1, SC.F[1]);
    SC.render(); SC.sim(1); SC.render(); SC.sim(1.5);
    return { k, ok: !!s && SC.errors.length === e0 && !SC.F.some(f => f.P.some(p => !Number.isFinite(p.x + p.y))), err: SC.errors.slice(e0).map(e => e.msg)[0] };
  }));
  const bad = st.filter(x => !x.ok);
  check(!bad.length, `v6w statuses applied plainly: ${JSON.stringify(bad)}`);
  rows.push({ kind: 'v6w', key: 'statuses applied plainly', ok: !bad.length, note: st.map(x => x.k).join(' ') });
}

// ---------- 4. screenshots: each trick mid-action with full effects ----------
async function testShots(browser, { check, rows, SHOTS }) {
  if (!SHOTS) return;
  const fs = require('fs'); fs.mkdirSync(SHOTS, { recursive: true });
  for (const [label, opts] of [['1080', { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }], ['864', { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 }]]) {
    const { page, errors } = await openPage(browser, opts);
    for (const w of KEYS) {
      const [foe, , need] = DUELS[w], map = w === 'pillow' ? 'sky' : 'neon';   // neon-styled arenas show the true colours
      const got = await page.evaluate(([w, foe, map, need]) => {
        __W.seed(3);
        SC.start({ mode: 'watch', map, weapons: [w, foe], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
          throws: [['none', 'none'], ['none', 'none']], orbs: false, winScore: 99, weather: 'clear', killcam: false });
        SC.G.state = 'play';
        let hit = null, at = null, n = 0;
        const off = on('weaponTrick', (f, k, B) => { if (f.team === 0 && !hit && (need.includes(k) || n > 120 * 20)) { hit = k; at = B || f; } });   // any of its tricks after 20 s
        for (; n < 120 * 60 && !hit; n++) worldStep(DT);          // real steps: floats, bursts and rings show
        for (let k = 0; k < 14; k++) worldStep(DT);
        off(); SC.G.state = 'paused';
        if (BANNER) BANNER.t = BANNER.len;                       // banners age in render time: drop the ROUND 1 card
        if (at) { const c = chest(at); focusCamera(c.x, c.y - 30, 3); }   // zoom in on where the trick landed
        for (let k = 0; k < 60; k++) SC.render(1 / 60);         // let the camera settle
        return hit;
      }, [w, foe, map, need]);
      await page.screenshot({ path: path.join(SHOTS, `v6w-${w}-${label}.png`) });
      if (!got) check(false, `v6w screenshot ${w} @${label}: trick never landed`);
    }
    check(!errors.length, `v6w screenshots @${label}: console ${[...new Set(errors)].join(' | ')}`);
    rows.push({ kind: 'v6w', key: 'screenshots @' + label, ok: !errors.length, note: `tmp/smoke/v6w-*-${label}.png` });
    await page.close();
  }
}

async function run(browser, ctx) {
  const { page, errors } = await openPage(browser);
  await page.evaluate(`window.FOCUS_FNS = {${Object.entries(FOCUS).map(([k, f]) => `${k}: ${f.toString().replace(/^\w+\(\)/, 'function ()')}`).join(',\n')}};`);
  for (const t of [testDuels, testFocus, testContent]) {
    try { await t(page, ctx); } catch (e) { ctx.check(false, `v6w ${t.name} crashed: ${e.message}`); }
  }
  ctx.check(!errors.length, 'v6w console: ' + [...new Set(errors)].join(' | '));
  await page.close();
  try { await testShots(browser, ctx); } catch (e) { ctx.check(false, `v6w screenshots crashed: ${e.message}`); }
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const browser = await chromium.launch(), failures = [], rows = [];
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    const t0 = Date.now(), only = process.argv.includes('--no-shots');
    try { await run(browser, { check, rows, SHOTS: only ? null : path.join(ROOT, 'tmp', 'smoke') }); } finally { await browser.close(); }
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`V6 WEAPONS FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`V6 WEAPONS OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
