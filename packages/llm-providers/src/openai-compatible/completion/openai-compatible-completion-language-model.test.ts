import { describe, expect, it } from 'bun:test'

import { OpenAICompatibleCompletionLanguageModel } from './openai-compatible-completion-language-model'

import type { LanguageModelV2 } from '@ai-sdk/provider'
import type { FetchFunction } from '@ai-sdk/provider-utils'

/** Build an SSE `data: {...}\n\n` event from an object. */
function sseEvent(value: unknown): string {
  return `data: ${JSON.stringify(value)}\n\n`
}

/**
 * A fetch mock that returns a text/event-stream body containing the given SSE
 * events. Mirrors the streaming helper in the chat language-model test.
 */
function streamFetch(events: unknown[]): FetchFunction {
  return Object.assign(
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
}

/**
 * A fetch mock that satisfies `typeof fetch` (which requires `preconnect`).
 * Mirrors the pattern used in the chat language-model test.
 */
function mockFetch(body: unknown): FetchFunction {
  return Object.assign(
    async () => {
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
    { preconnect: async () => {} },
  )
}

function createModel(
  fetchImpl: FetchFunction,
): OpenAICompatibleCompletionLanguageModel {
  return new OpenAICompatibleCompletionLanguageModel('test-completion-model', {
    provider: 'test-provider',
    headers: () => ({}),
    url: () => 'https://example.test/v1/completions',
    fetch: fetchImpl,
  })
}

function generateOptions(): Parameters<LanguageModelV2['doGenerate']>[0] {
  return {
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
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
  } as Parameters<LanguageModelV2['doGenerate']>[0]
}

describe('OpenAICompatibleCompletionLanguageModel (FID-006 LLM1/LLM2)', () => {
  it('doGenerate does not throw when the provider returns empty choices', async () => {
    const model = createModel(
      mockFetch({
        id: 'cmpl-1',
        created: 123,
        model: 'test-completion-model',
        choices: [],
        usage: { prompt_tokens: 3, completion_tokens: 0, total_tokens: 3 },
      }),
    )

    const result = await model.doGenerate(generateOptions())

    expect(result.content).toEqual([])
    expect(result.finishReason).toBe('unknown')
    expect(result.usage?.inputTokens).toBe(3)
  })

  it('doGenerate maps a normal completion response', async () => {
    const model = createModel(
      mockFetch({
        id: 'cmpl-2',
        created: 123,
        model: 'test-completion-model',
        choices: [{ text: 'Hi there', finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
    )

    const result = await model.doGenerate(generateOptions())

    expect(result.content).toEqual([{ type: 'text', text: 'Hi there' }])
    expect(result.finishReason).toBe('stop')
  })

  it('LLM2: provider options cannot override the requested model', async () => {
    let sentBody: { model?: string } | undefined

    const fetchImpl = Object.assign(
      async (_url: unknown, init?: { body?: unknown }) => {
        sentBody = JSON.parse(String(init?.body)) as { model?: string }
        return new Response(
          JSON.stringify({
            id: 'cmpl-3',
            created: 123,
            model: 'test-completion-model',
            choices: [{ text: 'ok', finish_reason: 'stop' }],
            usage: undefined,
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      },
      { preconnect: async () => {} },
    )
    const model = createModel(fetchImpl)

    await model.doGenerate({
      ...generateOptions(),
      // A misconfigured provider option that tries to swap the model. The
      // raw spread would inject `model` without the post-spread re-assertion.
      providerOptions: { 'test-provider': { model: 'evil-model' } } as never,
    })

    expect(sentBody?.model).toBe('test-completion-model')
  })

  it('LLM6: doStream error part carries a string message (unified with chat)', async () => {
    const model = createModel(
      streamFetch([{ error: { message: 'stream exploded', type: 'server_error' } }]),
    )

    const { stream } = await model.doStream(generateOptions())
    const parts: Array<{ type: string; error?: unknown }> = []
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value as { type: string; error?: unknown })
    }

    const errorPart = parts.find((part) => part.type === 'error')
    expect(errorPart).toBeDefined()
    expect(errorPart?.error).toBe('stream exploded')
  })
})
