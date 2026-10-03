import type { RecordedCall } from './fixture-schema.ts'
import type { Json } from '../core/mod.ts'

/** Trim bounds — tunable beside the pass, mirrored by the size lint. */
export const TRIM_ARRAY_CAP = 2
export const TRIM_STRING_CAP = 500

/**
 * The deterministic trim pass: cap every array to its first
 * TRIM_ARRAY_CAP elements and truncate string leaves beyond
 * TRIM_STRING_CAP chars — recursively, keys and structure untouched.
 * Applied ONLY to recorded RESPONSE bodies (never requests/urls/statuses),
 * so the replayed wire contract is unchanged; only what the engine
 * CONSUMES shrinks (count assertions reflect the trimmed reality).
 */
export function trimJson(value: Json): Json {
  if (typeof value === 'string') {
    return value.length > TRIM_STRING_CAP
      ? value.slice(0, TRIM_STRING_CAP)
      : value
  }
  if (Array.isArray(value)) {
    return value.slice(0, TRIM_ARRAY_CAP).map(trimJson)
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, Json> = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = trimJson(item)
    }
    return out
  }
  return value
}

/** Apply the trim pass to a recorded call chain (response bodies only). */
export function trimCalls(calls: RecordedCall[]): RecordedCall[] {
  return calls.map((call) => ({
    req: call.req,
    res: { ...call.res, body: trimJson(call.res.body) },
  }))
}

/**
 * The PII scrub pass (fixture strategy v2): value-level redaction on string
 * LEAVES — email-shaped substrings → `user@example.com`, E.164-ish phone
 * substrings → `+15550000000` — recursively, keys and structure untouched.
 * Deliberately conservative (regex leaves, no key heuristics): recordings
 * are for SHAPE, and shape survives redaction. Applied by the recorder
 * after `trimJson`; shared committed chains are additionally hand-checked.
 */
export function scrubJson(value: Json): Json {
  if (typeof value === 'string') {
    return value
      .replace(
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
        'user@example.com',
      )
      .replace(/\+\d{7,15}/g, '+15550000000')
  }
  if (Array.isArray(value)) return value.map(scrubJson)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, Json> = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = scrubJson(item)
    }
    return out
  }
  return value
}

/** The placeholder every redacted query value collapses to. */
export const REDACTED_QUERY_VALUE = 'REDACTED'

/**
 * Strip credentials out of a URL-valued header (`location`).
 *
 * A redirect target can BE a bearer credential: a presigned S3 URL carries
 * its authorization in the query string (`X-Amz-Signature`, `Signature`,
 * `token`, …), and recording one verbatim would commit temporary read access
 * to the vendor's object. So every query VALUE collapses to a placeholder
 * while the scheme, host, path and parameter NAMES survive — which is all a
 * fixture needs, since it exists to pin SHAPE.
 *
 * Value-level, not a denylist of known-secret parameter names: a denylist is
 * wrong the first time a vendor signs with a parameter nobody listed.
 *
 * Non-URL values and URLs without a query pass through untouched (a plain
 * trailing-slash 307 `location` is not a secret and stays readable).
 */
export function scrubUrlCredentials(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return value // not a URL (relative location, junk) — leave it alone
  }
  if ([...url.searchParams.keys()].length === 0) return value
  for (const key of [...url.searchParams.keys()]) {
    url.searchParams.set(key, REDACTED_QUERY_VALUE)
  }
  return url.toString()
}

/** Scrub over a recorded chain — REQUEST bodies included: request payloads
 *  are exactly where caller-supplied PII lives, and replay matches calls by
 *  method + URL only, so scrubbing the body is replay-safe (PR #2 finding).
 *  The REQUEST URL is deliberately KEPT verbatim — the replay matcher and
 *  the `{{request.url}}` fixture binding depend on it; recorded inputs come
 *  from the curated test-inputs table, which follows the placeholder
 *  identity convention (consented or public-figure names only).
 *
 *  RESPONSE HEADERS get the URL-credential scrub: an allowlisted `location`
 *  may be a presigned (bearer) URL. Replay-safe for the same reason the body
 *  is — matching never reads response headers. */
export function scrubCalls(calls: RecordedCall[]): RecordedCall[] {
  return calls.map((call) => ({
    req: {
      ...call.req,
      ...(call.req.body !== undefined
        ? { body: scrubJson(call.req.body) }
        : {}),
    },
    res: {
      ...call.res,
      ...(call.res.headers !== undefined
        ? {
            headers: Object.fromEntries(
              Object.entries(call.res.headers).map(([key, value]) => [
                key,
                scrubUrlCredentials(value),
              ]),
            ),
          }
        : {}),
      body: scrubJson(call.res.body),
    },
  }))
}
