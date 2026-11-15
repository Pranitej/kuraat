# kuraat — web client

React web build of the kuraat mobile app designs (`../kuraat — Mobile App UI Screens.pdf`), used for the client demo
before the React Native app is built. It implements all 26 screens in the PDF, adapted for phones, tablets and desktop.

There is no backend yet: the `src/services/` layer simulates the API in the browser (realistic latency, validation,
errors) and keeps demo data in `localStorage`, so the demo survives refreshes.

## Run locally

Requirements: Node.js 22 LTS (developed on 22.19) and npm.

```bash
cd client
npm install
npm run dev        # development server → http://localhost:5173
npm run build      # production build → client/dist
npm run preview    # serve the production build → http://localhost:4173
```

`dist/` is a static single-page app. Deploy it to any static host and configure the host to serve `index.html`
for unknown paths (SPA fallback), because the app uses client-side routes such as `/products/truffle-box-classic`.

## Demo guide

| What | How |
|---|---|
| Sign in as the demo customer | Mobile **50 123 4821**, password **Kuraat@2026** |
| Sign in with WhatsApp code | Any 6 digits work (e.g. 482193). **000000** shows the "wrong code" error. |
| Create a new customer | Welcome → Create an account, with any Saudi mobile starting with 5 (e.g. 55 123 4567) |
| Promo codes | **KURAAT10** (10 % off), **FREEDELIVERY**, **WELCOME15** (first order only) |
| Card payment | Any valid test card, e.g. **4242 4242 4242 4242**, future expiry, any CVV |
| Declined payment | Card **4000 0000 0000 0002** |
| Branch chosen by stock | Add **Truffle Box · Praline**: it is out of stock at Corniche, so it ships from Dhahran (6.8 km) |
| Reset everything | Open **http://localhost:5173/?reset-demo**: restores the original demo data and signs out |

The demo customer starts with the PDF's cart (Truffle Box · Classic ×1, Butter Croissant Box ×2), three saved
addresses and two past orders. Checking out creates order **#KR-20418**, the order shown in the PDF. Its status moves
on in real time (Confirmed → Preparing → Out for delivery → Delivered), and the matching notifications appear.

## Project structure

```
client/
├── index.html
├── tailwind.config.js          Tailwind theme generated from src/theme/tokens.js
├── vite.config.js              "@/..." import alias → src/
└── src/
    ├── theme/tokens.js         Design tokens (colours, type scale, radii, shadows) — plain JS, copyable to mobile/
    ├── domain/                 Pure business logic, no React/DOM — pricing & VAT, delivery-branch selection,
    │                           delivery slots, order status, validation, password rules, formatting, catalogue,
    │                           branches, demo seed data
    ├── services/               API layer (currently simulated): auth, addresses, orders, payments,
    │                           notifications, cart. Swap these for real HTTP calls when server/ is ready.
    ├── context/                React state per domain (Auth, Cart, Favorites, Addresses, Orders,
    │                           Notifications, Checkout, Toast)
    ├── components/
    │   ├── ui/                 Design-system primitives (Button, Field, Chip, Tag, Toggle, Modal, …)
    │   ├── layout/             ScreenHeader, BottomBar, AuthLayout, AppBar (desktop), AppShell
    │   ├── shop/ branch/ checkout/ account/   Feature components
    ├── pages/                  One file per PDF screen (auth/, shop/, checkout/, account/)
    ├── routes/                 Route table + guards (signed-in only / signed-out only)
    ├── config/                 Route paths, shared option lists
    ├── hooks/                  Shared hooks (countdown, media query, scroll, delivery branch, …)
    ├── lib/                    Browser utilities (storage wrapper, class names)
    └── assets/images/          Logo and product photography (cropped from the client guide in the PDF)
```

### Connecting the real server

The UI never touches storage directly; it only calls `src/services/*` through the contexts. To go live:

1. Replace each service function with an HTTP call. Keep the same name, arguments and return shape
   (see `../server/README.md` for the contract).
2. Throw `ApiError` (`src/services/request.js`) with `{ code, field }` on validation errors, so forms show the message
   on the correct field.
3. Delete `src/services/db.js` and the seed in `src/domain/demo.js`.

Keep the rules in `src/domain/` (VAT, delivery fee, branch choice, delivery slot) in step with the server, or have
the server return those values.

## Notes for the React Native phase

- Start the mobile theme from a copy of `src/theme/tokens.js` and `src/domain/`. Neither uses browser APIs.
- Component names and props follow `DESIGN_SYSTEM.md` §E, so the RN primitives can mirror `src/components/ui/`.
- The brand font in production is **Bahij TheSansArabic** (licensed). This build uses the PDF's stand-ins,
  Source Sans 3 and Noto Sans Arabic, self-hosted via `@fontsource`.
