/**
 * The photo shown next to an ordered product. An order stores the photo address from the day it was placed,
 * which can go stale (the product's photo changed, or RSOF no longer has the product). So the screens ask the
 * product-by-id API for the current photo instead: the product's first image, or null when RSOF does not have
 * the product any more, it has no photo, or the lookup failed — the screens then show the placeholder.
 */
import { getProductDetail } from './catalogService.js';

const KEEP_MS = 5 * 60 * 1000;
const cache = new Map(); // productId → { at, promise }

/** @returns {Promise<string|null>} one request per product per five minutes, however many cards ask. */
export function loadProductImage(productId) {
  if (!productId) return Promise.resolve(null);
  const hit = cache.get(productId);
  if (hit && Date.now() - hit.at < KEEP_MS) return hit.promise;
  const promise = getProductDetail(productId)
    .then((product) => product?.images?.[0] || null)
    .catch((error) => {
      // "Not found" is an answer worth remembering; a network or server failure is tried again next time.
      if (error?.code !== 'not_found') cache.delete(productId);
      return null;
    });
  cache.set(productId, { at: Date.now(), promise });
  return promise;
}

export const clearProductImages = () => cache.clear();
