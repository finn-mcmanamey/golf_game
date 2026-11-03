// v5 "Rift" expansion. Everything here layers on the engine through its own extension points (wrapped functions,
// events, def* registries) so the original systems stay untouched underneath:
//   perfect dodge + counter, tech recovery, 3 skills, 3 orbs, Ascension (roguelite mode), weapon mastery (cosmetic),
//   rarity tiers, settings, codex techniques, sounds for the rift arsenal.

// ---------- settings (defaults merge into old saves; nothing existing is overwritten) ----------
const V5_DEFAULTS = { v5Slowmo: true, v5Beat: true, v5MasteryFx: true, v5Tips: true };
for (const k in V5_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = V5_DEFAULTS[k];
  if (!(k in SETTINGS) || typeof SETTINGS[k] !== typeof V5_DEFAULTS[k]) SETTINGS[k] = V5_DEFAULTS[k];
}
const v5On = k => SETTINGS[k] !== false;

// ---------- rarity tiers (display + codex; every weapon stays free to use) ----------
const TIER_INFO = {
  common: { name: 'Common', color: '#c9cdee' }, rare: { name: 'Rare', color: '#5ef2ff' },
  epic: { name: 'Epic', color: '#b98cff' }, mythic: { name: 'Mythic', color: '#ffd84a' },
};
const V5_TIERS = { 'chrono-katana': 'epic', graviton: 'epic', 'echo-blades': 'rare', thornvine: 'rare', 'phase-rifle': 'rare',
  'meteor-flail': 'epic', 'prism-cannon': 'mythic', singularity: 'mythic' };
for (const k in V5_TIERS) if (WEAPONS[k] && !WEAPONS[k].tier) WEAPONS[k].tier = V5_TIERS[k];
const weaponTier = w => (w && TIER_INFO[w.tier]) ? w.tier : 'common';
const RIFT_WEAPONS = listOf(WEAPONS).filter(w => !w.hidden && w.tier && w.tier !== 'common').map(w => w.key);

// ---------- weapon mastery (cosmetic only: badges, a swing glow, skins and titles) ----------
// Points come from the codex counters the game already keeps, so an old save starts with the mastery it earned.
const MASTERY = [
  { key: 'bronze', name: 'Bronze', pts: 8, color: '#d08a4a' },
  { key: 'silver', name: 'Silver', pts: 30, color: '#dfe6f5' },
  { key: 'gold', name: 'Gold', pts: 90, color: '#ffd84a' },
  { key: 'mythic', name: 'Mythic', pts: 220, color: '#ff5ad1' },
];
function masteryPts(key) { const [u, w, k] = codexRow('w', key); return (u || 0) + 2 * (w || 0) + (k || 0); }
function masteryTier(key) { const p = masteryPts(key); let t = -1; MASTERY.forEach((m, i) => { if (p >= m.pts) t = i; }); return t; }
function masteryText(key) {
  const p = masteryPts(key), t = masteryTier(key), next = MASTERY[t + 1];
  return (t >= 0 ? MASTERY[t].name + ' mastery' : 'No mastery yet') + (next ? ` · ${p}/${next.pts} to ${next.name}` : ' · maxed');
}
defLook(TITLES, 'weapon-adept', { name: 'Weapon Adept', icon: '🏷', hidden: true });
defLook(TITLES, 'arms-master', { name: 'Arms Master', icon: '🏷', hidden: true });
defLook(TITLES, 'golden-hand', { name: 'Golden Hand', icon: '🏷', hidden: true });
defLook(TITLES, 'mythsmith', { name: 'Mythsmith', icon: '🏷', hidden: true });
defLook(TITLES, 'riftwalker', { name: 'Riftwalker', icon: '🏷', hidden: true });
defLook(TITLES, 'ascendant', { name: 'Ascendant', icon: '🏷', hidden: true });
defLook(TITLES, 'perfect-form', { name: 'Perfect Form', icon: '🏷', hidden: true });
defLook(WSKINS, 'rift', { name: 'Rift Prism', icon: '🔷', hidden: true, stops: ['#2a0d4a', '#7a5cff', '#ff5ad1', '#fff0ff'] });
defLook(WSKINS, 'aurora', { name: 'Mythic Aurora', icon: '🌌', hidden: true, stops: ['#06213a', '#1fd1a5', '#ffd84a', '#ffffff'] });
const V5_STATS = Object.assign({ perfect: 0, tech: 0, counters: 0, ascBest: 0 }, store.getObj('v5stats'));
const v5StatSave = () => store.set('v5stats', V5_STATS);
// Each unlock: [look registry, key, test, toast text]
const V5_UNLOCKS = [
  [TITLES, 'weapon-adept', () => masteryCount(1) >= 1, 'Title: Weapon Adept'],
  [TITLES, 'arms-master', () => masteryCount(1) >= 8, 'Title: Arms Master'],
  [TITLES, 'golden-hand', () => masteryCount(2) >= 1, 'Title: Golden Hand'],
  [WSKINS, 'rift', () => masteryCount(2) >= 1, 'Weapon skin: Rift Prism'],
  [TITLES, 'mythsmith', () => masteryCount(3) >= 1, 'Title: Mythsmith'],
  [WSKINS, 'aurora', () => masteryCount(3) >= 1, 'Weapon skin: Mythic Aurora'],
  [TITLES, 'riftwalker', () => (campSave().stars.r5 || 0) > 0, 'Title: Riftwalker'],
  [TITLES, 'ascendant', () => V5_STATS.ascBest >= 8, 'Title: Ascendant'],
  [TITLES, 'perfect-form', () => V5_STATS.perfect >= 25, 'Title: Perfect Form'],
];
function masteryCount(tier) { return listOf(WEAPONS).filter(w => !w.hidden && masteryTier(w.key) >= tier).length; }
let V5_SEEN = null;    // mastery tiers already announced (seeded silently at boot)
function v5CheckUnlocks(quiet) {
  for (const [reg, key, test, text] of V5_UNLOCKS) {
    if (!reg[key] || !reg[key].hidden) continue;
    let ok = false; try { ok = test(); } catch (e) { report(e, 'v5 unlock ' + key); }
    if (!ok) continue;
    reg[key].hidden = false;
    if (!quiet) toast('Unlocked!', text, '★', '#ffd84a');
  }
  const now = {};
  for (const w of listOf(WEAPONS)) if (!w.hidden) now[w.key] = masteryTier(w.key);
  if (V5_SEEN && !quiet) for (const k in now) if (now[k] > (V5_SEEN[k] ?? -1) && now[k] >= 0) {
    const m = MASTERY[now[k]];
    toast(`${WEAPONS[k].name}: ${m.name} mastery`, now[k] >= 2 ? 'Its swings now glow in your colours.' : 'Badge shown in the loadout and codex.', '✦', m.color);
  }
  V5_SEEN = now;
}

// ---------- statuses ----------
defStatus('counter', { name: 'Counter', icon: '↯', color: '#8cf6ff', max: 1.5,
  draw(ctx, f) { const c = chest(f); circle(ctx, c.x, c.y, 34 * f.scale, null, rgba('#8cf6ff', .35 + .25 * Math.sin(G_STATE.t * 20)), 2); } });
defStatus('overclock', { name: 'Overclock', icon: '⚙', color: '#ff8a2e', max: 5, cdMul: .7,
  onEnd(f) { if (f.alive) { addStatus(f, 'overheat', 1.6, 1, f); const c = chest(f); float(c.x, c.y - 50, 'OVERHEAT', '#ff5c48', 16); } } });
defStatus('overheat', { name: 'Overheated', icon: '♨', color: '#ff5c48', debuff: true, max: 2, moveMul: .75, cdMul: 1.3 });
defStatus('tempo', { name: 'Tempo', icon: '♪', color: '#5dff9a', max: 7, cdMul: .65, moveMul: .8 });
defStatus('quicksilver', { name: 'Quicksilver', icon: '☿', color: '#c9f0ff', max: 8, takenMul: 1.15 });
defStatus('siphon', { name: 'Siphon', icon: '⚱', color: '#ff3d7a', max: 4, moveMul: .5,
  tick(f, dt) {
    const foe = nearestEnemy(f);
    if (!foe || !foe.alive || dist(chest(foe), chest(f)) > 280) return;
    f.mem.siphonAcc = (f.mem.siphonAcc || 0) + dt;
    if (f.mem.siphonAcc < .25) return;
    f.mem.siphonAcc = 0;
    const got = damage(foe, 1.5, { src: f, kind: 'status', small: true, color: '#ff3d7a' });
    if (got > 0) { heal(f, got, false); const a = chest(foe), b = chest(f); beam(a.x, a.y, b.x, b.y, '#ff3d7a', 3, .15); }
  } });

// ---------- skills ----------
defSkill('overclock', {
  name: 'Overclock', icon: '⚙', color: '#ff8a2e', cd: 14, sfx: 'rift-charge', order: 40,
  desc: 'For 5 s attacks recover 30% faster and skill cooldowns tick 60% faster. Then you overheat: slowed for 1.6 s.',
  use(f) { addStatus(f, 'overclock', 5, 1, f); const c = chest(f); ring(c.x, c.y, 70, '#ff8a2e', .4, 4); burst(c.x, c.y, '#ffb347', 16, 260); },
  ai: { when: (f, foe, d) => d < 260 && f.hp > 30 },
});
defSkill('rewind', {
  name: 'Rift Recall', icon: '⟲', color: '#b98cff', cd: 12, sfx: 'rift-phase', order: 41,
  desc: 'Leave an echo where you stand. 2.5 s later you snap back to it and recover half the health you lost meanwhile.',
  use(f) {
    if (!f.grounded) return false;
    const c = chest(f);
    f.mem.rewind = { x: f.P[2].x, y: feetY(f), hp: f.hp, t: 2.5 };
    f.mem.rewind.zone = skillZone({ owner: f, x: f.P[2].x, y: feetY(f), life: 2.6,
      draw(ctx, z) {
        const k = z.t / 2.5;
        ctx.save(); ctx.globalAlpha = .35 + .25 * Math.sin(z.t * 10);
        lineXY(ctx, z.x, z.y - 10, z.x, z.y - 80 * f.scale, '#b98cff', 4); circle(ctx, z.x, z.y - 95 * f.scale, 14 * f.scale, null, '#b98cff', 3);
        ctx.restore();
        circle(ctx, z.x, z.y - 4, 26, null, rgba('#b98cff', .6), 2);
        ctx.beginPath(); ctx.arc(z.x, z.y - 4, 26, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
      } });
    ring(c.x, c.y, 50, '#b98cff', .3, 3);
  },
  ai: { when: (f, foe, d) => f.grounded && d < 170 && f.hp > 25 && !skillOverPit(f) },
});
defSkill('blood-pact', {
  name: 'Blood Pact', icon: '♥', color: '#ff3d5a', cd: 18, sfx: 'rift-pop', order: 42,
  desc: 'Pay 15% of your max health (never fatal) for 35 super meter.',
  use(f) {
    if (f.super >= 100 || f.hp <= f.maxHp * .2) return false;
    const cost = Math.round(f.maxHp * .15), c = chest(f);
    f.hp = Math.max(1, f.hp - cost);
    float(c.x, c.y - 40, '-' + cost, '#ff3d5a', 20);
    gainSuper(f, 35);
    burst(c.x, c.y, '#ff3d5a', 18, 260); ring(c.x, c.y, 56, '#ff3d5a', .35, 4);
  },
  ai: { when: (f, foe, d) => f.super >= 50 && f.super < 100 && f.hp > f.maxHp * .55 && d > 220 },
});

// ---------- orbs (each with a cost) ----------
defOrb('tempo', { name: 'Tempo', icon: '♪', color: '#5dff9a', weight: .7, desc: 'Attack 35% faster for 7 s, but move 20% slower.',
  grab(f) { addStatus(f, 'tempo', 7, 1, f); } });
defOrb('quicksilver', { name: 'Quicksilver', icon: '☿', color: '#c9f0ff', weight: .7,
  desc: 'For 8 s: perfect-dodge window ×1.8 and dash cooldown halved, but you take 15% more damage.',
  grab(f) { addStatus(f, 'quicksilver', 8, 1, f); f.dashCd = 0; } });
defOrb('siphon', { name: 'Siphon', icon: '⚱', color: '#ff3d7a', weight: .6,
  desc: 'For 4 s drain 6 health a second from the nearest foe within reach, but you are slowed by half.',
  grab(f) { addStatus(f, 'siphon', 4, 1, f); } });

// ---------- perfect dodge, counter, phased, Ascension relics: one wrapper around damage ----------
const PERFECT = { window: .13, cool: 1.1, counterMul: 1.35, phasedMul: 1.35 };
on('dash', f => {
  f.mem.dashAt = G_STATE.t;
  if (f.status.quicksilver) f.dashCd *= .5;
});
const _v5Attack = attack;
attack = function (f) { f.mem.atkAt = G_STATE.t; return _v5Attack.apply(this, arguments); };
function perfectWindow(B) { return PERFECT.window * (B.status.quicksilver ? 1.8 : 1) * ((B.asc && B.asc.perfect) || 1); }
function perfectDodge(B, A, o, kind) {
  if (!(B.dashT > 0) || B.mem.dashAt == null || B.summon) return false;
  if (kind !== 'melee' && kind !== 'proj' && kind !== 'skill') return false;
  if (o.blast || o.unblockable || kind === 'status') return false;
  const since = G_STATE.t - B.mem.dashAt;
  if (since > perfectWindow(B) || G_STATE.t < (B.mem.perfectCd || 0)) return false;
  // Only a read counts: the attack (or shot) must have started before the dash did.
  if (kind === 'melee' && A && (A.mem.atkAt ?? -1) > B.mem.dashAt) return false;
  if (o.proj && o.proj.t != null && o.proj.t < since) return false;
  if (aiBrain(B) && !chance(aiLevel(B).dodge)) return false;     // CPUs earn it at their dodge skill (easy 8%, insane 80%)
  B.mem.perfectCd = G_STATE.t + PERFECT.cool;
  B.inv = Math.max(B.inv, .25);
  B.dashCd = Math.min(B.dashCd, .15);
  gainSuper(B, 15);
  addStatus(B, 'counter', 1.2, 1, B);
  if (o.proj) o.proj.pierce = Math.max(o.proj.pierce || 0, 1) + 1;
  const c = chest(B);
  float(c.x, c.y - 70, 'PERFECT!', '#8cf6ff', 24);
  ring(c.x, c.y, 60, '#8cf6ff', .35, 4); burst(c.x, c.y, '#e8fbff', 14, 300);
  sfx('rift-perfect');
  if (v5On('v5Slowmo') && !G_STATE.sim && !aiBrain(B)) slowmo(.28, .35);   // only your own dodges slow time
  if (B.asc && B.asc.perfectHeal) heal(B, B.asc.perfectHeal);
  if (!aiBrain(B) && !G_STATE.cfg.autopilot) { V5_STATS.perfect++; v5StatSave(); }
  emit('perfectDodge', B, A);
  return true;
}
const _v5Damage = damage;
damage = function (B, amount, o = {}) {
  if (!B || !B.alive || !(amount > 0)) return _v5Damage(B, amount, o);
  const A = o.src && o.src !== B ? o.src : null, kind = o.kind || 'melee';
  const direct = kind !== 'status' && kind !== 'hazard' && kind !== 'ringout' && kind !== 'thorns';
  if (direct && !(B.inv > 0) && perfectDodge(B, A, o, kind)) return 0;
  let amt = amount, tag = null;
  if (direct && A) {
    if (A.status.counter) { amt *= PERFECT.counterMul; removeStatus(A, 'counter'); tag = ['COUNTER', '#8cf6ff']; }
    if (B.status.phased) { amt *= PERFECT.phasedMul; removeStatus(B, 'phased'); tag = tag || ['PHASED', '#b98cff']; }
  }
  // Ascension relics / foe affixes
  if (B.asc && B.asc.second > 0 && amt >= B.hp && kind !== 'ringout') {
    B.asc.second--; amt = Math.max(0, B.hp - 1);
    B.inv = Math.max(B.inv, 1); const c = chest(B);
    float(c.x, c.y - 70, 'SECOND WIND!', '#5dff9a', 22); ring(c.x, c.y, 80, '#5dff9a', .5, 5); sfx('rift-relic');
    if (amt <= 0) return 0;
  }
  const dealt = _v5Damage(B, amt, o);
  if (dealt > 0) {
    if (tag) { const c = chest(B); float(c.x, c.y - 84, tag[0], tag[1], 18); if (tag[0] === 'COUNTER' && A && !aiBrain(A)) { V5_STATS.counters++; v5StatSave(); } }
    if (A && A.asc && A.asc.steal && direct && A.alive) heal(A, dealt * A.asc.steal, dealt * A.asc.steal >= 2);
    if (A && B.asc && B.asc.thorns && kind === 'melee' && A.alive) damage(A, B.asc.thorns, { src: B, kind: 'thorns', small: true, color: '#7dff6a' });
    if ((o.kb || 0) >= 420 || dealt >= 12) B.mem.launchAt = G_STATE.t;    // tech recovery window opens
  }
  return dealt;
};

// ---------- tech recovery: hold/tap guard just before you land after a big hit ----------
const TECH = { buffer: .22, window: 1.3, inv: .3 };
const _v5Drive = drive;
drive = function (f, dt) {
  if (!f.alive) return _v5Drive(f, dt);
  // Landing = airborne last tick, grounded now (the contact flags are only refreshed by the physics step).
  const wasAir = !!f.mem.v5Air, inp = f.inp || {};
  if (inp.block || (inp.blockHeld && !f.mem.blockPrev)) f.mem.techBuf = TECH.buffer;
  f.mem.blockPrev = !!inp.blockHeld;
  if (f.mem.techBuf > 0) f.mem.techBuf -= dt;
  _v5Drive(f, dt);
  f.mem.v5Air = !f.grounded;
  if (!wasAir || !f.grounded || f.summon || f.heldBy || f.status.stun || f.status.freeze) return;
  if (G_STATE.t - (f.mem.launchAt ?? -9) > TECH.window || f.mem.techUsed === f.mem.launchAt) return;
  const helpless = f.tumble > 0 || f.stagger > .08 || G_STATE.t - f.mem.launchAt < .9;
  if (!helpless) return;
  const ok = aiBrain(f) ? chance(aiLevel(f).dodge * .7) : f.mem.techBuf > 0;
  f.mem.techUsed = f.mem.launchAt;
  if (!ok) return;
  f.tumble = 0; f.stagger = 0; f.inv = Math.max(f.inv, TECH.inv); f.mem.techBuf = 0;
  const dir = Math.sign(inp.mx || 0) || -f.face;
  for (const p of f.P) { p.ox = p.x - dir * 320 * DT; }
  const c = chest(f);
  float(c.x, c.y - 60, 'TECH!', '#8cf6ff', 20); ring(f.P[2].x, feetY(f), 40, '#8cf6ff', .3, 3);
  burst(f.P[2].x, feetY(f), '#c9f0ff', 10, 220);
  sfx('rift-tech');
  if (!aiBrain(f) && !G_STATE.cfg.autopilot) { V5_STATS.tech++; v5StatSave(); }
};

// Skill-timer ticks the engine doesn't own: Overclock's faster cooldowns and Rift Recall's snap-back.
on('mapStep', dt => {
  if (G_STATE.lock > 0) return;
  for (const f of F) {
    if (!f.alive) continue;
    if (f.status.overclock) for (let k = 0; k < 2; k++) if (f.skillCd[k] > 0) f.skillCd[k] = Math.max(0, f.skillCd[k] - dt * .6);
    const rw = f.mem.rewind;
    if (rw && (rw.t -= dt) <= 0) {
      f.mem.rewind = null;
      if (rw.zone) rw.zone.dead = true;
      const from = chest(f);
      moveFighter(f, rw.x - f.P[2].x, rw.y - feetY(f));
      for (const p of f.P) { p.ox = p.x; p.oy = p.y; }
      f.tumble = 0; f.inv = Math.max(f.inv, .2);
      const to = chest(f), lost = rw.hp - f.hp;
      beam(from.x, from.y, to.x, to.y, '#b98cff', 8, .3); ring(to.x, to.y, 60, '#b98cff', .35, 4);
      if (lost > 0) heal(f, lost / 2);
      sfx('rift-phase');
    }
    // Ascension regen affix
    if (f.asc && f.asc.regen && f.hp < f.maxHp) f.hp = Math.min(f.maxHp, f.hp + f.asc.regen * dt);
    // Mastery swing glow (cosmetic): Gold and Mythic weapons trail sparks in the tier colour while swinging.
    if (v5On('v5MasteryFx') && !aiBrain(f) && !f.summon && f.atkCd > 0 && chance(.35) && !G_STATE.sim) {
      const t = masteryTierCached(f.wkey);
      if (t >= 2) { const tip = f.P[f.tip] || f.P[f.main.hand]; burst(tip.x, tip.y, MASTERY[t].color, 1, 60, { life: .3 }); }
    }
  }
});
const MASTERY_CACHE = {};
function masteryTierCached(key) { return key in MASTERY_CACHE ? MASTERY_CACHE[key] : (MASTERY_CACHE[key] = masteryTier(key)); }
on('roundEnd', () => { for (const k in MASTERY_CACHE) delete MASTERY_CACHE[k]; });
on('roundStart', () => { for (const f of F) { f.mem.rewind = null; } });

// ---------- CPU: weapon-specific brains for melee weapons too (engine only ran them for guns) ----------
// (the call site in aiMicro is patched by the build to drop its `&& f.w.ranged`; no original melee weapon has one)
if (WEAPONS['bass-drop']) WEAPONS['bass-drop'].ai.think = (f, foe, d) => {
  // Hard and Insane CPUs hold a swing until it will land on the beat (~0.12 s after the press); lower levels swing freely.
  if (aiLevel(f).punish < .7) return;
  const onBeat = bassOnBeat(G_STATE.t + .12);
  if (f.inp.attack && !onBeat) { f.inp.attack = false; f.mem.bassQ = G_STATE.t + .7; }
  else if (f.mem.bassQ && G_STATE.t < f.mem.bassQ && onBeat && f.atkCd <= 0 && d < 170) { f.inp.attack = true; f.mem.bassQ = 0; }
};

// ---------- Ascension: a roguelite climb with relics ----------
const ASC_RELICS = {
  'ember-heart': { name: 'Ember Heart', icon: '❤', color: '#ff5c48', desc: '+20 max health.', apply(f, a, n) { f.maxHp += 20 * n; } },
  whetstone: { name: 'Whetstone', icon: '⚔', color: '#ffd84a', desc: 'Deal 12% more damage.', apply(f, a, n) { f.dmgCls = (f.dmgCls || 1) * Math.pow(1.12, n); } },
  'iron-skin': { name: 'Iron Skin', icon: '⛨', color: '#c9cdee', desc: 'Take 12% less damage.', apply(f, a, n) { f.dmgTakenMul = (f.dmgTakenMul || 1) * Math.pow(.88, n); } },
  fang: { name: 'Vampire Fang', icon: '🦷', color: '#ff3d5a', desc: 'Heal 10% of the damage you deal.', apply(f, a, n) { a.steal += .1 * n; } },
  briar: { name: 'Briar Mail', icon: '❦', color: '#7dff6a', desc: 'Foes who hit you in melee take 3 damage.', apply(f, a, n) { a.thorns += 3 * n; } },
  tailwind: { name: 'Tailwind', icon: '»', color: '#8cf6ff', desc: 'Move 10% faster; dash cooldown −25%.', apply(f, a, n) { f.spdMul = (f.spdMul || 1) * Math.pow(1.1, n); f.dashCdMul = (f.dashCdMul || 1) * Math.pow(.75, n); } },
  battery: { name: 'Battery', icon: '⚡', color: '#ffe94a', desc: 'Start every fight with 40 super; +15% super gain.', apply(f, a, n) { f.super = Math.min(100, 40 * n); f.superMul = (f.superMul || 1) * Math.pow(1.15, n); } },
  'second-wind': { name: 'Second Wind', icon: '✚', color: '#5dff9a', desc: 'Once per fight, a K.O. hit leaves you at 1 health instead.', apply(f, a, n) { a.second += n; } },
  'glass-edge': { name: 'Glass Edge', icon: '◇', color: '#e8fbff', desc: 'Deal 30% more damage, take 20% more.', apply(f, a, n) { f.dmgCls = (f.dmgCls || 1) * Math.pow(1.3, n); f.dmgTakenMul = (f.dmgTakenMul || 1) * Math.pow(1.2, n); } },
  quickdraw: { name: 'Quickdraw', icon: '✦', color: '#b98cff', desc: 'Skill cooldowns −20%.', apply(f, a, n) { f.skillCdMul = (f.skillCdMul || 1) * Math.pow(.8, n); } },
  'rift-step': { name: 'Rift Step', icon: '☿', color: '#c9f0ff', desc: 'Perfect-dodge window ×1.6; each perfect dodge heals 5.', apply(f, a, n) { a.perfect *= Math.pow(1.6, n); a.perfectHeal += 5 * n; } },
  medic: { name: 'Field Medic', icon: '⚕', color: '#5dff9a', desc: 'Recover 20 extra health between floors.', apply() {} },
};
const ASC_AFFIXES = {
  swift: { name: 'Swift', color: '#8cf6ff', apply(f) { f.spdMul = (f.spdMul || 1) * 1.15; f.dashCdMul = (f.dashCdMul || 1) * .7; } },
  ironclad: { name: 'Ironclad', color: '#c9cdee', apply(f) { f.kbMul = (f.kbMul || 1) * .65; f.dmgTakenMul = (f.dmgTakenMul || 1) * .88; f.spdMul = (f.spdMul || 1) * .9; } },
  vampiric: { name: 'Vampiric', color: '#ff3d5a', apply(f, a) { a.steal += .2; } },
  thorned: { name: 'Thorned', color: '#7dff6a', apply(f, a) { a.thorns += 3; } },
  brutal: { name: 'Brutal', color: '#ff8a2e', apply(f) { f.dmgCls = (f.dmgCls || 1) * 1.18; } },
  regen: { name: 'Regenerating', color: '#5dff9a', apply(f, a) { a.regen += 1.2; } },
};
const ASC_HEAL = 25, ASC_CHAMP_EVERY = 4;
function ascBlank() { return { steal: 0, thorns: 0, second: 0, perfect: 1, perfectHeal: 0, regen: 0 }; }
function ascFoes(n, diff, playerColor) {
  const champ = n % ASC_CHAMP_EVERY === 0;
  const lv = clamp(Math.floor((n - 1) / 3) + (DIFF_SHIFT[diff] || 0) - 1 + (champ ? 1 : 0), 0, AI_ORDER.length - 1);
  const theme = pick(MODE_THEMES), lo = themeLoadout(theme);
  const weapon = champ && RIFT_WEAPONS.length ? pick(RIFT_WEAPONS) : lo.weapon;
  const skills = n < 3 ? (lo.skills || []).slice(0, 1) : lo.skills;
  // Difficulty comes from smarter levels, skills and affixes; health grows only a little past floor 8.
  const hpMul = (champ ? 1.05 : .85) * (1 + Math.max(0, n - 8) * .03);
  const nAff = champ ? 2 : n >= 9 ? 2 : n >= 3 ? 1 : 0;
  const affixes = shuffle(Object.keys(ASC_AFFIXES)).slice(0, nAff);
  return { affixes, entries: [modeEntry({ team: 1, ...lo, weapon, skills, color: champ ? '#ffd84a' : modeColor(playerColor), hat: champ ? 'none' : modeHat(),
    name: champ ? 'RIFT CHAMPION' : MODE_NAMES[(n * 5) % MODE_NAMES.length].toUpperCase(), aiLevel: AI_ORDER[lv],
    scale: champ ? 1.3 : 1, hpMul, spawn: 1 })] };
}
function ascDraftOptions(run) {
  const keys = shuffle(Object.keys(ASC_RELICS));
  return keys.slice(0, 3);
}
function ascCounts(run) { const c = {}; for (const k of run.relics) c[k] = (c[k] || 0) + 1; return c; }
function ascApplyAll(run) {
  const me = F.find(f => f.id === 0), counts = ascCounts(run);
  if (me) {
    me.asc = ascBlank();
    for (const k in counts) ASC_RELICS[k].apply(me, me.asc, counts[k]);
  }
  for (const f of F) if (f.team === 1 && !f.summon) {
    f.asc = ascBlank();
    for (const k of run.affixes || []) ASC_AFFIXES[k].apply(f, f.asc);
    if (run.floor % ASC_CHAMP_EVERY === 0) { f.isBoss = true; f.kbMul = (f.kbMul || 1) * .75; }
  }
}
function ascPick(run, k) {
  const key = run.draft.opts[k];
  run.relics.push(key);
  run.draft = null;
  G_STATE.lock = Math.min(G_STATE.lock, .9);
  const r = ASC_RELICS[key];
  sfx('rift-relic');
  ascApplyAll(run);
  const me = F.find(f => f.id === 0);
  if (me && key === 'ember-heart') me.hp = Math.min(me.maxHp, me.hp + 20);
  if (me) { const c = chest(me); ring(c.x, c.y, 70, r.color, .45, 4); burst(c.x, c.y, r.color, 20, 300); }
  ascBanner(run, r.name.toUpperCase() + ' TAKEN');
}
function ascBanner(run, pre) {
  const champ = run.floor % ASC_CHAMP_EVERY === 0, aff = (run.affixes || []).map(k => ASC_AFFIXES[k].name).join(' · ');
  banner('FLOOR ' + run.floor, pre || (champ ? 'CHAMPION' : 'FIGHT!') + (aff ? '  ·  ' + aff.toUpperCase() : ''), 1.8, champ ? '#ffd84a' : null);
}
// Draft cards, in screen space. The hit boxes are shared with the pointer handler.
function ascCardRects() {
  const cw = 300, ch = 250, gap = 34, x0 = W / 2 - (cw * 3 + gap * 2) / 2, y = H / 2 - ch / 2 + 20;
  return [0, 1, 2].map(i => ({ x: x0 + i * (cw + gap), y, w: cw, h: ch }));
}
function ascWrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
const ASC_PICK_TIME = 20;
defMode('ascension', {
  name: 'Ascension', icon: '⇑', order: 54,
  desc: 'A roguelite climb: one duel per floor, a Rift Champion every 4th. Win to draft 1 of 3 relics that stack for the run. Health carries over; one loss ends the climb.',
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], roundLimit: 120,
  setup(cfg) {
    const player = humanEntry(cfg, 0, 0, 0, 'YOU'), first = ascFoes(1, cfg.diff, player.color);
    return { roster: [player, ...first.entries], run: { floor: 1, cleared: 0, relics: [], affixes: first.affixes, hp: null, draft: null, pending: false } };
  },
  roundLabel() { return 'FLOOR ' + modeRun().floor; },
  onRoundStart() {
    const run = modeRun();
    G_STATE.winScore = 0;
    ascApplyAll(run);
    const me = F.find(f => f.id === 0);
    if (me && run.hp != null) {
      const champBefore = (run.floor - 1) % ASC_CHAMP_EVERY === 0;
      const extra = ASC_HEAL + 20 * (ascCounts(run).medic || 0);
      me.hp = me.hpShow = champBefore ? me.maxHp : Math.min(me.maxHp, run.hp + extra);
    }
    if (run.pending) {
      run.pending = false;
      run.draft = { opts: ascDraftOptions(run), sel: 1, t: 0, mxPrev: 0 };
      G_STATE.lock = Math.max(G_STATE.lock, 1);
      BANNER = null;
    } else ascBanner(run);
  },
  onStep(dt) {
    const run = modeRun(), d = run.draft;
    if (!d) return;
    G_STATE.lock = Math.max(G_STATE.lock, .9);
    d.t += dt;
    const me = F.find(f => f.id === 0), inp = (me && me.inp) || {};
    const auto = !me || aiBrain(me) || G_STATE.cfg.autopilot || G_STATE.sim;
    if (auto && d.t > .6) return ascPick(run, 0);
    const mx = Math.sign(inp.mx || 0);
    if (mx && mx !== d.mxPrev && d.t > .25) { d.sel = clamp(d.sel + mx, 0, 2); sfx('nav', .6, true); }
    d.mxPrev = mx;
    if (d.click != null) { const k = d.click; d.click = null; if (k === d.sel) return ascPick(run, k); d.sel = k; }
    if (d.t > .45 && (inp.attack || inp.jump)) return ascPick(run, d.sel);
    if (d.t > ASC_PICK_TIME) ascPick(run, d.sel);
  },
  roundOver(winner) {
    const run = modeRun(), me = F.find(f => f.id === 0);
    if (!me || winner !== 0) return 'match';
    run.cleared++; run.floor++; run.hp = Math.max(1, me.hp); run.pending = true;
    const next = ascFoes(run.floor, G_STATE.cfg.diff, G_STATE.roster[0].color);
    run.affixes = next.affixes;
    G_STATE.roster = [G_STATE.roster[0], ...next.entries];
    return 'next';
  },
  hud(ctx) {
    const run = modeRun(), best = Math.max(V5_STATS.ascBest, run.cleared);
    const counts = ascCounts(run), relicLine = Object.keys(counts).map(k => ASC_RELICS[k].icon + (counts[k] > 1 ? '×' + counts[k] : '')).join(' ');
    modeText(ctx, `Floor ${run.floor}  ·  Cleared ${run.cleared}  ·  Best ${best}${relicLine ? '  ·  ' + relicLine : ''}`, W / 2, H - 22, 14, '#c9cdee', 'center', '600 ' + FONT_BODY);
    const d = run.draft;
    if (!d) return;
    ctx.save();
    ctx.fillStyle = 'rgba(5,4,14,.78)'; ctx.fillRect(0, 0, W, H);
    modeText(ctx, `FLOOR ${run.floor - 1} CLEARED`, W / 2, 130, 34, '#ffd84a', 'center');
    modeText(ctx, 'Choose a relic for the rest of the climb', W / 2, 172, 18, '#c9cdee', 'center', '600 ' + FONT_BODY);
    ascCardRects().forEach((r, i) => {
      const key = d.opts[i], rel = ASC_RELICS[key], sel = i === d.sel, have = counts[key] || 0;
      ctx.fillStyle = sel ? 'rgba(40,30,80,.95)' : 'rgba(20,16,44,.9)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = sel ? rel.color : 'rgba(150,140,220,.4)'; ctx.lineWidth = sel ? 4 : 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
      modeText(ctx, rel.icon, r.x + r.w / 2, r.y + 70, 46, rel.color, 'center', '400 46px ' + FONT_BODY);
      modeText(ctx, rel.name.toUpperCase(), r.x + r.w / 2, r.y + 122, 20, '#ffffff', 'center');
      ctx.font = '500 16px ' + FONT_BODY;
      ascWrap(ctx, rel.desc, r.w - 40).forEach((ln, k) => modeText(ctx, ln, r.x + r.w / 2, r.y + 156 + k * 21, 16, '#dfe2ff', 'center', '500 ' + FONT_BODY));
      if (have) modeText(ctx, `Owned ×${have}`, r.x + r.w / 2, r.y + r.h - 18, 14, rel.color, 'center', '600 ' + FONT_BODY);
    });
    const left = Math.max(0, Math.ceil(ASC_PICK_TIME - d.t));
    modeText(ctx, `${touchUI() ? 'Tap a card twice' : 'Move left / right to choose · Attack or Jump to take it'}  ·  auto-pick in ${left}s`, W / 2, H - 90, 15, '#c9cdee', 'center', '600 ' + FONT_BODY);
    ctx.restore();
  },
  results() {
    const run = modeRun(), best = Math.max(V5_STATS.ascBest, run.cleared);
    if (!G_STATE.cfg.autopilot && best > V5_STATS.ascBest) { V5_STATS.ascBest = best; v5StatSave(); }
    const names = Object.entries(ascCounts(run)).map(([k, n]) => ASC_RELICS[k].name + (n > 1 ? ' ×' + n : ''));
    return { title: `Reached floor ${run.floor}`, color: run.cleared >= best && run.cleared ? '#ffd84a' : '#ff8a2e',
      lines: [`${run.cleared} floor${run.cleared === 1 ? '' : 's'} cleared (${levelName(modeDiff())}).`,
        names.length ? 'Relics: ' + names.join(', ') : 'No relics drafted.', run.cleared >= best && run.cleared ? 'New personal best!' : `Personal best: ${best} floors.`] };
  },
});

// ---------- Mythic Quest: Neon Rift art + the hold goal ----------
CAMP_BG.rift = ['#12052a', '#3a0f4f'];
CAMP_DECOR_DRAW.rift = function (g, x, y, s, v, t) {
  if (v < .5) {                                              // floating broken platforms
    const b = Math.sin(t * .8 + v * 9) * 3 * s;
    poly(g, [{ x: x - 20 * s, y: y + b }, { x: x + 20 * s, y: y + b }, { x: x + 8 * s, y: y + 14 * s + b }, { x: x - 10 * s, y: y + 12 * s + b }], '#241447', '#9a7cff', 1.5);
    g.fillStyle = '#ff5ad1'; g.fillRect(x - 20 * s, y - 2 * s + b, 40 * s, 3 * s);
  } else glow(g, '#5ef2ff', 12, () => poly(g, [{ x: x - 7 * s, y }, { x, y: y - 20 * s }, { x: x + 7 * s, y }, { x, y: y + 8 * s }],
    rgba(v > .75 ? '#5ef2ff' : '#ff5ad1', .55 + .35 * Math.sin(t * 2.4 + v * 13)), null));
};
CAMP_AMBIENT.rift = function (g, x, y, w, h, k, t) {
  const cx = x + w / 2, cy = y + h * .45, r = Math.min(w, h) * .32;
  g.save(); g.globalAlpha = .35;
  for (let a = 0; a < 3; a++) { g.beginPath(); g.ellipse(cx, cy, r * (1 - a * .25), r * .45 * (1 - a * .25), t * .3 + a, 0, TAU); g.strokeStyle = a % 2 ? '#ff5ad1' : '#9a7cff'; g.lineWidth = 2 * k; g.stroke(); }
  g.restore();
  campMotes(g, x, y, w, h, k, t, '#ff8ae6', 14, .6, -.4);
};
function questHold(run, me, goal, dt) {
  const zx = goal.x ?? W / 2, zw = goal.w || 220;
  if (!run.holdZone || run.holdZone.dead) {
    run.hold = run.hold || 0;
    const y = MAP.floor != null ? MAP.floor : (groundBelow(zx, H * .45) ?? H - 80);
    run.holdZone = skillZone({ owner: null, x: zx, y, life: 1e6,
      draw(ctx, z) {
        const k = clamp((run.hold || 0) / goal.secs, 0, 1), col = run.holdState === 'contested' ? '#ff5c48' : run.holdState === 'on' ? '#7dff6a' : '#5ef2ff';
        ctx.save(); ctx.globalAlpha = .18 + .1 * Math.sin(z.t * 4);
        ctx.fillStyle = col; ctx.fillRect(z.x - zw / 2, z.y - 140, zw, 140);
        ctx.restore();
        lineXY(ctx, z.x - zw / 2, z.y - 2, z.x + zw / 2, z.y - 2, rgba(col, .6), 5);
        lineXY(ctx, z.x - zw / 2, z.y - 2, z.x - zw / 2 + zw * k, z.y - 2, '#ffffff', 5);
      } });
  }
  const inZone = f => f.alive && Math.abs(f.P[2].x - zx) < zw / 2 && Math.abs(feetY(f) - run.holdZone.y) < 150;
  const mine = inZone(me), theirs = F.some(f => f.team !== 0 && !f.summon && inZone(f));
  run.holdState = mine && theirs ? 'contested' : mine ? 'on' : 'off';
  if (run.holdState === 'on') run.hold += dt;
  else if (!mine) run.hold = Math.max(0, run.hold - dt * .35);
  if (run.holdState === 'on' && Math.floor(run.hold * 4) !== Math.floor((run.hold - dt) * 4)) burst(zx + rnd(-zw / 2, zw / 2), run.holdZone.y, '#7dff6a', 1, 120, { life: .5 });
  return run.hold >= goal.secs;
}
function questHoldText(g, run) {
  const v = run ? Math.min(g.secs, run.hold || 0) : 0, st = run && run.holdState === 'contested' ? '  ·  CONTESTED' : run && run.holdState === 'off' ? '  ·  GET IN THE ZONE' : '';
  return `HOLD THE WELL  ${v.toFixed(1)} / ${g.secs} s${st}`;
}

// ---------- loadout: tier + mastery in the weapon grid and the preview ----------
const _v5WeaponCell = typeof weaponCell === 'function' ? weaponCell : null;
if (_v5WeaponCell) weaponCell = function (w) {
  const node = _v5WeaponCell.apply(this, arguments);
  try {
    const def = typeof w === 'string' ? WEAPONS[w] : w, tile = node && node.querySelector('.w-tile');
    if (tile && def && def.key) {
      const t = masteryTier(def.key), tier = weaponTier(def);
      if (tier !== 'common') tile.append(el('span', { class: 'v5-tier', style: { '--tc': TIER_INFO[tier].color }, text: TIER_INFO[tier].name[0], title: TIER_INFO[tier].name }));
      if (t >= 0) tile.append(el('span', { class: 'v5-mastery', style: { '--mc': MASTERY[t].color }, title: MASTERY[t].name + ' mastery', text: '✦' }));
    }
  } catch (e) { report(e, 'v5 weaponCell'); }
  return node;
};
const _v5Preview = previewPane;
previewPane = function (i, lo) {
  const node = _v5Preview.apply(this, arguments);
  try {
    const key = lo && (lo.weapon || lo.w), def = WEAPONS[key];
    if (node && def) {
      const tier = weaponTier(def), t = masteryTier(key);
      node.append(el('div', { class: 'v5-preview' },
        el('span', { class: 'v5-chip', style: { '--tc': TIER_INFO[tier].color }, text: TIER_INFO[tier].name }),
        el('span', { class: 'v5-chip', style: { '--tc': t >= 0 ? MASTERY[t].color : '#8088b0' }, text: masteryText(key) })));
    }
  } catch (e) { report(e, 'v5 previewPane'); }
  return node;
};

// ---------- codex: tiers, mastery and a Techniques tab ----------
const V5_TECHNIQUES = [
  { name: 'Perfect Dodge', icon: '☿', text: 'Dash just as an attack or shot that was already coming would hit (the first ~0.13 s of the dash). You take nothing, gain 15 super, your dash refreshes and your next hit within 1.2 s is a COUNTER for +35% damage. Explosions and unblockables can\u2019t be perfect-dodged.' },
  { name: 'Tech Recovery', icon: '⤒', text: 'After a big hit launches you, tap Guard in the moment before you land. You skip the stagger and tumble, roll a step (toward the direction you hold) and are briefly untouchable.' },
  { name: 'Counter', icon: '↯', text: 'Earned from a Perfect Dodge. The next damaging hit you land deals +35%. Use it quickly: it fades after 1.2 s.' },
  { name: 'Phased', icon: '◈', text: 'Phase Rifle shots and the Glass Hour rift event mark a fighter. The next hit they take deals +35%, then the mark is gone.' },
  { name: 'Guard, Parry, Guard Break', icon: '⛨', text: 'Hold Guard to block from the front for chip damage; raise it right as a hit lands to parry. Heavy weapons and the Aegis Tower\u2019s bash wear a guard down until it breaks.' },
  { name: 'Weapon Mastery', icon: '✦', text: 'Every weapon earns mastery as you use it (1 point a round, 2 per round won, 1 per K.O.). Bronze 8, Silver 30, Gold 90, Mythic 220. Rewards are cosmetic only: badges, a swing glow at Gold, weapon skins and titles.' },
  { name: 'Ascension Relics', icon: '⇑', text: 'In Ascension you draft one of three relics after every floor. Relics stack. Foes on later floors carry affixes (Swift, Ironclad, Vampiric, Thorned, Brutal, Regenerating) instead of simply having more health.' },
];
CODEX_TABS.push(['t', 'Techniques']);
const _v5CodexEntries = codexEntries;
codexEntries = function (tab) {
  if (tab === 't') return V5_TECHNIQUES.map(t => ({ name: t.name, icon: t.icon, text: t.text, lore: '', stats: null }));
  const list = _v5CodexEntries.apply(this, arguments);
  if (tab === 'w') for (const e of list) {
    const key = e.weapon;
    if (!key || !WEAPONS[key]) continue;
    const tier = weaponTier(WEAPONS[key]);
    e.text = `${TIER_INFO[tier].name} · ${masteryText(key)}${e.text ? ' · ' + e.text : ''}`;
  }
  return list;
};

// ---------- sounds for the rift arsenal and the new mechanics ----------
defSfx('rift-chrono', () => { tone(1800, 600, .25, 'sine', .14); tone(900, 1400, .2, 'triangle', .08, .05); });
defSfx('rift-charge', () => { tone(220, 880, .35, 'sawtooth', .07); noiseSweep(.3, 400, 3000, .08); });
defSfx('rift-grav', () => { thump(70, 30, .5, .5); tone(160, 60, .5, 'sine', .15); });
defSfx('rift-boom', () => { noise(.55, 260, .6, 'lowpass'); thump(90, 28, .5, .7); });
defSfx('rift-echo', () => { for (let k = 0; k < 3; k++) tone(1200 - k * 200, 700, .1, 'triangle', .07 / (k + 1), k * .07); });
defSfx('rift-vine', () => { noiseSweep(.25, 600, 2000, .12); tone(300, 180, .2, 'square', .04); });
defSfx('rift-phase', () => { tone(400, 1600, .2, 'sine', .1); tone(1600, 400, .2, 'sine', .06, .12); });
defSfx('rift-prism', () => { for (let k = 0; k < 4; k++) tone(1400 + k * 500, 2000 + k * 400, .18, 'sine', .05, k * .03); });
defSfx('rift-pop', () => { tone(600, 200, .12, 'square', .08); noise(.08, 1500, .1); });
defSfx('rift-bash', () => { thump(140, 50, .25, .6); noise(.2, 700, .35, 'lowpass'); });
defSfx('rift-anchor', () => { thump(60, 25, .6, .8); noise(.4, 300, .4, 'lowpass'); tone(180, 120, .4, 'triangle', .06); });
defSfx('rift-whistle', () => { tone(2400, 900, .5, 'sine', .06); });
defSfx('rift-sweep', () => { noiseSweep(.22, 500, 2600, .22); });
defSfx('rift-hook', () => { tone(900, 300, .18, 'sawtooth', .05); noiseSweep(.2, 2000, 600, .08); });
defSfx('rift-hook-hit', () => { thump(180, 80, .15, .5); tone(1200, 1500, .08, 'square', .05); });
defSfx('rift-kick', () => { thump(110, 40, .25, .8); noise(.25, 500, .5, 'lowpass'); });
defSfx('rift-mortar', () => { thump(130, 60, .2, .6); noise(.15, 900, .2); });
defSfx('rift-gloop', () => { tone(300, 120, .2, 'sine', .14); tone(500, 200, .15, 'sine', .06, .05); });
defSfx('rift-splat', () => { noise(.2, 500, .3, 'lowpass'); tone(200, 90, .15, 'sine', .1); });
defSfx('rift-rod', () => { tone(1400, 1800, .12, 'square', .05); noise(.1, 4000, .08, 'highpass'); });
defSfx('rift-zap', () => { noiseSweep(.18, 6000, 2500, .14, 'highpass'); tone(2200, 300, .15, 'sawtooth', .05); });
defSfx('rift-beat', () => { thump(70, 45, .14, .55); noise(.04, 6000, .05, 'highpass'); });
defSfx('rift-onbeat', () => { thump(55, 30, .3, .9); noise(.3, 220, .5, 'lowpass'); tone(110, 55, .25, 'square', .05); });
defSfx('rift-javelin', () => { noiseSweep(.3, 3000, 900, .14); tone(1800, 600, .2, 'sawtooth', .04); });
defSfx('rift-perfect', () => { tone(1500, 2600, .16, 'sine', .14); tone(2600, 3400, .2, 'triangle', .07, .06); noiseSweep(.25, 8000, 3000, .06, 'highpass'); });
defSfx('rift-tech', () => { tone(700, 1200, .1, 'triangle', .1); noise(.08, 3000, .08, 'highpass'); });
defSfx('rift-relic', () => { [523, 659, 784, 1046].forEach((f, k) => tone(f, f, .22, 'triangle', .08, k * .07)); });

// ---------- settings screen: a "Rift" group under the existing settings ----------
const _v5Settings = SCREENS.settings;
SCREENS.settings = function () {
  const node = _v5Settings.apply(this, arguments);
  try {
    const group = el('section', { class: 'set-group v5-group' }, el('h3', { text: 'Rift effects (v5)' }),
      toggleField('Perfect-dodge slow motion', v5On('v5Slowmo'), v => setSetting('v5Slowmo', v), 'A short slow-down when you perfect-dodge. Off for less motion.'),
      toggleField('Bass Drop beat clicks', v5On('v5Beat'), v => setSetting('v5Beat', v), 'The metronome tick the Bass Drop swings to.'),
      toggleField('Mastery swing glow', v5On('v5MasteryFx'), v => setSetting('v5MasteryFx', v), 'Sparks on Gold and Mythic mastery weapons. Off saves a little performance.'),
      toggleField('New-mechanic tips', v5On('v5Tips'), v => setSetting('v5Tips', v), 'One-time tips the first time you see a perfect dodge, tech or relic.'));
    const host = node && node.querySelector('.set-grid');
    if (host) host.append(group);
  } catch (e) { report(e, 'v5 settings'); }
  return node;
};

// ---------- one-time tips ----------
const V5_TIPS = store.getObj('v5tips');
function v5Tip(id, title, sub) {
  if (!v5On('v5Tips') || V5_TIPS[id] || G_STATE.cfg && G_STATE.cfg.autopilot) return;
  V5_TIPS[id] = 1; store.set('v5tips', V5_TIPS);
  toast(title, sub, '?', '#8cf6ff');
}
on('perfectDodge', B => { if (!aiBrain(B)) v5Tip('pd', 'Perfect dodge!', 'Your next hit within 1.2 s is a +35% COUNTER.'); else if (F.some(f => f.ctrl === 'human' && !aiBrain(f))) v5Tip('pd-cpu', 'The CPU perfect-dodged', 'Dash right as a hit lands to do it yourself.'); });
on('roundStart', () => {
  if (G_STATE.mode && G_STATE.mode.key === 'ascension') v5Tip('asc', 'Ascension', 'Win a floor to draft a relic. Relics stack for the whole climb.');
  const me = F.find(f => f.id === 0 && !aiBrain(f));
  if (me && WEAPONS[me.wkey] && WEAPONS[me.wkey].tier && WEAPONS[me.wkey].tier !== 'common') v5Tip('w-' + me.wkey, WEAPONS[me.wkey].name, WEAPONS[me.wkey].desc);
});

// ---------- progress hooks ----------
on('matchOver', () => { try { v5CheckUnlocks(false); } catch (e) { report(e, 'v5 unlocks'); } });
on('boot', () => { try { v5CheckUnlocks(true); } catch (e) { report(e, 'v5 boot'); } });

// ---------- styles ----------
document.head.append(el('style', { text: `
.v5-tier{position:absolute;top:4px;left:4px;font:700 10px/1 ${FONT_BODY};color:var(--tc);border:1px solid var(--tc);border-radius:4px;padding:2px 3px;background:rgba(5,4,14,.7);pointer-events:none}
.v5-mastery{position:absolute;top:3px;right:5px;font-size:12px;color:var(--mc);text-shadow:0 0 6px var(--mc);pointer-events:none}
.v5-preview{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.v5-chip{font:600 12px ${FONT_BODY};color:var(--tc);border:1px solid var(--tc);border-radius:999px;padding:2px 8px;background:rgba(5,4,14,.5)}
.w-tile{position:relative}
` }));

// ---------- pointer support for the Ascension draft (mouse and touch) ----------
on('boot', () => {
  const cv = document.getElementById('c');
  if (!cv) return;
  cv.addEventListener('pointerdown', e => {
    const m = G_STATE.mode, run = m && m.key === 'ascension' && modeRun();
    if (!run || !run.draft) return;
    const r = cv.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H);
    const x = (e.clientX - r.left - (r.width - W * s) / 2) / s, y = (e.clientY - r.top - (r.height - H * s) / 2) / s;
    const k = ascCardRects().findIndex(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (k >= 0) { run.draft.click = k; e.preventDefault(); }
  });
});



// ============================================================================
//  Match feedback: kill feed, combo meter, low-HP vignette, announcer
//  (ported from the V4 pack; DOM-only, no simulation or balance changes)
// ============================================================================
const FEED = { combo: {}, lastSay: 0 };
function feedEl(cls, html = '') {
  let el = document.querySelector('.' + cls);
  if (!el) { el = document.createElement('div'); el.className = cls; el.innerHTML = html; document.body.appendChild(el); }
  return el;
}
function addKillFeed(killer, victim) {
  const w = (killer.w && killer.w.key && WEAPONS[killer.w.key]) || { name: 'Fists', color: '#ffffff' };
  const item = document.createElement('div');
  item.className = 'kf-item';
  item.innerHTML = `<b style="color:${killer.color}">${killer.name}</b><span style="color:${w.color}"> ${w.name} </span><b style="color:${victim.color}">${victim.name}</b>`;
  feedEl('kill-feed').appendChild(item);
  setTimeout(() => item.remove(), 3000);
}
function showCombo(n) {
  const el = feedEl('combo-meter', '<b></b><small>COMBO</small>');
  el.querySelector('b').textContent = n + 'x';
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  el.style.opacity = '1';
  clearTimeout(el._hide);
  el._hide = setTimeout(() => el.style.opacity = '0', 1400);
}
function updateLowHpVignette() {
  const me = F[0], on = G_STATE.state === 'play' && me && me.alive && me.hp / me.maxHp < .28;
  feedEl('low-hp-vignette').classList.toggle('on', !!on);
}
setInterval(updateLowHpVignette, 200);
// A big banner call-out (v5). Named apart from 82's spoken announce(), which a same-named function here replaced.
function feedAnnounce(text, color) {
  if (G_STATE.t - FEED.lastSay < 1.2) return;
  FEED.lastSay = G_STATE.t; banner(text, '', 1.1, color || '#ffd84a');
}
on('ko', (victim, killer) => {
  if (G_STATE.sim || !killer || !victim || killer === victim) return;
  addKillFeed(killer, victim);
  const c = FEED.combo[killer.id] ||= { n: 0, last: 0 }, now = G_STATE.t;
  c.n = now - c.last < 2.2 ? c.n + 1 : 1; c.last = now;
  if (killer.id === 0 && c.n > 1) showCombo(c.n);
  if (killer.id === 0 && F.filter(f => f.alive && f.team !== killer.team).length === 1) feedAnnounce('ONE LEFT!', '#ff5c48');
});
on('roundStart', () => { FEED.combo = {}; const kf = document.querySelector('.kill-feed'); if (kf) kf.innerHTML = ''; });

boot();
