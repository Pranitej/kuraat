import * as Updates from 'expo-updates';
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DevSettings, I18nManager } from 'react-native';
import { LANGUAGES, getLanguage, initLanguage, isRTL, setLanguage, subscribeLanguage } from '@/i18n';

// Read the saved language before the first screen so the app never flashes the wrong one.
initLanguage();
// Native layout direction follows the language. It only takes effect after the app reloads, which
// changeLanguage() below does; on the next launch it is already right.
I18nManager.allowRTL(true);
if (I18nManager.isRTL !== isRTL()) I18nManager.forceRTL(isRTL());

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

/** Holds the current language for React and switches it (reloading the app when the direction flips). */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState(getLanguage);

  useEffect(() => subscribeLanguage(setLang), []);

  const changeLanguage = useCallback((code: string) => {
    setLanguage(code);
    const rtl = isRTL();
    I18nManager.forceRTL(rtl);
    if (I18nManager.isRTL !== rtl) {
      // Left-to-right <-> right-to-left is a native setting: reload so every screen picks it up.
      Updates.reloadAsync().catch(() => DevSettings.reload());
    }
  }, []);

  const value = useMemo<Value>(
    () => ({ language, other: LANGUAGES.find((l) => l.code !== language) ?? LANGUAGES[0], changeLanguage }),
    [language, changeLanguage],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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
