import { afterEach, describe, expect, it } from 'vitest';
import { getDirection, getLanguage, localized, ltr, setLanguage, subscribeLanguage, t } from '@/i18n';
import { formatOrderNumber, formatPhone, formatSAR } from '@/domain';
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

describe('numbers that always read left to right', () => {
  afterEach(() => setLanguage('en'));
  const LRI = '⁦';
  const PDI = '⁩';

  it('English is untouched', () => {
    expect(ltr('+966 92 001 8958')).toBe('+966 92 001 8958');
    expect(formatPhone('501234821')).toBe('+966 50 123 4821');
    expect(formatOrderNumber(20420)).toBe('#20420');
  });

  it('Arabic wraps a phone number and an order number so the groups and the + / # stay in place', () => {
    setLanguage('ar');
    expect(ltr('+966 92 001 8958')).toBe(`${LRI}+966 92 001 8958${PDI}`);
    expect(formatPhone('501234821')).toBe(`${LRI}+966 50 123 4821${PDI}`);
    expect(formatPhone('+917905793532')).toMatch(/^⁦\+91 .*⁩$/);
    expect(formatOrderNumber(20420)).toBe(`${LRI}#20420${PDI}`);
  });

  it('never wraps twice, and a phone number inside a sentence is wrapped once', () => {
    setLanguage('ar');
    expect(ltr(ltr('+966 50 123 4821'))).toBe(`${LRI}+966 50 123 4821${PDI}`);
    expect(t('A new code was sent to {phone}', { phone: formatPhone('501234821') })).toBe(`تم إرسال رمز جديد إلى ${LRI}+966 50 123 4821${PDI}`);
  });
});
