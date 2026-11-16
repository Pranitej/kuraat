/**
 * Saves the cart to the server without making taps wait: changes are sent after `delayMs` of
 * quiet, one save at a time, always the latest state. Only the answer to the latest state is
 * reported (`onResult`), so an older answer never undoes newer taps. A failed save keeps the state
 * for the next attempt (a later change or `flush`).
 */
export function createCartSync({ put, delayMs = 300, onResult = () => {}, onError = () => {} }) {
  let state = null;
  let version = 0; // last scheduled
  let saved = 0; // last saved
  let timer = null;
  let running = false;
  const waiters = [];

  function settle(error, savedOrFailedVersion) {
    for (let i = waiters.length - 1; i >= 0; i -= 1) {
      const w = waiters[i];
      if (error && w.target <= savedOrFailedVersion) {
        waiters.splice(i, 1);
        w.reject(error);
      } else if (!error && saved >= w.target) {
        waiters.splice(i, 1);
        w.resolve();
      }
    }
  }

  async function run() {
    clearTimeout(timer);
    timer = null;
    if (running || saved >= version) return;
    running = true;
    const v = version;
    let failed = false;
    try {
      const result = await put(state);
      saved = v;
      if (v === version) onResult(result);
      settle(null, v);
    } catch (error) {
      failed = true;
      onError(error);
      settle(error, v);
    } finally {
      running = false;
    }
    // Changes made while saving: send them now unless their quiet time is still running.
    if (saved < version && !timer && (!failed || version > v)) run();
  }

  return {
    schedule(next) {
      state = next;
      version += 1;
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    /** Sends what is waiting now; resolves once it is saved (rejects if that save fails). */
    flush() {
      if (saved >= version) return Promise.resolve();
      const promise = new Promise((resolve, reject) => waiters.push({ target: version, resolve, reject }));
      clearTimeout(timer);
      timer = null;
      if (!running) run();
      return promise;
    },
    isPending: () => saved < version,
    /** Forget everything waiting (e.g. on sign-out). */
    cancel() {
      clearTimeout(timer);
      timer = null;
      state = null;
      saved = version;
      waiters.splice(0).forEach((w) => w.resolve());
    },
  };
}
