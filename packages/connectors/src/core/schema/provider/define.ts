import { parseSchema } from '../parse.ts'
import { type ProviderDef, type ProviderDefSeed, zProviderDef } from './def.ts'

import type {
  TypedEnvelopeCtx,
  TypedLifecycleSlots,
  TypedOutputSlots,
} from '../endpoint/typed.ts'
import type { Consolidated } from '../hooks/mod.ts'
import type { Json } from '../json/type.ts'
import type { z } from 'zod'

type SeedLifecycle = NonNullable<ProviderDefSeed['lifecycle']>
type SeedOutput = NonNullable<ProviderDefSeed['output']>
type SeedUsage = NonNullable<ProviderDefSeed['usage']>

/**
 * The provider def, typed over ITS OWN `lifecycle.state` schema (design
 * D24 — the provider half of the D23 type layer, composed from the SAME
 * shared slot shapes `defineEndpoint` uses): the fn-owned `state.data`
 * bag is typed at read sites (`data.lifecycle.state` in tick + envelope
 * ctxs) AND write sites (lifecycle outcome `state`) — sound because the
 * engine validates the same schema on the same boundaries. The BODY stays
 * `Json | undefined` here: a provider fn serves every endpoint, so its
 * input body is genuinely untypeable (D23's documented seam). Counts stay
 * `Record<string, number>` — there is no model generic at provider level
 * (a generic provider consolidate keys off `data.usage.model` at runtime).
 */
export function defineProvider<
  StateSchema extends z.ZodType = z.ZodType<Json | undefined>,
>(
  seed: Omit<ProviderDefSeed, 'lifecycle' | 'output' | 'usage'> & {
    lifecycle?: TypedLifecycleSlots<
      Json | undefined,
      StateSchema,
      SeedLifecycle
    >
    output?: TypedOutputSlots<
      Json | undefined,
      z.output<StateSchema>,
      SeedOutput
    >
    usage?: Omit<SeedUsage, 'evidence' | 'consolidate'> & {
      /** Post-run quantities default (design D27) — a GENERIC
       *  fn serving every endpoint keys its counts off
       *  `data.usage.model` at runtime; counts stay
       *  `Record<string, number>` (no model generic at
       *  provider level). */
      evidence?: (
        ctx: TypedEnvelopeCtx<Json | undefined, z.output<StateSchema>>,
      ) => { counts: Record<string, number> }
      /** The vendor-meter default (design D27) — where the
       *  vendor puts its meter is a provider-wide fact, so the
       *  claim + strip is written ONCE here. */
      consolidate?: (
        ctx: TypedEnvelopeCtx<Json | undefined, z.output<StateSchema>>,
      ) => Consolidated
    }
  },
): ProviderDef {
  return parseSchema(zProviderDef, seed as ProviderDefSeed, 'defineProvider')
}
