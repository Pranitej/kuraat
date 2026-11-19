import { afterEach, describe, expect, it } from 'vitest';
import { getDirection, getLanguage, localized, setLanguage, subscribeLanguage, t } from '@/i18n';
import { formatSAR } from '@/domain';
import ar from './ar.js';


describe('t()', () => {
  afterEach(() => setLanguage('en'));
  it('returns the English text and fills placeholders in English', () => {
    expect(t('Add to cart')).toBe('Add to cart');
    expect(t('Order #{number}', { number: 7 })).toBe('Order #7');
  });

  it('looks the text up in Arabic and keeps the placeholders', () => {
    setLanguage('ar');
    expect(t('Add to cart')).toBe(ar['Add to cart']);
    expect(t('Remove {name}', { name: 'Truffle' })).toBe('إزالة Truffle');
  });

  it('falls back to the English text when a line has no translation', () => {
    setLanguage('ar');
    expect(t('A line nobody translated yet')).toBe('A line nobody translated yet');
  });

  it('keeps phone numbers and amounts left-to-right inside Arabic text', () => {
    setLanguage('ar');
    expect(t('A new code was sent to {phone}', { phone: '+966 50 123 4821' })).toContain('⁦+966 50 123 4821⁩');
    expect(formatSAR(185)).toBe('⁦185.00⁩ ر.س');
  });
});

describe('language state', () => {
  afterEach(() => setLanguage('en'));
  it('switches direction, notifies listeners and ignores unknown languages', () => {
    const seen = [];
    const off = subscribeLanguage((code) => seen.push(code));
    setLanguage('ar');
    setLanguage('fr');
    setLanguage('ar');
    off();
    expect(getLanguage()).toBe('ar');
    expect(getDirection()).toBe('rtl');
    expect(seen).toEqual(['ar']);
    setLanguage('en');
    expect(getDirection()).toBe('ltr');
  });
});

describe('localized()', () => {
  afterEach(() => setLanguage('en'));
  const LABELS = localized([{ id: 'home', label: 'Home' }, { id: 'office', label: 'Office' }]);

  it('translates when read, so a language change after load still applies', () => {
    expect(LABELS.map((l) => l.label)).toEqual(['Home', 'Office']);
    setLanguage('ar');
    expect(LABELS.map((l) => l.label)).toEqual([ar.Home, ar.Office]);
    expect(LABELS.map((l) => l.id)).toEqual(['home', 'office']);
  });
});

describe('Arabic dictionary', () => {
  it('keeps the same {placeholders} as the English text', () => {
    const names = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    const broken = Object.entries(ar).filter(([en, translated]) => names(en) !== names(translated)).map(([en]) => en);
    expect(broken).toEqual([]);
  });
});
