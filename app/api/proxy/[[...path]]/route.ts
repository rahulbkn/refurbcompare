// Same-origin API proxy for the RefurbCompare backend.
//
// Maps browser requests at /api/proxy/** to the backend API. Used when
// NEXT_PUBLIC_API_URL is set to "/api/proxy" so clients only ever talk to our
// own origin — the real backend origin stays server-only (EXTERNAL_API_URL).
//
// Security:
//   - Never forwards Authorization / cookie / X-Admin-Key headers from the
//     client. The internal token is attached server-side by gatewayFetch.
//   - Responses are JSON/text passthrough; internal headers are stripped.
//   - Enforces the gateway timeout for every request.
//
// The same helper powers server-side data fetching (lib/api-gateway.ts), so a
// single code path is used whether the caller is a Server Component or a
// browser hitting /api/proxy.

import { NextRequest, NextResponse } from "next/server";
import { ApiError, gatewayRequest } from "@/lib/api-gateway";

export const dynamic = "force-dynamic";

// Headers the backend may return that only make sense inside our own network.
const INTERNAL_RESPONSE_HEADERS = ["x-admin-key", "set-cookie", "authorization"];

/** Only forward requests to known public API prefixes; everything else 404. */
const ALLOWED_PATH_PREFIXES = [
  "/api/v1/products",
  "/api/v1/deals",
  "/api/v1/price-history",
  "/api/v1/price-alerts",
  "/api/v1/providers",
];

async function handle(request: NextRequest, path: string[]): Promise<NextResponse> {
  const rest = `/${path.join("/")}`;
  const allowed = ALLOWED_PATH_PREFIXES.some((p) => {
    return rest === p || rest.startsWith(`${p}/`);
  });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Unknown proxy path." } },
      { status: 404 },
    );
  }

  const method = request.method;
  let payload: unknown;
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    const raw = await request.text().catch(() => "");
    try {
      payload = raw ? JSON.parse(raw) : undefined;
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
        { status: 400 },
      );
    }
  }

  try {
    const result = await gatewayRequest(rest, {
      method,
      query: Object.fromEntries(request.nextUrl.searchParams),
      payload,
      redirect: "manual",
    });

    // Keep the status + envelope, drop internal response headers.
    const headers = new Headers();
    for (const [key, value] of result.headers.entries()) {
      if (INTERNAL_RESPONSE_HEADERS.includes(key.toLowerCase())) continue;
      if (key.toLowerCase() === "content-encoding") continue;
      headers.set(key, value);
    }
    // Fresh data per request; allow 60s CDN cache so bursts don't hammer the API.
    if (method === "GET") {
      headers.set("cache-control", headers.get("cache-control") ?? "public, max-age=0, s-maxage=60");
    }

    let body: unknown;
    try {
      body = result.body ? JSON.parse(result.body) : null;
    } catch {
      body = result.body;
    }
    return NextResponse.json(body, { status: result.status, headers });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: err.code, message: err.message, details: err.details },
        },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "PROXY_ERROR", message: "Proxy upstream error." } },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path ?? []);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path ?? []);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path ?? []);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return handle(request, path ?? []);
}