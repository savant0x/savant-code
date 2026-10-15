import { z } from 'zod'

import { zBaseMeta } from './base.ts'
import { zCategoryId } from '../common/ids.ts'

/**
 * Endpoint metadata. `categories` = CLOSED vocabulary — leaf ids validated
 * fail-closed at compile against connectors/categories.ts.
 */
export const zEndpointMeta = z.strictObject({
  ...zBaseMeta.shape,
  categories: z.array(zCategoryId).optional(),
})
export type EndpointMeta = z.infer<typeof zEndpointMeta>
