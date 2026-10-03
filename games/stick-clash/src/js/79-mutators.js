// 79-mutators.js: match mutators (picked on the arena screen, sent as cfg.mutators) and party mini-games that play
// between rounds (cfg.minigames, or the Settings choice). Mutators are off in Ranked and the quest modes.
// defMutator(key, { name, icon, desc, secret, match(cfg), round(), step(dt), ko(V, K), hit(B, amt, o), fighter(f) }).

const MUTATORS = {};
function defMutator(key, def) { return defLook(MUTATORS, key, def); }
const MUT_OFF_MODES = new Set(['ranked', 'campaign', 'challenge']);
let MUT_ON = [];          // the defs active in the current match

function mutActive(key) { return MUT_ON.some(m => m.key === key); }
function mutRun(name, ...args) { for (const m of MUT_ON) if (m[name]) hook(m, name, ...args); }

defMutator('bigheads', { name: 'Big Heads', icon: '🎃', desc: 'Huge heads. Purely for the giggles.', secret: 'konami',
  fighter(f) { f.headMul = 1.9; } });
defMutator('lowgrav', { name: 'Low Gravity', icon: '🌙', desc: 'Floaty jumps and long, lazy knockbacks.',
  round() { PHYS.gravity *= .55; } });
defMutator('explosive', { name: 'Explosive K.O.s', icon: '💣', desc: 'Every K.O. goes off like a bomb.',
  ko(V, K) { const h = V.P[2]; explode(h.x, h.y - 20, 120, 12, K && K !== V ? K : null, { kind: 'skill', color: '#ff8a2e' }); } });
defMutator('tiny', { name: 'Tiny Fighters', icon: '🐜', desc: 'Everyone shrinks. Weapons stay full size.',
  step() { for (const f of F) for (const l of f.L) if (!l.weapon) l.cur = lerp(l.cur, l.r * .68, .1); } });
defMutator('speed', { name: 'Speed ×1.5', icon: '⏩', desc: 'The whole match runs half again as fast.',
  match(cfg) { cfg.speed = (cfg.speed || 1) * 1.5; } });
defMutator('vampire', { name: 'Vampire', icon: '🧛', desc: 'Direct hits heal the attacker for a third of the damage.',
  hit(B, amt, o) { const A = o.src; if (A && A !== B && A.alive && /^(melee|proj|explode|skill)$/.test(o.kind || 'melee')) heal(A, amt / 3, false); } });
defMutator('ricochet', { name: 'Ricochet', icon: '🎱', desc: 'Bullets bounce off walls and floors twice.',
  step() { for (const p of PROJ) if (!p.zone && !p.mutRico && p.kind !== 'pickup' && p.kind !== 'throwable') { p.mutRico = true; p.bounce = Math.max(p.bounce || 0, 2); } } });
defMutator('sudden', { name: 'Sudden Death', icon: '☠', desc: 'Everything hits two and a half times as hard.',
  fighter(f) { f.dmgTakenMul = (f.dmgTakenMul || 1) * 2.5; } });
defMutator('randomweapons', { name: 'Random Weapons', icon: '🎲', desc: 'A new random weapon for everyone, every round.',
  fighter(f) { if (f.scale <= 1.05) equipWeapon(f, randomKey(WEAPONS)); } });
defMutator('supercharged', { name: 'Supercharged', icon: '🔋', desc: 'Every round starts with a full super meter.',
  fighter(f) { f.super = 100; } });
defMutator('orbstorm', { name: 'Orb Storm', icon: '🌠', desc: 'Power-up orbs rain down three times as often.',
  match(cfg) { cfg.orbs = true; cfg.orbRate = (cfg.orbRate || 1) * 3; } });

const mutAllowed = () => !G_STATE.demo && !MUT_OFF_MODES.has(G_STATE.mode && G_STATE.mode.key);
// Read from the live cfg: the first round starts (roundStart) before matchStart is emitted.
function mutRefresh() { MUT_ON = mutAllowed() ? ((G_STATE.cfg && G_STATE.cfg.mutators) || []).map(k => MUTATORS[k]).filter(Boolean) : []; }
on('matchStart', cfg => {
  mutRefresh();
  if (MUT_ON.length && !cfg.mutApplied) { cfg.mutApplied = true; mutRun('match', cfg); }   // a rematch reuses cfg
});
on('roundStart', () => {
  mutRefresh();
  if (!MUT_ON.length) return;
  mutRun('round');
  for (const f of F) if (!f.summon) mutRun('fighter', f);
});
on('mapStep', dt => { if (MUT_ON.length) mutRun('step', dt); });
on('ko', (V, K) => { if (MUT_ON.length && !V.summon) mutRun('ko', V, K); });
on('damage', (B, amt, o) => { if (MUT_ON.length && o) mutRun('hit', B, amt, o); });

// ---------- party mini-games between rounds ----------
// From round 2, every other round opens with a 10-15 s mini-game in the arena (no one can be K.O.'d). The winner
// carries a small perk into the real round, which then starts fresh. defMini(key, { name, icon, how, time,
// start(m), step(m, dt), draw(c, m), score: 'high' | 'low' }); m = { def, t, pts: [per fighter], data }.
const MINIS = {};
function defMini(key, def) { return defLook(MINIS, key, Object.assign({ time: 12, score: 'high' }, def)); }
const MINI_MODES = new Set(['versus', 'pvp', 'watch', 'team', 'ffa', 'roulette', 'tournament']);
const MINI_DEFAULT_ON = new Set(['watch', 'pvp', 'team', 'ffa']);    // CPU vs CPU and party modes
const MINI_PERKS = [
  ['shield', 'a shield', f => addStatus(f, 'shield', 20, 1)], ['haste', 'a head start', f => addStatus(f, 'haste', 4)],
  ['super', '+35 super', f => gainSuper(f, 35)], ['regen', 'regeneration', f => addStatus(f, 'regen', 4)]];
let MINI = null;                 // the running mini-game
const MINI_PERK = { round: 0, id: -1, perk: null };

function miniWanted() {
  const g = G_STATE, m = g.mode && g.mode.key, choice = g.cfg && g.cfg.minigames;
  if (g.demo || !MINI_MODES.has(m) || g.round < 2 || g.round % 2) return false;
  if (choice === true || choice === false) return choice;
  const s = typeof SETTINGS === 'object' ? SETTINGS.minigames : 'auto';
  return s === 'on' || (s !== 'off' && MINI_DEFAULT_ON.has(m));
}
on('matchStart', () => { MINI = null; MINI_PERK.round = 0; });
on('roundStart', round => {
  if (MINI && MINI.round === round) {                         // the real round after a mini-game: hand out the perk
    if (MINI.over && MINI_PERK.perk) miniGivePerk();
    return;
  }
  MINI = null;
  if (miniWanted()) miniStart(round);
});
function miniStart(round, key) {
  const def = MINIS[key] || MINIS[randomKey(MINIS)];        // key: tests pick a game
  MINI = { def, round, t: 0, pts: F.map(() => 0), data: {}, over: false };
  for (const f of F) f.dmgTakenMul = .01;
  hook(def, 'start', MINI);
  banner(def.name.toUpperCase(), 'MINI-GAME · ' + def.how, 2.4, '#ffd84a');
  emit('miniStart', def.key);
}
function miniStep(dt) {
  const m = MINI;
  if (!m || m.over || G_STATE.round !== m.round) return;
  G_STATE.roundT = 0;
  for (const f of F) if (f.alive) { f.hp = f.maxHp; miniRescue(f); }
  if (G_STATE.lock > 0) return;
  m.t += dt;
  hook(m.def, 'step', m, dt);
  if (m.t >= m.def.time) miniFinish();
}
on('mapStep', dt => { if (MINI) miniStep(dt); });
// Nobody falls out during a mini-game: fighters dropping off the arena come back from above their spawn.
function miniRescue(f) {
  const h = f.P[2], out = h.y > H + 80 || (!MAP.walls && (h.x < -120 || h.x > W + 120));
  if (!out) return;
  const sp = spawnPoint(f.id);
  moveFighter(f, sp[0] - h.x, sp[1] - 200 - h.y);
  for (const p of f.P) setVel(p, 0, 0);
}
function miniWinner(m) {
  const ids = F.map((f, i) => i).filter(i => !F[i].summon), sign = m.def.score === 'low' ? -1 : 1;
  const best = Math.max(...ids.map(i => sign * m.pts[i])), top = ids.filter(i => sign * m.pts[i] === best);
  return top.length === 1 ? top[0] : (m.data.first ?? -1);
}
function miniFinish() {
  const m = MINI, win = miniWinner(m), f = F[win];
  m.over = true;
  const perk = pick(MINI_PERKS);
  Object.assign(MINI_PERK, { round: G_STATE.round, id: win, perk: f ? perk : null });
  emit('miniEnd', m.def.key, f || null);
  newRound();          // the real round: fresh arena and fighters (the perk is handed out by roundStart)
  if (f) banner(`${f.name} wins ${m.def.name}!`, `Perk: ${perk[1]}`, 2, f.color);
}
function miniGivePerk() {
  const f = F[MINI_PERK.id];
  if (f && MINI_PERK.perk) { MINI_PERK.perk[2](f); float(f.P[0].x, f.P[0].y - 50, 'PERK: ' + MINI_PERK.perk[1].toUpperCase(), '#ffd84a', 16); }
  MINI_PERK.perk = null;
}
const miniFeet = f => ({ x: (f.P[8].x + f.P[10].x) / 2, y: feetY(f) });

defMini('sumo', { name: 'Sumo Shove', icon: '🤼', how: 'Every hit scores a point. Knockback is doubled!', time: 12,
  start() { for (const f of F) f.kbMul = (f.kbMul || 1) * 2; } });
on('hit', A => { if (MINI && !MINI.over && MINI.def.key === 'sumo' && A && MINI.pts[A.id] != null) { MINI.pts[A.id]++; if (MINI.data.first == null) MINI.data.first = A.id; } });

defMini('dodge', { name: 'Dodgeball Rain', icon: '🔴', how: 'Dodge the falling balls. Fewest hits wins!', time: 12, score: 'low',
  start(m) { m.data.balls = []; m.data.next = 0; },
  step(m, dt) {
    const d = m.data;
    if ((d.next -= dt) <= 0) { d.next = .28; d.balls.push({ x: rnd(60, W - 60), y: -30, vy: rnd(380, 560), r: 14, bounced: false }); }
    for (const b of d.balls) { b.vy += 900 * dt; b.y += b.vy * dt; miniBall(m, b); }
    d.balls = d.balls.filter(b => b.y < H + 60 && !b.hit);
  },
  draw(c, m) { for (const b of m.data.balls) glow(c, '#ff4a6a', 12, () => circle(c, b.x, b.y, b.r, '#ff4a6a', '#ffffff', 2)); } });
function miniBall(m, b) {
  for (const f of F) {
    if (!f.alive || f.summon || !f.P.slice(0, 3).some(p => Math.hypot(p.x - b.x, p.y - b.y) < b.r + 12)) continue;
    m.pts[f.id]++; b.hit = true; kick(f.P[0], rnd(-200, 200), 300);
    burst(b.x, b.y, '#ff4a6a', 10, 220);
    return;
  }
  const g = groundBelow(b.x, b.y - b.vy * DT - 4);
  if (g != null && b.y + b.r > g && b.vy > 0) { if (b.bounced) b.hit = true; b.bounced = true; b.y = g - b.r; b.vy *= -.45; }
}

defMini('hotfloor', { name: 'Hot Floor', icon: '🔥', how: 'Stay off the glowing lanes when they turn red!', time: 13, score: 'low',
  start(m) { m.data.lanes = Array.from({ length: 8 }, () => ({ warn: 0, hot: 0 })); m.data.next = 1; },
  step(m, dt) {
    const d = m.data;
    for (const l of d.lanes) { if (l.warn > 0 && (l.warn -= dt) <= 0) l.hot = 1.3; else if (l.hot > 0) l.hot -= dt; }
    if ((d.next -= dt) <= 0) { d.next = 2; shuffle(d.lanes.filter(l => l.warn <= 0 && l.hot <= 0)).slice(0, 3).forEach(l => { l.warn = .9; }); }
    for (const f of F) {
      if (!f.alive || f.summon || !f.grounded) continue;
      const lane = d.lanes[clamp(Math.floor(miniFeet(f).x / (W / 8)), 0, 7)];
      if (lane.hot > 0 && (f.mem.miniBurnT || 0) <= m.t) { m.pts[f.id]++; f.mem.miniBurnT = m.t + .35; for (const p of f.P) kick(p, 0, -260); }
    }
  },
  draw(c, m) {
    m.data.lanes.forEach((l, k) => {
      if (l.warn <= 0 && l.hot <= 0) return;
      c.fillStyle = l.hot > 0 ? 'rgba(255,60,40,.28)' : `rgba(255,216,74,${.12 + .1 * Math.sin(G_STATE.t * 20)})`;
      c.fillRect(k * W / 8 + 2, 0, W / 8 - 4, H);
    });
  } });

defMini('reflex', { name: 'Reflex Duel', icon: '⚡', how: 'Wait for NOW!, then press attack first. Too early = out!', time: 8,
  start(m) { m.data.go = rnd(1.6, 3.4); m.data.out = {}; m.data.cpu = F.map(() => rnd(.2, .55)); for (const f of F) f.ai.behave = 'idle'; },
  step(m) {
    const d = m.data;
    for (const f of F) {
      if (f.summon || d.out[f.id] || d.first != null) continue;
      const human = f.ctrl === 'human' && !f.autopilot, pressed = human ? f.inp.attack : m.t >= d.go + d.cpu[f.id];
      if (!pressed) continue;
      if (m.t < d.go) { d.out[f.id] = true; float(f.P[0].x, f.P[0].y - 40, 'TOO EARLY!', '#ff4a6a', 16); }
      else { d.first = f.id; m.pts[f.id] = 1; float(f.P[0].x, f.P[0].y - 40, 'FIRST!', '#ffd84a', 20); m.t = Math.max(m.t, m.def.time - 1.2); }
    }
    for (const f of F) { f.inp.mx = 0; f.inp.attack = f.inp.jump = false; f.inp.dash = 0; }
  },
  hud(c, m) {
    const now = m.t >= m.data.go;
    modeText(c, now ? 'NOW!' : 'WAIT...', W / 2, PARTY_HUD_Y + 110, now ? 72 : 48, now ? '#5dff9a' : '#ff8a2e');
  } });

const miniLive = () => !!MINI && !MINI.over && G_STATE.round === MINI.round && G_STATE.state !== 'killcam';
// World-space drawing (balls, lanes), drawn after the fighters.
function miniDrawWorld(c) {
  if (!miniLive() || !MINI.def.draw) return;
  c.save(); hook(MINI.def, 'draw', c, MINI); c.restore();
}
// The scoreboard (arena space, over the world).
function miniDraw(c) {
  const m = MINI;
  if (!miniLive()) return;
  c.save();
  if (m.def.hud) hook(m.def, 'hud', c, m);
  const left = Math.max(0, Math.ceil(m.def.time - m.t)), y = PARTY_HUD_Y, rows = F.filter(f => !f.summon).slice(0, 8);
  const step = Math.min(150, (VIEW.hudW - 40) / Math.max(1, rows.length));
  modeText(c, `${m.def.icon} ${m.def.name.toUpperCase()}  ${left}s`, W / 2, y, 22, '#ffd84a');
  rows.forEach((f, k) => modeText(c, `${f.name.slice(0, 8)} ${m.pts[f.id]}`, W / 2 + (k - (rows.length - 1) / 2) * step, y + 30, 16, f.color));
  c.restore();
}
