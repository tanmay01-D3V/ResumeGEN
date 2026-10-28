import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodError } from 'zod';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'Sign in to continue.') {
    return new ApiError(401, 'unauthorized', message);
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new ApiError(403, 'forbidden', message);
  }

  static notFound(message = 'Resource not found.') {
    return new ApiError(404, 'not_found', message);
  }

  static conflict(message: string, details?: unknown) {
    return new ApiError(409, 'conflict', message, details);
  }

  static tooMany(message = 'Too many requests. Please slow down.') {
    return new ApiError(429, 'rate_limited', message);
  }

  static upstream(message: string, details?: unknown) {
    return new ApiError(502, 'upstream_error', message, details);
  }

  static notConfigured(message: string, details?: unknown) {
    return new ApiError(503, 'not_configured', message, details);
  }
}

export function zodDetails(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
