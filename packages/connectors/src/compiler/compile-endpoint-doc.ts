import {
  CC,
  CompileError,
  CompileErrorCode,
  parseDoc,
  SC,
  semverMax,
} from './compile-shared.ts'
import {
  docHash,
  type EndpointDoc,
  type FnRef,
  type Json,
  pruneUndefined,
  stableStringify,
  zEndpointDoc,
} from '../core/mod.ts'


import type {
  EndpointPhaseAResult,
  EndpointPhaseBResult,
} from './compile-endpoint-types.ts'
import type { FnInterner } from './fns.ts'

// T106 file split: endpoint DOC assembly + the minEngineVersion AUTO rule,
// extracted VERBATIM from compile.ts (300-line ceiling; zero behavior
// change). Phase results flow in; the validated doc comes out.

export interface AssembleEndpointDocArgs {
  def: { request: { method: string } }
  providerName: string
  where: string
  interner: FnInterner
  phaseA: EndpointPhaseAResult
  phaseB: EndpointPhaseBResult
  bindingRefs: FnRef[]
  compiledBindings: Record<string, Json> | undefined
  hasResources: boolean
  loggerWarn?: (message: string, fields?: unknown) => void
}

/** minEngineVersion AUTO-ONLY + the assembled, validated EndpointDoc. */
export async function assembleEndpointDoc(
  args: AssembleEndpointDocArgs,
): Promise<EndpointDoc> {
  const {
    def,
    providerName,
    where,
    interner,
    phaseA,
    phaseB,
    bindingRefs,
    compiledBindings,
    hasResources,
  } = args

  // ---- minEngineVersion: AUTO-ONLY ------------------------------
  const refs = [
    phaseA.injectRef,
    phaseA.toRequestRef,
    phaseA.fromResponseRef,
    phaseA.fromErrorRef,
    phaseB.consolidateRef,
    phaseB.estimateRef,
    phaseA.lifecycleStartRef,
    phaseA.lifecyclePollRef,
    phaseA.lifecycleStopRef,
    ...bindingRefs,
  ].filter((ref): ref is FnRef => ref !== undefined)
  const minEngineVersion = semverMax([
    ...refs.map((ref) => interner.table[ref.$fn.key].api),
    // a binding/cadence with no NEW fn (e.g. uses with neither
    // key nor ensure) still floors the doc: an older engine's
    // strictObject rejects the new keys outright.
    ...(hasResources || phaseB.updateEstimateEveryMs !== undefined
      ? [SC.resourcesSince]
      : []),
  ])

  // ---- assemble + validate --------------------------------------
  const docWithoutHash = pruneUndefined({
    specVersion: SC.specVersion,
    id: phaseA.id,
    endpoint: phaseA.endpointPath,
    provider: providerName,
    minEngineVersion,
    meta: phaseA.meta,
    auth: {
      inject: phaseA.injectRef as unknown as Json,
      credentials: phaseA.credentialsSchema,
    },
    request: {
      method: def.request.method,
      url: phaseA.url,
      headers:
        Object.keys(phaseA.headers).length > 0 ? phaseA.headers : undefined,
    },
    input: {
      schema: {
        body: phaseB.inputSchemas.body,
        queryParams: phaseB.inputSchemas.queryParams,
        pathParams: phaseB.inputSchemas.pathParams,
      },
      toRequest: phaseA.toRequestRef as unknown as Json,
    },
    output: {
      fromResponse: phaseA.fromResponseRef as unknown as Json,
      fromError: phaseA.fromErrorRef as unknown as Json,
      schema: phaseB.outputSchema,
    },
    usage: {
      model: phaseB.usageModel as unknown as Json,
      credits: phaseB.credits as unknown as Json,
      estimate: phaseB.estimateRef as unknown as Json,
      evidence: phaseB.evidenceRef as unknown as Json,
      consolidate: phaseB.consolidateRef as unknown as Json,
      updateEstimateEveryMs: phaseB.updateEstimateEveryMs,
    },
    lifecycle: phaseA.lifecycleStartRef
      ? {
          start: phaseA.lifecycleStartRef as unknown as Json,
          poll: phaseA.lifecyclePollRef as unknown as Json,
          stop: phaseA.lifecycleStopRef as unknown as Json,
          stateSchema: phaseA.stateSchema as unknown as Json,
        }
      : undefined,
    resources: compiledBindings
      ? pruneUndefined(compiledBindings as Record<string, Json | undefined>)
      : undefined,
    timeouts: phaseA.timeouts,
  }) as Record<string, Json>

  const hash = await docHash(docWithoutHash)
  const doc = parseDoc(zEndpointDoc, { ...docWithoutHash, hash }, where)

  const size = stableStringify(docWithoutHash).length
  if (size > CC.docSizeFailBytes) {
    throw new CompileError(
      CompileErrorCode.DOC_MALFORMED,
      `${where}: doc size ${size} > ${CC.docSizeFailBytes}`,
    )
  }
  if (size > CC.docSizeWarnBytes) {
    args.loggerWarn?.(`doc size over warn threshold`, { where, size })
  }
  return doc
}
