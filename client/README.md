# kuraat — web client

React web build of the kuraat mobile app designs (`../kuraat — Mobile App UI Screens.pdf`): all 26 screens in the
PDF, adapted for phones, tablets and desktop.

The app talks **only to the kuraat server API** (`../server`). The server owns accounts, addresses, the cart,
prices, promo codes, payments and notifications, and reads the catalogue, branches and order status from the
RSOF order system (a local fake of it during development). Nothing but the login session and UI conveniences is
kept in the browser.

```
web app (this)  ──►  kuraat server API  ──►  RSOF order system (fake locally, RSOF UAT later)
```

## Run locally

Requirements: Node.js 22 LTS (developed on 22.19) and npm, plus the server running (see `../server/README.md`).

```bash
# 1. the server side (once: npm install, cp .env.example .env, docker compose up -d, npm run db:migrate)
cd server
npm run mock-rof        # terminal 1 — fake RSOF on :8080
npm run db:seed         # demo customer, PDF cart and past orders (needs the fake RSOF running)
npm run dev             # terminal 2 — API on :4000

# 2. the web app
cd client
npm install
npm run dev             # terminal 3 — http://localhost:5173
npm test                # unit tests (Vitest)
npm run build           # production build → client/dist
```

The API address comes from `VITE_API_BASE_URL` (default `http://localhost:4000/api/v1`; see `.env.example`). The
server must allow the web app's origin in its `CORS_ORIGINS`.

`dist/` is a static single-page app. Deploy it to any static host and configure the host to serve `index.html`
for unknown paths (SPA fallback), because the app uses client-side routes such as `/products/<id>`.

## Demo guide

| What | How |
|---|---|
| Sign in as the demo customer | Mobile **50 123 4821**, password **Kuraat@2026** |
| Sign in with WhatsApp code | The test code is always **123456** (nothing is sent in test mode); any other code is "not correct" |
| Create a new customer | Welcome → Create an account, with any Saudi mobile starting with 5 (e.g. 55 123 4567) |
| Promo codes | **KURAAT10** (10 % off), **FREEDELIVERY**, **WELCOME15** (first order only — the demo customer already has orders) |
| Card payment | **4242 4242 4242 4242**, future expiry, any CVV · declined: **4000 0000 0000 0002** · or UPI `name@bank`, or cash |
| Branch chosen by stock | Order **Truffle Box · Praline**: it is out of stock at Corniche, so the order ships from Dhahran. The cart and delivery screens say so in advance only when the server's `ROF_INVENTORY_CHECK` is on |
| Move an order along | `cd server && npm run mock-rof:advance -- 20418` (next status) or `… 20418 OutForDelivery`; the tracking screen follows within 30 s |
| Cancel an order | Possible until the branch starts preparing it (tracking screen → Cancel order) |
| Start over | Stop the fake RSOF, delete `server/mock-rof/data/state.json`, start it again, then remove the demo customer from the `kuraat` database (or recreate the database) and run `npm run db:seed` |

The demo customer starts with the PDF's cart (Truffle Box · Classic ×1, Butter Croissant Box ×2), three saved
addresses, the two delivered orders **#KR-20377** and **#KR-20291**, and the PDF notifications. The next order is
**#KR-20418**, the order shown in the PDF.

Times are always shown in Saudi time (UTC+3), whatever the device's time zone.

## Project structure

```
client/
├── index.html
├── tailwind.config.js          Tailwind theme generated from src/theme/tokens.js
├── vite.config.js              "@/..." import alias → src/
├── vitest.config.js            unit tests (run in America/New_York to catch time-zone mistakes)
└── src/
    ├── theme/tokens.js         Design tokens (colours, type scale, radii, shadows) — plain JS, copyable to mobile/
    ├── domain/                 Pure display/form logic for the server's data — Saudi-time formatting,
    │                           validation, password rules, catalogue / cart / order / branch views
    ├── services/               The API layer: api.js (HTTP, tokens, refresh, ApiError) + one file per area
    │                           (auth, catalog, branches, addresses, cart + cartSync, checkout, orders,
    │                           notifications)
    ├── context/                React state per area (Auth, Catalog, Branches, Cart, Favorites, Addresses,
    │                           Orders, Notifications, Checkout, Toast)
    ├── components/
    │   ├── ui/                 Design-system primitives (Button, Field, Chip, Tag, Toggle, Modal, …)
    │   ├── layout/             ScreenHeader, BottomBar, AuthLayout, AppBar (desktop), AppShell
    │   ├── shop/ branch/ checkout/ account/   Feature components
    ├── pages/                  One file per PDF screen (auth/, shop/, checkout/, account/)
    ├── routes/                 Route table + guards (signed-in only / signed-out only)
    ├── config/                 Route paths, shared option lists
    ├── hooks/                  Shared hooks (countdown, media query, delivery quote, …)
    ├── lib/                    Browser utilities (storage wrapper, class names)
    └── assets/images/          Logo and the two brand photos (product photos come from the server)
```

### How the app uses the server

- **One HTTP client** (`services/api.js`): JSON, `Authorization: Bearer`, server errors as
  `ApiError(message, { code, field, status })` so forms put the message on the right field. A 401 refreshes the
  session once (shared by parallel requests) and retries; if that fails the app signs out.
- **Session**: access + refresh token in local storage (key `kuraat:v1:auth`); restored with `GET /me` at start.
- **Cart**: taps change the screen at once and are saved in the background (`services/cartSync.js`: after 300 ms
  of quiet, one save at a time, latest state wins). Totals, promo results and price/stock warnings come from the
  server's priced cart. "Continue" and "Pay" wait for pending saves.
- **Checkout**: the delivering branch and slot come from `POST /checkout/quote`. One idempotency key per checkout
  (kept in session storage) is sent with every "Pay", so retries never create a second order.
- **Orders**: status is read live from RSOF through the server; ongoing orders are re-read every 30 s.

Real map: the branch and address maps are still the drawn illustration (pins placed by distance rank); a real
map (Leaflet + OpenStreetMap) and address search are the next step.

## Notes for the React Native phase

- Start the mobile theme from a copy of `src/theme/tokens.js` and `src/domain/`. Neither uses browser APIs.
- `src/services/` works unchanged once `src/lib/storage.js` is swapped for AsyncStorage/MMKV.
- Component names and props follow `DESIGN_SYSTEM.md` §E, so the RN primitives can mirror `src/components/ui/`.
- The brand font in production is **Bahij TheSansArabic** (licensed). This build uses the PDF's stand-ins,
  Source Sans 3 and Noto Sans Arabic, self-hosted via `@fontsource`.
