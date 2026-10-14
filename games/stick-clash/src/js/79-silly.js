// 79-silly.js (v4): before each round of a 2-human duel (cfg.silly 'vote') both players vote on 3 one-round rules (79's hooks).
const SILLY = {};
const defSilly = (key, def) => defLook(SILLY, key, def);
const SILLY_MUTS = ['lowgrav', 'tiny', 'explosive', 'vampire', 'ricochet', 'supercharged'];
const SILLY_TIME = 7;
const VOTE = { open: false, opts: [], cur: [1, 1], pick: [-1, -1], t: 0, el: null };
let SILLY_ON = null;
const SILLY_BOOMS = [];  // Explosive Hits blast next step, not inside a damage event

defSilly('bouncy', { name: 'Bouncy Floor', icon: '🏀', desc: 'Hard landings bounce you back up.', step: sillyBounce });
defSilly('giant', { name: 'Giant Heads', icon: '🗿', desc: 'Enormous heads. Very hard to miss.', fighter(f) { f.headMul = f.headHit = 2.4; } });   // hitbox too (20)
defSilly('reverse', { name: 'Reversed Controls', icon: '🔄', desc: 'Left is right and right is left!', round: sillyReverse });
defSilly('slippery', { name: 'Slippery Floor', icon: '🧊', desc: 'Everything is ice.', round() { PHYS.friction *= .2; } });
defSilly('boom', { name: 'Explosive Hits', icon: '💥', desc: 'Every solid hit goes off with a bang.',
  hit(B, amt, o) { if (!o.blast && o.src && o.src !== B && amt >= 6 && /^(melee|proj)$/.test(o.kind || 'melee')) SILLY_BOOMS.push([chest(B), o.src]); } });
defSilly('zoom', { name: 'Super Speed', icon: '⚡', desc: 'Everyone runs half again as fast.', fighter(f) { f.spdMul = (f.spdMul || 1) * 1.5; } });

function sillyBounce() {  // a hard landing bounces back at 80 % of the fall speed
  for (const f of F) {
    if (!f.grounded) f.mem.sillyFall = Math.max(f.mem.sillyFall || 0, vy(f.P[2]));
    else { if (f.alive && f.mem.sillyFall > 250) for (const p of f.P) kick(p, 0, -Math.min(1300, f.mem.sillyFall * .8)); f.mem.sillyFall = 0; }
  }
}
// Left/right flip around each player's drive (MAP.frame, 58) and back after, so no input is lost.
function sillyReverse() {
  const base = MAP.frame;
  MAP.frame = function (f, phase, enter) {
    const flip = phase === 'drive' && f.ctrl === 'human' && !f.autopilot;
    if (flip && !enter) f.inp.mx = -f.inp.mx;
    if (base) base.call(this, f, phase, enter);
    if (flip && enter) { f.inp.mx = -f.inp.mx; f.inp.dash = -f.inp.dash; }
  };
}
const sillyDef = key => SILLY[key] || MUTATORS[key];
// Also for fighters entering mid-round (71), with this round's rule only (VOTE.map).
function sillyFighter(f) { if (SILLY_ON && VOTE.map === MAP && !f.summon) hook(SILLY_ON, 'fighter', f); }

on('roundStart', round => {
  SILLY_ON = null; VOTE.open = false; SILLY_BOOMS.length = 0;
  if (!G_STATE.cfg.autopilot && G_STATE.cfg.silly === 'vote' && duoPair() && !(MINI && !MINI.over && MINI.round === round)) {  // not a mini-game
    const pool = [...listOf(SILLY), ...SILLY_MUTS.map(k => MUTATORS[k]).filter(m => m && !mutActive(m.key))];
    Object.assign(VOTE, { open: true, opts: shuffle(pool).slice(0, 3).map(d => d.key), cur: [1, 1], pick: [-1, -1], t: SILLY_TIME });
    BANNER = null;
  }
  sillyRender();
});
on('mapStep', dt => {
  if (SILLY_ON) hook(SILLY_ON, 'step', dt);
  for (const [c, src] of SILLY_BOOMS.splice(0)) explode(c.x, c.y, 85, 3, src, { kind: 'skill', color: '#ff8a2e', kb: 620 });
  if (!VOTE.open) return;
  G_STATE.lock = Math.max(G_STATE.lock, 1);
  G_STATE.override = G_STATE.override || sillyHold;  // the world waits, frozen (sims step it locked)
  if (BANNER && BANNER.b === 'FIGHT!') BANNER = null;  // 94's controls card restarts it
  sillyTick(dt);
});
function sillyHold(dt) { if (!VOTE.open) G_STATE.override = null; else if (G_STATE.state === 'play') sillyTick(dt); }  // lets go after the vote
function sillyTick(dt) {
  if ((VOTE.t -= dt) <= 0 || Math.min(...VOTE.pick) >= 0) sillyResolve();
  else if (!VOTE.el || VOTE.el.hidden) sillyRender();
  else VOTE.el.querySelector('i').style.setProperty('--t', VOTE.t / SILLY_TIME);
}
on('damage', (B, amt, o) => { if (SILLY_ON && o) hook(SILLY_ON, 'hit', B, amt, o); });
on('ko', (V, K) => { if (SILLY_ON && !V.summon) hook(SILLY_ON, 'ko', V, K); });
on('state', sillyRender);

function sillyResolve() {
  const p = VOTE.pick.map(k => k < 0 ? rndi(0, 2) : k), same = p[0] === p[1];
  VOTE.open = false; VOTE.map = MAP;
  SILLY_ON = sillyDef(VOTE.opts[same ? p[0] : pick(p)]);
  G_STATE.lock = TUNE.startLock;
  hook(SILLY_ON, 'round');
  F.forEach(sillyFighter);
  banner(SILLY_ON.name.toUpperCase(), same ? 'YOU BOTH PICKED IT!' : 'THIS ROUND ONLY', 2.2, '#ffd84a');
  sfx('round');
  sillyRender();
}
function sillyInput(s, act) {  // act: 'left' | 'right' | 'ok'
  if (!VOTE.open || !act || !(s === 0 || s === 1) || VOTE.pick[s] >= 0) return;
  if (act === 'ok') VOTE.pick[s] = VOTE.cur[s];
  else VOTE.cur[s] = (VOTE.cur[s] + (act === 'left' ? 2 : 1)) % 3;
  uiSfx(act === 'ok' ? 'chime' : 'nav');
  sillyRender();
}
const sillyKeys = s => keySets()[JOINED ? (JOINED[s] || {}).keys : s] || {};   // player s's own key set (93's lobby seat order)
// Shown once the world waits for it: after 94's card, with the touch seats (table mode) known.
const sillyLive = () => VOTE.open && G_STATE.state === 'play' && G_STATE.override === sillyHold;
const sillyAct = (a, l, r, ok) => a === l ? 'left' : a === r ? 'right' : ok.includes(a) ? 'ok' : '';
addEventListener('keydown', e => {
  if (sillyLive() && !e.repeat) for (const s of [0, 1]) { const b = sillyKeys(s); sillyInput(s, sillyAct(e.code, b.left, b.right, [b.attack, b.jump])); }
});
on('pad', (a, s) => { if (sillyLive()) sillyInput(s, sillyAct(a, 'left', 'right', ['jump', 'attack'])); });

// One side per player; in table mode P2's faces them.
function sillyRender() {
  const show = sillyLive(), table = show && typeof tableActive === 'function' && tableActive();
  if (!VOTE.el) { if (!show) return; document.body.append(VOTE.el = el('div', { role: 'dialog' })); }
  VOTE.el.hidden = !show;
  VOTE.el.className = 'vote' + (table ? ' table' : '');
  if (show) VOTE.el.replaceChildren(el('div', { class: 'vote-card' }, el('div', { class: 'vote-head' }, `Silly rules · Round ${G_STATE.round}`,
    el('i', { style: { '--t': VOTE.t / SILLY_TIME } })), el('div', { class: 'vote-sides' }, [0, 1].map(s => sillySide(s, table)))));
}
// Key caps (or pad buttons) to choose and pick; "Tap a rule" on the touch screen.
function sillyHow(s) {
  const k = ['left', 'right', 'attack'].map(a => keyHint(s, a));
  return k[0] ? el('div', { class: 'kr vote-how' }, keyCap(k[0]), keyCap(k[1]), el('span', { text: 'choose · ' }), keyCap(k[2]), el('span', { text: 'picks' }))
    : el('small', { text: 'Tap a rule' });
}
function sillySide(s, table) {
  const r = G_STATE.roster.find(x => x.ctrl === 'human' && x.slot === s), done = VOTE.pick[s] >= 0;
  return el('section', { class: 'vote-side' + (table && s ? ' flip' : ''), style: { '--pc': r.color } }, el('h3', { text: r.name + (done ? ' ✓' : '') }),
    VOTE.opts.map((k, i) => { const d = sillyDef(k); return el('button', { tabindex: '-1', class: 'vote-opt' + (VOTE.cur[s] === i ? ' cur' : '') + (VOTE.pick[s] === i ? ' picked' : ''),
      onpointerdown: e => { e.preventDefault(); if (!done) { VOTE.cur[s] = i; sillyInput(s, 'ok'); } } }, el('span', { text: d.icon }), el('strong', { text: d.name }), el('small', { text: d.desc })); }),
    done ? el('small', { text: 'Locked in!' }) : sillyHow(s));
}
