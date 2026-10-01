
import { hasMeteredLines } from '@shared/core'

import { resolveCredits } from './compile-endpoint-credits.ts'
import {
  resolve,
  SC,
  CompileError,
  CompileErrorCode,
  SYNTHESIZED_EMPTY_USAGE,
  toJsonSchema,
} from './compile-shared.ts'

import type { FnInterner } from './fns.ts'
import type { zEndpointDef, zProviderDef ,
  Credits,
  FnRef,
  Json,
  UsageModel,
} from '@shared/core'
import type z from 'zod'

// T106 file split: endpoint usage/credits/schema sections, verbatim
// (credits resolution lives in compile-endpoint-credits.ts).

export interface EndpointPhaseBArgs {
  def: z.infer<typeof zEndpointDef>
  provider: z.infer<typeof zProviderDef>
  where: string
  endpointFile: string
  providerFile: string
  interner: FnInterner
  /** Phase A outcome — the updateEstimateEveryMs check reads the
   *  poll resolution (dead-config lint). */
  lifecyclePollResolved: boolean
  /** The provider-wide drained-pool set (design D6b) — mutated here. */
  drainedByProvider: Set<string>
}

export interface EndpointPhaseBResult {
  usageModel: UsageModel
  metered: boolean
  estimateRef: FnRef
  evidenceRef: FnRef
  consolidateRef: FnRef | undefined
  credits: Credits
  inputSchemas: {
    body: Record<string, Json> | undefined
    queryParams: Record<string, Json> | undefined
    pathParams: Record<string, Json> | undefined
  }
  outputSchema: Record<string, Json> | undefined
  updateEstimateEveryMs: number | undefined
}

export async function compileEndpointPhaseB(
  args: EndpointPhaseBArgs,
): Promise<EndpointPhaseBResult> {
  const {
    def,
    provider,
    where,
    endpointFile,
    providerFile,
    interner,
    lifecyclePollResolved,
    drainedByProvider,
  } = args

  // ---- usage.model (inline DATA, REQUIRED) ----------------------
  const usageModel = def.usage?.model ?? provider.usage?.model
  if (usageModel === undefined) {
    throw new CompileError(
      CompileErrorCode.HOOK_UNRESOLVED,
      `${where}: usage.model must resolve — declare it on the ` +
        `endpoint or the provider; every doc states what is ` +
        `chargeable (design D19).`,
    )
  }
  const meteredCount =
    usageModel.kind === 'COMPOSITE'
      ? Object.values(usageModel.components).filter(
          (component) => component.kind === 'PER_UNIT',
        ).length
      : usageModel.kind === 'PER_UNIT'
        ? 1
        : 0
  // ≥2 METERED components ⇒ only DOC-owned fns can know which
  // line a count belongs to — a GENERIC provider evidence fn
  // keys by "the sole PER_UNIT line" and would have no basis to
  // choose between two (design D19). Reject at build time, not
  // at the first live run. (Checked FIRST — the more specific
  // diagnosis wins over the general must-resolve rule.)
  if (usageModel.kind === 'COMPOSITE' && meteredCount >= 2) {
    if (def.usage?.evidence === undefined) {
      throw new CompileError(
        CompileErrorCode.HOOK_UNRESOLVED,
        `${where}: ${meteredCount} metered components — ` +
          `a doc-level usage.evidence must key its ` +
          `own counts (the generic provider fn cannot ` +
          `choose between them)`,
      )
    }
    if (def.usage?.estimate === undefined) {
      throw new CompileError(
        CompileErrorCode.HOOK_UNRESOLVED,
        `${where}: ≥2 metered components require a ` +
          `doc-level usage.estimate too (same keying)`,
      )
    }
  }
  // ---- usage.estimate + usage.evidence: the QUANTITIES pair ----
  // (design D27 subclassing): endpoint ?? provider, and when
  // NEITHER declares one AND the model has no metered lines, the
  // compiler synthesizes the one lawful fn — `{counts: {}}` is
  // the only return a FREE/flat model admits, so writing it by
  // hand adds no information. A METERED model's quantities
  // depend on input/response — must resolve (the deduced-
  // estimate guarantee, designs D24/D25).
  const metered = hasMeteredLines(usageModel)
  const estimateFn = resolve(
    def.usage?.estimate,
    `${endpointFile}#usage.estimate`,
    provider.usage?.estimate,
    `${providerFile}#usage.estimate`,
  )
  const evidenceFn = resolve(
    def.usage?.evidence,
    `${endpointFile}#usage.evidence`,
    provider.usage?.evidence,
    `${providerFile}#usage.evidence`,
  )
  if (metered && !estimateFn) {
    throw new CompileError(
      CompileErrorCode.HOOK_UNRESOLVED,
      `${where}: usage.estimate must resolve — the model has ` +
        `metered lines, so the promise depends on the ` +
        `input (deduced estimates, design D24/D27)`,
    )
  }
  if (metered && !evidenceFn) {
    throw new CompileError(
      CompileErrorCode.HOOK_UNRESOLVED,
      `${where}: usage.evidence must resolve — the model has ` +
        `metered lines, so the settled quantities depend ` +
        `on the response (design D27)`,
    )
  }
  const synthesize = () =>
    interner.intern(
      SYNTHESIZED_EMPTY_USAGE,
      'core#usage.synthesizedEmpty',
      SC.fnAbiSince,
    )
  const estimateRef = estimateFn
    ? await interner.intern(estimateFn.value, estimateFn.label, SC.fnAbiSince)
    : await synthesize()
  const evidenceRef = evidenceFn
    ? await interner.intern(evidenceFn.value, evidenceFn.label, SC.fnAbiSince)
    : await synthesize()

  // ---- usage.consolidate: the VENDOR-METER fn, OPTIONAL --------
  // (design D27 — not every vendor reports one; typically
  // provider-level: where the meter lives is a provider-wide
  // fact, so the claim + strip is written once).
  const consolidate = resolve(
    def.usage?.consolidate,
    `${endpointFile}#usage.consolidate`,
    provider.usage?.consolidate,
    `${providerFile}#usage.consolidate`,
  )
  const consolidateRef = consolidate
    ? await interner.intern(
        consolidate.value,
        consolidate.label,
        SC.fnAbiSince,
      )
    : undefined

  // ---- credits (design D26, revised D6): resolved in
  // compile-endpoint-credits.ts — key-wise endpoint over
  // provider, drain lints, D6c emit exactly what is drained.
  const credits = resolveCredits({
    usageModel,
    def,
    provider,
    where,
    drainedByProvider,
  })

  // ---- input/output schemas: leaf-wise fallback -----------------
  const schemaLeaf = (
    endpointSchema: z.ZodType | undefined,
    providerSchema: z.ZodType | undefined,
    label: string,
  ) => {
    const resolved = endpointSchema ?? providerSchema
    return resolved ? toJsonSchema(resolved, label) : undefined
  }
  const inputSchemas = {
    body: schemaLeaf(
      def.input?.schema?.body,
      provider.input?.schema?.body,
      `${where}: input.schema.body`,
    ),
    queryParams: schemaLeaf(
      def.input?.schema?.queryParams,
      provider.input?.schema?.queryParams,
      `${where}: input.schema.queryParams`,
    ),
    pathParams: schemaLeaf(
      def.input?.schema?.pathParams,
      provider.input?.schema?.pathParams,
      `${where}: input.schema.pathParams`,
    ),
  }
  const outputSchema = schemaLeaf(
    def.output?.schema,
    provider.output?.schema,
    `${where}: output.schema`,
  )

  // ---- usage.updateEstimateEveryMs (design D40) -----------------
  // Resolved endpoint ?? provider like every other usage leaf.
  // Coherence: only a POLLABLE run has a mid-flight to re-price,
  // and only METERED lines give the estimate anything to vary.
  const updateEstimateEveryMs =
    def.usage?.updateEstimateEveryMs ?? provider.usage?.updateEstimateEveryMs
  if (updateEstimateEveryMs !== undefined) {
    if (!lifecyclePollResolved) {
      throw new CompileError(
        CompileErrorCode.DOC_MALFORMED,
        `${where}: usage.updateEstimateEveryMs is dead ` +
          `config — no resolved lifecycle.poll (only a ` +
          `pollable run has a mid-flight to re-price)`,
      )
    }
    if (!metered) {
      throw new CompileError(
        CompileErrorCode.DOC_MALFORMED,
        `${where}: usage.updateEstimateEveryMs on a model ` +
          `with no metered lines — a flat/free estimate ` +
          `cannot vary`,
      )
    }
  }

  return {
    usageModel,
    metered,
    estimateRef,
    evidenceRef,
    consolidateRef,
    credits,
    inputSchemas,
    outputSchema,
    updateEstimateEveryMs,
  }
}
