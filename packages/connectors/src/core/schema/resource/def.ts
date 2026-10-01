import { z } from 'zod'

import { zResourceSlug } from './ids.ts'
import {
  zResourceRefreshFn,
  zResourceReleaseFn,
  zResourceVerifyFn,
  zViews,
} from './ops.ts'
import { zReconcileUsage, zResourceUsage } from './usage.ts'
import { zSchemaCarrier } from '../hooks/ctx.ts'
import { zBaseMeta } from '../meta/base.ts'
import { zResourceWebhooksSection } from '../sections/webhooks.ts'

/**
 * zResourceDef — a RESOURCE as a first-class sibling of the endpoint def
 * (design D30, refined D38–D42): the durable thing a provider can OWN on
 * a workspace's behalf (a phone number, a mailbox, a VM). Lives at
 * `connectors/<provider>/resources/<slug>/resource.ts`; id
 * `<provider>/<slug>`.
 *
 * The def declares WHAT the resource is (`data`), its RATE CARD
 * (`usage` — pure data; this repo reports, the broker prices, the host
 * charges), how estimated lines SYNC (`reconcileUsage`), its lifecycle
 * (`lifecycle.verify/release/refresh` — platform-driven, no user input),
 * its live reads (`views`) and its event streams (`webhooks`). What
 * USERS do to it is ordinary ENDPOINTS, bound via `resources:` blocks.
 *
 * No auth/request/timeouts sections: resources always run under their
 * provider's fused identity (compiler copies the provider's resolved
 * auth + origin + requestMs into the doc).
 */
export const zResourceDef = z.strictObject({
  /** REQUIRED self-identity (design D46): must equal the def's folder
   *  name (loader-asserted) — the doc id is `<provider>/<slug>`. */
  slug: zResourceSlug,
  meta: zBaseMeta,
  /** The stored-snapshot shape — what the host persists per owned
   *  instance and serves back into every op/endpoint read (compiled to
   *  JSON Schema; live truth stays upstream). An owned instance
   *  carries these fields as `.data`. */
  data: zSchemaCarrier,
  /** DISPLAY/CATALOG-ONLY input shapes of the user actions (create /
   *  update / release) — the acquisition surface a catalog can render
   *  without walking endpoints. The EXECUTABLE contracts stay on the
   *  bound endpoints; the compiler checks each bound endpoint's input
   *  can CARRY the matching slot's required props. */
  inputs: z
    .strictObject({
      create: zSchemaCarrier.optional(),
      update: zSchemaCarrier.optional(),
      release: zSchemaCarrier.optional(),
    })
    .optional(),
  /** The RATE CARD (design D39) — REQUIRED: even a free resource
   *  declares a $0 fixed line with a real period (the host lifecycle
   *  always has a settle boundary). */
  usage: zResourceUsage,
  /** The SYNC defs for estimated lines (design D39): per-line
   *  `{everyMs, get}` — compile-checked to cover exactly the estimated
   *  lines. */
  reconcileUsage: zReconcileUsage.optional(),
  /** The resource's lifecycle (design D41): aliveness → teardown →
   *  re-sync. Platform-driven; an op fn ctx simply has no input. */
  lifecycle: z.strictObject({
    verify: zResourceVerifyFn,
    release: zResourceReleaseFn,
    refresh: zResourceRefreshFn.optional(),
  }),
  /** Named LIVE reads of the upstream object (design D42). */
  views: zViews.optional(),
  webhooks: zResourceWebhooksSection.optional(),
})

export type ResourceDefSeed = z.input<typeof zResourceDef>
export type ResourceDef = z.output<typeof zResourceDef>
