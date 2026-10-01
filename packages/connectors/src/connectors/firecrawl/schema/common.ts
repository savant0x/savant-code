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
 *
 * T106 file split (FID-2026-0930-001, 300-line ceiling): the mirror is
 * re-exported VERBATIM from three modules — common-options.ts (location /
 * PII / threat-protection / audit), common-formats.ts (parsers / actions /
 * formats), common-scrape.ts (ScrapeOptions + webhook). Import paths are
 * the ONLY change; every schema byte is untouched.
 */

export {
  zAuditMetadata,
  zLocation,
  zRedactPIIEntity,
  zRedactPIIOptions,
  zThreatProtectionOverride,
} from './common-options.ts'
export {
  zAction,
  zParser,
  zScrapeFormat,
} from './common-formats.ts'
export { zScrapeOptions, zWebhook } from './common-scrape.ts'
