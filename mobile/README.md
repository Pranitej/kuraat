# kuraat — mobile (React Native, Expo)

The kuraat customer app for **Android and iOS**, built with Expo SDK 58 (React Native 0.88, New Architecture).
It talks to the same kuraat server API as the web app and shares its client logic file-for-file
(see `../PARITY.md`). Independent app: install, run and build from this folder.

> Work in progress — the full run guide, structure and release checklist are written as the screens land.

```bash
cd mobile
npm install
cp .env.example .env     # put your laptop's Wi-Fi IP in EXPO_PUBLIC_API_BASE_URL
npx expo start           # scan the QR code with Expo Go (Android / iOS)
```
