/**
 * @module echo/law4-turn-end
 *
 * Law 4: Verify Call-Graph Reachability — turn-end evaluation.
 *
 * After a feature is wired (export added), the agent must grep for
 * callers to confirm reachability. If features were wired but not
 * verified, this gate fires.
 *
 * FID-2026-0823-007 (operator directive 2026-0823): Laws 1-4 are immutable
 * process laws and block in EVERY execution mode — the former
 * strict-only tier condition was removed. The hold stays bounded:
 * loop-iteration's applyTurnEndEnforcement is main-agent-only and
 * surrenders after the FID-2026-0822-003 breaker limits, surfacing the
 * violation instead of looping forever — a hard block, not an infinite
 * hold.
 */

import type {
  EnforcementMode,
  EnforcementResult,
  EnforcementState,
  AdvisoryWarning,
} from './types'

/**
 * Evaluate Law 4 at turn end.
 *
 * Compares `featuresWired` against `featuresVerified` to detect
 * features that were exported but whose callers were never grepped.
 *
 * @returns EnforcementResult — always blocked when unwired features exist,
 *          regardless of execution mode.
 */
export function evaluateLaw4TurnEnd(params: {
  state: EnforcementState
  mode: EnforcementMode
  tier: 'core_4' | 'all_15'
}): EnforcementResult {
  const { state } = params
  const warnings: AdvisoryWarning[] = []

  // Find unwired features: in featuresWired but not in featuresVerified
  const unwired: string[] = []
  for (const feature of state.featuresWired) {
    if (!state.featuresVerified.has(feature)) {
      unwired.push(feature)
    }
  }

  if (unwired.length === 0) {
    return { blocked: false, warnings }
  }

  const featureList = unwired.join(', ')
  const msg =
    `Law 4: Call-graph reachability — ${unwired.length} feature(s) ` +
    `wired but not verified for callers: [${featureList}]. ` +
    `Run code_search or grep for production entry points.`

  warnings.push({
    law: 4,
    severity: 'warning',
    message: msg,
  })

  // FID-2026-0823-007: immutable law — blocks in every mode.
  return {
    blocked: true,
    reason: msg,
    warnings,
  }
}
