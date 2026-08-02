import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'

import type { LanguageModelV2 } from '@ai-sdk/provider'

const REAL_FETCH = globalThis.fetch
const COMMAND_CODE_MODEL = 'commandcode/deepseek/deepseek-v4-pro'
const COMMAND_CODE_CLAUDE_MODEL = 'commandcode/claude-sonnet-4.6'
const COMMAND_CODE_PROMPT = [
  {
    role: 'user' as const,
    content: [{ type: 'text' as const, text: 'test' }],
  },
]

describe('getModelForRequest ChatGPT OAuth fallback behavior', () => {
  const mockGetValidChatGptOAuthCredentials = mock(() => Promise.resolve(null))
  let originalCommandCodeApiKey: string | undefined

  beforeEach(async () => {
    originalCommandCodeApiKey = process.env.COMMAND_CODE_API_KEY
    delete process.env.COMMAND_CODE_API_KEY
    // Mock CHATGPT_OAUTH_ENABLED to true so the ChatGPT OAuth path is entered.
    // Uses mockModule helper since this is an absolute package specifier.
    await mockModule('@savant-code/common/constants/chatgpt-oauth', () => ({
      CHATGPT_OAUTH_ENABLED: true,
    }))

    // Mock credentials directly with Bun's mock.module — the helper resolves
    // relative paths from common/src/testing/, not from this test file.
    mock.module('../../credentials', () => ({
      getValidChatGptOAuthCredentials: mockGetValidChatGptOAuthCredentials,
    }))

    mockGetValidChatGptOAuthCredentials.mockReset()
    mockGetValidChatGptOAuthCredentials.mockResolvedValue(null)
  })

  afterEach(() => {
    mock.restore()
    globalThis.fetch = REAL_FETCH
    if (originalCommandCodeApiKey === undefined) {
      delete process.env.COMMAND_CODE_API_KEY
    } else {
      process.env.COMMAND_CODE_API_KEY = originalCommandCodeApiKey
    }
    clearMockedModules()
  })

  async function importFresh() {
    const mod = await import('../model-provider')
    // Ensure clean rate-limit state
    mod.resetChatGptOAuthRateLimit()
    return mod
  }

  test('falls through to backend when rate-limited', async () => {
    const { getModelForRequest, markChatGptOAuthRateLimited } =
      await importFresh()

    markChatGptOAuthRateLimited()

    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: 'openai/gpt-5.3',
    })

    expect(result.isChatGptOAuth).toBe(false)
  })

  test('falls through to backend when credentials unavailable', async () => {
    const { getModelForRequest } = await importFresh()

    mockGetValidChatGptOAuthCredentials.mockResolvedValue(null)

    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: 'openai/gpt-5.3',
    })

    expect(result.isChatGptOAuth).toBe(false)
  })

  test('requires the CommandCode API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({ apiKey: 'test-key', model: COMMAND_CODE_MODEL }),
    ).rejects.toThrow(
      'CommandCode API key not set. Set COMMAND_CODE_API_KEY environment variable.',
    )
  })

  test('routes CommandCode OpenAI models to chat completions with the namespaced ID', async () => {
    process.env.COMMAND_CODE_API_KEY = 'commandcode-test-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('data: [DONE]\\n\\n', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: COMMAND_CODE_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe(
      'https://api.commandcode.ai/provider/v1/chat/completions',
    )
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer commandcode-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe('deepseek/deepseek-v4-pro')
  })

  test('routes CommandCode Claude models to Anthropic messages with x-api-key', async () => {
    process.env.COMMAND_CODE_API_KEY = 'commandcode-test-key'
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('', {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    )
    // @ts-expect-error - test fetch has the same runtime contract
    globalThis.fetch = fetchMock

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      apiKey: 'test-key',
      model: COMMAND_CODE_CLAUDE_MODEL,
    })
    await (result.model as LanguageModelV2).doStream({
      prompt: COMMAND_CODE_PROMPT,
    })

    const [input, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit | undefined,
    ]
    expect(String(input)).toBe(
      'https://api.commandcode.ai/provider/v1/messages',
    )
    expect(new Headers(init?.headers).get('x-api-key')).toBe(
      'commandcode-test-key',
    )
    expect(JSON.parse(String(init?.body)).model).toBe('claude-sonnet-4.6')
  })
})
