// 24-classes.js: the six fighter classes chosen in the loadout. A class changes the body (health, speed, mass ->
// knockback taken, stamina) and adds a passive. Numbers are multipliers on the base fighter; tuned with
// tools/class-balance.cjs so every class wins 35-65% against each other (mirror random loadouts, Normal CPUs).
// Health decides CPU fights more than anything else: +15% (Tank) already needs the slow speed and softer hits.
// 'none' (hidden) is the plain fighter used by bosses, summons and modes that don't hand out classes.

defClass('none', { name: 'Classic', hidden: true, icon: '○', desc: 'No class.' });

defClass('ninja', { name: 'Ninja', icon: '☾', color: '#5ef2ff', order: 10,
  desc: 'Fast and light. Gets knocked further.', passive: 'Extra mid-air jump (triple jump).',
  hp: 1.05, speed: 1.14, mass: .9, stamina: .9, airJumps: 1 });

defClass('brute', { name: 'Brute', icon: '♜', color: '#ff8a2e', order: 20,
  desc: 'Heavy hitter. Slow on its feet.', passive: 'Melee hits +12% and knock weapons loose more often.',
  speed: .88, mass: 1.25, stamina: 1.1, melee: 1.12, disarm: 1.6 });

defClass('mage', { name: 'Mage', icon: '✶', color: '#b98cff', order: 30,
  desc: 'Lives on its skills.', passive: 'Skill cooldowns 38% shorter. Super meter fills 15% faster.',
  cd: .62, superGain: 1.15 });

defClass('gunner', { name: 'Gunner', icon: '⊕', color: '#ffd84a', order: 40,
  desc: 'Never runs dry.', passive: '+50% ammo, reloads 60% faster, one extra throwable.',
  ammo: 1.5, reload: 1.6, throwBonus: 1 });

defClass('tank', { name: 'Tank', icon: '⬢', color: '#9dff5a', order: 50,
  desc: 'A wall of health and stamina. Slow, hits a little softer.', passive: '+15% health, +50% guard stamina, hard to knock away.',
  hp: 1.15, speed: .86, mass: 1.4, stamina: 1.5, dmg: .9 });

defClass('trickster', { name: 'Trickster', icon: '♠', color: '#ff5ad1', order: 60,
  desc: 'Slippery and hard to pin down.', passive: 'Dash goes 60% further, recharges faster and turns you invisible for a moment.',
  speed: 1.04, dash: 1.6, dashCd: .8,
  onDash(f) { addStatus(f, 'invis', 1); } });

// Sets a fighter's class numbers (called from initFightingDepth when the fighter is built).
function applyClass(f, key) {
  const c = CLASSES[key] || CLASSES.none;
  f.cls = c; f.clsKey = c.key;
  f.maxHp = f.hp = f.hpShow = Math.max(1, Math.round(f.maxHp * c.hp));
  f.maxStamina = Math.round(100 * c.stamina);
  Object.assign(f, { spdMul: c.speed, dmgCls: c.dmg, meleeCls: c.melee || 1, skillCdMul: c.cd, ammoMul: c.ammo, reloadRate: c.reload,
    dashMul: c.dash, dashCdMul: c.dashCd || 1, clsJumps: c.airJumps, kbCls: Math.pow(c.mass, -.8), disarmMul: c.disarm || 1,
    superMul: c.superGain || 1 });
  f.airJumps += c.airJumps;
}

on('dash', f => { if (f.cls) hook(f.cls, 'onDash', f); });

// 'random' picks a visible class; unknown keys fall back to none.
function resolveClass(key) {
  if (key === 'random') return randomKey(CLASSES) || 'none';
  return CLASSES[key] ? key : 'none';
}
