/**
 * Prisma Client Singleton
 * Ensures only one instance of Prisma Client is created
 * Prevents connection pool exhaustion in development
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

// Extend globalThis for TypeScript type safety
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create Prisma Client instance with logging
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });

// Log Prisma warnings and errors using our logger
prisma.$on('warn', (e) => {
  logger.warn({ prismaWarning: e }, 'Prisma warning');
});

prisma.$on('error', (e) => {
  logger.error({ prismaError: e }, 'Prisma error');
});

// Store in global in development to prevent creating new instances on hot reload
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma on process termination
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
  logger.info('Prisma client disconnected');
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await disconnectPrisma();
});
