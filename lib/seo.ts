import type { Metadata } from "next";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const SITE_NAME = "RefurbCompare";
const DEFAULT_DESCRIPTION =
  "Compare refurbished smartphone prices across third-party sellers in India and find the best deal. Independent comparison — we never sell devices ourselves.";

export function buildPageMeta(input: {
  title: string;
  description?: string;
  canonicalPath?: string;
}): Metadata {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";

  return {
    title: input.title,
    description: input.description ?? DEFAULT_DESCRIPTION,
    alternates: input.canonicalPath
      ? { canonical: new URL(input.canonicalPath, base).toString() }
      : undefined,
    openGraph: {
      title: input.title,
      description: input.description ?? DEFAULT_DESCRIPTION,
      siteName: SITE_NAME,
      type: "website",
    },
    robots: DEMO_MODE
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export function structuredOfferListing(input: {
  name: string;
  price: number;
  availability: "InStock" | "OutOfStock";
  brand: string;
  url: string;
  currency: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: input.name,
    price: input.price,
    priceCurrency: input.currency,
    availability: input.availability,
    seller: { "@type": "Organization", name: "RefurbCompare" },
    url: input.url,
  };
}