// 52-skills-control.js: control, defence and trick skills (gravity well, force push, bubble, heal, berserk,
// time warp, decoy, vanish, snare mine, magnet) and the statuses they use.
// Uses the helpers from 50-skills.js (skillZone, skillHit, skillFoesNear...).

// ---------- statuses used by these skills ----------
defStatus('berserk', { name: 'Berserk', icon: '⚔', color: '#ff3d5a', max: 8, dmgMul: 1.4, takenMul: 1.25, moveMul: 1.1, cdMul: .85,
  draw(ctx, f) {   // a ring of flickering flames rising off the head and shoulders
    const n = f.P[1], hd = f.P[0], t = G_STATE.t, sc = f.scale;
    glow(ctx, '#ff3d5a', 16, () => {
      for (let k = 0; k < 6; k++) {
        const ox = (k - 2.5) * 9 * sc, base = lerp(n.y, hd.y, .3) + Math.abs(ox) * .5;
        const h = (30 + Math.sin(t * 17 + k * 1.7) * 10) * sc, x = n.x + ox + Math.sin(t * 9 + k * 2) * 3 * sc;
        ctx.globalAlpha = .6;
        poly(ctx, [[x - 6 * sc, base], [x + 6 * sc, base], [x + Math.sin(t * 11 + k) * 5 * sc, base - h]], k % 2 ? '#ff3d5a' : '#ffb02e');
      }
    });
    ctx.globalAlpha = 1;
  } });

defStatus('timewarp', { name: 'Time Warp', icon: '⧗', color: '#c7a6ff', debuff: true, max: 4, moveMul: .45, cdMul: 1.8,
  draw(ctx, f, s) {   // a slowly ticking clock face around the chest
    const c = chest(f), r = 44 * f.scale, a = G_STATE.t * 1.4;
    circle(ctx, c.x, c.y, r, rgba('#c7a6ff', .1), rgba('#c7a6ff', .6), 2);
    lineXY(ctx, c.x, c.y, c.x + Math.cos(a) * r * .8, c.y + Math.sin(a) * r * .8, '#c7a6ff', 3);
    lineXY(ctx, c.x, c.y, c.x + Math.cos(a / 12) * r * .5, c.y + Math.sin(a / 12) * r * .5, '#ffffff', 3);
  } });

// A decoy's lifetime; when it runs out the decoy vanishes. Decoys also hit half as hard.
defStatus('phantom', { name: 'Decoy', icon: '⧉', color: '#e6e0ff', max: 10, dmgMul: .5,
  onEnd(f) { decoyDismiss(f); },
  draw(ctx, f) {   // glitchy scan lines so the copy reads as fake
    const c = chest(f);
    ctx.globalAlpha = .35 + .25 * Math.sin(G_STATE.t * 23);
    for (let k = -2; k <= 2; k++) lineXY(ctx, c.x - 22, c.y + k * 22 + Math.sin(G_STATE.t * 7 + k) * 4, c.x + 22, c.y + k * 22, '#ffffff', 1.5);
    ctx.globalAlpha = 1;
  } });

// ---------- Singularity: a gravity well that drags foes in, then pops ----------
const WELL = { life: 2.2, reach: 280, pull: 3200, popDmg: 12, popRadius: 120 };

defSkill('gravity-well', {
  name: 'Singularity', icon: '◎', color: '#b98cff', cd: 10, sfx: 'well', order: 30,
  desc: 'Open a gravity well that drags foes and their shots toward it for 2 s, then implodes.',
  use(f) {
    const foe = nearestEnemy(f, true), near = foe && dist(foe.P[2], f.P[2]) < 420;
    const at = near ? chest(foe) : { x: f.P[2].x + f.face * 220, y: chest(f).y - 20 }, skill = this;
    skillZone({ owner: f, x: clamp(at.x, 40, W - 40), y: at.y, life: WELL.life, color: skill.color,
      onStep(z, dt) { wellPull(f, z, dt); },
      onExpire(z) { explode(z.x, z.y, WELL.popRadius, WELL.popDmg, f, { color: skill.color, kb: 600, kind: 'skill' }); },
      draw(ctx, z) { wellDraw(ctx, z, skill.color); } });
  },
  ai: { when: (f, foe, d) => d > 80 && d < 420 },
});

function wellPull(f, z, dt) {
  for (const e of enemiesOf(f)) {
    if (!e.alive) continue;
    const c = chest(e), dx = z.x - c.x, dy = z.y - c.y, d = Math.hypot(dx, dy);
    if (d > WELL.reach || d < 12) continue;
    const k = WELL.pull * (1 - d / WELL.reach * .7) * dt;
    for (const p of e.P) kick(p, dx / d * k, dy / d * k);
  }
  for (const p of skillEnemyShots(f, z.x, z.y, WELL.reach)) {       // shots curve into the well
    const dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy) || 1;
    p.vx += dx / d * 2400 * dt; p.vy += dy / d * 2400 * dt;
  }
}

function wellDraw(ctx, z, color) {
  const grow = clamp(z.t * 5, 0, 1), r = 22 * grow;
  ctx.globalAlpha = .18;
  circle(ctx, z.x, z.y, WELL.reach * grow, null, color, 2);
  ctx.globalAlpha = .8;
  ctx.lineWidth = 3; ctx.strokeStyle = color;
  for (let k = 0; k < 3; k++) {          // spiral arms swirling inward
    const a = -z.t * 6 + k * TAU / 3;
    ctx.beginPath(); ctx.arc(z.x, z.y, r * 2.6, a, a + 1.6); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  glow(ctx, color, 24, () => circle(ctx, z.x, z.y, r, '#0a0614', color, 3));
}

// ---------- Force Push: blast foes and their shots away ----------
const PUSH = { radius: 240, dmg: 7, kb: 1050 };

defSkill('repulse', {
  name: 'Force Push', icon: '❂', color: '#7fd8ff', cd: 8, sfx: 'push', order: 31,
  desc: 'A shockwave that hurls nearby foes away and sends their projectiles back.',
  use(f) {
    const c = chest(f), foes = skillFoesNear(f, c.x, c.y, PUSH.radius * f.scale), shots = skillEnemyShots(f, c.x, c.y, PUSH.radius);
    if (!foes.length && !shots.length) return false;
    for (const e of foes) {
      const ec = chest(e), d = Math.hypot(ec.x - c.x, ec.y - c.y) || 1, fall = 1 - d / (PUSH.radius * f.scale) * .5;
      skillHit(f, e, PUSH.dmg, { nx: (ec.x - c.x) / d, ny: Math.min(-.35, (ec.y - c.y) / d), kb: PUSH.kb * fall, color: this.color });
    }
    for (const p of shots) skillReflect(p, f, 1.1);
    ring(c.x, c.y, PUSH.radius * f.scale, this.color, .35, 7); ring(c.x, c.y, PUSH.radius * .6, '#ffffff', .25, 3);
    burst(c.x, c.y, this.color, 24, 600);
    shake(9);
  },
  ai: { when: (f, foe, d) => d < 150 || (typeof incoming === 'function' && incoming(f)) },
});

// ---------- Aegis Bubble: a two-hit shield ----------
defSkill('bubble', {
  name: 'Aegis Bubble', icon: '◈', color: '#7fd8ff', cd: 14, sfx: 'bubble', order: 32,
  desc: 'Wrap yourself in a bubble that blocks the next two hits (lasts 4.5 s).',
  use(f) {
    if (f.status.shield && f.status.shield.power >= 2) return false;
    addStatus(f, 'shield', 4.5, 2, f);
    const c = chest(f);
    ring(c.x, c.y, 80 * f.scale, this.color, .35, 5);
    burst(c.x, c.y, this.color, 16, 260);
  },
  ai: { when: (f, foe, d) => (foe.swingT > 0 && d < 200) || (typeof incoming === 'function' && incoming(f)) || (d < 150 && f.hp < 60) },
});

// ---------- Mending Pulse: heal over time and shake off debuffs ----------
defSkill('mend', {
  name: 'Mending Pulse', icon: '✙', color: '#5dff9a', cd: 15, sfx: 'heal', order: 33,
  desc: 'Cleanse burns, poison and slows, then regenerate about 20 health over 4 seconds.',
  use(f) {
    const hurt = f.hp < f.maxHp - 8, debuffs = Object.keys(f.status).filter(k => STATUS[k].debuff);
    if (!hurt && !debuffs.length) return false;
    for (const k of debuffs) removeStatus(f, k);
    addStatus(f, 'regen', 4, .85, f);
    const c = chest(f);
    ring(c.x, c.y, 70 * f.scale, this.color, .45, 4);
    burst(c.x, c.y, this.color, 20, 200, { grav: -300 });
  },
  draw(ctx, f) {
    if (!f.status.regen) return;
    const c = chest(f), t = G_STATE.t;
    ctx.fillStyle = this.color; ctx.font = `600 ${Math.round(14 * f.scale)}px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < 3; k++) {          // little crosses drifting up
      const ph = (t * .8 + k / 3) % 1;
      ctx.globalAlpha = (1 - ph) * .8;
      ctx.fillText('+', c.x + Math.sin(k * 2.1 + t) * 22, c.y + 30 - ph * 90);
    }
    ctx.globalAlpha = 1;
  },
  ai: { when: (f, foe, d) => f.hp < f.maxHp * .55 && (d > 160 || f.hp < f.maxHp * .3) },
});

// ---------- Blood Frenzy: hit harder and move faster, but take more damage ----------
defSkill('frenzy', {
  name: 'Blood Frenzy', icon: '⚔', color: '#ff3d5a', cd: 13, sfx: 'frenzy', order: 34,
  desc: 'For 5 s: +40% damage, faster moves and attacks, but you take 25% more damage.',
  use(f) {
    addStatus(f, 'berserk', 5, 1, f);
    const c = chest(f);
    ring(c.x, c.y, 90 * f.scale, this.color, .4, 5);
    burst(c.x, c.y, this.color, 24, 380);
    flashScreen(this.color, .08);
  },
  ai: { when: (f, foe, d) => d < 260 && f.hp > 30 },
});

// ---------- Chrono Field: slow time for nearby foes ----------
const CHRONO = { radius: 320, secs: 3.5 };

defSkill('chrono', {
  name: 'Chrono Field', icon: '⧗', color: '#c7a6ff', cd: 10, sfx: 'chrono', order: 35,
  desc: 'Foes within 320px move and attack at half speed for 3.5 s; their shots in range crawl.',
  use(f) {
    const c = chest(f), foes = skillFoesNear(f, c.x, c.y, CHRONO.radius);
    if (!foes.length) return false;
    for (const e of foes) addStatus(e, 'timewarp', CHRONO.secs, 1, f);
    for (const p of skillEnemyShots(f, c.x, c.y, CHRONO.radius)) { p.vx *= .35; p.vy *= .35; }
    ring(c.x, c.y, CHRONO.radius, this.color, .6, 4); ring(c.x, c.y, CHRONO.radius * .7, '#ffffff', .45, 2);
  },
  ai: { when: (f, foe, d) => d < 280 },
});

// ---------- Mirror Decoy: a weaker copy that fights by your side for 5 s ----------
let DECOY_SEQ = 0;

defSkill('decoy', {
  name: 'Mirror Decoy', icon: '⧉', color: '#e6e0ff', cd: 15, sfx: 'decoy', order: 36,
  desc: 'Summon a fragile copy of yourself (30 hp, half damage) that fights for 5 s and draws enemy attention.',
  use(f) {
    if (F.some(c => c.summon && c.owner === f && c.alive)) return false;     // one decoy at a time
    const x = clamp(f.P[2].x - f.face * 50 * f.scale, 40, W - 40);
    const c = makeFighter({ id: 100 + (DECOY_SEQ++ % 900), team: f.team, ctrl: 'cpu', weapon: f.wkey, skills: [],
      color: skillMixColor(f.color, '#ffffff', .45), name: f.name, hat: f.hat, scale: f.scale, hpMul: .3, aiLevel: 'normal', face: f.face,
      x, y: feetY(f) });
    c.summon = true; c.owner = f;
    addStatus(c, 'phantom', 5, 1, f);
    F = F.concat([c]);                  // a new array: loops already walking F are not disturbed
    const cc = chest(c);
    ring(cc.x, cc.y, 70, this.color, .4, 4); burst(cc.x, cc.y, this.color, 24, 320);
  },
  onStep(f) {
    // Decoys never outlive the round clock, and vanish before a fall would count as a ring-out.
    for (const c of F) {
      if (!c.summon || c.owner !== f || !c.alive) continue;
      const h = c.P[2], fell = h.y > H + 150 || h.x < -150 || h.x > W + 150;
      if (fell || G_STATE.roundT > G_STATE.roundLimit - .25) decoyDismiss(c);
    }
  },
  ai: { when: (f, foe, d) => d < 380 },
});

// Removes a decoy without a KO (no score, no KO banner).
function decoyDismiss(c) {
  if (!c.summon || !c.alive) return;
  c.alive = false; c.status = {};
  const cc = chest(c);
  burst(cc.x, cc.y, c.color, 26, 360); ring(cc.x, cc.y, 60, c.color, .3, 3);
  sfx('poof');
  F = F.filter(x => x !== c);
}

// A decoy reduced to 0 hp just vanishes; damage() then skips the knockout because hp is no longer 0.
on('damage', B => { if (B.summon && B.hp <= 0) { B.hp = .01; decoyDismiss(B); } });
on('ko', victim => { for (const c of F) if (c.summon && c.owner === victim) decoyDismiss(c); });

// ---------- Vanish: turn invisible, and strike from the shadows ----------
defSkill('vanish', {
  name: 'Vanish', icon: '◐', color: '#c7b8ff', cd: 10, sfx: 'vanish', order: 37,
  desc: 'Turn invisible for 3.5 s with a burst of speed. Your first hit from hiding deals +8 and reveals you.',
  use(f) {
    addStatus(f, 'invis', 3.5, 1, f); addStatus(f, 'haste', 2, 1, f);
    f.mem.vanish = true;
    const c = chest(f);
    burst(c.x, c.y, '#8a84b8', 30, 260, { grav: -200 }); ring(c.x, c.y, 60, this.color, .3, 3);
  },
  onStep(f) { if (f.mem.vanish && !f.status.invis) f.mem.vanish = false; },
  ai: { when: (f, foe, d) => (f.hp < 55 && d < 250) || (d > 200 && d < 450 && f.w.ai.style === 'melee') },
});

// The ambush: the first direct hit out of Vanish adds bonus damage and ends the invisibility.
on('damage', (B, amt, o) => {
  const A = o && o.src;
  if (!A || !A.mem || !A.mem.vanish || o.kind === 'status' || o.kind === 'hazard' || o.kind === 'ringout') return;
  A.mem.vanish = false;
  removeStatus(A, 'invis');
  if (B.alive) damage(B, 8, { src: A, kind: 'status', color: '#c7b8ff', small: true });
  float(B.P[0].x, B.P[0].y - 50, 'AMBUSH', '#c7b8ff', 22);
});

// ---------- Snare Mine: a hidden trap that stuns and pops up whoever steps on it ----------
const SNARE = { arm: .6, life: 14, max: 2, dmg: 10 };

defSkill('snare', {
  name: 'Snare Mine', icon: '⌖', color: '#ffd84a', cd: 7, sfx: 'trap', order: 38,
  desc: 'Drop a mine at your feet (up to 2). It arms in 0.6 s; a foe stepping on it is stunned and popped into the air.',
  use(f) {
    const x = f.P[2].x, fy = feetY(f), gy = skillGround(x, fy - 6);
    if (gy == null || gy - fy > 24) return false;            // only on solid ground
    const mine = PROJ.filter(p => !p.dead && p.kind === 'snare' && p.owner === f);
    if (mine.length >= SNARE.max) mine[0].dead = true;       // the oldest one goes
    const skill = this;
    skillZone({ owner: f, x, y: gy, life: SNARE.life, kind: 'snare', color: skill.color, danger: 40,
      onStep(z) { snareCheck(f, z, skill.color); },
      draw(ctx, z) { snareDraw(ctx, z, skill.color); } });
  },
  ai: { when: (f, foe, d) => f.grounded && d > 70 && d < 300 },
});

function snareCheck(f, z, color) {
  if (z.t < SNARE.arm) return;
  for (const e of enemiesOf(f)) {
    if (!e.alive || Math.abs(e.P[2].x - z.x) > 34 * e.scale || Math.abs(feetY(e) - z.y) > 30) continue;
    damage(e, SNARE.dmg, { src: f, kind: 'skill', x: z.x, y: z.y - 20, nx: 0, ny: -1, kb: 820, parts: ALL_BODY, status: ['stun', .9], color });
    burst(z.x, z.y, color, 20, 380); ring(z.x, z.y, 60, color, .3, 4);
    sfx('trap', 1.2);
    z.dead = true;
    return;
  }
}

function snareDraw(ctx, z, color) {
  const armed = z.t >= SNARE.arm, x = z.x, y = z.y, w = 26;
  ctx.globalAlpha = armed ? .9 : .45;
  ctx.lineCap = 'round';
  glow(ctx, color, armed ? 10 : 0, () => {
    ctx.lineWidth = 4; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(x - w, y - 2); ctx.lineTo(x + w, y - 2); ctx.stroke();
    ctx.lineWidth = 3;
    for (let k = -w + 4; k <= w - 4; k += 8) { ctx.beginPath(); ctx.moveTo(x + k, y - 2); ctx.lineTo(x + k + 3, y - (armed ? 14 : 8)); ctx.stroke(); }  // teeth
  });
  ctx.globalAlpha = 1;
  if (armed && Math.sin(z.t * 8) > 0) circle(ctx, x, y - 6, 4, '#ff4a6a');      // blinking armed light
}

// ---------- Magnet Pulse: pull orbs, foes and their weapons toward you ----------
const MAGNET = { reach: 380, orbReach: 650 };

defSkill('magnet', {
  name: 'Magnet Pulse', icon: '⋒', color: '#ff5a7a', cd: 8, sfx: 'magnet', order: 39,
  desc: 'Yank nearby foes and their weapons toward you (throwing their guard off) and pull in power-up orbs.',
  use(f) {
    const c = chest(f), foes = skillFoesNear(f, c.x, c.y, MAGNET.reach), orbs = ORB_LIST.filter(o => !o.taken && dist(o, c) < MAGNET.orbReach);
    if (!foes.length && !orbs.length) return false;
    for (const e of foes) magnetYank(f, e, this.color);
    for (const o of orbs) { o.solid = null; beam(o.x, o.y, c.x, c.y, o.def.color, 4, .3); }
    if (orbs.length) skillZone({ owner: f, life: .5, onStep(z, dt) { magnetDragOrbs(f, orbs, dt); } });
    ring(c.x, c.y, MAGNET.reach, this.color, .4, 4);
  },
  ai: { when: (f, foe, d) => ORB_LIST.some(o => dist(o, f.P[2]) > 140 && dist(o, f.P[2]) < 600) || (d > 170 && d < 360 && f.w.ai.style === 'melee') },
});

function magnetYank(f, e, color) {
  const c = chest(f), ec = chest(e), d = Math.hypot(c.x - ec.x, c.y - ec.y) || 1, ux = (c.x - ec.x) / d, uy = (c.y - ec.y) / d;
  damage(e, 5, { src: f, kind: 'skill', nx: ux, ny: -.3, kb: 0, small: true, color });
  for (const p of e.P) kick(p, ux * 700, uy * 300 - 150);
  for (const rig of rigsOf(e)) kick(e.P[rig.tip], ux * 1500, uy * 1500);   // weapon wrenched toward us
  e.atkCd = Math.max(e.atkCd, .35);
  beam(ec.x, ec.y, c.x, c.y, color, 5, .25);
}

function magnetDragOrbs(f, orbs, dt) {
  const c = chest(f);
  for (const o of orbs) {
    if (o.taken) continue;
    o.x = lerp(o.x, c.x, Math.min(1, dt * 12)); o.y = lerp(o.y, c.y, Math.min(1, dt * 12));
  }
}

on('boot', () => {
  defSfx('well', () => { tone(400, 60, .9, 'sawtooth', .07); noise(.8, 200, .2, 'lowpass'); });
  defSfx('push', () => { noise(.35, 900, .45); tone(260, 80, .3, 'sine', .3); });
  defSfx('bubble', () => { tone(600, 1200, .25, 'sine', .1); tone(900, 1800, .2, 'triangle', .05, .08); });
  defSfx('heal', () => { tone(523, 523, .15, 'sine', .08); tone(659, 659, .15, 'sine', .08, .1); tone(784, 784, .3, 'sine', .08, .2); });
  defSfx('frenzy', () => { tone(110, 70, .5, 'sawtooth', .14); noise(.4, 600, .3, 'lowpass'); });
  defSfx('chrono', () => { tone(1200, 200, .7, 'sine', .08); tone(600, 100, .7, 'triangle', .05, .1); });
  defSfx('decoy', () => { tone(400, 800, .15, 'square', .04); tone(800, 400, .15, 'square', .04, .12); });
  defSfx('poof', () => { noise(.25, 1500, .2); tone(500, 200, .15, 'sine', .06); });
  defSfx('vanish', () => { noise(.4, 3000, .15, 'highpass'); tone(900, 200, .35, 'sine', .07); });
  defSfx('magnet', () => { tone(80, 160, .4, 'sawtooth', .1); tone(2000, 3000, .3, 'sine', .03); });
});
