/* ===== sound: all synthesised with Web Audio, no files =====
   Catch clunks, blade splashes, rushing water that rises with speed, the start horn and the crowd. */

const AU = {
  ctx: null, master: null, noise: null, water: null, crowd: null,

  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const sr = this.ctx.sampleRate, buf = this.ctx.createBuffer(1, sr * 2, sr), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.master = this.ctx.createGain();
      this.master.gain.value = settings.sound ? 0.8 : 0;
      this.master.connect(this.ctx.destination);
      this.water = this.loop(500, 0.6, 'lowpass');
      this.crowd = this.loop(1100, 0.8, 'bandpass');
      this.rain = this.loop(5000, 0.3, 'highpass');
      this.slide = this.loop(160, 2.5, 'bandpass');
    } catch (e) { this.ctx = null }
  },

  // A filtered noise bed whose volume we can turn up and down.
  loop(freq, q, type) {
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noise; src.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return { g, f };
  },

  ready() { return this.ctx && this.ctx.state === 'running' },

  hiss(freq, q, dur, vol, type = 'bandpass', delay = 0) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },

  tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },

  play(name, v = 1) {
    switch (name) {
      case 'catch': this.hiss(700, 0.9, 0.18, 0.35 * v, 'lowpass'); this.tone(180, 90, 0.07, 0.25 * v); break;
      case 'perfect': this.tone(880, 880, 0.09, 0.08 * v, 'triangle'); this.tone(1320, 1320, 0.12, 0.06 * v, 'triangle', 0.05); break;
      case 'release': this.hiss(2400, 1.2, 0.12, 0.12 * v); this.tone(420, 300, 0.05, 0.1 * v, 'square'); break;
      case 'crab': this.hiss(300, 0.6, 0.6, 0.6, 'lowpass'); this.tone(140, 50, 0.5, 0.4, 'sawtooth'); break;
      case 'buoy': this.tone(300, 200, 0.08, 0.2, 'square'); break;
      case 'attention': this.tone(660, 660, 0.25, 0.15, 'triangle'); break;
      case 'go': this.tone(440, 440, 0.9, 0.3, 'sawtooth'); this.tone(442, 442, 0.9, 0.2, 'square'); break;
      case 'finish': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.3, 0.16, 'triangle', i * 0.1)); break;
      case 'cheer': this.hiss(900, 0.4, 2.6, 0.5, 'bandpass'); this.hiss(2400, 0.6, 2.2, 0.25, 'bandpass', 0.1); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.45, 0.18, 'square', i * 0.11)); break;
      case 'ui': this.tone(900, 1100, 0.04, 0.08); break;
      case 'cue': this.tone(1200, 1150, 0.035, 0.07, 'sine'); break;
      case 'cannon': this.tone(75, 28, 1.3, 0.55); this.tone(150, 40, 0.35, 0.3, 'sawtooth'); this.hiss(500, 0.4, 1.6, 0.7, 'lowpass'); break;
      case 'heart': this.tone(62, 44, 0.13, 0.45 * v); this.tone(58, 40, 0.11, 0.3 * v, 'sine', 0.17); break;
      case 'whistle': this.tone(2900, 2700, 0.16, 0.09, 'sine'); this.tone(3100, 2950, 0.16, 0.05, 'triangle'); break;
      case 'tick': this.tone(1500, 1500, 0.025, 0.05, 'square'); break;
    }
  },

  // Ambient beds follow the race: water rush with boat speed, crowd swelling near the finish.
  ambient(speed, crowd, rain = 0, sliding = 0) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    this.water.g.gain.setTargetAtTime(0.03 + Math.min(1, speed / 6) * 0.12, t, 0.2);
    this.water.f.frequency.setTargetAtTime(300 + speed * 90, t, 0.2);
    this.crowd.g.gain.setTargetAtTime(crowd * 0.18, t, 0.4);
    this.rain.g.gain.setTargetAtTime(rain * 0.05, t, 0.5);
    this.slide.g.gain.setTargetAtTime(sliding * 0.22, t, 0.05);   // seat wheels rumbling on the recovery
  },

  setOn(on) { if (this.master) this.master.gain.value = on ? 0.8 : 0 },
};
