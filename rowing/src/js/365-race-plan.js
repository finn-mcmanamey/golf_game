/* ===== race plans: the target stroke rate set for you by distance =====
   Works through the normal rate input, so recorded races replay exactly. Pressing W/S (or − +) takes over by hand. */

const PLANS_UI = {
  manual: { label: 'Manual' },
  classic: { label: 'Classic', rate: (f, D) => f < 0.08 ? 40 : f > 1 - Math.min(0.25, 150 / D) ? 38 : 33 },   // start, settle, sprint
  even: { label: 'Even', rate: () => 34 },
};

const plan = { overridden: false };
function resetPlan() { plan.overridden = false }

// Called each tick before inputs are read: nudges the target rate to the plan.
function applyPlan() {
  const p = PLANS_UI[settings.plan];
  if (!p?.rate || plan.overridden || !race.started || race.player2 || practiceMode()) return;
  const r = p.rate(race.player.x / race.course.distance, race.course.distance);
  if (r !== targetRate) { targetRate = r; $('rateTarget').classList.add('flash'); setTimeout(() => $('rateTarget').classList.remove('flash'), 400) }
}
