import type { MetadataRoute } from "next";
import { DEMO_MODE } from "@/lib/seo";
import { getRepository } from "@/lib/repo";

const STATIC_ROUTES = [
  "",
  "phones",
  "deals",
  "search",
  "price-history",
  "guides",
  "about",
  "how-it-works",
  "terms",
  "privacy",
  "disclaimer",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  if (!DEMO_MODE) {
    try {
      const repo = await getRepository();
      const items = await repo.listProducts({ limit: 200 });
      for (const product of items) {
        if (product.slug) {
          entries.push({
            url: new URL(`/phones/${product.slug}`, base).toString(),
            changeFrequency: "daily",
            priority: 0.8,
          });
        }
      }
    } catch {
      // Degrade gracefully to static routes; never fail the build over the
      // sitemap when the API/DB is unreachable at build time.
    }
  }

  return entries;
}