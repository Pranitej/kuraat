/** State holder for the fake ROF. Optionally persisted to a JSON file so restarts keep orders. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createSeed } from './seed.js';

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

/** Loads saved state from `filePath` if it exists, otherwise starts from the seed. */
export function loadStore(filePath) {
  const data = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : createSeed();
  return createStore({ data, filePath });
}
