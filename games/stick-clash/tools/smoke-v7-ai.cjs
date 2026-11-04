// Smoke tests and measurements for the v7 CPU pass (68-ai-v7.js). Called by tools/smoke.cjs; also runs on its own
// (`node tools/smoke-v7-ai.cjs [--measure] [--ladder] [--no-shots]`, after `node build.mjs`). Headless (SC.sim):
// - tricks: seeded CPU duels per trick weapon count signature tricks per round (weaponTrick events, trick floats and
//   trick functions); each weapon the v7 pass fixed must use its trick, and the whole set must not drop below v6;
// - kit: skills, throwables and mount CPU use per round;
// - smarter play: CPUs back off a telegraphed charge (graviton / guitar / javelin), swap a weak weapon for a better one
//   lying near, and the modes they used to play badly reach their objective;
// - personality: a line after a K.O., reactions (pillow, banana slip, frying pan, comeback, revenge), show-off when far
//   ahead, talk off with SETTINGS.taunts, no bubbles in crowds without rivals;
// - ladder: each level still beats the one below (short seeded matrix; --ladder runs the long one);
// - screenshots of bubbles and taunts at 1920x1080 @1 and 1536x864 @1.25 (tmp/smoke/v7a-*.png).
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const ARGS = process.argv.slice(2);

async function openPage(browser, opts = {}) {
  const page = await browser.newPage(opts), errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto('file://' + (process.env.HTML ? path.resolve(process.env.HTML) : path.join(ROOT, 'dist', 'stick-clash.html')));
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(HELPERS);
  return { page, errors };
}

// Page-side helpers. Trick detectors: v6 weapons emit weaponTrick; v5 weapons float a word or call a trick function.
const HELPERS = () => {
  const TRICK_FLOATS = { 'chrono-katana': ['TIME STOP!'], thornvine: ['ROOTED!'], 'meteor-flail': ['METEOR!'], 'prism-cannon': ['PRISM!'],
    'aegis-tower': ['GUARD CRUSH'], anchor: ['KEELHAULED!'], naginata: ['SWEPT!'], grapnel: ['HOOKED!', 'ZIP!'], javelin: ['THROW!'],
    'bass-drop': ['ON BEAT!'] };
  const TRICK_FNS = { graviton: 'gravitonPulse', conductor: 'conductorPlant' };
  window.__A = {
    TRICK_FLOATS, TRICK_FNS,
    seed(n) {
      for (const k in AI_MOVES) delete AI_MOVES[k];
      for (const k in CLASH_T) delete CLASH_T[k];
      let s = n * 7919;
      Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      SC.G.t = 1000;
    },
    // Counters for one run: texts floated, trick events per owner id, skill/throwable/mount uses, rounds, lines said.
    probe() {
      const P = __A.P = { floats: {}, tricks: {}, skills: {}, throws: {}, mounts: {}, rounds: 0, fns: {}, said: [] };
      if (!__A.wired) {
        __A.wired = true;
        const f0 = window.float;
        window.float = function (x, y, text) { if (__A.P) __A.P.floats[text] = (__A.P.floats[text] || 0) + 1; return f0.apply(this, arguments); };
        for (const k in TRICK_FNS) {
          const name = TRICK_FNS[k], fn = window[name];
          window[name] = function (f) { if (__A.P && f) __A.P.fns[f.id] = (__A.P.fns[f.id] || 0) + 1; return fn.apply(this, arguments); };
        }
        const say0 = window.aiSay;
        window.aiSay = function (f, text) { const ok = say0.apply(this, arguments); if (ok && __A.P) __A.P.said.push({ id: f.id, text, t: SC.G.t }); return ok; };
        on('weaponTrick', (f, key) => { if (__A.P && f) (__A.P.tricks[f.id] = __A.P.tricks[f.id] || {})[key] = ((__A.P.tricks[f.id] || {})[key] || 0) + 1; });
        on('skill', (f, key) => { if (__A.P && f) { const o = __A.P.skills[f.id] = __A.P.skills[f.id] || {}; o[key] = (o[key] || 0) + 1; } });
        on('throwable', (f, key) => { if (__A.P && f) { const o = __A.P.throws[f.id] = __A.P.throws[f.id] || {}; o[key] = (o[key] || 0) + 1; } });
        on('mount', (f, key) => { if (__A.P && f) { const o = __A.P.mounts[f.id] = __A.P.mounts[f.id] || {}; o[key] = (o[key] || 0) + 1; } });
        on('roundStart', () => { if (__A.P) __A.P.rounds++; });
      }
      return P;
    },
    // Tricks fighter 0 (holding `key`) pulled off in this probe.
    tricksOf(key, P) {
      let n = 0;
      for (const k in P.tricks[0] || {}) n += P.tricks[0][k];
      for (const t of TRICK_FLOATS[key] || []) n += P.floats[t] || 0;
      if (TRICK_FNS[key]) n += P.fns[0] || 0;
      return n;
    },
    // Seeded CPU duels: weapon `key` against a rotation of plain foes and arenas, `secs` each. Per round: tricks.
    trickRuns(key, diff = 'normal', secs = 40, seeds = 6) {
      const foes = ['pistol', 'blade', 'grenade'], maps = ['dojo', 'sky', 'neon'];
      let tricks = 0, rounds = 0;
      const keep = Math.random;
      for (let s = 0; s < seeds; s++) {
        __A.seed(key.length * 101 + s + 1);
        const P = __A.probe();
        SC.start({ mode: 'watch', map: maps[s % 3], weapons: [key, foes[s % 3]], diffs: [diff, diff], classes: ['none', 'none'],
          skills: [['none', 'none'], ['none', 'none']], throws: [['none', 'none'], ['none', 'none']], winScore: 999, minigames: false });
        SC.G.state = 'play';
        SC.sim(secs);
        tricks += __A.tricksOf(key, P); rounds += Math.max(1, P.rounds);
      }
      Math.random = keep; __A.P = null;
      return { key, tricks, rounds, per: +(tricks / rounds).toFixed(2), errors: SC.errors.length };
    },
    // Kit use per round: fighter 0 carries `what` (a skill, throwable or mount orb key) against a plain CPU.
    kitRuns(kind, key, diff = 'normal', secs = 30, seeds = 4) {
      let uses = 0, rounds = 0;
      const keep = Math.random;
      for (let s = 0; s < seeds; s++) {
        __A.seed(key.length * 37 + s + 3);
        const P = __A.probe();
        const cfg = { mode: 'watch', map: ['dojo', 'neon'][s % 2], weapons: [['blade', 'pistol'][s % 2], ['blade', 'pistol', 'spear', 'grenade'][s % 4]], diffs: [diff, diff],
          classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']], throws: [['none', 'none'], ['none', 'none']], winScore: 999, minigames: false };
        if (kind === 'skill') cfg.skills[0] = [key, 'none'];
        if (kind === 'throw') cfg.throws[0] = [key, key];
        SC.start(cfg); SC.G.state = 'play';
        SC.sim(secs);
        const tab = kind === 'skill' ? P.skills : kind === 'throw' ? P.throws : null;
        uses += (tab[0] || {})[key] || 0;
        rounds += Math.max(1, P.rounds);
      }
      Math.random = keep; __A.P = null;
      return { kind, key, uses, rounds, per: +(uses / rounds).toFixed(2) };
    },
  };
};

const TRICK_WEAPONS = ['tennis-racket', 'umbrella', 'yoyo', 'paint-roller', 'snowball', 'water-blaster', 'magnet-glove', 'pogo-hammer',
  'rock-guitar', 'banana', 'plunger-bow', 'pillow', 'chrono-katana', 'graviton', 'thornvine', 'meteor-flail', 'prism-cannon',
  'aegis-tower', 'anchor', 'naginata', 'grapnel', 'javelin', 'conductor', 'bass-drop'];

async function measureTricks(page, diff) {
  return page.evaluate(([keys, diff]) => keys.map(k => __A.trickRuns(k, diff)), [TRICK_WEAPONS, diff]);
}

async function measureKit(page) {
  return page.evaluate(() => {
    const out = [];
    for (const k in SC.reg.SKILLS) if (!SC.reg.SKILLS[k].hidden) out.push(__A.kitRuns('skill', k));
    for (const k in SC.reg.THROWABLES) out.push(__A.kitRuns('throw', k));
    return out;
  });
}

// The weapons this pass gave a trick brain must now use their trick; nothing in the set may break or error.
const FIXED = { 'meteor-flail': .3, thornvine: .18, anchor: .28, 'chrono-katana': .5 };   // v6 build: .04, .14, .21, .55
async function testTricks(page, { check, rows }) {
  const t = await measureTricks(page, 'normal');
  const by = Object.fromEntries(t.map(r => [r.key, r])), total = t.reduce((a, r) => a + r.per, 0);
  let ok = check(t.every(r => !r.errors), 'v7 tricks: errors in ' + t.filter(r => r.errors).map(r => r.key).join(', '));
  for (const k in FIXED) ok &= check(by[k].per >= FIXED[k], `v7 tricks: ${k} ${by[k].per}/round (want ≥ ${FIXED[k]})`);
  ok &= check(total >= 38, `v7 tricks: all trick weapons ${total.toFixed(1)}/round in total (v6 had ~41)`);
  rows.push({ kind: 'v7 ai', key: 'weapon tricks', ok: !!ok, note: Object.keys(FIXED).map(k => `${k} ${by[k].per}`).join(', ') + `; total ${total.toFixed(1)}/round over ${t.length} weapons` });
  const k = await measureKit(page), thr = k.filter(r => r.kind === 'throw'), sk = k.filter(r => r.kind === 'skill');
  const thrPer = thr.reduce((a, r) => a + r.per, 0) / thr.length, used = sk.filter(r => r.uses > 0).length;
  const ok2 = check(thrPer >= .35, `v7 kit: throwables ${thrPer.toFixed(2)}/round`) & check(used >= sk.length - 3, `v7 kit: only ${used}/${sk.length} skills used`);
  rows.push({ kind: 'v7 ai', key: 'kit use', ok: !!ok2, note: `throwables ${thrPer.toFixed(2)}/round each; ${used}/${sk.length} skills used` });
}

// Scripted moments: a charge it backs away from, a better weapon it swaps for, Volley Clash's net.
async function testSmarts(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const keep = Math.random, out = {};
    // A human holding a charged Graviton pulse at 150 px: how far does the CPU stand off while it's armed?
    out.read = ['easy', 'insane'].map(diff => {
      let away = 0;
      for (let s = 0; s < 6; s++) {
        __A.seed(500 + s);
        SC.start({ mode: 'watch', map: 'dojo', weapons: ['graviton', 'blade'], diffs: [diff, diff], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
          throws: [['none', 'none'], ['none', 'none']], winScore: 999, minigames: false });
        SC.G.state = 'play'; SC.G.lock = 0;
        const [A, B] = SC.F;
        A.ctrl = 'human';
        moveFighter(A, 520 - A.P[2].x, 0); moveFighter(B, 670 - B.P[2].x, 0);
        A.mem.gravArmed = true; A.mem.gravHold = .6; A.inp.attackHeld = true; A.inp.mx = 0;
        let most = 0;
        for (let k = 0; k < 24; k++) { A.mem.gravArmed = true; A.inp.attackHeld = true; SC.sim(1 / 30); most = Math.max(most, Math.abs(B.P[2].x - A.P[2].x)); }
        if (most > 240) away++;
      }
      return away;
    });
    // A Normal CPU with a plain blade and a mythic weapon lying 200 px away, the foe far off.
    out.upgrade = ['easy', 'insane'].map(diff => {
      let took = 0;
      for (let s = 0; s < 4; s++) {
        __A.seed(600 + s);
        SC.start({ mode: 'watch', map: 'dojo', weapons: ['blade', 'pistol'], diffs: [diff, diff], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
          throws: [['none', 'none'], ['none', 'none']], winScore: 999, minigames: false, orbs: false });
        SC.G.state = 'play'; SC.G.lock = 0;
        const [A, B] = SC.F;
        B.ai.behave = 'idle';
        moveFighter(A, 300 - A.P[2].x, 0); moveFighter(B, 1150 - B.P[2].x, 0);
        spawnPickup('weapon', 'bass-drop', 500, feetY(A) - 30, 0, 0);
        SC.sim(3);
        if (A.wkey === 'bass-drop') took++;
      }
      return took;
    });
    // Volley Clash: share of time CPUs spend on the rival's court, and the longest rally.
    out.volley = [];
    for (let s = 1; s <= 4; s++) {
      __A.seed(s * 99);
      SC.start({ mode: 'volley', autopilot: true, diff: s % 2 ? 'normal' : 'hard' }); SC.G.state = 'play';
      let wrong = 0, n = 0;
      for (let t = 0; t < 120 && SC.G.state !== 'over'; t += 1 / 15) {
        SC.sim(1 / 15);
        for (const f of SC.F) { if (!f.alive || f.summon) continue; n++; if ((f.P[2].x < VC_NET.x) !== (f.team % 2 === 0)) wrong++; }
      }
      out.volley.push({ wrong: wrong / Math.max(1, n), best: modeRun().best, pts: modeRun().pts.join('-') });
    }
    Math.random = keep;
    out.errors = SC.errors.map(e => e.msg);
    return out;
  });
  const wrong = r.volley.reduce((a, v) => a + v.wrong, 0) / r.volley.length;
  const ok = check(r.read[1] >= 4 && r.read[1] > r.read[0], `v7 smarts: backed off a charged pulse easy ${r.read[0]}/6, insane ${r.read[1]}/6`)
    & check(r.upgrade[1] >= 3 && r.upgrade[1] >= r.upgrade[0], `v7 smarts: swapped for a mythic easy ${r.upgrade[0]}/4, insane ${r.upgrade[1]}/4`)
    & check(wrong < .05, `v7 smarts: volley CPUs on the wrong court ${(wrong * 100).toFixed(0)}% of the time`)
    & check(!r.errors.length, 'v7 smarts errors: ' + r.errors.slice(0, 3).join(' | '));
  rows.push({ kind: 'v7 ai', key: 'smarter play', ok: !!ok, note: `charge read easy ${r.read[0]}/6 insane ${r.read[1]}/6; upgrade easy ${r.upgrade[0]}/4 insane ${r.upgrade[1]}/4; volley wrong court ${(wrong * 100).toFixed(1)}%, rallies ${r.volley.map(v => v.best).join('/')}` });
}

// Lines: a K.O. line, reactions to silly hits and tricks, revenge and salty lines between rounds, show-offs by level,
// and silence with talk off or in a crowd of plain CPUs.
async function testTalk(page, { check, rows }) {
  const r = await page.evaluate(() => {
    const keep = Math.random, out = {};
    const duel = (wa, wb, diff = 'normal', extra = {}) => {
      SC.start(Object.assign({ mode: 'watch', map: 'dojo', weapons: [wa, wb], diffs: [diff, diff], classes: ['none', 'none'], skills: [['none', 'none'], ['none', 'none']],
        throws: [['none', 'none'], ['none', 'none']], winScore: 999, minigames: false }, extra));
      SC.G.state = 'play'; SC.G.lock = 0;
      return SC.F;
    };
    const lines = k => AI_V7_LINES[k];
    // K.O. lines in plain CPU duels.
    __A.seed(700); const P = __A.probe(); let kos = 0, answered = 0;
    const koT = [];
    on('ko', (V, K) => { if (__A.P === P && K && K !== V && K.alive) koT.push({ id: K.id, t: SC.G.t }); });
    duel('random', 'random'); SC.sim(120);
    for (const k of koT) { kos++; if (P.said.some(s => s.id === k.id && Math.abs(s.t - k.t) < .05)) answered++; }
    out.ko = { kos, answered };
    // Reactions: a pillow to the face and a banana slip.
    __A.seed(701); __A.probe();
    let [A, B] = duel('pillow', 'blade'); B.ai.sayT = -9; AI_TALK.lastT = -9;
    damage(B, 3, { src: A, kind: 'melee', x: B.P[1].x, y: B.P[1].y, nx: 1, ny: 0, kb: 100 });
    out.pillow = __A.P.said.map(s => s.text).find(t => lines('pillow').includes(t)) || null;
    [A, B] = duel('banana', 'blade'); B.ai.sayT = -9; AI_TALK.lastT = -9;
    emit('weaponTrick', A, 'slip', B);
    out.slip = __A.P.said.map(s => s.text).find(t => lines('slipped').includes(t)) || null;
    // Revenge: B K.O.'d A last round; this round A K.O.'s B.
    [A, B] = duel('blade', 'blade');
    AI_V7.mem = { 0: { koBy: 1 } };
    A.ai.sayT = -9; AI_TALK.lastT = -9;
    emit('ko', B, A, {});
    out.revenge = __A.P.said.map(s => s.text).find(t => lines('revenge').includes(t)) || null;
    // Losing to a frying pan, then the next round starts: a salty line.
    AI_V7.mem = { 1: { lost: true, lostTo: 'frying-pan', streak: 1 } };
    for (const f of SC.F) f.ai.sayT = -9;
    AI_TALK.lastT = -9;
    emit('roundStart', 2);
    out.salty = __A.P.said.map(s => s.text).find(t => lines('lostPan').concat(lines('salty')).includes(t)) || null;
    // Show-offs: far ahead (two rounds up), foe far away, per level.
    out.show = ['easy', 'insane'].map(diff => {
      let n = 0;
      for (let s = 0; s < 4; s++) {
        __A.seed(720 + s);
        const [X, Y] = duel('blade', 'blade', diff);
        SC.G.score[0] = 2; Y.ai.behave = 'idle';
        moveFighter(X, 250 - X.P[2].x, 0); moveFighter(Y, 1100 - Y.P[2].x, 0);
        AI_V7.shows = 0;
        for (let k = 0; k < 300; k++) { SC.sim(1 / 15); X.inp.mx = 0; moveFighter(X, 250 - X.P[2].x, 0); }
        n += AI_V7.shows;
      }
      return n;
    });
    // Talk off, and a crowd of plain CPUs: no bubbles at all.
    SETTINGS.taunts = false; __A.seed(730); let Q = __A.probe(); duel('random', 'random'); SC.sim(40); out.off = Q.said.length;
    SETTINGS.taunts = true; __A.seed(731); Q = __A.probe();
    SC.start({ mode: 'watch', fighters: 6, weapons: ['random'], winScore: 999, minigames: false }); SC.G.state = 'play'; SC.sim(30); out.crowd = Q.said.length;
    __A.P = null; Math.random = keep;
    out.errors = SC.errors.map(e => e.msg);
    return out;
  });
  const ok = check(r.ko.kos > 0 && r.ko.answered / r.ko.kos >= .8, `v7 talk: ${r.ko.answered}/${r.ko.kos} K.O.s got a line`)
    & check(!!r.pillow && !!r.slip, `v7 talk: reactions pillow "${r.pillow}" slip "${r.slip}"`)
    & check(!!r.revenge && !!r.salty, `v7 talk: revenge "${r.revenge}" salty "${r.salty}"`)
    & check(r.show[0] > r.show[1] && r.show[0] > 0, `v7 talk: show-offs easy ${r.show[0]} insane ${r.show[1]}`)
    & check(r.off === 0 && r.crowd === 0, `v7 talk: lines with talk off ${r.off}, in a plain crowd ${r.crowd}`)
    & check(!r.errors.length, 'v7 talk errors: ' + r.errors.slice(0, 3).join(' | '));
  rows.push({ kind: 'v7 ai', key: 'personality', ok: !!ok, note: `${r.ko.answered}/${r.ko.kos} K.O. lines; "${r.pillow}", "${r.slip}", "${r.revenge}", "${r.salty}"; show-offs easy ${r.show[0]} / insane ${r.show[1]}` });
}

// Each level beats the one below (seeded CPU vs CPU on random arenas and gear). Short in the suite; --ladder is longer.
async function ladder(page, secs, games) {
  return page.evaluate(([secs, games]) => {
    const keep = Math.random, out = [];
    for (let i = 0; i < AI_ORDER.length - 1; i++) {
      const lo = AI_ORDER[i], hi = AI_ORDER[i + 1];
      let win = 0, n = 0;
      for (let g = 0; g < games; g++) {
        __A.seed(900 + i * 50 + g);
        const swap = g % 2, maps = Object.keys(SC.reg.MAPS).filter(k => !SC.reg.MAPS[k].hidden);
        SC.start({ mode: 'watch', diffs: swap ? [lo, hi] : [hi, lo], map: maps[(g * 7 + i * 3) % maps.length], weapons: ['random', 'random'], winScore: 999 });
        SC.G.state = 'play';
        SC.sim(secs);
        for (const l of SC.G.log) { if (l.winner < 0) continue; n++; if (l.winner === (swap ? 1 : 0)) win++; }
      }
      out.push({ pair: `${hi} v ${lo}`, win: win / Math.max(1, n), n });
    }
    Math.random = keep;
    return out;
  }, [secs, games]);
}
async function testLadder(page, { check, rows }) {
  const long = ARGS.includes('--ladder'), r = await ladder(page, long ? 90 : 60, long ? 24 : 8);
  const ok = check(r.every(p => p.win > .55), 'v7 ladder: ' + r.map(p => `${p.pair} ${(p.win * 100).toFixed(0)}%`).join(', '));
  rows.push({ kind: 'v7 ai', key: 'difficulty ladder', ok: !!ok, note: r.map(p => `${p.pair} ${(p.win * 100).toFixed(0)}% (${p.n})`).join(', ') });
}

// Bubbles over the fighters on the real canvas, at the two laptop sizes.
async function testShots(browser, { check, rows, SHOTS }) {
  if (!SHOTS) return;
  const dir = path.join(ROOT, 'tmp', 'smoke');
  fs.mkdirSync(dir, { recursive: true });
  const files = [], lifts = [];
  for (const [w, h, dpr] of [[1920, 1080, 1], [1536, 864, 1.25]]) {
    const { page, errors } = await openPage(browser, { viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const lift = await page.evaluate(() => {
      __A.seed(800);
      SC.start({ mode: 'watch', map: 'dojo', weapons: ['frying-pan', 'blade'], classes: ['none', 'none'], winScore: 999, minigames: false,
        personas: ['dazzle', 'none'] });
      SC.G.state = 'play'; SC.G.lock = 0; SC.sim(.5);
      const [A, B] = SC.F;
      for (const f of SC.F) { f.ai.behave = 'idle'; f.hp = Math.round(f.maxHp * (f === A ? .9 : .3)); }
      moveFighter(A, 330 - A.P[2].x, 0); moveFighter(B, 520 - B.P[2].x, 0);   // open floor, left of the gate
      SC.sim(1.2);
      A.ai.behave = null; A.ai.flourish = { kind: 'taunt', t: SC.G.t + 2 };   // A strikes a pose while both talk
      SC.sim(.35); SC.G.state = 'paused';
      BANNER = null;
      if (Math.abs(feetY(A) - feetY(B)) < 20) { moveFighter(A, 330 - A.P[2].x, 0); moveFighter(B, 480 - B.P[2].x, 0); }   // close: the bubbles collide
      AI_TALK.list = []; A.ai.sayT = B.ai.sayT = AI_TALK.lastT = -9;
      aiSay(B, AI_V7_LINES.lostPan[0], true);
      aiSay(A, 'Watch and learn!', true);
      for (const b of AI_TALK.list) b.t = SC.G.t - .5;
      SC.render(1 / 60);
      return AI_TALK.list.map(b => b.lift || 0);
    });
    lifts.push(Math.round(Math.max(...lift)));
    const file = path.join(dir, `v7a-bubbles-${w}.png`);
    await page.screenshot({ path: file });
    files.push(path.relative(ROOT, file));
    check(!errors.length, `v7 shots ${w}: ` + errors.join(' | '));
    await page.close();
  }
  const ok = check(lifts.every(l => l > 0), `v7 shots: two close bubbles not stacked (lift ${lifts.join('/')})`);
  rows.push({ kind: 'v7 ai', key: 'bubble screenshots', ok, note: `stacked by ${lifts.join('/')} px; ` + files.join(', ') });
}

async function run(browser, ctx) {
  const { page, errors } = await openPage(browser);
  if (ARGS.includes('--ladder-only')) {                // before/after ladder numbers (HTML=… for another build)
    const l = await ladder(page, 90, +(process.env.GAMES || 24));
    console.table(l.map(p => ({ pair: p.pair, win: (p.win * 100).toFixed(1) + '%', rounds: p.n })));
    await page.close();
    return;
  }
  if (ARGS.includes('--measure')) {
    const t = await measureTricks(page, process.env.DIFF || 'normal');
    console.table(t);
    const k = await measureKit(page);
    console.table(k);
    const l = ARGS.includes('--ladder') ? await ladder(page, 90, 24) : null;
    if (l) console.table(l);
    fs.mkdirSync(path.join(ROOT, 'tmp', 'a'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'tmp', 'a', 'measure-' + (process.env.TAG || 'now') + '.json'), JSON.stringify({ tricks: t, kit: k, ladder: l }, null, 1));
    await page.close();
    return;
  }
  for (const t of [testTricks, testSmarts, testTalk, testLadder]) {
    try { await t(page, ctx); } catch (e) { ctx.check(false, `v7 ai ${t.name} crashed: ${e.message}`); }
  }
  ctx.check(!errors.length, 'v7 ai console: ' + [...new Set(errors)].join(' | '));
  await page.close();
  try { await testShots(browser, ctx); } catch (e) { ctx.check(false, `v7 ai testShots crashed: ${e.message}`); }
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const browser = await chromium.launch(), failures = [], rows = [];
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    const t0 = Date.now();
    try { await run(browser, { check, rows, SHOTS: !ARGS.includes('--no-shots') }); } finally { await browser.close(); }
    if (rows.length) console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`V7 AI FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`V7 AI OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
