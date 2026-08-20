/** Fastify-style redirect safeguard shared by web + API layers. */

export interface SafeRedirectTarget {
  url: string;
  source: 'affiliate' | 'direct';
}

const ALLOWED_PROTOCOLS = ['https:'];
const DEV_PROTOCOLS = ['http:', 'https:'];

/**
 * Validates that `raw` is a well-formed absolute URL using an allowed scheme.
 * Never allows javascript:, data:, file: or protocol-relative URLs.
 */
export function parseAllowedUrl(raw: string, allowHttp = false): URL | null {
  const protocols = allowHttp ? DEV_PROTOCOLS : ALLOWED_PROTOCOLS;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!protocols.includes(url.protocol)) return null;
  if (!url.hostname) return null;
  return url;
}

/** true for any user-controlled host which we must never redirect to. */
export function isForbiddenHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    host.includes('refurbcompare')
  );
}

/**
 * Checks that `hostname` is either an exact match for or a subdomain of one of
 * the allowed domains (boundary-aware: "cashify.in" does not approve "evilcashify.in").
 */
export function hostAllowed(hostname: string, allowedDomains: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  for (const allowed of allowedDomains) {
    const domain = allowed.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (!domain) continue;
    if (host === domain) return true;
    if (host.endsWith(`.${domain}`)) return true;
  }
  return false;
}

/** Parses the provider's allowedDomains string into a list of bare hostnames. */
export function parseAllowedDomains(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''))
    .filter((s) => s.length > 0 && s.includes('.'));
}

export interface UTMConfig {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  ref?: string | null;
}

const SAFE_CHARS = /^[a-zA-Z0-9._~:-]+$/;

function sanitizeParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.trim();
  if (!clean || clean.length > 100) return null;
  if (!SAFE_CHARS.test(clean)) return null;
  return clean;
}

/**
 * Appends campaign/attribution params to a validated target URL. Only accepts
 * params composed of safe characters; rejects anything that could smuggle a
 * different host via parameter values.
 */
export function buildTargetUrl(base: URL, utm: UTMConfig): string {
  base.searchParams.set('utm_source', sanitizeParam(utm.source) ?? 'refurbcompare');
  const medium = sanitizeParam(utm.medium);
  if (medium) base.searchParams.set('utm_medium', medium);
  const campaign = sanitizeParam(utm.campaign);
  if (campaign) base.searchParams.set('utm_campaign', campaign);
  const ref = sanitizeParam(utm.ref);
  if (ref) base.searchParams.set('ref', ref);
  return base.toString();
}

/**
 * Full redirect resolution: verifies protocol + host against the provider's
 * approved domains, preferring the affiliate URL when present and still valid.
 */
export function resolveRedirectTarget(opts: {
  rawUrl: string;
  affiliateUrl: string | null;
  allowedDomains: string[];
  utm: UTMConfig;
  allowHttp?: boolean;
}): SafeRedirectTarget | null {
  const urls = opts.affiliateUrl ? [opts.affiliateUrl, opts.rawUrl] : [opts.rawUrl];
  for (const candidate of urls) {
    const parsed = parseAllowedUrl(candidate, opts.allowHttp);
    if (!parsed) continue;
    if (isForbiddenHost(parsed.hostname)) continue;
    if (!hostAllowed(parsed.hostname, opts.allowedDomains)) continue;
    return {
      url: buildTargetUrl(parsed, opts.utm),
      source: candidate === opts.affiliateUrl ? 'affiliate' : 'direct',
    };
  }
  return null;
}