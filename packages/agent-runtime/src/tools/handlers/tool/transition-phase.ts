import type { CodebuffToolHandlerFunction } from '../handler-function-type'
import type {
  CodebuffToolCall,
  CodebuffToolOutput,
} from '@codebuff/common/tools/list'
import type { Logger } from '@codebuff/common/types/contracts/logger'
import type { FsmPhase } from '@codebuff/common/types/session-state'

const VALID_TRANSITIONS: Record<string, string[]> = {
  idle: ['red'],
  red: ['green'],
  green: ['audit'],
  audit: ['self_correct', 'complete'],
  self_correct: ['green'],
  complete: ['idle'],
}

export const handleTransitionPhase = (async (params: {
  previousToolCallFinished: Promise<any>
  toolCall: CodebuffToolCall<'transition_phase'>
  logger: Logger
  agentState: { fsmPhase?: FsmPhase }
}): Promise<{ output: CodebuffToolOutput<'transition_phase'> }> => {
  const { toolCall, logger, agentState } = params
  const { phase, reason } = toolCall.input

  const currentPhase = agentState.fsmPhase ?? 'idle'
  const allowed = VALID_TRANSITIONS[currentPhase] ?? []
  const isValid = allowed.includes(phase)

  logger.debug({ phase, reason, currentPhase, isValid }, 'FSM transition')

  if (!isValid) {
    return {
      output: [{
        type: 'json',
        value: {
          message: `INVALID FSM transition: ${currentPhase} → ${phase}. Allowed: ${allowed.join(', ')}. Reason: ${reason}`,
        },
      }],
    }
  }

  agentState.fsmPhase = phase as FsmPhase

  return {
    output: [{
      type: 'json',
      value: {
        message: `FSM transition: ${currentPhase} → ${phase}. ${reason}`,
      },
    }],
  }
}) satisfies CodebuffToolHandlerFunction<'transition_phase'>
