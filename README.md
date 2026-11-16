# kuraat

Ordering app for **kuraat** — fresh truffles, cakes and pastries delivered from the branch nearest to the customer.

The repository holds three **independent** applications. Each has its own `package.json`, dependencies,
assets and configuration, and is installed, built and deployed on its own — nothing is shared at runtime.

```
kuraat/
├── client/            React web app (ReactJS + Tailwind CSS) — the mobile UI on the web
├── mobile/            React Native app (next phase)
├── server/            Backend API (Node.js + MySQL) — talks to the RSOF order system (ROF)
└── DESIGN_SYSTEM.md   UI/UX specification: tokens, components, 26 screens, flows, rules
```

Kept locally, outside git: the two source PDFs (the UI screens and RSOF's *Order Integration API Guide*),
the design and implementation-plan documents (`docs/`) and the test-credentials sheets (`TEST_CREDENTIALS.md`).

| App | Status | Start here |
|---|---|---|
| `client/` | All 26 screens, running on the server API (no data in the browser); real map still to come | [client/README.md](client/README.md) |
| `server/` | Built and tested against a local fake ROF; ready for RSOF UAT once the kuraat tenant and login exist | [server/README.md](server/README.md) |
| `mobile/` | Not started (follows client approval) | [mobile/README.md](mobile/README.md) |

## Quick start

```bash
# Backend (see server/README.md for details)
cd server && npm install && cp .env.example .env
docker compose up -d && npm run db:migrate
npm run mock-rof      # terminal 1 — fake RSOF order system
npm run db:seed       # demo customer + PDF past orders and cart (needs the fake RSOF running)
npm run dev           # terminal 2 — API on http://localhost:4000/api/v1

# Web client (talks only to the API above)
cd client && npm install && npm run dev      # http://localhost:5173
```

Local URLs, test logins, cards and database access are listed in a local `TEST_CREDENTIALS.md` (not committed).
