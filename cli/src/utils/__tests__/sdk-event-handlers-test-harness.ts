// Shared fixtures for the sdk-event-handlers test family.
// Sibling of the Loop-347 decomposition (suite files all import these).
import { describe, expect, test } from 'bun:test'

import { createAgentBlock } from '../message-block-helpers'
import { createMessageUpdater } from '../message-updater'
import {
  createEventHandler,
  createStreamChunkHandler,
} from '../sdk-event-handlers'

import type { StreamStatus } from '../../hooks/use-message-queue'
import type { ChatMessage } from '../../types/chat'
import type { AgentMode } from '../constants'
import type { EventHandlerState } from '../sdk-event-handlers'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'

// Re-exports so sibling suites keep the original import surface.
export { describe, expect, test }
export { createAgentBlock, createEventHandler, createStreamChunkHandler }

// Type for spawn agent info stored in the map
export interface SpawnAgentInfo {
  index: number
  agentType: string
}

// SDK event types for testing
export interface SubagentStartEvent {
  type: 'subagent_start'
  agentId: string
  agentType: string
  displayName: string
  onlyChild: boolean
  parentAgentId: string | undefined
  params: Record<string, JSONValue> | undefined
  prompt: string | undefined
}

export interface ToolResultEvent {
  type: 'tool_result'
  toolCallId: string
  toolName: string
  output: Array<{
    type: 'json'
    value: Array<{
      agentName: string
      value: any
    }>
  }>
}

export const createStreamRefs = (): {
  controller: EventHandlerState['streaming']['streamRefs']
  state: {
    rootStreamBuffer: string
    agentStreamAccumulators: Map<string, string>
    rootStreamSeen: boolean
    planExtracted: boolean
    wasAbortedByUser: boolean
    spawnAgentsMap: Map<string, SpawnAgentInfo>
  }
} => {
  const state = {
    rootStreamBuffer: '',
    agentStreamAccumulators: new Map<string, string>(),
    rootStreamSeen: false,
    planExtracted: false,
    wasAbortedByUser: false,
    spawnAgentsMap: new Map<string, SpawnAgentInfo>(),
    // FID-2026-0718-010 (Q13): late-chunk guard flag, matches StreamState
    runCompleted: false,
  }

  const controller = {
    state,
    reset: () => {},
    setters: {
      setRootStreamBuffer: (value: string) => {
        state.rootStreamBuffer = value
      },
      appendRootStreamBuffer: (value: string) => {
        state.rootStreamBuffer += value
      },
      setAgentAccumulator: (agentId: string, value: string) => {
        state.agentStreamAccumulators.set(agentId, value)
      },
      removeAgentAccumulator: (agentId: string) => {
        state.agentStreamAccumulators.delete(agentId)
      },
      setRootStreamSeen: (value: boolean) => {
        state.rootStreamSeen = value
      },
      setPlanExtracted: (value: boolean) => {
        state.planExtracted = value
      },
      setWasAbortedByUser: (value: boolean) => {
        state.wasAbortedByUser = value
      },
      setSpawnAgentInfo: (agentId: string, info: SpawnAgentInfo) => {
        state.spawnAgentsMap.set(agentId, info)
      },
      removeSpawnAgentInfo: (agentId: string) => {
        state.spawnAgentsMap.delete(agentId)
      },
      // FID-2026-0718-010 (Q13)
      setRunCompleted: (value: boolean) => {
        state.runCompleted = value
      },
    },
  }

  return { controller, state }
}

export const createTestContext = (agentMode: AgentMode = 'HYBRID') => {
  let messages: ChatMessage[] = [
    {
      id: 'ai-1',
      variant: 'ai',
      content: '',
      blocks: [],
      timestamp: 'now',
    },
  ]
  let streamingAgents = new Set<string>()
  let streamStatus: StreamStatus | null = null
  let hasPlanResponse = false
  const streamRefs = createStreamRefs()

  const updater = createMessageUpdater(
    'ai-1',
    (fn: (msgs: ChatMessage[]) => ChatMessage[]) => {
      messages = fn(messages)
    },
  )

  const ctx: EventHandlerState = {
    streaming: {
      streamRefs: streamRefs.controller,
      setStreamingAgents: (fn: (prev: Set<string>) => Set<string>) => {
        streamingAgents = fn(streamingAgents)
      },
      setStreamStatus: (status: StreamStatus) => {
        streamStatus = status
      },
    },
    message: {
      aiMessageId: 'ai-1',
      updater,
      hasReceivedContentRef: { current: false },
    },
    subagents: {
      addActiveSubagent: () => {},
      removeActiveSubagent: () => {},
    },
    mode: {
      agentMode,
      setHasReceivedPlanResponse: (value: boolean) => {
        hasPlanResponse = value
      },
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as Logger,
    setIsRetrying: () => {},
  }

  return {
    ctx,
    getMessages: () => messages,
    getStreamingAgents: () => streamingAgents,
    getStreamStatus: () => streamStatus,
    getHasPlanResponse: () => hasPlanResponse,
    streamRefs,
  }
}
