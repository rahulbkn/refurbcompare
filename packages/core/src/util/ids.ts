/** Deterministic stable id from a prefix + unique key (portable, no crypto dep). */
export function stableId(prefix: string, key: string): string {
  const cleanedPfx = prefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const cleanedKey = key
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${cleanedPfx}_${cleanedKey}`;
}

/** Random hex id generator that works in Node and edge runtimes. */
export function randomHexId(length = 24): string {
  const alphabet = '0123456789abcdef';
  let out = '';
  // Prefer Web Crypto when available (node:crypto is a Node-only feature and
  // is therefore intentionally avoided here).
  const cryptoLike = globalThis.crypto as { getRandomValues?: (b: Uint8Array) => Uint8Array } | undefined;
  if (cryptoLike?.getRandomValues) {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    cryptoLike.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) out += alphabet[(bytes[i] ?? 0) % 16]!;
    return out.slice(0, length);
  }
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * 16)]!;
  return out;
}

/** Short user-facing click id (base36, url-safe). */
export function shortId(): string {
  return randomHexId(12);
}