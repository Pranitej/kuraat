/**
 * Uniform API errors. Every error response is { message, code, field } — the shape the client's
 * ApiError expects (field is null unless one input caused it).
 */

export class AppError extends Error {
  constructor(status, code, message, field = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export const badRequest = (code, message, field = null) => new AppError(400, code, message, field);
export const unauthorized = (code = 'unauthorized', message = 'Please sign in again.') => new AppError(401, code, message);
export const paymentRequired = (code, message, field = null) => new AppError(402, code, message, field);
export const forbidden = (code, message) => new AppError(403, code, message);
export const notFound = (code = 'not_found', message = 'We could not find that.', field = null) =>
  new AppError(404, code, message, field);
export const conflict = (code, message, field = null) => new AppError(409, code, message, field);
export const tooManyRequests = (code = 'too_many_requests', message = 'Too many attempts. Please wait a moment and try again.') =>
  new AppError(429, code, message);
export const unavailable = (code, message) => new AppError(503, code, message);

export const ROF_UNAVAILABLE_MESSAGE = "We can't reach the store right now. Please try again in a moment.";

const body = (code, message, field = null) => ({ message, code, field });

export function notFoundRoute(req, res) {
  res.status(404).json(body('route_not_found', `No API route for ${req.method} ${req.path}.`));
}

/**
 * Turns any thrown error into the uniform body. ROF failures that a feature did not handle itself:
 * unavailable/auth → 503 rof_unavailable (auth = our ROF login is misconfigured, logged loudly);
 * rejected → 502 rof_error (an unexpected success:false; logged with ROF's message).
 */
export const errorHandler = (logger = console) =>
  // Express recognises error handlers by their four parameters.
  // eslint-disable-next-line no-unused-vars
  function errorMiddleware(error, req, res, next) {
    if (error instanceof AppError) {
      return res.status(error.status).json(body(error.code, error.message, error.field));
    }
    if (error?.name === 'RofError') {
      if (error.kind === 'auth') logger.error(`[rof] service-user login refused — check ROF_EMAIL/ROF_PASSWORD: ${error.message}`);
      else logger.warn(`[rof] ${error.kind}: ${error.message}`);
      if (error.kind === 'rejected') {
        return res.status(502).json(body('rof_error', "The store couldn't complete this request. Please try again."));
      }
      return res.status(503).json(body('rof_unavailable', ROF_UNAVAILABLE_MESSAGE));
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json(body('invalid_json', 'The request body is not valid JSON.'));
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json(body('too_large', 'The request is too large.'));
    }
    logger.error('[error]', req.method, req.originalUrl, error?.stack || error);
    return res.status(500).json(body('server_error', 'Something went wrong on our side. Please try again.'));
  };
