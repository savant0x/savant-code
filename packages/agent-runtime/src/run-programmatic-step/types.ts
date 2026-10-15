import type { ExecuteToolCallParams } from '../tools/tool-executor'
import type {
  AgentTemplate,
  StepGenerator,
} from '@savant-code/common/types/agent-template'
import type {
  HandleStepsLogChunkFn,
  SendActionFn,
} from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'

/** Parameters for runProgrammaticStep. */
export type RunProgrammaticStepParams = {
  agentState: AgentState
  clientSessionId: string
  fingerprintId: string
  handleStepsLogChunk: HandleStepsLogChunkFn
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  nResponses?: string[]
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  prompt: string | undefined
  repoId: string | undefined
  repoUrl: string | undefined
  stepNumber: number
  stepsComplete: boolean
  template: AgentTemplate
  toolCallParams:
    Record<string, string | number | boolean | null | undefined> | undefined
  sendAction: SendActionFn
  system: string | undefined
  userId: string | undefined
  userInputId: string
} & Omit<
  ExecuteToolCallParams,
  | 'toolName'
  | 'input'
  | 'autoInsertEndStepParam'
  | 'excludeToolFromMessageHistory'
  | 'agentContext'
  | 'agentStepId'
  | 'agentTemplate'
  | 'fullResponse'
  | 'previousToolCallFinished'
  | 'fileProcessingState'
  | 'toolCallId'
  | 'toolCalls'
  | 'toolCallsToAddToMessageHistory'
  | 'toolResults'
  | 'toolResultsToAddToMessageHistory'
>

/** Result from runProgrammaticStep. */
export type RunProgrammaticStepResult = {
  agentState: AgentState
  endTurn: boolean
  stepNumber: number
  generateN?: number
}

export type { StepGenerator }
