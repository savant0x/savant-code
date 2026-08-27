/**
 * FID-2026-0822-003: post-terminal continuation controls.
 *
 * Live incidents showed turns that complete cleanly (exempt-only tool calls
 * or plain text) being re-invoked indefinitely by synthetic inputs — the
 * end-of-turn system reminder re-arms the very turn it was supposed to close,
 * and uncapped ECHO turn-end enforcement can block completion forever. These
 * pure decision helpers bound both mechanisms WITHOUT touching legitimate
 * work:
 *
 *  - Post-terminal breaker: counts consecutive iterations in which a terminal
 *    verdict was overridden. Ordinary working steps (no terminal verdict) and
 *    genuine operator input reset the counter, so long agentic turns are
 *    never interrupted. At POST_TERMINAL_CONTINUATION_LIMIT the caller ends
 *    the turn.
 *  - Enforcement surrender: after TURN_END_ENFORCEMENT_SURRENDER_LIMIT
 *    consecutive blocked turn-end verdicts, the caller lets the turn end and
 *    logs the surrender instead of injecting forever.
 *
 * AUTONOMY CARVE-OUT (operator-mandated): both mechanisms are bypassed for
 * autonomous runs — Auto Drive (drive record active/paused/blocked) and
 * active goal-engine continuations. Long turns are legitimate product
 * behavior there and must never be auto-ended.
 */

export const POST_TERMINAL_CONTINUATION_LIMIT = 6
export const TURN_END_ENFORCEMENT_SURRENDER_LIMIT = 3

export type AutonomousContinuationState = {
  drive?: { status?: string } | null
  goal?: { status?: string } | null
}

/**
 * True only for runs whose continuation is operator-sanctioned autonomy:
 * an active/driving/paused/blocked Auto Drive record or an active goal.
 * Planning/awaiting_confirmation drives are still interactive turns.
 */
export function isAutonomousContinuation(
  state: AutonomousContinuationState,
): boolean {
  if (state.goal?.status === 'active') return true
  const driveStatus = state.drive?.status
  return (
    driveStatus === 'active' ||
    driveStatus === 'paused' ||
    driveStatus === 'blocked'
  )
}

export type PostTerminalInputs = {
  /** A raw terminal verdict was produced this iteration (pre-override). */
  sawTerminalVerdict: boolean
  /** Final shouldEndTurn for the iteration (post-override). */
  shouldEndTurn: boolean
  /** Genuine operator input arrived (steered user messages) — resets. */
  genuineUserInput: boolean
}

export type PostTerminalVerdict = {
  count: number
  trip: boolean
}

export function updatePostTerminalCounter(
  prev: number,
  inputs: PostTerminalInputs,
): PostTerminalVerdict {
  let count: number
  if (inputs.shouldEndTurn || inputs.genuineUserInput) {
    count = 0
  } else if (inputs.sawTerminalVerdict) {
    count = prev + 1
  } else {
    count = 0
  }
  return { count, trip: count >= POST_TERMINAL_CONTINUATION_LIMIT }
}

export type TurnEndBlockVerdict = {
  count: number
  surrender: boolean
}

export function updateTurnEndBlockCounter(
  prev: number,
  inputs: { blocked: boolean },
): TurnEndBlockVerdict {
  const count = inputs.blocked ? prev + 1 : 0
  return {
    count,
    surrender: count >= TURN_END_ENFORCEMENT_SURRENDER_LIMIT,
  }
}
