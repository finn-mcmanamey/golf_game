// 71b-party-v6.js (v6): Volley Clash, Paint Wars, Tower Race, the Spark Rush and Last Platform mini-games, and v6 helpers.

// ---------- shared v6 helpers ----------
const V6 = { help: {}, own: {} };  // per mode: rules lines; its own arena
// cfg.humans: the arena screen's Players choice (1: a CPU takes P2's seat).
const v6Humans = cfg => clamp(Math.round(cfg.humans ?? 2), 1, 2);
const v6HumansPick = key => clamp((MENU.v6humans || {})[key] || 2, 1, 2);
const v6Body = '600 ' + FONT_BODY;
const v6Mode = key => G_STATE.mode && G_STATE.mode.key === key;
const v6Clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const v6Apart = (a, b) => !aiColorNear(a, b);  // colours easy to tell apart
// P1, P2 (a CPU when alone), then CPUs up to n: paler shades on side(i)'s team, or each on its own.
function v6Crowd(cfg, n, teams, cpuName, side) {
  const names = duoNames(cfg), p1 = humanEntry(cfg, 0, 0, teams[0], names[0]);
  const p2 = v6Humans(cfg) > 1 ? humanEntry(cfg, 1, 1, teams[1], names[1]) : modeEntry({ ...loadoutOf(cfg, 1), team: teams[1], name: cpuName });
  if (!v6Apart(p1.color, p2.color)) p2.color = modeColor(p1.color);
  const list = [p1, p2], cpu = shuffle(MODE_NAMES.slice()), free = DEFAULT_COLORS.concat(MODE_COLORS).filter(c => v6Apart(c, p1.color) && v6Apart(c, p2.color));
  for (let i = 2; i < n; i++) list.push(modeEntry({ team: side ? side(i) : i, ...themeLoadout(pick(MODE_THEMES)), hat: modeHat(), name: cpu[i].toUpperCase(),
    color: side ? skillMixColor(list[i % 2].color, '#ffffff', .45) : free[i - 2] || modeColor(p1.color) }));
  return list;
}
// Shared mode shape: one round the mode ends itself; K.O.s come back after `respawn` s.
function v6Def(key, o) {
  if (o.ownMap) V6.own[key] = o.ownMap;
  return defMode(key, Object.assign({ players: [1, 2], cpu: true, pickers: 2, labels: ['Player 1', 'Player 2'], winScore: 1, crowd: [2, 4, 2],
    holdRound: () => true, roundOver: () => 'match', onKO(v) { if (!v.summon) modeRun().dead[v.id] = this.respawn; } }, o));
}
// A side's face: its first human (as the colour-blind palette coloured them), else its first fighter.
function v6SideLead(team) {
  const list = F.filter(f => f.team === team && !f.summon);
  return list.find(f => f.ctrl === 'human') || list[0] || null;
}
const v6TeamColor = team => (v6SideLead(team) || {}).color || PARTY_TEAMS[team % 2].color;
const v6SideName = team => (v6SideLead(team) || {}).name || partyTeamName(team);
const v6Result = (win, lines) => ({ title: win < 0 ? 'Draw!' : `${v6SideName(win)} wins!`, color: win < 0 ? '#ffd84a' : v6TeamColor(win), won: win === 0, lines: lines.filter(Boolean) });
const v6End = (win, sub) => partyEnd(win, 'time', 'TIME!', win < 0 ? 'DRAW' : v6SideName(win) + ' ' + sub, win < 0 ? null : v6TeamColor(win));
const v6Lead = (a, b) => a === b ? -1 : a > b ? 0 : 1;

// 73-duo's head-to-head line for players who met among CPUs (73 counts pure duels); cfg.noRecord/cfg.night skip it.
function v6Rivalry(score) {
  try {
    const R = G_STATE.roster, p = [0, 1].map(s => R.find(r => r.ctrl === 'human' && r.slot === s)), info = G_STATE.info, names = p.map(r => r && String(r.name));
    if (!p[0] || !p[1] || p[0].team === p[1].team || G_STATE.cfg.autopilot || G_STATE.demo || duoPair() || duoLow(names[0]) === duoLow(names[1])) return null;
    if (!info.v6Rec && !G_STATE.cfg.noRecord && !G_STATE.cfg.night) info.v6Rec = v6Settle(names, p.map(score));
    const rec = info.v6Rec || duoRec(...names);
    return rec ? 'Head-to-head: ' + duoLine(rec, ...names) : null;
  } catch (e) { report(e, 'v6 rivalry'); return null; }
}
function v6Settle(names, s) {  // as 73's duoSettle; s: each player's score
  const rec = duoRec(...names, true), side = s[0] === s[1] ? -1 : duoSide(rec, names[s[0] > s[1] ? 0 : 1]);
  for (const n of names) rec.n[duoSide(rec, n)] = n;
  rec.total++;
  if (side >= 0) rec.w[side]++;
  rec.streak = side < 0 ? [-1, 0] : [side, rec.streak[0] === side ? rec.streak[1] + 1 : 1];
  rec.last = (rec.last + (side < 0 ? 'd' : 'ab'[side])).slice(-10);
  duoSave();
  return rec;
}
// Steers fighters via the arena's frame hook until newRound rebuilds MAP.
function v6Frame(fn) {
  const base = MAP.frame;
  MAP.frame = function (f, phase, enter) { if (base) base.call(this, f, phase, enter); fn(f, phase, enter); };
}
const v6Still = f => { for (const k in f.inp) f.inp[k] = typeof f.inp[k] === 'number' ? 0 : false; };

// Arena screen: rules, the Players choice, and a mode's own arena in place of the grid.
function v6MapsPanel(node, mode) {
  const h = V6.help[mode.key], body = node.querySelector('.sheet-body'), own = MAPS[V6.own[mode.key]], grid = node.querySelector('.map-grid');
  if (!h || !body) return;
  if (own && grid) grid.replaceWith(el('div', { class: 'v6-own' }, el('img', { src: mapThumb(own.key), alt: '' }),
    el('div', {}, el('strong', { text: own.name }), el('small', { text: own.desc }))));
  const seats = segField('Players', [[1, mode.duo === 'coop' ? '1 player + CPU ally' : '1 player vs CPU'], [2, '2 players']], v6HumansPick(mode.key),
    v => { MENU.v6humans = Object.assign({}, MENU.v6humans, { [mode.key]: v }); saveMenu(); });
  body.prepend(el('section', { class: 'v6-help' }, el('h3', {}, el('span', { text: modeIcon(mode) }), mode.name), el('ul', {}, h.map(t => el('li', { text: t }))), seats));
}
function v6HowtoCard(node) {  // one card: each v6 mode's and mini-game's first sentence
  const grid = node.querySelector('.help-grid'), rows = Object.keys(V6.help).map(k => MODES[k]).concat(['coinrush', 'lastplatform'].map(k => MINIS[k])).filter(Boolean);
  if (grid) grid.append(el('section', { class: 'help-card v6-howto' }, el('h3', {}, el('span', { text: '🎉' }), 'Party and co-op games'),
    el('ul', { class: 'orb-list' }, rows.map(m => el('li', {}, el('b', { text: m.icon }), el('span', {}, el('strong', { text: m.name }), ' ' + (m.how || m.desc.split(/(?<=[.!?])\s/)[0])))))));
}
on('boot', () => {
  const maps = SCREENS.maps, howto = SCREENS.howto, cfgOf = menuCfg, body = drawFighter;
  SCREENS.maps = () => { const node = maps(), mode = MODES[MENU.mode]; try { if (mode) v6MapsPanel(node, mode); } catch (e) { report(e, 'v6 arena screen'); } return node; };
  SCREENS.howto = () => { const node = howto(); try { v6HowtoCard(node); } catch (e) { report(e, 'v6 how to play'); } return node; };
  menuCfg = () => { const c = cfgOf(); if (V6.help[c.mode]) c.humans = v6HumansPick(c.mode); return c; };
  // Boss parts are hit boxes their mode draws; drones draw themselves (kill-cam ghosts inherit both).
  drawFighter = f => { if (f.v6part) return; if (f.v6draw) { if (f.alive) hook(f, 'v6draw', ctx, f); return; } body(f); };
});

// ---------- Volley Clash ----------
// Hit the ball over the net; a ball landing on your side scores for the other. Brawling allowed.
const VC_NET = { x: 634, w: 12, top: 470 }, VC_R = 32, VC_GRAV = .42, VC_SERVE = 1.2, VC_TAKEN = .5;
const VC_POINTS = { short: 5, normal: 7, long: 11 }, VC_AIM_ERR = { easy: 80, normal: 38, hard: 16, insane: 6 };
const vcGoal = () => VC_POINTS[(G_STATE.cfg || {}).roundLen] || 7;
const vcSideOf = x => x < VC_NET.x + VC_NET.w / 2 ? 0 : 1;
const vcHome = (side, k) => [[330, 180, 480], [950, 1100, 800]][side][k % 3];

defMap('beach', {
  name: 'Sunset Court', hidden: true, desc: 'Sand, surf and a net down the middle: the Volley Clash court.',
  floor: 650, friction: .2, orbs: false, weather: ['wind', 'night'],
  palette: { sky1: '#21103a', sky2: '#ff8a5c', ground: '#e9c48d', line: '#ffe0a8', accent: '#5ef2ff', solid: '#3a2448' },
  solids: [{ x: VC_NET.x, y: VC_NET.top, w: VC_NET.w, h: 650 - VC_NET.top, oneWay: false, vcNet: true, draw: vcDrawNet }],
  spawns: [[330, 650], [950, 650], [480, 650], [800, 650], [180, 650], [1100, 650]],
  drawBg(c, t) { vcDrawBeach(c, t); },
});

v6Def('volley', {
  name: 'Volley Clash', icon: '🏐', order: 21, duo: 'versus', roundLimit: 240, crowd: [2, 6, 2], noScore: true, noDisarm: true, respawn: 2.5, ownMap: 'beach',
  desc: 'Beach volleyball with weapons: smack the ball over the net, spike it, bonk your rival. First to 7.',
  setup(cfg) { return { roster: v6Crowd(cfg, partyCrowd(cfg, this) & ~1 || 2, [0, 1], 'RIVAL', i => i % 2), map: 'beach', run: { pts: [0, 0], dead: {}, rally: 0, best: 0, spikes: {} } }; },
  roundLabel() { return `VOLLEY CLASH · FIRST TO ${vcGoal()}`; },
  onRoundStart() {
    const run = modeRun(), slot = [0, 0];
    run.net = MAP.solids.find(s => s.vcNet) || null;
    for (const f of F) if (!f.summon) { const side = f.team % 2; partyPlace(f, vcHome(side, slot[side]++), partyFloor()); f.dmgTakenMul = VC_TAKEN; }
    vcServe(run, chance(.5) ? 0 : 1);
    banner('VOLLEY CLASH', `FIRST TO ${vcGoal()} POINTS`, 2, '#ffd84a');
  },
  onStep(dt) {
    const run = modeRun(), b = run.ball;
    if (!b || !partyLive()) return;
    partyTickRespawns(run, dt, old => { partyRespawn(old, vcHome(old.team % 2, old.id), partyFloor()).dmgTakenMul = VC_TAKEN; });
    vcStepBall(run, b, dt);
    vcCpuTouches(b);
    if (!G_STATE.ending && G_STATE.roundT >= G_STATE.roundLimit) v6End(v6Lead(...run.pts), 'WINS');
  },
  aiGoal(f) { return vcAiGoal(f); },
  drawWorld(c) { vcDrawBall(c, modeRun().ball); },
  hud(c) { vcHud(c, modeRun()); },
  results() {
    const run = modeRun(), [a, b] = run.pts, spikes = F.filter(f => !f.summon && run.spikes[f.id]).map(f => `${f.name} ${run.spikes[f.id]}`);
    return v6Result(v6Lead(a, b), [`Points ${a} – ${b} · longest rally ${run.best} touches.`, v6Rivalry(r => run.pts[r.team % 2]),
      spikes.length && `Spikes: ${spikes.join(' · ')}.`]);
  },
});

function vcServe(run, side) {
  run.ball = { x: side ? 950 : 330, y: 200, vx: 0, vy: 0, r: VC_R, spin: 0, hold: VC_SERVE, last: null, flight: 0, cool: new Map() };
  run.rally = 0;
}
function vcStepBall(run, b, dt) {
  if (b.hold > 0) { b.hold -= dt; return; }
  b.vy += PHYS.gravity * VC_GRAV * dt; b.vx += PHYS.windX * .25 * dt;  // floaty; gusts carry it
  b.vx *= 1 - .2 * dt; b.vy *= 1 - .2 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.spin += b.vx * dt / b.r;
  if (b.x < b.r || b.x > W - b.r) { b.x = clamp(b.x, b.r, W - b.r); b.vx = Math.abs(b.vx) * (b.x < W / 2 ? .8 : -.8); }
  if (b.y < -160) { b.y = -160; b.vy = Math.abs(b.vy) * .5; }
  if (run.net) socCollideRect(b, run.net);
  for (const f of F) if (f.alive && !f.summon) vcTouch(run, b, f);
  vcShots(b);
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 1500) { b.vx *= 1500 / sp; b.vy *= 1500 / sp; }
  if (b.y + b.r >= partyFloor()) vcPoint(run, b);
}
// Bodies bump the ball up, weapons hit it toward the other court: one touch per fighter per .22 s.
function vcTouch(run, b, f) {
  const ready = (b.cool.get(f) || 0) <= G_STATE.t, sp = Math.hypot(b.vx, b.vy);
  for (let j = 0; j < f.P.length; j++) {
    if (j < 11 && j % 2) continue;  // mid-limb joints
    const p = f.P[j], weapon = j >= 11, pr = (weapon ? 8 : j === 0 ? 14 : 8) * f.scale, dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
    if (d >= b.r + pr || d < 1e-3) continue;
    const nx = dx / d, ny = dy / d, rel = (vx(p) - b.vx) * nx + (vy(p) - b.vy) * ny;
    b.x = p.x + nx * (b.r + pr); b.y = p.y + ny * (b.r + pr);
    if (!ready) continue;
    b.cool.set(f, G_STATE.t + .22);
    if (!weapon && sp > 560 && b.last && b.last.team !== f.team) {
      damage(f, clamp((sp - 480) / 55, 2, 9), { src: b.last, kind: 'skill', x: b.x, y: b.y, nx: b.vx / sp, ny: b.vy / sp, kb: 360, color: '#ffe0a8' });
      float(f.P[0].x, f.P[0].y - 44, 'BONK!', '#ffe0a8', 20);
    }
    if (weapon && rel > 120) vcHit(run, b, f, rel);
    else {  // a header
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; }
      b.vy = Math.min(b.vy, -360); b.vx += (f.team % 2 ? -1 : 1) * 70; sfx('v6-bump', .5);
    }
    if (b.last !== f) run.rally++;
    b.last = f; b.flight++;
    return;
  }
}
// Heavier weapons hit harder; airborne near the net it's a spike.
function vcHit(run, b, f, rel) {
  const dir = f.team % 2 ? -1 : 1, mass = clamp(f.w.mass || 1, .4, 3);
  if (!f.grounded && feetY(f) < partyFloor() - 50 && Math.abs(b.x - VC_NET.x) < 360 && b.y > VC_NET.top - 260) {
    b.vx = dir * (560 + 130 * mass); b.vy = 240 + 50 * mass;
    run.spikes[f.id] = (run.spikes[f.id] || 0) + 1;
    float(b.x, b.y - 46, 'SPIKE!', f.color, 26); sfx('v6-spike'); shake(5);
  } else {
    const k = clamp(rel / 650, .75, 1.35);
    b.vx = dir * (230 + 95 * mass) * k + vx(f.P[2]) * .25; b.vy = -(530 + 65 * mass) * (.9 + .1 * k);
    sfx('v6-bump');
  }
  burst(b.x, b.y, f.color, 12, 280, { life: .25 });
}
function vcShove(b, kx, ky, owner) { b.vx += kx; b.vy += ky; if (owner) { b.last = owner; b.flight++; } }
function vcShots(b) {
  for (const p of PROJ) {
    if (p.dead || p.zone || !(p.r > 0) || Math.hypot(p.x - b.x, p.y - b.y) > b.r + p.r) continue;
    const k = clamp((p.dmg || 6) / 10, .4, 2) * .3;
    vcShove(b, p.vx * k, p.vy * k - 160, p.owner);
    if (!p.explode) { p.dead = true; burst(p.x, p.y, p.color, 6, 200, { life: .2 }); }
  }
}
on('explode', (x, y, radius, owner) => {
  const b = v6Mode('volley') && modeRun().ball, d = b && Math.hypot(b.x - x, b.y - y), k = d && 900 * (1 - d / (radius + b.r)) / Math.max(1, d);
  if (b && b.hold <= 0 && k > 0) vcShove(b, (b.x - x) * k, (b.y - y) * k - 220, owner);
});
function vcPoint(run, b) {
  const side = vcSideOf(b.x), team = 1 - side, fl = partyFloor();
  run.pts[team]++; run.best = Math.max(run.best, run.rally);
  b.y = fl - b.r;
  burst(b.x, fl - 4, '#ffe0a8', 30, 380, { grav: 1 }); ring(b.x, fl, 90, v6TeamColor(team), .5, 6); sfx('v6-point'); shake(8);
  if (run.pts[team] >= vcGoal()) return partyEnd(team, 'points', 'GAME!', v6SideName(team) + ' WINS', v6TeamColor(team));
  banner('POINT', `${v6SideName(team)} · ${run.pts[0]} – ${run.pts[1]}`, 1.3, v6TeamColor(team));
  vcServe(run, side);  // the loser serves
}
// Where the ball lands (x), its own physics run ahead; dots collects the path.
function vcPredict(b, dots) {
  let x = b.x, y = b.y, sx = b.vx, sy = b.vy;
  const step = 1 / 30, fl = partyFloor();
  for (let k = 1; k < 80 && y + b.r < fl; k++) {
    sy += PHYS.gravity * VC_GRAV * step; sx *= 1 - .2 * step; sy *= 1 - .2 * step; x += sx * step; y += sy * step;
    if (x < b.r || x > W - b.r) { sx = -sx * .8; x = clamp(x, b.r, W - b.r); }
    if (dots && k % 3 === 0 && k < 40 && y + b.r < fl) dots.push(x, y);
  }
  return x;
}
// CPUs: whoever is nearest the landing spot gets behind it (lower levels misjudge it); the rest wait at home.
function vcAiGoal(f) {
  const b = modeRun().ball;
  if (!b) return null;
  const side = f.team % 2, fl = partyFloor(), land = b.hold > 0 ? b.x : vcPredict(b);
  const mates = F.filter(o => o.alive && !o.summon && o.team === f.team), lo = side ? VC_NET.x + 46 : 30, hi = side ? W - 30 : VC_NET.x - 46;
  if (vcSideOf(land) !== side) return { x: vcHome(side, 0) + (mates.indexOf(f) - (mates.length - 1) / 2) * 150, y: fl, w: 70 };
  if (f.mem.vcFlight !== b.flight) { f.mem.vcFlight = b.flight; f.mem.vcErr = rnd(-1, 1) * (VC_AIM_ERR[f.aiLevel || modeDiff()] ?? 38); }
  const taker = mates.reduce((a, o) => Math.abs(o.P[2].x - land) < Math.abs(a.P[2].x - land) ? o : a, f);
  return taker === f ? { x: clamp(land + (side ? 34 : -34) + f.mem.vcErr, lo, hi), y: fl, w: 28 } : { x: clamp(lerp(vcHome(side, 0), land, .35), lo, hi), y: fl, w: 90 };
}
// CPUs swing at a ball in reach and jump to meet a high one.
function vcCpuTouches(b) {
  if (b.hold > 0) return;
  for (const f of F) {
    if (!f.alive || f.summon || !aiBrain(f) || !canAct(f)) continue;
    const c = chest(f), dx = b.x - c.x, dy = b.y - c.y;
    if (f.atkCd <= 0 && Math.hypot(dx, dy) < aiReach(f) * .8 + b.r && dy > -170) { f.inp.attack = true; f.face = f.team % 2 ? -1 : 1; }
    else if (f.grounded && Math.abs(dx) < 90 && dy < -110 && dy > -330 && b.vy > -150) f.inp.jump = true;
  }
}
function vcHud(c, run) {
  const y = PARTY_HUD_Y, goal = vcGoal(), cols = [0, 1].map(v6TeamColor), gap = Math.min(15, 170 / goal), b = run.ball;
  modePanel(c, W / 2 - 220, y - 24, 440, 66, 'rgba(255,224,168,.45)');
  modeText(c, `${v6SideName(0)}  ${run.pts[0]}`, W / 2 - 22, y - 2, 21, cols[0], 'right');
  modeText(c, '🏐', W / 2, y - 2, 16, '#ffe0a8');
  modeText(c, `${run.pts[1]}  ${v6SideName(1)}`, W / 2 + 22, y - 2, 21, cols[1], 'left');
  for (const t of [0, 1]) for (let k = 0; k < goal; k++) circle(c, W / 2 + (t ? 1 : -1) * (24 + k * gap), y + 26, 4.5, k < run.pts[t] ? cols[t] : 'rgba(255,255,255,.2)');
  if (b && b.hold > 0 && G_STATE.lock <= 0) modeText(c, `Serve to ${v6SideName(vcSideOf(b.x))}`, W / 2, y + 58, 15, '#ffe0a8', 'center', v6Body);
  partyDrawRespawns(c, run, y + 80);
}
// The ball, its dotted path and a ring where it lands (coloured for the side about to lose the point).
function vcDrawBall(c, b) {
  if (!b) return;
  const fl = partyFloor(), dots = [], land = b.hold > 0 ? null : vcPredict(b, dots);
  for (let k = 0; k < dots.length; k += 2) { c.globalAlpha = .6 * (1 - k / 30); circle(c, dots[k], dots[k + 1], 4, '#ffffff'); }
  if (land != null) {
    const col = v6TeamColor(vcSideOf(land));
    c.globalAlpha = .55 + .3 * Math.sin(G_STATE.t * 10); c.strokeStyle = col; c.lineWidth = 3;
    c.beginPath(); c.ellipse(land, fl - 1, 30, 8, 0, 0, TAU); c.stroke();
    lineXY(c, land - 9, fl - 7, land + 9, fl + 5, col, 3); lineXY(c, land - 9, fl + 5, land + 9, fl - 7, col, 3);
  }
  c.globalAlpha = 1;
  glow(c, '#fff3c4', 16, () => circle(c, b.x, b.y, b.r, '#fff7e0', '#1f1430', 3));
  c.save(); c.beginPath(); c.arc(b.x, b.y, b.r - 2, 0, TAU); c.clip(); c.lineWidth = 6;
  ['#ff5ad1', '#5ef2ff', '#ffd84a'].forEach((col, k) => { const a = b.spin + k * TAU / 3; c.strokeStyle = col; c.beginPath(); c.arc(b.x + Math.cos(a) * b.r * .95, b.y + Math.sin(a) * b.r * .95, b.r * .78, 0, TAU); c.stroke(); });
  c.restore();
  if (b.hold <= 0) return;
  c.strokeStyle = '#ffd84a'; c.lineWidth = 4; c.beginPath(); c.arc(b.x, b.y, b.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * b.hold / VC_SERVE); c.stroke();
  modeText(c, 'SERVE', b.x, b.y - b.r - 24, 16, '#ffd84a');
}
function vcDrawNet(c, s) {
  mapRect(c, '#2a1a3a', s.x, s.y, s.w, s.h);
  mapRect(c, 'rgba(255,240,220,.18)', s.x - 7, s.y + 6, s.w + 14, 78);
  for (let y = s.y + 20; y < s.y + 84; y += 16) lineXY(c, s.x - 7, y, s.x + s.w + 7, y, 'rgba(255,240,220,.5)', 1);
  glowLine(c, s.x - 9, s.y + 4, s.x + s.w + 9, s.y + 4, '#ffe0a8', 4);
}
// Sunset beach; the ball's shadow on the sand, under the fighters.
function vcDrawBeach(c, t) {
  const fl = MAP.floor ?? 650, sea = 470, b = v6Mode('volley') && c === ctx && modeRun().ball;
  mapSky(c, sea, ['#21103a', '#7a2f6b', '#ff8a5c']);
  mapGlow(c, 960, 410, 260, '#ff8a5c', .35);
  mapSun(c, 960, 410, 96, ['#ffe9a0', '#ff9a5c', '#ff4a8a'], 'rgba(122,47,107,.55)', t);
  mapRect(c, '#2b1b55', -40, sea, W + 80, fl - sea);
  for (let k = 0; k < 4; k++) lineXY(c, -40, sea + 20 + k * 40 + Math.sin(t + k) * 3, W + 40, sea + 20 + k * 40 - Math.sin(t + k) * 3, rgba('#ffb3a0', .18 - k * .03), 2);
  c.lineCap = 'round';
  for (const [x, d] of [[60, 1], [W - 60, -1]]) {  // palms
    const tx = x + d * 70 + Math.sin(t * .8 + x) * 6, ty = fl - 260;
    lineXY(c, x, fl, tx, ty, '#1b0d26', 14);
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .65; lineXY(c, tx, ty, tx + Math.cos(a) * 100, ty + Math.sin(a) * 60 + 40, '#1b0d26', 7); }
  }
  mapGround(c, fl, ['#f2cf96', '#c99a5c'], '#ffe0a8', 3);
  if (!b) return;
  const h = clamp((fl - b.y) / 520, 0, 1);
  c.fillStyle = `rgba(60,24,50,${.5 - .3 * h})`; c.beginPath(); c.ellipse(b.x, fl + 3, b.r * (1.15 - .55 * h), 7 * (1 - .4 * h), 0, 0, TAU); c.fill();
}

// ---------- Paint Wars ----------
// Footsteps and hits paint the arena; the side covering more of it at the end wins.
const PW_CELL = 16, PW_FOOT = 18, PW_TAKEN = .6;
const pwLive = () => v6Mode('paint') && modeRun().segs ? modeRun() : null;

v6Def('paint', {
  name: 'Paint Wars', icon: '🎨', order: 22, duo: 'versus', roundLimit: 60, crowd: [2, 6, 2], noScore: true, respawn: 2.5,
  desc: 'Footsteps and hits paint the arena in your colour. Cover more of it than your rival in 60 seconds.',
  setup(cfg) { return { roster: v6Crowd(cfg, partyCrowd(cfg, this) & ~1 || 2, [0, 1], 'RIVAL', i => i % 2), map: partyMap(cfg), run: { dead: {}, by: {} } }; },
  roundLabel() { return 'PAINT WARS'; },
  onRoundStart() {
    const run = modeRun(), slot = [0, 0];
    pwBuild(run);
    for (const f of F) if (!f.summon) { const [x, y] = partySideSpot(f.team % 2, slot[f.team % 2]++ + 1); partyPlace(f, x, y); f.dmgTakenMul = PW_TAKEN; }
    banner('PAINT WARS', 'COVER THE ARENA IN YOUR COLOUR!', 2, '#ff5ad1');
  },
  onStep(dt) {
    const run = modeRun();
    if (!run.segs || !partyLive()) return;
    partyTickRespawns(run, dt, old => { const [x, y] = partySideSpot(old.team % 2, old.id); partyRespawn(old, x, y).dmgTakenMul = PW_TAKEN; });
    for (const f of F) if (f.alive && !f.summon) for (const j of [8, 10]) {  // grounded feet paint
      const p = f.P[j], seg = p.g && run.segs.find(sg => sg.s === p.gs);
      if (seg) pwPaint(run, seg, p.x, PW_FOOT, f.team % 2, f);
    }
    if (G_STATE.roundT >= G_STATE.roundLimit) v6End(v6Lead(...run.count), 'PAINTS THE TOWN');
  },
  aiGoal(f) { return pwAiGoal(f); },
  drawWorld(c) { pwDraw(c, modeRun()); },
  hud(c) { pwHud(c, modeRun()); },
  results() {
    const run = modeRun(), pct = t => Math.round(run.count[t] / Math.max(1, run.total) * 100);
    const top = F.filter(f => !f.summon).sort((a, b) => (run.by[b.id] || 0) - (run.by[a.id] || 0))[0];
    return v6Result(G_STATE.winner, [`Coverage: ${v6SideName(0)} ${pct(0)}% · ${v6SideName(1)} ${pct(1)}%.`, v6Rivalry(r => run.count[r.team % 2]),
      top && run.by[top.id] && `Busiest brush: ${top.name} (${run.by[top.id]} tiles painted).`]);
  },
});

// The floor and ledge tops in PW_CELL cells (none over hazards).
function pwBuild(run) {
  Object.assign(run, { segs: [], count: [0, 0], total: 0 });
  const add = (x0, x1, s) => {
    const n = Math.max(1, Math.round((x1 - x0) / PW_CELL)), seg = { x0, w: x1 - x0, s, n, own: new Int8Array(n).fill(-1), dead: new Uint8Array(n) };
    for (let k = 0; k < n; k++) if (MAP.hazards.some(hz => inRect(pwCellX(seg, k), pwSegY(seg) - 4, hz, 6))) seg.dead[k] = 1; else run.total++;
    run.segs.push(seg);
  };
  if (MAP.floor != null) add(0, W, null);
  for (const s of MAP.solids) if (s.w >= 48 && !s.brk && s.y > 40 && s.y < (MAP.floor ?? H) - 10) add(s.x, s.x + s.w, s);
}
const pwSegY = seg => seg.s ? seg.s.y : MAP.floor;
const pwSegX = seg => seg.s ? seg.s.x : seg.x0;  // ledges may slide
const pwCellX = (seg, k) => pwSegX(seg) + (k + .5) * seg.w / seg.n;
function pwPaint(run, seg, x, r, team, f) {
  const cw = seg.w / seg.n, x0 = pwSegX(seg);
  for (let k = Math.max(0, Math.floor((x - r - x0) / cw)), k1 = Math.min(seg.n - 1, Math.floor((x + r - x0) / cw)); k <= k1; k++) {
    if (seg.dead[k] || seg.own[k] === team) continue;
    if (seg.own[k] >= 0) run.count[seg.own[k]]--;
    seg.own[k] = team; run.count[team]++; run.by[f.id] = (run.by[f.id] || 0) + 1;
  }
}
function pwSplash(run, x, y, r, f) {
  const gy = groundBelow(x, y - 20);
  if (gy == null) return;
  for (const seg of run.segs) if (Math.abs(pwSegY(seg) - gy) < 3 && x + r > pwSegX(seg) && x - r < pwSegX(seg) + seg.w) pwPaint(run, seg, x, r, f.team % 2, f);
  burst(x, gy - 6, v6TeamColor(f.team % 2), 10, 220, { life: .35, grav: 1 });
}
on('damage', (B, amt, o) => {
  const run = pwLive(), A = o && o.src && (o.src.summon ? o.src.owner : o.src);
  if (!run || !A || A.team === B.team || !/^(melee|proj|explode|skill)$/.test(o.kind || 'melee')) return;
  pwSplash(run, B.P[2].x, feetY(B), 26 + Math.min(40, amt * 2.5), A);
  sfx('rift-splat', .6);
});
on('explode', (x, y, radius, owner) => { const run = pwLive(); if (run && owner && !owner.summon) pwSplash(run, x, y, radius * .8, owner); });
// CPUs paint the nearest cell not theirs (rival paint first), kept a moment against dithering.
function pwAiGoal(f) {
  const run = modeRun(), m = f.mem.pw, team = f.team % 2, me = f.P[2].x, fy = feetY(f);
  if (!run.segs) return null;
  if (m && m.until > G_STATE.t) return m.zone;
  let best = null, bs = Infinity;
  for (const seg of run.segs) for (let k = 0, y = pwSegY(seg); k < seg.n; k += 2) {
    if (seg.dead[k] || seg.own[k] === team) continue;
    const x = pwCellX(seg, k), s = Math.abs(x - me) + Math.abs(y - fy) * 1.6 - (seg.own[k] >= 0 ? 60 : 0);
    if (s < bs) { bs = s; best = { x, y, w: 50 }; }
  }
  f.mem.pw = { zone: best, until: G_STATE.t + rnd(.6, 1.2) };
  return best;
}
function pwHud(c, run) {
  if (!run.segs) return;
  const y = PARTY_HUD_Y, w = Math.min(520, VIEW.hudW - 160), x = W / 2 - w / 2, tot = Math.max(1, run.total), cols = [0, 1].map(v6TeamColor);
  const a = run.count[0] / tot, b = run.count[1] / tot, left = Math.max(0, G_STATE.roundLimit - G_STATE.roundT);
  modePanel(c, x - 14, y - 24, w + 28, 70, 'rgba(255,90,209,.45)');
  mapRect(c, 'rgba(255,255,255,.1)', x, y - 9, w, 18);
  glow(c, cols[0], 10, () => mapRect(c, cols[0], x, y - 9, w * a, 18));
  glow(c, cols[1], 10, () => mapRect(c, cols[1], x + w * (1 - b), y - 9, w * b, 18));
  lineXY(c, W / 2, y - 14, W / 2, y + 14, '#ffffff', 2);
  modeText(c, `${v6SideName(0)} ${Math.round(a * 100)}%`, x, y + 28, 16, cols[0], 'left');
  modeText(c, `${Math.round(b * 100)}% ${v6SideName(1)}`, x + w, y + 28, 16, cols[1], 'right');
  modeText(c, v6Clock(left), W / 2, y + 28, 18, left < 10 ? '#ff4a6a' : '#ffffff');
  partyDrawRespawns(c, run, y + 66);
}
function pwDraw(c, run) {
  if (!run.segs) return;
  const cols = [0, 1].map(v6TeamColor);
  for (const seg of run.segs) {
    const cw = seg.w / seg.n, x0 = pwSegX(seg), y = pwSegY(seg);
    for (let k = 0, e; k < seg.n; k = e) {
      const o = seg.own[k];
      for (e = k + 1; e < seg.n && seg.own[e] === o;) e++;
      if (o < 0) continue;
      mapRect(c, rgba(cols[o], .9), x0 + k * cw, y - 4, (e - k) * cw, 9);
      mapRect(c, 'rgba(255,255,255,.35)', x0 + k * cw + 2, y - 2, (e - k) * cw - 4, 1.5);
      if (seg.s) for (let q = k; q < e; q++) if ((q * 7 + seg.n) % 5 === 0) mapRect(c, rgba(cols[o], .8), x0 + (q + .4) * cw, y + 4, 3, 4 + (q % 3) * 4);
    }
  }
}

// ---------- Tower Race ----------
// A fresh tower each race; the world scrolls so the camera climbs. Falls stop at your checkpoint. First to 2 races.
const TW_FLOOR = 660, TW_TALL = 3000, TW_GAP = [150, 190], TW_CHECK = 620, TW_TAKEN = .5, TW_KB = 1.25;

defMap('spire', {
  name: 'The Wick Spire', hidden: true, desc: 'The foot of a tower that climbs into the clouds: Tower Race builds the rest.',
  floor: TW_FLOOR, orbs: false, weather: false,
  palette: { sky1: '#0b1030', sky2: '#ff9a5a', ground: '#1a1630', line: '#ffd84a', accent: '#5ef2ff', solid: '#241c3e' },
  solids: [{ x: 160, y: 500, w: 220 }, { x: 900, y: 500, w: 220 }, { x: 520, y: 360, w: 240 }],
  spawns: [[300, 660], [980, 660], [440, 660], [840, 660], [180, 660], [1100, 660]],
  drawBg(c, t) { twDrawBg(c, t); },
});

v6Def('tower', {
  name: 'Tower Race', icon: '🗼', order: 23, duo: 'versus', winScore: 2, roundLimit: 150, noDisarm: true, respawn: 2, roundOver: null, ownMap: 'spire',
  desc: 'Race up a tall tower to the flag, knocking your rival down on the way. Checkpoints catch falls. Best of 3.',
  setup(cfg) { return { roster: v6Crowd(cfg, partyCrowd(cfg, this), [0, 1], 'RIVAL'), map: 'spire', run: { dead: {} } }; },
  roundLabel() { return `TOWER RACE · RACE ${G_STATE.round}`; },
  onRoundStart() { twStart(modeRun()); },
  onStep(dt) { twStep(modeRun(), dt); },
  aiGoal(f) { return twAiGoal(f); },
  drawWorld(c) { twDraw(c, modeRun()); },
  hud(c) { twHud(c, modeRun()); },
  results() {
    const run = modeRun(), s = G_STATE.score, R = G_STATE.roster, best = s.indexOf(Math.max(...s)), r = R[best] || R[0];
    return { title: best === 0 ? 'King of the tower!' : `${r.name} wins!`, color: r.color, won: best === 0,
      lines: [`Races won: ${R.map((e, i) => `${e.name} ${s[i] || 0}`).join(' · ')}.`, v6Rivalry(e => (s[e.team] || 0) * 1e5 + (run.best[R.indexOf(e)] || 0)),
        `Tower height: ${Math.round(run.tower.tall / 10)} m.`].filter(Boolean) };
  },
});

// Rows of ledges a jump apart (h: height); the main one zigzags within reach of the last, side ones add routes.
function twBuild(tall) {
  const rows = [], checks = [];
  let h = 0, x = W / 2, next = TW_CHECK;
  while (h < tall - 200) {
    h += rnd(...TW_GAP);
    const check = h >= next && h < tall - 300, last = h >= tall - 200, w = check ? 330 : rnd(150, 230);
    if (check) next += TW_CHECK;
    const slide = !check && !last && chance(.16) ? rnd(60, 110) : 0, dir = x < 380 ? 1 : x > W - 380 ? -1 : chance(.5) ? 1 : -1;
    x = clamp(last ? clamp(W / 2 + rnd(-220, 220), x - 300, x + 300) : x + dir * rnd(140, 300), 40 + w / 2 + slide, W - 40 - w / 2 - slide);
    const main = { x: x - w / 2, h, w, check, slide, period: rnd(3, 4.5), phase: rnd(0, TAU) };
    rows.push(main);
    if (check) checks.push(main);
    for (let k = 0, n = check ? 0 : rndi(0, 2); k < n; k++) {
      const ew = rnd(110, 180), ex = rnd(40, W - 40 - ew);
      if (Math.abs(ex + ew / 2 - x) > (w + ew) / 2 + 70) rows.push({ x: ex, h: h + rnd(-30, 30), w: ew, block: chance(.2) });
    }
  }
  const top = { x: W / 2 - 180, h: tall, w: 360, top: true };
  rows.push(top);
  return { rows, checks, top, tall };
}
// A still move: the kill-cam records where scrolling put it.
function twSolid(r) {
  const y = TW_FLOOR - r.h;
  return (r.s = { x: r.x, y, w: r.w, h: r.block ? 46 : 14, oneWay: !r.block, x0: r.x, y0: y, dx: 0, dy: 0, tw: r, draw: twDrawLedge,
    move: { dx: r.slide || 0, dy: 0, period: r.period || 4, phase: r.phase || 0 } });
}
function twGear(f) { f.dmgTakenMul = TW_TAKEN; f.kbMul = (f.kbMul || 1) * TW_KB; f.ringSave = twRingSave; return f; }
function twStart(run) {
  const tw = twBuild(Math.round(TW_TALL * roundLenMul())), list = F.filter(f => !f.summon);
  Object.assign(run, { tower: tw, scroll: 0, cp: {}, best: {} });
  MAP.solids = tw.rows.map(twSolid); MAP.orbs = false;
  list.forEach((f, i) => { partyPlace(f, W / 2 + (i - (list.length - 1) / 2) * 110, TW_FLOOR); twGear(f); });
  banner('TOWER RACE', 'FIRST TO THE FLAG!', 2, '#ffd84a');
}
function twStep(run, dt) {
  if (!run.tower) return;
  twScroll(run, dt);
  if (!partyLive()) return;
  partyTickRespawns(run, dt, old => { const sp = twSpot(run, twCheckOf(run, old), old.id); twGear(partyRespawn(old, sp.x, sp.y)); });
  for (const f of F) if (f.alive && !f.summon && !G_STATE.ending) twRacer(run, f);
  if (!G_STATE.ending && G_STATE.roundT >= G_STATE.roundLimit) { const top = twLeader(run); partyEnd(top.team, 'time', 'TIME!', top.name + ' CLIMBED HIGHEST', top.color); }
}
const twCheckOf = (run, f) => run.tower.checks[run.cp[f.id] ?? -1] || null;
const twHeight = (run, f) => TW_FLOOR + run.scroll - feetY(f);
const twLeader = run => F.filter(f => !f.summon).reduce((a, f) => twHeight(run, f) > twHeight(run, a) ? f : a);
function twRacer(run, f) {
  run.best[f.id] = Math.max(run.best[f.id] || 0, twHeight(run, f));
  const cps = run.tower.checks, top = run.tower.top.s, fx = top.x + top.w / 2;
  for (let i = (run.cp[f.id] ?? -1) + 1; i < cps.length; i++) if ([8, 10].some(j => f.P[j].g && f.P[j].gs === cps[i].s)) {
    const c = chest(f);
    run.cp[f.id] = i; (cps[i].by = cps[i].by || []).push(f.color);
    float(c.x, c.y - 60, 'CHECKPOINT!', f.color, 20); ring(c.x, c.y, 60, f.color, .35, 4); sfx('chime');
  }
  const cp = twCheckOf(run, f), fy = feetY(f);
  if (fy > 930 || (cp && cp.s.y < 640 && fy > cp.s.y + 160)) return twRescue(run, f, cp);
  if (!G_STATE.ending && f.P.slice(0, 11).some(p => Math.abs(p.x - fx) < 28 && p.y > top.y - 125 && p.y < top.y + 6)) {
    partyEnd(f.team, 'flag', 'TOP OF THE TOWER!', f.name + ' WINS THE RACE', f.color); shake(12); sfx('cheer');
  }
}
function twSpot(run, cp, id) {
  const s = cp && cp.s.y < 640 ? cp.s : MAP.solids.filter(o => o.y > 150 && o.y < 640 && o.oneWay).sort((a, b) => b.y - a.y)[0];
  return s ? { x: clamp(s.x + s.w / 2 + ((id % 3) - 1) * 40, s.x + 20, s.x + s.w - 20), y: s.y, s } : { x: W / 2, y: Math.min(TW_FLOOR + run.scroll, 600) };
}
function twRescue(run, f, cp) {
  const sp = twSpot(run, cp, f.id), c = chest(f);
  partyPlace(f, sp.x, sp.y);
  f.inv = Math.max(f.inv || 0, 1); f.stagger = Math.max(f.stagger, .25);
  ring(c.x, c.y, 70, f.color, .4, 4);
  float(sp.x, sp.y - 120, cp && cp.s === sp.s ? 'CHECKPOINT' : 'BACK IN THE RACE', f.color, 18); sfx('chime', .6);
}
function twRingSave(f) { const run = modeRun(); if (run.tower) twRescue(run, f, twCheckOf(run, f)); return !!run.tower; }
// Dead-zone camera: scroll when a player passes y 170 or 600 (never below the ground).
function twScroll(run, dt) {
  const list = F.filter(f => f.alive && !f.summon), humans = list.filter(f => f.ctrl === 'human'), lead = humans.length ? humans : list;
  if (!lead.length) return;
  const top = Math.min(...lead.map(f => f.P[0].y)), low = Math.max(...lead.map(feetY));
  const want = Math.max(top < 170 ? 170 - top : low > 600 ? Math.max(600 - low, 170 - top) : 0, -run.scroll), s = clamp(want * Math.min(1, dt * 5), -14, 14);
  if (Math.abs(s) > .05) twShift(run, s);
}
// Moves the whole world (and the camera) by s px.
function twShift(run, s) {
  run.scroll += s;
  for (const f of F) {
    for (const p of f.P) { p.y += s; p.oy += s; }
    for (const o of [f.mem.grapple, f.mem.rewind, f.mem.pet, f.mount]) if (o && typeof o.y === 'number') o.y += s;
    if (f.ai.nav && typeof f.ai.nav.top === 'number') f.ai.nav.top += s;
    for (const q of f.trail) { q.y += s; q.hy += s; }
  }
  for (const p of PROJ) { p.y += s; for (let k = 1; k < p.tr.length; k += 2) p.tr[k] += s; if (typeof p.landY === 'number') p.landY += s; }
  for (const list of [MAP.solids, MAP.hazards]) for (const o of list) { o.y += s; o.y0 += s; }
  for (const list of [ORB_LIST, PARTS, FLOATS, RINGS, SHARDS]) for (const q of list) q.y += s;
  for (const q of BEAMS) { q.y1 += s; q.y2 += s; }
  if (MAP.floor != null) MAP.floor += s;
  CAM.y += s; CAM.fy += s;
}
// CPUs climb to the best ledge a jump or two up; near the top, the flag.
function twAiGoal(f) {
  const run = modeRun(), fy = feetY(f), x = f.P[2].x, flag = run.tower && run.tower.top.s;
  if (!flag) return null;
  if (flag.y > fy - 320 && flag.y < fy + 10) return { x: flag.x + flag.w / 2, y: flag.y, w: 40 };
  let best = null, bs = -Infinity;
  for (const s of MAP.solids) {
    const up = fy - s.y, cx = clamp(x, s.x + 20, s.x + s.w - 20), dx = Math.abs(cx - x), score = up * 1.2 - dx * .7;
    if (up >= 80 && up <= 320 && s.y > 40 && dx < 430 && score > bs) { bs = score; best = { x: lerp(cx, s.x + s.w / 2, .4), y: s.y, w: Math.max(40, s.w - 40) }; }
  }
  return best || { x: W / 2, y: fy, w: 200 };
}
function twDrawLedge(c, s) {
  const r = s.tw || {}, edge = r.top ? '#ffd84a' : r.check ? '#5ef2ff' : r.slide ? '#ff5ad1' : '#b98cff';
  mapRect(c, r.check ? '#173546' : '#221a3c', s.x, s.y, s.w, s.h);
  mapVGrad(c, s.x, s.y, s.w, s.h, [rgba(edge, .3), 'rgba(0,0,0,.35)']);
  glowLine(c, s.x, s.y, s.x + s.w, s.y, edge, 3);
  if (r.slide) for (const x of [s.x + 8, s.x + s.w - 8]) circle(c, x, s.y + 7, 3, edge);
}
// The sky darkens with altitude; height marks every 50 m.
function twDrawBg(c, t) {
  const run = v6Mode('tower') && c === ctx ? modeRun() : {}, sc = run.scroll || 0, k = run.tower ? clamp(sc / run.tower.tall, 0, 1) : 0;
  mapSky(c, H, [skillMixColor('#1a1446', '#05060f', k), skillMixColor('#ff9a5a', '#2a1a5e', k)]);
  mapStars(c, t, Math.round(14 + 70 * k), H * .9);
  for (let h = Math.max(500, Math.ceil((sc - 120) / 500) * 500); h < sc + 900; h += 500) modeText(c, `${h / 10} m`, 64, TW_FLOOR + sc - h, 14, 'rgba(255,216,74,.6)');
  if (MAP.floor < H + 40) mapGround(c, MAP.floor, '#1a1630', '#ffd84a', 3);
}
function twDraw(c, run) {
  if (!run.tower) return;
  for (const cp of run.tower.checks) {
    const s = cp.s, x = s.x + 24, top = s.y - 72;
    if (s.y < -80 || s.y > H + 40) continue;
    lineXY(c, x, s.y, x, top, '#c9cdee', 3);
    poly(c, [[x, top], [x + 32, top + 10], [x, top + 20]], cp.by ? cp.by[cp.by.length - 1] : 'rgba(94,242,255,.55)', '#ffffff', 1.5);
    (cp.by || []).slice(-6).forEach((col, i) => circle(c, x + 18 + i * 11, s.y - 9, 4, col, '#07080f', 1));
  }
  const top = run.tower.top.s, fx = top.x + top.w / 2, fy = top.y, wave = k => Math.sin(G_STATE.t * 6 + k) * 6;
  if (fy < -160 || fy > H + 40) return;
  lineXY(c, fx, fy, fx, fy - 122, '#ffffff', 4);
  glow(c, '#ffd84a', 18, () => poly(c, [[fx, fy - 122], [fx + 64, fy - 110 + wave(1)], [fx + 60, fy - 90 + wave(2)], [fx, fy - 78]], '#ffd84a', '#ffffff', 2));
  modeText(c, 'FINISH', fx, fy - 142, 18, '#ffd84a');
}
function twHud(c, run) {
  if (!run.tower) return;
  c.save(); setArenaTransform();
  const x = W - 32, y0 = 220, y1 = H - 70, at = h => lerp(y1, y0, clamp(h / run.tower.tall, 0, 1));
  modePanel(c, x - 17, y0 - 34, 34, y1 - y0 + 50, 'rgba(255,216,74,.5)');
  lineXY(c, x, y0, x, y1, 'rgba(255,255,255,.25)', 4);
  for (const cp of run.tower.checks) lineXY(c, x - 9, at(cp.h), x + 9, at(cp.h), '#5ef2ff', 2);
  modeText(c, '⚑', x, y0 - 16, 18, '#ffd84a');
  for (const f of F) if (!f.summon) circle(c, x, at(twHeight(run, f)), f.ctrl === 'human' ? 7 : 5, f.color, '#07080f', 2);
  c.restore();
  partyDrawRespawns(c, run, PARTY_HUD_Y);
}

// ---------- mini-games (79's defMini, registered at boot) ----------
// Spark Rush (key coinrush; no coin wording on screen since v4): grab falling sparks (purple = 3); a hit knocks one loose.
const COIN_LIFE = 5;
const coinRushMake = (x, y, vx, vy, v) => ({ x, y, vx, vy, v, t: 0, r: v > 1 ? 16 : 12, rest: false });
function coinRushStart(m) {
  Object.assign(m.data, { coins: [], next: .3 });
  v6Frame((f, phase, enter) => { if (phase === 'think' && !enter && miniLive() && MINI === m && f.alive && !f.summon) coinRushSteer(m, f); });
}
function coinRushStep(m, dt) {
  const d = m.data;
  if ((d.next -= dt) <= 0) { d.next = rnd(.21, .39); d.coins.push(coinRushMake(rnd(50, W - 50), -30, rnd(-60, 60), rnd(0, 120), chance(.12) ? 3 : 1)); }
  for (const c of d.coins) {
    c.t += dt;
    if (!c.rest) {
      c.vy += 1100 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.x < 20 || c.x > W - 20) { c.vx *= -.6; c.x = clamp(c.x, 20, W - 20); }
      const g = groundBelow(c.x, c.y - c.vy * dt - c.r);
      if (g != null && c.y + c.r > g && c.vy > 0) { c.y = g - c.r; c.vy *= -.35; c.vx *= .7; c.rest = Math.abs(c.vy) < 60; }
    }
    const f = F.find(o => o.alive && !o.summon && m.pts[o.id] != null && o.P.slice(0, 11).some(p => Math.abs(p.x - c.x) < c.r + 14 && Math.abs(p.y - c.y) < c.r + 14));
    if (!f) continue;
    c.taken = true; m.pts[f.id] += c.v;
    if (d.first == null) d.first = f.id;
    float(c.x, c.y - 20, '+' + c.v, c.v > 1 ? '#d58cff' : '#ffd84a', 16); burst(c.x, c.y, '#ffd84a', 8, 200, { life: .3 }); sfx('v6-coin', .6);
  }
  d.coins = d.coins.filter(c => !c.taken && c.t < COIN_LIFE && c.y < H + 80);
}
on('damage', (B, amt, o) => {
  const m = MINI;
  if (!m || m.over || m.def.key !== 'coinrush' || !o || !o.src || o.src === B || !(m.pts[B.id] > 0) || (B.mem.coinT || 0) > G_STATE.t || !/^(melee|proj|explode|skill)$/.test(o.kind || 'melee')) return;
  m.pts[B.id]--; B.mem.coinT = G_STATE.t + .7;
  m.data.coins.push(coinRushMake(B.P[0].x, B.P[0].y - 24, rnd(-220, 220), -460, 1));
  float(B.P[0].x, B.P[0].y - 40, '-1', '#ffd84a', 16);
});
function coinRushSteer(m, f) {
  const me = f.P[2];
  let best = null, bs = Infinity;
  for (const c of m.data.coins) { const s = Math.abs(c.x - me.x) + Math.max(0, me.y - c.y - 40) * .8 - c.v * 40; if (s < bs) { bs = s; best = c; } }
  if (!best) return;
  const dx = best.x - me.x;
  f.inp.mx = Math.abs(dx) > 14 ? Math.sign(dx) : 0;
  if (f.grounded && Math.abs(dx) < 140 && best.y < me.y - 90 && chance(.08)) f.inp.jump = true;
}
function coinRushDraw(c, m) {
  for (const k of m.data.coins) {
    const w = k.r * (.25 + .75 * Math.abs(Math.cos(G_STATE.t * 6 + k.x))), big = k.v > 1;
    c.globalAlpha = clamp(COIN_LIFE - k.t, 0, 1);
    glow(c, big ? '#d58cff' : '#ffd84a', 10, () => { c.fillStyle = big ? '#b46cff' : '#ffc93a'; c.beginPath(); c.ellipse(k.x, k.y, w, k.r, 0, 0, TAU); c.fill(); });
    circle(c, k.x - w * .3, k.y - k.r * .35, 2.5, '#ffffff');
  }
  c.globalAlpha = 1;
}

// Last Platform: tiles crumble one by one; off a tile you're out. Last one standing wins.
const LAST_TILES = 7, LAST_Y = 420, LAST_W = 128;
const lastPlatOn = (s, f) => Math.abs((f.P[8].x + f.P[10].x) / 2 - s.x - s.w / 2) < s.w / 2 + 6 && Math.abs(feetY(f) - s.y) < 30;
function lastPlatStart(m) {
  const d = m.data, gap = (W - LAST_TILES * LAST_W) / (LAST_TILES + 1), list = F.filter(f => f.alive && !f.summon);
  Object.assign(d, { tiles: [], out: {}, kos: {}, next: 2.2, bench: 0, warn: null, done: false });
  for (let k = 0; k < LAST_TILES; k++) {
    const x = gap + k * (LAST_W + gap), s = { x, y: LAST_Y, w: LAST_W, h: 16, oneWay: true, x0: x, y0: LAST_Y, dx: 0, dy: 0, lastTile: true, draw: lastPlatDrawTile };
    d.tiles.push(s);
  }
  MAP.solids = d.tiles.slice();  // the arena's own ledges sit out: only tiles and the floor
  list.forEach((f, i) => { const s = d.tiles[Math.min(LAST_TILES - 1, Math.floor((i + .5) * LAST_TILES / list.length))]; partyPlace(f, s.x + s.w / 2, s.y); });
  v6Frame((f, phase, enter) => {
    if (!miniLive() || MINI !== m || f.summon) return;
    if (d.out[f.id] != null) { if (phase === 'drive' && enter) v6Still(f); }
    else if (phase === 'think' && !enter) lastPlatSteer(d, f);
  });
}
function lastPlatStep(m, dt) {
  const d = m.data;
  if (d.warn && (d.warn.t -= dt) <= 0) {
    const s = d.warn.s;
    MAP.solids = MAP.solids.filter(o => o !== s); d.tiles = d.tiles.filter(o => o !== s); d.warn = null;
    burst(s.x + s.w / 2, s.y + 8, '#ff8a2e', 24, 320, { grav: 1 }); sfx('mapCrumble', .7); shake(4);
  } else if (!d.warn && d.tiles.length > 1 && (d.next -= dt) <= 0) {  // mostly one someone stands on
    const busy = d.tiles.filter(s => F.some(f => f.alive && d.out[f.id] == null && lastPlatOn(s, f))), s = busy.length && chance(.6) ? pick(busy) : pick(d.tiles);
    d.next = Math.max(.9, 1.9 - m.t * .06); d.warn = { s, t: .9 }; s.shake = 1; sfx('mapCrumble', .35);
  }
  for (const f of F) {
    if (!f.alive || f.summon) continue;
    if (d.out[f.id] != null) partyPlace(f, f.mem.benchX, f.mem.benchY);
    else if (d.done) continue;  // one is left: the scores are final
    else if (m.t > .3 && (feetY(f) > LAST_Y + 80 || [8, 10].some(j => f.P[j].g && !(f.P[j].gs && f.P[j].gs.lastTile)))) lastPlatOut(m, f);
    else m.pts[f.id] = Math.floor(m.t) + (d.kos[f.id] || 0);  // seconds standing + knock-offs
  }
  const left = F.filter(f => f.alive && !f.summon && d.out[f.id] == null);
  if (d.done || left.length > 1) return;
  d.done = true; m.t = Math.max(m.t, m.def.time - 1);
  for (const f of left) { m.pts[f.id] += 3; float(f.P[0].x, f.P[0].y - 50, 'LAST ONE STANDING!', f.color, 22); }
}
function lastPlatOut(m, f) {
  const d = m.data, k = recentAttacker(f), c = chest(f);
  d.out[f.id] = m.t;
  if (k && k !== f && d.out[k.id] == null) { d.kos[k.id] = (d.kos[k.id] || 0) + 1; if (d.first == null) d.first = k.id; }
  f.mem.benchX = 50 + (d.bench++ % 8) * 52; f.mem.benchY = MAP.floor ?? H - 30;
  addStatus(f, 'invis', 30);
  float(c.x, c.y - 50, 'OUT!', '#ff4a6a', 22); sfx('poof');
}
// CPUs stay over a safe tile, in the air too (momentum counts), else hop to the nearest safe one.
function lastPlatSteer(d, f) {
  const doomed = d.warn && d.warn.s, fx = (f.P[8].x + f.P[10].x) / 2, mid = s => s.x + s.w / 2, safe = d.tiles.filter(s => s !== doomed);
  const home = safe.find(s => Math.abs(fx - mid(s)) < s.w / 2 && feetY(f) < s.y + 20), ahead = fx + vx(f.P[2]) * .25 + (f.inp.mx || 0) * 24;
  f.inp.dash = 0;
  if (home) { if (Math.abs(ahead - mid(home)) > home.w / 2 - 10) f.inp.mx = Math.sign(mid(home) - fx); return; }
  const to = safe.reduce((a, s) => !a || Math.abs(mid(s) - fx) < Math.abs(mid(a) - fx) ? s : a, null);
  if (!to) return;
  f.inp.mx = Math.abs(mid(to) - fx) > 10 ? Math.sign(mid(to) - fx) : 0;
  if (f.grounded && Math.abs(mid(to) - fx) > to.w / 2) f.inp.jump = true;
  if (!f.grounded && f.airJumps > 0 && feetY(f) > LAST_Y - 10 && vy(f.P[2]) > 0) f.inp.jump = true;
}
function lastPlatDrawTile(c, s, t) {
  const warn = s.shake && miniLive(), x = s.x + (warn ? Math.sin(t * 70) * 2.5 : 0), edge = warn ? '#ff4a6a' : '#ffd84a';
  mapRect(c, warn ? '#4a1626' : '#2a2448', x, s.y, s.w, s.h);
  mapVGrad(c, x, s.y, s.w, s.h, [rgba(edge, .35), 'rgba(0,0,0,.3)']);
  glowLine(c, x, s.y, x + s.w, s.y, edge, 3);
  if (warn) for (let k = 1; k < 4; k++) lineXY(c, x + k * s.w / 4, s.y + 2, x + k * s.w / 4 + (k % 2 ? 9 : -9), s.y + s.h - 2, '#ff8a2e', 1.5);
}

// ---------- boot: mini-games, rules, lore, sounds ----------
Object.assign(V6.help, {
  volley: [
    'Attack to hit the big ball over the net: heavier weapons hit it further.',
    'A ball landing on your side scores for the other side. First to 7 (Short 5, Long 11).',
    'Jump and swing near the net to SPIKE. A fast ball bonks whoever it hits.',
    'The ring on the sand shows where the ball will land.'],
  paint: [
    'Every footstep paints the floor or ledge under you in your colour.',
    'Every hit you land splashes paint under your rival; blasts splash wide.',
    'The bar shows who covers more when the 60 s run out (Short 42, Long 96).'],
  tower: [
    'Climb to the flag at the top: first to touch it wins the race. First to 2 races wins.',
    'Knock rivals off their ledge. Pink ledges slide; solid blocks can be wall-jumped.',
    'Blue checkpoint ledges: a fall never takes you below the last one you touched.',
    'The meter on the right shows everyone\'s height.'],
});
on('boot', () => {
  defMini('coinrush', { name: 'Spark Rush', icon: '✨', how: 'Grab falling sparks! A hit knocks one loose.', time: 12, start: coinRushStart, step: coinRushStep, draw: coinRushDraw });
  defMini('lastplatform', { name: 'Last Platform', icon: '🧱', how: 'Tiles crumble one by one. Last one standing wins!', time: 16, start: lastPlatStart, step: lastPlatStep,
    draw(c, m) { for (const f of F) if (m.data.out[f.id] != null && f.alive) modeText(c, 'OUT', f.P[0].x, f.P[0].y - 34, 13, '#ff4a6a'); } });
  Object.assign(LORE_LINES.m, {
    beach: 'Where the Cloud Docks crews spend shore leave, smacking a ball over a net strung between two masts. Lumen keeps score, badly.',
    spire: 'The Wicks raise this tower ledge by ledge in one night, racing to plant a flag where the smoke of the Great Candle meets the stars.',
  });
  defSfx('v6-bump', v => { thump(230, 120, .12, .3 * v); noise(.05, 2600, .08 * v, 'highpass'); });
  defSfx('v6-spike', v => { noiseSweep(.22, 1200, 5000, .22 * v, 'bandpass'); thump(170, 50, .2, .45 * v); });
  defSfx('v6-point', v => { tone(880, 880, .12, 'square', .06 * v); tone(1175, 1175, .22, 'square', .06 * v, .12); });
  defSfx('v6-coin', v => { tone(1320, 1320, .06, 'square', .05 * v); tone(1760, 1760, .14, 'square', .05 * v, .06); });
  defSfx('v6-laser', v => { tone(170, 90, .9, 'sawtooth', .1 * v); noiseSweep(.9, 2200, 600, .1 * v, 'bandpass'); });
});
