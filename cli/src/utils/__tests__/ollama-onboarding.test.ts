import fs from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test, beforeEach, afterEach } from 'bun:test'

import {
  __resetOllamaAutoConfigured,
  applyPersistedDirectProviderSettings,
  detectOllamaAndConfigureDirectProvider,
  isOllamaAutoConfigured,
  selectLocalOllamaModel,
} from '../ollama-onboarding'
import {
  DEFAULT_SAVANT_CODE_MODEL_ID,
  loadSettings,
  saveSettings,
} from '../settings'

// Prevent side effects on the real settings file during tests.
const originalEnvDirectProvider = process.env.DIRECT_PROVIDER
const originalEnvBaseUrl = process.env.INFERENCE_BASE_URL
const originalEnvApiKey = process.env.OPENCODE_GO_API_KEY
const originalEnvBackendToken = process.env.SAVANT_CODE_API_KEY
const originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
let tempConfigDir: string

describe('ollama-onboarding', () => {
  beforeEach(() => {
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-ollama-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempConfigDir
    delete process.env.DIRECT_PROVIDER
    delete process.env.INFERENCE_BASE_URL
    delete process.env.OPENCODE_GO_API_KEY
    delete process.env.SAVANT_CODE_API_KEY
    __resetOllamaAutoConfigured()
    saveSettings({
      directProvider: undefined,
      directProviderBaseUrl: undefined,
    })
  })

  afterEach(() => {
    process.env.DIRECT_PROVIDER = originalEnvDirectProvider
    process.env.INFERENCE_BASE_URL = originalEnvBaseUrl
    process.env.OPENCODE_GO_API_KEY = originalEnvApiKey
    process.env.SAVANT_CODE_API_KEY = originalEnvBackendToken
    if (originalConfigDir === undefined) delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempConfigDir, { recursive: true, force: true })
  })

  test.serial('selectLocalOllamaModel ignores cloud-backed and embedding entries', () => {
    expect(
      selectLocalOllamaModel([
        'cloud-model:cloud',
        'nomic-embed-text:latest',
        'local-coder:latest',
        'another-cloud:cloud',
      ]),
    ).toBe('local-coder:latest')
    expect(selectLocalOllamaModel(['cloud-model:cloud'])).toBeUndefined()
    expect(selectLocalOllamaModel(['nomic-embed-text:latest'])).toBeUndefined()
  })

  test.serial('applyPersistedDirectProviderSettings restores Ollama config from settings', () => {
    saveSettings({
      directProvider: 'ollama',
      directProviderBaseUrl: 'http://localhost:11434/v1',
    })

    applyPersistedDirectProviderSettings()

    expect(process.env.DIRECT_PROVIDER).toBe('ollama')
    expect(process.env.INFERENCE_BASE_URL).toBe('http://localhost:11434/v1')
    expect(isOllamaAutoConfigured()).toBe(true)
  })

  test.serial('applyPersistedDirectProviderSettings does nothing when no persisted provider', () => {
    applyPersistedDirectProviderSettings()

    expect(process.env.DIRECT_PROVIDER).toBeUndefined()
    expect(process.env.INFERENCE_BASE_URL).toBeUndefined()
    expect(isOllamaAutoConfigured()).toBe(false)
  })

  test.serial('applyPersistedDirectProviderSettings does nothing when a backend token is present', () => {
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

  test.serial('detectOllamaAndConfigureDirectProvider returns early when DIRECT_PROVIDER is already set', async () => {
    process.env.DIRECT_PROVIDER = 'openrouter'

    await detectOllamaAndConfigureDirectProvider()

    expect(process.env.INFERENCE_BASE_URL).toBeUndefined()
    expect(isOllamaAutoConfigured()).toBe(false)
  })

  test.serial('does not override an explicit non-default model with Ollama detection', async () => {
    saveSettings({
      savantCodeModelPreference: 'openrouter/gpt-5',
      savantCodeModelProviderPreference: 'openrouter',
      savantCodeModelAutoConfigured: false,
    })

    await detectOllamaAndConfigureDirectProvider(async () => ({
      available: true,
      host: 'http://localhost:11434',
      models: ['qwen2.5-coder:latest'],
    }))

    expect(process.env.DIRECT_PROVIDER).toBeUndefined()
    expect(loadSettings().savantCodeModelPreference).toBe('openrouter/gpt-5')
  })

  test.serial('clears persisted Ollama mode when no usable local model remains', async () => {
    saveSettings({
      directProvider: 'ollama',
      directProviderBaseUrl: 'http://localhost:11434/v1',
    })
    applyPersistedDirectProviderSettings()

    await detectOllamaAndConfigureDirectProvider(async () => ({
      available: true,
      host: 'http://localhost:11434',
      models: ['nomic-embed-text:latest', 'remote-model:cloud'],
    }))

    expect(process.env.DIRECT_PROVIDER).toBeUndefined()
    expect(process.env.INFERENCE_BASE_URL).toBeUndefined()
    expect(isOllamaAutoConfigured()).toBe(false)
    expect(loadSettings().directProvider).toBeUndefined()
    expect(loadSettings().directProviderBaseUrl).toBeUndefined()
    expect(loadSettings().savantCodeModelPreference).toBe(
      'opencode-go/mimo-v2.5',
    )
    expect(loadSettings().savantCodeModelProviderPreference).toBe('opencode-go')
    expect(loadSettings().savantCodeModelAutoConfigured).toBe(false)
  })

  test.serial('replaces a gateway preference with a local model during Ollama onboarding', async () => {
    saveSettings({
      savantCodeModelPreference: DEFAULT_SAVANT_CODE_MODEL_ID,
      savantCodeModelProviderPreference: 'opencode-go',
      savantCodeModelAutoConfigured: true,
    })

    await detectOllamaAndConfigureDirectProvider(async () => ({
      available: true,
      host: 'http://localhost:11434',
      models: ['qwen2.5-coder:latest'],
    }))

    expect(loadSettings().savantCodeModelPreference).toBe(
      'qwen2.5-coder:latest',
    )
  })

  test.serial('configures an explicitly selected Ollama model when its URL is missing', async () => {
    saveSettings({
      savantCodeModelPreference: 'llama3.2:latest',
      savantCodeModelProviderPreference: 'ollama',
      savantCodeModelAutoConfigured: false,
      directProvider: undefined,
      directProviderBaseUrl: undefined,
    })

    await detectOllamaAndConfigureDirectProvider(async () => ({
      available: true,
      host: 'http://localhost:11434',
      models: ['llama3.2:latest'],
    }))

    expect(process.env.DIRECT_PROVIDER).toBe('ollama')
    expect(process.env.INFERENCE_BASE_URL).toBe('http://localhost:11434/v1')
    expect(loadSettings().savantCodeModelPreference).toBe('llama3.2:latest')
  })

  test.serial('preserves an explicitly selected Ollama model', async () => {
    saveSettings({
      savantCodeModelPreference: 'llama3.2:latest',
      savantCodeModelProviderPreference: 'ollama',
      savantCodeModelAutoConfigured: false,
    })

    await detectOllamaAndConfigureDirectProvider(async () => ({
      available: true,
      host: 'http://localhost:11434',
      models: ['qwen2.5-coder:latest'],
    }))

    expect(loadSettings().savantCodeModelPreference).toBe(
      'llama3.2:latest',
    )
  })
})
