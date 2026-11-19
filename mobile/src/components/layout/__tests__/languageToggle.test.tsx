import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Updates from 'expo-updates';
import { I18nManager, Text } from 'react-native';
import { LanguageToggle } from '@/components/layout';
import { I18nProvider, LocalizedTree, RESUME_ROUTE_KEY } from '@/context/I18nContext';
import { getLanguage, setLanguage, t } from '@/i18n';
import { local } from '@/lib/storage';

// Switching between English and Arabic flips the native layout direction, which restarts the app; the
// restart itself cannot run in a test, so it is stubbed.
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-router', () => ({ usePathname: () => '/orders' }));

function Label() {
  return <Text>{t('Add to cart')}</Text>;
}

function screenWithToggle() {
  return (
    <I18nProvider>
      <LocalizedTree>
        <LanguageToggle />
        <Label />
      </LocalizedTree>
    </I18nProvider>
  );
}

// While the cover is up, the screens behind it are (rightly) hidden from screen readers.
const behindCover = { includeHiddenElements: true };

beforeEach(async () => {
  jest.useFakeTimers();
  (Updates.reloadAsync as jest.Mock).mockClear();
  local.remove(RESUME_ROUTE_KEY);
  await act(async () => {
    setLanguage('en');
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Language toggle', () => {
  test('English -> Arabic: a cover, then the language changes and the app restarts on the same screen', async () => {
    await render(screenWithToggle());
    expect(screen.getByText('Add to cart')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Switch language to العربية' }));
    // First a calm cover, with nothing half-translated behind it yet.
    expect(screen.getByTestId('language-switching')).toBeTruthy();
    expect(getLanguage()).toBe('en');
    expect(Updates.reloadAsync).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(getLanguage()).toBe('ar');
    expect(screen.getByText('أضف إلى السلة', behindCover)).toBeTruthy();
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(local.read(RESUME_ROUTE_KEY)).toBe('/orders');
  });

  test('Arabic -> English goes through exactly the same steps', async () => {
    jest.replaceProperty(I18nManager, 'isRTL', true);
    await act(async () => {
      setLanguage('ar');
    });
    await render(screenWithToggle());

    await fireEvent.press(screen.getByRole('button', { name: 'تغيير اللغة إلى English' }));
    expect(screen.getByTestId('language-switching')).toBeTruthy();
    expect(getLanguage()).toBe('ar');

    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(getLanguage()).toBe('en');
    expect(screen.getByText('Add to cart', behindCover)).toBeTruthy();
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
    expect(local.read(RESUME_ROUTE_KEY)).toBe('/orders');
  });

  test('no restart (and no cover) when the layout direction already matches', async () => {
    jest.replaceProperty(I18nManager, 'isRTL', true);
    await render(screenWithToggle());

    await fireEvent.press(screen.getByRole('button', { name: 'Switch language to العربية' }));
    expect(screen.queryByTestId('language-switching')).toBeNull();
    expect(getLanguage()).toBe('ar');
    expect(Updates.reloadAsync).not.toHaveBeenCalled();
  });
});
