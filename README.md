# kuraat

Ordering app for **kuraat** — fresh truffles, cakes and pastries delivered from the branch nearest to the customer.

The repository holds three **independent** applications. Each has its own `package.json`, dependencies,
assets and configuration, and is installed, built and deployed on its own — nothing is shared at runtime.

```
kuraat/
├── client/                              React web app (ReactJS + Tailwind CSS) — client demo of the mobile UI
├── mobile/                              React Native app (next phase)
├── server/                              Backend API (to be added)
├── DESIGN_SYSTEM.md                     UI/UX specification for all three: tokens, components, 26 screens, flows, rules
└── kuraat — Mobile App UI Screens.pdf   Source of truth for the UI
```

| App | Status | Start here |
|---|---|---|
| `client/` | Complete — all 26 screens, frontend-only demo data | [client/README.md](client/README.md) |
| `mobile/` | Not started (follows client approval) | [mobile/README.md](mobile/README.md) |
| `server/` | Not started | [server/README.md](server/README.md) — API contract expected by the client |

## Quick start (web client)

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

Demo sign-in: mobile **50 123 4821**, password **Kuraat@2026** (or choose "Get a code on WhatsApp" and enter any 6 digits).
