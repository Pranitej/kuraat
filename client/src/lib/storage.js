/**
 * Safe, namespaced key/value storage. Wraps localStorage/sessionStorage with JSON and
 * try/catch so private windows or blocked storage never break the app (falls back to memory).
 * In React Native this module is the only one that needs swapping (e.g. AsyncStorage/MMKV).
 */

const NAMESPACE = 'kuraat:v1:';
const memory = { local: new Map(), session: new Map() };

function backend(kind) {
  try {
    const s = kind === 'session' ? window.sessionStorage : window.localStorage;
    const probe = `${NAMESPACE}__probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function make(kind) {
  let store;
  const get = () => {
    if (store === undefined) store = backend(kind);
    return store;
  };
  return {
    read(key, fallback = null) {
      const s = get();
      try {
        const raw = s ? s.getItem(NAMESPACE + key) : memory[kind].get(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      const raw = JSON.stringify(value);
      const s = get();
      try {
        if (s) s.setItem(NAMESPACE + key, raw);
        else memory[kind].set(key, raw);
      } catch {
        memory[kind].set(key, raw);
      }
    },
    remove(key) {
      const s = get();
      try {
        if (s) s.removeItem(NAMESPACE + key);
      } catch {
        /* ignore */
      }
      memory[kind].delete(key);
    },
    clearAll() {
      const s = get();
      try {
        if (s) {
          Object.keys(s)
            .filter((k) => k.startsWith(NAMESPACE))
            .forEach((k) => s.removeItem(k));
        }
      } catch {
        /* ignore */
      }
      memory[kind].clear();
    },
  };
}

export const local = make('local');
export const session = make('session');
