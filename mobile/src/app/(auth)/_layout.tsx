import { Stack } from 'expo-router';
import { colors } from '@/theme/theme';

/** Signed-out screens: Welcome, Sign up, Sign in (guarded in the root layout). */
export default function AuthGroupLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.cream } }} />;
}
