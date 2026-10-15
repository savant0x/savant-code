// Shared type surface for the spawn_agents tool handler, split from
// spawn-agents.ts (FID-2026-0819-005 Loop 270: the handler and its
// per-child orchestration both need this parameterization, and a shared
// module keeps the two under the 300-line ceiling without duplication).

import type {
  validateAndGetAgentTemplate,
  executeSubagent,
} from './spawn-agent-utils'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ToolSet } from 'ai'

export type SendSubagentChunk = (data: {
  userInputId: string
  agentId: string
  agentType: string
  chunk: string
  prompt?: string
  forwardToPrompt?: boolean
}) => void

export type SpawnAgentsToolName = 'spawn_agents'

/** Full parameter surface of the spawn_agents tool handler. */
export type SpawnAgentsParams = {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<SpawnAgentsToolName>

  agentState: AgentState
  agentTemplate: AgentTemplate
  fingerprintId: string
  localAgentTemplates: Record<string, AgentTemplate>
  logger: Logger
  system: string
  tools?: ToolSet
  userId: string | undefined
  userInputId: string
  sendSubagentChunk: SendSubagentChunk
  writeToClient: (chunk: string | PrintModeEvent) => void
} & ParamsExcluding<
  typeof validateAndGetAgentTemplate,
  'agentTypeStr' | 'parentAgentTemplate'
> &
  ParamsExcluding<
    typeof executeSubagent,
    | 'userInputId'
    | 'prompt'
    | 'spawnParams'
    | 'agentTemplate'
    | 'parentAgentState'
    | 'agentState'
    | 'fingerprintId'
    | 'isOnlyChild'
    | 'parentSystemPrompt'
    | 'parentTools'
    | 'onResponseChunk'
    | 'propagation'
  >

/** Deps for one child-agent run, sliced from the handler params. */
export type RunSingleSubagentDeps = {
  params: SpawnAgentsParams
  parentAgentState: AgentState
  parentAgentTemplate: AgentTemplate
  fingerprintId: string
  parentSystemPrompt: string
  parentTools: ToolSet
  userInputId: string
  sendSubagentChunk: SendSubagentChunk
  writeToClient: (chunk: string | PrintModeEvent) => void
  isOnlyChild: boolean
  agentTypeStr: string
  prompt: string | undefined
  spawnParams: Record<string, JSONValue> | undefined
}

/** The raw per-child outcome as produced by executeSubagent. */
export type ExecuteSubagentResult = Awaited<ReturnType<typeof executeSubagent>>
