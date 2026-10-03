// 87-juice.js: game feel on top of the core effects. Everything here is drawing or sound only; it never changes a
// fight's outcome. The renderer (85) calls juiceDrawWorld() before the fighters and juiceDrawScreen() after the
// screen overlays.
// - camera punch-zoom on heavy hits and K.O.s (CAM.punch, honours the screen-shake setting)
// - chromatic split + red vignette flash on K.O., longer slow motion and a hit-stop on the deciding blow
// - a short hit-stop when weapons clash
// - dust puffs and a thud when a fighter lands hard; speed streaks behind fighters sent flying
// - low-health heartbeat: a pulsing red vignette and a quiet heartbeat for a real player under 30% health
// - hit effect colours: neon sparks in the fighter's colour (default) or red (SETTINGS.hitFx)
// It also adds its settings (and the music toggle) to the Settings screen.

const JUICE_DEFAULTS = { hitFx: 'sparks', killcamAll: false, heartbeat: true, musicOn: true };
for (const k in JUICE_DEFAULTS) {
  if (!(k in SETTING_DEFAULTS)) SETTING_DEFAULTS[k] = JUICE_DEFAULTS[k];
  if (!(k in SETTINGS)) SETTINGS[k] = JUICE_DEFAULTS[k];
}

const JUICE = { chroma: 0, koFlash: 0, koColor: '#ff4a6a', beat: 0, beatPulse: 0, land: new WeakMap(), scratch: null, vignettes: new Map() };
const JUICE_RED = ['#ff2840', '#d3102a', '#ff5a5a'];

// Colour of the sparks a hit throws (used by hitFeedback in 30-combat).
function hitColor(B) { return SETTINGS.hitFx === 'red' ? pick(JUICE_RED) : B.color; }

const juiceDirect = o => o && (o.kind === 'melee' || o.kind === 'proj' || o.kind === 'explode' || o.kind === 'skill');

on('damage', (B, amt, o) => {
  if (G_STATE.sim || !juiceDirect(o) || o.small) return;
  if (amt >= 12) CAM.punch = Math.max(CAM.punch || 0, Math.min(.075, (amt - 8) * .004) * FX.shakeMul);
  if (SETTINGS.hitFx === 'red') {   // heavier droplets that fall and splash on the floor
    const x = o.x ?? B.P[1].x, y = o.y ?? B.P[1].y;
    burst(x, y, '#9a0018', 4 + amt * .5, 160 + amt * 8, { grav: 2000, size: 1.2, life: .9 });
  }
});

on('ko', victim => {
  if (G_STATE.sim || victim.summon) return;
  const deciding = aliveTeams().length <= 1;
  if (!G_STATE.demo) {                    // the attract demo behind the menus stays calm (and cheap)
    JUICE.chroma = deciding ? 1 : .55;
    JUICE.koFlash = deciding ? 1 : .6;
  }
  JUICE.koColor = victim.color;
  CAM.punch = Math.max(CAM.punch || 0, (deciding ? .11 : .06) * FX.shakeMul);
  if (deciding && !G_STATE.demo) { hitstop(.11); slowmo(1.7, .22); }   // let the final blow land, then savour it
});

on('clash', () => hitstop(.045));

// ---------- world-space extras (drawn before the fighters) ----------
function juiceDrawWorld(c2, dt) {
  if (dt > 0 && (G_STATE.state === 'play' || G_STATE.state === 'menu')) for (const f of F) juiceCheckLanding(f);
  for (const f of F) juiceSpeedStreaks(c2, f);
}

// Remembers the fastest fall while airborne and puffs dust on a hard landing.
function juiceCheckLanding(f) {
  let st = JUICE.land.get(f);
  if (!st) JUICE.land.set(f, st = { air: false, vy: 0 });
  if (!f.grounded) { st.air = true; st.vy = Math.max(st.vy, vy(f.P[2])); return; }
  if (st.air && st.vy > 700 && f.alive) {
    const power = clamp((st.vy - 700) / 900, .25, 1) * f.scale;
    juiceDust(f.P[2].x, feetY(f), power);
    sfx('land', .4 + power * .6);
    if (power > .7) shake(3 * power);
  }
  st.air = false; st.vy = 0;
}

// Dust that spreads sideways along the ground and drifts up.
function juiceDust(x, y, power) {
  if (G_STATE.sim) return;
  const n = Math.round((6 + 10 * power) * FX.partMul);
  for (let k = 0; k < n; k++) {
    const dir = k % 2 ? 1 : -1, life = rnd(.3, .55);
    PARTS.push({ x: x + dir * rnd(2, 12), y: y - 2, vx: dir * rnd(90, 320) * power, vy: -rnd(20, 110) * power, life, max: life,
      c: 'rgba(200,205,240,.75)', s: rnd(2.5, 5) * (.7 + power * .5), grav: -60 });
  }
}

// Faint copies of the body trailing behind a fighter that is flying fast (big knockback, launches).
function juiceSpeedStreaks(c2, f) {
  const hip = f.P[2], vxh = vx(hip), vyh = vy(hip), sp = Math.hypot(vxh, vyh);
  if (sp < 1100 || f.grounded) return;
  c2.save(); c2.lineCap = c2.lineJoin = 'round';
  for (let k = 1; k <= 3; k++) {
    c2.globalAlpha = clamp((sp - 1100) / 1500, .05, .22) * (1 - k * .25);
    c2.translate(-vxh * .012, -vyh * .012);
    drawBody(f, f.color, 5 * f.scale);
  }
  c2.restore();
}

// ---------- screen-space overlays ----------
function juiceDrawScreen(c2, dt) {
  if (JUICE.chroma > 0) { juiceChroma(c2, JUICE.chroma); JUICE.chroma = Math.max(0, JUICE.chroma - dt * 4); }   // ≤ .25 s
  if (JUICE.koFlash > 0) {
    juiceVignette(c2, JUICE.koColor, JUICE.koFlash * .45);
    JUICE.koFlash = Math.max(0, JUICE.koFlash - dt * 1.6);
  }
  juiceHeartbeat(c2, dt);
}

// Red and cyan copies of the frame pulled apart: a chromatic-aberration hit on K.O. The copies are made at a quarter
// of the pixels (the split is a brief blur anyway), so a K.O. no longer costs several full-screen passes.
const JUICE_CHROMA_RES = .5;
function juiceChroma(c2, amount) {
  if (typeof document === 'undefined' || amount < .02) return;
  const c = JUICE.scratch || (JUICE.scratch = document.createElement('canvas'));
  const sw = Math.max(1, Math.round(cv.width * JUICE_CHROMA_RES)), sh = Math.max(1, Math.round(cv.height * JUICE_CHROMA_RES));
  if (c.width !== sw || c.height !== sh) { c.width = sw; c.height = sh; }
  const g = c.getContext('2d'), off = amount * 9 * VIEW.s;
  c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0);
  for (const [color, dx] of [['#ff0000', off], ['#00ffff', -off]]) {
    g.globalCompositeOperation = 'copy'; g.drawImage(cv, 0, 0, sw, sh);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, sw, sh);
    c2.globalCompositeOperation = 'lighter'; c2.globalAlpha = .55 * amount; c2.drawImage(c, dx, 0, cv.width, cv.height);
  }
  c2.restore();
}

// A coloured glow around the screen edges (alpha 0..1). Gradients are cached per colour.
function juiceVignette(c2, color, alpha) {
  let g = JUICE.vignettes.get(color);
  if (!g) {
    g = c2.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .95);
    g.addColorStop(0, rgba(color, 0)); g.addColorStop(.55, rgba(color, .3)); g.addColorStop(1, rgba(color, 1));
    JUICE.vignettes.set(color, g);
  }
  c2.globalAlpha = clamp(alpha, 0, 1);
  c2.fillStyle = g; c2.fillRect(0, 0, W, H);
  c2.globalAlpha = 1;
}

// The lowest-health real player under 30% hears and sees a heartbeat that quickens as health drops.
function juiceHeartbeat(c2, dt) {
  if (!SETTINGS.heartbeat || G_STATE.state !== 'play' || G_STATE.demo || G_STATE.ending) { JUICE.beatPulse = 0; return; }
  let frac = 1;
  for (const f of F) if (f.alive && f.ctrl === 'human' && !f.autopilot && !f.summon) frac = Math.min(frac, f.hp / f.maxHp);
  if (frac >= .3) { JUICE.beat = 0; return; }
  const rate = lerp(2.1, 1.15, frac / .3);            // beats per second
  JUICE.beat += dt * rate;
  if (JUICE.beat >= 1) { JUICE.beat -= 1; sfx('heartbeat', .5 + (.3 - frac)); }
  const ph = JUICE.beat, pulse = Math.exp(-ph * 9) + .6 * Math.exp(-Math.abs(ph - .2) * 14);
  juiceVignette(c2, '#ff1030', (.24 + .38 * pulse) * (1 - frac / .3 * .45));
}

// ---------- Settings screen additions ----------
// Adds our options to the Settings screen built by 97-ui-pages (wrapped at boot, after it has registered).
function juiceSettingsExtras(node) {
  const groups = node.querySelectorAll ? node.querySelectorAll('.set-group') : [];
  const set = k => v => setSetting(k, v);
  for (const g of groups) {
    const title = g.querySelector('h3') && g.querySelector('h3').textContent;
    if (title === 'Effects') {
      g.append(
        toggleField('Replay every K.O.', SETTINGS.killcamAll, set('killcamAll'), 'Off: only the match-deciding K.O. is replayed.'),
        segField('Hit effects', [['sparks', 'Neon sparks'], ['red', 'Red']], SETTINGS.hitFx, set('hitFx')),
        toggleField('Low-health heartbeat', SETTINGS.heartbeat, set('heartbeat')));
    } else if (title === 'Sound') {
      const music = toggleField('Music', SETTINGS.musicOn, set('musicOn'), 'Synthwave soundtrack.');
      g.children.length > 2 ? g.insertBefore(music, g.children[2]) : g.append(music);
    }
  }
  return node;
}

on('boot', () => {
  if (typeof SCREENS === 'undefined' || typeof SCREENS.settings !== 'function') return;
  const build = SCREENS.settings;
  SCREENS.settings = () => {
    const node = build();
    try { juiceSettingsExtras(node); } catch (e) { report(e, 'juice settings'); }
    return node;
  };
});
