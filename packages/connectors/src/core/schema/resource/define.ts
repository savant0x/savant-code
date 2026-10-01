import { parseSchema } from '../parse.ts'
import { type ResourceDef, type ResourceDefSeed, zResourceDef } from './def.ts'

import type {
  RefreshOutcome,
  ReleaseOutcome,
  ResourceOpUtils,
  VerifyOutcome,
} from './ops.ts'
import type { UsageReading, UsageWindow } from './usage.ts'
import type { HookLogger } from '../hooks/ctx.ts'
import type { Json } from '../json/type.ts'
import type { z } from 'zod'

/** The op ctx with the INSTANCE's `data` typed as the def's own schema
 *  output (sound: the engine validates it against the compiled data
 *  schema before any op runs). */
export interface TypedOwnedResource<Data> {
  resource: string
  externalId: string
  data: Data
  syncedAt?: string
}

export interface TypedResourceOpCtx<Data> {
  data: { resource: TypedOwnedResource<Data> }
  utils: ResourceOpUtils
  logger: HookLogger
}

export interface TypedViewCtx<Data> {
  data: { resource: TypedOwnedResource<Data>; args?: Json }
  utils: ResourceOpUtils
  logger: HookLogger
}

export interface TypedReconcileUsageCtx<Data> {
  data: { resource: TypedOwnedResource<Data>; window: UsageWindow }
  utils: ResourceOpUtils
  logger: HookLogger
}

type SeedLifecycle = ResourceDefSeed['lifecycle']
type SeedReconcile = NonNullable<ResourceDefSeed['reconcileUsage']>

/**
 * defineResource — the parsed seed, with the instance's `data` typed by
 * the def's OWN `data` schema across every lifecycle/reconcile/view fn
 * (the D23 pattern: the type layer narrows, zod stays the runtime truth;
 * the engine's per-call instance validation is the soundness anchor).
 */
export function defineResource<DataSchema extends z.ZodType>(
  seed: Omit<
    ResourceDefSeed,
    'data' | 'lifecycle' | 'views' | 'reconcileUsage'
  > & {
    data: DataSchema
    reconcileUsage?: Record<
      string,
      Omit<SeedReconcile[string], 'get'> & {
        get: (
          ctx: TypedReconcileUsageCtx<z.output<DataSchema>>,
        ) => Promise<UsageReading>
      }
    >
    lifecycle: Omit<SeedLifecycle, 'verify' | 'release' | 'refresh'> & {
      verify: (
        ctx: TypedResourceOpCtx<z.output<DataSchema>>,
      ) => Promise<VerifyOutcome>
      release: (
        ctx: TypedResourceOpCtx<z.output<DataSchema>>,
      ) => Promise<ReleaseOutcome>
      refresh?: (
        ctx: TypedResourceOpCtx<z.output<DataSchema>>,
      ) => Promise<RefreshOutcome>
    }
    views?: Record<
      string,
      {
        label?: string
        read: (ctx: TypedViewCtx<z.output<DataSchema>>) => Promise<Json>
      }
    >
  },
): ResourceDef {
  return parseSchema(
    zResourceDef,
    seed as unknown as ResourceDefSeed,
    'defineResource',
  )
}
