import type { JSONValue, Message } from '../types/util-types'

export function userMsg(text: string, tags?: string[]): Message {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
    ...(tags ? { tags } : {}),
  }
}

export function assistantMsg(
  text: string,
  toolCalls: Array<{ toolName: string; input: Record<string, JSONValue> }> = [],
): Message {
  return {
    role: 'assistant',
    content: [
      ...(text ? [{ type: 'text' as const, text }] : []),
      ...toolCalls.map((tc) => ({
        type: 'tool-call' as const,
        toolCallId: 'tc-' + tc.toolName,
        toolName: tc.toolName,
        input: tc.input,
      })),
    ],
  }
}

export function toolMsg(toolName: string, value: JSONValue): Message {
  return {
    role: 'tool',
    toolName,
    toolCallId: 'tc-' + toolName,
    content: [{ type: 'json', value }],
  }
}
