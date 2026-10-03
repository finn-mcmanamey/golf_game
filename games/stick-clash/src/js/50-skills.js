// 50-skills.js: skill defs. use(f) runs when the skill key is pressed and the cooldown is ready; return false to
// cancel without spending the cooldown. onStep(f, dt) runs every step for fighters that carry the skill; keep
// per-fighter state in f.mem. ai.when(f, foe, dist) tells the CPU when using it is a good idea.
// This slice holds the shared skill helpers plus the movement and melee skills; 51 and 52 hold the rest.

// ---------- shared helpers ----------
// Living enemies of f whose chest is within r of (x, y).
function skillFoesNear(f, x, y, r) {
  return enemiesOf(f).filter(e => e.alive && Math.hypot(chest(e).x - x, chest(e).y - y) < r);
}

// Direct skill damage; knockback points away from the caster unless nx/ny are given.
function skillHit(f, e, amount, o = {}) {
  const a = chest(f), b = chest(e), d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return damage(e, amount, Object.assign({ src: f, kind: 'skill', x: b.x, y: b.y, nx: (b.x - a.x) / d, ny: (b.y - a.y) / d,
    kb: 500, parts: ALL_BODY, color: o.color }, o));
}

// Sets the whole body's velocity (px/s): launches, leaps and pulls.
function skillLaunch(f, vxNew, vyNew) {
  for (const p of f.P) { p.ox = p.x - vxNew * DT; p.oy = p.y - vyNew * DT; }
}

// Where a skill shot starts and which way it flies: from the weapon hand toward the nearest visible foe's chest.
function skillAim(f, speed) {
  const hand = f.P[f.main.hand], foe = nearestEnemy(f, true);
  const ang = foe ? angleTo(hand, chest(foe)) : (f.face > 0 ? -.08 : Math.PI + .08);
  return { x: hand.x, y: hand.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, foe };
}

// Zones are lingering skill objects (clouds, wells, traps, telegraphs). They ride the projectile list so they are
// stepped, drawn and cleared each round like any projectile; r < 0 means they never touch bodies, weapons or walls.
// A zone always draws itself (default: nothing), since the standard projectile drawing can't use a negative radius.
function skillZone(o) {
  return spawnProj(Object.assign({ r: -1e4, dmg: 0, solid: false, trail: false, kind: 'zone', vx: 0, vy: 0, draw() {} }, o, { zone: true }));
}

// A zone may set `danger` (px): CPUs on the other team step out of that radius and won't walk into it.
// Enemy projectiles (not zones) within r of (x, y): for skills that reflect, slow or swallow shots.
function skillEnemyShots(f, x, y, r) {
  return PROJ.filter(p => !p.dead && !p.zone && p.team !== f.team && Math.hypot(p.x - x, p.y - y) < r);
}

// Turns an enemy projectile into ours, sent back toward the nearest foe a little faster.
function skillReflect(p, f, speedMul = 1.15) {
  const foe = nearestEnemy(f), sp = Math.hypot(p.vx, p.vy) * speedMul || 900;
  const ang = foe ? angleTo(p, chest(foe)) : Math.atan2(-p.vy, -p.vx);
  p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
  p.owner = f; p.team = f.team; p.hits = []; p.t = Math.min(p.t, p.life * .4);
  burst(p.x, p.y, '#ffe9a8', 10, 360, { life: .25 });
}

// Height of the ground under x near y, or null over a pit.
function skillGround(x, y) { return groundBelow(clamp(x, 1, W - 1), y); }

// Mixes two '#rrggbb' colours (t = 0 gives a, 1 gives b).
function skillMixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(lerp(pa >> s & 255, pb >> s & 255, t));
  return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
}

// Is there ground somewhere along the next `reach` px in direction dir? (CPUs shouldn't lunge into pits.)
function skillSafeAhead(f, dir, reach) {
  const fy = feetY(f);
  for (let d = 60; d <= reach; d += 60) if (skillGround(f.P[2].x + dir * d, fy - 30) == null) return false;
  return true;
}

// Over a pit with nothing below: recovery skills (leaps, grapples) are worth using.
const skillOverPit = f => !f.grounded && skillGround(f.P[2].x, feetY(f)) == null;

// ---------- Phase Step: teleport behind the nearest foe ----------
// Returns an x beside `foe` with ground under it (never over a pit), preferring behind its back.
function blinkSpot(f, foe) {
  const hip = f.P[2], y = foe ? feetY(foe) : feetY(f);
  const xs = foe ? [foe.P[2].x - foe.face * 110 * foe.scale, foe.P[2].x + foe.face * 110 * foe.scale] : [hip.x + f.face * 260];
  for (const x of xs) {
    if (x < 40 || x > W - 40) continue;
    const g = groundBelow(x, y - 70);
    if (g != null && g - y < 120 && !solidAt(x, g - 60)) return { x, y: g };
  }
  return null;
}

defSkill('blink', {
  name: 'Phase Step', icon: '✦', color: '#b98cff', cd: 4, sfx: 'blink', order: 10,
  desc: 'Teleport behind the nearest foe with a moment of invulnerability.',
  use(f) {
    const spot = blinkSpot(f, nearestEnemy(f));
    if (!spot) return false;
    const from = chest(f);
    moveFighter(f, spot.x - f.P[2].x, spot.y - feetY(f));
    for (const p of f.P) { p.ox = p.x; p.oy = p.y; }      // arrive standing still
    const to = chest(f);
    beam(from.x, from.y, to.x, to.y, this.color, 10, .3);
    ring(from.x, from.y, 50, this.color, .3, 3); ring(to.x, to.y, 60, this.color, .35, 4);
    burst(to.x, to.y, this.color, 18, 320);
    f.inv = .45;
  },
  ai: { when: (f, foe, d) => d > 300 || (f.hp < 35 && d < 140) },
});

// ---------- Quake Stomp: ground shockwave (slams down first if airborne) ----------
function quake(f, power) {
  const x = f.P[2].x, y = feetY(f), reach = 190 * power;
  for (const e of enemiesOf(f)) {
    if (!e.alive) continue;
    const ex = e.P[2].x, ey = feetY(e), d = Math.abs(ex - x);
    if (d > reach || Math.abs(ey - y) > 70) continue;          // jumping over the wave dodges it
    const fall = 1 - d / reach * .5;
    damage(e, 11 * power * fall, { src: f, kind: 'skill', x: ex, y: ey - 30, nx: Math.sign(ex - x || 1) * .55, ny: -.84,
      kb: 820 * fall, parts: ALL_BODY, status: ['stun', .45 * power] });
  }
  ring(x, y, reach, '#ffb347', .4, 6); ring(x, y, reach * .6, '#ffffff', .25, 3);
  burst(x, y, '#c9a27a', 26, 420); burst(x, y, '#ffb347', 12, 300);
  shake(14);
  sfx('slam');
}

defSkill('slam', {
  name: 'Quake Stomp', icon: '◉', color: '#ffb347', cd: 7, order: 11,
  desc: 'Stomp a shockwave that launches and stuns grounded foes. In the air, dive first for a bigger quake.',
  use(f) {
    if (f.grounded) { quake(f, 1); return; }
    f.mem.slam = { t: 0 };
    for (const p of f.P) { p.oy = p.y - 1500 * DT; }     // dive straight down
  },
  onStep(f, dt) {
    const s = f.mem.slam;
    if (!s) return;
    s.t += dt;
    if (!f.alive || s.t > 1.5) { delete f.mem.slam; return; }
    if (f.grounded) { delete f.mem.slam; quake(f, 1.35); }
  },
  draw(ctx, f) {
    if (!f.mem.slam) return;
    const c = chest(f);
    ctx.globalAlpha = .5;
    lineXY(ctx, c.x, c.y - 90, c.x, c.y - 10, this.color, 10 * f.scale);
    ctx.globalAlpha = 1;
  },
  ai: { when: (f, foe, d) => d < 210 && Math.abs(foe.P[2].y - f.P[2].y) < 120 },
});

// ---------- Comet Lunge: an invulnerable dash that cuts through everyone in the way ----------
const LUNGE = { speed: 1500, time: .2, dmg: 8, reach: 62 };

defSkill('lunge', {
  name: 'Comet Lunge', icon: '➤', color: '#5ef2ff', cd: 7, sfx: 'lunge', order: 12,
  desc: 'Streak forward ~300px, untouchable, slicing every foe you pass through.',
  use(f) {
    const foe = nearestEnemy(f, true), dir = foe ? Math.sign(foe.P[2].x - f.P[2].x) || f.face : f.face;
    f.mem.lunge = { t: LUNGE.time, dir, hit: [] };
    f.inv = LUNGE.time + .06; f.dashT = LUNGE.time;          // dashT also draws the dash afterimage
    ring(f.P[2].x, f.P[2].y, 40, this.color, .25, 4);
  },
  onStep(f, dt) {
    const L = f.mem.lunge;
    if (!L) return;
    if (!f.alive || (L.t -= dt) <= 0) {                       // end: bleed off most of the speed
      for (const p of f.P) { p.ox = p.x - vx(p) * .3 * DT; }
      delete f.mem.lunge; return;
    }
    for (const p of f.P) setVel(p, L.dir * LUNGE.speed, clamp(vy(p), -260, 260));
    const c = chest(f);
    for (const e of skillFoesNear(f, c.x, c.y, LUNGE.reach * f.scale + 30)) {
      if (L.hit.includes(e)) continue;
      L.hit.push(e);
      skillHit(f, e, LUNGE.dmg, { nx: L.dir * .9, ny: -.42, kb: 680, color: this.color });
      beam(c.x - L.dir * 60, c.y, c.x + L.dir * 60, c.y, this.color, 8, .2);
    }
    if (chance(.5)) burst(c.x, c.y, this.color, 2, 120, { life: .3 });
  },
  draw(ctx, f) {
    const L = f.mem.lunge;
    if (!L) return;
    const c = chest(f);
    ctx.globalAlpha = .55;
    glow(ctx, this.color, 16, () => lineXY(ctx, c.x - L.dir * 120, c.y, c.x + L.dir * 20, c.y, this.color, 16 * f.scale));
    ctx.globalAlpha = 1;
  },
  ai: { when: (f, foe, d) => d > 130 && d < 400 && Math.abs(foe.P[2].y - f.P[2].y) < 80 && skillSafeAhead(f, Math.sign(foe.P[2].x - f.P[2].x) || 1, 300) },
});

// ---------- Sky Splitter: rising uppercut that launches foes ----------
defSkill('uppercut', {
  name: 'Sky Splitter', icon: '⇑', color: '#ffd84a', cd: 6, sfx: 'uppercut', order: 13,
  desc: 'Hop up with a rising slash that launches nearby foes skyward.',
  use(f) {
    skillLaunch(f, f.face * 120, -950);
    for (const j of [5, 6, ...f.main.pts.slice(1)]) kick(f.P[j], f.face * 300, -1300);   // whip the weapon upward
    f.mem.upper = { t: .28, hit: [] };
    f.swingT = .3;
    const c = chest(f);
    burst(c.x, feetY(f), this.color, 12, 260);
  },
  onStep(f, dt) {
    const U = f.mem.upper;
    if (!U) return;
    if (!f.alive || (U.t -= dt) <= 0) { delete f.mem.upper; return; }
    const c = chest(f), tip = f.P[f.tip];
    for (const e of enemiesOf(f)) {
      if (!e.alive || U.hit.includes(e)) continue;
      const near = [0, 1, 2].some(j => Math.hypot(e.P[j].x - c.x, e.P[j].y - c.y) < 95 * f.scale || Math.hypot(e.P[j].x - tip.x, e.P[j].y - tip.y) < 50 * f.scale);
      if (!near) continue;
      U.hit.push(e);
      skillHit(f, e, 9, { nx: f.face * .28, ny: -1, kb: 1150, status: ['stun', .3], color: this.color });
      beam(e.P[2].x, e.P[2].y + 30, e.P[2].x, e.P[2].y - 120, this.color, 10, .25);
    }
  },
  draw(ctx, f) {
    if (!f.mem.upper) return;
    const c = chest(f);
    ctx.globalAlpha = f.mem.upper.t * 2.5;
    glow(ctx, this.color, 14, () => { ctx.beginPath(); ctx.arc(c.x, c.y, 70 * f.scale, -Math.PI / 2 - .9, -Math.PI / 2 + .9); ctx.strokeStyle = this.color; ctx.lineWidth = 5; ctx.stroke(); });
    ctx.globalAlpha = 1;
  },
  ai: { when: (f, foe, d) => d < 115 },
});

// ---------- Rocket Leap: a blast under your feet throws you skyward ----------
defSkill('rocket', {
  name: 'Rocket Leap', icon: '⇈', color: '#ff8a3d', cd: 7, sfx: 'rocket', order: 14,
  desc: 'Blast off the ground (or mid-air) ~360px up, scorching anyone beside you. Great for escapes and recovery.',
  use(f) {
    const x = f.P[2].x, y = feetY(f);
    explode(x, y - 12, 105, 12, f, { color: this.color, kb: 650, kind: 'skill' });
    skillLaunch(f, clamp(f.inp.mx, -1, 1) * 260, -1650);
    f.inv = .15; f.rising = false;
    beam(x, y + 10, x, y - 60, '#ffe9a8', 14, .25);
  },
  draw(ctx, f) {
    if (vy(f.P[2]) > -500 || f.grounded) return;      // exhaust flames while blasting upward
    const y = feetY(f), x = f.P[2].x;
    ctx.globalAlpha = .7;
    glow(ctx, this.color, 18, () => poly(ctx, [[x - 9, y], [x + 9, y], [x + rnd(-4, 4), y + 34 + rnd(0, 18)]], this.color));
    ctx.globalAlpha = 1;
  },
  ai: { when: (f, foe, d) => skillOverPit(f) && vy(f.P[2]) > 0 && f.airJumps <= 0 || (foe.P[2].y < f.P[2].y - 150 && d < 320) || (d < 90 && f.hp < 45) },
});

// ---------- Grapple Line: hook a foe and reel them in, or hook a wall and zip to it ----------
defSkill('grapple', {
  name: 'Grapple Line', icon: '⤳', color: '#9dff5a', cd: 6, sfx: 'grapple', order: 15,
  desc: 'Fire a hook. Hit a foe: yank them to you, dazed. Hit a wall or ledge: zip over to it.',
  use(f) {
    const a = skillAim(f, 1700), skill = this;
    if (!a.foe) { a.vy = -900; a.vx = f.face * 1450; }      // nobody in sight: hook up and forward
    f.mem.grapple = null;
    f.mem.hook = spawnProj({ owner: f, x: a.x, y: a.y, vx: a.vx, vy: a.vy, r: 6, dmg: 6, kb: 60, life: .4, kind: 'hook',
      color: skill.color, trail: false,
      onHit(p, target) { f.mem.grapple = { target, t: .45 }; f.mem.hook = null; },
      onExpire(p, why) {
        if (why === 'world') { f.mem.grapple = { x: p.x, y: p.y, t: .5 }; sfx('trap', .6); }
        if (f.mem.hook === p) f.mem.hook = null;
      },
      draw(ctx, p) { grappleDrawHook(ctx, p.x, p.y, Math.atan2(p.vy, p.vx), skill.color); },
    });
  },
  onStep(f, dt) {
    const G = f.mem.grapple;
    if (!G) return;
    G.t -= dt;
    const me = chest(f);
    if (G.target) {
      const e = G.target, c = chest(e), d = Math.hypot(me.x - c.x, me.y - c.y);
      if (!f.alive || !e.alive || G.t <= 0 || d < 75 * f.scale) {
        if (e.alive && d < 110 * f.scale) addStatus(e, 'stun', .6, 1, f);
        f.mem.grapple = null; return;
      }
      skillLaunch(e, (me.x - c.x) / d * 1150, (me.y - c.y) / d * 1150 - 120);
    } else {
      const d = Math.hypot(G.x - me.x, G.y - me.y);
      if (!f.alive || G.t <= 0 || d < 55) { f.mem.grapple = null; f.airJumps = Math.max(f.airJumps, 1); return; }
      skillLaunch(f, (G.x - me.x) / d * 1300, (G.y - me.y) / d * 1300);
    }
  },
  draw(ctx, f) {
    const G = f.mem.grapple, h = f.P[f.main.hand];
    const end = f.mem.hook || (G && (G.target ? chest(G.target) : G));
    if (!end || f.mem.hook && f.mem.hook.dead) return;
    ctx.globalAlpha = 1;
    glow(ctx, this.color, 10, () => lineXY(ctx, h.x, h.y, end.x, end.y, this.color, 3));
    lineXY(ctx, h.x, h.y, end.x, end.y, '#ffffff', 1);
    if (G && !G.target) grappleDrawHook(ctx, G.x, G.y, angleTo(h, G), this.color);
  },
  ai: { when: (f, foe, d) => (f.w.ai.style === 'melee' ? d > 260 && d < 640 : d > 160 && d < 380) || (skillOverPit(f) && f.airJumps <= 0) },
});

function grappleDrawHook(ctx, x, y, ang, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(6, 0);
  ctx.moveTo(6, 0); ctx.quadraticCurveTo(2, -10, -6, -9); ctx.moveTo(6, 0); ctx.quadraticCurveTo(2, 10, -6, 9);
  ctx.stroke();
  ctx.restore();
}

// ---------- Riposte: a split-second guard that reflects shots and counters swings ----------
const PARRY = { window: .5, reach: 80, counterDmg: 10 };

defSkill('parry', {
  name: 'Riposte', icon: '⊗', color: '#fff1a8', cd: 8, sfx: 'guard', order: 16,
  desc: 'For half a second you are untouchable: shots bounce back and the first swing at you is countered with a stun.',
  use(f) {
    f.mem.parry = { t: PARRY.window };
    f.inv = PARRY.window;
    const c = chest(f);
    ring(c.x, c.y, 70 * f.scale, this.color, .25, 3);
  },
  onStep(f, dt) {
    const P = f.mem.parry;
    if (!P) return;
    if (!f.alive || (P.t -= dt) <= 0) { delete f.mem.parry; return; }
    const c = chest(f), hip = f.P[2], reach = PARRY.reach * f.scale;
    for (const p of skillEnemyShots(f, c.x, c.y, reach + 30)) { skillReflect(p, f, 1.2); sfx('block'); }
    for (const e of enemiesOf(f)) {
      if (!e.alive) continue;
      for (const rig of rigsOf(e)) {
        const tip = e.P[rig.tip], sp = Math.hypot(vx(tip) - vx(hip), vy(tip) - vy(hip));
        if (Math.hypot(tip.x - c.x, tip.y - c.y) < reach && sp > TUNE.minHit) { parryCounter(f, e, this.color); return; }
      }
    }
  },
  draw(ctx, f) {
    if (!f.mem.parry) return;
    const c = chest(f), a = f.face > 0 ? 0 : Math.PI;
    ctx.globalAlpha = .9;
    glow(ctx, this.color, 18, () => {
      ctx.beginPath(); ctx.arc(c.x, c.y, PARRY.reach * f.scale, a - 1.1, a + 1.1);
      ctx.strokeStyle = this.color; ctx.lineWidth = 5; ctx.stroke();
    });
    ctx.globalAlpha = 1;
  },
  ai: { when: (f, foe, d) => (foe.swingT > 0 && d < 170) || (typeof incoming === 'function' && incoming(f)) },
});

function parryCounter(f, e, color) {
  delete f.mem.parry;
  f.inv = .2;
  e.atkCd = Math.max(e.atkCd, .5);
  skillHit(f, e, PARRY.counterDmg, { kb: 760, status: ['stun', .7], color });
  const c = chest(e);
  float(c.x, c.y - 60, 'PARRY!', color, 28);
  ring(c.x, c.y, 80, color, .3, 5); flashScreen('#ffffff', .12); hitstop(.08);
  sfx('parry');
}

// Sounds for the skills in this slice (80-audio loads later, so they are added at boot).
on('boot', () => {
  defSfx('lunge', () => { noise(.22, 2400, .22, 'highpass'); tone(300, 1200, .18, 'sawtooth', .05); });
  defSfx('uppercut', () => { noise(.18, 1800, .2); tone(220, 900, .2, 'triangle', .1); });
  defSfx('rocket', () => { noise(.5, 260, .55, 'lowpass'); tone(160, 600, .35, 'sawtooth', .06); });
  defSfx('grapple', () => { tone(1800, 600, .12, 'square', .04); noise(.12, 3000, .12, 'highpass'); });
  defSfx('trap', v => { tone(900, 500, .06, 'square', .06 * v); tone(500, 300, .06, 'square', .05 * v, .06); });
  defSfx('guard', () => { tone(1500, 1500, .08, 'triangle', .08); tone(2200, 2200, .12, 'sine', .05, .03); });
  defSfx('parry', () => { tone(2400, 1600, .3, 'triangle', .12); tone(3200, 2800, .25, 'sine', .08); noise(.1, 6000, .2, 'highpass'); });
});
