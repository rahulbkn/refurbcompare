// WorkerDatabase — the database boundary for the Cloudflare deployment.
//
// The Mode A deployment (default) keeps data inside an external Fastify API
// (Postgres on our side, exposed through EXTERNAL_API_URL). The frontend
// Worker never holds database credentials; it talks to the API through
// lib/api-gateway.ts.
//
// This module is the explicit seam that would change for Mode B (backend
// running inside the Worker with Hyperdrive): swapping `getWorkerDatabase`'s
// resolution would move page data onto the Worker's own Postgres while keeping
// page/repo code untouched.
//
//   API_MODE=external   -> externalApiDatabase  (Mode A, default)
//   API_MODE=hyperdrive -> hyperdrivePlaceholderDatabase (Mode B, stub)

import {
  API_MODE,
  gatewayGet,
} from "./api-gateway";
import type { ApiProduct } from "./api-client";

export type WorkerDatabase = {
  readonly mode: "external" | "hyperdrive";
  health(): Promise<{ ok: boolean; provider: string }>;
  fetchProducts(query?: Record<string, unknown>): Promise<ApiProduct[]>;
  fetchProduct(slugOrId: string): Promise<ApiProduct | null>;
  /** Placeholder for row-level writes; Mode A writes happen through the API. */
  ping(): Promise<string>;
};

/** Mode A — everything delegates to the external Fastify API. */
const externalApiDatabase: WorkerDatabase = {
  mode: "external",
  async health() {
    try {
      await gatewayGet<{ status: string }>("/healthz");
      return { ok: true, provider: "external-api" };
    } catch {
      return { ok: false, provider: "external-api" };
    }
  },
  async fetchProducts(query) {
    const { data } = await gatewayGet<ApiProduct[]>("/api/v1/products", {
      page: 1,
      pageSize: 100,
      ...query,
    });
    return data;
  },
  async fetchProduct(slugOrId) {
    try {
      const { data } = await gatewayGet<ApiProduct>(
        `/api/v1/products/${encodeURIComponent(slugOrId)}`,
      );
      return data;
    } catch {
      return null;
    }
  },
  async ping() {
    return "external-api";
  },
};

/** Scaffolding for local/CI usage with no backend; returns empty results. */
const mockDatabase: WorkerDatabase = {
  mode: "external",
  async health() {
    return { ok: true, provider: "mock" };
  },
  async fetchProducts() {
    return [];
  },
  async fetchProduct() {
    return null;
  },
  async ping() {
    return "mock";
  },
};

/**
 * Mode B stub. Wiring this up means bundling the backend's database layer into
 * the Worker and pointing Postgres through a Hyperdrive binding
 * (`HYPERDRIVE_DATABASE_URL` / `binding = "HYPERDRIVE"`). Not implemented yet —
 * it refuses to run so it can never silently serve wrong data.
 */
const hyperdrivePlaceholderDatabase: WorkerDatabase = {
  mode: "hyperdrive",
  async health() {
    return { ok: false, provider: "hyperdrive (not configured)" };
  },
  async fetchProducts() {
    throw new Error(
      "Mode B (Hyperdrive) is not implemented. Set API_MODE=external (Mode A) or remove the hyperdrive binding.",
    );
  },
  async fetchProduct() {
    throw new Error("Mode B (Hyperdrive) is not implemented. Use Mode A.");
  },
  async ping() {
    throw new Error("Mode B (Hyperdrive) is not implemented. Use Mode A.");
  },
};

export function getWorkerDatabase(): WorkerDatabase {
  switch (API_MODE) {
    case "external":
      // When neither direct nor proxied API base is set (pure scaffolding à la
      // `mock` driver), degrade to the mock.
      return (
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.EXTERNAL_API_URL ||
        process.env.API_URL
      )
        ? externalApiDatabase
        : mockDatabase;
    case "hyperdrive":
      return hyperdrivePlaceholderDatabase;
    default:
      return externalApiDatabase;
  }
}

export { externalApiDatabase, mockDatabase, hyperdrivePlaceholderDatabase };