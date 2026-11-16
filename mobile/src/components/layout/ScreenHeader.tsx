import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from '@/components/icons';
import { IconButton, type IconButtonVariant } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useGoBack } from '@/hooks/navigation';
import { colors, layout } from '@/theme/theme';
import { useScreenScrollY } from './Screen';

/** 44 pt back button (PDF): goes back, or to `fallback` when there is no history. */
export function BackButton({
  fallback = '/home',
  onPress,
  variant = 'surface',
  label = 'Back',
}: {
  fallback?: Href;
  onPress?: () => void;
  variant?: IconButtonVariant;
  label?: string;
}) {
  const goBack = useGoBack(fallback);
  return <IconButton icon={ChevronLeft} label={label} variant={variant} iconSize={22} strokeWidth={2} onPress={onPress ?? goBack} />;
}

type Props = {
  title: string;
  back?: boolean;
  backFallback?: Href;
  onBack?: () => void;
  right?: ReactNode;
};

/**
 * Screen header (PDF): 44 back button · centred 20/700 title · optional right element.
 * Fixed at the top; a hairline appears once the content scrolls (as on the web).
 */
export function ScreenHeader({ title, back = true, backFallback = '/home', onBack, right }: Props) {
  const insets = useSafeAreaInsets();
  const scrollY = useScreenScrollY();
  const line = useAnimatedStyle(() => ({
    borderBottomColor: interpolateColor(scrollY ? Math.min(scrollY.get(), 8) : 0, [0, 8], ['rgba(238,225,216,0)', colors.lineSubtle]),
  }));
  return (
    <Animated.View style={[styles.wrap, { paddingTop: insets.top + layout.headerTop }, line]}>
      <View style={styles.row}>
        <View style={styles.side}>{back ? <BackButton fallback={backFallback} onPress={onBack} /> : null}</View>
        <Text variant="heading" numberOfLines={1} accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.cream, borderBottomWidth: 1, zIndex: 2 },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end' },
  title: { maxWidth: '60%', textAlign: 'center' },
});
