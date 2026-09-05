import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { applyPersistedDirectProviderSettings } from '../ollama-onboarding'
import {
  PROVIDER_SETUP_CONFIG,
  RESEARCH_KEY_SERVICES,
  applyPersistedProviderApiKeys,
  configureDefaultDirectProvider,
  getMissingProviderSetup,
  getProviderSetupGuidance,
  getProviderSetupInfo,
  saveProviderApiKey,
} from '../provider-setup'
import { saveSettings } from '../settings'

// Derived from the live config surfaces so a newly added provider or
// research service can never be forgotten here — the hand-maintained list
// missed KIOSAPI_API_KEY and leaked it into the suite (FID-2026-0905-006):
// the one-configured-provider self-selection then resolved kiosapi instead
// of the openrouter bootstrap default.
const PROVIDER_ENV_VARS = [
  ...Object.values(PROVIDER_SETUP_CONFIG).map((config) => config.envVar),
  ...Object.values(RESEARCH_KEY_SERVICES).map((service) => service.envVar),
  'DIRECT_PROVIDER',
  'INFERENCE_BASE_URL',
  'SAVANT_CODE_API_KEY',
] as const

describe('provider setup', () => {
  let originalConfigDir: string | undefined
  let tempDir: string
  let originalEnv: Partial<
    Record<(typeof PROVIDER_ENV_VARS)[number], string | undefined>
  >

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-provider-setup-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    originalEnv = Object.fromEntries(
      PROVIDER_ENV_VARS.map((name) => [name, process.env[name]]),
    )
    for (const name of PROVIDER_ENV_VARS) delete process.env[name]
  })

  afterEach(() => {
    for (const name of PROVIDER_ENV_VARS) {
      const value = originalEnv[name]
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('rejects an empty provider key', () => {
    expect(() => saveProviderApiKey('opencode-go', '  ')).toThrow(
      'Provider API key cannot be empty.',
    )
    expect(fs.existsSync(path.join(tempDir, 'credentials.json'))).toBe(false)
  })

  test('restores direct mode from a persisted provider key', () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { OPENCODE_API_KEY: 'stored-key' },
      }),
    )

    applyPersistedProviderApiKeys()

    expect(process.env.DIRECT_PROVIDER).toBe('opencode-go')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://opencode.ai/zen/go/v1')
  })

  test('configures the default gateway without inventing a provider key', () => {
    configureDefaultDirectProvider()

    expect(process.env.DIRECT_PROVIDER).toBe('openrouter')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://openrouter.ai/api/v1')
    expect(process.env.OPENROUTER_API_KEY).toBeUndefined()
  })

  test('does not override an explicit direct provider or backend token', () => {
    process.env.DIRECT_PROVIDER = 'ollama'
    process.env.INFERENCE_BASE_URL = 'http://localhost:11434/v1'

    configureDefaultDirectProvider()

    expect(process.env.DIRECT_PROVIDER).toBe('ollama')
    expect(process.env.INFERENCE_BASE_URL).toBe('http://localhost:11434/v1')
  })

  test('saved gateway key takes precedence over persisted Ollama mode', () => {
    saveSettings({
      directProvider: 'ollama',
      directProviderBaseUrl: 'http://localhost:11434/v1',
    })

    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { OPENCODE_API_KEY: 'stored-key' },
      }),
    )

    // Startup restores provider keys before persisted Ollama settings. This
    // test mirrors that ordering and ensures the key wins.
    applyPersistedProviderApiKeys()
    applyPersistedDirectProviderSettings()

    expect(process.env.DIRECT_PROVIDER).toBe('opencode-go')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://opencode.ai/zen/go/v1')
  })

  test('identifies missing setup only for the active gateway provider', () => {
    process.env.DIRECT_PROVIDER = 'opencode-go'

    const missing = getMissingProviderSetup()

    expect(missing?.provider).toBe('opencode-go')
    if (!missing) throw new Error('Expected missing provider setup')
    const guidance = getProviderSetupGuidance(missing)
    expect(guidance).toContain('/provider opencode-go')
    expect(guidance).toContain('OPENCODE_API_KEY')

    process.env.OPENCODE_API_KEY = 'shell-key'
    expect(getMissingProviderSetup()).toBeUndefined()
  })

  test('bypasses gateway guidance for Ollama and backend auth', () => {
    process.env.DIRECT_PROVIDER = 'ollama'
    expect(getMissingProviderSetup()).toBeUndefined()

    delete process.env.DIRECT_PROVIDER
    process.env.SAVANT_CODE_API_KEY = 'backend-key'
    expect(getMissingProviderSetup()).toBeUndefined()
  })

  test('returns setup metadata for supported providers only', () => {
    expect(getProviderSetupInfo('OpenRouter')).toMatchObject({
      provider: 'openrouter',
      envVar: 'OPENROUTER_API_KEY',
    })
    expect(getProviderSetupInfo('OpenCode-Go')).toMatchObject({
      provider: 'opencode-go',
      envVar: 'OPENCODE_API_KEY',
    })
    expect(getProviderSetupInfo('TokenHarbor')).toMatchObject({
      provider: 'tokenharbor',
      envVar: 'TOKENHARBOR_API_KEY',
      baseUrl: 'https://tokenharbor.ai/v1',
    })
    expect(getProviderSetupInfo('Nous')).toMatchObject({
      provider: 'nous',
      envVar: 'NOUS_API_KEY',
      baseUrl: 'https://inference-api.nousresearch.com/v1',
    })
    expect(getProviderSetupInfo('unknown')).toBeUndefined()
  })
})
