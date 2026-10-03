// Smoke tests for the Mythic Quest campaign and the challenge levels (76-77, 98-campaign-ui).
// Called by tools/smoke.cjs; also runs on its own (`node tools/smoke-quest.cjs`, after `node build.mjs`).
// - every campaign node and challenge starts (autopilot), runs a few seconds without errors or NaN, then resolves via
//   SC.quest.win() to a results title with stars; boss nodes must reach every phase; the first node and a challenge
//   also play out naturally; saving, unlocking and the skill tree are checked on a real (non-autopilot) win;
// - screenshots of the world map, a dialogue, a boss phase, the skill tree and the challenge list at 1280x720 and
//   400x800 (tmp/smoke/quest-*.png).
const path = require('path');
const fs = require('fs');

async function testQuestSim(page, { check, rows }) {
  const res = await page.evaluate(() => {
    const out = [], one = (kind, id) => {
      const e0 = SC.errors.length;
      SC.quest.start(kind, id);
      const map = SC.state().map, fighters = SC.F.length, ok0 = SC.G.state === 'play' && !!SC.quest.run();
      SC.sim(1);
      const nan0 = SC.F.some(f => f.P.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)));
      let phases = null;
      const bosses = SC.F.filter(f => f.isBoss && f.alive), ctl = bosses.length && bossPhaseCtl(bosses[0]);
      if (ctl && SC.G.state === 'play' && !SC.G.ending) {
        for (const b of bosses) { b.hp = b.maxHp * .2; b.inv = 0; }
        SC.sim(.6);
        phases = `${ctl.idx}/${ctl.phases.length}`;
      }
      if (SC.G.state === 'play') SC.sim(4);
      const nan = nan0 || SC.F.some(f => f.P.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)));
      if (SC.G.state === 'play') SC.quest.win();
      let t = 0;
      while (SC.G.state !== 'over' && t < 30) { SC.sim(1); t++; }
      const r = SC.G.result || {};
      out.push({ kind, id, map, fighters, ok0, nan, phases, needPhases: kind === 'campaign' && !!CAMP_BY_ID[id].phases, over: SC.G.state === 'over', title: r.title, stars: r.stars, won: r.won,
        errors: SC.errors.slice(e0).map(e => e.msg) });
    };
    for (const id of SC.quest.nodes()) one('campaign', id);
    for (const id of SC.quest.challenges()) one('challenge', id);
    return out;
  });
  for (const r of res) {
    const ok = check(r.ok0, `${r.kind} ${r.id}: did not start`) & check(!r.nan, `${r.kind} ${r.id}: NaN`)
      & check(r.over && !!r.title, `${r.kind} ${r.id}: no result`) & check(!r.errors.length, `${r.kind} ${r.id}: errors ${r.errors.join(' | ')}`)
      & check(r.fighters >= 2, `${r.kind} ${r.id}: fewer than 2 fighters`)
      & check(r.needPhases ? !!r.phases && r.phases.split('/')[0] === r.phases.split('/')[1] : true, `${r.kind} ${r.id}: boss phases ${r.phases}`);
    rows.push({ kind: r.kind, key: r.id, ok: !!ok, note: `${r.map} · ${r.title} ${r.won ? '★' + r.stars : ''}${r.phases ? ' · phases ' + r.phases : ''}` });
  }
  check(res.filter(r => r.kind === 'campaign').length >= 20, 'campaign: fewer than 20 nodes');
  check(res.filter(r => r.kind === 'challenge').length >= 28, 'challenges: fewer than 28');

  // Natural play, saving, unlocking and the skill tree.
  const n = await page.evaluate(() => {
    const out = {}, e0 = SC.errors.length, keep = { q: store.get('quest', null), c: store.get('challenges', null) };
    const play = (kind, id) => { SC.quest.start(kind, id); let t = 0; while (SC.G.state !== 'over' && t < 200) { SC.sim(5); t += 5; } return SC.G.state === 'over' && !!SC.G.result.title; };
    out.naturalNode = play('campaign', 'e1');
    out.naturalChallenge = play('challenge', 'laststand');
    store.set('quest', {}); store.set('challenges', {});
    SC.start({ mode: 'campaign', node: 'e1' }); SC.quest.win(); SC.sim(4);
    const s = campSave();
    out.saved = SC.G.state === 'over' && s.stars.e1 >= 1 && campUnlocked('e2', s) && !campUnlocked('e3', s);
    out.points = campPoints(s) === s.stars.e1 && campBuy('v1') && !campBuy('v3') && campSave().tree.v1 === 1;
    SC.start({ mode: 'campaign', node: 'e2' }); SC.G.lock = 0;
    out.treeApplied = Math.round(SC.F[0].maxHp) === Math.round(SC.F[0].hp) && SC.F[0].maxHp > 100 * (SC.F[0].cls ? SC.F[0].cls.hp : 1) + 5;
    SC.start({ mode: 'challenge', challenge: 'noblock' }); SC.G.lock = 0; SC.F[0].blocking = true; SC.sim(3.5);
    out.ruleFails = SC.G.state === 'over' && SC.G.result.won === false;
    SC.start({ mode: 'challenge', challenge: 'parry' }); SC.quest.win(); SC.sim(4);
    out.chalSaved = (chalSave().parry || 0) >= 1;
    store.set('quest', keep.q || {}); store.set('challenges', keep.c || {});
    out.errors = SC.errors.slice(e0).map(e => e.msg);
    startMatch(demoConfig());
    return out;
  });
  for (const k of ['naturalNode', 'naturalChallenge', 'saved', 'points', 'treeApplied', 'ruleFails', 'chalSaved']) {
    check(n[k], `quest: ${k} failed`);
    rows.push({ kind: 'quest', key: k, ok: !!n[k] });
  }
  check(!n.errors.length, 'quest: errors ' + n.errors.join(' | '));
}

async function shotsAt(browser, size, { newPage, SHOTS, check, rows }) {
  const tag = `${size.width}x${size.height}`, { page, errors } = await newPage(browser);
  await page.setViewportSize(size);
  const snap = async (name, fn) => {
    try {
      const ok = await page.evaluate(fn);
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(SHOTS, `quest-${name}-${tag}.png`) });
      check(ok !== false, `quest screen ${name} ${tag}: failed`);
      rows.push({ kind: 'quest-ui', key: `${name} ${tag}`, ok: ok !== false });
    } catch (e) { check(false, `quest screen ${name} ${tag}: ${e.message}`); }
  };
  await page.evaluate(() => store.set('quest', { stars: { e1: 3, e2: 2, es: 1, e3: 2, e4: 1, e5: 2, f1: 1, f2: 1 }, at: 'f2', seen: { e1: 1, e2: 1, e3: 1, e4: 1, e5: 1, f1: 1 }, tree: { v1: 1, p1: 1 } }));
  await snap('menu', () => { openScreen('menu'); return !!document.querySelector('.quest-item'); });
  await snap('map', () => { openScreen('campaign', 'menu'); return document.querySelectorAll('.camp-node').length >= 20 && !!document.querySelector('.camp-node.sel'); });
  await snap('walk', () => { document.querySelector('[data-key="node-f3"]').focus(); return CAMP_UI.sel === 'f3' && CAMP_UI.path.length > 0; });
  await snap('dialogue', () => { SC.quest.dialogue(CAMP_BY_ID.f5.pre); return !!document.querySelector('.camp-dlg .dlg-text').textContent; });
  await snap('tree', () => { campDialogueClose(); openScreen('skilltree', 'campaign'); return document.querySelectorAll('.tree-node').length === 12; });
  await snap('challenges', () => { store.set('challenges', { pan: 3, grenadier: 1, laststand: 2 }); openScreen('challenges', 'menu'); return document.querySelectorAll('.chal-card').length >= 28; });
  await snap('boss', () => {
    SC.quest.start('campaign', 'e5', { autopilot: true }); SC.G.lock = 0; SC.sim(1.5);
    const b = SC.F.find(f => f.isBoss); b.hp = b.maxHp * .45; SC.sim(1.2);
    return bossPhaseCtl(b).idx === 1;
  });
  await snap('results', () => { SC.quest.win(); SC.sim(4); return SC.G.state === 'over'; });
  await page.waitForTimeout(200);
  const hasMapBtn = await page.evaluate(() => [...document.querySelectorAll('#over button')].some(b => /World map/.test(b.textContent)));
  check(hasMapBtn, `quest results ${tag}: no World map button`);
  check(!errors.length, `quest ui ${tag}: console errors ${errors.join(' | ')}`);
  await page.close();
}

async function run(page, browser, ctx) {
  fs.mkdirSync(ctx.SHOTS, { recursive: true });
  await testQuestSim(page, ctx);
  for (const size of [{ width: 1280, height: 720 }, { width: 400, height: 800 }]) await shotsAt(browser, size, ctx);
}
module.exports = { run };

// Standalone: node tools/smoke-quest.cjs
if (require.main === module) {
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  const ROOT = path.resolve(__dirname, '..'), SHOTS = path.join(ROOT, 'tmp', 'smoke'), failures = [], rows = [];
  const check = (ok, what) => { if (!ok) failures.push(what); return ok; };
  async function newPage(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await page.goto('file://' + path.join(ROOT, 'dist', 'stick-clash.html'));
    await page.waitForFunction(() => window.SC && SC.G.state === 'menu');
    return { page, errors };
  }
  (async () => {
    const browser = await chromium.launch();
    try {
      const { page, errors } = await newPage(browser);
      await run(page, browser, { check, rows, SHOTS, newPage });
      if (errors.length) failures.push('console: ' + errors.join(' | '));
    } catch (e) { failures.push('crashed: ' + (e.stack || e.message)); }
    await browser.close();
    console.table(rows.map(r => ({ kind: r.kind, key: r.key, ok: r.ok ? 'ok' : 'FAIL', note: r.note || '' })));
    if (failures.length) { console.error('QUEST SMOKE FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
    console.log('QUEST SMOKE OK');
  })();
}
