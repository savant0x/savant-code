import { z } from 'zod'

import { zJson } from '../json/type.ts'

/**
 * The run vocabulary, IN-side: what callers submit — the v1-compatible trio
 * (body / queryParams / pathParams). Symmetric with run/result.ts:
 * RunInput in → RunResult out.
 */
export const zRunInput = z
  .object({
    body: zJson.optional(),
    queryParams: z.record(z.string(), zJson).optional(),
    pathParams: z.record(z.string(), z.string()).optional(),
  })
  .strict()
export type RunInput = z.infer<typeof zRunInput>
