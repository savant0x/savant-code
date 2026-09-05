// openai-compatible chat-language-model test family — doGenerate path
// (FID-2026-0803-002 LLM-1: empty `choices` must not crash the hot path).
// Sibling of the Loop 354 decomposition (shared fixtures in
// ./chat-language-model-stream-harness).
import { describe, it, expect } from 'bun:test'

import {
  createOpenAICompatible,
  PROMPT,
  type LanguageModelV2,
} from './chat-language-model-stream-harness'

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
