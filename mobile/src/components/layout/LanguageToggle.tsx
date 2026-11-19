import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Languages } from '@/components/icons';
import { Text } from '@/components/ui';
import { useI18n } from '@/context/I18nContext';
import { t } from '@/i18n';
import { colors, radii } from '@/theme/theme';

/** One-tap English ⇄ العربية switch. It names the language you will get, in that language's own script. */
export function LanguageToggle({ tone = 'surface', height = 40, style }: { tone?: 'surface' | 'glass'; height?: number; style?: StyleProp<ViewStyle> }) {
  const { other, changeLanguage } = useI18n();
  const glass = tone === 'glass';
  const fg = glass ? colors.white : colors.maroon;
  return (
    <Pressable
      onPress={() => changeLanguage(other.code)}
      accessibilityRole="button"
      accessibilityLabel={t('Switch language to {language}', { language: other.label })}
      hitSlop={4}
      style={({ pressed }) => [
        styles.pill,
        { height, backgroundColor: glass ? 'rgba(255,255,255,0.14)' : colors.white, borderColor: glass ? 'rgba(255,255,255,0.4)' : colors.lineSubtle },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Languages size={18} strokeWidth={1.8} color={fg} />
      <Text variant="small" weight={700} arabic={other.code === 'ar'} style={{ color: fg }}>
        {other.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1 },
});
