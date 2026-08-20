// Server-only gateway to the RefurbMeter backend API (Fastify).
//
// This is the single seam between the frontend and the backend API. It is only
// ever executed on the server (Server Components, route handlers, build-time
// codegen) so the resolved API base can stay secret in production.
//
// Base URL resolution order (Mode A):
//   1. EXTERNAL_API_URL  — server-only Worker secret (Cloudflare production)
//   2. NEXT_PUBLIC_API_URL — local dev. May be relative ("/api/proxy") to route
//      through the same-origin proxy handlers (app/api/proxy) so the browser
//      never talks to a backend origin directly.
//   3. API_URL            — generic override
//   4. http://127.0.0.1:4000 — local fallback
//
// Mode B (Hyperdrive / backend-in-worker) is not implemented; see
// lib/cloudflare-db.ts for the boundary and stub.

const DEFAULT_BASE = "http://127.0.0.1:4000";

/** Server-only resolved backend base. Never import this into client components. */
export function resolveApiBase(): string {
  const explicit = process.env.EXTERNAL_API_URL ?? process.env.API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const configured =
    process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    const trimmed = configured.replace(/\/+$/, "");
    // Relative base (e.g. "/api/proxy") = same-origin proxy handlers.
    if (trimmed.startsWith("/")) {
      const origin =
        process.env.FRONTEND_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
      const absolute = origin.replace(/\/+$/, "");
      if (absolute.startsWith("http")) return `${absolute}${trimmed}`;
      return trimmed;
    }
    return trimmed;
  }

  return DEFAULT_BASE;
}

export const API_BASE = resolveApiBase();

/** Request timeout for backend calls. Default 10s; override in .env/wrangler. */
export const API_TIMEOUT_MS = Number(
  process.env.EXTERNAL_API_TIMEOUT_MS ?? 10000,
);

/** Runtime mode of the data layer. "external" = Mode A (default). */
export const API_MODE = (
  process.env.API_MODE ?? "external"
).toLowerCase();

/**
 * Internal service-token header between our own frontend Worker and the
 * backend. Only attached server-side; the backend may ignore it for public
 * routes.
 */
const INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN || "";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** fetch() bounded by API_TIMEOUT_MS with the internal token attached. */
export async function gatewayFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  headers.set("accept", "application/json");
  if (!headers.has("user-agent")) {
    headers.set("user-agent", "refurbcompare-frontend/1.0 (server-side gateway)");
  }
  if (INTERNAL_TOKEN) {
    headers.set("x-refurbcompare-internal-token", INTERNAL_TOKEN);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        504,
        "GATEWAY_TIMEOUT",
        `The API did not respond within ${API_TIMEOUT_MS}ms.`,
      );
    }
    throw new ApiError(
      502,
      "GATEWAY_UNREACHABLE",
      `Could not reach the API at ${hostOf(url)}.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "the configured backend";
  }
}

export function buildGatewayUrl(
  path: string,
  query?: Record<string, unknown>,
): string {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

type ApiEnvelope<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export async function parseEnvelope<T>(
  res: Response,
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const raw = await res.text().catch(() => "");
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  const env = body as ApiEnvelope<T> | null;
  if (!res.ok || !env || env.success !== true) {
    const error = (body as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error;
    throw new ApiError(
      res.status || 502,
      error?.code ?? "API_ERROR",
      error?.message ?? `API request failed with status ${res.status}`,
      error?.details,
    );
  }
  return { data: env.data, meta: env.meta };
}

export async function gatewayGet<T>(
  path: string,
  query?: Record<string, unknown>,
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const res = await gatewayFetch(buildGatewayUrl(path, query), {
    cache: "no-store",
  });
  return parseEnvelope<T>(res);
}

export async function gatewayPost<T>(
  path: string,
  payload: unknown,
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const res = await gatewayFetch(buildGatewayUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return parseEnvelope<T>(res);
}

/**
 * Raw gateway request used by the /api/proxy handlers and the /go proxy.
 * Preserves HTTP status and lets callers decide whether to follow the
 * Location header (redirect: "manual").
 */
export async function gatewayRequest(
  path: string,
  options: {
    method?: string;
    query?: Record<string, unknown>;
    payload?: unknown;
    redirect?: RequestInit["redirect"];
  } = {},
): Promise<{ status: number; headers: Headers; body: string }> {
  const headers = new Headers();
  if (options.payload !== undefined) {
    headers.set("content-type", "application/json");
  }
  const res = await gatewayFetch(buildGatewayUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.payload !== undefined ? JSON.stringify(options.payload) : undefined,
    redirect: options.redirect ?? "follow",
    cache: "no-store",
  });
  const body = await res.text().catch(() => "");
  return { status: res.status, headers: res.headers, body };
}