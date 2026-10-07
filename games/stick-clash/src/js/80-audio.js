// 80-audio.js: synthesized sound effects (WebAudio, no files). sfx(name, volume) plays one, sfxAt(name, x, volume)
// pans it to where it happened; defSfx(name, fn) adds more. Silent during the menu demo, during SC.sim and when muted
// (M). Audio starts on the first key or tap, and the game runs fine (silently) where WebAudio is missing.
//
// Signal path: tone()/noise() -> [per-sound panner] -> SFX_BUS -> MASTER -> compressor -> speakers.
// Music (81-music.js) goes MUSIC_BUS -> MASTER, so the Settings sliders (AUDIO_MIX) control each bus.
//
// Weapon hits get a layer by weapon category on top of the generic body 'hit' (see AUDIO_HIT_LAYER below);
// a weapon may name its own with `hitSfx: 'my-sound'`.

const SFX = {};
const SFX_LAST = {};
let AC = null, NOISE = null, MASTER = null, MUTED = store.getBool('muted');
let AUDIO_FAILED = false;          // WebAudio missing or blocked: stop trying on every key press
let AUDIO_NEED_GESTURE = true;     // no running AudioContext yet: sound waits for a tap or key (92-device shows a hint for pad-only starts)
// iOS mutes WebAudio while the ringer switch is on silent unless the page asks for a 'playback' audio session.
const AUDIO_DEFAULTS = { silentSwitch: 'play' };
for (const k in AUDIO_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = AUDIO_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = AUDIO_DEFAULTS[k];
}
SETTING_CHOICES.silentSwitch = ['play', 'respect'];
// Volume mix from the Settings screen (0..1 each). Sound effects go through SFX_BUS; music should use MUSIC_BUS.
const AUDIO_MIX = { master: 1, sfx: 1, music: .6 };
let SFX_BUS = null, MUSIC_BUS = null;
let SFX_OUT = null;                // where tone()/noise() connect right now (SFX_BUS, or a panner inside sfxAt)
let AUDIO_PITCH = 1;               // < 1 pitches every sound down (the kill-cam replay sets it)
let AUDIO_VOICES = 0;              // sources currently playing; new ones are dropped above AUDIO_MAX_VOICES
const AUDIO_MAX_VOICES = 90;
let SFX_RECORD = null;             // the kill-cam sets this to hear every sfx(name, vol) call

function applyAudioMix() {
  if (!AC) return;
  const now = AC.currentTime;
  if (MASTER) MASTER.gain.setTargetAtTime(MUTED ? 0 : .9 * AUDIO_MIX.master, now, .02);
  if (SFX_BUS) SFX_BUS.gain.setTargetAtTime(AUDIO_MIX.sfx, now, .02);
  if (MUSIC_BUS) MUSIC_BUS.gain.setTargetAtTime(AUDIO_MIX.music * .55, now, .02);
}

function defSfx(name, fn) { SFX[name] = fn; }

// Also the listener for every activation event, so resume() runs synchronously inside the gesture (iOS insists).
function initAudio(e) {
  if (e && e.isTrusted) emit('gesture', e);   // a real tap or key: the announcer (82) and the sound hint (92-device) listen
  if (AUDIO_FAILED) return;
  if (AC) { audioResume(); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { AUDIO_FAILED = true; return; }
    AC = new Ctx();
    const comp = AC.createDynamicsCompressor();      // glues loud moments together instead of clipping
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .2;
    comp.connect(AC.destination);
    MASTER = AC.createGain(); MASTER.gain.value = 0; MASTER.connect(comp);
    SFX_BUS = AC.createGain(); SFX_BUS.connect(MASTER);
    MUSIC_BUS = AC.createGain(); MUSIC_BUS.connect(MASTER);
    NOISE = AC.createBuffer(1, AC.sampleRate * 1.5, AC.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    AC.addEventListener('statechange', audioStateChanged);
    audioStateChanged();
    audioApplySession();
    applyAudioMix();
    emit('audioReady');
  } catch (e) { AC = null; AUDIO_FAILED = true; }
}
// Safari reports 'interrupted' (a call, Siri, another app's audio) as well as 'suspended': resume from any state.
function audioResume() {
  if (!AC || AC.state === 'running' || typeof AC.resume !== 'function') return;
  try { const p = AC.resume(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* not allowed yet */ }
}
function audioStateChanged() {
  AUDIO_NEED_GESTURE = !AC || AC.state !== 'running';
  emit('audioState', AC ? AC.state : 'none');
}
// SETTINGS.silentSwitch 'play': sound even with the iPhone/iPad ringer switch on silent (an explicit 'playback'
// session). A looping silent <audio> element is the old trick for this; it is not used because it hijacks the audio
// session (ducking other apps' music, taking the lock-screen controls) for the whole visit.
function audioApplySession() {
  const s = navigator.audioSession;
  if (!s || typeof s.type !== 'string') return;
  try { s.type = SETTINGS.silentSwitch === 'respect' ? 'auto' : 'playback'; } catch (err) { /* unsupported value */ }
}
// iOS counts touchend and click as user activation (pointerdown alone is not enough there); capture runs first.
for (const ev of ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click']) addEventListener(ev, initAudio, { passive: true, capture: true });
// Coming back to the tab (or from a call) leaves Safari's context suspended: wake it up again.
document.addEventListener('visibilitychange', () => { if (!document.hidden) initAudio(); });

// Counts a playing source so a burst of sounds can't pile up hundreds of nodes.
function audioVoice(src) {
  AUDIO_VOICES++;
  src.onended = () => { AUDIO_VOICES--; };
}
const audioBusy = () => !AC || AUDIO_VOICES >= AUDIO_MAX_VOICES;
const audioOut = () => SFX_OUT || SFX_BUS || MASTER;

// A pitch sweep from f0 to f1 Hz with a tiny attack (no clicks).
function tone(f0, f1, dur, type, vol, delay = 0) {
  if (audioBusy()) return;
  const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, f0 * AUDIO_PITCH), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * AUDIO_PITCH), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(audioOut()); o.start(t); o.stop(t + dur + .03);
  audioVoice(o);
}

// Filtered noise burst (hits, swooshes, explosions). Starts at a random spot in the buffer so repeats differ.
function noise(dur, freq, vol, type = 'bandpass', delay = 0) {
  noiseSweep(dur, freq, freq, vol, type, delay);
}

// Noise whose filter glides from f0 to f1 Hz: whooshes and risers.
function noiseSweep(dur, f0, f1, vol, type = 'bandpass', delay = 0, q = 1) {
  if (audioBusy()) return;
  const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(), t = AC.currentTime + delay;
  s.buffer = NOISE; s.loop = true; fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(Math.max(20, f0 * AUDIO_PITCH), t);
  if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * AUDIO_PITCH), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .006);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(fl).connect(g).connect(audioOut()); s.start(t, Math.random()); s.stop(t + dur + .03);
  audioVoice(s);
}

// Inharmonic partials that ring like struck metal (clangs, shields, parries).
function metal(f, dur, vol, delay = 0) {
  const parts = [[1, 1], [2.76, .55], [5.4, .3], [8.93, .16]];
  for (const [m, a] of parts) tone(f * m, f * m * .985, dur * (1.1 - a * .3), 'sine', vol * a, delay);
}

// A low pitch drop: kicks, body hits, landings.
function thump(f0, f1, dur, vol, delay = 0) { tone(f0, f1, dur, 'sine', vol, delay); }

// always: play even behind the menu (UI clicks).
function sfx(name, vol = 1, always = false) {
  if (SFX_RECORD && !always) SFX_RECORD(name, vol);
  if (!AC || MUTED || G_STATE.sim || (G_STATE.state === 'menu' && !always)) return;
  const fn = SFX[name];
  if (!fn) return;
  const now = AC.currentTime;
  if (SFX_LAST[name] && now - SFX_LAST[name] < .03) return;   // identical sounds in the same instant just get louder
  SFX_LAST[name] = now;
  try { fn(clamp(vol, 0, 2)); } catch (e) { report(e, 'sfx ' + name); }
}
const uiSfx = name => sfx(name, 1, true);

// Like sfx, panned left/right by where x (arena units) is on screen.
function sfxAt(name, x, vol = 1) {
  if (!AC || MUTED || G_STATE.sim || G_STATE.state === 'menu' || !AC.createStereoPanner) { sfx(name, vol); return; }
  const camX = typeof CAM !== 'undefined' ? CAM.x : W / 2;
  const pan = AC.createStereoPanner();
  pan.pan.value = clamp((x - camX) / (W / 2), -1, 1) * .7;
  pan.connect(SFX_BUS);
  SFX_OUT = pan;
  try { sfx(name, vol); } finally { SFX_OUT = null; }
  setTimeout(() => { try { pan.disconnect(); } catch (e) { /* already gone */ } }, 4000);
}

function setMuted(m) { MUTED = !!m; store.set('muted', MUTED); applyAudioMix(); emit('mute', MUTED); }
function toggleMute() { setMuted(!MUTED); }

// ---------- core sounds ----------
defSfx('hit', v => { thump(190, 48, .2, .5 * v); noise(.12, 1100, .38 * v); });
defSfx('clash', () => { metal(1450, .45, .07); noiseSweep(.16, 7000, 2500, .22, 'highpass'); tone(3200, 2400, .08, 'square', .03); });
defSfx('ko', () => {
  thump(140, 30, .9, .7); tone(330, 55, .9, 'sawtooth', .12); noise(.6, 380, .45, 'lowpass');
  noiseSweep(.5, 5000, 400, .2, 'bandpass', .02, 2);
});
defSfx('orb', () => { for (const [k, f] of [[0, 660], [1, 880], [2, 1320], [3, 1760]]) tone(f, f * 1.01, .16, 'triangle', .08, k * .045); });
defSfx('jump', v => tone(v < 1 ? 380 : 240, v < 1 ? 760 : 470, .09, 'sine', .07));
defSfx('land', v => { thump(130, 50, .1, .22 * v); noise(.1, 700, .14 * v, 'lowpass'); });
// v = weapon mass: heavier weapons whoosh lower and longer.
defSfx('swing', v => { const k = 1 / Math.sqrt(v); noiseSweep(.12 + v * .06, 700 * k, 3200 * k, .2, 'bandpass', 0, 1.6); });
defSfx('dash', () => { noiseSweep(.22, 900, 5200, .2, 'bandpass', 0, 1.2); tone(520, 170, .16, 'sine', .06); });
defSfx('shoot', () => { noise(.06, 3400, .28); thump(260, 60, .1, .25); tone(900, 240, .07, 'square', .04); });
defSfx('boom', v => {
  noise(.8 * v, 180, .8 * v, 'lowpass'); thump(120, 26, .6, .65 * v);
  noiseSweep(.5, 2600, 300, .25 * v, 'bandpass', .03); for (let k = 0; k < 4; k++) noise(.05, 3000, .1 * v, 'highpass', .08 + k * .07 + Math.random() * .05);
});
defSfx('skill', () => { tone(440, 880, .2, 'triangle', .09); tone(660, 1320, .2, 'sine', .06, .05); noiseSweep(.3, 1500, 7000, .06, 'bandpass', 0, 3); });
defSfx('block', () => { metal(880, .35, .09); noise(.08, 4000, .2); thump(160, 80, .08, .2); });
defSfx('reload', () => { tone(320, 300, .04, 'square', .05); noiseSweep(.08, 1200, 3000, .08, 'bandpass', .05); tone(560, 540, .04, 'square', .06, .14); });
defSfx('shatter', () => {
  noiseSweep(.3, 8000, 3500, .28, 'highpass');
  for (let k = 0; k < 6; k++) tone(2600 + Math.random() * 2400, 2400, .12, 'sine', .04, Math.random() * .2);
});
defSfx('blink', () => { tone(1400, 300, .2, 'sine', .1); tone(300, 1600, .18, 'triangle', .06, .05); });
defSfx('slam', () => { noise(.45, 220, .7, 'lowpass'); thump(95, 30, .4, .6); });
defSfx('round', () => { tone(392, 392, .12, 'square', .06); tone(523, 523, .22, 'square', .06, .14); });
defSfx('fight', () => {
  for (const f of [220, 277, 330, 440]) tone(f, f, .5, 'sawtooth', .045);   // a bright major power chord
  thump(150, 40, .3, .5); noiseSweep(.5, 800, 6000, .14, 'bandpass', 0, 1.5);
});
defSfx('click', () => { tone(1200, 1500, .035, 'triangle', .06); tone(2400, 2400, .02, 'sine', .02); });
defSfx('heartbeat', v => { thump(70, 42, .16, .5 * v); thump(64, 40, .14, .36 * v, .2); });
// The crowd: an "aah" swell (formant-filtered noise) and scattered claps.
defSfx('cheer', v => {
  for (const [f, a] of [[650, .5], [1150, .35], [2600, .18]]) noiseSweep(1.8, f * .9, f * 1.05, a * .35 * v, 'bandpass', .05, 5);
  for (let k = 0; k < 26; k++) noise(.04, 2200 + Math.random() * 1500, (.05 + Math.random() * .07) * v, 'bandpass', .1 + Math.random() * 1.5);
});
defSfx('replay', () => { noiseSweep(.45, 300, 4000, .16, 'bandpass', 0, 3); tone(200, 1200, .4, 'sawtooth', .04); tone(1200, 600, .2, 'square', .03, .4); });

// ---------- weapon-category hit layers ----------
defSfx('hit-slash', v => { noiseSweep(.14, 6500, 2200, .3 * v, 'highpass'); tone(2900, 2300, .1, 'triangle', .035 * v); });
defSfx('hit-thud', v => { thump(110, 34, .28, .65 * v); noise(.18, 260, .5 * v, 'lowpass'); });
defSfx('hit-stab', v => { noise(.06, 2400, .35 * v); thump(240, 90, .08, .3 * v); });
defSfx('hit-whip', v => { noise(.04, 7000, .4 * v, 'highpass'); tone(3000, 900, .05, 'square', .04 * v); });
defSfx('hit-punch', v => { thump(170, 55, .12, .55 * v); noise(.08, 600, .4 * v, 'lowpass'); });
defSfx('hit-clang', v => { metal(620, .4, .08 * v); thump(140, 60, .1, .3 * v); });
defSfx('hit-bullet', v => { noise(.05, 3000, .3 * v); tone(1800, 500, .05, 'square', .03 * v); });
defSfx('hit-magic', v => { tone(1700, 300, .22, 'sawtooth', .05 * v); noiseSweep(.2, 6000, 1500, .14 * v, 'bandpass', 0, 3); tone(880, 1760, .12, 'sine', .05 * v, .03); });
defSfx('hit-weird', v => { tone(300, 1400, .12, 'triangle', .08 * v); tone(1400, 200, .14, 'square', .03 * v, .06); });
defSfx('swing-blade', () => tone(3600, 3300, .16, 'sine', .018));
defSfx('swing-chain', () => { for (let k = 0; k < 3; k++) noise(.03, 5200, .07, 'highpass', k * .05); });

const AUDIO_HIT_LAYER = { blade: 'hit-slash', heavy: 'hit-thud', polearm: 'hit-stab', chain: 'hit-whip', fist: 'hit-punch',
  shield: 'hit-clang', ranged: 'hit-thud', magic: 'hit-magic', exotic: 'hit-weird' };

// Which category layer a direct hit gets: the weapon's own hitSfx, else by weapon category and damage kind.
function audioHitLayer(o) {
  const w = o.weapon || (o.src && o.src.w);
  if (w && w.hitSfx) return w.hitSfx;
  if (o.kind === 'proj') return w && w.cat === 'magic' ? 'hit-magic' : 'hit-bullet';
  if (o.kind === 'melee' && w) return AUDIO_HIT_LAYER[w.cat] || null;
  return null;
}

on('damage', (B, amt, o) => {
  if (!AC || !o || o.small) return;
  const layer = audioHitLayer(o);
  if (layer) sfxAt(layer, o.x ?? B.P[1].x, clamp(amt / 16, .5, 1.3));
});
on('attack', f => {
  if (!AC || f.w.ranged || typeof f.w.attack === 'function') return;
  if (f.w.cat === 'blade') sfx('swing-blade');
  else if (f.w.chain) sfx('swing-chain');
});
// The crowd roars for every K.O., loudest for the one that ends the round.
on('ko', victim => { if (!victim.summon && SETTINGS.crowd !== false) sfx('cheer', aliveTeams().length <= 1 ? 1 : .55); });   // crowd: 83
