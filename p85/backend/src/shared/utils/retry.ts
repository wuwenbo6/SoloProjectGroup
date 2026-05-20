import logger from '../middleware/logger';

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 100, backoffMultiplier = 2 } = options;
  let lastError: Error;
  let currentDelay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info(`Operation succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        logger.warn(
          `Operation failed, retrying (${attempt + 1}/${maxRetries}): ${lastError.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay *= backoffMultiplier;
      }
    }
  }

  logger.error(`Operation failed after ${maxRetries} retries: ${lastError.message}`);
  throw lastError;
}

export async function withTransaction<T>(
  sequelize: any,
  fn: (transaction: any) => Promise<T>
): Promise<T> {
  const transaction = await sequelize.transaction();
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
