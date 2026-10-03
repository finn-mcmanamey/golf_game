# Stick Clash for iPhone

A small Expo (React Native) app that runs the Stick Clash browser game full screen, offline.
The game's single HTML file is copied into the app, so no internet is needed to play.

## Run it on your iPhone

You need Node.js 20+ on your computer and the free **Expo Go** app on your iPhone.

1. Build the game (in the game folder, one level up):
   ```sh
   cd ..
   node build.mjs          # makes dist/stick-clash.html
   cd mobile
   ```
2. Install the app's packages (once, or after `package.json` changes):
   ```sh
   npm install
   ```
3. Copy the latest game into the app (do this every time you rebuild the game):
   ```sh
   npm run sync
   ```
4. Start the dev server and scan the QR code with the iPhone camera:
   ```sh
   npx expo start
   ```
   Phone and computer must be on the same Wi-Fi. If they can't see each other, use `npx expo start --tunnel`.

`npm start` does steps 3 and 4 together.

## What the app adds

- Landscape only, full screen, no status bar, screen stays awake.
- Saves: any `localStorage` key starting with `stickclash` is also kept in the app's own storage,
  so saves survive iOS clearing web data.
- Vibration: the game can call `window.StickClashNative?.haptic('heavy')`
  (styles: `light`, `medium`, `heavy`, `soft`, `rigid`, `success`, `warning`, `error`, `selection`).
  In a normal browser `StickClashNative` is undefined, so the `?.` makes it safe to call anywhere.

## Useful commands

| Command | What it does |
|---|---|
| `npm run sync` | Copy `../dist/stick-clash.html` into `src/generated/` |
| `npm run typecheck` | Check the TypeScript |
| `npm run export:ios` | Bundle the app for iOS without a phone (a quick "does it build" check) |
| `npm run icons` | Redraw the icon and splash image in `assets/` |

## Putting it on the App Store (EAS and TestFlight)

Expo's cloud service, **EAS**, builds the real iOS app for you; no Mac needed.
You need an Apple Developer account (paid, yearly).

1. Change `ios.bundleIdentifier` in `app.json` from `com.example.stickclash` to your own,
   e.g. `com.yourname.stickclash`. It must be unique on the App Store.
2. Run `npm run sync` so the latest game is inside the app.
3. Sign in and build:
   ```sh
   npx eas-cli@latest login
   npx eas-cli@latest build --platform ios --profile production
   ```
   EAS walks you through Apple sign-in and certificates the first time.
4. Send it to TestFlight:
   ```sh
   npx eas-cli@latest submit --platform ios --latest
   ```
   Then add testers in App Store Connect → TestFlight.

The `.easignore` file makes sure the copied game (`src/generated/`) is uploaded to EAS,
even though git ignores it.
