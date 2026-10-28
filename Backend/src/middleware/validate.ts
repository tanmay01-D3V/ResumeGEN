import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ApiError, zodDetails } from '../utils/errors';

type Source = 'body' | 'query' | 'params';

function validator(schema: ZodType, source: Source): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(ApiError.badRequest('Please check the highlighted fields.', zodDetails(result.error)));
      return;
    }
    if (source === 'body') req.body = result.data;
    else if (source === 'query') req.query = result.data as typeof req.query;
    else req.params = result.data as typeof req.params;
    next();
  };
}

export const validateBody = (schema: ZodType) => validator(schema, 'body');
export const validateQuery = (schema: ZodType) => validator(schema, 'query');
export const validateParams = (schema: ZodType) => validator(schema, 'params');
