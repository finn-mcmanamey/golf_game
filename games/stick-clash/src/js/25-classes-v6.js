// 25-classes-v6.js: the Duelist, Wrestler and Engineer. A def carries its knobs, `ai` (multipliers on the CPU level's
// knobs, via 67's aiTuned) and `cpu` (a think hook after the brain). Tuned with tools/class-balance.cjs.

defClass('duelist', { name: 'Duelist', icon: '†', color: '#ffe066', order: 70,
  desc: 'A precise fencer who wins by reading the swing.',
  passive: 'Parry window 80% wider. After a parry, your next hit within 1.5 s is a riposte for +40% damage.',
  hp: 1, speed: 1.06, mass: .95, stamina: 1.1, parryWin: 1.8, riposte: 1.4, ai: { parry: 1.4, punish: 1.15 } });

defClass('wrestler', { name: 'Wrestler', icon: '⋈', color: '#ff6a3d', order: 80,
  desc: 'Gets hold of you and does not let go.',
  passive: 'Grabs reach 30% further and recover faster; throws hit 25% harder. Grab, jump and throw in mid-air for a PILEDRIVER.',
  hp: .95, speed: .95, mass: 1.15, stamina: 1.05, grabReach: 1.3, grabCd: .75, throwPower: 1.25, throwFling: 1.12, ai: { grab: 1.1 },
  cpu(f, L, dt) { wrestlerCpu(f, L, dt); } });

defClass('engineer', { name: 'Engineer', icon: '⚒', color: '#5dd6ff', order: 90,
  desc: 'Never fights alone: brings a little turret.',
  passive: 'Once a round, deploy a turret that plinks the nearest foe for 8 s: press your throwable key with none left, or hold it.',
  hp: .97, speed: 1, mass: 1, stamina: .95, turret: true,
  cpu(f, L, dt) { engineerCpu(f, L, dt); } });

// A body flung at speed (a piledrive, a rocket charge) would land big weapon hits just by carrying its weapon along.
function swingHitsOff(f, secs) {
  for (const e of F) if (e.team !== f.team) for (const off of [false, true]) { const k = strikeKey(e.id, off); f.hitCd[k] = Math.max(f.hitCd[k] || 0, secs); }
}
// Foes smash a turret, a duck or a wall: a fast enemy weapon tip where near(tip) says, and enemy shots where
// near(shot) says (each stopped there; returns their damage, at least 4 a shot).
const enemyTipHits = (team, near) => F.some(e => e.alive && e.team !== team && rigsOf(e).some(r => near(e.P[r.tip]) && Math.hypot(vx(e.P[r.tip]), vy(e.P[r.tip])) > TUNE.minHit));
function enemyShotsHit(team, near) {
  let n = 0;
  for (const p of PROJ) if (!p.zone && !p.dead && p.team !== team && p.r >= 0 && near(p)) { n += p.explode ? 6 : Math.max(4, p.dmg || 0); killProj(p, 'world'); }
  return n;
}

// CPU think hooks run after 65's brain (class play, the duck lure, mount tactics); 65's think is wrapped at boot.
const THINK_AFTER = [(f, dt) => {
  if (f.alive && f.cls && f.cls.cpu && f.ai.L && G_STATE.lock <= 0 && f.ai.behave !== 'idle' && f.ai.behave !== 'roam') hook(f.cls, 'cpu', f, f.ai.L, dt);
}];

// ---------- Duelist ----------
defStatus('riposte', { name: 'Riposte', icon: '†', color: '#ffe066', max: 2, dmgMul: f => (f.cls && f.cls.riposte) || 1.4,
  draw(ctx, f) { const t = f.P[f.tip]; glow(ctx, '#ffe066', 12, () => circle(ctx, t.x, t.y, 4 + Math.sin(G_STATE.t * 16) * 2, '#fff6c8')); } });

// A Duelist's fresh guard still parries a hit landing later than the normal window would allow.
const _duelistGuardHit = guardHit;
guardHit = function (B, A, o, x, y, amount) {
  const k = B.cls && B.cls.parryWin;
  if (k > 1 && B.blocking && !o.unblockable && !o.blast && BLOCK.chip[o.kind] != null && guardFront(B, A, o) &&
    G_STATE.t - B.blockStart < (o.proj ? BLOCK.parryShot : BLOCK.parryWin) * (2 - (B.w.guard || 1)) * k) { parry(B, A, o, x, y); return 0; }
  return _duelistGuardHit(B, A, o, x, y, amount);
};
function duelistArm(f) {
  if (!f.cls || !f.cls.riposte || !f.alive) return;
  addStatus(f, 'riposte', 1.5, 1, f);
  sfx('guard', .7);
}
on('parry', B => {
  duelistArm(B);
  if (B.cls && B.cls.riposte && aiBrain(B)) { B.inp.attack = true; B.ai.armed = true; }   // a CPU Duelist answers at once
});
// The first direct hit with the riposte up spends it (the status's dmgMul already gave that hit its bonus).
on('damage', (B, amt, o) => {
  const A = o && o.src;
  if (!A || A === B || !A.status || !A.status.riposte || o.kind === 'status' || o.kind === 'hazard' || o.kind === 'ringout') return;
  removeStatus(A, 'riposte');
  const c = chest(B);
  float(c.x, c.y - 74, 'RIPOSTE!', '#ffe066', 24);
  sfx('s6-riposte');
});

// ---------- Wrestler ----------
const WRESTLER = { pileMin: 55, pileDmg: 18, pileStun: .5, waveR: 120, waveDmg: 6, hop: .95 };

// Runs fn with some of GRAB's numbers scaled (the grab code reads the one shared GRAB table).
function grabTuned(muls, fn) {
  const keep = {};
  for (const k in muls) if (muls[k] > 0) { keep[k] = GRAB[k]; GRAB[k] *= muls[k]; }
  try { return fn(); } finally { Object.assign(GRAB, keep); }
}
const _wrestlerTryGrab = tryGrab;
tryGrab = function (A) {
  const c = A.cls || {}, cd0 = A.grabCd, got = grabTuned({ reach: c.grabReach }, () => _wrestlerTryGrab(A));
  if (c.grabCd && A.grabCd !== cd0) A.grabCd *= c.grabCd;          // quicker recovery, hit or whiff
  return got;
};
// A Wrestler may hop while holding someone (everyone else's grab uses up the step).
const _wrestlerMovesActions = movesActions;
movesActions = function (f, grounded) {
  if (f.holding && f.cls && f.cls.throwPower && f.jumpBuf > 0 && f.jumpCd <= 0 && (grounded || f.coyote > 0)) {
    doJump(f, WRESTLER.hop);
    f.grabT = Math.max(f.grabT, G_STATE.t - GRAB.hold + .8);          // time to throw from the top of the hop
    swingHitsOff(f, .8);                                              // the flailing weapon mustn't hit who we carry
  }
  return _wrestlerMovesActions(f, grounded);
};
const _wrestlerGrabThrow = grabThrow;
grabThrow = function (A) {
  const c = A.cls || {};
  if (A.holding && c.throwPower && wrestlerHigh(A)) return wrestlerPiledriver(A);
  return grabTuned({ dmg: c.throwPower, throwVx: c.throwFling, throwVy: c.throwFling }, () => _wrestlerGrabThrow(A));
};
// Airborne high enough over real ground (never over a pit: that would just drop both of you out).
function wrestlerHigh(A) {
  const fy = feetY(A), g = groundBelow(A.P[2].x, fy);
  return !A.grounded && g != null && g - fy > WRESTLER.pileMin && g - fy < 600;
}
function wrestlerPiledriver(A) {
  const B = A.holding, hip = B.P[2];
  grabRelease(A);
  for (const p of B.P) { const u = vx(p); p.y = 2 * hip.y - p.y; p.ox = p.x - u * .2 * DT; p.oy = p.y - 1500 * DT; }   // flip head-down, drive it down
  for (const p of A.P) setVel(p, vx(p) * .2, 900);
  swingHitsOff(A, .9);
  addStatus(B, 'ragdoll', 1, 1, A);
  A.stats.throws++;
  float(chest(B).x, chest(B).y - 60, 'PILEDRIVER!', A.cls.color, 26);
  sfx('dash');
  skillZone({ owner: A, life: 1, kind: 'piledriver', victim: B, onStep: wrestlerPileStep });
  emit('throw', A, B);
}
// Waits for the head (or body) to meet the ground, then the impact: big damage, a stun and a small shockwave.
function wrestlerPileStep(z) {
  const B = z.victim, A = z.owner, head = B.P[0], g = groundBelow(head.x, head.y - 30);
  if (!B.alive) { z.dead = true; return; }
  if (!(B.P.slice(0, 3).some(p => p.g) || (g != null && g - head.y < 10)) && z.t < .8) return;
  z.dead = true;
  const x = head.x, y = g ?? head.y;
  removeStatus(B, 'ragdoll');
  damage(B, WRESTLER.pileDmg, { src: A, kind: 'skill', unblockable: true, x, y: y - 10, nx: 0, ny: -1, kb: 480, throw: true, status: ['stun', WRESTLER.pileStun] });
  for (const e of skillFoesNear(A, x, y - 40, WRESTLER.waveR)) if (e !== B) skillHit(A, e, WRESTLER.waveDmg, { kb: 600, ny: -.8 });
  ring(x, y, WRESTLER.waveR, '#ff6a3d', .4, 6); burst(x, y, '#ffe9a8', 26, 460);
  shake(16); sfx('s6-pile');
}
// CPU Wrestler: grabs from its longer reach; holding someone, it sometimes hops and piledrives instead of a plain throw.
function wrestlerCpu(f, L, dt) {
  const m = f.mem, foe = f.ai.foe;
  if (f.holding) {
    if (m.pileOn !== f.holding) { m.pileOn = f.holding; m.pileGo = chance(.15 + (L.grab || .2) * .5) && groundBelow(f.P[2].x, feetY(f) - 4) != null; }
    if (!m.pileGo) return;                                         // a plain throw (66's aiHoldAndThrow aims it)
    f.inp.grab = false;
    if (f.grounded && f.jumpCd <= 0) f.inp.jump = true;
    else if (!f.grounded && vy(f.P[2]) > -150 && wrestlerHigh(f)) f.inp.grab = true;   // drive them down from the top of the hop
    return;
  }
  m.pileOn = null;
  if (!foe || !canAct(f) || f.grabCd > 0 || f.mount || !canBeGrabbed(f, foe)) return;
  const a = chest(f), b = chest(foe), reach = GRAB.reach * f.cls.grabReach * f.scale + 18 * foe.scale;
  if (Math.hypot(b.x - a.x, (b.y - a.y) * 1.4) < reach && chance((L.grab || .2) * dt * 4)) f.inp.grab = true;
}

// ---------- Engineer ----------
const TURRET = { life: 8, every: .8, range: 650, dmg: 2, speed: 1150, hp: 30, hold: .45, simpleAt: 3 };
const ENG = { throwNext: null };   // 34's throwNext, kept at boot so a released charge can still throw

const engCan = f => !!(f.cls && f.cls.turret) && f.alive && !f.summon && !f.mem.turretUsed;
// Where the turret would stand: on the ground just in front, or null over a drop.
function engSpot(f) {
  const x = clamp(f.P[2].x + f.face * 46 * f.scale, 30, W - 30), fy = feetY(f), gy = groundBelow(x, fy - 30);
  return gy == null || gy - fy > 140 ? null : { x, gy };
}
function engDeploy(f) {
  const s = engSpot(f);
  f.mem.engCharge = null;
  if (!s) { float(f.P[0].x, f.P[0].y - 50, 'NO GROUND', '#ff8a2e', 16); return null; }
  f.mem.turretUsed = true;
  skillZone({ owner: f, x: s.x, y: s.gy, life: TURRET.life, kind: 'turret', hp: TURRET.hp, maxHp: TURRET.hp, cool: .35, scan: 0,
    aim: f.face > 0 ? 0 : Math.PI, hitT: -9, on: zoneSolidAt(s.x, s.gy), onStep: engTurretStep, draw: engTurretDraw });
  float(s.x, s.gy - 70, 'TURRET UP!', f.cls.color, 20);
  sfx('rift-rod');
}
function engTurretStep(z, dt) {
  const f = z.owner, hx = z.x, hy = z.y - 30;
  if (!f.alive || !zoneRide(z)) { engTurretBreak(z); return; }    // it goes down with its Engineer
  const near = (p, r) => Math.hypot(p.x - hx, p.y - hy - 12) < r, shot = enemyShotsHit(z.team, p => near(p, p.r + 16));
  if (z.t - z.hitT > .3 && enemyTipHits(z.team, t => near(t, 28))) { z.hitT = z.t; engTurretHurt(z, 10); }
  if (shot) engTurretHurt(z, shot);
  if (z.dead) return;
  if ((z.scan -= dt) <= 0) { z.scan = .15; z.target = engTurretTarget(z); }
  const foe = z.target && z.target.alive ? z.target : null;
  if (!foe) return;
  const c = chest(foe);
  z.aim += aiWrap(Math.atan2(c.y - hy, c.x + vx(foe.P[2]) * .12 - hx) - z.aim) * Math.min(1, dt * 10);
  if ((z.cool -= dt) > 0) return;
  z.cool = TURRET.every; z.shotT = z.t;
  spawnProj({ owner: f, x: hx + Math.cos(z.aim) * 18, y: hy + Math.sin(z.aim) * 18, vx: Math.cos(z.aim) * TURRET.speed, vy: Math.sin(z.aim) * TURRET.speed,
    r: 3, dmg: TURRET.dmg, life: .7, kind: 'turret-shot', color: f.color, dmgKind: 'skill', kb: 120, small: true });
  sfx('gun-pop', .45);
}
// The nearest visible foe within range (a shot at one behind a block just breaks on it).
function engTurretTarget(z) {
  let best = null, bd = TURRET.range;
  for (const e of F) {
    const d = Math.hypot(chest(e).x - z.x, chest(e).y - z.y + 30);
    if (e.alive && e.team !== z.team && d < bd && !(e.status.invis && d > 190)) { bd = d; best = e; }
  }
  return best;
}
function engTurretHurt(z, n) { z.hp -= n; z.hurtT = z.t; if (z.hp <= 0) engTurretBreak(z); else sfx('brkStone', .3); }
function engTurretBreak(z) {
  if (z.dead) return;
  z.dead = true;
  burst(z.x, z.y - 20, '#c9cdee', 18, 360); burst(z.x, z.y - 20, z.owner.color, 10, 260);
  sfx('shatter', .6);
}
// A tripod with a barrel tracking its target and a ring for the time it has left.
function engTurretDraw(ctx, z) {
  const col = z.owner.color, hx = z.x, hy = z.y - 30;
  ctx.save(); ctx.lineCap = 'round';
  for (const s of [-1, 0, 1]) lineXY(ctx, hx, hy + 6, hx + s * 14, z.y, '#8a93b8', 3.5);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(z.aim);
  ctx.fillStyle = '#2a3048'; ctx.fillRect(0, -3.5, 20, 7);
  if (z.t - (z.shotT ?? -9) < .06) circle(ctx, 23, 0, 5, '#fff6c8');
  ctx.restore();
  glow(ctx, col, 8, () => circle(ctx, hx, hy, 10, z.t - (z.hurtT ?? -9) < .1 ? '#ffffff' : '#3a4058', col, 2.5));
  ctx.strokeStyle = rgba(col, .8); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(hx, hy, 14, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(1 - z.t / z.life, 0, 1)); ctx.stroke();
  if (z.hp < z.maxHp) { ctx.fillStyle = '#ff6a6a'; ctx.fillRect(hx - 14, hy - 24, 28 * z.hp / z.maxHp, 4); }
  ctx.restore();
}

// Each step: a human holding the throwable key charges the turret (letting go early throws as usual); Simple
// controls have no throwable key, so the turret builds itself a few seconds into the round.
on('mapStep', dt => {
  if (G_STATE.lock > 0) return;
  for (const f of F) {
    if (!engCan(f)) continue;
    const ch = f.mem.engCharge;
    if (ch && !canAct(f)) f.mem.engCharge = null;
    else if (ch && f.inp.throwHeld) { if ((ch.t += dt) >= TURRET.hold) engDeploy(f); }
    else if (ch) { f.mem.engCharge = null; ENG.throwNext(f); }
    else if (f.ctrl === 'human' && !f.autopilot && simpleOn(f.slot) && G_STATE.roundT > TURRET.simpleAt && f.grounded && canAct(f)) engDeploy(f);
  }
});
// CPU Engineer: sets the turret up with a little room to spare, facing the foe.
function engineerCpu(f, L, dt) {
  const foe = f.ai.foe, d = foe ? Math.abs(foe.P[2].x - f.P[2].x) : 0;
  if (engCan(f) && foe && foe.alive && canAct(f) && f.grounded && !f.mount && d > 150 && d < 700 && chance((L.skill || .5) * dt * 2.5) && engSpot(f)) engDeploy(f);
}

on('boot', () => {
  ENG.throwNext = throwNext;
  throwNext = function (f) {
    if (!engCan(f)) return ENG.throwNext(f);
    if (![0, 1].some(k => f.throwN[k] > 0 && THROWABLES[f.throws[k]])) { engDeploy(f); return null; }   // none left: deploy
    if (f.ctrl === 'human' && !f.autopilot) { f.mem.engCharge = f.mem.engCharge || { t: 0 }; return null; }  // tap throws, hold deploys
    return ENG.throwNext(f);
  };
  const _engReadHuman = readHuman;
  readHuman = function (f) { _engReadHuman(f); f.inp.throwHeld = !simpleOn(f.slot) && heldAction(f.slot, 'throw'); };
  // The turret's HUD badge after the throwables: lit while unused, a ring while it charges.
  const _engDrawThrowIcons = drawThrowIcons;
  drawThrowIcons = function (f, cx, y, dir) {
    cx = _engDrawThrowIcons(f, cx, y, dir);
    if (!f.cls || !f.cls.turret || f.summon) return cx;
    const ready = !f.mem.turretUsed, col = f.cls.color, ch = f.mem.engCharge;
    hudBadge(cx, y, 10, rgba(col, ready ? .9 : .25), 1.5, ready ? col : rgba(col, .3), 11, '⚙');
    if (ch) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, y, 12, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(ch.t / TURRET.hold, 0, 1)); ctx.stroke(); }
    return cx + dir * 29;
  };
  const _clsAiTuned = aiTuned;
  aiTuned = function (f) {
    const L = _clsAiTuned(f), m = f.cls && f.cls.ai;
    if (m) for (const k in m) if (typeof L[k] === 'number') L[k] = Math.min(.95, L[k] * m[k]);
    return L;
  };
  const _think = think;
  think = function (f, dt) { _think(f, dt); for (const fn of THINK_AFTER) fn(f, dt); };
  Object.assign(LORE_LINES.c, {
    duelist: 'Crystal Court fencers learned to parry from mirrors that never blink. They turn the swing aside and answer before its echo fades.',
    wrestler: 'Ember Wastes pit fighters settle arguments by lifting them. A Wrestler who reaches you is already planning the trip down, head first.',
    engineer: 'Robo Factory tinkerers who never chose between building and brawling. Their turrets are loyal, loud and held together with tape.',
  });
  defSfx('s6-riposte', v => { metal(1900, .3, .09 * v); noiseSweep(.18, 6000, 1500, .12 * v, 'highpass'); tone(1200, 600, .2, 'sawtooth', .04 * v); });
  defSfx('s6-pile', v => { thump(110, 30, .55, .9 * v); noise(.5, 260, .6 * v, 'lowpass'); noise(.25, 1800, .2 * v, 'bandpass', .04); });
});
