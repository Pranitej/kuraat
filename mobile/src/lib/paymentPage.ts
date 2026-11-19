import { requireOptionalNativeModule } from 'expo';
import { Linking } from 'react-native';

type WebBrowserModule = { openBrowserAsync: (url: string, options?: Record<string, unknown>) => Promise<unknown> };

/**
 * Does this build contain the in-app browser's native piece? Ask BEFORE loading the package: React Native reports a
 * module that fails to load as a fatal error (the red "Cannot find native module" screen), which no try/catch around
 * \`require\` can stop — it used to appear after the customer came back from the phone's browser on an older dev build.
 */
const hasInAppBrowser = (): boolean => {
  try {
    return Boolean(requireOptionalNativeModule('ExpoWebBrowser'));
  } catch {
    return false;
  }
};

/**
 * Opens RSOF's payment page in the in-app browser sheet (SFSafariViewController / Chrome Custom Tab): the customer
 * stays in the app. Only web addresses are opened. A build without the expo-web-browser native module (a dev build
 * made before it was added) opens the phone's own browser instead. Resolves when the sheet is closed; nothing is
 * checked afterwards — whether the customer paid is RSOF's business.
 */
export async function openPaymentPage(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) throw new Error('Not a web address');
  if (hasInAppBrowser()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const browser = require('expo-web-browser') as WebBrowserModule;
    await browser.openBrowserAsync(url, { dismissButtonStyle: 'close', showTitle: true, enableBarCollapsing: false });
    return;
  }
  await Linking.openURL(url);
}
