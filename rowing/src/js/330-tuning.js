/* ===== F8 tuning panel: every TUNE constant as a slider =====
   For trying out how rowing should feel. Any race rowed with changed values is marked and never saved as a record. */

function buildTuningPanel() {
  const el = $('tune');
  const rows = Object.keys(TUNE_DEFAULTS).filter(k => k !== 'dt').map(k => {
    const d = TUNE_DEFAULTS[k], step = Math.abs(d) < 0.1 ? 0.001 : Math.abs(d) < 2 ? 0.01 : 1;
    return `<label><span>${k}</span><input type="range" id="tune-${k}" min="${(d * 0.2).toFixed(4)}" max="${(d * 2.5).toFixed(4)}" step="${step}" value="${TUNE[k]}"><b id="tuneV-${k}">${TUNE[k]}</b></label>`;
  });
  el.innerHTML = `<h3>Tuning <small>F8</small></h3>${rows.join('')}<div class="row"><button id="tuneReset" class="sec">Reset all</button><button id="tuneClose" class="sec">Close</button></div>`;
  for (const k of Object.keys(TUNE_DEFAULTS)) {
    const input = $('tune-' + k);
    if (!input) continue;
    input.oninput = () => { TUNE[k] = parseFloat(input.value); $('tuneV-' + k).textContent = TUNE[k]; tuneChanged() };
  }
  $('tuneReset').onclick = () => { Object.assign(TUNE, TUNE_DEFAULTS); buildTuningPanel(); tuneChanged() };
  $('tuneClose').onclick = toggleTuning;
}

function tuneChanged() { $('tunedTag').classList.toggle('hide', !tuneEdited()) }

function toggleTuning() {
  const el = $('tune'), open = el.classList.toggle('hide') === false;
  if (open) buildTuningPanel();
}

addEventListener('keydown', e => { if (e.code === 'F8') { e.preventDefault(); toggleTuning() } });
