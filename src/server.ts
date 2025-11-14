/**
 * Fastify server bootstrap
 * Rock-solid lead ingestion CRM backend
 *
 * Setup instructions:
 * 1. Install dependencies: npm install
 * 2. Set up environment: cp .env.example .env (edit with your DATABASE_URL)
 * 3. Run migrations: npx prisma migrate dev
 * 4. Start server: npm run dev (development) or npm start (production)
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { logger } from './logger';
import { disconnectPrisma } from './db/prisma';
import { registerLeadRoute } from './routes/lead';

/**
 * Create and configure Fastify instance
 */
async function buildServer() {
  const fastify = Fastify({
    logger: logger,
    requestIdHeader: 'x-request-id', // Use the same header from PHP script
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    trustProxy: true, // Important for getting correct IP in production
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true, // Allow all origins (adjust in production if needed)
    credentials: true,
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { ok: true, timestamp: new Date().toISOString() };
  });

  // Register lead ingestion route
  await registerLeadRoute(fastify);

  return fastify;
}

/**
 * Start the server
 */
async function start() {
  try {
    const fastify = await buildServer();

    // Start listening
    await fastify.listen({
      port: config.port,
      host: '0.0.0.0', // Listen on all interfaces
    });

    logger.info(
      {
        port: config.port,
        nodeEnv: config.nodeEnv,
      },
      `Server started successfully on port ${config.port}`,
    );

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal, shutting down gracefully...');

      try {
        await fastify.close();
        logger.info('Fastify server closed');

        await disconnectPrisma();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error({ reason, promise }, 'Unhandled rejection');
      process.exit(1);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
start();
