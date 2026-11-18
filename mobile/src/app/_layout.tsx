import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { I18nManager, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorFallback, OfflineBanner } from '@/components/layout';
import { AppProviders } from '@/context/AppProviders';
import { useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { setClockReader } from '@/domain';
import { readPhoneClock } from '@/lib/clock';
import { initMonitoring } from '@/lib/monitoring';
import { useAppFonts } from '@/theme/fonts';
import { colors } from '@/theme/theme';

// The UI is English (PDF): keep left-to-right on Arabic-language phones too.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 200 });
initMonitoring();
// Every time on screen follows the phone's 12/24-hour setting.
setClockReader(readPhoneClock);

/** Any screen that throws shows a friendly retry screen instead of a blank one. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorFallback error={error} retry={retry} />;
}

export default function RootLayout() {
  const fontsReady = useAppFonts();

  useEffect(() => {
    // The native splash (maroon + white wordmark) hands over to screen 01, which looks the same.
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ToastProvider>
            <AppProviders>
              <RootStack />
              <OfflineBanner />
            </AppProviders>
          </ToastProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Guards (DESIGN_SYSTEM §G): signed-in screens only with a session, Welcome/Sign up/Sign in only
 * without one. Splash, Verify and Set password are reachable either way (like the web).
 */
function RootStack() {
  const { isAuthenticated } = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.cream } }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="verify" />
      <Stack.Screen name="set-password" />
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.maroon } });
