// 96-ui-loadout.js: the loadout screen (one tab per picker): weapon grid by category with drawn icons, skill picker
// (choose 2), colour + hat picker, and a live preview of the fighter with stat bars. Previews use real fighters from
// makeFighter (never added to F) posed by hand, so every weapon and hat draws exactly as it does in the arena.

const LO = { picker: 0, tab: 'weapon', cat: 'all', confirm: null };
const LIVE_CANVASES = new Set();
const PREVIEW_FIGHTERS = new Map();

// ---------- canvases ----------
function uiCanvas(w, h, cls) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = el('canvas', { class: cls || null, width: Math.round(w * dpr), height: Math.round(h * dpr), 'aria-hidden': 'true' });
  c.style.aspectRatio = `${w} / ${h}`;
  c.ui = { w, h, dpr };
  return c;
}
// A canvas redrawn every animation frame while it is on screen: draw(g, t, w, h) in CSS pixels.
function liveCanvas(w, h, cls, draw) {
  const c = uiCanvas(w, h, cls);
  LIVE_CANVASES.add({ c, draw });
  return c;
}
function uiLiveLoop(now) {
  requestAnimationFrame(uiLiveLoop);
  if (!LIVE_CANVASES.size || !activePanel()) return;   // no menu open: nothing to paint
  for (const item of LIVE_CANVASES) {
    if (!item.c.isConnected) { LIVE_CANVASES.delete(item); continue; }
    if (item.c.offsetParent === null) continue;
    paintCanvas(item.c, g => item.draw(g, now / 1000, item.c.ui.w, item.c.ui.h), () => LIVE_CANVASES.delete(item));
  }
}
requestAnimationFrame(uiLiveLoop);
// Clears and draws into a ui canvas with errors contained (a broken preview must never break the menu).
function paintCanvas(c, fn, onError) {
  const g = c.getContext('2d'), { dpr } = c.ui;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, c.ui.w, c.ui.h);
  g.save();
  try { fn(g); } catch (e) { report(e, 'menu preview'); if (onError) onError(); }
  g.restore();
}

// ---------- posed preview fighters ----------
function previewFighter(weapon, color, hat) {
  let f = PREVIEW_FIGHTERS.get(weapon);
  if (!f) {
    f = makeFighter({ id: 0, x: 0, y: 0, face: 1, weapon, ctrl: 'cpu', name: 'preview' });
    f.preview = true;                 // cloth (78) skips the arena floor
    PREVIEW_FIGHTERS.set(weapon, f);
  }
  f.color = color; f.hat = hat || 'none';
  return f;
}
function setPt(p, x, y) { p.x = p.ox = x; p.y = p.oy = y; }
// Lays a weapon rig out straight from the hand at angle a (chains sag a little).
function placeRig(f, rig, hx, hy, a) {
  setPt(f.P[rig.hand], hx, hy);
  const n = rig.pts.length - 1, len = rig.w.len * f.scale, sag = rig.w.chain ? .35 : 0;
  for (let k = 1; k <= n; k++) {
    const d = len * k / n;
    setPt(f.P[rig.pts[k]], hx + Math.cos(a) * d, hy + Math.sin(a) * d + sag * len * (k / n) ** 2);
  }
}
// Idle stance with a gentle bob and weapon sway (feet at 0, 0 facing right).
function posePreview(f, t) {
  const bob = Math.sin(t * 2.2) * 2.5, ranged = !!f.w.ranged;
  BODY_POSE.forEach(([x, y], j) => setPt(f.P[j], x, y + (j <= 6 ? bob : 0)));
  const hx = ranged ? 36 : 28, hy = (ranged ? -112 : -110) + bob;
  setPt(f.P[5], 14, -114 + bob); setPt(f.P[6], hx, hy);
  placeRig(f, f.main, hx, hy, ranged ? -.06 + Math.sin(t * 1.3) * .04 : -1.05 + Math.sin(t * 1.8) * .32);
  if (f.off) {
    setPt(f.P[3], -2, -108 + bob); setPt(f.P[4], 14, -94 + bob);
    placeRig(f, f.off, 14, -94 + bob, f.off.w.cat === 'shield' ? -.5 : -.55 + Math.sin(t * 1.8 + 1) * .3);
  }
}
function drawPreviewBody(g, f) {
  g.lineCap = g.lineJoin = 'round';
  glow(g, f.color, 12, () => {
    g.strokeStyle = f.color; g.lineWidth = 7; g.beginPath();
    for (const [a, b] of BODY_LINKS) { g.moveTo(f.P[a].x, f.P[a].y); g.lineTo(f.P[b].x, f.P[b].y); }
    g.stroke();
    circle(g, f.P[0].x, f.P[0].y, HEAD_R, f.color);
  });
  circle(g, f.P[0].x + 6, f.P[0].y - 2, 3, '#0b0c18');
}
function drawPreviewHat(g, f) {
  const hat = HATS[f.hat];
  if (!hat || f.hat === 'none') return;
  g.save(); g.translate(f.P[0].x, f.P[0].y);
  hat.draw(g, f, { r: HEAD_R, face: 1, scale: 1, color: f.color });
  g.restore();
}
function drawPreviewWeapons(g, f) {
  for (const rig of rigsOf(f)) rig.w.draw.call(rig.w, g, f, weaponView(f, rig));
}

// The big animated preview: floor glow, fighter, hat and weapon. 'random' cycles through the arsenal.
function drawLoadoutPreview(g, t, w, h, lo) {
  let key = lo.weapon;
  if (!WEAPONS[key]) { const all = listOf(WEAPONS); key = all[Math.floor(t / .9) % all.length].key; }
  const hat = lo.hat === 'random' ? listOf(HATS)[1 + Math.floor(t / .9) % (listOf(HATS).length - 1)].key : lo.hat;
  const f = previewFighter(key, lo.color, hat);
  posePreview(f, t);
  const s = h / 300;
  const floor = g.createRadialGradient(w / 2, h - 26, 4, w / 2, h - 26, w * .45);
  floor.addColorStop(0, rgba(lo.color, .35)); floor.addColorStop(1, rgba(lo.color, 0));
  g.fillStyle = floor; g.fillRect(0, h - 60, w, 60);
  g.translate(w / 2 - 20 * s, h - 26); g.scale(s, s);
  const look = typeof lookForPreview === 'function' ? lookForPreview(lo) : null;   // outfit, skin, pet (98-ui-progress)
  if (look) outfitDraw(g, f, look, 'back', t);
  drawPreviewBody(g, f);
  if (look) outfitDraw(g, f, look, 'front', t);
  drawPreviewHat(g, f);
  if (look) { for (const rig of rigsOf(f)) skinDrawWeapon(g, f, rig, weaponView(f, rig), look); lookPreviewPet(g, f, look, t); }
  else drawPreviewWeapons(g, f);
}

// A static weapon icon: the weapon laid diagonally and fitted to the tile by its drawn pixels (blades that stick out
// sideways, like a scythe's, stay inside). Lines get thicker when the icon is shrunk so chains stay readable.
function drawWeaponIcon(c, key, color) {
  const f = previewFighter(key, color, 'none'), a = f.w.ranged ? -.12 : -.42, { w, h } = c.ui;
  posePreview(f, 0);
  placeRig(f, f.main, 0, 0, a);
  if (f.off) {
    if (iconStaffHalves(f)) placeRig(f, f.off, 0, 0, a + Math.PI);    // a split staff reads as one staff
    else placeRig(f, f.off, 8, 10, a + .5);
  }
  let box = iconBounds(f, 1), s = iconFit(box, w, h), thick = clamp(1 / s, 1, 2.2);
  if (thick > 1) { box = iconBounds(f, thick); s = iconFit(box, w, h); }
  paintCanvas(c, g => {
    g.translate(w / 2 - (box.x0 + box.x1) / 2 * s, h / 2 - (box.y0 + box.y1) / 2 * s); g.scale(s, s);
    drawIconWeapons(g, f, thick);
  });
}
const iconStaffHalves = f => !!f.off && f.off.w.hidden && f.w.twoHanded;
const iconFit = (box, w, h) => Math.min((w - 10) / Math.max(1, box.x1 - box.x0), (h - 8) / Math.max(1, box.y1 - box.y0), 1.5);
function drawIconWeapons(g, f, thick) {
  g.lineCap = g.lineJoin = 'round';
  for (const rig of rigsOf(f)) { const v = weaponView(f, rig); v.k *= thick; rig.w.draw.call(rig.w, g, f, v); }
}
// Bounding box (weapon space, hand at 0,0) of the pixels a weapon really draws, measured on a scratch canvas.
const ICON_SCRATCH = { c: null, size: 480, boxes: new Map() };   // boxes: cached per weapon and line thickness
function iconBounds(f, thick) {
  const id = f.wkey + '|' + thick.toFixed(2);
  if (!ICON_SCRATCH.boxes.has(id)) ICON_SCRATCH.boxes.set(id, iconMeasure(f, thick));
  return ICON_SCRATCH.boxes.get(id);
}
function iconMeasure(f, thick) {
  const n = ICON_SCRATCH.size, half = n / 2;
  const c = ICON_SCRATCH.c || (ICON_SCRATCH.c = Object.assign(document.createElement('canvas'), { width: n, height: n }));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, n, n);
  g.save(); g.translate(half, half);
  try { drawIconWeapons(g, f, thick); } catch (e) { report(e, 'weapon icon ' + f.wkey); }
  g.restore();
  const px = g.getImageData(0, 0, n, n).data;
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (px[(y * n + x) * 4 + 3] < 60) continue;          // ignore faint glow
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { x0: -40, y0: -20, x1: 40, y1: 20 };
  return { x0: x0 - half, y0: y0 - half, x1: x1 + 1 - half, y1: y1 + 1 - half };
}
// A head wearing a hat, for hat tiles.
function drawHatIcon(c, key, color) {
  paintCanvas(c, g => {
    const { w, h } = c.ui, r = Math.min(w, h) * .2, f = previewFighter(listOf(WEAPONS)[0].key, color, key);
    g.translate(w / 2, h * .68);
    glow(g, color, 8, () => circle(g, 0, 0, r, color));
    circle(g, r * .42, -r * .12, r * .2, '#0b0c18');
    if (HATS[key] && key !== 'none') HATS[key].draw(g, f, { r, face: 1, scale: r / HEAD_R, color });
  });
}

// ---------- weapon stats (percentile among all weapons, so bars spread nicely) ----------
let WEAPON_RANKS = null;
function weaponRaw(w) {
  if (w.ranged) {
    const r = w.ranged, p = r.proj || {};
    return { power: (p.dmg ?? 10) * (r.pellets || 1) * (p.explode ? 1.4 : 1) / 8, reach: (w.ai && w.ai.range) || 420, speed: 1 / Math.max(.05, r.cooldown) };
  }
  return { power: w.dmg * (w.offhand ? 1.3 : 1) * (1 + (w.kb - 1) * .3), reach: w.len + (w.chain ? 20 : 0), speed: (w.speed || 1) / Math.max(.15, w.cd) };
}
function weaponRank(key) {
  if (!WEAPON_RANKS) {
    const all = listOf(WEAPONS), raws = all.map(w => [w.key, weaponRaw(w)]);
    WEAPON_RANKS = {};
    for (const [k, r] of raws) {
      WEAPON_RANKS[k] = {};
      for (const stat of ['power', 'reach', 'speed']) {
        const below = raws.filter(([, o]) => o[stat] < r[stat]).length;
        WEAPON_RANKS[k][stat] = .12 + .88 * below / Math.max(1, raws.length - 1);
      }
    }
  }
  return WEAPON_RANKS[key];
}
function statBars(key) {
  const r = weaponRank(key), bar = (label, v) => el('div', { class: 'bar' }, el('span', { text: label }),
    el('b', { style: { '--v': (v * 100).toFixed(0) + '%' } }));
  if (!r) return el('div', { class: 'bars dim' }, bar('Power', .5), bar('Reach', .5), bar('Speed', .5));
  return el('div', { class: 'bars' }, bar('Power', r.power), bar('Reach', r.reach), bar('Speed', r.speed));
}
function weaponTraits(w) {
  const t = [];
  if (w.ranged) t.push(`${w.ranged.ammo} shots`, `reload ${w.ranged.reload}s`, w.ranged.auto ? 'hold to fire' : null);
  if (w.offhand) t.push('dual wield');
  if (w.chain) t.push('flexible');
  if (w.block > 0) t.push('blocks shots');
  if (w.armor < 1) t.push('armoured');
  if (w.twoHanded) t.push('two-handed');
  return t.filter(Boolean);
}

// ---------- the screen ----------
SCREENS.loadout = () => {
  const mode = MODES[MENU.mode] || {}, n = Math.max(1, modePickers(mode)), labels = mode.labels || [];
  LO.picker = clamp(LO.picker, 0, n - 1);
  const i = LO.picker, lo = menuLoadout(i), label = labels[i] || `Fighter ${i + 1}`;
  const tabs = n > 1 ? el('div', { class: 'player-tabs', role: 'tablist' }, Array.from({ length: n }, (_, k) => {
    const l = menuLoadout(k);
    return el('button', { role: 'tab', 'aria-selected': String(k === i), 'data-key': 'picker-' + k, style: { '--pc': l.color },
      onclick: () => { LO.picker = k; LO.confirm = null; uiSfx('click'); refreshScreen(); } }, el('i'), labels[k] || `Fighter ${k + 1}`);
  })) : null;
  const sections = [['weapon', 'Weapon'], ['skills', 'Skills'], ['class', 'Class'], ['gear', 'Throwables'], ['style', 'Style'], ['look', 'Look']];
  const subTabs = el('div', { class: 'seg sub-tabs', role: 'tablist' }, sections.map(([k, t]) =>
    el('button', { role: 'tab', 'aria-pressed': String(LO.tab === k), 'data-key': 'tab-' + k, onclick: () => { LO.tab = k; uiSfx('click'); refreshScreen(); } }, t)));
  const tabs3 = { skills: skillsTab, style: styleTab, class: classTab, gear: gearTab, look: typeof lookTab === 'function' ? lookTab : styleTab };
  const content = (tabs3[LO.tab] || weaponTab)(i, lo);
  const last = i >= n - 1;
  // A mode may send its last loadout step elsewhere (mode.loadoutNext / loadoutLabel: the campaign map, the challenge list).
  const next = el('button', { class: 'go', onclick: () => { uiSfx('click'); if (last) { if (mode.loadoutNext) mode.loadoutNext(); else openScreen('maps', 'loadout'); } else { LO.picker++; refreshScreen(); } } },
    last ? mode.loadoutLabel || 'Arena ▸' : `Next: ${labels[i + 1] || 'Fighter ' + (i + 2)} ▸`);
  return sheet('Loadout', [tabs, typeof presetBar === 'function' ? presetBar(i, lo) : null, el('div', { class: 'lo-grid', style: { '--pc': lo.color } },
    previewPane(i, lo, label), el('div', { class: 'lo-pick' }, subTabs, content))],
  [uiButton('◂ Back', goBack, 'foot-back'), last ? null : uiButton('Skip to arena', () => openScreen('maps', 'loadout'), 'skip'), next], { cls: 'sheet-loadout' });
};

function previewPane(i, lo, label) {
  const w = WEAPONS[lo.weapon];
  const canvas = liveCanvas(300, 280, 'lo-canvas', (g, t, cw, ch) => drawLoadoutPreview(g, t, cw, ch, lo));
  // Several 'random' picks become one chip ("Random skill ×2"), not a row of identical ones.
  const randoms = lo.skills.filter(k => k === 'random').length;
  const skills = lo.skills.filter((k, s) => k !== 'random' || lo.skills.indexOf('random') === s).map(k => {
    const d = SKILLS[k];
    return el('span', { class: 'skill-chip', style: d ? { '--sc': d.color } : null },
      el('b', { text: d ? d.icon : k === 'random' ? '🎲' : '–' }), d ? d.name : k === 'random' ? `Random skill${randoms > 1 ? ' ×' + randoms : ''}` : 'No skill');
  });
  return el('div', { class: 'lo-preview' },
    el('div', { class: 'lo-who' }, el('i', { style: { background: lo.color } }), label),
    canvas,
    el('h3', { class: 'lo-name' }, w ? w.name : 'Random weapon',
      el('small', { text: w ? (CAT_ICONS[w.cat] || '') + ' ' + (CAT_NAMES[w.cat] || w.cat) : 'A new pick every match' })),
    el('p', { class: 'lo-desc', text: w ? w.desc : 'Rolls a different weapon from the whole arsenal for each match.' }),
    statBars(w && w.key),
    w && weaponTraits(w).length ? el('p', { class: 'traits', text: weaponTraits(w).join(' · ') }) : null,
    el('div', { class: 'skill-chips' }, skills, loadoutChipsV3(lo)));
}

// Class and throwable chips under the preview.
function loadoutChipsV3(lo) {
  const c = CLASSES[lo.cls], chip = (d, fallback) => el('span', { class: 'skill-chip', style: d ? { '--sc': d.color } : null },
    el('b', { text: d ? d.icon : '🎲' }), d ? d.name : fallback);
  const randomThrows = lo.throws.filter(k => k === 'random').length;
  return [chip(c, 'Random class'), ...lo.throws.map((k, s) => THROWABLES[k] ? chip(THROWABLES[k]) :
    k === 'random' && lo.throws.indexOf('random') === s ? chip(null, `Random throwable${randomThrows > 1 ? 's ×' + randomThrows : ''}`) : null)];
}

// ---------- class tab ----------
// Stat bars are scaled across the range the classes actually use, so the differences are easy to see.
function classTab(i, lo) {
  const pick = key => () => { lo.cls = key; saveMenu(); uiSfx('click'); refreshScreen(); };
  const bar = (label, v) => el('div', { class: 'bar' }, el('span', { text: label }), el('b', { style: { '--v': (clamp(v, .06, 1) * 100).toFixed(0) + '%' } }));
  const tiles = listOf(CLASSES).map(c => el('button', { class: 'skill-tile class-tile' + (lo.cls === c.key ? ' sel' : ''), 'data-key': 'cls-' + c.key,
    style: { '--sc': c.color }, title: c.passive, onclick: pick(c.key) },
  el('span', { class: 'sk-icon', text: c.icon }),
  el('span', { class: 'sk-text' }, el('strong', { text: c.name }), el('small', { text: c.desc }), el('em', { class: 'cl-passive', text: c.passive })),
  el('div', { class: 'bars cl-bars' }, bar('Health', (c.hp - .8) / .6), bar('Speed', (c.speed - .8) / .36), bar('Weight', (c.mass - .7) / .75),
    bar('Guard', (c.stamina - .8) / .75))));
  const random = el('button', { class: 'skill-tile class-tile' + (CLASSES[lo.cls] ? '' : ' sel'), 'data-key': 'cls-random', onclick: pick('random') },
    el('span', { class: 'sk-icon', text: '🎲' }), el('span', { class: 'sk-text' }, el('strong', { text: 'Random' }), el('small', { text: 'A different class every match.' })));
  return el('div', { class: 'tab-body' },
    el('p', { class: 'hint', text: 'Your class sets your health, speed and weight, and adds a passive. Every class can win: pick a style.' }),
    el('div', { class: 'skill-grid class-grid' }, random, tiles));
}

// ---------- throwables tab ----------
function gearTab(i, lo) {
  const th = lo.throws, set = (a, b) => { lo.throws = [a, b]; saveMenu(); uiSfx('click'); refreshScreen(); };
  const human = !isCpuPicker(i), key = human && BINDS[Math.min(i, 1)] ? keyLabel(BINDS[Math.min(i, 1)].throw) : '';
  const slots = el('div', { class: 'skill-slots' }, [0, 1].map(s => {
    const d = THROWABLES[th[s]];
    return el('div', { class: 'slot', style: d ? { '--sc': d.color } : null }, el('small', { text: `Throw ${s + 1}` + (key ? ` · key ${key}` : '') }),
      el('strong', {}, el('b', { text: d ? d.icon : th[s] === 'random' ? '🎲' : '–' }), d ? d.name : th[s] === 'random' ? 'Random' : 'Empty'));
  }),
  el('div', { class: 'slot-actions' },
    el('button', { 'data-key': 'th-random', onclick: () => set('random', 'random') }, '🎲 Random'),
    el('button', { 'data-key': 'th-clear', onclick: () => set('none', 'none') }, 'Clear')));
  const toggle = k => {
    const at = th.indexOf(k), next = th.slice();
    if (at >= 0) { next[at] = 'none'; return set(...next); }
    const free = th.findIndex(x => !THROWABLES[x]);
    if (free >= 0) { next[free] = k; return set(...next); }
    set(th[1], k);
  };
  const grid = el('div', { class: 'skill-grid' }, listOf(THROWABLES).map(t => {
    const slot = th.indexOf(t.key);
    return el('button', { class: 'skill-tile' + (slot >= 0 ? ' sel' : ''), 'data-key': 'th-' + t.key, style: { '--sc': t.color }, title: t.desc, onclick: () => toggle(t.key) },
      el('span', { class: 'sk-icon', text: t.icon }), el('span', { class: 'sk-text' }, el('strong', { text: t.name }), el('small', { text: t.desc })),
      slot >= 0 ? el('span', { class: 'sk-badge', text: String(slot + 1) }) : null);
  }));
  return el('div', { class: 'tab-body' },
    el('p', { class: 'hint', text: 'Pick two throwables. Each can be thrown once per round, lobbed at the nearest foe.' }), slots, grid);
}

// ---------- weapon tab ----------
function weaponTab(i, lo) {
  const all = listOf(WEAPONS), cats = WEAPON_CATS.filter(c => all.some(w => w.cat === c));
  if (LO.cat !== 'all' && !cats.includes(LO.cat)) LO.cat = 'all';
  const chips = el('div', { class: 'cat-chips', role: 'group', 'aria-label': 'Weapon category' },
    [['all', 'All', '★'], ...cats.map(c => [c, CAT_NAMES[c] || c, CAT_ICONS[c] || ''])].map(([c, name, icon]) =>
      el('button', { 'aria-pressed': String(LO.cat === c), 'data-key': 'cat-' + c, onclick: () => { LO.cat = c; uiSfx('click'); refreshScreen(); } },
        icon + ' ' + name + (c === 'all' ? '' : ` ${all.filter(w => w.cat === c).length}`))));
  const pick = key => () => { lo.weapon = key; saveMenu(); uiSfx('click'); refreshScreen(); };
  const groups = (LO.cat === 'all' ? cats : [LO.cat]).map(c => el('section', { class: 'w-group' },
    el('h4', { text: `${CAT_ICONS[c] || ''} ${CAT_NAMES[c] || c}` }),
    el('div', { class: 'tile-grid' }, all.filter(w => w.cat === c).map(w => {
      const c2 = uiCanvas(132, 54);
      drawWeaponIcon(c2, w.key, lo.color);
      return el('button', { class: 'tile w-tile' + (lo.weapon === w.key ? ' sel' : ''), 'data-key': 'w-' + w.key, title: w.desc, onclick: pick(w.key) },
        c2, el('span', { text: w.name }));
    }))));
  const random = el('button', { class: 'tile w-tile random' + (WEAPONS[lo.weapon] ? '' : ' sel'), 'data-key': 'w-random', onclick: pick('random') },
    el('span', { class: 'big-icon', text: '🎲' }), el('span', { text: 'Random each match' }));
  return el('div', { class: 'tab-body' }, chips, el('div', { class: 'tile-grid' }, random), groups);
}

// ---------- skills tab ----------
function skillsTab(i, lo) {
  const human = !isCpuPicker(i), sk = lo.skills;
  const keyFor = s => human && BINDS[Math.min(i, 1)] ? keyLabel(BINDS[Math.min(i, 1)]['skill' + (s + 1)]) : '';
  const setSkills = (a, b) => { lo.skills = [a, b]; saveMenu(); uiSfx('click'); refreshScreen(); };
  const slots = el('div', { class: 'skill-slots' }, [0, 1].map(s => {
    const d = SKILLS[sk[s]];
    return el('div', { class: 'slot', style: d ? { '--sc': d.color } : null },
      el('small', { text: `Slot ${s + 1}` + (keyFor(s) ? ` · key ${keyFor(s)}` : '') }),
      el('strong', {}, el('b', { text: d ? d.icon : sk[s] === 'random' ? '🎲' : '–' }), d ? d.name : sk[s] === 'random' ? 'Random' : 'Empty'));
  }),
  el('div', { class: 'slot-actions' },
    el('button', { 'data-key': 'sk-random', onclick: () => setSkills('random', 'random') }, '🎲 Random'),
    el('button', { 'data-key': 'sk-clear', onclick: () => setSkills('none', 'none') }, 'Clear')));
  const toggle = key => {
    const at = sk.indexOf(key);
    if (at >= 0) { const next = sk.slice(); next[at] = 'none'; return setSkills(...next); }
    const free = sk.findIndex(k => !SKILLS[k]);
    if (free >= 0) { const next = sk.slice(); next[free] = key; return setSkills(...next); }
    setSkills(sk[1], key);                      // both full: the oldest pick makes way
  };
  // The tiles clamp descriptions to two lines; the info line shows the full text of the hovered or focused skill.
  const lastPick = SKILLS[sk[1]] || SKILLS[sk[0]];
  const info = el('p', { class: 'sk-info', 'aria-live': 'polite' });
  const showInfo = d => { info.replaceChildren(d ? el('b', { style: { color: d.color }, text: `${d.icon} ${d.name} · ${d.cd}s  ` }) : '', d ? d.desc : 'Hover or focus a skill to read all about it.'); };
  showInfo(lastPick);
  const grid = el('div', { class: 'skill-grid' }, listOf(SKILLS).map(s => {
    const slot = sk.indexOf(s.key);
    return el('button', { class: 'skill-tile' + (slot >= 0 ? ' sel' : ''), 'data-key': 'sk-' + s.key, style: { '--sc': s.color }, title: s.desc,
      onclick: () => toggle(s.key), onpointerenter: () => showInfo(s), onfocus: () => showInfo(s) },
      el('span', { class: 'sk-icon', text: s.icon }),
      el('span', { class: 'sk-text' }, el('strong', { text: s.name }), el('small', { text: s.desc })),
      el('span', { class: 'sk-cd', text: `${s.cd}s` }),
      slot >= 0 ? el('span', { class: 'sk-badge', text: String(slot + 1) }) : null);
  }));
  return el('div', { class: 'tab-body' }, el('p', { class: 'hint', text: 'Choose two skills. Click a chosen skill again to drop it.' }), slots, info, grid);
}

// ---------- style tab (colour + hat) ----------
function styleTab(i, lo) {
  const cpu = isCpuPicker(i);
  const swatches = COLOR_PACKS.map(p => {
    const owned = ownsPack(p.key);
    return el('div', { class: 'pack-row' + (owned ? '' : ' locked') },
      el('small', { text: p.name + (owned ? '' : ` · 🔒 ${p.price}`) }),
      el('div', { class: 'swatches' }, p.colors.map(c => el('button', {
        class: 'swatch' + (lo.color === c ? ' sel' : ''), style: { '--c': c }, 'data-key': 'col-' + c,
        'aria-label': owned ? `Colour ${c}` : `Locked: buy ${p.name} for ${p.price} coins`,
        onclick: () => owned ? (lo.color = c, saveMenu(), uiSfx('click'), refreshScreen()) : tryBuy('pack', p.key, () => { lo.color = c; saveMenu(); }),
      }, owned ? null : el('span', { text: LO.confirm === 'pack:' + p.key ? '?' : '🔒' })))));
  });
  const hats = listOf(HATS).map(h => hatTile(h, lo));
  if (cpu) hats.unshift(el('button', { class: 'tile hat-tile' + (lo.hat === 'random' ? ' sel' : ''), 'data-key': 'hat-random',
    onclick: () => { lo.hat = 'random'; saveMenu(); uiSfx('click'); refreshScreen(); } }, el('span', { class: 'big-icon', text: '🎲' }), el('span', { text: 'Random' })));
  return el('div', { class: 'tab-body' },
    el('h4', { text: 'Colour' }), el('div', { class: 'packs' }, swatches),
    el('h4', { text: 'Hat' }), el('div', { class: 'tile-grid hats' }, hats));
}

function hatTile(h, lo) {
  const owned = ownsHat(h.key), c = uiCanvas(84, 84), asking = LO.confirm === 'hat:' + h.key;
  drawHatIcon(c, h.key, lo.color);
  const onclick = () => owned ? (lo.hat = h.key, saveMenu(), uiSfx('click'), refreshScreen())
    : tryBuy('hat', h.key, () => { lo.hat = h.key; saveMenu(); });
  return el('button', { class: 'tile hat-tile' + (lo.hat === h.key ? ' sel' : '') + (owned ? '' : ' locked') + (asking ? ' asking' : ''), 'data-key': 'hat-' + h.key, onclick },
    c, el('span', { text: h.name }),
    owned ? null : el('em', { class: 'price', text: asking ? `Buy · ${h.price}` : `🔒 ${h.price}` }));
}

// Buying from a tile takes two clicks: the first asks, the second pays. Not enough coins: a hint toast.
function tryBuy(kind, key, then) {
  const item = kind === 'hat' ? HATS[key] : COLOR_PACKS.find(p => p.key === key), id = kind + ':' + key;
  if (!item) return;
  if (PROFILE.coins < item.price) {
    uiSfx('deny');
    toast('Not enough coins', `${item.name} costs ${item.price}. You have ${PROFILE.coins}. Win matches to earn more!`, '🪙', '#ff8a2e');
    return;
  }
  if (LO.confirm !== id) { LO.confirm = id; uiSfx('click'); refreshScreen(); return; }
  LO.confirm = null;
  if (buyItem(kind, key)) {
    uiSfx('coin');
    toast('Unlocked: ' + item.name, `−${item.price} coins`, kind === 'hat' ? '🎩' : '🎨', '#5dff9a');
    if (then) then();
  }
  refreshScreen();
}
