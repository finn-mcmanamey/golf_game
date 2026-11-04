// 53-skills-v6.js: eight v6 skills on 50-skills' helpers and 34b's zones (Tornado is 34b's whirlwind). Per-fighter states
// are statuses, which the kill-cam copies frame by frame, so replays show them.

// ---------- Mirror Shield: every enemy shot that comes close flies back at its shooter for 1.2 s ----------
const MIRROR = { secs: 1.2, reach: 80, speed: 1.25 };
defStatus('mirror', { name: 'Mirror Shield', icon: '⟐', color: '#bff4ff', max: 2,
  draw(ctx, f) {   // a faceted dome, turning slowly
    const c = chest(f), r = MIRROR.reach * f.scale, a = G_STATE.t * 2;
    ctx.save(); ctx.globalAlpha = .5;
    poly(ctx, [0, 1, 2, 3, 4, 5].map(k => [c.x + Math.cos(k * TAU / 6 + a) * r, c.y + Math.sin(k * TAU / 6 + a) * r]), rgba('#bff4ff', .25), '#e8fbff', 2);
    ctx.restore();
  } });

defSkill('mirror-shield', {
  name: 'Mirror Shield', icon: '⟐', color: '#bff4ff', cd: 9, sfx: 'rift-prism', order: 50,
  desc: 'For 1.2 s a mirror dome sends every enemy shot, bomb and spell back at whoever fired it, 25% faster.',
  use(f) { addStatus(f, 'mirror', MIRROR.secs, 1, f); ring(chest(f).x, chest(f).y, MIRROR.reach * f.scale, this.color, .3, 4); },
  onStep(f) {
    if (!f.status.mirror) return;
    for (const p of skillEnemyShots(f, chest(f).x, chest(f).y, MIRROR.reach * f.scale)) mirrorBounce(p, f);
  },
  ai: { when: (f, foe, d) => !!incoming(f) || (aiStyle(foe) !== 'melee' && d > 160 && d < 720) },
});
// Back toward the shooter (or the nearest foe if the shooter is gone), now ours.
function mirrorBounce(p, f) {
  const from = p.owner && p.owner.alive && p.owner.team !== f.team ? p.owner : nearestEnemy(f);
  const sp = (Math.hypot(p.vx, p.vy) || 700) * MIRROR.speed, ang = from ? angleTo(p, chest(from)) : Math.atan2(-p.vy, -p.vx);
  p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
  p.owner = f; p.team = f.team; p.hits = []; p.t = Math.min(p.t, p.life * .4);
  burst(p.x, p.y, '#e8fbff', 8, 300, { life: .2 }); sfx('block', .6);
}

// ---------- Shadow Step: step out behind the nearest foe; hits deal +35% for 1.2 s ----------
defStatus('umbra', { name: 'Shadow Strike', icon: '⬗', color: '#9a7cff', max: 1.2, dmgMul: 1.35,
  draw(ctx, f) { glow(ctx, '#9a7cff', 16, () => circle(ctx, chest(f).x, chest(f).y, 36 * f.scale, rgba('#2a1d4a', .45), '#9a7cff', 2)); } });   // a shadow aura

defSkill('shadow-step', {
  name: 'Shadow Step', icon: '⬗', color: '#9a7cff', cd: 6, sfx: 'vanish', order: 51,
  desc: 'Melt into the shadows and step out behind the nearest foe. For 1.2 s afterwards your hits deal +35%.',
  use(f) {
    const foe = nearestEnemy(f), spot = foe && blinkSpot(f, foe), from = chest(f);
    if (!spot) return false;
    moveFighter(f, spot.x - f.P[2].x, spot.y - feetY(f));
    for (const p of f.P) { p.ox = p.x; p.oy = p.y; }
    f.face = Math.sign(foe.P[2].x - f.P[2].x) || f.face;
    addStatus(f, 'umbra', 1.2, 1, f);
    burst(from.x, from.y, '#2a1d4a', 22, 240, { grav: -150 }); burst(chest(f).x, chest(f).y, this.color, 16, 300);
  },
  ai: { when: (f, foe, d) => (aiStyle(f) === 'melee' && d > 160 && d < 520) || (f.hp < 40 && d < 130) },
});

// ---------- Shrink Bolt (key shrink-ray): a bolt that shrinks its target for 5 s; named apart from 55's Shrink Ray orb ----------
defStatus('shrunk', { name: 'Shrunk', icon: '⊚', color: '#7dffcf', debuff: true, max: 6, dmgMul: .75,
  tick(f) { for (const l of f.L) if (!l.weapon) l.cur = lerp(l.cur, l.r * .66, .12); },
  onEnd(f) { for (const l of f.L) if (!l.weapon) l.cur = l.r; } });

defSkill('shrink-ray', {
  name: 'Shrink Bolt', icon: '⊚', color: '#7dffcf', cd: 10, sfx: 'gun-zap', order: 52,
  desc: 'A ringed bolt: the foe it hits shrinks for 5 s, with a smaller body that deals 25% less damage.',
  use(f) {
    const a = skillAim(f, 1250);
    spawnProj({ owner: f, x: a.x, y: a.y, vx: a.vx, vy: a.vy, r: 7, dmg: 4, life: .9, kind: 'shrink-ray', color: this.color, kb: 120,
      dmgKind: 'skill', status: ['shrunk', 5], draw: shrinkRayDraw });
  },
  ai: { when: (f, foe, d) => d > 100 && d < 720 && f.ai.los !== false },
});
function shrinkRayDraw(ctx, p) {   // rings trailing the bolt, smaller toward the back
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.strokeStyle = p.color; ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(-k * 12, 0, 7 - k * 2, 8 - k * 2, 0, 0, TAU); ctx.stroke(); }
  glow(ctx, p.color, 12, () => circle(ctx, 4, 0, 4, '#ffffff'));
  ctx.restore();
}

// ---------- Spring Pad: a bounce pad that launches anyone who steps or lands on it ----------
const SPRING = { life: 8, launch: 1650, foeDmg: 5, daze: .6, w: 30 };

defSkill('spring-pad', {
  name: 'Spring Pad', icon: '⇪', color: '#9dff5a', cd: 10, sfx: 'mapBoing', order: 53,
  desc: 'Drop a bounce pad at your feet for 8 s. Anyone who lands on it is launched sky-high; foes are dazed for a moment.',
  use(f) {
    const x = f.P[2].x, fy = feetY(f), gy = skillGround(x, fy - 6);
    if (gy == null || gy - fy > 30) return false;                      // only on solid ground
    for (const p of PROJ) if (p.kind === 'spring-pad' && p.owner === f) p.dead = true;   // one pad each
    skillZone({ owner: f, x, y: gy, life: SPRING.life, kind: 'spring-pad', color: this.color, danger: 34, cool: { [f.id]: .8 }, boingT: -9,
      on: zoneSolidAt(x, gy), onStep: springPadStep, draw: springPadDraw });
  },
  ai: { when: (f, foe, d) => f.grounded && ((d < 240 && aiStyle(foe) === 'melee') || foe.P[2].y < f.P[2].y - 160) },
});
// Arms after a moment (the dropper gets a little longer to step off); each fighter at most every .5 s.
function springPadStep(z) {
  if (!zoneRide(z) || z.t < .3) return;
  for (const e of F) {
    const feet = feetY(e);
    if (!e.alive || (z.cool[e.id] || 0) > z.t || (e.mount && e.mount.carried) || e.heldBy) continue;
    if (Math.abs(e.P[2].x - z.x) > SPRING.w + 10 * e.scale || feet < z.y - 16 || feet > z.y + 10 || vy(e.P[2]) < -250) continue;
    const foe = e.team !== z.team, side = (Math.sign(e.P[2].x - z.x) || 1) * 220;   // foes land beside the pad, never back on it
    z.cool[e.id] = z.t + .5; z.boingT = z.t;
    for (const p of e.P) { p.oy = p.y + SPRING.launch / Math.sqrt(e.scale) * DT; if (foe) p.ox = p.x - side * DT; }
    e.rising = false; e.airJumps = Math.max(e.airJumps, 1);         // a pad launch is the same height for everyone
    if (foe) damage(e, SPRING.foeDmg, { src: z.owner, kind: 'skill', x: z.x, y: z.y - 30, nx: 0, ny: -1, kb: 0, small: true, status: ['stun', SPRING.daze] });
    burst(z.x, z.y, z.color, 12, 320); sfx('mapBoing', .8);
  }
}
function springPadDraw(ctx, z) {
  const top = z.y - 16 + clamp(1 - (z.t - z.boingT) / .2, 0, 1) * 8, w = SPRING.w;
  ctx.save(); ctx.globalAlpha = clamp((z.life - z.t) * 2, .3, 1);
  ctx.fillStyle = '#2a3346'; ctx.fillRect(z.x - w, z.y - 4, w * 2, 4);
  ctx.strokeStyle = '#c9cdee'; ctx.lineWidth = 2; ctx.beginPath();            // the coil
  for (let k = 0; k <= 6; k++) ctx.lineTo(z.x + (k % 2 ? 1 : -1) * w * .55, lerp(z.y - 4, top + 4, k / 6));
  ctx.stroke();
  glow(ctx, z.color, 10, () => { ctx.fillStyle = z.color; ctx.fillRect(z.x - w, top - 4, w * 2, 5); });
  ctx.restore();
}

// ---------- Wall Up: a breakable barrier for 4 s that stops foes and their shots (you and your allies pass) ----------
const WALLUP = { secs: 4, w: 26, h: 150, hp: 40, gap: 72 };

defSkill('wall-up', {
  name: 'Wall Up', icon: '▥', color: '#ffb347', cd: 11, sfx: 'rift-anchor', order: 54,
  desc: 'Raise a breakable barrier toward the nearest foe for 4 s. It stops foes, their swings and their shots; you and your allies pass through.',
  use(f) {
    const foe = nearestEnemy(f, true), dir = foe ? Math.sign(foe.P[2].x - f.P[2].x) || f.face : f.face;
    const x = f.P[2].x + dir * WALLUP.gap * f.scale, fy = feetY(f), gy = groundBelow(x, fy - 40);
    if (x < 50 || x > W - 50 || gy == null || Math.abs(gy - fy) > 40) return false;   // needs ground beside us
    skillZone({ owner: f, x, y: gy, life: WALLUP.secs, kind: 'wall-up', hp: WALLUP.hp, maxHp: WALLUP.hp, hitT: -9, hurtT: -9,
      on: zoneSolidAt(x, gy), onStep: wallUpStep, draw: wallUpDraw });
    burst(x, gy, this.color, 18, 300); shake(5);
  },
  ai: { when: (f, foe, d) => (aiStyle(foe) !== 'melee' && d > 200 && d < 800) || (!!incoming(f) && d > 150) || (f.hp < 35 && d > 90 && d < 220) },
});

const wallUpBox = z => ({ x: z.x - WALLUP.w / 2, y: z.y - WALLUP.h, w: WALLUP.w, h: WALLUP.h });
function wallUpStep(z) {
  if (!zoneRide(z)) return;
  const box = wallUpBox(z), shot = enemyShotsHit(z.team, p => inRect(p.x, p.y, box, p.r) || inRect(p.x - p.vx * DT / 2, p.y - p.vy * DT / 2, box, p.r));   // fast shots too
  if (z.t - z.hitT > .3 && enemyTipHits(z.team, t => inRect(t.x, t.y, box, 10))) { z.hitT = z.t; wallUpHurt(z, 8); }   // before the push-back stops the tip
  for (const e of F) if (e.alive && e.team !== z.team) wallUpHold(e, box, z.x);
  if (shot && !z.dead) wallUpHurt(z, shot);
}
// A foe's body and weapon are pushed back out on the side its hip is on, with no speed left into the wall.
function wallUpHold(e, box, cx) {
  const side = e.P[2].x < cx ? -1 : 1, edge = side < 0 ? box.x - 2 : box.x + box.w + 2;
  for (const p of e.P) if (inRect(p.x, p.y, box, 2)) { p.x = edge; p.ox = side < 0 ? Math.max(p.ox, p.x) : Math.min(p.ox, p.x); }
}
function wallUpHurt(z, n) {
  z.hp -= n; z.hurtT = z.t;
  if (z.hp > 0) { sfx('brkStone', .35); return; }
  z.dead = true;
  burst(z.x, z.y - WALLUP.h / 2, '#ffb347', 20, 380, { life: .8, grav: 1, size: 4 }); shake(6); sfx('brkStone', 1);
}
function wallUpDraw(ctx, z) {
  const b = wallUpBox(z), h = b.h * clamp(z.t / .15, 0, 1), top = z.y - h, left = z.life - z.t, col = z.owner.color;   // grows out of the ground
  ctx.save();
  if (left < .7) ctx.globalAlpha = .55 + .45 * Math.abs(Math.sin(left * 18));   // flickers just before it drops
  mapRect(ctx, z.t - z.hurtT < .1 ? '#8a7a5a' : 'rgba(44,36,22,.92)', b.x, top, b.w, h);
  ctx.fillStyle = rgba('#ffb347', .55);
  for (let y = top + 8; y < z.y - 10; y += 22) ctx.fillRect(b.x + 3, y, b.w - 6, 7);       // hazard stripes
  glowLine(ctx, b.x, top, b.x + b.w, top, col, 3);
  if (z.hp < z.maxHp) brkDrawCracks(ctx, { x: b.x, y: top, w: b.w, h, brk: 'pillar' }, 1 - z.hp / z.maxHp);
  ctx.restore();
}

// ---------- Pinball: curl into a bouncing ball that hurts every foe it crashes into ----------
const PINBALL = { secs: 2, speed: 700, bounce: 760, dmg: 9, curl: .45, hitCd: .6 };
defStatus('pinball', { name: 'Pinball', icon: '⦿', color: '#ff5ad1', max: 2.5, takenMul: .75,   // a curled ball is hard to hurt
  onEnd(f) { for (const l of f.L) if (!l.weapon) l.cur = l.r; },
  draw(ctx, f) {   // a glowing shell with spin lines
    const c = f.P[2], r = 44 * f.scale, a = G_STATE.t - vx(c) / 40;
    glow(ctx, '#ff5ad1', 14, () => circle(ctx, c.x, c.y, r, rgba('#ff5ad1', .14), '#ff5ad1', 3));
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(c.x, c.y, r - 6, a + k * 2.1, a + k * 2.1 + .8); ctx.stroke(); }
  } });

defSkill('pinball', {
  name: 'Pinball', icon: '⦿', color: '#ff5ad1', cd: 9, sfx: 'arPop', order: 55,
  desc: 'Curl into a bouncing ball for 2 s (25% less damage taken): steer with left/right, jump to bounce. Every foe you crash into takes a hit.',
  use(f) {
    if (f.mount || f.heldBy || f.holding || f.ult) return false;
    addStatus(f, 'pinball', PINBALL.secs, 1, f);
    f.mem.pinball = { hits: {}, bounces: 0, at: -9 };
    skillLaunch(f, f.face * 420, -560);
  },
  onStep(f) { pinballStep(f); },
  ai: { when: (f, foe, d) => d > 110 && d < 420 && Math.abs(foe.P[2].y - f.P[2].y) < 90 && skillSafeAhead(f, Math.sign(foe.P[2].x - f.P[2].x) || 1, 300) },
});
// While curled the body skips its upright drive: it rolls toward the held direction (or the foe) instead.
const _pinballDriveBody = driveBody;
driveBody = function (f, dt, grounded, locked) {
  if (!f.status.pinball || f.heldBy || f.status.ragdoll) return _pinballDriveBody(f, dt, grounded, locked);   // grabbed or thrown: limp as usual
  const P = f.P, hip = P[2], want = (Math.sign(locked ? 0 : f.inp.mx) || f.face) * PINBALL.speed;
  const spin = clamp(vx(hip) / (28 * f.scale), -16, 16) * dt * 6;   // turns the ball the way it rolls
  for (const l of f.L) if (!l.weapon) l.cur = lerp(l.cur, l.r * PINBALL.curl, .25);
  for (let j = 0; j < 11; j++) { const p = P[j]; p.fx += (want - vx(p)) * (grounded ? 5 : 1.5); kick(p, -(p.y - hip.y) * spin, (p.x - hip.x) * spin); }
  f.inp.blockHeld = false; f.atkCd = Math.max(f.atkCd, .05);
};
function pinballStep(f) {
  const m = f.mem.pinball, c = chest(f);
  if (!m || !f.status.pinball) { f.mem.pinball = null; return; }
  if (f.P.slice(0, 11).some(p => p.g) && vy(f.P[2]) > -80 && G_STATE.t - m.at > .18) {   // hit the floor: bounce, a little lower each time
    m.at = G_STATE.t;
    for (const p of f.P) p.oy = p.y + PINBALL.bounce * Math.pow(.86, ++m.bounces) * DT;
    sfx('mapBoing', .5);
  }
  for (const e of skillFoesNear(f, c.x, c.y, 80 * f.scale)) {
    if ((m.hits[e.id] || 0) > G_STATE.t) continue;
    m.hits[e.id] = G_STATE.t + PINBALL.hitCd;
    skillHit(f, e, PINBALL.dmg, { kb: 720, ny: -.55, color: '#ff5ad1' });
    for (const p of f.P) kick(p, -Math.sign(chest(e).x - c.x) * 420, -260);    // and rebound off them
    sfx('mapBoing', 1);
  }
}

// ---------- Rally Cry: a shout that heals and empowers you and nearby allies ----------
const RALLY = { secs: 5, heal: .12, solo: .08, reach: 340 };
defStatus('rally', { name: 'Rallied', icon: '⚑', color: '#ffd84a', max: 6, dmgMul: 1.15,
  draw(ctx, f) {   // a little pennant over the head
    const s = f.scale, x = f.P[0].x - 18 * s, y = f.P[0].y - 56 * s;
    lineXY(ctx, x, y + 26 * s, x, y, '#c9cdee', 2);
    poly(ctx, [[x, y], [x + 18 * s, y + 5 * s + Math.sin(G_STATE.t * 8) * 3], [x, y + 11 * s]], '#ffd84a');
  } });

defSkill('rally-cry', {
  name: 'Rally Cry', icon: '⚑', color: '#ffd84a', cd: 16, sfx: 's6-rally', order: 56,
  desc: 'A battle shout: you and allies within 340px heal 12% and deal +15% damage for 5 s. With no allies (a 1v1) it heals only you, 8%.',
  use(f) {
    const solo = !F.some(a => a !== f && a.team === f.team && !a.summon), c = chest(f);
    for (const a of F) {
      if (!a.alive || a.team !== f.team || a.summon || (a !== f && dist(a.P[2], f.P[2]) > RALLY.reach)) continue;
      heal(a, a.maxHp * (solo ? RALLY.solo : RALLY.heal));
      addStatus(a, 'rally', RALLY.secs, 1, f);
      if (a !== f) beam(c.x, c.y, chest(a).x, chest(a).y, this.color, 4, .3);
    }
    ring(c.x, c.y, solo ? 90 : RALLY.reach, this.color, .45, 5);
    float(c.x, c.y - 90, 'RALLY!', this.color, 24);
  },
  ai: { when: (f, foe, d) => (f.hp < f.maxHp * .8 && d < 380) || alliesOf(f).some(a => a.alive && !a.summon && a.hp < a.maxHp * .6 && dist(a.P[2], f.P[2]) < RALLY.reach) },
});

// ---------- Tornado: a slow whirlwind that lifts and carries foes ----------
defSkill('tornado', {
  name: 'Tornado', icon: '🌪', color: '#bfe9ff', cd: 12, sfx: 'arWhirr', order: 57,
  desc: 'Conjure a slow whirlwind that drifts at the nearest foe for 3 s, lifting and carrying anyone caught inside. It never crosses a pit.',
  use(f) {
    const foe = nearestEnemy(f, true), dir = foe ? Math.sign(foe.P[2].x - f.P[2].x) || f.face : f.face;
    const x = clamp(f.P[2].x + dir * 70, 40, W - 40), gy = skillGround(x, feetY(f) - 40);
    if (gy == null || gy - feetY(f) > 120) return false;
    whirlSpawn(f, x, gy, { life: 3.2, radius: 62, height: 230, speed: 130, dir, dps: 3.5, color: this.color, kind: 'tornado' });
  },
  ai: { when: (f, foe, d) => d > 120 && d < 480 && Math.abs(foe.P[2].y - f.P[2].y) < 120 },
});

on('boot', () => {
  Object.assign(LORE_LINES.s, {
    'mirror-shield': "A pane of the Crystal Court's frozen hall that remembers who cast every reflection. Shots that touch it go home faster than they left.",
    'shadow-step': 'Shades of the Shadow Depths never walk around a foe when they can step through the dark behind one. The first cut lands before they turn.',
    'shrink-ray': 'A Robo Factory crate-packing prototype gone rogue. Being shrunk does not hurt, but swinging a full-size weapon with tiny arms is humbling.',
    'spring-pad': 'Wobble Hills children bolt these to hilltops to reach the Great Candle at festival time. Duelists use them to send guests into orbit.',
    'wall-up': 'Gloamguard sappers raise a barricade faster than a foe can say parley. It never lasts, but four seconds of cover has won many rounds.',
    pinball: "Invented in the Neon league's arcades by a Wick who fell into a pinball cabinet. The bouncing is involuntary; the damage is not.",
    'rally-cry': "The war shout of the Ember Wastes, loud enough to make the Great Candle's flame lean. Allies stand taller; a lone Wick just feels better.",
    tornado: "A coil of the Storm Lord's stolen wind, loosed to wander the arena. It picks up foes the way the Windward Bridge picks up hats.",
  });
  defSfx('s6-rally', v => { [392, 494, 587, 784].forEach((hz, k) => tone(hz, hz, .25, 'sawtooth', .045 * v, k * .07)); thump(110, 60, .3, .3 * v); });
});
