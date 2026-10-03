// Stick Clash: one full-screen WebView running the bundled, offline game.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { GAME_HTML } from './src/generated/gameHtml';
import { buildInjectedScript, handleBridgeMessage, loadSaves, type SaveItems } from './src/bridge';

const BACKGROUND = '#10121a';
// A fake https origin gives the page a real, stable origin (so localStorage works).
// Nothing is ever fetched from it: the game is one self-contained file.
const BASE_URL = 'https://stickclash.local/';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useKeepAwake();
  const [saves, setSaves] = useState<SaveItems | null>(null);
  const [session, setSession] = useState(0);

  // Restore saves before the WebView exists, so they can be injected up front.
  const restoreAndMount = useCallback(() => {
    loadSaves().then((items) => {
      setSaves(items);
      setSession((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    restoreAndMount();
  }, [restoreAndMount]);

  const injected = useMemo(() => (saves ? buildInjectedScript(saves) : ''), [saves]);

  const onMessage = useCallback((e: WebViewMessageEvent) => handleBridgeMessage(e.nativeEvent.data), []);

  // Keep the game inside the app; open any real web link in Safari instead.
  const onShouldStartLoad = useCallback((req: ShouldStartLoadRequest) => {
    const url = req.url;
    if (url.startsWith(BASE_URL) || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) {
      return true;
    }
    if (/^(https?|mailto):/i.test(url)) Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar hidden style="light" />
      {saves && (
        <WebView
          key={session}
          style={styles.web}
          source={{ html: GAME_HTML, baseUrl: BASE_URL }}
          originWhitelist={['about:*', 'https://stickclash.local', 'data:*', 'blob:*']}
          onShouldStartLoadWithRequest={onShouldStartLoad}
          injectedJavaScriptBeforeContentLoaded={injected}
          onMessage={onMessage}
          onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
          // iOS may kill the web process in the background; reload with fresh saves.
          onContentProcessDidTerminate={restoreAndMount}
          onRenderProcessGone={restoreAndMount}
          // Media and audio.
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsAirPlayForMediaPlayback={false}
          // A game, not a page: no scrolling, bouncing, zooming, selection or link previews.
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          setBuiltInZoomControls={false}
          textInteractionEnabled={false}
          allowsLinkPreview={false}
          dataDetectorTypes="none"
          allowsBackForwardNavigationGestures={false}
          setSupportMultipleWindows={false}
          keyboardDisplayRequiresUserAction={false}
          hideKeyboardAccessoryView
          // Safari Web Inspector in development only.
          webviewDebuggingEnabled={__DEV__}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  web: { flex: 1, backgroundColor: BACKGROUND },
});
