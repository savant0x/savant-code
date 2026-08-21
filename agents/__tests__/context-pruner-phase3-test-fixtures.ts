import { createContextPrunerHandleSteps } from '../context-pruner/handle-steps'

import type { AgentState, ToolCall } from '../types/agent-definition'
import type { JSONValue, Message } from '../types/util-types'

export function textMessage(
  role: Message['role'],
  text: string,
  tags?: string[],
): Message {
  return {
    role,
    content: [{ type: 'text', text }],
    ...(tags ? { tags } : {}),
  } as Message
}

export function userMessage(text: string, tags?: string[]): Message {
  return textMessage('user', text, tags)
}

export function assistantMessage(text: string): Message {
  return textMessage('assistant', text)
}

export function toolMessage(toolName: string, value: JSONValue): Message {
  return {
    role: 'tool',
    toolName,
    toolCallId: `tc-${toolName}-${Math.random().toString(36).slice(2, 8)}`,
    content: [{ type: 'json', value }],
  } as Message
}

export function makeAgentState(messageHistory: Message[]): AgentState {
  return {
    agentId: 'context-pruner',
    messageHistory,
    contextTokenCount: 0,
  } as unknown as AgentState
}

export async function runPruner(
  messageHistory: Message[],
  params: Record<string, JSONValue> = {},
): Promise<{ toolCall?: ToolCall<'set_messages'>; messages?: Message[] }> {
  const handleSteps = createContextPrunerHandleSteps()
  const agentState = makeAgentState(messageHistory)
  const logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  } as Parameters<typeof handleSteps>[0]['logger']

  const generator = handleSteps({
    agentState,
    params,
    logger,
  } as never)

  let lastToolCall: ToolCall<'set_messages'> | undefined
  let result = generator.next()
  while (!result.done) {
    const value = result.value
    if (
      value &&
      value !== 'STEP' &&
      value !== 'STEP_ALL' &&
      'toolName' in value
    ) {
      lastToolCall = value as ToolCall<'set_messages'>
    }
    result = generator.next({
      agentState,
      toolResult: [],
      stepsComplete: false,
      nResponses: [],
    })
  }
  return { toolCall: lastToolCall, messages: lastToolCall?.input?.messages }
}

export function getText(m: Message): string {
  if (typeof m.content === 'string') return m.content
  return m.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
}
