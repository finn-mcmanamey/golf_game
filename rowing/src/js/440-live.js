/* ===== live races: friends who have the game open row against each other in real time =====
   Uses the artifact's `room`: a short code names a private room; Start sends the race settings to everyone in it.
   Each page simulates only its own boat (so its race code stays exact) and shares where it is through presence;
   the other crews are drawn in neighbouring lanes, smoothed between updates. */

const live = { room: null, lobby: null, code: '', remote: new Map(), state: 'off', lastSent: 0, unsubs: [] };
const LIVE_LANES = [3, 1, 4, 0, 5];   // where the other crews appear around your lane (2)

async function connectLive() {
  if (!window.claude?.use) return;
  try {
    live.room = await claude.use('room');
    if (live.room) $('btnLive').classList.remove('hide');
  } catch (e) { live.room = null }
}

const randomCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

async function joinLive(code) {
  code = code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
  if (!code || !live.room) return;
  await leaveLive();
  try { live.lobby = await live.room.join('race-' + code.toLowerCase()) } catch (e) { toast('Could not join that race. Try again in a moment.'); return }
  live.code = code;
  live.state = 'lobby';
  live.unsubs.push(live.lobby.on('start', msg => startLiveRace(msg.data)));
  live.unsubs.push(live.lobby.onPeers(() => renderLiveLobby()));
  sendPresence(true);
  renderLiveLobby();
}

async function leaveLive() {
  live.unsubs.forEach(u => u());
  live.unsubs = [];
  live.remote.clear();
  if (live.lobby) { try { await live.lobby.leave() } catch (e) { } }
  live.lobby = null;
  live.state = 'off';
}

// Shared about ten times a second while racing: everything another page needs to draw this crew.
function sendPresence(force = false) {
  if (!live.lobby || (!force && game.time - live.lastSent < 0.1)) return;
  live.lastSent = game.time;
  const p = game.state === 'race' || game.state === 'results' ? race?.player : null;
  live.lobby.presence({
    name: crew.club.slice(0, 14), shirt: crew.shirt, state: live.state,
    ...(p && live.state !== 'lobby' ? { x: +p.x.toFixed(2), off: +(p.z - laneZ(p.lane)).toFixed(2), v: +p.v.toFixed(2), h: +p.h.toFixed(3),
      ph: p.phase, cls: p.cls, ft: p.finishTime, t: +race.t.toFixed(2) } : {}),
  }).catch(() => {});
}

function renderLiveLobby() {
  if (!live.lobby) { $('liveRoom').classList.add('hide'); $('liveJoin').classList.remove('hide'); return }
  $('liveJoin').classList.add('hide');
  $('liveRoom').classList.remove('hide');
  $('liveCode').textContent = live.code;
  const crews = live.lobby.peers().filter(p => p.kind === 'viewer');
  $('liveCrews').innerHTML = crews.map(p => `<div>${p.sameTab ? '<b>You</b>' : escapeHtml(String(p.presence.name || 'Rower'))}${p.presence.state === 'racing' ? ' · racing' : ''}</div>`).join('') || '<div>Waiting…</div>';
  const o = currentOpts();
  $('liveRace').textContent = `${o.distance} m · ${BOAT_CLASSES[o.cls].name} · ${makeCourse(o.seed, o.distance).name}`;
}

// Everyone in the room starts on the same message, so all the countdowns run together.
function startLiveRace(data) {
  if (live.state === 'racing' || !data?.opts) return;
  const o = data.opts;
  if (!BOAT_CLASSES[o.cls] || !DIFFICULTY[o.difficulty] || !(o.distance > 0 && o.distance <= 4000)) return;   // untrusted: check before using
  live.state = 'racing';
  live.remote.clear();
  $('live').classList.add('hide');
  startRace({ seed: o.seed | 0, distance: o.distance, cls: o.cls, difficulty: o.difficulty, kind: 'regatta', lane: 2, solo: true, rules: RULES_LATEST }, null, 'live');
  sendPresence(true);
}

function pressLiveStart() {
  const o = currentOpts();
  live.lobby?.emit('start', { opts: { seed: o.seed, distance: o.distance, cls: o.cls, difficulty: 'club' } })
    .catch(() => toast('Only crew members who can use this page can start a race.'));
}

// Each frame: read the other crews' presence into boats we can draw, moving them on smoothly between updates.
function updateLiveBoats(dt) {
  if (!live.lobby || live.state !== 'racing' || !race) return;
  sendPresence();
  const others = live.lobby.peers().filter(p => !p.sameTab && p.kind === 'viewer' && p.presence.state === 'racing' && p.presence.x != null)
    .sort((a, b) => a.peer < b.peer ? -1 : 1).slice(0, LIVE_LANES.length);
  const seen = new Set();
  others.forEach((p, i) => {
    const s = p.presence, cls = BOAT_CLASSES[s.cls] ? s.cls : '1x';
    let r = live.remote.get(p.peer);
    if (!r) { r = makeBoat(cls, LIVE_LANES[i], String(s.name || 'Rower').slice(0, 14)); r.isRemote = true; r.shirt = s.shirt; live.remote.set(p.peer, r) }
    seen.add(p.peer);
    if (r.stamp !== p.updatedAt) {
      // A fresh report: steer towards it rather than jumping, so the boat never stutters.
      r.stamp = p.updatedAt;
      r.targetX = Number(s.x) || 0;
      r.v = Number(s.v) || 0;
      r.h = clamp(Number(s.h) || 0, 0, 1);
      r.phase = ['drive', 'recover', 'front', 'crab'].includes(s.ph) ? s.ph : 'front';
      r.finishTime = typeof s.ft === 'number' ? s.ft : null;
      r.z = laneZ(r.lane) + clamp(Number(s.off) || 0, -4, 4);
    }
    r.targetX += r.v * dt;
    r.x += (r.targetX - r.x) * Math.min(1, dt * 6);
  });
  for (const k of [...live.remote.keys()]) if (!seen.has(k)) live.remote.delete(k);
  renderLiveStandings();
}

function renderLiveStandings() {
  const all = [race.player, ...live.remote.values()];
  all.sort((a, b) => (a.finishTime ?? 1e9) - (b.finishTime ?? 1e9) || b.x - a.x);
  $('liveStand').innerHTML = '<b>Live race</b>' + all.map((b, i) =>
    `<div class="${b === race.player ? 'me' : ''}"><span>${i + 1}</span><span>${b === race.player ? 'You' : escapeHtml(b.crewName)}</span><span class="t">${b.finishTime != null ? fmtTime(b.finishTime) : Math.round(b.x) + ' m'}</span></div>`).join('');
}

function endLiveRace() {
  if (live.state !== 'racing') return;
  live.state = 'done';
  sendPresence(true);
}

$('btnLive').onclick = () => { $('live').classList.remove('hide'); renderLiveLobby() };
$('liveClose').onclick = () => { $('live').classList.add('hide') };
$('liveCreate').onclick = () => joinLive(randomCode());
$('liveJoinBtn').onclick = () => joinLive($('liveCodeIn').value);
$('liveStart').onclick = pressLiveStart;
$('liveLeave').onclick = async () => { await leaveLive(); renderLiveLobby() };
connectLive();
