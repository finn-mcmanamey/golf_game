/* ===== coaching feedback: the force curve of each stroke and where your catches land =====
   Like the monitor on a rowing machine: a smooth, full hump is a good stroke; a late or short one shows. */

const coach = { curve: [], last: [], timings: [] };

function resetCoaching() { coach.curve = []; coach.last = []; coach.timings = [] }

// Called every tick: collect force samples through the drive, keep the finished curve to draw.
function sampleForce(p) {
  if (p.phase === 'drive') coach.curve.push(p.force || 0);
  else if (coach.curve.length) { coach.last = coach.curve; coach.curve = [] }
}

function coachCatch(e) { if (e.error !== 0) coach.timings.push(e.error) }

function drawForceCurve() {
  const c = $('forceC'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const draw = (pts, colour, width) => {
    if (pts.length < 2) return;
    g.strokeStyle = colour; g.lineWidth = width; g.beginPath();
    pts.forEach((f, i) => { const x = i / (pts.length - 1) * (W - 4) + 2, y = H - 3 - f / (TUNE.peakForce * 1.5) * (H - 6); i ? g.lineTo(x, y) : g.moveTo(x, y) });
    g.stroke();
  };
  draw(coach.last, 'rgba(255,255,255,.35)', 2);
  draw(coach.curve, '#ffd23a', 2.5);
}

// Results: a histogram of catch timing, from rushing (early) to hanging at the front (late).
function timingChart() {
  const t = coach.timings;
  if (t.length < 5) return '';
  const bins = 13, span = 0.39, counts = new Array(bins).fill(0);
  for (const e of t) counts[clamp(Math.round((e + span) / (2 * span) * (bins - 1)), 0, bins - 1)]++;
  const max = Math.max(...counts), W = 520, H = 70, bw = (W - 20) / bins;
  const mean = t.reduce((a, b) => a + b, 0) / t.length;
  const tip = Math.abs(mean) < 0.03 ? 'Your catches are centred on the moment. Keep it.' : mean < 0 ? 'You tend to rush the catch: wait for the slide to reach the front.' : 'You tend to hang at the front: catch as the slide arrives.';
  const bars = counts.map((n, i) => {
    const h = n / max * (H - 18), mid = Math.abs(i - (bins - 1) / 2) <= 1;
    return `<rect x="${10 + i * bw + 1}" y="${H - 14 - h}" width="${bw - 2}" height="${h}" rx="2" fill="${mid ? '#4ade80' : '#fb923c'}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${bars}<text x="12" y="${H - 2}" style="text-anchor:start">early</text><text x="${W / 2}" y="${H - 2}">on time</text><text x="${W - 12}" y="${H - 2}" style="text-anchor:end">late</text></svg>
    <div class="legend"><span>${tip}</span></div>${lateDeviceHint(mean, t.length)}`;
}

// A steady late lean on a device that was never calibrated is often its sound or screen delay, not the rower (F-101).
function lateDeviceHint(mean, n) {
  if (mean < 0.05 || n < 12 || STORE.get('calibrated', false)) return '';
  return `<div class="legend"><span>Late by ${Math.round(mean * 1000)} ms on average: that can be this device's delay. </span><button class="sec mini tuneTiming">Tune timing · 7 s</button></div>`;
}
