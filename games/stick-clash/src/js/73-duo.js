// 73-duo.js (v4): 2 players: names, records per pair (+ handicap), round length, quick rematch, the 2-player setup panel.
// A cfg without roundLen/handicap/silly plays as before. pairs[key]: { n, w, last: 10 winners 'a'|'b'|'d', streak, total, wave }.
const DUO_HCAP_STEP = 5, DUO_HCAP_MAX = 30;  // % health per win of lead (last 10), cap
const ROUND_LENS = { short: .7, normal: 1, long: 1.6 };  // × health and × round time
const ROUND_LEN_OFF = new Set(['campaign', 'challenge', 'ranked', 'training']);
const duoBlank = () => ({ w: [0, 0], last: '', streak: [-1, 0], total: 0, wave: 0 });
const DUO = duoLoad();

function duoLoad() {
  const s = store.getObj('duo'), n = Array.isArray(s.names) ? s.names : [], pairs = {};
  for (const [k, r] of Object.entries(s.pairs && typeof s.pairs === 'object' ? s.pairs : {})) { const rec = duoRepair(r); if (rec) pairs[k] = rec; }
  return { names: [0, 1].map(i => (typeof n[i] === 'string' ? n[i] : '').slice(0, 12)), hcap: s.hcap !== false, silly: s.silly === 'off' ? 'off' : 'vote', told: !!s.told, pairs };
}
// A saved pair, checked so a damaged save can't break the menus: bad counts reset, no two names = dropped (null).
function duoRepair(r) {
  if (!r || !Array.isArray(r.n) || r.n.length !== 2 || !r.n.every(x => typeof x === 'string' && x.trim())) return null;
  const num = x => Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0, w = [0, 1].map(i => num(Array.isArray(r.w) ? r.w[i] : 0));
  const streak = Array.isArray(r.streak) && [-1, 0, 1].includes(r.streak[0]) ? [r.streak[0], num(r.streak[1])] : [-1, 0];
  return { n: r.n.slice(), w, last: typeof r.last === 'string' ? r.last.replace(/[^abd]/g, '').slice(-10) : '', streak,
    total: Math.max(num(r.total), w[0] + w[1]), wave: num(r.wave) };
}
const duoSave = () => store.set('duo', DUO);
const duoName = i => DUO.names[i].trim() || `Player ${i + 1}`;
const duoNames = cfg => [0, 1].map(i => (cfg.names || [])[i] || duoName(i));
const duoLow = s => String(s).trim().toLowerCase();
function duoRec(a, b, create) {
  const n = [a, b].sort((x, y) => duoLow(x) < duoLow(y) ? -1 : 1), k = n.map(duoLow).join('|');
  if (create && !DUO.pairs[k]) DUO.pairs[k] = Object.assign(duoBlank(), { n });
  return DUO.pairs[k] || null;
}
const duoSide = (rec, name) => duoLow(rec.n[0]) === duoLow(name) ? 0 : 1;
function duoPair() {  // only duels with a 2-player setup (duo: 'versus'), not lobby party modes
  const R = G_STATE.roster || [], p = [0, 1].map(s => R.find(r => r.ctrl === 'human' && r.slot === s));
  if (G_STATE.demo || (G_STATE.mode || {}).duo !== 'versus' || !p[0] || !p[1] || p[0].team === p[1].team || R.some(r => r.ctrl !== 'human' || r.slot > 1)) return null;
  return duoLow(p[0].name) === duoLow(p[1].name) ? null : p.map(r => String(r.name));
}
function duoSettle() {  // once; the results card asks before matchOver
  const info = G_STATE.info || {}, pair = G_STATE.state === 'over' && !G_STATE.cfg.autopilot && duoPair();
  if ('duoRec' in info || !pair) return info.duoRec || null;
  const rec = duoRec(...pair, true), sc = G_STATE.score, top = Math.max(...sc), win = G_STATE.roster.find(r => r.team === sc.indexOf(top));
  const side = sc.filter(s => s === top).length > 1 || !win ? -1 : duoSide(rec, pair[win.slot]);
  for (const n of pair) rec.n[duoSide(rec, n)] = n;  // spelt as last typed
  rec.total++;
  if (side >= 0) rec.w[side]++;
  rec.streak = side < 0 ? [-1, 0] : [side, rec.streak[0] === side ? rec.streak[1] + 1 : 1];
  rec.last = (rec.last + (side < 0 ? 'd' : 'ab'[side])).slice(-10);
  duoSave();
  return (info.duoRec = rec);
}
on('matchOver', duoSettle);
function duoLine(rec, a, b) {
  const [s, n] = rec.streak, w = x => rec.w[duoSide(rec, x)];
  return `${a} ${w(a)} – ${w(b)} ${b}` + (n > 1 ? ` · ${rec.n[s]} on a ${n}-win streak` : '');
}
const duoDots = (rec, cols) => el('span', { class: 'duo-dots' },  // the last results, cols by rec side
  [...rec.last].map(c => el('i', { style: c === 'd' ? null : { background: cols[c === 'a' ? 0 : 1] } })));

function duoHandicap(rec) {
  const won = c => rec ? rec.last.split(c).length - 1 : 0, a = won('a'), b = won('b'), pct = Math.min(DUO_HCAP_MAX, DUO_HCAP_STEP * Math.abs(a - b));
  return pct ? { name: rec.n[a > b ? 0 : 1], pct, won: Math.max(a, b), of: rec.last.length } : null;
}
function duoMatchHcap() {  // this match's (when its cfg asks), worked out once
  const info = G_STATE.info || {}, pair = G_STATE.cfg.handicap && duoPair(), h = pair && duoHandicap(duoRec(...pair));
  if (!('duoHcap' in info)) info.duoHcap = h && Object.assign(h, { slot: pair.findIndex(n => duoLow(n) === duoLow(h.name)) });
  return info.duoHcap;
}

const roundLenPick = mode => (MENU.roundLen || {})[mode.key] || (mode.customRounds ? 'short' : 'normal');   // party modes: Short
const roundLenMul = (cfg = G_STATE.cfg, mode = G_STATE.mode) => !cfg || cfg.demo || !mode || ROUND_LEN_OFF.has(mode.key) ? 1 : ROUND_LENS[cfg.roundLen] || 1;
// 95 menuCfg: handicap and silly rules only where the setup panel offers them
const duoMenuCfg = mode => Object.assign({ roundLen: roundLenPick(mode) }, mode.duo === 'versus' ? { handicap: DUO.hcap, silly: DUO.silly } : null);
// Round length and handicap health, once per fighter; health carried over (run.hp) stays, as in 75 matchHpMul.
function duoHpApply(f) {
  if (f.summon || f.duoHpDone) return;
  const h = duoMatchHcap(), r = G_STATE.roster[f.id] || {};
  f.duoHpDone = true;
  f.hcap = h && r.ctrl === 'human' && r.slot === h.slot ? h.pct : 0;
  const k = ('hp' in modeRun() ? 1 : roundLenMul()) * (1 - f.hcap / 100), frac = f.hp / f.maxHp;
  if (k !== 1) { f.maxHp = Math.round(f.maxHp * k); f.hp = f.hpShow = Math.max(1, Math.round(f.maxHp * frac)); }
}
on('roundStart', () => F.forEach(duoHpApply));
on('matchStart', cfg => {  // explained the first time, after 94's controls card (not behind its scrim)
  const h = duoMatchHcap();
  if (!h || DUO.told || cfg.autopilot) return;
  DUO.told = true; duoSave();
  cardAfter(() => toast(`Handicap: ${h.name} −${h.pct}% health`, `${h.name} won ${h.won} of your last ${h.of}; it eases as you even up`, '⚖', '#ff8a2e'), cfg);
});
function duoBadge(f, x, y, dir) {  // HUD card tag (85 drawCard)
  const t = `♥ −${f.hcap}%`;
  ctx.font = `700 11px ${FONT_BODY}`;
  const w = ctx.measureText(t).width + 10, x0 = dir > 0 ? x : x - w;
  ctx.fillStyle = '#ff8a2e'; ctx.fillRect(x0, y - 8, w, 16);
  ctx.fillStyle = '#1a0d00'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x0 + w / 2, y + .5);
}

// Quick rematch: same mode, arena, rules and players; everyone on a weapon not just used.
const quickRematchOk = () => G_STATE.state === 'over' && !G_STATE.mode.quest && modePickers(G_STATE.mode) > 0;
function quickRematch() {
  const used = new Set(G_STATE.roster.concat(...(modeRun().tag || [])).map(r => r.weapon)), cfg = Object.assign({}, G_STATE.cfg);
  cfg.loadouts = (cfg.loadouts || []).map(lo => Object.assign({}, lo, { weapon: randomKey(WEAPONS, w => !used.has(w.key)) || 'random' }));
  uiSfx('fight');
  startMatch(cfg);
}
const quickRematchButton = () => quickRematchOk() ? uiButton('Rematch · new weapons', quickRematch, 'quick-rm', { title: 'R · pad Start' }) : null;
const quickArmed = () => quickRematchOk() && performance.now() >= UI_PAD.armAt;  // R / Start: nothing held from the fight
addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat && !typingIn(e.target) && quickArmed()) { e.preventDefault(); quickRematch(); } });
on('pad', a => { if (a === 'pause' && quickArmed()) quickRematch(); });

function duoPanel(mode) {
  const vs = mode.duo === 'versus', cols = [0, 1].map(i => menuLoadout(i).color), names = [0, 1].map(duoName), rec = duoRec(...names);
  const input = i => el('input', { class: 'duo-name', maxlength: 12, value: DUO.names[i], placeholder: `Player ${i + 1}`, 'aria-label': `Player ${i + 1} name`,
    'data-key': 'duo-name-' + i, style: { '--pc': cols[i] }, onchange: refreshScreen,
    oninput: e => { DUO.names[i] = e.target.value; duoSave(); }, onkeydown: e => { if (e.key === 'Enter') moveFocus([0, 1]); } });
  const h = vs && DUO.hcap && duoHandicap(rec), text = !vs ? (rec && rec.wave ? `Co-op best: ${rec.wave} waves` : 'Team up!')
    : rec && rec.total ? duoLine(rec, ...names) : `First match: ${names[0]} vs ${names[1]}`;
  return el('section', { class: 'duo-panel' }, el('div', { class: 'duo-names' }, input(0), vs ? 'VS' : '&', input(1)),
    el('p', { class: 'duo-rec' }, text, vs && rec ? duoDots(rec, rec.n.map(n => cols[+(duoLow(n) !== duoLow(names[0]))])) : null),
    vs ? el('div', { class: 'duo-opts' },
      toggleField('Handicap', DUO.hcap, v => { DUO.hcap = v; duoSave(); }, h ? `${h.name} starts with −${h.pct}% health.` : 'Whoever wins more starts with less health.'),
      segField('Silly rules', [['off', 'Off'], ['vote', 'Vote']], DUO.silly, v => { DUO.silly = v; duoSave(); })) : null);
}
function duoResultsLine() {  // 97 buildResults: a failing record must not keep the card from showing
  try {
    const rec = duoSettle(), pair = duoPair();
    return rec && pair ? el('p', { class: 'duo-res', text: 'Head-to-head: ' + duoLine(rec, ...pair) }) : null;
  } catch (e) { report(e, 'duo results'); return null; }
}
function duoRivalsTab() {  // Trophies & Stats → Rivals (97)
  const list = Object.values(DUO.pairs).sort((a, b) => b.total - a.total || b.wave - a.wave);
  return list.length ? el('div', { class: 'duo-rivals' }, list.map(r => { const [score, ...more] = duoLine(r, ...r.n).split(' · ');
    return el('div', { class: 'stat-tile', tabindex: '0' }, el('b', { text: score }), el('span', { text: [`${r.total} matches`, ...more, r.wave && `co-op best ${r.wave} waves`].filter(Boolean).join(' · ') })); }))
    : el('p', { class: 'hint', text: 'Name both players on the 2-player setup and fight!' });
}
on('boot', () => {
  const build = SCREENS.maps;
  SCREENS.maps = () => {
    const node = build(), mode = MODES[MENU.mode] || {}, body = node.querySelector('.sheet-body'), quick = node.querySelector('.quick-set');
    if (mode.duo && body) body.prepend(duoPanel(mode));
    if (quick && !ROUND_LEN_OFF.has(mode.key)) quick.insertBefore(segField('Round length', [['short', 'Short'], ['normal', 'Normal'], ['long', 'Long']], roundLenPick(mode),
      v => { MENU.roundLen = Object.assign({}, MENU.roundLen, { [mode.key]: v }); saveMenu(); }), quick.children[1] || null);
    return node;
  };
});
