import { z } from 'zod'

import { zPurpose } from '../../../schema/common.ts'

/**
 * TinyFish /search query params — ported from the v1 adaptor.
 *
 * PORT NOTE: v1 guarded cross-field rules (recency vs calendar bounds,
 * research_paper-only filters, date ordering, real-calendar-date checks)
 * with `.superRefine()`/`.refine()` on the LIVE zod schema. Those checks
 * cannot be represented in the compiled JSON Schema (design: refinements do
 * not survive `z.toJSONSchema`), so here they are DOCUMENTED constraints in
 * the describes — TinyFish itself rejects invalid combinations with a 400.
 */
const DOMAIN_TYPES = ['web', 'news', 'research_paper'] as const

/** Ten years in minutes — TinyFish's documented `recency_minutes` ceiling. */
const MAX_RECENCY_MINUTES = 5_256_000

// z.iso.date() compiles to a calendar-aware pattern (month/day bounds, leap
// years) — real validation survives into the compiled doc, unlike a .refine.
const zIsoDate = z.iso.date('Must be a calendar date in YYYY-MM-DD format')

export const zTinyfishSearchQueryParams = z
  .object({
    query: z
      .string()
      .min(1)
      .describe(
        'Search query. Accepts natural language and still honours ' +
          'site:/-site: operators, though include_domains / ' +
          'exclude_domains are preferred because they do not collide ' +
          "with other query syntax. Example: 'NVIDIA Q4 FY2025 revenue'.",
      ),
    purpose: zPurpose.optional(),
    location: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Country code for geo-targeted results. Example: US, GB, FR, DE. ' +
          'Auto-resolves from `language` when omitted; defaults to US if ' +
          'neither is set.',
      ),
    language: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Language code for result language. Example: en, fr, de. ' +
          'Auto-resolves from `location` when omitted; defaults to en if ' +
          'neither is set.',
      ),
    include_domains: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Comma-separated domains to restrict results to. Example: ' +
          'github.com,arxiv.org.',
      ),
    exclude_domains: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Comma-separated domains to exclude from results. Example: ' +
          'pinterest.com,quora.com.',
      ),
    recency_minutes: z
      .number()
      .int()
      .min(1)
      .max(MAX_RECENCY_MINUTES)
      .optional()
      .describe(
        'Freshness window in minutes, relative to now. Example: 60 for ' +
          'the last hour. Cannot be combined with after_date or ' +
          'before_date, and is not supported for ' +
          'domain_type=research_paper.',
      ),
    after_date: zIsoDate
      .optional()
      .describe(
        'Lower calendar bound, YYYY-MM-DD (must be a real calendar date). ' +
          'Example: 2026-06-01. Cannot be combined with recency_minutes, ' +
          'and is not supported for domain_type=research_paper.',
      ),
    before_date: zIsoDate
      .optional()
      .describe(
        'Upper calendar bound, YYYY-MM-DD (must be a real calendar date, on ' +
          'or after after_date). Example: 2026-06-18. Cannot be combined ' +
          'with recency_minutes, and is not supported for ' +
          'domain_type=research_paper.',
      ),
    domain_type: z
      .enum(DOMAIN_TYPES)
      .optional()
      .describe(
        "Corpus to search. 'web' (default) returns general results; 'news' " +
          "adds publisher and date; 'research_paper' searches academic " +
          'work and adds authors, venue, year, cited_by_count, and ' +
          'pdf_url.',
      ),
    pub_year_min: z
      .number()
      .int()
      .min(0)
      .max(9999)
      .optional()
      .describe(
        'Inclusive lower publication-year bound (must not exceed ' +
          'pub_year_max). Only supported for domain_type=research_paper. ' +
          'Example: 2017.',
      ),
    pub_year_max: z
      .number()
      .int()
      .min(0)
      .max(9999)
      .optional()
      .describe(
        'Inclusive upper publication-year bound. Only supported for ' +
          'domain_type=research_paper. Example: 2024.',
      ),
    page: z
      .number()
      .int()
      .min(0)
      .max(10)
      .optional()
      .describe(
        'Zero-indexed result page. Example: 2 returns the third page. ' +
          'Maximum 10.',
      ),
  })
  .strict()
