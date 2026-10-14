// 81-music.js: original procedural music (no samples). A calm "menu" theme plays behind the menus and every arena
// has its own track style (MUSIC_ARENAS) during matches, with intensity layers that rise with the fight.
// It only starts after the player's first key or tap (browsers require a user gesture for audio), follows
// SETTINGS.musicOn and the music volume slider, and is muffled while paused, in slow-mo, replays and photo mode.
//
// Voices: detuned saw pad, plucked saw bass, square arpeggio through a tempo-synced echo, drums (kick, snare,
// hats) and a lead melody. Pad and bass duck on every kick for the classic pumping feel. Scheduled ~150 ms ahead.

const MUSIC_THEMES = {
  // Chords as semitone offsets from A2 (110 Hz). 'a' plays twice, then 'b', then 'a' again (16 bars).
  // mel: the lead tune, [step, semitones, 16ths] per note.
  menu: { bpm: 92, root: 0, drums: 'soft', arpEvery: 2, padVol: .07, bassVol: .11, arpVol: .028, leadStyle: 'chalk',
    a: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],          // Am  F  C  G
    b: [[-4, 0, 3], [-2, 2, 5], [0, 3, 7], [0, 3, 7]],           // F   G  Am Am
    mel: { a: [[0, 24, 3, 3, 27, 3, 6, 31, 2, 8, 36, 4, 12, 34, 2, 14, 31, 2], [0, 32, 4, 4, 31, 2, 6, 27, 2, 8, 24, 6],
      [0, 22, 3, 3, 27, 3, 6, 31, 2, 8, 34, 4, 12, 32, 2, 14, 31, 2], [0, 29, 4, 4, 26, 2, 6, 22, 2, 8, 29, 6]],
    b: [[0, 36, 6, 6, 34, 2, 8, 32, 4, 12, 31, 4], [0, 29, 6, 6, 31, 2, 8, 34, 4, 12, 32, 2, 14, 31, 2],
      [0, 31, 4, 4, 27, 2, 6, 26, 2, 8, 24, 8], [12, 27, 2, 14, 29, 2]] } },
  fight: { bpm: 124, root: 7, drums: 'full', arpEvery: 1, padVol: .05, bassVol: .14, arpVol: .03,
    a: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]],         // Em  C  G  D   (root E)
    b: [[-4, 0, 3], [-2, 2, 5], [0, 3, 7], [1, 5, 8]] },          // C   D  Em F (a lift into the loop)
};
const MUSIC_FORM = ['a', 'a', 'b', 'a'];
const MUSIC_LOOKAHEAD = .15;    // seconds of notes scheduled ahead of the clock

const MUSIC = { theme: null, want: 'menu', step: 0, next: 0, nodes: null, timer: 0, leads: 0, leadStyle: '' };

const musicHz = semi => 110 * Math.pow(2, semi / 12);
const musicOn = () => typeof SETTINGS === 'undefined' || SETTINGS.musicOn !== false;

// Builds the music mixer once audio exists: voices -> duck -> filter -> MUSIC_BUS, arp -> echo -> filter.
function musicNodes() {
  if (MUSIC.nodes || !AC || !MUSIC_BUS) return MUSIC.nodes;
  const filter = AC.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 16000; filter.Q.value = .7;
  const hit = AC.createGain(); hit.connect(MUSIC_BUS); filter.connect(hit);
  const duck = AC.createGain(); duck.connect(filter);
  const dry = AC.createGain(); dry.connect(filter);
  const echo = AC.createDelay(1), fb = AC.createGain(), wet = AC.createGain();
  fb.gain.value = .38; wet.gain.value = .45;
  echo.connect(fb).connect(echo); echo.connect(wet).connect(filter);
  MUSIC.nodes = { filter, duck, dry, echo, hit };
  return MUSIC.nodes;
}

// A heavy hit (80's 'hit') ducks the whole band for a moment.
function musicDuck(depth) {
  const g = MUSIC.nodes && MUSIC.nodes.hit.gain, t = AC.currentTime;
  if (!g) return;
  g.cancelScheduledValues(t); g.setTargetAtTime(1 - .45 * depth, t, .01); g.setTargetAtTime(1, t + .08, .12);
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
    if (audioBusy(0)) break;
    const osc = AC.createOscillator();
    osc.type = o.type; osc.detune.value = det;
    osc.frequency.setValueAtTime(freq * (o.scoop || 1), t);           // scoop: slide up into the note
    if (o.scoop) osc.frequency.exponentialRampToValueAtTime(freq, t + .07);
    osc.connect(dest); osc.start(t); osc.stop(t + dur + .05);
    audioVoice(osc);
  }
}

function musicKick(t, vol) {
  if (audioBusy(0)) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .3);
  o.connect(g).connect(MUSIC.nodes.dry); o.start(t); o.stop(t + .32);
  audioVoice(o);
  const d = MUSIC.nodes.duck.gain;      // sidechain pump
  d.cancelScheduledValues(t); d.setValueAtTime(.45, t); d.linearRampToValueAtTime(1, t + .22);
}

function musicNoise(t, dur, freq, type, vol) {
  if (audioBusy(0)) return;
  const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NOISE; s.loop = true; fl.type = type; fl.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(fl).connect(g).connect(MUSIC.nodes.dry); s.start(t, Math.random()); s.stop(t + dur + .02);
  audioVoice(s);
}

// ---------- arena styles ----------
// Every arena gets its own track: tempo, key, scale, chord progression (scale degrees), drum groove, bass line, arp
// pattern and instruments. Arenas without an entry get a style rolled from their key, so new arenas sound distinct too.
const MUSIC_SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11], dominant: [0, 1, 4, 5, 7, 8, 10],
};
// Drum grooves as 16-step strings: k kick, s snare, o open hat, t tom (x = hit).
const MUSIC_DRUMS = {
  four: { k: 'x...x...x...x...', s: '....x.......x...', o: '..x...x...x...x.', t: '' },
  break: { k: 'x.........x.x...', s: '....x..x.x..x...', o: '..x.......x.....', t: '' },
  half: { k: 'x.........x.....', s: '........x.......', o: '....x.......x...', t: '' },
  shuffle: { k: 'x.....x.x.......', s: '....x.......x..x', o: '..x...x...x...x.', t: '' },
  tribal: { k: 'x..x....x..x....', s: '............x...', o: '', t: '..x...x.x.x...xx' },
  march: { k: 'x...x...x...x...', s: '..x...x.x.x...x.', o: '', t: '' },
  soft: { k: 'x.........x.....', s: '', o: '', t: '' },
};
// [bpm, root (semitones from A), scale, verse degrees, chorus degrees, drums, bass, arp, lead wave, pad wave, swing]
const MUSIC_ARENAS = {
  neon: [124, 7, 'minor', [0, 5, 2, 6], [5, 6, 0, 0], 'four', 'eighths', 'up', 'square', 'sawtooth', 0],
  dojo: [100, 2, 'phrygian', [0, 1, 0, 6], [3, 1, 0, 0], 'tribal', 'sub', 'pent', 'triangle', 'triangle', 0],
  foundry: [132, 5, 'phrygian', [0, 0, 1, 0], [5, 6, 1, 0], 'break', 'pulse', 'random', 'square', 'square', 0],
  frost: [96, 4, 'dorian', [0, 3, 6, 4], [3, 4, 0, 0], 'half', 'sub', 'updown', 'sine', 'triangle', 0],
  moon: [84, 0, 'lydian', [0, 1, 4, 0], [5, 1, 0, 0], 'soft', 'sub', 'random', 'sine', 'sine', 0],
  sky: [116, 3, 'mixo', [0, 6, 3, 0], [3, 4, 6, 0], 'four', 'eighths', 'up', 'triangle', 'sawtooth', 0],
  caldera: [140, 0, 'harmonic', [0, 5, 4, 0], [3, 4, 5, 4], 'break', 'eighths', 'updown', 'sawtooth', 'sawtooth', 0],
  factory: [128, 10, 'minor', [0, 0, 5, 6], [3, 5, 6, 0], 'four', 'offbeat', 'up', 'square', 'square', 0],
  spikepit: [150, 1, 'phrygian', [0, 1, 0, 1], [6, 5, 1, 0], 'break', 'pulse', 'random', 'sawtooth', 'square', 0],
  storm: [136, 8, 'minor', [0, 6, 5, 4], [5, 6, 0, 4], 'break', 'eighths', 'random', 'sawtooth', 'sawtooth', 0],
  desert: [104, 4, 'dominant', [0, 1, 0, 6], [3, 1, 0, 0], 'tribal', 'walk', 'pent', 'triangle', 'triangle', .12],
  temple: [98, 9, 'dorian', [0, 3, 0, 6], [2, 3, 6, 0], 'tribal', 'sub', 'pent', 'triangle', 'sine', 0],
  bounce: [128, 3, 'major', [0, 4, 5, 3], [3, 4, 0, 4], 'four', 'offbeat', 'updown', 'square', 'triangle', 0],
  graveyard: [90, 0, 'harmonic', [0, 3, 4, 0], [5, 3, 4, 4], 'shuffle', 'walk', 'updown', 'triangle', 'square', .2],
  station: [120, 6, 'lydian', [0, 1, 0, 4], [3, 4, 1, 0], 'four', 'eighths', 'up', 'sine', 'sawtooth', 0],
  pirate: [112, 2, 'dorian', [0, 6, 0, 4], [2, 6, 3, 4], 'shuffle', 'walk', 'updown', 'square', 'triangle', .28],
  train: [144, 7, 'mixo', [0, 3, 0, 6], [3, 3, 0, 4], 'march', 'walk', 'up', 'square', 'square', .1],
  jungle: [108, 5, 'dorian', [0, 6, 3, 0], [6, 3, 4, 0], 'tribal', 'offbeat', 'pent', 'triangle', 'triangle', .15],
  candy: [132, 8, 'major', [0, 5, 3, 4], [3, 4, 5, 0], 'four', 'eighths', 'up', 'square', 'triangle', 0],
  eruption: [148, 1, 'harmonic', [0, 0, 5, 4], [5, 4, 5, 4], 'break', 'pulse', 'updown', 'sawtooth', 'sawtooth', 0],
  asteroid: [100, 11, 'lydian', [0, 4, 1, 0], [5, 4, 1, 1], 'half', 'sub', 'random', 'sine', 'sine', 0],
  mansion: [88, 3, 'harmonic', [0, 5, 3, 4], [0, 5, 1, 4], 'shuffle', 'walk', 'updown', 'triangle', 'square', .22],
  kitchen: [118, 10, 'mixo', [0, 3, 4, 0], [3, 6, 4, 0], 'shuffle', 'offbeat', 'up', 'square', 'triangle', .25],
};

// A small string hash so an arena without an entry always rolls the same style.
function musicHash(str) { let h = 7; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

function musicRolledStyle(key) {
  const h = musicHash(key), at = (list, k) => list[(h >>> k) % list.length];
  const prog = [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 4], [0, 1, 0, 4]];
  return [96 + h % 50, h % 12, at(Object.keys(MUSIC_SCALES), 3), at(prog, 5), at(prog, 7), at(['four', 'break', 'half', 'shuffle', 'tribal'], 9),
    at(['eighths', 'offbeat', 'pulse', 'walk', 'sub'], 11), at(['up', 'updown', 'random', 'pent'], 13), at(['square', 'triangle', 'sawtooth', 'sine'], 15),
    at(['sawtooth', 'triangle', 'square'], 17), 0];
}

// A triad on scale degree d (wrapping into the next octave).
function musicTriad(scale, d) {
  const at = k => scale[k % 7] + 12 * Math.floor(k / 7);
  return [at(d), at(d + 2), at(d + 4)];
}

// Builds (and caches) the theme for an arena from its style row.
function musicArenaTheme(mapKey) {
  const name = 'map:' + mapKey;
  if (MUSIC_THEMES[name]) return name;
  const [bpm, root, scaleKey, a, b, drums, bass, arp, lead, pad, swing] = MUSIC_ARENAS[mapKey] || musicRolledStyle(mapKey);
  const scale = MUSIC_SCALES[scaleKey] || MUSIC_SCALES.minor, low = root > 6 ? root - 12 : root;
  MUSIC_THEMES[name] = { bpm, root: low, drums, bass, arp, lead, pad, swing, scale, arpEvery: bpm > 130 ? 2 : 1,
    padVol: pad === 'sawtooth' ? .05 : .07, bassVol: bass === 'sub' ? .17 : .14, arpVol: lead === 'sine' ? .045 : lead === 'sawtooth' ? .022 : .03,
    a: a.map(d => musicTriad(scale, d)), b: b.map(d => musicTriad(scale, d)), mel: musicMelody(scale, a, b, musicHash(mapKey) | 1) };
  return name;
}

// ---------- lead melody ----------
// Bar rhythms: hex digits are note lengths in 16ths, 'r' + digit a rest. Phrase ends hold, then breathe.
const MUSIC_CELLS = ['4444', '224224', '6244', '22228', '4228', '332224', 'r22444', '2r2444'];
const MUSIC_ENDS = ['446r2', '2246r2', '68r2', 'cr4', '428r2'];
const musicRng = s => () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
function musicCell(str) {   // -> [[step, length], ...]
  const out = [];
  for (let i = 0, s = 0; i < str.length; i++) {
    const rest = str[i] === 'r', len = parseInt(str[rest ? ++i : i], 16);
    if (!rest) out.push([s, len]);
    s += len;
  }
  return out;
}

// An arena's seeded tune: per section a call ending open (3rd or 5th), then an answer repeating the call's first bar
// on its own chord (the repeat makes it hummable) and landing on a root. Steps, some leaps, chord tones on beats.
function musicMelody(scale, degA, degB, seed) {
  const rng = musicRng(seed), pick = list => list[Math.floor(rng() * list.length)];
  const semi = k => scale[(k % 7 + 7) % 7] + 12 * Math.floor(k / 7);
  const section = (degs, home) => {
    const bars = [[], [], [], []], cell = musicCell(pick(MUSIC_CELLS)), motif = [];
    let k = home, dir = 1;
    const near = (d, set) => {   // nearest degree to k that is `set` steps above chord root d
      for (let r = 0; r < 7; r++) for (const j of [k + r * dir, k - r * dir]) if (set.includes((j - d + 70) % 7)) return j;
    };
    const walk = (bar, notes, end) => notes.forEach(([s, len], i) => {
      const r = rng(), leap = r > .85;
      if (end && i === notes.length - 1) k = near(degs[bar], end);
      else if (s % 8 === 0) k = near(degs[bar], [0, 2, 4]);
      else {
        if (r < .15) dir = -dir;
        k += dir * (leap ? 3 : r < .7 ? 1 : 2);
        if (leap) dir = -dir;
        if (k > home + 5) { k -= 2; dir = -1; } else if (k < home - 4) { k += 2; dir = 1; }
      }
      bars[bar].push(s, semi(k), len);
      if (!bar) motif.push(k);
    });
    walk(0, cell);
    walk(1, musicCell(pick(MUSIC_ENDS)), [2, 4]);
    const shift = (degs[2] - degs[0] + 10) % 7 - 3;
    cell.forEach(([s, len], i) => bars[2].push(s, semi(motif[i] + shift), len));
    k = motif[motif.length - 1] + shift;
    walk(3, musicCell(pick(MUSIC_ENDS)), [0]);
    return bars;
  };
  return { a: section(degA, 14), b: section(degB, 16) };
}

// The lead's instrument per art style; ink and chalk pluck their 8ths.
const MUSIC_LEADS = {
  neon: { type: 'sawtooth', vol: .06, detune: [-8, 8], sustain: 1, cutoff: 3200, cutoffEnd: 1400 },
  ink: { type: 'sine', vol: .08, attack: .05, sustain: 1, breath: 1 },     // flute
  pixel: { type: 'square', vol: .04, sustain: 1, release: .02 },
  paper: { type: 'sine', vol: .18, len: .4, harm: 3.9 },                   // marimba
  chalk: { type: 'sine', vol: .06, attack: .03, sustain: 1, scoop: .94 }, // whistle
  pluck: { type: 'triangle', vol: .07, len: .35, cutoff: 3000, cutoffEnd: 500 },
};
const MUSIC_PENTA = [0, 0, 3, 3, 3, 5, 5, 7, 7, 10, 10, 12];   // nearest minor-pentatonic note per semitone

// The lead notes due now. It rests through the first verse; the final round brings it in at once, an octave up.
function musicLead(n, t, bar, inBar, th, s16, base) {
  const final = MUSIC_DYN.lift > 0 && th !== MUSIC_THEMES.menu, notes = th.mel && (bar > 3 || final) && th.mel[MUSIC_FORM[bar >> 2]][bar % 4];
  const style = th.leadStyle || artStyleOf(MAP).key;
  for (let i = 0; notes && i < notes.length; i += 3) {
    if (notes[i] !== inBar) continue;
    const s = notes[i + 1], len = notes[i + 2], hz = musicHz((style === 'ink' ? s - s % 12 + MUSIC_PENTA[s % 12] : s) + base + (final ? 12 : 0));
    const o = len <= 2 && (style === 'ink' || style === 'chalk') ? MUSIC_LEADS.pluck : MUSIC_LEADS[style] || MUSIC_LEADS.neon;
    musicNote(n.dry, t, hz, Math.max(.15, Math.min(len * s16, o.len || 9)), o);
    if (o.harm) musicNote(n.dry, t, hz * o.harm, .07, { type: 'sine', vol: o.vol * .25 });   // marimba overtone
    if (o.breath) musicNoise(t, .09, hz * 2, 'bandpass', .012);                              // flute breath
    MUSIC.leads++; MUSIC.leadStyle = style;
  }
}

// ---------- dynamic intensity ----------
// 0..1 from the fight: someone near death, match point, the final round, boss phases and the last seconds of a round.
// Layers come in as it rises: 16th hats (.25), an octave bass + counter line (.45), snare rolls and crashes (.7).
const MUSIC_DYN = { level: 0, boss: 0, lift: 0 };
function musicIntensity() {
  if (G_STATE.state !== 'play' || G_STATE.demo) return 0;
  const low = F.some(f => f.alive && !f.summon && f.hp / f.maxHp < .3);
  const matchPoint = G_STATE.score.some(s => s >= G_STATE.winScore - 1);
  const late = G_STATE.roundLimit - G_STATE.roundT < 10;
  return clamp((low ? .45 : 0) + (matchPoint ? .25 : 0) + (musicFinalRound() ? .25 : 0) + MUSIC_DYN.boss * .25 + (late ? .2 : 0), 0, 1);
}
// Every team one round from winning: the deciding round.
function musicFinalRound() {
  const sc = G_STATE.score, need = G_STATE.winScore - 1;
  return sc.length > 1 && need > 0 && sc.filter(s => s >= need).length >= 2;
}
on('bossPhase', (ctl, n) => { MUSIC_DYN.boss = Math.max(MUSIC_DYN.boss, n - 1); });
on('roundStart', () => { MUSIC_DYN.boss = 0; MUSIC_DYN.lift = musicFinalRound() ? 2 : 0; });   // the final round modulates up
on('matchStart', () => { MUSIC_DYN.boss = 0; MUSIC_DYN.lift = 0; });

// ---------- one 16th-note step ----------
function musicStep(t, step, th) {
  const n = MUSIC.nodes, beat = 60 / th.bpm, s16 = beat / 4, bar = (step >> 4) % 16, inBar = step % 16;
  const lift = MUSIC.theme === 'menu' ? 0 : MUSIC_DYN.lift;
  const chord = th[MUSIC_FORM[bar >> 2]][bar % 4].map(c => c + th.root + lift), I = MUSIC_DYN.level;
  if (th.swing && inBar % 2 === 1) t += s16 * th.swing;           // swung 16ths (shanties, shuffles)
  if (inBar === 0) {     // pad: the whole chord, held for the bar
    for (const c of chord) musicNote(n.duck, t, musicHz(c + 12), beat * 4, { type: th.pad || 'sawtooth', vol: th.padVol / 3, detune: [-9, 8],
      attack: beat * .8, sustain: true, release: beat, cutoff: 1400 + I * 1200, cutoffEnd: 2200 + I * 1800, q: .8 });
  }
  musicBass(n, t, inBar, chord, th, s16, I);
  musicArp(n, t, inBar, chord, th, s16, I);
  musicLead(n, t, bar, inBar, th, s16, th.root + lift);
  if (I > .45 && inBar % 8 === 0) {   // counter line: a held high chord tone
    musicNote(n.echo, t, musicHz(chord[(bar + inBar / 8) % 3] + 36), beat * 1.8, { type: 'triangle', vol: .02, attack: .08, cutoff: 3000 });
  }
  musicDrums(t, inBar, bar, th, I);
}

function musicBass(n, t, inBar, chord, th, s16, I) {
  const kind = th.bass || 'eighths', root = chord[0] - 12, o = { type: kind === 'sub' ? 'sine' : 'sawtooth', vol: th.bassVol, cutoff: 900 + I * 600, cutoffEnd: 180, q: 6 };
  let note = null, len = s16 * 1.8;
  if (kind === 'eighths' && inBar % 2 === 0) note = root + (inBar % 4 === 2 ? 12 : 0);
  else if (kind === 'offbeat' && inBar % 4 === 2) note = root + (inBar === 14 ? 7 : 0);
  else if (kind === 'pulse') { note = root; len = s16 * .9; }
  else if (kind === 'walk' && inBar % 4 === 0) { note = [chord[0], chord[1], chord[2], chord[0] + 12][inBar / 4] - 12; len = s16 * 3.4; }
  else if (kind === 'sub' && inBar % 8 === 0) { note = root; len = s16 * 7.5; }
  if (note == null) return;
  musicNote(n.duck, t, musicHz(note), len, o);
  if (I > .45 && kind !== 'pulse') musicNote(n.duck, t, musicHz(note + 12), len * .7, Object.assign({}, o, { vol: th.bassVol * .4 }));
}

function musicArp(n, t, inBar, chord, th, s16, I) {
  const every = I > .7 ? 1 : th.arpEvery;
  if (inBar % every !== 0) return;
  const k = inBar / every, pat = th.arp || 'up';
  let note;
  if (pat === 'updown') note = chord[[0, 1, 2, 1][k % 4]] + 24 + (k % 8 >= 4 ? 12 : 0);
  else if (pat === 'random') note = chord[Math.floor(Math.random() * 3)] + 24 + (Math.random() < .4 ? 12 : 0);
  else if (pat === 'pent') { const sc = th.scale || MUSIC_SCALES.minor; note = chord[0] + sc[[0, 2, 4, 1, 4, 2][k % 6] % 7] + 24; }
  else note = chord[k % 3] + 24 + ((k % 6) >= 3 ? 12 : 0);
  if (pat === 'random' && Math.random() < .3) return;     // rests make the random line breathe
  musicNote(n.echo, t, musicHz(note), s16 * 1.4, { type: th.lead || 'square', vol: th.arpVol, cutoff: 4200, cutoffEnd: 900, q: 2 });
}

function musicTom(t, f0, vol) {
  if (audioBusy(0)) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * .55, t + .18);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .22);
  o.connect(g).connect(MUSIC.nodes.dry); o.start(t); o.stop(t + .25); audioVoice(o);
}

function musicSnare(t, vol) {
  musicNoise(t, .16, 1800, 'bandpass', .22 * vol);
  if (audioBusy(0)) return;
  const o = AC.createOscillator(), g = AC.createGain();   // snare body
  o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(140, t + .08);
  g.gain.setValueAtTime(.12 * vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .1);
  o.connect(g).connect(MUSIC.nodes.dry); o.start(t); o.stop(t + .12); audioVoice(o);
}

function musicDrums(t, inBar, bar, th, I) {
  if (th.drums === 'soft' && th === MUSIC_THEMES.menu) {   // menu: a heartbeat kick and shakers, after an intro bar
    if (bar > 0 && (inBar === 0 || inBar === 10)) musicKick(t, .32);
    if (inBar % 4 === 2) musicNoise(t, .04, 8000, 'highpass', .025);
    return;
  }
  const g = MUSIC_DRUMS[th.drums] || MUSIC_DRUMS.four, hit = row => row && row[inBar] === 'x';
  const fill = bar % 4 === 3 && inBar >= 12, roll = I > .7 && inBar >= 12;
  if (hit(g.k)) musicKick(t, .55);
  if (hit(g.s) || ((fill || roll) && inBar % (roll ? 1 : 2) === 0)) musicSnare(t, roll && !hit(g.s) ? .55 : 1);
  if (hit(g.t)) musicTom(t, inBar % 3 ? 130 : 95, .3);
  if (I > .7 && inBar === 0 && bar % 2 === 0) musicNoise(t, .9, 6000, 'highpass', .07);   // crash
  if (hit(g.o)) musicNoise(t, .09, 7500, 'highpass', .06);      // open hat
  else if (I > .25 || inBar % 2 === 0) musicNoise(t, .03, 9000, 'highpass', .03);
}

// Theme for the current game state: calm in menus, the arena's own track in matches.
function musicWanted() {
  const s = G_STATE.state;
  if (s === 'menu' || s === 'over' || !MAP) return 'menu';
  return musicArenaTheme(MAP.key || 'neon');
}

// Muffles the music while paused, during slow-mo, the kill-cam replay and photo mode.
function musicFilterTarget() {
  const s = G_STATE.state;
  if (s === 'paused' || s === 'photo') return 600;
  if (s === 'killcam') return 1100;
  if (FX.slow > 0) return 1800;
  return 16000;
}

function musicTick() {
  if (!AC || AC.state !== 'running' || !musicOn() || MUTED || !musicNodes()) return;
  const now = AC.currentTime;
  MUSIC.nodes.filter.frequency.setTargetAtTime(musicFilterTarget(), now, .12);
  MUSIC_DYN.level += (musicIntensity() - MUSIC_DYN.level) * .08;   // eases in and out over a second or two
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
