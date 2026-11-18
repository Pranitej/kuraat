import { useEffect, useState } from 'react';
import { getQuote } from '@/services/checkoutService.js';

const CACHE_MS = 30_000;
const cache = new Map(); // key → { at, promise }

function cachedQuote(addressId, productIds) {
  const key = `${addressId}|${productIds.join(',')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = getQuote({ addressId, productIds });
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

/**
 * "Will be delivered from …": the branch the server would choose for this address and these
 * products (nearest hub with stock), its distance and the delivery slot. Re-asked when either
 * changes; answers are reused for 30 s. `quote` is null while loading or when no branch serves
 * the address (`error` says why).
 *
 * Pickup (design 2026-11-18 §5.3): `fulfilment: 'pickup'` needs no address. The quote is the nearest
 * branch to where the customer is (its `branch` may be null) and the stored cart priced without the
 * delivery fee (`totals`) — prices must never be stale, so a pickup quote is never reused.
 * `retry()` asks again after a failure. A quote of the other kind is never shown while a new one loads.
 */
export function useDeliveryQuote({ addressId, productIds = [], fulfilment = 'delivery' }) {
  const key = productIds.join(',');
  const pickup = fulfilment === 'pickup';
  const enabled = pickup || Boolean(addressId);
  const [state, setState] = useState({ quote: null, pickup, loading: enabled, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ quote: null, pickup, loading: false, error: null });
      return undefined;
    }
    let alive = true;
    // Keep the last quote of the same kind while refreshing; never show a delivery quote as a pickup one.
    setState((s) => ({ quote: s.pickup === pickup ? s.quote : null, pickup, loading: true, error: null }));
    const ids = key ? key.split(',') : [];
    const request = pickup ? getQuote({ fulfilment: 'pickup', productIds: ids.length ? ids : undefined }) : cachedQuote(addressId, ids);
    request
      .then((quote) => alive && setState({ quote, pickup, loading: false, error: null }))
      .catch((error) => alive && setState({ quote: null, pickup, loading: false, error }));
    return () => {
      alive = false;
    };
  }, [enabled, pickup, addressId, key, attempt]);

  return { quote: state.quote, loading: state.loading, error: state.error, retry: () => setAttempt((n) => n + 1) };
}
