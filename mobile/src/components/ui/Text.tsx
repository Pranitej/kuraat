import { memo } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { FONT_FAMILY, MAX_FONT_SCALE, colors, type, type ColorName, type TypeToken, type Weight } from '@/theme/theme';

export type TextProps = RNTextProps & {
  /** Type-scale token (DESIGN_SYSTEM.md §C.2). Default `body`. */
  variant?: TypeToken;
  /** Colour token. Default `ink` (headings/values); use `copy` for paragraphs, `muted` for meta. */
  color?: ColorName;
  /** Overrides the token's weight (picks the matching font file). */
  weight?: Weight;
  align?: TextStyle['textAlign'];
  arabic?: boolean;
};

/** The only Text the app uses: token typography, capped font scaling, brand colours. */
function TextBase({ variant = 'body', color = 'ink', weight, align, arabic, style, ...rest }: TextProps) {
  const base = type[variant];
  const fontFamily = arabic
    ? weight === 500 || (!weight && base.fontFamily === FONT_FAMILY[500])
      ? FONT_FAMILY.arabic500
      : FONT_FAMILY.arabic700
    : weight
      ? FONT_FAMILY[weight]
      : base.fontFamily;
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[base, { color: colors[color], fontFamily }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}

export const Text = memo(TextBase);
