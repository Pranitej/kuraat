/** Cart and favourites on the server (server/README.md → Cart & checkout, Favourites). */
import { apiRequest } from './api.js';

/** The cart priced from RSOF's current prices and stock: { items, promo, totals }. */
export const getCart = () => apiRequest('/cart');

/** Stores the cart the customer now sees and returns it priced. */
export const putCart = ({ items, promoCode }) =>
  apiRequest('/cart', { method: 'PUT', body: { items: items.map(({ productId, qty }) => ({ productId, qty })), promoCode: promoCode ?? null } });

export const getFavorites = async () => (await apiRequest('/favorites')).productIds;
export const putFavorites = async (productIds) => (await apiRequest('/favorites', { method: 'PUT', body: { productIds } })).productIds;
