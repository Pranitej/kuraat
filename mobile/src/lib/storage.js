/**
 * Mobile platform file — same exports as client/src/lib/storage.js, so the shared services/ and
 * domain/ files run unchanged (see ../../parity.json).
 *
 * - `local`: kept on the device (expo-sqlite key-value store, synchronous API), namespaced and
 *   JSON-encoded, never throwing (falls back to memory if the store fails).
 * - `session`: one app launch, in memory — the mobile counterpart of the browser's sessionStorage.
 * - `tokenStore`: the login tokens in the device keychain / keystore (expo-secure-store), cached in
 *   memory so the shared API client reads them synchronously.
 */
import Storage from 'expo-sqlite/kv-store';
import * as SecureStore from 'expo-secure-store';

const NAMESPACE = 'kuraat:v1:';

function makeLocal() {
  const fallback = new Map();
  return {
    /** @param {string} key @param {any} [fallbackValue] @returns {any} */
    read(key, fallbackValue = null) {
      try {
        const raw = Storage.getItemSync(NAMESPACE + key) ?? fallback.get(key) ?? null;
        return raw == null ? fallbackValue : JSON.parse(raw);
      } catch {
        return fallbackValue;
      }
    },
    write(key, value) {
      const raw = JSON.stringify(value);
      try {
        Storage.setItemSync(NAMESPACE + key, raw);
      } catch {
        fallback.set(key, raw);
      }
    },
    remove(key) {
      try {
        Storage.removeItemSync(NAMESPACE + key);
      } catch {
        /* ignore */
      }
      fallback.delete(key);
    },
    /** Everything this app stored on the device — like the web, where the tokens live in `local` too. */
    clearAll() {
      try {
        Storage.getAllKeysSync()
          .filter((k) => k.startsWith(NAMESPACE))
          .forEach((k) => Storage.removeItemSync(k));
      } catch {
        /* ignore */
      }
      fallback.clear();
      tokenStore.remove();
    },
  };
}

function makeSession() {
  const memory = new Map();
  return {
    /** @param {string} key @param {any} [fallbackValue] @returns {any} */
    read(key, fallbackValue = null) {
      try {
        return memory.has(key) ? JSON.parse(memory.get(key)) : fallbackValue;
      } catch {
        return fallbackValue;
      }
    },
    write(key, value) {
      memory.set(key, JSON.stringify(value));
    },
    remove(key) {
      memory.delete(key);
    },
    clearAll() {
      memory.clear();
    },
  };
}

export const local = makeLocal();
export const session = makeSession();

const TOKENS_KEY = 'kuraat.auth';
const SECURE_OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
let tokens; // undefined = not read from the keychain yet

function readSecure() {
  try {
    const raw = SecureStore.getItem(TOKENS_KEY, SECURE_OPTIONS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** The signed-in session's tokens (keychain / keystore). Writes are saved in the background. */
export const tokenStore = {
  read() {
    if (tokens === undefined) tokens = readSecure();
    return tokens;
  },
  write({ accessToken, refreshToken }) {
    tokens = { accessToken, refreshToken };
    SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens), SECURE_OPTIONS).catch(() => {});
  },
  remove() {
    tokens = null;
    SecureStore.deleteItemAsync(TOKENS_KEY, SECURE_OPTIONS).catch(() => {});
  },
};
