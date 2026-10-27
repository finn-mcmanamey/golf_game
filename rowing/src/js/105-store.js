/* ===== saves: every setting and record goes through this one store =====
   Browser storage can be blocked (private windows, previews), so reads and writes never throw. */

const STORE = (() => {
  const PREFIX = 'voxelregatta.', mem = new Map();
  let ls = null;
  try { ls = window.localStorage; ls.getItem(PREFIX + 'probe') } catch (e) { ls = null }
  return {
    get(key, fallback) {
      try {
        const raw = ls ? ls.getItem(PREFIX + key) : mem.get(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      mem.set(key, raw);
      try { if (ls) ls.setItem(PREFIX + key, raw) } catch (e) { /* storage full or blocked: memory copy keeps this session working */ }
    },
  };
})();

const settings = Object.assign({ distance: 500, cls: '1x', difficulty: 'club', sound: true, quality: 1, assist: true, voice: false, cue: true, calm: false, bigText: false, role: 'row', plan: 'classic', music: true, pace: 'off', oneButton: false, kind: 'regatta', camera: 'tv', seed: 0 },
  STORE.get('settings', {}));
const saveSettings = () => STORE.set('settings', settings);

// Personal bests: one per distance and boat class, with the race code that rowed it (so it can be a ghost).
// Each kind of race keeps its own records; regattas keep the original keys so older saves still count.
const pbKey = (distance, cls, kind) => (kind && kind !== 'regatta' ? kind + '-' : '') + `${distance}-${cls}`;
const getPB = (distance, cls, kind) => STORE.get('pbs', {})[pbKey(distance, cls, kind)] || null;
function savePB(distance, cls, kind, record) {
  const all = STORE.get('pbs', {});
  all[pbKey(distance, cls, kind)] = record;
  STORE.set('pbs', all);
}
