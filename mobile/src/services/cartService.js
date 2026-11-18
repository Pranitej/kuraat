/** Cart on the server (server/README.md → Cart & checkout). */
import { apiRequest } from './api.js';

/** The cart priced from RSOF's current prices and stock: { items, totals }. */
export const getCart = () => apiRequest('/cart');

/** Stores the cart the customer now sees and returns it priced. */
export const putCart = ({ items }) => apiRequest('/cart', { method: 'PUT', body: { items: items.map(({ productId, qty }) => ({ productId, qty })) } });
