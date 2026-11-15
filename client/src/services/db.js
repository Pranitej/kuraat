/**
 * Demo data store. The whole demo "database" lives in browser storage so changes survive refresh.
 * Only the services in this folder touch it — UI code talks to services/contexts — so replacing
 * the services with real API calls later does not affect screens.
 */

import { createDemoSeed, SEED_VERSION } from '@/domain';
import { local } from '../lib/storage.js';

const KEY = 'db';
let cache = null;

function load() {
  const stored = local.read(KEY);
  if (stored && stored.version === SEED_VERSION) return stored;
  const seed = createDemoSeed(new Date());
  local.write(KEY, seed);
  return seed;
}

export function getDb() {
  if (!cache) cache = load();
  return cache;
}

/** Mutate a draft copy of the db and persist it. Returns whatever `fn` returns. */
export function updateDb(fn) {
  const draft = structuredClone(getDb());
  const result = fn(draft);
  cache = draft;
  local.write(KEY, draft);
  return result;
}

export function userBucket(db, collection, userId, fallback = []) {
  if (!db[collection]) db[collection] = {};
  if (!db[collection][userId]) db[collection][userId] = structuredClone(fallback);
  return db[collection][userId];
}
