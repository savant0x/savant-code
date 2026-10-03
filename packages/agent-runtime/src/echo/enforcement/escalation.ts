/**
 * @module echo/enforcement/escalation
 *
 * FID-2026-1001-003 step 4: repeat-block escalation (N=3) for the Law 3
 * pre-write blocks. A hard block repeated identically is not progress: the
 * response must escalate from block to TURN TERMINATION ("notifies but does
 * not compel" is the pattern this FID exists to end).
 *
 * - Counter keyed `(law, tool, canonical targetPath)`, tracked SEPARATELY
 *   from the steering budget (`steeredKeys`/`steeringPerLaw`) so advisory
 *   dedupe can never suppress escalation.
 * - N=3, not 2: a legitimate multi-file batch produces a different key per
 *   file and never escalates.
 * - Reset by an intervening COMPLIANT READ (any law) or, for law 3, a
 *   verification-shaped command — the same `detectsVerificationCommand`
 *   predicate the credit path uses (Law 13).
 * - The escalated response is mechanical, not textual:
 *   `state.turnTerminationArmed` is consumed once by
 *   `run-agent-step/loop/boundary-gates.ts → applyLawEscalationTermination`,
 *   which forces the turn to end at that step's boundary.
 */

import { detectsVerificationCommand } from '../../util/echo-compliance'
import { canonicalizePath } from '../path-canonicalization'
import { terminalCommandCandidates } from './helpers'

import type {
  AdvisoryWarning,
  EnforcementResult,
  EnforcementState,
} from '../types'

/** Blocks after which the response escalates (FID-2026-1001-003 step 4). */
export const LAW_BLOCK_ESCALATION_THRESHOLD = 3

function buildBlockKey(params: {
  law: number
  toolName: string
  targetPath: string | undefined
}): string {
  const target = params.targetPath ? canonicalizePath(params.targetPath) : '-'
  return `${params.law}|${params.toolName}|${target}`
}

/**
 * Record one hard block of this key and return the blocking result:
 * identical reason, plus — at the Nth identical block — the escalation
 * notice, and beyond it the turn-termination arming.
 */
export function recordLawBlock(params: {
  state: EnforcementState
  law: number
  toolName: string
  targetPath: string | undefined
  reason: string
  /** Advisories accumulated by earlier gates; preserved on the block. */
  warnings?: AdvisoryWarning[]
}): EnforcementResult {
  const key = buildBlockKey(params)
  const count = (params.state.blockStrikes.get(key) ?? 0) + 1
  params.state.blockStrikes.set(key, count)
  let reason = params.reason
  if (count === LAW_BLOCK_ESCALATION_THRESHOLD) {
    reason +=
      ' (escalation: a further identical attempt terminates the turn — ' +
      'FID-2026-1001-003 step 4)'
  }
  const terminateTurn = count > LAW_BLOCK_ESCALATION_THRESHOLD
  if (terminateTurn) {
    // The "next repeat": the harder response. The block itself still stands
    // (the command never ran); the turn ends at this step's boundary.
    params.state.turnTerminationArmed = true
    reason += ' (escalated: turn terminated)'
  }
  return {
    blocked: true,
    reason,
    warnings: params.warnings ?? [],
    terminateTurn,
  }
}

/**
 * An intervening COMPLIANT call resets the ladder: any tracked read (all
 * laws), or a verification-shaped terminal command (law 3 — the escape
 * clause means the run WAS the verification the blocks asked for).
 */
export function noteCompliantIntervening(params: {
  state: EnforcementState
  toolName: string
  input: Record<string, unknown>
}): void {
  if (params.toolName === 'read_files' || params.toolName === 'read_subtree') {
    params.state.blockStrikes.clear()
    params.state.turnTerminationArmed = false
    return
  }
  if (
    params.toolName === 'run_terminal_command' ||
    params.toolName === 'run_readonly_command'
  ) {
    const verification = terminalCommandCandidates(params.input).some(
      detectsVerificationCommand,
    )
    if (verification) {
      for (const key of [...params.state.blockStrikes.keys()]) {
        if (key.startsWith('3|')) params.state.blockStrikes.delete(key)
      }
      params.state.turnTerminationArmed = false
    }
  }
}

/**
 * Consume the armed termination (boundary gate): true at most once per
 * arming, so a terminated turn cannot re-terminate its successor spuriously.
 */
export function consumeTurnTermination(state: EnforcementState): boolean {
  if (!state.turnTerminationArmed) return false
  state.turnTerminationArmed = false
  return true
}
