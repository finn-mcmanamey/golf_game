// 67-ai-persona.js: named CPU rivals. A persona gives a CPU a name, a look, favourite gear and a fighting style:
// multipliers on its difficulty knobs (mul / add, applied within the chosen level) plus an optional act(f, L, c)
// that runs at the end of each decision (65 aiDecide) to add the style's signature behaviour.
// Modes opt in per roster entry (`persona: key`) via aiPersonaEntry(); the bot ladder (CPU vs CPU 'watch') has none
// unless cfg.personas asks, so difficulty and weapon balance are measured without them.
// Also here: speech bubbles and taunts (aiSay / aiTalk, drawn by aiTalkDraw from 85-render), the HUD tag, the
// loadout's rival picker and the two settings (SETTINGS.taunts, SETTINGS.adaptive; adaptive itself is in 68).
// API for other slices: aiPersona(key) -> def | null, aiPersonaKeys(), aiPersonaOf(f), aiPersonaEntry(entry, key, o).

const AI_PERSONAS = {};
// Knobs that are chances (clamped to 0..AI_CHANCE_MAX after a persona scales them).
const AI_CHANCE_KEYS = ['attack', 'skill', 'dodge', 'orb', 'idle', 'punish', 'edge', 'jump', 'brawl', 'guard', 'block',
  'parry', 'grab', 'throw', 'super', 'wall', 'loot', 'walk'];
const AI_CHANCE_MAX = .95;

function defPersona(key, def) {
  AI_PERSONAS[key] = Object.assign({ key, mul: {}, add: {}, lines: {}, weapons: [], skills: [], throws: [] }, def);
}
const aiPersona = key => AI_PERSONAS[key] || null;
const aiPersonaKeys = () => Object.keys(AI_PERSONAS);
// The fighter's persona: read lazily from its roster entry, so respawned fighters keep it and summons have none.
function aiPersonaOf(f) {
  if (!f || f.summon || !G_STATE.roster) return null;
  const r = G_STATE.roster[f.id];
  return r && r.persona ? aiPersona(r.persona) : null;
}

// ---------- the rivals ----------
defPersona('torque', {
  name: 'Torque', title: 'Rusher', color: '#ff8a2e', hat: 'horns', cls: 'trickster',   // v3 balance: brute + heavy ran 66-73%
  weapons: ['battle-axe', 'hammer', 'chainsaw'], cats: ['heavy'], skills: ['lunge', 'frenzy', 'uppercut'], throws: ['grenade', 'cluster'],
  mul: { attack: 1.1, idle: .2, walk: 1.4, spacing: .6, guard: .4, block: .6, react: 1.25 }, add: { brawl: .2 },   // balance: ~56% vs a plain Normal CPU
  act(f, L, c) {     // closes long gaps with a dash and swings on arrival
    if (c.style === 'melee' && c.d > c.range * 1.4 && c.d < 520 && f.dashCd <= 0 && f.grounded && chance(.45)) { f.inp.dash = c.dir; f.ai.armed = true; }
  },
  lines: { hi: ['Out of my way!', 'Full speed!'], ko: ['Steamrolled!', 'NEXT!'], parry: ['Huh?!'], combo: ['Keep up!', 'Can\'t stop me!'],
    low: ['Just a scratch!'], win: ['Too slow!', 'Faster next time.'] },
});
defPersona('mirage', {
  name: 'Mirage', title: 'Trickster', color: '#b98cff', hat: 'tophat', cls: 'trickster',
  weapons: ['katana', 'kunai', 'war-fan'], cats: ['blade'], skills: ['blink', 'vanish', 'decoy'], throws: ['smoke', 'sticky'],
  mul: { throw: 2.5, dodge: 1.3 },
  act(f, L, c) {     // dashes through the foe and swings at its back
    const behind = f.ai.foe.P[2].x + c.dir * 110;
    if (c.d > 40 && c.d < 150 && Math.abs(c.dy) < 40 && f.dashCd <= 0 && f.grounded && behind > 80 && behind < W - 80 && chance(.3)) {
      f.inp.dash = c.dir; f.ai.queue = G_STATE.t + .24;
    }
  },
  lines: { hi: ['Now you see me…'], ko: ['Poof!', 'Over here!'], parry: ['Predictable.'], combo: ['Behind you!'],
    low: ['Time to vanish…'], win: ['Didn\'t see that coming?'] },
});
defPersona('vale', {
  name: 'Vale', title: 'Zoner', color: '#5ef2ff', hat: 'cap', cls: 'gunner',
  weapons: ['longbow', 'crossbow', 'sniper'], cats: ['ranged'], skills: ['snare', 'repulse', 'frost-nova'], throws: ['mine', 'ice'],
  mul: { guard: 2, block: 1.6, attack: .9 },
  act(f, L, c) {     // keeps the foe at arm's length: backs off its reach (baiting a whiff) or dashes away from a rusher
    const foe = f.ai.foe;
    if (c.style === 'melee') {
      if (c.d < c.foeRange + 25 && foe.atkCd < .15 && chance(.5)) { aiGoTo(f, f.P[2].x - c.dir * 120, null); f.ai.armed = true; }
    } else if (c.d < 340 && f.dashCd <= 0 && !aiCornered(f, c.dir, 220) && chance(.35)) f.inp.dash = -c.dir;
  },
  lines: { hi: ['Keep your distance.'], ko: ['Bullseye.', 'Range wins.'], parry: ['Not in my zone.'], combo: ['Pinned down!'],
    low: ['Too close!'], win: ['Stay back next time.'] },
});
defPersona('dazzle', {
  name: 'Dazzle', title: 'Show-off', color: '#ff5ad1', hat: 'unicorn', cls: 'mage',
  weapons: ['flame-sword', 'nunchaku', 'lollipop'], skills: ['meteor', 'lightning', 'rocket'], throws: ['cluster', 'grenade'],
  mul: { super: 1.8, jump: 2.5 },
  act(f, L, c) {     // poses when ahead and fires the ultimate the moment it's full, in range or not
    const foe = f.ai.foe, lead = f.hp / f.maxHp - foe.hp / foe.maxHp;
    if (lead > .3 && c.d > 260 && chance(.3)) { f.inp.mx = 0; f.ai.armed = false; if (f.grounded) f.inp.jump = chance(.5); aiTalk(f, 'taunt'); }
    if (f.super >= 100 && !f.ult && chance(.25)) f.inp.super = true;
  },
  lines: { hi: ['Cameras on me!'], ko: ['And the crowd goes wild!', '✨ Flawless ✨'], parry: ['Too easy!'], combo: ['Watch THIS!'],
    low: ['Part of the show!'], win: ['Encore! Encore!'], taunt: ['Is that all?', '😎', 'Try to keep up!'] },
});
defPersona('tamsin', {
  name: 'Tamsin', title: 'Parry Master', color: '#7dffcf', hat: 'kabuto', cls: 'tank',
  weapons: ['katana', 'saber', 'bo-staff'], cats: ['blade'], skills: ['parry', 'chrono', 'mend'], throws: ['ice', 'smoke'],
  mul: { parry: 2.2, block: 1.4, guard: 1.6, attack: .85 }, add: { punish: .2 },
  act(f, L, c) {     // waits at the edge of the foe's reach for it to commit
    const foe = f.ai.foe;
    if (c.style === 'melee' && aiStyle(foe) === 'melee' && c.d < c.foeRange + 30 && foe.atkCd < .1 && chance(.4)) { f.inp.mx = 0; f.ai.armed = c.d < c.range; }
  },
  lines: { hi: ['Show me your strike.'], ko: ['Patience wins.'], parry: ['Denied.', 'Too slow.', 'Read it.'], combo: ['Flow like water.'],
    low: ['Breathe…'], win: ['Calm beats chaos.'] },
});
defPersona('grizz', {
  name: 'Grizz', title: 'Grappler', color: '#ffd84a', hat: 'viking', cls: 'brute',
  weapons: ['fists', 'frying-pan', 'mace'], cats: ['fist'], skills: ['grapple', 'magnet', 'slam'], throws: ['sticky', 'mine'],
  mul: { grab: 2, hold: .7, react: 1.15 },   // balance: ~56% (was 60-63%)
  act(f, L, c) {     // walks into hugging range and grabs
    const foe = f.ai.foe;
    if (c.d > GRAB.reach * 2.2 || Math.abs(c.dy) > 50) return;
    if (c.d > GRAB.reach * .9) aiGoTo(f, foe.P[2].x - c.dir * 30, null);
    else if (f.grabCd <= 0 && !f.holding && canBeGrabbed(f, foe) && chance(.35)) f.inp.grab = true;
  },
  lines: { hi: ['Come here, you!'], ko: ['Bear hug!', 'Pinned!'], parry: ['Hmph.'], combo: ['Can\'t wriggle out!'],
    low: ['Grr…'], win: ['Nobody escapes Grizz!'] },
});
defPersona('magpie', {
  name: 'Magpie', title: 'Orb Hunter', color: '#9dff5a', hat: 'propeller', cls: 'ninja',
  weapons: ['boomerang', 'whip', 'kusarigama'], cats: ['chain'], skills: ['magnet', 'blink', 'mend'], throws: ['smoke', 'grenade'],
  mul: { orb: 3, loot: 2 },
  act(f, L, c) {     // anything shiny on the floor comes first, unless the foe is already in its face
    const me = f.P[2], items = [...ORB_LIST, ...pickupsLive()];
    if (c.d < c.range * .8 && f.hp > f.ai.foe.hp) return;
    let best = null;
    for (const o of items) if (Math.abs(o.x - me.x) < 900 && (!best || Math.abs(o.x - me.x) < Math.abs(best.x - me.x))) best = o;
    if (best) aiGoTo(f, best.x, best.y + 30);
  },
  lines: { hi: ['Ooh, shiny!'], ko: ['Mine now!'], parry: ['Hands off!'], combo: ['Collecting hits!'],
    low: ['Need a power-up!'], win: ['Finders keepers!'] },
});
defPersona('fenn', {
  name: 'Fenn', title: 'Berserker', color: '#ff4a6a', hat: 'mohawk', cls: 'none',   // no class: brute + heavy ran ~70%
  weapons: ['double-axe', 'battle-axe', 'scythe'], cats: ['heavy'], skills: ['frenzy', 'slam', 'tremor'], throws: ['grenade', 'cluster'],
  // balance (v3 integration): 70% vs a plain Normal CPU -> ~60%: slower reads, and the ultimate goes off the moment it's full
  mul: { guard: 0, block: .3, parry: .3, idle: 0, dodge: .6, attack: 1.15, super: 2, react: 1.25 }, add: { brawl: .25 },
  act(f, L, c) {     // the more hurt, the wilder: always armed, dashes in more as health drops, no patience for the super
    const rage = 1 - f.hp / f.maxHp;
    f.ai.armed = true;
    if (c.d > c.range && f.dashCd <= 0 && chance(.15 + rage * .5)) f.inp.dash = c.dir;
    if (f.super >= 100 && !f.ult) f.inp.super = true;
  },
  lines: { hi: ['RAAAGH!'], ko: ['MORE!', 'WHO\'S NEXT?!'], parry: ['GRR!'], combo: ['SMASH! SMASH!'],
    low: ['NOW I\'M ANGRY!', '💢'], win: ['BLOOD AND THUNDER!'] },
});
defPersona('ivo', {
  name: 'Ivo', title: 'Tactician', color: '#c9d2e8', hat: 'gradcap', cls: 'mage',
  weapons: ['halberd', 'spear', 'trident'], cats: ['polearm'], skills: ['repulse', 'gravity-well', 'snare'], throws: ['mine', 'ice'],
  mul: { grab: 1.6, throw: 1.5, edge: 1.5 },
  act(f, L, c) {     // stands on the far side of a foe near a drop or hazard, so every hit pushes it toward the danger
    const side = aiThrowDir(f.ai.foe);
    if (!side || c.d > 420) return;
    aiGoTo(f, f.ai.foe.P[2].x - side * c.range * .6, feetY(f.ai.foe));
    if (Math.sign(f.ai.foe.P[2].x - f.P[2].x) === side) f.ai.armed = true;
  },
  lines: { hi: ['I\'ve studied this arena.'], ko: ['As calculated.', 'Mind the edge.'], parry: ['Anticipated.'], combo: ['Checkmate soon.'],
    low: ['Recalculating…'], win: ['Strategy over strength.'] },
});
defPersona('skitter', {
  name: 'Skitter', title: 'Coward', color: '#c0ff7a', hat: 'bunny', cls: 'ninja',
  weapons: ['slingshot', 'shotgun', 'kunai'], cats: ['ranged'], skills: ['vanish', 'blink', 'mend'], throws: ['smoke', 'ice'],
  mul: { dodge: 1.5, guard: 1.3, aimErr: .7, react: .85 },   // balance: jumpy reflexes and steadier aim (40% -> ~50%)
  act(f, L, c) {     // low and losing: runs (toward orbs if any), fights back only when cornered
    const foe = f.ai.foe;
    if (f.hp / f.maxHp > .25 || f.hp >= foe.hp || aiCornered(f, c.dir, 140)) return;
    aiGoTo(f, f.P[2].x - c.dir * 300, null);
    f.ai.armed = c.d < c.range;
    if (c.d < 220 && f.dashCd <= 0 && chance(.4)) f.inp.dash = -c.dir;
  },
  lines: { hi: ['C-can we talk about this?'], ko: ['I… I won?!', 'Sorry! Sorry!'], parry: ['Eep!'], combo: ['Lucky hits!'],
    low: ['Not the face!', 'Mercy!', '😱'], win: ['Phew…'] },
});

// ---------- per-fighter knobs ----------
// The knobs a CPU actually plays with: its level, nudged by adaptive difficulty (68), then shaped by its persona,
// then by what it has learned about a human's habits (68). With none of those it is a plain copy of the level.
function aiTuned(f) {
  const L = Object.assign({}, aiBaseLevel(f));
  aiAdaptBlend(L, f);
  const p = aiPersonaOf(f);
  if (p) {
    for (const k in p.mul) if (typeof L[k] === 'number') L[k] = aiChance(k, L[k] * p.mul[k]);
    for (const k in p.add) L[k] = aiChance(k, (L[k] || 0) + p.add[k]);
  }
  aiHabitKnobs(L, f);
  return L;
}
// A persona-scaled knob kept in range (only chances; px and seconds knobs just scale).
const aiChance = (k, v) => AI_CHANCE_KEYS.includes(k) ? clamp(v, 0, k === 'walk' ? 1 : AI_CHANCE_MAX) : v;

// The persona's signature move, once per decision (not in objective modes, where the mode steers the CPU).
function aiPersonaAct(f, L, c) {
  const p = aiPersonaOf(f);
  if (!p || !p.act || !f.ai.foe || G_STATE.lock > 0 || f.heldBy || f.holding || (G_STATE.mode && G_STATE.mode.aiGoal)) return;
  try { p.act(f, L, c); } catch (e) { report(e, 'persona ' + p.key); }
}

// ---------- roster entries ----------
// Makes a roster entry (or a tournament ladder slot) this persona. key: a persona key, 'random' (one not in
// o.avoid), or 'none'/falsy to leave the entry alone. o.gear: 'force' (favourite gear replaces the mode's),
// 'fill' (default: only 'random' picks are replaced) or false. o.color: false keeps the entry's colour;
// o.avoidColor: keep the entry's colour if the persona's is too close to it. o.hat: false keeps the hat.
// o.caps: false keeps the name's case (ladders print 'Torque', HUDs 'TORQUE').
function aiPersonaEntry(entry, key, o = {}) {
  if (!key || key === 'none') return entry;
  const p = key === 'random' ? aiPersona(pick(aiPersonaKeys().filter(k => !(o.avoid || []).includes(k)))) : aiPersona(key);
  if (!p) return entry;
  entry.persona = p.key; entry.title = p.title;
  if (!o.keepName) entry.name = o.caps === false ? p.name : p.name.toUpperCase();
  if (o.gear !== false) aiPersonaGear(entry, p, o.gear === 'force');
  if (o.color !== false && !(o.avoidColor && aiColorNear(p.color, o.avoidColor))) entry.color = p.color;
  if (o.hat !== false && HATS[p.hat] && (o.gear === 'force' || !entry.hat || entry.hat === 'random' || entry.hat === 'none')) entry.hat = p.hat;
  return entry;
}
function aiPersonaGear(e, p, force) {
  const skills = shuffle(p.skills.filter(k => SKILLS[k] && !SKILLS[k].hidden));
  if (force || !e.weapon || e.weapon === 'random') e.weapon = modeWeapon(shuffle(p.weapons.slice()), p.cats);
  if (force || !Array.isArray(e.skills)) e.skills = ['random', 'random'];
  e.skills = e.skills.map(k => k === 'random' ? skills.shift() || 'random' : k);
  if (CLASSES[p.cls] && e.cls !== 'none' && (force || !e.cls || e.cls === 'random')) e.cls = p.cls;
  const th = p.throws.filter(k => THROWABLES[k]);
  if (th.length && (force || !e.throws || e.throws.includes('random'))) e.throws = (e.throws || ['random', 'random']).map((k, i) => force || k === 'random' ? th[i % th.length] : k);
}
function aiColorNear(a, b) {
  const rgb = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) || 0), A = rgb(a), B = rgb(b);
  return A.reduce((s, v, i) => s + (v - B[i]) ** 2, 0) < 150 * 150;
}
// A shuffled list of n distinct persona keys (repeats only past ten).
function aiPersonaDraw(n) {
  const keys = shuffle(aiPersonaKeys());
  return Array.from({ length: n }, (_, i) => keys[i % keys.length]);
}

// ---------- speech bubbles ----------
// One line at a time per fighter (each ≥ AI_TALK.each s apart), and at most one new bubble every AI_TALK.gap s
// overall, so an 8-fighter brawl doesn't turn into a chat room. Off with SETTINGS.taunts = false.
const AI_TALK = { list: [], lastT: -9, gap: 1.1, each: 3.5, life: 1.9, said: 0 };
const AI_TALK_LINES = { hi: ['Let\'s go!'], ko: ['Down you go!', 'Gotcha!'], parry: ['Blocked!', 'Nope!'], combo: ['Combo!'],
  low: ['Ouch…'], win: ['Too easy!', 'GG!'], taunt: ['Come on!'] };

function aiTalkOk(f) {
  if (!f || !aiBrain(f) || f.summon || G_STATE.demo || (typeof SETTINGS !== 'undefined' && SETTINGS.taunts === false)) return false;
  return !!aiPersonaOf(f) || F.filter(o => !o.summon).length <= 2;    // crowds: only the named rivals talk
}
// Puts `text` over f's head. force: skips the global gap (round wins, reads). Returns true if shown.
function aiSay(f, text, force) {
  const t = G_STATE.t;
  if (!aiTalkOk(f) || t - (f.ai.sayT ?? -9) < AI_TALK.each || (!force && t - AI_TALK.lastT < AI_TALK.gap)) return false;
  f.ai.sayT = AI_TALK.lastT = t;
  AI_TALK.list = AI_TALK.list.filter(b => b.f !== f && t - b.t < AI_TALK.life);
  const p = aiPersonaOf(f);
  AI_TALK.list.push({ f, text, t, color: p ? p.color : f.color });
  AI_TALK.said++;
  return true;
}
function aiTalk(f, kind, force) {
  const p = aiPersonaOf(f), lines = (p && p.lines[kind]) || AI_TALK_LINES[kind];
  return lines ? aiSay(f, pick(lines), force) : false;
}

on('ko', (V, K) => { if (K && K !== V && K.alive) aiTalk(K, 'ko'); });
on('parry', B => aiTalk(B, 'parry'));
on('hit', A => { if (A.combo === 4) aiTalk(A, 'combo'); });
on('damage', B => {
  if (!B.alive || B.ai.lowSaid || B.hp > B.maxHp * .25) return;
  B.ai.lowSaid = true; aiTalk(B, 'low');
});
on('roundEnd', team => {
  const w = F.find(f => f.alive && f.team === team && aiTalkOk(f));
  if (w && chance(.75)) aiTalk(w, 'win', true);
});
on('roundStart', round => {
  AI_TALK.list = [];
  if (round === 1) { const f = F.find(o => aiPersonaOf(o) && aiTalkOk(o)); if (f) aiTalk(f, 'hi', true); }
});

// Drawn in world space after the fighters (85 render). A rounded bubble with a tail, popping in and fading out.
function aiTalkDraw(ctx) {
  if (G_STATE.state === 'killcam' || !AI_TALK.list.length) return;
  const t = G_STATE.t;
  AI_TALK.list = AI_TALK.list.filter(b => t - b.t < AI_TALK.life && t >= b.t && F.includes(b.f));
  for (const b of AI_TALK.list) aiBubble(ctx, b, t - b.t);
}
function aiBubble(ctx, b, age) {
  const f = b.f, head = f.P[0], pop = Math.min(1, age * 9), fade = clamp((AI_TALK.life - age) / .3, 0, 1);
  const x = clamp(head.x, 90, W - 90), y = head.y - (HEAD_R + 34) * f.scale - Math.max(0, hatReach(f.hat) - 1) * HEAD_R;
  if (IS_TOUCH && typeof ctx.getTransform === 'function') {   // not over the on-screen skill buttons (low corners)
    const m = ctx.getTransform(), sx = (m.a * x + m.e) / VIEW.dpr, sy = (m.d * y + m.f) / VIEW.dpr;
    if (sy > innerHeight * .45 && (sx < innerWidth * .26 || sx > innerWidth * .74)) return;
  }
  ctx.save();
  ctx.globalAlpha = fade; ctx.translate(x, y); ctx.scale(pop, pop);
  ctx.font = `13px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(b.text).width + 20, h = 26;
  ctx.fillStyle = 'rgba(8,9,22,.9)'; ctx.strokeStyle = b.color; ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-w / 2, -h, w, h, 9); else ctx.rect(-w / 2, -h, w, h);
  ctx.moveTo(-6, 0); ctx.lineTo(head.x - x, 10); ctx.lineTo(6, 0);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillText(b.text, 0, -h / 2 + 1);
  ctx.restore();
}

// HUD: the persona's title as a small pill after the weapon label on its card (85 drawCard).
function aiPersonaHudTag(f, x, y, dir) {
  const p = aiPersonaOf(f);
  if (!p) return;
  ctx.font = `10px ${FONT_DISPLAY}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const txt = p.title.toUpperCase(), w = ctx.measureText(txt).width + 12, cx = x + dir * w / 2;
  ctx.strokeStyle = p.color; ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - w / 2, y - 8, w, 16, 8); else ctx.rect(cx - w / 2, y - 8, w, 16);
  ctx.fillStyle = '#0a0b18'; ctx.fill();            // opaque, so the chip reads on any arena
  ctx.fillStyle = rgba(p.color, .18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = p.color; ctx.fillText(txt, cx, y + .5);
}

// ---------- settings and the loadout's rival picker (UI slices load later: wired at boot) ----------
const AI_SETTING_DEFAULTS = { taunts: true, adaptive: true };
on('boot', () => {
  if (typeof SETTINGS === 'undefined') return;
  for (const k in AI_SETTING_DEFAULTS) {
    if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = AI_SETTING_DEFAULTS[k];
    if (!(k in SETTINGS)) SETTINGS[k] = AI_SETTING_DEFAULTS[k];
  }
  if (typeof SCREENS === 'undefined') return;
  aiWrapScreen('settings', aiSettingsExtras);
  aiWrapScreen('loadout', aiLoadoutExtras);
});
function aiWrapScreen(name, extra) {
  const build = SCREENS[name];
  if (typeof build !== 'function') return;
  SCREENS[name] = () => {
    const node = build();
    try { extra(node); } catch (e) { report(e, 'ai ' + name); }
    return node;
  };
}
function aiSettingsExtras(node) {
  const grid = node.querySelector && node.querySelector('.set-grid');
  if (!grid) return;
  const set = k => v => setSetting(k, v);
  grid.append(el('section', { class: 'set-group' }, el('h3', { text: 'CPU rivals' }),
    toggleField('Taunts & reactions', SETTINGS.taunts, set('taunts'), 'Speech bubbles from CPU rivals.'),
    toggleField('Adaptive difficulty', SETTINGS.adaptive, set('adaptive'), 'Quietly keeps 1P vs CPU matches close, within the chosen level. Never in Ranked.')));
}
// Versus: pick which rival plays the CPU side (Random by default, or a plain CPU).
function aiLoadoutExtras(node) {
  if (MENU.mode !== 'versus' || !isCpuPicker(LO.picker) || !node.querySelector) return;
  const lo = menuLoadout(LO.picker), cur = lo.persona || 'random', pick = node.querySelector('.lo-pick');
  const opt = (k, text, color) => el('button', { 'aria-pressed': String(cur === k), 'data-key': 'persona-' + k, style: color ? { color } : null,
    onclick: () => { lo.persona = k; saveMenu(); uiSfx('click'); refreshScreen(); } }, text);
  const row = el('div', { class: 'field' }, el('span', { class: 'lbl', text: 'Rival' }), el('div', { class: 'seg' },
    opt('random', '🎲 Random'), opt('none', 'Plain CPU'), aiPersonaKeys().map(k => opt(k, AI_PERSONAS[k].name, AI_PERSONAS[k].color))));
  if (pick) pick.prepend(row);
  const who = node.querySelector('.lo-who'), p = aiPersona(cur);
  if (who) who.append(el('small', { text: p ? ` · ${p.name} the ${p.title}` : cur === 'none' ? ' · plain CPU' : ' · a random rival' }));
}
