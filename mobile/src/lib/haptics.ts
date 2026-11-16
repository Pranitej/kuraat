import * as Haptics from 'expo-haptics';

/** Light tap feedback (add to cart, stepper). Never throws — haptics are optional. */
export function tap(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Success feedback (payment done, order placed). */
export function success(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
