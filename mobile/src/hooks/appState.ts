import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** True while the app is in front (the web's `document.visibilityState === 'visible'`). */
export const isAppActive = (): boolean => AppState.currentState === 'active';

/** Calls `onActive` each time the app comes back to the front (the web's window focus). */
export function useAppActive(onActive: () => void): void {
  const latest = useRef(onActive);
  useEffect(() => {
    latest.current = onActive;
  });
  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (previous !== 'active' && next === 'active') latest.current();
      previous = next;
    });
    return () => sub.remove();
  }, []);
}
