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
 */
export function useDeliveryQuote({ addressId, productIds = [] }) {
  const key = productIds.join(',');
  const [state, setState] = useState({ quote: null, loading: Boolean(addressId), error: null });

  useEffect(() => {
    if (!addressId) {
      setState({ quote: null, loading: false, error: null });
      return undefined;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    cachedQuote(addressId, key ? key.split(',') : [])
      .then((quote) => alive && setState({ quote, loading: false, error: null }))
      .catch((error) => alive && setState({ quote: null, loading: false, error }));
    return () => {
      alive = false;
    };
  }, [addressId, key]);

  return state;
}
