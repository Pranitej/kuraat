# kuraat — mobile (React Native)

Reserved for the React Native app, which will be built after the web client demo is approved.
This folder will be its own project (own `package.json`, assets and build tooling), independent of `client/` and `server/`.

Starting points:

- **Design:** `../DESIGN_SYSTEM.md` (tokens, components, all 26 screens, navigation, restrictions) and the PDF.
- **Tokens:** copy `../client/src/theme/tokens.js` (plain JS, no CSS).
- **Business logic:** copy `../client/src/domain/` (pricing and VAT, delivery-branch selection, delivery slots,
  order status, validation, formatting). It has no DOM or React dependencies.
- **Assets:** logo and product photos in `../client/src/assets/images/`.
- **API:** the endpoints described in `../server/README.md`.
