import {
  readProtocolConfig,
  scanOpenFids,
} from '@savant-code/common/util/protocol-config'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { FsmPhase } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

// Circuit-breaker limit, driven by `perfection_loop.max_iterations` in
// protocol.config.yaml (default 10). Cached per cwd so the YAML is not re-read
// on every transition while test processes that use multiple cwds stay
// correct (FID-2026-0803-001 ECHO-3).
const maxIterationsCache = new Map<string, number>()
function getMaxIterations(cwd: string): number {
  let cached = maxIterationsCache.get(cwd)
  if (cached === undefined) {
    cached = readProtocolConfig(cwd).maxIterations
    maxIterationsCache.set(cwd, cached)
  }
  return cached
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  idle: ['red', 'green'],
  red: ['green', 'idle'], // abort from red
  green: ['audit', 'idle'], // abort from green
  audit: ['self_correct', 'complete', 'idle'], // abort from audit
  self_correct: ['green', 'complete', 'idle'], // fix & verify inline → complete; or loop back to green
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
  const MAX_ITERATIONS = getMaxIterations(fileContext.cwd)
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

  // FID-Bound Enforcement: block entry to 'green' from a loop phase (red/green/
  // audit/self_correct) when no FID files are present in dev/fids/. This is a
  // PRESENCE check, not a status/convergence check (FID-2026-0803-001 ECHO-7).
  // `idle → green` intentionally bypasses it — Hybrid Mode allows direct
  // orchestrator writes for simple tasks without a FID (ECHO-4); devMode also
  // bypasses for CLI-dev scenarios.
  if (
    phase === 'green' &&
    currentPhase !== 'idle' &&
    fileContext.devMode !== true
  ) {
    const openFids = scanOpenFids(fileContext.cwd)
    if (openFids.length === 0) {
      logger.warn(
        { phase, currentPhase, openFids: 0 },
        'FSM transition REJECTED — no FID files present',
      )
      return {
        output: [
          {
            type: 'json',
            value: {
              message: `Cannot transition to GREEN: no FID files present in dev/fids/. FID-bound execution requires an open FID before writing code (Hybrid Mode direct writes use the idle → green path for simple tasks).`,
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
