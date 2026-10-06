import {
  compileSteeringRules,
  evaluateSteeringRules,
  formatSteeringBlock,
  steeringTextSurface,
} from './steering-rules'

import type { GateContext, GateHalt, GateStage } from './gate-context'
import type { CompiledSteeringRule, SteeringOverride } from './steering-rules'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { SteeringRuleSpec } from '@savant-code/common/types/steering'

/**
 * Deterministic before-tool steering gate (FID-2026-1006-002 WP1).
 *
 * Sits AFTER the EHEL gate and the PreToolUse hook gate, so project steering
 * is an ADDITIONAL gate at the same enforcement point, never a bypass — the
 * same composition rule the hook gate follows (FID-2026-0814-003). A rule
 * violation halts dispatch with a visible, actionable error; an overridden
 * call dispatches and its override is audited through `auditOverride`.
 *
 * Fail-safe by construction: an unreadable/absent config yields no rules, a
 * malformed rule is dropped and reported once per rule set (never fatal),
 * and a compile error can never turn a guard into a bypass silently.
 */
export type SteeringOverrideAudit = {
  ruleId: string
  reason: string
  toolName: string
  agentId: string
}

export function createSteeringGate<T extends ToolName>(deps: {
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  getRules: () => readonly SteeringRuleSpec[]
  auditOverride: (record: SteeringOverrideAudit) => void
}): GateStage<T> {
  // Compile once per rule-set identity. `getRules()` returns a cached array
  // (the loader caches per project root), so identity is a sound cache key.
  const cache = new WeakMap<
    object,
    { rules: CompiledSteeringRule[]; errors: readonly string[] }
  >()

  const resolve = (specs: readonly SteeringRuleSpec[]) => {
    const cached = cache.get(specs)
    if (cached) return cached
    const { rules, errors } = compileSteeringRules(specs)
    for (const error of errors) {
      deps.logger.warn({ steering: error }, `steering config: ${error}`)
    }
    const entry = { rules, errors }
    cache.set(specs, entry)
    return entry
  }

  return (ctx: GateContext<T>): GateHalt => {
    const specs = deps.getRules()
    if (specs.length === 0) return { halt: false }
    const { rules } = resolve(specs)
    if (rules.length === 0) return { halt: false }

    const text = steeringTextSurface(
      ctx.toolCall.input as Record<string, never> | undefined,
    )
    const decision = evaluateSteeringRules(rules, {
      toolName: String(ctx.toolName),
      text,
    })

    if (decision.kind === 'allow') return { halt: false }

    if (decision.kind === 'block') {
      deps.onResponseChunk({
        type: 'error',
        message: formatSteeringBlock(decision.rule, String(ctx.toolName)),
      })
      deps.logger.warn(
        { ruleId: decision.rule.id, toolName: String(ctx.toolName) },
        `steering: blocked ${String(ctx.toolName)} (rule ${decision.rule.id})`,
      )
      return { halt: true, status: 'failed' }
    }

    const override: SteeringOverride = decision.override
    deps.auditOverride({
      ruleId: decision.rule.id,
      reason: override.reason,
      toolName: String(ctx.toolName),
      agentId: ctx.params.agentTemplate.id,
    })
    return { halt: false }
  }
}
