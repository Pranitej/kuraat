/**
 * Cart + favourites persistence. These are synchronous on purpose: the cart is a device-local
 * draft until checkout (like the mobile app), so every tap updates instantly.
 */

import { getDb, updateDb, userBucket } from './db.js';

const EMPTY = { items: [], promoCode: null };

export function readCart(userId) {
  return getDb().carts?.[userId] || EMPTY;
}

export function writeCart(userId, cart) {
  updateDb((db) => {
    if (!db.carts) db.carts = {};
    db.carts[userId] = cart;
  });
}

export function readFavorites(userId) {
  return getDb().favorites?.[userId] || [];
}

export function writeFavorites(userId, ids) {
  updateDb((db) => {
    const list = userBucket(db, 'favorites', userId);
    list.splice(0, list.length, ...ids);
  });
}
