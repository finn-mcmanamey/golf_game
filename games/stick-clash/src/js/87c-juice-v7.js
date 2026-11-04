// 87c-juice-v7.js (v7 "juicier fights"): drawing, sound and callouts on top of 35-effects, 84-postfx and 87-juice.
// Nothing here changes a fight: the handlers skip SC.sim, the menu demo and the balance tools, never touch hp,
// velocity or the RNG (comic randomness comes from a private LCG), and only add hit-stop / slow-mo, which already
// freeze real-time play alone. Visual-only numbers kept on fighters (jzDizzy, jzFly, jzFire) are plain numbers, so the
// kill-cam snapshots them, and every timed effect goes through FX_RECORD, so replays show it in sync.
// - Impact tiers: light / HEAVY / CRUSHING hits differ in hit-stop, a camera kick along the blow, the flash shape
//   (a cross glint, then a comic starburst with speed lines and a zoom punch) and a sub thump under the hit sound.
// - Finishers: the round-winning K.O. gets a title (HOME RUN!, WIPEOUT!, SPLAT!, KABOOM!, SUPLEX!, CRUSHED!,
//   WHOOPS!) on the K.O. banner, a zoom punch, a stinger, the announcer and the crowd; the kill-cam's tag repeats it.
// - Streaks: rising combo ticks and a 3 HIT / 5 HIT / FRENZY / RAMPAGE ladder, multi-K.O.s, ON FIRE after three
//   round wins in a row (an aura until the streak breaks), COMEBACK from far behind on health or rounds.
// - Comic bodies: dizzy birds after crushing hits and long stuns, screams and flailing arcs in long flights, a squash
//   on hard landings, BOING on bounces, a 5% ghost that floats out of a K.O.'d body; CLOSE CALL! at 5 hp or less.
// SETTINGS.fightGags (Settings > Effects) turns the callouts and gags off; the impact tiers follow the Juice level,
// and reduced flashing (or the OS reduce-motion preference) skips every zoom, kick, starburst and speed line.

if (!('fightGags' in SETTING_DEFAULTS)) SETTING_DEFAULTS.fightGags = true;
if (!('fightGags' in SETTINGS)) SETTINGS.fightGags = true;

const JZ = { clock: 0, seed: 7, kx: 0, ky: 0, bursts: [], words: [], ghosts: [], decals: [], stars: [], stickers: [],
  close: new Set(), combo: new Map(), multi: new Map(), lastTier: new Map(), prevVy: new WeakMap(), gap: {}, rgap: {},
  streak: {}, finish: null, forceGhost: false, log: [] };

// ---------- gates ----------
const jzLive = () => !G_STATE.sim && !G_STATE.demo;
const jzGags = () => SETTINGS.fightGags !== false;
// 0 with reduced flashing / OS reduce motion (no zooms, kicks or flashes), else the juice level's shake scale.
const jzMotion = () => (SETTINGS.reduceFlash || (BANNER_CALM && BANNER_CALM.matches)) ? 0 : fxJuice().shake;
// A private random stream so visual variety never moves the game's (possibly seeded) Math.random.
function jzRand() { JZ.seed = (Math.imul(JZ.seed, 1664525) + 1013904223) >>> 0; return JZ.seed / 4294967296; }
const jzPick = list => list[Math.floor(jzRand() * list.length)];
// Test log of what fired (kind:detail), kept short.
function jzLog(s) { JZ.log.push(s); if (JZ.log.length > 80) JZ.log.shift(); }
// Ink and paper arenas are light: comic lines are drawn dark there, light everywhere else.
const jzInk = () => !!ART.style && (ART.style.key === 'ink' || ART.style.key === 'paper');
const jzPlayer = f => !!f && f.ctrl === 'human' && !f.autopilot;
// Sound from a recorded effect: the kill-cam already replays the recorded sfx, so a replayed effect stays quiet.
const jzSfx = (name, vol) => { if (typeof KC === 'undefined' || !KC.play) sfx(name, vol); };

// ---------- sounds (all synthesized, silent without WebAudio) ----------
const JZ_SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
defSfx('jz-thump', v => { thump(96, 36, .24, .55 * v); noise(.05, 2600, .1 * v); });
defSfx('jz-crush', v => {
  thump(72, 24, .5, .85 * v); tone(170, 42, .28, 'square', .07 * v);
  noiseSweep(.32, 3200, 260, .32 * v, 'lowpass'); noise(.04, 4200, .18 * v, 'highpass');
});
// sfx('jz-combo:n'): a tick that climbs a major scale with each hit of a streak.
defSfx('jz-combo', (v, n) => {
  const f = 520 * Math.pow(2, JZ_SCALE[clamp((+n || 2) - 2, 0, JZ_SCALE.length - 1)] / 12);
  tone(f, f * 1.01, .09, 'triangle', .13 * v); tone(f * 2, f * 2, .05, 'sine', .05 * v);
});
defSfx('jz-finish', v => {
  noiseSweep(.55, 300, 6400, .16 * v, 'bandpass', 0, 1.5); thump(84, 28, .8, .8 * v, .04);
  tone(220, 880, .32, 'sawtooth', .05 * v); tone(110, 55, .7, 'sawtooth', .05 * v, .3);
});
defSfx('jz-boing', v => { tone(150, 560, .1, 'sine', .32 * v); tone(560, 230, .34, 'triangle', .2 * v, .09); });
defSfx('jz-ghost', v => {
  tone(700, 330, 1, 'sine', .1 * v); tone(707, 334, 1, 'sine', .08 * v, .04);   // two detuned voices waver: "wooo"
  for (const [k, f] of [523, 659, 784, 1047].entries()) tone(f, f, .5, 'triangle', .05 * v, .1 + k * .08);   // harp
});
defSfx('jz-ding', v => { tone(1760, 1760, .5, 'sine', .14 * v, .3); tone(2637, 2637, .4, 'sine', .07 * v, .36); });
defSfx('jz-pop', v => { noiseSweep(.12, 1200, 5200, .09 * v, 'bandpass', 0, 2); tone(660, 990, .08, 'square', .035 * v); });
defSfx('jz-splat', v => { noise(.2, 520, .4 * v, 'lowpass'); tone(320, 70, .16, 'sine', .3 * v); });
defSfx('jz-fire', v => { noiseSweep(.9, 180, 2400, .22 * v, 'lowpass', 0, 2); tone(196, 392, .5, 'sawtooth', .04 * v); });

// ---------- impact tiers ----------
// 1 light, 2 HEAVY, 3 CRUSHING (the biggest blows, grab throws, ultimates and heavy K.O. blows).
function jzTier(B, amt, o) {
  const A = o.src;
  if (o.throw || amt >= 20 || (A && A.ult && amt >= 10) || (B.hp <= 0 && amt >= 15)) return 3;
  return amt >= 12 ? 2 : 1;
}
const JZ_WORDS = { melee: ['WHAM!', 'KRAK!', 'SMASH!', 'THWACK!'], proj: ['BLAM!', 'POW!'], explode: ['KA-BOOM!'],
  skill: ['ZAP!', 'WHAM!'], throw: ['SUPLEX!', 'THUD!'] };

on('damage', (B, amt, o) => {
  if (!jzLive() || !o) return;
  jzCloseCall(B, amt);
  jzTrackGap(B);
  if (!juiceDirect(o) || o.small || B.summon) return;
  const tier = jzTier(B, amt, o);
  JZ.lastTier.set(B.id, tier);
  if (o.src && o.src !== B) jzComboStep(o.src);
  if (tier < 2) return;
  const c = chest(B), x = o.x ?? c.x, y = o.y ?? c.y;
  let nx = o.nx || 0, ny = o.ny || 0;
  if (!nx && !ny && o.src) { const s = chest(o.src); nx = c.x - s.x; ny = c.y - s.y; }
  const L = Math.hypot(nx, ny) || 1;
  const word = tier === 3 && jzGags() ? jzPick(JZ_WORDS[o.throw ? 'throw' : o.kind] || JZ_WORDS.melee) : '';
  jzImpact(x, y, nx / L, ny / L, tier, hitColor(B), word);
  const ko = B.hp <= 0;
  // Crushing blows freeze at least 100 ms (throws and ultimates deal little damage); 30's hit-stop covers the rest,
  // so the v4 feel contract (heavy hits 60-120 ms) holds. Real time only.
  if (tier === 3) hitstop(Math.max(.1, hitstopFor(amt, ko && !B.summon, ko && koDecides(B))));
  if (tier === 3 && B.hp > 0) B.jzDizzy = G_STATE.t + 1.7;
});

// The impact itself (recorded, so the kill-cam replays it): kick, flash shape, speed lines, word, sound.
function jzImpact(x, y, nx, ny, tier, color, word) {
  if (G_STATE.sim) return;
  if (FX_RECORD) FX_RECORD('jzImpact', arguments);
  const m = jzMotion(), crush = tier === 3;
  jzLog(crush ? 'tier:crushing' : 'tier:heavy');
  jzSfx(crush ? 'jz-crush' : 'jz-thump', crush ? 1 : .8);
  if (m > 0) {
    const kick = (crush ? 15 : 6) * m;
    JZ.kx = nx * kick; JZ.ky = ny * kick;
    if (crush) CAM.punch = Math.max(CAM.punch || 0, .1 * Math.min(m, 1.2));
    JZ.bursts.push({ x, y, a: Math.atan2(ny, nx), color, tier, t0: G_STATE.t, life: crush ? .34 : .11, spin: jzRand() * TAU });
    if (JZ.bursts.length > 12) JZ.bursts.shift();
  }
  if (word) jzWord(x + nx * 30, y - 46, word, '#ffe14a', 30, 'burst');
}

// A comic word in the world (onomatopoeia, BOING, CLOSE CALL...). style 'burst' sits on a jagged speech burst.
function jzWord(x, y, text, color, size, style = 'plain', life = .8) {
  if (G_STATE.sim || G_STATE.demo) return;
  if (FX_RECORD) FX_RECORD('jzWord', arguments);
  JZ.words.push({ x, y, text, color, size, style, life, t0: G_STATE.t, rot: (jzRand() - .5) * .35 });
  if (JZ.words.length > 8) JZ.words.shift();
}

// ---------- combos, streaks and callouts ----------
const JZ_LADDER = { 3: ['3 HIT!', '#9dff5a'], 5: ['5 HIT!', '#2ee6ff'], 8: ['FRENZY!', '#ff9a2e'], 12: ['RAMPAGE!', '#ff3d6a'],
  16: ['UNSTOPPABLE!', '#ff5ad1'] };
// Called on each direct hit: a rising tick per new combo step and a sticker at each rung of the ladder.
function jzComboStep(A) {
  const n = A.comboT > 0 ? A.combo : 0, last = JZ.combo.get(A.id) || 0;
  JZ.combo.set(A.id, n);
  if (n <= last || n < 2) return;
  sfx('jz-combo:' + Math.min(n, 13), .5);
  const rung = JZ_LADDER[n];
  if (!rung || !jzGags()) return;
  const crowd = F.filter(f => !f.summon).length > 2;
  if (crowd && !jzPlayer(A) && n < 8) return;   // busy brawls: only the big rungs from CPUs
  jzSticker(rung[0], rung[1], jzSide(A), A.name, 'combo' + A.id);
  if (n >= 8) { crowdReact('roar', .7, .3); if (jzPlayer(A) || F.some(jzPlayer)) announce(n >= 12 ? 'Rampage!' : 'Frenzy!', 1); }
}

// Which screen side a fighter's stickers go to: by team in two-team fights (P1's card is on the left), else by place.
function jzSide(f) {
  if (G_STATE.teams === 2) return f.team === 0 ? -1 : 1;
  return chest(f).x < W / 2 ? -1 : 1;
}

// A slanted callout under the HUD on one side of the screen (recorded: the kill-cam shows it again).
function jzSticker(text, color, side, sub = '', key = '') {
  if (G_STATE.sim || G_STATE.demo) return;
  if (FX_RECORD) FX_RECORD('jzSticker', arguments);
  jzLog('callout:' + text);
  if (key) JZ.stickers = JZ.stickers.filter(s => s.key !== key);   // a ladder rung replaces the one below it
  const same = JZ.stickers.filter(s => s.side === side);
  if (same.length >= 3) JZ.stickers.splice(JZ.stickers.indexOf(same[0]), 1);
  JZ.stickers.push({ text, color, side, sub, key, t0: JZ.clock, life: 1.5 });
  jzSfx('jz-pop', .7);
}

// Multi-K.O.s by one fighter within 3 s, the round-winning finisher and the ghost gag.
on('ko', (v, k, o) => {
  if (!jzLive() || v.summon) return;
  if (k && k !== v && k.team !== v.team && jzGags()) {
    const m = JZ.multi.get(k.id), now = G_STATE.t, n = m && now - m.t < 3 ? m.n + 1 : 1;
    JZ.multi.set(k.id, { n, t: now });
    if (n >= 2) { jzSticker(n === 2 ? 'DOUBLE K.O.!' : n === 3 ? 'TRIPLE K.O.!' : 'MEGA K.O.!', '#ffd84a', jzSide(k), k.name); crowdReact('roar', .8, .3); }
  }
  const c = chest(v);
  if (o && o.kind !== 'ringout' && jzGags() && (JZ.forceGhost || jzGhostRoll(v))) jzGhost(c.x, c.y, v.color, v.scale);
  if (koDecides(v)) jzFinisher(v, k, o || {});
});

// 5% of K.O.s, from a hash of who, which round and when (no Math.random).
function jzGhostRoll(v) {
  const h = Math.imul((v.id + 1) * 2654435761 ^ G_STATE.round * 40503 ^ Math.floor(G_STATE.t * 7), 2246822519) >>> 0;
  return h % 100 < 5;
}
function jzGhost(x, y, color, scale) {
  if (G_STATE.sim) return;
  if (FX_RECORD) FX_RECORD('jzGhost', arguments);
  jzLog('gag:ghost');
  JZ.ghosts.push({ x, y, color, scale, t0: G_STATE.t, life: 2.6 });
  jzSfx('jz-ghost', .8);
}

// ---------- finishers ----------
const JZ_FINISH = {
  home: ['HOME RUN!', '#ffd84a', 'Home run!'], wipe: ['WIPEOUT!', '#4ad8ff', 'Wipeout!'], splat: ['SPLAT!', '#ff5ad1', 'Splat!'],
  boom: ['KABOOM!', '#ff9a2e', 'Kaboom!'], suplex: ['SUPLEX!', '#b98cff', 'Suplex!'], crush: ['CRUSHED!', '#ff3d3d', 'Crushed!'],
  oops: ['WHOOPS!', '#9dff5a', 'Whoops!'], ko: ['K.O.', null, ''],
};
// How the deciding blow landed: flown off the side fast, fallen off, against a wall, blown up, thrown, crushed...
function jzFinishKind(v, o) {
  const hip = v.P[2], sp = Math.hypot(vx(hip), vy(hip));
  if (o.kind === 'ringout') return (hip.x < -150 || hip.x > W + 150 || hip.y < 0) && sp > 700 ? 'home' : 'wipe';
  if (o.throw) return 'suplex';
  if (o.kind === 'explode') return 'boom';
  if (jzWallX(v) != null) return 'splat';
  if (o.kind === 'hazard' || o.kind === 'status') return 'oops';
  return JZ.lastTier.get(v.id) === 3 ? 'crush' : 'ko';
}

// The x of a wall (arena side or a solid block's side) the body is pressed against, or null.
function jzWallX(v) {
  const c = chest(v);
  if (MAP.walls !== false && (c.x < 60 || c.x > W - 60)) return c.x < W / 2 ? 0 : W;
  for (const s of MAP.solids) {
    if (s.oneWay || s.h < 40 || c.y < s.y - 10 || c.y > s.y + s.h + 10) continue;
    if (Math.abs(c.x - s.x) < 40) return s.x;
    if (Math.abs(c.x - s.x - s.w) < 40) return s.x + s.w;
  }
  return null;
}

function jzFinisher(v, k, o) {
  const kind = jzFinishKind(v, o), c = chest(v), m = jzMotion();
  JZ.finish = { kind, victim: v };
  jzLog('finisher:' + kind);
  sfx('jz-finish', 1);
  if (m > 0) {
    CAM.punch = Math.max(CAM.punch || 0, .16 * Math.min(m, 1.2));
    JZ.bursts.push({ x: c.x, y: c.y, a: 0, color: v.color, tier: 4, t0: G_STATE.t, life: .7, spin: jzRand() * TAU });
  }
  if (!jzGags()) return;
  if (kind === 'splat') jzSplat(jzWallX(v), c.y, v.color);
  if (kind === 'home') jzTwinkle(c.x, c.y);
  if (kind === 'home') crowdReact('roar', 1.1, .6);
  if (kind === 'splat' || kind === 'crush' || kind === 'suplex') crowdReact('ooh', 1, .3);
}

// A paint splat of the loser's colour left on the wall (fades after a few seconds).
function jzSplat(x, y, color) {
  if (G_STATE.sim) return;
  if (FX_RECORD) FX_RECORD('jzSplat', arguments);
  const blobs = [];
  for (let k = 0; k < 8; k++) blobs.push([(jzRand() - .5) * 46, (jzRand() - .5) * 60, 8 + jzRand() * 16, jzRand() * 40]);
  JZ.decals.push({ x, y, color, blobs, t0: G_STATE.t, life: 4.5 });
  if (JZ.decals.length > 6) JZ.decals.shift();
  jzSfx('jz-splat', 1);
}

// A home run leaves a twinkling star where the body left the screen, with a "ding".
function jzTwinkle(x, y) {
  if (G_STATE.sim) return;
  if (FX_RECORD) FX_RECORD('jzTwinkle', arguments);
  const [x0, x1] = floatViewX();
  JZ.stars.push({ x: clamp(x, x0 + 50, x1 - 50), y: clamp(y, 70, H - 90), t0: G_STATE.t + .35, life: 1.4 });
  jzSfx('jz-ding', 1);
}

on('roundEnd', (winner, reason) => {
  if (!jzLive()) return;
  const fin = JZ.finish, def = fin && JZ_FINISH[fin.kind];
  JZ.finish = null;
  if (reason === 'ko' && def && def[1] && jzGags()) {
    if (BANNER && BANNER.a === 'K.O.') { BANNER.a = def[0]; BANNER.color = def[1]; BANNER.fit = null; }
    if (typeof KC !== 'undefined' && KC.lastKO) KC.lastKO.jzFinish = def;   // the kill-cam's tag (88) repeats the title
    announce(def[2], 3);
  }
  jzStreaks(winner, reason);
});

// ON FIRE after three round wins in a row, STREAK BROKEN when it ends, COMEBACK from far behind.
function jzStreaks(winner, reason) {
  const won = winner >= 0 && (reason === 'ko' || reason === 'time' || reason === 'zone');
  const broke = won && Object.keys(JZ.streak).some(t => +t !== winner && JZ.streak[t] >= 3);
  for (const t in JZ.streak) if (+t !== winner) JZ.streak[t] = 0;
  if (!won) return;
  const n = JZ.streak[winner] = (JZ.streak[winner] || 0) + 1, team = F.filter(f => f.team === winner && !f.summon);
  const lead = team[0], side = lead ? jzSide(lead) : 0, gags = jzGags();
  jzRoundGap();
  const sc = G_STATE.score, ws = G_STATE.winScore, matchWin = ws >= 2 && ws < 50 && sc[winner] >= ws;
  if (gags && (JZ.gap[winner] >= .5 || (matchWin && JZ.rgap[winner] >= 2))) {
    jzSticker('COMEBACK!', '#9dff5a', side, JZ.rgap[winner] >= 2 && matchWin ? 'FROM ' + JZ.rgap[winner] + ' ROUNDS DOWN' : 'FROM THE BRINK');
    crowdReact('roar', 1.1, .6); announce('What a comeback!', 3);
  }
  if (broke && gags) jzSticker('STREAK BROKEN!', '#2ee6ff', side);
  if (n === 3 && gags) {
    jzSticker('ON FIRE!', '#ff7a2e', side, lead ? lead.name : '');
    sfx('jz-fire', 1); crowdReact('roar', 1, .5); announce('On fire!', 2);
  }
  if (n >= 3) for (const f of team) f.jzFire = 1;
}

// Health gap: how far each team has fallen behind the best other team this round (1 = full hp vs none).
function jzTeamFrac(t) {
  const m = F.filter(f => f.team === t && !f.summon);
  return m.length ? m.reduce((s, f) => s + (f.alive ? f.hp / f.maxHp : 0), 0) / m.length : null;
}
function jzTrackGap(B) {
  if (B.summon || !G_STATE.teams) return;
  const own = jzTeamFrac(B.team);
  let best = 0;
  for (let t = 0; t < G_STATE.teams; t++) if (t !== B.team) best = Math.max(best, jzTeamFrac(t) || 0);
  if (own != null) JZ.gap[B.team] = Math.max(JZ.gap[B.team] || 0, best - own);
}
// Round gap: the most rounds each team has trailed by this match.
function jzRoundGap() {
  const sc = G_STATE.score;
  sc.forEach((s, t) => { const other = Math.max(...sc.filter((_, u) => u !== t)); JZ.rgap[t] = Math.max(JZ.rgap[t] || 0, other - s); });
}

// CLOSE CALL! the moment a hit leaves someone on 5 hp or less (once a round each): a gasp and a heartbeat of slow-mo.
function jzCloseCall(B, amt) {
  if (B.summon || !B.alive || B.hp <= 0 || B.hp > 5 || B.hp + amt <= 5 || JZ.close.has(B.id) || G_STATE.ending) return;
  JZ.close.add(B.id);
  jzLog('callout:CLOSE CALL!');
  if (jzGags()) jzWord(B.P[0].x, B.P[0].y - 60 * B.scale, 'CLOSE CALL!', '#ffffff', 26, 'plain', 1.1);
  crowdReact('gasp', 1, .3);
  if (jzMotion() > 0) slowmo(.3, .45);
}

// Long stuns make a fighter dizzy too (stars already orbit; the birds join in).
on('status', (f, name, secs) => {
  if (jzLive() && name === 'stun' && secs >= 1 && !f.summon) { f.jzDizzy = Math.max(f.jzDizzy || 0, G_STATE.t + Math.min(secs, 2.5)); jzLog('gag:dizzy'); }
});

on('roundStart', () => {
  JZ.close.clear(); JZ.combo.clear(); JZ.multi.clear(); JZ.lastTier.clear(); JZ.gap = {}; JZ.finish = null;
  jzClear();
  for (const f of F) if (!f.summon && (JZ.streak[f.team] || 0) >= 3) f.jzFire = 1;   // the aura carries into the round
});
on('matchStart', () => { JZ.streak = {}; JZ.rgap = {}; JZ.stickers.length = 0; });
on('state', (now, before) => { if (now === 'killcam' || before === 'killcam') jzClear(); });
function jzClear() { JZ.bursts.length = JZ.words.length = JZ.ghosts.length = JZ.decals.length = JZ.stars.length = 0; JZ.kx = JZ.ky = 0; }

// ---------- per-frame body gags (drawing state only) ----------
// Flight time for screams, bounce detection for BOING, a squash on hard landings.
function jzBodies(dt) {
  for (const f of F) {
    if (!f.alive || f.summon) continue;
    const hip = f.P[2], v = vy(hip), sp = Math.hypot(vx(hip), v);
    // A flight starts with a fast launch from a recent hit and lasts until the body touches down.
    const launched = f.jzFly > 0 || (sp > 750 && G_STATE.t - (f.lastHitT || -9) < .4);
    f.jzFly = !f.grounded && !f.heldBy && launched ? (f.jzFly || 0) + dt : 0;
    const prev = JZ.prevVy.get(f);
    JZ.prevVy.set(f, v);
    if (prev > 650 && v < -450 && !(f.flash > 0) && G_STATE.t - (f.jzBoingT || -9) > .5) {
      f.jzBoingT = G_STATE.t;
      jzLog('gag:boing');
      if (jzGags()) jzWord(hip.x, feetY(f) - 10, 'BOING!', '#ff8ce0', 24);
      sfx('jz-boing', .8);
      jzSquash(f.id, -.16);
    }
  }
}

// Squash (k > 0) or stretch (k < 0) the body through 84's squash-and-stretch (recorded for the kill-cam).
function jzSquash(id, k) {
  if (G_STATE.sim || jzMotion() <= 0) return;
  if (FX_RECORD) FX_RECORD('jzSquash', arguments);
  PFX.squash.set(id, { t0: G_STATE.t, nx: 0, ny: 1, k });
}

// 87's landing check, plus a squash for the hard ones.
const jzBaseLanding = juiceCheckLanding;
juiceCheckLanding = function (f) {
  const st = JUICE.land.get(f);
  if (st && st.air && f.grounded && f.alive && st.vy > 900) { jzSquash(f.id, clamp((st.vy - 900) / 2400, .08, .2)); jzLog('gag:squash'); }
  jzBaseLanding(f);
};

// ---------- drawing ----------
// Behind the fighters: speed lines, impact starbursts and cross glints, wall splats.
const jzBaseWorld = juiceDrawWorld;
juiceDrawWorld = function (c2, dt) {
  jzBaseWorld(c2, dt);
  if (dt > 0 && (G_STATE.state === 'play' || G_STATE.state === 'menu') && !G_STATE.sim) jzBodies(dt);
  const now = G_STATE.t;
  fxCompact(JZ.bursts, b => now - b.t0 < b.life && b.t0 <= now + 1e-6);
  fxCompact(JZ.decals, d => now - d.t0 < d.life && d.t0 <= now + 1e-6);
  if (!JZ.bursts.length && !JZ.decals.length) return;
  c2.save();
  for (const d of JZ.decals) jzDrawSplat(c2, d, now - d.t0);
  for (const b of JZ.bursts) {
    const k = (now - b.t0) / b.life;
    if (b.tier >= 3) jzSpeedLines(c2, b, k);
    if (b.tier === 3) jzStarburst(c2, b, k);
    if (b.tier === 2) jzGlint(c2, b, k);
  }
  c2.restore();
};

// Manga focus lines rushing in at the blow (finishers get more, longer ones).
function jzSpeedLines(c2, b, k) {
  const n = b.tier === 4 ? 30 : 20, ink = jzInk();
  c2.globalAlpha = (1 - k) * (ink ? .5 : .4);
  c2.fillStyle = ink ? '#1a1420' : '#ffffff';
  c2.beginPath();
  for (let i = 0; i < n; i++) {
    const a = b.spin + i / n * TAU + Math.sin(i * 12.9898) * .08, r0 = 90 + (i % 3) * 34 + k * 60, r1 = 1100, w = .012 + (i % 2) * .01;
    c2.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0);
    c2.lineTo(b.x + Math.cos(a - w) * r1, b.y + Math.sin(a - w) * r1);
    c2.lineTo(b.x + Math.cos(a + w) * r1, b.y + Math.sin(a + w) * r1);
  }
  c2.fill();
  c2.globalAlpha = 1;
}

// A jagged comic starburst: the "impact frame" of a crushing hit.
function jzStarburst(c2, b, k) {
  const r = (34 + 46 * Math.min(1, k * 4)) * (1 - k * .3), n = 12;
  c2.globalAlpha = k < .5 ? 1 : 1 - (k - .5) * 2;
  c2.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = b.spin + i / (n * 2) * TAU, rr = i % 2 ? r * .5 : r * (.85 + .3 * Math.abs(Math.sin(i * 7.31)));
    i ? c2.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr) : c2.moveTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr);
  }
  c2.closePath();
  c2.fillStyle = '#fff6c8'; c2.fill();
  c2.lineWidth = 4; c2.strokeStyle = b.color; c2.lineJoin = 'miter'; c2.stroke();
  c2.globalAlpha = 1;
}

// A heavy hit's glint: a thin four-point star along the blow.
function jzGlint(c2, b, k) {
  const len = 70 * (1 - k * .4), wid = 7 * (1 - k);
  c2.save(); c2.translate(b.x, b.y); c2.rotate(b.a);
  c2.globalAlpha = 1 - k; c2.fillStyle = jzInk() ? b.color : '#ffffff';
  for (const [l, w] of [[len, wid], [wid, len * .55]]) {
    c2.beginPath(); c2.moveTo(-l, 0); c2.lineTo(0, -w); c2.lineTo(l, 0); c2.lineTo(0, w); c2.closePath(); c2.fill();
  }
  c2.restore();
}

function jzDrawSplat(c2, d, age) {
  c2.globalAlpha = clamp((d.life - age) / 1.2, 0, 1) * .85;
  c2.fillStyle = d.color;
  c2.beginPath();
  for (const [dx, dy, r, drip] of d.blobs) {
    const x = d.x + dx * .6, y = d.y + dy;
    c2.moveTo(x + r, y); c2.arc(x, y, r, 0, TAU);
    const len = Math.min(drip, age * 30);   // paint runs down the wall
    c2.rect(x - 2.5, y, 5, len); c2.moveTo(x + 4, y + len); c2.arc(x, y + len, 4, 0, TAU);
  }
  c2.fill();
  c2.globalAlpha = 1;
}

// After the fighters: comic words, the ghost and the home-run twinkle.
const jzBaseShatter = shatterDraw;
shatterDraw = function (c2) {
  jzBaseShatter(c2);
  const now = G_STATE.t;
  for (const k of ['words', 'ghosts', 'stars']) fxCompact(JZ[k], e => now - e.t0 < e.life && e.t0 <= now + 3);
  if (!JZ.words.length && !JZ.ghosts.length && !JZ.stars.length) return;
  c2.save();
  for (const g of JZ.ghosts) jzDrawGhost(c2, g, now - g.t0);
  for (const s of JZ.stars) if (now >= s.t0) jzDrawTwinkle(c2, s, now - s.t0);
  const view = floatViewX();
  for (const w of JZ.words) if (now >= w.t0) jzDrawWord(c2, w, (now - w.t0) / w.life, view);
  c2.restore();
};

function jzDrawWord(c2, w, k, view) {
  const pop = k < .12 ? .6 + k / .12 * .6 : k < .22 ? 1.2 - (k - .12) * 2 : 1, size = w.size * pop;
  c2.font = `${Math.round(size)}px ${FONT_DISPLAY}`;
  const half = c2.measureText(w.text).width / 2 + 14, x = clamp(w.x, view[0] + half, Math.max(view[0] + half, view[1] - half));
  const y = w.y - k * 24;
  c2.save(); c2.translate(x, y); c2.rotate(w.rot);
  c2.globalAlpha = k > .75 ? (1 - k) / .25 : 1;
  if (w.style === 'burst') {   // a jagged speech burst behind the word
    c2.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * TAU, r = i % 2 ? .78 : 1;
      c2.lineTo(Math.cos(a) * (half + 8) * r, Math.sin(a) * size * .95 * r);
    }
    c2.closePath(); c2.fillStyle = '#1a0f22'; c2.fill();
    c2.lineWidth = 3; c2.strokeStyle = w.color; c2.stroke();
  }
  c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.lineJoin = 'round';
  c2.lineWidth = 6; c2.strokeStyle = '#07080f'; c2.strokeText(w.text, 0, 1);
  c2.fillStyle = w.color; c2.fillText(w.text, 0, 1);
  c2.restore();
}

// A little sheet ghost with cross eyes and a halo floats up out of the body, waving goodbye.
function jzDrawGhost(c2, g, age) {
  const k = age / g.life, s = g.scale, x = g.x + Math.sin(age * 3) * 14 * s, y = g.y - 20 - age * 70 * s;
  c2.save(); c2.translate(x, y); c2.scale(s, s);
  c2.globalAlpha = (k < .1 ? k / .1 : k > .7 ? (1 - k) / .3 : 1) * .85;
  c2.beginPath(); c2.moveTo(-16, 18); c2.lineTo(-16, -4); c2.arc(0, -4, 16, Math.PI, 0); c2.lineTo(16, 18);
  for (let i = 0; i < 4; i++) c2.quadraticCurveTo(12 - i * 8, 10 + (i % 2 ? 8 : -2) + Math.sin(age * 9 + i) * 3, 8 - i * 8, 18);
  c2.closePath(); c2.fillStyle = '#f4f6ff'; c2.fill(); c2.lineWidth = 2.5; c2.strokeStyle = g.color; c2.stroke();
  c2.strokeStyle = '#1a1420'; c2.lineWidth = 2;   // x x eyes
  for (const ex of [-6, 6]) { c2.beginPath(); c2.moveTo(ex - 3, -7); c2.lineTo(ex + 3, -1); c2.moveTo(ex + 3, -7); c2.lineTo(ex - 3, -1); c2.stroke(); }
  c2.lineWidth = 2.5; c2.strokeStyle = '#ffd84a';   // halo
  c2.beginPath(); c2.ellipse(0, -26, 11, 3.5, 0, 0, TAU); c2.stroke();
  const wave = Math.sin(age * 10) * .5;   // the waving hand
  c2.strokeStyle = g.color; c2.beginPath(); c2.moveTo(15, 2); c2.lineTo(15 + Math.cos(-.9 + wave) * 12, 2 + Math.sin(-.9 + wave) * 12); c2.stroke();
  c2.restore();
}

function jzDrawTwinkle(c2, s, age) {
  const k = age / s.life, r = 26 * (k < .2 ? k / .2 : 1 - (k - .2) / .8) + 4;
  c2.save(); c2.translate(s.x, s.y); c2.rotate(age * 4);
  c2.globalAlpha = clamp(1 - k, 0, 1); c2.fillStyle = '#fff6b0';
  c2.beginPath();
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? r * .28 : r; c2.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c2.closePath(); c2.fill(); c2.strokeStyle = '#ffd84a'; c2.lineWidth = 2; c2.stroke();
  c2.restore();
}

// On each fighter (inside its transform, after the body): dizzy birds, flight screams, frenzy and on-fire flames.
const jzBaseOver = drawFighterOver;
drawFighterOver = function (f) {
  jzBaseOver(f);
  if (!f.alive || !jzGags() || G_STATE.demo) return;
  const t = G_STATE.t;
  if (f.jzFire) jzFlames(f, t, '#ff7a2e', '#ffe14a', 1);
  if (f.combo >= 8 && f.comboT > 0) jzFlames(f, t, f.color, '#ffffff', .7);
  if (f.jzDizzy > t) jzDizzyBirds(f, t, f.jzDizzy - t);
  if (f.jzFly > .25) jzScream(f, f.jzFly);
};

// Flickering flame tongues licking up from the head, shoulders and hands.
function jzFlames(f, t, outer, inner, a) {
  const sc = f.scale;
  ctx.save(); ctx.globalAlpha *= a * .75;
  for (const [j, k] of [[0, 1.3], [1, 1], [2, .8], [4, .7], [6, .7]]) {
    const p = f.P[j];
    if (!p) continue;
    for (const [col, m] of [[outer, 1], [inner, .5]]) {
      const h = (26 + 10 * Math.sin(t * 17 + j * 3)) * k * m * sc, w = 9 * k * m * sc, sway = Math.sin(t * 11 + j) * 4 * sc;
      ctx.fillStyle = col; ctx.beginPath();
      ctx.moveTo(p.x - w, p.y - (j ? 0 : HEAD_R * sc * .6));
      ctx.quadraticCurveTo(p.x - w * .4 + sway, p.y - h * .6, p.x + sway * 1.5, p.y - h - (j ? 0 : HEAD_R * sc));
      ctx.quadraticCurveTo(p.x + w * .4 + sway, p.y - h * .6, p.x + w, p.y - (j ? 0 : HEAD_R * sc * .6));
      ctx.fill();
    }
  }
  ctx.restore();
}

// Two cartoon birds and a star circling the head of a dizzy fighter.
function jzDizzyBirds(f, t, left) {
  const head = f.P[0], sc = f.scale * (f.headMul || 1), fade = clamp(left / .3, 0, 1);
  ctx.save(); ctx.globalAlpha *= fade;
  for (let i = 0; i < 3; i++) {
    const a = t * 4.2 + i * TAU / 3, x = head.x + Math.cos(a) * 24 * sc, y = head.y - 24 * sc + Math.sin(a) * 7 * sc;
    if (i === 2) { ctx.fillStyle = '#ffe066'; ctx.font = `${Math.round(13 * sc)}px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.fillText('★', x, y); continue; }
    const flap = Math.sin(t * 22 + i * 2) * 4 * sc, dir = Math.sin(a) > 0 ? 1 : -1;   // birds face the way they fly
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x, y, 4 * sc, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1.8 * sc; ctx.beginPath();
    ctx.moveTo(x - 6 * sc, y - flap); ctx.lineTo(x, y - 1); ctx.lineTo(x + 6 * sc, y - flap); ctx.stroke();
    ctx.fillStyle = '#ff8a2e'; ctx.beginPath(); ctx.moveTo(x - dir * 4 * sc, y - 1.5 * sc); ctx.lineTo(x - dir * 8 * sc, y); ctx.lineTo(x - dir * 4 * sc, y + 1.5 * sc); ctx.fill();
  }
  ctx.restore();
}

// "AAAAH!" trailing from the head of a fighter sent flying, plus motion arcs at the flailing hands and feet.
function jzScream(f, fly) {
  const head = f.P[0], hip = f.P[2], sc = f.scale, vxh = vx(hip), vyh = vy(hip), sp = Math.hypot(vxh, vyh) || 1;
  const txt = 'A'.repeat(2 + Math.min(5, Math.floor(fly * 6))) + 'H!', t = G_STATE.t;
  ctx.save();
  ctx.globalAlpha *= clamp((fly - .25) * 5, 0, 1);
  ctx.font = `${Math.round(17 * sc)}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const x = head.x - vxh / sp * 34 * sc, y = head.y - vyh / sp * 34 * sc - 18 * sc + Math.sin(t * 40) * 1.5;
  ctx.lineWidth = 5; ctx.strokeStyle = '#07080f'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = '#ffffff'; ctx.fillText(txt, x, y);
  ctx.strokeStyle = jzInk() ? 'rgba(30,20,40,.55)' : 'rgba(255,255,255,.6)'; ctx.lineWidth = 2 * sc; ctx.lineCap = 'round';
  for (const j of [4, 6, 8, 10]) {
    const p = f.P[j];
    if (!p) continue;
    const a = t * 18 + j;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9 * sc, a, a + 1.6); ctx.stroke();
  }
  ctx.restore();
}

// Screen space (before bloom and the HUD): the camera kick decays here, and the clock for stickers runs.
const jzBaseScreen = juiceDrawScreen;
juiceDrawScreen = function (c2, dt) {
  jzBaseScreen(c2, dt);
  JZ.clock += dt;
  const d = Math.exp(-dt * 16);
  JZ.kx *= d; JZ.ky *= d;
  if (Math.abs(JZ.kx) + Math.abs(JZ.ky) < .05) JZ.kx = JZ.ky = 0;
};

// The kick shifts the world view along the blow (screen px), on top of the random shake.
const jzBaseTransform = setWorldTransform;
setWorldTransform = function (sx = 0, sy = 0) {
  const on = G_STATE.state === 'play' || G_STATE.state === 'killcam';
  return jzBaseTransform(sx + (on ? JZ.kx * VIEW.s : 0), sy + (on ? JZ.ky * VIEW.s : 0));
};

// Stickers sit with the banners (after the HUD, hidden in photo mode with it).
const jzBaseBanner = drawBanner;
drawBanner = function (dt) {
  jzBaseBanner(dt);
  if (G_STATE.demo) return;
  fxCompact(JZ.stickers, s => JZ.clock - s.t0 < s.life && JZ.clock >= s.t0);
  if (!JZ.stickers.length) return;
  const rows = { '-1': 0, 0: 0, 1: 0 }, top = Math.max(160, (hudBlockPx() - VIEW.oy) / VIEW.s + 62);   // below the HUD cards (taller in brawls)
  for (let i = JZ.stickers.length - 1; i >= 0; i--) { const s = JZ.stickers[i]; jzDrawSticker(s, rows[s.side]++, top); }
};

// A slanted plate with the callout in big type and the fighter's name under it; pops in, slides out.
function jzDrawSticker(s, row, top) {
  const age = JZ.clock - s.t0, calm = jzMotion() <= 0;
  const pop = calm ? 1 : age < .12 ? 1.5 - age / .12 * .5 : 1, out = clamp((s.life - age) / .25, 0, 1);
  const x = s.side < 0 ? 230 : s.side > 0 ? W - 230 : W / 2, y = top + row * 76 - (calm ? 0 : (1 - out) * 20);
  ctx.save();
  ctx.translate(x + (calm ? 0 : s.side * (1 - out) * 60), y); ctx.scale(pop, pop); ctx.transform(1, 0, -.18, 1, 0, 0);
  ctx.globalAlpha = out;
  ctx.font = `40px ${FONT_DISPLAY}`;
  const w = Math.max(150, ctx.measureText(s.text).width + 44);
  ctx.fillStyle = 'rgba(7,8,15,.86)'; ctx.fillRect(-w / 2, -28, w, s.sub ? 64 : 54);
  ctx.fillStyle = s.color; ctx.fillRect(-w / 2, -28, 7, s.sub ? 64 : 54); ctx.fillRect(w / 2 - 7, -28, 7, s.sub ? 64 : 54);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  glow(ctx, s.color, 14, () => { ctx.fillStyle = s.color; ctx.fillText(s.text, 0, 0); });
  if (s.sub) { ctx.font = `600 14px ${FONT_BODY}`; ctx.fillStyle = '#e8eaff'; ctx.fillText(String(s.sub).toUpperCase(), 0, 25); }
  ctx.restore();
}

// ---------- kill-cam, settings, tests ----------
on('boot', () => {
  if (typeof KC_FX === 'object') Object.assign(KC_FX, { jzImpact, jzWord, jzSticker, jzGhost, jzSplat, jzTwinkle, jzSquash });
  if (typeof kcDrawTag === 'function') {
    const base = kcDrawTag;
    kcDrawTag = function (c2, y) {   // the replay's top bar names the finisher in the middle
      base(c2, y);
      const def = KC.play && KC.play.ko.jzFinish;
      if (!def) return;
      c2.textAlign = 'center'; c2.font = `30px ${FONT_DISPLAY}`; c2.fillStyle = def[1];
      glow(c2, def[1], 16, () => c2.fillText(def[0], W / 2, y + 1));
    };
  }
  if (typeof SCREENS !== 'undefined' && typeof SCREENS.settings === 'function') {
    const build = SCREENS.settings;
    SCREENS.settings = () => {
      const node = build();
      try { jzSettings(node); } catch (e) { report(e, 'juice v7 settings'); }
      return node;
    };
  }
  if (window.SC) window.SC.juice7 = { JZ, log: JZ.log, tier: jzTier, finishKind: jzFinishKind, sticker: jzSticker };
});

// One toggle in Settings > Effects, after 87's Juice row.
function jzSettings(node) {
  for (const g of node.querySelectorAll ? node.querySelectorAll('.set-group') : []) {
    const h = g.querySelector('h3');
    if (!h || h.textContent !== 'Effects') continue;
    g.append(toggleField('Comic callouts', SETTINGS.fightGags !== false, v => setSetting('fightGags', v),
      'Combo and streak callouts, finisher titles (HOME RUN!, SPLAT!), comic hit words, dizzy birds and other body gags.'));
  }
}

// v7 merge: on a ladder rung the corner sticker already says "5 HIT!", so the in-world "5 HIT COMBO" label is dropped
// for that hit (other counts still float). Drawing only.
{
  const jzFloatPlain = float;
  float = function (x, y, text, color, size, key) {
    const m = typeof text === 'string' && key && /^combo/.test(key) && /^(\d+) HIT COMBO$/.exec(text);
    if (m && JZ_LADDER[+m[1]] && jzGags()) return;
    return jzFloatPlain.apply(this, arguments);
  };
}
