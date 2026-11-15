# kuraat

Ordering app for **kuraat** — fresh truffles, cakes and pastries delivered from the branch nearest to the customer.

The repository holds three **independent** applications. Each has its own `package.json`, dependencies,
assets and configuration, and is installed, built and deployed on its own — nothing is shared at runtime.

```
kuraat/
├── client/            React web app (ReactJS + Tailwind CSS) — the mobile UI on the web
├── mobile/            React Native app (next phase)
├── server/            Backend API (Node.js + MySQL) — talks to the RSOF order system (ROF)
├── docs/              Designs and implementation plans
└── DESIGN_SYSTEM.md   UI/UX specification: tokens, components, 26 screens, flows, rules
```

The two source PDFs (the UI screens and RSOF's *Order Integration API Guide*) are kept locally, outside git.

| App | Status | Start here |
|---|---|---|
| `client/` | All 26 screens; still uses browser demo data — switching to the server is next | [client/README.md](client/README.md) |
| `server/` | Built and tested against a local fake ROF; ready for RSOF UAT once the kuraat tenant and login exist | [server/README.md](server/README.md) |
| `mobile/` | Not started (follows client approval) | [mobile/README.md](mobile/README.md) |

## Quick start

```bash
# Backend (see server/README.md for details)
cd server && npm install && cp .env.example .env
docker compose up -d && npm run db:migrate && npm run db:seed
npm run mock-rof      # terminal 1 — fake RSOF order system
npm run dev           # terminal 2 — API on http://localhost:4000/api/v1

# Web client
cd client && npm install && npm run dev      # http://localhost:5173
```

Test logins and cards: [client/TEST_CREDENTIALS.md](client/TEST_CREDENTIALS.md).
