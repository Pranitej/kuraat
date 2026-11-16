import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CirclePattern, Logo, Text } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes.js';
import { colors, gradients } from '@/theme/theme';
import { LinearGradient } from 'expo-linear-gradient';

/** Shown once per launch; later visits (e.g. after signing out) go straight on. */
let booted = false;

function Dot({ active }: { active: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withTiming(active ? 26 : 6, { duration: 500 }),
    opacity: withTiming(active ? 1 : 0.4, { duration: 500 }),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** 01 · Splash — brand moment while the session restores; auto-advances (~2.5 s), tap to skip. */
export default function SplashScreen() {
  const { isAuthenticated, status } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(booted);
  const [tapped, setTapped] = useState(false);
  const done = useRef(false);

  // Leave after the brand moment (or a tap) — but only once the session check has finished.
  useEffect(() => {
    if (done.current || status !== 'ready' || !(elapsed || tapped)) return;
    done.current = true;
    booted = true;
    router.replace(isAuthenticated ? ROUTES.home : ROUTES.welcome);
  }, [status, elapsed, tapped, isAuthenticated, router]);

  useEffect(() => {
    if (booted) return undefined;
    const timers = [setTimeout(() => setStep(1), 800), setTimeout(() => setStep(2), 1600), setTimeout(() => setElapsed(true), 2500)];
    return () => timers.forEach(clearTimeout);
  }, []);

  const skip = useCallback(() => setTapped(true), []);
  const g = gradients.maroon;

  return (
    <Pressable onPress={skip} accessibilityRole="button" accessibilityLabel="Continue to kuraat" style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={g.colors} locations={g.locations} start={g.start} end={g.end} style={StyleSheet.absoluteFill} />
      <CirclePattern variant="splash" fade="up" />
      <Animated.View entering={FadeInUp.duration(600)} style={styles.center}>
        <Logo tone="white" width={216} />
        <View style={styles.rule} />
        <Text variant="body-lg" color="white80" align="center" style={styles.tagline}>
          Your partner for every gathering
        </Text>
        <Text arabic weight={700} color="white" align="center" style={styles.arabic}>
          كُرات شريك الجمعات
        </Text>
      </Animated.View>
      <View style={[styles.dots, { bottom: Math.max(56, insets.bottom + 24) }]} accessibilityElementsHidden>
        {[0, 1, 2].map((i) => (
          <Dot key={i} active={step === i} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.maroon, overflow: 'hidden' },
  center: { alignItems: 'center', marginTop: '-16%', paddingHorizontal: 24 },
  rule: { marginTop: 32, width: 40, height: 1, backgroundColor: colors.white40 },
  tagline: { marginTop: 24, fontSize: 17 },
  arabic: { marginTop: 8, fontSize: 22, lineHeight: 36 },
  dots: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.white },
});
