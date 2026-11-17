# kuraat — web and mobile parity

The web app (`client/`) and the mobile app (`mobile/`) are two independent apps that must behave the same.
This page is the rule and the record.

## The rule

1. **The server owns the business logic** — prices, VAT, promo codes, stock, the delivering branch, delivery slots,
   payments, order status. Both apps only show what it answers.
2. **Client logic is shared as identical files.** The files below exist in both apps with the same bytes. Change
   them in `client/` first, copy them to `mobile/`, and run `cd mobile && npm run parity` (CI runs it too).
   Never edit them only in `mobile/`.
3. **Every feature lands in both apps** in the same piece of work. If that is not possible, add a line to
   [Gaps](#gaps) with the reason, and remove it when the other app catches up.
4. Platform differences are allowed only where a platform does the same job differently (see the Note column).

### Shared files (`client/src/…` = `mobile/src/…`)

| Area | Files |
|---|---|
| Display and form logic | `domain/*.js` and their tests |
| Server API client | `services/*.js` and their tests (`api.js`, `authService.js`, `cartSync.js`, …) |
| Design tokens | `theme/tokens.js` |
| Routes and options | `config/routes.js`, `config/options.js` |
| Delivery quote hook | `hooks/useDeliveryQuote.js` |
| Test helper | `test/stubFetch.js` |

The full list is `mobile/parity.json`. Each app has its own copy of the two platform files the shared code imports:
`lib/storage.js` (web: localStorage / sessionStorage; mobile: device storage + the keychain for the login
tokens) and `lib/env.js` (where the API is).

## Features

✅ done · — not applicable

| # | Screen / feature | Web | Mobile | Note |
|---|---|---|---|---|
| 01 | Splash | ✅ | ✅ | Mobile: the native splash hands over to the animated one |
| 02 | Welcome, Terms / Privacy dialogs | ✅ | ✅ | |
| 03 | Sign up | ✅ | ✅ | |
| 04 | Verify (WhatsApp code) — sign-up, sign-in, reset, phone change, delete account | ✅ | ✅ | Mobile: code autofill from the keyboard |
| 05 | Set password | ✅ | ✅ | |
| 06 | Sign in (password / WhatsApp code) | ✅ | ✅ | |
| 07–08 | Home, search, filter sheet, add to cart | ✅ | ✅ | Web keeps filters in the URL; mobile in the screen. No bell or hearts (removed 18 Nov 2026). Category pills (and the sheet's Category section) only when every product has a category (`categoryFilter`, 18 Nov 2026) |
| — | Home "Deliver to" (address sheet; drives nearest branch, checkout address, default) | ✅ | ✅ | Added after the PDF (17 Nov 2026) |
| 09–10 | Product detail (gallery, details, allergens, delivered-from) | ✅ | ✅ | |
| 11 | Image zoom, share | ✅ | ✅ | Web: Web Share / copy link · Mobile: native share sheet, pinch to zoom |
| 12 | Cart (stepper, undo, warnings) | ✅ | ✅ | No promo code field (removed 18 Nov 2026) |
| 13 | Delivery details (address, phone, delivering branch) | ✅ | ✅ | |
| 14 | Payment (card, cash on delivery; no UPI) | ✅ | ✅ | Simulated payments until the real gateway |
| 15 | Payment successful | ✅ | ✅ | "Confirmed by <branch>", or "Sent to the nearest branch" while RSOF has not assigned one (18 Nov 2026) |
| 16 | Order confirmed + branch popup | ✅ | ✅ | RSOF assigns the branch from the pin we send; until it does, the popup reads "The nearest branch with your items" with "Track order" (shared wording `PENDING_BRANCH`, 18 Nov 2026) |
| 17 | Profile, log out | ✅ | ✅ | |
| 18 | Account (name, phone change, email, gender, photo) | ✅ | ✅ | Mobile: photo from the gallery |
| 18 | Delete account (store requirement) | ✅ | ✅ | Account screen → confirm → WhatsApp code |
| 19 | Password (set / change / forgot) | ✅ | ✅ | |
| 20–21 | My orders (status dropdown, refresh button, empty states) | ✅ | ✅ | Dropdown groups from the server's status table (`ORDER_FILTERS`). Web: native select · Mobile: `SelectField variant="chip"` + bottom sheet (18 Nov 2026). Cards show "Branch being confirmed" until RSOF assigns a branch |
| 22 | Order tracking (live status, refresh button, cancel, delivery-code resend) | ✅ | ✅ | Both refresh every 30 s while an order is on its way (mobile: while the app is in front, and on return); the refresh button re-reads RSOF now (`?refresh=true`, at most once per 10 s). Phones show the status tag above the timeline. The maroon branch card reads "Branch being confirmed" (no Call/Directions) until RSOF assigns one |
| 23 | Saved addresses | ✅ | ✅ | |
| 24 | Add / edit address | ✅ | ✅ | |
| 25 | Our branches (search, cities, map, call, directions) | ✅ | ✅ | |
| 26 | Notifications | — | — | Removed from both apps (18 Nov 2026), together with Favourites and promo codes; the server endpoints are unchanged |
| — | Session refresh, sign out on expiry | ✅ | ✅ | Web: tokens in local storage · Mobile: device keychain |
| — | Current location once per session (Home) → `PUT /me/location` | ✅ | ✅ | Shared `captureLocationOnce`. Web: browser geolocation · Mobile: `expo-location`, while-in-use only (needs a new dev build). Refused → nothing, not asked again that session (18 Nov 2026) |
| — | Offline banner | — | ✅ | Web shows the "can't reach kuraat" message per request |
| — | Desktop / tablet layouts | ✅ | — | Mobile is phone-first; wide screens use a centred 640 pt column |

## Gaps

- **Real map, GPS and address search** — not in either app yet; both use the drawn map and the fixed demo
  "current location". Planned for both together.
- **Push notifications** — not in either app (the in-app notification list was removed too).
- **Product detail refresh** — both apps keep a product's detail for the session (known minor, shared).
