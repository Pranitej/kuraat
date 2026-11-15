# kuraat — server

Reserved for the backend API. It will be its own project (own dependencies, configuration and deployment), independent
of `client/` and `mobile/`.

## What the client expects

The web client currently simulates these operations in `client/src/services/`. Each function below maps to an endpoint.
Field names follow the client's data model (`client/src/domain/demo.js` shows complete examples).

Errors should return a message plus a machine code and, where relevant, the field that failed, for example
`{ "message": "This number already has a kuraat account.", "code": "phone_taken", "field": "phone" }`.

### Auth (`authService.js`)

| Operation | Purpose |
|---|---|
| Request WhatsApp code `{ phone, purpose }` | `purpose`: `signup` · `signin` · `reset` · `change-phone`. Send a 6-digit code on WhatsApp (resend after 60 s). |
| Verify code `{ phone, code }` | Completes sign-up (creates the account from the sign-up form) or sign-in; for reset/change-phone it returns a short-lived verification token. |
| Sign in with password `{ phone, password }` | Returns session + user. Errors: `not_found`, `no_password`, `wrong_password`. |
| Sign up with password `{ form, password }` | "Set a password instead" path, when the WhatsApp code does not arrive. |
| Reset password `{ verificationToken, newPassword }` | After a `reset` code. |
| Change password `{ currentPassword?, newPassword }` | `currentPassword` is required only if the user already has one. |
| Update profile `{ name, email, gender, avatar, phone? }` | A phone change requires a `change-phone` verification. |
| Sign out | |

### Catalogue & branches

Products (`client/src/domain/catalog.js`) and branches (`client/src/domain/branches.js`) are static in the demo.
The server should provide them, including per-branch stock and opening hours.

### Addresses (`addressService.js`)

List / create / update / delete / set default. An address has `label`, `type` (`home` · `office` · `other`),
`line`, `district`, `city`, `postcode`, `landmark`, `phone`, `isDefault` and `location { lat, lng }`.
Exactly one address is the default.

### Orders & payments (`orderService.js`, `paymentService.js`)

| Operation | Notes |
|---|---|
| Quote / place order `{ items, promoCode, addressId, deliveryPhone, payment }` | The server picks the **delivery branch** from the address and stock, computes totals (prices include 15 % VAT, SAR 15 delivery, promo) and returns the delivery window. |
| Process payment `{ method, card \| upiId }` | `card` · `upi` · `cod`. Return `transactionId`, brand and last 4 digits; decline with `card_declined`. Never return or store the full card number or CVV. |
| List orders / get order | Includes status timestamps: `createdAt`, `preparingAt`, `outForDeliveryAt`, `windowStart`, `windowEnd`, `deliveredAt`. |

The reference rules for branch choice, delivery slots and order status are in
`client/src/domain/delivery.js` and `client/src/domain/orders.js`.

### Notifications (`notificationService.js`)

List, mark one read, mark all read. Types: `order`, `payment`, `out_for_delivery`, `delivered`, `product`, `security`,
`welcome`, each with a link target (`order` id, `product` id, `password`).
