import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from '@/theme/theme';
import { CheckCircle } from './Controls';
import { Text } from './Text';
import { t } from '@/i18n';

/** What domain/password.js `evaluatePassword` returns. */
export type PasswordEvaluation = {
  score: number;
  label: string;
  level: string;
  results: { id: string; label: string; met: boolean }[];
};

/** 4-segment strength meter + caption (PDF screens 05, 19). */
export function StrengthMeter({ evaluation, style }: { evaluation: PasswordEvaluation; style?: StyleProp<ViewStyle> }) {
  const { score, label, level } = evaluation;
  const fill = level === 'weak' ? colors.hotpink : colors.maroon;
  return (
    <View
      style={[styles.meter, style]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={label ? t('Password strength: {label}', { label }) : undefined}
    >
      <View style={styles.segments}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < score ? fill : colors.sand }]} />
        ))}
      </View>
      {label ? (
        <Text variant="label" color={level === 'weak' ? 'hotpink' : 'maroon'} style={styles.caption}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** Checklist of the password rules. */
export function PasswordRules({ evaluation, style }: { evaluation: PasswordEvaluation; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.rules, style]}>
      {evaluation.results.map((r) => (
        <View key={r.id} style={styles.rule} accessibilityLabel={`${r.label}, ${r.met ? 'met' : 'not met'}`}>
          <CheckCircle checked={r.met} />
          <Text color={r.met ? 'ink' : 'muted'} style={styles.flex}>
            {r.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  meter: { marginTop: 12 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: radii.pill },
  caption: { marginTop: 8 },
  rules: { gap: 10 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
