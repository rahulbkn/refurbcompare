// Repository adapter selection.
//
// Driver order:
//   1. REPO_DRIVER (explicit opt-in/out)
//   2. "api" when the frontend is wired to the Fastify backend — that is when
//      NEXT_PUBLIC_API_URL is configured (local dev) OR EXTERNAL_API_URL is set
//      (Mode A on Cloudflare, see lib/api-gateway.ts). Data then flows through
//      the API gateway on every deployment.
//   3. DATABASE_DRIVER env (default "prisma" in production, "sqlite" elsewhere)

import type { Repository } from "./types";

let cachedRepository: Repository | null = null;

const DEFAULT_DRIVER =
  process.env.NODE_ENV === "production" ? "prisma" : "sqlite";

export async function getRepository(): Promise<Repository> {
  if (cachedRepository) return cachedRepository;

  const driver = (
    process.env.REPO_DRIVER ??
    (process.env.NEXT_PUBLIC_API_URL || process.env.EXTERNAL_API_URL
      ? "api"
      : undefined) ??
    process.env.DATABASE_DRIVER ??
    DEFAULT_DRIVER
  ).toLowerCase();

  let repository: Repository;
  if (driver === "api") {
    const { apiRepository } = await import("./api");
    repository = apiRepository;
  } else if (driver === "prisma") {
    const { prismaRepository } = await import("./prisma");
    repository = prismaRepository;
  } else if (driver === "sqlite") {
    const { sqliteRepository } = await import("./sqlite");
    repository = sqliteRepository;
  } else {
    throw new Error(
      `Unknown REPO_DRIVER "${driver}" (expected "api", "sqlite" or "prisma").`,
    );
  }

  cachedRepository = repository;
  return repository;
}

export type { Repository } from "./types";

export * from "./types";