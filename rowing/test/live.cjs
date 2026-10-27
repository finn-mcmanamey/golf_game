// Live race check: two pages share a fake room (BroadcastChannel), one makes a race code, the other joins,
// both start together and each must see the other's boat moving. Needs Playwright.   node rowing/test/live.cjs
const { chromium } = require('playwright');

const fakeRoom = () => {
  const ch = new BroadcastChannel('fake-room'), me = Math.random().toString(36).slice(2, 10);
  const rooms = {};
  ch.onmessage = e => { const m = e.data, r = rooms[m.room]; if (!r) return;
    if (m.kind === 'emit') r.handlers[m.topic]?.forEach(h => h({ topic: m.topic, data: m.data, peer: m.peer, sameTab: m.peer === me, kind: 'viewer' }));
    if (m.kind === 'presence') { r.peers.set(m.peer, { peer: m.peer, presence: m.presence, updatedAt: Date.now(), sameTab: m.peer === me, kind: 'viewer' }); r.peerFns.forEach(f => f({})) } };
  const room = { join: async name => {
    const r = rooms[name] = { handlers: {}, peers: new Map(), peerFns: [] };
    const send = m => { ch.postMessage({ ...m, room: name, peer: me }); ch.onmessage({ data: { ...m, room: name, peer: me } }) };
    return { name, on: (t, h) => ((r.handlers[t] ||= []).push(h), () => {}), emit: async (topic, data) => send({ kind: 'emit', topic, data }),
      presence: async patch => send({ kind: 'presence', presence: { ...(r.peers.get(me)?.presence || {}), ...patch } }),
      peers: () => [...r.peers.values()], onPeers: f => (r.peerFns.push(f), () => {}), leave: async () => {} } } };
  window.claude = { use: async n => n === 'room' ? room : null };
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 600 } });
  const errs = [];
  const open = async () => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(fakeRoom); await p.goto('file://' + require('node:path').resolve(__dirname, '../dist/index.html') + '#autopilot'); await p.waitForFunction(() => !document.getElementById('btnLive').classList.contains('hide')); return p };
  const a = await open(), c = await open();
  await a.evaluate(() => { crew.club = 'Dad'; settings.distance = 250; menuChanged() });
  await c.evaluate(() => { crew.club = 'Finn' });
  await a.click('#btnLive'); await a.click('#liveCreate');
  const code = await a.evaluate(() => live.code);
  await c.click('#btnLive'); await c.fill('#liveCodeIn', code); await c.click('#liveJoinBtn');
  await a.waitForTimeout(800);
  console.log('lobby on A:', await a.evaluate(() => $('liveCrews').innerText.replace(/\n/g, ' | ')));
  await a.click('#liveStart');
  await a.waitForFunction(() => race.started, null, { timeout: 120000 });
  await c.waitForFunction(() => race.started, null, { timeout: 120000 });
  await a.evaluate(() => { cam.mode = 'aerial' }); await a.waitForTimeout(6000);

  console.log('A sees:', await a.evaluate(() => [...live.remote.values()].map(r => r.crewName + ' lane ' + r.lane + ' x ' + r.x.toFixed(1)).join(', ')), '| A at', await a.evaluate(() => race.player.x.toFixed(1)));
  console.log('C sees:', await c.evaluate(() => [...live.remote.values()].map(r => r.crewName + ' x ' + r.x.toFixed(1)).join(', ')), '| C at', await c.evaluate(() => race.player.x.toFixed(1)));
  const ok = await a.evaluate(() => [...live.remote.values()].some(r => r.crewName === 'Finn' && r.x > 1)) && await c.evaluate(() => [...live.remote.values()].some(r => r.crewName === 'Dad' && r.x > 1));
  console.log(ok && !errs.length ? 'ok: both crews see each other racing' : 'FAIL'); if (!ok || errs.length) process.exitCode = 1;
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
