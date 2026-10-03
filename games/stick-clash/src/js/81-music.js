// 81-music.js: an original procedural synthwave loop (no samples). A calm "menu" theme plays behind the menus and a
// driving "fight" theme during matches. It only starts after the player's first key or tap (browsers require a user
// gesture for audio), follows SETTINGS.musicOn and the music volume slider, and is muffled while paused or in slow-mo.
//
// Voices: detuned saw pad, plucked saw bass, square arpeggio through a tempo-synced echo, and drums (kick, snare,
// hats). Pad and bass duck on every kick for the classic pumping feel. Everything is scheduled ~150 ms ahead.

const MUSIC_THEMES = {
  // Chords as semitone offsets from A2 (110 Hz). 'a' plays twice, then 'b', then 'a' again (16 bars).
  menu: { bpm: 92, root: 0, drums: 'soft', arpEvery: 2, padVol: .07, bassVol: .11, arpVol: .028,
    a: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],          // Am  F  C  G
    b: [[-4, 0, 3], [-2, 2, 5], [0, 3, 7], [0, 3, 7]] },          // F   G  Am Am
  fight: { bpm: 124, root: 7, drums: 'full', arpEvery: 1, padVol: .05, bassVol: .14, arpVol: .03,
    a: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]],         // Em  C  G  D   (root E)
    b: [[-4, 0, 3], [-2, 2, 5], [0, 3, 7], [1, 5, 8]] },          // C   D  Em F (a lift into the loop)
};
const MUSIC_FORM = ['a', 'a', 'b', 'a'];
const MUSIC_LOOKAHEAD = .15;    // seconds of notes scheduled ahead of the clock

const MUSIC = { theme: null, want: 'menu', step: 0, next: 0, nodes: null, timer: 0 };

const musicHz = semi => 110 * Math.pow(2, semi / 12);
const musicOn = () => typeof SETTINGS === 'undefined' || SETTINGS.musicOn !== false;

// Builds the music mixer once audio exists: voices -> duck -> filter -> MUSIC_BUS, arp -> echo -> filter.
function musicNodes() {
  if (MUSIC.nodes || !AC || !MUSIC_BUS) return MUSIC.nodes;
  const filter = AC.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 16000; filter.Q.value = .7;
  filter.connect(MUSIC_BUS);
  const duck = AC.createGain(); duck.connect(filter);
  const dry = AC.createGain(); dry.connect(filter);
  const echo = AC.createDelay(1), fb = AC.createGain(), wet = AC.createGain();
  fb.gain.value = .38; wet.gain.value = .45;
  echo.connect(fb).connect(echo); echo.connect(wet).connect(filter);
  MUSIC.nodes = { filter, duck, dry, echo };
  return MUSIC.nodes;
}

// One synth note into `out`: oscillators (detuned copies for width), an optional filter sweep and an envelope.
function musicNote(out, t, freq, dur, o) {
  const g = AC.createGain(), peak = o.vol;
  let dest = g;
  if (o.cutoff) {
    const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 4;
    fl.frequency.setValueAtTime(o.cutoff, t); fl.frequency.exponentialRampToValueAtTime(o.cutoffEnd || o.cutoff, t + dur);
    fl.connect(g); dest = fl;
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + (o.attack || .005));
  if (o.sustain) g.gain.setValueAtTime(peak, t + dur - (o.release || .1));
  g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  g.connect(out);
  for (const det of o.detune || [0]) {
    const osc = AC.createOscillator();
    osc.type = o.type; osc.frequency.value = freq; osc.detune.value = det;
    osc.connect(dest); osc.start(t); osc.stop(t + dur + .05);
    audioVoice(osc);
  }
}

function musicKick(t, vol) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .3);
  o.connect(g).connect(MUSIC.nodes.dry); o.start(t); o.stop(t + .32);
  audioVoice(o);
  const d = MUSIC.nodes.duck.gain;      // sidechain pump
  d.cancelScheduledValues(t); d.setValueAtTime(.45, t); d.linearRampToValueAtTime(1, t + .22);
}

function musicNoise(t, dur, freq, type, vol) {
  const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NOISE; s.loop = true; fl.type = type; fl.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(fl).connect(g).connect(MUSIC.nodes.dry); s.start(t, Math.random()); s.stop(t + dur + .02);
  audioVoice(s);
}

// How tense the fight is (0..1): someone near death or the match on the line adds drive.
function musicIntensity() {
  if (G_STATE.state !== 'play' || G_STATE.demo) return 0;
  const low = F.some(f => f.alive && !f.summon && f.hp / f.maxHp < .3);
  const matchPoint = G_STATE.score.some(s => s >= G_STATE.winScore - 1);
  return (low ? .6 : 0) + (matchPoint ? .4 : 0);
}

// Schedules everything that happens on one 16th-note step.
function musicStep(t, step, th) {
  const n = MUSIC.nodes, beat = 60 / th.bpm, s16 = beat / 4, bar = (step >> 4) % 16, inBar = step % 16;
  const chord = th[MUSIC_FORM[bar >> 2]][bar % 4].map(c => c + th.root);
  if (inBar === 0) {     // pad: the whole chord, held for the bar
    for (const c of chord) musicNote(n.duck, t, musicHz(c + 12), beat * 4, { type: 'sawtooth', vol: th.padVol / 3, detune: [-9, 8],
      attack: beat * .8, sustain: true, release: beat, cutoff: 1400, cutoffEnd: 2200, q: .8 });
  }
  if (inBar % 2 === 0) {  // bass: root in 8ths, octave jump on the off-beats
    const up = inBar % 4 === 2 ? 12 : 0;
    musicNote(n.duck, t, musicHz(chord[0] - 12 + up), s16 * 1.8, { type: 'sawtooth', vol: th.bassVol, cutoff: 900, cutoffEnd: 180, q: 6 });
  }
  if (inBar % th.arpEvery === 0) {   // arpeggio climbing the chord over two octaves
    const k = (inBar / th.arpEvery) % 6, note = chord[k % 3] + 24 + (k >= 3 ? 12 : 0);
    musicNote(n.echo, t, musicHz(note), s16 * 1.4, { type: 'square', vol: th.arpVol, cutoff: 4200, cutoffEnd: 900, q: 2 });
  }
  musicDrums(t, inBar, bar, th);
}

function musicDrums(t, inBar, bar, th) {
  if (th.drums === 'soft') {   // menu: a heartbeat kick and shakers, after an intro bar
    if (bar > 0 && (inBar === 0 || inBar === 10)) musicKick(t, .32);
    if (inBar % 4 === 2) musicNoise(t, .04, 8000, 'highpass', .025);
    return;
  }
  const fill = bar % 4 === 3 && inBar >= 12;
  if (inBar % 4 === 0) musicKick(t, .55);
  if (inBar === 4 || inBar === 12 || (fill && inBar % 2 === 0)) {
    musicNoise(t, .16, 1800, 'bandpass', .22);
    const o = AC.createOscillator(), g = AC.createGain();   // snare body
    o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(140, t + .08);
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .1);
    o.connect(g).connect(MUSIC.nodes.dry); o.start(t); o.stop(t + .12); audioVoice(o);
  }
  const hats16 = musicIntensity() > .5;
  if (inBar % 4 === 2) musicNoise(t, .09, 7500, 'highpass', .06);      // open hat on the off-beat
  else if (hats16 || inBar % 2 === 0) musicNoise(t, .03, 9000, 'highpass', .03);
}

// Theme for the current game state: calm in menus, driving in matches.
function musicWanted() {
  const s = G_STATE.state;
  return s === 'menu' || s === 'over' ? 'menu' : 'fight';
}

// Muffles the music while paused, during slow-mo and in the kill-cam replay.
function musicFilterTarget() {
  const s = G_STATE.state;
  if (s === 'paused') return 600;
  if (s === 'killcam') return 1100;
  if (FX.slow > 0) return 1800;
  return 16000;
}

function musicTick() {
  if (!AC || AC.state !== 'running' || !musicOn() || MUTED || !musicNodes()) return;
  const now = AC.currentTime;
  MUSIC.nodes.filter.frequency.setTargetAtTime(musicFilterTarget(), now, .12);
  if (MUSIC.next < now) { MUSIC.next = now + .06; }          // first start, or the tab was asleep: don't burst-schedule
  MUSIC.want = musicWanted();
  while (MUSIC.next < now + MUSIC_LOOKAHEAD) {
    if (!MUSIC.theme || (MUSIC.want !== MUSIC.theme && MUSIC.step % 16 === 0)) musicSwitch(MUSIC.want);
    const th = MUSIC_THEMES[MUSIC.theme];
    try { musicStep(MUSIC.next, MUSIC.step, th); } catch (e) { report(e, 'music'); }
    MUSIC.step++;
    MUSIC.next += 60 / th.bpm / 4;
  }
}

// Changes theme on a bar line, restarting the song form; sets the echo to a dotted-8th of the new tempo.
function musicSwitch(name) {
  MUSIC.theme = name; MUSIC.step = 0;
  MUSIC.nodes.echo.delayTime.setValueAtTime(60 / MUSIC_THEMES[name].bpm * .75, AC.currentTime);
}

setInterval(() => { try { musicTick(); } catch (e) { report(e, 'music'); } }, 40);
