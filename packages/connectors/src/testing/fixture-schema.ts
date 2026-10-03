import { readFile } from 'node:fs/promises' // port: was Deno.readTextFile (PORT-NOTES.md)

import { z } from 'zod'

import { zJson } from '../core/mod.ts'

/**
 * HTTP fixture: recorded {req, res} pairs served in order during replay.
 * Headers are NEVER recorded — credentials cannot leak into fixtures.
 *
 * FIXTURES ARE MINIMAL SHARED CHAINS (fixture strategy v2): committed DATA
 * files at PROVIDER level (`connectors/<provider>/fixtures/<shape>.json`) —
 * one hand-minimized chain per lifecycle SHAPE (run-succeeded, run-failed,
 * start-rejected, pay-per-event…), each stating what it exercises in
 * `description`. Call urls may carry `{{request.url}}` / `{{request.origin}}`
 * placeholders, bound at replay time from the endpoint's compiled request —
 * so ONE chain serves every endpoint of the provider.
 *
 * Recording heritage (fixture diet, design D11): chains derive from real
 * recordings — requests, order, statuses untouched (replay matches
 * REQUESTS only) — with RESPONSE bodies shrunk by the deterministic
 * `trimJson` pass (arrays capped, long strings truncated) and PII redacted
 * by `scrubJson` (structural placeholders; keys/shape intact). The
 * fixture-size lint (fixture-size.test.ts) bounds files.
 */
/**
 * The ONLY response headers a fixture may carry. Request headers are never
 * recorded (credentials); response headers are a different set, but
 * `set-cookie` and account-identifying ratelimit/tracing headers live there
 * too — so the recorder captures an explicit allowlist and nothing else is
 * kept. Growing it is a deliberate edit in the same PR as the connector that
 * needs it (the categories.ts posture).
 *
 * The allowlist bounds WHICH headers survive; it does not make the survivor
 * safe by itself — a `location` can BE a credential (a presigned URL). That
 * is `scrubUrlCredentials`' job, applied by `scrubCalls` before anything is
 * written.
 */
export const RECORDED_RES_HEADERS = [
  'location',
  'retry-after',
  'x-api-units-cost-total-actual',
  'x-api-cache',
  'x-credits-charged',
] as const

export const zRecordedCall = z
  .object({
    req: z
      .object({
        method: z.string(),
        url: z.string(),
        body: zJson.optional(),
      })
      .strict(),
    res: z
      .object({
        status: z.number().int(),
        /** ALLOWLISTED response headers — envelope facts a fn reads, e.g. a
         *  302's `location`. Absent on every chain that does not need one.
         *  Keys are CHECKED against the allowlist, not merely typed
         *  `z.string()`: the recorder is not the only way a fixture gets
         *  written, and a hand-edited one carrying `set-cookie` must fail to
         *  load rather than replay. (A refinement rather than
         *  `z.record(z.enum(...))`, which is EXHAUSTIVE — that would demand
         *  every allowlisted key on every fixture the moment the list grows
         *  past one.) */
        headers: z
          .record(z.string(), z.string())
          .refine(
            (headers) =>
              Object.keys(headers).every((key) =>
                (RECORDED_RES_HEADERS as readonly string[]).includes(key),
              ),
            {
              message: `response headers must be one of: ${RECORDED_RES_HEADERS.join(
                ', ',
              )}`,
            },
          )
          .optional(),
        body: zJson,
      })
      .strict(),
  })
  .strict()
export type RecordedCall = z.infer<typeof zRecordedCall>

/** The allowlisted subset of a real response's headers, keys lowercased. */
export function pickRecordedHeaders(
  headers: Headers,
): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const name of RECORDED_RES_HEADERS) {
    const value = headers.get(name)
    // lowercase the KEY too, not just the (case-insensitive) lookup: the
    // allowlist is meant to grow, and an entry added as `Retry-After`
    // would otherwise be written verbatim and never match a fn reading
    // `res.headers["retry-after"]`
    if (value !== null) out[name.toLowerCase()] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export const zFixture = z
  .object({
    name: z.string().min(1),
    /** What lifecycle shape this chain exercises — every fixture says why
     *  it exists (fixture strategy v2). */
    description: z.string().min(1),
    calls: z.array(zRecordedCall).min(1),
  })
  .strict()
export type Fixture = z.infer<typeof zFixture>

export async function loadFixture(path: string): Promise<Fixture> {
  return zFixture.parse(JSON.parse(await readFile(path, 'utf8'))) // port: was Deno.readTextFile (PORT-NOTES.md)
}
