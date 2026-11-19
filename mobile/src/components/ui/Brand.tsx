import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Mask, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { LOGO_ASPECT, logos } from '@/assets/images';
import { initials } from '@/domain';
import { colors, gradients, pattern as patternTokens } from '@/theme/theme';
import { Text } from './Text';
import { t } from '@/i18n';

/** Wordmark — solid white on maroon or solid maroon on cream (brand rule; never recoloured). */
export function Logo({ tone = 'maroon', width = 132 }: { tone?: 'maroon' | 'white'; width?: number }) {
  return (
    <Image
      source={tone === 'white' ? logos.white : logos.maroon}
      style={{ width, height: width / LOGO_ASPECT }}
      contentFit="contain"
      accessibilityLabel={t('kuraat')}
      accessibilityRole="image"
    />
  );
}

/** WhatsApp glyph (brand mark — not in Lucide). Same paths as the web app. */
export function WhatsAppIcon({ size = 20, color = colors.maroon }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M3.7 20.3l1.2-4.2a8.55 8.55 0 1 1 3.2 3.1L3.7 20.3Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path
        d="M9.2 7.9c.2-.4.4-.45.7-.45h.5c.17 0 .37.05.5.37l.68 1.62c.08.22.04.45-.1.63l-.5.6c-.13.17-.14.36-.02.55.33.56.74 1.05 1.24 1.48.47.41.98.74 1.53.97.2.09.4.04.55-.1l.57-.66c.17-.2.42-.24.65-.13l1.57.74c.27.13.37.33.37.56 0 .33-.1.92-.5 1.3-.47.42-1.12.7-1.87.56-1.16-.23-2.4-.88-3.56-1.95-1.2-1.11-2-2.4-2.32-3.6-.18-.74.05-1.44.3-1.86Z"
        fill={color}
      />
    </Svg>
  );
}

/** Initials avatar or photo (data URL or https). */
export function Avatar({
  name,
  src,
  size = 44,
  tone = 'maroon',
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  tone?: 'maroon' | 'cream';
}) {
  const bg = tone === 'maroon' ? colors.maroon : colors.cream;
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
      accessibilityLabel={name ?? undefined}
    >
      {src ? (
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <Text
          weight={700}
          color={tone === 'maroon' ? 'white' : 'maroon'}
          style={{ fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.46) }}
        >
          {initials(name || '')}
        </Text>
      )}
    </View>
  );
}

type Fade = 'down' | 'up' | 'edges' | 'none';
/** Opacity stops matching the web's mask-fade-* utilities (offset → alpha). */
const FADE_STOPS: Record<Exclude<Fade, 'none'>, [number, number][]> = {
  down: [
    [0, 1],
    [0.45, 0.55],
    [1, 0],
  ],
  up: [
    [0, 0],
    [0.15, 0],
    [0.6, 0.7],
    [1, 1],
  ],
  edges: [
    [0, 1],
    [0.55, 0.35],
    [1, 0.6],
  ],
};

/** Brand circle pattern: checkerboard of squares holding inverse-tone circles, faded like the PDF. */
export const CirclePattern = memo(function CirclePattern({
  variant = 'maroon',
  fade = 'down',
}: {
  variant?: keyof typeof patternTokens;
  fade?: Fade;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { a, b, cell: c } = patternTokens[variant];
  const r = c * 0.36;
  const h = c / 2;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={`p${id}`} patternUnits="userSpaceOnUse" x={-2} y={-2} width={c * 2} height={c * 2}>
            <Rect width={c} height={c} fill={a} />
            <Circle cx={h} cy={h} r={r} fill={b} />
            <Rect x={c} width={c} height={c} fill={b} />
            <Circle cx={c + h} cy={h} r={r} fill={a} />
            <Rect y={c} width={c} height={c} fill={b} />
            <Circle cx={h} cy={c + h} r={r} fill={a} />
            <Rect x={c} y={c} width={c} height={c} fill={a} />
            <Circle cx={c + h} cy={c + h} r={r} fill={b} />
          </Pattern>
          {fade !== 'none' ? (
            <>
              <SvgGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                {FADE_STOPS[fade].map(([offset, alpha]) => (
                  <Stop key={offset} offset={offset} stopColor="#FFFFFF" stopOpacity={alpha} />
                ))}
              </SvgGradient>
              <Mask id={`m${id}`}>
                <Rect width="100%" height="100%" fill={`url(#g${id})`} />
              </Mask>
            </>
          ) : null}
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#p${id})`} mask={fade !== 'none' ? `url(#m${id})` : undefined} />
      </Svg>
    </View>
  );
});

/** Maroon gradient surface with the circle pattern (headers, banners, footers, branch card). */
export function MaroonPanel({ fade = 'down', style, children }: { fade?: Fade; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const g = gradients.maroon;
  return (
    <View style={[styles.panel, style]}>
      <LinearGradient colors={g.colors} locations={g.locations} start={g.start} end={g.end} style={StyleSheet.absoluteFill} />
      <CirclePattern variant="maroon" fade={fade} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  panel: { overflow: 'hidden', backgroundColor: colors.maroon },
});
