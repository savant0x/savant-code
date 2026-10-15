import { z } from 'zod'

import { zJson } from './../json/type.ts'
import { zResourceId } from './ids.ts'

/**
 * Resource ADDRESSING + the OWNED INSTANCE — dependency-leaf shapes (no
 * hook imports) shared by resource lifecycle ops, endpoint bindings,
 * lifecycle utils (`utils.resources`) and webhook hooks.
 */

/** One owned resource, addressed by its doc id + the vendor's own id —
 *  used where addressing is genuinely CROSS-DOC (provision seeds,
 *  webhook routing, settle marks). Op fns never see one: they get the
 *  full OwnedResource instance instead (design D41). */
export const zResourceTarget = z.strictObject({
  /** Resource doc id — "<provider>/<slug>", SELF-DESCRIBING (a
   *  cross-provider ensure seed resolves its doc on the seed's own
   *  provider). */
  resource: zResourceId,
  /** The vendor's identifier (v1 externalId — the ownership-pointer
   *  key). */
  externalId: z.string().min(1),
})
export type ResourceTarget = z.infer<typeof zResourceTarget>

/**
 * An OWNED RESOURCE instance as the host serves it back (design D41 —
 * renamed from `ResourceRow`: fn-facing, not backend-facing). The story
 * is symmetric with the def: the def declares a `data` schema, an owned
 * instance carries `.data`. Host-owned fields (workspace, billing
 * schedule, events) never appear: the engine and the fns see exactly
 * what the doc declared.
 */
export const zOwnedResource = z.strictObject({
  resource: zResourceId,
  externalId: z.string().min(1),
  /** The `data`-schema snapshot (validated by the engine against the
   *  doc's data schema on the way IN — defense against host drift). */
  data: zJson,
  syncedAt: z.iso.datetime().optional(),
})
export type OwnedResource = z.infer<typeof zOwnedResource>

/** The query surface of `utils.resources.owned` / the host ResourceReader
 *  port: instances of ONE resource kind owned by the RUNNING workspace,
 *  optionally narrowed to one externalId. Empty array = owns none (never
 *  an error). */
export const zResourceQuery = z.strictObject({
  resource: zResourceId,
  externalId: z.string().min(1).optional(),
})
export type ResourceQuery = z.infer<typeof zResourceQuery>
