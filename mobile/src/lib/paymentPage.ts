import { Linking } from 'react-native';

type WebBrowserModule = { openBrowserAsync: (url: string, options?: Record<string, unknown>) => Promise<unknown> };

/**
 * Opens RSOF's payment page in the in-app browser sheet (SFSafariViewController / Chrome Custom Tab): the customer
 * stays in the app. Only web addresses are opened. A build without the expo-web-browser native module (an older dev
 * build) falls back to the phone's own browser instead of crashing. Resolves when the sheet is closed; nothing is
 * checked afterwards — whether the customer paid is RSOF's business.
 */
export async function openPaymentPage(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) throw new Error('Not a web address');
  let browser: WebBrowserModule | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    browser = require('expo-web-browser') as WebBrowserModule;
  } catch {
    browser = null;
  }
  if (browser) {
    await browser.openBrowserAsync(url, { dismissButtonStyle: 'close', showTitle: true, enableBarCollapsing: false });
    return;
  }
  await Linking.openURL(url);
}
