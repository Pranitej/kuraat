import { Gesture } from 'react-native-gesture-handler';

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

/**
 * Drag / tap on the image viewer's zoom track → scale 1–3 (100–300 %).
 *
 * Runs on the JS thread: it only feeds React state (the percentage) and calls plain JS. With
 * Reanimated installed, gesture callbacks otherwise run on the UI thread, where calling a non-worklet
 * function is a fatal error — dragging the slider closed the app.
 */
export function zoomSliderGesture(getWidth: () => number, onChange: (scale: number) => void) {
  const toScale = (x: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, ZOOM_MIN + (x / Math.max(1, getWidth())) * (ZOOM_MAX - ZOOM_MIN)));
  return Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => onChange(toScale(e.x)))
    .onUpdate((e) => onChange(toScale(e.x)));
}
