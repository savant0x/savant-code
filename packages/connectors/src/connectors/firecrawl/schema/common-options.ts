import { z } from 'zod'

/**
 * Firecrawl v2 shared request fragments — the FAITHFUL VENDOR MIRROR of the
 * published OpenAPI components (`https://docs.firecrawl.dev/api-reference/
 * v2-openapi.json`, captured 2026-09-16). Optionality ONLY: no `.default()`,
 * no invented structure, no reshaping (D25). The vendor's documented defaults
 * are recorded in `describe` text so callers can read them; where one matters
 * to an estimate it is applied at the BINDING in `endpoint.ts`, never here.
 *
 * Nothing is `.strict()`: Firecrawl ships new scrape options continuously and
 * a strict mirror would reject a request the vendor accepts. Unknown keys pass
 * through untouched — which is also why no endpoint needs `input.toRequest`:
 * the validated input IS the wire body.
 */

/** OpenAPI `ScrapeOptions.location` (also `/map` and `/search`). */
export const zLocation = z.object({
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe(
      "ISO 3166-1 alpha-2 country code (e.g. 'US', 'AU', 'DE', 'JP'). " +
        "Defaults to 'US'.",
    ),
  languages: z
    .array(z.string())
    .optional()
    .describe(
      'Preferred languages and locales in order of priority (e.g. ' +
        "['en-US']). Defaults to the language of the location.",
    ),
})

/** OpenAPI `RedactPIIEntity`. */
export const zRedactPIIEntity = z.enum([
  'PERSON',
  'EMAIL',
  'PHONE',
  'LOCATION',
  'FINANCIAL',
  'SECRET',
])

/** OpenAPI `RedactPIIOptions`. */
export const zRedactPIIOptions = z.object({
  mode: z
    .enum(['accurate', 'aggressive', 'fast'])
    .optional()
    .describe(
      "Redaction strategy. 'accurate' (default) is model-only and " +
        "optimized for precision, 'aggressive' increases recall with " +
        "extra heuristics, 'fast' uses heuristics without the model call.",
    ),
  entities: z
    .array(zRedactPIIEntity)
    .optional()
    .describe(
      'Restrict redaction to these entity buckets. Omit to redact all.',
    ),
  replaceStyle: z
    .enum(['tag', 'mask', 'remove'])
    .optional()
    .describe(
      "'tag' (default) replaces spans with placeholders like <EMAIL>, " +
        "'mask' replaces characters with *, 'remove' deletes the span.",
    ),
})

/**
 * OpenAPI `ThreatProtectionOverride`. Enterprise-gated per-request override;
 * `mode: "normal"` is a BILLABLE line (+2 credits per URL scanned), which is
 * why the mirror carries it rather than leaving it to the account policy.
 */
export const zThreatProtectionOverride = z.object({
  mode: z
    .enum(['off', 'normal'])
    .optional()
    .describe(
      "URL scanning mode for this request. 'normal' checks URLs against " +
        'Google Web Risk and costs +2 credits per URL scanned.',
    ),
  riskScoreThreshold: z.number().int().min(0).max(100).optional(),
  blacklist: z.array(z.string()).max(1000).optional(),
  whitelist: z.array(z.string()).max(1000).optional(),
  blockedTlds: z.array(z.string()).max(1000).optional(),
  failurePolicy: z.enum(['open', 'closed']).optional(),
})

/** OpenAPI `AuditMetadata` — SIEM attribution, enterprise-gated. */
export const zAuditMetadata = z.object({
  username: z
    .string()
    .max(1024)
    .describe('The username associated with the request.'),
})

/**
 * OpenAPI `ScrapeOptions.parsers` item. The bare string `"pdf"` and the
 * object form are both accepted; an EMPTY parsers array skips PDF parsing and
 * returns base64 at a flat 1 credit instead of 1 credit per PDF page.
 */
