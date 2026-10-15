// OpenAI-compatible chat message conversion — consecutive assistant
// message merging.
// Sibling of the Loop 323 decomposition.

import { describe, it, expect } from 'bun:test'

import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages'

describe('consecutive assistant messages', () => {
  it('merges a run of assistant messages into one wire message', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'reasoning', text: 'Read the file first.' }],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Working on it.' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'read_files',
            input: { paths: ['a.ts'] },
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Working on it.',
        reasoning_content: 'Read the file first.',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'read_files',
              arguments: JSON.stringify({ paths: ['a.ts'] }),
            },
          },
        ],
      },
    ])
  })

  it('concatenates text, reasoning, and tool_calls across the run in order', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'First, ' },
          { type: 'text', text: 'Step one.' },
        ],
      },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'then done.' },
          { type: 'text', text: ' Step two.' },
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'a',
            input: {},
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_2',
            toolName: 'b',
            input: {},
          },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Step one. Step two.',
        reasoning_content: 'First, then done.',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'a', arguments: '{}' },
          },
          {
            id: 'call_2',
            type: 'function',
            function: { name: 'b', arguments: '{}' },
          },
        ],
      },
    ])
  })

  it('does not merge assistant messages separated by another role', () => {
    const result = convertToOpenAICompatibleChatMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'One.' }],
      },
      { role: 'user', content: [{ type: 'text', text: 'Go on.' }] },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Two.' }],
      },
    ])

    expect(result).toEqual([
      { role: 'assistant', content: 'One.' },
      { role: 'user', content: [{ type: 'text', text: 'Go on.' }] },
      { role: 'assistant', content: 'Two.' },
    ])
  })
})
