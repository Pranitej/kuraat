import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors, radii } from '@/theme/theme';
import { t } from '@/i18n';

export type MapPin = { id: string; x: number; y: number; label: string };

/** Maroon map pin (same drawing as the web). */
export function MapPinGlyph({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 28 34">
      <Path d="M14 33c-1-1.3-11-11.4-11-19A11 11 0 0 1 25 14c0 7.6-10 17.7-11 19Z" fill={colors.maroon} />
      <Circle cx={14} cy={13.5} r={4.2} fill={colors.white} />
    </Svg>
  );
}

type Props = {
  pins?: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** "You are here" position in % of the map. */
  you?: { x: number; y: number };
  height?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * Stylised map (PDF screens 24 & 25): sand blocks, cream roads, maroon pins, orange "you" dot.
 * Pins are buttons when `onSelect` is given. (Real map: next step for web and mobile together.)
 */
export function MapIllustration({ pins = [], selectedId, onSelect, you, height = 176, style, children }: Props) {
  const [size, setSize] = useState({ w: 0, h: height });
  return (
    <View
      style={[styles.map, { height }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <Svg width="100%" height="100%" viewBox="0 0 390 190" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Rect width={390} height={190} fill="#F1DACD" />
        <Path d="M300 120 L390 92 L390 190 L260 190 Z" fill="#F3CFCB" />
        <G fill="#EBC9BA">
          <Rect x={22} y={18} width={38} height={34} rx={6} />
          <Rect x={92} y={78} width={60} height={38} rx={6} />
          <Rect x={160} y={100} width={54} height={34} rx={6} />
          <Rect x={300} y={22} width={44} height={40} rx={6} />
          <Rect x={22} y={152} width={64} height={30} rx={6} />
          <Rect x={168} y={152} width={50} height={30} rx={6} />
          <Rect x={324} y={122} width={58} height={36} rx={6} />
        </G>
        <G stroke={colors.cream} strokeLinecap="round" fill="none">
          <Path d="M-10 70 L400 30" strokeWidth={11} />
          <Path d="M-10 150 L400 104" strokeWidth={9} />
          <Path d="M98 -10 L150 200" strokeWidth={10} />
          <Path d="M268 -10 L246 200" strokeWidth={8} />
          <Path d="M360 -10 L392 60" strokeWidth={6} />
        </G>
      </Svg>

      {you ? (
        <View pointerEvents="none" style={[styles.you, { left: (you.x / 100) * size.w - 18, top: (you.y / 100) * size.h - 18 }]}>
          <View style={styles.youHalo} />
          <View style={styles.youDot} />
        </View>
      ) : null}

      {pins.map((pin) => {
        const selected = pin.id === selectedId;
        const d = selected ? 34 : 28;
        const position = { left: (pin.x / 100) * size.w - d / 2, top: (pin.y / 100) * size.h - d * 1.2, zIndex: selected ? 2 : 1 };
        if (!onSelect) {
          return (
            <View key={pin.id} pointerEvents="none" style={[styles.pin, position]}>
              <MapPinGlyph size={d} />
            </View>
          );
        }
        return (
          <Pressable
            key={pin.id}
            onPress={() => onSelect(pin.id)}
            accessibilityRole="button"
            accessibilityLabel={t('Show {label}', { label: pin.label })}
            accessibilityState={{ selected }}
            hitSlop={8}
            style={[styles.pin, position]}
          >
            <MapPinGlyph size={d} />
          </Pressable>
        );
      })}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { overflow: 'hidden', borderRadius: radii.xl, backgroundColor: '#F1DACD' },
  you: { position: 'absolute', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  youHalo: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(200,84,45,0.2)' },
  youDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.orange,
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  pin: { position: 'absolute' },
});
