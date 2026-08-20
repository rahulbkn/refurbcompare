import { NextResponse, type NextRequest } from "next/server";
import { proxyGo } from "@/lib/api-client";
import { idParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = idParamSchema.parse(await context.params);

  const result = await proxyGo(id, Object.fromEntries(request.nextUrl.searchParams));

  if (result.location) {
    const response = NextResponse.redirect(result.location, result.status as 302);
    if (result.demo) {
      response.headers.set("X-RefurbMeter-Demo", result.demo);
    }
    return response;
  }

  // Forward the backend's error envelope (404 / 403 / 410 / 422 / 5xx).
  return NextResponse.json(result.body ?? { error: "Redirect failed." }, {
    status: result.status,
  });
}