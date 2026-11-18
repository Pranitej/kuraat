# kuraat — web client

React web build of the kuraat mobile app designs (`../kuraat — Mobile App UI Screens.pdf`): all 26 screens in the
PDF, adapted for phones, tablets and desktop.

The app talks **only to the kuraat server API** (`../server`). The server owns accounts, addresses, the cart,
prices and payments, and reads the catalogue, branches and order status from the
RSOF order system (a local fake of it during development). Nothing but the login session and UI conveniences is
kept in the browser.

```
web app (this)  ──►  kuraat server API  ──►  RSOF order system (rofuat.rsof.com.sa for now)
```

## Run locally

Requirements: Node.js 22 LTS (developed on 22.19) and npm, plus the server running (see `../server/README.md`).

```bash
# 1. the server side (once: npm install, cp .env.example .env and fill in the RSOF login, docker compose up -d, npm run db:migrate)
cd server
npm run dev             # terminal 1 — API on :4000, talking to the RSOF in .env

# 2. the web app
cd client
npm install
npm run dev             # terminal 2 — http://localhost:5173
npm test                # unit tests (Vitest)
npm run build           # production build → client/dist
```

The API address comes from `VITE_API_BASE_URL` (default `http://localhost:4000/api/v1`; see `.env.example`). The
server must allow the web app's origin in its `CORS_ORIGINS`.

`dist/` is a static single-page app. Deploy it to any static host and configure the host to serve `index.html`
for unknown paths (SPA fallback), because the app uses client-side routes such as `/products/<id>`.

## Trying it out

Everything the shop shows comes from the real RSOF, so it is only as full as RSOF's products and stock.

| What | How |
|---|---|
| Create a customer | Welcome → Create an account, with any Saudi mobile starting with 5 (e.g. 55 123 4567). The WhatsApp code is always **123456** while the server runs in test mode (nothing is sent) |
| Sign in with a code | The test code is **123456**; any other code is "not correct" |
| Card payment | Payments are simulated until a gateway is chosen: **4242 4242 4242 4242**, future expiry, any CVV · declined: **4000 0000 0000 0002** · or cash on delivery / pay at the branch |
| Branch chosen by stock | RSOF picks the branch after the customer's pin is sent. With `ROF_INVENTORY_CHECK=true` the cart and delivery screens skip a nearer branch that is out of stock |
| Follow an order | RSOF staff move it through the statuses in the RSOF dashboard; the orders page refresh button (or the tracking screen within 30 s) picks it up |
| Cancel an order | Possible until the branch starts preparing it (tracking screen → Cancel order) |
| Delete the account | Account → Delete account → confirm → code 123456. Not possible while an order is on its way |

Orders placed on RSOF's test system (UAT) are real orders there: cancel the ones you do not need.

Times and dates are shown in the time zone of the device (browser or phone): the server sends UTC and each device converts it. Branch opening hours are a Saudi-time rule of the branch and shown as they are.

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
    │                           (auth, catalog, branches, addresses, cart + cartSync, checkout, orders)
    ├── context/                React state per area (Auth, Catalog, Branches, Cart, Addresses, Orders,
    │                           Checkout, Toast)
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
  of quiet, one save at a time, latest state wins). Totals and price/stock warnings come from the server's
  priced cart. The apps have no promo codes and always save the cart without one. "Continue" and "Pay" wait for pending saves.
- **Checkout**: the delivering branch and slot come from `POST /checkout/quote`. One idempotency key per checkout
  (kept in session storage) is sent with every "Pay", so retries never create a second order.
- **Orders**: status is read live from RSOF through the server; ongoing orders are re-read every 30 s.

Real map: the branch and address maps are still the drawn illustration (pins placed by distance rank); a real
map (Leaflet + OpenStreetMap) and address search are the next step.

## Keeping the web and mobile apps in sync

The mobile app (`../mobile`) shares this app's client logic as identical files: `src/domain/`, `src/services/`,
`src/theme/tokens.js`, `src/config/routes.js`, `src/config/options.js`, `src/hooks/useDeliveryQuote.js` and
`src/test/stubFetch.js`. Change them here, copy them to `mobile/src/`, and run `cd ../mobile && npm run parity`.
The only platform files they import are `src/lib/storage.js` (including `tokenStore`) and `src/lib/env.js`; each app
has its own. Every feature goes into both apps — see `../PARITY.md`.

## Notes

- The brand font in production is **Bahij TheSansArabic** (licensed). This build uses the PDF's stand-ins,
  Source Sans 3 and Noto Sans Arabic, self-hosted via `@fontsource`.
