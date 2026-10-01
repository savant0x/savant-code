import { z } from 'zod'

import { zContentsOptions } from '../../../schema/contents-options.ts'

/**
 * Exa /contents request body — ported from the v1 adaptor. Non-strict top
 * level (unknown keys tolerated by validation, sent verbatim).
 */
export const zExaContentsBody = z.object({
  urls: z.array(z.string()).min(1).describe('URLs to fetch contents for.'),
  ids: z.array(z.string()).optional(),
  ...zContentsOptions.shape,
  livecrawlTimeout: z.number().int().positive().optional(),
})
