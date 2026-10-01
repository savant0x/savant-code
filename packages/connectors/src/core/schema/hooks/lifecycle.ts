import { z } from 'zod'

import './lifecycle-data.ts'

import { type FnUtils } from './ctx.ts'
import { zHttpMethod } from '../common/http.ts'
import { type Json, zJson } from '../json/type.ts'
import {
  type OwnedResource,
  type ResourceQuery,
} from '../resource/row.ts'

/**
 * THE LIFECYCLE HOOK FAMILY — `lifecycle.start` / `lifecycle.poll` /
 * `lifecycle.stop`: the async run protocol (design: add-async-run-protocol).
 *
 * Unlike the four pure hooks, lifecycle fns are EFFECTFUL-BY-CAPABILITY:
 * they receive `utils.http` (the v2 provider runtime — every call goes
 * through the engine's ONE transport port, auth injected at egress, so fns
 * never see credentials) and `utils.log`. They are the v2 form of
 * monid-services' `runLifecycle` hooks: imperative fns that sequence their
 * own HTTP calls (e.g. Apify's poll = status GET + dataset GET in one tick),
 * relay vendor errors AS DATA, and thread opaque `state` between ticks.
 *
 * The amended IO invariant: "all IO happens in the engine" becomes "all IO
 * flows through the engine's transport port". Preserved by construction:
 * auth custody, fixture replay (transport-level), billing determinism
 * (usage.consolidate stays the only settle authority; the engine forces zero
 * usage on non-2xx httpStatus, so a fn cannot bill an error), closed terms
 * (the capability is passed in, never imported).
 *
 * Enforcement differs from the pure hooks (which use z.function.implement):
 * lifecycle fns are ASYNC, so the engine validates ctx.data before the call
 * and the OUTCOME after the awaited return (FN_CONTRACT on either), lets
 * EngineErrors (e.g. transport EXECUTION_FAILED from utils.http) propagate
 * untouched, and maps any other uncaught throw to EXECUTION_FAILED
 * (retriable) — monid-services' ProviderError posture. The z.function
 * factory is not used here (zod fn factories don't model Promise returns);
 * the data/outcome schemas below ARE the contract.
 */

// ---------------------------------------------------------------------------
// utils.http — the provider runtime (v1 `ProviderRuntime.client.request`)
// ---------------------------------------------------------------------------

/**
 * One HTTP call issued by a lifecycle fn — ZERO defaults: every field sent
 * is a field stated here. `path` resolves against the doc request URL's
 * origin (v1 `apiPath` semantics); an absolute `url` may target any HTTPS
 * host, but credentials are injected ONLY for same-origin targets (design
 * D16 — the same-origin credential rule; cross-origin calls go out bare).
 * `headers` ARE the complete outbound header set (no doc-header merge);
 * `requestMs` overrides the doc's per-request timeout. Auth injection is
 * transport-side and not overridable (custody).
 */
export const zHttpCall = z
  .strictObject({
    method: zHttpMethod,
    /** Absolute HTTPS target. Exactly one of `url` | `path`. */
    url: z.url({ protocol: /^https$/ }).optional(),
    /** Resolved against the doc request URL's origin. */
    path: z.string().regex(/^\//, 'path must start with /').optional(),
    headers: z.record(z.string(), z.string()).optional(),
    /** Author-friendly: a scalar, or SEVERAL values under one key. The
     *  engine normalizes both into the wire multimap — an array is sent
     *  as a repeated key (`?k=a&k=b`). An EMPTY array is allowed and
     *  means "no value for this key": the engine drops it, exactly as it
     *  does on the declarative path, so a fn building params dynamically
     *  (`{ids: someList}`) needs no length guard. The min-1 floor belongs
     *  on the WIRE shape (`zHttpRequestParts.query`), which is what the
     *  normalizer produces — never on the authoring input. */
    queryParams: z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .optional(),
    body: zJson.optional(),
    requestMs: z.number().int().positive().optional(),
  })
  .refine((call) => (call.url !== undefined) !== (call.path !== undefined), {
    message: 'exactly one of url | path',
  })
export type HttpCall = z.infer<typeof zHttpCall>

/** What utils.http returns: status + response headers + sniff-decoded body.
 *  Vendor non-2xx is RETURNED (data), never thrown — the fn decides; transport
 *  failures throw EXECUTION_FAILED through the fn (retriable). */
export interface HttpResult {
  status: number
  /** The VENDOR'S RESPONSE headers, keys LOWERCASED — envelope facts a
   *  vendor answers WITH instead of a body (a 302's `location` IS the
   *  payload for an endpoint whose answer is the redirect target — a
   *  presigned URL minted per request; `retry-after`, `content-range` and
   *  `link` pagination are the same shape). Always present ({} when the
   *  transport reports none), so fns never branch on presence. REQUEST
   *  headers — where credentials live — stay invisible to fns: redirects
   *  are never followed, so a credential never travels to the target
   *  either (design D16). */
  headers: Record<string, string>
  body: Json
}

export type LifecycleHttpFn = (call: HttpCall) => Promise<HttpResult>

/**
 * `utils.sleep(ms)` — a bounded in-phase wait (design D34): drain-polling
 * inside ONE phase call (saperly's stop hangs up, then watches the call
 * settle). Host-clock injectable (EngineCtx.sleep), so tests never wall-
 * wait. Bounded twice, both → FN_CONTRACT (a doc-authoring bug, not a
 * vendor fault): per call ≤ SLEEP_MAX_MS_PER_CALL, cumulative per phase
 * invocation ≤ SLEEP_BUDGET_MS. Long waits belong to the POLL CADENCE
 * (pollAfterMs), not to sleeping inside a phase.
 */
export type LifecycleSleepFn = (ms: number) => Promise<void>

export const SLEEP_MAX_MS_PER_CALL = 30_000
export const SLEEP_BUDGET_MS = 120_000

/**
 * `utils.resources` — the run-scoped OWNERSHIP window (design D32): rows
 * of the running workspace's resources, served by the HOST's
 * ResourceReader port. STRUCTURALLY WITHHELD unless the doc declares a
 * `resource` binding: undeclared docs get a stub that throws
 * RESOURCES_UNDECLARED (capability follows declaration, like utils.http
 * itself). Empty array = owns none — a fn-level decision follows (relay a
 * vendor-shaped 404, provision, etc.), never an engine error.
 */
export interface LifecycleResources {
  owned(query: ResourceQuery): Promise<OwnedResource[]>
}

/**
 * Per-call overrides for `utils.request()` — the DEFAULT RELAY (v1's
 * "default HTTP relay" as a callable): it executes THE endpoint's compiled
 * request, initialized from `data.request` + the caller input —
 * method/url/headers from the compiled request, `body ?? input.body`,
 * `queryParams ?? input.queryParams` — with a PRESENCE-BASED merge: any
 * field here overrides per call, absent fields fall through. That includes
 * the TARGET (`url` | `path` — at most one): `utils.request` can do
 * anything `utils.http` can; the difference is defaults (request = the
 * compiled request's, http = none). Same-origin credential rule (D16) and
 * https-only apply identically.
 */
export const zRequestOverrides = z
  .strictObject({
    method: zHttpMethod.optional(),
    /** Absolute HTTPS target override. At most one of `url` | `path`. */
    url: z.url({ protocol: /^https$/ }).optional(),
    /** Path override, resolved against the doc request URL's origin. */
    path: z.string().regex(/^\//, 'path must start with /').optional(),
    headers: z.record(z.string(), z.string()).optional(),
    queryParams: z.record(z.string(), zJson).optional(),
    body: zJson.optional(),
    requestMs: z.number().int().positive().optional(),
  })
  .refine((o) => o.url === undefined || o.path === undefined, {
    message: 'at most one of url | path',
  })
export type RequestOverrides = z.infer<typeof zRequestOverrides>

export type LifecycleRequestFn = (
  overrides?: RequestOverrides,
) => Promise<HttpResult>

/** The lifecycle hooks' utils: the pure ABI + the effect capabilities —
 *  `http` (raw, explicit), `request` (the default relay), `sleep`
 *  (bounded in-phase waits) and `resources` (the ownership window —
 *  a throwing stub unless the doc declares a binding). Logging is NOT
 *  here: `ctx.logger` is its own ctx member (every hook has it). */
export interface LifecycleUtils extends FnUtils {
  http: LifecycleHttpFn
  request: LifecycleRequestFn
  sleep: LifecycleSleepFn
  resources: LifecycleResources
}

export const zLifecycleUtils = z.custom<LifecycleUtils>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    'json' in value &&
    'money' in value &&
    'http' in value &&
    'request' in value &&
    'sleep' in value &&
    'resources' in value,
  'expected LifecycleUtils ({ json, money, http, request, sleep, resources })',
)
