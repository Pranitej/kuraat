/**
 * Request helper for the demo services: adds realistic latency and a uniform error shape,
 * mirroring how the real API client will behave (async, may throw ApiError).
 */

export class ApiError extends Error {
  constructor(message, { code = 'error', field = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run `fn` after a short, slightly variable delay. */
export async function request(fn, { min = 350, max = 750 } = {}) {
  await wait(min + Math.random() * (max - min));
  return structuredClone(await fn());
}
