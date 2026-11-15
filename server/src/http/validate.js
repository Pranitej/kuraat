/**
 * Request validation with zod. Failures become 400 { code: 'invalid', field, message } using the
 * first problem found. Parsed values replace req.body; query/params go to req.validQuery /
 * req.validParams (Express 5 makes req.query read-only).
 */
import { badRequest } from './errors.js';

const TARGET = { body: 'body', query: 'validQuery', params: 'validParams' };

export function validate(schemas = {}) {
  return (req, res, next) => {
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        const issue = result.error.issues[0];
        return next(badRequest('invalid', issue.message, issue.path.join('.') || null));
      }
      req[TARGET[part]] = result.data;
    }
    return next();
  };
}
