/**
 * The TYPE layer over `defineEndpoint` (design D19a) — types only, no
 * runtime: zod stays the runtime truth (the derived-enum pattern), TS
 * narrows on top of the SAME declarations, so a doc's own fns are checked
 * against the doc's own model and input schema at `deno task check`:
 *
 *   - `usage.counts` KEYS are the model's literal metered keys — a typo'd
 *     or flat-component key fails the typecheck;
 *   - `data.input.body` is `z.output` of the doc's OWN input schema —
 *     direct property access, no JSONPath guessing (sound at runtime:
 *     `validateInput` runs the same schema before any hook, with schema
 *     defaults materialized into the body);
 *   - a COUNTING estimate cannot be declared on a flat doc at all (the
 *     slot type is `never` — "this preset doesn't support this model" is
 *     a doc-site type error, not a silent {} fallback).
 */
import type { FnUtils, HookLogger } from '../hooks/ctx.ts'
import type {
  GatedResources,
  LifecycleRequestInfo,
  LifecycleRunInfo,
} from '../hooks/lifecycle-data.ts' // T106 split: moved from lifecycle.ts
import type { LifecycleUtils } from '../hooks/lifecycle.ts'
import type { Json } from '../json/type.ts'
import type { RunInput } from '../run/input.ts'
import type { FnState, RunState } from '../run/state.ts'
import type { UsageModel } from '../usage/model/mod.ts'
import type { z } from 'zod'

/**
 * The metered counts KEYS a model bills, as LITERAL types: COMPOSITE →
 * its PER_UNIT component ids (flat components filtered out — never a
 * count); leaf PER_UNIT → the unit; PER_CALL / no model → `never`
 * (nothing countable). The type-level twin of the runtime rules in
 * usage/validate.ts (`countsMismatch`).
 */
export type MeteredKeyOf<M> = M extends {
  kind: 'COMPOSITE'
  components: infer C
}
  ? {
      [K in keyof C]: C[K] extends { kind: 'PER_UNIT' } ? K : never
    }[keyof C] &
      string
  : M extends { kind: 'PER_UNIT'; unit: infer U extends string }
    ? U
    : never

/** The FN-returned usage: typed QUANTITIES per metered rate-card line —
 *  a SUBSET of the metered line ids is legal (mode-selected lines —
 *  linkedin), a foreign key is not. FREE and flat models have no metered
 *  lines, so their fns can write only `{counts: {}}` (design D25/D26 —
 *  flat 1s and the credits fold are engine-owned; fns never do rate
 *  math or receipt plumbing). */
export type TypedUsage<K extends string> = {
  /** No metered lines (FREE/flat models) ⇒ only `{}` is writable —
   *  `Record<string, never>` rejects every entry (a bare `{}` target
   *  would accept anything: TS skips excess-property checks against
   *  empty shapes). */
  counts: [K] extends [never]
    ? Record<string, never>
    : Partial<Record<K, number>>
}

/** RunInput with the body AND queryParams typed by the doc's OWN schemas
 *  (design D25 — queryParams joins the typed layer; sound: validateInput
 *  clones + materializes defaults for all input channels first). */
export type TypedRunInput<B, Q = Record<string, Json> | undefined> = Omit<
  RunInput,
  'body' | 'queryParams'
> & { body: B; queryParams: Q }

/**
 * RunState / FnState with the fn-owned `data` bag typed by the doc's OWN
 * `lifecycle.state` schema (design D23 addendum) — SOUND like the body:
 * the engine validates `state.data` against `doc.lifecycle.stateSchema`
 * on every boundary before a fn sees it. No declared schema ⇒ `Json`
 * (exactly today's shape — no regression).
 */
export type TypedRunState<SD> = Omit<RunState, 'data'> & { data?: SD }
export type TypedFnState<SD> = Omit<FnState, 'data'> & { data?: SD }

/** The consolidate/fromResponse envelope ctx, body- and state-typed. Ctx
 *  paths name their PROVENANCE: `data.lifecycle.state` (the async run's
 *  final threaded state), `data.usage.model` (the doc's own model). */
export interface TypedEnvelopeCtx<
  B,
  SD = Json,
  Q = Record<string, Json> | undefined,
> {
  data: {
    input: TypedRunInput<B, Q>
    output: Json
    lifecycle?: { state: TypedRunState<SD> }
    usage: { model: UsageModel }
  }
  utils: FnUtils
  logger: HookLogger
}

/** The estimate ctx, body-typed. `elapsedMs` is absent at admission and
 *  set on cadenced re-runs (design D40) — one fn, two moments. */
export interface TypedEstimateCtx<B, Q = Record<string, Json> | undefined> {
  data: {
    input: TypedRunInput<B, Q>
    elapsedMs?: number
    usage: { model: UsageModel }
  }
  utils: FnUtils
  logger: HookLogger
}

/**
 * Lifecycle fn ctxs + outcomes, body- and state-typed (design D23
 * addendum). The tick ctx reads the WHOLE RunState at
 * `data.lifecycle.state` (fn-owned fields + engine-owned timing); the
 * outcome's `state` is the fn-owned WHOLE next state (design D21) with
 * its `data` bag checked against the doc's declared `lifecycle.state`
 * schema AT THE WRITE SITE — a poll fn stashing a mis-shaped billing
 * signal fails `deno task check`, not just the runtime gate.
 */
export interface TypedLifecycleStartCtx<
  B,
  Q = Record<string, Json> | undefined,
> {
  data: {
    input: TypedRunInput<B, Q>
    request: LifecycleRequestInfo
    run: LifecycleRunInfo
    /** The GATED INSTANCES (design D43): every keyed binding's owned
     *  resource by alias — present iff the doc declares keyed
     *  bindings and the gate found rows. */
    resources?: GatedResources
  }
  utils: LifecycleUtils
  logger: HookLogger
}

export interface TypedLifecycleTickCtx<
  B,
  SD = Json,
  Q = Record<string, Json> | undefined,
> {
  data: {
    input: TypedRunInput<B, Q>
    request: LifecycleRequestInfo
    run: LifecycleRunInfo
    resources?: GatedResources
    lifecycle: { state: TypedRunState<SD> }
  }
  utils: LifecycleUtils
  logger: HookLogger
}

export type TypedLifecycleOutcome<SD = Json> =
  | {
      kind: 'RUNNING'
      state?: TypedFnState<SD>
      pollAfterMs?: number
    }
  | {
      kind: 'COMPLETED'
      httpStatus: number
      providerHttpStatus?: number
      output: Json
      state?: TypedFnState<SD>
    }

/**
 * The SHARED seed slot-override shapes (design D24) — written once,
 * composed by BOTH `defineEndpoint` (B = the doc's own body type) and
 * `defineProvider` (B = `Json | undefined`: a provider fn serves every
 * endpoint, so its body is genuinely untypeable — D23's documented seam).
 * A builder API or z.function factories would be slimmer to write but
 * trade away seed-literal inference — the thing that keeps doc authoring
 * annotation-free.
 */
export type TypedLifecycleSlots<B, StateSchema extends z.ZodType, Seed> = Omit<
  Seed,
  'state' | 'start' | 'poll' | 'stop'
> & {
  state?: StateSchema
  start?: (
    ctx: TypedLifecycleStartCtx<B>,
  ) => Promise<TypedLifecycleOutcome<z.output<StateSchema>>>
  poll?: (
    ctx: TypedLifecycleTickCtx<B, z.output<StateSchema>>,
  ) => Promise<TypedLifecycleOutcome<z.output<StateSchema>>>
  /** Stop with a voice (design D34): a full COMPLETED envelope
   *  settles the metered work, UNRESOLVED flags for host
   *  reconciliation, void keeps the classic best-effort posture. */
  stop?: (ctx: TypedLifecycleTickCtx<B, z.output<StateSchema>>) => Promise<
    | Extract<
        TypedLifecycleOutcome<z.output<StateSchema>>,
        { kind: 'COMPLETED' }
      >
    | {
        kind: 'UNRESOLVED'
        reason?: string
        state?: TypedFnState<z.output<StateSchema>>
      }
    | void
  >
}

export type TypedOutputSlots<B, SD, Seed> = Omit<
  Seed,
  'fromResponse' | 'fromError'
> & {
  fromResponse?: (ctx: TypedEnvelopeCtx<B, SD>) => Json
  fromError?: (ctx: TypedEnvelopeCtx<B, SD>) => Json
}

/**
 * The typed return of a usage.consolidate (vendor-meter) fn — design
 * D27: the vendor's own consumption claim per declared pool, plus the
 * payload with the billing field removed (absent = unchanged). Pool ids
 * stay `string` — the credit-id generic is the deferred defineConnector
 * typed-assembly stub (D26 open question).
 */
export type TypedConsolidated = {
  credits: Record<string, number>
  output?: Json
}
