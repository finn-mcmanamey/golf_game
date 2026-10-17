#!/usr/bin/env python3
"""Runs the built game in a real WebKit engine (WebKitGTK's MiniBrowser through WebKitWebDriver, on Xvfb) and
checks what a Chromium-only test run can't: that every script, weapon, arena and screen works in WebKit, which
media features it has, and how the page lays out at iPad sizes. Standard library only; run with `python3 -I`.

Usage: python3 -I tools/webkit-check.py [--keep]     (exit code 1 when a check fails)
Needs: apt-get install webkit2gtk-driver xvfb   (WebKitWebDriver + MiniBrowser; Xvfb for a display)
"""
import base64, glob, json, os, shutil, socket, subprocess, sys, time, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'file://' + os.path.join(ROOT, 'dist', 'stick-clash.html')
OUT = os.path.join(ROOT, 'tmp', 'webkit')
PORT = 4471
DISPLAY = ':99'
SIZES = [(1194, 834), (1366, 1024), (834, 1194)]   # iPad Pro 11", iPad Pro 12.9", portrait


def find_minibrowser():
    for pat in ['/usr/lib/*/webkit2gtk-4.1/MiniBrowser', '/usr/lib/webkit2gtk-4.1/MiniBrowser', '/usr/libexec/webkit2gtk-4.1/MiniBrowser',
                '/usr/lib/*/webkitgtk-6.0/MiniBrowser', '/usr/libexec/webkitgtk-6.0/MiniBrowser']:
        hits = glob.glob(pat)
        if hits:
            return hits[0]
    try:
        for line in subprocess.run(['dpkg', '-L', 'webkit2gtk-driver'], capture_output=True, text=True).stdout.splitlines():
            if line.endswith('/MiniBrowser'):
                return line
    except OSError:
        pass
    return None


def wait_port(port, seconds):
    for _ in range(int(seconds * 10)):
        with socket.socket() as s:
            s.settimeout(.2)
            if s.connect_ex(('127.0.0.1', port)) == 0:
                return True
        time.sleep(.1)
    return False


class Driver:
    """The few W3C WebDriver calls this needs, over plain HTTP."""
    def __init__(self, port):
        self.base = 'http://127.0.0.1:%d' % port
        self.sid = None

    def call(self, method, path, body=None):
        data = json.dumps(body if body is not None else {}).encode() if method == 'POST' else None
        req = urllib.request.Request(self.base + path, data=data, method=method, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.loads(r.read().decode())['value']
        except urllib.error.HTTPError as e:
            raise RuntimeError('%s %s -> %s %s' % (method, path, e.code, e.read().decode()[:400]))

    def start(self, binary):
        caps = {'capabilities': {'alwaysMatch': {'browserName': 'MiniBrowser', 'webkitgtk:browserOptions': {'binary': binary, 'args': ['--automation']}}}}
        v = self.call('POST', '/session', caps)
        self.sid = v['sessionId']
        self.call('POST', '/session/%s/timeouts' % self.sid, {'script': 180000, 'pageLoad': 60000})

    def run(self, script, *args):
        return self.call('POST', '/session/%s/execute/sync' % self.sid, {'script': script, 'args': list(args)})

    def run_async(self, script, *args):
        return self.call('POST', '/session/%s/execute/async' % self.sid, {'script': script, 'args': list(args)})

    def goto(self, url):
        self.call('POST', '/session/%s/url' % self.sid, {'url': url})

    def inner_size(self, w, h):
        """Sets the window so the page's innerWidth/innerHeight are w x h (the window chrome is measured first)."""
        self.call('POST', '/session/%s/window/rect' % self.sid, {'width': w, 'height': h, 'x': 0, 'y': 0})
        iw, ih = self.run('return [innerWidth, innerHeight]')
        if (iw, ih) != (w, h):
            self.call('POST', '/session/%s/window/rect' % self.sid, {'width': w + (w - iw), 'height': h + (h - ih), 'x': 0, 'y': 0})
            iw, ih = self.run('return [innerWidth, innerHeight]')
        return iw, ih

    def screenshot(self, name):
        png = base64.b64decode(self.call('GET', '/session/%s/screenshot' % self.sid))
        path = os.path.join(OUT, name + '.png')
        with open(path, 'wb') as f:
            f.write(png)
        return path

    def touch_tap(self, x, y):
        """A real touch tap through the Actions API; raises if this WebDriver has no touch pointer."""
        actions = {'actions': [{'type': 'pointer', 'id': 'finger', 'parameters': {'pointerType': 'touch'}, 'actions': [
            {'type': 'pointerMove', 'x': int(x), 'y': int(y), 'duration': 0}, {'type': 'pointerDown', 'button': 0},
            {'type': 'pause', 'duration': 60}, {'type': 'pointerUp', 'button': 0}]}]}
        self.call('POST', '/session/%s/actions' % self.sid, actions)

    def quit(self):
        if self.sid:
            try:
                self.call('DELETE', '/session/%s' % self.sid)
            except Exception:
                pass


# Installed after load: the game logs its own caught errors in SC.errors; this catches anything uncaught.
ERR_HOOK = """
window.__wk = { errs: [] };
addEventListener('error', e => __wk.errs.push('error: ' + (e.message || e.type)));
addEventListener('unhandledrejection', e => __wk.errs.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
return typeof SC;
"""

ERRS = "return (window.__wk ? __wk.errs : []).concat(typeof SC === 'object' ? SC.errors.map(e => e.msg) : ['no SC'])"


# v4: synthetic touch and key events (WebKitGTK's driver has no touch actions; the game reads untrusted events too).
TAP_JS = """
const tap = (el, x, y, id) => { const o = { pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1, bubbles: true, pointerId: id };
  el.dispatchEvent(new PointerEvent('pointerdown', o)); return () => el.dispatchEvent(new PointerEvent('pointerup', o)); };
const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
const shown = e => !!e && !e.hidden && e.getClientRects().length > 0 && +getComputedStyle(e).opacity > .05;
"""


def res_checks(d, check):
    """v4.1 adaptive resolution in WebKit: every arena at the sharpest step, the governor stepping down, and what medium
    smoothing costs the bloom copy here (the copy drops it on WebKit if it costs more than 0.3 ms)."""
    if not d.run("return !!(window.SC && SC.res)"):
        return check('resolution: SC.res (older build)', True, 'skipped')
    d.inner_size(1800, 1300)   # big enough that step 0 is sharper than step 3 at this engine's pixel ratio of 1
    d.run("resize()")
    r = d.run("""
      const bad = [];
      SC.res.force(0);
      for (const k of Object.keys(SC.reg.MAPS)) {
        const e0 = SC.errors.length;
        try { SC.start({ mode: 'watch', map: k }); SC.G.lock = 0; SC.sim(.5); SC.render(1 / 60); SC.render(1 / 60); }
        catch (e) { bad.push(k + ': ' + e.message); }
        if (SC.errors.length > e0) bad.push(k + ': ' + SC.errors[SC.errors.length - 1].msg);
      }
      const size = [cv.width, cv.height, Math.round(innerWidth * resDpr(0)), Math.round(innerHeight * resDpr(0))];
      SC.res.force(null); SC.render(1 / 60);
      return { n: Object.keys(SC.reg.MAPS).length, bad, size };
    """)
    check('resolution: all %d arenas render at step 0' % r['n'], not r['bad'] and r['size'][0] == r['size'][2] and r['size'][1] == r['size'][3],
          ('; '.join(r['bad']) or json.dumps(r['size']))[:160])
    # 25 ms frames in a neon arena with bloom High: the bloom steps change something at any pixel ratio, so it steps down.
    r = d.run("""
      const R = SC.res.RES, keep = SETTINGS.bloom;
      SETTINGS.bloom = 'high'; SC.res.auto(true);
      SC.start({ mode: 'versus', map: 'neon' }); SC.G.lock = 0; SC.G.state = 'paused';
      Object.assign(R, { step: 0, cool: 0, avg: 0 }); SC.render(0); R.cool = 0;
      const seen = [R.step];
      for (let k = 0; k < 900; k++) { const s = SC.res.feed(25); if (s !== seen[seen.length - 1]) seen.push(s); }
      SC.render(0);
      const out = { seen, shown: R.shown, tier: SC.postfx.bloom.tier, held: R.held, errors: SC.errors.map(e => e.msg).slice(-3) };
      SC.res.auto(false); SETTINGS.bloom = keep; SC.render(0);
      return out;
    """)
    check('resolution: SC.res.feed steps down', len(r['seen']) > 1 and r['seen'][1] > r['seen'][0] and not r['errors'], json.dumps(r))
    # The bloom copy at the sharpest step: low vs medium smoothing, ms per copy (60 copies timed together, as WebKit's
    # clock is coarse; read back so the work is counted), alternating three times.
    r = d.run("""
      SC.start({ mode: 'watch', fighters: 8, map: 'neon' }); SC.G.lock = 0; SC.sim(1); SC.G.state = 'paused';
      SC.res.force(0); SC.render(1 / 60);
      const c = document.createElement('canvas'), out = { canvas: cv.width + 'x' + cv.height, low: [], medium: [] };
      c.width = Math.ceil(VIEW.w3 / 4); c.height = Math.ceil(VIEW.h3 / 4);
      const g = c.getContext('2d');
      for (let rep = 0; rep < 3; rep++) for (const q of ['low', 'medium']) {
        g.imageSmoothingQuality = q; g.getImageData(0, 0, 1, 1);
        const t0 = performance.now();
        for (let k = 0; k < 60; k++) { g.drawImage(cv, 0, 0, c.width, c.height); g.getImageData(0, 0, 1, 1); }
        out[q].push(+((performance.now() - t0) / 60).toFixed(3));
      }
      SC.res.force(null); SC.render(1 / 60);
      return out;
    """)
    check('resolution: bloom copy smoothing cost (informational)', True, json.dumps(r))
    d.inner_size(1280, 720)
    d.run("resize()")


def v4_checks(d, check):
    """Arena art styles, iPad table mode, the Compact 2P laptop layout, the controls card and the rule vote in WebKit."""
    # Every art style renders with 8 fighters; the pixel layer is scaled up without smoothing.
    d.inner_size(1194, 834)
    styles = d.run("resize(); const by = {}; for (const k of Object.keys(SC.reg.MAPS)) { const s = SC.styles.of(k); if (!by[s]) by[s] = k; } return by;")
    for style, key in sorted(styles.items()):
        r = d.run("""
          const key = arguments[0], e0 = SC.errors.length; let err = '';
          try { toMenu(); SC.start({ mode: 'ffa', fighters: 8, map: key }); SC.G.lock = 0; SC.sim(2.5); for (let i = 0; i < 20; i++) SC.render(1 / 60); }
          catch (e) { err = e.message; }
          if (SC.errors.length > e0) err = err || SC.errors[SC.errors.length - 1].msg;
          return { err, layer: SC.styles.layer() || null, nan: SC.F.some(f => f.P.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) };
        """, key)
        ok = not r['err'] and not r['nan'] and (style != 'pixel' or (r['layer'] or {}).get('smooth') is False)
        check('art style %s (%s) renders' % (style, key), ok, json.dumps(r))
        d.screenshot('style-%s-1194x834' % style)

    # iPad table mode: two touch sets (P2's turned 180°), Advanced buttons >= 44 px and not touching, clear of the HUD,
    # and P2's own attack button attacks with P2 only.
    for (w, h) in [(1194, 834), (1366, 1024)]:
        d.inner_size(w, h)
        d.run(TAP_JS + """
          resize(); toMenu(); ROTATE_SKIPPED = true; setScheme(0, 'advanced'); setScheme(1, 'advanced'); SETTINGS.tableMode = true;
          SC.start({ mode: 'pvp', map: 'dojo', silly: 'off', minigames: false }); SC.G.lock = 0;
          tap(document.elementFromPoint(innerWidth / 2, innerHeight / 2) || document.body, innerWidth / 2, innerHeight / 2, 1)();
        """)
        time.sleep(.6)
        r = d.run(TAP_JS + """
          const sets = [...document.querySelectorAll('#touch .tset')].filter(shown), btns = s => [...s.querySelectorAll('.tarc button')].filter(shown);
          const out = { table: tableActive(), touch: !TOUCH_EL.hidden, sets: sets.length, turned: sets[1] ? getComputedStyle(sets[1]).transform : 'none' };
          let minSize = 1e9, minGap = 1e9;
          for (const s of sets) {
            const bs = btns(s).map(b => b.getBoundingClientRect());
            for (const b of bs) minSize = Math.min(minSize, b.width, b.height);
            for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
              const a = bs[i], c = bs[j];
              minGap = Math.min(minGap, Math.hypot(a.left + a.width / 2 - c.left - c.width / 2, a.top + a.height / 2 - c.top - c.height / 2) - (a.width + c.width) / 2);
            }
          }
          Object.assign(out, { minSize: Math.round(minSize), minGap: Math.round(minGap) });
          const V = SC.view.VIEW, top = V.hudY / V.dpr, bottom = (V.hudY + V.hudH) / V.dpr, all = sets.flatMap(btns).map(b => b.getBoundingClientRect());
          out.overHud = sets[1] ? btns(sets[1]).map(b => b.getBoundingClientRect()).filter(b => b.top < bottom && b.bottom > top).length : -1;
          out.offScreen = all.filter(b => b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1).length;
          window.__atk = []; on('attack', f => __atk.push(f.slot)); SC.F[1].atkCd = 0;
          const btn = document.querySelector('#touch .tset2 [data-act="attack"]'), b = btn.getBoundingClientRect();
          const up = tap(btn, b.left + b.width / 2, b.top + b.height / 2, 2); SC.sim(.15); up(); SC.sim(.05);
          out.attacks = [...new Set(__atk)].join();
          return out;
        """)
        check('table mode %dx%d: two sets, P2 turned' % (w, h), r['table'] and r['touch'] and r['sets'] == 2 and r['turned'].startswith('matrix(-1'), json.dumps(r))
        check('table mode %dx%d: buttons >= 44 px, apart, clear of the HUD' % (w, h),
              r['minSize'] >= 44 and r['minGap'] >= 4 and r['overHud'] == 0 and r['offScreen'] == 0, json.dumps(r))
        check('table mode %dx%d: P2 attack button attacks with P2' % (w, h), r['attacks'] == '1', json.dumps(r))
        d.screenshot('table-%dx%d' % (w, h))
    d.run("SETTINGS.tableMode = false; toMenu();")

    # Laptop: Compact 2P keys, both key strips on screen, and each player's attack key attacks with that player only.
    d.inner_size(1280, 720)
    d.run(TAP_JS + """
      resize(); toMenu(); setKeyLayout('compact'); setScheme(0, 'simple'); setScheme(1, 'simple');
      SC.start({ mode: 'pvp', map: 'neon', silly: 'off', minigames: false }); SC.G.lock = 0;
      for (const c of ['KeyA', 'ArrowLeft']) { key('keydown', c); key('keyup', c); }   // both players last used keys
      SC.sim(.1); for (let i = 0; i < 5; i++) SC.render(1 / 60);
    """)
    time.sleep(.6)
    r = d.run(TAP_JS + """
      const ks = keySets(), out = { p1: ks[0].attack, p2: ks[1].attack, skill2: ks[1].skill2, strips: [...document.querySelectorAll('.kstrip')].filter(shown).length };
      window.__atk = []; on('attack', f => __atk.push(f.slot));
      SC.F[0].atkCd = SC.F[1].atkCd = 0; key('keydown', out.p1); SC.sim(.15); key('keyup', out.p1); SC.sim(.4);
      out.first = [...new Set(__atk)].join(); __atk.length = 0;
      SC.F[1].atkCd = 0; key('keydown', out.p2); SC.sim(.15); key('keyup', out.p2); SC.sim(.05);
      out.second = [...new Set(__atk)].join();
      return out;
    """)
    check('compact 2P: keys and both key strips', r['p1'] == 'KeyF' and r['p2'] == 'Period' and r['strips'] == 2, json.dumps(r))
    check('compact 2P: each attack key drives its own player', r['first'] == '0' and r['second'] == '1', json.dumps(r))
    d.screenshot('compact-1280x720')
    d.run("setKeyLayout('standard'); toMenu();")

    # The controls card, then the rule vote (2-player duel), both drawn by this engine.
    r = d.run(TAP_JS + """
      toMenu(); SC.start({ mode: 'pvp', map: 'dojo', silly: 'vote', minigames: false }); SC.controls.card(true);
      return { card: SC.controls.cardOpen(), sections: document.querySelectorAll('.cc-sec').length };
    """)
    time.sleep(.5)   # the card ignores input for 350 ms, so the press that opened it can't close it
    r.update(d.run(TAP_JS + "key('keydown', 'KeyK'); key('keyup', 'KeyK'); return { closed: !SC.controls.cardOpen() };"))
    time.sleep(.8)
    r.update(d.run(TAP_JS + "for (let i = 0; i < 3; i++) SC.render(1 / 60); const v = document.querySelector('.vote'); return { vote: shown(v), sides: v ? v.querySelectorAll('.vote-sides > *').length : 0 };"))
    check('controls card and rule vote', r['card'] and r['sections'] >= 2 and r['closed'] and r['vote'] and r['sides'] == 2, json.dumps(r))
    d.screenshot('vote-1280x720')
    d.run("toMenu();")


def main():
    keep = '--keep' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    driver_bin = shutil.which('WebKitWebDriver')
    browser = find_minibrowser()
    if not driver_bin or not browser:
        print('WEBKIT CHECK SKIPPED: WebKitWebDriver/MiniBrowser not installed (apt-get install webkit2gtk-driver)')
        return 2
    env = dict(os.environ, DISPLAY=DISPLAY, GDK_BACKEND='x11', LIBGL_ALWAYS_SOFTWARE='1', WEBKIT_DISABLE_DMABUF_RENDERER='1')
    procs = []
    if not os.path.exists('/tmp/.X11-unix/X' + DISPLAY[1:]):
        procs.append(subprocess.Popen(['Xvfb', DISPLAY, '-screen', '0', '1800x1400x24', '-nolisten', 'tcp'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        time.sleep(1)
    procs.append(subprocess.Popen([driver_bin, '--port=%d' % PORT, '--host=127.0.0.1'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT))
    if not wait_port(PORT, 15):
        print('WebKitWebDriver did not start')
        return 1
    d = Driver(PORT)
    rows = []

    def check(name, ok, note=''):
        rows.append((name, bool(ok), str(note)[:160]))

    try:
        d.start(browser)
        d.inner_size(1280, 720)
        d.goto(PAGE)
        time.sleep(2.5)
        sc = d.run(ERR_HOOK)
        check('boot: game script loaded', sc == 'object', 'typeof SC = %s' % sc)
        if sc != 'object':
            raise SystemExit(1)
        info = d.run("""
          const c = document.createElement('canvas').getContext('2d');
          const mr = typeof MediaRecorder !== 'undefined';
          return { ua: navigator.userAgent, version: typeof VERSION === 'string' ? VERSION : '?',
            webgl: !!document.createElement('canvas').getContext('webgl'), filter: 'filter' in c, roundRect: !!c.roundRect,
            compression: typeof CompressionStream !== 'undefined', decompression: typeof DecompressionStream !== 'undefined',
            mediaRecorder: mr, mp4: mr && MediaRecorder.isTypeSupported('video/mp4'), webm: mr && MediaRecorder.isTypeSupported('video/webm'),
            captureStream: 'captureStream' in HTMLCanvasElement.prototype, speech: 'speechSynthesis' in window,
            audio: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined', share: !!navigator.share,
            wakeLock: !!navigator.wakeLock, idle: typeof requestIdleCallback !== 'undefined', offscreen: typeof OffscreenCanvas !== 'undefined',
            dvh: CSS.supports('height', '100dvh'), wkBackdrop: CSS.supports('-webkit-backdrop-filter', 'blur(1px)'),
            overscroll: CSS.supports('overscroll-behavior', 'none'), touchAction: CSS.supports('touch-action', 'pan-y'),
            fonts: document.fonts ? document.fonts.status : 'n/a' };
        """)
        check('engine: WebKit, not Chromium', 'WebKit' in info['ua'] and 'Chrome' not in info['ua'], info['ua'][:90])
        check('boot: version', True, 'v%s' % info['version'])
        check('features (informational)', True, json.dumps({k: v for k, v in info.items() if k != 'ua'}))
        check('boot: no errors', not d.run(ERRS), d.run(ERRS))

        # An 8-fighter brawl simulated and drawn in WebKit.
        r = d.run("""
          SC.start({ mode: 'ffa', fighters: 8, map: 'caldera', diff: 'hard' }); SC.G.lock = 0; SC.sim(8);
          for (let i = 0; i < 60; i++) SC.render(1 / 60);
          const nan = SC.F.some(f => f.P.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)));
          return { fighters: SC.F.length, nan, dmg: SC.F.reduce((s, f) => s + f.stats.dmgDealt, 0), state: SC.G.state };
        """)
        check('match: 8 fighters simulate and draw', r['fighters'] >= 8 and not r['nan'] and not d.run(ERRS), json.dumps(r))
        d.screenshot('match-8-1280x720')

        # Every weapon's draw code and every arena's background run in WebKit.
        r = d.run("""
          const bad = [];
          for (const k of Object.keys(SC.reg.WEAPONS)) {
            const e0 = SC.errors.length;
            try { SC.start({ mode: 'versus', map: 'dojo', loadouts: [{ weapon: k }, { weapon: 'blade' }] }); SC.G.lock = 0; SC.sim(.4); SC.render(1 / 60); SC.render(1 / 60); }
            catch (e) { bad.push(k + ': ' + e.message); }
            if (SC.errors.length > e0) bad.push(k + ': ' + SC.errors[SC.errors.length - 1].msg);
          }
          return { n: Object.keys(SC.reg.WEAPONS).length, bad };
        """)
        check('weapons: all %d draw' % r['n'], not r['bad'], '; '.join(r['bad'])[:160])
        r = d.run("""
          const bad = [];
          for (const k of Object.keys(SC.reg.MAPS)) {
            const e0 = SC.errors.length;
            try { SC.start({ mode: 'watch', map: k }); SC.G.lock = 0; SC.sim(1); SC.render(1 / 60); SC.render(1 / 60); }
            catch (e) { bad.push(k + ': ' + e.message); }
            if (SC.errors.length > e0) bad.push(k + ': ' + SC.errors[SC.errors.length - 1].msg);
          }
          return { n: Object.keys(SC.reg.MAPS).length, bad };
        """)
        check('arenas: all %d render' % r['n'], not r['bad'], '; '.join(r['bad'])[:160])
        res_checks(d, check)

        # Every menu screen builds.
        r = d.run("""
          toMenu(); const bad = [], names = Object.keys(typeof SCREENS === 'object' ? SCREENS : {});
          for (const s of names) { const e0 = SC.errors.length; try { openScreen(s, 'menu'); } catch (e) { bad.push(s + ': ' + e.message); } if (SC.errors.length > e0) bad.push(s + ': ' + SC.errors[SC.errors.length - 1].msg); }
          openScreen('menu', 'menu');
          return { n: names.length, bad, names };
        """)
        check('screens: all %d open' % r['n'], r['n'] > 5 and not r['bad'], '; '.join(r['bad'])[:160])
        for s in ['loadout', 'settings', 'codex', 'campaign']:
            if s in r['names']:
                d.run("openScreen(%s, 'menu')" % json.dumps(s))
                time.sleep(.4)
                d.screenshot('screen-' + s)
        d.run("openScreen('menu', 'menu')")

        # Export and photo pipelines.
        r = d.run("""
          const out = { mime: SC.export && SC.export.mime(), how: SC.export && SC.export.how() };
          if (SC.gif) { const g = SC.gif(8, 8, 10); const px = new ImageData(8, 8); g.addFrame(px); g.addFrame(px); out.gif = g.finish().type; }
          if (SC.photo && SC.photo.bake) { const id = new ImageData(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1); SC.photo.bake(id, 'grayscale(1)'); out.bake = Array.from(id.data); }
          return out;
        """)
        check('export: mime/how chosen', r['how'] in ('video', 'gif', 'none'), json.dumps(r))
        check('export: GIF encoder works', r.get('gif') == 'image/gif', str(r.get('gif')))
        check('photo: filter bake works', (r.get('bake') or [0])[0] == (r.get('bake') or [0, 1])[1], str(r.get('bake')))

        # Save codes: compressed by this engine's CompressionStream, unpacked by the game's own inflater, round trip exact.
        r = d.run_async("""
          const done = arguments[arguments.length - 1];
          (async () => {
            if (typeof CompressionStream !== 'function') return done({ skip: 'no CompressionStream' });
            if (!(SC.savecode && SC.savecode.inflate)) return done({ skip: 'no SC.savecode.inflate (older build)' });
            const pack = async bytes => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
            const words = ['katana', 'neon', 'Frostspire', 'coins', 'wins', 'ranked', 'quest', 'tree'];
            let bad = 0, n = 0, maxLen = 0;
            for (let i = 0; i < 120; i++) {
              const o = {}; const keys = 5 + (i * 7) % 60;
              for (let k = 0; k < keys; k++) o[words[k % words.length] + k] = k % 3 ? words[(k * i) % words.length].repeat(1 + (k % 9)) : (k * 7919 + i) % 100000;
              if (i % 40 === 39) o.big = Array.from({ length: 9000 }, (_, j) => (j * 2654435761 % 4294967296).toString(36)).join('');
              const src = new TextEncoder().encode(JSON.stringify(o)), z = await pack(src), back = SC.savecode.inflate(z);
              n++; maxLen = Math.max(maxLen, src.length);
              if (back.length !== src.length || back.some((b, j) => b !== src[j])) bad++;
            }
            done({ n, bad, maxLen });
          })().catch(e => done({ error: e.message }));
        """)
        check('save codes: WebKit-compressed codes inflate exactly', r.get('skip') or (r.get('bad') == 0 and r.get('n')), json.dumps(r))

        # The automatic benchmark must not start before a real gesture (the 30 fps iframe cap would measure Low).
        r = d.run("return SC.perf && SC.perf.autoBlock ? SC.perf.autoBlock() : 'no autoBlock (older build)'")
        check('perf: no automatic benchmark before a gesture', r in ('no gesture yet', 'test automation', 'result is fresh', 'no autoBlock (older build)'), r)

        # The benchmark in WebKit (software rendering here: the tier will be low; it must still finish).
        r = d.run_async("""
          const done = arguments[arguments.length - 1];
          toMenu(); setTimeout(async () => { try { const res = await SC.perf.run(.6); done(JSON.stringify(res && { tier: res.tier, capped: res.capped, inconclusive: res.inconclusive })); } catch (e) { done('error: ' + e.message); } }, 600);
        """)
        check('perf: benchmark runs', r and not str(r).startswith('error'), r)

        # Touch input: real touch actions if this driver has them, else synthetic pointer events.
        d.run("toMenu(); SC.start({ mode: 'versus', map: 'dojo' }); SC.G.lock = 0; window.__wk.types = []; addEventListener('pointerdown', e => __wk.types.push(e.pointerType), true);")
        touched = 'WebDriver touch action'
        try:
            d.touch_tap(200, 560)
        except Exception as e:
            touched = 'no touch actions (%s)' % str(e)[:50]
        time.sleep(.3)
        seen = d.run("return __wk.types")
        check('touch: engine input types (informational)', True, '%s delivered pointerType %s' % (touched, seen))
        if 'touch' not in seen:   # WebKitGTK's driver sends mouse pointers; the game's touch logic still runs on synthetic events
            d.run("""
              const el = document.elementFromPoint(200, 560) || document.body, o = { pointerType: 'touch', clientX: 200, clientY: 560, isPrimary: true, bubbles: true, pointerId: 7 };
              el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o));
            """)
            time.sleep(.3)
        r = d.run("return { last: SC.device && SC.device.lastInput, shown: !document.getElementById('touch').hidden, audio: typeof AC !== 'undefined' && !!AC }")
        check('touch: a touch shows the controls', r['last'] == 'touch' and r['shown'], json.dumps(r))
        check('audio: context created by the touch', r['audio'], '')

        # The stick ring is drawn under the thumb: start a stick drag in the left zone and compare the ring's centre.
        st = d.run("""
          const zone = document.querySelector('#touch .tzone-l'), ring = document.querySelector('#touch .tstick');
          if (!zone || !ring) return { skip: 'no stick' };
          const z = zone.getBoundingClientRect(), x = Math.round(z.left + z.width * .4), y = Math.round(z.top + z.height * .6);
          const o = { pointerType: 'touch', clientX: x, clientY: y, isPrimary: true, bubbles: true, pointerId: 11 };
          zone.dispatchEvent(new PointerEvent('pointerdown', o));
          const b = ring.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
          zone.dispatchEvent(new PointerEvent('pointerup', o));
          const rest = ring.getBoundingClientRect();
          return { x, y, cx: Math.round(cx), cy: Math.round(cy), off: Math.round(Math.hypot(cx - x, cy - y)),
            restInside: rest.left >= 0 && rest.top >= 0 && rest.right <= innerWidth && rest.bottom <= innerHeight };
        """)
        check('touch: stick ring under the thumb', st.get('skip') or st['off'] <= 4, json.dumps(st))
        check('touch: idle stick fully on screen', st.get('skip') or st['restInside'], json.dumps(st))
        check('no errors so far', not d.run(ERRS), d.run(ERRS))

        # iPad sizes: layout, HUD band and a screenshot each.
        for (w, h) in SIZES:
            iw, ih = d.inner_size(w, h)
            d.run("resize(); toMenu(); SC.start({ mode: 'watch', map: 'kitchen' }); SC.G.lock = 0; for (const f of SC.F) { f.ai.behave = 'idle'; f.ai.t = 1e9; } SC.sim(.5); for (let i = 0; i < 30; i++) SC.render(1 / 60);")
            r = d.run("const { VIEW, CAM } = SC.view; return { iw: innerWidth, ih: innerHeight, vy: VIEW.vy, hudY: VIEW.hudY, hudH: VIEW.hudH, hudOver: VIEW.hudOver, s: VIEW.s, zoom: CAM.z }")
            ok = abs(r['iw'] - w) <= 2 and abs(r['ih'] - h) <= 2 and r['hudH'] > 0
            check('layout %dx%d' % (w, h), ok, json.dumps(r))
            d.screenshot('play-%dx%d' % (w, h))
        v4_checks(d, check)
        check('final: no errors', not d.run(ERRS), d.run(ERRS))
    except SystemExit:
        pass
    except Exception as e:
        check('harness', False, 'crashed: %s' % e)
    finally:
        d.quit()
        if not keep:
            for p in procs:
                p.terminate()

    width = max(len(n) for n, _, _ in rows) + 2
    for name, ok, note in rows:
        print('%-*s %s  %s' % (width, name, 'ok  ' if ok else 'FAIL', note))
    failed = [n for n, ok, _ in rows if not ok]
    with open(os.path.join(OUT, 'report.json'), 'w') as f:
        json.dump([{'name': n, 'ok': ok, 'note': note} for n, ok, note in rows], f, indent=1)
    print('\nWEBKIT CHECK %s: %d checks, %d failed. Screenshots in %s' % ('FAILED' if failed else 'OK', len(rows), len(failed), OUT))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
