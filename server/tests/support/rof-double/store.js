/** State holder for the RSOF stand-in used by the tests. In memory only. */
import { createSeed } from './seed.js';

export function createStore({ data = createSeed() } = {}) {
  return { data, save() {} }; // kept so the stand-in can call it; nothing is persisted
}
