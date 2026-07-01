import { LoggerService } from '@nestjs/common';

import {
  DEFAULT_INITIAL_DELAY_MS,
  DEFAULT_MAX_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_USE_EXPONENTIAL_BACKOFF,
  JITTER_MAX,
  JITTER_MIN,
  RetryOptions,
} from '../constants';

const defaultRetryOptions: RetryOptions = {
  maxRetries: DEFAULT_MAX_RETRIES,
  initialDelayMs: DEFAULT_INITIAL_DELAY_MS,
  useExponentialBackoff: DEFAULT_USE_EXPONENTIAL_BACKOFF,
  maxDelayMs: DEFAULT_MAX_DELAY_MS,
} as const;

export const logErrorDetails = (message: string, error: any, logger: LoggerService | Console) => {
  const log = {
    errorMessage: error?.message || error?.errorMessage,
    errorCode: error?.code || error?.errorCode,
    response: error?.response,
    responseCode: error?.response?.status || error?.responseCode,
    rejected: error?.rejected,
    rejectedErrors: error?.rejectedErrors?.map((e: any) => ({
      message: e?.message,
      recipient: e?.recipient,
    })),
  };

  logger.error(message, log);
};

export const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  logger: LoggerService | Console,
  options: Partial<RetryOptions> = {},
): Promise<T> => {
  const cleanOptions = Object.fromEntries(
    Object.entries(options).filter(([, v]) => v !== undefined),
  );
  const retryOptions = { ...defaultRetryOptions, ...cleanOptions };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryOptions.maxRetries; attempt++) {
    try {
      const result = await operation();

      if (attempt > 0) {
        logger.log(
          `${operationName} succeeded on attempt ${attempt + 1}/${retryOptions.maxRetries}`,
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      if (retryOptions.shouldRetry && !retryOptions.shouldRetry(error)) {
        throw error;
      }

      if (attempt < retryOptions.maxRetries - 1) {
        let delay = retryOptions.initialDelayMs;

        if (retryOptions.useExponentialBackoff) {
          delay = Math.min(
            retryOptions.initialDelayMs * Math.pow(2, attempt),
            retryOptions.maxDelayMs,
          );
        }

        const jitterRange = JITTER_MAX - JITTER_MIN;
        const jitter = JITTER_MIN + Math.random() * jitterRange;
        delay = Math.floor(delay * jitter);

        logger.warn(
          `${operationName} - Attempt ${attempt + 1}/${
            retryOptions.maxRetries
          } failed: ${error.message}. Retrying in ${delay}ms...`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logErrorDetails(
          `${operationName} - All ${retryOptions.maxRetries} attempts failed.`,
          error,
          logger,
        );
      }
    }
  }

  throw lastError;
};
