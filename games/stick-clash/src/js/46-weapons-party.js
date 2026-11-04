// 46-weapons-party.js: the Party Arsenal (v6). Twelve silly weapons, each built around ONE trick no other weapon has:
// Tennis Racket (timed returns), Umbrella (canopy + glide), Yo-Yo (out and back, walk the dog), Paint Roller (slippery
// stripes), Snowball Launcher (chill stacks, then a snowman), Water Blaster (push, soak, douse), Magnet Glove (tractor
// pull, weapon rip, bends metal shots), Pogo Hammer (bounce, landing wave), Rock Guitar (power-chord cone), Banana
// Launcher (peels that trip), Plunger Bow (tether and yank) and Pillow (feathers, PILLOW FIGHT! K.O.s).
// Every special hit goes through damage(), so weapon power, levels, guards and the codex see it. Trick state lives in
// f.mem, statuses and PROJ zones, so each round starts clean; pwRoundEnd also clears it the moment a round is decided.
// emit('weaponTrick', f, key, B) fires whenever a trick lands (tests listen; anything else may too).

// Tuning in one place. Times in s, speeds in px/s, distances in px.
const PW = {
  aceWin: .2, aceSpeed: 1.7, aceMax: 2800, aceDmg: 1.4, aceCap: 6,          // racket: sweet-spot window, return boost
  glideFall: 130, glideSteer: 420, canopyAt: .6,                                           // umbrella glide
  yoyoReach: 3.3, yoyoOut: .19, dogReach: 2.5, dogMax: 2.4, dogDmg: 2, dogTick: .14,
  paintLen: 200, paintLife: 5, paintMax: 3, paintGrip: .1, paintFric: .02,   // roller: stripe size, grip and friction left
  chillSecs: 4, chillSlow: .12, snowFreeze: 1.1,
  soakSecs: 4, soakShock: 1.5, waterShove: 75,
  magDelay: .18, magReach: 380, magPull: 2600, magRip: 1.2, magHeat: 2, magCool: 1.6, magTurn: 30, magBendR: 260,
  pogoVel: 1450, pogoChain: .5, pogoWave: 130, pogoWaveDmg: 6,
  chordSpeed: 950, chordLife: .36, chordDmg: 7, chordHold: .7, chordCd: 4,
  peelLife: 8, peelMax: 4, peelDmg: 5, splatFrom: 420, pillowPop: 500,
  tetherSecs: 2.5, ropeMin: 140, ropeMax: 320, yankDmg: 7, yankPow: 1250,
};
const PW_KINDS = new Set(['paint', 'peel', 'chord', 'feather', 'pw-fx']);       // PROJ entries cleared at round end
const PW_STATUSES = ['chilled', 'snowman', 'soaked', 'slick', 'tethered'];
const PW_METAL = new Set(['bullet', 'bolt', 'kunai', 'javelin', 'arrow']);   // shots the magnet catches (not explosives)
const PW_SHOCK_W = new Set(['storm-staff', 'conductor', 'plasma-staff', 'plasma-end']);          // lightning weapons

// ---------- shared helpers ----------
function pwTrick(f, key, B) { if (f) emit('weaponTrick', f, key, B || null); }
// A short teaching label over B, at most once per `secs` for this effect.
function pwSay(f, B, key, text, color, secs = 1.2) { if (f && axOnce(f, B, key, secs)) float(B.P[0].x, B.P[0].y - 54, text, color, 22); }
// Purely visual decor (feathers, snow puffs): skipped in headless sims.
function pwFx(o) { if (!G_STATE.sim) rangedDecor(Object.assign({ kind: 'pw-fx', life: .5 }, o)); }
// During a kill-cam replay a fighter we hold a reference to is drawn as its ghost.
const pwSeen = f => (KC.play && KC.play.ghosts.get(f)) || f;
// The floor or platform top at or below (x, y): { y, s } (s = the solid to ride, or null), or null over a gap.
function pwSurface(x, y) {
  const gy = groundBelow(x, y - 6);
  if (gy == null || gy > H + 40) return null;
  return { y: gy, s: MAP.solids.find(o => x >= o.x && x <= o.x + o.w && Math.abs(o.y - gy) < 2) || null };
}
// Floor zones ride their moving platform; false when the platform is gone (a broken crate).
function pwRide(z) {
  if (!z.s) return true;
  if (!MAP.solids.includes(z.s)) return false;
  z.x += z.s.dx; z.y += z.s.dy;
  return true;
}
// Keeps one fighter's newest `max` zones of one kind, retiring the oldest.
function pwKeep(f, key, max, zone) {
  const list = (f.mem[key] || []).filter(z => !z.dead);
  while (list.length >= max) list.shift().dead = true;
  list.push(zone); f.mem[key] = list;
}
// Feet out, head back: the yo-yo and the banana peel knock fighters flat this way.
function pwTrip(B, dir, power = 1) {
  for (const j of [7, 8, 9, 10]) kick(B.P[j], dir * 760 * power, -300 * power);
  kick(B.P[0], -dir * 280 * power, 0); kick(B.P[1], -dir * 160 * power, 0);
  tumbleKick(B, -dir, .7 * power);
  B.stagger = Math.max(B.stagger, .6 * power); B.atkCd = Math.max(B.atkCd, .35);
}
// A lob that lands on the nearest visible foe (leading a runner a little): snowballs and bananas.
function pwLob(f, speed, grav, o) {
  if (!rangedSpend(f)) return null;
  const b = rangedBarrel(f), foe = nearestEnemy(f, true), g = PHYS.gravity * grav;
  const c = foe ? chest(foe) : { x: b.x + f.face * 400, y: b.y }, tx = c.x + (foe ? clamp(vx(foe.P[2]), -500, 500) * .3 : 0) + rnd(-18, 18);
  const T = clamp(Math.abs(tx - b.x) / speed, .28, .95);
  return spawnProj(Object.assign({ owner: f, x: b.x, y: b.y, vx: (tx - b.x) / T, vy: (c.y - b.y - .5 * g * T * T) / T, grav }, o));
}
// Enemy shots a weapon may touch: real projectiles only (no zones, decor or pickups).
const pwShot = (p, f) => !p.dead && !p.zone && p.r > 0 && p.team !== f.team;

// ---------- statuses ----------
defStatus('chilled', { name: 'Chilled', icon: '❅', color: '#bfe9ff', debuff: true, max: 5,
  moveMul: (f, s) => 1 - PW.chillSlow * (s.n || 1),
  draw(ctx, f, s) {                                                      // a column of 1-3 snowflakes: the stack meter
    const c = chest(f), k = f.scale;
    for (let i = 0; i < 3; i++) pwFlake(ctx, c.x - f.face * 30 * k, c.y - 22 * k + i * 14 * k, 5 * k, i < (s.n || 1) ? '#e8f8ff' : 'rgba(191,233,255,.25)');
  } });
defStatus('snowman', { name: 'Snowman', icon: '☃', color: '#ffffff', debuff: true, max: 2,
  tick(f, dt, s) { if (!f.status.freeze) s.t = 0; },                     // melts with the freeze it dresses up
  draw(ctx, f) { snowmanDraw(ctx, f); } });
defStatus('soaked', { name: 'Soaked', icon: '≈', color: '#3fb8ff', debuff: true, max: 6,
  tick(f) { if (f.status.burn) removeStatus(f, 'burn'); },               // too wet to burn
  draw(ctx, f) {
    const t = G_STATE.t * 3 + f.id;
    for (const j of [0, 4, 6]) { const p = f.P[j], d = (t + j) % 1; circle(ctx, p.x, p.y + 6 + d * 18, 2.6 * f.scale * (1 - d * .5), rgba('#7fd0ff', .8 - d * .6)); }
  } });
defStatus('slick', { name: 'Slippery', icon: '◇', color: '#ff9ae6', debuff: true, max: .4,
  draw(ctx, f) { for (const j of [8, 10]) circle(ctx, f.P[j].x, f.P[j].y + 2, 6 * f.scale, rgba('#ffffff', .35)); } });
defStatus('tethered', { name: 'Tethered', icon: '⊸', color: '#ff3d5a', debuff: true, max: 3,
  tick(f, dt, s) { tetherPull(f, s); },
  draw(ctx, f, s) { tetherDraw(ctx, f, s); } });

function pwFlake(ctx, x, y, r, color) {
  for (let a = 0; a < 3; a++) { const c = Math.cos(a * Math.PI / 3) * r, s = Math.sin(a * Math.PI / 3) * r; lineXY(ctx, x - c, y - s, x + c, y + s, color, 1.8); }
}

// ---------- Tennis Racket: a well-timed swing returns any shot faster, harder, and now yours ----------
defWeapon('tennis-racket', {
  power: 1.15,
  name: 'Tennis Racket', cat: 'exotic', order: 43.2, color: '#d6ff3a', tier: 'rare',
  desc: 'A racket with a huge string bed. Swing just as a shot arrives (the strings flash white for a moment) to return it 70% faster and 40% harder, aimed at whoever fired it and now counting as yours. Rockets, grenades, bubbles and arrows all go back. Quick, light hits otherwise.',
  len: 76, mass: .8, dmg: .9, width: 8, cd: .42, kb: 1.1,
  arc: 'forehand flick', sig: 'timed swing returns shots: faster, harder, yours',
  ai: { range: 130, style: 'melee', think: racketThink },
  attack(f) { spinAttack(f, 1.05, 5); f.mem.aceT = PW.aceWin; f.mem.aceN = 0; },
  onStep(f, dt) { if (f.mem.aceT > 0) racketCatch(f, dt); },
  draw(ctx, f, s) { racketDraw(ctx, f, s); },
});
// The string bed is a capsule from above the grip to the tip; it catches any shot crossing it this step or the next.
function racketCatch(f, dt) {
  const m = f.mem, h = f.P[f.main.hand], t = f.P[f.tip], L = dist(h, t) || 1, k = 26 * f.scale;
  const ax = h.x + (t.x - h.x) / L * k, ay = h.y + (t.y - h.y) / L * k;
  m.aceT -= dt;
  for (const p of PROJ) {
    if (!pwShot(p, f)) continue;
    const r = segSeg(p.x - p.vx * dt, p.y - p.vy * dt, p.x + p.vx * dt, p.y + p.vy * dt, ax, ay, t.x, t.y);
    if (r.d > k + p.r) continue;
    racketReturn(f, p, r.qx, r.qy, m.aceN++ === 0);
    if (m.aceN >= PW.aceCap) { m.aceT = 0; return; }
  }
}
function racketReturn(f, p, x, y, first) {
  const from = p.owner && p.owner !== f && p.owner.alive ? p.owner : nearestEnemy(f, true);
  const sp = clamp(Math.hypot(p.vx, p.vy) * PW.aceSpeed, 1100, PW.aceMax), c = from ? chest(from) : { x: x + f.face * 500, y };
  const d = Math.hypot(c.x - x, c.y - y) || 1, T = d / sp;
  p.vx = (c.x - x) / d * sp; p.vy = (c.y - y) / d * sp - .5 * PHYS.gravity * (p.grav || 0) * T;   // lifted for falling shots
  Object.assign(p, { x, y, owner: f, team: f.team, hits: [], rolled: {}, color: '#d6ff3a', rally: (p.rally || 0) + 1 });
  p.t = Math.min(p.t, p.life * .3); p.life = Math.max(p.life, p.t + T + .3);
  if (p.dmg > 0) p.dmg *= PW.aceDmg;
  if (p.pdmg > 0) p.pdmg *= PW.aceDmg;
  if (p.mark) p.mark.dead = true;                                       // a mortar's landing marker no longer applies
  if (first) {
    float(x, y - 30, p.rally > 1 ? 'RALLY ×' + p.rally : 'ACE!', '#d6ff3a', 24);
    ring(x, y, 36, '#d6ff3a', .25, 4); sfx('pw-ace'); hitstop(.03);
  }
  pwTrick(f, 'ace', from);
}
// CPUs swing when a shot is about to arrive; better levels read the timing more often.
function racketThink(f) {
  if (f.atkCd > 0 || f.mem.aceT > 0) return;
  const p = incoming(f);
  if (!p || !(p.r > 0) || f.ai.aceSeen === p) return;
  const c = chest(f), eta = Math.hypot(p.x - c.x, p.y - c.y) / (Math.hypot(p.vx, p.vy) || 1);
  if (eta > .15) return;
  f.ai.aceSeen = p;
  if (chance(.3 + .6 * aiLevel(f).dodge)) f.inp.attack = true;
}
function racketDraw(ctx, f, s) {
  const k = s.k, hot = f.mem.aceT > 0, c = s.at(s.L - 20 * k), rx = 21 * k, ry = 15 * k;
  meleeHandle(ctx, s, 13, '#f2f2f8', 6);                                  // white grip tape
  for (let d = -12; d < 0; d += 4) meleeGuard(ctx, s, d * k, 3, '#9aa1b8', 1);
  line(ctx, s.h, s.at(s.L - 38 * k), '#2c3150', 4 * k);                    // throat
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(Math.atan2(s.uy, s.ux));
  ctx.fillStyle = hot ? 'rgba(255,255,255,.45)' : 'rgba(214,255,58,.12)';
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = hot ? '#ffffff' : 'rgba(235,240,255,.75)'; ctx.lineWidth = 1.1 * k; ctx.beginPath();
  for (let i = -2; i <= 2; i++) {                                          // the string grid, clipped to the oval
    const x = i * 6.5 * k, hy = ry * Math.sqrt(1 - (x / rx) ** 2), y = i * 5 * k, hx = rx * Math.sqrt(1 - (y / ry) ** 2);
    ctx.moveTo(x, -hy); ctx.lineTo(x, hy); ctx.moveTo(-hx, y); ctx.lineTo(hx, y);
  }
  ctx.stroke();
  glow(ctx, '#d6ff3a', hot ? 18 : 6, () => { ctx.strokeStyle = '#d6ff3a'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke(); });
  ctx.restore();
}

// ---------- Umbrella: guard opens a canopy that covers you from above; hold attack in the air to glide ----------
defWeapon('umbrella', {
  power: 1.06,
  name: 'Umbrella', cat: 'shield', order: 61, color: '#ff4f7b', tier: 'rare',
  desc: 'A sturdy brolly with a steel tip; attack is a quick lunging poke. Guard and it pops open in your colour: the canopy also covers you from above, so hits and shells coming down are blocked from any side and falling shots bounce off it. Hold attack in the air to open it and glide: a slow, floaty fall you can steer.',
  len: 94, mass: .85, dmg: .84, width: 5, cd: .46, guard: .8,
  arc: 'lunging poke', sig: 'guard: canopy covers above; hold attack in the air: glide',
  ai: { range: 155, style: 'melee', think: umbrellaThink },
  attack(f) { meleeThrust(f, 1.02, f.main, f.grounded ? 170 : 60); },
  onStep(f, dt) { umbrellaStep(f, dt); },
  draw(ctx, f, s) { umbrellaDraw(ctx, f, s); },
});
function umbrellaStep(f, dt) {
  const m = f.mem, glide = !f.grounded && f.inp.attackHeld && canAct(f) && !f.blocking && !f.heldBy && !f.mount;
  if ((glide || f.blocking) && !m.umbOpen) sfx('pw-umbrella', .6);
  m.umbOpen = glide || f.blocking;
  if (m.umbOpen) umbrellaCanopy(f);
  if (!glide) { m.glideT = 0; return; }
  if ((m.glideT = (m.glideT || 0) + dt) > .3 && m.glideT - dt <= .3) pwTrick(f, 'glide');
  const P = f.P, neck = P[1], s = f.scale, mx = clamp(f.inp.mx, -1, 1);
  spring(P[6], neck.x + f.face * 6 * s, neck.y - 30 * s, 380, 16);        // arm up, canopy overhead
  spring(P[f.tip], P[6].x + f.face * 6 * s, P[6].y - f.w.len * s, 420, 18);
  for (const p of P) {
    const v = vy(p);
    if (v > PW.glideFall) p.oy = p.y - lerp(v, PW.glideFall, .5) * DT;   // a slow, floaty fall...
    p.fx += (mx * PW.glideSteer - vx(p)) * 3;                            // ...with extra air control to steer it
  }
}
// The open canopy bats away enemy shots falling onto it (they bounce off; nobody's side changes).
function umbrellaCanopy(f) {
  const h = f.P[f.main.hand], t = f.P[f.tip], R = 46 * f.scale, cx = lerp(h.x, t.x, PW.canopyAt), cy = lerp(h.y, t.y, PW.canopyAt);
  for (const p of PROJ) {
    if (!pwShot(p, f) || p.vy <= 0) continue;
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d, dot = p.vx * nx + p.vy * ny;
    if (d > R + p.r || dy > R * .35 || dot >= 0) continue;
    p.vx = (p.vx - 2 * dot * nx) * .6; p.vy = (p.vy - 2 * dot * ny) * .6;
    p.x = cx + nx * (R + p.r + 1); p.y = cy + ny * (R + p.r + 1);
    burst(p.x, p.y, '#ffb3cc', 6, 200, { life: .2 }); sfx('pw-plink', .7);
    pwTrick(f, 'canopy');
  }
}
// A raised umbrella also guards hits that come down from above, whatever side they come from.
const pwGuardFront0 = guardFront;
guardFront = function (B, A, o) { return umbrellaAbove(B, o) || pwGuardFront0(B, A, o); };
function umbrellaAbove(B, o) {
  if (B.wkey !== 'umbrella' || !B.blocking) return false;
  return o.proj ? o.proj.vy > Math.abs(o.proj.vx) * .5 : (o.ny || 0) > .5;
}
// CPUs glide when falling far or over a pit, and open the canopy when shells rain down on them.
function umbrellaThink(f) {
  const fy = feetY(f), g = groundBelow(f.P[2].x, fy);
  f.inp.attackHeld = !f.grounded && vy(f.P[2]) > 60 && (g == null || g - fy > 160);
  const p = incoming(f);
  if (p && f.grounded && p.vy > 250 && p.y < f.P[0].y && f.ai.umbSeen !== p) { f.ai.umbSeen = p; if (chance(.4 + .5 * aiLevel(f).dodge)) aiGuard(f, 0, .45); }
}
function umbrellaDraw(ctx, f, s) {
  const k = s.k, L = s.L, open = f.mem.umbOpen, col = s.color;
  const hook = s.at(-16 * k), cup = s.at(-16 * k, 9 * k * s.face);       // the J handle
  ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 5 * k; ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(s.h.x, s.h.y); ctx.lineTo(hook.x, hook.y); ctx.quadraticCurveTo(cup.x - s.ux * 10 * k, cup.y - s.uy * 10 * k, cup.x, cup.y); ctx.stroke();
  line(ctx, s.h, s.t, '#c9cdee', 2.5 * k);                                 // shaft
  if (!open) {                                                             // folded canopy with a strap
    poly(ctx, [s.at(L * .28, -2 * k), s.at(L * .45, -6 * k), s.at(L * .9, -1.5 * k), s.at(L * .9, 1.5 * k), s.at(L * .45, 6 * k), s.at(L * .28, 2 * k)], col, rgba('#000000', .3), 1);
    meleeGuard(ctx, s, L * .55, 6, '#ffffff', 2);
    return;
  }
  const c = s.at(L * PW.canopyAt), R = 46 * k, a = Math.atan2(s.uy, s.ux);
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(a);
  ctx.beginPath(); ctx.ellipse(0, 0, R * .55, R, 0, -Math.PI / 2, Math.PI / 2); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * k; ctx.beginPath();     // ribs from the crown to the rim
  for (const o of [-.6, 0, .6]) { ctx.moveTo(R * .55, 0); ctx.quadraticCurveTo(R * .4, o * R * .7, 0, o * R); }
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, -R + R * .25 + i * R * .5, R * .25, Math.PI / 2, Math.PI * 1.5); ctx.fill(); }   // scalloped rim
  ctx.restore();
}

// ---------- Yo-Yo: flings out and snaps back (hits both ways); hold to walk the dog along the floor ----------
defWeapon('yoyo', {
  power: .8,
  name: 'Yo-Yo', cat: 'chain', order: 45.5, color: '#ff8a2e', tier: 'rare',
  desc: 'A heavy competition yo-yo. Attack flings it out on its string and it snaps straight back, so it can hit on the way out and again on the way home. Keep holding attack on the ground and it drops to the floor and "walks the dog": it rolls along in front of you, nipping ankles and tripping the first foe it runs into.',
  len: 52, mass: .5, dmg: .92, width: 7, chain: 3, cd: .52, kb: .95,
  arc: 'fling and snap back', sig: 'hits out and back; hold: walk the dog (trips)',
  ai: { range: 205, style: 'melee', think: yoyoThink },
  onEquip(f) { f.mem.yoyo = null; },
  attack(f) { yoyoFling(f); },
  onStep(f, dt) { yoyoStep(f, dt); },
  onHit(A, B) { const y = A.mem.yoyo; if (y && y.back && !y.dog) { pwSay(A, B, 'yoyoBack', 'AND BACK!', '#ff8a2e'); pwTrick(A, 'yoyo-return', B); } },
  draw(ctx, f, s) { yoyoDraw(ctx, f, s); },
});
function yoyoFling(f) {
  const u = meleeAim(f), pts = f.main.pts.slice(1);
  axStretch(f.main, PW.yoyoReach);
  pts.forEach((j, i) => kick(f.P[j], u.x * (1300 + i * 500), u.y * (1300 + i * 500) - 140));
  f.mem.yoyo = { t: 0, back: false, dog: 0, rig: f.main };
  f.swingT = .32;
  sfx('pw-zip', .7);
}
function yoyoHome(f) {
  axStretch(f.main, 1);
  const h = f.P[f.main.hand], t = f.P[f.tip], d = dist(h, t) || 1;
  kick(t, (h.x - t.x) / d * 1300, (h.y - t.y) / d * 1300);
  sfx('pw-snap', .5);
}
function yoyoStep(f, dt) {
  const y = f.mem.yoyo;
  if (!y) return;
  if (y.rig !== f.main || !f.alive) { f.mem.yoyo = null; return; }
  y.t += dt;
  if (!y.back) {
    if (y.t < PW.yoyoOut) return;
    y.back = true;
    for (const B of enemiesOf(f)) delete f.hitCd[strikeKey(B.id, false)];   // the trip home may hit them again
    if (f.inp.attackHeld && f.grounded && canAct(f)) { y.dog = DT; axStretch(f.main, PW.dogReach); }
    else yoyoHome(f);
    return;
  }
  if (!y.dog) { if (y.t > PW.yoyoOut + .3) f.mem.yoyo = null; return; }
  if (!f.inp.attackHeld || !f.grounded || !canAct(f) || (y.dog += dt) > PW.dogMax) { yoyoHome(f); y.dog = 0; return; }
  const tx = f.P[2].x + f.face * (100 + Math.sin(y.dog * 6) * 40) * f.scale, tip = f.P[f.tip];
  spring(tip, tx, (groundBelow(tx, feetY(f) - 30) ?? feetY(f)) - 9 * f.scale, 320, 20);   // roll along the floor ahead
  if ((y.tick = (y.tick || 0) - dt) > 0) return;
  for (const B of enemiesOf(f)) {
    if (!B.alive || B.inv > 0 || !HIT_SHAPES.some(T => segSeg(tip.x, tip.y, tip.x, tip.y, B.P[T.a].x, B.P[T.a].y, B.P[T.b].x, B.P[T.b].y).d < hurtR(B, T) + 11 * f.scale)) continue;
    y.tick = PW.dogTick;
    damage(B, PW.dogDmg, { src: f, kind: 'melee', weapon: f.w, x: tip.x, y: tip.y - 6, nx: f.face, ny: -.4, kb: 160, small: true, parts: [7, 8, 9, 10] });
    if (B.alive && B.grounded && axOnce(f, B, 'dog', 1.6)) {
      pwTrip(B, -f.face, .9);
      float(B.P[0].x, B.P[0].y - 54, 'WALKED THE DOG!', '#ff8a2e', 20);
      pwTrick(f, 'dog', B);
    }
  }
}
// CPUs decide as each throw leaves the hand whether to keep holding and walk the dog at a grounded foe.
function yoyoThink(f, foe, d) {
  const y = f.mem.yoyo;
  if (y && !y.rolled) { y.rolled = true; y.wantDog = foe.grounded && d > 110 && d < 240 && chance(.4); }
  f.inp.attackHeld = !!(y && y.wantDog);
}
function yoyoDraw(ctx, f, s) {
  const k = s.k, t = s.t, y = f.mem.yoyo, spin = G_STATE.t * (y ? (y.dog ? 40 : 25) : 4);
  ctx.strokeStyle = '#f2f2f8'; ctx.lineWidth = 1.4 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.h.x, s.h.y);
  for (const p of s.pts.slice(1)) ctx.lineTo(p.x, p.y);                     // the string
  ctx.stroke();
  circle(ctx, s.h.x, s.h.y, 3 * k, null, '#f2f2f8', 1.5);                  // finger loop
  if (y && y.dog) for (let i = 1; i < 3; i++) lineXY(ctx, t.x - s.face * (12 + i * 7) * k, t.y - i * 3 * k, t.x - s.face * (20 + i * 9) * k, t.y - i * 3 * k, rgba('#ff8a2e', .5), 2);
  circle(ctx, t.x, t.y, 11 * k, '#ff8a2e', '#7a2a0a', 2 * k);
  for (let i = 0; i < 3; i++) { const a = spin + i * TAU / 3; lineXY(ctx, t.x + Math.cos(a) * 5 * k, t.y + Math.sin(a) * 5 * k, t.x + Math.cos(a) * 10 * k, t.y + Math.sin(a) * 10 * k, '#ffd27a', 2 * k); }
  circle(ctx, t.x, t.y, 4.5 * k, '#2ad4ff');
}

// ---------- Paint Roller: every swing rolls a slippery stripe onto the surface you stand on ----------
defWeapon('paint-roller', {
  power: 1.12,
  name: 'Paint Roller', cat: 'polearm', order: 38, color: '#5ef2ff', tier: 'common', twoHanded: true,
  desc: 'A long-handled roller loaded with slick neon paint in your colour. Every swing on the ground rolls a wet stripe out in front of you on the floor or platform you stand on. For 5 s any foe on it slides as if on ice: no grip, no brakes. Up to three stripes at once.',
  len: 104, mass: 1.1, dmg: 1.05, width: 9, cd: .64, kb: 1.05,
  arc: 'low rolling sweep', sig: 'swings lay slippery paint stripes (5 s, max 3)',
  ai: { range: 160, style: 'melee', think: rollerThink },
  attack(f) { spinAttack(f, 1, 2); rollerPaint(f); },
  draw(ctx, f, s) { rollerDraw(ctx, f, s); },
});
function rollerPaint(f) {
  const g = f.grounded && pwSurface(f.P[2].x, feetY(f) - 4);
  if (!g) return;
  const lo = g.s ? g.s.x : 0, hi = g.s ? g.s.x + g.s.w : W;
  const a = clamp(f.P[2].x + f.face * 14 * f.scale, lo, hi), b = clamp(f.P[2].x + f.face * PW.paintLen * f.scale, lo, hi);
  if (Math.abs(b - a) < 30) return;
  pwKeep(f, 'paints', PW.paintMax, skillZone({ owner: f, x: (a + b) / 2, y: g.y, hw: Math.abs(b - a) / 2, dir: f.face, s: g.s,
    life: PW.paintLife, kind: 'paint', color: f.color, onStep: paintStep, draw: paintDraw }));
  sfx('pw-paint', .6);
}
// The stripe unrolls over .18 s from the roller outward: its live span right now.
function paintSpan(z) {
  const grow = Math.min(1, z.t / .18), x0 = z.x - z.hw, x1 = z.x + z.hw;
  return z.dir > 0 ? [x0, x0 + 2 * z.hw * grow] : [x1 - 2 * z.hw * grow, x1];
}
function paintStep(z) {
  if (!pwRide(z)) { z.dead = true; return; }
  const [lo, hi] = paintSpan(z);
  for (const B of F) {
    if (!B.alive || B.team === z.team || B.mount) continue;
    if (![B.P[8], B.P[10]].some(p => p.g && p.x > lo - 6 && p.x < hi + 6 && Math.abs(p.y - z.y) < 8)) continue;
    addStatus(B, 'slick', .25, 1, z.owner);
    paintSlide(B);
    if (z.owner && axOnce(z.owner, B, 'paint', 1.5)) { float(B.P[0].x, B.P[0].y - 54, 'SLIPPERY!', z.color, 20); pwTrick(z.owner, 'paint', B); }
  }
}
// Runs after the physics step: gives back most of the floor friction this step took from the feet, so the body glides.
function paintSlide(B) {
  const fr = PHYS.friction;
  if (fr <= PW.paintFric) return;
  const keep = (1 - PW.paintFric) / (1 - fr);
  for (const p of B.P) if (p.g) { const sdx = p.gs ? p.gs.dx : 0; p.ox = p.x - sdx - (p.x - p.ox - sdx) * keep; }
}
// Grip is cut after the arena's own step (Frost Peak sets grip) and before the weather's (snow stacks on top); last
// step's cut is undone first unless something else has set grip since.
on('mapStep', () => {
  for (const f of F) {
    const m = f.mem;
    if (m.pwGripSet != null && f.grip === m.pwGripSet) f.grip = m.pwGripBase;
    m.pwGripSet = null;
    if (!f.alive || !f.status.slick) continue;
    m.pwGripBase = f.grip; f.grip = (f.grip ?? 1) * PW.paintGrip; m.pwGripSet = f.grip;
  }
});
// CPUs also roll paint out ahead of a foe walking in at mid range, so they arrive on a slick floor.
function rollerThink(f, foe, d) {
  if (f.grounded && f.atkCd <= 0 && d > 170 && d < 300 && Math.abs(feetY(foe) - feetY(f)) < 20 && Math.sign(vx(foe.P[2])) === -Math.sign(foe.P[2].x - f.P[2].x) && chance(.05)) f.inp.attack = true;
}
function rollerDraw(ctx, f, s) {
  const k = s.k, L = s.L;
  line(ctx, s.at(-16 * k), s.at(L - 6 * k), '#c9cdee', 4 * k);                // pole
  meleeHandle(ctx, s, 16, '#2a2d3e', 7);
  const a = s.at(L, -17 * k), b = s.at(L, 17 * k);
  line(ctx, s.at(L - 8 * k), s.at(L - 2 * k), '#8e96c4', 4 * k);
  line(ctx, a, b, s.color, 13 * k);                                            // the roller, soaked in your colour
  line(ctx, s.at(L - 3 * k, -15 * k), s.at(L - 3 * k, 15 * k), rgba('#ffffff', .35), 2.5 * k);
  const drip = s.at(L + 4 * k, (G_STATE.t * 9 % 2 - 1) * 10 * k);
  circle(ctx, drip.x, drip.y + 7 * k, 2.4 * k, s.color);
}
function paintDraw(ctx, z) {
  const [lo, hi] = paintSpan(z), fade = Math.min(1, (z.life - z.t) * 1.5);
  ctx.globalAlpha = .85 * fade;
  ctx.fillStyle = z.color; ctx.fillRect(lo, z.y - 6, hi - lo, 7);
  circle(ctx, lo, z.y - 2.5, 3.5, z.color); circle(ctx, hi, z.y - 2.5, 3.5, z.color);
  for (let x = lo + 18; x < hi - 10; x += 34) circle(ctx, x, z.y + 2, 2.5, z.color);   // drips over the edge
  ctx.globalAlpha = .6 * fade;
  lineXY(ctx, lo + 4, z.y - 4.5, hi - 4, z.y - 4.5, '#ffffff', 1.5);           // wet shine
  ctx.globalAlpha = 1;
}

// ---------- Snowball Launcher: lobbed snowballs stack Chill; the third stack freezes the foe in a snowman ----------
defWeapon('snowball', {
  power: .8,
  name: 'Snowball Launcher', cat: 'ranged', order: 25.5, color: '#dff4ff', tier: 'common', twoHanded: true,
  desc: 'A hand-cranked tube that lobs packed snowballs in an arc onto the target. Each hit adds a stack of Chill (12% slower per stack, 4 s, shown as snowflakes beside them). The third stack freezes the foe solid inside a snowman for a second, and the next hit shatters the ice for bonus damage.',
  len: 50, mass: 1.1, dmg: .25, width: 7, bodyRecoil: 80,
  arc: 'arcing lob', sig: 'chill stacks; the 3rd freezes the foe in a snowman',
  ranged: { cooldown: .5, ammo: 4, reload: 1.9, speed: 1000, spread: .04, recoil: 140, sfx: 'pw-snow', proj: { grav: .75 } },
  ai: { range: 380, style: 'kite' },
  attack(f) {
    rangedAttack(f, g => pwLob(g, 1000, .75, rangedProj({ dmg: 6, r: 8, life: 1.8, kb: 200, kind: 'snowball', color: '#ffffff', trail: false,
      onHit(p, B, dealt) { if (dealt > 0) snowChill(B, p.owner); }, onExpire: snowPuff, draw: snowballDraw })));
  },
  draw(ctx, f, s) { snowLauncherDraw(ctx, f, s); },
});
function snowChill(B, A) {
  if (!B.alive || B.status.freeze) return;
  const s = addStatus(B, 'chilled', PW.chillSecs, 1, A);
  if (!s) return;
  s.n = Math.min(3, (s.n || 0) + 1);
  if (s.n < 3 || B.immune.freeze > G_STATE.t) return;                      // a fresh thaw: the next hit freezes
  removeStatus(B, 'chilled');
  if (!addStatus(B, 'freeze', PW.snowFreeze, 1, A)) return;
  addStatus(B, 'snowman', PW.snowFreeze, 1, A);
  float(B.P[0].x, B.P[0].y - 64, 'SNOWMAN!', '#dff4ff', 26);
  sfx('pw-snowman'); pwTrick(A, 'snowman', B);
}
function snowPuff(p, why) {
  if (why !== 'world') return;
  pwFx({ x: p.x, y: p.y, life: .6, draw(ctx, q) { const a = q.t / q.life; ctx.globalAlpha = .7 * (1 - a); for (let i = 0; i < 5; i++) circle(ctx, q.x + (i - 2) * 9 * (1 + a), q.y - 4 - a * 14 - (i % 2) * 6, 6 + a * 6, '#ffffff'); ctx.globalAlpha = 1; } });
}
function snowballDraw(ctx, p) {
  circle(ctx, p.x, p.y, 8, '#ffffff', '#9fc8e8', 2);
  circle(ctx, p.x - 2.5, p.y - 2.5, 2.5, '#e8f8ff');
}
function snowLauncherDraw(ctx, f, s) {
  const k = s.k, side = rangedSide(s), crank = s.at(6 * k, 10 * k * side), a = G_STATE.t * (f.reload > 0 ? 14 : 2);
  line(ctx, s.h, s.at(-4 * k, 12 * k * side), '#30344c', 7 * k);
  line(ctx, s.at(-12 * k), s.t, '#8fb8d8', 13 * k);                         // tube
  line(ctx, s.at(-12 * k), s.t, '#dff4ff', 8 * k);
  line(ctx, s.at(s.L - 5 * k), s.t, '#5a7a98', 15 * k);
  for (let i = 0; i < f.ammo; i++) { const p = s.at((2 + i * 8) * k, -11 * k * side); circle(ctx, p.x, p.y, 4 * k, '#ffffff', '#9fc8e8', 1); }   // snowballs in the hopper
  lineXY(ctx, crank.x, crank.y, crank.x + Math.cos(a) * 7 * k, crank.y + Math.sin(a) * 7 * k, '#c9a46a', 2.5 * k);
  rangedDrawReload(ctx, f, s, '#dff4ff', f.w.ranged);
}
function snowmanDraw(ctx, f) {
  const k = f.scale, hip = f.P[2], head = f.P[0], c = chest(f), fc = f.face;
  ctx.globalAlpha = .94;
  circle(ctx, hip.x, hip.y + 16 * k, 30 * k, '#f4fbff', '#bfe0f5', 2.5);
  circle(ctx, c.x, c.y - 6 * k, 22 * k, '#f8fdff', '#bfe0f5', 2.5);
  circle(ctx, head.x, head.y, 16 * k, '#ffffff', '#bfe0f5', 2.5);
  ctx.globalAlpha = 1;
  line(ctx, { x: head.x - 13 * k, y: head.y + 13 * k }, { x: head.x + 13 * k, y: head.y + 13 * k }, f.color, 5 * k);   // scarf in their colour
  for (const e of [-1, 1]) circle(ctx, head.x + fc * 4 * k + e * 5 * k, head.y - 4 * k, 2.2 * k, '#1a1c2c');
  poly(ctx, [{ x: head.x + fc * 4 * k, y: head.y }, { x: head.x + fc * 18 * k, y: head.y + 3 * k }, { x: head.x + fc * 4 * k, y: head.y + 5 * k }], '#ff8a2e');
  for (const o of [-6, 4]) circle(ctx, c.x, c.y + o * k, 2.4 * k, '#1a1c2c');
  for (const side of [-1, 1]) lineXY(ctx, c.x + side * 20 * k, c.y - 8 * k, c.x + side * 36 * k, c.y - 22 * k, '#6b4a2e', 2.5 * k);
}

// ---------- Water Blaster: a strong pushing stream that soaks, douses fire and conducts lightning ----------
defWeapon('water-blaster', {
  power: 1.15,
  name: 'Water Blaster', cat: 'ranged', order: 23.5, color: '#3fb8ff', tier: 'common', twoHanded: true,
  desc: 'A pump-action super soaker. Hold attack for a long arcing stream: very little damage, but a strong push that walks foes back, into walls and off ledges. Anyone it hits stops burning and is Soaked for 4 s: they cannot catch fire, and lightning or shock hits them 50% harder (Storm Staff, Conductor Rods, Storm Call, shock weapons, electric floors).',
  len: 54, mass: 1.15, dmg: .25, width: 6,
  arc: 'pressure stream', sig: 'big push; soaks: no burning, +50% from lightning and shock',
  ranged: { cooldown: .05, ammo: 40, reload: 2.2, auto: true, speed: 1150, spread: .05, recoil: 12, sfx: 'gun-silent',
    proj: { dmg: 0, pdmg: .85, pkb: 230, packWindow: .25, packKey: 'water', r: 7, life: .42, grav: .45, drag: .5, pierce: 1, kind: 'water', trail: false,
      onHit: waterHit, draw: waterDraw } },
  ai: { range: 300, style: 'ranged', think(f, foe, d) { f.inp.attackHeld = d < 440 && chance(.9); } },
  attack(f) { rangedAttack(f, rangedFire); },
  draw(ctx, f, s) { waterBlasterDraw(ctx, f, s); },
});
function waterHit(p, B) {
  rangedPackHit(p, B);
  const sp = Math.hypot(p.vx, p.vy) || 1, braced = B.blocking && guardFront(B, p.owner, { proj: p }) ? .4 : 1;
  for (const q of B.P) kick(q, p.vx / sp * PW.waterShove * braced, -10);  // the stream keeps walking them back (less into a guard)
  B.stagger = Math.max(B.stagger, .04 * braced);                         // and makes it hard to wade in against it
  if (B.status.burn) { removeStatus(B, 'burn'); pwSay(p.owner, B, 'douse', 'FSSSH!', '#bfe9ff', .8); pwTrick(p.owner, 'douse', B); }
  if (!B.status.soaked) pwTrick(p.owner, 'soak', B);
  addStatus(B, 'soaked', PW.soakSecs, 1, p.owner);
}
function waterDraw(ctx, p) {                                              // a short streak along its motion: the drops join into a jet
  const a = 1 - p.t / p.life, bx = p.x - p.vx * .045, by = p.y - p.vy * .045;
  ctx.lineCap = 'round';
  lineXY(ctx, bx, by, p.x, p.y, rgba('#3fb8ff', .5 + a * .3), 6 + a * 4);
  lineXY(ctx, bx, by, p.x, p.y, rgba('#dff4ff', .7 * a), 2);
}
function waterBlasterDraw(ctx, f, s) {
  const k = s.k, side = rangedSide(s), tank = s.at(10 * k, -12 * k * side), fill = f.reload > 0 ? 1 - f.reload / f.w.ranged.reload : f.ammo / ammoCap(f);
  line(ctx, s.h, s.at(-4 * k, 12 * k * side), '#30344c', 7 * k);
  line(ctx, s.at(-16 * k), s.at(s.L - 8 * k), '#ff8a2e', 12 * k);           // the toy's orange body
  line(ctx, s.at(s.L - 10 * k), s.t, '#ffd84a', 6 * k);                      // nozzle
  line(ctx, s.at(14 * k, 9 * k * side), s.at(30 * k, 9 * k * side), '#ffd84a', 6 * k);   // pump grip
  circle(ctx, tank.x, tank.y, 10 * k, rgba('#9fdcff', .25), '#ffffff', 1.5);
  circle(ctx, tank.x, tank.y + 10 * k * (1 - fill), 10 * k * Math.max(.15, fill), rgba('#3fb8ff', .8));   // water level
}

// ---------- Magnet Glove: hold to pull foes and loose weapons in, rip weapons away and bend metal shots ----------
defWeapon('magnet-glove', {
  power: 1.2,
  name: 'Magnet Glove', cat: 'fist', order: 53, color: '#ff4a5a', tier: 'epic',
  desc: 'A power glove with a horseshoe magnet in the palm. Tap for a heavy palm strike. Hold attack to switch the magnet on: it drags the nearest foe toward you, reels in loose weapons and bends metal shots (bullets, bolts, kunai, arrows) into the glove, where they clank to a stop. Keep pulling one foe for 1.2 s and you rip the weapon out of their hands. It overheats after 2 s.',
  len: 26, mass: 1.2, dmg: .8, width: 12, kb: 1.2, lift: .55, cd: .44,
  arc: 'palm strike; hold: tractor beam', sig: 'hold: pull foes and weapons in, catch metal shots; 1.2 s rips their weapon',
  ai: { range: 100, style: 'melee', think: magnetThink },
  attack(f) { meleeThrust(f, 1.1, f.main, f.grounded ? 110 : 40); },
  onStep(f, dt) { magnetStep(f, dt); },
  onHit() { sfx('punch'); },
  draw(ctx, f, s) { magnetDraw(ctx, f, s); },
});
function magnetStep(f, dt) {
  const m = f.mem, t = G_STATE.t, want = f.inp.attackHeld && canAct(f) && !f.blocking && t >= (m.magCool || 0);
  m.magHeld = want ? (m.magHeld || 0) + dt : 0;
  m.magOn = m.magHeld > PW.magDelay;
  m.magFoe = null;
  if (!m.magOn) { m.magRip = 0; m.magHeat = Math.max(0, (m.magHeat || 0) - dt); return; }
  if ((m.magHeat = (m.magHeat || 0) + dt) > PW.magHeat) {
    Object.assign(m, { magCool: t + PW.magCool, magHeat: 0, magOn: false, magRip: 0 });
    float(f.P[0].x, f.P[0].y - 50, 'OVERHEAT', '#ff8a2e', 18);
    return;
  }
  const c = f.P[f.tip], neck = f.P[1];
  let foe = null, best = PW.magReach;
  for (const B of enemiesOf(f)) { if (B.alive && !(B.inv > 0) && dist(chest(B), c) < best) { best = dist(chest(B), c); foe = B; } }
  if (foe) {
    const a = angleTo(neck, chest(foe));                                    // reach the glove out at them
    spring(f.P[6], neck.x + Math.cos(a) * 40 * f.scale, neck.y + 8 * f.scale + Math.sin(a) * 34 * f.scale, 260, 14);
    axPull(foe, c.x, c.y, PW.magPull * dt * (1 - best / (PW.magReach * 1.4)));
    m.magRip = m.magLast === foe ? (m.magRip || 0) + dt : 0;
    m.magFoe = m.magLast = foe;
    if (m.magRip >= PW.magRip) magnetRip(f, foe);
  }
  for (const p of PROJ) {
    if (p.kind === 'pickup' && p.pickup === 'weapon' && !p.dead) {         // loose weapons slide over to you
      const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d < 420 && d > 30) { p.vx += dx / d * 1600 * dt; p.vy += dy / d * 1600 * dt - 400 * dt; p.rest = 0; }
    } else if (pwShot(p, f) && (PW_METAL.has(p.kind) || p.metal)) magnetBend(f, p, dt);
  }
  if ((m.magSnd = (m.magSnd || 0) - dt) <= 0) { m.magSnd = .25; sfx('pw-magnet', .5); }
}
// A metal shot heading our way curves into the glove (same speed) and clanks to a stop on it.
function magnetBend(f, p, dt) {
  const c = f.P[f.tip], dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy), sp = Math.hypot(p.vx, p.vy);
  if (d > PW.magBendR || sp < 1 || dx * p.vx + dy * p.vy < 0) return;
  if (d < 18 * f.scale + p.r) {
    killProj(p, 'magnet');
    burst(c.x, c.y, '#e8ecff', 8, 260, { life: .2 }); sfx('pw-clank', .7);
    return;
  }
  const cur = Math.atan2(p.vy, p.vx), da = Math.atan2(Math.sin(Math.atan2(dy, dx) - cur), Math.cos(Math.atan2(dy, dx) - cur));
  const turn = PW.magTurn * (1 - d / PW.magBendR) * dt, a = cur + clamp(da, -turn, turn);
  p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
  if (!p.bent) { p.bent = true; pwTrick(f, 'bend'); }
}
function magnetRip(f, B) {
  f.mem.magRip = 0;
  if (isBare(B) || B.mount || B.scale > f.scale * 1.3 || (G_STATE.mode && G_STATE.mode.noDisarm)) return;
  const c = chest(f), item = disarm(B, f, { nx: Math.sign(c.x - B.P[2].x) });
  if (!item) return;
  const d = dist(item, c) || 1;
  item.vx = (c.x - item.x) / d * 700; item.vy = -420;                      // the weapon flies at the glove
  Object.assign(f.mem, { magCool: G_STATE.t + 1.2, magHeat: 0 });
  float(B.P[0].x, B.P[0].y - 70, 'YOINK!', '#ff4a5a', 26); sfx('pw-yoink');
  pwTrick(f, 'rip', B);
}
// CPUs reel foes in from mid range (and keep pulling to rip an armed one), and switch on against metal shots.
function magnetThink(f, foe, d) {
  const m = f.mem, shot = incoming(f), metal = shot && (PW_METAL.has(shot.kind) || shot.metal);
  const pull = (d > 130 && d < PW.magReach - 20) || metal || (m.magFoe === foe && !isBare(foe) && d < 300);
  f.inp.attackHeld = !!pull && G_STATE.t >= (m.magCool || 0) && (m.magHeat || 0) < PW.magHeat - .05;
}
function magnetDraw(ctx, f, s) {
  const k = s.k, t = s.t, m = f.mem, hot = G_STATE.t < (m.magCool || 0), a = Math.atan2(s.uy, s.ux);
  line(ctx, s.h, s.at(s.L * .55), '#3a2a34', 10 * k);                        // cuff
  circle(ctx, t.x, t.y, 12 * k, hot ? '#ff9a5a' : '#d8283a', '#5a0a14', 2 * k);
  ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(a);                        // the horseshoe in the palm, prongs forward
  ctx.strokeStyle = '#ff4a5a'; ctx.lineWidth = 5 * k; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(2 * k, 0, 8 * k, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
  for (const o of [-8, 8]) line(ctx, { x: 2 * k, y: o * k }, { x: 9 * k, y: o * k }, '#e8ecff', 5 * k);
  ctx.restore();
  if (!m.magOn) return;
  ctx.globalAlpha = .6;
  for (let i = 0; i < 3; i++) {                                              // field rings rolling outward
    const r = (14 + ((G_STATE.t * 90 + i * 20) % 60)) * k;
    ctx.strokeStyle = i % 2 ? '#ff4a5a' : '#9fb3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, r, a - .7, a + .7); ctx.stroke();
  }
  const foe = m.magFoe && pwSeen(m.magFoe);
  if (foe && foe.alive) { ctx.setLineDash([6, 6]); lineXY(ctx, t.x, t.y, chest(foe).x, chest(foe).y, '#ff4a5a', 2); ctx.setLineDash([]); }
  ctx.globalAlpha = 1;
}

// ---------- Pogo Hammer: a smash bounces you up; landing from the bounce sends a shockwave ----------
defWeapon('pogo-hammer', {
  power: 1.1,
  name: 'Pogo Hammer', cat: 'heavy', order: 26.5, color: '#ffd84a', tier: 'epic', twoHanded: true,
  desc: 'A rubber mallet on a spring-loaded handle. Smash the floor (or bop a foe from above) and it bounces you high into the air. Smash again within half a second of landing to chain the bounce higher (up to three). Every landing from a bounce sends a shockwave along the floor that pops up anyone near.',
  len: 82, mass: 1.9, dmg: 1.05, width: 9, kb: 1.15, cd: .72, speed: .95,
  arc: 'overhead smash', sig: 'smash bounces you up (chains ×3); landing sends a shockwave',
  ai: { range: 140, style: 'melee', think: pogoThink },
  attack(f) { spinAttack(f, 1.25); f.mem.pogoSmash = .45; },
  onStep(f, dt) { pogoStep(f, dt); },
  onHit(A, B, hit) { if (!A.grounded && !A.mem.pogoAir && hit.y < chest(B).y) pogoBounce(A, hit.x, hit.y, B); },   // bop them from above
  draw(ctx, f, s) { pogoHammerDraw(ctx, f, s); },
});
function pogoStep(f, dt) {
  const m = f.mem;
  if (m.pogoSmash > 0) {
    m.pogoSmash -= dt;
    const t = f.P[f.tip], g = groundBelow(t.x, t.y - 30);
    if (f.grounded && g != null && t.y > g - 24 && vy(t) > 150) { m.pogoSmash = 0; pogoBounce(f, t.x, g); }
  }
  const air = m.pogoAir;
  if (!air) return;
  if (!f.alive || (air.t += dt) > 3) { m.pogoAir = null; return; }
  if (f.grounded && air.t > .15) { m.pogoAir = null; m.pogoLand = G_STATE.t; pogoWave(f); }
}
function pogoBounce(f, x, y, foe) {
  const m = f.mem, chain = G_STATE.t - (m.pogoLand ?? -9) < PW.pogoChain ? Math.min(3, (m.pogoN || 1) + 1) : 1, v = PW.pogoVel * (1 + (chain - 1) * .13);
  m.pogoN = chain; m.pogoAir = { t: 0 };
  for (const p of f.P) p.oy = p.y + v * DT;                                  // a set climb, like a jump
  f.rising = false; f.coyote = 0;                                           // full height even with jump released
  ring(x, y, 34, '#ffd84a', .25, 4); burst(x, y, '#ffd84a', 10, 260);
  float(x, y - 24, chain > 1 ? 'BOING ×' + chain : 'BOING!', '#ffd84a', 20 + chain * 2);
  sfx('pw-boing', .7 + chain * .15);
  pwTrick(f, 'bounce', foe);
}
function pogoWave(f) {
  const x = f.P[2].x, gy = feetY(f), R = PW.pogoWave * f.scale, n = f.mem.pogoN || 1;
  for (const B of enemiesOf(f)) {
    const dx = B.P[2].x - x;
    if (!B.alive || B.inv > 0 || Math.abs(dx) > R || Math.abs(feetY(B) - gy) > 40) continue;
    damage(B, PW.pogoWaveDmg * (1 + (n - 1) * .25) * (1 - Math.abs(dx) / R * .4), { src: f, kind: 'explode', blast: true, x: B.P[2].x, y: gy - 10,
      nx: Math.sign(dx) * .5, ny: -.85, kb: 480, parts: [2, 7, 8, 9, 10], color: '#ffd84a' });
    pwTrick(f, 'quake', B);
  }
  ring(x, gy, R, '#ffd84a', .3, 4); burst(x, gy, '#c9a46a', 16, 360, { grav: 1400 });
  shake(6); sfx('pw-quake', .7);
}
// CPUs pogo up to a foe on a ledge above, and chain the bounce when a foe is still close after landing.
function pogoThink(f, foe, d) {
  if (!f.grounded || f.atkCd > 0) return;
  const up = feetY(f) - feetY(foe), m = f.mem;
  if (up > 90 && up < 420 && Math.abs(foe.P[2].x - f.P[2].x) < 200) f.inp.attack = true;
  else if (G_STATE.t - (m.pogoLand ?? -9) < .3 && m.pogoTry !== m.pogoLand && d < 260) { m.pogoTry = m.pogoLand; if (chance(.6)) f.inp.attack = true; }
}
function pogoHammerDraw(ctx, f, s) {
  const k = s.k, L = s.L, air = !!f.mem.pogoAir;
  meleeHandle(ctx, s, 14, '#3a2a20', 6);
  line(ctx, s.h, s.at(L * .3), '#8a6a44', 5 * k);
  ctx.strokeStyle = '#c9cdee'; ctx.lineWidth = 2 * k; ctx.beginPath();     // the coil spring, stretched mid-bounce
  const c0 = L * .3, c1 = L * (air ? .7 : .6), n = 7;
  for (let i = 0; i <= n; i++) { const p = s.at(c0 + (c1 - c0) * i / n, (i % 2 ? 6 : -6) * k); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
  ctx.stroke();
  line(ctx, s.at(c1), s.at(L - 12 * k), '#8a6a44', 5 * k);
  const a = s.at(L - 4 * k, -18 * k), b = s.at(L - 4 * k, 18 * k);
  line(ctx, a, b, '#ffd84a', 20 * k);                                        // rubber mallet head
  line(ctx, s.at(L - 4 * k, -18 * k), s.at(L - 4 * k, -12 * k), '#ff3d5a', 21 * k);
  line(ctx, s.at(L - 4 * k, 12 * k), s.at(L - 4 * k, 18 * k), '#ff3d5a', 21 * k);
}

// ---------- Rock Guitar: heavy swings; every 4th hit (or a charged swing) fires a power-chord soundwave ----------
defWeapon('rock-guitar', {
  power: .9,
  name: 'Rock Guitar', cat: 'heavy', order: 28.5, color: '#ff5ad1', tier: 'mythic', twoHanded: true,
  desc: 'A solid-body electric guitar swung like an axe. Every hit you land lights one of four pips on the body; the 4th hit strikes a power chord: a cone of sound that blasts everyone in front of you away. Or hold attack for 0.7 s and let go to play a charged chord at any time (4 s to recharge).',
  len: 88, mass: 1.7, dmg: 1.04, width: 10, kb: 1.15, cd: .74, speed: .94,
  arc: 'heavy axe swing', sig: 'every 4th hit or a charged swing: power-chord soundwave cone',
  ai: { range: 148, style: 'melee', think: guitarThink },
  attack(f) { spinAttack(f, 1.15); },
  onStep(f, dt) { guitarStep(f, dt); },
  onHit(A) { if ((A.mem.gtrPips = (A.mem.gtrPips || 0) + 1) >= 4) { A.mem.gtrPips = 0; guitarChord(A, false); } },
  draw(ctx, f, s) { guitarDraw(ctx, f, s); },
});
function guitarStep(f, dt) {
  const m = f.mem;
  if (f.inp.attackHeld && G_STATE.t >= (m.gtrReady || 0) && canAct(f)) {
    if ((m.gtrHold = (m.gtrHold || 0) + dt) > PW.chordHold && !m.gtrArmed) { m.gtrArmed = true; sfx('pw-tune', .5); }
    return;
  }
  if (m.gtrArmed && canAct(f)) { m.gtrReady = G_STATE.t + PW.chordCd; spinAttack(f, 1); guitarChord(f, true); }
  m.gtrArmed = false; m.gtrHold = 0;
}
function guitarChord(f, charged) {
  const c = chest(f), h = { x: c.x + f.face * 30 * f.scale, y: c.y - 10 * f.scale };   // the blast leaves at body height
  spawnProj({ owner: f, x: h.x, y: h.y, x0: h.x, y0: h.y, dir: f.face, r: -999, dmg: 0, life: PW.chordLife, solid: false, trail: false,
    kind: 'chord', amt: PW.chordDmg * (charged ? 1.2 : 1), color: '#ff5ad1', onStep: chordStep, draw: chordDraw });
  float(h.x, h.y - 40, charged ? 'POWER CHORD!' : 'ROCK ON!', '#ff5ad1', 22);
  sfx('pw-chord'); shake(5);
  pwTrick(f, 'chord');
}
// The wavefront expands from where the chord was struck; each foe inside the forward cone is blasted once.
function chordStep(p) {
  const R = p.t * PW.chordSpeed;
  for (const B of F) {
    if (!B.alive || B.team === p.team || B.inv > 0 || p.hits.includes(B.id)) continue;
    const c = chest(B), dx = c.x - p.x0, dy = c.y - p.y0;
    if (Math.hypot(dx, dy) > R + 24 * B.scale || dx * p.dir < -10 || Math.abs(dy) > Math.abs(dx) * .7 + 40) continue;
    p.hits.push(B.id);
    damage(B, p.amt, { src: p.owner, kind: 'explode', blast: true, x: c.x, y: c.y, nx: p.dir, ny: -.35, kb: 720, parts: ALL_BODY, color: '#ff5ad1' });
  }
}
function chordDraw(ctx, p) {
  const R = p.t * PW.chordSpeed, a0 = p.dir > 0 ? 0 : Math.PI, fade = 1 - p.t / p.life;
  for (let i = 0; i < 3; i++) {
    const r = R - i * 22;
    if (r < 8) continue;
    ctx.globalAlpha = fade * (1 - i * .28);
    ctx.strokeStyle = i === 1 ? '#ffffff' : '#ff5ad1'; ctx.lineWidth = 9 - i * 2.5;
    ctx.beginPath(); ctx.arc(p.x0, p.y0, r, a0 - .6, a0 + .6); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// CPUs charge a chord from mid range and let it go once the foe is inside its reach.
function guitarThink(f, foe, d) {
  const m = f.mem;
  if (G_STATE.t < (m.gtrReady || 0)) return;
  if (m.gtrArmed) { f.inp.attackHeld = !(d < 300 && Math.abs(foe.P[2].y - f.P[2].y) < 90); return; }
  f.inp.attackHeld = m.gtrHold > 0 || (d > 170 && d < 340 && chance(.02));
}
function guitarDraw(ctx, f, s) {
  const k = s.k, L = s.L, m = f.mem, armed = m.gtrArmed, pips = m.gtrPips || 0;
  line(ctx, s.at(-18 * k), s.at(-8 * k), '#2a2236', 8 * k);                  // headstock
  for (const o of [-1, 1]) circle(ctx, s.at(-14 * k, o * 5 * k).x, s.at(-14 * k, o * 5 * k).y, 1.8 * k, '#e8ecff');
  line(ctx, s.at(-8 * k), s.at(L - 34 * k), '#5a3b26', 6 * k);              // neck
  for (let d = 6; d < L - 36 * k; d += 9 * k) meleeGuard(ctx, s, d, 3, '#c9cdee', 1);   // frets
  const v = [s.at(L - 38 * k, 0), s.at(L + 6 * k, -24 * k), s.at(L - 6 * k, -4 * k), s.at(L - 6 * k, 4 * k), s.at(L + 6 * k, 24 * k)];
  poly(ctx, v, '#ff5ad1', '#ffffff', 2 * k);                                  // flying-V body
  line(ctx, s.at(L - 30 * k, -3 * k), s.at(L - 10 * k, 3 * k), '#ffd84a', 2.5 * k);   // lightning stripe
  for (let i = 0; i < 4; i++) { const p = s.at(L - (28 - i * 6) * k, 9 * k); circle(ctx, p.x, p.y, 2.2 * k, i < pips ? '#ffd84a' : '#4a2a40'); }
  const wob = armed ? Math.sin(G_STATE.t * 70) * 2 * k : 0;
  glow(ctx, '#ff5ad1', armed ? 16 : 0, () => line(ctx, s.at(-8 * k, wob), s.at(L - 20 * k, -wob), armed ? '#ffffff' : '#c9cdee', armed ? 1.6 * k : 1));
}

// ---------- Banana Launcher: lobbed bananas leave peels on the floor that trip foes ----------
defWeapon('banana', {
  power: .77,
  name: 'Banana Launcher', cat: 'exotic', order: 41.5, color: '#ffe14a', tier: 'rare', twoHanded: true,
  desc: 'Lobs bananas in an arc onto the target. A banana that hits bonks the foe and drops its peel just behind them; one that lands leaves a peel on the floor for 8 s (four peels each at most, a fifth replaces your oldest). Any foe who steps on a peel slips and falls flat. Your own peels never trip you.',
  len: 48, mass: 1, dmg: .25, width: 7, bodyRecoil: 60,
  arc: 'arcing lob', sig: 'peels lie on the floor (8 s, max 4) and trip foes who step on them',
  ranged: { cooldown: .55, ammo: 4, reload: 2, speed: 1050, spread: .03, recoil: 120, sfx: 'pw-banana', proj: { grav: .9 } },
  ai: { range: 330, style: 'kite' },
  attack(f) {
    rangedAttack(f, g => pwLob(g, 1050, .9, rangedProj({ dmg: 4, r: 9, life: 2, kb: 160, kind: 'banana', color: '#ffe14a', trail: false,
      onHit(p, B, dealt) { if (dealt > 0) B.stagger = Math.max(B.stagger, .25); }, onExpire: bananaLand, draw: bananaDraw })));
  },
  draw(ctx, f, s) { bananaLauncherDraw(ctx, f, s); },
});
function bananaLand(p, why, target) {
  if (!p.owner) return;
  if (why === 'world') bananaPeel(p.owner, p.x, p.y);
  else if (why === 'hit' && target) bananaPeel(p.owner, target.P[2].x - Math.sign(p.vx || 1) * 34, feetY(target));   // just behind them
}
function bananaPeel(f, x, y) {
  x = clamp(x, 20, W - 20);
  const g = pwSurface(x, y - 20);
  if (!g) return;
  pwKeep(f, 'peels', PW.peelMax, skillZone({ owner: f, x, y: g.y, s: g.s, life: PW.peelLife, danger: 18, kind: 'peel', color: '#ffe14a',
    rot: rnd(-.4, .4), onStep: peelStep, draw: peelDraw }));
}
function peelStep(z) {
  if (!pwRide(z)) { z.dead = true; return; }
  for (const B of F) {
    if (!B.alive || B.team === z.team || B.inv > 0 || B.mount) continue;
    if (G_STATE.t < (B.mem.pwSlipT || 0)) continue;                    // just slipped: one fall at a time
    if ([B.P[8], B.P[10]].some(p => p.g && Math.abs(p.x - z.x) < 16 * B.scale + 6 && Math.abs(p.y - z.y) < 10)) { bananaSlip(z, B); return; }
  }
}
function bananaSlip(z, B) {
  z.dead = true; B.mem.pwSlipT = G_STATE.t + .8;
  pwTrip(B, Math.sign(vx(B.P[2])) || B.face, 1.1);
  if (z.owner) damage(B, PW.peelDmg, { src: z.owner, kind: 'proj', unblockable: true, x: z.x, y: z.y - 12, nx: 0, ny: -1, kb: 0, color: '#ffe14a' });
  float(B.P[0].x, B.P[0].y - 54, 'SLIP!', '#ffe14a', 24); sfx('pw-slip');
  pwTrick(z.owner, 'slip', B);
}
function bananaShape(ctx, x, y, a, r) {                                     // a crescent banana with a brown stem
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(0, -r * .4, r, .35, Math.PI - .35); ctx.arc(0, -r * 1.1, r * 1.25, Math.PI - .5, .5, true); ctx.fill();
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(r * .8, -r * .1, r * .35, r * .3);
  ctx.restore();
}
function bananaDraw(ctx, p) { bananaShape(ctx, p.x, p.y, p.t * 14, 10); }
function peelDraw(ctx, z) {
  const fade = Math.min(1, (z.life - z.t) * 2);
  ctx.globalAlpha = fade;
  for (const a of [-1, 0, 1]) {                                              // three splayed strips round a stub
    const ex = z.x + Math.cos(z.rot + a * .9 - Math.PI / 2) * 19, ey = z.y - 3 + Math.abs(a) * 1.5;
    ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(z.x, z.y - 5); ctx.quadraticCurveTo((z.x + ex) / 2, z.y - 12, ex, ey); ctx.stroke();
  }
  circle(ctx, z.x, z.y - 6, 4, '#f5d03a', '#6b4a2e', 1.5);
  ctx.globalAlpha = 1;
}
function bananaLauncherDraw(ctx, f, s) {
  const k = s.k, side = rangedSide(s);
  line(ctx, s.h, s.at(-4 * k, 12 * k * side), '#30344c', 7 * k);
  line(ctx, s.at(-14 * k), s.t, '#6b8a2e', 14 * k);                         // jungle-green tube
  line(ctx, s.at(-14 * k), s.at(-6 * k), '#ffe14a', 15 * k);
  line(ctx, s.at(s.L - 6 * k), s.t, '#ffe14a', 16 * k);
  if (f.ammo > 0 && f.reload <= 0) bananaShape(ctx, s.t.x + s.ux * 4 * k, s.t.y + s.uy * 4 * k, Math.atan2(s.uy, s.ux) - .6, 8 * k);   // one peeking out
  rangedDrawReload(ctx, f, s, '#ffe14a', f.w.ranged);
}

// ---------- Plunger Bow: a hit tethers the foe to you for 2.5 s; attack yanks them in ----------
defWeapon('plunger-bow', {
  power: 1.2,
  name: 'Plunger Bow', cat: 'ranged', order: 18.5, color: '#ff3d5a', tier: 'epic',
  desc: 'A bow that shoots rubber plungers on a bungee rope. A plunger that hits sticks for 2.5 s and tethers the foe to you: they cannot get any further away than the rope allows, so no running off and no escaping over the edge. Press attack while they are stuck to yank them in for a hit.',
  len: 34, mass: .8, dmg: .25, width: 4,
  arc: 'plunger shot', sig: 'a hit tethers the foe 2.5 s; attack yanks them in',
  ranged: { cooldown: .5, ammo: 1, reload: 1.2, speed: 1700, spread: .02, recoil: 130, sfx: 'pw-plunger',
    proj: rangedProj({ dmg: 7, r: 6, life: 1.1, grav: .22, kb: 120, kind: 'plunger', trail: false, onHit: plungerStick, draw: plungerDraw }) },
  ai: { range: 380, style: 'ranged', think: plungerThink },
  attack(f) { if (!plungerYank(f)) rangedAttack(f, rangedFire); },
  draw(ctx, f, s) { plungerBowDraw(ctx, f, s); },
});
function plungerStick(p, B, dealt) {
  const A = p.owner;
  if (!A || !A.alive || dealt <= 0) return;
  const s = addStatus(B, 'tethered', PW.tetherSecs, 1, A);
  if (!s) return;
  s.src = A; s.len = clamp(dist(A.P[2], B.P[2]), PW.ropeMin, PW.ropeMax);
  A.mem.pwTether = B;
  float(B.P[0].x, B.P[0].y - 54, 'STUCK!', '#ff3d5a', 22); sfx('pw-plunk');
  pwTrick(A, 'tether', B);
}
// The rope only pulls when stretched past its length: then the tethered body is held at it (a much bigger foe drags
// the shooter along instead).
function tetherPull(B, s) {
  const A = s.src;
  if (!A || !A.alive || F.indexOf(A) < 0) { s.t = 0; return; }
  const dx = B.P[2].x - A.P[2].x, dy = B.P[2].y - A.P[2].y, d = Math.hypot(dx, dy) || 1;
  if (!(s.len > 0)) s.len = clamp(d, PW.ropeMin, PW.ropeMax);                // tethered by any other route: rope = gap now
  if (d <= s.len) return;
  const ux = dx / d, uy = dy / d, over = Math.min(d - s.len, 30), big = B.scale > A.scale * 1.2;
  const shift = (f, k) => {
    for (const p of f.P) {
      p.x -= ux * over * k; p.ox -= ux * over * k; p.y -= uy * over * k; p.oy -= uy * over * k;
      const out = ((p.x - p.ox) * ux + (p.y - p.oy) * uy) * Math.sign(k);   // speed along the rope, away from the other end
      if (out > 0) { p.ox += ux * out * .9 * Math.sign(k); p.oy += uy * out * .9 * Math.sign(k); }
    }
  };
  shift(B, big ? .3 : .85);
  if (big) shift(A, -.55);
}
function plungerYank(f) {
  const B = f.mem.pwTether, s = B && B.alive && B.status.tethered;
  if (!s || s.src !== f) return false;
  removeStatus(B, 'tethered'); f.mem.pwTether = null;
  const c = chest(f), cb = chest(B);
  axPull(B, c.x, c.y - 30, PW.yankPow, 260);
  damage(B, PW.yankDmg, { src: f, kind: 'proj', x: cb.x, y: cb.y, nx: Math.sign(c.x - cb.x), ny: -.3, kb: 0, color: '#ff3d5a' });
  B.stagger = Math.max(B.stagger, .45); f.atkCd = Math.max(f.atkCd, .4);
  float(cb.x, cb.y - 60, 'YANK!', '#ff3d5a', 24); sfx('pw-yank');
  pwTrick(f, 'yank', B);
  return true;
}
// CPUs yank a stuck foe once it has strayed a little (or before the plunger lets go).
function plungerThink(f, foe, d) {
  const B = f.mem.pwTether, s = B && B.alive && B.status.tethered;
  if (s && s.src === f && f.atkCd <= 0 && ((s.max - s.t > .5 && d > 160) || s.t < .4)) f.inp.attack = true;
}
function plungerShape(ctx, x, y, a, k) {                                   // stick behind, red cup in front
  const c = Math.cos(a), s = Math.sin(a);
  lineXY(ctx, x - c * 26 * k, y - s * 26 * k, x, y, '#c9a46a', 3 * k);
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = '#ff3d5a'; ctx.beginPath(); ctx.moveTo(0, -3 * k); ctx.lineTo(8 * k, -8 * k); ctx.lineTo(8 * k, 8 * k); ctx.lineTo(0, 3 * k); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function plungerDraw(ctx, p) { plungerShape(ctx, p.x, p.y, Math.atan2(p.vy, p.vx), 1); }
function tetherDraw(ctx, f, s) {
  const A = s.src && pwSeen(s.src);
  if (!A || !A.alive) return;
  const a = A.P[A.tip], b = chest(f), d = Math.hypot(b.x - a.x, b.y - a.y), sag = Math.max(0, s.len - d) * .5;
  ctx.strokeStyle = d >= s.len - 4 ? '#ff3d5a' : '#ffb3c0'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
  plungerShape(ctx, b.x, b.y, Math.atan2(b.y - a.y, b.x - a.x), f.scale);
}
function plungerBowDraw(ctx, f, s) {
  const k = s.k, arm = 34 * k, mid = s.t;
  const l = { x: mid.x + s.nx * arm - s.ux * 10 * k, y: mid.y + s.ny * arm - s.uy * 10 * k }, r = { x: mid.x - s.nx * arm - s.ux * 10 * k, y: mid.y - s.ny * arm - s.uy * 10 * k };
  ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 4 * k; ctx.beginPath();
  ctx.moveTo(l.x, l.y); ctx.quadraticCurveTo(mid.x + s.ux * 14 * k, mid.y + s.uy * 14 * k, r.x, r.y); ctx.stroke();
  const nock = s.at(s.L - 14 * k);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(nock.x, nock.y); ctx.lineTo(r.x, r.y); ctx.stroke();
  if (f.ammo > 0 && f.reload <= 0) plungerShape(ctx, s.at(s.L + 12 * k).x, s.at(s.L + 12 * k).y, Math.atan2(s.uy, s.ux), k);
  rangedDrawReload(ctx, f, s, '#ff3d5a', f.w.ranged);
}

// ---------- Pillow: huge knockback, almost no damage, feathers everywhere; PILLOW FIGHT! K.O.s ----------
defWeapon('pillow', {
  power: 1.15,
  name: 'Pillow', cat: 'exotic', order: 43.6, color: '#f6f0ff', tier: 'common',
  desc: 'A big fluffy pillow. It barely hurts at all, but every hit knocks the target flying in a burst of feathers: perfect for ring-outs and pits, and whatever wall or floor they slam into hurts more than the pillow did. Finish a K.O. with it (a ring-out after a pillow hit counts) and the whole arena gets a PILLOW FIGHT!',
  len: 58, mass: .7, dmg: .55, width: 15, cd: .36, kb: 2.3, speed: 1.04,
  arc: 'big soft swing', sig: 'huge knockback, almost no damage (walls hurt); PILLOW FIGHT! K.O.s',
  ai: { range: 120, style: 'melee' },
  onHit(A, B, hit) {
    if (!B.alive) return;
    for (const p of B.P) kick(p, 0, -PW.pillowPop);                       // up as well as away: they come down hard
    B.mem.pwPillow = { by: A, t: G_STATE.t }; pillowFeathers(hit.x, hit.y, 9); sfx('pw-fwump', .8); pillowSplatWatch(A, B);
  },
  draw(ctx, f, s) { pillowDraw(ctx, f, s); },
});
// For a second after a pillow hit, slamming into a wall, the ceiling or the floor at speed hurts (once): the pillow
// itself barely does, whatever it sends them into does.
function pillowSplatWatch(A, B) {
  if (B.mem.pwSplat && !B.mem.pwSplat.dead) { B.mem.pwSplat.life = B.mem.pwSplat.t + 1; return; }
  B.mem.pwSplat = skillZone({ owner: A, life: 1, kind: 'pw-fx', v: Math.hypot(vx(B.P[2]), vy(B.P[2])), onStep(z) {
    if (!B.alive || !A.alive) { z.dead = true; return; }
    const h = B.P[2], v = Math.hypot(vx(h), vy(h)), drop = z.v - v, near = B.P.some(p => p.g) || h.x < WALL_PAD + 50 || h.x > W - WALL_PAD - 50 || h.y < CEILING + 60;
    z.v = Math.max(v, z.v - 2400 * DT);                                   // the peak of the last ~50 ms: bodies land over a few steps
    if (drop < PW.splatFrom || !near) return;
    z.dead = true;
    damage(B, clamp((drop - PW.splatFrom) / 45 + 5, 5, 16), { src: A, kind: 'melee', unblockable: true, weapon: WEAPONS.pillow, x: h.x, y: h.y, nx: 0, ny: 0, kb: 0, color: '#f6f0ff' });
    float(h.x, h.y - 40, 'SPLAT!', '#f6f0ff', 22); pillowFeathers(h.x, h.y, 5);
    pwTrick(A, 'splat', B);
  } });
}
function pillowFeathers(x, y, n) {
  for (let i = 0; i < n; i++) pwFx({ x, y, vx: rnd(-260, 260), vy: rnd(-380, -60), life: rnd(1, 1.6), grav: .07, drag: 2.4, kind: 'feather',
    rot: rnd(0, TAU), sway: rnd(2, 4), draw: featherDraw });
}
function featherDraw(ctx, p) {
  const a = p.rot + Math.sin(p.t * p.sway * 2) * .7, c = Math.cos(a) * 12, s = Math.sin(a) * 12;
  ctx.globalAlpha = Math.min(1, (p.life - p.t) * 2);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.x - c, p.y - s); ctx.quadraticCurveTo(p.x + s * .5, p.y - c * .5, p.x + c, p.y + s); ctx.stroke();
  lineXY(ctx, p.x - c, p.y - s, p.x + c * .6, p.y + s * .6, '#c9cdee', 1);
  ctx.globalAlpha = 1;
}
function pillowDraw(ctx, f, s) {
  const k = s.k, L = s.L, sq = 1 + (f.swingT > 0 ? Math.sin(f.swingT * 30) * .08 : 0), w = 15 * k * sq, m = (L + 2 * k) / 2;
  const c = [s.at(2 * k, -w - 3 * k), s.at(L + 3 * k, -w - 3 * k), s.at(L + 3 * k, w + 3 * k), s.at(2 * k, w + 3 * k)];   // pointed corners
  const mid = [s.at(m, -w - 7 * k), s.at(L + 9 * k, 0), s.at(m, w + 7 * k), s.at(-4 * k, 0)];                  // puffed-out sides
  ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y);
  for (let i = 0; i < 4; i++) { const a = mid[i], b = c[(i + 1) % 4]; ctx.quadraticCurveTo(a.x - (b.x - c[i].x) * .1, a.y - (b.y - c[i].y) * .1, b.x, b.y); }
  ctx.closePath(); ctx.fillStyle = '#f6f0ff'; ctx.fill(); ctx.strokeStyle = '#c9b8ff'; ctx.lineWidth = 2.5 * k; ctx.stroke();
  line(ctx, s.at(10 * k, -w * .4), s.at(L - 6 * k, -w * .4), rgba('#ffffff', .9), 2 * k);   // soft highlight
  line(ctx, s.at(10 * k, w * .45), s.at(L - 6 * k, w * .45), rgba('#c9b8ff', .45), 1.5 * k); // seam
}
// A K.O. by pillow (or a ring-out within 3 s of a pillow hit) is a PILLOW FIGHT: a round-deciding one takes over the
// round-end banner (endRound draws it in the same step), any other gets its own.
on('ko', (V, K, o) => {
  const pw = V.mem.pwPillow, blow = o && o.weapon && o.weapon.key === 'pillow';   // the K.O. fires before the blow's onHit
  if (!K || !(blow || (pw && pw.by === K && G_STATE.t - pw.t <= 3))) return;
  V.mem.pwPillowKo = koDecides(V);
  const c = chest(V);
  pillowFeathers(clamp(c.x, 40, W - 40), clamp(c.y, 60, H - 40), 22);
  if (!V.mem.pwPillowKo) banner('PILLOW FIGHT!', V.name + ' got pillowed', 1.4, '#ffb3e6');
  sfx('pw-pillowfight');
  pwTrick(K, 'pillow-ko', V);
});

// ---------- shared hooks ----------
// Lightning and shock hit a soaked fighter 50% harder. Damage carrying `shock: true` counts too (for new content).
function pwShocking(B, o) {
  if (o.shock) return true;
  const A = o.src, k = o.kind;
  if (k === 'hazard') return !!MAP && MAP.hazards.some(hz => (hz.kind === 'electric' || hz.trap === 'bolt') && [0, 2, 8, 10].some(j => inRect(B.P[j].x, B.P[j].y, hz)));
  if (!A) return false;
  if (k === 'skill') return (SKILLS.lightning && o.color === SKILLS.lightning.color) || (o.elemental && o.color === ELEMENTS.shock.color);
  const w = o.weapon || A.w;
  return (k === 'melee' || k === 'proj' || k === 'explode') && (A.element === 'shock' || PW_SHOCK_W.has(w.key) || (A.lvl >= 3 && LEVEL_ELEMENT[w.cat] === 'shock'));
}
const pwDamage0 = damage;
damage = function (B, amount, o = {}) {
  if (B && B.alive && B.status && B.status.soaked && amount > 0 && pwShocking(B, o)) {
    amount *= PW.soakShock;
    if (!o.small) pwSay(B, B, 'zapped', 'ZAPPED!', '#ffe94a', .5);
    sfx('pw-zap', .7);
    pwTrick(o.src, 'zapped', B);
  }
  return pwDamage0(B, amount, o);
};
// Once a round is decided every trick stops: floor zones go, statuses lift, held states drop.
function pwRoundEnd() {
  for (const p of PROJ) if (PW_KINDS.has(p.kind)) p.dead = true;
  for (const f of F) {
    for (const k of PW_STATUSES) if (f.status[k]) removeStatus(f, k);
    const m = f.mem;
    if (m.yoyo && m.yoyo.rig === f.main) axStretch(f.main, 1);
    if (m.pwGripSet != null && f.grip === m.pwGripSet) f.grip = m.pwGripBase;
    Object.assign(m, { yoyo: null, pwTether: null, magOn: false, magHeld: 0, magFoe: null, aceT: 0, pogoAir: null, pogoSmash: 0,
      gtrArmed: false, gtrHold: 0, umbOpen: false, glideT: 0, paints: null, peels: null, pwGripSet: null });
  }
}
on('roundEnd', () => {
  if (BANNER && F.some(f => f.mem.pwPillowKo)) { BANNER.a = 'PILLOW FIGHT!'; BANNER.color = '#ffb3e6'; }
  pwRoundEnd();
});

// ---------- sounds and lore (registered once 80-audio and 79-lore exist) ----------
on('boot', () => {
  if (typeof defSfx === 'function') {
    defSfx('pw-ace', v => { tone(1100, 1500, .06, 'triangle', .2 * v); noise(.05, 3600, .25 * v); tone(2600, 2500, .12, 'sine', .05 * v, .02); });
    defSfx('pw-umbrella', v => { noiseSweep(.16, 500, 2600, .2 * v, 'bandpass'); tone(170, 110, .1, 'sine', .2 * v); });
    defSfx('pw-plink', v => tone(2300, 1900, .05, 'square', .04 * v));
    defSfx('pw-zip', v => { tone(450, 1500, .14, 'triangle', .07 * v); noiseSweep(.12, 2000, 5200, .05 * v, 'bandpass'); });
    defSfx('pw-snap', v => tone(1500, 500, .09, 'triangle', .07 * v));
    defSfx('pw-paint', v => { noiseSweep(.22, 300, 1200, .3 * v, 'lowpass'); thump(120, 80, .15, .15 * v); });
    defSfx('pw-slip', v => { tone(500, 1600, .3, 'sine', .1 * v); thump(160, 50, .2, .4 * v, .28); });
    defSfx('pw-snow', v => { noise(.12, 800, .3 * v, 'lowpass'); thump(210, 120, .1, .2 * v); });
    defSfx('pw-snowman', v => { tone(1568, 1568, .12, 'triangle', .06 * v); tone(2093, 2093, .25, 'triangle', .05 * v, .1); noise(.25, 7000, .05 * v, 'highpass'); });
    defSfx('pw-zap', v => { noise(.2, 3500, .3 * v, 'highpass'); tone(95, 60, .25, 'sawtooth', .14 * v); });
    defSfx('pw-magnet', v => { tone(110, 112, .26, 'sawtooth', .035 * v); tone(220, 226, .26, 'square', .015 * v); });
    defSfx('pw-clank', v => { metal(1400, .15, .06 * v); noise(.04, 4000, .1 * v); });
    defSfx('pw-yoink', v => { metal(820, .3, .1 * v); tone(380, 1300, .16, 'square', .05 * v); });
    defSfx('pw-boing', v => { tone(190, 720, .12, 'sine', .25 * v); tone(720, 260, .22, 'sine', .18 * v, .1); });
    defSfx('pw-quake', v => { thump(120, 40, .25, .5 * v); noise(.25, 300, .3 * v, 'lowpass'); });
    defSfx('pw-chord', v => { for (const [f0, w] of [[82, .12], [123, .1], [165, .07]]) tone(f0, f0 * .98, .7, 'sawtooth', w * v); noise(.3, 1500, .12 * v); });
    defSfx('pw-tune', v => tone(330, 660, .3, 'sawtooth', .04 * v));
    defSfx('pw-banana', v => { tone(300, 620, .1, 'triangle', .1 * v); noise(.05, 1800, .08 * v); });
    defSfx('pw-plunger', v => { tone(250, 110, .18, 'triangle', .12 * v); noise(.04, 2400, .1 * v); });
    defSfx('pw-plunk', v => { tone(320, 640, .06, 'sine', .22 * v); tone(700, 300, .1, 'sine', .14 * v, .05); });
    defSfx('pw-yank', v => { tone(140, 420, .18, 'sawtooth', .07 * v); noiseSweep(.2, 600, 2400, .12 * v, 'bandpass'); });
    defSfx('pw-fwump', v => { noise(.14, 450, .45 * v, 'lowpass'); noise(.2, 3000, .05 * v, 'highpass', .02); });
    defSfx('pw-pillowfight', v => { [523, 659, 784, 1047].forEach((n, i) => tone(n, n, i < 3 ? .1 : .3, 'triangle', .07 * v, i * .1)); });
  }
  // Swing | hit signatures (80b): layers 'kind secs Hz Hz2 vol [delay] [Q]'.
  if (typeof WSND === 'object') Object.assign(WSND, {
    'tennis-racket': 'nb .1 2500 6000 .12 0 3|tt .04 900 700 .35,nb .03 4000 4000 .15 0 4',
    umbrella: 'nb .09 1500 3200 .1 0 2.5|tt .05 500 300 .3,nl .06 700 400 .3',
    yoyo: 'tt .12 600 1500 .06,nb .1 2500 5000 .05 0 3|tq .04 1200 800 .06,nb .04 3000 3000 .25 0 3',
    'paint-roller': 'nl .18 500 900 .3,nb .14 900 1500 .1 0 1.5|nl .12 400 200 .5,ts .1 140 90 .25',
    snowball: 'nl .1 700 400 .25,ts .06 260 150 .2|nb .12 2500 1500 .3 0 1.2,nh .08 6000 6000 .1',
    'water-blaster': 'hn .12 2400 2400 .2|nb .1 3000 1800 .25 0 1.5',
    'magnet-glove': 'nb .08 600 1800 .14 0 1.4,tw .1 120 90 .03|m .25 900 900 .07,ts .1 160 60 .4',
    'pogo-hammer': 'nb .2 300 900 .25 0 1.2|ts .3 160 520 .3,ts .2 520 220 .2 .12',
    'rock-guitar': 'nb .22 280 900 .28 0 1.2|tw .35 82 80 .12,tw .35 123 121 .09,tq .2 165 163 .05',
    banana: 'tt .1 280 640 .1,nb .05 1200 2400 .1 0 2|ts .05 600 300 .25,nl .06 900 400 .3',
    'plunger-bow': 'tt .18 260 120 .12,nb .03 2000 2000 .12 0 3|tt .06 300 600 .25,ts .08 700 300 .15',
    pillow: 'nl .18 500 900 .3,nb .12 700 1400 .08 0 1.2|nl .14 450 200 .55,nb .1 900 600 .15 0 .8',
  });
  Object.assign(LORE_LINES.w, {
    'tennis-racket': "Strung with harp wire salvaged from the Sky Citadel's fallen bell tower, it hums whenever a shot comes close. The Neon league banned it for a season, then quietly gave up when nobody could return a serve anyway.",
    umbrella: 'Lumen carried this one through the Frostspire sleet before the Great Candle went out, and it has never once turned inside out. Porters on the Cloud Docks swear by it for the long drop between quays.',
    yoyo: 'A Wobble Hills toy that a bored Wick restrung with spider silk from the Shadow Depths. It always comes back, which is more than can be said for the duelists who laugh at it.',
    'paint-roller': 'The sign painters of the Neon Foundry roll their colours on thick, and the stripes stay slick long after the job is done. Rookies who mock the decorators tend to learn the floor the hard way.',
    snowball: "Built by Frostspire children who were tired of losing snowball fights to the Frost Queen's guards. Three good hits and the target becomes a very surprised snowman until the ice gives way.",
    'water-blaster': 'The Pyre Wardens of the Ember Wastes keep one beside every lantern in case a Wick gets carried away. Smugglers in the Static Marsh fear it more than any blade, because they know what a storm does to a soaked coat.',
    'magnet-glove': 'Wound in the Robo Factory from the coil of a crane that once lifted whole trains. It cannot tell a sword from a spoon, so it simply takes both.',
    'pogo-hammer': "A meat tenderiser from the Giant's Kitchen with a bedspring welded into the handle by someone who should have known better. Every bounce lands harder than the last, and the floor keeps the dents as souvenirs.",
    'rock-guitar': 'Played once at the Neon league finals, it cracked the arena glass on the fourth chord and has been a weapon ever since. Lumen insists the Great Candle flickered in time with the solo.',
    banana: "Loaded with fruit from the Jungle Temple's gardens, where the monkeys worked out the trick long before the Wicks did. Nothing in the four realms humbles a champion faster than a peel they never saw.",
    'plunger-bow': 'A Sky Docks rigger fitted rubber plungers and a bungee line to an old bow to haul cargo crates aboard. Fighters, it turned out, come aboard just as well and with far more shouting.',
    pillow: 'Stuffed with feathers from the roosts above the Sky Citadel and stitched for a sleepover that got out of hand. It has never broken a single bone, yet it has sent more champions off the edge than any hammer.',
  });
});
