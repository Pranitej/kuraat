/**
 * The device's current position, asked when the customer adds an address or signs up (same rules as the
 * web's lib/geolocation.js): asks for "while using the app" permission only; refused → null; a fix
 * that takes longer than 10 s or fails → null. Never throws. `precise` is for an address pin the customer asked
 * for: a high-accuracy fix, 15 s at most.
 */
import * as Location from 'expo-location';

const TIMEOUT_MS = 10_000;
const PRECISE_TIMEOUT_MS = 15_000;

export async function getDevicePosition({ precise = false }: { precise?: boolean } = {}): Promise<{ lat: number; lng: number } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), precise ? PRECISE_TIMEOUT_MS : TIMEOUT_MS);
    });
    const fix = Location.getCurrentPositionAsync({ accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced });
    const position = await Promise.race([fix, timeout]);
    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
