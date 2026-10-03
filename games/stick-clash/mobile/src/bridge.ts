// The small bridge between the game page and the native app.
//
// Saves: WKWebView's localStorage can be wiped by iOS, so every localStorage key
// starting with SAVE_PREFIX is mirrored into AsyncStorage. Native is the source of
// truth: it restores the keys before the page's own scripts run, and the page
// reports every change back through postMessage.
//
// Haptics: the page can post {type:'haptic', style} (or call
// window.StickClashNative.haptic(style)) to trigger expo-haptics.
//
// The injected code is a plain string, not Function.toString(), because Hermes
// release builds strip function source.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

export const SAVE_PREFIX = 'stickclash';
const NATIVE_PREFIX = 'webls:'; // namespace for mirrored keys inside AsyncStorage

export type SaveItems = Record<string, string>;

export type HapticStyle =
  | 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'
  | 'success' | 'warning' | 'error'
  | 'selection';

type BridgeMessage =
  | { type: 'storage'; op: 'set'; key: string; value: string }
  | { type: 'storage'; op: 'remove'; key: string }
  | { type: 'storage'; op: 'snapshot'; items: SaveItems }
  | { type: 'haptic'; style?: HapticStyle };

/** Loads the mirrored saves so they can be injected before the page loads. */
export async function loadSaves(): Promise<SaveItems> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(NATIVE_PREFIX));
    const pairs = await AsyncStorage.multiGet(keys);
    const items: SaveItems = {};
    for (const [k, v] of pairs) if (v != null) items[k.slice(NATIVE_PREFIX.length)] = v;
    return items;
  } catch (e) {
    console.warn('[bridge] could not load saves', e);
    return {};
  }
}

const isSaveKey = (key: unknown): key is string =>
  typeof key === 'string' && key.startsWith(SAVE_PREFIX);

async function applyStorage(msg: Extract<BridgeMessage, { type: 'storage' }>) {
  if (msg.op === 'set' && isSaveKey(msg.key) && typeof msg.value === 'string') {
    await AsyncStorage.setItem(NATIVE_PREFIX + msg.key, msg.value);
  } else if (msg.op === 'remove' && isSaveKey(msg.key)) {
    await AsyncStorage.removeItem(NATIVE_PREFIX + msg.key);
  } else if (msg.op === 'snapshot' && msg.items && typeof msg.items === 'object') {
    // A full snapshot replaces every mirrored key, which also catches deletions.
    const existing = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(NATIVE_PREFIX));
    const next = Object.entries(msg.items).filter(([k, v]) => isSaveKey(k) && typeof v === 'string');
    const keep = new Set(next.map(([k]) => NATIVE_PREFIX + k));
    await AsyncStorage.multiRemove(existing.filter((k) => !keep.has(k)));
    if (next.length) await AsyncStorage.multiSet(next.map(([k, v]) => [NATIVE_PREFIX + k, v]));
  }
}

function playHaptic(style: HapticStyle = 'medium') {
  const S = Haptics.ImpactFeedbackStyle;
  const N = Haptics.NotificationFeedbackType;
  const impact: Partial<Record<HapticStyle, Haptics.ImpactFeedbackStyle>> = {
    light: S.Light, medium: S.Medium, heavy: S.Heavy, soft: S.Soft, rigid: S.Rigid,
  };
  const notify: Partial<Record<HapticStyle, Haptics.NotificationFeedbackType>> = {
    success: N.Success, warning: N.Warning, error: N.Error,
  };
  if (style === 'selection') return Haptics.selectionAsync();
  if (notify[style]) return Haptics.notificationAsync(notify[style]);
  return Haptics.impactAsync(impact[style] ?? S.Medium);
}

/** Handles one raw message string from the WebView. Unknown messages are ignored. */
export function handleBridgeMessage(raw: string) {
  let msg: BridgeMessage;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'storage') {
    applyStorage(msg).catch((e) => console.warn('[bridge] save failed', e));
  } else if (msg.type === 'haptic') {
    playHaptic(msg.style).catch(() => {}); // haptics are best effort
  }
}

const PAGE_CSS = [
  'html,body{overscroll-behavior:none;background:#10121a}',
  '*{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}',
  'input,textarea,[contenteditable]{-webkit-user-select:text;user-select:text}',
].join('');

/**
 * Script injected before any page content loads: restores saves, mirrors
 * localStorage writes, exposes haptics, and turns off zoom and text selection.
 */
export function buildInjectedScript(saves: SaveItems): string {
  return `(function () {
  var PREFIX = ${JSON.stringify(SAVE_PREFIX)};
  var post = function (m) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {}
  };

  // 1. Restore saves before the game reads them.
  var ls = null;
  try { ls = window.localStorage; } catch (e) {}
  if (ls) {
    var saves = ${JSON.stringify(saves)};
    for (var k in saves) { try { ls.setItem(k, saves[k]); } catch (e) {} }

    // 2. Mirror changes to native.
    var proto = Object.getPrototypeOf(ls);
    var setItem = proto.setItem, removeItem = proto.removeItem, clear = proto.clear;
    var isSave = function (key) { return typeof key === 'string' && key.indexOf(PREFIX) === 0; };
    proto.setItem = function (key, value) {
      setItem.call(this, key, value);
      key = String(key);
      if (this === ls && isSave(key)) post({ type: 'storage', op: 'set', key: key, value: String(value) });
    };
    proto.removeItem = function (key) {
      removeItem.call(this, key);
      key = String(key);
      if (this === ls && isSave(key)) post({ type: 'storage', op: 'remove', key: key });
    };
    var snapshot = function () {
      var items = {};
      for (var i = 0; i < ls.length; i++) {
        var key = ls.key(i);
        if (isSave(key)) items[key] = ls.getItem(key);
      }
      post({ type: 'storage', op: 'snapshot', items: items });
    };
    proto.clear = function () { clear.call(this); if (this === ls) snapshot(); };
    // Catches writes that bypass setItem (e.g. localStorage.foo = 1) when the app is backgrounded.
    document.addEventListener('visibilitychange', function () { if (document.hidden) snapshot(); });
    window.addEventListener('pagehide', snapshot);
  }

  // 3. Haptics helper for the game: StickClashNative.haptic('heavy').
  window.StickClashNative = {
    isApp: true,
    haptic: function (style) { post({ type: 'haptic', style: style || 'medium' }); }
  };

  // 4. No zoom, no selection or callouts.
  var addStyle = function () {
    var s = document.createElement('style');
    s.textContent = ${JSON.stringify(PAGE_CSS)};
    (document.head || document.documentElement).appendChild(s);
    var vp = document.querySelector('meta[name=viewport]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; (document.head || document.documentElement).appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addStyle);
  else addStyle();
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
})();
true;`;
}
