import { describe, expect, test } from 'bun:test'

import { ModelRequestLimitsStore } from '../util/model-request-limits'
import { parseProviderTokenLimitError } from '../util/provider-token-limit-error'

const RECORDED_BUDGET_ERROR =
  'This model configuration accepts at most 1048576 combined input and output tokens. However, your request has 112977 input tokens and asks for 943717 output tokens (1056694 tokens total). Please reduce the input length or requested output length.'

describe('model request limits', () => {
  test('OpenRouter upstream vendor ids cannot overwrite direct provider limits', () => {
    const store = new ModelRequestLimitsStore()
    store.replaceCatalog([
      {
        id: 'openai/gpt-5',
        provider: 'openrouter',
        maxCompletionTokens: 128000,
      },
      { id: 'openai/gpt-5', provider: 'openai', maxCompletionTokens: 8192 },
    ])
    expect(store.get('openrouter/openai/gpt-5', '').maxOutputTokens).toBe(
      128000,
    )
    expect(store.get('openai/gpt-5', '').maxOutputTokens).toBe(8192)
  })
  test('serving observations only lower limits and stay isolated to their route', () => {
    const store = new ModelRequestLimitsStore()
    store.replaceCatalog([
      {
        id: 'gateway/glm-flash',
        contextLength: 1310720,
        maxCompletionTokens: 943717,
      },
    ])
    store.observe('route-a', { contextWindow: 1048576 })
    store.observe('route-a', {
      contextWindow: 2000000,
      maxOutputTokens: 131072,
    })
    store.replaceCatalog([
      {
        id: 'gateway/glm-flash',
        contextLength: 2000000,
        maxCompletionTokens: 943717,
      },
    ])
    expect(store.get('gateway/glm-flash', 'route-a')).toEqual({
      contextWindow: 1048576,
      maxOutputTokens: 131072,
    })
    expect(store.get('gateway/glm-flash', 'route-b').contextWindow).toBe(
      2000000,
    )
    expect(
      store.get('gateway/glm-flash-next', 'route-b').contextWindow,
    ).toBeUndefined()
  })

  test('invalid metadata is ignored and duplicate ids use the smaller ceiling', () => {
    const store = new ModelRequestLimitsStore()
    store.replaceCatalog([
      {
        id: 'm',
        contextLength: 1000,
        topProvider: { contextLength: 800, maxCompletionTokens: NaN },
        maxCompletionTokens: 100,
      },
      { id: 'm', contextLength: Infinity, maxCompletionTokens: 50 },
      { id: 'bad', contextLength: -1, maxCompletionTokens: 1.5 },
    ])
    store.observe('route', { contextWindow: NaN, maxOutputTokens: -100 })
    expect(store.get('m', 'route')).toEqual({
      contextWindow: 800,
      maxOutputTokens: 50,
    })
    expect(store.get('bad', 'route')).toEqual({
      contextWindow: undefined,
      maxOutputTokens: undefined,
    })
    store.replaceCatalog([])
    expect(store.get('m', 'route').contextWindow).toBeUndefined()
    store.replaceCatalog(
      JSON.parse('[null,{"id":42},{"id":"valid","contextLength":2000}]'),
      'openrouter',
    )
    expect(store.get('openrouter/valid', 'route').contextWindow).toBe(2000)
  })

  test('parses the actual rejection and nested adapter response bodies', () => {
    expect(
      parseProviderTokenLimitError(new Error(RECORDED_BUDGET_ERROR)),
    ).toEqual({
      contextWindow: 1048576,
      inputTokens: 112977,
      maxOutputTokens: undefined,
    })
    expect(
      parseProviderTokenLimitError({
        message: 'Bad Request',
        responseBody: JSON.stringify({
          error: { message: RECORDED_BUDGET_ERROR },
        }),
      })?.inputTokens,
    ).toBe(112977)
    expect(
      parseProviderTokenLimitError({
        message:
          'maximum context length is 8192 tokens, including 7000 tokens in the messages',
      })?.contextWindow,
    ).toBe(8192)
    expect(
      parseProviderTokenLimitError({ message: 'max_tokens must be <= 131072' })
        ?.maxOutputTokens,
    ).toBe(131072)
  })

  test('does not learn arbitrary numbers or malformed token limits', () => {
    for (const error of [
      null,
      400,
      { statusCode: 400 },
      new Error('HTTP 429: try again in 1048576 ms'),
      new Error('accepts at most 0 combined input and output tokens'),
    ]) {
      expect(parseProviderTokenLimitError(error)).toBeUndefined()
    }
  })
})
