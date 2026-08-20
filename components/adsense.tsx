"use client";

import { useEffect, useRef } from "react";

// Configurable Google AdSense placement.
//
// Disabled by default. Enable by setting NEXT_PUBLIC_ADSENSE_ENABLED="true"
// and NEXT_PUBLIC_ADSENSE_CLIENT="ca-pub-XXXXXXXX" in your environment; the
// client ID is a public value (it appears in the published page source), so
// making it a NEXT_PUBLIC_ var is intentional.
//
// When disabled (the default) this renders nothing and loads no SDK, keeping
// the site ad-free until monetization is configured.

const ADSENSE_ENABLED =
  process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function isAdSlotEnabled(): boolean {
  return ADSENSE_ENABLED && ADSENSE_CLIENT.startsWith("ca-pub-");
}

export default function AdSlot({ pname }: { pname: string }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!isAdSlotEnabled()) return;
    if (typeof window === "undefined") return;
    // Load the async AdSense loader exactly once per session so configured
    // placements actually render. Doing this in the placement component keeps
    // the SDK entirely off pages that have no ad slot.
    if (!document.querySelector("script[data-refurbcompare-adsense]")) {
      const script = document.createElement("script");
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.refurbcompareAdsense = "1";
      document.head.appendChild(script);
    }
    if (!pushed.current) {
      pushed.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Ad unit rejected by policy or temporarily unavailable; never breaks
        // the page.
      }
    }
  }, []);

  if (!isAdSlotEnabled()) return null;

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-[var(--border)]">
      <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
        Advertisement
      </div>
      <ins
        className="adsbygoogle block min-h-[100px] w-full"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={pname}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}