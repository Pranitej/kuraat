import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { LanguageToggle } from '@/components/layout';
import { I18nProvider, LocalizedTree } from '@/context/I18nContext';
import { getLanguage, setLanguage, t } from '@/i18n';

// Switching between English and Arabic flips the native layout direction, which reloads the app; the
// reload itself cannot run in a test, so it is stubbed.
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn(() => Promise.resolve()) }));

function Label() {
  return <Text>{t('Add to cart')}</Text>;
}

afterEach(() => act(() => setLanguage('en')));

describe('Language toggle', () => {
  test('offers the other language in its own script and switches to it', async () => {
    await render(
      <I18nProvider>
        <LocalizedTree>
          <LanguageToggle />
          <Label />
        </LocalizedTree>
      </I18nProvider>,
    );
    expect(screen.getByText('Add to cart')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Switch language to العربية' }));

    expect(getLanguage()).toBe('ar');
    expect(screen.getByText('أضف إلى السلة')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });
});
