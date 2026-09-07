import type { RequestHandler } from 'express';

interface Bucket { count: number; resetAt: number; }

export function createRateLimiter(limit: number, windowMs: number, key: (request: Parameters<RequestHandler>[0]) => string): RequestHandler {
  const buckets = new Map<string, Bucket>();
  return (request, response, next) => {
    const now = Date.now();
    const value = key(request);
    const current = buckets.get(value);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(value, bucket);
    if (bucket.count > limit) {
      response.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      response.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests. Try again later.' } });
      return;
    }
    next();
  };
}
