import { zoomSliderGesture } from '../zoomSlider';

describe('zoom slider (image viewer)', () => {
  test('runs on the JS thread: its handler calls plain JS (a UI-thread call crashed the app)', () => {
    const gesture = zoomSliderGesture(
      () => 200,
      () => {},
    );
    expect(gesture.config.runOnJS).toBe(true);
  });

  test('dragging across the track maps to 100–300 % and stays in range', () => {
    const onChange = jest.fn();
    const gesture = zoomSliderGesture(() => 200, onChange);
    const update = gesture.handlers.onUpdate as unknown as (e: { x: number }) => void;
    update({ x: 0 });
    update({ x: 100 });
    update({ x: 200 });
    update({ x: 260 }); // finger past the end
    update({ x: -20 });
    expect(onChange.mock.calls.map(([s]) => s)).toEqual([1, 2, 3, 3, 1]);
  });

  test('touching the track jumps there', () => {
    const onChange = jest.fn();
    const begin = zoomSliderGesture(() => 200, onChange).handlers.onBegin as unknown as (e: { x: number }) => void;
    begin({ x: 50 });
    expect(onChange).toHaveBeenCalledWith(1.5);
  });
});
