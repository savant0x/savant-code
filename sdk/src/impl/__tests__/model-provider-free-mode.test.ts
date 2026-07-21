import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'

describe('getModelForRequest ChatGPT OAuth fallback behavior', () => {
  const mockGetValidChatGptOAuthCredentials = mock(() =>
    Promise.resolve(null),
  )

  beforeEach(async () => {
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
})
