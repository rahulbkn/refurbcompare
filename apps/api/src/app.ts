import Fastify, { type FastifyBaseLogger } from 'fastify';
import type { Server, IncomingMessage, ServerResponse } from 'node:http';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { toFastifyErrorHandler } from './plugins/errors.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerAdminRoutes } from './routes/admin.js';
import type { ApiServices } from './bootstrap.js';

export function buildApp(svc: ApiServices) {
  const { config, logger } = svc;

  const app = Fastify<Server, IncomingMessage, ServerResponse, FastifyBaseLogger>({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    genReqId: (req) => (req.headers['x-request-id'] as string) ?? crypto.randomUUID().slice(0, 12),
    trustProxy: true,
  });

  app.setErrorHandler(toFastifyErrorHandler());

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Origin not allowed'), false);
    },
    credentials: true,
  });

  app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: 60_000,
    // Rate-limit responses use the JSON:API envelope too.
    errorResponseBuilder: (req, ctx) => ({
      success: false,
      error: { code: 'RATE_LIMITED', message: `Rate limit exceeded (max ${ctx.max} requests per minute)` },
      requestId: (req.id as string) ?? undefined,
    }),
  });

  app.register(swagger, {
    openapi: {
      info: { title: 'RefurbMeter API', version: '0.1.0' },
      servers: [{ url: `http://${config.host}:${config.port}` }],
    },
  });
  app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/openapi.json', async () => {
    const { swagger } = app as unknown as { swagger(): unknown };
    return swagger() as ReturnType<typeof swagger>;
  });

  // Register routes inside a plugin so @fastify/swagger's onRoute hook (installed
  // during plugin boot) can collect them for /docs + /openapi.json. Routes added
  // directly on the root instance before boot complete never reach the hook.
  app.register(
    async (routed) => {
      registerPublicRoutes(routed, svc);
      registerAdminRoutes(routed, svc);
    },
    { prefix: '' },
  );

  return app;
}