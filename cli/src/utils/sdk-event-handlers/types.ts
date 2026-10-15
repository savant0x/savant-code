import type { StreamController } from '../../hooks/stream-state'
import type { StreamStatus } from '../../hooks/use-message-queue'
import type { AgentMode } from '../constants'
import type { MessageUpdater } from '../message-updater'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { MutableRefObject } from 'react'

export type SetStreamingAgentsFn = (
  updater: (prev: Set<string>) => Set<string>,
) => void
export type SetStreamStatusFn = (status: StreamStatus) => void
export type StreamChunkEvent =
  | string
  | {
      type: 'subagent_chunk'
      agentId: string
      agentType: string
      chunk: string
    }
  | {
      type: 'reasoning_chunk'
      agentId: string
      ancestorRunIds: string[]
      chunk: string
    }
export type StreamingState = {
  streamRefs: StreamController
  setStreamingAgents: SetStreamingAgentsFn
  setStreamStatus: SetStreamStatusFn
}
export type MessageState = {
  aiMessageId: string
  updater: MessageUpdater
  hasReceivedContentRef: MutableRefObject<boolean>
}
export type SubagentState = {
  addActiveSubagent: (id: string) => void
  removeActiveSubagent: (id: string) => void
}
export type ModeState = {
  agentMode: AgentMode
  setHasReceivedPlanResponse: (value: boolean) => void
}
export type EventHandlerState = {
  streaming: StreamingState
  message: MessageState
  subagents: SubagentState
  mode: ModeState
  logger: Logger
  setIsRetrying: (retrying: boolean) => void
  onTotalCost?: (cost: number) => void
  onToolCall?: (toolName: string) => void
  onSubagentStart?: (agentId: string, displayName: string) => void
  onSubagentFinish?: (agentId: string) => void
}
export type TextDelta = {
  type: 'text' | 'reasoning'
  text: string
}
