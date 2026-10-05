// 98-campaign-ui.js: screens for the Mythic Quest (76-campaign) and the Challenges (77-challenges):
// - 'campaign': a procedurally drawn world map. Nodes are real buttons laid over a canvas, so arrows, the d-pad, mouse
//   and touch all work through the menu's spatial navigation; a little stickman (with Lumen, the lantern spirit) walks
//   the paths to the selected node. On a portrait screen the map is transposed (realms run top to bottom).
// - dialogue boxes (speaker, 1-3 lines, Next / Skip), 'skilltree', 'challenges', title menu entries, and the results
//   screen's "World map" / "Next challenge" buttons. CSS: styles/98-campaign.css.

const CAMP_UI = { at: null, path: [], seg: 0, sel: null, auto: null, canvas: null, info: null, raf: 0, last: 0, tall: false,
  prevMode: null, selBefore: null, dlg: null };
const CAMP_BG = { ember: ['#2b0d07', '#521a0a'], frost: ['#0d2036', '#2a537a'], sky: ['#25204f', '#5a6cb5'], shadow: ['#07050d', '#1c1233'] };

// ---------- starting fights ----------
function questCfg(extra) {
  return Object.assign({ map: 'random', diff: 'normal', loadouts: [loadoutForMatch(0)], speed: SETTINGS.speed,
    orbs: SETTINGS.items !== 'off', orbRate: ITEM_RATES[SETTINGS.items] || 1, killcam: !!SETTINGS.killcam }, extra);
}
function questLaunch(extra) { initAudio(); uiSfx('fight'); startMatch(questCfg(extra)); }
const campFight = id => questLaunch({ mode: 'campaign', node: id });
const chalStart = id => questLaunch({ mode: 'challenge', challenge: id });
// Opens the loadout screen for a quest mode; its last button comes back here (mode.loadoutNext, 96-ui-loadout).
function questLoadout(modeKey, back) {
  if (MENU.mode !== 'campaign' && MENU.mode !== 'challenge') CAMP_UI.prevMode = MENU.mode;
  MENU.mode = modeKey; LO.picker = 0;
  openScreen('loadout', back);
}
// Leaving the loadout puts the menu's own mode back (so Quick Fight is unchanged).
function questRestoreMode() {
  if (MENU.mode !== 'campaign' && MENU.mode !== 'challenge') return;
  MENU.mode = CAMP_UI.prevMode && MODES[CAMP_UI.prevMode] ? CAMP_UI.prevMode : 'versus'; saveMenu();
}
MODES.campaign.loadoutLabel = 'World map ▸';
MODES.campaign.loadoutNext = () => openScreen('campaign');
MODES.challenge.loadoutLabel = 'Challenges ▸';
MODES.challenge.loadoutNext = () => openScreen('challenges');

// ---------- map geometry ----------
// Map units (0-100 across the realms, 0-100 down) to screen percentages ("UV"). Portrait screens swap the axes and
// fit each realm's nodes below a strip for its name.
function campUV(n) {
  if (!CAMP_UI.tall) return { x: n.x, y: n.y };
  const r = clamp(Math.floor(n.x / 25), 0, 3);
  return { x: 4 + n.y * .92, y: r * 25 + 5 + (n.x - r * 25) / 25 * 19 };
}
// A gentle curve between two nodes (the walker follows the same curve the path is drawn with).
function campCurve(a, b, t) {
  const mx = (a.x + b.x) / 2 + (b.y - a.y) * .18, my = (a.y + b.y) / 2 - (b.x - a.x) * .18, s = 1 - t;
  return { x: s * s * a.x + 2 * s * t * mx + t * t * b.x, y: s * s * a.y + 2 * s * t * my + t * t * b.y };
}
const campLen = (a, b) => { const p = campUV(a), q = campUV(b); return Math.hypot(q.x - p.x, q.y - p.y) * 1.1; };
// Shortest walk over unlocked nodes (paths work both ways).
function campRoute(to) {
  const s = campSave(), prev = { [CAMP_UI.at]: null }, queue = [CAMP_UI.at];
  while (queue.length) {
    const id = queue.shift();
    if (id === to) break;
    const next = CAMP_BY_ID[id].to.concat(CAMP_PARENTS[id] || []);
    for (const k of next) if (!(k in prev) && campUnlocked(k, s)) { prev[k] = id; queue.push(k); }
  }
  if (!(to in prev)) return;
  const path = [];
  for (let k = to; k !== CAMP_UI.at; k = prev[k]) path.unshift(k);
  if (CAMP_UI.path.length && CAMP_UI.seg > 0) return;     // finish the current step first (campArrive re-routes)
  CAMP_UI.path = path; CAMP_UI.seg = 0;
}
function campWalk(dt) {
  const u = CAMP_UI;
  if (!u.path.length) return;
  u.seg += dt * 34 / campLen(CAMP_BY_ID[u.at], CAMP_BY_ID[u.path[0]]);
  if (u.seg < 1) return;
  u.at = u.path.shift(); u.seg = 0;
  const s = campSave(); s.at = u.at; store.set('quest', s);
  if (u.path[u.path.length - 1] !== u.sel) { u.path = []; if (u.sel !== u.at) campRoute(u.sel); }   // the target changed mid-walk
  if (!u.path.length && u.auto === u.at) campEnter(u.at);
}
// Where the walker is, in UV.
function campWalkerPos() {
  const u = CAMP_UI, a = campUV(CAMP_BY_ID[u.at]);
  return u.path.length ? campCurve(a, campUV(CAMP_BY_ID[u.path[0]]), u.seg) : a;
}

// ---------- the world map screen ----------
SCREENS.campaign = () => {
  questRestoreMode();
  const s = campSave(), u = CAMP_UI;
  u.tall = innerWidth < innerHeight * .95;
  if (!CAMP_BY_ID[u.at] || !campUnlocked(u.at, s)) { u.at = s.at; u.path = []; u.seg = 0; }
  if (!u.sel || !campUnlocked(u.sel, s)) u.sel = u.at;
  u.canvas = el('canvas', { class: 'camp-canvas', 'aria-hidden': 'true' });
  const realmAt = campRealmAt(s);
  const labels = CAMP_REALMS.map((r, i) => {
    const p = CAMP_UI.tall ? { x: 2, y: i * 25 + 2.4 } : { x: i * 25 + 12.5, y: 4 };
    return el('span', { class: 'camp-realm', style: { left: p.x + '%', top: p.y + '%', '--rc': r.color } }, (i > realmAt ? '🔒 ' : '') + r.name);
  });
  const box = el('div', { class: 'camp-map' + (u.tall ? ' tall' : '') }, u.canvas, labels, CAMP_NODES.map(n => campNodeButton(n, s)));
  u.info = el('div', { class: 'camp-info' });
  campFillInfo();
  campLoopStart();
  if (QUEST_PENDING.post) { const id = QUEST_PENDING.post; QUEST_PENDING.post = null; setTimeout(() => campDialogue(CAMP_BY_ID[id].post), 60); }
  const pts = campPoints(s);
  return sheet('Mythic Quest', box, [uiButton('◂ Back', goBack, 'foot-back'), u.info,
    uiButton(`Skill tree${pts ? ` (${pts})` : ''}`, () => openScreen('skilltree', 'campaign'), 'camp-tree' + (pts ? ' has-pts' : '')),
    uiButton('Loadout', () => questLoadout('campaign', 'campaign')),
    el('button', { class: 'go', onclick: () => { uiSfx('click'); campEnter(u.sel); } }, 'Fight ▸')],
  { cls: 'sheet-camp', headExtra: el('span', { class: 'quest-chip' }, `★ ${campStarTotal(s)}/${CAMP_NODES.length * 3}`) });
};

function campNodeButton(n, s) {
  const open = campUnlocked(n.id, s), stars = s.stars[n.id] || 0, p = campUV(n), kind = CAMP_KINDS[n.kind];
  const fresh = open && !stars && !s.seen[n.id];
  return el('button', { class: `camp-node k-${n.kind}${stars ? ' done' : ''}${fresh ? ' new' : ''}${n.id === CAMP_UI.sel ? ' sel' : ''}${p.x < 14 ? ' edge-l' : p.x > 86 ? ' edge-r' : ''}`,
    style: { left: p.x + '%', top: p.y + '%', '--rc': CAMP_REALMS[n.r].color }, disabled: !open || null, 'data-key': 'node-' + n.id,
    'aria-label': `${n.name}, ${kind.label}${open ? `, ${stars} of 3 stars` : ', locked'}`,
    onpointerdown: () => { CAMP_UI.selBefore = CAMP_UI.sel; },
    onfocus: () => campSelect(n.id),
    onclick: e => { const again = e.detail === 0 || CAMP_UI.selBefore === n.id; CAMP_UI.selBefore = null; campSelect(n.id); if (again) campEnter(n.id); } },
  el('span', { class: 'cn-icon', text: open ? kind.icon : '🔒' }),
  stars ? el('span', { class: 'cn-stars', text: questStarStr(stars) }) : null,
  el('span', { class: 'cn-name', text: n.name }));
}

function campSelect(id) {
  if (CAMP_UI.sel === id) return;
  CAMP_UI.sel = id; CAMP_UI.auto = null;
  for (const b of document.querySelectorAll('.camp-node')) b.classList.toggle('sel', b.dataset.key === 'node-' + id);
  campRoute(id);
  campFillInfo();
  uiSfx('nav');
}
// The footer card: the selected node's name, realm, foes, arena and stars.
function campFillInfo() {
  const n = CAMP_BY_ID[CAMP_UI.sel], s = campSave();
  if (!n || !CAMP_UI.info) return;
  const map = MAPS[questMap(n.map, CAMP_REALMS[n.r].maps)], wx = n.wx && WEATHER[n.wx];
  const foes = {};
  for (const f of n.foes) foes[f[0]] = (foes[f[0]] || 0) + 1;
  const where = [CAMP_REALMS[n.r].name, CAMP_KINDS[n.kind].label, map ? map.name : '', wx ? wx.name : '', (n.mods || []).includes('dark') ? 'Darkness' : ''];
  CAMP_UI.info.replaceChildren(
    el('b', { class: 'ci-name', style: { color: CAMP_REALMS[n.r].color } }, `${CAMP_KINDS[n.kind].icon} ${n.name}`),
    el('small', { text: where.filter(Boolean).join(' · ') }),
    el('span', { class: 'ci-foes', text: 'vs ' + Object.entries(foes).map(([k, c]) => c > 1 ? `${k} ×${c}` : k).join(', ') }),
    el('span', { class: 'ci-stars' }, el('b', { text: questStarStr(s.stars[n.id] || 0) }), ' ', questStarRules(campSpec(n).st).map(questStarText).join(' · ')));
}

function campEnter(id) {
  const n = CAMP_BY_ID[id], s = campSave();
  if (!n || !campUnlocked(id, s)) return;
  if (CAMP_UI.at !== id) { CAMP_UI.auto = id; campRoute(id); return; }    // walk there first, then go in
  CAMP_UI.auto = null;
  if (n.pre && !s.seen[id]) {
    s.seen[id] = 1; store.set('quest', s);
    campDialogue(n.pre, () => campFight(id));
  } else campFight(id);
}

// ---------- dialogue ----------
// Shows lines [[speaker, text], ...] one at a time over the current screen; done() runs after the last (or Skip).
function campDialogue(lines, done) {
  const panel = PANELS[UI.screen];
  if (!panel || !lines || !lines.length) { if (done) done(); return; }
  campDialogueClose();
  const sheetEl = panel.querySelector('.sheet');
  let i = 0;
  const finish = () => { campDialogueClose(); if (done) done(); };
  const face = el('i', { class: 'dlg-face' }), who = el('b', { class: 'dlg-who' }), text = el('p', { class: 'dlg-text' });
  const next = el('button', { class: 'go dlg-next', onclick: () => { uiSfx('click'); if (++i >= lines.length) finish(); else show(); } });
  const box = el('div', { class: 'camp-dlg', role: 'dialog', 'aria-live': 'polite' }, face,
    el('div', { class: 'dlg-body' }, who, text),
    el('div', { class: 'dlg-btns' }, el('button', { class: 'dlg-skip', onclick: () => { uiSfx('back'); finish(); } }, 'Skip'), next));
  function show() {
    const [name, line] = lines[i], color = campSpeakerColor(name);
    box.style.setProperty('--dc', color);
    face.className = 'dlg-face' + (name === LUMEN ? ' lumen' : '');
    who.textContent = name; text.textContent = line;
    text.classList.remove('in'); void text.offsetWidth; text.classList.add('in');
    next.textContent = i + 1 < lines.length ? 'Next ▸' : 'OK ▸';
  }
  CAMP_UI.dlg = box;
  if (sheetEl) sheetEl.inert = true;
  panel.append(box);
  show();
  next.focus({ preventScroll: true });
}
function campDialogueClose() {
  const d = CAMP_UI.dlg;
  if (!d) return;
  const sh = d.parentNode && d.parentNode.querySelector('.sheet');
  if (sh) sh.inert = false;
  d.remove(); CAMP_UI.dlg = null;
}
function campSpeakerColor(name) {
  if (name === LUMEN) return '#ffd84a';
  const n = CAMP_NODES.find(k => k.foes.some(f => f[0].toUpperCase() === name));
  return n ? (n.foes[0][3] && n.foes[0][3].color) || CAMP_REALMS[n.r].color : '#ff8a2e';
}
// Escape skips a dialogue instead of leaving the screen.
addEventListener('keydown', e => {
  if (!CAMP_UI.dlg || e.code !== 'Escape') return;
  const host = CAMP_UI.dlg.parentNode;
  if (!host || host.hidden) { campDialogueClose(); return; }          // its screen was left (pad B): just tidy up
  e.preventDefault(); e.stopImmediatePropagation();
  CAMP_UI.dlg.querySelector('.dlg-skip').click();
}, true);

// ---------- drawing the map ----------
function campLoopStart() {
  if (!CAMP_UI.raf) CAMP_UI.raf = requestAnimationFrame(t => { CAMP_UI.last = t; campLoop(t); });
}
function campLoop(now) {
  const u = CAMP_UI;
  if (!u.canvas || !u.canvas.isConnected || UI.screen !== 'campaign' || !PANELS.campaign || PANELS.campaign.hidden) { u.raf = 0; return; }
  u.raf = requestAnimationFrame(campLoop);
  const dt = Math.min(.05, Math.max(0, (now - u.last) / 1000));
  u.last = now;
  campWalk(dt);
  try { campDraw(now / 1000); } catch (e) { report(e, 'campaign map'); cancelAnimationFrame(u.raf); u.raf = 0; }
}
on('state', () => { if (G_STATE.state !== 'menu') campDialogueClose(); });
addEventListener('resize', () => {
  if (UI.screen === 'campaign' && PANELS.campaign && !PANELS.campaign.hidden && (innerWidth < innerHeight * .95) !== CAMP_UI.tall) refreshScreen();
});

// Seeded decorations per realm, kept clear of the nodes.
function campRng(seed) { return () => (seed = seed * 16807 % 2147483647) / 2147483647; }
const CAMP_DECOR = CAMP_REALMS.map((r, i) => {
  const rand = campRng(97 + i * 131), out = [];
  for (let k = 0; k < 40 && out.length < 14; k++) {
    const d = { x: i * 25 + 2 + rand() * 21, y: 8 + rand() * 86, s: .6 + rand() * .8, k: rand() };
    if (CAMP_NODES.every(n => Math.hypot(n.x - d.x, (n.y - d.y) * .6) > 6)) out.push(d);
  }
  return out;
});

function campDraw(t) {
  const c = CAMP_UI.canvas, dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d'), s = campSave(), realmAt = campRealmAt(s), k = Math.min(w, h) / 520;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = uv => ({ x: uv.x / 100 * w, y: uv.y / 100 * h });          // UV to canvas pixels
  CAMP_REALMS.forEach((r, i) => campDrawRealm(g, r, i, P, w, h, k, t));
  campDrawPaths(g, s, P, k, t);
  const me = P(campWalkerPos());
  campDrawShade(g, P, w, h, me, k);
  CAMP_REALMS.forEach((r, i) => { if (i > realmAt) campFillBand(g, i, w, h, 'rgba(4,5,12,.55)'); });
  campDrawWalker(g, me, k, t);
}
// The band of realm i (landscape: a column; portrait: a row).
function campBand(i, w, h) { return CAMP_UI.tall ? [0, i * h / 4, w, h / 4] : [i * w / 4, 0, w / 4, h]; }
function campFillBand(g, i, w, h, fill) { const [x, y, bw, bh] = campBand(i, w, h); g.fillStyle = fill; g.fillRect(x, y, bw, bh); }

function campDrawRealm(g, r, i, P, w, h, k, t) {
  const [x, y, bw, bh] = campBand(i, w, h), [c1, c2] = CAMP_BG[r.key];
  const grad = CAMP_UI.tall ? g.createLinearGradient(0, y, 0, y + bh) : g.createLinearGradient(x, 0, x + bw, 0);
  grad.addColorStop(0, c1); grad.addColorStop(.5, c2); grad.addColorStop(1, c1);
  g.fillStyle = grad; g.fillRect(x, y, bw, bh);
  for (const d of CAMP_DECOR[i]) { const p = P(campUV(d)); CAMP_DECOR_DRAW[r.key](g, p.x, p.y, d.s * k, d.k, t); }
  CAMP_AMBIENT[r.key](g, x, y, bw, bh, k, t);
  if (i) {                                                 // a glowing seam between realms
    g.strokeStyle = rgba(r.color, .35); g.lineWidth = 3 * k; g.beginPath();
    for (let q = 0; q <= 24; q++) {
      const a = q / 24, j = Math.sin(a * 19 + i) * 6 * k;
      const px = CAMP_UI.tall ? a * w : x + j, py = CAMP_UI.tall ? y + j : a * h;
      if (q) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.stroke();
  }
}

const CAMP_DECOR_DRAW = {
  ember(g, x, y, s, v, t) {                                // volcanoes with glowing craters, or lava cracks
    if (v < .55) {
      poly(g, [{ x: x - 34 * s, y: y + 18 * s }, { x: x - 8 * s, y: y - 22 * s }, { x: x + 8 * s, y: y - 22 * s }, { x: x + 34 * s, y: y + 18 * s }], '#1a0805', '#3a1408', 2);
      glow(g, '#ff6a2a', 14, () => circle(g, x, y - 22 * s, (5 + Math.sin(t * 3 + v * 9)) * s, '#ff8a2e'));
    } else {
      g.strokeStyle = rgba('#ff6a2a', .55 + .25 * Math.sin(t * 2 + v * 7)); g.lineWidth = 2.5 * s; g.beginPath();
      g.moveTo(x - 30 * s, y); g.quadraticCurveTo(x - 10 * s, y - 10 * s, x, y + 2 * s); g.quadraticCurveTo(x + 14 * s, y + 12 * s, x + 30 * s, y - 4 * s); g.stroke();
    }
  },
  frost(g, x, y, s, v) {                                   // snow-capped peaks and pines
    if (v < .6) {
      poly(g, [{ x: x - 32 * s, y: y + 20 * s }, { x, y: y - 30 * s }, { x: x + 32 * s, y: y + 20 * s }], '#16324f', '#3d6a94', 2);
      poly(g, [{ x: x - 11 * s, y: y - 13 * s }, { x, y: y - 30 * s }, { x: x + 11 * s, y: y - 13 * s }, { x: x + 3 * s, y: y - 16 * s }], '#e8fbff', null);
    } else {
      for (const dx of [-9, 7]) poly(g, [{ x: x + (dx - 8) * s, y: y + 10 * s }, { x: x + dx * s, y: y - 16 * s }, { x: x + (dx + 8) * s, y: y + 10 * s }], '#1e4a5e', '#9fe8ff', 1);
    }
  },
  sky(g, x, y, s, v, t) {                                  // floating islands bobbing, and puffy clouds
    const b = Math.sin(t * 1.3 + v * 9) * 3 * s;
    if (v < .55) {
      poly(g, [{ x: x - 26 * s, y: y + b }, { x: x + 26 * s, y: y + b }, { x: x + 6 * s, y: y + 22 * s + b }, { x: x - 4 * s, y: y + 26 * s + b }], '#3a2f5e', '#6a5aa8', 1.5);
      g.fillStyle = '#7dffcf'; g.fillRect(x - 26 * s, y - 4 * s + b, 52 * s, 5 * s);
    } else {
      g.fillStyle = 'rgba(235,240,255,.22)';
      for (const [dx, r] of [[-14, 10], [0, 14], [14, 9]]) { g.beginPath(); g.arc(x + dx * s + Math.sin(t * .4 + v * 5) * 6 * s, y, r * s, 0, TAU); g.fill(); }
    }
  },
  shadow(g, x, y, s, v, t) {                               // stalagmites and glowing crystals
    if (v < .55) poly(g, [{ x: x - 12 * s, y: y + 16 * s }, { x: x - 2 * s, y: y - 26 * s }, { x: x + 12 * s, y: y + 16 * s }], '#120c22', '#2c1f4d', 1.5);
    else glow(g, '#8a6aff', 12, () => poly(g, [{ x: x - 6 * s, y }, { x, y: y - 18 * s }, { x: x + 6 * s, y }, { x, y: y + 8 * s }],
      rgba('#b98cff', .55 + .35 * Math.sin(t * 2 + v * 11)), null));
  },
};
// Moving bits per realm: rising embers, falling snow, drifting motes, faint eyes in the dark.
const CAMP_AMBIENT = {
  ember(g, x, y, w, h, k, t) { campMotes(g, x, y, w, h, k, t, '#ffb067', 18, 0, -1); },
  frost(g, x, y, w, h, k, t) { campMotes(g, x, y, w, h, k, t, '#ffffff', 22, .3, 1); },
  sky(g, x, y, w, h, k, t) { campMotes(g, x, y, w, h, k, t, '#ffe94a', 10, 1, -.2); },
  shadow(g, x, y, w, h, k, t) {
    for (let i = 0; i < 4; i++) {
      if (Math.sin(t * .7 + i * 2.3) < .6) continue;
      const ex = x + w * ((i * .29 + .13) % 1), ey = y + h * ((i * .37 + .21) % 1);
      for (const dx of [-5, 5]) circle(g, ex + dx * k, ey, 2 * k, '#ff4a6a');
    }
  },
};
function campMotes(g, x, y, w, h, k, t, color, n, sx, sy) {
  g.fillStyle = rgba(color, .7);
  for (let i = 0; i < n; i++) {
    const a = (i * .618) % 1, b = (i * .377 + t * .05 * (1 + a)) % 1;
    const u = (a + sx * b * .2) % 1, v = sy > 0 ? b : 1 - b;
    g.fillRect(x + u * w, y + v * h, 2 * k, 2 * k);
  }
}

function campDrawPaths(g, s, P, k, t) {
  g.lineCap = 'round';
  for (const n of CAMP_NODES) for (const id of n.to) {
    const b = CAMP_BY_ID[id], open = campUnlocked(id, s), done = campCleared(id, s);
    g.strokeStyle = done ? 'rgba(255,216,74,.85)' : open ? 'rgba(238,240,255,.75)' : 'rgba(150,155,200,.25)';
    g.lineWidth = (done ? 4 : 3) * k;
    g.setLineDash([2 * k, 9 * k]); g.lineDashOffset = open && !done ? -t * 14 : 0;
    g.beginPath();
    for (let q = 0; q <= 20; q++) { const p = P(campCurve(campUV(n), campUV(b), q / 20)); if (q) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }
    g.stroke();
  }
  g.setLineDash([]);
}
// The Shadow Depths stay dark except around the walker ("lit by your weapon").
function campDrawShade(g, P, w, h, me, k) {
  const [x, y, bw, bh] = campBand(3, w, h), r = 120 * k;
  g.save(); g.beginPath(); g.rect(x, y, bw, bh); g.clip();
  const grad = g.createRadialGradient(me.x, me.y, r * .3, me.x, me.y, r);
  grad.addColorStop(0, 'rgba(3,2,8,0)'); grad.addColorStop(1, 'rgba(3,2,8,.72)');
  g.fillStyle = grad; g.fillRect(x, y, bw, bh);
  g.restore();
}
// The player's stickman (in their colour, blade glowing) with Lumen bobbing beside it.
function campDrawWalker(g, p, k, t) {
  const color = menuLoadout(0).color, walking = CAMP_UI.path.length > 0, ph = walking ? t * 11 : 0, s = 1.4 * k;
  const nx = walking ? CAMP_BY_ID[CAMP_UI.path[0]] : null, face = nx ? Math.sign(campUV(nx).x - campWalkerPos().x) || 1 : 1;
  p = { x: p.x - 42 * k, y: p.y + 16 * k };                 // stand beside the node button, not under it
  const hip = { x: p.x, y: p.y - 16 * s }, neck = { x: p.x + face * 1.5 * s, y: p.y - 32 * s + (walking ? Math.abs(Math.sin(ph)) * 1.5 * s : 0) };
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(p.x, p.y + 2 * s, 12 * s, 3.5 * s, 0, 0, TAU); g.fill();
  glow(g, color, 10, () => {
    for (const sgn of [1, -1]) {
      const sw = Math.sin(ph) * sgn;
      line(g, hip, { x: p.x + sw * 7 * s, y: p.y }, color, 3 * s);
      line(g, neck, { x: neck.x - sw * 6 * s, y: neck.y + 13 * s }, color, 2.6 * s);
    }
    line(g, hip, neck, color, 3.2 * s);
    circle(g, neck.x + face * 1 * s, neck.y - 7 * s, 6 * s, '#07080f', color, 2.6 * s);
  });
  const hand = { x: neck.x + face * 8 * s, y: neck.y + 10 * s };
  glow(g, '#ffffff', 12, () => line(g, hand, { x: hand.x + face * 13 * s, y: hand.y - 15 * s }, '#e8fbff', 2.4 * s));
  line(g, neck, hand, color, 2.6 * s);
  const lx = p.x - face * 20 * s, ly = p.y - 44 * s + Math.sin(t * 2.4) * 4 * s;
  glow(g, '#ffd84a', 18, () => circle(g, lx, ly, 5.5 * s, '#ffe9a8', '#ffd84a', 1.5));
}

// ---------- skill tree ----------
SCREENS.skilltree = () => {
  const s = campSave(), pts = campPoints(s);
  const cols = CAMP_TREE.map(b => el('div', { class: 'tree-col', style: { '--tc': b.color } },
    el('h3', { text: `${b.icon} ${b.name}` }),
    b.skills.map(k => {
      const owned = !!s.tree[k.id], can = campCanBuy(k.id, s);
      return el('button', { class: 'tree-node' + (owned ? ' owned' : can ? ' can' : ' locked'), 'data-key': 'sk-' + k.id,
        onclick: () => { if (owned) return; if (campBuy(k.id)) { uiSfx('unlock'); refreshScreen(); } else uiSfx('deny'); } },
      el('b', { text: k.name }), el('small', { text: k.desc }), el('em', { text: owned ? 'Learned' : `${k.cost} point${k.cost > 1 ? 's' : ''}` }));
    })));
  return sheet('Skill Tree', [el('p', { class: 'hint tree-hint', text: 'Every campaign star earns a skill point. Learn each branch from the top down. Skills only apply in the Mythic Quest.' }),
    el('div', { class: 'tree-grid' }, cols)],
  [uiButton('◂ Back', goBack, 'foot-back'), uiButton('Reset skills', () => { campRespec(); refreshScreen(); }, null, { disabled: !campSpent(s) || null })],
  { headExtra: el('span', { class: 'quest-chip' + (pts ? ' glow' : '') }, `◆ ${pts} point${pts === 1 ? '' : 's'}`) });
};

// ---------- challenge list ----------
SCREENS.challenges = () => {
  questRestoreMode();
  const s = chalSave();
  const grid = el('div', { class: 'chal-grid' }, CHALLENGES.map((c, i) => {
    const st = s[c.id] || 0, rules = questRulesText(c);
    return el('button', { class: 'chal-card' + (st ? ' done' : '') + (st === 3 ? ' perfect' : ''), 'data-key': 'ch-' + c.id, onclick: () => chalStart(c.id) },
      el('span', { class: 'chal-num', text: String(i + 1) }), el('span', { class: 'chal-icon', 'aria-hidden': 'true', text: c.icon }),
      el('strong', { text: c.name }), el('p', { text: c.desc }),
      el('span', { class: 'chal-stars', text: questStarStr(st) }),
      el('small', { text: [rules, questStarRules(c.st).map(questStarText).join(' · ')].filter(Boolean).join(' — ') }));
  }));
  return sheet('Challenges', grid, [uiButton('◂ Back', goBack, 'foot-back'), uiButton('Loadout', () => questLoadout('challenge', 'challenges'))],
    { cls: 'sheet-chal', headExtra: el('span', { class: 'quest-chip' }, `★ ${chalStarTotal(s)}/${CHALLENGES.length * 3}`) });
};

// ---------- title menu entries (called by SCREENS.menu in 95-ui) ----------
function questMenuItems(item) {
  const s = campSave(), r = CAMP_REALMS[campRealmAt(s)];
  return el('div', { class: 'menu-pair' },          // side by side, so the title menu still fits a 720 px screen
    item('Mythic Quest', `${r.name} · ${campStarTotal(s)}/${CAMP_NODES.length * 3} ★`, () => openScreen('campaign', 'menu'), 'quest-item'),
    item('Challenges', `${chalStarTotal(chalSave())}/${CHALLENGES.length * 3} ★`, () => openScreen('challenges', 'menu')));
}

// ---------- results screen: back to the map / next challenge ----------
function questBack(screen) { UI.next = screen; UI.back[screen] = 'menu'; toMenu(); }
on('state', st => {
  if (st !== 'over' || !G_STATE.mode || !G_STATE.mode.quest) return;
  setTimeout(questResultButtons, 0);
});
function questResultButtons() {
  const row = document.querySelector('#over .results-card .row'), last = QUEST_PENDING.last;
  if (!row || !last) return;
  for (const b of row.querySelectorAll('button')) if (/^Change /.test(b.textContent)) b.remove();
  const btns = [];
  if (last.kind === 'campaign') btns.push(uiButton('🗺 World map', () => questBack('campaign'), last.won ? 'go' : null));
  else {
    const i = CHALLENGES.findIndex(c => c.id === last.id), nx = CHALLENGES[i + 1];
    if (last.won && nx) btns.push(uiButton(`Next: ${nx.name} ▸`, () => chalStart(nx.id), 'go'));
    btns.push(uiButton('Challenges', () => questBack('challenges')));
  }
  if (btns[0] && btns[0].classList.contains('go')) { const rm = row.querySelector('.go'); if (rm) rm.classList.remove('go'); }
  row.prepend(...btns);
  if (!IS_TOUCH) btns[0].focus({ preventScroll: true });
}

// ---------- test hook ----------
on('boot', () => {
  if (typeof window === 'undefined' || !window.SC) return;
  SC.quest = {
    nodes: () => CAMP_NODES.map(n => n.id),
    challenges: () => CHALLENGES.map(c => c.id),
    start: (kind, id, extra) => SC.start(Object.assign(kind === 'campaign' ? { mode: 'campaign', node: id } : { mode: 'challenge', challenge: id },
      { autopilot: true }, extra)),
    win() { const r = questRun(); if (r) r.force = true; return !!r; },          // the goal counts as met on the next step
    run: () => questRun(),
    dialogue: lines => campDialogue(lines || CAMP_NODES[0].pre),
  };
});
