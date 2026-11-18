/**
 * Domain layer — platform-agnostic display and form logic for the server's data (formatting in
 * the device time zone, validation, password rules, catalogue/cart/order/branch views). Kept free of
 * DOM/React/storage so it can be copied into the React Native app (mobile/). Business rules
 * (prices, VAT, promos, branch choice, order status) live in server/.
 */

export * from './format.js';
export * from './geo.js';
export * from './validation.js';
export * from './password.js';
export * from './branches.js';
export * from './catalog.js';
export * from './cart.js';
export * from './orders.js';
export * from './address.js';
export * from './phone.js';
export * from './countries.js';
