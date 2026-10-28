import type { RequestHandler } from 'express';
import { ApiError } from '../utils/errors';
import { verifyBearerToken } from '../services/authService';

/**
 * Derives identity exclusively from the verified bearer token. A uid supplied
 * in a request body/query is never treated as authorisation.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw ApiError.unauthorized();
    }
    req.user = await verifyBearerToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

export function currentUser(req: { user?: { uid: string; email: string; name: string; authMode: 'firebase' | 'demo' } }) {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
