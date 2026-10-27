/* ===== timing calibration (F-101): tap along to ten clicks; the catch cues then arrive that much earlier =====
   Measures sound output delay + screen + thumb on this device. Only cues and drawing use it, never the simulation,
   so race codes, ghosts and the leaderboard are identical whatever the device. */

const CAL = { beat: 0.6, clicks: 10, warmup: 2, accept: 0.3, minTaps: 6, max: 0.3, leadIn: 1 };
let cal = null;

// Seconds of race time the cues move earlier: the measured delay is real time, so a slowed race needs less.
const latencyLead = () => (settings.latencyMs || 0) / 1000 * gameSpeed();

function openCalibration() {
  AU.init();
  $('calib').classList.remove('hide');
  $('calMsg').textContent = 'Tap (any key or the screen) on each click. Ten clicks, about seven seconds.';
  $('calGo').classList.remove('hide');
  $('calTaps').innerHTML = '';
}

function startCalibration() {
  const ctx = AU.ctx;
  // The test measures the sound's delay too, so it needs sound actually playing.
  if (!ctx || ctx.state !== 'running' || !settings.sound) { toast('Turn sound on for the timing test.'); return }
  const t0 = ctx.currentTime + CAL.leadIn;
  cal = { clicks: Array.from({ length: CAL.clicks }, (_, i) => t0 + i * CAL.beat), paired: new Map(), scheduled: 0 };
  // Taps are timed by their own event timestamps, so the clicks are mapped onto that clock once, here:
  // the audio clock only moves in blocks, which would add a bias to every tap.
  const anchor = performance.now() / 1000 - ctx.currentTime;
  cal.at = cal.clicks.map(t => t + anchor);
  $('calGo').classList.add('hide');
  $('calMsg').textContent = 'Tap on each click…';
  $('calTaps').innerHTML = cal.clicks.map(() => '<i></i>').join('');
  cal.end = setTimeout(finishCalibration, (CAL.leadIn + CAL.clicks * CAL.beat + 0.4) * 1000);
  pulseCalibration();
}

// The ring pulses on each click, read from the audio clock, so the eye and the ear agree on the beat.
function pulseCalibration() {
  if (!cal) return;
  const now = AU.ctx.currentTime;
  // Each click is scheduled just before it's due, so closing the test stops the rest.
  while (cal.scheduled < cal.clicks.length && cal.clicks[cal.scheduled] - now < 0.2) AU.tone(1200, 1200, 0.04, 0.25, 'square', Math.max(0, cal.clicks[cal.scheduled++] - now));
  const since = Math.min(...cal.clicks.map(t => now >= t ? now - t : 9));
  $('calRing').style.transform = `scale(${1 + 0.25 * Math.max(0, 1 - since / 0.15)})`;
  requestAnimationFrame(pulseCalibration);
}

// A tap pairs with its nearest click; warm-up clicks and second taps on one click are ignored.
function calibrationTap(e) {
  if (!cal) return;
  const now = e.timeStamp / 1000;
  const i = cal.at.reduce((best, t, k) => Math.abs(now - t) < Math.abs(now - cal.at[best]) ? k : best, 0), d = now - cal.at[i];
  if (Math.abs(d) > CAL.accept || cal.paired.has(i)) return;
  cal.paired.set(i, d);
  const dot = $('calTaps').children[i];
  if (dot) dot.className = i < CAL.warmup ? 'warm' : Math.abs(d - median([...cal.paired.values()])) < 0.075 ? 'good' : 'off';
}

const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 };

function finishCalibration() {
  const taps = [...cal.paired].filter(([i]) => i >= CAL.warmup).map(([, d]) => d);
  cal = null;
  $('calGo').classList.remove('hide');
  $('calGo').textContent = 'Try again';
  if (taps.length < CAL.minTaps) { $('calMsg').textContent = "Didn't catch enough taps. Try again, one tap per click."; return }
  settings.latencyMs = Math.round(clamp(median(taps), 0, CAL.max) * 1000);
  saveSettings();
  STORE.set('calibrated', true);
  $('calCard').classList.add('hide');
  $('calMsg').textContent = `Your device + thumb: ${settings.latencyMs} ms. The catch beep and the slide now arrive that much earlier.`;
}

function closeCalibration() {
  if (cal) { clearTimeout(cal.end); cal = null }
  $('calib').classList.add('hide');
}

// While the test is open, every key and tap belongs to it (captured before the game's own handlers).
addEventListener('keydown', e => {
  if ($('calib').classList.contains('hide')) return;
  e.stopImmediatePropagation();
  e.preventDefault();
  if (e.code === 'Escape') closeCalibration(); else if (!e.repeat) calibrationTap(e);
}, true);
$('calib').addEventListener('pointerdown', e => { if (!e.target.closest('button')) calibrationTap(e) });
$('calGo').onclick = startCalibration;
$('calClose').onclick = closeCalibration;
$('btnCalCard').onclick = openCalibration;
$('pCal').onclick = openCalibration;
if (!STORE.get('calibrated', false)) $('calCard').classList.remove('hide');
