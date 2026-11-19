import { render, screen } from '@testing-library/react-native';
import { I18nManager } from 'react-native';
import { Text } from '@/components/ui';

/** Loads the language provider module in a fresh registry and records what it tells the native layout. */
function directionCalls(rtl: boolean): string[] {
  const calls: string[] = [];
  jest.isolateModules(() => {
    const { I18nManager: fresh } = require('react-native') as { I18nManager: typeof I18nManager };
    jest.spyOn(fresh, 'allowRTL').mockImplementation((v: boolean) => void calls.push(`allowRTL(${v})`));
    jest.spyOn(fresh, 'forceRTL').mockImplementation((v: boolean) => void calls.push(`forceRTL(${v})`));
    jest.doMock('@/i18n', () => ({ ...jest.requireActual('@/i18n'), initLanguage: () => (rtl ? 'ar' : 'en'), isRTL: () => rtl }));
    require('@/context/I18nContext');
    jest.dontMock('@/i18n');
  });
  return calls;
}

describe('Language and layout direction (review focus 4)', () => {
  test('English keeps the app left-to-right', () => {
    expect(directionCalls(false)).toEqual(['allowRTL(true)']);
  });

  test('Arabic switches the native layout to right-to-left', () => {
    expect(directionCalls(true)).toEqual(['allowRTL(true)', 'forceRTL(true)']);
  });

  test('text scales with the phone setting but is capped at 1.3×', async () => {
    await render(<Text>Your partner for every gathering</Text>);
    expect(screen.getByText('Your partner for every gathering').props.maxFontSizeMultiplier).toBe(1.3);
  });
});
