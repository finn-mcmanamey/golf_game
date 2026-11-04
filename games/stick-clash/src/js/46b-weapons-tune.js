// 46b-weapons-tune.js (v7): weak weapons get strong. Two jobs, no edits to the old weapon slices:
// 1. Win rates: W7_POWER retunes `power` so every weapon lands 42-58% at Normal (tools/balance.cjs, V3=1).
// 2. Feel: sixteen of the dullest weapons get a signature bonus (W7_BONUS): a crit, a finisher or a stagger with its
//    own label, ring and sound, so a landed bonus reads at a glance. All of it runs through one `damage` wrapper and a
//    few def hooks; drawing and sounds stay presentational and every number lives in W7.
// Events: emit('weaponBonus', attacker, key, victim) whenever a bonus lands (tests and the codex counters use it).

// ---------- tuning ----------
// Balance knob per weapon (× damage dealt with it). Buffs lift the weak; the few above 58% come down a little.
const W7_POWER = {
  // the weapons with a new bonus: power re-fitted around it (a strong bonus can mean a lower base)
  // v7 merge: Rapier, Saber and Haymakers trimmed once 68-ai-v7's CPUs aimed for their bonuses (they won 63-70%);
  // the Longshot nudged up from .85 (39.6%).
  sniper: .9, nunchaku: .98,   // nunchaku 1.08 won 61% once CPUs chased its STAGGER
  spear: 1.12, halberd: 1.12, katana: 1.08, saber: .86, rapier: .82, whip: 1.22, hammer: 1.2, chainsaw: 1.38,
  'boxing-gloves': .84, kusarigama: 1.1, 'war-fan': 1.24, 'echo-blades': .9, 'chrono-katana': 1.15, pistol: 1.0,
  revolver: 1.02,
  // other weak weapons: plain buffs
  kickback: 1.5, singularity: 1.06, pillow: 1.25, 'magnet-glove': 1.32, wand: .8, bubble: 1.25, greatsword: 1.1,
  bat: 1.2, slingshot: .96, broadsword: 1.02, grapnel: 1.16, confetti: 1.0, 'tennis-racket': 1.2, trident: 1.2,
  'bo-staff': 1.16, flail: 1.22, 'void-orb': .8, minigun: .96, naginata: 1.3, thornvine: 1.3, 'plasma-staff': 1.14,
  'battle-axe': 1.22, umbrella: 1.2, 'plunger-bow': 1.25, snowball: .84, 'water-blaster': 1.2, flamethrower: 1.45,
  gloop: 1.35,
  // trims: outliers above 58%
  conductor: .74, 'phase-rifle': .82, 'meteor-flail': .95, mortar: .8, javelin: .96, yoyo: .76,
  anchor: .96, 'prism-cannon': 1.08, 'storm-staff': .97,
};

// Every bonus number in one place (times in s, distances in px at scale 1).
const W7 = {
  finMin: 6,                                                      // a finisher never lands softer than this (before ×)
  bonusCap: 30,                                                   // nor harder than this (TUNE.maxHit 26: no cheap one-shots)
  spearTip: 30, spearMin: 4, spearMul: 1.5, spearKb: 1.3,         // tip sweet spot (a graze doesn't count)
  halberdTripEvery: 1.2, halberdChopMul: 1.15,                    // the chop hooks the legs
  iaiWindow: .4, iaiMul: 1.45, iaiKb: 1.3,                         // katana quick-draw cut
  riposteWindow: 2, riposteMul: 1.3, riposteKb: 1.25,             // saber after a deflect or a clash
  toucheGap: 1.6, toucheMul: 1.7,                                 // rapier: 3rd hit in a row
  whipCrack: 1250, whipMul: 1.55, whipKb: 1.3,                    // whip tip speed for a crack
  nunchakuGap: 1.8, nunchakuEvery: 5, nunchakuMul: 1.3, nunchakuStun: .45,
  quakeR: 200, quakeDmg: 10,                                      // hammer shockwave (v4: 150, 7)
  sawRamp: .35, sawTicks: 6, sawRip: 8,                           // chainsaw grind ramp + RIP finisher
  upperGap: 1.5, upperMul: 1.6, upperKb: 1.5,                     // boxing gloves: 3rd punch in a row
  reapMul: 1.35, reapPull: 220, reapEvery: 1.2,                                   // kusarigama on a bleeding foe
  galeEvery: 3, galeR: 26, galeKb: 1050, galeDmg: 5, galeLife: .5, // war fan
  echoMark: .45, echoMul: 2.2,                                    // echo blades resonance
  chronoMul: 1.3, chronoRecharge: 4.5,                            // chrono katana (v5: 6 s)
  pistolMul: 1.8, pistolR: 7, pistolKb: 640,                      // last round in the clip
  tapGap: 1.1, tapMul: 1.3, revolverStagger: .3,                  // revolver double tap
};

// What each bonus is called, for the codex, the How to Play card and the tests. key -> [weapon, label, color, sound]
const W7_BONUS = {
  tip: ['spear', 'TIP!', '#ffe9a8', 'w7-ding'],
  hook: ['halberd', 'HOOKED!', '#ffd27a', 'w7-hook'],
  iai: ['katana', 'IAI CUT!', '#ffffff', 'w7-iai'],
  riposte: ['saber', 'RIPOSTE!', '#d6a8ff', 'w7-riposte'],
  touche: ['rapier', 'TOUCHÉ!', '#ffe9a8', 'w7-ding'],
  crack: ['whip', 'CRACK!', '#ffd84a', 'w7-crack'],
  stagger: ['nunchaku', 'STAGGER!', '#ffb36b', 'w7-clack'],
  quake: ['hammer', 'QUAKE!', '#ffd27a', 'w7-quake'],
  rip: ['chainsaw', 'RIP!', '#ffb347', 'w7-rip'],
  uppercut: ['boxing-gloves', 'UPPERCUT!', '#ff6b6b', 'w7-bell'],
  reap: ['kusarigama', 'REAP!', '#ff3b4e', 'w7-reap'],
  gale: ['war-fan', 'GALE!', '#c9f3ff', 'w7-gale'],
  resonance: ['echo-blades', 'RESONANCE!', '#5ef2ff', 'w7-resonance'],
  tick: ['chrono-katana', 'TICK!', '#8cf6ff', 'w7-tick'],
  overcharge: ['pistol', 'OVERCHARGE!', '#bffcff', 'w7-overcharge'],
  doubletap: ['revolver', 'DOUBLE TAP!', '#ffd84a', 'w7-tap'],
};

// The new descriptions (old text kept, the bonus added at the end so players learn it from the picker).
const W7_DESC = {
  spear: `Longest reach. Lunging pokes from safety; weaker up close. Hit with the very tip for a TIP! crit (×${W7.spearMul}, extra knockback).`,
  halberd: 'Axe blade, spike and hook on a long haft. Attacks alternate between a lunge and a sweeping chop; the chop hooks the legs and trips the foe flat.',
  katana: `Long, light, curved. Rest it a second and the next swing is a lunging quick-draw cut that crosses the gap; if it lands it is an IAI CUT (×${W7.iaiMul}).`,
  saber: `Light, very fast plasma blade. Swing it into a shot and the shot flies straight back at whoever fired it. Deflect a shot or win a clash and your next cut within ${W7.riposteWindow} s is a RIPOSTE (×${W7.riposteMul}).`,
  rapier: `Needle-thin duelling blade. Every attack is a fast, long lunge straight at the foe. Three hits in a row: the third is a TOUCHÉ (×${W7.toucheMul}).`,
  whip: `Very long leather whip. Low damage but huge reach; a full-speed crack of the tip hits ×${W7.whipMul} harder and slows the target.`,
  nunchaku: `Two sticks on a short chain. Very fast flurries; the loose stick cracks at high speed. Every ${W7.nunchakuEvery}th hit in a row STAGGERS the foe (a short stun).`,
  hammer: 'Slow and heavy. Smash the ground on a downswing to send out a wide QUAKE shockwave that pops foes up.',
  chainsaw: 'Revving chainsaw. Attacks spin it up: while revving it grinds anything it touches, harder the longer it bites, then RIPS them away.',
  'boxing-gloves': 'Boxing gloves. Short reach, but fast alternating jabs with huge knockback. Land three punches in a row and the third is an UPPERCUT that launches.',
  kusarigama: `Sickle on a long chain. Hooks the target, makes it bleed and drags it closer. Hit a bleeding foe to REAP (×${W7.reapMul} and a harder drag, once a second).`,
  'war-fan': `Steel folding fan. Each swing also throws a short gust that shoves the foe away; every ${W7.galeEvery}rd swing throws a big GALE.`,
  'echo-blades': `Twin light blades. Every attack swings both, and a ghost of the main swing cuts the same spot 0.25 s later. If the main swing hit, the echo RESONATES for ×${W7.echoMul}.`,
  'chrono-katana': `A quick, light katana with a clock in the guard. Land three cuts on the same foe within 2 s and you stop their clock: they are Time-Warped for 1.4 s and you get a burst of haste. Cuts on a Time-Warped foe TICK for ×${W7.chronoMul}; the field winds back up in ${W7.chronoRecharge} s.`,
  pistol: `Five quick energy shots, then a reload. Keep your distance: the last round in the clip is an OVERCHARGED bolt (×${W7.pistolMul}, big knockback).`,
  revolver: `Five slow, heavy rounds that knock foes back and make them stagger. Hit again within ${W7.tapGap} s for a DOUBLE TAP (×${W7.tapMul}). Long reload.`,
};
// Signature arcs for the codex/tools (only where the old `sig` didn't mention the bonus).
const W7_SIG = {
  spear: 'tip sweet spot crit', halberd: 'chop trips', katana: 'rested 1 s: quick-draw lunge, IAI CUT',
  saber: 'mid-swing deflect; deflect or clash: RIPOSTE', rapier: 'long lunge; 3rd hit in a row TOUCHÉ',
  whip: 'tip crack + slow', nunchaku: 'every 5th hit staggers', hammer: 'wide quake shockwave',
  chainsaw: 'grind ramps, then RIP', 'boxing-gloves': '3rd punch: UPPERCUT', kusarigama: 'reap a bleeding foe',
  'war-fan': 'gust; every 3rd swing a GALE', 'echo-blades': 'echo resonates on a hit foe',
  'chrono-katana': '3 hits in 2 s: Time Warp; warped foes TICK',
  pistol: 'last round OVERCHARGED', revolver: 'stagger + DOUBLE TAP',
};

// ---------- shared helpers ----------
// Hits in a row on one foe, each within `gap` s of the last; contacts within 0.08 s (both ends of a swing) count once.
function w7Streak(A, B, key, gap) {
  const m = A.mem.w7s || (A.mem.w7s = {}), c = m[key] || (m[key] = { foe: null, n: 0, t: -9 });
  const dt = G_STATE.t - c.t;
  if (c.foe === B && dt < .08) return c.n;
  c.n = c.foe === B && dt < gap ? c.n + 1 : 1;
  c.foe = B; c.t = G_STATE.t;
  return c.n;
}
// The streak count the NEXT hit on B would reach (1 if it would start a new one).
function w7Next(A, B, key, gap) {
  const c = A.mem.w7s && A.mem.w7s[key];
  return c && c.foe === B && G_STATE.t - c.t < gap ? c.n + 1 : 1;
}
function w7Reset(A, key) { const c = A.mem.w7s && A.mem.w7s[key]; if (c) c.n = 0; }
const w7IsMain = (A, o) => !o.weapon || o.weapon === A.w || (A.off && o.weapon === A.off.w);

// Feedback for a landed bonus: its label, a ring, a bit more hit-stop and shake, its sound. Effects only.
function w7Land(A, B, key, x, y) {
  const [, label, color, snd] = W7_BONUS[key];
  const m = A.mem.w7n || (A.mem.w7n = {});
  m[key] = (m[key] || 0) + 1;
  float(x, y - 44, label, color, 24);
  ring(x, y, 34 * B.scale, color, .26, 4);
  ring(x, y, 62 * B.scale, '#ffffff', .18, 2);
  burst(x, y, color, 10, 380, { life: .3 });
  hitstop(.07);
  shake(6);
  sfx(snd, .9);
  emit('weaponBonus', A, key, B);
}

// ---------- the per-weapon bonuses ----------
// pre(A, B, o, amount) runs before the hit and returns { key, mul, kb, min, o } or null (min: the least the hit counts
// as before ×mul, so a finisher from a slow swing still lands like one); post(A, B, dealt, o, bonus) runs
// after a hit that dealt damage (streak counters, statuses). Only melee and shot damage (`kind` melee/proj) count.
const W7_HIT = {
  spear: {
    pre(A, B, o, amount) {   // the contact point is within a spear-head of the tip
      const t = A.P[A.tip];
      if (!o.weapon || o.x == null || amount < W7.spearMin || Math.hypot(o.x - t.x, o.y - t.y) > W7.spearTip * A.scale) return null;
      return { key: 'tip', mul: W7.spearMul, kb: W7.spearKb };
    },
  },
  halberd: {
    pre(A, B, o) {   // halberdAlt is false after a chop (it toggles before each attack); one trip per foe per 1.2 s
      const last = A.mem.w7Hook && A.mem.w7Hook[B.id];
      if (!o.weapon || A.mem.halberdAlt || G_STATE.t - (last ?? -9) < W7.halberdTripEvery) return null;
      return { key: 'hook', mul: W7.halberdChopMul };
    },
    post(A, B, dealt, o, b) {
      if (!b) return;
      (A.mem.w7Hook || (A.mem.w7Hook = {}))[B.id] = G_STATE.t;
      if (B.alive) pwTrip(B, Math.sign(B.P[2].x - A.P[2].x) || A.face, .75);
    },
  },
  katana: {
    pre(A, B, o) {
      if (!o.weapon || !(A.mem.w7Iai > G_STATE.t)) return null;
      A.mem.w7Iai = 0;   // one cut per draw
      return { key: 'iai', mul: W7.iaiMul, kb: W7.iaiKb, min: W7.finMin };
    },
  },
  saber: {
    pre(A, B, o) {
      if (!o.weapon || !(A.mem.w7Riposte > G_STATE.t)) return null;
      A.mem.w7Riposte = 0;
      return { key: 'riposte', mul: W7.riposteMul, kb: W7.riposteKb, min: W7.finMin };
    },
  },
  rapier: {
    pre(A, B, o) { return o.weapon && w7Next(A, B, 'touche', W7.toucheGap) >= 3 ? { key: 'touche', mul: W7.toucheMul, min: W7.finMin } : null; },
    post(A, B, dealt, o, b) { if (o.weapon) { w7Streak(A, B, 'touche', W7.toucheGap); if (b) w7Reset(A, 'touche'); } },
  },
  whip: {
    pre(A, B, o) {   // the tip's own speed: only the end of the lash cracks
      const t = A.P[A.tip];
      return o.weapon && Math.hypot(vx(t), vy(t)) >= W7.whipCrack ? { key: 'crack', mul: W7.whipMul, kb: W7.whipKb } : null;
    },
    post(A, B, dealt, o, b) { if (b && B.alive) addStatus(B, 'slow', 1, 1, A); },
  },
  nunchaku: {
    pre(A, B, o) { return o.weapon && w7Next(A, B, 'nun', W7.nunchakuGap) >= W7.nunchakuEvery ? { key: 'stagger', mul: W7.nunchakuMul, min: W7.finMin } : null; },
    post(A, B, dealt, o, b) {
      if (!o.weapon) return;
      w7Streak(A, B, 'nun', W7.nunchakuGap);
      if (!b) return;
      w7Reset(A, 'nun');
      if (B.alive) addStatus(B, 'stun', W7.nunchakuStun, 1, A);
    },
  },
  'boxing-gloves': {
    pre(A, B, o) {
      if (!o.weapon || w7Next(A, B, 'upper', W7.upperGap) < 3) return null;
      const dir = Math.sign(B.P[2].x - A.P[2].x) || A.face;
      return { key: 'uppercut', mul: W7.upperMul, kb: W7.upperKb, min: W7.finMin, o: { nx: dir * .35, ny: -.94 } };
    },
    post(A, B, dealt, o, b) { if (o.weapon) { w7Streak(A, B, 'upper', W7.upperGap); if (b) w7Reset(A, 'upper'); } },
  },
  kusarigama: {
    pre(A, B, o) {   // one reap per foe per W7.reapEvery s, so it reads as a finisher rather than every hit
      const last = A.mem.w7Reap && A.mem.w7Reap[B.id];
      return o.weapon && B.status.bleed && !(G_STATE.t - (last ?? -9) < W7.reapEvery) ? { key: 'reap', mul: W7.reapMul, min: W7.finMin } : null;
    },
    post(A, B, dealt, o, b) {
      if (!b) return;
      (A.mem.w7Reap || (A.mem.w7Reap = {}))[B.id] = G_STATE.t;
      if (B.alive) meleePull(A, B, W7.reapPull);
    },
  },
  'war-fan': {
    pre(A, B, o) { return o.proj && o.proj.w7Gale ? { key: 'gale', mul: 1 } : null; },
  },
  'echo-blades': {
    pre(A, B, o) {   // the echo is the only melee hit from these blades with no weapon rig
      const marks = A.mem.w7Echo;
      if (o.weapon || o.color !== '#5ef2ff' || !marks || !(G_STATE.t - (marks[B.id] ?? -9) < W7.echoMark + .25)) return null;
      marks[B.id] = -9;
      return { key: 'resonance', mul: W7.echoMul };
    },
    post(A, B, dealt, o) { if (o.weapon) (A.mem.w7Echo || (A.mem.w7Echo = {}))[B.id] = G_STATE.t; },
  },
  'chrono-katana': {
    pre(A, B, o) { return o.weapon && B.status.timewarp ? { key: 'tick', mul: W7.chronoMul } : null; },
  },
  pistol: {
    pre(A, B, o) { return o.proj && o.proj.w7Last ? { key: 'overcharge', mul: 1 } : null; },   // its dmg is already raised
  },
  revolver: {
    pre(A, B, o) { return o.proj && w7Next(A, B, 'tap', W7.tapGap) >= 2 ? { key: 'doubletap', mul: W7.tapMul } : null; },
    post(A, B, dealt, o, b) {
      if (!o.proj) return;
      B.stagger = Math.max(B.stagger, W7.revolverStagger);
      w7Streak(A, B, 'tap', W7.tapGap);
      if (b) w7Reset(A, 'tap');
    },
  },
};

// A bonus hit: at least its finisher floor, times its multiplier, capped (never below the plain hit).
const w7BonusAmount = (amount, b) => Math.max(amount, Math.min(Math.max(amount, b.min || 0) * b.mul, W7.bonusCap));

// The wrapper every bonus goes through (46's soak wrapper is inside it, v5's perfect dodge outside it).
const w7Damage0 = damage;
damage = function (B, amount, o = {}) {
  const A = o.src, kind = o.kind || 'melee';
  if (!A || A === B || !B || !B.alive || !(amount > 0) || (kind !== 'melee' && kind !== 'proj') || !A.mem) return w7Damage0(B, amount, o);
  const key = (o.proj && o.proj.w7Owner === A && o.proj.w7Key) || A.wkey, h = W7_HIT[key];   // a deflected shot is no longer its gun's
  if (!h || (!o.proj && !w7IsMain(A, o) && key !== 'echo-blades')) return w7Damage0(B, amount, o);
  const b = h.pre ? h.pre(A, B, o, amount) : null;
  const o2 = b ? Object.assign({}, o, b.o, { kb: (o.kb || 0) * (b.kb || 1) }) : o;
  const dealt = w7Damage0(B, b ? w7BonusAmount(amount, b) : amount, o2);
  if (dealt > 0) {
    if (h.post) h.post(A, B, dealt, o, b);   // statuses first, so a 'weaponBonus' listener sees them
    if (b) w7Land(A, B, b.key, o.x ?? chest(B).x, o.y ?? chest(B).y);
  }
  return dealt;
};

// ---------- hooks on the weapon defs ----------
// Wraps a def method: fn(orig, ...args) runs instead, calling orig (bound to the def) when it wants the old behaviour.
function w7Wrap(key, method, fn) {
  const def = WEAPONS[key];
  if (!def) return;
  const orig = def[method];
  def[method] = function (...args) { return fn.call(this, orig ? (...a) => orig.apply(this, a) : () => {}, ...args); };
}

// Katana: note a quick-draw before the old attack resets the sheath timer.
function w7HookKatana() {
  w7Wrap('katana', 'attack', (orig, f) => {
    if (f.mem.katanaSheath > 1) f.mem.w7Iai = G_STATE.t + W7.iaiWindow;
    orig(f);
  });
}

// Saber: a deflected shot (deflectProj emits block with no attacker) or a won clash arms a riposte.
function w7ArmRiposte(f) {
  if (!f || f.wkey !== 'saber' || !f.alive) return;
  f.mem.w7Riposte = G_STATE.t + W7.riposteWindow;
  if (axOnce(f, f, 'w7arm', .5)) { const t = f.P[f.tip]; ring(t.x, t.y, 26, '#d6a8ff', .25, 3); sfx('w7-arm', .6); }
}
function w7HookSaber() {
  on('block', (B, src) => { if (!src && B.swingT > 0) w7ArmRiposte(B); });
  on('clash', (A, B) => { w7ArmRiposte(A); w7ArmRiposte(B); });
  w7Wrap('saber', 'draw', function (orig, ctx, f, s) {
    orig(ctx, f, s);
    if (!f.mem || !(f.mem.w7Riposte > G_STATE.t)) return;
    const pulse = .5 + .5 * Math.sin(G_STATE.t * 18);   // a primed blade flickers white along its edge
    ctx.globalAlpha = .35 + pulse * .4;
    line(ctx, s.at(6 * s.k), s.t, '#ffffff', 3 * s.k);
    ctx.globalAlpha = 1;
  });
}

// Whip: the crack now decides itself in the damage wrapper; the old onHit only floated the label.
function w7HookWhip() { WEAPONS.whip && (WEAPONS.whip.onHit = function () {}); }

// Hammer: the same downswing slam, with a wider, harder shockwave and its own label.
function w7HookHammer() {
  if (!WEAPONS.hammer) return;
  WEAPONS.hammer.onStep = function (f, dt) {
    if (!(f.mem.hammerSlam > 0)) return;
    f.mem.hammerSlam -= dt;
    const t = f.P[f.tip], g = groundBelow(t.x, t.y - 30);
    if (g == null || t.y <= g - 22 || vy(t) <= 300) return;
    f.mem.hammerSlam = 0;
    const before = enemiesOf(f).map(B => B.hp);
    meleeShockwave(f, t.x, g, W7.quakeR * f.scale, W7.quakeDmg);
    const hurt = enemiesOf(f).find((B, i) => B.hp < before[i]);
    if (hurt) w7Land(f, hurt, 'quake', t.x, g - 20);
  };
}

// Chainsaw: each grind tick on the same foe bites harder; after W7.sawTicks of them it RIPS the foe away.
function w7HookChainsaw() {
  if (!WEAPONS.chainsaw) return;
  WEAPONS.chainsaw.onStep = function (f, dt) {
    const m = f.mem;
    m.sawGrind = (m.sawGrind || 0) - dt; m.sawSnd = (m.sawSnd || 0) - dt;
    if (!(m.sawRev > 0)) { m.w7SawN = 0; return; }
    m.sawRev -= dt;
    if (m.sawSnd <= 0) { sfx('saw', .8 + Math.min(m.w7SawN || 0, 6) * .06); m.sawSnd = .14; }
    const hit = m.sawGrind <= 0 && meleeTouching(f, f.main, 6 * f.scale);
    if (!hit) return;
    m.sawGrind = .1;
    m.w7SawN = m.w7SawFoe === hit.B ? (m.w7SawN || 0) + 1 : 1; m.w7SawFoe = hit.B;
    if (m.w7SawN >= W7.sawTicks) { w7SawRip(f, hit); return; }
    damage(hit.B, 2 + W7.sawRamp * (m.w7SawN - 1), { src: f, kind: 'status', x: hit.x, y: hit.y, color: '#ffb347', small: true });
    for (const p of hit.B.P) kick(p, f.face * 40, -10);
    hit.B.stagger = Math.max(hit.B.stagger, .1);
    burst(hit.x, hit.y, '#ffd27a', 4 + m.w7SawN, 360, { life: .2 });
  };
}
function w7SawRip(f, hit) {
  const m = f.mem, dir = Math.sign(hit.B.P[2].x - f.P[2].x) || f.face;
  m.w7SawN = 0; m.sawRev = 0;   // the rip ends the rev: attack again to start a new bite
  const dealt = w7Damage0(hit.B, W7.sawRip, { src: f, kind: 'melee', weapon: f.w, x: hit.x, y: hit.y, nx: dir * .8, ny: -.6, kb: 560, color: '#ffb347' });
  if (dealt > 0) w7Land(f, hit.B, 'rip', hit.x, hit.y);
}

// War fan: every 3rd swing's gust is a big gale (the gust is the newest of its shots).
function w7HookFan() {
  w7Wrap('war-fan', 'attack', (orig, f) => {
    orig(f);
    f.mem.w7FanN = ((f.mem.w7FanN || 0) + 1) % W7.galeEvery;
    if (f.mem.w7FanN) return;
    const g = PROJ.slice().reverse().find(p => p.owner === f && p.kind === 'gust' && !p.dead);
    if (!g) return;
    Object.assign(g, { r: W7.galeR, kb: W7.galeKb, dmg: W7.galeDmg, life: W7.galeLife, drag: 1.8, w7Gale: true, w7Key: 'war-fan', w7Owner: f });
    g.vx *= 1.25; g.vy *= 1.25;
    ring(g.x, g.y, 30, '#c9f3ff', .25, 3);
    sfx('w7-gale', .7);
  });
}

// Chrono katana: the field winds back up faster (the old onHit sets 6 s; pull it in).
function w7HookChrono() {
  w7Wrap('chrono-katana', 'onHit', (orig, A, B, hit) => {
    const before = A.mem.chronoReady || 0;
    orig(A, B, hit);
    if (A.mem.chronoReady > before) A.mem.chronoReady = G_STATE.t + W7.chronoRecharge;
  });
}

// Pistol: the last round in the clip leaves as a fat overcharged bolt. Revolver: shots carry their key (for streaks).
function w7OnFire(f, p) {
  if (!p || !f.w) return;
  if (f.wkey === 'revolver') { Object.assign(p, { w7Key: 'revolver', w7Owner: f }); return; }
  if (f.wkey !== 'pistol' || f.ammo > 0) return;
  Object.assign(p, { w7Last: true, w7Key: 'pistol', w7Owner: f, dmg: p.dmg * W7.pistolMul, r: W7.pistolR, kb: W7.pistolKb, color: '#bffcff', draw: w7BoltDraw });
  const b = rangedBarrel(f);
  ring(b.x, b.y, 26, '#bffcff', .2, 4);
  burst(b.x, b.y, '#ffffff', 14, 420, { life: .22 });
  shake(4);
  sfx('w7-overcharge', .8);
}
function w7BoltDraw(ctx, p) {
  rangedTrail(ctx, p, rgba('#5ef2ff', .5), 7);
  glow(ctx, '#5ef2ff', 18, () => circle(ctx, p.x, p.y, p.r + 1, '#5ef2ff'));
  circle(ctx, p.x, p.y, p.r * .55, '#ffffff');
}

// ---------- sounds ----------
// The bonus sounds (silent without an AudioContext, like every sfx) and punchier WSND signatures for the weapons that
// only had their category's. WSND recipes: 'swing|hit', layers 'kind secs Hz Hz2 vol [delay] [Q]' (see 80b).
const W7_WSND = {
  spear: 'nb .12 2200 5200 .14 0 3|nb .04 3000 3000 .4,ts .1 300 110 .35',                 // shff / thock
  halberd: 'nb .26 500 1800 .28 0 1.4|m .25 380 380 .07,ts .2 150 50 .5',                  // heavy whoom / chop
  saber: 'tw .22 150 230 .05,ts .22 300 460 .04|tw .1 1300 300 .07,nh .08 6000 6000 .22',   // hum / sizzle
  kusarigama: 'nh .03 5200 5200 .07,nh .03 4400 4400 .06 .04,nh .03 5000 5000 .07 .08|ts .06 3200 1400 .05,nh .06 7000 7000 .3',
  pistol: '|ts .07 1700 600 .1,nb .04 2600 2600 .25',                                       // shots land with a zap
  revolver: 'nl .25 180 120 .35|ts .14 140 55 .5,nb .06 1800 1800 .3',                      // boom tail / thud
};
function w7Sounds() {
  if (typeof defSfx !== 'function') return;
  defSfx('w7-ding', v => { tone(2350, 2330, .5, 'sine', .14 * v); tone(4700, 4650, .3, 'sine', .05 * v); noise(.03, 5000, .15 * v, 'highpass'); });
  defSfx('w7-hook', v => { metal(420, .3, .06 * v); thump(160, 50, .2, .45 * v); noiseSweep(.12, 1800, 400, .2 * v); });
  defSfx('w7-iai', v => { noiseSweep(.18, 9000, 2500, .3 * v, 'highpass'); tone(4200, 4100, .5, 'sine', .05 * v, .05); });
  defSfx('w7-arm', v => { tone(600, 1300, .12, 'triangle', .06 * v); });
  defSfx('w7-riposte', v => { tone(900, 2200, .1, 'sawtooth', .05 * v); noiseSweep(.14, 7000, 3000, .25 * v, 'highpass'); tone(2200, 2180, .3, 'sine', .07 * v, .06); });
  defSfx('w7-crack', v => { noise(.04, 7500, .5 * v, 'highpass'); tone(3200, 600, .07, 'square', .07 * v); noiseSweep(.2, 4000, 800, .12 * v, 'bandpass', .03); });
  defSfx('w7-clack', v => { tone(1500, 1200, .04, 'triangle', .2 * v); tone(1100, 900, .05, 'triangle', .18 * v, .05); thump(200, 70, .18, .4 * v, .05); });
  defSfx('w7-quake', v => { noise(.6, 110, .8 * v, 'lowpass'); tone(60, 24, .55, 'sine', .6 * v); });
  defSfx('w7-rip', v => { tone(90, 300, .25, 'sawtooth', .08 * v); noiseSweep(.3, 900, 4000, .3 * v, 'bandpass', 0, 2); thump(150, 50, .2, .4 * v, .1); });
  defSfx('w7-bell', v => { metal(880, .9, .1 * v); thump(170, 50, .2, .55 * v); noise(.1, 500, .5 * v, 'lowpass'); });
  defSfx('w7-reap', v => { noiseSweep(.3, 600, 3800, .25 * v, 'bandpass', 0, 2); tone(260, 90, .25, 'sawtooth', .05 * v); });
  defSfx('w7-gale', v => { noiseSweep(.45, 400, 2400, .32 * v, 'bandpass', 0, 1.5); });
  defSfx('w7-resonance', v => { tone(880, 880, .4, 'sine', .08 * v); tone(1320, 1330, .4, 'sine', .06 * v, .02); tone(1760, 1770, .35, 'triangle', .04 * v, .04); });
  defSfx('w7-tick', v => { tone(2600, 2600, .03, 'square', .05 * v); tone(2000, 2000, .03, 'square', .04 * v, .09); });
  defSfx('w7-overcharge', v => { tone(300, 1800, .12, 'sawtooth', .06 * v); tone(1800, 200, .25, 'square', .05 * v, .1); noise(.08, 3000, .3 * v); });
  defSfx('w7-tap', v => { thump(140, 45, .25, .55 * v); noise(.05, 2400, .3 * v); metal(1200, .2, .04 * v, .04); });
  Object.assign(WSND, W7_WSND);
  for (const k in W7_WSND) delete WSND_CACHE[k];
}

// ---------- lore ----------
const W7_LORE = {
  spear: 'Lumen\'s spear-drillers say a point is only a point at the very end, and the Wick agrees with a ring like a struck bell.',
  'boxing-gloves': 'The Haymakers were sewn for the Candle\'s exhibition bouts, and the third punch always rings the bell nobody hung.',
  revolver: 'The Thunder Six was cast from a storm-realm lightning rod, so its bullets arrive in pairs like thunder after the flash.',
};

// ---------- help ----------
// One How to Play card and a codex technique, so players know the labels mean something they can aim for.
const W7_HELP = 'Sixteen weapons have a signature bonus: hit with the Spear\'s tip (TIP!), land three Haymaker punches in a row (UPPERCUT!), fire the Pulse Pistol\'s last round (OVERCHARGE!), deflect a shot with the Energy Saber (RIPOSTE!)... Each weapon\'s description in the picker says how to land its bonus; the label and a ring show when it does.';
function w7HelpCard() {
  if (typeof V5_TECHNIQUES === 'object') V5_TECHNIQUES.push({ name: 'Weapon bonuses', icon: '✪', text: W7_HELP });
  const before = SCREENS.howto;
  if (typeof before !== 'function') return;
  SCREENS.howto = function () {
    const node = before.apply(this, arguments), grid = node && node.querySelector('.help-grid');
    if (grid) grid.appendChild(el('section', { class: 'help-card' }, el('h3', {}, el('span', { text: '✪' }), 'Weapon bonuses'), el('p', { text: W7_HELP })));
    return node;
  };
}

// ---------- boot: apply the tuning and the hooks ----------
on('boot', () => {
  for (const k in W7_POWER) if (WEAPONS[k]) WEAPONS[k].power = W7_POWER[k];
  for (const k in W7_DESC) if (WEAPONS[k]) WEAPONS[k].desc = W7_DESC[k];
  for (const k in W7_SIG) if (WEAPONS[k]) WEAPONS[k].sig = W7_SIG[k];
  w7HookKatana(); w7HookSaber(); w7HookWhip(); w7HookHammer(); w7HookChainsaw(); w7HookFan(); w7HookChrono();
  on('fire', w7OnFire);
  w7Sounds();
  w7HelpCard();
  if (typeof LORE_LINES === 'object') Object.assign(LORE_LINES.w, W7_LORE);
});
