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
  live.unsubs.push(live.lobby.on('cheer', showCheer));
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
  // Only crews waiting in the lobby (dialog open, or back from a live race) are pulled into a new race.
  const waiting = live.state === 'lobby' || live.state === 'done';
  const here = !$('live').classList.contains('hide') || game.mode === 'live' && game.state !== 'race';
  if (!waiting || !here || !data?.opts) return;
  const o = data.opts;
  // Untrusted: only our own boat classes and distances, whole-number seeds.
  if (!Object.hasOwn(BOAT_CLASSES, o.cls) || !Object.hasOwn(DIFFICULTY, o.difficulty) || ![...DISTANCES, 4000].includes(o.distance) || !Number.isInteger(o.seed)) return;
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
  // Crews still racing, and crews already home (they stay on the water and in the standings).
  const others = live.lobby.peers().filter(p => !p.sameTab && p.kind === 'viewer' && (p.presence.state === 'racing' || p.presence.state === 'done') && Number.isFinite(p.presence.x))
    .sort((a, b) => a.peer < b.peer ? -1 : 1).slice(0, LIVE_LANES.length);
  const seen = new Set();
  others.forEach(p => {
    const s = p.presence, cls = Object.hasOwn(BOAT_CLASSES, s.cls) ? s.cls : '1x';
    let r = live.remote.get(p.peer);
    if (!r) {
      // Each newcomer takes the first free lane, so two crews never share one.
      const taken = new Set([...live.remote.values()].map(b => b.lane)), lane = LIVE_LANES.find(l => !taken.has(l)) ?? LIVE_LANES[0];
      r = makeBoat(cls, lane, String(s.name || 'Rower').slice(0, 14)); r.isRemote = true; r.shirt = Number.isInteger(s.shirt) ? s.shirt : 0xffffff; live.remote.set(p.peer, r);
    }
    seen.add(p.peer);
    if (r.stamp !== p.updatedAt) {
      // A fresh report: steer towards it rather than jumping, so the boat never stutters.
      r.stamp = p.updatedAt;
      // Untrusted numbers: finite and in range, or ignored.
      const num = (v, lo, hi, d) => Number.isFinite(v) ? clamp(v, lo, hi) : d;
      r.targetX = num(s.x, 0, race.course.distance + 100, 0);
      r.v = num(s.v, 0, 8, 0);
      r.h = num(s.h, 0, 1, 0);
      r.phase = ['drive', 'recover', 'front', 'crab'].includes(s.ph) ? s.ph : 'front';
      r.finishTime = Number.isFinite(s.ft) && s.ft > 0 && s.ft < 3600 ? s.ft : null;
      r.z = laneZ(r.lane) + num(s.off, -4, 4, 0);
    }
    // Between reports, coast on at the last speed, but not for long: a crew that has gone quiet stops.
    if (Date.now() - p.updatedAt < 1000) r.targetX += r.v * dt;
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

/* ----- cheers: tiny reactions between crews during a live race ----- */
const CHEERS = ['💪', '👏', '😅', '🔥'];
let lastCheer = 0;

function sendCheer(i) {
  if (!live.lobby || live.state !== 'racing' || game.state !== 'race' || game.time - lastCheer < 1) return;   // one a second is plenty
  lastCheer = game.time;
  live.lobby.emit('cheer', { i }).catch(() => {});
}

const cheerSeen = new Map();   // peer -> last time, so one crew can't flood the screen
function showCheer(msg) {
  if (Date.now() - (cheerSeen.get(msg.peer) || 0) < 800 || $('cheers').childElementCount > 5) return;
  cheerSeen.set(msg.peer, Date.now());
  const i = msg.data?.i, who = msg.sameTab ? 'You' : String(live.lobby?.peers().find(p => p.peer === msg.peer)?.presence.name || 'Rower').slice(0, 14);
  if (!(i >= 0 && i < CHEERS.length)) return;   // untrusted: only our own four reactions are ever shown
  const el = document.createElement('div');
  el.className = 'cheer';
  el.textContent = `${who} ${CHEERS[i]}`;
  $('cheers').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

addEventListener('keydown', e => { const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code); if (i >= 0 && game.mode === 'live') sendCheer(i) });
document.querySelectorAll('#cheerBar button').forEach((b, i) => b.onclick = e => { e.stopPropagation(); sendCheer(i) });
