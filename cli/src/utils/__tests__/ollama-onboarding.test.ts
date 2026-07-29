import { describe, expect, test, beforeEach, afterEach } from 'bun:test'

import {
  __resetOllamaAutoConfigured,
  applyPersistedDirectProviderSettings,
  detectOllamaAndConfigureDirectProvider,
  isOllamaAutoConfigured,
} from '../ollama-onboarding'
import { saveSettings } from '../settings'

// Prevent side effects on the real settings file during tests.
const originalEnvDirectProvider = process.env.DIRECT_PROVIDER
const originalEnvBaseUrl = process.env.INFERENCE_BASE_URL

describe('ollama-onboarding', () => {
  beforeEach(() => {
    delete process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
    __resetOllamaAutoConfigured()
    saveSettings({
      directProvider: undefined,
      directProviderBaseUrl: undefined,
    })
  })

  afterEach(() => {
    process.env.DIRECT_PROVIDER = originalEnvDirectProvider
    process.env.INFERENCE_BASE_URL = originalEnvBaseUrl
  })

  test('applyPersistedDirectProviderSettings restores Ollama config from settings', () => {
    saveSettings({
      directProvider: 'ollama',
      directProviderBaseUrl: 'http://localhost:11434/v1',
    })

    applyPersistedDirectProviderSettings()

    expect(process.env.DIRECT_PROVIDER).toBe('ollama')
    expect(process.env.INFERENCE_BASE_URL).toBe('http://localhost:11434/v1')
    expect(isOllamaAutoConfigured()).toBe(true)
  })

  test('applyPersistedDirectProviderSettings does nothing when no persisted provider', () => {
    applyPersistedDirectProviderSettings()

    expect(process.env.DIRECT_PROVIDER).toBeUndefined()
    expect(process.env.INFERENCE_BASE_URL).toBeUndefined()
    expect(isOllamaAutoConfigured()).toBe(false)
  })

  test('applyPersistedDirectProviderSettings does nothing when a backend token is present', () => {
    saveSettings({
      directProvider: 'ollama',
      directProviderBaseUrl: 'http://localhost:11434/v1',
    })
    process.env.SAVANT_CODE_API_KEY = 'test-backend-token'

    applyPersistedDirectProviderSettings()

    expect(process.env.DIRECT_PROVIDER).toBeUndefined()
    expect(process.env.INFERENCE_BASE_URL).toBeUndefined()
    expect(isOllamaAutoConfigured()).toBe(false)

    delete process.env.SAVANT_CODE_API_KEY
  })

  test('detectOllamaAndConfigureDirectProvider returns early when DIRECT_PROVIDER is already set', async () => {
    process.env.DIRECT_PROVIDER = 'openrouter'

    await detectOllamaAndConfigureDirectProvider()

    expect(process.env.INFERENCE_BASE_URL).toBeUndefined()
    expect(isOllamaAutoConfigured()).toBe(false)
  })
})
