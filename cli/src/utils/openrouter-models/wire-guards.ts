/**
 * Shared wire-value guards for the live-catalog parsers
 * (FID-2026-0928-009 Part 4 — the consolidation home for the
 * per-shim `asOptionalString`/`asOptionalNumber` copies; the
 * shared-primitive ESLint rule registry points at this module).
 *
 * Parsers receive untyped vendor payloads, so these guards take
 * `unknown` and narrow — the general form that subsumes every former
 * local copy (including `openrouter.ts`'s numeric variant, which the
 * `null`-coercion contract below covers).
 */

/** Non-empty string, else undefined. */
export function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Finite number, else undefined. Wire `null` (a real value in vendor
 * catalogs for absent numerics) coerces to undefined exactly like a
 * malformed value — the parser boundary normalizes, consumers never re-guard.
 */
export function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
