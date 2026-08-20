export default function AffiliateDisclosure({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`${compact ? "text-[11px]" : "text-xs"} text-[var(--text-muted)]`}>
      RefurbMeter compares third-party offers.{" "}
      {compact ? "You'll be redirected to the seller's website to complete your purchase." : null}{" "}
      Prices and availability may change.
    </p>
  );
}