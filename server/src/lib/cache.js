/**
 * Small in-memory cache for ROF reads (design spec §6.3): values younger than ttlMs are reused.
 * If refreshing fails because ROF is unavailable, the last value is served (stale beats an error page
 * for catalogue and branch lists); with nothing cached, the error is passed on.
 * Concurrent misses for the same key share one load.
 */
import { isRofError } from '../rof/errors.js';

export function createTtlCache({ ttlMs, now = () => Date.now() }) {
  const entries = new Map(); // key → { value, at }
  const loading = new Map(); // key → Promise

  async function load(key, loader) {
    if (!loading.has(key)) {
      loading.set(
        key,
        (async () => {
          try {
            const value = await loader();
            entries.set(key, { value, at: now() });
            return value;
          } finally {
            loading.delete(key);
          }
        })(),
      );
    }
    return loading.get(key);
  }

  return {
    async get(key, loader, { fresh = false } = {}) {
      const entry = entries.get(key);
      if (!fresh && entry && now() - entry.at < ttlMs) return entry.value;
      try {
        return await load(key, loader);
      } catch (error) {
        if (entry && isRofError(error, 'unavailable')) return entry.value;
        throw error;
      }
    },
  };
}
