// 56-fusion.js: elements and combo weapons. Grabbing an elemental orb (fire, ice, shock, poison) fuses that element
// into the fighter's weapon for the rest of the round: a tinted glow, a hybrid name ("Flaming Chainsaw") and an effect
// on every direct weapon hit (melee, shots, blasts). The element stays with the fighter, so a disarmed fighter keeps
// flaming fists. Lv3 weapons (33-power) carry a weak dose of their category's natural element.
// Add an element with defElement(key, { name, adj, icon, color, status, hit(A, B, dealt, o) }) (o.weak = Lv3 dose).

defElement('fire', { name: 'Fire', adj: 'Flaming', icon: '✹', color: '#ff7a2e', status: ['burn', 2.5, 1],
  hit(A, B, d, o) { addStatus(B, 'burn', o.weak ? 1.2 : 2, o.weak ? .6 : 1, A); } });

defElement('ice', { name: 'Ice', adj: 'Frozen', icon: '❄', color: '#9fe8ff', status: ['freeze', 1, 1],
  hit(A, B, d, o) {
    addStatus(B, 'slow', o.weak ? .7 : 1.3, 1, A);
    if (!o.weak && chance(.15)) addStatus(B, 'freeze', .6, 1, A);
  } });

defElement('shock', { name: 'Shock', adj: 'Shocking', icon: 'ϟ', color: '#ffe94a', status: ['stun', .6, 1],
  hit(A, B, d, o) {
    if (chance(o.weak ? .08 : .22)) addStatus(B, 'stun', .25, 1, A);
    const c = chest(B), next = F.find(e => e !== B && e.alive && e.team !== A.team && dist(chest(e), c) < 180);
    if (!next || o.weak) return;                                        // full shock arcs on to a second foe
    const n = chest(next);
    damage(next, Math.max(2, d * .4), { src: A, kind: 'skill', x: n.x, y: n.y, elemental: true, small: true, color: '#ffe94a' });
    beam(c.x, c.y, n.x, n.y, '#ffe94a', 3, .2);
  } });

defElement('poison', { name: 'Poison', adj: 'Venom', icon: '☠', color: '#8dff4a', status: ['poison', 3, 1],
  hit(A, B, d, o) { addStatus(B, 'poison', o.weak ? 1.5 : 3, o.weak ? .6 : 1, A); } });

function hookElement(key, A, B, dealt, o) { const el = ELEMENTS[key]; if (el && B.alive && B.hp > 0) hook(el, 'hit', A, B, dealt, o); }

// Every direct weapon hit from a fused fighter (or a Lv3 weapon) applies its element. Mount attacks and the arcs
// themselves (o.elemental) don't, so nothing chains forever.
on('damage', (B, amt, o) => {
  const A = o && o.src;
  if (!A || A === B || o.elemental || o.fromMount || !(o.kind === 'melee' || o.kind === 'proj' || o.kind === 'explode')) return;
  const key = A.element || (A.lvl >= 3 ? LEVEL_ELEMENT[A.w.cat] : null);
  if (key) hookElement(key, A, B, amt, { weak: !A.element, x: o.x, y: o.y });
});

function fuseElement(f, key) {
  const el = ELEMENTS[key];
  if (!el || !f.alive) return;
  f.element = key;
  const c = chest(f);
  float(c.x, c.y - 80, weaponLabel(f).toUpperCase(), el.color, 24);
  ring(c.x, c.y, 80 * f.scale, el.color, .4, 5);
  emit('element', f, key);
}

// The weapon's name with its fused element in front ("Flaming Chainsaw"). Used by the HUD and the kill-cam caption.
function weaponLabel(f) {
  const el = f.element && ELEMENTS[f.element];
  return (el ? el.adj + ' ' : '') + (f.w ? f.w.name : '');
}

// Draw-only: a glow in the element's colour along every weapon segment, plus a small flourish at the tip.
function fusionDraw(f) {
  const el = ELEMENTS[f.element];
  if (!el) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.shadowColor = el.color; ctx.shadowBlur = 18; ctx.globalAlpha = .55;
  for (const rig of rigsOf(f)) for (const [a, b] of rig.ws) line(ctx, f.P[a], f.P[b], el.color, (rig.w.width + 5) * f.scale);
  const t = f.P[f.tip], k = G_STATE.t;
  ctx.globalAlpha = .9;
  if (f.element === 'fire') for (let i = 0; i < 3; i++) circle(ctx, t.x + Math.sin(k * 17 + i * 2) * 6, t.y - 6 - ((k * 60 + i * 9) % 18), 3.5 - i * .8, i ? '#ffb02e' : '#ff4a1a');
  else if (f.element === 'shock') { const j = () => rnd(-10, 10); lineXY(ctx, t.x, t.y, t.x + j(), t.y + j(), '#ffffff', 2); }
  else if (f.element === 'ice') poly(ctx, [[t.x, t.y - 8], [t.x + 5, t.y], [t.x, t.y + 8], [t.x - 5, t.y]], '#e8fbff');
  else circle(ctx, t.x, t.y + 6 + (k * 40) % 14, 2.5, el.color);
  ctx.restore();
}

// ---------- the elemental orbs ----------
for (const [key, desc] of [['fire', 'hits set foes ablaze'], ['ice', 'hits chill and sometimes freeze'],
  ['shock', 'hits arc to a second foe and may stun'], ['poison', 'hits poison']]) {
  const el = ELEMENTS[key];
  defOrb(key + '-orb', { name: el.name + ' Orb', icon: el.icon, color: el.color, weight: .5,
    desc: `Fuses ${el.name.toLowerCase()} into your weapon for the round: ${desc}.`, grab(f) { fuseElement(f, key); } });
}
