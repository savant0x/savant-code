import { z } from 'zod'

/**
 * Contents-extraction options shared by /search (inline `contents`) and
 * /contents. Ported from monid-providers (itself ported from the v1 adaptor).
 */

/** Full page text: `true` for defaults, or an object for control. */
export const zText = z.union([
  z.boolean(),
  z.object({
    maxCharacters: z.number().int().positive().optional(),
    includeHtmlTags: z.boolean().optional(),
  }),
])

/** Key excerpts: `true` for defaults, or an object to steer selection. */
export const zHighlights = z.union([
  z.boolean(),
  z.object({
    query: z.string().optional(),
    numSentences: z.number().int().positive().optional(),
    highlightsPerUrl: z.number().int().positive().optional(),
  }),
])

/** LLM-generated summary per result. */
export const zSummary = z.object({
  query: z.string().optional(),
  schema: z.record(z.string(), z.any()).optional(),
})

/** String or array of strings — subpage search terms. */
export const zSubpageTarget = z.union([z.string(), z.array(z.string())])

/** Extra per-page data. */
export const zExtras = z.object({
  links: z.number().int().min(0).optional(),
  imageLinks: z.number().int().min(0).optional(),
})

/** Inline contents-extraction options shared by /search.contents and /contents. */
export const zContentsOptions = z.object({
  text: zText.optional(),
  highlights: zHighlights.optional(),
  summary: zSummary.optional(),
  subpages: z.number().int().min(0).optional(),
  subpageTarget: zSubpageTarget.optional(),
  extras: zExtras.optional(),
  maxAgeHours: z.number().int().optional(),
})
