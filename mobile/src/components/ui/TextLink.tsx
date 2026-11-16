import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { Text } from './Text';

/** Text link (PDF: maroon 15/700 — "Sign in", "See all", "Manage"). Works inline inside other Text. */
export function TextLink({
  children,
  onPress,
  disabled,
  weight = 700,
  size = 15,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  weight?: 600 | 700;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      weight={weight}
      color="maroon"
      onPress={disabled ? undefined : onPress}
      suppressHighlighting
      accessibilityRole="link"
      accessibilityState={{ disabled }}
      style={[{ fontSize: size, lineHeight: size + 7 }, disabled && styles.disabled, style]}
    >
      {children}
    </Text>
  );
}

/** Muted lead-in + bold maroon link, centred ("Already have an account? Sign in"). */
export function LeadLink({
  lead,
  link,
  onPress,
  style,
}: {
  lead: string;
  link: string;
  onPress: () => void;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text color="muted" align="center" style={style}>
      {lead} <TextLink onPress={onPress}>{link}</TextLink>
    </Text>
  );
}

const styles = StyleSheet.create({ disabled: { opacity: 0.6 } });
