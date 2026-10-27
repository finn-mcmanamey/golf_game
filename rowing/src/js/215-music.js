/* ===== menu music: a slow, generated chord progression on soft pads =====
   Plays only on the menus, after the first click (browsers need a gesture before sound). */

const MUSIC = {
  timer: 0, step: 0, bus: null,
  // D major: I – vi – IV – V, as frequencies of each chord's notes.
  chords: [[146.8, 185, 220, 293.7], [123.5, 146.8, 185, 246.9], [98, 146.8, 196, 246.9], [110, 138.6, 164.8, 220]],

  start() {
    if (this.timer || !settings.music || !AU.ready() || game.state !== 'menu') return;   // menus only
    if (!this.bus) {
      this.bus = AU.ctx.createBiquadFilter();
      this.bus.type = 'lowpass'; this.bus.frequency.value = 1400;
      this.gain = AU.ctx.createGain();
      this.bus.connect(this.gain).connect(AU.master);
    }
    this.gain.gain.setTargetAtTime(0.5, AU.ctx.currentTime, 1.5);
    this.play();
    this.timer = setInterval(() => this.play(), 4000);
  },

  play() {
    const c = AU.ctx, t = c.currentTime, chord = this.chords[this.step++ % this.chords.length];
    chord.forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = i ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 4;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 1.2);
      g.gain.linearRampToValueAtTime(0, t + 4.4);
      o.connect(g).connect(this.bus);
      o.start(t); o.stop(t + 4.5);
    });
    // A light melody note on top every other bar.
    if (this.step % 2) AU.tone(chord[3] * 2, chord[3] * 2, 1.6, 0.02, 'sine', 0.5);
  },

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = 0;
    this.gain?.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.4);
  },
};

// The first tap or key on the menu unlocks sound and starts the music.
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => {
  if (game.state !== 'menu') return;
  AU.init();
  setTimeout(() => MUSIC.start(), 100);
}, { once: true });
