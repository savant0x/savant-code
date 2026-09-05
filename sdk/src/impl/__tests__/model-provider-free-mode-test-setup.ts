// Shared test harness for the model-provider free-mode test family.
// Sibling of the Loop 325 decomposition: each suite file calls
// setupModelProviderTestHarness() inside its describe block to register
// the env save/restore + module-mock lifecycle and get the importFresh
// helper. Lives in the same directory so `../../credentials` and
// `../model-provider` resolve identically to the original monolith.

import {
  clearMockedModules,
  mockModule,
} from '@savant-code/common/testing/mock-modules'
import { beforeEach, afterEach, mock } from 'bun:test'

export const REAL_FETCH = globalThis.fetch
export const COMMAND_CODE_MODEL = 'commandcode/deepseek/deepseek-v4-pro'
export const COMMAND_CODE_CLAUDE_MODEL = 'commandcode/claude-sonnet-4.6'
export const TOKEN_HARBOR_MODEL = 'tokenharbor/anthropic/claude-opus-5'
export const NOUS_MODEL = 'nous/anthropic/claude-sonnet-4.6'
export const ZEN_CHAT_MODEL = 'opencode-zen/glm-5.3'
export const ZEN_CLAUDE_MODEL = 'opencode-zen/claude-sonnet-4-6'
export const ZEN_RESPONSES_MODEL = 'opencode-zen/gpt-5.5'
export const ZEN_GEMINI_MODEL = 'opencode-zen/gemini-3-flash'
export const COMMAND_CODE_PROMPT = [
  {
    role: 'user' as const,
    content: [{ type: 'text' as const, text: 'test' }],
  },
]

export function setupModelProviderTestHarness() {
  const mockGetValidChatGptOAuthCredentials = mock(() => Promise.resolve(null))
  let originalCommandCodeApiKey: string | undefined
  let originalOpencodeZenApiKey: string | undefined
  let originalOpencodeGoApiKey: string | undefined
  let originalTokenHarborApiKey: string | undefined
  let originalNousApiKey: string | undefined
  let originalOpenRouterApiKey: string | undefined
  let originalOrMasterKey: string | undefined
  let originalInferenceApiKey: string | undefined
  let originalDirectProvider: string | undefined
  let originalInferenceBaseUrl: string | undefined

  beforeEach(async () => {
    originalCommandCodeApiKey = process.env.COMMAND_CODE_API_KEY
    delete process.env.COMMAND_CODE_API_KEY
    originalOpencodeZenApiKey = process.env.OPENCODE_API_KEY
    delete process.env.OPENCODE_API_KEY
    originalOpencodeGoApiKey = process.env.OPENCODE_GO_API_KEY
    delete process.env.OPENCODE_GO_API_KEY
    originalTokenHarborApiKey = process.env.TOKENHARBOR_API_KEY
    delete process.env.TOKENHARBOR_API_KEY
    originalNousApiKey = process.env.NOUS_API_KEY
    delete process.env.NOUS_API_KEY
    originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY
    originalOrMasterKey = process.env.OR_MASTER_KEY
    originalInferenceApiKey = process.env.INFERENCE_API_KEY
    originalDirectProvider = process.env.DIRECT_PROVIDER
    originalInferenceBaseUrl = process.env.INFERENCE_BASE_URL
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OR_MASTER_KEY
    delete process.env.INFERENCE_API_KEY
    delete process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
    const { resetOpenRouterApiKeyCache } =
      await import('../openrouter-key-resolver')
    resetOpenRouterApiKeyCache()
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
    if (originalOpencodeZenApiKey === undefined) {
      delete process.env.OPENCODE_API_KEY
    } else {
      process.env.OPENCODE_API_KEY = originalOpencodeZenApiKey
    }
    if (originalOpencodeGoApiKey === undefined) {
      delete process.env.OPENCODE_GO_API_KEY
    } else {
      process.env.OPENCODE_GO_API_KEY = originalOpencodeGoApiKey
    }
    if (originalTokenHarborApiKey === undefined) {
      delete process.env.TOKENHARBOR_API_KEY
    } else {
      process.env.TOKENHARBOR_API_KEY = originalTokenHarborApiKey
    }
    if (originalNousApiKey === undefined) {
      delete process.env.NOUS_API_KEY
    } else {
      process.env.NOUS_API_KEY = originalNousApiKey
    }
    if (originalOpenRouterApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey
    }
    if (originalOrMasterKey === undefined) {
      delete process.env.OR_MASTER_KEY
    } else {
      process.env.OR_MASTER_KEY = originalOrMasterKey
    }
    if (originalInferenceApiKey === undefined) {
      delete process.env.INFERENCE_API_KEY
    } else {
      process.env.INFERENCE_API_KEY = originalInferenceApiKey
    }
    if (originalDirectProvider === undefined) {
      delete process.env.DIRECT_PROVIDER
    } else {
      process.env.DIRECT_PROVIDER = originalDirectProvider
    }
    if (originalInferenceBaseUrl === undefined) {
      delete process.env.INFERENCE_BASE_URL
    } else {
      process.env.INFERENCE_BASE_URL = originalInferenceBaseUrl
    }
    clearMockedModules()
  })

  async function importFresh() {
    const mod = await import('../model-provider')
    // Ensure clean rate-limit state
    mod.resetChatGptOAuthRateLimit()
    return mod
  }

  return { mockGetValidChatGptOAuthCredentials, importFresh }
}
