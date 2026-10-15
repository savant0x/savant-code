import {
  appendToolToAgentBlock,
  closeNativeReasoningBlock,
  closeNativeReasoningInAgent,
  markAgentComplete,
} from '../block-operations'
import { shouldHideAgent } from '../constants'
import {
  createAgentBlock,
  findAgentTypeById,
  nestBlockUnderParent,
} from '../message-block-helpers'
import {
  findMatchingSpawnAgent,
  resolveSpawnAgentToReal,
} from '../spawn-agent-matcher'
import {
  isHiddenToolName,
  isJSONValueRecord,
  updateStreamingAgents,
} from './guards'

import type { EventHandlerState } from './types'
import type { ContentBlock, ToolContentBlock } from '../../types/chat'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  PrintModeSubagentFinish,
  PrintModeSubagentStart,
  PrintModeToolCall,
} from '@savant-code/common/types/print-mode'
import type { ToolName } from '@savant-code/sdk'

export const handleSubagentStart = (
  state: EventHandlerState,
  event: PrintModeSubagentStart,
) => {
  if (shouldHideAgent(event.agentType)) {
    return
  }
  state.subagents.addActiveSubagent(event.agentId)
  // Wire sidebar data: track agent start
  if (state.onSubagentStart) {
    state.onSubagentStart(event.agentId, event.displayName || event.agentType)
  }
  const spawnAgentMatch = findMatchingSpawnAgent(
    state.streaming.streamRefs.state.spawnAgentsMap,
    event.agentType || '',
  )
  if (spawnAgentMatch) {
    state.message.updater.updateAiMessageBlocks((blocks) =>
      resolveSpawnAgentToReal({
        blocks,
        match: spawnAgentMatch,
        realAgentId: event.agentId,
        realAgentType: event.agentType,
        parentAgentId: event.parentAgentId,
        params: event.params,
        prompt: event.prompt,
      }),
    )
    updateStreamingAgents(state, {
      remove: spawnAgentMatch.tempId,
      add: event.agentId,
    })
    state.streaming.streamRefs.setters.removeSpawnAgentInfo(
      spawnAgentMatch.tempId,
    )
    return
  }
  state.logger.info(
    {
      agentId: event.agentId,
      agentType: event.agentType,
      parentAgentId: event.parentAgentId || 'ROOT',
    },
    'Creating new agent block (no spawn_agents match)',
  )
  state.message.updater.updateAiMessageBlocks((blocks) => {
    // Look up the parent agent's type if there's a parent agent ID
    const parentAgentType = event.parentAgentId
      ? findAgentTypeById(blocks, event.parentAgentId)
      : undefined
    const newAgentBlock = createAgentBlock({
      agentId: event.agentId,
      agentType: event.agentType || '',
      prompt: event.prompt,
      params: event.params,
      parentAgentType,
    })
    if (event.parentAgentId) {
      const { blocks: nestedBlocks, parentFound } = nestBlockUnderParent(
        blocks,
        event.parentAgentId,
        newAgentBlock,
      )
      if (parentFound) {
        return nestedBlocks
      }
    }
    return [...blocks, newAgentBlock]
  })
  updateStreamingAgents(state, { add: event.agentId })
}
export const handleSubagentFinish = (
  state: EventHandlerState,
  event: PrintModeSubagentFinish,
) => {
  if (shouldHideAgent(event.agentType)) {
    return
  }
  state.streaming.streamRefs.setters.removeAgentAccumulator(event.agentId)
  state.subagents.removeActiveSubagent(event.agentId)
  // Wire sidebar data: track agent finish
  if (state.onSubagentFinish) {
    state.onSubagentFinish(event.agentId)
  }
  state.message.updater.updateAiMessageBlocks((blocks) =>
    markAgentComplete(blocks, event.agentId),
  )
  updateStreamingAgents(state, { remove: event.agentId })
}
const handleSpawnAgentsToolCall = (
  state: EventHandlerState,
  event: PrintModeToolCall,
) => {
  const rawAgents = event.input?.agents
  const agents: Record<string, JSONValue>[] = Array.isArray(rawAgents)
    ? rawAgents.filter(isJSONValueRecord)
    : []
  agents.forEach((agent, index) => {
    const tempAgentId = `${event.toolCallId}-${index}`
    const agentType =
      typeof agent.agent_type === 'string' ? agent.agent_type : 'unknown'
    state.streaming.streamRefs.setters.setSpawnAgentInfo(tempAgentId, {
      index,
      agentType,
    })
  })
  state.message.updater.updateAiMessageBlocks((blocks) => {
    // Look up the parent agent's type if there's a parent agent ID
    const parentAgentType = event.agentId
      ? findAgentTypeById(blocks, event.agentId)
      : undefined
    const newAgentBlocks: ContentBlock[] = agents
      .map((agent, originalIndex) => ({ agent, originalIndex }))
      .filter(({ agent }) => !shouldHideAgent(String(agent.agent_type || '')))
      .map(({ agent, originalIndex }) =>
        createAgentBlock({
          agentId: `${event.toolCallId}-${originalIndex}`,
          agentType: String(agent.agent_type || ''),
          prompt: typeof agent.prompt === 'string' ? agent.prompt : undefined,
          params: isJSONValueRecord(agent.params) ? agent.params : undefined,
          spawnToolCallId: event.toolCallId,
          spawnIndex: originalIndex,
          parentAgentType,
        }),
      )
    return [...blocks, ...newAgentBlocks]
  })
  agents.forEach((_, index) => {
    updateStreamingAgents(state, { add: `${event.toolCallId}-${index}` })
  })
}
const handleRegularToolCall = (
  state: EventHandlerState,
  event: PrintModeToolCall,
) => {
  const newToolBlock: ToolContentBlock = {
    type: 'tool',
    toolCallId: event.toolCallId,
    toolName: event.toolName as ToolName,
    input: event.input,
    agentId: event.agentId,
    ...(event.includeToolCall !== undefined && {
      includeToolCall: event.includeToolCall,
    }),
  }
  if (event.parentAgentId && event.agentId) {
    state.message.updater.updateAiMessageBlocks((blocks) =>
      appendToolToAgentBlock(blocks, event.agentId as string, newToolBlock),
    )
    return
  }
  state.message.updater.updateAiMessageBlocks((blocks) => [
    ...blocks,
    newToolBlock,
  ])
}
export const handleToolCall = (
  state: EventHandlerState,
  event: PrintModeToolCall,
) => {
  // Close any open native reasoning blocks when a tool call happens
  // (agent may go directly from thinking to tool calls without emitting text)
  // This must happen BEFORE any early returns (spawn_agents, hidden tools)
  if (event.parentAgentId && event.agentId) {
    // For agent tool calls, close reasoning in that specific agent
    state.message.updater.updateAiMessageBlocks((blocks) =>
      closeNativeReasoningInAgent(blocks, event.agentId as string),
    )
  } else if (!event.parentAgentId) {
    // For root tool calls, close reasoning at root level
    state.message.updater.updateAiMessageBlocks(closeNativeReasoningBlock)
  }
  // Wire sidebar data: track tool call
  if (state.onToolCall && !isHiddenToolName(event.toolName)) {
    state.onToolCall(event.toolName)
  }
  if (event.toolName === 'spawn_agents' && event.input?.agents) {
    handleSpawnAgentsToolCall(state, event)
    return
  }
  if (isHiddenToolName(event.toolName)) {
    return
  }
  handleRegularToolCall(state, event)
  updateStreamingAgents(state, { add: event.toolCallId })
}
