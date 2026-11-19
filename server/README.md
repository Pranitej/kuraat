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
| Addresses (coordinates only if the customer shared their location — optional) | Hub branches (location, phone) |
| Cart and product prices (no delivery fee, VAT or promo codes) | Order creation + branch assignment (from the pin, only when the customer shared one; otherwise RSOF asks them) |
| Which payment the customer chose, and "paid" once RSOF says so | Order status, timeline, cancel, delivery-code resend |
| | Card payments: RSOF's payment link (`POST /api/v1/orders/payment-link`, `X-Api-Key`) — the customer pays on RSOF's page |
| Notifications, delivery estimates, branch opening hours | |

Design: `docs/superpowers/specs/2026-11-15-rsof-uat-integration-design.md` (kept locally, outside git).
ROF reference: *Order Integration API Guide – Mobile App Backend* (PDF, kept outside git).

## Run locally

Requirements: Node.js 22.9+ (developed on 22.19), Docker Desktop (or any MySQL 8).

```bash
cd server
npm install
cp .env.example .env          # then fill in ROF_EMAIL and ROF_PASSWORD (ask RSOF)
docker compose up -d          # MySQL 8.4 on localhost:3307 (databases kuraat + kuraat_test)
npm run db:migrate            # create tables
npm run dev                   # API on http://localhost:4000/api/v1, talking to the RSOF in .env
```

There is no local stand-in for RSOF: the API always talks to the real RSOF set in `.env`. The web app
(`../client`) runs on top of this API; see its README for how to try it.

Using WAMP's MySQL instead of Docker: create databases `kuraat` and `kuraat_test`, then point `DATABASE_URL` and
`TEST_DATABASE_URL` in `.env` at them.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `npm start` | API server (dev reloads on change). Also starts the order-status poller. |
| `npm run db:migrate` | Applies new migrations (`migrations/index.js` lists them in order). |
| `npm run rof:check [-- --write]` | Contract check against the configured RSOF (see *Connecting to RSOF*). `--write` creates and cancels two real test orders there. |
| `npm test` | All tests (needs the Docker MySQL; uses `kuraat_test`). They never reach RSOF: an in-process stand-in in `tests/support/rof-double/` answers, and the RSOF settings are pinned in `vitest.config.js`. |

### Settings (`.env`)

| Key | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `DATABASE_URL`, `TEST_DATABASE_URL` | Docker MySQL | `mysql://user:pass@host:port/db` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | — | 32+ random characters each; different per environment |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated web origins |
| `ROF_BASE_URL` | — | The RSOF to talk to: `https://rofuat.rsof.com.sa` for UAT |
| `ROF_MEDIA_BASE_URL` | (= `ROF_BASE_URL`) | Base for product photo links the apps load. Leave empty: RSOF's own address is right for phones and browsers |
| `ROF_EMAIL`, `ROF_PASSWORD` | — | The RSOF login the server uses (ideally a service user not tied to a branch). Never commit it |
| `ROF_INVENTORY_CHECK` | `false` | `true` only if the service user has `Inventory.Read`; checkout then skips a nearer branch that is out of stock, with one `GET /api/inventory/balances` call |
| `ROF_TIMEOUT_MS` | `10000` | Per ROF call (20000 suits UAT) |
| `OTP_MODE`, `OTP_TEST_CODE` | `test`, `123456` | `test`: no WhatsApp message; the code is printed in the server log |
| `WHATSAPP_API_USER`, `WHATSAPP_API_PASSWORD`, `WHATSAPP_SENDER`, `WHATSAPP_TEMPLATE_NAME` | — | Needed only with `OTP_MODE=whatsapp`: a random 6-digit code is sent through RSOF's messaging API (`POST /messaging/auth/token`, then `POST /messaging/send_template_message` with the approved AUTHENTICATION template). The server refuses to start in that mode if any is missing. The real user/password stay in `.env`, never in git. While RSOF's WhatsApp number is in testing it can message only the numbers RSOF allowed; any other number fails with "We can't send WhatsApp codes right now" and nothing is stored |
| `WHATSAPP_API_BASE_URL`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_TIMEOUT_MS` | `https://app.rofconsole.com/messaging`, `en`, `10000` | The messaging API address, the template language, and the timeout per call |
| `ORDER_POLL_INTERVAL_MS` | `60000` | How often unfinished orders are re-read from ROF |
| `PASSWORD_HASH_COST` | `12` | bcrypt cost |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `20` | Per IP, for `/auth/*` |
| `TRUST_PROXY` | unset | Set to `1` when running behind one reverse proxy / load balancer (so limits use the customer IP) |
| `OTP_ALLOW_TEST_IN_PRODUCTION` | `false` | With `NODE_ENV=production` the server refuses `OTP_MODE=test` unless this is `true` — set it for UAT only |
| `ROF_API_KEY` | unset | RSOF API key (`X-Api-Key` on RSOF's key-based endpoints; today the payment-link call, so it needs the `payments.link` scope), for online payments (the "card" payment method id; RSOF's payment page decides which payment options exist). Unset, or RSOF's payment-link API not answering (checked at most once a minute with a request that matches no order) → card is shown as unavailable and refused before anything is created; cash on delivery and pay at branch still work. Never commit it |

Business rules ROF does not hold (fees, promo codes, opening hours, delivery slots, max detour) are in
[`src/config/business.js`](src/config/business.js).

## API (`/api/v1`)

All bodies are JSON. Signed-in routes need `Authorization: Bearer <accessToken>`. Every error is
`{ "message": "…", "code": "…", "field": "…" | null }` — show `message`, branch on `code`.

| Area | Endpoints |
|---|---|
| Health | `GET /health` |
| Login | `POST /auth/otp/request` `{ phone, purpose: signup·signin·reset·delete-account, payload? }` · `POST /auth/otp/resend` `{ challengeId }` · `POST /auth/otp/verify` `{ challengeId, code }` · `POST /auth/signup/password` · `POST /auth/signin` `{ phone, password }` · `POST /auth/password/reset` `{ verificationToken, newPassword }` · `POST /auth/refresh` `{ refreshToken }` · `POST /auth/signout` |
| Profile | `GET /me` · `PATCH /me` `{ name?, email?, gender?, avatar? }` (the mobile number is fixed once the account exists: a different `phone` → 400 `phone_locked`) · `PUT /me/password` · `PUT /me/location` `{ lat, lng }` → 204 (latest device location, sent once per app session; cleared on deletion) · `DELETE /me` `{ verificationToken }` |
| Addresses | `GET /addresses` · `POST /addresses` · `PATCH /addresses/:id` · `DELETE /addresses/:id` · `POST /addresses/:id/default` |
| Shop | `GET /categories` · `GET /products?categoryId&search` · `GET /products/:id` · `GET /branches` |
| Favourites, cards | `GET/PUT /favorites` · `GET /cards` · `DELETE /cards/:id` |
| Cart & checkout | `GET/PUT /cart` `{ items: [{ productId, qty }] }` · `GET /checkout/payment-options` → `{ card: boolean }` (card works right now) · `POST /checkout/quote` `{ fulfilment?: 'delivery'·'pickup', addressId (delivery), productIds?, location? }` (pickup: nearest-hub estimate from the request, else the last known location, else the usual address — plus the stored cart priced from RSOF prices) |
| Orders | `POST /orders` `{ fulfilment?: 'delivery'·'pickup', addressId (delivery only), payment, idempotencyKey — the order always carries the account's mobile number; a `deliveryPhone` sent by an older app is ignored }` (delivery pays `{ method: 'card' }` or `{ method: 'cod' }`; pickup — no address — pays card or `{ method: 'branch' }`) · `GET /orders?tab=ongoing·delivered·all&refresh=true` · `GET /orders/:id?refresh=true` (`refresh=true` = re-read ROF now, at most once per 10 s per customer) · `POST /orders/:id/pay` → `{ status: 'pending', link, expiresAt, amount, currency }` or `{ status: 'paid' }` (card orders placed in the app) · `POST /orders/:id/cancel` · `POST /orders/:id/resend-code` |
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
retry — the server then never creates a second ROF order.

Online payment (19 Nov 2026) — kept simple on purpose: RSOF is the master of orders AND of the money, so the kuraat
server only opens RSOF's payment page and never tracks, checks or shows whether the customer paid:
1. `POST /orders` with `payment: { method: 'card' }` (the id of "pay online") creates the order in RSOF (it needs the order
   number for the link), then asks RSOF for the payment link ONCE. The reply's `payment` is
   `{ status: 'online', link, linkExpiresAt }` (`link` null if RSOF had none). The app opens `link`.
2. After paying, the apps only say "check your payment status on the Orders page", which shows RSOF's own order status.
   The kuraat server never asks RSOF again about the payment: no "paid" state, no payment notification, no refund state.
3. `POST /orders/:id/pay` → `{ link, expiresAt }`: a payment page again (the Pay button when the order reply had none).
   RSOF answers `NotReady` → 503 `payment_not_ready`; `Error`, RSOF down or the key refused → 503 `payment_unavailable`;
   `AlreadyPaid` / `NoPayableOrder` → 409 `not_payable` ("Please check the Orders page for your payment status.").
4. `GET /checkout/payment-options` → `{ card }`: the one other RSOF call — a cached check (5 min when on, 1 min when off)
   that online payment really works (key set, RSOF's payment gateway set up). Off → the apps grey it out.
5. Cancelling an order: the payment record is voided and the message says "If you already paid online, the store will handle
   your refund." (RSOF decides about the money).
`payment.status` in order replies: `online` · `later` (cash / at branch) · `cancelled` (how the customer pays — never whether they paid). Whether they paid is RSOF's own `paymentStatus`, passed through on the order as `paymentStatus: { code, label } | null` (e.g. `Paid` / `Payment pending` / `Payment failed`; null until RSOF has one) and shown on the order details only — it arrives with the order read we already make, so no extra RSOF call. An older app build that still sends
card details is refused ("Please update the app"). UPI is not offered (Saudi Arabia).

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

## Connecting to RSOF

1. RSOF sets up the kuraat tenant: hub branches (`branchType = 'hub'`, with latitude/longitude), products with images
   and custom fields, and a service user that is not tied to a branch.
2. Put these in `.env` (git-ignored): `ROF_BASE_URL=https://rofuat.rsof.com.sa`, `ROF_EMAIL=…`, `ROF_PASSWORD=…`, and
   `ROF_INVENTORY_CHECK=true` if `Inventory.Read` is granted.
3. `npm run rof:check` — every line should be `OK`. A `MISMATCH` names the field; fix it in `src/rof/adapter.js` or
   `src/rof/fields.js` (e.g. if RSOF named the weight field `weight` instead of `weight_g`).
4. Optional, after agreeing with RSOF: `npm run rof:check -- --write` creates **two** test orders (one delivery, one
   pickup), sends each a pin, reports whether RSOF auto-assigned them, reads them and cancels them. RSOF does not check
   stock when an order is created, so they are created even with no stock.
5. Place one real order from the app and ask branch staff to move it through the statuses.

**Verified on the real UAT (18 Nov 2026, phase 4):** login and the token; categories, products (list and detail), photos
(`/uploads/...` load), a non-hub branch lookup; and the two endpoints the lead sent us (we use both):
`GET /api/branches` (the old `/api/branches/tenant/{id}` still works, but this one needs no tenant id) and
`GET /api/inventory/balances` — one row per product × branch that has a stock record:
`{ branchId, branchName, branchType, productId, productName, baseUnitName, packSizes, onHand, reserved, available, incoming, allowOversell }`.
RSOF answers **10 rows per page** unless asked for more, so our client reads every page (`PageIndex`/`PageSize`).
`GET /api/branches` **ignores `isHubBranch`** and also lists the master branch, so we filter hubs (and closed or
deleted branches) ourselves. Stock: a product/branch pair with no row holds none; what can be sold is `available`
(on hand minus reserved), or anything when the row has `allowOversell`; `?ProductId=` narrows the list;
`?BranchId=` is ignored;
the create call with our delivery **and pickup** payloads (`fulfillmentType` is validated strictly: `"Delivery"` and
`"Pickup"` work, `"pickup"` and `"Bogus"` are refused with "Validation Failed"; a pickup order is stored as
`"Pickup"`, a delivery order as `null`); `PUT /orders/{id}/location/shared` (Created → SharedLocationManually); cancel;
the timeline (names) and the numeric statuses in the embedded detail timeline. RSOF does **not** validate `source`,
`orderType`, the phone or an empty name, and does **not** check stock at create — our own validation and the cart's
stock check (`availableToSell`) are what protect it.

**Still to confirm on UAT (needs stock at a hub):** that RSOF auto-assigns the nearest branch with stock after the pin
(none was assigned in the tests because every product has 0 stock), the resend-code refusal wording, and how counter
staff find a pickup order (`20418`, `KR-20418` or the phone — the dashboard's pickup counter takes "Order number / phone /
approval number").

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
tests/          unit + API tests (Vitest + Supertest, real MySQL); tests/support/rof-double is an in-process RSOF stand-in used only by the tests
```
