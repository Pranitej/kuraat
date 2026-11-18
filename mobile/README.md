# kuraat — mobile (React Native, Expo)

The kuraat customer app for **Android and iOS**: all 26 screens of the design, native, on the same kuraat server API
as the web app. Built with Expo SDK 58 (React Native 0.88, React 19.3, New Architecture, Hermes, React Compiler).

Independent app: install, run and build from this folder. It shares its client logic with the web app file for file
(see [Keeping web and mobile in sync](#keeping-web-and-mobile-in-sync)).

```
mobile app (this)  ──►  kuraat server API  ──►  RSOF order system (fake locally, RSOF UAT later)
```

## Run it on your phone (Expo Go)

Requirements: Node.js 22 LTS, the server running on your laptop (`../server/README.md`), and the **Expo Go** app on an
Android phone (Play Store) or iPhone (App Store). Phone and laptop must be on the **same Wi‑Fi**.

1. Find the laptop's Wi‑Fi address — PowerShell: `ipconfig` → "IPv4 Address" (e.g. `192.168.1.25`).
2. Let the phone reach the API (once, PowerShell **as administrator**):
   ```powershell
   New-NetFirewallRule -DisplayName "kuraat API 4000" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
   ```
3. Configure and start:
   ```bash
   cd mobile
   npm install
   cp .env.example .env        # set EXPO_PUBLIC_API_BASE_URL=http://192.168.1.25:4000/api/v1
   npm start                   # opens in Expo Go; scan the QR code with Expo Go (Android) or the Camera (iPhone)
   ```
4. Create a customer (any Saudi mobile starting with 5; the test code is 123456), or sign in with one you made. See the web README's "Trying it out".

A phone cannot use `localhost` — that would be the phone itself. Check the address from the phone's browser:
`http://<laptop IP>:4000/api/v1/health` must answer `{"status":"ok"}`. If it does not, the firewall rule or Wi‑Fi
(guest networks often block devices from each other) is the problem. `npx expo start --go --tunnel` works across
networks for the app itself, but the API still has to be reachable from the phone.

After changing `.env`, restart with `npx expo start --go --clear`.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server for **Expo Go** (QR code) |
| `npm run start:dev-client` | Dev server for a development build (after the first EAS build) |
| `npm run check` | Everything CI runs: parity, types, lint, all tests |
| `npm test` | Logic tests (Vitest: shared domain/services + adapters) then UI tests (Jest + Testing Library) |
| `npm run parity` | Fails if a file shared with the web app differs from `../client/src` |
| `npm run typecheck` · `npm run lint` · `npm run format` | TypeScript, ESLint (Expo config), Prettier |
| `npm run doctor` | `expo-doctor` — dependency and config health |
| `npm run export:check` | Bundles Android and iOS JavaScript (catches import/bundling errors without a device) |

## Project structure

```
mobile/
├── app.config.ts            Variants (APP_VARIANT): development · preview · production — names, ids, API, OTA
├── eas.json                 EAS build/submit profiles (project @pranitejrsof/kuraat)
├── parity.json              Files that must equal ../client/src/* (checked by scripts/check-parity.mjs)
├── assets/                  App icon, Android adaptive icon, splash, brand images (scripts/make-icons.cjs)
└── src/
    ├── app/                 Routes (Expo Router). Thin files that re-export a screen; groups:
    │                        (auth) signed-out only · (app) signed-in only · verify, set-password either way
    ├── screens/             One file per PDF screen: auth/ shop/ checkout/ account/
    ├── components/
    │   ├── ui/              Design-system primitives (Button, Field, Chip, Dialog, BottomSheet, Toast, …)
    │   ├── layout/          Screen, ScreenHeader, BottomBar, AuthLayout, OfflineBanner, ErrorFallback
    │   ├── shop/ branch/ checkout/ account/   Feature components (same names as the web)
    │   └── icons.ts         The Lucide icons in use, imported one by one (small bundle)
    ├── context/             Data providers (same rules as the web's): auth, catalogue, branches, cart,
    │                        addresses, orders, checkout, toast
    ├── hooks/               App state, countdown, navigation, typed delivery-quote hook
    ├── lib/                 Platform files: storage.js (device store + keychain), env.js (API URL),
    │                        monitoring, linking, haptics, photo
    ├── domain/ services/    ← shared with the web app, byte for byte (do not edit here)
    ├── theme/               tokens.js (shared) → theme.ts (RN styles), fonts
    ├── types/api.ts         The server's response shapes
    └── test/                Test helpers (render with providers, fake server, router mock, native fakes)
```

### How it works

- **Data**: the server owns accounts, prices, VAT, stock, the delivering branch, payments and order status.
  The app never computes those itself.
- **Session**: access + refresh tokens in the **device keychain / keystore** (expo-secure-store); a 401 refreshes once
  (shared by parallel requests) and retries; a refused refresh signs out once.
- **Cart**: taps update at once and are saved in the background (300 ms of quiet, one save at a time, latest wins).
- **Checkout**: one idempotency key per checkout, reused on every "Pay" retry — never a second order.
- **Orders** refresh every 30 s while something is on its way **and the app is in front**, and when
  the app comes back to the front. Times are always Saudi time.
- **Offline**: a banner shows while the phone has no connection; requests fail with the shared "can't reach kuraat"
  message and screens offer "Try again".
- **Layout**: phone layout from the PDF; tablets get the same layout in a centred 640 pt column. Light theme,
  portrait, always left-to-right (also on Arabic-language phones), text scaling capped at 1.3×.

## Keeping web and mobile in sync

The rule (also in `../PARITY.md`): the server owns the business logic; client logic is shared as identical files;
every feature goes into both apps.

- Shared files (`parity.json`): `domain/`, `services/` (+ their tests), `theme/tokens.js`, `config/routes.js`,
  `config/options.js`, `hooks/useDeliveryQuote.js`, `test/stubFetch.js`. **Edit them in `client/src/`, copy them here,
  run `npm run parity`.** The only platform files they import are `lib/storage.js` and `lib/env.js`.
- Screens and providers are written per platform with the same names, copy and behaviour as the web's.
- CI (`.github/workflows/mobile.yml`) runs the parity check on every change to `mobile/` or the shared web files.

## Builds and release (EAS)

The app is linked to the EAS project **@pranitejrsof/kuraat** (`owner` and `extra.eas.projectId` in `app.config.ts`;
set `EAS_OWNER` / `EAS_PROJECT_ID` to point a build at another account's project). Check who the CLI is signed in as
before building — the project only builds under that account.

```bash
npx eas-cli@latest whoami                # must be pranitejrsof
npx eas-cli@latest login --device        # sign in by approving a code in the browser (works without a password prompt)
npm run check:fingerprint               # must pass before any EAS build (see "API address" below)
# development build (replaces Expo Go; loads JS from `npm run start:dev-client`, API from mobile/.env):
npx eas-cli@latest build --profile development --platform android
# internal Android test build (APK) against UAT — first set EXPO_PUBLIC_API_BASE_URL for the preview
# profile (eas.json "env", or `npx eas-cli@latest env:create`); a variable set only in your terminal does NOT reach EAS:
npx eas-cli@latest build --profile preview --platform android
# store builds:
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform android   # then ios
```

| Variant | App name · id | API | Build |
|---|---|---|---|
| development | kuraat (dev) · `com.rsof.kuraat.dev` | laptop LAN (http allowed) | Expo Go / development build |
| preview | kuraat (preview) · `com.rsof.kuraat.preview` | UAT (https only) | internal APK / TestFlight |
| production | kuraat · `com.rsof.kuraat` | production (https only) | AAB (Play) / IPA (App Store) |

Versions: `version` in `app.config.ts`; build numbers and version codes are kept by EAS (`appVersionSource: remote`).
Over-the-air JS updates (expo-updates) use the native fingerprint as runtime version, so an update never reaches a
binary it doesn't fit.

**API address and the runtime version.** EAS recomputes the fingerprint from the uploaded files, and `mobile/.env` is
git-ignored, so it never reaches EAS. Anything machine-local must therefore stay out of the native config: the API
address is read from `EXPO_PUBLIC_API_BASE_URL` in the JS bundle (`src/lib/env.js`), not from `app.config.ts` `extra`.
When it was in `extra`, the first development build failed with "Runtime version mismatch" (17 Nov 2026).
`npm run check:fingerprint` resolves the runtime version with two different addresses and fails if they differ —
run it after any change to `app.config.ts`.

### Release checklist (outside the code)

- [x] Expo account (pranitejrsof, 2026-11-17). Apple Developer Program and Google Play Console accounts — decide the owner (RSOF or the
      brand) and confirm the final application id **before the first store upload** (it cannot change afterwards).
- [ ] Hosted UAT and production API over HTTPS; RSOF UAT tenant + login (`../server/README.md` → Switching to UAT).
- [ ] Real payment gateway (and its SDK or hosted page) instead of the simulated payments.
- [ ] Public privacy-policy URL, terms URL, and an account-deletion help page (Google Play asks for it).
- [ ] Play "Data safety" and App Store privacy answers (name, phone, email, addresses, order history, optional photo;
      no tracking, no ads).
- [ ] Store listing: texts, screenshots (phone), feature graphic, support email/phone, age rating.
- [ ] Vector app icon from the brand owner (the current icon is generated from the wordmark's "k");
      licensed Bahij TheSansArabic font files if production should use the brand font.
- [ ] Crash reporting account (e.g. Sentry) — wire it in `src/lib/monitoring.ts`.
- [ ] Device pass on several Android phones (small screen, large font, Arabic system language) and an iPhone.

Delete account (required by both stores) is built: Account → Delete account → WhatsApp code.

## Troubleshooting

- **"We can't reach kuraat right now"** on the phone: wrong `EXPO_PUBLIC_API_BASE_URL`, firewall, or the server is not
  running — open `http://<laptop IP>:4000/api/v1/health` on the phone.
- **QR opens a "development build" screen**: start with `npm start` (Expo Go), not `npx expo start`.
- **Windows: `Cannot find native binding` from Vitest** after installing a single package: npm skipped an optional
  dependency — delete `node_modules` and `package-lock.json` and run `npm install` again.
