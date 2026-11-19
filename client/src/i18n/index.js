/**
 * Translations (shared file — identical in the web and the mobile app).
 *
 * The English text is the key: `t('Add to cart')`. English shows the key itself; Arabic looks it up in
 * `ar.js` and falls back to the English text when a line is missing, so a gap never shows a blank or a
 * raw key. Placeholders use {name}: `t('{count} items', { count })`.
 *
 * The language is held here (not in React) so plain helpers such as `formatSAR` can translate too. The
 * platform provider (web: context/I18nContext.jsx) re-renders the tree when `setLanguage` is called.
 */
import { local } from '@/lib/storage.js';
import ar from './ar.js';

export const LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

const DICTIONARIES = { ar };
const STORAGE_KEY = 'language';
const isSupported = (code) => LANGUAGES.some((l) => l.code === code);

let current = 'en';
const listeners = new Set();

/** Load the saved language (call once at start-up); anything unknown means English. */
export function initLanguage(fallback = 'en') {
  const saved = local.read(STORAGE_KEY);
  current = isSupported(saved) ? saved : isSupported(fallback) ? fallback : 'en';
  return current;
}

export const getLanguage = () => current;
export const getDirection = () => LANGUAGES.find((l) => l.code === current).dir;
export const isRTL = () => getDirection() === 'rtl';

export function setLanguage(code) {
  if (!isSupported(code) || code === current) return;
  current = code;
  local.write(STORAGE_KEY, code);
  listeners.forEach((fn) => fn(code));
}

export function subscribeLanguage(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Wraps phone numbers and amounts in a left-to-right isolate so Arabic text does not reorder their digits.
const isolate = (value) => (current !== 'en' && /^[+#]?[\d][\d\s.,+()-]*$/.test(value) ? `\u2066${value}\u2069` : value);

/** Translate `key` (the English text) into the current language and fill in {placeholders}. */
export function t(key, vars) {
  const text = (current !== 'en' && DICTIONARIES[current]?.[key]) || key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] == null ? match : isolate(String(vars[name]))));
}

/**
 * Wrap a module-level object/array of display text (labels, option lists) so every string in it is
 * translated when it is read, not when the file loads. Use it for constants; inside functions call t().
 */
export function localized(value) {
  if (typeof value === 'string') return t(value);
  if (!value || typeof value !== 'object') return value;
  return new Proxy(value, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver);
      return typeof v === 'string' || (v && typeof v === 'object') ? localized(v) : v;
    },
  });
}
