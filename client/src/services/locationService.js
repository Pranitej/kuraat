/**
 * The customer's current location, sent once per session (design 2026-11-18 §5.6). Shared with the
 * mobile app; each app passes its own getPosition (browser geolocation / expo-location).
 */
import { session } from '@/lib/storage.js';
import { apiRequest } from './api.js';

/** PUT /me/location — the server keeps only the latest. */
export const saveLocation = ({ lat, lng }) => apiRequest('/me/location', { method: 'PUT', body: { lat, lng } });

/**
 * Asks for the position and saves it, at most once per session per customer. The session is marked
 * before asking, so a refusal or a failure is not asked again until the next session. Never throws:
 * it must never get in the way of the screen that calls it.
 * @param {string} userId
 * @param {() => Promise<{ lat: number, lng: number } | null>} getPosition
 * @returns {Promise<'skipped' | 'unavailable' | 'saved' | 'failed'>}
 */
export async function captureLocationOnce(userId, getPosition) {
  const key = `location-done:${userId}`;
  if (session.read(key)) return 'skipped';
  session.write(key, true);
  let position = null;
  try {
    position = await getPosition();
  } catch {
    position = null;
  }
  if (!position) return 'unavailable';
  try {
    await saveLocation(position);
    return 'saved';
  } catch {
    return 'failed';
  }
}
