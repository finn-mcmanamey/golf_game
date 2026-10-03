// 55-orbs.js: power-up orb defs. The arena spawns up to MAP.maxOrbs at a time on floors and platforms (runtime in
// 30-combat.js). grab(f, orb) runs when any part of a fighter touches one. weight sets how often it appears.

defOrb('heal', { name: '+35 HP', icon: '+', color: '#5dff9a', desc: 'Restore 35 health.', weight: 1.2,
  grab(f) { heal(f, 35, false); } });

defOrb('haste', { name: 'Haste', icon: '»', color: '#ffd84a', desc: 'Move and attack faster for 6 seconds.',
  grab(f) { addStatus(f, 'haste', 6); } });

defOrb('giant', { name: 'Giant Weapon', icon: '▲', color: '#ff5ad1', desc: 'Your weapon grows 50% for 8 seconds.',
  grab(f) { addStatus(f, 'giant', 8); } });

defOrb('shield', { name: 'Shield', icon: '◆', color: '#7fd8ff', desc: 'Blocks the next hit (lasts 20 seconds).',
  grab(f) { addStatus(f, 'shield', 20, 1); } });

// ---------- orbs added with the skills pack (statuses first, then the orbs) ----------
defStatus('lifesteal', { name: 'Lifesteal', icon: '♦', color: '#ff4a6a', max: 12,
  draw(ctx, f) {   // a red drop orbiting the head
    const a = G_STATE.t * 4, h = f.P[0];
    circle(ctx, h.x + Math.cos(a) * 22 * f.scale, h.y + Math.sin(a) * 10 * f.scale, 3.5 * f.scale, '#ff4a6a');
  } });
defStatus('overcharge', { name: 'Double Damage', icon: '×2', color: '#ffe94a', max: 8, dmgMul: 2,
  draw(ctx, f) {   // crackling sparks along the weapon
    if (!chance(.5)) return;
    const t = f.P[f.tip], h = f.P[f.main.hand], k = Math.random();
    lineXY(ctx, lerp(h.x, t.x, k), lerp(h.y, t.y, k), lerp(h.x, t.x, k) + rnd(-12, 12), lerp(h.y, t.y, k) + rnd(-12, 12), '#ffe94a', 2);
  } });
// Shrunk: the body (not the head or weapon) contracts to ~62%, and the fighter hits softer.
defStatus('tiny', { name: 'Shrunk', icon: '▾', color: '#5ef2ff', debuff: true, max: 8, dmgMul: .7,
  tick(f) { for (const l of f.L) if (!l.weapon) l.cur = lerp(l.cur, l.r * .62, .1); },
  onEnd(f) { for (const l of f.L) if (!l.weapon) l.cur = l.r; } });
defStatus('airwalk', { name: 'Sky Boots', icon: '⇡', color: '#9dff5a', max: 12,
  onAdd(f) { f.mem.extraJumps = (f.mem.extraJumps || 0) + 1; f.airJumps++; },
  onEnd(f) { f.mem.extraJumps = Math.max(0, (f.mem.extraJumps || 0) - 1); },
  draw(ctx, f) {   // little wings at the heels
    for (const j of [8, 10]) { const p = f.P[j]; poly(ctx, [[p.x, p.y - 4], [p.x - f.face * 14, p.y - 14], [p.x - f.face * 10, p.y - 2]], '#9dff5a'); }
  } });
defStatus('thorns', { name: 'Thorns', icon: '✷', color: '#c9ff4a', max: 12,
  draw(ctx, f) {
    const c = chest(f);
    ctx.globalAlpha = .6;
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8 + G_STATE.t, r0 = 34 * f.scale, r1 = 44 * f.scale;
      lineXY(ctx, c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1, '#c9ff4a', 2);
    }
    ctx.globalAlpha = 1;
  } });

// Lifesteal heals 40% of direct damage dealt; thorns returns half of melee damage taken to the attacker.
on('damage', (B, amt, o) => {
  const A = o && o.src, direct = o && (o.kind === 'melee' || o.kind === 'proj' || o.kind === 'explode' || o.kind === 'skill');
  if (A && A !== B && direct && A.status.lifesteal) heal(A, amt * .4, true);
  if (A && A !== B && A.alive && o.kind === 'melee' && B.status.thorns) {
    damage(A, Math.max(1, amt * .5), { src: B, kind: 'status', color: '#c9ff4a', small: true });
  }
});

defOrb('vamp', { name: 'Lifesteal', icon: '♦', color: '#ff4a6a', desc: 'For 8 seconds, heal 40% of the damage you deal.',
  grab(f) { addStatus(f, 'lifesteal', 8); } });

defOrb('overcharge', { name: 'Double Damage', icon: '×2', color: '#ffe94a', desc: 'Deal double damage for 5 seconds.', weight: .7,
  grab(f) { addStatus(f, 'overcharge', 5); flashScreen('#ffe94a', .1); } });

defOrb('shrink', { name: 'Shrink Ray', icon: '▾', color: '#5ef2ff', desc: 'Shrinks every foe for 6 seconds: tiny bodies, weak hits.', weight: .7,
  grab(f) {
    for (const e of enemiesOf(f)) if (e.alive) { addStatus(e, 'tiny', 6, 1, f); beam(chest(f).x, chest(f).y, chest(e).x, chest(e).y, '#5ef2ff', 6, .3); }
  } });

defOrb('recharge', { name: 'Skill Reset', icon: '↻', color: '#b98cff', desc: 'Both skills are ready again instantly.', weight: .8,
  grab(f) { f.skillCd = [0, 0]; } });

defOrb('skyboots', { name: 'Sky Boots', icon: '⇡', color: '#9dff5a', desc: 'An extra mid-air jump (triple jump) for 10 seconds.', weight: .8,
  grab(f) { addStatus(f, 'airwalk', 10); } });

defOrb('thorns', { name: 'Thorn Mail', icon: '✷', color: '#c9ff4a', desc: 'For 8 seconds, melee attackers take half the damage they deal you.', weight: .8,
  grab(f) { addStatus(f, 'thorns', 8); } });
