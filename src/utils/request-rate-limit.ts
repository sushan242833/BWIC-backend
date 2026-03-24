import { AppError } from "../middleware/error.middleware";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface AssertRateLimitOptions {
  key: string;
  maxRequests: number;
  windowMs: number;
  message: string;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export const assertRateLimit = ({
  key,
  maxRequests,
  windowMs,
  message,
}: AssertRateLimitOptions) => {
  const now = Date.now();
  const existingBucket = rateLimitBuckets.get(key);

  if (!existingBucket || existingBucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  if (existingBucket.count >= maxRequests) {
    throw new AppError(message, 429);
  }

  rateLimitBuckets.set(key, {
    ...existingBucket,
    count: existingBucket.count + 1,
  });
};
