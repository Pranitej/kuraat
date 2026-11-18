/**
 * The browser's current position, asked when the customer adds an address or signs up. Coarse is enough
 * (nearest branch), and it must never hang the page: 10 s at most, a 5-minute-old fix is fine.
 * Refused, unsupported (e.g. plain http on a phone) or failed → null.
 * `precise` is for an address pin the customer asked for: a fresh, accurate fix (GPS if the device has it), 15 s at most.
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export function getBrowserPosition({ precise = false } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: precise, timeout: precise ? 15_000 : 10_000, maximumAge: precise ? 0 : 300_000 },
    );
  });
}
