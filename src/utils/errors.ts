/**
 * Error utilities for typed error handling
 * Provides helpers for detecting and handling specific database errors
 */

import { Prisma } from '@prisma/client';
import { logger } from '../logger';

/**
 * Checks if error is a Prisma unique constraint violation
 */
export function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' // Unique constraint violation
  );
}

/**
 * Checks if the unique constraint error is specifically for idempotency_key
 */
export function isIdempotencyKeyConstraintError(error: unknown): boolean {
  if (!isPrismaUniqueConstraintError(error)) {
    return false;
  }

  // P2002 error metadata contains the fields that caused the violation
  const meta = error.meta as { target?: string[] } | undefined;
  const target = meta?.target || [];

  return (
    target.includes('idempotencyKey') ||
    target.includes('idempotency_key') ||
    target.some((field) => field.toLowerCase().includes('idempotency'))
  );
}

/**
 * Logs detailed error information for debugging
 */
export function logError(error: unknown, context: Record<string, unknown>) {
  if (error instanceof Error) {
    logger.error(
      {
        ...context,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        // Include Prisma-specific details if available
        ...(error instanceof Prisma.PrismaClientKnownRequestError && {
          prismaCode: error.code,
          prismaMeta: error.meta,
        }),
      },
      'Error occurred during lead ingestion',
    );
  } else {
    logger.error(
      {
        ...context,
        error: String(error),
      },
      'Unknown error occurred during lead ingestion',
    );
  }
}

/**
 * Formats error for safe client response (no internal details leaked)
 */
export function formatClientError(error: unknown): { ok: false; error: string } {
  // Never leak internal error details to client
  return {
    ok: false,
    error: 'internal_error',
  };
}
