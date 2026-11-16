import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Minimize2, Share2, X, ZoomIn, ZoomOut } from '@/components/icons';
import { IconButton, Text } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/context/ToastContext';
import { useGoBack } from '@/hooks';
import { colors, radii } from '@/theme/theme';

const MIN = 1;
const MAX = 3;
const STEP = 0.25;
const clamp = (v: number, a: number, b: number) => {
  'worklet';
  return Math.min(b, Math.max(a, v));
};

/** Zoom slider (100–300 %): drag or tap the track; adjustable for screen readers. */
function ZoomSlider({ percent, onChange }: { percent: number; onChange: (scale: number) => void }) {
  const [width, setWidth] = useState(0);
  const fraction = (percent / 100 - MIN) / (MAX - MIN);
  const toScale = (x: number) => clamp(MIN + (x / Math.max(1, width)) * (MAX - MIN), MIN, MAX);
  const drag = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => scheduleOnRN(onChange, toScale(e.x)))
    .onUpdate((e) => scheduleOnRN(onChange, toScale(e.x)));
  return (
    <GestureDetector gesture={drag}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={styles.slider}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Zoom level"
        accessibilityValue={{ min: MIN * 100, max: MAX * 100, now: percent, text: `${percent}%` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(percent / 100 + (e.nativeEvent.actionName === 'increment' ? STEP : -STEP))}
      >
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${fraction * 100}%` }]} />
        </View>
        <View style={[styles.knob, { left: Math.max(0, fraction * width - 10) }]} />
      </View>
    </GestureDetector>
  );
}

/** 11 · Image zoom — pinch, double-tap 100↔200 %, pan when zoomed, swipe between photos, buttons and slider. */
export default function ImageZoomScreen() {
  const params = useLocalSearchParams<{ productId: string; i?: string }>();
  const catalog = useCatalog();
  const product = catalog.getProduct(params.productId);
  const goBack = useGoBack(product ? ROUTES.product(product.id) : ROUTES.home);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const images = product?.images ?? [];
  const [index, setIndex] = useState(() => clamp(Number(params.i) || 0, 0, Math.max(0, images.length - 1)));
  const [percent, setPercent] = useState(100);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const stageW = useSharedValue(0);
  const stageH = useSharedValue(0);

  useAnimatedReaction(
    () => Math.round(scale.get() * 100),
    (now, before) => {
      if (now !== before) scheduleOnRN(setPercent, now);
    },
  );

  const imageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }] }));

  const reset = useCallback(() => {
    scale.set(withTiming(1, { duration: 160 }));
    tx.set(withTiming(0, { duration: 160 }));
    ty.set(withTiming(0, { duration: 160 }));
    setPercent(100);
  }, [scale, tx, ty]);

  const zoomTo = useCallback(
    (next: number) => {
      const s = clamp(Math.round(next * 100) / 100, MIN, MAX);
      const maxX = ((s - 1) * stageW.get()) / 2;
      const maxY = ((s - 1) * stageH.get()) / 2;
      scale.set(withTiming(s, { duration: 160 }));
      tx.set(withTiming(clamp(tx.get(), -maxX, maxX), { duration: 160 }));
      ty.set(withTiming(clamp(ty.get(), -maxY, maxY), { duration: 160 }));
      setPercent(Math.round(s * 100));
    },
    [scale, tx, ty, stageW, stageH],
  );

  const select = useCallback(
    (i: number) => {
      setIndex(i);
      reset();
    },
    [reset],
  );
  const step = useCallback((dir: 1 | -1) => setIndex((i) => (i + dir + images.length) % images.length), [images.length]);

  if (!product && catalog.status === 'loading') return <View style={styles.root} />;
  if (!product) return <Redirect href={ROUTES.home} />;

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.set(scale.get());
    })
    .onUpdate((e) => {
      const s = clamp(savedScale.get() * e.scale, MIN, MAX);
      const maxX = ((s - 1) * stageW.get()) / 2;
      const maxY = ((s - 1) * stageH.get()) / 2;
      scale.set(s);
      tx.set(clamp(tx.get(), -maxX, maxX));
      ty.set(clamp(ty.get(), -maxY, maxY));
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      savedX.set(tx.get());
      savedY.set(ty.get());
    })
    .onUpdate((e) => {
      const s = scale.get();
      if (s <= 1) return;
      const maxX = ((s - 1) * stageW.get()) / 2;
      const maxY = ((s - 1) * stageH.get()) / 2;
      tx.set(clamp(savedX.get() + e.translationX, -maxX, maxX));
      ty.set(clamp(savedY.get() + e.translationY, -maxY, maxY));
    })
    .onEnd((e) => {
      if (scale.get() <= 1 && Math.abs(e.translationX) > 50 && Math.abs(e.translationX) > Math.abs(e.translationY)) {
        scheduleOnRN(step, e.translationX < 0 ? 1 : -1);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.get() > 1) {
        scale.set(withTiming(1, { duration: 160 }));
        tx.set(withTiming(0, { duration: 160 }));
        ty.set(withTiming(0, { duration: 160 }));
      } else {
        scale.set(withTiming(2, { duration: 160 }));
      }
    });

  const gestures = Gesture.Simultaneous(pinch, pan, doubleTap);

  const share = async () => {
    try {
      await Share.share({ title: `${product.name} · kuraat`, message: `${product.name} · kuraat\n${images[index]}`, url: images[index] });
    } catch {
      toast.show('Could not share this photo', { tone: 'error' });
    }
  };

  return (
    <View style={styles.root} accessibilityViewIsModal accessibilityLabel={`${product.name} photo viewer`}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <IconButton icon={X} label="Close" variant="viewer" onPress={goBack} />
        <Text weight={700} color="white" style={styles.counter} accessibilityLiveRegion="polite">
          {index + 1} / {images.length}
        </Text>
        <IconButton icon={Share2} label="Share" variant="viewer" onPress={share} />
      </View>

      <GestureDetector gesture={gestures}>
        <View
          style={styles.stage}
          onLayout={(e) => {
            stageW.set(e.nativeEvent.layout.width);
            stageH.set(e.nativeEvent.layout.height);
          }}
        >
          <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
            <Image
              key={images[index]}
              source={{ uri: images[index] }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={160}
              accessibilityLabel={`${product.name} — photo ${index + 1}`}
            />
          </Animated.View>

          <View style={styles.rail}>
            <IconButton
              icon={ZoomIn}
              label="Zoom in"
              variant="plainLight"
              onPress={() => zoomTo(percent / 100 + STEP)}
              disabled={percent >= MAX * 100}
            />
            <IconButton
              icon={ZoomOut}
              label="Zoom out"
              variant="plainLight"
              onPress={() => zoomTo(percent / 100 - STEP)}
              disabled={percent <= MIN * 100}
            />
            <IconButton icon={Minimize2} label="Fit to screen" variant="plainLight" onPress={reset} />
          </View>

          <View style={styles.badge}>
            <Text variant="label" color="white" style={styles.tabular}>
              {percent}%
            </Text>
          </View>
        </View>
      </GestureDetector>

      <View style={[styles.bottom, { paddingBottom: Math.max(20, insets.bottom + 8) }]}>
        <View style={styles.sliderRow}>
          <Pressable onPress={() => zoomTo(percent / 100 - STEP)} accessibilityRole="button" accessibilityLabel="Zoom out" hitSlop={10}>
            <ZoomOut size={20} color={colors.white80} strokeWidth={1.8} />
          </Pressable>
          <ZoomSlider percent={percent} onChange={zoomTo} />
          <Pressable onPress={() => zoomTo(percent / 100 + STEP)} accessibilityRole="button" accessibilityLabel="Zoom in" hitSlop={10}>
            <ZoomIn size={20} color={colors.white80} strokeWidth={1.8} />
          </Pressable>
        </View>
        <View style={styles.thumbs}>
          {images.map((src, i) => (
            <Pressable
              key={src}
              onPress={() => select(i)}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${i + 1}`}
              accessibilityState={{ selected: i === index }}
              style={[styles.thumb, i === index ? styles.thumbActive : styles.thumbIdle]}
            >
              <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Pressable>
          ))}
        </View>
        <Text variant="label" weight={400} color="white70" align="center" style={styles.hint}>
          Pinch or double-tap to zoom · drag to pan
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.viewer },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, zIndex: 2 },
  counter: { fontSize: 16, fontVariant: ['tabular-nums'] },
  stage: { flex: 1, overflow: 'hidden' },
  rail: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -76,
    gap: 4,
    padding: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  badge: {
    position: 'absolute',
    left: 20,
    bottom: 16,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(120,18,50,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  bottom: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slider: { flex: 1, height: 28, justifyContent: 'center' },
  track: { height: 4, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  trackFill: { height: '100%', backgroundColor: colors.white },
  knob: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  thumbs: { marginTop: 20, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: radii.lg, borderWidth: 2, overflow: 'hidden' },
  thumbActive: { borderColor: colors.white, transform: [{ scale: 1.05 }] },
  thumbIdle: { borderColor: 'transparent', opacity: 0.7 },
  hint: { marginTop: 16 },
});
