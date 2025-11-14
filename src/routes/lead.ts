/**
 * Lead ingestion route - POST /api/lead
 * Accepts lead data from PHP script with minimal validation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { isCrmLeadPayload } from '../types/lead';
import { ingestLead } from '../services/leadService';
import { formatClientError } from '../utils/errors';
import { logger } from '../logger';

/**
 * Extracts header value case-insensitively
 */
function getHeader(request: FastifyRequest, headerName: string): string | null {
  // Fastify normalizes headers to lowercase
  const normalizedName = headerName.toLowerCase();
  const value = request.headers[normalizedName];

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }

  return null;
}

/**
 * Registers the lead ingestion route
 */
export async function registerLeadRoute(fastify: FastifyInstance) {
  fastify.post('/api/lead', async (request: FastifyRequest, reply: FastifyReply) => {
    // Extract headers
    const idempotencyKey = getHeader(request, 'idempotency-key');
    const xRequestId = getHeader(request, 'x-request-id');

    logger.info(
      {
        method: request.method,
        url: request.url,
        idempotencyKey,
        xRequestId,
      },
      'Received lead ingestion request',
    );

    // Minimal validation: ensure body is an object
    if (!isCrmLeadPayload(request.body)) {
      logger.warn(
        {
          body: request.body,
          idempotencyKey,
          xRequestId,
        },
        'Invalid request body - not an object',
      );

      return reply.code(400).send({
        ok: false,
        error: 'invalid_payload',
      });
    }

    // Ingest the lead
    const result = await ingestLead({
      payload: request.body,
      idempotencyKey,
      xRequestId,
    });

    // Handle result
    if (result.success) {
      const statusCode = result.response.deduplicated ? 409 : 201;

      logger.info(
        {
          leadId: result.response.lead_id,
          deduplicated: result.response.deduplicated,
          idempotencyKey,
          xRequestId,
        },
        `Lead ${result.response.deduplicated ? 'deduplicated' : 'created'} successfully`,
      );

      return reply.code(statusCode).send(result.response);
    } else {
      // Error occurred - log it and return safe error to client
      logger.error(
        {
          idempotencyKey,
          xRequestId,
        },
        'Failed to ingest lead',
      );

      return reply.code(500).send(formatClientError(result.error));
    }
  });
}
