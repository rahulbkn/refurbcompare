/** FNV-1a 32-bit hash → hex. Portable, deterministic. */
export function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'other';

const MOBILE = /\b(iphone|android|mobile)\b/i;
const TABLET = /\b(ipad|tablet)\b/i;
const BOT = /\b(bot|crawler|spider|curl|wget|headless)\b/i;
const DESKTOP = /\b(windows|macintosh|linux|mac os)\b/i;

export function detectDeviceType(ua: string | null | undefined): DeviceType {
  if (!ua) return 'other';
  if (BOT.test(ua)) return 'bot';
  if (TABLET.test(ua)) return 'tablet';
  if (MOBILE.test(ua)) return 'mobile';
  if (DESKTOP.test(ua)) return 'desktop';
  return 'other';
}

/** Hash a raw user-agent so we never persist raw UA strings. */
export function hashUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return fnv1aHex(ua);
}