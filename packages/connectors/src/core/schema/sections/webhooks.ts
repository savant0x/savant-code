import { z } from 'zod'

import {
  zResourceWebhookSubscribeFn,
  zWebhookRouteFn,
  zWebhookSubscribeFn,
  zWebhookVerify,
} from '../hooks/webhooks.ts'

/**
 * WEBHOOK SECTIONS (design D36/D44) — the def-side declarations. SCOPE
 * IS POSITIONAL: a hook on the PROVIDER def is the vendor-account stream
 * (`/v1/providers/:provider/account/{slug}`), a hook on a RESOURCE def
 * is a per-resource registration (`/v1/providers/:provider/resource/
 * {resourceId}/{slug}`, `subscribe` REQUIRED — a per-resource stream
 * without upstream registration cannot exist). No `account:` wrapper —
 * where the hook LIVES already says what it is.
 * The HOST owns the ingress route, raw-byte signature verification (the
 * declarative `verify` descriptor), the routing rows, and executing the
 * route verdicts; docs own the vocabulary.
 */

export const zWebhookSlug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'webhook slug must be lowercase kebab-case')
export type WebhookSlug = z.infer<typeof zWebhookSlug>

/** One provider-scope hook. No `subscribe` = MANUAL registration: the
 *  host boot-reconcile ensures the routing row and LOGS the callback URL
 *  for the operator to paste into the vendor dashboard (saperly). */
export const zProviderWebhook = z.strictObject({
  verify: zWebhookVerify,
  route: zWebhookRouteFn,
  subscribe: zWebhookSubscribeFn.optional(),
  unsubscribe: zWebhookSubscribeFn.optional(),
})
export type ProviderWebhook = z.infer<typeof zProviderWebhook>

export const zWebhooksSection = z.record(zWebhookSlug, zProviderWebhook)
export type WebhooksSection = z.infer<typeof zWebhooksSection>

/** One resource-scope hook — `subscribe` REQUIRED (idempotent: keys
 *  derive from resource identity + a URL hash, re-asserts converge). */
export const zResourceWebhook = z.strictObject({
  verify: zWebhookVerify,
  route: zWebhookRouteFn,
  subscribe: zResourceWebhookSubscribeFn,
  unsubscribe: zResourceWebhookSubscribeFn.optional(),
})
export type ResourceWebhook = z.infer<typeof zResourceWebhook>

export const zResourceWebhooksSection = z.record(zWebhookSlug, zResourceWebhook)
export type ResourceWebhooksSection = z.infer<typeof zResourceWebhooksSection>
