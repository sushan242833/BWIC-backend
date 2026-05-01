import sequelize from "@config/config";
import { AuthRateLimit } from "@models/auth-rate-limit.model";
import { AppError } from "../middleware/error.middleware";

interface AssertRateLimitOptions {
  key: string;
  maxRequests: number;
  windowMs: number;
  message: string;
}

export const assertRateLimit = async ({
  key,
  maxRequests,
  windowMs,
  message,
}: AssertRateLimitOptions) => {
  const now = new Date();
  const nextResetAt = new Date(now.getTime() + windowMs);

  await sequelize.transaction(async (transaction) => {
    await AuthRateLimit.findOrCreate({
      where: { key },
      defaults: {
        key,
        count: 0,
        resetAt: now,
      },
      transaction,
    });

    const bucket = await AuthRateLimit.findByPk(key, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!bucket) {
      throw new AppError("Unable to enforce request limits right now.", 500);
    }

    if (bucket.resetAt.getTime() <= now.getTime()) {
      bucket.count = 1;
      bucket.resetAt = nextResetAt;
      await bucket.save({ transaction });
      return;
    }

    if (bucket.count >= maxRequests) {
      throw new AppError(message, 429);
    }

    bucket.count += 1;
    await bucket.save({ transaction });
  });
};

export const clearRateLimit = async (key: string) => {
  await AuthRateLimit.destroy({ where: { key } });
};
