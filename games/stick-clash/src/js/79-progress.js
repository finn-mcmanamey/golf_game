// 79-progress.js: titles, the look registries in one place, secrets + cheat codes, the codex stats and lore, and the
// fighter-creator presets. v4: every look and title is free from the start (no track, XP or quests); the secret ones
// stay hidden until their code or feat is found. Saved via store: 'prog' (title, found secrets, codex stats) and
// 'presets'. Only real (non-autopilot, non-demo, non-practice) matches count toward the codex.

const TITLES = {};
[['rookie', 'Rookie'], ['brawler', 'Brawler'], ['wobbler', 'Wobble Lord'], ['neon-ninja', 'Neon Ninja'], ['pet-whisperer', 'Pet Whisperer'],
  ['untouchable', 'Untouchable'], ['taunt-master', 'Taunt Master'], ['grand-duelist', 'Grand Duelist'], ['legend', 'Living Legend'],
  ['stick-legend', 'Stick Legend'], ['retro', 'Retro Soul', 1], ['night-owl', 'Night Owl', 1]]
  .forEach(([k, name, hidden]) => defLook(TITLES, k, { name, icon: '🏷', hidden: !!hidden }));

const LOOKS = { outfit: OUTFITS, skin: WSKINS, ko: KOFX, pet: PETS, pose: POSES, title: TITLES };
// A look can be worn when it exists and isn't a secret still waiting to be found.
const lookUsable = (kind, key) => { const d = LOOKS[kind] && LOOKS[kind][key]; return !!d && !d.hidden; };

const PROG = (() => {
  const p = store.getObj('prog'), obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  return { title: typeof p.title === 'string' ? p.title : 'rookie', secrets: obj(p.secrets), codex: obj(p.codex) };
})();
let progDirty = false;   // codex K.O. counters are bumped mid-round and saved at the round's end (or by flushSaves)
function progSave() { progDirty = false; store.set('prog', PROG); }
onFlush(() => { if (progDirty) progSave(); });

// ---------- codex stats and match feats ----------
const FEAT_MATCH = { taunts: 0, done: false };   // safe taunts this match (the Show-off secret)
const progReal = () => typeof statsOn === 'function' && statsOn();
on('matchStart', () => Object.assign(FEAT_MATCH, { taunts: 0, done: false }));
on('ko', (V, K) => { if (progReal() && isRealPlayer(K) && V !== K && !V.summon) codexKo(K); });
on('tauntDone', f => { if (progReal() && isRealPlayer(f)) FEAT_MATCH.taunts++; });
on('roundEnd', winner => { if (progReal()) for (const f of F.filter(isRealPlayer)) codexRound(f, f.team === winner); });
// Once per counted match: the boss codex rows and the feats that unlock secrets.
on('matchOver', () => {
  if (!progReal() || G_STATE.cfg.autopilot || FEAT_MATCH.done) return;
  FEAT_MATCH.done = true;
  const won = !!(recordMatch() || {}).won;
  codexBoss(won);
  secretFeats(won);
});

// Codex stats per entry: [uses, wins, K.O.s]. Kinds: w weapons, s skills, c classes, m arenas, p pets, b boss nodes.
function codexBump(kind, key, slot, n = 1) {
  if (!key) return;
  const t = PROG.codex[kind] = PROG.codex[kind] || {}, row = t[key] = t[key] || [0, 0, 0];
  row[slot] += n;
  progDirty = true;
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

// ---------- secrets and cheat codes ----------
// Codes are typed on the title screen. Feats unlock during play. Found secrets show in the codex; the rest are ???.
// Finding one un-hides its reward (a hidden def stays out of every menu until then).
const SECRETS = {
  konami: { name: 'Retro Soul', code: '↑↑↓↓←→←→BA', hint: 'A very old code from very old games.', reward: 'Big Heads mutator + title',
    give() { secretShow(TITLES, 'retro'); } },
  cluck: { name: 'Rubber Chicken', code: 'CLUCK', hint: 'What does the chicken say?', reward: 'Secret weapon', give() { secretShow(WEAPONS, 'rubber-chicken'); } },
  shiny: { name: 'Prism Crown', code: 'SHINY', hint: 'Something that sparkles.', reward: 'Secret hat', give() { secretShow(HATS, 'prism'); } },
  boogie: { name: 'Disco Fever', code: 'BOOGIE', hint: 'Get down on the title screen.', reward: 'Secret K.O. effect', give() { secretShow(KOFX, 'disco'); } },
  nightowl: { name: 'Night Owl', hint: 'Finish a match in the small hours.', reward: 'Title', give() { secretShow(TITLES, 'night-owl'); } },
  showoff: { name: 'Show-off', hint: 'Taunt safely three times in one match, then win it.', reward: 'Secret outfit',
    give() { secretShow(OUTFITS, 'jester'); } },
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
  if (won && FEAT_MATCH.taunts >= 3) secretUnlock('showoff');
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
// Typed code entry (the Codex's Secrets tab, for phones with no keyboard on the title screen): feeds letters and
// arrows through the same buffer and returns the key of the code it completed (unlocking it), or null.
function cheatEnter(text) {
  const typed = [...String(text || '').toUpperCase()].filter(ch => /[A-Z↑↓←→]/.test(ch)).join('');
  if (!typed) return null;
  CHEAT.buf = (CHEAT.buf + typed).slice(-16);
  for (const k in SECRETS) if (SECRETS[k].code && CHEAT.buf.endsWith(SECRETS[k].code)) { CHEAT.buf = ''; secretUnlock(k); return k; }
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
  name: 'Prism Crown', hidden: true, order: 99,
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
  'It has never lost a staring contest.', 'Handle with flair.', 'The crowds still chant about it.', 'It glows brightest at night.',
  'It looks better after a few dents.', 'Rookies borrow it. Champions get it back.', 'It was last seen winning a bet.', 'Spectators duck on instinct.'];
// Weapons also get a line about the kind of weapon they are, so a bow and a hammer don't read alike.
const LORE_CAT = {
  blade: ['A {n} is drawn fast and sheathed faster.', 'Smiths of the {p} test every {n} on a falling feather.', 'Duelists polish the {n} more than they polish their manners.'],
  heavy: ['It takes two hands and a bad attitude to swing the {n}.', 'The {n} is slow, loud and very hard to argue with.'],
  polearm: ['The {n} keeps trouble exactly one step away.', 'Guards of the {p} swear by the {n}: reach is respect.'],
  chain: ['The {n} never travels in a straight line.', 'Hear the {n} rattle and count your steps backward.'],
  fist: ['No handle, no excuses: the {n} is just you, louder.', 'Brawlers in the {p} wrap their knuckles in {n} lore.'],
  ranged: ['A good {n} shot is ninety percent patience.', 'Scouts of the {p} carry a {n} and a very long grudge.', 'The {n} is happiest when the target thinks it is out of range.'],
  magic: ['The {n} hums a note nobody can quite place.', 'Mages swear the {n} chose them, not the other way round.'],
  exotic: ['Nobody has a manual for the {n}. Nobody wants one.', 'The {n} is what happens when a blacksmith gets curious.'],
  shield: ['The {n} has never lost an argument, only gained dents.', 'Behind the {n}, even a rookie feels like a wall.'],
};
// The hand-written lines in 79-lore.js come first; the generator below covers anything added without a line.
// Seeded by the entry, so a generated line never changes between visits.
function loreRng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
function codexLore(kind, key, name, cat) {
  const t = typeof LORE_LINES === 'object' && LORE_LINES[kind] && LORE_LINES[kind][key];
  if (t) return t;
  const rng = loreRng(kind + key), pickR = a => a[Math.floor(rng() * a.length)];
  const pool = kind === 'w' && LORE_CAT[cat] && rng() < .7 ? LORE_CAT[cat] : LORE[kind] || LORE.w;
  const line1 = pickR(pool).replace(/\{(\w+)\}/g, (_, k) => (k === 'n' ? name : pickR(LORE_FILL[k])));
  return line1[0].toUpperCase() + line1.slice(1) + ' ' + pickR(LORE_END);
}

// ---------- fighter-creator presets ----------
const PRESET_MAX = 8;
const PRESET_FIELDS = ['color', 'hat', 'outfit', 'cls', 'weapon', 'skills', 'throws', 'skins', 'ko', 'pet', 'pose'];
const presetList = () => store.getArr('presets').filter(p => p && typeof p === 'object' && typeof p.name === 'string' && p.name).slice(0, PRESET_MAX);
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
