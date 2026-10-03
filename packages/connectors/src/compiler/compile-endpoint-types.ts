import type { FnInterner } from './fns.ts'
import type {
  Credits,
  FnRef,
  Json,
  UsageModel,
  zEndpointDef,
  zProviderDef,
} from '../core/mod.ts'
import type z from 'zod'

// T106 file split: the endpoint-phase argument/result contracts for the
// compile.ts phase modules (compile-endpoint-a/b.ts + -doc.ts). Types only —
// every phase body is a verbatim extraction from the pre-split compile.ts.

export interface EndpointPhaseAArgs {
  def: z.infer<typeof zEndpointDef>
  provider: z.infer<typeof zProviderDef>
  providerName: string
  where: string
  endpointFile: string
  providerFile: string
  /** Compiled endpoints so far — duplicate-identity guard. */
  endpoints: Record<string, unknown>
  interner: FnInterner
  /** The category enum BUILT from the run's leafCategories (compile.ts). */
  zCategories: z.ZodType
}

export interface EndpointPhaseAResult {
  id: string
  endpointPath: string
  meta: Json
  url: string
  headers: Record<string, string>
  timeouts: {
    requestMs: number
    runMs: number
    pollMs: number | undefined
  }
  lifecycleStartRef: FnRef | undefined
  lifecyclePollRef: FnRef | undefined
  lifecycleStopRef: FnRef | undefined
  lifecyclePollResolved: boolean
  stateSchema: Record<string, Json> | undefined
  injectRef: FnRef
  credentialsSchema: Record<string, Json>
  toRequestRef: FnRef | undefined
  fromResponseRef: FnRef | undefined
  fromErrorRef: FnRef | undefined
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
