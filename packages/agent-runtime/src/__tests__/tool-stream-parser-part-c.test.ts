import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { promptSuccess } from '@savant-code/common/util/error'
import { beforeEach, describe, expect, it } from 'bun:test'

import { processStreamWithTools } from '../tool-stream-parser'

import type { AgentRuntimeDeps } from '@savant-code/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'

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

  it('should suppress a split legacy block from reasoning', async () => {
    const stream = createMockStream([
      reasoningChunk('<think>Keep</think>\n<tool_'),
      reasoningChunk(
        'call><function=sequentialthinking>payload</tool_call>\nDone',
      ),
    ])
    const visibleReasoning: string[] = []

    for await (const chunk of processStreamWithTools({
      ...agentRuntimeImpl,
      stream,
      processors: {},
      defaultProcessor: () => ({
        onTagStart: () => {},
        onTagEnd: () => {},
      }),
      onResponseChunk: () => {},
      executeXmlToolCall: async () => {},
    })) {
      if (chunk.type === 'reasoning') {
        visibleReasoning.push(chunk.text)
      }
    }

    expect(visibleReasoning.join('')).toBe('<think>Keep</think>\n\nDone')
  })

  it('should fail closed for an unterminated legacy tool-call block', async () => {
    const executed: string[] = []
    const stream = createMockStream([
      textChunk('<tool_call><function=sequentialthinking>unfinished'),
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
  })

  it('should handle empty stream', async () => {
    const streamChunks: StreamChunk[] = []
    const stream = createMockStream(streamChunks)

    const events: any[] = []

    const processors = {}

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

    expect(events).toEqual([])
    expect(result).toEqual([])
  })

  it('should handle stream with only text content', async () => {
    const streamChunks: StreamChunk[] = [
      textChunk('Just some text'),
      textChunk(' with no tool calls'),
    ]
    const stream = createMockStream(streamChunks)

    const events: any[] = []

    const processors = {}

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

    expect(events).toEqual([])
  })
})
