// FID-2026-0819-005 Loop 224: unknown-tool + complex-parameter suites,
// moved verbatim from tool-stream-parser-part-a.test.ts (parent over the
// 300-line ceiling). See tool-stream-parser-part-a.test.ts for the sibling
// suites' contract.

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

  let agentRuntimeImpl: AgentRuntimeDeps

  beforeEach(() => {
    agentRuntimeImpl = { ...TEST_AGENT_RUNTIME_IMPL }
  })

  it('should handle unknown tool names via defaultProcessor', async () => {
    const streamChunks: StreamChunk[] = [
      createToolCallChunk('unknown_tool', { param1: 'value1' }),
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

    const responseChunks: any[] = []

    function onResponseChunk(chunk: any) {
      responseChunks.push(chunk)
    }

    function defaultProcessor(toolName: string) {
      // For unknown tools, still return a processor but track the error
      events.push({
        name: toolName,
        error: `Tool not found: ${toolName}`,
        type: 'error',
      })
      return {
        onTagStart: () => {},
        onTagEnd: () => {},
      }
    }

    for await (const _chunk of processStreamWithTools({
      ...agentRuntimeImpl,
      stream,
      processors,
      defaultProcessor,
      onResponseChunk,
      executeXmlToolCall: async () => {},
    })) {
      // consume stream
    }

    expect(events).toEqual([
      {
        name: 'unknown_tool',
        error: 'Tool not found: unknown_tool',
        type: 'error',
      },
    ])
  })

  it('should handle tool calls with complex parameters', async () => {
    const streamChunks: StreamChunk[] = [
      createToolCallChunk('complex_tool', {
        array_param: ['item1', 'item2'],
        object_param: { nested: 'value' },
        boolean_param: true,
        number_param: 42,
      }),
    ]
    const stream = createMockStream(streamChunks)

    const events: any[] = []

    const processors = {
      complex_tool: {
        params: [
          'array_param',
          'object_param',
          'boolean_param',
          'number_param',
        ] as string[],
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
        tagName: 'complex_tool',
        type: 'start',
        attributes: {},
      },
      {
        tagName: 'complex_tool',
        type: 'end',
        params: {
          array_param: ['item1', 'item2'],
          object_param: { nested: 'value' },
          boolean_param: true,
          number_param: 42,
        },
      },
    ])
  })
})
