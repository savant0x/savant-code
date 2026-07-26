import { scanOpenFids } from '@savant-code/common/util/protocol-config'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { FsmPhase } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

const MAX_ITERATIONS = 10

const VALID_TRANSITIONS: Record<string, string[]> = {
  idle: ['red', 'green'],
  red: ['green', 'idle'],       // abort from red
  green: ['audit', 'idle'],      // abort from green
  audit: ['self_correct', 'complete', 'idle'],  // abort from audit
  self_correct: ['green', 'complete', 'idle'],  // fix & verify inline → complete; or loop back to green
  complete: ['idle'],
}

// NOTE: FSM phase and iterationCount are session-scoped (in-memory only).
// On restart/resume, phase resets to 'idle' and iterationCount resets to 0.
// This is by design — the Perfection Loop is a session-level workflow.
export const handleTransitionPhase = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'transition_phase'>
  logger: Logger
  agentState: { fsmPhase?: FsmPhase; iterationCount?: number }
  fileContext: ProjectFileContext
}): Promise<{ output: SavantCodeToolOutput<'transition_phase'> }> => {
  const { toolCall, logger, agentState, fileContext } = params
  const { phase, reason } = toolCall.input

  const currentPhase = agentState.fsmPhase ?? 'idle'
  const allowed = VALID_TRANSITIONS[currentPhase] ?? []
  const isValid = allowed.includes(phase)

  if (!isValid) {
    logger.warn(
      { phase, reason, currentPhase, allowed },
      'FSM transition REJECTED',
    )
    return {
      output: [
        {
          type: 'json',
          value: {
            message: `INVALID FSM transition: ${currentPhase} → ${phase}. Allowed: ${allowed.join(', ')}. Reason: ${reason}`,
          },
        },
      ],
    }
  }

  // FID-Bound Enforcement: block any entry to 'green' when no open FIDs exist.
  // Dev mode bypass: when devMode is active, allow GREEN transitions without
  // an open FID. This enables Hybrid Mode (direct writes for simple tasks)
  // and mirrors the isDevOverride pattern in tool-executor.ts for write tools.
  if (phase === 'green' && currentPhase !== 'idle' && fileContext.devMode !== true) {
    const openFids = scanOpenFids(fileContext.cwd)
    if (openFids.length === 0) {
      logger.warn(
        { phase, currentPhase, openFids: 0 },
        'FSM transition REJECTED — no open FIDs',
      )
      return {
        output: [
          {
            type: 'json',
            value: {
              message: `Cannot transition to GREEN: no open FID files found in dev/fids/. Create a FID before writing code (ECHO Law 2: FID-Bound Execution).`,
            },
          },
        ],
      }
    }
  }

  // Circuit Breaker: hard stop at MAX_ITERATIONS
  const iterationCount = agentState.iterationCount ?? 0
  if (phase === 'green' && iterationCount >= MAX_ITERATIONS) {
    logger.warn(
      { iterationCount, maxIterations: MAX_ITERATIONS, currentPhase },
      'FSM transition REJECTED — iteration limit reached',
    )
    return {
      output: [
        {
          type: 'json',
          value: {
            message: `Hard stop: maximum ${MAX_ITERATIONS} iterations reached (current: ${iterationCount}). Transition to COMPLETE to wrap up this FID, or escalate for review. Do not attempt further self-correction.`,
          },
        },
      ],
    }
  }

  // Valid transition — apply state changes
  agentState.fsmPhase = phase as FsmPhase

  // Increment iteration count on self_correct→green (looping back)
  if (currentPhase === 'self_correct' && phase === 'green') {
    agentState.iterationCount = iterationCount + 1
  }

  // Reset iteration count on completion (audit→complete or self_correct→complete)
  if (phase === 'complete') {
    agentState.iterationCount = 0
  }

  // Reset iteration count on any →idle (abort)
  if (phase === 'idle') {
    agentState.iterationCount = 0
  }

  logger.debug(
    {
      transition: `${currentPhase} → ${phase}`,
      reason,
      iterationCount: agentState.iterationCount,
    },
    'FSM transition OK',
  )

  return {
    output: [
      {
        type: 'json',
        value: {
          message: `FSM transition: ${currentPhase} → ${phase}. ${reason}`,
          phase,
        },
      },
    ],
  }
}) satisfies SavantCodeToolHandlerFunction<'transition_phase'>
