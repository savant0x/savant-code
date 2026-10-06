// FID-2026-1006-003 (quality-gate): the spawn_agent_inline handler's params
// contract, extracted verbatim from spawn-agent-inline.ts — a bulky, stable
// type contract reads on its own while the handler logic keeps changing.

import type { executeSubagent } from './spawn-agent-utils'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'
import type { ToolSet } from 'ai'

export type HandleSpawnAgentInlineParams = {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'spawn_agent_inline'>

  agentState: AgentState
  agentTemplate: AgentTemplate
  clientSessionId: string
  fileContext: ProjectFileContext
  fingerprintId: string
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  system: string
  tools: ToolSet
  userId: string | undefined
  userInputId: string
  writeToClient: (chunk: string | PrintModeEvent) => void
} & ParamsExcluding<
  typeof executeSubagent,
  | 'userInputId'
  | 'prompt'
  | 'spawnParams'
  | 'agentTemplate'
  | 'parentAgentState'
  | 'agentState'
  | 'parentSystemPrompt'
  | 'parentTools'
  | 'onResponseChunk'
  | 'clearUserPromptMessagesAfterResponse'
  | 'fingerprintId'
  | 'propagation'
>
