import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '@refurbcompare/core';
import { ZodError } from 'zod';

export interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  requestId?: string;
}

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiSuccessResponse<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

export function errorResponse(status: number, code: string, message: string, requestId?: string, details?: unknown): ApiErrorResponse {
  return {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    ...(requestId ? { requestId } : {}),
  };
}

/** Maps domain exceptions to RFC-style JSON:API error envelopes. */
export function toFastifyErrorHandler(): (
  err: unknown,
  req: FastifyRequest,
  reply: FastifyReply,
) => void {
  return (err, req, reply) => {
    const requestId = (req.id as string) ?? undefined;

    if (err instanceof AppError) {
      const status = err.status;
      return reply.status(status).send(
        errorResponse(status, err.code, err.message, requestId, err.details ?? undefined),
      );
    }

    if (err instanceof ZodError) {
      return reply
        .status(400)
        .send(errorResponse(400, 'VALIDATION_ERROR', 'Invalid request', requestId, err.flatten()));
    }

    // Fastify's own validation errors come as { validation, validationContext }.
    const fastifyErr = err as (Error & { validation?: unknown; statusCode?: number });
    if (fastifyErr.validation) {
      return reply
        .status(400)
        .send(errorResponse(400, 'VALIDATION_ERROR', 'Invalid request schema', requestId, fastifyErr.validation));
    }

    const known = (err as Error & { statusCode?: number }).statusCode;
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (known && known >= 400 && known < 500) {
      return reply.status(known).send(errorResponse(known, 'HTTP_' + known, message, requestId));
    }

    req.log.error({ err }, 'unhandled error');
    return reply
      .status(500)
      .send(errorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId));
  };
}