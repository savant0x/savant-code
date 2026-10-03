import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { getModelForRequest as requestModel } from '../model-provider'

async function getModelForRequest(params: Parameters<typeof requestModel>[0]) {
  const result = await requestModel(params)
  if (typeof result.model === 'string')
    throw new Error('Expected a resolved model')
  return { ...result, model: result.model }
}

const ENV_NAMES = [
  'DIRECT_PROVIDER',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'NVIDIA_API_KEY',
  'OR_MASTER_KEY',
  'INFERENCE_API_KEY',
  'INFERENCE_BASE_URL',
] as const
const saved = new Map<string, string | undefined>()
const originalFetch = globalThis.fetch

beforeEach(() => {
  for (const name of ENV_NAMES) {
    saved.set(name, process.env[name])
    delete process.env[name]
  }
  process.env.DIRECT_PROVIDER = 'openrouter'
  process.env.OPENROUTER_API_KEY = 'test-router'
  process.env.OPENAI_API_KEY = 'test-platform'
})
afterEach(() => {
  for (const name of ENV_NAMES) {
    const value = saved.get(name)
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  globalThis.fetch = originalFetch
})

describe('explicit serving route', () => {
  test('the OpenRouter upstream vendor never captures the serving route', async () => {
    const result = await getModelForRequest({
      model: 'openai/gpt-5',
      modelRoute: captureModelRoute('openrouter'),
    })
    expect(result.isChatGptOAuth).toBe(false)
    expect(result.model.provider).toBe('openrouter')
    expect(result.model.modelId).toBe('openai/gpt-5')
  })

  test('direct OpenAI uses its own Responses route for both full and bare IDs', async () => {
    for (const model of ['openai/gpt-5', 'gpt-5']) {
      const result = await getModelForRequest({
        model,
        modelRoute: captureModelRoute('openai'),
      })
      expect(result.model.provider).toBe('openai.responses')
      expect(result.model.modelId).toBe('gpt-5')
    }
  })

  test('keeps real OpenRouter slugs unchanged', async () => {
    const result = await getModelForRequest({
      model: 'openrouter/free',
      modelRoute: captureModelRoute('openrouter'),
    })
    expect(result.model.modelId).toBe('openrouter/free')
  })

  test('a missing selected key cannot borrow a platform credential', async () => {
    delete process.env.OPENROUTER_API_KEY
    await expect(
      getModelForRequest({
        model: 'openai/gpt-5',
        modelRoute: captureModelRoute('openrouter'),
      }),
    ).rejects.toThrow('OpenRouter')
  })

  test('rejects unknown providers and a foreign OAuth auth lane', () => {
    expect(() => captureModelRoute('not-registered')).toThrow('unavailable')
    expect(() => captureModelRoute('openrouter', 'chatgpt-oauth')).toThrow(
      'OpenAI',
    )
  })

  test('NVIDIA strips only its own prefix', async () => {
    process.env.NVIDIA_API_KEY = 'test-nim'
    const result = await getModelForRequest({
      model: 'nvidia/meta/llama',
      modelRoute: captureModelRoute('nvidia'),
    })
    expect(result.model.provider).toBe('nvidia')
    expect(result.model.modelId).toBe('meta/llama')
  })

  test('transport receives the selected endpoint, credential and unchanged upstream ID', async () => {
    let observedUrl = ''
    let authorization = ''
    let modelId = ''
    const transport = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      observedUrl = String(input)
      authorization = new Headers(init?.headers).get('authorization') ?? ''
      const body = JSON.parse(String(init?.body)) as { model: string }
      modelId = body.model
      return Response.json({
        id: 'test',
        object: 'chat.completion',
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ok' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })
    }
    globalThis.fetch = Object.assign(transport, {
      preconnect: originalFetch.preconnect,
    })
    const result = await getModelForRequest({
      model: 'openai/gpt-5',
      modelRoute: captureModelRoute('openrouter'),
    })
    await result.model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    })
    expect(observedUrl).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(authorization).toBe('Bearer test-router')
    expect(modelId).toBe('openai/gpt-5')
  })
})
