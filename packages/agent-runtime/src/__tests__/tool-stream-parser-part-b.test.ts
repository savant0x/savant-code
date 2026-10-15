import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { promptSuccess } from '@savant-code/common/util/error'
import { beforeEach, describe, expect, it } from 'bun:test'

import { processStreamWithTools } from '../tool-stream-parser'
import { createToolCallChunk } from './test-utils'

import type { AgentRuntimeDeps } from '@savant-code/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'
import type { JSONValue } from '@savant-code/common/types/json'

describe('processStreamWithTags', () => {
  async function* createMockStream(chunks: StreamChunk[]) {
    for (const chunk of chunks) {
      yield chunk
    }

    return promptSuccess('mock-message-id')
  }

  function textChunk(text: string): StreamChunk {
    return { type: 'text' as const, text }
  }

  function reasoningChunk(text: string): StreamChunk {
    return { type: 'reasoning' as const, text }
  }

  let agentRuntimeImpl: AgentRuntimeDeps

  beforeEach(() => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL }
  })

  it('should handle text content mixed with tool calls', async () => {
    const streamChunks: StreamChunk[] = [
      textChunk('Some text before'),
      createToolCallChunk('test_tool', { param1: 'value1' }),
      textChunk('Some text after'),
    ]
    const stream = createMockStream(streamChunks)

    const events: any[] = []

    const processors = {
      test_tool: {
        params: ['param1'] as string[],
        onTagStart: (tagName: string, attributes: Record<string, string>) => {
          events.push({ tagName, type: 'start', attributes })
        },
        onTagEnd: (tagName: string, params: Record<string, JSONValue>) => {
          events.push({ tagName, type: 'end', params })
        },
      },
    }

    const result: string[] = []
    const responseChunks: any[] = []

    function onResponseChunk(chunk: any) {
      responseChunks.push(chunk)
    }

    function defaultProcessor(toolName: string) {
      return {
        onTagStart: () => {},
        onTagEnd: () => {},
      }
    }

    for await (const chunk of processStreamWithTools({
      ...agentRuntimeImpl,
      stream,
      processors,
      defaultProcessor,
      onResponseChunk,
      executeXmlToolCall: async () => {},
    })) {
      if (chunk.type === 'text') {
        result.push(chunk.text)
      }
    }

    expect(events).toEqual([
      {
        tagName: 'test_tool',
        type: 'start',
        attributes: {},
      },
      {
        tagName: 'test_tool',
        type: 'end',
        params: { param1: 'value1' },
      },
    ])
  })

  it('should execute canonical text tool calls and hide their envelope', async () => {
    const executed: Array<{
      toolName: string
      input: Record<string, JSONValue>
    }> = []
    const stream = createMockStream([
      textChunk(
        'Before\n<savant_code_tool_call>\n{"cb_tool_name":"sequentialthinking","thought":"Use the canonical format"}\n</savant_code_tool_call>\nAfter',
      ),
    ])
    const visibleText: string[] = []

    for await (const chunk of processStreamWithTools({
      ...agentRuntimeImpl,
      stream,
      processors: {},
      defaultProcessor: () => ({
        onTagStart: () => {},
        onTagEnd: () => {},
      }),
      onResponseChunk: () => {},
      executeXmlToolCall: async ({ toolName, input }) => {
        executed.push({ toolName, input })
      },
    })) {
      if (chunk.type === 'text') {
        visibleText.push(chunk.text)
      }
    }

    expect(executed).toEqual([
      {
        toolName: 'sequentialthinking',
        input: { thought: 'Use the canonical format' },
      },
    ])
    expect(visibleText.join('')).toBe('Before\n\nAfter')
    expect(visibleText.join('')).not.toContain('savant_code_tool_call')
  })

  it('should suppress unsupported function XML without executing or emitting it', async () => {
    const executed: string[] = []
    const emittedText: string[] = []
    const unsupportedText =
      '<tool_call>\\n<function=sequentialthinking>\\n<parameter=thought>Do not execute</parameter>\\n</tool_call>'
    const stream = createMockStream([textChunk(unsupportedText)])
    const visibleText: string[] = []

    for await (const chunk of processStreamWithTools({
      ...agentRuntimeImpl,
      stream,
      processors: {},
      defaultProcessor: () => ({
        onTagStart: () => {},
        onTagEnd: () => {},
      }),
      onResponseChunk: (chunk) => {
        if (chunk.type === 'text') {
          emittedText.push(chunk.text)
        }
      },
      executeXmlToolCall: async ({ toolName }) => {
        executed.push(toolName)
      },
    })) {
      if (chunk.type === 'text') {
        visibleText.push(chunk.text)
      }
    }

    expect(executed).toEqual([])
    expect(visibleText.join('')).toBe('')
    expect(emittedText.join('')).toBe('')
  })

  it('should suppress legacy markup from reasoning without parsing or executing it', async () => {
    const executed: string[] = []
    const visibleReasoning: string[] = []
    const stream = createMockStream([
      reasoningChunk(
        '<think>Keep this reasoning</think>\n<tool_call><function=sequentialthinking>\n<parameter=thought>Do not show this</parameter>\n</tool_call>\nContinue reasoning',
      ),
    ])

    for await (const chunk of processStreamWithTools({
      ...agentRuntimeImpl,
      stream,
      processors: {},
      defaultProcessor: () => ({
        onTagStart: () => {},
        onTagEnd: () => {},
      }),
      onResponseChunk: () => {},
      executeXmlToolCall: async ({ toolName }) => {
        executed.push(toolName)
      },
    })) {
      if (chunk.type === 'reasoning') {
        visibleReasoning.push(chunk.text)
      }
    }

    expect(executed).toEqual([])
    expect(visibleReasoning.join('')).toBe(
      '<think>Keep this reasoning</think>\n\nContinue reasoning',
    )
  })
})
