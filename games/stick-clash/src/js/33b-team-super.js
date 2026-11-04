// 33b-team-super.js: DOUBLE TEAM for two players on one team (the help text at the bottom says how it plays). Versus never
// arms it. Wraps 33-power's useUltimate, ultStep and ultDraw; a hero's f.ult carries `team2`.

const TEAM_SUPER = { near: 220, window: .5, tele: .55, dash: .3, dur: 1.2, slash: 12, wave: 20, waveR: 640, color: '#ffe66a' };
const TS = { pending: null, ready: [], wasReady: false };

// A real player (not a CPU, autopilot or summon) who could fire an ultimate right now.
const teamSuperAble = f => f.alive && f.ctrl === 'human' && !f.autopilot && !f.summon && f.super >= 100 && !f.ult && !f.mount && !f.holding && canAct(f);
// The teammate f would team up with now, or null (not armed).
function teamSuperPartner(f) {
  if (G_STATE.ending || (G_STATE.mode && G_STATE.mode.duo === 'versus') || !teamSuperAble(f)) return null;
  return F.find(g => g !== f && g.team === f.team && teamSuperAble(g) && dist(g.P[2], f.P[2]) <= TEAM_SUPER.near) || null;
}

// While armed, the first press waits for the partner's; the second one inside the window starts Double Team.
const _teamUseUltimate = useUltimate;
useUltimate = function (f) {
  const partner = teamSuperPartner(f), p = TS.pending;
  if (!partner) return _teamUseUltimate(f);
  if (p && p.f === partner && G_STATE.t - p.t <= TEAM_SUPER.window) { TS.pending = null; teamSuperStart(partner, f); }
  else if (!p || p.f !== f) TS.pending = { f, t: G_STATE.t };
  return true;
};
// Every step: an unanswered press fires its own ultimate; refresh the ready pairs (for the hint and the chime).
on('mapStep', () => {
  const p = TS.pending, humans = F.filter(f => f.ctrl === 'human' && f.super >= 100), pairs = [];
  if (p && G_STATE.t - p.t > TEAM_SUPER.window) { TS.pending = null; if (p.f.alive && F.includes(p.f)) _teamUseUltimate(p.f); }
  if (humans.length > 1) for (const f of humans) { const g = teamSuperPartner(f); if (g && f.id < g.id) pairs.push([f, g]); }
  if (pairs.length && !TS.wasReady) sfx('chime');
  TS.ready = pairs; TS.wasReady = pairs.length > 0;
});
on('roundStart', () => { TS.pending = null; TS.ready = []; TS.wasReady = false; });

function teamSuperStart(a, b) {
  const T = TEAM_SUPER, foes = F.filter(e => e.alive && e.team !== a.team), [left, right] = a.P[2].x <= b.P[2].x ? [a, b] : [b, a];
  const x = clamp(foes.length ? foes.reduce((s, e) => s + e.P[2].x, 0) / foes.length : (a.P[2].x + b.P[2].x) / 2 + a.face * 220, 180, W - 180);
  const gy = foes.length ? Math.max(...foes.map(feetY)) : feetY(a), y = groundBelow(x, gy - 60) ?? gy;   // where the X crosses: among the foes
  const run = { x, y, waved: false, paths: [] };
  [left, right].forEach((f, i) => {
    const side = i ? 1 : -1, end = teamSuperLanding(x - side * 320, x, y);
    run.paths[i] = [clamp(x + side * 300, 40, W - 40), Math.max(60, y - 270), end.x, end.y - 85];   // the hip, from high on one side to low on the other
    f.ult = { key: 'double-team', team2: run, role: i, t: 0, dur: T.dur, hit: new Set() };
    f.super = 0; f.stats.ults++; f.blocking = false; f.inv = Math.max(f.inv, T.dur + .15);
    emit('ultimate', f, 'double-team');
  });
  for (const e of foes) if (aiBrain(e) && e.ai) {   // the telegraph is for the foes: CPUs react to it too
    const L = aiLevel(e);
    if (chance(L.dodge)) e.inp.jump = true; else if (chance(L.block || 0)) aiGuard(e, T.tele - .15, .7);
  }
  banner('DOUBLE TEAM!', `${a.name} + ${b.name}`, T.tele + .15, T.color);   // gone before the dash, so it never hides it
  focusCamera(x, y - 90, T.dur + .2); flashScreen(T.color, .2); shake(8); slowmo(.3, .4);
  sfx('s6-team');
}
// A dash end point with ground under it, stepping back toward the centre until there is some (never over a pit).
function teamSuperLanding(x, cx, gy) {
  for (let k = 0; k < 12; k++) { const tx = lerp(x, cx, k / 12), g = groundBelow(tx, gy - 220); if (g != null && Math.abs(g - gy) < 200) return { x: tx, y: g }; }
  return { x: cx, y: gy };
}
// Telegraph (hover and glow), blink to the start of the dash, dash along it slashing foes, then one shockwave.
function teamSuperStep(f, u, dt) {
  const T = TEAM_SUPER, run = u.team2, [sx, sy, ex, ey] = run.paths[u.role], k = clamp((u.t - T.tele) / T.dash, 0, 1);
  if (u.t < T.tele) { ultHover(f, .85); moveFighter(f, 0, -50 * dt); return; }
  if (!u.blinked) { u.blinked = true; moveFighter(f, sx - f.P[2].x, sy - f.P[2].y); for (const p of f.P) { p.ox = p.x; p.oy = p.y; } sfx('lunge', .8); }
  if (k >= 1) { if (!run.waved) teamSuperWave(run, f); return; }
  const x0 = f.P[2].x, y0 = f.P[2].y, tx = lerp(sx, ex, k), ty = lerp(sy, ey, k);
  moveFighter(f, tx - x0, ty - y0); ultHover(f);
  f.face = Math.sign(ex - sx) || f.face;
  for (const e of F) {
    if (!e.alive || e.team === f.team || u.hit.has(e) || ultSegDist(chest(e).x, chest(e).y, x0, y0 - 20, tx, ty - 20) > 78) continue;
    u.hit.add(e);
    ultHit(f, e, T.slash, { kb: 360, nx: Math.sign(ex - sx), ny: -.5 });
    beam(chest(e).x - 55, chest(e).y - 45, chest(e).x + 55, chest(e).y + 45, '#ffffff', 5, .25);
  }
}
// Every foe is hit, hardest near the crossing; it is a blast (a guard takes it as chip damage, nobody can parry it).
function teamSuperWave(run, by) {
  const T = TEAM_SUPER;
  run.waved = true;
  for (const e of F) {
    if (!e.alive || e.team === by.team) continue;
    const c = chest(e), fall = clamp(1 - Math.hypot(c.x - run.x, c.y - run.y) / T.waveR, .4, 1);
    ultHit(by, e, T.wave * fall, { kb: 200 + 700 * fall, nx: Math.sign(c.x - run.x) || 1, ny: -.75, blast: true, status: ['stun', .35] });
  }
  ring(run.x, run.y, T.waveR * .55, T.color, .5, 9); ring(run.x, run.y, 200, '#ffffff', .35, 5);
  burst(run.x, run.y - 20, T.color, 40, 800); flashScreen('#fff3b0', .3); shake(22);
  sfx('s6-team-wave');
}

const _teamUltStep = ultStep;
ultStep = function (f, dt) {
  const u = f.ult;
  if (!u || !u.team2) return _teamUltStep(f, dt);
  u.t += dt;
  if (f.alive) teamSuperStep(f, u, dt);
  if (!f.alive || (u.t >= u.dur && f.ult === u)) f.ult = null;
};
const _teamUltDraw = ultDraw;
ultDraw = function (f) { if (f.ult && f.ult.team2) teamSuperDraw(ctx, f, f.ult); else _teamUltDraw(f); };

// The heroes glow; during the telegraph the first one also draws the X of the dash paths and the shockwave's reach.
function teamSuperDraw(c2, f, u) {
  const T = TEAM_SUPER, run = u.team2, c = chest(f), k = u.t / T.tele;
  c2.save();
  if (k < 1) {
    glow(c2, T.color, 22, () => circle(c2, c.x, c.y, 30 + k * 30, rgba(T.color, .18), T.color, 3));
    if (u.role === 0) {
      c2.globalAlpha = .35 + .35 * Math.abs(Math.sin(u.t * 22));
      for (const [sx, sy, ex, ey] of run.paths) lineXY(c2, sx, sy, ex, ey, '#ff4a6a', 4);
      c2.strokeStyle = '#ff4a6a'; c2.lineWidth = 3;
      c2.beginPath(); c2.ellipse(run.x, run.y, T.waveR * .55 * k, 14, 0, 0, TAU); c2.stroke();
    }
  } else if (u.t < T.tele + T.dash) {
    const p = run.paths[u.role];
    c2.globalAlpha = .6;
    glow(c2, T.color, 18, () => lineXY(c2, p[0], p[1], f.P[2].x, f.P[2].y, T.color, 10 * f.scale));
  }
  c2.restore();
}
// The world-space hint over a ready pair: a tether between them, "TEAM SUPER READY" and both super keys.
function teamSuperDrawHint(c2) {
  if (G_STATE.state === 'killcam') return;
  const pulse = .75 + .25 * Math.sin(G_STATE.t * 7), keyOf = h => keyHint(h.slot, 'super') || '★';
  for (const [f, g] of TS.ready) {
    const a = f.P[0], b = g.P[0], x = (a.x + b.x) / 2, y = Math.min(a.y, b.y) - 74, wait = TS.pending && TS.pending.f;
    c2.save();
    c2.setLineDash([8, 8]); c2.lineDashOffset = -G_STATE.t * 40; c2.globalAlpha = .7 * pulse;
    lineXY(c2, a.x, a.y - 22, b.x, b.y - 22, TEAM_SUPER.color, 3);
    c2.setLineDash([]);
    teamSuperText(c2, 'TEAM SUPER READY', x, y, 20, TEAM_SUPER.color, pulse);
    teamSuperText(c2, wait === f || wait === g ? `${(wait === f ? g : f).name}: press super now!` : `both press ${keyOf(f)} + ${keyOf(g)} together`, x, y + 20, 13, '#fff6d6', 1);
    c2.restore();
  }
}
function teamSuperText(c2, text, x, y, px, color, a) {
  c2.font = `${px}px ${FONT_DISPLAY}`; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.lineJoin = 'round';
  c2.globalAlpha = a; c2.lineWidth = 4; c2.strokeStyle = 'rgba(7,8,15,.9)'; c2.strokeText(text, x, y);
  c2.fillStyle = color; c2.fillText(text, x, y);
}

on('boot', () => {
  const help = 'Two players on one team with full super meters, standing close: TEAM SUPER READY shows above you. Both press super within half a second for DOUBLE TEAM, a crossing dash-slash and a shockwave that hits every foe. A lone press waits that half second, then fires your own ultimate.';
  const _teamTalkDraw = aiTalkDraw;
  aiTalkDraw = function (c2) { _teamTalkDraw(c2); teamSuperDrawHint(c2); };
  V5_TECHNIQUES.push({ name: 'Team Super: Double Team', icon: '✦', text: help });
  const _teamHowto = SCREENS.howto;
  SCREENS.howto = function () {
    const node = _teamHowto.apply(this, arguments), grid = node && node.querySelector('.help-grid');
    if (grid) grid.appendChild(el('section', { class: 'help-card' }, el('h3', {}, el('span', { text: '✦' }), 'Team Super'), el('p', { text: help })));
    return node;
  };
  defSfx('s6-team', v => { [262, 330, 392, 523].forEach((hz, k) => tone(hz, hz * 2, .6, 'sawtooth', .05 * v, k * .04)); noiseSweep(.7, 300, 5000, .1 * v, 'bandpass'); });
  defSfx('s6-team-wave', v => { thump(100, 28, .7, .9 * v); noise(.8, 300, .6 * v, 'lowpass'); noiseSweep(.5, 5000, 800, .1 * v, 'highpass', .05); });
});
