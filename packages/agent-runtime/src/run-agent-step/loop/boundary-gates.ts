import { userMessage } from '@savant-code/common/util/messages'

import { getOrCreateEnforcement } from '../../echo/enforcement'
import { buildUserMessageContent } from '../../util/messages'
import {
  isAutonomousContinuation,
  updatePostTerminalCounter,
  updateTurnEndBlockCounter,
} from '../post-terminal-breaker'

import type { LoopAgentStepsParams } from '../types'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { AgentState } from '@savant-code/common/types/session-state'

/** Dependencies for the boundary enforcement helpers (Loop 300: extracted
 *  verbatim from `loop-iteration.ts`). */
export type BoundaryGateDeps = {
  currentAgentState: AgentState
  logger: Logger
}

/**
 * FID-2026-0811-015: one shared turn-end evaluator is used by both
 * programmatic and LLM completion paths. It emits bounded corrective
 * context and keeps blocked turns inside the loop for self-correction.
 * FID-2026-0822-003: bounded blocking. After N consecutive blocked
 * turn-end verdicts the enforcement surrenders (logs + allows the end)
 * instead of injecting forever — unless the run is an autonomous
 * continuation (Auto Drive / active goal), where behavior is preserved
 * by explicit operator direction.
 */
export function applyTurnEndEnforcement(
  deps: BoundaryGateDeps,
  ending: boolean,
): boolean {
  const { currentAgentState, logger } = deps
  if (!ending || currentAgentState.parentId) return ending
  const enforcement = getOrCreateEnforcement(currentAgentState)
  const result = enforcement.evaluateTurnEnd()
  if (!result.blocked && !result.report) {
    currentAgentState.turnEndBlockCount = 0
    return ending
  }
  // FID-2026-0822-003: enforcement blocking must not outrun the
  // stepsRemaining backstop either.
  if (currentAgentState.stepsRemaining <= 0) {
    return ending
  }
  currentAgentState.messageHistory = [
    ...currentAgentState.messageHistory,
    userMessage({
      content: buildUserMessageContent(
        result.report || 'ECHO turn-end enforcement blocked completion.',
        undefined,
        undefined,
      ),
      tags: ['ECHO_COMPLIANCE'],
      keepDuringTruncation: true,
    }),
  ]
  if (result.blocked) {
    const verdict = updateTurnEndBlockCounter(
      currentAgentState.turnEndBlockCount ?? 0,
      { blocked: true },
    )
    currentAgentState.turnEndBlockCount = verdict.count
    if (verdict.surrender && !isAutonomousContinuation(currentAgentState)) {
      logger.warn(
        { blocks: verdict.count },
        'ECHO turn-end enforcement surrendered after repeated blocks',
      )
      currentAgentState.turnEndBlockCount = 0
      return ending
    }
    return false
  }
  return ending
}

/**
 * Steering: if the host fed user messages while this step ran, append them
 * now (the step's LLM call + tools have completed, so history is in a clean
 * state) and keep the turn going so the agent runs a second step that can
 * see (and act on) the new message.
 *
 * Returns the drained steering texts (empty = nothing was steered).
 */
export function applySteeringMessages(
  deps: BoundaryGateDeps,
  steered: string[],
): void {
  const { currentAgentState } = deps
  if (steered.length === 0) return
  currentAgentState.messageHistory = [
    ...currentAgentState.messageHistory,
    ...steered.map((text) =>
      userMessage({
        content: buildUserMessageContent(text, undefined, undefined),
        tags: ['USER_PROMPT'],
        keepDuringTruncation: true,
      }),
    ),
  ]
}

/**
 * FID-2026-0804-009: harness ECHO compliance — Law 3 (verify-after-write)
 * + mechanical Verifier-criteria flag + FID escalation, evaluated at each
 * step boundary (no-op mid-batch; only fires when the turn is ending).
 * Emits non-blocking compliance_warning receipts and, when violations
 * exist, injects corrective steering so the running agent self-corrects
 * (bounded by the tracker's steering budget — never loops forever).
 * MAIN-LOOP ONLY (code-review finding): subagent loops share the parent
 * run's tracker for RECORDING (tool-executor) but must never evaluate or
 * steer here — a Forge/basher subagent can't act on a Verifier-spawn
 * directive injected into its own message history. Programmatic-only
 * turns exit at the `if (shouldEndTurn) break` above before this block,
 * so handleSteps-driven runs intentionally never evaluate here.
 *
 * Returns the number of steering messages injected (0 = none).
 */
export function evaluateEchoComplianceAtBoundary(
  deps: BoundaryGateDeps,
  params: {
    loopParams: LoopAgentStepsParams
    stepNumber: number
    endingTurn: boolean
    stepsRemaining: number
  },
): number {
  const { currentAgentState, logger: _logger } = deps
  const { loopParams, stepNumber, endingTurn, stepsRemaining } = params
  const echoCompliance = currentAgentState.echoCompliance
  if (
    echoCompliance &&
    echoCompliance.mode !== 'off' &&
    !currentAgentState.parentId
  ) {
    const violations = echoCompliance.evaluateAtStepBoundary({
      stepNumber,
      endingTurn,
    })
    if (violations.length > 0) {
      for (const violation of violations) {
        loopParams.onResponseChunk({
          type: 'compliance_warning',
          ...violation,
        })
      }
      const steering = echoCompliance.takeSteeringMessages()
      // FID-2026-0822-003: synthetic steering must never outrun the
      // stepsRemaining backstop — once the step budget is spent, let the
      // turn end (Auto Drive keeps its own driver-level budgets).
      if (steering.length > 0 && stepsRemaining >= 1) {
        currentAgentState.messageHistory = [
          ...currentAgentState.messageHistory,
          ...steering.map((text) =>
            userMessage({
              content: buildUserMessageContent(text, undefined, undefined),
              tags: ['ECHO_COMPLIANCE'],
              keepDuringTruncation: true,
            }),
          ),
        ]
        return steering.length
      }
    }
  }
  return 0
}

/**
 * FID-2026-0819-005 Loop 300: composes the post-LLM-step boundary tail
 * (steering flush → ECHO compliance → post-terminal breaker) exactly as the
 * original `loop-iteration.ts` sequence did. Returns the final turn decision
 * and whether the post-terminal breaker tripped.
 */
export function applyStepBoundaryTail(
  deps: BoundaryGateDeps,
  params: {
    loopParams: LoopAgentStepsParams
    steered: string[]
    sawTerminalVerdict: boolean
    shouldEndTurn: boolean
    stepNumber: number
  },
): { shouldEndTurn: boolean; hardEnd: boolean } {
  const { loopParams, steered, sawTerminalVerdict, stepNumber } = params
  let shouldEndTurn = params.shouldEndTurn

  applySteeringMessages(deps, steered)
  if (steered.length > 0) {
    shouldEndTurn = false
  }

  const steeringInjected = evaluateEchoComplianceAtBoundary(deps, {
    loopParams,
    stepNumber,
    endingTurn: shouldEndTurn,
    stepsRemaining: deps.currentAgentState.stepsRemaining,
  })
  if (steeringInjected > 0) {
    shouldEndTurn = false
  }

  const genuineUserInput = steered.length > 0
  const post = applyPostTerminalBreaker(deps, {
    sawTerminalVerdict,
    shouldEndTurn,
    genuineUserInput,
    onResponseChunk: (chunk) => {
      loopParams.onResponseChunk(chunk)
    },
  })
  return {
    shouldEndTurn: post.hardEnd ? true : shouldEndTurn,
    hardEnd: post.hardEnd,
  }
}

/**
 * FID-2026-0822-003: post-terminal continuation breaker. A terminal
 * verdict overridden by synthetic inputs must not loop the turn forever.
 * Genuine operator input (steered user messages) resets; ordinary working
 * steps reset; Auto Drive / active-goal runs bypass entirely.
 *
 * Returns the updated counter and whether the breaker tripped.
 */
export function applyPostTerminalBreaker(
  deps: BoundaryGateDeps,
  params: {
    sawTerminalVerdict: boolean
    shouldEndTurn: boolean
    genuineUserInput: boolean
    onResponseChunk: (chunk: string) => void
  },
): { count: number; trip: boolean; hardEnd: boolean } {
  const { currentAgentState, logger } = deps
  const {
    sawTerminalVerdict,
    shouldEndTurn,
    genuineUserInput,
    onResponseChunk,
  } = params
  const postTerminal = updatePostTerminalCounter(
    currentAgentState.postTerminalContinuations ?? 0,
    {
      sawTerminalVerdict,
      shouldEndTurn,
      genuineUserInput,
    },
  )
  currentAgentState.postTerminalContinuations = postTerminal.count
  const hardEnd =
    postTerminal.trip && !isAutonomousContinuation(currentAgentState)
  if (hardEnd) {
    const notice =
      'Turn auto-ended: no operator input after repeated post-completion continuations.'
    logger.warn({ postTerminalContinuations: postTerminal.count }, notice)
    onResponseChunk(notice)
  }
  return { count: postTerminal.count, trip: postTerminal.trip, hardEnd }
}
