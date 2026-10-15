// FID-2026-0819-005 Loop 141: pruner context-preparation phase, extracted
// from main.ts (STEP 0 tag-strip + prompt-cache-miss probe — pure, no
// yields). Registered in handle-steps.ts embeddedHelpers so the serialized
// generator scope resolves it. See main.ts for the orchestration contract.

import type { AgentState } from '../types/agent-definition'
import type { JSONValue, Message } from '../types/util-types'

export type PreparedPruneContext = {
  currentMessages: Message[]
  cacheWillMiss: boolean
  cacheGapMs: number | null
}

export function preparePruneContext(params: {
  agentState: AgentState
  params: Record<string, JSONValue> | undefined
  cacheExpiryMs: number
}): PreparedPruneContext {
  const { agentState, params: spawnParams, cacheExpiryMs } = params
  const messages = agentState.messageHistory

  // STEP 0: Always remove the last INSTRUCTIONS_PROMPT and SUBAGENT_SPAWN
  // (these are inserted for the context-pruner subagent itself)
  let currentMessages = [...messages]
  const lastInstructionsPromptIndex = currentMessages.findLastIndex((message) =>
    message.tags?.includes('INSTRUCTIONS_PROMPT'),
  )
  if (lastInstructionsPromptIndex !== -1) {
    currentMessages.splice(lastInstructionsPromptIndex, 1)
  }
  const lastSubagentSpawnIndex = currentMessages.findLastIndex((message) =>
    message.tags?.includes('SUBAGENT_SPAWN'),
  )
  if (lastSubagentSpawnIndex !== -1) {
    currentMessages.splice(lastSubagentSpawnIndex, 1)
  }

  // Also remove the params USER_PROMPT if params were provided to this agent
  // (this is the message like <user_message>{"cacheExpiryMs": 600000}</user_message>)
  if (spawnParams && Object.keys(spawnParams).length > 0) {
    const lastUserPromptIndex = currentMessages.findLastIndex((message) =>
      message.tags?.includes('USER_PROMPT'),
    )
    if (lastUserPromptIndex !== -1) {
      currentMessages.splice(lastUserPromptIndex, 1)
    }
  }

  // Check for prompt cache miss (>5 min gap before the USER_PROMPT message)
  // The USER_PROMPT is the actual user message; INSTRUCTIONS_PROMPT comes after it
  // We need to find the USER_PROMPT and check the gap between it and the last assistant message
  let cacheWillMiss = false
  let cacheGapMs: number | null = null
  const userPromptIndex = currentMessages.findLastIndex((message) =>
    message.tags?.includes('USER_PROMPT'),
  )
  if (userPromptIndex > 0) {
    const userPromptMsg = currentMessages[userPromptIndex]
    // Find the last assistant message before USER_PROMPT (tool messages don't have sentAt)
    let lastAssistantMsg: Message | undefined
    for (let i = userPromptIndex - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'assistant') {
        lastAssistantMsg = currentMessages[i]
        break
      }
    }
    if (
      userPromptMsg !== undefined &&
      typeof userPromptMsg.sentAt === 'number' &&
      lastAssistantMsg !== undefined &&
      typeof lastAssistantMsg.sentAt === 'number'
    ) {
      const gap = userPromptMsg.sentAt - lastAssistantMsg.sentAt
      cacheGapMs = gap
      cacheWillMiss = gap > cacheExpiryMs
    }
  }
  return { currentMessages, cacheWillMiss, cacheGapMs }
}
