import { CompileError, CompileErrorCode } from './compile-shared.ts'

import type {
  Credits,
  UsageModel,
  zEndpointDef,
  zProviderDef,
} from '../core/mod.ts'
import type z from 'zod'

// T106 file split: the credits section (design D26/D6/D6b/D6c) extracted
// VERBATIM from compile.ts; zero behavior change. The drainedByProvider set
// is the caller's (provider-wide, design D6b) and is mutated here.

export interface ResolveCreditsArgs {
  usageModel: UsageModel
  def: z.infer<typeof zEndpointDef>
  provider: z.infer<typeof zProviderDef>
  where: string
  drainedByProvider: Set<string>
}

export function resolveCredits(args: ResolveCreditsArgs): Credits {
  const { usageModel, def, provider, where, drainedByProvider } = args
  if (usageModel.kind === 'FREE' && def.usage?.credits) {
    throw new CompileError(
      CompileErrorCode.HOOK_UNRESOLVED,
      `${where}: usage.credits on a FREE doc — free drains ` +
        `nothing (design D26: compiled FREE credits = {})`,
    )
  }
  const declared: Credits =
    usageModel.kind === 'FREE'
      ? {}
      : {
          ...provider.usage?.credits,
          ...def.usage?.credits,
        }
  if (usageModel.kind !== 'FREE' && Object.keys(declared).length === 0) {
    throw new CompileError(
      CompileErrorCode.HOOK_UNRESOLVED,
      `${where}: usage.credits must resolve — a billable ` +
        `model's lines drain declared credit systems ` +
        `(design D26; a provider declares its pool SET ` +
        `once — {default: {...}} for single-pool vendors — ` +
        `and an endpoint may add or restate one key-wise)`,
    )
  }
  const consumesLines: [string, { credit: string }][] =
    usageModel.kind === 'COMPOSITE'
      ? Object.entries(usageModel.components).map(([id, component]) => [
          id,
          component.consumes,
        ])
      : usageModel.kind === 'FREE'
        ? []
        : [
            [
              usageModel.kind === 'PER_UNIT' ? usageModel.unit : 'CALL',
              usageModel.consumes,
            ],
          ]
  const declaredIds = new Set(Object.keys(declared))
  for (const [lineId, consumes] of consumesLines) {
    if (!declaredIds.has(consumes.credit)) {
      throw new CompileError(
        CompileErrorCode.HOOK_UNRESOLVED,
        `${where}: line "${lineId}" consumes undeclared ` +
          `credit "${consumes.credit}" (declared: ` +
          `${[...declaredIds].join(', ') || 'none'})`,
      )
    }
  }
  const usedIds = new Set(consumesLines.map(([, c]) => c.credit))
  for (const id of Object.keys(def.usage?.credits ?? {})) {
    if (!usedIds.has(id)) {
      throw new CompileError(
        CompileErrorCode.HOOK_UNRESOLVED,
        `${where}: endpoint-declared credit "${id}" is ` +
          `drained by no line of this endpoint — remove ` +
          `it, reference it, or move it to the provider`,
      )
    }
  }
  for (const id of usedIds) drainedByProvider.add(id)
  // the doc carries ONLY what it drains (design D6c) — sorted
  // for a deterministic emitted key order (the hash is RFC 8785
  // either way); every id is declared, checked just above.
  return Object.fromEntries([...usedIds].sort().map((id) => [id, declared[id]]))
}
