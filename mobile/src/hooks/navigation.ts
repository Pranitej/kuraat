import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/** Back that falls back to a sensible parent when there is no history (deep link, notification). */
export function useGoBack(fallback: Href = '/home') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
