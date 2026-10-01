import { z } from 'zod'

import { zJsonSchemaDoc } from './json-schema-doc.ts'
import { contractConfig } from '../../config.ts' // port: inlined constants module (PORT-NOTES.md)
import { zHttpMethod } from '../common/http.ts'
import {
  zDocHash,
  zEndpointId,
  zEndpointPath,
  zProviderName,
  zSemverString,
} from '../common/ids.ts'
import { zFnRef } from '../fn-table/ref.ts'
import { zEndpointMeta } from '../meta/endpoint.ts'
import { zResourceId } from '../resource/ids.ts'
import { resourcesSectionIssues } from '../sections/resource-binding.ts'
import { zTimeouts } from '../sections/timeouts.ts'
import { zCredits, zUsageModel } from '../usage/model/mod.ts'

/**
 * zEndpointDoc — the COMPILED artifact: pure, flat, strict RFC 8259 JSON,
 * self-executing after provider fusion (no provider lookup at run time; all
 * leaf-wise fallback already resolved). Hooks hold `$fn` content-id
 * references — a doc alone cannot execute; it runs as a SEALED UNIT
 * ({doc, fns}, bundle/sealed-unit.ts).
 */
export const zEndpointDoc = z.strictObject({
  /** Doc FORMAT version (config.yml schema.spec_version) — semver. */
  specVersion: z.literal(contractConfig.schema.specVersion),
  id: zEndpointId, // "<provider>#<endpoint sans slash>" — derived, never authored
  /** The PUBLIC endpoint identity as a native path (design D22) — the
   *  catalog/broker-facing name; `id` is `provider#` + this minus its
   *  leading slash. */
  endpoint: zEndpointPath,
  provider: zProviderName,
  /** Compiler-derived: semverMax(doc_format_since, api of every $fn). */
  minEngineVersion: zSemverString,
  /** Post-fallback (docsUrl/categories may come from the provider). */
  meta: zEndpointMeta,
  auth: z.strictObject({
    /** Executed by the injector (Transport/Relay), never the pipeline. */
    inject: zFnRef,
    /** JSON Schema of the credential SHAPE — validated against RESOLVED
     *  secrets before inject runs (MISSING_CREDENTIAL). Never a value. */
    credentials: zJsonSchemaDoc,
  }),
  request: z.strictObject({
    method: zHttpMethod,
    /** Absolute after baseUrl resolution; may contain {pathParam}s. */
    url: z.string().min(1),
    headers: z.record(z.string(), z.string()).optional(),
  }),
  input: z.strictObject({
    schema: z.strictObject({
      body: zJsonSchemaDoc.optional(),
      queryParams: zJsonSchemaDoc.optional(),
      pathParams: zJsonSchemaDoc.optional(),
    }),
    toRequest: zFnRef.optional(),
  }),
  output: z.strictObject({
    fromResponse: zFnRef.optional(),
    /** Provider-error projection (runs after zero-usage forcing). */
    fromError: zFnRef.optional(),
    /** Validates the FINAL (post-fromResponse) SUCCESS output. */
    schema: zJsonSchemaDoc.optional(),
  }),
  usage: z.strictObject({
    /** The billing-shape + RATE-CARD declaration (design D26) —
     *  inline DATA (hash-covered), never a fn: catalogs and the
     *  broker price from it without executing anything. REQUIRED
     *  (resolved endpoint ?? provider at compile). */
    model: zUsageModel,
    /** The credit systems the model's lines drain (design D26) —
     *  resolved provider ?? endpoint at compile; every consumes.credit
     *  references one of these ids (compile-checked). `{}` for FREE
     *  docs. */
    credits: zCredits,
    /** Pre-run quantities promise: validated input → `{counts}` per
     *  metered line — REQUIRED (resolved endpoint ?? provider;
     *  compiler-synthesized `() => ({counts:{}})` for models with no
     *  metered lines — design D27). */
    estimate: zFnRef,
    /** Post-run quantities settle: RAW envelope → `{counts}` —
     *  REQUIRED (same resolution + synthesis rule as estimate). */
    evidence: zFnRef,
    /** The vendor-meter fn: lifts the vendor's own consumed-credits
     *  number out of the payload (`{credits, output?}`) — OPTIONAL
     *  (not every vendor reports one), resolved endpoint ?? provider.
     *  A resolved claim WINS over the derived fold at settle
     *  (design D27). */
    consolidate: zFnRef.optional(),
    /** The estimate re-run cadence (design D40) — PRESENT means the
     *  estimate reads `elapsedMs` and hosts re-price the hold on
     *  this cadence while RUNNING. Requires lifecycle.poll + a
     *  metered model (compile-checked). */
    updateEstimateEveryMs: z.number().int().positive().optional(),
  }),
  /**
   * Async run protocol (engine ≥ config schema.async_since). When present
   * the engine calls `start` INSTEAD of executing `request` itself —
   * `request` stays required and rides into the fns as ctx.data.request.
   * `poll` absent ⇒ not pollable; `stop` absent ⇒ stop is a no-op.
   */
  lifecycle: z
    .strictObject({
      start: zFnRef,
      poll: zFnRef.optional(),
      stop: zFnRef.optional(),
      /** JSON Schema of the fn-owned `state.data` bag — engine-validated
       *  per tick (typed state, resolved endpoint ?? provider). */
      stateSchema: zJsonSchemaDoc.optional(),
    })
    .optional(),
  /** Endpoint↔resource bindings (design D32/D43), compiled: the
   *  purpose-keyed block with fn slots as $fn refs, the binding
   *  invariants (provisions ≤1, targeted keys, alias uniqueness)
   *  already compile-checked. Presence unlocks `utils.resources` and
   *  demands a ResourceReader at load. Gate order is canonical:
   *  uses → updates → releases → reads, declaration order within. */
  resources: z
    .strictObject({
      provisions: z
        .array(
          z.strictObject({
            id: zResourceId,
            seed: zFnRef,
          }),
        )
        .optional(),
      uses: z
        .array(
          z.strictObject({
            id: zResourceId,
            key: z.string().min(1).optional(),
            as: z.string().min(1).optional(),
            ensure: zFnRef.optional(),
          }),
        )
        .optional(),
      updates: z
        .array(
          z.strictObject({
            id: zResourceId,
            key: z.string().min(1),
            as: z.string().min(1).optional(),
          }),
        )
        .optional(),
      releases: z
        .array(
          z.strictObject({
            id: zResourceId,
            key: z.string().min(1),
            as: z.string().min(1).optional(),
          }),
        )
        .optional(),
      reads: z
        .array(
          z.strictObject({
            id: zResourceId,
            key: z.string().min(1).optional(),
            as: z.string().min(1).optional(),
            ensure: zFnRef.optional(),
          }),
        )
        .optional(),
    })
    .superRefine((section, ctx) => {
      // the SAME invariants the def schema enforces — docs cross a
      // trust boundary, so the engine-side shape re-enforces them
      // (provisions ≤1, `as` requires `key`, aliases unique)
      for (const issue of resourcesSectionIssues(section)) {
        ctx.addIssue({ code: 'custom', ...issue })
      }
    })
    .optional(),
  timeouts: zTimeouts,
  /** Hash of the stable serialization (minus this field) — covers $fn ids. */
  hash: zDocHash,
})
export type EndpointDoc = z.infer<typeof zEndpointDoc>

/** Collect every $fn id a doc references. */
export function fnKeysOf(doc: EndpointDoc): string[] {
  const keys: string[] = [doc.auth.inject.$fn.key]
  if (doc.input.toRequest) keys.push(doc.input.toRequest.$fn.key)
  if (doc.output.fromResponse) keys.push(doc.output.fromResponse.$fn.key)
  if (doc.output.fromError) keys.push(doc.output.fromError.$fn.key)
  keys.push(doc.usage.estimate.$fn.key)
  keys.push(doc.usage.evidence.$fn.key)
  if (doc.usage.consolidate) keys.push(doc.usage.consolidate.$fn.key)
  if (doc.lifecycle) {
    keys.push(doc.lifecycle.start.$fn.key)
    if (doc.lifecycle.poll) keys.push(doc.lifecycle.poll.$fn.key)
    if (doc.lifecycle.stop) keys.push(doc.lifecycle.stop.$fn.key)
  }
  if (doc.resources) {
    for (const binding of doc.resources.provisions ?? []) {
      keys.push(binding.seed.$fn.key)
    }
    for (const binding of [
      ...(doc.resources.uses ?? []),
      ...(doc.resources.reads ?? []),
    ]) {
      if (binding.ensure) keys.push(binding.ensure.$fn.key)
    }
  }
  return [...new Set(keys)]
}
