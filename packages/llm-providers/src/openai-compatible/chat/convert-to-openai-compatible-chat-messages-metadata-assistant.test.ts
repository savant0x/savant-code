// OpenAI-compatible chat message conversion — provider metadata on
// assistant messages, tool calls, and tool results.
// Sibling of the Loop 323 decomposition (basic metadata merging lives in
// the metadata-basics sibling).

import { describe, it, expect } from 'bun:test'

import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages'

describe('provider-specific metadata merging (assistant/tool)', () => {
  it('should handle an assistant message with text plus multiple tool calls', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Checking that now...' },
          {
            type: 'tool-call',
            toolCallId: 'call1',
            toolName: 'searchTool',
            input: { query: 'Weather' },
            providerOptions: {
              openaiCompatible: { function_call_reason: 'user request' },
            },
          },
          { type: 'text', text: 'Almost there...' },
          {
            type: 'tool-call',
            toolCallId: 'call2',
            toolName: 'mapsTool',
            input: { location: 'Paris' },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Checking that now...Almost there...',
        tool_calls: [
          {
            id: 'call1',
            type: 'function',
            function: {
              name: 'searchTool',
              arguments: JSON.stringify({ query: 'Weather' }),
            },
            function_call_reason: 'user request',
          },
          {
            id: 'call2',
            type: 'function',
            function: {
              name: 'mapsTool',
              arguments: JSON.stringify({ location: 'Paris' }),
            },
          },
        ],
      },
    ])
  })

  it('should preserve assistant reasoning content with tool calls', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Need the date first. ' },
          { type: 'reasoning', text: 'Then call weather.' },
          { type: 'text', text: 'Checking that now...' },
          {
            type: 'tool-call',
            toolCallId: 'call1',
            toolName: 'get_weather',
            input: { location: 'Hangzhou' },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Checking that now...',
        reasoning_content: 'Need the date first. Then call weather.',
        tool_calls: [
          {
            id: 'call1',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: JSON.stringify({ location: 'Hangzhou' }),
            },
          },
        ],
      },
    ])
  })

  it('should handle a single tool role message with multiple tool-result parts', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'tool',
        providerOptions: {
          // this just gets omitted as we prioritize content-level metadata
          openaiCompatible: { responseTier: 'detailed' },
        },
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call123',
            toolName: 'calculator',
            output: { type: 'json', value: { stepOne: 'data chunk 1' } },
          },
          {
            type: 'tool-result',
            toolCallId: 'call123',
            toolName: 'calculator',
            providerOptions: {
              openaiCompatible: { partial: true },
            },
            output: { type: 'json', value: { stepTwo: 'data chunk 2' } },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'tool',
        tool_call_id: 'call123',
        content: JSON.stringify({ stepOne: 'data chunk 1' }),
      },
      {
        role: 'tool',
        tool_call_id: 'call123',
        content: JSON.stringify({ stepTwo: 'data chunk 2' }),
        partial: true,
      },
    ])
  })

  it('should handle different tool metadata vs. message-level metadata', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        providerOptions: {
          openaiCompatible: { globalPriority: 'high' },
        },
        content: [
          { type: 'text', text: 'Initiating tool calls...' },
          {
            type: 'tool-call',
            toolCallId: 'callXYZ',
            toolName: 'awesomeTool',
            input: { param: 'someValue' },
            providerOptions: {
              openaiCompatible: {
                toolPriority: 'critical',
              },
            },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        globalPriority: 'high',
        content: 'Initiating tool calls...',
        tool_calls: [
          {
            id: 'callXYZ',
            type: 'function',
            function: {
              name: 'awesomeTool',
              arguments: JSON.stringify({ param: 'someValue' }),
            },
            toolPriority: 'critical',
          },
        ],
      },
    ])
  })

  it('should handle metadata collisions and overwrites in tool calls', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        providerOptions: {
          openaiCompatible: {
            cacheControl: { type: 'default' },
            sharedKey: 'assistantLevel',
          },
        },
        content: [
          {
            type: 'tool-call',
            toolCallId: 'collisionToolCall',
            toolName: 'collider',
            input: { num: 42 },
            providerOptions: {
              openaiCompatible: {
                cacheControl: { type: 'ephemeral' }, // overwrites top-level
                sharedKey: 'toolLevel',
              },
            },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        cacheControl: { type: 'default' },
        sharedKey: 'assistantLevel',
        content: '',
        tool_calls: [
          {
            id: 'collisionToolCall',
            type: 'function',
            function: {
              name: 'collider',
              arguments: JSON.stringify({ num: 42 }),
            },
            cacheControl: { type: 'ephemeral' },
            sharedKey: 'toolLevel',
          },
        ],
      },
    ])
  })
})
