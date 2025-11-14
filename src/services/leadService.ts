/**
 * Lead ingestion service - core business logic
 * Guarantees zero data loss through raw storage first, then normalized storage
 */

import { prisma } from '../db/prisma';
import { logger } from '../logger';
import {
  CrmLeadPayload,
  LeadCreatedResponse,
  LeadDeduplicatedResponse,
} from '../types/lead';
import { isIdempotencyKeyConstraintError, logError } from '../utils/errors';
import { randomUUID } from 'crypto';

export interface IngestLeadOptions {
  payload: CrmLeadPayload;
  idempotencyKey: string | null;
  xRequestId: string | null;
}

export interface IngestLeadResult {
  success: true;
  response: LeadCreatedResponse | LeadDeduplicatedResponse;
}

export interface IngestLeadError {
  success: false;
  error: unknown;
}

/**
 * Ingests a lead with guaranteed zero data loss
 *
 * Strategy:
 * 1. Generate UUID for this lead
 * 2. Store raw payload first (audit trail, never lose data)
 * 3. Store normalized lead
 * 4. Handle idempotency via unique constraint on idempotencyKey
 *
 * Returns success response or error for the caller to handle
 */
export async function ingestLead(
  options: IngestLeadOptions,
): Promise<IngestLeadResult | IngestLeadError> {
  const { payload, idempotencyKey, xRequestId } = options;
  const leadId = randomUUID();

  logger.info(
    {
      leadId,
      idempotencyKey,
      xRequestId,
    },
    'Starting lead ingestion',
  );

  // Step 1: Store raw payload first - this guarantees we never lose data
  try {
    await prisma.leadRaw.create({
      data: {
        id: leadId,
        idempotencyKey: idempotencyKey || null,
        xRequestId: xRequestId || null,
        payload: payload as unknown as Record<string, unknown>, // Prisma Json type
      },
    });

    logger.info(
      {
        leadId,
        idempotencyKey,
        xRequestId,
      },
      'Raw lead stored successfully',
    );
  } catch (error) {
    // If raw storage fails due to idempotency key conflict, ignore it
    // We don't need duplicate raw entries for the same idempotency key
    if (isIdempotencyKeyConstraintError(error)) {
      logger.info(
        {
          leadId,
          idempotencyKey,
          xRequestId,
        },
        'Raw lead already exists (idempotency key conflict), continuing with normalized storage',
      );
    } else {
      // Any other error in raw storage is critical - we MUST not lose this lead
      logError(error, {
        step: 'raw_storage',
        leadId,
        idempotencyKey,
        xRequestId,
        payload,
      });
      return { success: false, error };
    }
  }

  // Step 2: Store normalized lead
  try {
    await prisma.lead.create({
      data: {
        id: leadId,
        clickId: payload.click_id || null,
        country: payload.country || null,
        creo: payload.creo || null,
        description: payload.description || null,
        domain: payload.domain || null,
        email: payload.email || null,
        firstName: payload.firstName || null,
        lastName: payload.lastName || null,
        ip: payload.ip || null,
        lang: payload.lang || null,
        marker: payload.marker || null,
        offer: payload.offer || null,
        phone: payload.phone || null,
        sourcetype: payload.sourcetype || null,
        idempotencyKey: idempotencyKey || null,
        xRequestId: xRequestId || null,
        status: 'new',
      },
    });

    logger.info(
      {
        leadId,
        idempotencyKey,
        xRequestId,
      },
      'Lead created successfully',
    );

    return {
      success: true,
      response: {
        ok: true,
        lead_id: leadId,
        deduplicated: false,
      },
    };
  } catch (error) {
    // Check if this is an idempotency key violation
    if (isIdempotencyKeyConstraintError(error)) {
      logger.info(
        {
          leadId,
          idempotencyKey,
          xRequestId,
        },
        'Lead deduplicated (idempotency key match)',
      );

      // Find the existing lead by idempotency key
      const existingLead = await prisma.lead.findFirst({
        where: {
          idempotencyKey: idempotencyKey || undefined,
        },
        select: {
          id: true,
        },
      });

      if (!existingLead) {
        // This shouldn't happen, but handle it gracefully
        logger.error(
          {
            leadId,
            idempotencyKey,
            xRequestId,
          },
          'Idempotency key conflict but existing lead not found',
        );
        return { success: false, error };
      }

      return {
        success: true,
        response: {
          ok: true,
          lead_id: existingLead.id,
          deduplicated: true,
        },
      };
    }

    // Any other error is logged and propagated
    logError(error, {
      step: 'normalized_storage',
      leadId,
      idempotencyKey,
      xRequestId,
      payload,
    });

    return { success: false, error };
  }
}
