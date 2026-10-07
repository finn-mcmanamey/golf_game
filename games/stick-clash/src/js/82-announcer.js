// 82-announcer.js: an arcade announcer for the big moments ("Round one", "Fight!", "K.O.!", "Perfect!", "Final round",
// "Double K.O.", "Ultimate!" ...). It speaks with the browser's speech engine (speechSynthesis, low pitch for a robotic
// arcade voice) over a synth stinger, and falls back to a formant-synth "voice" built from WebAudio when speech is
// missing or the player picks Synth. Silent in the menu demo, in SC.sim and when muted; works with neither API.
// Settings: SETTINGS.announcer ('voice' | 'synth' | 'off') and SETTINGS.annVol (0..1).

const ANN_DEFAULTS = { announcer: 'voice', annVol: .8 };
for (const k in ANN_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = ANN_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = ANN_DEFAULTS[k];
}

const ANN = { log: [], last: 0, lastPrio: 0, synthAt: 0, waitFight: false, voice: undefined, bus: null, warmed: false };
const ANN_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// How the synth voice pronounces a line (rough phonetics: one vowel group = one syllable).
const ANN_SAY = { 'K.O.!': 'kay oh', 'Double K.O.!': 'dub bul kay oh', 'Fight!': 'faait', 'Perfect!': 'per fect',
  'Ultimate!': 'ul ti mate', 'Final round': 'fai nal rround', 'Time!': 'taaim', 'Parry!': 'pa ree', 'Ring out!': 'ring out' };

const annNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const annOn = () => SETTINGS.announcer !== 'off' && !G_STATE.sim && !G_STATE.demo;

// Speaks a line. prio: a higher-priority line may cut a lower one off; equal or lower ones wait their turn.
function announce(text, prio = 1) {
  if (!annOn()) return false;
  const now = annNow();
  if (now - ANN.last < .5 && prio < ANN.lastPrio) return false;    // don't bury a K.O. under a parry call
  const cut = now - ANN.last > 1.2 || prio > ANN.lastPrio;        // "K.O.!" then "Perfect!" queue; a new moment cuts in
  ANN.last = now; ANN.lastPrio = prio;
  ANN.log.push({ text, t: now, how: annMode() });
  if (ANN.log.length > 30) ANN.log.shift();
  if (MUTED || AUDIO_MIX.master <= 0) return true;
  try {
    annStinger(prio);
    if (annMode() === 'voice') annSpeak(text, cut);
    else annSynth(ANN_SAY[text] || text.toLowerCase());
  } catch (e) { report(e, 'announcer'); }
  return true;
}

// 'voice' when speech works and is wanted, else 'synth' (which needs WebAudio), else 'none'.
function annMode() {
  const speech = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  if (SETTINGS.announcer === 'voice' && speech) return 'voice';
  return AC ? 'synth' : 'none';
}

// Picks a low English voice once (the list loads late in some browsers, so it is re-checked until found).
function annPickVoice() {
  if (ANN.voice) return ANN.voice;
  const list = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
  const en = list.filter(v => /^en/i.test(v.lang));
  ANN.voice = en.find(v => /male|daniel|fred|alex|george|david|uk english/i.test(v.name)) || en[0] || null;
  return ANN.voice;
}

function annSpeak(text, cut) {
  const u = new SpeechSynthesisUtterance(text);
  const v = annPickVoice();
  if (v) u.voice = v;
  u.rate = .92; u.pitch = .15;                       // slow and low: the arcade robot
  u.volume = clamp(SETTINGS.annVol * AUDIO_MIX.master, 0, 1);
  if (cut) speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// Announcer bus: its own gain (the announcer volume) into the effects bus.
function annBus() {
  if (!AC) return null;
  if (!ANN.bus) { ANN.bus = AC.createGain(); ANN.bus.connect(SFX_BUS || MASTER); }
  ANN.bus.gain.value = SETTINGS.annVol * 1.4;
  return ANN.bus;
}

// A short arcade riser and hit under every call (louder for the big ones).
function annStinger(prio) {
  const bus = annBus();
  if (!bus) return;
  SFX_OUT = bus;
  try {
    noiseSweep(.35, 400, 5000, .05 * prio, 'bandpass', 0, 2);
    if (prio >= 2) { tone(110, 55, .5, 'sawtooth', .05); thump(120, 40, .3, .25); }
  } finally { SFX_OUT = null; }
}

// Vowel -> first two formants (Hz): what makes a buzz sound like "ah", "ee" or "oh".
const ANN_FORMANTS = { a: [800, 1200], e: [450, 1900], i: [320, 2300], o: [480, 850], u: [340, 760], y: [320, 2300] };

// The fallback voice: a buzzing sawtooth "throat" shaped by two formant filters per syllable, with consonant clicks.
function annSynth(phon) {
  const bus = annBus();
  if (!bus || audioBusy()) return;
  const syl = phon.match(/[^aeiouy\s]*[aeiouy]+[^aeiouy\s]*/gi) || [phon];
  let t = Math.max(AC.currentTime + .02, ANN.synthAt);
  syl.forEach((s, i) => {
    const v = (s.match(/[aeiouy]/i) || ['a'])[0].toLowerCase(), dur = .1 + s.length * .025;
    const pitch = 128 * (i === syl.length - 1 ? .82 : 1 + (i % 2) * .08);
    if (/^[kptbdgfsch]/i.test(s)) annClick(bus, t, /^[sfch]/i.test(s));
    annVowel(bus, t, dur, pitch, ANN_FORMANTS[v]);
    t += dur + .035;
  });
  ANN.synthAt = t + .08;
}

function annVowel(bus, t, dur, pitch, formants) {
  const src = AC.createOscillator(), env = AC.createGain();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(pitch * 1.06, t); src.frequency.exponentialRampToValueAtTime(pitch * .9, t + dur);
  env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(.5, t + .015);
  env.gain.setValueAtTime(.5, t + dur * .7); env.gain.exponentialRampToValueAtTime(.001, t + dur);
  env.connect(bus);
  for (const [k, f] of formants.entries()) {
    const bp = AC.createBiquadFilter(), g = AC.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 7; g.gain.value = k ? .5 : .9;
    src.connect(bp).connect(g).connect(env);
  }
  src.start(t); src.stop(t + dur + .03);
  audioVoice(src);
}

function annClick(bus, t, hiss) {
  const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NOISE; fl.type = 'highpass'; fl.frequency.value = hiss ? 4000 : 1500;
  g.gain.setValueAtTime(hiss ? .2 : .35, t); g.gain.exponentialRampToValueAtTime(.001, t + (hiss ? .08 : .03));
  s.connect(fl).connect(g).connect(bus); s.start(t, Math.random()); s.stop(t + .1);
  audioVoice(s);
}

// Safari only starts speech from inside a user gesture: the first real tap or key speaks a silent utterance once,
// so "Round one" (called from a timer later) is allowed. 80-audio emits 'gesture' from its activation listeners.
function annWarm() {
  if (ANN.warmed || SETTINGS.announcer !== 'voice') return;
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
  ANN.warmed = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* no speech */ }
}
on('gesture', annWarm);

// ---------- when it speaks ----------
const annWord = n => ANN_WORDS[n] || String(n);
const annRealHumans = () => F.filter(f => f.ctrl === 'human' && !f.autopilot && !f.summon);

on('roundStart', round => {
  if (!annOn()) return;
  ANN.waitFight = true;
  const label = hook(G_STATE.mode, 'roundLabel');       // modes may relabel rounds ("WAVE 3")
  if (label) return announce(String(label).toLowerCase().replace(/^\w/, c => c.toUpperCase()), 2);
  announce(musicFinalRound() ? 'Final round' : 'Round ' + annWord(round), 2);
});
on('state', now => { if (now === 'menu' || now === 'over') ANN.waitFight = false; });

// "Fight!" the moment the start-of-round freeze ends.
function annTick() {
  if (!ANN.waitFight || G_STATE.state !== 'play' || G_STATE.lock > 0) return;
  ANN.waitFight = false;
  announce('Fight!', 2);
}
setInterval(() => { try { annTick(); } catch (e) { report(e, 'announcer'); } }, 50);

on('roundEnd', (winner, reason) => {
  if (!annOn()) return;
  if (reason === 'draw') return announce('Double K.O.!', 3);
  if (reason === 'time') return announce('Time!', 3);
  if (reason !== 'ko') return;
  announce('K.O.!', 3);
  const team = F.filter(f => f.team === winner && !f.summon);
  if (team.length && team.every(f => f.alive && f.hp >= f.maxHp)) announce('Perfect!', 3);
  else if (team.some(f => f.alive && f.hp / f.maxHp < .15)) announce('Close call!', 3);
});

on('ko', (victim, killer, o) => {
  if (!annOn() || victim.summon || aliveTeams().length <= 1) return;   // the round-ending K.O. is called by roundEnd
  if (o && o.kind === 'ringout') announce('Ring out!', 1);
});
on('ultimate', () => announce('Ultimate!', 2));
on('parry', (B, A) => {
  if (annNow() - (ANN.parryAt || 0) < 4 || !(B.ctrl === 'human' || (A && A.ctrl === 'human'))) return;
  if (announce('Parry!', 1)) ANN.parryAt = annNow();
});
on('bossPhase', (ctl, n) => announce(n >= 3 ? 'Final phase!' : 'Phase ' + annWord(n), 2));
on('matchOver', () => {
  if (!annOn()) return;
  const humans = annRealHumans(), best = G_STATE.score.indexOf(Math.max(...G_STATE.score));
  if (!humans.length) return announce('Game!', 3);
  announce(humans.some(f => f.team === best) ? 'You win!' : 'You lose!', 3);
});

on('boot', () => { if (window.SC) window.SC.announcer = { log: ANN.log, say: announce, mode: annMode }; });
