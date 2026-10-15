import { z } from 'zod'

import { zPurpose } from '../../../schema/common.ts'

/**
 * TinyFish /fetch body — ported from the v1 adaptor.
 *
 * PORT NOTE: v1's `.superRefine()` (conditional-request validators are a
 * single-URL feature) cannot be represented in the compiled JSON Schema —
 * documented in the describes instead; TinyFish rejects the combination
 * with a 400.
 */
const FORMATS = ['markdown', 'html', 'json'] as const

/** TinyFish accepts 1-10 URLs per call. */
const MAX_URLS = 10

/** Per-URL backend timeout ceiling, in milliseconds. */
const MAX_PER_URL_TIMEOUT_MS = 110_000

/** CSS selector list bounds — 1-20 entries, each 1-1000 characters. */
const MAX_SELECTORS = 20
const MAX_SELECTOR_LENGTH = 1_000

const zSelectorList = z
  .array(z.string().min(1).max(MAX_SELECTOR_LENGTH))
  .min(1)
  .max(MAX_SELECTORS)

/** http(s) only, matching what TinyFish itself accepts. */
const zHttpUrl = z.url({ protocol: /^https?$/ })

export const zTinyfishFetchBody = z
  .object({
    urls: z
      .array(zHttpUrl)
      .min(1)
      .max(MAX_URLS)
      .describe(
        '1-10 http(s) URLs to fetch, processed in parallel. Private IPs, ' +
          'localhost, and cloud metadata endpoints are rejected. A ' +
          'failure on one URL never fails the batch — it appears in ' +
          'errors[] instead.',
      ),
    purpose: zPurpose.optional(),
    format: z
      .enum(FORMATS)
      .optional()
      .describe(
        "Output format for each result's `text`. 'markdown' (default) is " +
          "best for LLM consumption, 'html' returns cleaned semantic " +
          "HTML, 'json' returns a structured document tree.",
      ),
    links: z
      .boolean()
      .optional()
      .describe(
        'Include every <a href> on the page as absolute URLs in the ' +
          "result's `links` array. Defaults to false.",
      ),
    image_links: z
      .boolean()
      .optional()
      .describe(
        'Include every <img src> on the page as absolute URLs in the ' +
          "result's `image_links` array. Defaults to false.",
      ),
    ttl: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Cache freshness tolerance in seconds. Omit to accept any cached ' +
          'entry, 0 to force a live fetch, or a positive number to accept ' +
          'entries younger than that many seconds.',
      ),
    per_url_timeout_ms: z
      .number()
      .int()
      .min(1)
      .max(MAX_PER_URL_TIMEOUT_MS)
      .optional()
      .describe(
        'Per-URL wall-clock budget in milliseconds (1-110000). A URL ' +
          "exceeding it returns a 'timeout' entry in errors[] while " +
          'the rest of the batch still completes.',
      ),
    if_none_match: z
      .string()
      .min(1)
      .optional()
      .describe(
        'An ETag saved from a prior fetch of this URL, forwarded verbatim ' +
          'as the If-None-Match request header. Single URL only (the ' +
          'batch combination is rejected upstream with a 400). An ' +
          'unchanged page returns not_modified: true instead of a body.',
      ),
    if_modified_since: z
      .string()
      .min(1)
      .optional()
      .describe(
        'A Last-Modified value saved from a prior fetch of this URL, ' +
          'forwarded verbatim as the If-Modified-Since request header. ' +
          'Single URL only (the batch combination is rejected upstream ' +
          'with a 400).',
      ),
    include_etag_and_last_modified: z
      .boolean()
      .optional()
      .describe(
        'Return `etag` and `last_modified` on each result so they can be ' +
          'replayed as if_none_match / if_modified_since on a later ' +
          'call. Defaults to false. Fetch does not store them for you. ' +
          'Pair it with ttl=0: validators come from the origin, so a ' +
          'cached hit returns none.',
      ),
    include_selectors: zSelectorList
      .optional()
      .describe(
        '1-20 CSS selectors scoping extraction to elements matching ANY ' +
          'entry, concatenated in document order. Automatic boilerplate ' +
          'removal is bypassed. A partial miss still succeeds and ' +
          'reports unmatched_selectors; a total miss fails that URL with ' +
          'selector_not_matched plus candidate_selectors retry hints.',
      ),
    exclude_selectors: zSelectorList
      .optional()
      .describe(
        '1-20 CSS selectors for elements to remove BEFORE extraction, ' +
          'applied before include_selectors so it also prunes inside ' +
          'selected regions. Entries that match nothing are a no-op.',
      ),
  })
  .strict()
