// 89-replays.js: highlight clips. Every K.O. in a real match is scored (big final blow, combo, ring-out, ultimate,
// comeback, deciding blow) and its kill-cam history (88's snapshots and timed events) is copied into a clip. The best
// HL_KEEP clips of the session stay in memory; a small summary of the all-time best is saved in the store.
// The Highlights screen (title menu) replays a clip through the kill-cam player and can export it as a WebM video:
// the replay plays on screen while each finished frame (bloom included) is copied to a fixed 1280x720 canvas that
// MediaRecorder records via captureStream, with the game's sound when WebAudio is running.

const HL_KEEP = 5;
const HL = { clips: [], pending: [], lastAmt: new WeakMap(), best: store.getArr('highlights').filter(h => h && typeof h.title === 'string' && Number.isFinite(h.score) && Array.isArray(h.tags)), playing: null, rec: null,
  lastExport: null, nextId: 1 };

// ---------- scoring and capture ----------
on('damage', (B, amt) => { if (!G_STATE.sim) HL.lastAmt.set(B, amt); });

on('ko', (victim, killer, o) => {
  if (G_STATE.sim || G_STATE.demo || victim.summon || KC.play || G_STATE.state !== 'play') return;
  const k = killer && killer !== victim ? killer : null, ringout = !!o && o.kind === 'ringout', c = chest(victim);
  const tags = [], blow = HL.lastAmt.get(victim) || 0;
  let score = 10 + blow;
  if (ringout) { score += 15; tags.push('Ring-out'); }
  if (k && k.ult) { score += 25; tags.push('Ultimate'); }
  if (k && k.combo >= 3) { score += k.combo * 4; tags.push(k.combo + '-hit combo'); }
  if (k && k.alive && k.hp / k.maxHp < .25) { score += 20; tags.push('Comeback'); }
  if (aliveTeams().length <= 1) { score += 10; tags.push('Deciding blow'); }
  if (blow >= 20) tags.push(blow + ' damage');
  HL.pending.push({ ko: { t: G_STATE.t, victim, killer: k, x: c.x, y: c.y, ringout }, score: Math.round(score), tags,
    map: MAP.name || MAP.key, weapon: k ? weaponLabel(k) : '' });
});

// Copies the kill-cam history around each pending K.O. once its tail is recorded (or right away when forced: the
// kill-cam is about to reset or replay). 88 calls hlFlush(true) before it clears its buffers.
function hlFlush(force) {
  if (!HL.pending.length || HL.playing) return;
  const keep = [];
  for (const p of HL.pending) {
    if (!force && G_STATE.t < p.ko.t + KC_AFTER + .05 && G_STATE.t >= p.ko.t) { keep.push(p); continue; }
    try { hlCapture(p); } catch (e) { report(e, 'highlight capture'); }
  }
  HL.pending = keep;
}
setInterval(() => { if (G_STATE.state === 'play') hlFlush(false); }, 100);

function hlCapture(p) {
  const t0 = p.ko.t - KC_BEFORE - .05, t1 = p.ko.t + KC_AFTER + .05;
  const frames = KC.frames.filter(f => f.t >= t0 && f.t <= t1), events = KC.events.filter(e => e.t >= t0 && e.t <= t1);
  if (frames.length < 20 || p.ko.t - frames[0].t < .8) return;
  const clip = Object.assign(p, { id: HL.nextId++, frames, events, when: Date.now(), thumb: hlThumb(),
    title: p.ko.killer ? `${p.ko.killer.name} K.O.s ${p.ko.victim.name}` : `${p.ko.victim.name} falls` });
  HL.clips.push(clip);
  HL.clips.sort((a, b) => b.score - a.score);
  HL.clips.length = Math.min(HL.clips.length, HL_KEEP);
  if (HL.clips.includes(clip)) hlRemember(clip);
}

// A small picture of the moment (the frame on screen right after the K.O.).
function hlThumb() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 240; c.height = 135;
  try { c.getContext('2d').drawImage(cv, VIEW.vx, VIEW.vy, VIEW.vw, VIEW.vh, 0, 0, 240, 135); } catch (e) { return null; }
  return c;
}

// The all-time best list in the store: titles and scores only (clips themselves are too big to save).
function hlRemember(clip) {
  const row = { title: clip.title, score: clip.score, tags: clip.tags.slice(0, 3), map: clip.map, weapon: clip.weapon, when: clip.when };
  HL.best = HL.best.concat(row).sort((a, b) => b.score - a.score).slice(0, HL_KEEP);
  store.set('highlights', HL.best);
}

// ---------- playback ----------
// Replays a clip through the kill-cam player from the title menu; returns to the Highlights screen afterwards.
function hlPlay(clip, onEnd) {
  if (!clip || KC.play || G_STATE.state !== 'menu') return false;
  HL.playing = { clip, demo: G_STATE.demo, onEnd };
  KC.frames = clip.frames.slice(); KC.events = clip.events.slice(); KC.pending = clip.ko;
  G_STATE.demo = false;            // so damage numbers and floating text replay too
  UI.next = 'highlights';
  kcStart('menu');
  if (!KC.play) { hlEnded(); return false; }
  return true;
}

function hlEnded() {
  const P = HL.playing;
  if (!P) return;
  HL.playing = null;
  G_STATE.demo = P.demo;
  if (P.onEnd) P.onEnd();
}
on('state', (now, before) => { if (before === 'killcam' && HL.playing) hlEnded(); });

// ---------- video export ----------
function hlExportSupport() {
  if (typeof MediaRecorder === 'undefined') return 'This browser cannot record video (no MediaRecorder).';
  if (!HTMLCanvasElement.prototype.captureStream) return 'This browser cannot capture the game canvas as video.';
  if (!hlMime()) return 'This browser cannot encode WebM video.';
  return '';
}
function hlMime() {
  const list = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
}

function hlExport(clip) {
  const why = hlExportSupport();
  if (why) { HL.lastExport = { error: why }; fxModal('Video export unavailable', el('p', { text: why })); return false; }
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 720;
  const stream = canvas.captureStream(30), mime = hlMime(), chunks = [];
  const audio = hlAudioTrack();
  if (audio) stream.addTrack(audio.track);
  let rec;
  try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4e6 }); }
  catch (e) { HL.lastExport = { error: e.message }; fxModal('Video export failed', el('p', { text: e.message })); return false; }
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = () => hlExportDone(new Blob(chunks, { type: mime.split(';')[0] }), audio);
  HL.rec = { canvas, g: canvas.getContext('2d'), rec, mime, frames: 0 };
  if (!hlPlay(clip, () => { if (rec.state !== 'inactive') rec.stop(); HL.rec = null; })) { HL.rec = null; return false; }
  rec.start(250);
  return true;
}

// Routes the game's sound into the recording too (when WebAudio runs). Returns { track, node } or null.
function hlAudioTrack() {
  if (!AC || AC.state !== 'running' || !AC.createMediaStreamDestination || !MASTER) return null;
  try {
    const node = AC.createMediaStreamDestination();
    MASTER.connect(node);
    const track = node.stream.getAudioTracks()[0];
    return track ? { track, node } : null;
  } catch (e) { return null; }
}

// Called by render (85) after every finished frame: copies the arena viewport (and the bloom) into the recording.
function hlRecordFrame() {
  const R = HL.rec;
  if (!R || G_STATE.state !== 'killcam') return;
  const g = R.g;
  g.globalCompositeOperation = 'source-over';
  g.drawImage(cv, VIEW.vx, VIEW.vy, VIEW.vw, VIEW.vh, 0, 0, 1280, 720);
  const b = BLOOM.cv;
  if (b && b.style.display !== 'none') {
    const s = b.width / cv.width;
    g.globalCompositeOperation = 'screen';
    g.drawImage(b, VIEW.vx * s, VIEW.vy * s, VIEW.vw * s, VIEW.vh * s, 0, 0, 1280, 720);
  }
  R.frames++;
}

function hlExportDone(blob, audio) {
  if (audio) try { MASTER.disconnect(audio.node); } catch (e) { /* already gone */ }
  HL.lastExport = { size: blob.size, type: blob.type };
  if (!blob.size) return fxModal('Video export failed', el('p', { text: 'The recording came out empty. Try again with the tab in front.' }));
  const url = URL.createObjectURL(blob), name = 'stick-clash-highlight-' + Date.now() + '.webm';
  fxDownload(url, name);
  const modal = fxModal('Highlight exported', el('video', { src: url, controls: true, loop: true, class: 'fx-preview' }),
    el('p', { class: 'hint', text: `${(blob.size / 1024).toFixed(0)} KB WebM. If no download started (some embedded viewers block downloads), right-click the video and choose "Save video as", or open the downloaded game file.` }));
  modal.addEventListener('fxclose', () => URL.revokeObjectURL(url));
}

// ---------- Highlights screen ----------
function hlScreen() {
  const cards = HL.clips.map((c, i) => el('article', { class: 'hl-card' },
    c.thumb || el('div', { class: 'hl-thumb' }),
    el('div', { class: 'hl-info' },
      el('strong', { text: `#${i + 1} ${c.title}` }),
      el('small', { text: [c.weapon, c.map].filter(Boolean).join(' · ') }),
      el('span', { class: 'chips' }, c.tags.map(t => el('em', { text: t })), el('em', { class: 'hl-score', text: c.score + ' pts' }))),
    el('div', { class: 'hl-btns' },
      uiButton('▶ Play', () => hlPlay(c), 'go', { 'data-key': 'hl-play-' + c.id }),
      uiButton('⬇ Export video', () => hlExport(c), null, { 'data-key': 'hl-export-' + c.id }))));
  const empty = el('div', { class: 'hl-empty' }, el('b', { text: '🎬' }), el('h3', { text: 'No highlights yet' }),
    el('p', { class: 'tag', text: 'Knock someone out in a match: the best five K.O.s of this session are kept here as replay clips you can watch and export as video.' }));
  const best = HL.best.length ? el('section', { class: 'set-group' }, el('h3', { text: 'All-time best' }),
    el('ol', { class: 'hl-best' }, HL.best.map(b => el('li', {}, el('b', { text: b.title }), ` · ${b.score} pts`, b.tags.length ? ` · ${b.tags.join(', ')}` : '')))) : null;
  return sheet('Highlights', el('div', { class: 'hl-wrap' }, cards.length ? cards : empty, best), null);
}

// Title menu: a Highlights entry next to Trophies & Stats (wrapped at boot, after 95 has registered the menu).
on('boot', () => {
  SCREENS.highlights = hlScreen;      // SCREENS lives in 95-ui, which loads after this slice
  const build = SCREENS.menu;
  SCREENS.menu = () => {
    const node = build();
    try { hlMenuItem(node); } catch (e) { report(e, 'highlights menu'); }
    return node;
  };
  if (window.SC) window.SC.highlights = { HL, play: hlPlay, export: hlExport, flush: hlFlush, support: hlExportSupport };
});
function hlMenuItem(node) {
  const labels = Array.from(node.querySelectorAll('.menu-item .mi-label'));
  const trophies = labels.find(l => /Trophies/.test(l.textContent));
  const item = el('button', { class: 'menu-item', onclick: () => { uiSfx('click'); openScreen('highlights', 'menu'); } },
    el('span', { class: 'mi-label', text: 'Highlights' }), el('small', { text: HL.clips.length ? `${HL.clips.length} K.O. clips` : 'Replays & video' }));
  const host = trophies && trophies.closest('.menu-item');
  if (host && host.parentNode) { const pair = el('div', { class: 'menu-pair' }); host.replaceWith(pair); pair.append(host, item); }
  else { const nav = node.querySelector('nav'); if (nav) nav.append(item); }
}

// Results screen: a shortcut to the clips once there are some.
on('state', st => {
  if (st !== 'over' || !HL.clips.length) return;
  setTimeout(() => {
    const row = document.querySelector('#over .results-card .row');
    if (row && !row.querySelector('[data-key="hl-open"]')) row.append(uiButton('🎬 Highlights', () => { UI.next = 'highlights'; UI.back.highlights = 'menu'; toMenu(); }, null, { 'data-key': 'hl-open' }));
  }, 0);
});
