import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

export { useAppActive, isAppActive } from './appState';
export { useGoBack } from './navigation';

/** Seconds remaining until `endsAt` (ms timestamp). */
export function useCountdown(endsAt: number | null | undefined): number {
  const calc = useCallback(() => Math.max(0, Math.ceil(((endsAt || 0) - Date.now()) / 1000)), [endsAt]);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
  }, [calc]);
  return left;
}

/** Re-render on an interval (live order status). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Async action state: run(fn) → { loading, error }. */
export function useAsyncAction<E = Error>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<E | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      if (mounted.current) setError(e as E);
      throw e;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);
  return { loading, error, setError, run };
}

/**
 * Android back on screens after an order (Payment successful, Order confirmed): go Home instead of
 * back into Payment.
 */
export function useBackToHome(): void {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.replace('/home');
        return true;
      });
      return () => sub.remove();
    }, [router]),
  );
}
