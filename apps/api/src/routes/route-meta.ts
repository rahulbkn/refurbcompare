/** Lightweight OpenAPI metadata (tags + summary only). Response schemas are
 * intentionally omitted so fast-json-stringify never re-shapes payloads. */
export function s(tags: string[], summary: string): { tags: string[]; summary: string } {
  return { tags, summary };
}