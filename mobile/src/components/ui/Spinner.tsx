import { ActivityIndicator } from 'react-native';
import { colors } from '@/theme/theme';
import { t } from '@/i18n';

/** Native activity indicator (smooth on the UI thread), labelled for screen readers. */
export function Spinner({ size = 22, color = colors.maroon, label = t('Loading') }: { size?: number; color?: string; label?: string }) {
  return (
    <ActivityIndicator size={size > 30 ? 'large' : 'small'} color={color} accessibilityLabel={label} accessibilityRole="progressbar" />
  );
}
