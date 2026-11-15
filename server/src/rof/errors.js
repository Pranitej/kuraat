/**
 * Errors from the RSOF order system (ROF).
 * - rejected:    ROF answered success:false (e.g. "Only 3 of … available"); message is ROF's own text.
 * - unavailable: network error, timeout, HTTP 5xx/429 or an unreadable reply.
 * - auth:        our service-user login was refused (configuration problem).
 */
export class RofError extends Error {
  constructor(kind, message, { status = null, path = null } = {}) {
    super(message);
    this.name = 'RofError';
    this.kind = kind;
    this.status = status;
    this.path = path;
  }
}

export const isRofError = (error, kind) => error instanceof RofError && (!kind || error.kind === kind);
