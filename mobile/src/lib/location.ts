/**
 * The device's current position for captureLocationOnce (design 2026-11-18 §5.6, same rules as the
 * web's lib/geolocation.js): asks for "while using the app" permission only; refused → null; a fix
 * that takes longer than 10 s or fails → null. Never throws.
 */
import * as Location from 'expo-location';

const TIMEOUT_MS = 10_000;

export async function getDevicePosition(): Promise<{ lat: number; lng: number } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), TIMEOUT_MS);
    });
    const fix = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const position = await Promise.race([fix, timeout]);
    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
