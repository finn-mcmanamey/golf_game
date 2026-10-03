// 78-pets.js: helper pets, small floating companions with one tiny ability on a cooldown. They are tuned to never
// decide a fight (a few HP, one blocked bullet, a short slow) and are off in Ranked and One-Hit modes.
// defPet(key, { name, icon, color, desc, cd, ready(f, pet) -> target|false, use(f, pet, target), draw(c, x, y, t, pet) }).
// Pet state lives in f.mem.pet = { x, y, cd, fx (flash timer), key } and is reset every round with f.mem.

const PETS = {};
const PET_OFF_MODES = new Set(['ranked', 'ohko']);
function defPet(key, def) { return defLook(PETS, key, Object.assign({ cd: 12, color: '#ffffff' }, def)); }

const petsAllowed = () => {
  const g = G_STATE, m = g.mode || {};
  return !!m.key && !PET_OFF_MODES.has(m.key) && !m.noPets && !(g.cfg && g.cfg.pets === false);
};
const petOf = f => { const k = lookOf(f).pet; return k && PETS[k] && k !== 'none' ? PETS[k] : null; };
const petFoe = (f, r) => {
  const c = chest(f);
  return enemiesOf(f).filter(e => e.alive && !e.summon && dist(chest(e), c) < r).sort((a, b) => dist(chest(a), c) - dist(chest(b), c))[0] || null;
};
// The nearest enemy projectile (not a zone or pickup) within r px of the owner's chest.
const petShot = (f, r) => {
  const c = chest(f);
  return PROJ.find(p => !p.dead && !p.zone && p.kind !== 'pickup' && p.owner && p.owner.team !== f.team && Math.hypot(p.x - c.x, p.y - c.y) < r) || null;
};

// ---------- the pets ----------
defPet('none', { name: 'No pet', icon: '—' });
defPet('bitbot', { name: 'Bit-Bot', icon: '🤖', color: '#7fd8ff', cd: 14, desc: 'Zaps one enemy shot out of the air.',
  ready: f => petShot(f, 80),
  use(f, pet, p) { beam(pet.x, pet.y, p.x, p.y, this.color, 3, .15); burst(p.x, p.y, this.color, 10, 200); p.dead = true; },
  draw(c, x, y, t) { hatRect(c, x - 9, y - 8, 18, 15, '#2a3a52', '#7fd8ff', 2); circle(c, x - 3, y - 1, 2.5, '#7fd8ff'); circle(c, x + 4, y - 1, 2.5, '#7fd8ff'); lineXY(c, x, y - 8, x, y - 14, '#7fd8ff', 2); circle(c, x, y - 15, 2.5, t % 1 < .5 ? '#ff5ad1' : '#7fd8ff'); } });
defPet('sprig', { name: 'Sprig', icon: '🌱', color: '#5dff9a', cd: 18, desc: 'Heals 5 HP when you drop below half.',
  ready: f => f.hp < f.maxHp * .5,
  use(f, pet) { heal(f, 5); beam(pet.x, pet.y, chest(f).x, chest(f).y, this.color, 2, .25); },
  draw(c, x, y, t) { hatEllipse(c, x, y, 7, 8, '#3fbf6a', '#c8ffd9'); hatEllipse(c, x - 6, y - 9, 6, 3, '#5dff9a', null, 1, -.6 + Math.sin(t * 4) * .2); hatEllipse(c, x + 6, y - 9, 6, 3, '#5dff9a', null, 1, .6 - Math.sin(t * 4) * .2); circle(c, x + 2, y - 1, 1.6, '#0b0c18'); } });
defPet('zappy', { name: 'Zappy', icon: '⚡', color: '#ffe066', cd: 10, desc: 'Zaps a foe within reach for 3 damage.',
  ready: f => petFoe(f, 170),
  use(f, pet, e) { const c = chest(e); beam(pet.x, pet.y, c.x, c.y, this.color, 3, .18); damage(e, 3, { src: f, kind: 'skill', x: c.x, y: c.y, nx: Math.sign(c.x - pet.x), ny: -.3, kb: 60, small: true }); },
  draw(c, x, y, t) { glow(c, '#ffe066', 12, () => circle(c, x, y, 7, '#ffe066')); for (let k = 0; k < 3; k++) { const a = t * 6 + k * TAU / 3; lineXY(c, x + Math.cos(a) * 8, y + Math.sin(a) * 8, x + Math.cos(a) * 13, y + Math.sin(a) * 13, '#fff6c8', 1.5); } } });
defPet('fetch', { name: 'Fetch', icon: '🐶', color: '#ffb36b', cd: 12, desc: 'Fetches the nearest power-up orb toward you.',
  ready: f => ORB_LIST.filter(o => !o.taken && Math.hypot(o.x - chest(f).x, o.y - chest(f).y) > 60).sort((a, b) => dist(a, chest(f)) - dist(b, chest(f)))[0] || false,
  use(f, pet, o) { const c = chest(f); ring(o.x, o.y, 30, this.color, .25, 3); o.x = lerp(o.x, c.x, .6); o.y = lerp(o.y, c.y - 10, .6); o.solid = null; },
  draw(c, x, y, t) { circle(c, x, y, 8, '#ffb36b', '#7a4a1e', 1.5); hatEllipse(c, x - 7, y - 3 + Math.sin(t * 8) * 2, 3, 6, '#7a4a1e'); hatEllipse(c, x + 7, y - 3 - Math.sin(t * 8) * 2, 3, 6, '#7a4a1e'); circle(c, x, y + 2, 2, '#0b0c18'); } });
defPet('tick', { name: 'Tick', icon: '⏰', color: '#b98cff', cd: 7, desc: 'Slows an incoming enemy projectile.',
  ready: f => petShot(f, 150),
  use(f, pet, p) { p.vx *= .45; p.vy *= .45; ring(p.x, p.y, 22, this.color, .3, 2); },
  draw(c, x, y, t) { circle(c, x, y, 8, '#2a1f46', '#b98cff', 2); lineXY(c, x, y, x + Math.cos(t * 3) * 5, y + Math.sin(t * 3) * 5, '#ffffff', 1.5); lineXY(c, x, y, x, y - 4, '#ffffff', 1.5); } });
defPet('wisp', { name: 'Ember Wisp', icon: '🔥', color: '#ff8a2e', cd: 15, desc: 'Sets a nearby foe alight for a moment.',
  ready: f => petFoe(f, 130),
  use(f, pet, e) { addStatus(e, 'burn', 1.2, .5, f); burst(chest(e).x, chest(e).y, this.color, 8, 160); },
  draw(c, x, y, t) { glow(c, '#ff8a2e', 10, () => poly(c, [[x, y - 12 - Math.sin(t * 9) * 2], [x + 7, y + 2], [x, y + 7], [x - 7, y + 2]], '#ff8a2e')); circle(c, x, y + 1, 3, '#ffe066'); } });
defPet('bubbles', { name: 'Bubbles', icon: '🐟', color: '#5ef2ff', cd: 14, desc: 'Washes one debuff off you.',
  ready: f => Object.keys(f.status).find(k => STATUS[k] && STATUS[k].debuff) || false,
  use(f, pet, k) { removeStatus(f, k); burst(chest(f).x, chest(f).y, this.color, 8, 140); },
  draw(c, x, y, t) { hatEllipse(c, x, y, 9, 6, '#5ef2ff', '#e8fbff'); poly(c, [[x - 8, y], [x - 15, y - 5 - Math.sin(t * 9) * 2], [x - 15, y + 5 + Math.sin(t * 9) * 2]], '#2bb7d6'); circle(c, x + 4, y - 1, 1.6, '#0b0c18'); } });
defPet('glim', { name: 'Glim', icon: '✨', color: '#ffd84a', cd: 15, desc: 'Every so often, tops up your super meter a little.',
  ready: f => f.super < 100 && enemiesOf(f).some(e => e.alive),
  use(f, pet) { gainSuper(f, 6); ring(pet.x, pet.y, 18, this.color, .3, 2); },
  draw(c, x, y, t) { c.save(); c.translate(x, y); c.rotate(t * 1.5); hatStar(c, 0, 0, 4, '#ffd84a'); c.restore(); circle(c, x, y, 2.5, '#fff6c8'); } });

// ---------- runtime (game logic: runs in SC.sim too) ----------
function petStep(f, dt) {
  const def = petOf(f);
  if (!def || !f.alive) return;
  const c = chest(f), tx = c.x - f.face * 34 * f.scale, ty = c.y - 52 * f.scale;
  const pet = f.mem.pet || (f.mem.pet = { key: def.key, x: tx, y: ty, cd: def.cd * .5, fx: 0 });
  const k = 1 - Math.exp(-6 * dt);
  pet.x += (tx - pet.x) * k; pet.y += (ty + Math.sin(G_STATE.t * 3 + f.id) * 5 - pet.y) * k;
  pet.fx = Math.max(0, pet.fx - dt);
  if ((pet.cd -= dt) > 0 || G_STATE.lock > 0 || G_STATE.ending) return;
  const target = hook(def, 'ready', f, pet);
  if (!target) return;
  hook(def, 'use', f, pet, target);
  pet.cd = def.cd; pet.fx = .4;
  emit('petUse', f, def.key);
}
on('mapStep', dt => { if (petsAllowed()) for (const f of F) if (!f.summon) petStep(f, dt); });

function petsDraw(c) {
  if (!F.length || !petsAllowed()) return;
  for (const f of F) {
    const pet = f.mem && f.mem.pet, def = pet && PETS[pet.key];
    if (!def || !f.alive) continue;
    c.save();
    if (pet.fx > 0) circle(c, pet.x, pet.y, 14 + pet.fx * 20, rgba(def.color, pet.fx * .5));
    petDrawOne(c, def, pet.x, pet.y, G_STATE.t);
    c.restore();
  }
}
function petDrawOne(c, def, x, y, t) {
  c.lineCap = c.lineJoin = 'round';
  try { if (def.draw) def.draw(c, x, y, t); } catch (e) { report(e, 'pet ' + def.key); }
}
