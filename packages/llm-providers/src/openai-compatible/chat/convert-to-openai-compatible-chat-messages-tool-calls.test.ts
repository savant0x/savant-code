// OpenAI-compatible chat message conversion — tool calls and tool results.
// Sibling of the Loop 323 decomposition.

import { describe, it, expect } from 'bun:test'

import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages'

describe('tool calls', () => {
  it('should stringify arguments to tool calls', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            input: { foo: 'bar123' },
            toolCallId: 'quux',
            toolName: 'thwomp',
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'quux',
            toolName: 'thwomp',
            output: { type: 'json', value: { oof: '321rab' } },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            type: 'function',
            id: 'quux',
            function: {
              name: 'thwomp',
              arguments: JSON.stringify({ foo: 'bar123' }),
            },
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify({ oof: '321rab' }),
        tool_call_id: 'quux',
      },
    ])
  })

  it('should handle text output type in tool results', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            input: { query: 'weather' },
            toolCallId: 'call-1',
            toolName: 'getWeather',
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            output: { type: 'text', value: 'It is sunny today' },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            type: 'function',
            id: 'call-1',
            function: {
              name: 'getWeather',
              arguments: JSON.stringify({ query: 'weather' }),
            },
          },
        ],
      },
      {
        role: 'tool',
        content: 'It is sunny today',
        tool_call_id: 'call-1',
      },
    ])
  })
})
