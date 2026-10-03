import { ModelRequestLimitsStore } from '@savant-code/common/util/model-request-limits'
import { describe, expect, mock, test } from 'bun:test'

import { withRequestTokenBudget } from '../model-provider/request-budget'
import { budgetModelRequest } from '../model-provider/request-budget-policy'
import { countRequestInputTokens } from '../model-provider/request-token-count'

import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider'

const prompt: LanguageModelV2CallOptions['prompt'] = [
  { role: 'user', content: [{ type: 'text', text: 'Continue' }] },
]
const recordedError =
  'This model configuration accepts at most 1048576 combined input and output tokens. However, your request has 112977 input tokens and asks for 943717 output tokens (1056694 tokens total). Please reduce the input length or requested output length.'
const generated: Awaited<ReturnType<LanguageModelV2['doGenerate']>> = {
  content: [{ type: 'text', text: 'ok' }],
  finishReason: 'stop',
  usage: { inputTokens: 10, outputTokens: 1, totalTokens: 11 },
  warnings: [],
}

function fixture(
  contextWindow = 1048576,
  maxOutputTokens: number | undefined = 943717,
) {
  const store = new ModelRequestLimitsStore()
  store.replaceCatalog([
    {
      id: 'gateway/flash',
      contextLength: contextWindow,
      maxCompletionTokens: maxOutputTokens,
    },
  ])
  const doGenerate = mock(
    async (_params: LanguageModelV2CallOptions) => generated,
  )
  const doStream = mock(async (_params: LanguageModelV2CallOptions) => ({
    stream: new ReadableStream<LanguageModelV2StreamPart>({
      start(controller) {
        controller.close()
      },
    }),
  }))
  const raw: LanguageModelV2 = {
    specificationVersion: 'v2',
    provider: 'gateway',
    modelId: 'flash',
    supportedUrls: {},
    doGenerate,
    doStream,
  }
  const options = {
    catalogId: 'gateway/flash',
    routeId: 'endpoint-a',
    limitsStore: store,
  }
  return {
    raw,
    store,
    options,
    doGenerate,
    doStream,
    model: withRequestTokenBudget(raw, options),
  }
}

describe('provider request token budgets', () => {
  test('recorded input and output numbers cannot cross the known combined window', () => {
    const result = budgetModelRequest(
      { prompt, maxOutputTokens: 943717 },
      { contextWindow: 1048576 },
      112977,
    )
    expect(result.maxOutputTokens).toBe(931503)
    expect(112977 + (result.maxOutputTokens ?? 0) + 4096).toBe(1048576)
  })

  test('counts final system, reasoning, tool arguments/results and schema instructions', () => {
    const params: LanguageModelV2CallOptions = {
      prompt: [
        { role: 'system', content: 'Read the project rules' },
        ...prompt,
        {
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Consider the evidence' },
            {
              type: 'tool-call',
              toolCallId: '1',
              toolName: 'read',
              input: { path: 'src/index.ts' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: '1',
              toolName: 'read',
              output: { type: 'text', value: 'important result '.repeat(100) },
            },
          ],
        },
      ],
      tools: [
        {
          type: 'function',
          name: 'read',
          description: 'Read files',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
          },
        },
      ],
      responseFormat: {
        type: 'json',
        schema: { type: 'object', properties: { answer: { type: 'string' } } },
      },
    }
    expect(countRequestInputTokens(params)).toBeGreaterThan(
      countRequestInputTokens({ prompt: params.prompt }),
    )
    expect(countRequestInputTokens({ prompt: params.prompt })).toBeGreaterThan(
      countRequestInputTokens({ prompt }),
    )
    const media: LanguageModelV2CallOptions = {
      prompt: [
        {
          role: 'user',
          content: [
            { type: 'file', mediaType: 'image/png', data: 'A'.repeat(100000) },
          ],
        },
      ],
    }
    expect(countRequestInputTokens(media)).toBe(1608)
  })

  test('both generate and stream dispatch the reduced final allowance', async () => {
    const { model, doGenerate, doStream } = fixture(2000, 1900)
    const params = {
      prompt: [{ role: 'system' as const, content: 'input '.repeat(600) }],
      maxOutputTokens: 1900,
    }
    const input = countRequestInputTokens(params)
    await model.doGenerate(params)
    await model.doStream(params)
    expect(doGenerate.mock.calls[0][0].maxOutputTokens).toBe(2000 - input - 20)
    expect(doStream.mock.calls[0][0].maxOutputTokens).toBe(
      doGenerate.mock.calls[0][0].maxOutputTokens,
    )
    expect(params.maxOutputTokens).toBe(1900)
    expect(model.provider).toBe('gateway')
    expect(model.modelId).toBe('flash')
  })

  test('preserves smaller caller caps and leaves unknown output caps omitted', async () => {
    const known = fixture(1000, 900)
    await known.model.doGenerate({ prompt, maxOutputTokens: 25 })
    expect(known.doGenerate.mock.calls[0][0].maxOutputTokens).toBe(25)
    known.store.replaceCatalog([{ id: 'gateway/flash', contextLength: 1000 }])
    await known.model.doGenerate({ prompt })
    expect(known.doGenerate.mock.calls[1][0].maxOutputTokens).toBeUndefined()
  })

  test('rejects exhausted input and malformed explicit caps before any dispatch', async () => {
    const { model, doGenerate, doStream, raw, options } = fixture(50, 25)
    const oversized = {
      prompt: [{ role: 'system' as const, content: 'input '.repeat(100) }],
    }
    await expect(
      Promise.resolve(model.doGenerate(oversized)),
    ).rejects.toMatchObject({ code: 'context_length_exceeded' })
    await expect(
      Promise.resolve(model.doStream(oversized)),
    ).rejects.toMatchObject({ code: 'context_length_exceeded' })
    for (const maxOutputTokens of [0, -1, NaN, Infinity, 1.5]) {
      await expect(
        Promise.resolve(model.doGenerate({ prompt, maxOutputTokens })),
      ).rejects.toThrow('positive safe integer')
    }
    expect(() =>
      withRequestTokenBudget(raw, { ...options, contextWindow: NaN }),
    ).toThrow('positive safe integer')
    expect(doGenerate).not.toHaveBeenCalled()
    expect(doStream).not.toHaveBeenCalled()
  })

  test('provider option overrides are bounded and never mutate caller options', async () => {
    const { model, doGenerate } = fixture(1000, 900)
    const providerOptions = {
      gateway: { max_tokens: 99999 },
      openai: { maxCompletionTokens: 99999 },
    }
    await model.doGenerate({ prompt, maxOutputTokens: 100, providerOptions })
    expect(doGenerate.mock.calls[0][0]).toMatchObject({
      maxOutputTokens: 100,
      providerOptions: {
        gateway: { max_tokens: 100 },
        openai: { maxCompletionTokens: 100 },
      },
    })
    expect(providerOptions.gateway.max_tokens).toBe(99999)
    await expect(
      Promise.resolve(
        model.doGenerate({
          prompt,
          providerOptions: { gateway: { max_tokens: '99999' } },
        }),
      ),
    ).rejects.toThrow('positive safe integer')
  })

  test('corrects a stale window from the recorded provider rejection before streaming', async () => {
    const { model, raw, options, store, doStream } = fixture(1310720)
    doStream.mockRejectedValueOnce(new Error(recordedError))
    await model.doStream({ prompt, maxOutputTokens: 943717 })
    expect(doStream).toHaveBeenCalledTimes(2)
    expect(doStream.mock.calls[0][0].maxOutputTokens).toBe(943717)
    expect(doStream.mock.calls[1][0].maxOutputTokens).toBe(931503)
    expect(store.get(options.catalogId, options.routeId).contextWindow).toBe(
      1048576,
    )
    // A later call recomputes input, rather than retaining this prompt's reported input.
    await model.doStream({ prompt, maxOutputTokens: 943717 })
    expect(doStream.mock.calls[2][0].maxOutputTokens).toBe(943717)
    expect(store.get(options.catalogId, 'endpoint-b').contextWindow).toBe(
      1310720,
    )
    expect(withRequestTokenBudget(raw, options).provider).toBe('gateway')
  })

  test('output-only cap correction covers generation, including previously omitted output', async () => {
    const { model, doGenerate, store } = fixture()
    store.replaceCatalog([{ id: 'gateway/flash', contextLength: 1048576 }])
    doGenerate.mockRejectedValueOnce(new Error('max_tokens must be <= 131072'))
    await model.doGenerate({ prompt })
    expect(doGenerate).toHaveBeenCalledTimes(2)
    expect(doGenerate.mock.calls[0][0].maxOutputTokens).toBeUndefined()
    expect(doGenerate.mock.calls[1][0].maxOutputTokens).toBe(131072)
  })

  test('does not retry twice, generic errors, aborted requests or unhelpful corrections', async () => {
    const twice = fixture(1310720)
    twice.doGenerate.mockRejectedValue(new Error(recordedError))
    await expect(
      Promise.resolve(
        twice.model.doGenerate({ prompt, maxOutputTokens: 943717 }),
      ),
    ).rejects.toThrow(recordedError)
    expect(twice.doGenerate).toHaveBeenCalledTimes(2)
    for (const error of [
      new Error('Authentication failed'),
      new Error('max_tokens must be <= 9999999'),
    ]) {
      const one = fixture()
      one.doGenerate.mockRejectedValue(error)
      await expect(
        Promise.resolve(one.model.doGenerate({ prompt, maxOutputTokens: 100 })),
      ).rejects.toBe(error)
      expect(one.doGenerate).toHaveBeenCalledTimes(1)
    }
    const aborted = fixture(1310720)
    const controller = new AbortController()
    aborted.doGenerate.mockImplementation(async () => {
      controller.abort()
      throw new Error(recordedError)
    })
    await expect(
      Promise.resolve(
        aborted.model.doGenerate({ prompt, abortSignal: controller.signal }),
      ),
    ).rejects.toThrow(recordedError)
    expect(aborted.doGenerate).toHaveBeenCalledTimes(1)
  })

  test('does not retry an error after a stream has been returned', async () => {
    const { model, doStream } = fixture(1310720)
    doStream.mockResolvedValueOnce({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'error', error: new Error(recordedError) })
          controller.close()
        },
      }),
    })
    const response = await model.doStream({ prompt, maxOutputTokens: 943717 })
    const item = await response.stream.getReader().read()
    expect(item.value?.type).toBe('error')
    expect(doStream).toHaveBeenCalledTimes(1)
  })
})
