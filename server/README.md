# kuraat — server

The kuraat backend. The apps (web `client/`, later `mobile/`) talk **only** to this server; this server talks to the
**RSOF order system (ROF)** for the catalogue, branches and orders.

```
client / mobile  ──►  kuraat server (this app)  ──►  RSOF order system (ROF)
                      MySQL: accounts, addresses,      catalogue, branches,
                      cart, payments, notifications    orders, statuses
```

| Owned here (MySQL) | Read from / written to ROF |
|---|---|
| Customer accounts and login (WhatsApp code or password), profile | Categories, products, product details (custom fields) |
| Addresses with coordinates | Hub branches (location, phone) |
| Cart, prices, VAT, delivery fee | Order creation + branch assignment (from the pin we send) |
| Payments (simulated in UAT), saved cards (brand + last 4 only) | Order status, timeline, cancel, delivery-code resend |
| Notifications, delivery estimates, branch opening hours | |

Design: `docs/superpowers/specs/2026-11-15-rsof-uat-integration-design.md` (kept locally, outside git).
ROF reference: *Order Integration API Guide – Mobile App Backend* (PDF, kept outside git).

## Run locally

Requirements: Node.js 22.9+ (developed on 22.19), Docker Desktop (or any MySQL 8).

```bash
cd server
npm install
cp .env.example .env          # defaults work for local development
docker compose up -d          # MySQL 8.4 on localhost:3307 (databases kuraat + kuraat_test)
npm run db:migrate            # create tables
npm run mock-rof              # fake ROF on http://localhost:8080   (terminal 1)
npm run db:seed               # demo customer 50 123 4821 / Kuraat@2026 + PDF cart and past orders
npm run dev                   # API on http://localhost:4000/api/v1 (terminal 2)
```

The web app (`../client`) runs on top of this API; see its README for the demo guide.

Using WAMP's MySQL instead of Docker: create databases `kuraat` and `kuraat_test`, then point `DATABASE_URL` and
`TEST_DATABASE_URL` in `.env` at them.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `npm start` | API server (dev reloads on change). Also starts the order-status poller. |
| `npm run db:migrate` | Applies new migrations (`migrations/index.js` lists them in order). |
| `npm run db:seed` | Adds the demo customer if missing and, when the configured ROF has them, the PDF's demo extras once: the delivered orders KR-20377 / KR-20291, the PDF cart and notifications. Start the fake ROF first; against RSOF UAT the past orders are skipped (it says why). |
| `npm run mock-rof` | Fake ROF on `MOCK_ROF_PORT` (8080). State is saved in `mock-rof/data/state.json`; delete it to start over. |
| `npm run mock-rof:advance -- 20418 [Status]` | Plays branch staff: moves order KR-20418 to the next status (or the one given, e.g. `Canceled`). |
| `npm run rof:check [-- --write]` | Contract check against the configured ROF (see *Switching to UAT*). |
| `npm test` | All tests (needs the Docker MySQL; uses `kuraat_test`). |

### Settings (`.env`)

| Key | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `DATABASE_URL`, `TEST_DATABASE_URL` | Docker MySQL | `mysql://user:pass@host:port/db` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | — | 32+ random characters each; different per environment |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated web origins |
| `ROF_BASE_URL` | `http://localhost:8080` | **The switch**: fake ROF locally, `https://rofuat.rsof.com.sa` for UAT |
| `ROF_MEDIA_BASE_URL` | (= `ROF_BASE_URL`) | Base for product photo links the apps load. Set to the laptop's Wi-Fi address (e.g. `http://192.168.1.10:8080`) to test the mobile app on a phone; leave empty in UAT/production |
| `ROF_EMAIL`, `ROF_PASSWORD` | fake ROF login | The ROF service user (not tied to a branch) |
| `ROF_INVENTORY_CHECK` | `false` | `true` only if the service user has `Inventory.Read` |
| `ROF_TIMEOUT_MS` | `10000` | Per ROF call |
| `OTP_MODE`, `OTP_TEST_CODE` | `test`, `123456` | `test`: no WhatsApp message; the code is printed in the server log |
| `PRICES_INCLUDE_VAT` | `true` | Whether ROF `sellingPrice` already includes 15 % VAT |
| `ORDER_POLL_INTERVAL_MS` | `60000` | How often unfinished orders are re-read from ROF |
| `PASSWORD_HASH_COST` | `12` | bcrypt cost |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `20` | Per IP, for `/auth/*` |
| `TRUST_PROXY` | unset | Set to `1` when running behind one reverse proxy / load balancer (so limits use the customer IP) |
| `OTP_ALLOW_TEST_IN_PRODUCTION` | `false` | With `NODE_ENV=production` the server refuses `OTP_MODE=test` unless this is `true` — set it for UAT only |
| `MOCK_ROF_*` | | Fake ROF only: port, login, `MOCK_AUTO_ADVANCE_SECONDS` (moves orders on a timer for demos) |

Business rules ROF does not hold (fees, promo codes, opening hours, delivery slots, max detour) are in
[`src/config/business.js`](src/config/business.js).

## API (`/api/v1`)

All bodies are JSON. Signed-in routes need `Authorization: Bearer <accessToken>`. Every error is
`{ "message": "…", "code": "…", "field": "…" | null }` — show `message`, branch on `code`.

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Login | `POST /auth/otp/request` `{ phone, purpose: signup·signin·reset·change-phone·delete-account, payload? }` · `POST /auth/otp/resend` `{ challengeId }` · `POST /auth/otp/verify` `{ challengeId, code }` · `POST /auth/signup/password` · `POST /auth/signin` `{ phone, password }` · `POST /auth/password/reset` `{ verificationToken, newPassword }` · `POST /auth/refresh` `{ refreshToken }` · `POST /auth/signout` |
| Profile | `GET /me` · `PATCH /me` `{ name?, email?, gender?, avatar?, phone? + verificationToken }` · `PUT /me/password` · `PUT /me/location` `{ lat, lng }` → 204 (latest device location, sent once per app session; cleared on deletion) · `DELETE /me` `{ verificationToken }` |
| Addresses | `GET /addresses` · `POST /addresses` · `PATCH /addresses/:id` · `DELETE /addresses/:id` · `POST /addresses/:id/default` |
| Shop | `GET /categories` · `GET /products?categoryId&search` · `GET /products/:id` · `GET /branches` |
| Favourites, cards | `GET/PUT /favorites` · `GET /cards` · `DELETE /cards/:id` |
| Cart & checkout | `GET/PUT /cart` `{ items: [{ productId, qty }], promoCode? }` · `POST /checkout/quote` `{ addressId, productIds? }` |
| Orders | `POST /orders` `{ addressId, deliveryPhone, payment, idempotencyKey }` · `GET /orders?tab=ongoing·delivered·all&refresh=true` · `GET /orders/:id?refresh=true` (`refresh=true` = re-read ROF now, at most once per 10 s per customer) · `POST /orders/:id/cancel` · `POST /orders/:id/resend-code` |
| Notifications | `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all` |

Products: `{ id, name, description[], price, categoryId, categoryName, images[], inStock, maxQuantity, meta,
subtitle, badge, featured, highlights[{label,value}], ingredients, allergens[], details[{key,label,value}] }`.
`details` is filled only by `GET /products/:id` — RSOF sends custom-field definitions per product, not in lists.

Tokens: access token 15 minutes; refresh token 30 days, **rotated on every refresh** (keep the new one). Re-using an
old refresh token signs the user out everywhere.

Deleting an account (required by the App Store and Google Play): signed in, `POST /auth/otp/request` with
`purpose: delete-account` and the account's own number (else 400 `wrong_phone`), verify the code (→ `{ next: 'delete-account',
verificationToken }`), then `DELETE /me` → 204. Profile, addresses, cards, favourites, cart, notifications and sessions are
deleted; placed orders stay for RSOF's records with only the city of the address. Refused with 409 `order_in_progress` (already at the code request) while
an order is on its way, 400 `unverified` without a fresh verified code. The number can sign up again afterwards.

Placing an order: create a new `idempotencyKey` (UUID) when the payment screen opens and send the same key on every
retry — the server then never creates a second ROF order. A declined card can be retried with the same key.

Test payments (UAT): card `4242 4242 4242 4242` (any future expiry, any CVV) succeeds; `4000 0000 0000 0002` is
declined; cash on delivery. UPI is not offered (Saudi Arabia).

## How the ROF connection is built (for whoever switches to UAT)

Everything ROF-specific is in [`src/rof/`](src/rof):

| File | Role |
|---|---|
| `client.js` | One method per ROF endpoint (paths from the guide). Returns ROF's raw `data`. |
| `tokenManager.js` | Service-user login, shared by concurrent calls, renewed 5 min before expiry, re-login once after a 401. |
| `adapter.js` | ROF shapes → ours (and our order → ROF's create body). **The place to fix field differences.** |
| `fields.js` | The product custom-field keys we give a special place: the card line (pieces, weight), the three product-page tiles (weight, pieces, dimensions → `highlights`), `ingredients` and `allergens` (own section), subtitle, badge, featured. Every other field is a plain detail row. |
| `status.js` | The only status table: ROF status names **or codes** (0–19) → customer label, tracking step (delivery and pickup), filter group (`placed`, `attention`, `preparing`, `ready`, `on_the_way`, `completed`, `cancelled`), plus the cancel / resend-code rules. Order replies carry `status.{id, code, label, group, step, cancelled}`; customers never see ROF names. |
| `schemas.js`, `check.js` | What we expect ROF to return, and the contract check that compares it. |

ROF errors: `success:false` → `RofError('rejected')` with ROF's own message; timeouts, 5xx, unreachable →
`'unavailable'` (the app shows "We can't reach the store right now"; lists keep showing the last copy). An order whose
creation times out is **never re-sent**; its payment is marked `needs_review` and logged for manual reconciliation.

## Switching to UAT

1. RSOF sets up the kuraat tenant: hub branches (`branchType = 'hub'`, with latitude/longitude), products with images
   and custom fields, and a service user that is not tied to a branch.
2. In `.env`: `ROF_BASE_URL=https://rofuat.rsof.com.sa`, `ROF_EMAIL=…`, `ROF_PASSWORD=…`
   (and `ROF_INVENTORY_CHECK=true` if `Inventory.Read` is granted).
3. `npm run rof:check` — every line should be `OK`. A `MISMATCH` names the field; fix it in `src/rof/adapter.js` or
   `src/rof/fields.js` (e.g. if RSOF named the weight field `weight` instead of `weight_g`).
4. Optional, after agreeing with RSOF: `npm run rof:check -- --write` creates one test order, sends it a pin, reports
   whether RSOF auto-assigned it, reads it and cancels it.
5. Place one real order from the app and ask branch staff to move it through the statuses.

Assumptions to confirm on UAT (not shown in the guide): the inventory reply shape
`data: [{ branchId, quantity }]`, and the wording of resend-code refusals.

## Project layout

```
src/config      env.js (validated settings) · business.js (rules ROF does not hold)
src/http        app, errors ({message, code, field}), validation, auth middleware, rate limits
src/modules     auth · users · addresses · favorites · cards · notifications · catalog · branches ·
                cart · checkout · payments · orders
src/rof         ROF client, token, adapter, fields, status, schemas, contract check
src/jobs        orderPoller (status changes → notifications)
src/lib         Saudi time (UTC+3), distance, cache, ids
migrations/     database schema (Knex)
mock-rof/       the fake ROF (dev and tests only)
tests/          unit + API tests (Vitest + Supertest, real MySQL, in-process fake ROF)
```
