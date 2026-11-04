// Smoke tests for the v6 two-player meta modes (74c Clash Cup, 74d Draft Duel, 74e Party Night), all seeded:
// - menus: the three modes in the mode list (icon, description), their arena-screen options and menu cfg, How to Play;
// - Clash Cup: 4 fighters driven by both players' keys, P1 knocked out, P2 champion (confetti, bracket on the results);
//   the Rivalry Match counted once in the head-to-head record; 8 fighters with both players out, CPU ties by quick
//   result and one watched then skipped; pause on the bracket; R for a quick rematch; an autopilot cup to the end;
// - Draft Duel: all 12 picks by keyboard (P1 and P2 keys, snake order, a press out of turn ignored), the kits on the
//   fighters and a new weapon each round, results, Rematch drafts again; a CPU in Player 2's seat;
// - Party Night: 3 events by keys and clicks to the podium (3/1 points, the final doubled, counted once in the record),
//   an autopilot night, silly twists, v6 mini-game and mode keys joining the pool, quitting ends the night.
// Screenshots (tmp/smoke/v6m-*.png) at 1920x1080 and 1536x864 at 125%. Called by tools/smoke.cjs; also runs alone
// (`node tools/smoke-v6-meta.cjs`, after `node build.mjs`).
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'dist', 'stick-clash.html');

async function open(browser, w = 1280, h = 720, dpr = 1) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto(URL);
  await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
  await page.evaluate(HELPERS);
  return { ctx, page, errors };
}

// Page-side helpers: a seeded Math.random, named players, a round won by a team, the screen shown.
const HELPERS = `
window.__M = {
  seed(n) { let s = n * 7919; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  names() { DUO.names = ['Finn', 'Dad']; DUO.pairs = {}; duoSave(); CTL.schemes.fill('advanced'); },   // a fresh save is Simple (one skill in play)
  team(slot) { const f = SC.F.find(f => f.ctrl === 'human' && f.slot === slot); return f ? f.team : -1; },
  // Team t takes the round: everyone else K.O.'d, then the K.O. delay runs out.
  win(t) { SC.G.lock = 0; const by = SC.F.find(f => f.team === t);
    for (const f of SC.F) if (f.team !== t && f.alive && !f.summon) { f.inv = 0; damage(f, 9999, { src: by, kind: 'melee' }); }
    SC.sim(TUNE.koDelay + .3); },
  tie(t) { const cup = modeRun().cup, tie = cupNext(cup); for (let k = 0; k < 5 && cupNext(cup) === tie && SC.G.state === 'play'; k++) __M.win(t); return tie; },
  shown() { const m = document.querySelector('.meta'); return !!m && !m.hidden && metaLive(); },
  text(sel) { const e = document.querySelector(sel); return e ? e.textContent : ''; },
};`;
const live = page => page.waitForFunction(() => __M.shown(), null, { timeout: 6000 }).then(() => page.waitForTimeout(520), () => {});   // + META_ARM
const press = async (page, ...keys) => { for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(60); } };

async function testMenus(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  const r = await page.evaluate(() => {
    openScreen('modes', 'menu');
    const cards = Object.fromEntries(['cup', 'draft', 'night'].map(k => { const c = document.querySelector(`#modes [data-key="mode-${k}"]`);
      return [k, c ? c.querySelector('.mode-icon').textContent + ' ' + c.querySelector('strong').textContent + ' · ' + c.querySelector('p').textContent.length : null]; }));
    const opts = {}, cfg = {};
    for (const k of ['cup', 'draft', 'night']) {
      MENU.mode = k; openScreen('maps', 'modes');
      const node = PANELS.maps;
      opts[k] = { opts: [...node.querySelectorAll('.meta-opts .lbl')].map(e => e.textContent).join(','), duo: !!node.querySelector('.duo-panel'),
        hcap: /Handicap/.test(node.textContent), twists: !!node.querySelector('[data-key="Silly rules-vote"]') && node.querySelector('[data-key="Silly rules-vote"]').textContent };
      const c = menuCfg(); cfg[k] = { cupSize: c.cupSize, draftP2: c.draftP2, nightLen: c.nightLen, loadouts: c.loadouts.length };
    }
    openScreen('howto', 'menu');
    const help = [...document.querySelectorAll('#howto .help-card h3')].map(e => e.textContent).filter(t => /Clash Cup|Draft Duel|Party Night/.test(t));
    MENU.mode = 'versus'; toMenu();
    return { cards, opts, cfg, help, hidden: !document.querySelector('#modes [data-key="mode-nightmini"]') };
  });
  const ok = check(Object.values(r.cards).every(Boolean) && r.hidden, `v6 meta menus: mode cards ${JSON.stringify(r.cards)}`)
    & check(r.opts.cup.opts === 'Bracket' && r.opts.draft.opts === 'Player 2' && r.opts.night.opts === 'Events' && r.opts.cup.duo && r.opts.cup.hcap
      && !r.opts.night.hcap && r.opts.night.twists === 'Twists', `v6 meta menus: arena options ${JSON.stringify(r.opts)}`)
    & check(r.cfg.cup.cupSize === 8 && r.cfg.cup.loadouts === 2 && r.cfg.draft.draftP2 === 'human' && r.cfg.draft.loadouts === 2 && r.cfg.night.nightLen === 8 && r.cfg.night.loadouts === 2,
      `v6 meta menus: menu cfg ${JSON.stringify(r.cfg)}`)
    & check(r.help.length === 3, `v6 meta menus: How to Play cards ${r.help}`) & check(!errors.length, 'v6 meta menus errors: ' + errors.join(' | '));
  rows.push({ kind: 'v6-meta', key: 'menus', ok: !!ok, note: Object.values(r.cards).join(' / ') });
  await ctx.close();
}

// Clash Cup, 4 fighters: the bracket by both players' keys, P1 knocked out in the semifinal, P2 champion.
async function testCup4(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  await page.evaluate(() => { __M.seed(11); __M.names(); SC.start({ mode: 'cup', cupSize: 4, map: 'dojo', killcam: false }); });
  await live(page);
  const s0 = await page.evaluate(() => ({ shown: __M.shown(), rows: document.querySelectorAll('.meta .cup-e').length, p1: __M.text('.meta .cup-e.hum'),
    next: __M.text('.meta .cup-next'), btn: __M.text('.meta .meta-btns'), frozen: SC.G.override === metaHold }));
  await press(page, 'Escape');
  const paused = await page.evaluate(() => ({ state: SC.G.state, hidden: document.querySelector('.meta').hidden }));
  await press(page, 'Escape'); await live(page);
  await press(page, 'KeyS');                                    // P1's attack: Fight!
  const s1 = await page.evaluate(() => ({ phase: modeRun().cup.phase, held: !!SC.G.override, roster: SC.G.roster.map(r => r.name).join(' v ') }));
  const lost = await page.evaluate(() => { const t = __M.tie(1 - __M.team(0)); return { w: t.w, sc: t.sc.join('-'), phase: modeRun().cup.phase }; });
  await live(page);
  const s2 = await page.evaluate(() => ({ out: __M.text('.meta .cup-e.hum.out'), next: __M.text('.meta .cup-next'), solo: cupSoloP2(), pad: padSlot({ index: 0 }, 0, true),
    strip: [stripSlot(0), stripSlot(1)] }));
  await press(page, 'ArrowDown');                               // P2's attack: Fight!
  const s3 = await page.evaluate(() => { const before = SC.F.find(f => f.slot === 1 && f.ctrl === 'human');
    return { phase: modeRun().cup.phase, p2: !!before, solo: cupSoloP2() }; });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250);
  const moved = await page.evaluate(() => SC.F.find(f => f.slot === 1 && f.ctrl === 'human').inp.mx);
  await page.keyboard.up('ArrowRight');
  await page.evaluate(() => __M.tie(__M.team(1)));
  await live(page);
  await press(page, 'Enter');                                   // P2's dash works as OK too: the final
  await page.evaluate(() => __M.tie(__M.team(1)));
  await page.waitForTimeout(400);
  const end = await page.evaluate(() => ({ state: SC.G.state, title: __M.text('#over h2'), res: SC.G.result, bracket: document.querySelectorAll('#over .cup-res .cup-m').length,
    champ: __M.text('#over .cup-champ'), confetti: document.querySelectorAll('#over .meta-confetti i').length, rec: duoRec('Finn', 'Dad') }));
  await page.waitForTimeout(1400);
  await press(page, 'KeyR');                                    // quick rematch: a new cup, new weapons
  await page.waitForTimeout(300);
  const again = await page.evaluate(() => ({ mode: SC.G.mode.key, state: SC.G.state, fresh: !modeRun().cup.rounds.flat().some(t => t.w >= 0) }));
  const ok = check(s0.shown && s0.rows === 6 && /Finn/.test(s0.p1) && /Fight/.test(s0.btn) && s0.frozen, `v6 cup4: bracket ${JSON.stringify(s0)}`)
    & check(paused.state === 'paused' && paused.hidden, `v6 cup4: pause ${JSON.stringify(paused)}`)
    & check(s1.phase === 'fight' && !s1.held && /Finn/.test(s1.roster), `v6 cup4: fight ${JSON.stringify(s1)}`)
    & check(lost.w === 3 && lost.sc === '0-2' && lost.phase === 'bracket', `v6 cup4: P1 knocked out ${JSON.stringify(lost)}`)
    & check(/Finn/.test(s2.out) && /Dad/.test(s2.next) && s2.solo && s2.pad === 1 && s2.strip[0] === -1, `v6 cup4: P2's tie ${JSON.stringify(s2)}`)
    & check(s3.phase === 'fight' && s3.p2 && moved === 1, `v6 cup4: P2 plays alone on own keys ${JSON.stringify(s3)} mx ${moved}`)
    & check(end.state === 'over' && /Dad wins the cup/.test(end.title) && end.res.won === true && end.bracket === 3 && /Dad/.test(end.champ) && end.confetti > 0 && !end.rec,
      `v6 cup4: champion ${JSON.stringify(end)}`)
    & check(again.mode === 'cup' && again.state === 'play' && again.fresh, `v6 cup4: quick rematch ${JSON.stringify(again)}`)
    & check(!errors.length, 'v6 cup4 errors: ' + errors.join(' | '));
  rows.push({ kind: 'v6-meta', key: 'cup 4: P1 out, P2 champion', ok: !!ok, note: end.title });
  await ctx.close();
}

// The Rivalry Match: both players through, the final counts once in their record.
async function testRivalry(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  await page.evaluate(() => { __M.seed(12); __M.names(); SC.start({ mode: 'cup', cupSize: 4, map: 'dojo', killcam: false }); });
  for (const [key, slot] of [['KeyS', 0], ['ArrowDown', 1]]) { await live(page); await press(page, key); await page.evaluate(s => __M.tie(__M.team(s)), slot); }
  await live(page);
  const riv = await page.evaluate(() => ({ next: __M.text('.meta .cup-next'), box: !!document.querySelector('.meta .cup-m.riv.next') }));
  await press(page, 'KeyW');                                    // P1's jump works as OK too
  const banner = await page.evaluate(() => BANNER && BANNER.a);
  await page.evaluate(() => __M.tie(__M.team(0)));
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => { emit('matchOver', SC.G.result); duoSettle();   // asked again: still once
    const rec = duoRec('Finn', 'Dad'); return { title: __M.text('#over h2'), line: __M.text('#over .duo-res'), total: rec && rec.total, w: rec && rec.w.join('-') }; });
  const ok = check(/Rivalry match · Final/.test(riv.next) && riv.box && banner === 'RIVALRY MATCH', `v6 rivalry: billed ${JSON.stringify(riv)} ${banner}`)
    & check(/Finn wins the cup/.test(r.title) && r.total === 1 && /Head-to-head: Finn 1 – 0 Dad/.test(r.line), `v6 rivalry: record ${JSON.stringify(r)}`)
    & check(!errors.length, 'v6 rivalry errors: ' + errors.join(' | '));
  rows.push({ kind: 'v6-meta', key: 'cup: rivalry match counted', ok: !!ok, note: r.line });
  await ctx.close();
}

// Clash Cup, 8 fighters: both players out, CPU ties by quick result, one watched and skipped, a CPU champion.
async function testCup8(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  await page.evaluate(() => { __M.seed(13); __M.names(); SC.start({ mode: 'cup', cupSize: 8, map: 'dojo', killcam: false }); });
  const log = [];
  let watched = null;
  for (let step = 0; step < 12; step++) {
    if (await page.evaluate(() => SC.G.state === 'over')) break;
    await live(page);
    const st = await page.evaluate(() => { const cup = modeRun().cup, t = cupNext(cup); return t && { humans: [t.a, t.b].filter(i => cup.ent[i].ctrl === 'human').map(i => cup.ent[i].slot),
      stage: cupStage(cup, t), btns: cupButtons(cup).map(b => b[0]).join() }; });
    if (!st) break;
    log.push(st.stage + ':' + (st.humans.join('') || 'cpu'));
    if (st.humans.length) {                                     // players: P1 wins the quarterfinal then loses, P2 loses at once
      await press(page, st.humans[0] ? 'ArrowDown' : 'KeyS');
      await page.evaluate(s => __M.tie(s === 0 && cupStage(modeRun().cup, cupNext(modeRun().cup)) === 'Quarterfinal' ? __M.team(0) : 1 - __M.team(s)), st.humans[0]);
    } else if (!watched) {                                      // the first CPU tie: Watch it, then skip with an attack key
      await press(page, 'KeyD', 'KeyS');
      await page.waitForTimeout(700);
      watched = await page.evaluate(() => ({ phase: modeRun().cup.phase, cpus: SC.F.every(f => f.ctrl === 'cpu'), hud: !!document.querySelector('.meta:not([hidden])') }));
      await page.evaluate(() => SC.sim(1.5));
      await press(page, 'ArrowDown');
      watched.after = await page.evaluate(() => { const t = modeRun().cup.rounds.flat().find(x => x.how === 'watch'); return { decided: !!t, phase: modeRun().cup.phase }; });
    } else await press(page, 'KeyS');                           // Quick result
  }
  await page.waitForTimeout(400);
  const end = await page.evaluate(() => { const cup = modeRun().cup; return { state: SC.G.state, title: __M.text('#over h2'), won: SC.G.result && SC.G.result.won,
    decided: cup.rounds.flat().filter(t => t.w >= 0).length, quick: cup.rounds.flat().filter(t => t.how === 'sim').length, outs: document.querySelectorAll('#over .cup-e.hum.out').length }; });
  const ok = check(watched && watched.phase === 'watch' && watched.cpus && !watched.hud && watched.after.decided && watched.after.phase === 'bracket', `v6 cup8: watch + skip ${JSON.stringify(watched)}`)
    & check(end.state === 'over' && end.decided === 7 && end.quick >= 3 && end.won === false && end.outs === 2 && /wins the cup/.test(end.title), `v6 cup8: end ${JSON.stringify(end)} ${log.join(' ')}`)
    & check(!errors.length, 'v6 cup8 errors: ' + errors.join(' | '));
  rows.push({ kind: 'v6-meta', key: 'cup 8: both out, watched + quick ties', ok: !!ok, note: log.join(' ') });
  // An autopilot cup runs to its champion headless.
  const auto = await page.evaluate(() => { __M.seed(14); const e0 = SC.errors.length; SC.start({ mode: 'cup', cupSize: 8, autopilot: true, map: 'dojo' });
    for (let t = 0; t < 900 && SC.G.state !== 'over'; t++) SC.sim(1);
    return { state: SC.G.state, decided: modeRun().cup.rounds.flat().filter(t => t.w >= 0).length, errors: SC.errors.slice(e0).map(e => e.msg) }; });
  check(auto.state === 'over' && auto.decided === 7 && !auto.errors.length, `v6 cup8: autopilot ${JSON.stringify(auto)}`);
  await ctx.close();
}

// Draft Duel: every pick by keyboard, the kits on the fighters, a new weapon each round, Rematch drafts again.
async function testDraft(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  await page.evaluate(() => { __M.seed(21); __M.names(); SC.start({ mode: 'draft', map: 'dojo', killcam: false }); });
  await live(page);
  const keys = [{ move: 'KeyD', ok: 'KeyS' }, { move: 'ArrowLeft', ok: 'ArrowDown' }];
  await press(page, 'ArrowDown');                               // P2 out of turn: ignored
  const early = await page.evaluate(() => modeRun().draft.i);
  await press(page, 'KeyD', 'KeyS');                            // P1: second card
  const first = await page.evaluate(() => { const d = modeRun().draft; return { took: d.kits[0].w[0] === d.pool.w[1], turn: draftTurn(d), cur: d.cur.join() }; });
  for (let n = 1; n < 12; n++) {
    const s = await page.evaluate(() => draftTurn(modeRun().draft));
    await press(page, keys[s].move, keys[s].ok);
  }
  const done = await page.evaluate(() => { const d = modeRun().draft; return { i: d.i, kits: d.kits.map(k => [k.w.length, k.s.length, k.c.length].join('')),
    uniq: new Set(d.kits.flatMap(k => k.w)).size === 6, shot: __M.text('.meta .dr-turn') }; });
  await page.waitForFunction(() => modeRun().drafted && !SC.G.override, null, { timeout: 5000 }).catch(() => {});
  const r1 = await page.evaluate(() => { const d = modeRun().draft;
    return SC.F.map((f, s) => f.wkey === d.kits[s].w[0] && f.skills.join() === d.kits[s].s.join() && f.clsKey === d.kits[s].c[0]); });
  const rounds = await page.evaluate(() => { const d = modeRun().draft, out = [];
    for (const t of [0, 1, 0]) { out.push(SC.F.map((f, s) => f.wkey === d.kits[s].w[SC.G.round - 1]).every(Boolean)); __M.win(t); }
    return { out, state: SC.G.state, title: __M.text('#over h2'), lines: __M.text('#over .results-lines'), total: (duoRec('Finn', 'Dad') || {}).total }; });
  await page.waitForTimeout(300);
  await page.click('#over .go');                                // Rematch: a new draft
  await live(page);
  const again = await page.evaluate(() => ({ i: modeRun().draft.i, drafted: modeRun().drafted, shown: __M.shown() }));
  const ok = check(early === 0 && first.took && first.turn === 1, `v6 draft: first picks ${early} ${JSON.stringify(first)}`)
    & check(done.i === 12 && done.kits.join() === '321,321' && done.uniq && /Fight/.test(done.shot), `v6 draft: picks ${JSON.stringify(done)}`)
    & check(r1.every(Boolean), `v6 draft: kits on the fighters ${r1}`)
    & check(rounds.out.every(Boolean) && rounds.state === 'over' && /Finn wins the draft/.test(rounds.title) && /→/.test(rounds.lines) && rounds.total === 1,
      `v6 draft: rounds ${JSON.stringify(rounds)}`)
    & check(again.i === 0 && !again.drafted && again.shown, `v6 draft: rematch drafts again ${JSON.stringify(again)}`);
  // A CPU in Player 2's seat drafts by itself (P1 still by keys).
  await page.evaluate(() => { __M.seed(22); SC.start({ mode: 'draft', map: 'dojo', killcam: false, draftP2: 'cpu' }); });
  await live(page);
  for (let n = 0; n < 40; n++) {
    const st = await page.evaluate(() => { const d = modeRun().draft; return { i: d.i, turn: draftTurn(d) }; });
    if (st.i >= 12) break;
    if (st.turn === 0) await press(page, 'ArrowRight', 'KeyS');  // one human: both key sets drive P1
    else await page.evaluate(() => SC.sim(1));
  }
  const cpu = await page.evaluate(() => { const d = modeRun().draft; return { i: d.i, kits: d.kits.map(k => k.w.length + k.s.length + k.c.length).join(), name: SC.G.roster[1].name, ctrl: SC.G.roster[1].ctrl }; });
  check(cpu.i === 12 && cpu.kits === '6,6' && cpu.ctrl === 'cpu', `v6 draft: CPU seat ${JSON.stringify(cpu)}`);
  check(!errors.length, 'v6 draft errors: ' + errors.join(' | '));
  rows.push({ kind: 'v6-meta', key: 'draft: 12 picks by keys, kits, rematch, CPU seat', ok: !!ok && cpu.i === 12, note: rounds.title });
  await ctx.close();
}

// Party Night: 3 events by keys and clicks to the podium; points 3/1 with the final doubled; the record once.
async function testNight(browser, { check, rows }) {
  const { ctx, page, errors } = await open(browser);
  await page.evaluate(() => { __M.seed(31); __M.names(); SC.start({ mode: 'night', nightLen: 3, map: 'dojo', killcam: false }); });
  await live(page);
  const intro = await page.evaluate(() => ({ events: document.querySelectorAll('.meta .night-list li').length, x2: !!document.querySelector('.meta .night-list li.x2:last-child'),
    first: NIGHT.list[0].kind, last: NIGHT.list[2].kind }));
  await press(page, 'ArrowDown');                               // either player starts
  const winners = [0, 1, 0], log = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(k => SC.G.cfg.night && NIGHT.i === k && SC.G.state === 'play', i, { timeout: 5000 }).catch(() => {});
    log.push(await page.evaluate(w => {   // the event ends with player w's side on top
      const g = SC.G, key = g.mode.key, R = g.roster, me = R.findIndex(r => r.ctrl === 'human' && r.slot === w), humans = R.filter(r => r.ctrl === 'human').length;
      if (key === 'nightmini') modeRun().win = me; else if (key === 'juggernaut') { for (const f of SC.F) modeRun().pts[f.id] = f.id === me ? 5 : 0; }
      else g.score = g.score.map((s, t) => t === R[me].team ? 9 : 0);
      endMatch();
      return `${key}:${humans}`;
    }, winners[i]));
    await page.waitForTimeout(250);
    if (i < 2) {
      const card = await page.evaluate(() => ({ h2: __M.text('#over h2'), pts: NIGHT.pts.join('-'), next: __M.text('#over .night-next') }));
      log.push(card.h2 + ' ' + card.pts);
      await page.click('#over .go');                            // Next event
    }
  }
  const pod = await page.evaluate(() => ({ title: __M.text('#over h2'), podium: document.querySelectorAll('#over .night-step').length, pts: NIGHT.pts.join('-'),
    gains: NIGHT.log.map(l => l.gain.join('/')).join(' '), done: NIGHT.done, total: duoRec('Finn', 'Dad').total, lines: __M.text('#over .results-lines'),
    confetti: document.querySelectorAll('#over .meta-confetti i').length }));
  await page.evaluate(() => quickRematch());                    // what R does on the podium: a new night
  await page.waitForTimeout(250);
  const again = await page.evaluate(() => ({ mode: SC.G.mode.key, i: NIGHT && NIGHT.i, list: NIGHT && NIGHT.list.length }));
  await page.evaluate(() => toMenu());
  const quit = await page.evaluate(() => NIGHT === null);
  const ok = check(intro.events === 3 && intro.x2 && intro.first === 'mode' && intro.last === 'mode', `v6 night: playlist ${JSON.stringify(intro)}`)
    & check(log.filter(l => /:\d$/.test(l)).every(l => l.endsWith(':2') || l.endsWith(':3') || l.endsWith(':4')), `v6 night: both players in every event ${log}`)
    & check(pod.done && pod.podium === 2 && pod.gains === '3/1 1/3 6/2' && pod.pts === '10-6' && /Finn wins Party Night/.test(pod.title) && pod.total === 1
      && /Head-to-head: Finn 1 – 0 Dad/.test(pod.lines) && pod.confetti > 0, `v6 night: podium ${JSON.stringify(pod)} ${log.join(' | ')}`)
    & check(again.mode === 'night' && again.i === -1 && again.list === 3 && quit, `v6 night: R + quit ${JSON.stringify(again)} ${quit}`);
  // An autopilot night of 3 runs to its podium headless; twists; v6 keys join the pool when they exist.
  const auto = await page.evaluate(() => { __M.seed(32); const e0 = SC.errors.length; SC.start({ mode: 'night', nightLen: 3, autopilot: true, map: 'random' });
    for (let t = 0; t < 1200 && !NIGHT.done; t++) { SC.sim(1); if (SC.G.state === 'over') nightPlay(NIGHT.i + 1); }   // what Next event does
    const sums = NIGHT.log.map((l, i) => l.gain[0] + l.gain[1] === (l.ev.x2 ? 2 : 1) * (l.res.slots.length ? 4 : 2));
    return { done: NIGHT.done, events: NIGHT.log.map(l => l.ev.key).join(), sums: sums.every(Boolean), over: SC.G.state, podium: !!document.querySelector('#over .night-podium'),
      errors: SC.errors.slice(e0).map(e => e.msg) }; });
  const more = await page.evaluate(() => {
    let tw = -1;
    for (let k = 33; k < 40 && tw < 0; k++) { __M.seed(k); SC.start({ mode: 'night', nightLen: 12, map: 'dojo', silly: 'vote', killcam: false }); tw = NIGHT.list.findIndex(e => e.twist); }
    nightPlay(tw);
    const twist = { want: NIGHT.list[tw].twist, on: SILLY_ON && SILLY_ON.key };
    // v6 keys: any mini-game joins; a v6 mode key (NIGHT_NEW) joins when defined. Stand-ins where they don't exist yet.
    const fake = NIGHT_NEW.find(k => !MODES[k] && !MINIS[k]);
    if (fake) defMode(fake, { name: 'Stand-in', desc: 'A v6 mode stand-in. First to 3.', crowd: [2, 4, 2], setup(cfg) { return { roster: partyFfaRoster(cfg, 2) }; } });
    defMini('v6test', { name: 'Stand-in mini', icon: '🏐', how: 'Keep it up.', start() {}, step() {} });
    const want = NIGHT_NEW.filter(k => MINIS[k] || (MODES[k] && !MODES[k].hidden)).concat('v6test'), seen = new Set();
    for (let k = 0; k < 30; k++) for (const e of nightPlaylist(12, false)) seen.add(e.key);
    const modeKey = NIGHT_NEW.find(k => MODES[k] && !MINIS[k] && !MODES[k].hidden);
    NIGHT.list[0] = nightEvent('mode', modeKey); nightPlay(0);
    const seated = SC.G.roster.filter(r => r.ctrl === 'human').map(r => r.slot).join(), mode = SC.G.mode.key;
    toMenu(); delete MINIS.v6test; if (fake) delete MODES[fake];
    return { twist, missing: want.filter(k => !seen.has(k)), seated, mode, modeKey };
  });
  check(auto.done && auto.sums && auto.over === 'over' && auto.podium && !auto.errors.length, `v6 night: autopilot ${JSON.stringify(auto)}`);
  check(more.twist.want === more.twist.on && !more.missing.length && more.seated === '0,1' && more.mode === more.modeKey, `v6 night: twists + v6 keys ${JSON.stringify(more)}`);
  check(!errors.length, 'v6 night errors: ' + errors.join(' | '));
  rows.push({ kind: 'v6-meta', key: 'night: 3 events to the podium', ok: !!ok && auto.done && !more.missing.length, note: `${pod.title} ${pod.pts}; auto ${auto.events}` });
  await ctx.close();
}

// Screens at 1920x1080 and 1536x864 at 125%: they fit on screen with nothing cut off.
async function shots(browser, { check, rows, SHOTS }) {
  const res = [];
  for (const [w, h, dpr] of [[1920, 1080, 1], [1536, 864, 1.25]]) {
    const { ctx, page, errors } = await open(browser, w, h, dpr), fit = [];
    const shot = async (name, sel) => {
      await page.waitForTimeout(450);
      fit.push(await page.evaluate(([n, s]) => { const e = document.querySelector(s), r = e && e.getBoundingClientRect();
        return r && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && e.scrollHeight <= e.clientHeight + 2 ? '' : n; }, [name, sel]));
      await page.screenshot({ path: path.join(SHOTS, `v6m-${name}-${w}.png`) });
    };
    await page.evaluate(() => { __M.seed(41); __M.names(); SC.start({ mode: 'cup', cupSize: 8, map: 'dojo', killcam: false }); });
    await live(page);
    await page.evaluate(() => { const cup = modeRun().cup; cupDecide(cup, cupNext(cup), [2, 1], 'fight'); cupAfter(cup); });
    await shot('cup-bracket', '.meta .meta-card');
    await page.evaluate(() => { const cup = modeRun().cup; while (cupNext(cup)) cupDecide(cup, cupNext(cup), cupSimTie(cup, cupNext(cup)), 'sim'); cupAfter(cup); });
    await shot('cup-results', '#over .results-card');
    await page.evaluate(() => SC.start({ mode: 'draft', map: 'dojo', killcam: false }));
    await live(page);
    await press(page, 'KeyD', 'KeyS', 'ArrowLeft', 'ArrowDown', 'ArrowDown', 'KeyD');
    await shot('draft', '.meta .meta-card');
    await page.evaluate(() => SC.start({ mode: 'night', nightLen: 8, map: 'dojo', killcam: false, silly: 'vote' }));
    await live(page);
    await shot('night-intro', '.meta .meta-card');
    await page.evaluate(() => { nightPlay(0); SC.G.score = SC.G.score.map((s, t) => t === __M.team(0) ? 2 : 0); endMatch(); });
    await shot('night-board', '#over .results-card');
    await page.evaluate(() => { NIGHT.i = NIGHT.list.length - 2; nightPlay(NIGHT.list.length - 1); SC.G.score = SC.G.score.map((s, t) => t === __M.team(1) ? 2 : 0); endMatch(); });
    await shot('night-podium', '#over .results-card');
    res.push({ w, bad: fit.filter(Boolean), errors });
    await ctx.close();
  }
  const ok = check(res.every(r => !r.bad.length && !r.errors.length), `v6 meta screens: ${JSON.stringify(res)}`);
  rows.push({ kind: 'v6-meta', key: 'screens', ok: !!ok, note: 'v6m-{cup-bracket,cup-results,draft,night-intro,night-board,night-podium} × 1920, 1536@1.25' });
}

async function run(browser, ctx) {
  fs.mkdirSync(ctx.SHOTS, { recursive: true });
  for (const t of [testMenus, testCup4, testRivalry, testCup8, testDraft, testNight, shots]) {
    try { await t(browser, ctx); } catch (e) { ctx.check(false, `v6 meta ${t.name} crashed: ${e.message}`); }
  }
}
module.exports = { run };

if (require.main === module) {
  (async () => {
    const { chromium } = require('/opt/node-tools/node_modules/playwright');
    const browser = await chromium.launch(), failures = [], rows = [], t0 = Date.now();
    const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
    try { await run(browser, { check, rows, SHOTS: path.join(ROOT, 'tmp', 'smoke') }); } finally { await browser.close(); }
    console.table(rows.map(r => ({ key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note })));
    if (failures.length) { console.error(`V6 META FAILED (${failures.length}):\n - ` + failures.join('\n - ')); process.exit(1); }
    console.log(`V6 META OK: ${rows.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  })();
}
