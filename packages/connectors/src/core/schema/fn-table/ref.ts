import { z } from 'zod'

import { zFnId } from '../common/ids.ts'
import { zJson } from '../json/type.ts'

/**
 * Reference from a compiled doc into the bundle's fnTable. `$fn` exists ONLY
 * in Docs — authors never write it (compiler-reserved marker). `args` present
 * iff the entry is a factory (a preset application).
 */
export const zFnRef = z
  .object({
    $fn: z
      .object({
        key: zFnId,
        args: z.array(zJson).optional(),
      })
      .strict(),
  })
  .strict()
export type FnRef = z.infer<typeof zFnRef>
