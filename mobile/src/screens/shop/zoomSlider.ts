import { Gesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

/**
 * Drag / tap on the image viewer's zoom track → scale 1–3 (100–300 %), on the UI thread.
 *
 * Every finger move goes straight to `apply` (a worklet that sets the scale shared value), so the
 * photo, the knob and the track fill follow the finger at display rate with no JS round trip and no
 * easing in between. Only worklet code may run here: calling a plain JS function from a UI-thread
 * gesture callback is a fatal error (an earlier version crashed the app that way).
 */
export function zoomSliderGesture(trackWidth: SharedValue<number>, apply: (scale: number) => void) {
  return Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      const s = ZOOM_MIN + (e.x / Math.max(1, trackWidth.get())) * (ZOOM_MAX - ZOOM_MIN);
      apply(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s)));
    })
    .onUpdate((e) => {
      const s = ZOOM_MIN + (e.x / Math.max(1, trackWidth.get())) * (ZOOM_MAX - ZOOM_MIN);
      apply(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s)));
    });
}
