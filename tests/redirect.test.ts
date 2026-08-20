import { describe, it, expect } from 'vitest';
import {
  parseAllowedUrl,
  isForbiddenHost,
  hostAllowed,
  parseAllowedDomains,
  buildTargetUrl,
  resolveRedirectTarget,
} from '@refurbcompare/core';

describe('parseAllowedUrl', () => {
  it('accepts https URLs', () => {
    expect(parseAllowedUrl('https://budli.in/product/x')?.hostname).toBe('budli.in');
  });

  it('rejects http in production semantics and all dangerous schemes', () => {
    expect(parseAllowedUrl('http://budli.in/x')).toBeNull();
    expect(parseAllowedUrl('javascript:alert(1)')).toBeNull();
    expect(parseAllowedUrl('data:text/html,hi')).toBeNull();
    expect(parseAllowedUrl('//budli.in/x')).toBeNull();
  });

  it('accepts http only when explicitly allowed (dev)', () => {
    expect(parseAllowedUrl('http://localhost:3000/x', true)).not.toBeNull();
  });
});

describe('isForbiddenHost', () => {
  it('flags loopback, local hosts and our own domain', () => {
    expect(isForbiddenHost('localhost')).toBe(true);
    expect(isForbiddenHost('127.0.0.1')).toBe(true);
    expect(isForbiddenHost('printer.local')).toBe(true);
    expect(isForbiddenHost('refurbcompare.in')).toBe(true);
    expect(isForbiddenHost('budli.in')).toBe(false);
  });
});

describe('hostAllowed', () => {
  it('allows exact host and subdomains only (boundary-aware)', () => {
    expect(hostAllowed('cashify.in', ['cashify.in'])).toBe(true);
    expect(hostAllowed('www.cashify.in', ['cashify.in'])).toBe(true);
    expect(hostAllowed('evilcashify.in', ['cashify.in'])).toBe(false);
    expect(hostAllowed('notcashify.in', ['cashify.in'])).toBe(false);
  });
});

describe('parseAllowedDomains', () => {
  it('parses a comma/space separated list into bare hosts', () => {
    expect(parseAllowedDomains('cashify.in, www.budli.in; https://refit.global/')).toEqual([
      'cashify.in',
      'www.budli.in',
      'refit.global',
    ]);
    expect(parseAllowedDomains(null)).toEqual([]);
  });
});

describe('buildTargetUrl', () => {
  it('appends utm params and sanitizes user input', () => {
    const url = buildTargetUrl(new URL('https://cashify.in/p'), {
      source: 'refurbcompare',
      medium: 'affiliate',
      campaign: 'summer',
    });
    expect(url).toContain('utm_source=refurbcompare');
    expect(url).toContain('utm_medium=affiliate');
    expect(url).toContain('utm_campaign=summer');
  });

  it('drops params with dangerous characters', () => {
    const url = buildTargetUrl(new URL('https://cashify.in/p'), {
      source: 'refurbcompare; url=https://evil.example',
    });
    expect(url).not.toContain('evil.example');
  });
});

describe('resolveRedirectTarget', () => {
  const base = {
    rawUrl: 'https://cashify.in/product/iphone-13',
    affiliateUrl: null,
    allowedDomains: ['cashify.in'],
    utm: { source: 'refurbcompare' },
  };

  it('resolves a direct URL inside the approved domain', () => {
    const target = resolveRedirectTarget(base);
    expect(target?.source).toBe('direct');
    expect(target?.url).toContain('cashify.in');
    expect(target?.url).toContain('utm_source=refurbcompare');
  });

  it('prefers the affiliate URL when present and valid', () => {
    const target = resolveRedirectTarget({ ...base, affiliateUrl: 'https://cashify.in/go?ref=aff' });
    expect(target?.source).toBe('affiliate');
    expect(target?.url).toContain('ref=aff');
  });

  it('rejects URLs outside the approved domain', () => {
    expect(resolveRedirectTarget({ ...base, rawUrl: 'https://evil.example/x' })).toBeNull();
  });

  it('rejects forbidden hosts even when allowlisted', () => {
    expect(
      resolveRedirectTarget({ ...base, rawUrl: 'https://refurbcompare.in/x', allowedDomains: ['refurbcompare.in'] }),
    ).toBeNull();
  });
});