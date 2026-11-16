import { Stack } from 'expo-router';
import { colors } from '@/theme/theme';

/** Signed-in screens (guarded in the root layout). Image zoom opens as a full-screen dark modal. */
export default function AppGroupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.cream } }}>
      <Stack.Screen
        name="products/[productId]/photos"
        options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: colors.viewer } }}
      />
    </Stack>
  );
}
