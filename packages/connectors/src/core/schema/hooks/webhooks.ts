import { z } from 'zod'

import { fnCarrier, type FnUtils, type HookLogger } from './ctx.ts'
import { zEndpointId } from '../common/ids.ts'
import { zJson } from '../json/type.ts'
import { zOwnedResource, zResourceTarget } from '../resource/row.ts'
import { zRunInput } from '../run/input.ts'

import type { LifecycleHttpFn } from './lifecycle.ts'

/**
 * WEBHOOK HOOKS (design D36) — declared on docs, EXECUTED BY THE HOST
 * ingress (the engine never listens). The v1 binding model is the contract:
 * one route `POST /v1/providers/:provider/*`, the path remainder IS the
 * binding (`account/{slug}` | `resource/{resourceId}/{slug}`), the only
 * stored state a routing row, and verification a signature over the EXACT
 * raw bytes (paths are guessable by design).
 *
 *   - `verify`: DECLARATIVE (an HMAC descriptor — no crypto in fns; the
 *     host executes it).
 *   - `route`: PURE — ONE verdict per delivery (design D44): WHO it
 *     belongs to (the correlation vocabulary) and WHAT to do (the closed
 *     action vocabulary). One delivery, one read — the v1
 *     correlate/dispatch pair collapsed (they always read the same
 *     envelope fields twice).
 *   - `subscribe`/`unsubscribe`: EFFECTFUL upstream registration, for
 *     vendors WITH a registration API. A provider hook without
 *     `subscribe` is MANUAL: the host boot-reconcile ensures the routing
 *     row and LOGS the callback URL to paste in the vendor dashboard
 *     (saperly).
 */

// ---------------------------------------------------------------------------
// verify — declarative descriptor
// ---------------------------------------------------------------------------

export const zWebhookVerify = z.strictObject({
  scheme: z.literal('hmac-sha256'),
  signatureHeader: z.string().min(1),
  /** Literal text the vendor puts BEFORE the hex digest in the
   *  signature header (saperly: "v1=" — the header reads `v1=<hex>`).
   *  Absent = the header is the bare hex. A delivery whose header
   *  lacks a declared prefix is a mismatch. */
  signaturePrefix: z.string().min(1).optional(),
  timestampHeader: z.string().min(1),
  /** The signed payload TEMPLATE (design D45): `${rawBody}` (the EXACT
   *  raw bytes — a signature that doesn't cover the body verifies
   *  nothing) and `${timestamp}` (the timestamp header's value —
   *  freshness must be BOUND to the HMAC: an unbound timestamp lets a
   *  captured body+signature replay forever inside rolling
   *  toleranceMs windows), joined with any literal glue the vendor
   *  specifies (saperly: "${timestamp}.${rawBody}"). Both are
   *  REQUIRED — the descriptor already demands a timestampHeader, so
   *  a vendor without timestamp-bound signing needs its own scheme,
   *  not a weaker template. */
  payload: z
    .string()
    .min(1)
    .refine(
      (template) => template.includes('${rawBody}'),
      'verify.payload must contain ${rawBody} — a signature that ' +
        'does not cover the raw bytes verifies nothing',
    )
    .refine(
      (template) => template.includes('${timestamp}'),
      'verify.payload must contain ${timestamp} — freshness unbound ' +
        'from the HMAC makes toleranceMs replayable',
    ),
  toleranceMs: z.number().int().positive(),
})
export type WebhookVerify = z.infer<typeof zWebhookVerify>

// ---------------------------------------------------------------------------
// route — WHO + WHAT, one verdict (design D44)
// ---------------------------------------------------------------------------

/** One verified delivery as fns see it: lower-cased headers + the
 *  sniff-decoded body. */
export const zWebhookDelivery = z.strictObject({
  headers: z.record(z.string(), z.string()),
  body: zJson,
})
export type WebhookDelivery = z.infer<typeof zWebhookDelivery>

export const zWebhookRouteData = z.strictObject({
  delivery: zWebhookDelivery,
})
export type WebhookRouteData = z.infer<typeof zWebhookRouteData>

/**
 * Correlation kinds → host resolution:
 *   - `resource`: the workspace OWNING that resource (ownership pointer).
 *   - `alias`: an E.164 alias pointer (an inbound callee is known only by
 *     number — saperly `call.received`).
 *   - `run`: an in-flight run — `externalRunId` must be the run's own
 *     lifecycle join key VERBATIM (state.externalRunId).
 *   - `unhandled`: expected traffic the provider does not map — dropped
 *     with the event name, never an error.
 */
export const zWebhookCorrelation = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('resource'),
    target: zResourceTarget,
  }),
  z.strictObject({ kind: z.literal('alias'), e164: z.string().min(1) }),
  z.strictObject({
    kind: z.literal('run'),
    externalRunId: z.string().min(1),
  }),
  z.strictObject({ kind: z.literal('unhandled'), event: z.string() }),
])
export type WebhookCorrelation = z.infer<typeof zWebhookCorrelation>

/**
 *   - `run`: START A RUN of `endpoint` in the correlated workspace — the
 *     resource-starts-a-run path (a call arrives on YOUR number ⇒
 *     inbound-calls starts there, adopts the external id, bills like any
 *     run). `runKey` makes duplicate deliveries converge on ONE
 *     deterministic run (default: the delivery id). Control policy:
 *     `bill-only` = already-received work is billed, never refused;
 *     `admit-overdraft` = admit always, the accrual loop enforces.
 *   - `signal-run`: nudge the correlated in-flight run's poll — `runKey`
 *     must reproduce the run's externalRunId VERBATIM.
 *   - `refresh`: run the resource doc's refresh op on `target`.
 *   - `ignore`: intentionally unmapped events — stated policy, not an
 *     error.
 */
export const zWebhookAction = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('run'),
    endpoint: zEndpointId,
    input: zRunInput,
    runKey: z.string().min(1).optional(),
    controlPolicy: z.enum(['bill-only', 'admit-overdraft']).optional(),
  }),
  z.strictObject({
    action: z.literal('signal-run'),
    runKey: z.string().min(1),
  }),
  z.strictObject({
    action: z.literal('refresh'),
    target: zResourceTarget,
  }),
  z.strictObject({ action: z.literal('ignore') }),
])
export type WebhookAction = z.infer<typeof zWebhookAction>

/** The route VERDICT: who + what, decided in ONE read of the delivery.
 *  `who: unhandled` pairs with `what: ignore` by convention (the host
 *  drops with the event name); a mapped who may still `ignore` (stated
 *  policy — saperly's outbound delivery receipts). */
export const zWebhookRoute = z.strictObject({
  who: zWebhookCorrelation,
  what: zWebhookAction,
})
export type WebhookRoute = z.infer<typeof zWebhookRoute>

export type WebhookRouteFn = (ctx: {
  data: WebhookRouteData
  utils: FnUtils
  logger: HookLogger
}) => WebhookRoute
export const zWebhookRouteFn = fnCarrier<WebhookRouteFn>('a webhooks route fn')

// ---------------------------------------------------------------------------
// subscribe / unsubscribe — effectful upstream registration
// ---------------------------------------------------------------------------

export interface WebhookSubscribeUtils extends FnUtils {
  http: LifecycleHttpFn
}

/** Account scope: the callback URL is the whole context. */
export const zWebhookSubscribeData = z.strictObject({
  callbackUrl: z.url(),
})
export type WebhookSubscribeData = z.infer<typeof zWebhookSubscribeData>

export type WebhookSubscribeFn = (ctx: {
  data: WebhookSubscribeData
  utils: WebhookSubscribeUtils
  logger: HookLogger
}) => Promise<void>
export const zWebhookSubscribeFn = fnCarrier<WebhookSubscribeFn>(
  'a webhooks subscribe fn',
)

/** Resource scope: + the target and its stored row (per-resource
 *  registration; idempotency keys derive from resource identity + a URL
 *  hash so re-asserts converge). */
export const zResourceWebhookSubscribeData = z.strictObject({
  callbackUrl: z.url(),
  target: zResourceTarget,
  resource: zOwnedResource,
})
export type ResourceWebhookSubscribeData = z.infer<
  typeof zResourceWebhookSubscribeData
>

export type ResourceWebhookSubscribeFn = (ctx: {
  data: ResourceWebhookSubscribeData
  utils: WebhookSubscribeUtils
  logger: HookLogger
}) => Promise<void>
export const zResourceWebhookSubscribeFn =
  fnCarrier<ResourceWebhookSubscribeFn>('a resource webhooks subscribe fn')
