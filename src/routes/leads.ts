/**
 * Leads CRM routes - list and manage leads
 * GET  /api/leads     — list with filtering, search, pagination
 * PATCH /api/leads/:id — update lead status
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';

interface LeadsQuerystring {
  status?: string;
  search?: string;
  page?: string;
  limit?: string;
}

interface LeadParams {
  id: string;
}

interface PatchLeadBody {
  status?: string;
}

const VALID_STATUSES = ['new', 'in_work', 'converted', 'rejected'];

export async function registerLeadsRoute(fastify: FastifyInstance<any, any, any, any>) {
  /**
   * GET /api/leads
   * Query params: status, search, page (1-based), limit
   */
  fastify.get('/api/leads', async (request: FastifyRequest<{ Querystring: LeadsQuerystring }>, reply: FastifyReply) => {
    const { status, search } = request.query;
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.LeadWhereInput = {};

    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return reply.send({
      ok: true,
      data: leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  /**
   * PATCH /api/leads/:id
   * Body: { status: "new" | "in_work" | "converted" | "rejected" }
   */
  fastify.patch('/api/leads/:id', async (request: FastifyRequest<{ Params: LeadParams; Body: PatchLeadBody }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = request.body as PatchLeadBody;

    if (!body || !body.status) {
      return reply.code(400).send({ ok: false, error: 'status is required' });
    }

    if (!VALID_STATUSES.includes(body.status)) {
      return reply.code(400).send({ ok: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    try {
      const lead = await prisma.lead.update({
        where: { id },
        data: { status: body.status },
      });

      return reply.send({ ok: true, data: lead });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return reply.code(404).send({ ok: false, error: 'Lead not found' });
      }
      throw error;
    }
  });
}
