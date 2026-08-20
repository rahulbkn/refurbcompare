import { NextResponse } from "next/server";
import { createPriceAlertSchema } from "@/lib/validation";
import { createPriceAlert, ApiError } from "@/lib/api-client";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createPriceAlertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const { data } = await createPriceAlert(parsed.data);
    return NextResponse.json(
      {
        id: data.alert.id,
        message:
          "Price alert is saved; notifications are not currently enabled.",
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return NextResponse.json(
        { error: "Price alert already active for this product and email." },
        { status: 409 },
      );
    }
    if (err instanceof ApiError && err.status === 404) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Could not save the price alert. Try again later." },
      { status: 502 },
    );
  }
}