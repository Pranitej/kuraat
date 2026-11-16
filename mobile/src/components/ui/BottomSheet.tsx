import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { X } from '@/components/icons';
import { colors, motion, radii, shadows } from '@/theme/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Bottom sheet (DESIGN_SYSTEM §E, derived): cream, 28 pt top corners, grab handle, title + close.
 * Slides up on the UI thread; drag down, scrim tap or Android back closes it.
 */
export function BottomSheet({ open, onClose, title, children, footer }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(height);

  useEffect(() => {
    if (open) y.set(withTiming(0, { duration: motion.slow }));
  }, [open, y, height]);

  const close = () => {
    y.set(
      withTiming(height, { duration: motion.base }, (done) => {
        if (done) scheduleOnRN(onClose);
      }),
    );
  };

  const drag = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      y.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        y.set(
          withTiming(height, { duration: motion.base }, (done) => {
            if (done) scheduleOnRN(onClose);
          }),
        );
      } else {
        y.set(withTiming(0, { duration: motion.fast }));
      }
    });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, y.get() / (height * 0.6)) }));

  return (
    <Modal
      testID="bottom-sheet"
      visible={open}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.scrim, scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessible={false} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { maxHeight: height * 0.88 }, sheet]} accessibilityViewIsModal>
          <GestureDetector gesture={drag}>
            <View>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text variant="heading" accessibilityRole="header">
                  {title}
                </Text>
                <IconButton icon={X} label="Close" size="md" onPress={close} />
              </View>
            </View>
          </GestureDetector>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>{footer}</View>
          ) : (
            <View style={{ height: insets.bottom }} />
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    width: '100%',
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    ...shadows.dialog,
  },
  handle: { alignSelf: 'center', marginTop: 10, width: 40, height: 4, borderRadius: radii.pill, backgroundColor: colors.line },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  body: { paddingHorizontal: 20, paddingBottom: 16 },
  footer: { borderTopWidth: 1, borderTopColor: colors.lineSubtle, backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 16 },
});
