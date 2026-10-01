import { z } from 'zod'

import { zAction, zParser, zScrapeFormat } from './common-formats.ts'
import {
  zAuditMetadata,
  zLocation,
  zRedactPIIOptions,
  zThreatProtectionOverride,
} from './common-options.ts'

export const zScrapeOptions = z.object({
  formats: z
    .array(zScrapeFormat)
    .optional()
    .describe("Output formats. Defaults to ['markdown']."),
  onlyMainContent: z
    .boolean()
    .optional()
    .describe(
      'Return only the main content, excluding headers, navs and footers ' +
        '(default true). A deterministic HTML-level filter; no LLM.',
    ),
  onlyCleanContent: z
    .boolean()
    .optional()
    .describe(
      'Beta. An additional LLM pass over the markdown to remove residual ' +
        'boilerplate (default false).',
    ),
  includeTags: z
    .array(z.string())
    .optional()
    .describe(
      'CSS selectors to include, matched against the original page DOM.',
    ),
  excludeTags: z
    .array(z.string())
    .optional()
    .describe(
      'CSS selectors to exclude, matched against the original page DOM.',
    ),
  maxAge: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Serve a cached copy younger than this many ms (default 172800000, ' +
        '2 days). 0 forces a live fetch. Cached results still cost a ' +
        'full credit — caching buys speed, not credits.',
    ),
  minAge: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Cache-ONLY lookup: never triggers a fresh scrape. A miss returns ' +
        '404 SCRAPE_NO_CACHED_DATA. Set 1 to accept any cached data.',
    ),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe('Headers to send with the request (cookies, user-agent, etc.).'),
  waitFor: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Extra ms to wait after load, on top of Firecrawl's smart wait " +
        '(default 0).',
    ),
  mobile: z
    .boolean()
    .optional()
    .describe('Emulate a mobile device (default false).'),
  skipTlsVerification: z
    .boolean()
    .optional()
    .describe('Skip TLS certificate verification (default true).'),
  timeout: z
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .optional()
    .describe('Per-page deadline in ms (default 60000, max 300000).'),
  parsers: z
    .array(zParser)
    .optional()
    .describe(
      "File processing. Defaults to ['pdf'], which parses PDFs to " +
        'markdown at 1 credit per PDF page. An EMPTY array returns the ' +
        'PDF as base64 at a flat 1 credit.',
    ),
  actions: z
    .array(zAction)
    .optional()
    .describe(
      'Browser actions to run before scraping. Max 50; the combined wait ' +
        'time must not exceed 60 s. Not supported for PDFs.',
    ),
  location: zLocation.optional(),
  removeBase64Images: z
    .boolean()
    .optional()
    .describe(
      'Replace base64 image URLs in markdown with a placeholder ' +
        '(default true). Does not affect html or rawHtml.',
    ),
  blockAds: z
    .boolean()
    .optional()
    .describe('Enable ad-blocking and cookie-popup blocking (default true).'),
  proxy: z
    .enum(['basic', 'enhanced', 'auto'])
    .optional()
    .describe(
      "'auto' (default) retries with enhanced anti-bot proxies when the " +
        'basic fetch is blocked. Enhanced proxies carry NO surcharge.',
    ),
  storeInCache: z
    .boolean()
    .optional()
    .describe(
      'Store the page in the Firecrawl index and cache (default true). ' +
        'Sensitive options (actions, headers) force this false.',
    ),
  lockdown: z
    .boolean()
    .optional()
    .describe(
      "Serve from Firecrawl's cache only, never fetching the target " +
        '(default false). Billed 5 credits on a hit, 1 on a miss; a ' +
        'miss returns 404 SCRAPE_LOCKDOWN_CACHE_MISS.',
    ),
  redactPII: z
    .union([z.boolean(), zRedactPIIOptions])
    .optional()
    .describe(
      'Redact personally identifiable information from the returned ' +
        'markdown (default false). Costs +4 credits per page.',
    ),
  profile: z
    .object({
      name: z.string().min(1).max(128),
      saveChanges: z.boolean().optional(),
    })
    .optional()
    .describe(
      'Persistent browser storage shared by scrapes using the same name.',
    ),
  threatProtection: zThreatProtectionOverride.optional(),
  auditMetadata: zAuditMetadata.optional(),
})

/** The webhook spec object shared by `/crawl`, `/batch/scrape` and `/agent`. */
export const zWebhook = z.object({
  url: z.url().describe('Where to deliver the events.'),
  headers: z.record(z.string(), z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  events: z
    .array(z.string())
    .optional()
    .describe('Event types to deliver. Defaults to all.'),
})
