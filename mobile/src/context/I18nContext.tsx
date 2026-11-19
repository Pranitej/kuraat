import * as ExpoRouter from 'expo-router';
import * as Updates from 'expo-updates';
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, DevSettings, I18nManager, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LANGUAGES, getLanguage, initLanguage, isRTL, setLanguage, subscribeLanguage } from '@/i18n';
import { local } from '@/lib/storage';
import { colors } from '@/theme/theme';

// Read the saved language before the first screen so the app never flashes the wrong one.
initLanguage();
// Native layout direction follows the language. It only takes effect after the app reloads, which
// changeLanguage() below does; on the next launch it is already right.
I18nManager.allowRTL(true);
if (I18nManager.isRTL !== isRTL()) I18nManager.forceRTL(isRTL());

/** Where the customer was when the language changed; the splash screen takes them back there after the restart. */
export const RESUME_ROUTE_KEY = 'resumeRoute';
const COVER_MS = 350;
const GIVE_UP_MS = 6000;

// Isolated component tests mock expo-router without this hook.
const usePathname: () => string | null = (ExpoRouter as { usePathname?: () => string }).usePathname ?? (() => null);

type Value = {
  language: string;
  /** The language the toggle would switch to. */
  other: (typeof LANGUAGES)[number];
  changeLanguage: (code: string) => void;
};

// Without a provider (isolated component tests) the toggle still works against the shared language state.
const fallback: Value = {
  language: getLanguage(),
  other: LANGUAGES.find((l) => l.code !== getLanguage()) ?? LANGUAGES[0],
  changeLanguage: setLanguage,
};
const Ctx = createContext<Value>(fallback);

/** Holds the current language for React and switches it (restarting the app once when the direction flips). */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState(getLanguage);
  const [switching, setSwitching] = useState(false);
  const pathname = usePathname();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => subscribeLanguage(setLang), []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const changeLanguage = useCallback(
    (code: string) => {
      if (code === getLanguage()) return;
      const nextRtl = LANGUAGES.find((l) => l.code === code)?.dir === 'rtl';
      if (I18nManager.isRTL === nextRtl) {
        setLanguage(code);
        return;
      }
      // English <-> Arabic flips the native layout direction, which only a restart can apply (both ways).
      // Cover the screen first, so the customer sees one calm "switching" moment and not a half-translated
      // flash, then restart and come back to the same screen.
      setSwitching(true);
      if (pathname && pathname !== '/') local.write(RESUME_ROUTE_KEY, pathname);
      timers.current.push(
        setTimeout(() => {
          setLanguage(code);
          I18nManager.forceRTL(nextRtl);
          Updates.reloadAsync().catch(() => DevSettings.reload());
        }, COVER_MS),
        // If the restart never happens (it should), do not leave the cover up for ever.
        setTimeout(() => setSwitching(false), GIVE_UP_MS),
      );
    },
    [pathname],
  );

  const value = useMemo<Value>(
    () => ({ language, other: LANGUAGES.find((l) => l.code !== language) ?? LANGUAGES[0], changeLanguage }),
    [language, changeLanguage],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {switching ? <SwitchingCover /> : null}
    </Ctx.Provider>
  );
}

/** Shown while the app restarts to apply the new layout direction. Names the change in both languages. */
function SwitchingCover() {
  return (
    <View style={styles.cover} accessibilityViewIsModal accessibilityLiveRegion="polite" testID="language-switching">
      <ActivityIndicator size="large" color={colors.maroon} />
      <Text weight={600}>Switching language…</Text>
      <Text weight={600} arabic>
        جارٍ تغيير اللغة…
      </Text>
    </View>
  );
}

export function useI18n(): Value {
  return useContext(Ctx);
}

/**
 * `t()` is a plain function, so screens redraw by remounting when the language changes. The providers
 * above it (sign-in, cart, orders…) are not touched.
 */
export function LocalizedTree({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  return <Fragment key={language}>{children}</Fragment>;
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, zIndex: 1000, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.cream },
});
