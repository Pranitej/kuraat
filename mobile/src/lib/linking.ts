import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useToast } from '@/context/ToastContext';

/** Opens tel:, mailto: and maps links (same URLs as the web app); false when the phone can't. */
export async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** openExternal with the "Couldn't open this link." toast on failure. */
export function useOpenUrl() {
  const toast = useToast();
  return useCallback(
    async (url: string) => {
      if (!(await openExternal(url))) toast.show("Couldn't open this link.", { tone: 'error' });
    },
    [toast],
  );
}
