import { Linking } from 'react-native';

/**
 * The payment page opens in the in-app sheet when this build has the native module, and in the phone's browser when it
 * does not — and a missing module must never be LOADED (React Native turns that into a fatal red screen).
 */
let mockNativePresent = true;
const mockLoaded = jest.fn();
const mockOpenBrowser = jest.fn(async () => ({ type: 'dismiss' }));

jest.mock('expo', () => ({ requireOptionalNativeModule: () => (mockNativePresent ? {} : null) }));
jest.mock('expo-web-browser', () => {
  mockLoaded(); // runs only when the package is actually loaded
  return { openBrowserAsync: (...args: unknown[]) => (mockOpenBrowser as (...a: unknown[]) => unknown)(...args) };
});

const PAGE = 'https://rofuat.rsof.com.sa/en/pay/T1';

beforeEach(() => {
  mockNativePresent = true;
  mockLoaded.mockClear();
  mockOpenBrowser.mockClear();
  jest.resetModules();
});

const load = () => require('./paymentPage') as typeof import('./paymentPage');

describe('openPaymentPage', () => {
  test('the build has the in-app browser: the sheet opens and the phone browser is not used', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await load().openPaymentPage(PAGE);
    expect(mockOpenBrowser).toHaveBeenCalledWith(PAGE, expect.any(Object));
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  test('an older build WITHOUT the native module: the phone browser opens and the package is never loaded (no red screen)', async () => {
    mockNativePresent = false;
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await load().openPaymentPage(PAGE);
    expect(open).toHaveBeenCalledWith(PAGE);
    expect(mockLoaded).not.toHaveBeenCalled();
    expect(mockOpenBrowser).not.toHaveBeenCalled();
    open.mockRestore();
  });

  test('only web addresses are opened', async () => {
    await expect(load().openPaymentPage('javascript:alert(1)')).rejects.toThrow('Not a web address');
    await expect(load().openPaymentPage('intent://pay')).rejects.toThrow('Not a web address');
    expect(mockOpenBrowser).not.toHaveBeenCalled();
  });

  test('the sheet itself failing is reported, not swallowed', async () => {
    mockOpenBrowser.mockRejectedValueOnce(new Error('sheet failed'));
    await expect(load().openPaymentPage(PAGE)).rejects.toThrow('sheet failed');
  });
});
