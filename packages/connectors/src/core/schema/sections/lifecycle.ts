import { z } from 'zod'

import { zSchemaCarrier } from '../hooks/ctx.ts'
import {
  zLifecyclePollFn,
  zLifecycleStartFn,
  zLifecycleStopFn,
} from '../hooks/lifecycle-data.ts' // T106 split: moved from lifecycle.ts (verbatim re-export via hooks/mod.ts)

/**
 * Lifecycle section — SHARED by EndpointDef and ProviderDef (one shape, both
 * scopes; leaf-wise fallback resolves each phase endpoint ?? provider). The
 * v2 form of monid-services' `runLifecycle`:
 *
 *   - `start`: replaces the engine's declarative execution of `request`
 *     (which stays REQUIRED — it becomes DATA into the fns via
 *     ctx.data.request). Returns running{state} | completed{raw envelope}.
 *   - `poll`: one status tick — absent ⇒ not pollable (a start that returns
 *     `running` without a resolved poll fails the run, CONTRACT_VIOLATION).
 *   - `stop`: best-effort vendor abort — absent ⇒ stop is a no-op.
 *
 * All fields `.optional()` per D20 (a `.default()` would shadow the other
 * scope); the compiler enforces that `start` resolves whenever ANY lifecycle
 * leaf does. A provider-level lifecycle is the `actorRunLifecycle`-attached-
 * to-every-def equivalent: Apify declares start/poll/stop once, endpoints
 * are pure data.
 */
export const zLifecycleSection = z.strictObject({
  start: zLifecycleStartFn.optional(),
  poll: zLifecyclePollFn.optional(),
  stop: zLifecycleStopFn.optional(),
  /**
   * Zod schema of the fn-owned `state.data` bag — the TYPED state
   * extension: compiled to JSON Schema at `doc.lifecycle.stateSchema`
   * (hash-covered, catalog-visible) and engine-validated on EVERY tick
   * boundary (after each start/poll return: FN_CONTRACT; before each
   * poll/stop invocation: defense against host-side corruption). The
   * live zod object doubles as the author's compile-time type
   * (`z.infer`); the doc schema is the runtime authority. Absent ⇒
   * `data` stays free-form Json (size cap only).
   */
  state: zSchemaCarrier.optional(),
})
export type LifecycleSection = z.infer<typeof zLifecycleSection>
