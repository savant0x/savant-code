import { describe, it, expect } from 'bun:test'

import { createOpenAICompatible } from '../openai-compatible-provider'
import {
  isCompleteToolCallArguments,
  parseToolCallArguments,
} from './openai-compatible-chat-language-model'

import type {
  LanguageModelV2,
  LanguageModelV2FunctionTool,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider'

// ---------------------------------------------------------------------------
// Unit tests — exported argument helpers (FID-2026-0801-008)
// ---------------------------------------------------------------------------

describe('parseToolCallArguments', () => {
  it('returns ok for a complete non-empty JSON object', () => {
    const result = parseToolCallArguments(
      '{"thought":"a","thoughtNumber":1,"totalThoughts":3,"nextThoughtNeeded":true}',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.thought).toBe('a')
      expect(result.value.thoughtNumber).toBe(1)
    }
  })

  it('parses an empty object but leaves completeness to the schema-aware helper', () => {
    const result = parseToolCallArguments('{}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({})
    }
  })

  it('parses a whitespace empty object', () => {
    const result = parseToolCallArguments('{ }')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({})
    }
  })

  it('returns not-ok for a string-literal encoding', () => {
    const result = parseToolCallArguments('"{\\"thought\\":\\"a\\"}"')
    expect(result).toEqual({
      ok: false,
      reason: 'non-object',
      value: '{"thought":"a"}',
    })
  })

  it('returns not-ok for an array', () => {
    const result = parseToolCallArguments('[]')
    expect(result.ok).toBe(false)
  })

  it('returns not-ok for null', () => {
    const result = parseToolCallArguments('null')
    expect(result.ok).toBe(false)
  })

  it('returns not-ok for truncated / malformed JSON', () => {
    expect(parseToolCallArguments('{"tho').ok).toBe(false)
    expect(parseToolCallArguments('{').ok).toBe(false)
    expect(parseToolCallArguments('').ok).toBe(false)
  })
})

describe('isCompleteToolCallArguments', () => {
  it('is true only for a complete non-empty object', () => {
    expect(
      isCompleteToolCallArguments(
        '{"thought":"a","thoughtNumber":1,"totalThoughts":3,"nextThoughtNeeded":true}',
      ),
    ).toBe(true)
    expect(isCompleteToolCallArguments('{}')).toBe(false)
    expect(isCompleteToolCallArguments('{}', [])).toBe(true)
    expect(
      isCompleteToolCallArguments('{}', ['thought', 'thoughtNumber']),
    ).toBe(false)
    expect(
      isCompleteToolCallArguments('{"thought":"a","thoughtNumber":1}', [
        'thought',
        'thoughtNumber',
      ]),
    ).toBe(true)
    expect(isCompleteToolCallArguments('{"tho')).toBe(false)
    expect(isCompleteToolCallArguments('"{}"')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Integration tests — real doStream path with a mocked SSE fetch
// ---------------------------------------------------------------------------

const PROMPT = [
  {
    role: 'user' as const,
    content: [{ type: 'text' as const, text: 'test' }],
  },
]

const THINKER_TOOL: LanguageModelV2FunctionTool = {
  type: 'function',
  name: 'sequentialthinking',
  description: 'Structured thinking',
  inputSchema: {
    type: 'object',
    required: [
      'thought',
      'thoughtNumber',
      'totalThoughts',
      'nextThoughtNeeded',
    ],
    properties: {
      thought: { type: 'string' },
      thoughtNumber: { type: 'integer' },
      totalThoughts: { type: 'integer' },
      nextThoughtNeeded: { type: 'boolean' },
    },
  },
}

const EMPTY_OBJECT_TOOL: LanguageModelV2FunctionTool = {
  type: 'function',
  name: 'empty_tool',
  description: 'A tool with no required arguments',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

/** Build an SSE `data: {...}\n\n` event from an object. */
function sseEvent(value: unknown): string {
  return `data: ${JSON.stringify(value)}\n\n`
}

/**
 * Create a real OpenAICompatibleChatLanguageModel whose fetch returns a mocked
 * text/event-stream response containing the given SSE events.
 */
function createStreamingModel(events: unknown[]) {
  const fetchMock = Object.assign(
    async () => {
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(sseEvent(event)))
          }
          controller.close()
        },
      })
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    },
    { preconnect: async () => {} },
  )

  return createOpenAICompatible({
    baseURL: 'https://example.com/v1',
    name: 'test',
    apiKey: 'test-key',
    fetch: fetchMock,
  })('test-model')
}

/** Collect every streamed part from a doStream call. */
async function collectStreamParts(
  model: ReturnType<typeof createStreamingModel>,
  tools: LanguageModelV2FunctionTool[] = [THINKER_TOOL],
) {
  const { stream } = await model.doStream({
    prompt: PROMPT,
    tools,
  })
  const parts: LanguageModelV2StreamPart[] = []
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
  }
  return parts
}

function toolCallsFrom(parts: LanguageModelV2StreamPart[]) {
  return parts.filter(
    (part): part is Extract<LanguageModelV2StreamPart, { type: 'tool-call' }> =>
      part.type === 'tool-call',
  )
}

function toolInputDeltasFrom(parts: LanguageModelV2StreamPart[]) {
  return parts
    .filter(
      (
        part,
      ): part is Extract<
        LanguageModelV2StreamPart,
        { type: 'tool-input-delta' }
      > => part.type === 'tool-input-delta',
    )
    .map((part) => part.delta)
}

/** Minimal SSE chunk carrying one tool-call delta for index 0. */
function toolDeltaChunk(
  index: number,
  args: string,
  name: string | null = 'sequentialthinking',
) {
  return {
    id: 'chatcmpl-1',
    created: 1,
    model: 'test-model',
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index,
              id: `call_${index}`,
              function: { name, arguments: args },
            },
          ],
        },
      },
    ],
  }
}

function finishChunk(reason = 'tool_calls') {
  return {
    id: 'chatcmpl-1',
    created: 1,
    model: 'test-model',
    choices: [{ delta: {}, finish_reason: reason }],
  }
}

const FULL_ARGS =
  '{"thought":"a","thoughtNumber":1,"totalThoughts":3,"nextThoughtNeeded":true}'

describe('doStream tool-call accumulation', () => {
  it('A. placeholder-first: {} placeholder then real object → one tool-call with full object', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{}'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].toolName).toBe('sequentialthinking')
    expect(calls[0].input).toBe(FULL_ARGS)
    expect(toolInputDeltasFrom(parts)).toEqual([FULL_ARGS])
  })

  it('B. normal OpenAI fragments merge into one object', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{"thought":'),
      toolDeltaChunk(0, '"a","thoughtNumber":'),
      toolDeltaChunk(0, '1,"totalThoughts":3,"nextThoughtNeeded":true}'),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })

  it('C. one-shot complete object in a single chunk → one tool-call', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })

  it('D. string-literal args fail closed at flush', async () => {
    const stringLiteral = JSON.stringify(FULL_ARGS)
    const model = createStreamingModel([
      toolDeltaChunk(0, stringLiteral),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    const errors = parts.filter((part) => part.type === 'error')
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
  })

  it('E. truncated at flush fails closed without exposing raw arguments', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{"thought":"unterminated'),
      finishChunk('stop'),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    const errors = parts.filter((part) => part.type === 'error')
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(JSON.stringify(errors[0])).not.toContain('unterminated')
  })

  it('E2. terminal empty arguments fail closed without an executable call', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, ''),
      finishChunk('stop'),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)
    const errors = parts.filter((part) => part.type === 'error')
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
  })

  it('E3. terminal whitespace arguments fail closed without an executable call', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '   '),
      finishChunk('stop'),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)
    const errors = parts.filter((part) => part.type === 'error')
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
  })

  it('F. non-object parseable (array) does not complete early; real object accumulates', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '[]'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
    expect(toolInputDeltasFrom(parts)).toEqual([FULL_ARGS])
  })

  it('F2. null stale fragment is replaced by the real object', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, 'null'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })

  it('F3. string-literal placeholder is replaced by a real object fragment', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '"{}"'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })

  it('F4. whitespace empty-object placeholder is replaced by the real object', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{ }'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })

  it('H. terminal empty object fails closed for required fields', async () => {
    const model = createStreamingModel([toolDeltaChunk(0, '{}'), finishChunk()])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)
    const errors = parts.filter(
      (part): part is Extract<LanguageModelV2StreamPart, { type: 'error' }> =>
        part.type === 'error',
    )
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.error).toEqual({
      type: 'native-incomplete',
      toolName: 'sequentialthinking',
    })
    expect(JSON.stringify(errors[0])).not.toContain('{}')
  })

  it('I. terminal empty object is valid for a zero-required-field tool', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{}', 'empty_tool'),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model, [EMPTY_OBJECT_TOOL])
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].toolName).toBe('empty_tool')
    expect(calls[0].input).toBe('{}')
  })

  it('J. undeclared tool calls fail closed without an executable call', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, FULL_ARGS, 'undeclared_tool'),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)
    const errors = parts.filter((part) => part.type === 'error')

    expect(calls).toHaveLength(0)
    expect(errors).toHaveLength(1)
  })

  it('G. multi-tool-call interleave completes both independently', async () => {
    const argsB =
      '{"thought":"b","thoughtNumber":2,"totalThoughts":4,"nextThoughtNeeded":true}'
    const model = createStreamingModel([
      toolDeltaChunk(0, '{"thought":'),
      toolDeltaChunk(1, '{"thought":'),
      toolDeltaChunk(
        0,
        '"a","thoughtNumber":1,"totalThoughts":3,"nextThoughtNeeded":true}',
      ),
      toolDeltaChunk(
        1,
        '"b","thoughtNumber":2,"totalThoughts":4,"nextThoughtNeeded":true}',
      ),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(2)
    expect(calls[0].toolCallId).toBe('call_0')
    expect(calls[0].input).toBe(FULL_ARGS)
    expect(calls[1].toolCallId).toBe('call_1')
    expect(calls[1].input).toBe(argsB)
  })
})

// ---------------------------------------------------------------------------
// Integration tests — real doGenerate path with a mocked JSON fetch
// (FID-2026-0803-002 LLM-1: empty `choices` must not crash the hot path)
// ---------------------------------------------------------------------------

describe('doGenerate (FID-2026-0803-002 LLM-1)', () => {
  it('does not throw when the provider returns empty choices', async () => {
    const fetchMock = Object.assign(
      async () => {
        return new Response(
          JSON.stringify({
            id: 'chatcmpl-1',
            created: 123,
            model: 'test-model',
            choices: [],
            usage: { prompt_tokens: 3, completion_tokens: 0, total_tokens: 3 },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      },
      { preconnect: async () => {} },
    )

    const model = createOpenAICompatible({
      baseURL: 'https://example.com/v1',
      name: 'test',
      apiKey: 'test-key',
      fetch: fetchMock,
    })('test-model')

    const result = await model.doGenerate({
      prompt: PROMPT,
      maxOutputTokens: 10,
      temperature: 0,
      topP: 1,
      topK: undefined,
      frequencyPenalty: 0,
      presencePenalty: 0,
      stopSequences: [],
      responseFormat: { type: 'text' },
      seed: undefined,
      providerOptions: {},
      tools: [],
      toolChoice: undefined,
      headers: {},
      abortSignal: new AbortController().signal,
    } as Parameters<LanguageModelV2['doGenerate']>[0])

    expect(result.content).toEqual([])
    expect(result.finishReason).toBe('unknown')
    expect(result.usage?.inputTokens).toBe(3)
  })
})
