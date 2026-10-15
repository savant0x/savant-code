import { z } from 'zod'

import { zPerCallModel } from './per-call.ts'
import { zPerUnitModel } from './per-unit.ts'

/**
 * The LEAF union — the scalar subset COMPOSITE embeds (v1's price/leaf.ts
 * pattern: leaves in their own module so the composite kinds can import
 * them without a cycle through mod.ts). Treat this and zUsageModel as one
 * API surface.
 */
export const zScalarUsageModel = z.discriminatedUnion('kind', [
  zPerCallModel,
  zPerUnitModel,
])
export type ScalarUsageModel = z.infer<typeof zScalarUsageModel>
