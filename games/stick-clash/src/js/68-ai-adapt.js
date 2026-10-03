// 68-ai-adapt.js: CPUs that adjust to the person playing them.
// 1. Adaptive difficulty (SETTINGS.adaptive, on by default; only with exactly one human, never in Ranked or practice):
//    after each round, AI_ADAPT.v moves toward +1 when the human is winning (more so for big health margins) and
//    toward -1 when losing. A CPU facing the human blends its numeric knobs toward the next level up (v > 0) or down
//    (v < 0) by at most AI_ADAPT.max, so it always stays between its own level and that neighbour (Insane never
//    goes above Insane, Easy never below Easy). Read by aiTuned (67) at every decision.
// 2. Habit reading: per match, each human's patterns are counted: attacking right after a jump (jumpIn), right after
//    a dash at a CPU (dashIn), guarding hits (turtle) and leaning on one skill (spam). Once a pattern has been seen
//    AI_HABIT.need times, CPUs facing that human counter it with a per-level chance: back off the jump-in or dash
//    so it whiffs and punish the recovery, time a parry on the follow-up swing, grab a turtle, guard a spammed skill.
//    A counter now and then shows a "READ YOU!" bubble. Only humans are read, so CPU-vs-CPU fights never change.

const AI_ADAPT = { v: 0, step: .3, decay: .8, max: .4, log: [] };
const AI_ADAPT_SKIP = ['armor', 'gunArmor'];     // CPU-vs-CPU toughness: not a feel knob

function aiHumanEntry() {
  const r = G_STATE.roster || [], humans = r.filter(e => e.ctrl === 'human');
  return humans.length === 1 ? humans[0] : null;
}
function aiAdaptOn() {
  const m = G_STATE.mode;
  if (!m || m.key === 'ranked' || m.practice || m.training || G_STATE.demo) return false;
  if (typeof SETTINGS !== 'undefined' && SETTINGS.adaptive === false) return false;
  return !!aiHumanEntry();
}

// Blends the level's knobs toward its neighbour for CPUs on the other side of the human.
function aiAdaptBlend(L, f) {
  const v = AI_ADAPT.v, me = aiHumanEntry();
  if (!v || !me || f.team === me.team || !aiAdaptOn()) return;
  const i = AI_ORDER.indexOf(f.aiLevel || (G_STATE.cfg && G_STATE.cfg.diff)), nb = i < 0 ? null : AI_LEVELS[AI_ORDER[i + Math.sign(v)]];
  if (!nb) return;
  const k = Math.abs(v) * AI_ADAPT.max;
  for (const key of new Set([...Object.keys(L), ...Object.keys(nb)])) {
    if (AI_ADAPT_SKIP.includes(key)) continue;
    const zero = AI_CHANCE_KEYS.includes(key) ? 0 : null;     // a chance a level lacks (brawl below Hard) counts as 0
    const a = typeof L[key] === 'number' ? L[key] : zero, b = typeof nb[key] === 'number' ? nb[key] : zero;
    if (a != null && b != null) L[key] = lerp(a, b, k);
  }
}

// After a round: winning by a lot pushes harder than scraping a win.
function aiAdaptRound(winner) {
  const me = aiHumanEntry();
  if (winner < 0 || !me || !aiAdaptOn()) return;
  const alive = F.filter(f => f.team === winner && f.alive && !f.summon);
  const margin = alive.length ? alive.reduce((s, f) => s + f.hp / f.maxHp, 0) / alive.length : 0;
  const dir = winner === me.team ? 1 : -1;
  AI_ADAPT.v = clamp(AI_ADAPT.v * AI_ADAPT.decay + dir * AI_ADAPT.step * (.5 + margin), -1, 1);
  AI_ADAPT.log.push({ round: G_STATE.round, won: dir > 0, margin: +margin.toFixed(2), v: +AI_ADAPT.v.toFixed(2) });
}
on('roundEnd', winner => aiAdaptRound(winner));

// ---------- habits ----------
const AI_HABIT = { on: true, need: 3, read: { easy: .3, normal: .55, hard: .75, insane: .9 }, cool: 6, reads: 0, counters: {} };
let AI_HAB = {};      // human fighter id -> its habit record, for this match

on('matchStart', () => { AI_ADAPT.v = 0; AI_ADAPT.log = []; AI_HAB = {}; AI_HABIT.reads = 0; AI_HABIT.counters = {}; });

const aiHuman = f => !!f && !aiBrain(f) && !f.summon;
function aiHabitRec(f) {
  return AI_HAB[f.id] || (AI_HAB[f.id] = { jumpT: -9, dashT: -9, n: { jumpIn: 0, dashIn: 0, turtle: 0, spam: 0 }, skills: {}, skillN: 0, spam: null });
}
const aiHabitKnown = (rec, k) => AI_HABIT.on && !!rec && rec.n[k] >= AI_HABIT.need;
// CPUs facing human A within `range` px.
const aiHabitFoes = (A, range) => F.filter(B => B.alive && aiBrain(B) && !B.summon && B.team !== A.team && canAct(B) &&
  Math.abs(B.P[2].x - A.P[2].x) < range && Math.abs(B.P[2].y - A.P[2].y) < 160);
// Does this CPU spot the pattern this time? Smarter levels more often.
const aiHabitRoll = B => chance(AI_HABIT.read[B.aiLevel || (G_STATE.cfg && G_STATE.cfg.diff)] ?? .5);
function aiReadYou(B, k) {
  AI_HABIT.reads++; AI_HABIT.counters[k] = (AI_HABIT.counters[k] || 0) + 1;
  if (G_STATE.t - (B.ai.readT ?? -99) < AI_HABIT.cool) return;
  B.ai.readT = G_STATE.t;
  aiSay(B, 'READ YOU!', true);
}

// A jump toward a CPU that reads jump-ins: it steps back so the air swing lands short, then answers.
on('jump', A => {
  if (!aiHuman(A)) return;
  const rec = aiHabitRec(A);
  rec.jumpT = G_STATE.t;
  if (!aiHabitKnown(rec, 'jumpIn')) return;
  for (const B of aiHabitFoes(A, 340)) {
    const away = Math.sign(B.P[2].x - A.P[2].x) || B.face;
    if (A.face !== away || !aiHabitRoll(B)) continue;
    aiGoTo(B, B.P[2].x + away * 150, null); B.ai.armed = false; B.ai.t = .3;
    aiReadYou(B, 'jumpIn');
  }
});
// A dash at a CPU that reads dash-ins: it stops and waits for the swing that always follows, to parry it.
on('dash', A => {
  if (!aiHuman(A)) return;
  const rec = aiHabitRec(A), dir = Math.sign(A.inp.dash) || A.face;
  rec.dashT = G_STATE.t;
  if (!aiHabitKnown(rec, 'dashIn')) return;
  for (const B of aiHabitFoes(A, 460)) {
    const away = Math.sign(B.P[2].x - A.P[2].x) || B.face;
    if (dir !== away || !aiHabitRoll(B)) continue;
    aiGoTo(B, B.P[2].x, null); B.ai.armed = false; B.ai.t = .35;   // hold ground: the parry comes on the swing (below)
    B.ai.readDash = G_STATE.t;
    aiReadYou(B, 'dashIn');
  }
});
// The swing that follows: count the pattern, and a CPU that knows it times a parry.
on('attack', A => {
  if (!aiHuman(A)) return;
  const rec = aiHabitRec(A), t = G_STATE.t;
  const k = !A.grounded && t - rec.jumpT < .7 ? 'jumpIn' : t - rec.dashT < .5 ? 'dashIn' : null;
  if (!k) return;
  rec.n[k]++;
  if (!aiHabitKnown(rec, k)) return;
  for (const B of aiHabitFoes(A, aiReach(A) + 90)) {
    if (k === 'dashIn' && t - (B.ai.readDash ?? -9) < .6) { aiHabitGuard(B); continue; }   // already read at the dash
    if (aiHabitRoll(B)) { aiHabitGuard(B); aiReadYou(B, k); }
  }
});
on('block', B => { if (aiHuman(B) && B.blocking) aiHabitRec(B).n.turtle++; });
// One skill used over and over: guard (or hop) the moment it comes out.
on('skill', (A, key) => {
  if (!aiHuman(A)) return;
  const rec = aiHabitRec(A);
  rec.skills[key] = (rec.skills[key] || 0) + 1; rec.skillN++;
  if (rec.skills[key] > AI_HABIT.need && rec.skills[key] / rec.skillN >= .6) { rec.spam = key; rec.n.spam = rec.skills[key]; }
  if (rec.spam !== key || !AI_HABIT.on) return;
  for (const B of aiHabitFoes(A, 480)) {
    if (!aiHabitRoll(B)) continue;
    aiHabitGuard(B);
    if (B.grounded && chance(.4)) B.inp.jump = true;
    aiReadYou(B, 'spam');
  }
});

// A guard timed for a swing we saw coming: a fresh one parries; one already up just blocks. Held through the swing
// (66 would otherwise drop it to punish the moment the swing starts).
function aiHabitGuard(B) {
  aiGuard(B, .01, .3);
  B.ai.guardLock = G_STATE.t + .3;
}

// Knobs: a known turtle gets grabbed (and lobbed at) a lot more.
function aiHabitKnobs(L, f) {
  const foe = f.ai.foe;
  if (!aiHuman(foe) || !aiHabitKnown(AI_HAB[foe.id], 'turtle')) return;
  L.grab = aiChance('grab', (L.grab || 0) + .45); L.throw = aiChance('throw', (L.throw || 0) + .1);
}
// Per decision: walk into a guarding turtle and grab it.
function aiHabitAct(f, L, c) {
  const foe = f.ai.foe;
  if (!aiHuman(foe) || !foe.blocking || !aiHabitKnown(AI_HAB[foe.id], 'turtle') || f.holding || f.heldBy || f.mount) return;
  if (c.d > GRAB.reach * 2.4 || Math.abs(c.dy) > 50) return;
  aiGoTo(f, foe.P[2].x - c.dir * 30, null);
  if (c.d < GRAB.reach + 10 && f.grabCd <= 0 && canBeGrabbed(f, foe) && aiHabitRoll(f)) { f.inp.grab = true; aiReadYou(f, 'turtle'); }
}
