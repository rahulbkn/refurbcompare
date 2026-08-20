import type { MetadataRoute } from "next";
import { DEMO_MODE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    rules: DEMO_MODE
      ? { userAgent: "*", disallow: "/" }
      : { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base,
  };
}