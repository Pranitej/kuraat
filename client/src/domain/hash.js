/**
 * Non-reversible string hash (cyrb53). Used so that demo credentials are never kept in
 * browser storage in plain text. This is a client-side demo safeguard, not real security —
 * production authentication happens server-side.
 */
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export function hashPassword(salt, password) {
  return cyrb53(`kuraat:${salt}:${password}`, 7);
}

/** Short random id, e.g. "84F2A91C". */
export function randomHex(length = 8) {
  let out = '';
  while (out.length < length) out += Math.floor(Math.random() * 16).toString(16);
  return out.toUpperCase();
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${randomHex(4).toLowerCase()}`;
}
