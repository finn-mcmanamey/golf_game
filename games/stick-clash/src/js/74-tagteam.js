// 74-tagteam.js (v4): two fighters a side; a K.O.'d fighter's partner tags in; both down loses the round. Only the fighter
// on the field is in the roster (one-player input rules still apply); partners wait in run.tag.
const TAG_DELAY = .9, TAG_GUARD = 1;  // s from K.O. to tag-in; the partner's protection

function tagMode(key, o) {
  defMode(key, Object.assign({ icon: '🔁', pickers: 4, winScore: 3, roundLimit: 90, holdRound: () => true,
    setup(cfg) {
      const names = duoNames(cfg), cpu = this.key === 'tagcpu', pair = t => [0, 1].map(j => t && cpu
        ? modeEntry({ ...loadoutOf(cfg, 2 + j), team: 1, name: 'CPU ' + (j + 1) }) : humanEntry(cfg, t * 2 + j, t, t, cpu ? 'YOU' : names[t]));
      const tag = [pair(0), pair(1)];
      tag.flat().forEach(rollRandomOnce);  // partners' random picks hold for the match
      return { roster: [tag[0][0], tag[1][0]], run: { tag, next: [1, 1], swapT: [0, 0] } };
    },
    hud(ctx) {  // fighters left per side ("●○") in each player's colour
      const run = modeRun(), dots = t => '●'.repeat(3 - run.next[t] - !F.some(f => f.team === t && f.alive && !f.summon)).padEnd(2, '○');
      modePanel(ctx, W / 2 - 58, PARTY_HUD_Y - 15, 116, 30);
      for (const t of [0, 1]) modeText(ctx, dots(t), W / 2 + (t ? 26 : -26), PARTY_HUD_Y, 18, teamColor(t));
    },
    onKO(v) { const run = modeRun(); if (!v.summon && run.next[v.team] < 2) run.swapT[v.team] = TAG_DELAY; },
    koEndsRound(v) { return modeRun().next[v.team] >= 2; },   // 30 koDecides: not while a partner waits
    onStep(dt) {
      const run = modeRun(), up = t => run.swapT[t] > 0 || F.some(f => f.team === t && f.alive && !f.summon);
      if (G_STATE.lock > 0 || G_STATE.ending) return;
      for (const t of [0, 1]) if (run.swapT[t] > 0 && (run.swapT[t] -= dt) <= 0) tagIn(run, t);
      const d = tagLeft(run, 0) - tagLeft(run, 1);  // time-out: partners left + health
      if (!up(0) || !up(1)) endRound(up(0) ? 0 : up(1) ? 1 : -1, up(0) || up(1) ? 'ko' : 'draw');
      else if (G_STATE.roundT >= G_STATE.roundLimit) endRound(Math.abs(d) < 1e-9 ? -1 : d > 0 ? 0 : 1, 'time');
    },
    roundOver() {  // first fighters in front again
      const run = modeRun();
      for (const t of [0, 1]) { run.tag[t][run.next[t] - 1] = G_STATE.roster[t]; G_STATE.roster[t] = run.tag[t][0]; }
      Object.assign(run, { next: [1, 1], swapT: [0, 0] });
      return G_STATE.score.some(s => s >= G_STATE.winScore) ? 'match' : 'next';
    },
  }, o));
}
const tagLeft = (run, t) => 2 - run.next[t] + F.filter(f => f.team === t && f.alive && !f.summon).reduce((s, f) => s + f.hp / f.maxHp, 0);

function tagIn(run, team) {
  const old = F.find(f => f.team === team && !f.summon), sp = spawnPoint(team);
  if (!old) return;
  const out = run.tag[team][run.next[team] - 1] = G_STATE.roster[old.id];
  const r = G_STATE.roster[old.id] = run.tag[team][run.next[team]++];
  r.color = out.color;   // the partner keeps its player's colour (colour-blind palette included)
  const f = partyRespawn(old, sp[0], sp[1], { skills: resolveSkills(r.skills) });
  f.inv = TAG_GUARD;
  for (const p of f.P) kick(p, sp[0] < W / 2 ? 240 : -240, -160);
  banner('TAG!', `${f.name} steps in`.toUpperCase(), 1.3, f.color);
}

tagMode('tagteam', { name: 'Tag Team', order: 22, players: [2, 2], cpu: false, duo: 'versus', pickerOwner: [0, 0, 1, 1],
  labels: ['P1 · fighter 1', 'P1 · fighter 2', 'P2 · fighter 1', 'P2 · fighter 2'],
  desc: 'Two fighters each: when one falls, the partner tags in. Knock out both to win the round.' });
tagMode('tagcpu', { name: 'Tag Team vs CPU', order: 23, players: [1, 1], cpu: true, pickerOwner: [0, 0, 0, 0], results: duelResults,
  labels: ['You · fighter 1', 'You · fighter 2', 'CPU · fighter 1', 'CPU · fighter 2'], desc: 'Your two fighters against the CPU\'s two, tagging in.' });
