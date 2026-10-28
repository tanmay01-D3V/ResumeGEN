import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

/**
 * AI endpoints are expensive and are rate limited per authenticated user.
 * A broader limiter protects the rest of the API from accidental loops.
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req) => req.user?.uid ?? ipKeyGenerator(req.ip ?? 'unknown'),
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'AI requests are limited to 12 per minute. Please wait a moment and try again.',
      },
    });
  },
});

export const generalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 240,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests. Please wait a minute and try again.',
      },
    });
  },
});
