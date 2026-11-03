// 79-progress.js: titles, the look registries in one place, secrets + cheat codes, the codex stats and lore, and the
// fighter-creator presets. v4: every look and title is free from the start (no track, XP or quests); the secret ones
// stay hidden until their code or feat is found. Saved via store: 'prog' (title, found secrets, codex stats) and
// 'presets'. Only real (non-autopilot, non-demo, non-practice) matches count toward the codex.

const TITLES = {};
[['rookie', 'Rookie'], ['brawler', 'Brawler'], ['wobbler', 'Wobble Lord'], ['neon-ninja', 'Neon Ninja'], ['pet-whisperer', 'Pet Whisperer'],
  ['untouchable', 'Untouchable'], ['taunt-master', 'Taunt Master'], ['grand-duelist', 'Grand Duelist'], ['legend', 'Living Legend'],
  ['stick-legend', 'Stick Legend'], ['retro', 'Retro Soul', 1], ['night-owl', 'Night Owl', 1]]
  .forEach(([k, name, hidden]) => defLook(TITLES, k, { name, icon: '🏷', hidden: !!hidden }));

const LOOKS = { outfit: OUTFITS, skin: WSKINS, ko: KOFX, pet: PETS, pose: POSES, title: TITLES };
// A look can be worn when it exists and isn't a secret still waiting to be found.
const lookUsable = (kind, key) => { const d = LOOKS[kind] && LOOKS[kind][key]; return !!d && !d.hidden; };

const PROG = (() => {
  const p = store.getObj('prog'), obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  return { title: typeof p.title === 'string' ? p.title : 'rookie', secrets: obj(p.secrets), codex: obj(p.codex) };
})();
let progDirty = false;   // codex K.O. counters are bumped mid-round and saved at the round's end (or by flushSaves)
function progSave() { progDirty = false; store.set('prog', PROG); }
onFlush(() => { if (progDirty) progSave(); });

// ---------- codex stats and match feats ----------
const FEAT_MATCH = { taunts: 0, done: false };   // safe taunts this match (the Show-off secret)
const progReal = () => typeof statsOn === 'function' && statsOn();
on('matchStart', () => Object.assign(FEAT_MATCH, { taunts: 0, done: false }));
on('ko', (V, K) => { if (progReal() && isRealPlayer(K) && V !== K && !V.summon) codexKo(K); });
on('tauntDone', f => { if (progReal() && isRealPlayer(f)) FEAT_MATCH.taunts++; });
on('roundEnd', winner => { if (progReal()) for (const f of F.filter(isRealPlayer)) codexRound(f, f.team === winner); });
// Once per counted match: the boss codex rows and the feats that unlock secrets.
on('matchOver', () => {
  if (!progReal() || G_STATE.cfg.autopilot || FEAT_MATCH.done) return;
  FEAT_MATCH.done = true;
  const won = !!(recordMatch() || {}).won;
  codexBoss(won);
  secretFeats(won);
});

// Codex stats per entry: [uses, wins, K.O.s]. Kinds: w weapons, s skills, c classes, m arenas, p pets, b boss nodes.
function codexBump(kind, key, slot, n = 1) {
  if (!key) return;
  const t = PROG.codex[kind] = PROG.codex[kind] || {}, row = t[key] = t[key] || [0, 0, 0];
  row[slot] += n;
  progDirty = true;
}
const codexKeys = f => [['w', f.wkey], ['c', f.clsKey], ['m', MAP && MAP.key], ['p', lookOf(f).pet], ...f.skills.filter(Boolean).map(k => ['s', k])];
function codexRound(f, won) { for (const [k, key] of codexKeys(f)) { codexBump(k, key, 0); if (won) codexBump(k, key, 1); } progSave(); }
function codexKo(f) { for (const [k, key] of codexKeys(f)) codexBump(k, key, 2); }
function codexBoss(won) {
  const node = G_STATE.mode && G_STATE.mode.key === 'campaign' && typeof CAMP_BY_ID === 'object' && CAMP_BY_ID[G_STATE.cfg.node];
  if (!node || (node.kind !== 'boss' && node.kind !== 'mini')) return;
  codexBump('b', node.id, 0); if (won) codexBump('b', node.id, 1);
  progSave();
}
const codexRow = (kind, key) => ((PROG.codex[kind] || {})[key]) || [0, 0, 0];

// ---------- secrets and cheat codes ----------
// Codes are typed on the title screen. Feats unlock during play. Found secrets show in the codex; the rest are ???.
// Finding one un-hides its reward (a hidden def stays out of every menu until then).
const SECRETS = {
  konami: { name: 'Retro Soul', code: '↑↑↓↓←→←→BA', hint: 'A very old code from very old games.', reward: 'Big Heads mutator + title',
    give() { secretShow(TITLES, 'retro'); } },
  cluck: { name: 'Rubber Chicken', code: 'CLUCK', hint: 'What does the chicken say?', reward: 'Secret weapon', give() { secretShow(WEAPONS, 'rubber-chicken'); } },
  shiny: { name: 'Prism Crown', code: 'SHINY', hint: 'Something that sparkles.', reward: 'Secret hat', give() { secretShow(HATS, 'prism'); } },
  boogie: { name: 'Disco Fever', code: 'BOOGIE', hint: 'Get down on the title screen.', reward: 'Secret K.O. effect', give() { secretShow(KOFX, 'disco'); } },
  nightowl: { name: 'Night Owl', hint: 'Finish a match in the small hours.', reward: 'Title', give() { secretShow(TITLES, 'night-owl'); } },
  showoff: { name: 'Show-off', hint: 'Taunt safely three times in one match, then win it.', reward: 'Secret outfit',
    give() { secretShow(OUTFITS, 'jester'); } },
};
function secretShow(reg, key) { if (reg[key]) reg[key].hidden = false; }
const secretFound = key => !!PROG.secrets[key];
function secretUnlock(key) {
  const s = SECRETS[key];
  if (!s || secretFound(key)) return false;
  PROG.secrets[key] = Date.now();
  s.give();
  progSave();
  if (typeof uiSfx === 'function') uiSfx('unlock');
  if (typeof toast === 'function') toast('Secret found: ' + s.name, s.reward, '🗝', '#ff5ad1');
  emit('secret', key);
  return true;
}
on('boot', () => { for (const k in PROG.secrets) if (SECRETS[k]) SECRETS[k].give(); });
function secretFeats(won) {
  const h = new Date().getHours();
  if (h < 5) secretUnlock('nightowl');
  if (won && FEAT_MATCH.taunts >= 3) secretUnlock('showoff');
}
// Title-screen typing: keeps the last keys and checks every code's ending.
const CHEAT = { buf: '' };
const CHEAT_KEYS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
function cheatKey(code) {
  const ch = CHEAT_KEYS[code] || (/^Key[A-Z]$/.test(code) ? code.slice(3) : '');
  if (!ch) return null;
  CHEAT.buf = (CHEAT.buf + ch).slice(-16);
  for (const k in SECRETS) if (SECRETS[k].code && CHEAT.buf.endsWith(SECRETS[k].code)) { CHEAT.buf = ''; return secretUnlock(k) ? k : null; }
  return null;
}
// Typed code entry (the Codex's Secrets tab, for phones with no keyboard on the title screen): feeds letters and
// arrows through the same buffer and returns the key of the code it completed (unlocking it), or null.
function cheatEnter(text) {
  const typed = [...String(text || '').toUpperCase()].filter(ch => /[A-Z↑↓←→]/.test(ch)).join('');
  if (!typed) return null;
  CHEAT.buf = (CHEAT.buf + typed).slice(-16);
  for (const k in SECRETS) if (SECRETS[k].code && CHEAT.buf.endsWith(SECRETS[k].code)) { CHEAT.buf = ''; secretUnlock(k); return k; }
  return null;
}

// The secret weapon and hat (hidden until their codes are typed).
defWeapon('rubber-chicken', {
  name: 'Rubber Chicken', cat: 'exotic', hidden: true, secret: true, order: 99, power: 1.1,   // secret: kept out of balance runs
  desc: 'Secret! A squeaky rubber chicken. Surprisingly heavy. Deeply embarrassing to lose to.',
  len: 58, mass: 1.05, dmg: 1.05, width: 9, kb: 1.2,
  ai: { range: 108, style: 'melee' },
  onHit(A, B) { if (chance(.3)) float(B.P[0].x, B.P[0].y - 30, 'SQUEAK!', '#ffe066', 16); },
  draw(ctx, f, s) {
    const k = s.k, body = s.at(s.L - 14 * k), head = s.at(s.L + 2 * k, -4 * k);
    line(ctx, s.at(-10 * k), s.at(s.L - 26 * k), '#ffd84a', 6 * k);
    hatEllipse(ctx, body.x, body.y, 16 * k, 10 * k, '#ffd84a', '#c79a1e', 1.5 * k, Math.atan2(s.uy, s.ux));
    circle(ctx, head.x, head.y, 7 * k, '#ffd84a', '#c79a1e', 1.5 * k);
    poly(ctx, [s.at(s.L + 8 * k, -6 * k), s.at(s.L + 16 * k, -3 * k), s.at(s.L + 8 * k, -1 * k)], '#ff8a2e');
    circle(ctx, s.at(s.L + 4 * k, -7 * k).x, s.at(s.L + 4 * k, -7 * k).y, 1.6 * k, '#0b0c18');
  },
});

// ============================================================================
//  79-arsenal.js: the Rift weapons (v5). The eight v3.5 weapons rebuilt on the engine's own helpers (same keys, so
//  codex stats and saved picks carry over), plus the shared bits the v5 weapons in 79-arsenal-new use.
//  Every special hit goes through damage() with kind 'melee'/'proj'/'explode' so weapon power, levels, guard, parry,
//  perfect dodges and the codex all see it. No timers outside the fixed step (meleeLater / rangedDecor / f.mem).
// ============================================================================

// ---------- shared helpers for the pack ----------
// Enemies whose chest is within r of (x, y).
function axFoesNear(f, x, y, r) {
  const out = [];
  for (const B of enemiesOf(f)) {
    if (!B.alive || B.inv > 0) continue;
    const c = chest(B), d = Math.hypot(c.x - x, c.y - y);
    if (d < r) out.push({ B, d, c });
  }
  return out;
}
// One special hit per foe per window: key names the effect, secs is how long the foe is immune to it again.
function axOnce(f, B, key, secs) {
  const m = f.mem.axOnce || (f.mem.axOnce = {}), id = key + ':' + B.id;
  if (G_STATE.t - (m[id] ?? -99) < secs) return false;
  m[id] = G_STATE.t;
  return true;
}
// Pulls B's whole body toward (x, y) with impulse `pow` px/s (tapered by distance).
function axPull(B, x, y, pow, lift = 0) {
  const c = chest(B), dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy) || 1;
  for (const p of B.P) kick(p, dx / d * pow, dy / d * pow - lift);
}
// Ground height under x (or the bottom of the screen over a pit).
const axGround = (x, y) => groundBelow(x, y) ?? H + 120;
// A weapon's links stretched to k × their rest length (chains that reach out); stores the rest length once.
function axStretch(rig, k) {
  for (const l of rig.links) {
    if (l.k && l.k < 1) continue;                     // leave the soft elbow->tip aligner alone
    if (l.axR == null) { l.axR = l.r; l.axRG = l.rG; }
    l.r = l.axR * k; l.rG = l.axRG * k;
  }
}
// A short-lived world-space visual that follows the fixed step (cleared with the round like every projectile).
const axFx = o => rangedDecor(Object.assign({ x: 0, y: 0, life: .4 }, o));

// ---------- statuses used by the Rift weapons ----------
// Phased: the next hit from anyone deals +35% (the Phase Rifle's mark). Consumed by the damage hook in 79-expansion.
defStatus('phased', { name: 'Phased', icon: '◈', color: '#b98cff', debuff: true, max: 3.5,
  draw(ctx, f) {
    const c = chest(f), r = 30 * f.scale, a = G_STATE.t * 3;
    ctx.globalAlpha = .55 + Math.sin(G_STATE.t * 14) * .2;
    for (let k = 0; k < 4; k++) {
      const b = a + k * TAU / 4;
      lineXY(ctx, c.x + Math.cos(b) * r, c.y + Math.sin(b) * r, c.x + Math.cos(b) * (r + 9), c.y + Math.sin(b) * (r + 9), '#b98cff', 3);
    }
    ctx.globalAlpha = 1;
  } });
// Gooed: stuck in Gloop. Slower and a little softer, and the goo drips.
defStatus('gooed', { name: 'Gooed', icon: '◍', color: '#9dff5a', debuff: true, max: 4, moveMul: .55, takenMul: 1.1, immunity: .3,
  draw(ctx, f) {
    const s = f.scale;
    for (const j of [8, 10, 2]) circle(ctx, f.P[j].x, f.P[j].y + 4 * s, 7 * s, rgba('#9dff5a', .55));
    if (chance(.25)) burst(f.P[8].x, f.P[8].y, '#9dff5a', 1, 40, { grav: 900, life: .4 });
  } });

// ---------- Chrono Katana: a third hit in a row stops the target's clock ----------
defWeapon('chrono-katana', {
  power: 1.02,
  name: 'Chrono Katana', cat: 'blade', order: 2.5, color: '#8cf6ff',
  desc: 'A quick, light katana with a clock in the guard. Land three cuts on the same foe within 2 s and you stop their clock: they are Time-Warped for 1.4 s and you get a burst of haste. The field needs 6 s to wind back up.',
  len: 96, mass: .8, dmg: .96, width: 4, cd: .5, arc: 'fast slash', sig: '3 hits in 2 s: Time Warp them, haste you (6 s wind-up)',
  ai: { range: 150, style: 'melee' },
  onHit(A, B, hit) {
    const n = meleeStreak(A, B, 'chronoStreak', 2);
    if (n < 3 || G_STATE.t < (A.mem.chronoReady || 0)) return;
    A.mem.chronoStreak.n = 0; A.mem.chronoReady = G_STATE.t + 6;
    addStatus(B, 'timewarp', 1.4, 1, A);
    addStatus(A, 'haste', 1.2, 1, A);
    const p = chest(B);
    ring(p.x, p.y, 80 * B.scale, '#8cf6ff', .45, 5); ring(p.x, p.y, 40 * B.scale, '#ffffff', .3, 3);
    float(p.x, p.y - 70, 'TIME STOP!', '#8cf6ff', 24);
    sfx('rift-chrono');
    if (A.ctrl === 'human' && SETTINGS.v5Slowmo !== false) slowmo(.18, .45);
  },
  draw(ctx, f, s) {
    const k = s.k, ready = G_STATE.t >= (f.mem.chronoReady || 0), n = f.mem.chronoStreak && G_STATE.t - f.mem.chronoStreak.t < 2 ? f.mem.chronoStreak.n : 0;
    meleeHandle(ctx, s, 22, '#1b2236', 6);
    for (let d = -20; d < 0; d += 6) meleeGuard(ctx, s, d, 3, '#8cf6ff', 2);
    const g = s.at(0);
    circle(ctx, g.x, g.y, 7 * k, '#1b2236', '#8cf6ff', 2 * k);                 // clock-face guard
    const a = G_STATE.t * (ready ? 2 : 9);
    lineXY(ctx, g.x, g.y, g.x + Math.cos(a) * 5 * k, g.y + Math.sin(a) * 5 * k, '#ffffff', 1.5 * k);
    meleeCurve(ctx, s, 3, s.L, 5, 4, '#dff8ff', '#ffffff');
    for (let i = 0; i < 3; i++) {                                               // streak pips along the blade
      const p = s.at(s.L * (.3 + i * .2), 0);
      circle(ctx, p.x, p.y, 2.2 * k, i < n && ready ? '#8cf6ff' : 'rgba(140,246,255,.25)');
    }
  },
});

// ---------- Graviton Maul: tap to swing, hold to charge a gravity pulse that pulls in, then blows out ----------
defWeapon('graviton', {
  power: 1.02,
  name: 'Graviton Maul', cat: 'heavy', twoHanded: true, order: 25.5, color: '#b98cff',
  desc: 'A two-handed maul with a captured singularity for a head. Tap for a heavy slam. Keep holding attack after the swing to charge the core (0.5 s); let go to fire a gravity pulse that drags nearby foes into the head, then blasts them away. The pulse recharges in 4 s.',
  len: 92, mass: 2.1, dmg: 1.18, width: 9, kb: 1.25, cd: 1, speed: .86, armor: .94, swingArmor: .45,
  arc: 'heavy slam', sig: 'hold 0.5 s: gravity pulse (pull, then blast), 4 s recharge',
  ai: { range: 150, style: 'melee',
    think(f, foe, d) { if (G_STATE.t >= (f.mem.gravReady || 0) && d < 230) f.inp.attackHeld = true; } },
  attack(f) {
    for (const j of f.main.pts.slice(1)) kick(f.P[j], -f.face * 120, -160);
    f.swingT = .55;
    meleeLater(f, .1, g => { spinAttack(g, 1.3); g.swingT = .45; });
    f.mem.gravHold = 0;
  },
  onStep(f, dt) {
    meleeLaterStep(f, dt);
    const ready = G_STATE.t >= (f.mem.gravReady || 0);
    if (f.inp.attackHeld && ready && canAct(f)) {
      f.mem.gravHold = (f.mem.gravHold || 0) + dt;
      if (f.mem.gravHold > .5 && !f.mem.gravArmed) { f.mem.gravArmed = true; sfx('rift-charge', .7); ring(f.P[f.tip].x, f.P[f.tip].y, 30, '#b98cff', .25, 3); }
      return;
    }
    if (f.mem.gravArmed && canAct(f)) gravitonPulse(f);
    f.mem.gravArmed = false; f.mem.gravHold = 0;
  },
  draw(ctx, f, s) {
    const k = s.k, armed = f.mem.gravArmed, head = s.at(s.L - 8 * k);
    meleeHandle(ctx, s, 24, '#2a2140', 7);
    line(ctx, s.at(-14 * k), s.at(s.L - 16 * k), '#4a3a6e', 6 * k);
    hatEllipse(ctx, head.x, head.y, 18 * k, 13 * k, '#241a3a', '#b98cff', 2.5 * k, Math.atan2(s.uy, s.ux) + Math.PI / 2);
    const pulse = armed ? 1 + Math.sin(G_STATE.t * 30) * .25 : 1;
    circle(ctx, head.x, head.y, 6 * k * pulse, '#05040c', armed ? '#ffffff' : '#b98cff', 2 * k);
    if (armed || G_STATE.t >= (f.mem.gravReady || 0)) {
      ctx.globalAlpha = armed ? .7 : .25;
      circle(ctx, head.x, head.y, (armed ? 22 : 15) * k, null, '#b98cff', 1.5 * k);
      ctx.globalAlpha = 1;
    }
  },
});
function gravitonPulse(f) {
  const h = f.P[f.tip], R = 230;
  f.mem.gravReady = G_STATE.t + 4; f.mem.gravArmed = false;
  for (const { B } of axFoesNear(f, h.x, h.y, R)) axPull(B, h.x, h.y, 950, 120);
  ring(h.x, h.y, R, '#b98cff', .3, 4); ring(h.x, h.y, R * .5, '#ffffff', .22, 2);
  burst(h.x, h.y, '#b98cff', 24, -380, { life: .35 });
  sfx('rift-grav'); shake(5);
  meleeLater(f, .2, g => {
    const c = g.P[g.tip];
    for (const { B, d } of axFoesNear(g, c.x, c.y, 140)) {
      const cb = chest(B), dx = cb.x - c.x, dy = cb.y - c.y, n = Math.hypot(dx, dy) || 1;
      damage(B, Math.round(13 * (1 - d / 140 * .4)), { src: g, kind: 'melee', x: cb.x, y: cb.y, nx: dx / n, ny: Math.min(-.4, dy / n), kb: 760, color: '#b98cff' });
    }
    ring(c.x, c.y, 140, '#ffffff', .25, 6); burst(c.x, c.y, '#b98cff', 30, 520);
    shake(10); sfx('rift-boom');
  });
}

// ---------- Echo Blades: every swing leaves a light echo that cuts again a beat later ----------
defWeapon('echo-blades', {
  power: .82,
  name: 'Echo Blades', cat: 'blade', offhand: 'echo-off', order: 5.5, color: '#5ef2ff',
  desc: 'Twin light blades. Every attack swings both, and a ghost of the main swing cuts the same spot 0.25 s later for a small hit. Great for catching foes who drop their guard or dash back in; weak if they simply step away.',
  len: 70, mass: .65, dmg: .74, width: 4, cd: .44, speed: 1.12,
  arc: 'double slash + delayed echo', sig: 'echo strikes the same place 0.25 s later',
  ai: { range: 118, style: 'melee' },
  attack(f) {
    spinAttack(f, .95);                                                        // swings the off-hand blade too
    const h = f.P[f.main.hand], reach = f.w.len * f.scale * 1.05;
    const ex = h.x + f.face * reach * .55, ey = h.y - 6;
    axFx({ x: ex, y: ey, life: .25, face: f.face, r: reach * .6, color: '#5ef2ff',
      draw(ctx, p) {
        const a = p.t / p.life;
        ctx.globalAlpha = .25 + a * .45;
        ctx.strokeStyle = '#5ef2ff'; ctx.lineWidth = 3 + a * 4; ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, p.face > 0 ? -1.3 : Math.PI - .8, p.face > 0 ? .8 : Math.PI + 1.3); ctx.stroke();
        ctx.globalAlpha = 1;
      },
      onExpire(p) {
        if (!f.alive) return;
        for (const { B, c } of axFoesNear(f, p.x, p.y, p.r + 18)) {
          if (!axOnce(f, B, 'echo', .2)) continue;
          damage(B, 5, { src: f, kind: 'melee', x: c.x, y: c.y, nx: p.face * .8, ny: -.35, kb: 300, color: '#5ef2ff' });
        }
        ring(p.x, p.y, p.r, '#ffffff', .15, 2);
        sfx('rift-echo', .6);
      } });
  },
  onStep(f, dt) { meleeLaterStep(f, dt); },
  draw(ctx, f, s) { echoBladeDraw(ctx, s); },
});
defWeapon('echo-off', {
  name: 'Echo Off-hand', cat: 'blade', hidden: true, desc: 'Off-hand light blade.',
  len: 62, mass: .55, dmg: .62, width: 4, color: '#5ef2ff',
  draw(ctx, f, s) { echoBladeDraw(ctx, s); },
});
function echoBladeDraw(ctx, s) {
  const k = s.k;
  meleeHandle(ctx, s, 10, '#16233a', 5);
  meleeGuard(ctx, s, 0, 7, '#5ef2ff', 3);
  ctx.globalAlpha = .35; line(ctx, s.at(2 * k), s.t, '#5ef2ff', 9 * k); ctx.globalAlpha = 1;
  line(ctx, s.at(2 * k), s.t, '#bffbff', 4 * k);
  line(ctx, s.at(2 * k), s.t, '#ffffff', 1.5 * k);
}

// ---------- Thornvine: a living whip that grows while you keep moving ----------
defWeapon('thornvine', {
  power: 1.12,
  name: 'Thornvine', cat: 'chain', order: 42.5, color: '#7dff6a',
  desc: 'A living vine whip. It grows up to 40% longer while you keep moving and shrinks back when you stand still. A full-speed lash of the thorned tip poisons; a lash at full growth also roots the foe for a moment.',
  len: 128, mass: .4, dmg: .66, width: 5, chain: 5, cd: .5, kb: .75,
  arc: 'long lash', sig: 'grows while moving; tip poisons, full growth roots',
  ai: { range: 190, style: 'melee' },
  onStep(f, dt) {
    for (const j of f.main.pts.slice(1)) f.P[j].fy -= PHYS.gravity * .8;    // light like the whip, so it can't anchor
    const moving = Math.abs(vx(f.P[2])) > 160;
    f.mem.vineGrow = clamp((f.mem.vineGrow || 0) + (moving ? dt / 1.6 : -dt / 1.1), 0, 1);
    axStretch(f.main, 1 + .4 * f.mem.vineGrow);
  },
  onHit(A, B, hit) {
    if (hit.rel < 1200) return;
    meleeProc(B, .6, 'poison', 2.4, .7, A, 'THORNED', '#7dff6a');
    if (A.mem.vineGrow > .95 && axOnce(A, B, 'root', 3)) {
      addStatus(B, 'pinned', .6, 1, A);
      float(B.P[0].x, B.P[0].y - 60, 'ROOTED!', '#7dff6a', 22);
      sfx('rift-vine');
    }
  },
  draw(ctx, f, s) {
    const k = s.k, pts = s.pts, g = f.mem.vineGrow || 0;
    line(ctx, s.at(-14 * k), s.h, '#3b2a14', 7 * k);
    ctx.strokeStyle = '#3f9a2a'; ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      ctx.lineWidth = (6 - i * .7) * k; ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      const m = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
      circle(ctx, m.x + 3 * k, m.y - 3 * k, 2.6 * k * (.6 + g * .6), '#7dff6a');      // leaves fill out as it grows
      lineXY(ctx, m.x, m.y, m.x - 4 * k, m.y + 4 * k, '#c9ff9a', 1.2 * k);            // thorns
    }
    circle(ctx, s.t.x, s.t.y, (3 + g * 2) * k, g > .95 ? '#ff5ad1' : '#7dff6a');      // the bud blooms at full growth
  },
});

// ---------- Phase Rifle: shots slip through platforms and mark the target ----------
defWeapon('phase-rifle', {
  power: .96,
  name: 'Phase Rifle', cat: 'ranged', order: 14.5, color: '#b98cff', twoHanded: true,
  desc: 'An experimental rifle whose bolts phase through floors and platforms, so cover will not save anyone. A hit Phases the target for 3.5 s: the next hit they take from anyone deals +35%.',
  len: 58, mass: 1, dmg: .3, width: 5, bodyRecoil: 150,
  arc: 'phasing bolt', sig: 'ignores platforms; hit marks: next hit +35%',
  ranged: { cooldown: .62, ammo: 4, reload: 2, speed: 2000, spread: .012, recoil: 200, sfx: 'rift-phase',
    proj: rangedProj({ dmg: 8, r: 5, life: 1.05, kb: 160, solid: false,
      onHit(p, B) { addStatus(B, 'phased', 3.5, 1, p.owner); },
      draw(ctx, p) {
        ctx.globalAlpha = .45; lineXY(ctx, p.x, p.y, p.x - p.vx * .02, p.y - p.vy * .02, '#b98cff', 9); ctx.globalAlpha = 1;
        lineXY(ctx, p.x, p.y, p.x - p.vx * .012, p.y - p.vy * .012, '#ffffff', 3);
      } }) },
  ai: { range: 520, style: 'ranged' },
  draw(ctx, f, s) {
    const k = s.k;
    line(ctx, s.at(-12 * k), s.at(s.L - 4 * k), '#2a2140', 9 * k);
    line(ctx, s.at(6 * k), s.at(s.L), '#b98cff', 3 * k);
    for (let i = 0; i < 3; i++) { const p = s.at((16 + i * 12) * k, -6 * k); circle(ctx, p.x, p.y, 2.3 * k, i < f.ammo - 1 ? '#ffffff' : '#4a3a6e'); }
  },
});

// ---------- Meteor Flail: hold to fire the head's thruster, release to slam with fire ----------
defWeapon('meteor-flail', {
  power: 1.05,
  name: 'Meteor Flail', cat: 'chain', order: 44.5, color: '#ff8a2e',
  desc: 'A flail whose head is a little rocket. Hold attack to light the thruster: the head drives out ahead of you and heats up over 1 s. While it is hot, the first hit it lands bursts in fire (burn + small blast). The thruster then needs 3 s to cool.',
  len: 86, mass: 1.55, dmg: 1.02, width: 8, chain: 3, kb: 1.2, cd: .7,
  arc: 'wild flail; rocket drive', sig: 'hold: thruster drive; hot hit bursts in fire',
  ai: { range: 165, style: 'melee',
    think(f, foe, d) { if (d < 300 && G_STATE.t >= (f.mem.meteorCool || 0)) f.inp.attackHeld = chance(.9); } },
  onStep(f, dt) {
    const cool = G_STATE.t < (f.mem.meteorCool || 0);
    if (f.inp.attackHeld && !cool && canAct(f)) {
      f.mem.meteorHeat = Math.min(1, (f.mem.meteorHeat || 0) + dt);
      const tip = f.P[f.tip], u = meleeAim(f);
      kick(tip, u.x * 3200 * dt, (u.y - .25) * 3200 * dt);
      if (chance(.7)) burst(tip.x - u.x * 10, tip.y - u.y * 10, chance(.5) ? '#ff8a2e' : '#ffd84a', 1, 160, { life: .3 });
      f.mem.meteorLit = true;
      if (f.mem.meteorHeat >= 1) { f.mem.meteorCool = G_STATE.t + 3; f.mem.meteorHot = G_STATE.t + 1.1; }
      return;
    }
    if (f.mem.meteorLit) {
      f.mem.meteorLit = false;
      if ((f.mem.meteorHeat || 0) > .5) { f.mem.meteorHot = G_STATE.t + .8; f.mem.meteorCool = G_STATE.t + 3; }
      f.mem.meteorHeat = 0;
    }
  },
  onHit(A, B, hit) {
    if (G_STATE.t > (A.mem.meteorHot || 0)) return;
    A.mem.meteorHot = 0;
    addStatus(B, 'burn', 2, 1, A);
    explode(hit.x, hit.y, 70, 7, A, { color: '#ff8a2e', kb: 420 });
    float(hit.x, hit.y - 40, 'METEOR!', '#ff8a2e', 22);
  },
  draw(ctx, f, s) {
    const chain = s.pts.slice(1), t = s.t, k = s.k, hot = G_STATE.t < (f.mem.meteorHot || 0) || f.mem.meteorLit;
    line(ctx, s.at(-12 * k), chain[0], '#4a3326', 6 * k);
    meleeChain(ctx, s, chain[0], '#c4cad8', 3);
    if (hot) { ctx.globalAlpha = .4; circle(ctx, t.x, t.y, 20 * k, '#ff8a2e'); ctx.globalAlpha = 1; }
    circle(ctx, t.x, t.y, 11 * k, hot ? '#ffb15c' : '#6b4a3a', '#ff8a2e', 2 * k);
    for (let i = 0; i < 5; i++) { const a = i * 1.257 + f.phase * .1; circle(ctx, t.x + Math.cos(a) * 6 * k, t.y + Math.sin(a) * 6 * k, 2 * k, hot ? '#fff1c1' : '#ff8a2e'); }
  },
});

// ---------- Prism Cannon: a white bolt that splits into three coloured shards ----------
const PRISM_SHARDS = [
  { c: '#ff5c48', status: 'burn', secs: 1.6, label: 'RUBY' },
  { c: '#5ef2ff', status: 'slow', secs: 1.4, label: 'SAPPHIRE' },
  { c: '#7dff6a', status: 'poison', secs: 2, label: 'EMERALD' },
];
defWeapon('prism-cannon', {
  power: 1.2,
  name: 'Prism Cannon', cat: 'magic', order: 33.5, color: '#f4f4ff', twoHanded: true,
  desc: 'Fires a white bolt that splits into three shards after a short flight: ruby burns, sapphire slows, emerald poisons. Up close the shards stay together; at the sweet spot (one split away) all three can strike one foe for a PRISM bonus.',
  len: 62, mass: 1.2, dmg: .3, width: 6,
  arc: 'splitting bolt', sig: 'splits into burn / slow / poison shards; all three = PRISM bonus',
  ranged: { cooldown: .9, ammo: 3, reload: 2.5, speed: 1500, spread: .03, recoil: 150, sfx: 'rift-prism',
    proj: rangedProj({ dmg: 5, r: 6, life: .9, kb: 120,
      onStep(p) {
        if (p.split || p.t < .14) return;
        p.split = true; p.dead = true;
        const sp = Math.hypot(p.vx, p.vy), a0 = Math.atan2(p.vy, p.vx);
        PRISM_SHARDS.forEach((sh, i) => spawnProj({ owner: p.owner, team: p.team, x: p.x, y: p.y,
          vx: Math.cos(a0 + (i - 1) * .1) * sp, vy: Math.sin(a0 + (i - 1) * .1) * sp, r: 5, dmg: 4.5, kb: 140, life: .7,
          color: sh.c, trail: true, shard: sh,
          onHit(q, B) {
            addStatus(B, sh.status, sh.secs, 1, q.owner);
            const m = q.owner && (q.owner.mem.prism || (q.owner.mem.prism = {}));
            if (!m) return;
            const r = m[B.id] && G_STATE.t - m[B.id].t < .35 ? m[B.id] : (m[B.id] = { t: G_STATE.t, set: {} });
            r.set[sh.label] = 1;
            if (Object.keys(r.set).length === 3) {
              r.set = {};
              damage(B, 7, { src: q.owner, kind: 'proj', x: chest(B).x, y: chest(B).y, nx: Math.sign(q.vx), ny: -.4, kb: 300, color: '#ffffff' });
              float(B.P[0].x, B.P[0].y - 60, 'PRISM!', '#ffffff', 26);
              ring(chest(B).x, chest(B).y, 50, '#ffffff', .3, 4);
            }
          } }));
        burst(p.x, p.y, '#ffffff', 10, 220, { life: .2 });
      },
      draw(ctx, p) { circle(ctx, p.x, p.y, 7, '#ffffff'); ctx.globalAlpha = .4; circle(ctx, p.x, p.y, 12, '#ffffff'); ctx.globalAlpha = 1; } }) },
  ai: { range: 340, style: 'ranged' },
  draw(ctx, f, s) {
    const k = s.k, m = s.at(s.L - 10 * k);
    line(ctx, s.at(-10 * k), s.at(s.L - 14 * k), '#2c2d44', 10 * k);
    poly(ctx, [s.at(s.L - 22 * k, -9 * k), s.at(s.L, 0), s.at(s.L - 22 * k, 9 * k)], 'rgba(255,255,255,.85)');
    PRISM_SHARDS.forEach((sh, i) => { const p = s.at((8 + i * 9) * k, 7 * k); circle(ctx, p.x, p.y, 2.4 * k, sh.c); });
    circle(ctx, m.x, m.y, 2 * k, '#ffffff');
  },
});

// ---------- Singularity Gauntlets: every third punch drops a tiny black hole ----------
defWeapon('singularity', {
  power: 0.88,
  name: 'Singularity Gauntlets', cat: 'fist', offhand: 'singularity-off', order: 51.5, color: '#a98cff',
  desc: 'Heavy gauntlets around two caged black holes. Fast alternating punches; every third punch leaves a micro-singularity in the air that drags foes toward it for 0.7 s, then pops for a small hit. Use it to drag a foe back into range or off a ledge.',
  len: 26, mass: 1.15, dmg: .74, width: 12, kb: 1.25, lift: .55, cd: .38, speed: 1.04,
  arc: 'alternating jabs', sig: 'every 3rd punch: micro-singularity (pull, then pop)',
  ai: { range: 90, style: 'melee' },
  attack(f) {
    f.mem.singJab = !f.mem.singJab;
    const rig = f.mem.singJab || !f.off ? f.main : f.off;
    meleeThrust(f, 1.08, rig);
    f.mem.singN = ((f.mem.singN || 0) + 1) % 3;
    if (f.mem.singN) return;
    const t = f.P[rig.tip], x = t.x + f.face * 34, y = t.y - 6;
    sfx('rift-grav', .5);
    axFx({ x, y, life: .7, owner: f,
      onStep(p, dt) {
        for (const { B, d } of axFoesNear(f, p.x, p.y, 170)) axPull(B, p.x, p.y, 1500 * dt * (1 - d / 220));
        if (chance(.6)) burst(p.x + rnd(-40, 40), p.y + rnd(-40, 40), '#a98cff', 1, -120, { life: .25 });
      },
      draw(ctx, p) {
        const a = p.t / p.life, r = 10 + a * 6;
        ctx.globalAlpha = .35; circle(ctx, p.x, p.y, r * 3, null, '#a98cff', 2); ctx.globalAlpha = 1;
        circle(ctx, p.x, p.y, r, '#05040c', '#d6c8ff', 2);
      },
      onExpire(p) {
        if (!f.alive) return;
        for (const { B, c } of axFoesNear(f, p.x, p.y, 70)) damage(B, 6, { src: f, kind: 'melee', x: c.x, y: c.y, nx: Math.sign(c.x - p.x) || 1, ny: -.6, kb: 360, color: '#a98cff' });
        ring(p.x, p.y, 70, '#a98cff', .25, 4); burst(p.x, p.y, '#ffffff', 12, 300);
        sfx('rift-pop');
      } });
  },
  onHit() { sfx('punch'); },
  draw(ctx, f, s) { singGloveDraw(ctx, f, s); },
});
defWeapon('singularity-off', {
  name: 'Singularity Off-hand', hidden: true, cat: 'fist', desc: 'Off-hand gauntlet.',
  len: 26, mass: 1.15, dmg: .74, width: 12, kb: 1.25, lift: .55, color: '#a98cff',
  onHit() { sfx('punch'); },
  draw(ctx, f, s) { singGloveDraw(ctx, f, s); },
});
function singGloveDraw(ctx, f, s) {
  const k = s.k, t = s.t, ready = (f.mem.singN || 0) === 2;
  line(ctx, s.h, s.at(s.L * .5), '#2a2140', 9 * k);
  circle(ctx, t.x, t.y, 11 * k, '#1a1430', '#a98cff', 2.5 * k);
  circle(ctx, t.x, t.y, (ready ? 5 + Math.sin(G_STATE.t * 20) : 4) * k, '#05040c', ready ? '#ffffff' : '#d6c8ff', 1.5 * k);
}

// ---------- the v5 weapons: ten new ones, each built around one tactical idea ----------

// ---------- Aegis Tower (shield): the anti-zoner wall; its attack is a guard-breaking charge ----------
defWeapon('aegis-tower', {
  power: 0.88,
  name: 'Aegis Tower', cat: 'shield', order: 60, color: '#7fd8ff', tier: 'epic',
  desc: 'A full-height tower shield. It turns most shots that touch it, and blocking with it is superb (a third of the chip and stamina, a wide parry window). Attack charges forward behind it: the bash staggers and tears through a raised guard. Slow, short and light on damage.',
  len: 52, mass: 2, dmg: .62, width: 16, block: .9, guard: .35, kb: 1.5, cd: 1, speed: .82, armor: .9,
  arc: 'shield charge', sig: 'turns shots; charge bash staggers and breaks guards',
  ai: { range: 120, style: 'melee',
    think(f, foe, d) {
      if (foe.w.ranged && d > 170 && f.stamina > 30) f.inp.blockHeld = true;   // walk shots down behind the wall
      if (foe.blocking && d < 170 && f.atkCd <= 0) f.inp.attack = true;          // the bash is the answer to a turtle
    } },
  attack(f) {
    const dir = f.face;
    for (let j = 0; j < 11; j++) kick(f.P[j], dir * (f.grounded ? 760 : 420), j < 3 ? -40 : 0);
    for (const j of f.main.pts.slice(1)) kick(f.P[j], dir * 600, 0);
    f.mem.bash = { t: .32, hit: [] };
    f.swingT = .32;
    sfx('rift-bash', .6);
  },
  onStep(f, dt) {
    const b = f.mem.bash;
    if (!b) return;
    if ((b.t -= dt) <= 0 || !f.alive) { f.mem.bash = null; return; }
    const c = chest(f);
    for (const { B, c: cb } of axFoesNear(f, c.x + f.face * 46 * f.scale, c.y, 62 * f.scale)) {
      if (b.hit.includes(B.id) || (cb.x - c.x) * f.face < -10) continue;
      b.hit.push(B.id);
      const guarded = B.blocking && guardFront(B, f, { nx: f.face, ny: 0 });
      if (guarded) {
        B.stamina -= 48; B.staminaCd = BLOCK.regenDelay;
        float(cb.x, cb.y - 70, 'GUARD CRUSH', '#7fd8ff', 22);
      }
      damage(B, 8, { src: f, kind: 'melee', x: cb.x, y: cb.y, nx: f.face, ny: -.35, kb: 980, color: '#7fd8ff' });
      if (guarded && B.stamina <= 0 && !B.status.stun) guardBreak(B);
      B.stagger = Math.max(B.stagger, .5);
      ring(cb.x, cb.y, 42, '#7fd8ff', .22, 4);
      sfx('rift-bash');
      shake(7);
    }
  },
  draw(ctx, f, s) {
    const k = s.k, a = s.at(-16 * k), b = s.at(s.L + 4 * k), w = 15 * k;
    const quad = [s.at(-16 * k, -w), s.at(s.L + 4 * k, -w), s.at(s.L + 4 * k, w), s.at(-16 * k, w)];
    poly(ctx, quad, '#1a2f4a');
    ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 3 * k; ctx.beginPath();
    quad.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
    line(ctx, a, b, rgba('#7fd8ff', .5), 2 * k);                                    // spine
    const boss = s.at(s.L * .42);
    circle(ctx, boss.x, boss.y, 6 * k, '#cfefff', '#7fd8ff', 2 * k);
    for (const d of [.12, .78]) line(ctx, s.at(s.L * d, -w * .8), s.at(s.L * d, w * .8), rgba('#7fd8ff', .45), 1.5 * k);
    if (f.mem.bash) { ctx.globalAlpha = .45; line(ctx, s.at(s.L + 8 * k, -w), s.at(s.L + 8 * k, w), '#ffffff', 4 * k); ctx.globalAlpha = 1; }
  },
});

// ---------- Tidebreaker Anchor (heavy): a ground cleaver that turns into a meteor from the air ----------
defWeapon('anchor', {
  power: 1.04,
  name: 'Tidebreaker Anchor', cat: 'heavy', twoHanded: true, order: 26, color: '#5fb0ff', tier: 'epic',
  desc: 'A ship\'s anchor on a short haft. On the ground: a slow, heavy heave. In the air (well above the floor): Anchor Drop, a straight plunge that skewers whoever is underneath and cracks the floor in a wide shockwave on landing. You sit still for a moment after a drop, so a whiff is punishable.',
  len: 98, mass: 2.5, dmg: 1.16, width: 10, kb: 1.45, cd: 1.05, speed: .8, armor: .95, swingArmor: .5,
  arc: 'heave; aerial plunge', sig: 'in the air: Anchor Drop (plunge + shockwave)',
  ai: { range: 150, style: 'melee',
    think(f, foe, d) {
      const dx = Math.abs(foe.P[2].x - f.P[2].x), below = foe.P[2].y - f.P[2].y;
      if (!f.grounded && dx < 110 && below > 60 && f.atkCd <= 0) f.inp.attack = true;     // drop on them
      if (f.grounded && d < 220 && d > 120 && f.jumpCd <= 0 && f.atkCd <= 0 && chance(.008)) f.inp.jump = true;
    } },
  attack(f) {
    const gy = axGround(f.P[2].x, feetY(f) - 4);
    if (!f.grounded && gy - feetY(f) > 80 && !f.mem.drop) {
      f.mem.drop = { t: 0, hit: [] };
      for (const p of f.P) p.oy = p.y - 1650 * DT;
      for (const j of f.main.pts.slice(1)) kick(f.P[j], 0, 1400);
      f.swingT = .6;
      sfx('rift-whistle', .7);
      return;
    }
    for (const j of f.main.pts.slice(1)) kick(f.P[j], -f.face * 150, -200);
    f.swingT = .62;
    meleeLater(f, .12, g => { spinAttack(g, 1.32); g.swingT = .5; });
  },
  onStep(f, dt) {
    meleeLaterStep(f, dt);
    const d = f.mem.drop;
    if (!d) return;
    d.t += dt;
    const t = f.P[f.tip];
    if (chance(.8)) burst(t.x, t.y - 20, '#5fb0ff', 1, 120, { life: .25 });
    for (const { B, c } of axFoesNear(f, t.x, t.y, 34 * f.scale)) {
      if (d.hit.includes(B.id)) continue;
      d.hit.push(B.id);
      damage(B, 17, { src: f, kind: 'melee', x: c.x, y: c.y, nx: Math.sign(c.x - t.x) * .3, ny: .9, kb: 520, color: '#5fb0ff' });
      float(c.x, c.y - 60, 'KEELHAULED!', '#5fb0ff', 24);
    }
    if (!f.alive || d.t > 1.4) { f.mem.drop = null; return; }
    if (f.grounded && d.t > .05) {
      f.mem.drop = null;
      const x = f.P[2].x, gy = feetY(f);
      meleeShockwave(f, x, gy, 128, 12);
      burst(x, gy, '#5fb0ff', 20, 380, { grav: 1200 });
      ring(x, gy, 70, '#ffffff', .3, 5);
      shake(12); hitstop(.04);
      sfx('rift-anchor');
      f.stagger = Math.max(f.stagger, .32); f.atkCd = Math.max(f.atkCd, .45);   // landing lag: the honest cost
    }
  },
  draw(ctx, f, s) {
    const k = s.k, head = s.at(s.L - 6 * k);
    line(ctx, s.at(-14 * k), s.at(s.L - 4 * k), '#3b4a60', 7 * k);
    line(ctx, s.at(-14 * k), s.at(s.L - 4 * k), '#7f93b0', 3 * k);
    circle(ctx, s.at(-18 * k).x, s.at(-18 * k).y, 6 * k, null, '#9fb3d0', 3 * k);       // shackle ring
    line(ctx, s.at(s.L * .3, -14 * k), s.at(s.L * .3, 14 * k), '#9fb3d0', 5 * k);        // stock
    ctx.strokeStyle = '#9fb3d0'; ctx.lineWidth = 6 * k; ctx.lineCap = 'round'; ctx.beginPath();
    const l = s.at(s.L - 20 * k, -22 * k), c = s.at(s.L + 10 * k, 0), r = s.at(s.L - 20 * k, 22 * k);
    ctx.moveTo(l.x, l.y); ctx.quadraticCurveTo(c.x, c.y, r.x, r.y); ctx.stroke();
    for (const side of [-1, 1]) poly(ctx, [s.at(s.L - 20 * k, side * 22 * k), s.at(s.L - 32 * k, side * 30 * k), s.at(s.L - 12 * k, side * 28 * k)], '#cfe0f5');
    circle(ctx, head.x, head.y, 3 * k, '#5fb0ff');
    if (f.mem.drop) { ctx.globalAlpha = .5; for (const o of [-14, 0, 14]) lineXY(ctx, s.t.x + o, s.t.y - 40, s.t.x + o, s.t.y - 120, '#5fb0ff', 3); ctx.globalAlpha = 1; }
  },
});

// ---------- Moonreach Naginata (polearm): alternates a high crescent and a low reaping sweep that trips ----------
defWeapon('naginata', {
  power: 1.25,
  name: 'Moonreach Naginata', cat: 'polearm', order: 36, color: '#ffd27a', tier: 'rare',
  desc: 'A long curved glaive. Attacks alternate: a high crescent cut, then a low reaping sweep along the floor that trips a grounded foe off their feet. The blade glows gold when the sweep is next, so both players can read it. Poor up close against someone in the air.',
  len: 146, mass: 1.15, dmg: .88, width: 5, cd: .64, kb: 1,
  arc: 'high crescent / low sweep', sig: 'every 2nd attack: low sweep trips grounded foes',
  ai: { range: 196, style: 'melee',
    think(f, foe) { if (f.mem.nagiNext && !foe.grounded) f.inp.attack = false; } },   // don't waste the sweep on a jumper
  attack(f) {
    const sweep = !!f.mem.nagiNext;
    f.mem.nagiNext = !sweep;
    if (!sweep) { spinAttack(f, 1.05); return; }
    const pts = f.main.pts.slice(1);
    pts.forEach((j, i) => kick(f.P[j], f.face * (900 + i * 400), 650 + i * 150));
    kick(f.P[0], -f.face * 60, 120); kick(f.P[1], -f.face * 30, 80);
    for (const j of [0, 1, 2]) kick(f.P[j], f.face * 200, 0);
    f.mem.sweepT = G_STATE.t + .32;
    f.swingT = .32;
    sfx('rift-sweep', .8);
  },
  onHit(A, B, hit) {
    if (G_STATE.t > (A.mem.sweepT || 0) || !B.grounded || B.mount || !axOnce(A, B, 'trip', 1.2)) return;
    for (const j of [7, 8, 9, 10]) kick(B.P[j], A.face * 820, -160);
    kick(B.P[0], -A.face * 260, 0);
    tumbleKick(B, -A.face, .8);
    B.stagger = Math.max(B.stagger, .6);
    float(B.P[0].x, B.P[0].y - 50, 'SWEPT!', '#ffd27a', 24);
    burst(hit.x, hit.y, '#ffd27a', 12, 300);
  },
  draw(ctx, f, s) {
    const k = s.k, gold = !!f.mem.nagiNext;
    meleeHandle(ctx, s, 20, '#2b1d16', 5);
    line(ctx, s.at(-20 * k), s.at(s.L - 34 * k), '#5a3b26', 5 * k);
    for (let d = 10; d < s.L - 40 * k; d += 22 * k) meleeGuard(ctx, s, d, 3, '#c9a46a', 1.5);   // shaft wraps
    meleeGuard(ctx, s, s.L - 34 * k, 6, '#c9b37a', 4);
    const tip = s.t, base = s.at(s.L - 34 * k), bow = s.at(s.L - 12 * k, -12 * k * s.face);
    ctx.fillStyle = gold ? '#ffe7b0' : '#dfe6ff'; ctx.beginPath(); ctx.moveTo(base.x, base.y);
    ctx.quadraticCurveTo(bow.x, bow.y, tip.x, tip.y);
    const back = s.at(s.L - 26 * k, 4 * k * s.face); ctx.quadraticCurveTo(back.x, back.y, base.x, base.y); ctx.fill();
    if (gold) { ctx.globalAlpha = .35 + Math.sin(G_STATE.t * 10) * .15; circle(ctx, tip.x, tip.y, 9 * k, '#ffd27a'); ctx.globalAlpha = 1; }
  },
});

// ---------- Grapnel Chain (chain): a hookshot that drags foes in, or you up to a ledge ----------
defWeapon('grapnel', {
  power: 1.1,
  name: 'Grapnel Chain', cat: 'chain', order: 45, color: '#c9d4ff', tier: 'rare',
  desc: 'A grappling hook on a chain. Attack flings the hook out to over twice its length: hooking a foe yanks them in toward you (great for pulling snipers off perches or dragging foes over a ledge); hooking the floor or a platform while you are airborne zips you to it. Weak hits and a long recovery if it misses.',
  len: 82, mass: .85, dmg: .66, width: 6, chain: 4, cd: 1.05, kb: .8,
  arc: 'hookshot', sig: 'hook: yank a foe in, or zip to a surface',
  ai: { range: 300, style: 'melee' },
  attack(f) {
    axStretch(f.main, 2.6);
    const u = meleeAim(f), pts = f.main.pts.slice(1);
    pts.forEach((j, i) => kick(f.P[j], u.x * (1200 + i * 500), u.y * (1200 + i * 500) - 240));
    f.mem.hook = { t: 0, done: false };
    f.swingT = .3;
    sfx('rift-hook', .8);
  },
  onStep(f, dt) {
    const h = f.mem.hook;
    if (!h) return;
    h.t += dt;
    if (!h.done && h.t > .06) {
      const t = f.P[f.tip];
      for (const { B, c } of axFoesNear(f, t.x, t.y, 34 * f.scale)) {
        h.done = true;
        const me = chest(f);
        damage(B, 6, { src: f, kind: 'melee', x: c.x, y: c.y, nx: Math.sign(me.x - c.x), ny: -.3, kb: 0, color: '#c9d4ff' });
        axPull(B, me.x, me.y - 30, 1250, 260);
        B.stagger = Math.max(B.stagger, .4);
        float(c.x, c.y - 60, 'HOOKED!', '#c9d4ff', 24);
        sfx('rift-hook-hit');
        break;
      }
      if (!h.done && !f.grounded && h.t > .12 && (t.g || solidAt(t.x, t.y + 4))) {
        h.done = true;
        axPull(f, t.x, t.y - 40, 1300, 260);
        float(t.x, t.y - 30, 'ZIP!', '#c9d4ff', 20);
        burst(t.x, t.y, '#c9d4ff', 10, 240);
        sfx('rift-hook-hit', .7);
      }
    }
    if (h.t > (h.done ? .2 : .45)) { axStretch(f.main, 1); f.mem.hook = null; }
  },
  draw(ctx, f, s) {
    const k = s.k, t = s.t, d = meleeChainDir(s);
    line(ctx, s.at(-12 * k), s.h, '#3a3f58', 6 * k);
    meleeChain(ctx, s, s.h, '#c9d4ff', 2.5);
    for (const side of [-1, 0, 1]) {
      const a = Math.atan2(d.y, d.x) + side * 1.1;
      ctx.strokeStyle = '#e6ecff'; ctx.lineWidth = 3 * k; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.quadraticCurveTo(t.x + Math.cos(a) * 12 * k, t.y + Math.sin(a) * 12 * k, t.x + Math.cos(a + side * .9) * 14 * k, t.y + Math.sin(a + side * .9) * 14 * k);
      ctx.stroke();
    }
    circle(ctx, t.x, t.y, 3.5 * k, '#ffffff');
  },
});

// ---------- Kickback Gauntlet (fist): point-blank air blasts that shove you the other way ----------
defWeapon('kickback', {
  power: 1.25,
  name: 'Kickback Gauntlet', cat: 'fist', order: 52, color: '#ff9a5a', tier: 'rare',
  desc: 'A piston gauntlet. Every punch fires a short cone of compressed air (a small hit with big push) and the recoil shoves you the other way. In the air with nobody close, it blasts straight down and launches you up: two recovery blasts per jump. A mobility weapon that saves you from ring-outs; short and light on damage.',
  len: 28, mass: 1.25, dmg: .62, width: 13, kb: 1.15, lift: .5, cd: .44, speed: 1.02,
  arc: 'piston punch + air cone', sig: 'air-blast punches; in the air, blasts down to recover (×2)',
  ai: { range: 110, style: 'melee',
    think(f, foe) {
      if (f.grounded) return;
      const g = groundBelow(f.P[2].x, feetY(f));
      if ((g == null || g - feetY(f) > 260) && vy(f.P[2]) > 200 && (f.mem.kbAir || 0) < 2 && f.atkCd <= 0) f.inp.attack = true;   // recover
    } },
  attack(f) {
    if (f.grounded) f.mem.kbAir = 0;
    const foe = nearestEnemy(f, true), c = chest(f);
    const close = foe && Math.hypot(chest(foe).x - c.x, chest(foe).y - c.y) < 190;
    let u = meleeAim(f);
    if (!f.grounded && !close) {
      if ((f.mem.kbAir || 0) >= 2) { meleeThrust(f, .9); return; }
      u = { x: f.face * .15, y: .99 };
    }
    meleeThrust(f, 1, f.main);
    const t = f.P[f.tip], ox = t.x + u.x * 14, oy = t.y + u.y * 14;
    for (const { B, c: cb } of axFoesNear(f, ox + u.x * 55, oy + u.y * 55, 85)) {
      const dx = cb.x - ox, dy = cb.y - oy, n = Math.hypot(dx, dy) || 1;
      if ((dx * u.x + dy * u.y) / n < .35) continue;
      damage(B, 6, { src: f, kind: 'melee', x: cb.x, y: cb.y, nx: u.x, ny: u.y - .25, kb: 640, color: '#ff9a5a' });
    }
    const air = !f.grounded, push = air ? (u.y > .9 ? 1150 : 700) : 380;
    if (air) f.mem.kbAir = (f.mem.kbAir || 0) + 1;
    for (const p of f.P) {
      if (air && u.y > .9) p.oy = Math.max(p.oy, p.y);        // cancel the fall first so the blast always lifts
      kick(p, -u.x * push, -u.y * push);
    }
    for (let i = 0; i < 3; i++) axFx({ x: ox + u.x * i * 26, y: oy + u.y * i * 26, life: .18 + i * .04, rr: 10 + i * 9,
      draw(ctx, p) { ctx.globalAlpha = 1 - p.t / p.life; circle(ctx, p.x, p.y, p.rr + p.t * 120, null, '#ffd2b0', 3); ctx.globalAlpha = 1; } });
    f.mem.kbVent = G_STATE.t + .35;
    sfx('rift-kick');
    shake(3);
  },
  onStep(f) { if (f.grounded) f.mem.kbAir = 0; },
  onHit() { sfx('punch'); },
  draw(ctx, f, s) {
    const k = s.k, t = s.t, hot = G_STATE.t < (f.mem.kbVent || 0);
    line(ctx, s.h, s.at(s.L * .6), '#4a3428', 11 * k);
    line(ctx, s.at(2 * k, -6 * k), s.at(s.L * .6, -6 * k), '#c9a46a', 2 * k);           // piston rods
    line(ctx, s.at(2 * k, 6 * k), s.at(s.L * .6, 6 * k), '#c9a46a', 2 * k);
    circle(ctx, t.x, t.y, 12 * k, '#6b4a3a', '#ff9a5a', 2.5 * k);
    for (const o of [-5, 0, 5]) { const v = s.at(s.L * .3, o * k); circle(ctx, v.x, v.y, 1.8 * k, hot ? '#ffd2b0' : '#2a1d16'); }
    const air = Math.max(0, 2 - (f.mem.kbAir || 0));
    for (let i = 0; i < 2; i++) { const p = s.at(-6 * k, (i ? 5 : -5) * k); circle(ctx, p.x, p.y, 2 * k, i < air ? '#ff9a5a' : '#3a2a22'); }
  },
});

// ---------- Starfall Mortar (ranged): lobbed shells with a landing marker; beats cover, useless point-blank ----------
defWeapon('mortar', {
  power: 1,
  name: 'Starfall Mortar', cat: 'ranged', order: 19, color: '#ffd84a', tier: 'epic', twoHanded: true,
  desc: 'A shoulder mortar. Each shell is lobbed high at where the target is heading, with a marker on the ground showing where it will land; it bursts in a wide blast after about a second. It ignores guards that face the wrong way and hits behind cover, but anything closer than a few steps is under the arc: keep your distance.',
  len: 50, mass: 1.4, dmg: .3, width: 9, bodyRecoil: 160,
  arc: 'high lob', sig: 'shells land where the marker shows (~1 s); wide blast',
  ranged: { cooldown: 1, ammo: 2, reload: 2.4, speed: 900, spread: 0, recoil: 260, sfx: 'rift-mortar' },
  ai: { range: 520, style: 'kite' },
  attack(f) {
    if (!rangedSpend(f)) { f.atkCd = .05; return; }
    const b = rangedBarrel(f), foe = nearestEnemy(f, true);
    let tx = f.P[2].x + f.face * 420, ty;
    if (foe) {
      const c = chest(foe), lead = clamp(vx(foe.P[2]), -500, 500) * .55;
      tx = clamp(c.x + lead, 30, W - 30);
    }
    tx = (Math.abs(tx - b.x) < 150) ? b.x + Math.sign(tx - b.x || f.face) * 150 : tx;   // the minimum arc
    ty = axGround(tx, foe ? Math.min(chest(foe).y, feetY(foe) - 10) : b.y);
    const T = clamp(Math.abs(tx - b.x) / 620, .8, 1.25), g = PHYS.gravity;
    const vx0 = (tx - b.x) / T, vy0 = (ty - b.y - .5 * g * T * T) / T;
    const mark = axFx({ x: tx, y: ty, life: T, color: f.color,
      draw(ctx, p) {
        const a = p.t / p.life, r = 54 - a * 26;
        ctx.globalAlpha = .35 + a * .5;
        circle(ctx, p.x, p.y - 2, r, null, '#ffd84a', 2 + a * 2);
        lineXY(ctx, p.x - r - 6, p.y - 2, p.x - r + 10, p.y - 2, '#ffd84a', 2); lineXY(ctx, p.x + r - 10, p.y - 2, p.x + r + 6, p.y - 2, '#ffd84a', 2);
        lineXY(ctx, p.x, p.y - 2 - r - 6, p.x, p.y - 2 - r + 10, '#ffd84a', 2);
        ctx.globalAlpha = 1;
      } });
    spawnProj({ owner: f, x: b.x, y: b.y, vx: vx0, vy: vy0, grav: 1, r: 7, dmg: 15, explode: 108, kb: 640, life: T + .6, color: '#ffd84a',
      trail: true, mark,
      onStep(p) { if (chance(.5)) burst(p.x, p.y, '#ffb347', 1, 80, { life: .25 }); },
      onExpire(p) { if (p.mark) p.mark.dead = true; },
      draw(ctx, p) { circle(ctx, p.x, p.y, 7, '#3a3320', '#ffd84a', 2.5); circle(ctx, p.x, p.y, 2.5, '#ffffff'); } });
    sfx('rift-whistle', .5);
  },
  draw(ctx, f, s) {
    const k = s.k;
    line(ctx, s.at(-14 * k), s.at(s.L), '#3a3a30', 14 * k);
    line(ctx, s.at(s.L - 6 * k), s.at(s.L + 2 * k), '#ffd84a', 15 * k);
    line(ctx, s.at(-10 * k, 9 * k), s.at(6 * k, 14 * k), '#5a5440', 4 * k);                 // bipod
    for (let i = 0; i < 2; i++) { const p = s.at((10 + i * 10) * k, -9 * k); circle(ctx, p.x, p.y, 2.6 * k, i < f.ammo ? '#ffd84a' : '#3a3320'); }
  },
});

// ---------- Gloop Cannon (exotic): sticky goo that turns the floor into a trap ----------
defWeapon('gloop', {
  power: 1.3,
  name: 'Gloop Cannon', cat: 'exotic', order: 42, color: '#9dff5a', tier: 'rare',
  desc: 'Fires slow, arcing blobs of neon goo. A direct hit Goos the target (45% slower, +10% damage taken). Blobs that land leave a sticky puddle for 5 s that goos anyone who walks through it; you can keep three puddles at once. Almost no damage on its own: it sets up everyone else.',
  len: 46, mass: 1.1, dmg: .3, width: 8,
  arc: 'arcing goo', sig: 'goo slows; puddles deny ground (max 3)',
  ranged: { cooldown: .5, ammo: 5, reload: 2.2, speed: 950, spread: .05, recoil: 120, sfx: 'rift-gloop',
    proj: rangedProj({ dmg: 4, r: 9, life: 1.6, grav: .85, kb: 90,
      onHit(p, B, dealt) { if (dealt > 0) { addStatus(B, 'gooed', 2.4, 1, p.owner); sfx('rift-splat', .7); } },
      onExpire(p, why) { if (why === 'world' && p.owner) gloopPuddle(p.owner, p.x, p.y); },
      draw(ctx, p) {
        const sq = 1 + Math.sin(p.t * 30) * .12;
        hatEllipse(ctx, p.x, p.y, 9 * sq, 9 / sq, '#9dff5a', '#4f9a2a', 1.5, Math.atan2(p.vy, p.vx));
        circle(ctx, p.x - 3, p.y - 3, 2.5, '#eaffd8');
      } }) },
  ai: { range: 360, style: 'kite' },
  draw(ctx, f, s) {
    const k = s.k, t = s.at(s.L - 4 * k);
    line(ctx, s.at(-10 * k), s.at(s.L), '#2a3a20', 12 * k);
    circle(ctx, s.at(8 * k, -10 * k).x, s.at(8 * k, -10 * k).y, 9 * k, rgba('#9dff5a', .7), '#4f9a2a', 2 * k);   // goo tank
    circle(ctx, t.x, t.y, 6 * k, '#9dff5a');
    if (f.ammo > 0) circle(ctx, s.t.x, s.t.y + 4 * k, 2.5 * k, '#9dff5a');                     // the drip
  },
});
function gloopPuddle(f, x, y) {
  const gy = axGround(x, y - 12);
  if (gy > H) return;
  const list = (f.mem.puddles || []).filter(p => !p.dead);
  while (list.length >= 3) list.shift().dead = true;
  const pd = axFx({ x, y: gy, life: 5, r: 66, owner: null, team: f.team,
    onStep(p) {
      for (const B of F) {
        if (!B.alive || B.team === p.team) continue;
        if (Math.abs(B.P[2].x - p.x) < p.r && Math.abs(feetY(B) - p.y) < 22) addStatus(B, 'gooed', .5, 1, f);
      }
    },
    draw(ctx, p) {
      const fade = Math.min(1, (p.life - p.t) * 2), a = Math.min(1, p.t * 6);
      ctx.globalAlpha = .55 * fade;
      hatEllipse(ctx, p.x, p.y - 2, p.r * a, 9, '#9dff5a', '#4f9a2a', 2);
      ctx.globalAlpha = .9 * fade;
      for (let i = 0; i < 3; i++) circle(ctx, p.x + (i - 1) * p.r * .5, p.y - 4 - Math.abs(Math.sin(G_STATE.t * 3 + i)) * 4, 3, '#d8ffc0');
      ctx.globalAlpha = 1;
    } });
  list.push(pd); f.mem.puddles = list;
  sfx('rift-splat', .6);
}

// ---------- Skyfall Javelin (polearm): quick thrusts, or throw it for a big hit and fight barehanded ----------
defWeapon('javelin', {
  power: 1.05,
  name: 'Skyfall Javelin', cat: 'polearm', order: 37, color: '#ffe6a0', tier: 'epic',
  desc: 'A light throwing spear. Tap for fast, long thrusts. Hold attack for half a second, then release to hurl it: a heavy, slightly arcing throw that skewers and pins whoever it hits. Then you are barehanded until you pick it up again (walk over it), or it flies back to you after 3 s. Anyone can grab it in the meantime.',
  len: 124, mass: .9, dmg: .9, width: 4, cd: .5,
  arc: 'thrust; hold to throw', sig: 'hold 0.5 s + release: throw (pins); recall after 3 s',
  ai: { range: 180, style: 'melee',
    think(f, foe, d) {
      if (d > 300 && d < 720 && Math.abs(foe.P[2].y - f.P[2].y) < 160) f.inp.attackHeld = true;   // throw at range
      else if (f.mem.javHold > .5 && d < 300) f.inp.attackHeld = false;
    } },
  attack(f) { meleeThrust(f, 1.05, f.main, f.grounded ? 120 : 40); f.mem.javHold = 0; },
  onStep(f, dt) {
    if (f.inp.attackHeld && canAct(f)) {
      f.mem.javHold = (f.mem.javHold || 0) + dt;
      if (f.mem.javHold > .5) {                                       // cock it back over the shoulder
        const h = f.P[f.main.hand];
        spring(f.P[f.tip], h.x - f.face * 60, h.y - 70, 200, 12);
        if (!f.mem.javReady) { f.mem.javReady = true; sfx('rift-charge', .45); }
      }
      return;
    }
    if (f.mem.javReady && canAct(f)) javelinThrow(f);
    f.mem.javReady = false; f.mem.javHold = 0;
  },
  draw(ctx, f, s) { javelinDraw(ctx, s.at(-20 * s.k), s.t, s.k, f.mem.javReady); },
});
function javelinDraw(ctx, a, b, k, glow) {
  line(ctx, a, b, '#7a5a34', 4 * k);
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  for (const o of [.12, .2]) lineXY(ctx, a.x + dx * o - uy * 5 * k, a.y + dy * o + ux * 5 * k, a.x + dx * o + uy * 5 * k, a.y + dy * o - ux * 5 * k, '#c9a46a', 2 * k);
  poly(ctx, [{ x: b.x + ux * 14 * k, y: b.y + uy * 14 * k }, { x: b.x - uy * 5 * k, y: b.y + ux * 5 * k }, { x: b.x + uy * 5 * k, y: b.y - ux * 5 * k }], '#ffe6a0');
  if (glow) { ctx.globalAlpha = .4 + Math.sin(G_STATE.t * 24) * .2; circle(ctx, b.x + ux * 6 * k, b.y + uy * 6 * k, 10 * k, '#ffe6a0'); ctx.globalAlpha = 1; }
}
function javelinThrow(f) {
  const u = meleeAim(f), h = f.P[f.main.hand], sp = 1950;
  equipWeapon(f, 'fists');
  f.bareT = 0; f.crateCalled = true;                                  // no supply crate: the javelin is coming back
  f.atkCd = Math.max(f.atkCd, .3);
  for (let j = 0; j < 11; j++) kick(f.P[j], u.x * 240, 0);
  spawnProj({ owner: f, x: h.x, y: h.y - 10, vx: u.x * sp, vy: u.y * sp - 170, grav: .45, r: 5, dmg: 19, kb: 560, life: 1.4,
    color: '#ffe6a0', trail: true, headMul: 1.2, kind: 'javelin',
    onHit(p, B, dealt) {
      if (dealt <= 0) return;
      addStatus(B, 'pinned', .5, 1, p.owner);
      float(B.P[0].x, B.P[0].y - 60, 'SKEWERED!', '#ffe6a0', 24);
      sfx('rift-javelin');
    },
    onExpire(p) { javelinDrop(f, p.x, Math.min(p.y, H - 20), p.vx); },
    draw(ctx, p) {
      const sp2 = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp2, uy = p.vy / sp2;
      javelinDraw(ctx, { x: p.x - ux * 110, y: p.y - uy * 110 }, { x: p.x, y: p.y }, 1, false);
    } });
  float(h.x, h.y - 40, 'THROW!', '#ffe6a0', 20);
  sfx('rift-whistle', .6); sfx('swing', 1.2);
}
// The thrown javelin lies where it landed; after 3 s it flies back to its thrower if they are still barehanded.
function javelinDrop(owner, x, y, vx0) {
  spawnPickup('weapon', 'javelin', x, y, vx0 * .08, -160, { dropBy: null,
    onStep(p, dt) {
      pickupStep(p, dt);
      if (p.dead || p.t < 3 || !owner.alive || !isBare(owner) || F.indexOf(owner) < 0) return;
      p.dead = true;
      equipWeapon(owner, 'javelin');
      owner.crateCalled = false;
      const hnd = owner.P[owner.main.hand];
      beam(p.x, p.y, hnd.x, hnd.y, '#ffe6a0', 3, .25);
      float(hnd.x, hnd.y - 40, 'RECALLED', '#ffe6a0', 18);
      sfx('rift-charge', .5);
    } });
}

// ---------- Conductor Rods (magic): plant lightning rods; foes crossing the arc between them get zapped ----------
defWeapon('conductor', {
  power: 0.95,
  name: 'Conductor Rods', cat: 'magic', order: 34, color: '#7fe0ff', tier: 'mythic',
  desc: 'A bundle of lightning rods. Each attack lobs a rod that plants where it lands (two at a time; a third replaces the oldest). A rod zaps the nearest foe within reach once a second, and two rods close enough to each other join in a crackling arc that shocks anyone who crosses it. Rods last 9 s, and a fast enemy swing smashes one. Slow to set up, weak up close.',
  len: 44, mass: .8, dmg: .5, width: 5,
  arc: 'lobbed rod', sig: 'plant 2 rods: auto-zaps + arc between them',
  ranged: { cooldown: .75, ammo: 2, reload: 1.8, speed: 800, spread: 0, recoil: 90, sfx: 'rift-rod' },
  ai: { range: 300, style: 'kite' },
  attack(f) {
    if (!rangedSpend(f)) { f.atkCd = .05; return; }
    const b = rangedBarrel(f), foe = nearestEnemy(f, true);
    const dx = foe ? clamp(chest(foe).x - b.x, -520, 520) : f.face * 300, T = .62;
    spawnProj({ owner: f, x: b.x, y: b.y, vx: dx / T * .8, vy: -560, grav: 1, r: 5, dmg: 4, kb: 120, life: 2, color: '#7fe0ff', trail: false,
      onExpire(p, why, target) { conductorPlant(f, p.x, target ? feetY(target) : p.y); },
      draw(ctx, p) { const a = p.t * 14; lineXY(ctx, p.x - Math.cos(a) * 18, p.y - Math.sin(a) * 18, p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, '#9fb3d0', 4); circle(ctx, p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, 3, '#7fe0ff'); } });
  },
  draw(ctx, f, s) {
    const k = s.k;
    for (const o of [-5, 0, 5]) line(ctx, s.at(-12 * k, o * k), s.at(s.L - Math.abs(o) * k, o * k), '#9fb3d0', 3 * k);
    meleeGuard(ctx, s, 4 * k, 9, '#3a4a60', 4);
    const t = s.t;
    if (chance(.3)) rangedSpark(ctx, t.x, t.y, t.x + rnd(-10, 10), t.y + rnd(-10, 10), '#7fe0ff', 1.5);
    for (let i = 0; i < 2; i++) { const p = s.at((10 + i * 9) * k, -9 * k); circle(ctx, p.x, p.y, 2.4 * k, i < f.ammo ? '#7fe0ff' : '#23303f'); }
  },
});
function conductorPlant(f, x, y) {
  const gy = axGround(clamp(x, 20, W - 20), y - 20);
  if (gy > H) return;
  const rods = (f.mem.rods || []).filter(r => !r.dead);
  while (rods.length >= 2) rods.shift().dead = true;
  const rod = axFx({ x: clamp(x, 20, W - 20), y: gy, life: 9, zapT: .5, arcT: 0, team: f.team, kind: 'rod',
    top: () => ({ x: rod.x, y: rod.y - 58 }),
    onStep(p, dt) {
      if (!f.alive || F.indexOf(f) < 0) { p.dead = true; return; }
      const top = p.top();
      for (const B of enemiesOf(f)) {                                   // a fast enemy swing smashes the rod
        if (!B.alive) continue;
        const t = B.P[B.tip];
        if (Math.hypot(t.x - top.x, t.y - (top.y + 30)) < 30 && Math.hypot(vx(t), vy(t)) > 700 && !B.w.ranged) {
          p.dead = true; float(top.x, top.y - 20, 'ROD SMASHED', '#7fe0ff', 18); burst(top.x, top.y + 20, '#9fb3d0', 14, 300); sfx('clash', .7); return;
        }
      }
      if ((p.zapT -= dt) <= 0) {
        p.zapT = 1;
        let best = null, bd = 150;
        for (const B of enemiesOf(f)) { if (!B.alive || B.inv > 0) continue; const c = chest(B), d = Math.hypot(c.x - top.x, c.y - top.y); if (d < bd) { bd = d; best = B; } }
        if (best) {
          const c = chest(best);
          rangedZigzag(top.x, top.y, c.x, c.y, '#7fe0ff', 3);
          damage(best, 5, { src: f, kind: 'proj', x: c.x, y: c.y, nx: Math.sign(c.x - top.x), ny: -.3, kb: 160, color: '#7fe0ff' });
          sfx('rift-zap', .6);
        }
      }
      const other = (f.mem.rods || []).find(r => r !== p && !r.dead);
      if (!other || other.t > p.t || Math.abs(other.x - p.x) > 600) return;   // the newer rod runs the arc
      const o = other.top();
      if ((p.arcT -= dt) > 0) return;
      p.arcT = .3;
      for (const B of enemiesOf(f)) {
        if (!B.alive || B.inv > 0) continue;
        const c = chest(B), r = segSeg(top.x, top.y + 20, o.x, o.y + 20, c.x, c.y - 30, c.x, c.y + 40);
        if (r.d > 22 || !axOnce(f, B, 'arc', .55)) continue;
        damage(B, 6, { src: f, kind: 'proj', x: r.qx, y: r.qy, nx: 0, ny: -1, kb: 260, color: '#7fe0ff' });
        B.stagger = Math.max(B.stagger, .25);
        rangedZigzag(top.x, top.y + 20, o.x, o.y + 20, '#ffffff', 2);
        sfx('rift-zap', .8);
      }
    },
    draw(ctx, p) {
      const top = p.top(), fade = Math.min(1, (p.life - p.t) * 1.5), rise = Math.min(1, p.t * 8);
      ctx.globalAlpha = fade;
      line(ctx, { x: p.x, y: p.y }, { x: p.x, y: p.y - 58 * rise }, '#9fb3d0', 4);
      for (let i = 0; i < 3; i++) lineXY(ctx, p.x - 6, p.y - 18 - i * 10, p.x + 6, p.y - 22 - i * 10, '#c97a3a', 2);   // copper coil
      circle(ctx, top.x, top.y, 5, '#7fe0ff');
      if (chance(.5)) rangedSpark(ctx, top.x, top.y, top.x + rnd(-14, 14), top.y + rnd(-14, 6), '#bff3ff', 1.5);
      const other = (f.mem.rods || []).find(r => r !== p && !r.dead);
      if (other && other.t <= p.t && Math.abs(other.x - p.x) <= 600) {
        const o = other.top();
        ctx.globalAlpha = fade * (.35 + Math.random() * .3);
        rangedSpark(ctx, top.x, top.y + 20, o.x, o.y + 20, '#7fe0ff', 3);
      }
      ctx.globalAlpha = 1;
    } });
  rods.push(rod); f.mem.rods = rods;
  burst(rod.x, gy, '#7fe0ff', 10, 240);
  sfx('rift-rod', .7);
}

// ---------- Bass Drop (exotic heavy): a speaker-hammer; hits on the beat land much harder ----------
const BASS_BEAT = .6;                                     // 100 BPM, shared by every Bass Drop on the field
const bassPhase = t => (t % BASS_BEAT) / BASS_BEAT;
const bassOnBeat = t => { const ph = bassPhase(t); return ph < .13 || ph > .9; };
defWeapon('bass-drop', {
  power: 1.22,
  name: 'Bass Drop', cat: 'exotic', twoHanded: true, order: 28, color: '#ff5ad1', tier: 'mythic',
  desc: 'A sledgehammer with a subwoofer for a head. It thumps a steady beat (100 BPM): the speaker pumps and a ring pulses at your feet on every beat. A hit that lands on the beat drops the bass: +75% damage and a small shockwave. Off-beat hits are weak. Pure timing skill.',
  len: 90, mass: 1.9, dmg: .82, width: 9, kb: 1.25, cd: .78, speed: .9,
  arc: 'heavy swing on the beat', sig: 'on-beat hits: +75% and a shockwave',
  ai: { range: 150, style: 'melee' },
  onStep(f) {
    const b = Math.floor(G_STATE.t / BASS_BEAT);
    if (b !== f.mem.bassBeat) { f.mem.bassBeat = b; if (f.ctrl === 'human' && G_STATE.lock <= 0 && SETTINGS.v5Beat !== false) sfx('rift-beat', .35); }
  },
  onHit(A, B, hit) {
    if (!bassOnBeat(G_STATE.t) || !axOnce(A, B, 'drop', .3)) return;
    damage(B, Math.max(3, hit.dmg * .75), { src: A, kind: 'melee', x: hit.x, y: hit.y, nx: hit.nx, ny: hit.ny - .3, kb: 420, color: '#ff5ad1', small: true });
    for (const { B: O, c } of axFoesNear(A, hit.x, hit.y, 110)) if (O !== B) damage(O, 4, { src: A, kind: 'melee', x: c.x, y: c.y, nx: Math.sign(c.x - hit.x), ny: -.5, kb: 300, color: '#ff5ad1', small: true });
    ring(hit.x, hit.y, 110, '#ff5ad1', .3, 5); ring(hit.x, hit.y, 55, '#ffffff', .2, 3);
    float(hit.x, hit.y - 50, 'ON BEAT!', '#ff5ad1', 24);
    sfx('rift-onbeat'); shake(6);
  },
  draw(ctx, f, s) {
    const k = s.k, ph = bassPhase(G_STATE.t), pump = 1 + Math.max(0, 1 - ph * 5) * .22, head = s.at(s.L - 6 * k);
    line(ctx, s.at(-16 * k), s.at(s.L - 14 * k), '#2b2236', 6 * k);
    for (let d = -14; d < 6; d += 5) meleeGuard(ctx, s, d * k, 3, '#ff5ad1', 1.5);
    hatEllipse(ctx, head.x, head.y, 20 * k, 15 * k, '#1a1426', '#ff5ad1', 2.5 * k, Math.atan2(s.uy, s.ux) + Math.PI / 2);
    const cone = s.at(s.L - 6 * k, 0);
    circle(ctx, cone.x, cone.y, 9 * k * pump, '#2d2440', '#ff9ae6', 2 * k);
    circle(ctx, cone.x, cone.y, 3.5 * k * pump, '#ff5ad1');
    if (f.alive && !f.summon) {                                      // the beat ring at the feet
      const x = f.P[2].x, y = feetY(f) + 2;
      ctx.globalAlpha = Math.max(0, .55 - ph * .9);
      hatEllipse(ctx, x, y, 18 + ph * 40, 4 + ph * 6, null, '#ff5ad1', 2);
      ctx.globalAlpha = 1;
    }
  },
});

// ============================================================================
//  V5 ARENAS (2) — rebuilt: real drawBg art, spawns on platforms, telegraphed hazards
// ============================================================================

defMap('void-arena', {
  name: 'Void Arena', order: 100,
  desc: 'Broken platforms circling a rift. No floor: ring-outs everywhere. The rift tugs airborne fighters toward the middle.',
  floor: null, walls: false, gravity: 1900, friction: .16, orbs: true, maxOrbs: 2,
  palette: { sky1: '#05040c', sky2: '#1a1033', ground: '#0c0a1a', line: '#9a7cff', accent: '#ff5ad1', solid: '#1c1436' },
  solids: [
    { x: 400, y: 500, w: 480, h: 44, oneWay: false },
    { x: 70, y: 585, w: 210, h: 30, oneWay: false },
    { x: 1000, y: 585, w: 210, h: 30, oneWay: false },
    { x: 545, y: 330, w: 190, move: { dx: 150, dy: 0, period: 7 } },
  ],
  spawns: [[500, 500], [780, 500], [175, 585], [1105, 585]],
  onStep(dt) {
    // The rift only tugs fighters in the air, gently, so it rescues as many recoveries as it ruins.
    for (const f of F) {
      if (!f.alive || f.P[8].g || f.P[10].g) continue;
      const c = chest(f), dx = 640 - c.x;
      if (Math.abs(dx) < 60 || c.y > 760) continue;
      const pull = Math.sign(dx) * Math.min(1, Math.abs(dx) / 500) * 260 * dt;
      for (const p of f.P) p.ox -= pull * DT;
    }
  },
  drawBg(ctx, t) {
    mapSky(ctx, H, ['#05040c', '#120a28', '#22113f', '#0a0618']);
    mapStars(ctx, t, 90, H * .8, 41);
    // The rift: rotating spiral arms around a dark core.
    const cx = 640, cy = 260;
    mapGlow(ctx, cx, cy, 300, '#7a5cff', .32);
    mapGlow(ctx, cx, cy, 140, '#ff5ad1', .22);
    ctx.save(); ctx.translate(cx, cy);
    for (let arm = 0; arm < 4; arm++) {
      ctx.strokeStyle = rgba(arm % 2 ? '#ff5ad1' : '#9a7cff', .32); ctx.lineWidth = 3; ctx.beginPath();
      for (let k = 0; k < 40; k++) {
        const a = t * .35 + arm * TAU / 4 + k * .16, r = 18 + k * 5.5;
        const x = Math.cos(a) * r, y = Math.sin(a) * r * .55;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    hatEllipse(ctx, 0, 0, 34, 20, '#020106', rgba('#c9b8ff', .8), 2.5);
    ctx.restore();
    // Debris drifting into the rift.
    ctx.fillStyle = 'rgba(150,120,255,.35)';
    for (let k = 0; k < 14; k++) {
      const life = mapWrap(t * .05 + mapHash(k) , 1), a = mapHash(k * 3) * TAU + t * .1;
      const r = (1 - life) * 520 + 40, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .5, s = 3 + mapHash(k * 7) * 7;
      ctx.globalAlpha = life * .8;
      poly(ctx, [[x, y - s], [x + s, y], [x, y + s * .6], [x - s * .8, y]], '#6a54b0');
    }
    ctx.globalAlpha = 1;
    // Faint far-off ruined pillars far below.
    for (const [x, h] of [[120, 160], [330, 110], [960, 140], [1170, 190]]) {
      ctx.fillStyle = 'rgba(30,20,60,.7)'; ctx.fillRect(x - 18, H - h, 36, h);
      glowLine(ctx, x - 18, H - h, x + 18, H - h, rgba('#9a7cff', .4), 2);
    }
  },
  drawSolid(ctx, s, t) {
    const h = s.oneWay ? 14 : s.h;
    // Jagged rock underside so platforms read as torn-off chunks of floor.
    const pts = [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w - 8, s.y + h]];
    const n = Math.max(3, Math.round(s.w / 60));
    for (let k = n; k >= 0; k--) pts.push([s.x + 8 + (s.w - 16) * k / n, s.y + h + (k % 2 ? 18 : 6) * (s.oneWay ? .4 : 1)]);
    pts.push([s.x + 8, s.y + h]);
    poly(ctx, pts, '#1c1436', rgba('#9a7cff', .45), 2);
    glowLine(ctx, s.x, s.y, s.x + s.w, s.y, s.move ? '#ff5ad1' : '#9a7cff', 3);
    if (s.move) for (const x of [s.x + 12, s.x + s.w - 12]) circle(ctx, x, s.y + 7, 3, '#ff5ad1');
  },
});

function crystalDrawSpike(c2, hz, t) {
  if (mapParked(hz)) return;
  const k = hz.ref ? 1 - hz.ref.tt / (hz.ref.max || 1) : 0, cx = hz.x + hz.w / 2, y = hz.y + hz.h;
  c2.save(); c2.globalAlpha = 1 - k * .8;
  poly(c2, [[cx - 22, y - 70], [cx, y], [cx + 22, y - 70], [cx, y - 140]], 'rgba(160,255,250,.85)', '#ffffff', 2);
  c2.restore();
}

defMap('crystal-cavern', {
  name: 'Crystal Cavern', order: 101,
  desc: 'A glowing geode. Crystals shiver loose from the ceiling (watch for the marker), and the high ledges are slick.',
  floor: 650, walls: true, gravity: 2150, friction: .14, orbs: true, maxOrbs: 2,
  palette: { sky1: '#061620', sky2: '#0f3040', ground: '#0a2230', line: '#5ef2ff', accent: '#7dff6a', solid: '#123848' },
  solids: [
    { x: 140, y: 470, w: 230 }, { x: 910, y: 470, w: 230 },
    { x: 545, y: 520, w: 190, h: 130, oneWay: false },
    { x: 500, y: 310, w: 280 },
  ],
  hazards: mapTrapSlots('crystal', 2, { dps: 16, tick: 1, status: ['stun', .35, 1], launch: 650, color: '#8cf6ff', draw: crystalDrawSpike }),
  spawns: [[300, 650], [980, 650], [255, 470], [1025, 470]],
  onStep(dt) {
    mapStepTraps(this, 'crystal', dt, {
      every: [4, 7], first: [3, 5], warn: 1.2, hit: .45,
      aim: () => { const x = rnd(80, W - 160); return { x, y: 140, w: 70, h: 510 }; },
      fire: (m, r) => {
        const cx = r.x + r.w / 2;
        shake(5); sfx('rift-prism', .7);
        burst(cx, 645, '#8cf6ff', 22, 520, { grav: 1, life: .6 });
        ring(cx, 645, 60, '#5ef2ff', .3, 4);
      },
    });
  },
  drawBg(ctx, t) {
    const fl = this.floor;
    mapSky(ctx, fl, ['#030a10', '#061a26', '#0d3446', '#0a2230']);
    mapGlow(ctx, 640, 380, 380, '#5ef2ff', .16);
    mapGlow(ctx, 220, 520, 200, '#7dff6a', .12);
    mapGlow(ctx, 1060, 500, 220, '#b98cff', .12);
    // Ceiling stalactites (back layer) and rear crystal clusters.
    ctx.fillStyle = '#04121a';
    ctx.beginPath(); ctx.moveTo(-40, -H); ctx.lineTo(W + 40, -H); ctx.lineTo(W + 40, 40);
    for (let x = W + 40; x >= -40; x -= 40) ctx.lineTo(x, 30 + mapHash(x) * 80 * (x % 80 ? 1 : .4));
    ctx.closePath(); ctx.fill();
    mapRidge(ctx, fl, 150, .008, 1.3, '#082230', fl);
    const cols = ['#5ef2ff', '#7dff6a', '#b98cff'];
    for (let k = 0; k < 16; k++) {
      const x = mapHash(k * 11 + 3) * W, s = 18 + mapHash(k * 5) * 34, y = fl - 30 - mapHash(k * 2) * 80, col = cols[k % 3];
      const pulse = .35 + .25 * Math.sin(t * 1.4 + k);
      ctx.globalAlpha = pulse;
      poly(ctx, [[x - s * .4, y], [x, y - s * 2.2], [x + s * .4, y], [x, y + s * .3]], rgba(col, .6), col, 1.5);
    }
    ctx.globalAlpha = 1;
    mapParticles(ctx, t, 26, { vy: -14, vx: 4, size: 2, color: '#a0fff5', alpha: .5, shape: 'circle', seed: 9, sway: 10 });
    drawGridFloor(ctx, fl, '#071a24', 'rgba(94,242,255,.16)', '#5ef2ff');
  },
  drawSolid(ctx, s, t) {
    const h = s.oneWay ? 14 : s.h;
    ctx.fillStyle = '#123848'; ctx.fillRect(s.x, s.y, s.w, h);
    // Crystal teeth along the edge of each slab.
    for (let x = s.x + 10; x < s.x + s.w - 6; x += 26) poly(ctx, [[x - 6, s.y + h], [x, s.y + h + 10], [x + 6, s.y + h]], rgba('#5ef2ff', .5));
    if (!s.oneWay) {
      ctx.strokeStyle = rgba('#5ef2ff', .4); ctx.lineWidth = 2; ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, h - 2);
      const pulse = .4 + .3 * Math.sin(t * 2);
      poly(ctx, [[s.x + s.w / 2 - 18, s.y + h - 12], [s.x + s.w / 2, s.y + 18], [s.x + s.w / 2 + 18, s.y + h - 12]], rgba('#7dff6a', pulse));
    }
    glowLine(ctx, s.x, s.y, s.x + s.w, s.y, '#5ef2ff', 3);
  },
});

// ============================================================================
//  V5 MODES (3) — rebuilt: fixed-step timers, single round end, fair spawns
// ============================================================================
const INF_COLOR = '#7dff6a', INF_RESPAWN = 1.6;

function infMark(f) {
  f.team = 1; f.color = INF_COLOR; f.infected = true;
  f.spdMul = (f.spdMul || 1) * 1.12;                  // the infected are a touch quicker but hit no harder
}

defMode('infection', {
  name: 'Infection', icon: '☣', order: 85,
  desc: 'One CPU starts infected. Every survivor KO\u2019d rises again as infected and hunts the rest. Last survivor standing, or anyone alive at the timer, wins.',
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 1, roundLimit: 120, customRounds: true, crowd: [3, 8, 6],
  setup(cfg) {
    const n = partyCrowd(cfg, this), roster = partyFfaRoster(cfg, n);
    const first = 1 + Math.floor(Math.random() * (n - 1));
    return { roster, map: partyMap(cfg), run: { infected: [first], dead: {}, n } };
  },
  roundLabel() { return 'INFECTION'; },
  holdRound() { return true; },
  roundOver() { return 'match'; },
  onRoundStart() {
    const run = modeRun();
    for (const f of F) { if (run.infected.includes(f.id)) infMark(f); else f.team = 0; }
    banner('INFECTION', "DON'T GET CAUGHT", 2, INF_COLOR);
  },
  onKO(v) {
    const run = modeRun();
    if (v.summon) return;
    if (!v.infected && !run.infected.includes(v.id)) {
      run.infected.push(v.id);
      const c = chest(v);
      float(c.x, c.y - 60, 'INFECTED!', INF_COLOR, 20); burst(c.x, c.y, INF_COLOR, 16, 250, { life: .5 });
    }
    run.dead[v.id] = INF_RESPAWN;
  },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive()) return;
    partyTickRespawns(run, dt, old => {
      const sp = partySafeSpot(old);
      infMark(partyRespawn(old, sp[0], sp[1], { team: 1, color: INF_COLOR }));
    });
    const healthy = F.filter(f => !f.summon && !run.infected.includes(f.id));
    if (healthy.length <= 1) {
      const last = healthy[0];
      run.survivors = healthy.map(f => f.id);
      return partyEnd(last ? 0 : 1, 'infection', last ? last.name + ' SURVIVED' : 'INFECTED WIN', '', last ? last.color : INF_COLOR);
    }
    if (G_STATE.roundT >= G_STATE.roundLimit) {
      run.survivors = healthy.map(f => f.id);
      partyEnd(0, 'time', 'SURVIVORS WIN', `${healthy.length} LEFT`, '#5ef2ff');
    }
  },
  hud(ctx) {
    const run = modeRun(), inf = run.infected.length, healthy = F.filter(f => !f.summon).length - inf;
    const left = Math.max(0, Math.ceil(G_STATE.roundLimit - G_STATE.roundT));
    modeText(ctx, `Survivors ${healthy}  ·  Infected ${inf}  ·  ${left}s`, W / 2, PARTY_HUD_Y, 16, INF_COLOR, 'center', '600 ' + FONT_BODY);
    partyDrawRespawns(ctx, run, PARTY_HUD_Y + 26);
  },
  results() {
    const run = modeRun(), surv = run.survivors || [], won = surv.includes(0);
    const names = surv.map(id => (G_STATE.roster[id] || {}).name).filter(Boolean);
    return { title: won ? 'You survived!' : 'You were infected', color: won ? '#5ef2ff' : INF_COLOR, won,
      lines: [`Survivors: ${names.join(', ') || 'none'}`, `${run.infected.length} of ${run.n} fighters were infected.`] };
  },
});

// Blitz: Gun Game across the new rift arsenal. Death by your own hand (fall, hazard) knocks you down a rung.
// 12 rungs: a 1v1 run lasts about 2.5 minutes, a 4-fighter brawl about half that.
const BLITZ_LADDER = ['bass-drop', 'chrono-katana', 'grapnel', 'echo-blades', 'gloop', 'phase-rifle', 'kickback',
  'javelin', 'meteor-flail', 'naginata', 'conductor', 'singularity'];

defMode('blitz', {
  name: 'Blitz Rush', icon: '⚡', order: 86,
  desc: 'Gun Game with the rift arsenal: every KO moves you up the ladder, falling off or dying to hazards moves you down. First KO on the last weapon wins.',
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 1, roundLimit: 180, customRounds: true, crowd: [2, 6, 4], noDisarm: true,
  setup(cfg) {
    const ladder = BLITZ_LADDER.filter(k => WEAPONS[k]);
    return { roster: partyFfaRoster(cfg, partyCrowd(cfg, this), { weapon: ladder[0] }), map: partyMap(cfg), run: { ladder, lvl: {}, dead: {} } };
  },
  roundLabel() { return 'BLITZ RUSH'; },
  holdRound() { return true; },
  roundOver() { return 'match'; },
  onRoundStart() {
    const run = modeRun();
    for (const f of F) run.lvl[f.id] = 0;
    banner('BLITZ RUSH', `${run.ladder.length} RIFT WEAPONS`, 2, '#ffd84a');
  },
  onKO(v, killer) {
    const run = modeRun();
    if (v.summon) return;
    run.dead[v.id] = 1.6;
    const k = killer && (killer.summon ? killer.owner : killer);
    if (k && k !== v && k.alive) ggAdvance(run, k);
    else if ((run.lvl[v.id] || 0) > 0) {
      run.lvl[v.id]--;
      const c = chest(v); float(c.x, c.y - 70, 'DEMOTED', '#ff5c48', 18);
    }
  },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive()) return;
    for (const p of PROJ) if (p.kind === 'pickup') p.dead = true;
    partyTickRespawns(run, dt, old => { const sp = partySafeSpot(old); partyRespawn(old, sp[0], sp[1], { weapon: run.ladder[run.lvl[old.id] || 0] }); });
    if (G_STATE.roundT >= G_STATE.roundLimit) { const top = ggLeader(run); partyEnd(top.team, 'time', 'TIME!', top.name + ' WINS', top.color); }
  },
  hud(ctx) { MODES.gungame.hud.call(this, ctx); },
  results() {
    const run = modeRun(), top = ggLeader(run), won = top.id === 0;
    return { title: won ? 'Blitz champion!' : `${top.name} wins`, color: top.color, won,
      lines: [`${top.name} reached ${Math.min((run.lvl[top.id] || 0) + 1, run.ladder.length)} of ${run.ladder.length}.`, `You reached ${(run.lvl[0] || 0) + 1} of ${run.ladder.length}.`] };
  },
});

// Rift Storm: a free-for-all where reality shifts on a visible countdown. Every event is announced 2 s ahead.
const RIFT_EVENTS = {
  lowgrav:  { name: 'LOW GRAVITY', sub: 'JUMP HIGHER, FALL SLOWER', color: '#b98cff', dur: 8,
    start(run) { run.g0 = PHYS.gravity; PHYS.gravity *= .5; }, end(run) { if (run.g0) PHYS.gravity = run.g0; run.g0 = 0; } },
  shuffle:  { name: 'WEAPON RIFT', sub: 'EVERYONE SWAPS', color: '#ffd84a', dur: 0,
    start() {
      const keys = listOf(WEAPONS).filter(w => !w.hidden && !w.bossOnly).map(w => w.key);
      for (const f of F) if (f.alive && !f.summon) { equipWeapon(f, pick(keys)); const c = chest(f); ring(c.x, c.y, 50, '#ffd84a', .3, 3); }
    } },
  surge:    { name: 'RIFT SURGE', sub: 'THE LAST-PLACE FIGHTER IS EMPOWERED', color: '#ff5c48', dur: 0,
    start() {
      const list = F.filter(f => f.alive && !f.summon);
      if (!list.length) return;
      const sc = G_STATE.score || [], low = list.reduce((a, f) => (sc[f.team] || 0) < (sc[a.team] || 0) ? f : a, list[0]);
      addStatus(low, 'rage', 6, 1, low); addStatus(low, 'haste', 6, 1, low);
      const c = chest(low); float(c.x, c.y - 80, 'RIFT POWER', low.color, 22); ring(c.x, c.y, 80, low.color, .4, 4);
    } },
  meteors:  { name: 'METEOR SHOWER', sub: 'WATCH THE MARKERS', color: '#ff8a2e', dur: 4,
    step(run, dt) {
      if ((run.mt = (run.mt || 0) - dt) > 0) return;
      run.mt = .33;
      const x = rnd(80, W - 80), gy = groundBelow(x, -200) ?? (MAP.floor ?? H);
      const mark = skillZone({ owner: null, x, y: gy, life: .9, kind: 'rift-mark',
        draw(ctx, z) { const k = z.t / z.life; circle(ctx, z.x, z.y, 10 + 40 * k, null, rgba('#ff8a2e', .4 + .5 * k), 2); } });
      spawnProj({ owner: null, x: x - 80, y: -60, vx: 80 / .9, vy: (gy + 60) / .9, r: 9, dmg: 9, explode: 70, kb: 520, life: 1.6,
        color: '#ff8a2e', grav: 0, mark, onExpire(p) { if (p.mark) p.mark.dead = true; },
        draw(ctx, p) { circle(ctx, p.x, p.y, 9, '#ffb347', '#ff5c48', 2); } });
    } },
  glass:    { name: 'GLASS HOUR', sub: 'EVERYONE IS PHASED: NEXT HIT +35%', color: '#8cf6ff', dur: 3.5,
    start() { for (const f of F) if (f.alive) addStatus(f, 'phased', 3.5, 1, f); } },
};

defMode('rift', {
  name: 'Rift Storm', icon: '✷', order: 87,
  desc: 'Free-for-all where reality shifts every ~16 s: low gravity, weapon swaps, meteor showers and more. Each shift is announced two seconds ahead.',
  players: [1, 1], cpu: true, pickers: 1, labels: ['You'], winScore: 5, customRounds: true, crowd: [2, 4, 3],
  setup(cfg) {
    return { roster: partyFfaRoster(cfg, partyCrowd(cfg, this)), map: partyMap(cfg), run: { next: 12, ev: null, evT: 0, warn: null, n: 0, order: shuffle(Object.keys(RIFT_EVENTS)) } };
  },
  roundLabel() { return 'RIFT STORM'; },
  onRoundStart() {
    const run = modeRun();
    if (run.ev && RIFT_EVENTS[run.ev].end) RIFT_EVENTS[run.ev].end(run);
    run.ev = null; run.warn = null;
    // The countdown carries across rounds (KOs are quick), with a short grace period after each reset.
    run.next = Math.max(run.next ?? 12, 6);
  },
  onStep(dt) {
    const run = modeRun();
    if (!partyLive()) { if (G_STATE.ending && run.ev) { const e = RIFT_EVENTS[run.ev]; if (e.end) e.end(run); run.ev = null; } return; }
    if (run.ev) {
      const e = RIFT_EVENTS[run.ev];
      if (e.step) e.step(run, dt);
      if ((run.evT -= dt) <= 0) { if (e.end) e.end(run); run.ev = null; }
    }
    run.next -= dt;
    if (!run.warn && run.next <= 2) {
      run.warn = run.order[run.n++ % run.order.length];
      const e = RIFT_EVENTS[run.warn];
      banner(e.name, e.sub, 1.6, e.color); sfx('rift-phase', .6);
    }
    if (run.next <= 0 && run.warn) {
      if (run.ev) { const o = RIFT_EVENTS[run.ev]; if (o.end) o.end(run); }
      const e = RIFT_EVENTS[run.warn];
      run.ev = run.warn; run.evT = e.dur; run.warn = null; run.next = 16 + rnd(0, 4);
      if (e.start) e.start(run);
      shake(6); burst(W / 2, H / 2, e.color, 30, 420, { life: .6 });
      if (!e.dur) run.ev = null;
    }
  },
  hud(ctx) {
    const run = modeRun(), e = run.ev && RIFT_EVENTS[run.ev];
    const txt = e ? `${e.name} · ${Math.max(0, run.evT).toFixed(1)}s` : `Next rift in ${Math.max(0, run.next).toFixed(1)}s`;
    modeText(ctx, txt, W / 2, PARTY_HUD_Y, 15, e ? e.color : '#b98cff', 'center', '600 ' + FONT_BODY);
  },
  abandon() { const run = modeRun(); if (run.ev && RIFT_EVENTS[run.ev].end) RIFT_EVENTS[run.ev].end(run); run.ev = null; },
});

// The secret Prism Crown (code SHINY), restored: v5's weapon insert replaced its definition but kept the code.
defHat('prism', {
  name: 'Prism Crown', hidden: true, order: 99,
  draw(ctx, f, h) {
    const r = h.r, y = -r * .75, t = hatT();
    ['#ff5ad1', '#ffd84a', '#5ef2ff', '#9dff5a', '#b98cff'].forEach((c, k) => {
      const x = (k - 2) * r * .4, tall = r * (.6 + .25 * Math.sin(t * 3 + k));
      poly(ctx, [[x - r * .2, y], [x, y - tall], [x + r * .2, y]], c, '#ffffff', h.scale);
    });
  },
});

// ---------- codex lore (short original lines, built from the entry's key) ----------
const LORE = {
  w: ['{n} was forged in the {p}.', 'Legend says the first {n} {d}.', 'Every {who} of the {p} knows the {n} by its hum.', 'The {n} turned up in a {o}.'],
  s: ['{n} was first taught in the {p}.', 'Masters of the {p} practise {n} at dawn.', 'A {who} once learned {n} from a {o}.'],
  c: ['The {n} school began in the {p}.', '{n}s train for years in the {p}.', 'Ask any {who}: a {n} never backs down.'],
  m: ['{n} sits at the edge of the {p}.', 'Duelists come to {n} from as far as the {p}.', 'Nobody remembers who built {n}. Some say a {who}.'],
  p: ['{n} hatched in a {o}.', 'A {who} from the {p} lost {n} once. It came back.', '{n} follows whoever shares their snacks.'],
};
const LORE_FILL = {
  p: ['Neon Foundry', 'Glass Dunes', 'Static Marsh', 'Ember Wastes', 'Frostspire', 'Wobble Hills', 'Sky Citadel', 'Shadow Depths'],
  d: ['split a thunderstorm in two', 'won a duel without touching the ground', 'wobbled a mountain flat', 'outlasted three champions in one night'],
  who: ['duelist', 'street brawler', 'old master', 'arena rookie', 'wandering bard'],
  o: ['meteor crater', 'scrapyard raffle', 'lost temple', 'vending machine at the end of the world', 'thunder egg'],
};
const LORE_END = ['It hums when a rival is near.', 'Its owners rarely stay humble.', 'Nobody agrees on who made it first.',
  'It has never lost a staring contest.', 'Handle with flair.', 'The crowds still chant about it.', 'It glows brightest at night.',
  'It looks better after a few dents.', 'Rookies borrow it. Champions get it back.', 'It was last seen winning a bet.', 'Spectators duck on instinct.'];
// Weapons also get a line about the kind of weapon they are, so a bow and a hammer don't read alike.
const LORE_CAT = {
  blade: ['A {n} is drawn fast and sheathed faster.', 'Smiths of the {p} test every {n} on a falling feather.', 'Duelists polish the {n} more than they polish their manners.'],
  heavy: ['It takes two hands and a bad attitude to swing the {n}.', 'The {n} is slow, loud and very hard to argue with.'],
  polearm: ['The {n} keeps trouble exactly one step away.', 'Guards of the {p} swear by the {n}: reach is respect.'],
  chain: ['The {n} never travels in a straight line.', 'Hear the {n} rattle and count your steps backward.'],
  fist: ['No handle, no excuses: the {n} is just you, louder.', 'Brawlers in the {p} wrap their knuckles in {n} lore.'],
  ranged: ['A good {n} shot is ninety percent patience.', 'Scouts of the {p} carry a {n} and a very long grudge.', 'The {n} is happiest when the target thinks it is out of range.'],
  magic: ['The {n} hums a note nobody can quite place.', 'Mages swear the {n} chose them, not the other way round.'],
  exotic: ['Nobody has a manual for the {n}. Nobody wants one.', 'The {n} is what happens when a blacksmith gets curious.'],
  shield: ['The {n} has never lost an argument, only gained dents.', 'Behind the {n}, even a rookie feels like a wall.'],
};
// The hand-written lines in 79-lore.js come first; the generator below covers anything added without a line.
// Seeded by the entry, so a generated line never changes between visits.
function loreRng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
function codexLore(kind, key, name, cat) {
  const t = typeof LORE_LINES === 'object' && LORE_LINES[kind] && LORE_LINES[kind][key];
  if (t) return t;
  const rng = loreRng(kind + key), pickR = a => a[Math.floor(rng() * a.length)];
  const pool = kind === 'w' && LORE_CAT[cat] && rng() < .7 ? LORE_CAT[cat] : LORE[kind] || LORE.w;
  const line1 = pickR(pool).replace(/\{(\w+)\}/g, (_, k) => (k === 'n' ? name : pickR(LORE_FILL[k])));
  return line1[0].toUpperCase() + line1.slice(1) + ' ' + pickR(LORE_END);
}

// ---------- fighter-creator presets ----------
const PRESET_MAX = 8;
const PRESET_FIELDS = ['color', 'hat', 'outfit', 'cls', 'weapon', 'skills', 'throws', 'skins', 'ko', 'pet', 'pose'];
const presetList = () => store.getArr('presets').filter(p => p && typeof p === 'object' && typeof p.name === 'string' && p.name).slice(0, PRESET_MAX);
function presetSave(name, lo, index = -1) {
  const list = presetList(), p = { name: String(name || 'Fighter').slice(0, 18) };
  for (const k of PRESET_FIELDS) if (lo[k] != null) p[k] = JSON.parse(JSON.stringify(lo[k]));
  if (index >= 0 && index < list.length) list[index] = p;
  else if (list.length < PRESET_MAX) list.push(p);
  else return false;
  store.set('presets', list);
  return true;
}
function presetApply(i, lo) {
  const p = presetList()[i];
  if (!p) return false;
  for (const k of PRESET_FIELDS) if (p[k] != null) lo[k] = JSON.parse(JSON.stringify(p[k]));
  lo.preset = p.name;
  return true;
}
function presetDelete(i) { const list = presetList(); list.splice(i, 1); store.set('presets', list); }
