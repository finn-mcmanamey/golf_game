// 83-crowd.js: a procedural crowd. A murmur bed (formant-filtered noise) that swells with the action, plus reactions
// tied to events: "ooh" on big hits and guard breaks, gasps and cheers for ring-outs, claps for parries and combos, a
// roar for ultimates and comebacks, boos for time-outs, draws and self-inflicted falls. All noise, no samples.
// SETTINGS.crowd turns it off (the existing K.O. cheer in 80-audio follows it too). crowdReact() logs every reaction
// in CROWD.log, so tests can check them without WebAudio.

if (!('crowd' in SETTING_DEFAULTS)) SETTING_DEFAULTS.crowd = true;
if (!('crowd' in SETTINGS)) SETTINGS.crowd = true;

const CROWD = { hype: 0, bed: null, log: [], last: {} };
const crowdOn = () => SETTINGS.crowd !== false && !G_STATE.sim && !G_STATE.demo;

// A short "voice" of the crowd: noise through vowel formants, gliding by `glide` (pitch shape of the reaction).
function crowdVowel(dur, f1, f2, vol, glide = 1, delay = 0) {
  noiseSweep(dur, f1, f1 * glide, vol, 'bandpass', delay, 6);
  noiseSweep(dur, f2, f2 * glide, vol * .55, 'bandpass', delay, 6);
}
function crowdClaps(n, spread, vol, delay = 0) {
  for (let k = 0; k < n; k++) noise(.035, 1800 + Math.random() * 1800, vol * (.5 + Math.random() * .6), 'bandpass', delay + Math.random() * spread);
}

defSfx('crowd-ooh', v => crowdVowel(.9, 330, 800, .3 * v, 1.25));
defSfx('crowd-gasp', v => { noiseSweep(.35, 1500, 4200, .22 * v, 'bandpass', 0, 2); crowdVowel(.3, 700, 1150, .12 * v, 1.3); });
defSfx('crowd-boo', v => { crowdVowel(1.3, 300, 700, .32 * v, .8); crowdVowel(1.1, 260, 640, .2 * v, .85, .12); });
defSfx('crowd-clap', v => crowdClaps(18, .9, .09 * v));
defSfx('crowd-roar', v => {
  crowdVowel(2.2, 600, 1100, .38 * v, 1.08); crowdVowel(1.8, 750, 1300, .22 * v, 1.1, .1);
  crowdClaps(34, 1.8, .08 * v, .15);
});

// Plays one reaction (rate-limited per kind) and raises the hype that drives the murmur bed.
function crowdReact(kind, vol = 1, hype = .2) {
  if (!crowdOn()) return false;
  const now = G_STATE.t;
  if (CROWD.last[kind] != null && now - CROWD.last[kind] < 1.1 && now >= CROWD.last[kind]) return false;
  CROWD.last[kind] = now;
  CROWD.hype = Math.min(1, CROWD.hype + hype);
  CROWD.log.push(kind);
  if (CROWD.log.length > 40) CROWD.log.shift();
  sfx('crowd-' + kind, vol);
  return true;
}

// The murmur bed: a looping noise source through two formant filters; its gain follows the hype.
function crowdBed() {
  if (CROWD.bed || !AC || !SFX_BUS) return CROWD.bed;
  const src = AC.createBufferSource(), g = AC.createGain();
  src.buffer = NOISE; src.loop = true; g.gain.value = 0;
  for (const [f, a] of [[500, 1], [1300, .45]]) {
    const bp = AC.createBiquadFilter(), ga = AC.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3; ga.gain.value = a;
    src.connect(bp).connect(ga).connect(g);
  }
  g.connect(SFX_BUS); src.start();
  CROWD.bed = { src, g };
  return CROWD.bed;
}

function crowdTick() {
  CROWD.hype *= .97;
  const bed = crowdBed();
  if (!bed) return;
  const live = (G_STATE.state === 'play' || G_STATE.state === 'killcam') && crowdOn() && !MUTED;
  bed.g.gain.setTargetAtTime(live ? .025 + CROWD.hype * .09 : 0, AC.currentTime, .4);
}
setInterval(() => { try { crowdTick(); } catch (e) { report(e, 'crowd'); } }, 100);

// ---------- what they react to ----------
const crowdDirect = o => o && (o.kind === 'melee' || o.kind === 'proj' || o.kind === 'explode' || o.kind === 'skill');

on('damage', (B, amt, o) => {
  if (crowdDirect(o) && amt >= 18) crowdReact('ooh', clamp(amt / 26, .6, 1.2), .25);
  else if (crowdDirect(o) && o.src && o.src.combo === 5) crowdReact('clap', 1, .2);   // a 5-hit combo
});
on('guardBreak', () => crowdReact('ooh', 1, .25));
on('parry', () => crowdReact('clap', .9, .2));
on('ultimate', () => crowdReact('roar', .8, .5));
on('ko', (victim, killer, o) => {
  if (victim.summon || !o || o.kind !== 'ringout') return;
  if (!killer || killer === victim) crowdReact('boo', .7, .1);       // walked off on their own
  else crowdReact('gasp', 1, .4);
});
on('roundEnd', (winner, reason) => {
  if (reason === 'time' || reason === 'draw') return crowdReact('boo', 1, .1);
  const team = F.filter(f => f.team === winner && f.alive && !f.summon);
  if (reason === 'ko' && team.some(f => f.hp / f.maxHp < .2)) crowdReact('roar', 1.1, .6);   // a comeback from the brink
});
on('matchStart', () => { CROWD.hype = 0; CROWD.last = {}; });
