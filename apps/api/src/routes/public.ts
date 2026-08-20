import type { FastifyInstance } from 'fastify';
import {
  listProductsQuerySchema,
  searchQuerySchema,
  priceAlertCreateSchema,
  priceHistoryQuerySchema,
  redirectQuerySchema,
  paginationSchema,
} from '@refurbcompare/core';
import { ok } from '../plugins/errors.js';
import { s } from './route-meta.js';
import type { ApiServices } from '../bootstrap.js';

export function registerPublicRoutes(app: FastifyInstance, svc: ApiServices): void {
  const { product, offers, search, redirect, priceHistory, priceAlert, provider, config } = svc;

  app.get('/healthz', { schema: s(['system'], 'Liveness + runtime mode') }, async () => {
    return ok({ status: 'ok', mode: config.dataMode, driver: svc.repo.driver });
  });

  // Render/uptime-monitor friendly liveness. Deliberately DB-free so it stays
  // healthy during provisioning and never triggers a scrape or provider sync.
  app.get('/api/v1/health', { schema: s(['system'], 'Simple liveness for platform health checks') }, async () => {
    return ok({ status: 'ok', service: 'refurbcompare-api', mode: config.dataMode, driver: svc.repo.driver });
  });

  app.get('/', { schema: s(['system'], 'Service banner') }, async () => {
    return ok({
      service: 'refurbcompare-api',
      version: '0.1.0',
      mode: config.dataMode,
      docs: '/docs',
      openapi: '/openapi.json',
    });
  });

  app.get('/api/v1/products', { schema: s(['products'], 'List products with filters + pagination') }, async (req, reply) => {
    const q = listProductsQuerySchema.parse(req.query);
    const { items, total } = await product.listProducts({
      query: q.query,
      brand: q.brand,
      model: q.model,
      condition: q.condition,
      minPrice: q.minPrice,
      maxPrice: q.maxPrice,
      sort: q.sort,
      inStock: q.inStock === 'true' ? true : q.inStock === 'false' ? false : undefined,
      page: q.page,
      pageSize: q.pageSize,
    });
    reply.send(ok(items, { page: q.page, pageSize: q.pageSize, total }));
  });

  app.get('/api/v1/products/:slug', { schema: s(['products'], 'Product by slug') }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    reply.send(ok(await product.getProduct(slug)));
  });

  app.get('/api/v1/products/:slug/listings', { schema: s(['products'], 'All offers + comparison for a product') }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const prod = await product.getProduct(slug);
    const comparison = await offers.compareProduct(prod.id);
    reply.send(ok(comparison));
  });

  app.get('/api/v1/search', { schema: s(['search'], 'Search products') }, async (req, reply) => {
    const q = searchQuerySchema.parse(req.query);
    const result = await search.search(q.q, q.page, q.pageSize);
    reply.send(ok(result.items, { page: q.page, pageSize: q.pageSize, total: result.total, q: q.q }));
  });

  app.get('/api/v1/deals', { schema: s(['deals'], 'Top discounted offers') }, async (req, reply) => {
    const q = paginationSchema.parse(req.query);
    reply.send(ok(await offers.topDeals(q.pageSize)));
  });

  app.get('/api/v1/price-history/:productId', { schema: s(['price-history'], 'Price history for a product') }, async (req, reply) => {
    const { productId } = req.params as { productId: string };
    const q = priceHistoryQuerySchema.parse(req.query);
    reply.send(ok(await priceHistory.getHistory(productId, q.days)));
  });

  app.post('/api/v1/price-alerts', { schema: s(['price-alerts'], 'Create a price-drop alert') }, async (req, reply) => {
    const body = priceAlertCreateSchema.parse(req.body);
    const result = await priceAlert.create(body);
    reply.status(201).send(ok(result));
  });

  app.get('/api/v1/providers', { schema: s(['providers'], 'Public provider list') }, async (_req, reply) => {
    reply.send(ok(await provider.listPublic()));
  });

  // JSON variant of the redirect (useful for the app and programmatic clients).
  app.get('/api/v1/redirect/:listingId', { schema: s(['redirect'], 'Resolve an outbound redirect as JSON') }, async (req, reply) => {
    const { listingId } = req.params as { listingId: string };
    const q = redirectQuerySchema.parse(req.query);
    const resolution = await redirect.resolve({
      listingId,
      utm: { source: q.utm_source, medium: q.utm_medium, campaign: q.utm_campaign, ref: q.ref },
      userAgent: req.headers['user-agent'] ?? null,
      referrer: req.headers.referer ?? null,
    });
    reply.send(ok(resolution));
  });

  // Canonical 302 outbound redirect with click tracking + attribution params.
  app.get('/go/:listingId', { schema: s(['redirect'], '302 outbound redirect with click tracking') }, async (req, reply) => {
    const { listingId } = req.params as { listingId: string };
    const q = redirectQuerySchema.parse(req.query);
    const resolution = await redirect.resolve({
      listingId,
      utm: { source: q.utm_source, medium: q.utm_medium, campaign: q.utm_campaign, ref: q.ref },
      userAgent: req.headers['user-agent'] ?? null,
      referrer: req.headers.referer ?? null,
    });
    reply.redirect(resolution.targetUrl, 302);
    return reply;
  });
}