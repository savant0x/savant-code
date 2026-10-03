import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { getModelForRequest } from '../model-provider'

import type { LanguageModelV2 } from '@ai-sdk/provider'

const envNames = [
  'CODECRAFT_API_KEY',
  'XKIRO_API_KEY',
  'CLEANAPIS_API_KEY',
] as const
const originalFetch = globalThis.fetch
const prompt = [
  { role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] },
]
const cases = [
  [
    'codecraft',
    'CodeCraft',
    'CODECRAFT_API_KEY',
    'gpt-5.6-luna',
    'https://codecraftapi.com/v1',
  ],
  [
    'cleanapis',
    'Clean APIs',
    'CLEANAPIS_API_KEY',
    'cleanapis/router',
    'https://cleanapis.com/v1',
  ],
  [
    'xkiro',
    'xKiro',
    'XKIRO_API_KEY',
    'qwen/future-model:free',
    'https://api.xkiro.com/v1',
  ],
] as const

describe('CodeCraft, xKiro, CleanAPIs SDK routing (FID-2026-1003-001)', () => {
  let originalEnv: Record<string, string | undefined>
  beforeEach(async () => {
    // Complete the one-shot local environment bootstrap before key deletion.
    await import('../model-provider')
    originalEnv = Object.fromEntries(
      envNames.map((name) => [name, process.env[name]]),
    )
    for (const name of envNames) delete process.env[name]
  })
  afterEach(() => {
    for (const name of envNames) {
      if (originalEnv[name] === undefined) delete process.env[name]
      else process.env[name] = originalEnv[name]
    }
    globalThis.fetch = originalFetch
    mock.restore()
  })

  for (const [provider, label, envVar, upstreamId, baseUrl] of cases) {
    test(`${provider} requires its own credential, including an empty placeholder`, async () => {
      process.env[envVar] = ''
      await expect(
        getModelForRequest({ model: `${provider}/${upstreamId}` }),
      ).rejects.toThrow(
        `${label} API key not set. Set ${envVar} environment variable or run /provider ${provider}.`,
      )
    })

    test(`${provider} sends chat tools and strips exactly one internal namespace`, async () => {
      process.env[envVar] = 'dummy-key'
      const fetchMock = mock(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response('data: [DONE]\n\n', {
            headers: { 'content-type': 'text/event-stream' },
          }),
      )
      globalThis.fetch = Object.assign(fetchMock, {
        preconnect: originalFetch.preconnect,
      })
      const result = await getModelForRequest({
        model: `${provider}/${upstreamId}`,
      })
      await (result.model as LanguageModelV2).doStream({
        prompt,
        tools: [
          {
            type: 'function',
            name: 'ping',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      })
      const [input, init] = fetchMock.mock.calls[0]
      expect(String(input)).toBe(`${baseUrl}/chat/completions`)
      expect(new Headers(init?.headers).get('authorization')).toBe(
        'Bearer dummy-key',
      )
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe(upstreamId)
      expect(body.stream).toBe(true)
      expect(body.tools[0].function.name).toBe('ping')
    })
  }

  test('xKiro Anthropic IDs use the installed Messages SDK with full vendor ID', async () => {
    process.env.XKIRO_API_KEY = 'dummy-key'
    const fetchMock = mock(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('', { headers: { 'content-type': 'text/event-stream' } }),
    )
    globalThis.fetch = Object.assign(fetchMock, {
      preconnect: originalFetch.preconnect,
    })
    const result = await getModelForRequest({
      model: 'xkiro/anthropic/future-claude',
    })
    await (result.model as LanguageModelV2).doStream({
      prompt,
      tools: [
        {
          type: 'function',
          name: 'ping',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    })
    const [input, init] = fetchMock.mock.calls[0]
    expect(String(input)).toBe('https://api.xkiro.com/v1/messages')
    expect(new Headers(init?.headers).get('x-api-key')).toBe('dummy-key')
    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe('anthropic/future-claude')
    expect(body.stream).toBe(true)
    expect(body.tools[0].name).toBe('ping')
    expect(body.tools[0].input_schema).toEqual({
      type: 'object',
      properties: {},
    })
  })
})
