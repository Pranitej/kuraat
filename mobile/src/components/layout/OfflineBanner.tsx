import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from '@/components/icons';
import { Text } from '@/components/ui/Text';
import { colors } from '@/theme/theme';
import { t } from '@/i18n';

/** Slim hot-pink bar under the status bar while the phone has no connection. */
export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  const insets = useSafeAreaInsets();
  if (isConnected !== false) return null;
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.bar, { paddingTop: insets.top + 4 }]}
    >
      <View style={styles.row}>
        <WifiOff size={16} color={colors.white} strokeWidth={2} />
        <Text variant="label" color="white">{t('You\'re offline. Some things may not load.')}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.hotpink, paddingBottom: 6, zIndex: 100 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
