import { z } from 'zod'

import { zContentsOptions } from '../../../schema/contents-options.ts'

/**
 * Exa /search request body — ported from the v1 adaptor, with the known drift
 * fixed (monid-providers task 10.5): deprecated startCrawlDate/endCrawlDate
 * dropped. `stream` is intentionally NOT EXPOSED — v1 only carried it because
 * it copied Exa's OpenAPI schema verbatim (the REST call rejects it). It is
 * absent from this schema (so absent from the compiled JSON Schema and
 * `catalog inspect`); since the schema is deliberately non-strict,
 * input.toRequest additionally strips it before send as defense-in-depth
 * (replacing v1's prepareBody override).
 */
export const zExaSearchBody = z.object({
  query: z.string().min(1).describe('Natural-language search query.'),
  type: z
    .enum([
      'auto',
      'instant',
      'fast',
      'neural',
      'deep-lite',
      'deep',
      'deep-reasoning',
    ])
    .optional(),
  numResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe('Number of results (1-100).')
    .optional(),
  category: z
    .enum([
      'company',
      'research paper',
      'news',
      'personal site',
      'financial report',
      'people',
    ])
    .optional()
    .describe(
      "Data category to focus the search on. 'company' and 'people' do not support " +
        'published-date filters or excludeDomains — sending them returns 400.',
    ),
  includeDomains: z
    .array(z.string())
    .optional()
    .describe(
      'Restrict results to these domains. Each entry is a hostname, a hostname with a ' +
        'path prefix (exa.ai/blog), or a wildcard subdomain (*.substack.com).',
    ),
  excludeDomains: z
    .array(z.string())
    .optional()
    .describe(
      'Drop results from these domains. Same entry formats as includeDomains.',
    ),
  startPublishedDate: z.iso.datetime().optional(),
  endPublishedDate: z.iso.datetime().optional(),
  userLocation: z.string().optional(),
  moderation: z.boolean().optional(),
  systemPrompt: z.string().optional(),
  outputSchema: z
    .record(z.string(), z.any())
    .optional()
    .describe(
      'JSON Schema for synthesized output. Adds roughly 2 s of synthesis latency.',
    ),
  additionalQueries: z.array(z.string()).optional(),
  contents: zContentsOptions.optional(),
})
