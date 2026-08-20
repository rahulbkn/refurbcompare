const UTM_SOURCE = "refurbcompare";
const UTM_MEDIUM = "referral";

export type RedirectPolicy = {
  source: string;
  medium: string;
  campaign: string;
  ref: string;
};

export const DEFAULT_POLICY: RedirectPolicy = {
  source: UTM_SOURCE,
  medium: UTM_MEDIUM,
  campaign: UTM_SOURCE,
  ref: UTM_SOURCE,
};

/**
 * Returns true when the URL is an https URL whose hostname is covered by at
 * least one of the allowlist hosts (exact match or subdomain match). Each
 * allowlist entry may be a bare hostname ("budli.in") or a full URL
 * ("https://www.budli.in"). This prevents open-redirect through the
 * /go/[listingId] route.
 */
export function isSafeRedirectUrl(
  url: string,
  allowedHosts: string[],
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  return allowedHosts.some((allowed) => {
    let candidate = allowed.trim().toLowerCase();
    try {
      candidate = new URL(candidate).hostname;
    } catch {
      // bare hostname — keep as-is
    }
    const normalized = candidate.replace(/^www\./, "");
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

/**
 * Build the final outbound URL: validate against the seller's own domain,
 * then append trackable referral query parameters.
 */
export function buildTargetUrl(input: {
  baseUrl: string;
  sellerWebsiteUrl: string;
  policy?: RedirectPolicy;
}): string {
  const policy = input.policy ?? DEFAULT_POLICY;

  if (!isSafeRedirectUrl(input.baseUrl, [input.sellerWebsiteUrl])) {
    throw new Error(
      `Refusing to build redirect for disallowed host: ${input.baseUrl}`,
    );
  }

  const url = new URL(input.baseUrl);
  url.searchParams.set("utm_source", policy.source);
  url.searchParams.set("utm_medium", policy.medium);
  url.searchParams.set("utm_campaign", policy.campaign);
  url.searchParams.set("ref", policy.ref);

  return url.toString();
}

export function redirectStatus(isPermanent = false): 302 | 308 {
  return isPermanent ? 308 : 302;
}