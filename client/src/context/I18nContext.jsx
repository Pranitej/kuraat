import { createContext, Fragment, useContext, useEffect, useMemo, useState } from 'react';
import { getDirection, getLanguage, initLanguage, LANGUAGES, setLanguage, subscribeLanguage } from '@/i18n';

// Read the saved language before the first render so the page never flashes the wrong one.
initLanguage();

const Ctx = createContext(null);

/** Holds the current language for React, keeps <html lang dir> in step with it. */
export function I18nProvider({ children }) {
  const [lang, setLang] = useState(getLanguage);

  useEffect(() => subscribeLanguage(setLang), []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = getDirection();
  }, [lang]);

  const value = useMemo(
    () => ({ lang, dir: getDirection(), languages: LANGUAGES, setLanguage, other: LANGUAGES.find((l) => l.code !== lang) }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

/**
 * `t()` is a plain function, so the screens re-draw by remounting when the language changes. The providers
 * above it (sign-in, cart, orders…) are not touched; only the open screen starts afresh.
 */
export function LocalizedTree({ children }) {
  const { lang } = useI18n();
  return <Fragment key={lang}>{children}</Fragment>;
}
