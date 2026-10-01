import { z } from 'zod'

import { zBaseMeta } from './base.ts'
import { zCategoryId } from '../common/ids.ts'

/** Provider metadata (catalog display; never copied into endpoint docs). */
export const zProviderMeta = z.strictObject({
  ...zBaseMeta.shape,
  homepageUrl: z.url().optional(),
  categories: z.array(zCategoryId).optional(),
})
export type ProviderMeta = z.infer<typeof zProviderMeta>
