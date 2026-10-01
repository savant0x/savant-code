import { z } from 'zod'

/**
 * Strict RFC 8259 JSON. No `undefined`, no functions, no dates, no live schemas —
 * every boundary (catalog storage, sealed units, Temporal payloads, fixtures) is
 * serialize-by-value, so the runtime type must round-trip losslessly.
 *
 * v1's `JSONExtendedType` (live zod schemas / thunks as leaves) has no runtime role
 * here: that expressiveness lives in the Def layer and is compiled away.
 */
export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json }

/**
 * zod v4 ships the exact recursive schema (lazy union of
 * null|boolean|number|string|array|record) — we pin OUR pervasive `Json`
 * alias as its type. Finite-number strictness holds: v4's z.number() rejects
 * NaN/±Infinity (and JSON.parse can never produce them anyway).
 */
export const zJson: z.ZodType<Json, Json> = z.json() as z.ZodType<Json, Json>

/** Deep-remove `undefined` values (object members dropped, array holes rejected). */
export function pruneUndefined(value: unknown): Json {
  if (value === undefined) {
    throw new Error('pruneUndefined: top-level value is undefined')
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`non-finite number: ${value}`)
    }
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item === undefined) throw new Error('undefined array element')
      return pruneUndefined(item)
    })
  }
  if (typeof value === 'object') {
    const out: { [key: string]: Json } = {}
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (item === undefined) continue
      out[key] = pruneUndefined(item)
    }
    return out
  }
  throw new Error(`not JSON-serializable: ${typeof value}`)
}

/** Assert a value is pure strict Json (throws otherwise) and return it typed. */
export function assertPureJson(value: unknown, label = 'value'): Json {
  const parsed = zJson.safeParse(value)
  if (!parsed.success) {
    throw new Error(
      `${label} is not strict JSON: ${parsed.error.issues[0]?.message}`,
    )
  }
  return parsed.data
}
