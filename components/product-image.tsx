"use client";

import { useState } from "react";

/**
 * Product thumbnail with graceful fallback.
 *
 * Uses a plain <img> instead of next/image on purpose: the site runs on
 * OpenNext/Cloudflare Workers where the default image optimizer needs extra
 * loader configuration, and provider CDNs (Shopify, Zoho, Cashify) change by
 * provider — a plain img renders any host with no remotePatterns upkeep.
 *
 * If the URL is missing or fails to load we show a generic smartphone glyph,
 * never another product's photo.
 */
export default function ProductImage({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = src && !broken;

  return (
    <span className={`flex h-full w-full items-center justify-center ${className}`}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className="h-10 w-10 text-[var(--text-muted)]"
        >
          <rect x="7" y="2.5" width="10" height="19" rx="2" />
          <line x1="10.5" y1="18.5" x2="13.5" y2="18.5" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
