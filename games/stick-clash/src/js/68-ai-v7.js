// 68-ai-v7.js: smarter, funnier CPUs (v7). Everything hooks in from here; no other slice is edited.
// 1. Tricks: weapon brains for signature moves the CPU used to miss (the Meteor Flail's hot rocket, the Thornvine's
//    growth, the Anchor Drop, the Chrono Katana's third cut) and throwables saved for an opening.
// 2. Smarter play, scaled by level (AI_V7_LEVELS, merged into AI_LEVELS so personas and adaptive difficulty shape them):
//    read a human's telegraphed charge and get out of its reach (then punish the release), bait a human's whiff at
//    the edge of its reach (both only against people, like 65's flinch, so weapon balance between CPUs is untouched), swap a weak weapon for a clearly better one lying close, and in Volley Clash get back over the net.
// 3. Personality: lines that react to what just happened (a pillow to the face, a banana slip, losing to a frying pan,
//    a comeback, revenge on whoever won the last round), boasts after a trick or a ring-out, showing off when far
//    ahead (low levels more often) and, at low levels, celebrating a big hit too early (a v4-style slip).
// Per-decision logic runs from a THINK_AFTER hook that notices 65's decision timer resetting; inputs it changes go
// back through aiSafety, so no new move walks or dashes off a ledge. Talk respects SETTINGS.taunts (67's aiSay).

// trick: chance to use a weapon trick this pass adds; read: chance to respect a telegraphed charge or big windup;
// bait: chance per decision to hover at a melee foe's reach for a whiff; upgrade: chance to go for a better weapon;
// showoff: × react × .2 per decision (so per second) to show off when far ahead; early: chance a big hit makes it celebrate too soon (slip).
const AI_V7_LEVELS = {
  easy: { trick: .45, read: .12, bait: 0, upgrade: .3, showoff: .5, early: .3 },
  normal: { trick: .75, read: .35, bait: .05, upgrade: .6, showoff: .3, early: .12 },
  hard: { trick: .95, read: .62, bait: .12, upgrade: .9, showoff: .15, early: .03 },
  insane: { trick: 1, read: .8, bait: .16, upgrade: 1, showoff: .08, early: 0 },
};
for (const k in AI_V7_LEVELS) if (AI_LEVELS[k]) Object.assign(AI_LEVELS[k], AI_V7_LEVELS[k]);
AI_CHANCE_KEYS.push('trick', 'read', 'bait', 'upgrade', 'showoff', 'early');
// meteor: share of decisions a CPU lights the Meteor Flail (every chance it got ran it at ~73% in tools/balance.cjs).
const AI_V7 = { meteor: .3, lead: .45, showFar: 320, bigHit: 14, wary: .55, upgradeNear: 380, mem: {}, lines: 0 };

// ---------- per-decision hook ----------
// 65 resets f.ai.t at every decision; a jump up in it means a fresh decision was just made this step.
function aiV7After(f, dt) {
  const a = f.ai;
  if (!f.alive || !a || !a.L || f.summon || a.behave === 'idle' || a.behave === 'roam' || G_STATE.lock > 0) return;
  const fresh = a.t > (a.v7t ?? -1);
  a.v7t = a.t;
  if (fresh) a.v7n = (a.v7n || 0) + 1;         // decision counter: weapon brains roll their trick once per decision
  if (f.heldBy || f.holding || !canAct(f)) return;
  let touched = aiV7Volley(f);
  const foe = a.foe;
  if (foe && foe.alive) {
    if (fresh) touched = aiV7Decide(f, a.L, foe) || touched;
    touched = aiV7Wary(f, foe) || touched;
    touched = aiV7Punish(f, foe) || touched;
  }
  if (touched && MAP) aiSafety(f);
}

function aiV7Decide(f, L, foe) {
  const c = aiSense(f, foe), zone = !!(G_STATE.mode && G_STATE.mode.aiGoal);
  if (aiV7ReadCharge(f, L, foe, c)) return true;
  if (aiV7ShowOff(f, L, foe, c)) return true;
  aiV7Opening(f, L, foe, c);
  if (zone) return false;                      // objective modes steer movement themselves
  return aiV7Upgrade(f, L, c) || aiV7Bait(f, L, foe, c);
}

// ---------- telegraphs: charges you can see coming ----------
// A foe charging a big move: { reach (px from its hips), guard (true if a guard helps) } or null.
function aiV7Telegraph(foe) {
  const m = foe.mem || {}, w = foe.wkey;
  if (w === 'graviton' && (m.gravArmed || m.gravHold > .25)) return { reach: 230, guard: false };
  if (w === 'rock-guitar' && (m.gtrArmed || m.gtrHold > .3)) return { reach: 320, guard: false };
  if (w === 'meteor-flail' && m.meteorHeat > .45) return { reach: aiReach(foe) + 70, guard: true };
  if (w === 'anchor' && !foe.grounded && m.drop) return { reach: 130, guard: false, under: true };
  return null;
}
function aiV7ReadCharge(f, L, foe, c) {
  const tg = !aiBrain(foe) && aiV7Telegraph(foe), a = f.ai;
  if (!tg || c.d > tg.reach + 40 || !chance(L.read)) return false;
  a.v7wary = { until: G_STATE.t + AI_V7.wary, reach: tg.reach, guard: tg.guard, foe, charged: true };
  a.armed = false;
  return true;
}
// Big two-handed windups: a CPU in reach that didn't parry may simply step out of the swing.
on('attack', A => {
  if (aiBrain(A) || !A.alive || G_STATE.lock > 0 || !A.w || A.w.ranged || !(A.w.twoHanded || (A.w.cd || 0) >= .95)) return;
  for (const B of F) {
    if (!B.alive || B === A || B.team === A.team || !aiBrain(B) || B.summon || !B.ai || !B.ai.L || B.blocking) continue;
    const d = Math.abs(B.P[2].x - A.P[2].x);
    if (d > aiReach(A) + 30 || Math.abs(B.P[2].y - A.P[2].y) > 120 || !chance(B.ai.L.read * .5)) continue;
    B.ai.v7wary = { until: G_STATE.t + .35, reach: aiReach(A) + 30, guard: true, foe: A };
  }
});
// Keeps out of a read move's reach every step; cornered, it guards (or hops). When the charge ends, it punishes.
function aiV7Wary(f, foe) {
  const w = f.ai.v7wary;
  if (!w) return false;
  const A = w.foe, t = G_STATE.t;
  if (!A.alive || t > w.until || (w.charged && !aiV7Telegraph(A))) {
    f.ai.v7wary = null;
    if (w.charged && A.alive && chance(f.ai.L.punish)) f.ai.v7punish = t + .4;
    return false;
  }
  const dx = f.P[2].x - A.P[2].x, away = Math.sign(dx) || -A.face, d = Math.abs(dx);
  if (d > w.reach + 20) { f.inp.mx = 0; return true; }
  if (aiCornered(f, -away, 120)) {
    if (w.guard) aiGuard(f, 0, .3); else if (f.grounded) aiHopOver(f, { dir: -away });
  } else {
    f.inp.mx = away; f.inp.attackHeld = false; f.ai.armed = false;
    if (d < w.reach * .6 && f.dashCd <= 0 && f.grounded) f.inp.dash = away;
  }
  return true;
}
// The charge is spent (or the swing whiffed): dash back in and swing.
function aiV7Punish(f, foe) {
  const until = f.ai.v7punish;
  if (!until) return false;
  if (G_STATE.t > until || f.w.ranged) { f.ai.v7punish = 0; return false; }
  const dx = foe.P[2].x - f.P[2].x, d = Math.abs(dx), range = aiReach(f);
  if (d > range * 2.6) return false;
  if (d > range * .9 && f.dashCd <= 0 && f.grounded) { f.inp.dash = Math.sign(dx); f.ai.queue = G_STATE.t + .05; }
  else if (f.atkCd <= 0) f.inp.attack = true;
  f.ai.v7punish = 0;
  return true;
}

// ---------- bait a whiff ----------
// Hover just outside a melee foe's reach; if it swings at air, 'attack' below turns the miss into a punish.
function aiV7Bait(f, L, foe, c) {
  if (aiBrain(foe) || c.style !== 'melee' || aiStyle(foe) !== 'melee' || foe.w.ranged || Math.abs(c.dy) > 50) return false;
  if (c.d < c.foeRange - 20 || c.d > c.foeRange + 90 || aiCornered(f, c.dir, 140) || !chance(L.bait)) return false;
  f.ai.v7bait = G_STATE.t + .7;
  f.ai.armed = false;
  aiGoTo(f, foe.P[2].x - c.dir * (c.foeRange + 30), null);
  return true;
}
on('attack', A => {
  for (const B of F) {
    if (!B.alive || !B.ai || !aiBrain(B) || B.ai.foe !== A || G_STATE.t > (B.ai.v7bait || 0)) continue;
    B.ai.v7bait = 0;
    if (Math.abs(B.P[2].x - A.P[2].x) > aiReach(A) - 10) B.ai.v7punish = G_STATE.t + .45;   // it swung at air
  }
});

// ---------- throwables at an opening ----------
// A foe that can't dodge right now (stunned, frozen, down, stuck, taunting) is the best moment for a throwable.
function aiV7Open(foe) {
  const s = foe.status || {};
  return !!(s.stun || s.freeze || s.snowman || s.pinned || s.tethered || s.timewarp || foe.guardBroken > 0 || !aiUpright(foe) || (foe.mem && foe.mem.taunt));
}
function aiV7Opening(f, L, foe, c) {
  if (f.throwCd > 0 || f.throwN[0] + f.throwN[1] <= 0 || !f.ai.los || f.inp.throw || !aiV7Open(foe)) return;
  if (aiThrowFits(f, foe, c.d) && chance(Math.min(.9, (L.throw || 0) * 1.6))) f.inp.throw = true;
}

// ---------- better weapon lying close ----------
const AI_V7_TIER = { common: 1, rare: 2, epic: 3, mythic: 4 };
const aiV7Worth = key => { const w = WEAPONS[key]; return !w || key === 'fists' ? 0 : AI_V7_TIER[w.tier] || 1.5; };
function aiV7Upgrade(f, L, c) {
  if (isBare(f) || f.mount || c.d < c.range * 1.4) return false;
  const me = f.P[2], mine = aiV7Worth(f.wkey);
  let best = null, bd = AI_V7.upgradeNear;
  for (const p of pickupsLive()) {
    const d = Math.abs(p.x - me.x);
    if (p.t > .3 && d < bd && Math.abs(p.y - feetY(f)) < 140 && aiV7Worth(p.wkey) >= mine + 1) { bd = d; best = p; }
  }
  if (!best || !chance(L.upgrade)) return false;   // rolled only when there is one (seeded fights stay as they were)
  aiGoTo(f, best.x, best.y + 8);
  if (Math.hypot(best.x - me.x, best.y - feetY(f) + 20) < ARMS.swap - 6 && f.grabCd <= 0) f.inp.grab = true;   // grab with nobody near = swap
  return true;
}

// ---------- Volley Clash: get back over the net ----------
// Knocked (or hopped) onto the rival's court, a CPU used to stand there all point. Run at the net and clear it with a
// double jump; on its own court it never hops or dashes across.
function aiV7Volley(f) {
  if (!G_STATE.mode || G_STATE.mode.key !== 'volley' || typeof VC_NET === 'undefined') return false;
  const me = f.P[2], home = f.team % 2 ? 1 : -1, side = Math.sign(me.x - VC_NET.x) || home;
  if (side === home) {
    const n = f.ai.nav;
    if (n && n.hop === -home && Math.abs(me.x - VC_NET.x) < 260) f.ai.nav = null;
    if (f.inp.dash === -home && Math.abs(me.x - VC_NET.x) < 300) f.inp.dash = 0;
    return false;
  }
  const gap = Math.abs(me.x - VC_NET.x);
  f.inp.mx = home; f.ai.tx = VC_NET.x + home * 120;
  if (f.grounded && gap < 150 && f.jumpCd <= 0 && !aiLeaping(f)) { f.inp.jump = true; f.ai.nav = { hop: home, t: 1.1 }; }
  return true;
}

// ---------- trick brains (v5 weapons load later: patched at boot) ----------
const aiV7Trick = f => chance(aiLevel(f).trick ?? .75);
// Meteor Flail: v5's brain re-rolled its hold every step, so the thruster never stayed lit long enough to get hot.
// Light it on the way in, keep it lit, and swing the moment it's hot and in reach.
function aiV7MeteorThink(f, foe, d) {
  const m = f.mem, t = G_STATE.t;
  if (t < (m.meteorHot || 0)) { f.inp.attackHeld = false; f.ai.armed = true; if (d > aiReach(f) * 1.1 && d < 330 && f.dashCd <= 0 && f.grounded) f.inp.dash = Math.sign(foe.P[2].x - f.P[2].x); return; }
  if (t < (m.meteorCool || 0)) { f.inp.attackHeld = false; return; }
  if (m.meteorLit) { f.inp.attackHeld = d < 420; return; }
  if (d < 330 && f.mem.v7meteorT !== f.ai.v7n) { f.mem.v7meteorT = f.ai.v7n; f.inp.attackHeld = aiV7Trick(f) && chance(AI_V7.meteor); }
}
// Thornvine: it grows while you move, so pace back and forth at the edge of reach until it's full, then lash.
function aiV7VineThink(f, foe, d) {
  const g = f.mem.vineGrow || 0, reach = aiReach(f) * (1 + .4 * g), dir = Math.sign(foe.P[2].x - f.P[2].x) || f.face;
  if (g > .9) {                                 // full grown: lash on the move (standing still shrinks it at once)
    if (f.grounded && d > reach * .5 && d < reach * 1.8 && f.dashCd <= 0 && !f.ai.queue && f.mem.v7vineOk) { f.inp.dash = dir; f.ai.queue = G_STATE.t + .05; }
    else if (d < reach) { f.inp.mx = dir; if (f.atkCd <= 0) f.inp.attack = true; }
    return;
  }
  if (!f.grounded || d < reach * .7 || d > 520 || f.ai.zoneHold || f.ai.zonePush) return;
  if (f.mem.v7vineOk === undefined || f.mem.v7vineT !== f.ai.v7n) { f.mem.v7vineT = f.ai.v7n; f.mem.v7vineOk = aiV7Trick(f); }
  if (!f.mem.v7vineOk) return;
  const back = d < reach + 40;
  f.inp.mx = (Math.floor(G_STATE.t * 1.6) % 2 && !back ? dir : -dir) * 1;
  f.ai.armed = false;
}
// Anchor: hop at a grounded foe (or walk off a ledge above it) and plunge on top of it.
function aiV7AnchorThink(f, foe, d) {
  const dx = Math.abs(foe.P[2].x - f.P[2].x), above = feetY(foe) - feetY(f);
  if (f.grounded && f.atkCd <= 0 && f.jumpCd <= 0 && dx > 70 && dx < 230 && Math.abs(above) < 40 && f.mem.v7anchorT !== f.ai.v7n) {
    f.mem.v7anchorT = f.ai.v7n;
    if (chance(.25) && aiV7Trick(f)) { f.inp.jump = true; f.ai.nav = { hop: Math.sign(foe.P[2].x - f.P[2].x), t: .5 }; }
  }
  if (f.grounded && above > 120 && above < 420 && dx < 260) f.inp.mx = Math.sign(foe.P[2].x - f.P[2].x);   // step off over it
}
// Chrono Katana: after two cuts, keep the pressure on so the third lands inside the 2 s window.
function aiV7ChronoThink(f, foe, d) {
  const s = f.mem.chronoStreak;
  if (!s || s.foe !== foe || s.n < 1 || G_STATE.t - s.t > 1.6 || G_STATE.t < (f.mem.chronoReady || 0)) return;
  f.ai.armed = true;
  if (f.atkCd <= 0 && d < aiReach(f) + 30) f.inp.attack = true;
  else if (s.n >= 2 && d > aiReach(f) && d < 300 && f.dashCd <= 0 && f.grounded && f.mem.v7chronoT !== f.ai.v7n) {
    f.mem.v7chronoT = f.ai.v7n;
    if (aiV7Trick(f)) { f.inp.dash = Math.sign(foe.P[2].x - f.P[2].x); f.ai.queue = G_STATE.t + .06; }
  }
}
// ---------- hints for the v7 weapon bonuses (46b-weapons-tune, W7) ----------
// Every one no-ops unless W7's slice is in the build (its W7 table and f.mem state).
const aiV7W7 = () => typeof W7 !== 'undefined';
const aiV7Dir = (f, foe) => Math.sign(foe.P[2].x - f.P[2].x) || f.face;
// Once per decision: does this CPU go for the bonus? (lower levels less often)
function aiV7Bonus(f, key) {
  if (f.mem[key + 'T'] !== f.ai.v7n) { f.mem[key + 'T'] = f.ai.v7n; f.mem[key] = aiV7Trick(f); }
  return f.mem[key];
}
// Katana: rest the blade ~1 s around 200 px, then the quick-draw lunge crosses the gap (IAI CUT).
function aiV7KatanaThink(f, foe, d) {
  if (!aiV7W7() || !f.grounded || !aiV7Bonus(f, 'v7iai')) return;
  const rested = f.mem.katanaSheath > 1;
  if (rested && d < 280 && f.atkCd <= 0) { f.inp.attack = true; return; }
  if (!rested && d > 160 && d < 280 && foe.swingT <= 0) { f.inp.mx = 0; f.inp.attack = false; f.ai.armed = false; }
}
// Energy Saber: a deflect or a won clash arms a riposte; cut while it lasts.
function aiV7SaberThink(f, foe, d) {
  if (!aiV7W7() || !(f.mem.w7Riposte > G_STATE.t)) return;
  f.ai.armed = true;
  if (d < aiReach(f) + 20 && f.atkCd <= 0) f.inp.attack = true; else if (d < 320) f.inp.mx = aiV7Dir(f, foe);
}
// Rapier / gloves / nunchaku: keep hitting the same foe inside the streak gap (TOUCHÉ, UPPERCUT, STAGGER).
const AI_V7_STREAKS = { rapier: ['touche', 1.6], 'boxing-gloves': ['upper', 1.5], nunchaku: ['nun', 1.8] };
function aiV7StreakThink(f, foe, d) {
  const [key, gap] = AI_V7_STREAKS[f.wkey] || [], c = aiV7W7() && f.mem.w7s && f.mem.w7s[key];
  if (!c || c.foe !== foe || c.n < 1 || G_STATE.t - c.t > gap * .85 || !aiV7Bonus(f, 'v7streak')) return;
  f.ai.armed = true;
  if (d < aiReach(f) + 15 && f.atkCd <= 0) f.inp.attack = true;
  else if (d < aiReach(f) * 2.4 && f.dashCd <= 0 && f.grounded && !f.ai.queue) { f.inp.dash = aiV7Dir(f, foe); f.ai.queue = G_STATE.t + .05; }
}
// Spear: fight at the edge of reach so the tip lands (TIP!): back off when crowded, poke from 150-180 px.
function aiV7SpearThink(f, foe, d) {
  if (!aiV7W7() || !f.grounded || Math.abs(feetY(foe) - feetY(f)) > 50 || !aiV7Bonus(f, 'v7tip')) return;
  if (d < 135 && !aiCornered(f, aiV7Dir(f, foe))) { f.inp.mx = -aiV7Dir(f, foe); f.inp.attack = false; }
  else if (d > 150 * f.scale && d < 180 * f.scale && f.atkCd <= 0) f.inp.attack = true;
}
// Pulse Pistol: the last round is OVERCHARGED; keep it (up to 1.5 s, so the gun never stalls) for a foe inside ~300 px.
function aiV7PistolThink(f, foe, d) {
  if (!aiV7W7() || f.ammo !== 1) { f.mem.v7saveT = 0; return; }
  if (!f.mem.v7saveT) f.mem.v7saveT = G_STATE.t + 1.5;
  if (d > 300 && G_STATE.t < f.mem.v7saveT) { f.inp.attack = false; f.inp.attackHeld = false; }
}
// Thunder Six: the follow-up inside 1.1 s of a hit is a DOUBLE TAP.
function aiV7RevolverThink(f, foe, d) {
  const c = aiV7W7() && f.mem.w7s && f.mem.w7s.tap;
  if (c && c.foe === foe && G_STATE.t - c.t < 1 && f.atkCd <= 0 && f.reload <= 0 && f.ai.los) f.inp.attack = true;
}
// Chrono Katana: a Time-Warped foe takes TICK bonus cuts; swing eagerly while it lasts.
function aiV7WarpThink(f, foe, d) {
  if (!aiV7W7() || !foe.status.timewarp) return;
  f.ai.armed = true;
  if (d < aiReach(f) + 20 && f.atkCd <= 0) f.inp.attack = true; else if (d < 360) f.inp.mx = aiV7Dir(f, foe);
}
function aiV7ChronoAll(f, foe, d) { aiV7ChronoThink(f, foe, d); aiV7WarpThink(f, foe, d); }

// Each brain replaces (meteor) or runs after the weapon's own ai.think.
const AI_V7_THINKS = { 'meteor-flail': [aiV7MeteorThink, true], thornvine: [aiV7VineThink], anchor: [aiV7AnchorThink], 'chrono-katana': [aiV7ChronoAll],
  katana: [aiV7KatanaThink], saber: [aiV7SaberThink], rapier: [aiV7StreakThink], 'boxing-gloves': [aiV7StreakThink], nunchaku: [aiV7StreakThink],
  spear: [aiV7SpearThink], pistol: [aiV7PistolThink], revolver: [aiV7RevolverThink] };   // kusarigama: pressing a bleeding foe measured worse (REAP 1.86 -> 1.2-1.5/round), left out
function aiV7InstallThinks() {
  for (const k in AI_V7_THINKS) {
    const w = WEAPONS[k], [fn, replace] = AI_V7_THINKS[k];
    if (!w || !w.ai) continue;
    const old = !replace && w.ai.think;
    w.ai.think = old ? (f, foe, d) => { old(f, foe, d); fn(f, foe, d); } : fn;
  }
}

// ---------- personality: what the CPU says ----------
// Short, kid-friendly lines per moment. Rivals keep their own voice for 67's kinds; these are the new moments.
const AI_V7_LINES = {
  pillow: ['Was that a PILLOW?!', 'Feathers everywhere!', 'Nap time? NO!'],
  pan: ['Clang! My head!', 'Who brings a pan to a fight?', 'Ow! Breakfast attack!'],
  chicken: ['Did that just squeak?', 'Defeated by poultry…'],
  slipped: ['Who left that there?!', 'Banana! Again!', 'Whoaaa—'],
  frozen: ['Brrr… c-cold!', 'I\'m a snowman now?!'],
  tethered: ['Let go of me!', 'Unstick! Unstick!'],
  aced: ['My own shot?!', 'Hey, that was mine!'],
  robbed: ['Hey! Give that back!', 'My weapon!'],
  splat: ['Ow, the wall!', 'Splat…'],
  slick: ['Slippy floor!', 'Wheee— no!'],
  boast: ['Did you see that?!', 'Trick shot!', 'Style points!', 'Too smooth!'],
  ring: ['Mind the gap!', 'Bye-bye!', 'Enjoy the fall!', 'Out of bounds!'],
  flashy: ['Add that to the highlights!', 'Nailed it!', 'Signature move!'],
  revenge: ['Payback time!', 'Remember me?', 'Now we\'re even!'],
  comeback: ['Never give up!', 'Down but not out!', 'What a comeback!'],
  salty: ['That one didn\'t count!', 'Best of… nine?', 'I slipped. Totally slipped.', 'Okay, warm-up\'s over.', 'Rematch! Right now!'],
  streak: ['Is my weapon broken?', 'Hey, stop winning!', 'New plan: win.'],
  lostPan: ['Lost to a frying pan… again?!', 'That pan is getting a name.'],
  lostPillow: ['Beaten by bedding.', 'Pillow fight rematch. Now.'],
  lostBanana: ['Bananas. Why always bananas?'],
  lostChicken: ['Not the chicken…'],
  show: ['Watch and learn!', 'Dance break!', '😎', 'Too easy!', '🕺', 'Ta-da!'],
  ko: AI_TALK_LINES.ko,
  early: ['Ha! Got you!', 'Victory dan— wait.', 'Easy wi— oh.'],
};
// The rivals' own voice for the new moments (67's personas; plain CPUs use AI_V7_LINES).
const AI_V7_RIVAL_LINES = {
  torque: { boast: ['Full throttle!'], salty: ['I\'ll be faster next time!'], revenge: ['Rematch won!'], ring: ['Off the track!'] },
  mirage: { boast: ['Ta-da!'], salty: ['A trick of the light…'], revenge: ['Surprise!'], slipped: ['That wasn\'t part of the act!'] },
  vale: { boast: ['Calculated shot.'], salty: ['You got lucky up close.'], ring: ['Out of range. Forever.'] },
  dazzle: { boast: ['Sparkle!', 'Did you film that?'], salty: ['The lighting was wrong!'], revenge: ['Comeback tour!'] },
  tamsin: { boast: ['Form is everything.'], salty: ['A lesson learned.'], revenge: ['Balance restored.'] },
  grizz: { boast: ['Grizz strong!'], salty: ['Grr. Again!'], ring: ['Thrown out!'], revenge: ['Bear hug payback!'] },
  magpie: { boast: ['Shiny move!'], robbed: ['MY shiny!'], salty: ['I was distracted by something shiny.'] },
  fenn: { boast: ['SMASHED IT!'], salty: ['AGAIN! NOW!'], revenge: ['VENGEANCE!'], streak: ['WHY WON\'T YOU FALL?!'] },
  ivo: { boast: ['Textbook.'], salty: ['Variables changed.'], ring: ['Gravity: undefeated.'], revenge: ['Noted. Corrected.'] },
  skitter: { boast: ['D-did I do that?'], salty: ['I wasn\'t ready!'], revenge: ['S-sorry! Not sorry!'], pillow: ['Soft… but scary!'] },
};
// Lines are picked with their own random numbers, never the game's: what a CPU says must not change what happens next
// (seeded tests and fights replay the same with talk on or off).
let aiV7Seed = 12345;
const aiV7Rnd = () => (aiV7Seed = (aiV7Seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const aiV7Pick = list => list[Math.floor(aiV7Rnd() * list.length)];
// One line of a kind (the rival's own voice first, if it has one for it). Counts the lines this pass adds.
function aiV7Say(f, kind, force) {
  const p = aiPersonaOf(f), own = p && AI_V7_RIVAL_LINES[p.key], lines = (own && own[kind]) || (p && p.lines[kind]) || AI_V7_LINES[kind];
  if (!lines || !aiSay(f, aiV7Pick(lines), force)) return false;
  AI_V7.lines++;
  sfx('ai-chirp', .35);
  return true;
}
const AI_V7_HIT_BY = { pillow: 'pillow', 'frying-pan': 'pan', 'rubber-chicken': 'chicken' };
// A CPU hit by something silly says so (once per weapon per round).
on('damage', (B, amt, o) => {
  const A = o && o.src;
  if (!A || A === B || !B.alive || !aiBrain(B) || !A.w || o.kind !== 'melee') return;
  const kind = AI_V7_HIT_BY[A.wkey];
  if (!kind || (B.ai.v7hitBy || (B.ai.v7hitBy = {}))[kind]) return;
  B.ai.v7hitBy[kind] = true;
  aiV7Say(B, kind);
});
const AI_V7_TRICK_VICTIM = { slip: 'slipped', snowman: 'frozen', tether: 'tethered', yank: 'tethered', ace: 'aced', rip: 'robbed', splat: 'splat', paint: 'slick' };
const AI_V7_TRICK_BOAST = ['ace', 'snowman', 'rip', 'chord', 'yank', 'slip', 'splat', 'dog', 'yoyo-return', 'bounce'];
// Tricks: the victim CPU reacts, or the CPU that pulled it off boasts (and remembers it for a flashy K.O.).
on('weaponTrick', (f, key, B) => {
  if (f && aiBrain(f) && f.ai) f.ai.v7trickT = G_STATE.t;
  if (B && B !== f && aiBrain(B) && B.alive && AI_V7_TRICK_VICTIM[key] && aiV7Say(B, AI_V7_TRICK_VICTIM[key])) return;
  if (f && aiBrain(f) && f.alive && AI_V7_TRICK_BOAST.includes(key) && aiV7Rnd() < .5) aiV7Say(f, 'boast');
});
on('ultimate', f => { if (f && f.ai) f.ai.v7trickT = G_STATE.t; });
// A K.O.: a ring-out quip, a flashy-move boast, or revenge on whoever won the last round. Remembered for next round.
on('ko', (V, K, o) => {
  if (!V || V.summon) return;
  const rec = AI_V7.mem[V.id] = AI_V7.mem[V.id] || {};
  rec.koBy = K && K !== V ? K.id : null; rec.lostTo = K && K !== V ? K.wkey : null;
  if (!K || K === V || !K.alive || !aiBrain(K) || K.summon) return;
  const mine = AI_V7.mem[K.id] || {};
  const kind = mine.koBy === V.id && !mine.avenged ? 'revenge' : o && o.kind === 'ringout' ? 'ring'
    : G_STATE.t - (K.ai.v7trickT ?? -9) < 2 ? 'flashy' : null;
  if (kind === 'revenge') mine.avenged = true;
  if (kind) { K.ai.sayT = -9; aiV7Say(K, kind, true); }   // takes the place of 67's plain K.O. line
  else if (!AI_TALK.list.some(b => b.f === K && b.t === G_STATE.t)) { K.ai.sayT = -9; aiV7Say(K, 'ko', true); }   // rate limits ate 67's line: a K.O. always gets one
});
// Round end: note comebacks and losing streaks; the next round's start gets the salty (or proud) line.
on('roundEnd', team => {
  for (const f of F) {
    if (f.summon) continue;
    const rec = AI_V7.mem[f.id] = AI_V7.mem[f.id] || {};
    const won = team >= 0 && f.team === team;
    rec.streak = won ? 0 : (rec.streak || 0) + (team >= 0 ? 1 : 0);
    rec.comeback = won && f.alive && f.ai && f.ai.v7low;
    rec.lost = team >= 0 && !won;
    if (won) rec.avenged = false;
  }
});
on('damage', B => { if (B.ai && B.alive && B.hp < B.maxHp * .25) B.ai.v7low = true; });
on('roundStart', round => {
  if (round <= 1) { AI_V7.mem = {}; return; }
  const f = F.find(o => !o.summon && aiBrain(o) && aiTalkOk(o) && AI_V7.mem[o.id] && (AI_V7.mem[o.id].lost || AI_V7.mem[o.id].comeback));
  if (!f) return;
  const rec = AI_V7.mem[f.id], lost = { 'frying-pan': 'lostPan', pillow: 'lostPillow', banana: 'lostBanana', 'rubber-chicken': 'lostChicken' }[rec.lostTo];
  const kind = rec.comeback ? 'comeback' : lost && aiV7Rnd() < .7 ? lost : rec.streak >= 2 ? 'streak' : 'salty';
  aiV7Say(f, kind, true);
});

// ---------- personality: showing off ----------
// Far ahead with nobody close: strike a pose or bounce about for a moment (lower levels can't resist more often).
function aiV7Lead(f, foe) {
  const sc = G_STATE.score || [], rounds = (sc[f.team] || 0) - (sc[foe.team] || 0);
  return rounds >= 2 || f.hp / f.maxHp - foe.hp / foe.maxHp > AI_V7.lead;
}
function aiV7ShowOff(f, L, foe, c) {
  if (f.ai.flourish || c.d < AI_V7.showFar || !f.grounded || !aiV7Lead(f, foe) || !aiV7TalkOn() || !chance(L.showoff * L.react * .2)) return false;   // × react: per second, not per decision
  f.ai.flourish = { kind: chance(.6) ? 'taunt' : 'hop', t: G_STATE.t + .9 };   // 67's aiFlourish poses and says a taunt line
  AI_V7.shows = (AI_V7.shows || 0) + 1;
  return true;
}
const aiV7TalkOn = () => typeof SETTINGS === 'undefined' || SETTINGS.taunts !== false;
// A big hit at a low level: it celebrates as if the round were over (a slip; the foe gets a free moment).
on('damage', (B, amt, o) => {
  const A = o && o.src;
  if (!A || A === B || !B.alive || !A.alive || !aiBrain(A) || !A.ai || !A.ai.L || A.summon || amt < AI_V7.bigHit || A.ai.flourish) return;
  if (!aiV7TalkOn() || !(A.ai.L.early > 0) || !chance(A.ai.L.early)) return;
  A.ai.flourish = { kind: 'taunt', t: G_STATE.t + .8 };
  aiSlip(A, 'celebrate');
  aiV7Say(A, 'early', true);           // said first, so 67's taunt line (rate-limited per fighter) doesn't replace it
});

// ---------- bubbles that don't overlap ----------
// Two fighters standing close used to get two bubbles on top of each other: the newer one is lifted above the older.
// Drawing only (67's aiBubble, wrapped).
const AI_V7_BUBBLE_H = 30;
function aiV7BubbleBox(ctx, b) {
  const f = b.f, head = f.P[0], w = ctx.measureText(b.text).width + 20;
  const x = clamp(head.x, 90, W - 90), y = head.y - (HEAD_R + 34) * f.scale - Math.max(0, hatReach(f.hat) - 1) * HEAD_R;
  return { x0: x - w / 2, x1: x + w / 2, y };
}
function aiV7StackBubbles(ctx) {
  if (!AI_TALK.list.length) return;
  ctx.save(); ctx.font = `13px ${FONT_DISPLAY}`;
  const placed = [];
  for (const b of AI_TALK.list) {
    const box = aiV7BubbleBox(ctx, b);
    b.lift = 0;
    for (const o of placed) if (box.x0 < o.x1 + 6 && box.x1 > o.x0 - 6 && Math.abs(box.y - b.lift - (o.y - o.lift)) < AI_V7_BUBBLE_H) b.lift = Math.max(b.lift, box.y - (o.y - o.lift) + AI_V7_BUBBLE_H + 4);
    placed.push(Object.assign(box, { lift: b.lift }));
  }
  ctx.restore();
}
const aiV7TalkDraw0 = aiTalkDraw, aiV7Bubble0 = aiBubble;
aiTalkDraw = function (ctx) { aiV7StackBubbles(ctx); aiV7TalkDraw0(ctx); };
aiBubble = function (ctx, b, age) {
  if (!b.lift) return aiV7Bubble0(ctx, b, age);
  ctx.save(); ctx.translate(0, -b.lift); aiV7Bubble0(ctx, b, age); ctx.restore();
};

// ---------- boot: weapon brains, the after-think hook, sound, settings text ----------
on('boot', () => {
  aiV7InstallThinks();
  THINK_AFTER.push(aiV7After);
  AI_TALK_LINES.taunt.push(...AI_V7_LINES.show, 'Catch me if you can!');
  if (typeof defSfx === 'function') defSfx('ai-chirp', v => { tone(880, 1320, .05, 'triangle', .07 * v); tone(1320, 990, .06, 'sine', .05 * v, .05); });
  if (typeof SCREENS !== 'undefined') aiWrapScreen('settings', node => {
    const b = node.querySelector && node.querySelector('[data-key="Taunts & reactions"]'), hint = b && b.parentNode.querySelector('.hint');
    if (hint) hint.textContent = 'Speech bubbles, reactions and show-off poses from CPUs.';
  });
});
