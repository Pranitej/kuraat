import { useNetInfo } from '@react-native-community/netinfo';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { BottomBar, OfflineBanner, ScreenHeader } from '@/components/layout';
import { ToastProvider } from '@/context/ToastContext';

jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: jest.fn() }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: mockBack, replace: jest.fn() }),
  // jest.mock factories cannot use imports; runs the effect once like a focused screen.
  useFocusEffect: (fn: () => void | (() => void)) => require('react').useEffect(fn, []),
}));
const mockBack = jest.fn();

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <ToastProvider>{ui}</ToastProvider>
  </SafeAreaProvider>
);

describe('OfflineBanner', () => {
  test('shows when the phone is offline', async () => {
    jest.mocked(useNetInfo).mockReturnValue({ isConnected: false } as never);
    await render(wrap(<OfflineBanner />));
    expect(screen.getByText("You're offline. Some things may not load.")).toBeTruthy();
  });

  test('hidden while online or still unknown', async () => {
    jest.mocked(useNetInfo).mockReturnValue({ isConnected: null } as never);
    await render(wrap(<OfflineBanner />));
    expect(screen.queryByText("You're offline. Some things may not load.")).toBeNull();
  });
});

describe('ScreenHeader', () => {
  test('centred title; back goes to the previous screen', async () => {
    await render(wrap(<ScreenHeader title="My cart" right={<Text>3 items</Text>} />));
    expect(screen.getByRole('header', { name: 'My cart' })).toBeTruthy();
    expect(screen.getByText('3 items')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('BottomBar', () => {
  test('renders its action', async () => {
    await render(wrap(<BottomBar>{<Text>Continue to delivery</Text>}</BottomBar>));
    expect(screen.getByText('Continue to delivery')).toBeTruthy();
  });
});
