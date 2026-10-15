// FID-2026-0819-005 Loop 164: per-step tool-execution state initialization,
// extracted from runProgrammaticStep (pure factory — no side effects beyond
// the cloneDeep of the agent context).
import { cloneDeep } from 'lodash'

import type { FileProcessingState } from '../tools/handlers/tool/write-file'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'
import type { AgentState } from '@savant-code/common/types/session-state'

export function initToolExecutionState(agentState: AgentState): {
  toolCalls: SavantCodeToolCall[]
  toolResults: ToolMessage[]
  fileProcessingState: FileProcessingState
  agentContext: AgentState['agentContext']
} {
  return {
    toolCalls: [],
    toolResults: [],
    fileProcessingState: {
      promisesByPath: {},
      allPromises: [],
      fileChangeErrors: [],
      fileChanges: [],
      firstFileProcessed: false,
    },
    agentContext: cloneDeep(agentState.agentContext),
  }
}
