# Voxel Regatta for iPhone

A small Expo app that runs the game full screen in a WebView, with haptic taps on perfect catches,
crabs and finishes (the browser can't vibrate on iOS; the app can).

```sh
npm run build:rowing          # at the repo root: builds rowing/dist/index.html
cd rowing/app
npm install
npm start                     # scan the QR code with Expo Go on your iPhone, or press i for the simulator
```

`npm start` copies the latest build into `game-html.js` first, so rebuild the game and restart to see changes.

How it fits together: `App.tsx` is the whole app (about 40 lines). The game posts short messages
(`perfect`, `crab`, `finish`) through `window.ReactNativeWebView` when it runs inside the app, and
`App.tsx` turns them into haptics. In a normal browser that object doesn't exist and nothing happens.
