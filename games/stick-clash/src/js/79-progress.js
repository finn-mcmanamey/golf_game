// 79-progress.js: the free 100-level progression track (XP from matches, campaign, challenges and quests), look
// ownership (outfits, skins, K.O. effects, pets, poses, titles), daily/weekly quests, secrets + cheat codes, the
// codex stats and the fighter-creator presets. Saved via store: 'prog' (xp, owned looks, title, secrets, codex
// stats), 'tasks' (quests) and 'presets'. Only real (non-autopilot, non-demo, non-practice) matches count.

const TITLES = {};
[['rookie', 'Rookie'], ['brawler', 'Brawler'], ['wobbler', 'Wobble Lord'], ['neon-ninja', 'Neon Ninja'], ['pet-whisperer', 'Pet Whisperer'],
  ['untouchable', 'Untouchable'], ['taunt-master', 'Taunt Master'], ['grand-duelist', 'Grand Duelist'], ['legend', 'Living Legend'],
  ['stick-legend', 'Stick Legend'], ['retro', 'Retro Soul', 1], ['night-owl', 'Night Owl', 1]]
  .forEach(([k, name, hidden]) => defLook(TITLES, k, { name, icon: '🏷', hidden: !!hidden }));

const LOOKS = { outfit: OUTFITS, skin: WSKINS, ko: KOFX, pet: PETS, pose: POSES, title: TITLES };
const LOOK_NAMES = { outfit: 'Outfit', skin: 'Weapon skin', ko: 'K.O. effect', pet: 'Pet', pose: 'Victory pose', title: 'Title', hat: 'Hat', coins: 'Coins' };
const LOOK_FREE = { outfit: ['none', 'scarf'], skin: ['none'], ko: ['none', 'confetti'], pet: ['none'], pose: ['cheer', 'wave'], title: ['rookie'] };

const PROG = (() => {
  const p = store.get('prog', {}) || {};
  return { xp: p.xp || 0, own: p.own || {}, title: p.title || 'rookie', secrets: p.secrets || {}, codex: p.codex || {}, seen: p.seen || 1 };
})();
function progSave() { store.set('prog', PROG); }
const lookOwned = (kind, key) => (LOOK_FREE[kind] || []).includes(key) || ((PROG.own[kind] || []).includes(key));
function lookGrant(kind, key) {
  if (kind === 'hat') { if (ownsHat(key)) return false; PROFILE.hats.push(key); saveProfile(); return true; }
  if (lookOwned(kind, key)) return false;
  (PROG.own[kind] = PROG.own[kind] || []).push(key);
  progSave();
  return true;
}

// ---------- the track: 100 levels, a reward on each ----------
const TRACK_ITEMS = [[2, 'pet', 'sprig'], [3, 'outfit', 'cape'], [4, 'skin', 'gold'], [5, 'ko', 'fireworks'], [6, 'pose', 'flex'],
  [7, 'title', 'brawler'], [8, 'outfit', 'sash'], [9, 'pet', 'bitbot'], [10, 'hat', 'cowboy'], [12, 'skin', 'neon'], [13, 'ko', 'hearts'],
  [14, 'outfit', 'tail'], [15, 'pose', 'point'], [16, 'pet', 'fetch'], [18, 'skin', 'frost'], [19, 'outfit', 'kilt'], [20, 'title', 'wobbler'],
  [21, 'ko', 'pixels'], [22, 'pose', 'dab'], [24, 'pet', 'zappy'], [25, 'hat', 'viking'], [26, 'outfit', 'ribbons'], [28, 'skin', 'pixel'],
  [30, 'ko', 'stars'], [31, 'title', 'neon-ninja'], [33, 'outfit', 'champ'], [35, 'pet', 'tick'], [36, 'pose', 'shrug'], [38, 'skin', 'candy'],
  [40, 'outfit', 'knight'], [42, 'ko', 'bubbles'], [44, 'title', 'pet-whisperer'], [45, 'hat', 'wizard'], [46, 'pet', 'bubbles'],
  [48, 'skin', 'crystal'], [50, 'outfit', 'samurai'], [52, 'pose', 'salute'], [54, 'ko', 'ghost'], [56, 'pet', 'wisp'], [58, 'skin', 'lava'],
  [60, 'outfit', 'cloak'], [62, 'title', 'untouchable'], [65, 'hat', 'halo'], [66, 'pose', 'bounce'], [68, 'ko', 'lightning'],
  [70, 'outfit', 'banner'], [74, 'pet', 'glim'], [76, 'title', 'taunt-master'], [78, 'skin', 'void'], [80, 'outfit', 'mantle'],
  [85, 'hat', 'crown'], [90, 'title', 'grand-duelist'], [95, 'title', 'legend'], [100, 'title', 'stick-legend']];
const TRACK_MAX = 100;
// TRACK[l] = the reward for reaching level l: { kind, key } or { kind: 'coins', n }.
const TRACK = Array.from({ length: TRACK_MAX + 1 }, (_, l) => ({ kind: 'coins', n: (30 + l * 2) * (l % 5 ? 1 : 3) }));
for (const [l, kind, key] of TRACK_ITEMS) TRACK[l] = { kind, key };
const xpNeed = l => 100 + l * 6;                       // XP from level l to l + 1 (~40,000 in total)
function trackLevel(xp) {
  let l = 1;
  while (l < TRACK_MAX && xp >= xpNeed(l)) { xp -= xpNeed(l); l++; }
  return { lvl: l, into: xp, need: l < TRACK_MAX ? xpNeed(l) : 0 };
}
function trackRewardName(r) {
  if (r.kind === 'coins') return `${r.n} coins`;
  const reg = r.kind === 'hat' ? HATS : LOOKS[r.kind], d = reg && reg[r.key];
  return (d ? d.name : r.key) + ' · ' + LOOK_NAMES[r.kind];
}
function trackIcon(r) {
  if (r.kind === 'coins') return '🪙';
  if (r.kind === 'hat') return '🎩';
  const d = LOOKS[r.kind] && LOOKS[r.kind][r.key];
  return d ? d.icon : '★';
}
// Adds XP, hands out every level reward passed, and returns the levels reached.
function addXp(n, why) {
  n = Math.max(0, Math.round(n));
  if (!n) return [];
  const before = trackLevel(PROG.xp).lvl;
  PROG.xp += n;
  const after = trackLevel(PROG.xp).lvl, ups = [];
  for (let l = before + 1; l <= after; l++) { trackGive(l); ups.push(l); }
  progSave();
  emit('xp', n, why, ups);
  return ups;
}
function trackGive(l) {
  const r = TRACK[l];
  if (r.kind === 'coins') addCoins(r.n);
  else if (!lookGrant(r.kind, r.key)) addCoins(150);          // already owned (a shop hat): coins instead
  if (typeof toast === 'function' && G_STATE.state !== 'over') toast(`Level ${l}!`, trackRewardName(r), trackIcon(r), '#5ef2ff');
}

// ---------- match XP and codex stats ----------
const PROG_MATCH = { xp: 0, lines: [], ups: [], kos: 0, taunts: 0 };
const progReal = () => typeof statsOn === 'function' && statsOn();
on('matchStart', () => Object.assign(PROG_MATCH, { xp: 0, lines: [], ups: [], kos: 0, taunts: 0, done: false }));
on('ko', (V, K) => { if (progReal() && isRealPlayer(K) && V !== K && !V.summon) { PROG_MATCH.kos++; codexKo(K); } });
on('tauntDone', f => { if (progReal() && isRealPlayer(f)) PROG_MATCH.taunts++; });
on('roundEnd', winner => { if (progReal()) for (const f of F.filter(isRealPlayer)) codexRound(f, f.team === winner); });
on('matchOver', () => progSettle());
// Works out the match XP once (called on matchOver and by the results screen, whichever comes first).
function progSettle() {
  if (!progReal() || PROG_MATCH.done) return;
  PROG_MATCH.done = true;
  const rw = (typeof settleMatch === 'function' && settleMatch()) || {}, mode = G_STATE.mode || {}, hs = rosterHumanTeams();
  const add = (n, why) => { n = Math.round(n); if (n > 0) { PROG_MATCH.xp += n; PROG_MATCH.lines.push([why, n]); } };
  add(40, 'Match played');
  if (rw.won) add(60, 'Victory');
  add(Math.min(60, hs.reduce((s, t) => s + (G_STATE.score[t] || 0), 0) * 10), 'Rounds won');
  add(Math.min(50, PROG_MATCH.kos * 5), 'K.O.s');
  if (mode.quest) add(40, mode.key === 'campaign' ? 'Quest battle' : 'Challenge');
  PROG_MATCH.ups = addXp(PROG_MATCH.xp, 'match');
  codexBoss(rw.won);
  secretFeats(rw.won);
}

// Codex stats per entry: [uses, wins, K.O.s]. Kinds: w weapons, s skills, c classes, m arenas, p pets, b boss nodes.
function codexBump(kind, key, slot, n = 1) {
  if (!key) return;
  const t = PROG.codex[kind] = PROG.codex[kind] || {}, row = t[key] = t[key] || [0, 0, 0];
  row[slot] += n;
}
const codexKeys = f => [['w', f.wkey], ['c', f.clsKey], ['m', MAP && MAP.key], ['p', lookOf(f).pet], ...f.skills.filter(Boolean).map(k => ['s', k])];
function codexRound(f, won) { for (const [k, key] of codexKeys(f)) { codexBump(k, key, 0); if (won) codexBump(k, key, 1); } progSave(); }
function codexKo(f) { for (const [k, key] of codexKeys(f)) codexBump(k, key, 2); }
function codexBoss(won) {
  const node = G_STATE.mode && G_STATE.mode.key === 'campaign' && typeof CAMP_BY_ID === 'object' && CAMP_BY_ID[G_STATE.cfg.node];
  if (!node || (node.kind !== 'boss' && node.kind !== 'mini')) return;
  codexBump('b', node.id, 0); if (won) codexBump('b', node.id, 1);
  progSave();
}
const codexRow = (kind, key) => ((PROG.codex[kind] || {})[key]) || [0, 0, 0];

// ---------- daily and weekly quests ----------
// Each task counts an event during real matches. Three dailies and three weeklies are drawn from the local date
// (same for every save on that day); one daily may be rerolled per day.
const TASKS = {
  win: { text: 'Win {n} matches', d: 2 }, play: { text: 'Play {n} matches', d: 3 }, kos: { text: 'Score {n} K.O.s', d: 6 },
  hits: { text: 'Land {n} hits', d: 40 }, skills: { text: 'Use skills {n} times', d: 12 }, parry: { text: 'Parry {n} attacks', d: 3 },
  throws: { text: 'Throw {n} throwables', d: 4 }, ults: { text: 'Fire {n} ultimates', d: 2 }, walls: { text: 'Wall jump {n} times', d: 5 },
  orbs: { text: 'Grab {n} power-up orbs', d: 4 }, taunts: { text: 'Finish {n} safe taunts', d: 3 }, grabs: { text: 'Grab-throw {n} foes', d: 3 },
  heads: { text: 'Land {n} head hits', d: 8 }, rounds: { text: 'Win {n} rounds', d: 6 }, pets: { text: 'Let your pet help {n} times', d: 4 },
  minis: { text: 'Win {n} party mini-games', d: 1 },
};
const TASK_REWARD = { daily: { xp: 120, coins: 40 }, weekly: { xp: 400, coins: 150 } };
function taskRng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayKey = (d = new Date()) => ymd(d);
const weekKey = (d = new Date()) => ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7));   // that week's Monday
function taskDraw(seed, n, avoid = []) {
  const rng = taskRng(seed), keys = Object.keys(TASKS).filter(k => !avoid.includes(k)), out = [];
  while (out.length < n && keys.length) out.push(keys.splice(Math.floor(rng() * keys.length), 1)[0]);
  return out;
}
const taskNew = (k, weekly) => ({ k, n: 0, need: TASKS[k].d * (weekly ? 5 : 1), done: false });
function tasksNow() {
  const s = store.get('tasks', {}) || {}, day = dayKey(), wk = weekKey();
  let dirty = false;
  if (s.day !== day || !Array.isArray(s.daily)) { s.day = day; s.daily = taskDraw('d' + day, 3).map(k => taskNew(k, false)); dirty = true; }
  if (s.week !== wk || !Array.isArray(s.weekly)) { s.week = wk; s.weekly = taskDraw('w' + wk, 3).map(k => taskNew(k, true)); dirty = true; }
  if (dirty) store.set('tasks', s);
  return s;
}
const taskCanReroll = () => tasksNow().rerolled !== dayKey();
function taskReroll(i) {
  const s = tasksNow(), cur = s.daily[i];
  if (!cur || cur.done || !taskCanReroll()) return false;
  const [k] = taskDraw('r' + s.day + i, 1, s.daily.map(t => t.k));
  if (!k) return false;
  s.daily[i] = taskNew(k, false); s.rerolled = s.day;
  store.set('tasks', s);
  return true;
}
function taskBump(key, n = 1) {
  const s = tasksNow();
  let changed = false;
  for (const [list, kind] of [[s.daily, 'daily'], [s.weekly, 'weekly']]) for (const t of list) {
    if (t.k !== key || t.done) continue;
    t.n = Math.min(t.need, t.n + n); changed = true;
    if (t.n >= t.need) taskComplete(t, kind);
  }
  if (changed) store.set('tasks', s);
}
function taskComplete(t, kind) {
  t.done = true;
  const r = TASK_REWARD[kind];
  addCoins(r.coins);
  addXp(r.xp, 'quest');
  if (typeof toast === 'function') toast(`${capitalWord(kind)} quest done!`, `${taskText(t)}  +${r.xp} XP · +${r.coins} coins`, '📜', '#9dff5a');
  emit('taskDone', t, kind);
}
const capitalWord = s => s[0].toUpperCase() + s.slice(1);
const taskText = t => TASKS[t.k].text.replace('{n}', t.need);
// Event wiring: only real players in real matches.
const taskBy = (f, key, n) => { if (progReal() && isRealPlayer(f)) taskBump(key, n); };
on('hit', A => taskBy(A, 'hits'));
on('damage', (B, a, o) => { if (o && o.head && o.src) taskBy(o.src, 'heads'); });
on('ko', (V, K) => { if (K && V !== K && !V.summon) taskBy(K, 'kos'); });
on('skill', f => taskBy(f, 'skills'));
on('parry', B => taskBy(B, 'parry'));
on('throwable', f => taskBy(f, 'throws'));
on('ultimate', f => taskBy(f, 'ults'));
on('wallJump', f => taskBy(f, 'walls'));
on('orb', f => taskBy(f, 'orbs'));
on('throw', A => taskBy(A, 'grabs'));
on('tauntDone', f => taskBy(f, 'taunts'));
on('petUse', f => taskBy(f, 'pets'));
on('miniEnd', (k, f) => { if (f) taskBy(f, 'minis'); });
on('roundEnd', w => { if (progReal()) for (const f of F.filter(isRealPlayer)) if (f.team === w) taskBump('rounds'); });
on('matchOver', () => { if (!progReal()) return; taskBump('play'); if (MATCH_TRACK.reward && MATCH_TRACK.reward.won) taskBump('win'); });

// ---------- secrets and cheat codes ----------
// Codes are typed on the title screen. Feats unlock during play. Found secrets show in the codex; the rest are ???.
const SECRETS = {
  konami: { name: 'Retro Soul', code: '↑↑↓↓←→←→BA', hint: 'A very old code from very old games.', reward: 'Big Heads mutator + title',
    give() { lookGrant('title', 'retro'); } },
  cluck: { name: 'Rubber Chicken', code: 'CLUCK', hint: 'What does the chicken say?', reward: 'Secret weapon', give() { secretShow(WEAPONS, 'rubber-chicken'); } },
  shiny: { name: 'Prism Crown', code: 'SHINY', hint: 'Something that sparkles.', reward: 'Secret hat', give() { secretShow(HATS, 'prism'); } },
  boogie: { name: 'Disco Fever', code: 'BOOGIE', hint: 'Get down on the title screen.', reward: 'Secret K.O. effect', give() { secretShow(KOFX, 'disco'); lookGrant('ko', 'disco'); } },
  nightowl: { name: 'Night Owl', hint: 'Finish a match in the small hours.', reward: 'Title', give() { lookGrant('title', 'night-owl'); } },
  showoff: { name: 'Show-off', hint: 'Taunt safely three times in one match, then win it.', reward: 'Secret outfit',
    give() { secretShow(OUTFITS, 'jester'); lookGrant('outfit', 'jester'); } },
};
function secretShow(reg, key) { if (reg[key]) reg[key].hidden = false; }
const secretFound = key => !!PROG.secrets[key];
function secretUnlock(key) {
  const s = SECRETS[key];
  if (!s || secretFound(key)) return false;
  PROG.secrets[key] = Date.now();
  s.give();
  progSave();
  if (typeof uiSfx === 'function') uiSfx('unlock');
  if (typeof toast === 'function') toast('Secret found: ' + s.name, s.reward, '🗝', '#ff5ad1');
  emit('secret', key);
  return true;
}
on('boot', () => { for (const k in PROG.secrets) if (SECRETS[k]) SECRETS[k].give(); });
function secretFeats(won) {
  const h = new Date().getHours();
  if (h < 5) secretUnlock('nightowl');
  if (won && PROG_MATCH.taunts >= 3) secretUnlock('showoff');
}
// Title-screen typing: keeps the last keys and checks every code's ending.
const CHEAT = { buf: '' };
const CHEAT_KEYS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
function cheatKey(code) {
  const ch = CHEAT_KEYS[code] || (/^Key[A-Z]$/.test(code) ? code.slice(3) : '');
  if (!ch) return null;
  CHEAT.buf = (CHEAT.buf + ch).slice(-16);
  for (const k in SECRETS) if (SECRETS[k].code && CHEAT.buf.endsWith(SECRETS[k].code)) { CHEAT.buf = ''; return secretUnlock(k) ? k : null; }
  return null;
}

// The secret weapon and hat (hidden until their codes are typed).
defWeapon('rubber-chicken', {
  name: 'Rubber Chicken', cat: 'exotic', hidden: true, secret: true, order: 99, power: 1.1,   // secret: kept out of balance runs
  desc: 'Secret! A squeaky rubber chicken. Surprisingly heavy. Deeply embarrassing to lose to.',
  len: 58, mass: 1.05, dmg: 1.05, width: 9, kb: 1.2,
  ai: { range: 108, style: 'melee' },
  onHit(A, B) { if (chance(.3)) float(B.P[0].x, B.P[0].y - 30, 'SQUEAK!', '#ffe066', 16); },
  draw(ctx, f, s) {
    const k = s.k, body = s.at(s.L - 14 * k), head = s.at(s.L + 2 * k, -4 * k);
    line(ctx, s.at(-10 * k), s.at(s.L - 26 * k), '#ffd84a', 6 * k);
    hatEllipse(ctx, body.x, body.y, 16 * k, 10 * k, '#ffd84a', '#c79a1e', 1.5 * k, Math.atan2(s.uy, s.ux));
    circle(ctx, head.x, head.y, 7 * k, '#ffd84a', '#c79a1e', 1.5 * k);
    poly(ctx, [s.at(s.L + 8 * k, -6 * k), s.at(s.L + 16 * k, -3 * k), s.at(s.L + 8 * k, -1 * k)], '#ff8a2e');
    circle(ctx, s.at(s.L + 4 * k, -7 * k).x, s.at(s.L + 4 * k, -7 * k).y, 1.6 * k, '#0b0c18');
  },
});
defHat('prism', {
  name: 'Prism Crown', hidden: true, price: 0, order: 99,
  draw(ctx, f, h) {
    const r = h.r, y = -r * .75, t = hatT();
    ['#ff5ad1', '#ffd84a', '#5ef2ff', '#9dff5a', '#b98cff'].forEach((c, k) => {
      const x = (k - 2) * r * .4, tall = r * (.6 + .25 * Math.sin(t * 3 + k));
      poly(ctx, [[x - r * .2, y], [x, y - tall], [x + r * .2, y]], c, '#ffffff', h.scale);
    });
  },
});

// ---------- codex lore (short original lines, built from the entry's key) ----------
const LORE = {
  w: ['{n} was forged in the {p}.', 'Legend says the first {n} {d}.', 'Every {who} of the {p} knows the {n} by its hum.', 'The {n} turned up in a {o}.'],
  s: ['{n} was first taught in the {p}.', 'Masters of the {p} practise {n} at dawn.', 'A {who} once learned {n} from a {o}.'],
  c: ['The {n} school began in the {p}.', '{n}s train for years in the {p}.', 'Ask any {who}: a {n} never backs down.'],
  m: ['{n} sits at the edge of the {p}.', 'Duelists come to {n} from as far as the {p}.', 'Nobody remembers who built {n}. Some say a {who}.'],
  p: ['{n} hatched in a {o}.', 'A {who} from the {p} lost {n} once. It came back.', '{n} follows whoever shares their snacks.'],
};
const LORE_FILL = {
  p: ['Neon Foundry', 'Glass Dunes', 'Static Marsh', 'Ember Wastes', 'Frostspire', 'Wobble Hills', 'Sky Citadel', 'Shadow Depths'],
  d: ['split a thunderstorm in two', 'won a duel without touching the ground', 'wobbled a mountain flat', 'outlasted three champions in one night'],
  who: ['duelist', 'street brawler', 'old master', 'arena rookie', 'wandering bard'],
  o: ['meteor crater', 'scrapyard raffle', 'lost temple', 'vending machine at the end of the world', 'thunder egg'],
};
const LORE_END = ['It hums when a rival is near.', 'Its owners rarely stay humble.', 'Nobody agrees on who made it first.',
  'It has never lost a staring contest.', 'Handle with flair.', 'The crowds still chant about it.', 'It glows brightest at night.'];
function codexLore(kind, key, name) {
  const rng = taskRng(kind + key), pickR = a => a[Math.floor(rng() * a.length)];
  const line1 = pickR(LORE[kind] || LORE.w).replace(/\{(\w+)\}/g, (_, k) => (k === 'n' ? name : pickR(LORE_FILL[k])));
  return line1[0].toUpperCase() + line1.slice(1) + ' ' + pickR(LORE_END);
}

// ---------- fighter-creator presets ----------
const PRESET_MAX = 8;
const PRESET_FIELDS = ['color', 'hat', 'outfit', 'cls', 'weapon', 'skills', 'throws', 'skins', 'ko', 'pet', 'pose'];
const presetList = () => (store.get('presets', []) || []).filter(p => p && p.name).slice(0, PRESET_MAX);
function presetSave(name, lo, index = -1) {
  const list = presetList(), p = { name: String(name || 'Fighter').slice(0, 18) };
  for (const k of PRESET_FIELDS) if (lo[k] != null) p[k] = JSON.parse(JSON.stringify(lo[k]));
  if (index >= 0 && index < list.length) list[index] = p;
  else if (list.length < PRESET_MAX) list.push(p);
  else return false;
  store.set('presets', list);
  return true;
}
function presetApply(i, lo) {
  const p = presetList()[i];
  if (!p) return false;
  for (const k of PRESET_FIELDS) if (p[k] != null) lo[k] = JSON.parse(JSON.stringify(p[k]));
  lo.preset = p.name;
  return true;
}
function presetDelete(i) { const list = presetList(); list.splice(i, 1); store.set('presets', list); }
