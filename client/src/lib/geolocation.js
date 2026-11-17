/**
 * The browser's current position for captureLocationOnce (design 2026-11-18 §5.6). Coarse is enough
 * (nearest branch), and it must never hang the page: 10 s at most, a 5-minute-old fix is fine.
 * Refused, unsupported (e.g. plain http on a phone) or failed → null.
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export function getBrowserPosition() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}
