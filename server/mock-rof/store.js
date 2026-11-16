/** State holder for the fake ROF. Optionally persisted to a JSON file so restarts keep orders. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createSeed, demoOrders } from './seed.js';

export function createStore({ data = createSeed(), filePath = null } = {}) {
  return {
    data,
    save() {
      if (!filePath) return;
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(data, null, 2));
    },
  };
}

/**
 * Loads saved state from `filePath` if it exists, otherwise starts from the seed. A state saved
 * before the demo orders existed gets them added (nothing else in it changes).
 */
export function loadStore(filePath) {
  if (!existsSync(filePath)) return createStore({ data: createSeed(), filePath });
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  const missing = demoOrders().filter((demo) => !data.orders.some((o) => o.id === demo.id));
  const store = createStore({ data, filePath });
  if (missing.length) {
    data.orders.push(...missing);
    store.save();
  }
  return store;
}
