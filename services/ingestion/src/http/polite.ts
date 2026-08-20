/**
 * Shared robots-aware, rate-limited HTTP layer for all live crawl/feed
 * connectors. Every request is gated on the origin's robots.txt (RFC 9309)
 * and throttled by the provider authorization's maxRequestsPerMinute. Pages
 * that respond with anti-bot walls (403/406/418/429 or captcha markers) abort
 * the crawl for that connector instead of being bypassed.
 */

export const POLITE_UA =
  'RefurbMeterBot/0.1 (authorized price-comparison crawler; https://refurbmeter.pages.dev/contact polite-crawler)';

export class RobotsDisallowedError extends Error {
  constructor(readonly url: string, reason: string) {
    super(reason);
    this.name = 'RobotsDisallowedError';
    this.url = url;
  }
}

export class PoliteBlockedError extends Error {
  constructor(
    readonly url: string,
    readonly status: number | null,
    reason = 'anti-bot wall',
  ) {
    super(`blocked by anti-bot wall (${reason}) at ${url}${status ? ` (HTTP ${status})` : ''}`);
    this.name = 'PoliteBlockedError';
    this.url = url;
    this.status = status;
  }
}

interface Rule {
  kind: 'allow' | 'disallow';
  pattern: string;
  /** Specificity per RFC 9309: longest rule (ignoring * and $) wins. */
  length: number;
}

interface RobotSet {
  groups: Map<string, Rule[]>;
  crawlDelay: number | null;
}

function pathToRegex(pattern: string): RegExp {
  const re = pattern.replace(/([.+?^${}()|[\]\\])/g, '\\$1');
  const src = re.replace(/\*/g, '.*').replace(/\\\$$/g, '$');
  return new RegExp(`^${src}`);
}

function ruleMatches(pattern: string, path: string): boolean {
  if (!pattern) return true;
  if (pattern[0] !== '/') return path.includes(pattern);
  return pathToRegex(pattern).test(path);
}

function specificity(pattern: string): number {
  return pattern.replace(/[*$]/g, '').length;
}

function evaluate(group: Rule[] | undefined, path: string): boolean {
  if (!group || group.length === 0) return true;
  let best: Rule | null = null;
  for (const rule of group) {
    if (!ruleMatches(rule.pattern, path)) continue;
    if (!best || rule.length > best.length) best = rule;
  }
  return best === null ? true : best.kind === 'allow';
}

function hardBlocked(group: Rule[] | undefined): boolean {
  if (!group) return false;
  return group.some((r) => r.kind === 'disallow' && (r.pattern === '/' || r.pattern === '/*' || r.pattern === '*'));
}

function parseRobots(text: string): RobotSet {
  const groups = new Map<string, Rule[]>();
  let crawlDelay: number | null = null;
  let currentUa: string | null = null;
  let rules: Rule[] = [];

  const flush = () => {
    if (currentUa !== null) {
      groups.set(currentUa, rules.length ? rules : []);
      rules = [];
    }
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    switch (key) {
      case 'user-agent':
        flush();
        currentUa = value.toLowerCase();
        break;
      case 'allow':
        if (currentUa) rules.push({ kind: 'allow', pattern: value, length: specificity(value) });
        break;
      case 'disallow':
        if (currentUa) rules.push({ kind: 'disallow', pattern: value, length: specificity(value) });
        break;
      case 'crawl-delay': {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) crawlDelay = n;
        break;
      }
    }
  }
  flush();

  return { groups, crawlDelay };
}

interface RobotsState {
  origin: string;
  groups: Map<string, Rule[]>;
  crawlDelay: number | null;
  uaGroup: string | null;
  fetchError: Error | null;
}

const ROBOTS_TTL_MS = 60 * 60 * 1000;

export class PoliteFetcher {
  private robotsCache = new Map<string, { state: RobotsState; fetchedAt: number }>();
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(private readonly opts: { ua?: string; defaultMaxRequestsPerMinute?: number; timeoutMs?: number }) {}

  private originOf(url: string): string {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  }

  private uaToken(): string {
    const ua = this.opts.ua ?? POLITE_UA;
    return ua.split(/\s+/)[0]!.replace(/\/.*$/, '').toLowerCase();
  }

  private async robotsState(origin: string): Promise<RobotsState> {
    const cached = this.robotsCache.get(origin);
    if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached.state;

    let state: RobotsState = {
      origin,
      groups: new Map(),
      crawlDelay: null,
      uaGroup: null,
      fetchError: null,
    };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { 'user-agent': this.opts.ua ?? POLITE_UA },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const text = await res.text();
        const parsed = parseRobots(text);
        state = {
          origin,
          groups: parsed.groups,
          crawlDelay: parsed.crawlDelay,
          uaGroup: null,
          fetchError: null,
        };
      }
    } catch (err) {
      state = {
        origin,
        groups: new Map(),
        crawlDelay: null,
        uaGroup: null,
        fetchError: err instanceof Error ? err : new Error(String(err)),
      };
    }
    this.robotsCache.set(origin, { state, fetchedAt: Date.now() });
    return state;
  }

  private effectiveRules(state: RobotsState): Rule[] | undefined {
    const ua = this.uaToken();
    // Exact user-agent first (longest UA token wins by exactness), else '*'.
    const candidates = [state.groups.get(ua), state.groups.get('*')];
    for (const group of candidates) {
      if (group && group.length > 0) return group;
    }
    return candidates[0] ?? undefined;
  }

  /** Returns a reason string when the URL must not be fetched, else null. */
  async robotsReason(url: string): Promise<string | null> {
    const origin = this.originOf(url);
    let state: RobotsState;
    try {
      state = await this.robotsState(origin);
    } catch {
      return null;
    }
    const rules = this.effectiveRules(state);
    if (state.fetchError) return null; // absent/unreachable robots.txt -> default allow
    if (hardBlocked(rules)) return `robots.txt disallows crawling ${origin} entirely`;
    if (!evaluate(rules, new URL(url).pathname)) {
      return `robots.txt disallows path ${new URL(url).pathname} on ${origin}`;
    }
    return null;
  }

  private async acquire(origin: string, maxPerMinute: number): Promise<void> {
    const bucket = this.buckets.get(origin) ?? { tokens: maxPerMinute, lastRefill: Date.now() };
    const now = Date.now();
    bucket.tokens = Math.min(maxPerMinute, bucket.tokens + ((now - bucket.lastRefill) / 60000) * maxPerMinute);
    bucket.lastRefill = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(origin, bucket);
      return;
    }
    const waitMs = Math.min(30000, ((1 - bucket.tokens) / maxPerMinute) * 60000);
    await new Promise((r) => setTimeout(r, waitMs));
    bucket.tokens = 0;
    this.buckets.set(origin, bucket);
  }

  private blockedPage(html: string): string | null {
    const lower = html.slice(0, 200000).toLowerCase();
    if ((lower.includes('just a moment') || lower.includes('/cdn-cgi/challenge-platform/')) && (lower.includes('cf-') || lower.includes('cloudflare'))) {
      return 'Cloudflare challenge';
    }
    if (lower.includes('g-recaptcha') || lower.includes('recaptcha/api')) return 'reCAPTCHA';
    if (lower.includes('enable javascript and cookies to continue') && lower.includes('verify you are human')) return 'anti-bot check';
    return null;
  }

  async text(url: string, opts: { maxRequestsPerMinute?: number } = {}): Promise<string> {
    const origin = this.originOf(url);
    const reason = await this.robotsReason(url);
    if (reason) throw new RobotsDisallowedError(url, reason);

    const maxPerMinute = opts.maxRequestsPerMinute ?? this.opts.defaultMaxRequestsPerMinute ?? 30;
    await this.acquire(origin, maxPerMinute);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 20000);
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': this.opts.ua ?? POLITE_UA,
          accept: 'text/html,application/json,application/ld+json,application/xhtml+xml,*/*;q=0.8',
          'accept-language': 'en-IN,en;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (res.status === 403 || res.status === 406 || res.status === 418 || res.status === 429) {
        throw new PoliteBlockedError(url, res.status);
      }
      const body = await res.text();
      const wall = this.blockedPage(body);
      if (wall) throw new PoliteBlockedError(url, res.status, wall);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async json<T>(url: string, opts: { maxRequestsPerMinute?: number } = {}): Promise<T> {
    const body = await this.text(url, opts);
    return JSON.parse(body) as T;
  }
}