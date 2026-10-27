// Voxel Regatta on iPhone: the whole game is one HTML file, shown full screen in a WebView.
// The game calls window.ReactNativeWebView.postMessage(...) for moments worth a haptic tap.
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import html from './game-html';

const haptics: Record<string, () => Promise<void>> = {
  perfect: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  crab: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  finish: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};

const onMessage = ({ nativeEvent }: WebViewMessageEvent) => haptics[nativeEvent.data]?.();

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <WebView
        // A fixed origin keeps saves (localStorage) between launches.
        source={{ html, baseUrl: 'https://voxel-regatta.app/' }}
        originWhitelist={['*']}
        onMessage={onMessage}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        bounces={false}
        style={styles.root}
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#0d1b2e' } });
