// 80-audio.js: synthesized sound effects (WebAudio, no files). sfx(name, volume) plays one, sfxAt(name, x, volume)
// pans it to where it happened; defSfx(name, fn) adds more. Silent during the menu demo, during SC.sim and when muted
// (M). Audio starts on the first key or tap, and the game runs fine (silently) where WebAudio is missing.
//
// Signal path: tone()/noise() -> [per-sound panner] -> SFX_BUS -> MASTER -> compressor -> speakers.
// Music (81-music.js) goes MUSIC_BUS -> MASTER, so the Settings sliders (AUDIO_MIX) control each bus.
//
// Every weapon has its own swing/shot and hit sound over the generic body 'hit' (80b; `hitSfx` still overrides).
// sfx('family:arg') plays SFX.family(vol, arg), so a weapon key or a voice pitch replays as a plain (name, vol) pair.

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
const AUDIO_MUSIC_ROOM = 24;       // voices effects leave free, so a brawl can't cut the music out (music uses audioBusy(0))
let SFX_RECORD = null;             // the kill-cam sets this to hear every sfx(name, vol) call

function applyAudioMix() {
  if (!AC) return;
  const now = AC.currentTime;
  if (MASTER) MASTER.gain.setTargetAtTime(MUTED ? 0 : .9 * AUDIO_MIX.master, now, .02);
  if (SFX_BUS) SFX_BUS.gain.setTargetAtTime(AUDIO_MIX.sfx, now, .02);
  if (MUSIC_BUS) MUSIC_BUS.gain.setTargetAtTime(AUDIO_MIX.music * .55, now, .02);
}

function defSfx(name, fn) { SFX[name] = fn; }

// The events browsers count as a user gesture (activation): the announcer's speech warm-up (82) and the benchmark
// (84-quality) wait for one of these. pointerdown is not one on iOS, and Esc is excluded everywhere.
const AUDIO_GESTURE_EVENTS = new Set(['pointerup', 'touchend', 'click', 'keydown']);
const audioIsGesture = e => !!e && e.isTrusted && AUDIO_GESTURE_EVENTS.has(e.type) && !(e.type === 'keydown' && e.code === 'Escape');

// Also the listener for every activation event, so resume() runs synchronously inside the gesture (iOS insists).
function initAudio(e) {
  if (audioIsGesture(e)) emit('gesture', e);   // a real tap or key: the announcer (82), the benchmark (84) and 92-device listen
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
// A suspended or 'interrupted' context would queue every voice to burst out on resume: every voice asks audioBusy.
const audioLive = () => !!AC && AC.state === 'running';
const audioBusy = (room = AUDIO_MUSIC_ROOM) => !audioLive() || AUDIO_VOICES >= AUDIO_MAX_VOICES - room;
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
  if (!audioLive() || MUTED || G_STATE.sim || (G_STATE.state === 'menu' && !always)) return;
  const cut = name.indexOf(':'), fn = SFX[name] || (cut > 0 && SFX[name.slice(0, cut)]);
  if (!fn) return;
  const now = AC.currentTime, pitch = AUDIO_PITCH;
  if (SFX_LAST[name] && now - SFX_LAST[name] < .03) return;   // identical sounds in the same instant just get louder
  SFX_LAST[name] = now;
  if (FX.hitstop > 0) AUDIO_PITCH *= 1 - Math.min(FX.hitstop, .2) * .5;   // a frozen hit sounds a touch lower and heavier
  try { fn(clamp(vol, 0, 2), name.slice(cut + 1)); } catch (e) { report(e, 'sfx ' + name); } finally { AUDIO_PITCH = pitch; }
}
const uiSfx = name => sfx(name, 1, true);

// Like sfx, panned left/right by where x (arena units) is on screen.
function sfxAt(name, x, vol = 1) {
  if (!audioLive() || MUTED || G_STATE.sim || G_STATE.state === 'menu' || !AC.createStereoPanner) { sfx(name, vol); return; }
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

// A drone held while re-triggered (chainsaw motor, flamethrower roar), so it always stops with the action.
const AUDIO_HELD = {};
function audioHold(id, secs, wave, freq, vol) {
  if (!audioLive()) return;
  const now = AC.currentTime, h = AUDIO_HELD[id], noisy = wave === 'noise';
  if (h || audioBusy()) { if (h) h.end = now + secs; return; }
  const src = noisy ? AC.createBufferSource() : AC.createOscillator(), fl = AC.createBiquadFilter(), g = AC.createGain();
  if (noisy) { src.buffer = NOISE; src.loop = true; } else { src.type = wave; src.frequency.value = freq * AUDIO_PITCH; }
  fl.type = 'lowpass'; fl.frequency.value = noisy ? freq : freq * 9;
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + .04);
  src.connect(fl).connect(g).connect(audioOut()); src.start(now);
  audioVoice(src);
  AUDIO_HELD[id] = { end: now + secs, g, src };
}
function audioHoldTick() {
  for (const id in AUDIO_HELD) {
    const h = AUDIO_HELD[id], now = AC.currentTime;
    if (now < h.end && !MUTED) continue;
    h.g.gain.setTargetAtTime(0, now, .04); h.src.stop(now + .25);
    delete AUDIO_HELD[id];
  }
}
setInterval(() => { if (AC) try { audioHoldTick(); } catch (e) { report(e, 'audio hold'); } }, 50);

// ---------- core sounds ----------
// A body hit (v = damage / 22): light hits stay soft; heavy ones add a crack, a deeper thump and a music duck.
defSfx('hit', v => {
  const heavy = clamp((v - .55) / .7, 0, 1);
  thump(190 - 90 * heavy, 48 - 18 * heavy, .16 + .24 * heavy, (.42 + .3 * heavy) * v);
  noise(.1, 1100 - 500 * heavy, .32 * v);
  if (heavy > 0) { noise(.015, 6000, .55 * heavy, 'highpass'); tone(2400, 400, .025, 'square', .08 * heavy); }
  if (heavy > .35) musicDuck(heavy);
});
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

// The crowd roars for every K.O., loudest for the one that ends the round.
on('ko', victim => { if (!victim.summon && SETTINGS.crowd !== false) sfx('cheer', koDecides(victim) ? 1 : .55); });   // crowd: 83
