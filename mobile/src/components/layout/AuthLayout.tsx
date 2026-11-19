import type { Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaroonPanel } from '@/components/ui/Brand';
import { Text } from '@/components/ui/Text';
import { colors, layout, radii } from '@/theme/theme';
import { LanguageToggle } from './LanguageToggle';
import { BackButton } from './ScreenHeader';

type Props = {
  title: string;
  children: ReactNode;
  backFallback?: Href;
  onBack?: () => void;
  showBack?: boolean;
};

/**
 * Auth screens (PDF 03–06): maroon gradient header with the glass back button and the large white
 * title (wrapping like the PDF at 232 pt), then the cream sheet overlapping it with 28 pt corners.
 * Scrolls as one, keeping the focused field above the keyboard.
 */
export function AuthLayout({ title, children, backFallback = '/welcome', onBack, showBack = true }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} bounces={false}>
        <MaroonPanel fade="down" style={{ height: insets.top + 200 }}>
          <View style={[styles.header, { paddingTop: insets.top + layout.headerTop }]}>
            <View style={styles.backRow}>
              {showBack ? <BackButton variant="glass" fallback={backFallback} onPress={onBack} /> : <View />}
              <LanguageToggle tone="glass" />
            </View>
            <Text variant="display" color="white" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          </View>
        </MaroonPanel>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.column}>{children}</View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1 },
  header: { flex: 1, paddingHorizontal: 24, paddingBottom: 52 },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 'auto', maxWidth: 232 },
  sheet: {
    flexGrow: 1,
    marginTop: -28,
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingTop: 28,
  },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: 24 },
});
