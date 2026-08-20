import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  adminSyncStartSchema,
  adminProviderUpdateSchema,
  adminAuthorizationSchema,
  adminListingUpdateSchema,
  adminProductUpdateSchema,
  adminAnalyticsQuerySchema,
  paginationSchema,
} from '@refurbcompare/core';
import { ok } from '../plugins/errors.js';
import { s } from './route-meta.js';
import type { ApiServices } from '../bootstrap.js';

/** Admin endpoints are protected by the ADMIN_API_KEY (X-Admin-Key header). */
function requireAdmin(svc: ApiServices) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const key = (req.headers['x-admin-key'] ?? '') as string;
    const valid = await svc.admin.adminAuth(key);
    if (!valid) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or missing admin API key' },
        requestId: (req.id as string) ?? undefined,
      });
      return reply;
    }
  };
}

export function registerAdminRoutes(app: FastifyInstance, svc: ApiServices): void {
  const { admin } = svc;
  const guard = requireAdmin(svc);

  app.addHook('preHandler', (req, reply, done) => {
    if (req.routeOptions.url?.startsWith('/api/v1/admin')) {
      void guard(req, reply).then(done).catch((err: unknown) => done(err as Error));
    } else {
      done();
    }
  });

  app.post('/api/v1/admin/sync/:slug', { schema: s(['admin'], 'Trigger a provider sync') }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const body = adminSyncStartSchema.parse(req.body ?? {});
    const modeRaw = body.mode;
    const result = await admin.triggerSync(slug, {
      mode: modeRaw,
      force: body.force === 'true',
    });
    reply.status(202).send(ok(result));
  });

  app.get('/api/v1/admin/sync/status', { schema: s(['admin'], 'List recent sync runs') }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    reply.send(ok(await admin.syncStatus(q.pageSize)));
  });

  app.get('/api/v1/admin/sync/errors', { schema: s(['admin'], 'List sync errors') }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    reply.send(ok(await admin.syncErrors({ limit: q.pageSize })));
  });

  app.post('/api/v1/admin/providers/:id/health-check', { schema: s(['admin'], 'Run a provider health check') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    reply.send(ok(await admin.healthCheck(id)));
  });

  app.patch('/api/v1/admin/providers/:id', { schema: s(['admin'], 'Update provider config or toggle enabled') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = adminProviderUpdateSchema.parse(req.body ?? {});
    reply.send(ok(await admin.updateProvider(id, body)));
  });

  app.post('/api/v1/admin/providers/:id/authorize', { schema: s(['admin'], 'Record provider authorization') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = adminAuthorizationSchema.parse(req.body ?? {});
    reply.send(ok(await admin.authorizeProvider(id, {
      ...body,
      termsReviewedAt: body.termsReviewedAt ?? null,
      robotsReviewedAt: body.robotsReviewedAt ?? null,
      authorizationNotes: body.authorizationNotes ?? null,
      expiresAt: body.expiresAt ?? null,
    })));
  });

  app.patch('/api/v1/admin/products/:id', { schema: s(['admin'], 'Update a product record') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = adminProductUpdateSchema.parse(req.body ?? {});
    reply.send(ok(await admin.updateProduct(id, body)));
  });

  app.patch('/api/v1/admin/listings/:id', { schema: s(['admin'], 'Update a listing record') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = adminListingUpdateSchema.parse(req.body ?? {});
    reply.send(ok(await admin.updateListing(id, body)));
  });

  app.get('/api/v1/admin/clicks', { schema: s(['admin'], 'List outbound clicks') }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    const { items, total } = await svc.repo.listClicks({ page: q.page, pageSize: q.pageSize });
    reply.send(ok(items, { page: q.page, pageSize: q.pageSize, total }));
  });

  app.get('/api/v1/admin/analytics', { schema: s(['admin'], 'Click and conversion analytics') }, async (req, reply) => {
    const q = adminAnalyticsQuerySchema.parse(req.query);
    const page = Number((req.query as { page?: string }).page ?? 1);
    const pageSize = Number((req.query as { pageSize?: string }).pageSize ?? 20);
    const result = await admin.analytics({
      providerId: q.providerId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      page,
      pageSize,
    });
    reply.send(ok(result));
  });

  app.get('/api/v1/admin/providers', { schema: s(['admin'], 'List all providers') }, async (_req, reply) => {
    reply.send(ok(await svc.repo.listProviders()));
  });

  app.get('/api/v1/admin/health', { schema: s(['admin'], 'Health check for all providers') }, async (_req, reply) => {
    const providers = await svc.repo.listProviders();
    const reports = [];
    for (const p of providers) {
      reports.push(await admin.healthCheck(p.id));
    }
    reply.send(ok(reports));
  });
}