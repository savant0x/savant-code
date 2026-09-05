// Shared harness for the openai-compatible chat-language-model test family.
// Sibling of the Loop 354 decomposition (suite files all import these).
import { createOpenAICompatible } from '../openai-compatible-provider'

import type {
  LanguageModelV2,
  LanguageModelV2FunctionTool,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider'

// Re-exports so sibling suites keep the original import surface.
export { createOpenAICompatible }
export type {
  LanguageModelV2,
  LanguageModelV2FunctionTool,
  LanguageModelV2StreamPart,
}

export const PROMPT = [
  {
    role: 'user' as const,
    content: [{ type: 'text' as const, text: 'test' }],
  },
]

export const THINKER_TOOL: LanguageModelV2FunctionTool = {
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

export const EMPTY_OBJECT_TOOL: LanguageModelV2FunctionTool = {
  type: 'function',
  name: 'empty_tool',
  description: 'A tool with no required arguments',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}

/** Build an SSE `data: {...}\n\n` event from an object. */
export function sseEvent(value: unknown): string {
  return `data: ${JSON.stringify(value)}\n\n`
}

/**
 * Create a real OpenAICompatibleChatLanguageModel whose fetch returns a mocked
 * text/event-stream response containing the given SSE events.
 */
export function createStreamingModel(events: unknown[]) {
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
export async function collectStreamParts(
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

export function toolCallsFrom(parts: LanguageModelV2StreamPart[]) {
  return parts.filter(
    (part): part is Extract<LanguageModelV2StreamPart, { type: 'tool-call' }> =>
      part.type === 'tool-call',
  )
}

export function toolInputDeltasFrom(parts: LanguageModelV2StreamPart[]) {
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
export function toolDeltaChunk(
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

export function finishChunk(reason = 'tool_calls') {
  return {
    id: 'chatcmpl-1',
    created: 1,
    model: 'test-model',
    choices: [{ delta: {}, finish_reason: reason }],
  }
}

export const FULL_ARGS =
  '{"thought":"a","thoughtNumber":1,"totalThoughts":3,"nextThoughtNeeded":true}'
