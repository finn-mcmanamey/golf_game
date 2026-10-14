// 83b-voices.js: silly fighter grunts on 82's formant synth, played as sfx('vox:line:Hz:delay') so the kill-cam replays
// them. VOX.log keeps the latest lines (tests read it, also without WebAudio).

// Syllables: [vowel, secs, pitch × at start, at end, consonants: h breath before, f hiss or p pop after].
const VOX_LINES = {
  oof: [['u', .16, 1.05, .75, 'f']], ow: [['a', .1, 1.15, 1.3], ['u', .14, 1.25, .8]],
  waah: [['u', .07, 1.1, 1.15], ['a', .6, 1.2, .5]], hup: [['u', .1, .95, 1.3, 'hp']],
  hyah: [['i', .05, 1, 1.2, 'h'], ['a', .22, 1.3, .9]], yay: [['i', .08, 1.1, 1.3], ['e', .28, 1.35, 1.6]],
  hoho: [['o', .11, 1.25, 1.1, 'h'], ['o', .17, 1.1, .9, 'h']],
};
const VOX_SAY = { hurt: ['oof', 'ow'], ko: ['waah'], jump: ['hup'], heavy: ['hyah'], win: ['yay', 'hoho'] };
const VOX_CLASS = { brute: .8, tank: .72, ninja: 1.12, trickster: 1.25, mage: 1.06, gunner: .92 };
const VOX = { log: [], busy: [], last: new WeakMap(), gap: .35, max: 3 };
const voxOn = () => SETTINGS.voices !== false && !G_STATE.sim && !G_STATE.demo;
// Class and size set the voice's range; a stable offset from name and slot makes each fighter's their own.
const voxPitch = f => 170 * (VOX_CLASS[f.clsKey] || 1) * (.84 + musicHash(f.name + f.id) % 41 / 100) / Math.sqrt(f.scale || 1);
const voxSilly = () => Object.keys(TUNE_SILLY).every(k => TUNE[k] === TUNE_SILLY[k]);

// A line of `kind` for f: at most every VOX.gap s per fighter and VOX.max at once (a K.O. always gets through).
function voxSay(f, kind, delay = 0) {
  const now = annNow(), ko = kind === 'ko';
  if (!voxOn() || !f || f.summon || (!ko && now - (VOX.last.get(f) ?? -9) < VOX.gap)) return false;
  VOX.busy = VOX.busy.filter(end => end > now);
  if (!ko && VOX.busy.length >= VOX.max) return false;
  const line = pick(VOX_SAY[kind]), hz = Math.round(voxPitch(f) * rnd(.94, 1.06));
  VOX.last.set(f, now); VOX.busy.push(now + delay + VOX_LINES[line].reduce((s, y) => s + y[1], .1));
  VOX.log.push({ t: now, id: f.id, line }); if (VOX.log.length > 60) VOX.log.shift();
  sfxAt(`vox:${line}:${hz}:${delay}`, f.P[1].x);
  return true;
}

// Formant vowels with breaths, hisses and pops; the silly feel profile bends them further.
defSfx('vox', (v, arg) => {
  const [line, hz, delay] = arg.split(':'), syl = VOX_LINES[line], bend = voxSilly() ? 1.6 : 1;
  if (!syl || SETTINGS.voices === false || audioBusy()) return;
  const g = AC.createGain(), b = x => Math.max(.35, 1 + (x - 1) * bend);
  g.gain.value = .7 * v * SETTINGS.voiceVol; g.connect(audioOut());
  let t = AC.currentTime + (+delay || 0);
  for (const [vowel, dur, from, to, cons = ''] of syl) {
    if (cons.includes('h')) { annClick(g, t, true); t += .04; }
    annVowel(g, t, dur, hz * AUDIO_PITCH, ANN_FORMANTS[vowel], b(from), b(to));
    t += dur + .03;
    if (/[fp]/.test(cons)) annClick(g, t - .05, cons.includes('f'));
  }
});

on('damage', (B, amt, o) => { if (amt >= 13 && B.hp > 0 && crowdDirect(o)) voxSay(B, 'hurt'); });
on('ko', V => voxSay(V, 'ko'));
on('jump', f => { if (chance(.3)) voxSay(f, 'jump'); });
on('attack', f => { if (!f.w.ranged && f.w.mass >= 1.6 && chance(.5)) voxSay(f, 'heavy'); });
on('skill', f => { if (chance(.6)) voxSay(f, 'heavy'); });
on('ultimate', f => voxSay(f, 'heavy'));
on('roundEnd', winner => { for (const f of F) if (f.team === winner && f.alive) voxSay(f, 'win', .6); });

// Settings → Sound rows (wrapped at boot, like 59) and the SC.sound test hooks.
on('boot', () => {
  for (const [k, v] of [['voices', true], ['voiceVol', .8]]) { SETTING_DEFAULTS[k] = v; if (!(k in SETTINGS)) SETTINGS[k] = v; }
  SETTING_RANGES.voiceVol = [0, 1];
  const build = typeof SCREENS === 'object' && SCREENS.settings;
  if (typeof build === 'function') SCREENS.settings = () => {
    const node = build(), g = [...node.querySelectorAll('.set-group')].find(x => x.querySelector('h3').textContent === 'Sound');
    if (g) g.append(toggleField('Voice grunts', SETTINGS.voices, v => setSetting('voices', v), 'Oof! Hup! Waaah!'),
      sliderField('Voice volume', SETTINGS.voiceVol, v => setSetting('voiceVol', v)));
    return node;
  };
  if (window.SC) SC.sound = { VOX, say: voxSay, recipe: wsndRecipe, WSND, MUSIC };
});
