import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, zodDetails } from '../utils/errors';
import { errorSummary, logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'not_found',
      message: `No route matches ${req.method} ${req.path}.`,
    },
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Please check the highlighted fields.',
        details: zodDetails(error),
      },
    });
    return;
  }

  if (error instanceof ApiError) {
    if (error.status >= 500) {
      logger.error('API error', { path: req.path, status: error.status, code: error.code });
    }
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  // body-parser raises entity.too.large / invalid JSON before routes.
  const maybeStatus = (error as { status?: number })?.status;
  if (maybeStatus === 400 || maybeStatus === 413) {
    res.status(maybeStatus).json({
      error: {
        code: maybeStatus === 413 ? 'payload_too_large' : 'invalid_request',
        message:
          maybeStatus === 413
            ? 'The request is too large. Please shorten the content.'
            : 'The request body is not valid JSON.',
      },
    });
    return;
  }

  logger.error('Unhandled API error', {
    path: req.path,
    method: req.method,
    error: errorSummary(error),
  });
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on the server. Please try again.',
    },
  });
}
