import { isWorkletFunction } from 'react-native-worklets';
import { zoomSliderGesture } from '../zoomSlider';

/** Stand-in for a shared value holding the track width. */
const track = (width: number) => ({ get: () => width }) as never;

describe('zoom slider (image viewer)', () => {
  test('runs on the UI thread with worklet handlers only (no JS round trip per finger move)', () => {
    const gesture = zoomSliderGesture(track(200), () => {
      'worklet';
    });
    expect(gesture.config.runOnJS).toBeFalsy();
    expect(isWorkletFunction(gesture.handlers.onBegin)).toBe(true);
    expect(isWorkletFunction(gesture.handlers.onUpdate)).toBe(true);
  });

  test('the knob follows the finger: 0–200 px maps straight to 100–300 % and stays in range', () => {
    const apply = jest.fn();
    const gesture = zoomSliderGesture(track(200), apply);
    const update = gesture.handlers.onUpdate as unknown as (e: { x: number }) => void;
    update({ x: 0 });
    update({ x: 100 });
    update({ x: 200 });
    update({ x: 260 }); // finger past the end
    update({ x: -20 });
    expect(apply.mock.calls.map(([s]) => s)).toEqual([1, 2, 3, 3, 1]);
  });

  test('touching the track jumps there', () => {
    const apply = jest.fn();
    const begin = zoomSliderGesture(track(200), apply).handlers.onBegin as unknown as (e: { x: number }) => void;
    begin({ x: 50 });
    expect(apply).toHaveBeenCalledWith(1.5);
  });
});
