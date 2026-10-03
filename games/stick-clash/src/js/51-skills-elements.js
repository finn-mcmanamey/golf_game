// 51-skills-elements.js: elemental and ranged skills (fire, lightning, ice, meteors, poison, earthquakes, glaives).
// Uses the helpers from 50-skills.js (skillZone, skillHit, skillAim...).

// ---------- Ember Orb: a lobbed fireball that bursts and sets foes alight ----------
defSkill('fireball', {
  name: 'Ember Orb', icon: '✺', color: '#ff7a2e', cd: 7, sfx: 'fireball', order: 20,
  desc: 'Hurl a fireball that bursts on impact and sets foes burning.',
  use(f) {
    const a = skillAim(f, 860);
    spawnProj({ owner: f, x: a.x, y: a.y, vx: a.vx, vy: a.vy - 60, r: 9, dmg: 8, explode: 62, grav: .12, life: 1.6,
      kind: 'fireball', color: this.color, kb: 520, status: ['burn', 2, 1], draw: fireballDraw });
    burst(a.x, a.y, this.color, 10, 240);
  },
  ai: { when: (f, foe, d) => d > 150 && d < 720 },
});

function fireballDraw(ctx, p) {
  const tr = p.tr;
  for (let k = 0; k + 1 < tr.length; k += 2) {            // flame tail, fading toward the back
    const a = k / tr.length;
    circle(ctx, tr[k], tr[k + 1], 3 + a * 8, rgba('#ff4a1a', a * .5));
  }
  glow(ctx, '#ff7a2e', 20, () => circle(ctx, p.x, p.y, p.r + Math.sin(p.t * 40) * 1.5, '#ff7a2e'));
  circle(ctx, p.x, p.y, p.r * .55, '#fff1a8');
}

// ---------- Storm Call: a telegraphed lightning bolt on the foe's spot ----------
const STORM = { delay: .55, halfWidth: 60, dmg: 16 };

defSkill('lightning', {
  name: 'Storm Call', icon: 'ϟ', color: '#8fd8ff', cd: 8, sfx: 'charge', order: 21,
  desc: 'Mark the ground under a foe; half a second later a lightning bolt strikes there and stuns. Move to dodge!',
  use(f) {
    const foe = nearestEnemy(f, true);
    if (!foe) return false;
    const x = foe.P[2].x, gy = skillGround(x, feetY(foe) - 20) ?? feetY(foe) + 60, skill = this;
    skillZone({ owner: f, x, y: gy, life: STORM.delay, color: skill.color, danger: STORM.halfWidth + 20,
      onExpire(z) { stormStrike(f, z.x, z.y, skill.color); },
      draw(ctx, z) { stormDrawMark(ctx, z, skill.color); } });
  },
  ai: { when: (f, foe, d) => d > 120 },
});

function stormStrike(f, x, gy, color) {
  for (const e of enemiesOf(f)) {
    if (!e.alive || Math.abs(e.P[2].x - x) > STORM.halfWidth * e.scale || e.P[2].y > gy + 20) continue;
    skillHit(f, e, STORM.dmg, { nx: 0, ny: -1, kb: 380, status: ['stun', .5], color });
  }
  let px = x, py = -40;                    // jagged bolt from the sky down to the ground
  for (let k = 1; k <= 7; k++) {
    const nx = x + (k === 7 ? 0 : rnd(-28, 28)), ny = lerp(-40, gy, k / 7);
    beam(px, py, nx, ny, color, 9, .32);
    px = nx; py = ny;
  }
  burst(x, gy, color, 26, 420); burst(x, gy, '#ffffff', 10, 500, { life: .25 });
  ring(x, gy, 90, color, .35, 5);
  flashScreen('#cfeeff', .18); shake(11);
  sfx('thunder');
}

function stormDrawMark(ctx, z, color) {
  const k = clamp(z.t / STORM.delay, 0, 1), w = STORM.halfWidth;
  ctx.globalAlpha = .12 + k * .25;
  ctx.fillStyle = color; ctx.fillRect(z.x - w * (1 - k * .5), -40, w * 2 * (1 - k * .5), z.y + 40);
  ctx.globalAlpha = .6 + .4 * Math.sin(z.t * 40);
  ctx.beginPath(); ctx.ellipse(z.x, z.y, w, 9, 0, 0, TAU); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------- Frost Nova: freeze everyone close ----------
defSkill('frost-nova', {
  name: 'Frost Nova', icon: '❄', color: '#9fe8ff', cd: 9, sfx: 'freeze', order: 22,
  desc: 'Freeze every foe within 170px for about a second.',
  use(f) {
    const c = chest(f), foes = skillFoesNear(f, c.x, c.y, 170 * f.scale);
    if (!foes.length) return false;                 // nobody in range: don't spend the cooldown
    for (const e of foes) skillHit(f, e, 6, { kb: 200, status: ['freeze', 1.1], color: this.color });
    ring(c.x, c.y, 170 * f.scale, this.color, .45, 6); ring(c.x, c.y, 110 * f.scale, '#ffffff', .3, 3);
    burst(c.x, c.y, this.color, 30, 520); burst(c.x, c.y, '#ffffff', 12, 300);
    flashScreen(this.color, .1);
  },
  ai: { when: (f, foe, d) => d < 150 },
});

// ---------- Starfall: a meteor crashes onto the foe's position ----------
const METEOR = { delay: .85, radius: 125, dmg: 18 };

defSkill('meteor', {
  name: 'Starfall', icon: '☄', color: '#ff9a3d', cd: 11, sfx: 'whistle', order: 23,
  desc: 'Call a meteor onto where the foe is heading. A big burning blast after a short warning.',
  use(f) {
    const foe = nearestEnemy(f, true);
    if (!foe) return false;
    const x = clamp(foe.P[2].x + vx(foe.P[2]) * .35, 40, W - 40);     // lead a running target a little
    const gy = skillGround(x, foe.P[2].y) ?? feetY(foe) + 40, skill = this;
    skillZone({ owner: f, x, y: gy, life: METEOR.delay, color: skill.color, danger: METEOR.radius,
      onExpire(z) {
        explode(z.x, z.y - 16, METEOR.radius, METEOR.dmg, f, { status: ['burn', 2, 1], color: skill.color, kb: 820, kind: 'skill' });
        burst(z.x, z.y, '#8a6a4a', 20, 520);
      },
      draw(ctx, z) { meteorDraw(ctx, z, skill.color); } });
  },
  ai: { when: (f, foe, d) => d > 200 },
});

function meteorDraw(ctx, z, color) {
  const k = clamp(z.t / METEOR.delay, 0, 1), r = METEOR.radius;
  ctx.globalAlpha = .25 + .35 * Math.abs(Math.sin(z.t * 14));                 // pulsing landing marker
  ctx.beginPath(); ctx.ellipse(z.x, z.y, r * (.4 + k * .6), 12, 0, 0, TAU); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  const mx = z.x - 260 * (1 - k), my = lerp(-160, z.y - 16, k * k);           // the rock falls in from the upper left
  ctx.globalAlpha = .45;
  lineXY(ctx, mx - 70, my - 110, mx, my, color, 18);
  ctx.globalAlpha = 1;
  glow(ctx, color, 26, () => circle(ctx, mx, my, 20, color));
  circle(ctx, mx + 3, my - 3, 12, '#5a3a2a'); circle(ctx, mx - 5, my + 4, 5, '#fff1a8');
}

// ---------- Toxic Cloud: a lingering poison cloud ----------
const TOXIC = { life: 4, radius: 110, tick: .35 };

defSkill('toxic', {
  name: 'Toxic Cloud', icon: '☁', color: '#8dff4a', cd: 11, sfx: 'cloud', order: 24,
  desc: 'Release a poison cloud on the foe (or ahead of you) that poisons anyone inside for 4 seconds.',
  use(f) {
    const foe = nearestEnemy(f, true), near = foe && dist(foe.P[2], f.P[2]) < 380;
    const at = near ? chest(foe) : { x: f.P[2].x + f.face * 150, y: chest(f).y };
    const skill = this, blobs = Array.from({ length: 7 }, () => ({ a: rnd(0, TAU), d: rnd(.2, .75), s: rnd(.45, .8), w: rnd(1, 2.5) }));
    skillZone({ owner: f, x: clamp(at.x, 40, W - 40), y: at.y, life: TOXIC.life, color: skill.color, tick: 0, danger: TOXIC.radius,
      onStep(z, dt) {
        z.x += PHYS.windX * .05 * dt;                       // clouds drift with the wind
        if ((z.tick -= dt) > 0) return;
        z.tick = TOXIC.tick;
        for (const e of skillFoesNear(f, z.x, z.y, TOXIC.radius)) addStatus(e, 'poison', 2, 1.1, f);
      },
      draw(ctx, z) { toxicDraw(ctx, z, blobs, skill.color); } });
  },
  ai: { when: (f, foe, d) => d < 360 },
});

function toxicDraw(ctx, z, blobs, color) {
  const fade = clamp(Math.min(z.t * 4, (z.life - z.t) * 2), 0, 1);
  for (const b of blobs) {
    const a = b.a + z.t * b.w * .4, x = z.x + Math.cos(a) * TOXIC.radius * b.d, y = z.y + Math.sin(a) * TOXIC.radius * b.d * .6;
    circle(ctx, x, y, TOXIC.radius * b.s * .6, rgba(color, .13 * fade));
  }
  circle(ctx, z.x, z.y, TOXIC.radius, null, rgba(color, .35 * fade), 2);
}

// ---------- Tremor: rolling earthquake that bounces every grounded foe ----------
const TREMOR = { life: 2.4, every: .6, dmg: 4 };

defSkill('tremor', {
  name: 'Tremor', icon: '≋', color: '#c9a27a', cd: 14, sfx: 'rumble', order: 25,
  desc: 'Shake the whole arena for 2.4 s: every pulse jolts and slows foes standing on the ground. Jump to avoid it.',
  use(f) {
    const skill = this;
    skillZone({ owner: f, x: f.P[2].x, y: feetY(f), life: TREMOR.life, pulse: .25,
      onStep(z, dt) {
        if ((z.pulse -= dt) > 0) return;
        z.pulse = TREMOR.every;
        tremorPulse(f, skill.color);
      } });
  },
  ai: { when: (f, foe, d) => foe.grounded && d > 140 },
});

function tremorPulse(f, color) {
  for (const e of enemiesOf(f)) {
    if (!e.alive || !e.grounded) continue;
    damage(e, TREMOR.dmg, { src: f, kind: 'skill', nx: rnd(-.2, .2), ny: -1, kb: 420, parts: ALL_BODY, status: ['slow', .8], color, small: true });
    burst(e.P[2].x, feetY(e), color, 10, 260);
  }
  const gy = MAP && MAP.floor != null ? MAP.floor : H - 60;
  for (let x = 60; x < W; x += 140) burst(x + rnd(-40, 40), gy, color, 3, 200);
  shake(10);
  sfx('rumble', .7);
}

// ---------- Spinning Glaive: a thrown blade that flies out and boomerangs back ----------
defSkill('glaive', {
  name: 'Spinning Glaive', icon: '✢', color: '#ff5ad1', cd: 7, sfx: 'glaive', order: 26,
  desc: 'Throw a spinning blade that cuts through foes on the way out and again on the way back.',
  use(f) {
    const a = skillAim(f, 1150), skill = this;
    spawnProj({ owner: f, x: a.x, y: a.y, vx: a.vx, vy: a.vy, r: 12, dmg: 7, pierce: 99, kb: 380, life: 2,
      solid: false, trail: false, kind: 'glaive', color: skill.color, back: false,
      onStep: glaiveStep, draw(ctx, p) { glaiveDraw(ctx, p, skill.color); } });
  },
  ai: { when: (f, foe, d) => d > 140 && d < 520 },
});

// Flies out, slows, then homes back to its thrower and can hit everyone again; vanishes when caught.
function glaiveStep(p, dt) {
  const o = p.owner;
  if (!p.back && (p.t > .38 || p.x < 20 || p.x > W - 20)) { p.back = true; p.hits = []; }
  if (!p.back || !o || !o.alive) return;
  const c = chest(o), d = Math.hypot(c.x - p.x, c.y - p.y) || 1;
  const sp = Math.min(1300, 400 + (p.t - .38) * 3000);
  p.vx = lerp(p.vx, (c.x - p.x) / d * sp, .15); p.vy = lerp(p.vy, (c.y - p.y) / d * sp, .15);
  if (d < 36) p.dead = true;
}

function glaiveDraw(ctx, p, color) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 26);
  glow(ctx, color, 14, () => {
    for (let k = 0; k < 3; k++) {
      ctx.rotate(TAU / 3);
      poly(ctx, [[0, -4], [20, -2], [14, 6], [0, 4]], color, '#ffffff', 1.5);
    }
  });
  circle(ctx, 0, 0, 4, '#ffffff');
  ctx.restore();
}

on('boot', () => {
  defSfx('fireball', () => { noise(.35, 700, .3, 'lowpass'); tone(200, 90, .3, 'sawtooth', .07); });
  defSfx('charge', () => { tone(300, 1800, .5, 'sawtooth', .04); noise(.4, 5000, .06, 'highpass'); });
  defSfx('thunder', () => { noise(.7, 1400, .7); noise(.9, 120, .6, 'lowpass', .05); tone(70, 30, .6, 'sine', .4); });
  defSfx('freeze', () => { noise(.4, 6000, .25, 'highpass'); tone(2600, 1200, .35, 'triangle', .07); tone(1800, 900, .3, 'sine', .05, .05); });
  defSfx('whistle', () => { tone(1800, 300, .85, 'sine', .07); noise(.85, 900, .08); });
  defSfx('cloud', () => { noise(.6, 500, .25, 'lowpass'); tone(160, 120, .5, 'sine', .08); });
  defSfx('rumble', v => { noise(.55, 90, .7 * v, 'lowpass'); tone(55, 35, .5, 'sine', .4 * v); });
  defSfx('glaive', () => { noise(.3, 3000, .18); tone(700, 1400, .25, 'triangle', .05); });
});
