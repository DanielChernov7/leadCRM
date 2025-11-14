/**
 * Configuration management with environment variable validation
 * Fails fast at startup if required variables are missing
 */

import dotenv from 'dotenv';
import { logger } from './logger';

// Load .env file
dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  logLevel: string;
}

/**
 * Validates and returns configuration object
 * Exits process if required variables are missing
 */
function loadConfig(): Config {
  const requiredVars = ['DATABASE_URL'];
  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    logger.error(
      {
        missingVars: missing,
      },
      'Missing required environment variables',
    );
    process.exit(1);
  }

  const config: Config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL!,
    logLevel: process.env.LOG_LEVEL || 'info',
  };

  // Validate port is a valid number
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    logger.error({ port: process.env.PORT }, 'Invalid PORT value');
    process.exit(1);
  }

  return config;
}

export const config = loadConfig();

// Log configuration on startup (sanitize sensitive data)
logger.info(
  {
    port: config.port,
    nodeEnv: config.nodeEnv,
    logLevel: config.logLevel,
    databaseUrl: config.databaseUrl.replace(/:[^:@]+@/, ':****@'), // Hide password
  },
  'Configuration loaded successfully',
);
