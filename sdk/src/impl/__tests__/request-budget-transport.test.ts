import { modelRequestLimits } from '@savant-code/common/util/model-request-limits'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { z } from 'zod/v4'

import { promptAiSdk, promptAiSdkStructured } from '../llm/prompts'
import { promptAiSdkStream } from '../llm/stream'
import { getModelForRequest } from '../model-provider'

import type { LanguageModelV2 } from '@ai-sdk/provider'
import type { PromptAiSdkFn } from '@savant-code/common/types/contracts/llm'
import type { ParamsOf } from '@savant-code/common/types/function-params'

const realFetch = globalThis.fetch
const modelId = 'tokenrouter/deepseek/deepseek-v4-pro'
let originalKey: string | undefined
let originalActive: string | undefined
let originalUrl: string | undefined
let originalMasterKey: string | undefined
let originalOpenRouterKey: string | undefined
let originalInferenceKey: string | undefined
let bodies: Array<{
  model: string
  max_tokens?: number
  messages: object[]
  response_format?: object
}>

function parameters(): ParamsOf<PromptAiSdkFn> {
  return {
    model: modelId,
    contextWindow: 2000,
    maxOutputTokens: 1900,
    runId: 'budget-run',
    clientSessionId: 'budget-client',
    fingerprintId: 'budget-fingerprint',
    userId: undefined,
    userInputId: 'budget-input',
    signal: new AbortController().signal,
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'input '.repeat(600) }] },
    ],
    sendAction: async () => {},
    trackEvent: async () => {},
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    maxRetries: 0,
  }
}

function sseResponse(text: string): Response {
  return new Response(
    'data: ' +
      JSON.stringify({
        id: 'budget-response',
        created: 1,
        model: 'fixture',
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
      }) +
      '\n\ndata: ' +
      JSON.stringify({
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 1,
          total_tokens: 1001,
        },
      }) +
      '\n\ndata: [DONE]\n\n',
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
}

function installFetch(stream = false, text = 'ok', firstError?: string) {
  const fetchMock = mock(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      if (firstError && bodies.length === 1)
        return new Response(
          JSON.stringify({ error: { message: firstError } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      if (stream) return sseResponse(text)
      return new Response(
        JSON.stringify({
          id: 'budget-response',
          created: 1,
          model: 'fixture',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: text },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 1,
            total_tokens: 1001,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    },
  )
  // Bun's fetch mock implements the transport contract; it lacks Bun.preconnect.
  globalThis.fetch = Object.assign(fetchMock, {
    preconnect: realFetch.preconnect,
  })
  return fetchMock
}

describe('request budget through actual SDK transport', () => {
  beforeEach(() => {
    originalKey = process.env.TOKENROUTER_API_KEY
    originalActive = process.env.DIRECT_PROVIDER
    originalUrl = process.env.INFERENCE_BASE_URL
    originalMasterKey = process.env.OR_MASTER_KEY
    originalOpenRouterKey = process.env.OPENROUTER_API_KEY
    originalInferenceKey = process.env.INFERENCE_API_KEY
    delete process.env.OR_MASTER_KEY
    delete process.env.OPENROUTER_API_KEY
    process.env.TOKENROUTER_API_KEY = 'budget-test-key'
    bodies = []
    modelRequestLimits.replaceCatalog([
      { id: modelId, contextLength: 2000, maxCompletionTokens: 1900 },
    ])
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    modelRequestLimits.replaceCatalog([])
    for (const [key, value] of [
      ['TOKENROUTER_API_KEY', originalKey],
      ['DIRECT_PROVIDER', originalActive],
      ['INFERENCE_BASE_URL', originalUrl],
      ['OR_MASTER_KEY', originalMasterKey],
      ['OPENROUTER_API_KEY', originalOpenRouterKey],
      ['INFERENCE_API_KEY', originalInferenceKey],
    ] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  test('normal generation clamps the serialized max_tokens and preserves model routing', async () => {
    installFetch()
    const result = await promptAiSdk(parameters())
    expect(result).toEqual({ aborted: false, value: 'ok' })
    expect(bodies).toHaveLength(1)
    expect(bodies[0].model).toBe('deepseek/deepseek-v4-pro')
    expect(bodies[0].max_tokens).toBeGreaterThan(0)
    expect(bodies[0].max_tokens).toBeLessThan(1900)
    expect(bodies[0].messages).toHaveLength(1)
  })

  test('structured generation counts schema instructions and preserves caller output ceilings', async () => {
    installFetch(false, '{"answer":"ok"}')
    const { maxOutputTokens: _cap, ...params } = parameters()
    const result = await promptAiSdkStructured({
      ...params,
      maxTokens: 100,
      schema: z.object({ answer: z.string() }),
    })
    expect(result).toEqual({ aborted: false, value: { answer: 'ok' } })
    expect(bodies[0].max_tokens).toBe(100)
    expect(bodies[0].response_format).toBeDefined()
  })

  test('streaming clamps the actual wire request before any text is delivered', async () => {
    installFetch(true)
    const stream = promptAiSdkStream(parameters())
    expect((await stream.next()).value).toMatchObject({
      type: 'text',
      text: 'ok',
    })
    while (!(await stream.next()).done) {
      /* drain completion telemetry */
    }
    expect(bodies).toHaveLength(1)
    expect(bodies[0].max_tokens).toBeGreaterThan(0)
    expect(bodies[0].max_tokens).toBeLessThan(1900)
  })

  test('a different subagent model uses its own catalog when no run cap is supplied', async () => {
    installFetch(true)
    const child = 'tokenrouter/z-ai/glm-5.2'
    modelRequestLimits.replaceCatalog([
      { id: child, contextLength: 2000, maxCompletionTokens: 300 },
    ])
    const result = await getModelForRequest({
      model: child,
      skipChatGptOAuth: true,
    })
    if (typeof result.model === 'string')
      throw new Error('Expected resolved model')
    await result.model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'child' }] }],
    })
    expect(bodies[0].max_tokens).toBe(300)
  })

  test('a bare-slug active provider shares the exact catalog identity', async () => {
    process.env.DIRECT_PROVIDER = 'tokenrouter'
    // FID-2026-1003-006: a custom INFERENCE_BASE_URL endpoint owns its
    // credential — the request is authorized by INFERENCE_API_KEY alone.
    process.env.INFERENCE_API_KEY = 'budget-endpoint-key'
    process.env.INFERENCE_BASE_URL = 'https://budget-fixture.invalid/v1'
    installFetch(true)
    const result = await getModelForRequest({
      model: 'deepseek/deepseek-v4-pro',
      skipChatGptOAuth: true,
    })
    if (typeof result.model === 'string')
      throw new Error('Expected resolved model')
    await result.model.doStream({
      prompt: [{ role: 'system', content: 'input '.repeat(600) }],
    })
    expect(bodies[0].max_tokens).toBeLessThan(1900)
  })

  test('a real HTTP 400 correction changes the wire allowance once', async () => {
    const error =
      'This model configuration accepts at most 1500 combined input and output tokens. However, your request has 1200 input tokens and asks for 1900 output tokens.'
    const fetchMock = installFetch(true, 'ok', error)
    process.env.DIRECT_PROVIDER = 'tokenrouter'
    process.env.INFERENCE_API_KEY = 'budget-endpoint-key'
    process.env.INFERENCE_BASE_URL =
      'https://budget-recovery-fixture.invalid/v1'
    const result = await getModelForRequest({
      model: 'deepseek/deepseek-v4-pro',
      skipChatGptOAuth: true,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Resume' }] }],
      maxOutputTokens: 1900,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(bodies[1].max_tokens).toBe(285)
  })

  test('active OpenRouter reads its serving namespace for a bare vendor model', async () => {
    process.env.DIRECT_PROVIDER = 'openrouter'
    process.env.OPENROUTER_API_KEY = 'budget-openrouter-test-key'
    // FID-2026-1003-006: the custom endpoint's own credential authorizes the
    // request; the OpenRouter key stays in its own lane.
    process.env.INFERENCE_API_KEY = 'budget-endpoint-key'
    process.env.INFERENCE_BASE_URL =
      'https://budget-openrouter-fixture.invalid/v1'
    modelRequestLimits.replaceCatalog([
      {
        id: 'z-ai/fixture-flash',
        provider: 'openrouter',
        contextLength: 2000,
        maxCompletionTokens: 300,
      },
    ])
    installFetch(true)
    const result = await getModelForRequest({
      model: 'z-ai/fixture-flash',
      skipChatGptOAuth: true,
    })
    if (typeof result.model === 'string')
      throw new Error('Expected resolved model')
    await result.model.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Resume' }] }],
    })
    expect(bodies[0].model).toBe('z-ai/fixture-flash')
    expect(bodies[0].max_tokens).toBe(300)
  })
})
