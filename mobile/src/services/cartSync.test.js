import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createCartSync } from './cartSync.js';

/** A put whose answers the test releases one by one. */
function controlledPut() {
  const pending = [];
  const put = vi.fn(
    (state) =>
      new Promise((resolve, reject) => {
        pending.push({ state, resolve, reject });
      }),
  );
  return { put, pending };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createCartSync', () => {
  test('saves once after 300 ms of quiet, with the latest state', async () => {
    const put = vi.fn(async (s) => ({ saved: s }));
    const sync = createCartSync({ put });
    sync.schedule('A');
    await vi.advanceTimersByTimeAsync(100);
    sync.schedule('B');
    await vi.advanceTimersByTimeAsync(100);
    sync.schedule('C');
    await vi.advanceTimersByTimeAsync(299);
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(put.mock.calls).toEqual([['C']]);
  });

  test('never runs two saves at once, and ends on the latest state', async () => {
    const { put, pending } = controlledPut();
    const sync = createCartSync({ put });
    sync.schedule('A');
    await vi.advanceTimersByTimeAsync(300);
    sync.schedule('B');
    await vi.advanceTimersByTimeAsync(300);
    expect(put).toHaveBeenCalledTimes(1);
    pending[0].resolve('answer A');
    await vi.advanceTimersByTimeAsync(0);
    expect(put.mock.calls).toEqual([['A'], ['B']]);
  });

  test('ignores the answer to an older state', async () => {
    const { put, pending } = controlledPut();
    const onResult = vi.fn();
    const sync = createCartSync({ put, onResult });
    sync.schedule('A');
    await vi.advanceTimersByTimeAsync(300);
    sync.schedule('B');
    pending[0].resolve('answer A');
    await vi.advanceTimersByTimeAsync(300);
    pending[1].resolve('answer B');
    await vi.advanceTimersByTimeAsync(0);
    expect(onResult.mock.calls).toEqual([['answer B']]);
  });

  test('flush saves at once and resolves when the save is done', async () => {
    const { put, pending } = controlledPut();
    const onResult = vi.fn();
    const sync = createCartSync({ put, onResult });
    sync.schedule('A');
    let done = false;
    const flushed = sync.flush().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(put.mock.calls).toEqual([['A']]);
    expect(done).toBe(false);
    pending[0].resolve('answer A');
    await flushed;
    expect(onResult).toHaveBeenCalledWith('answer A');
    expect(sync.isPending()).toBe(false);
  });

  test('flush with nothing to save resolves without calling the server', async () => {
    const put = vi.fn();
    await createCartSync({ put }).flush();
    expect(put).not.toHaveBeenCalled();
  });

  test('flush rejects when the save fails, and the state is sent again on the next flush', async () => {
    const error = new Error('down');
    const put = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('ok');
    const onError = vi.fn();
    const sync = createCartSync({ put, onError });
    sync.schedule('A');
    await expect(sync.flush()).rejects.toBe(error);
    expect(onError).toHaveBeenCalledWith(error);
    expect(sync.isPending()).toBe(true);
    await sync.flush();
    expect(put.mock.calls).toEqual([['A'], ['A']]);
    expect(sync.isPending()).toBe(false);
  });

  test('a change made during a failed save is still sent', async () => {
    const { put, pending } = controlledPut();
    const sync = createCartSync({ put, onError: () => {} });
    sync.schedule('A');
    await vi.advanceTimersByTimeAsync(300);
    sync.schedule('B');
    await vi.advanceTimersByTimeAsync(300);
    pending[0].reject(new Error('down'));
    await vi.advanceTimersByTimeAsync(0);
    expect(put.mock.calls).toEqual([['A'], ['B']]);
  });

  test('cancel drops what was waiting', async () => {
    const put = vi.fn(async () => 'ok');
    const sync = createCartSync({ put });
    sync.schedule('A');
    sync.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(put).not.toHaveBeenCalled();
    expect(sync.isPending()).toBe(false);
  });
});
