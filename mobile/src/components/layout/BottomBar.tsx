import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReportBottomBar } from '@/context/ToastContext';
import { colors, layout, shadows } from '@/theme/theme';

/**
 * Sticky bottom action bar (PDF): white, top shadow, padding 16 / 16 / safe area. Pass it to
 * `Screen bottomBar`. While its screen is focused it tells the toast host its height.
 */
export function BottomBar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const report = useReportBottomBar();
  const [height, setHeight] = useState(0);

  useFocusEffect(
    useCallback(() => {
      report(height);
      return () => report(0);
    }, [height, report]),
  );

  return (
    <View
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }, style]}
    >
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, paddingTop: 16, ...shadows.bar },
  inner: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: 16 },
});
