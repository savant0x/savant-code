import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  PROVIDER_SETUP_CONFIG,
  RESEARCH_KEY_SERVICES,
  activateConfiguredProvider,
  applyPersistedProviderApiKeys,
  configureDefaultDirectProvider,
  getConfiguredProviderNames,
  getMissingProviderSetup,
  getProviderSetupGuidance,
  saveProviderApiKey,
} from '../provider-setup'
import { saveSettings } from '../settings'

// Derived (rationale in provider-setup-gateway.test.ts — FID-2026-0905-006).
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

  test('saves the provider key in credentials.json and loads it for the current process', () => {
    saveProviderApiKey('opencode-go', '  test-opencode-key  ')

    expect(process.env.OPENCODE_API_KEY).toBe('test-opencode-key')
    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    )
    expect(credentials.providerApiKeys.OPENCODE_API_KEY).toBe(
      'test-opencode-key',
    )
    expect(credentials.providerApiKeys.OPENCODE_API_KEY).not.toContain('  ')
    expect(getConfiguredProviderNames()).toContain('opencode-go')
  })

  test('activates Nous from an existing shell key without requiring setup input', () => {
    process.env.NOUS_API_KEY = 'env-nous-key'

    expect(activateConfiguredProvider('nous')).toBe(true)
    expect(process.env.DIRECT_PROVIDER).toBe('nous')
    expect(process.env.INFERENCE_BASE_URL).toBe(
      'https://inference-api.nousresearch.com/v1',
    )
    expect(
      JSON.parse(fs.readFileSync(path.join(tempDir, 'settings.json'), 'utf8'))
        .activeProvider,
    ).toBe('nous')
    expect(fs.existsSync(path.join(tempDir, 'credentials.json'))).toBe(false)
  })

  test('leaves an explicit route untouched when the selected provider is unconfigured', () => {
    process.env.DIRECT_PROVIDER = 'ollama'
    process.env.INFERENCE_BASE_URL = 'https://custom.example/v1'

    expect(activateConfiguredProvider('nous')).toBe(false)
    expect(process.env.DIRECT_PROVIDER).toBe('ollama')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://custom.example/v1')
  })

  test('persisted active provider wins over a different configured environment key at startup', () => {
    saveSettings({ activeProvider: 'tokenharbor' })
    process.env.NOUS_API_KEY = 'env-nous-key'

    configureDefaultDirectProvider()

    expect(process.env.DIRECT_PROVIDER).toBe('tokenharbor')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://tokenharbor.ai/v1')
  })

  test('saves Nous credentials for direct-provider mode', () => {
    saveProviderApiKey('nous', '  test-nous-key  ')

    expect(process.env.NOUS_API_KEY).toBe('test-nous-key')
    expect(process.env.DIRECT_PROVIDER).toBe('nous')
    expect(process.env.INFERENCE_BASE_URL).toBe(
      'https://inference-api.nousresearch.com/v1',
    )
    expect(getConfiguredProviderNames()).toContain('nous')
  })

  test('saves TokenHarbor credentials for direct-provider mode', () => {
    saveProviderApiKey('tokenharbor', '  test-tokenharbor-key  ')

    expect(process.env.TOKENHARBOR_API_KEY).toBe('test-tokenharbor-key')
    expect(process.env.DIRECT_PROVIDER).toBe('tokenharbor')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://tokenharbor.ai/v1')
    expect(getConfiguredProviderNames()).toContain('tokenharbor')
  })

  test('saves OpenRouter credentials for direct-provider mode', () => {
    saveProviderApiKey('openrouter', '  test-openrouter-key  ')

    expect(process.env.OPENROUTER_API_KEY).toBe('test-openrouter-key')
    expect(process.env.DIRECT_PROVIDER).toBe('openrouter')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://openrouter.ai/api/v1')
    expect(getConfiguredProviderNames()).toContain('openrouter')
  })

  test('persists the selection as activeProvider without legacy direct fields (Phase 4)', () => {
    saveProviderApiKey('tokenharbor', 'test-tokenharbor-key')

    const persisted = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'settings.json'), 'utf8'),
    )
    expect(persisted.activeProvider).toBe('tokenharbor')
    expect(persisted.savantCodeModelProviderPreference).toBe('tokenharbor')
    // Legacy gateway routing fields are no longer persisted — the registry
    // derives the base URL from activeProvider (FID-2026-0809-001 Phase 4).
    expect(persisted.directProvider).toBeUndefined()
    expect(persisted.directProviderBaseUrl).toBeUndefined()
  })

  test('configureDefaultDirectProvider routes from the persisted activeProvider', () => {
    saveSettings({ activeProvider: 'tokenharbor' })

    configureDefaultDirectProvider()

    expect(process.env.DIRECT_PROVIDER).toBe('tokenharbor')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://tokenharbor.ai/v1')
  })

  test('getMissingProviderSetup follows the persisted activeProvider', () => {
    saveSettings({ activeProvider: 'opencode-go' })

    const missing = getMissingProviderSetup()

    expect(missing?.provider).toBe('opencode-go')
    const guidance = getProviderSetupGuidance(
      missing as NonNullable<typeof missing>,
    )
    expect(guidance).toContain('/provider opencode-go')
  })

  test('preserves an explicit shell key and routing when replacing a provider key', () => {
    process.env.OPENROUTER_API_KEY = 'shell-key'
    process.env.DIRECT_PROVIDER = 'ollama'
    process.env.INFERENCE_BASE_URL = 'https://custom.example/v1'

    saveProviderApiKey('openrouter', 'stored-key')

    expect(process.env.OPENROUTER_API_KEY).toBe('shell-key')
    expect(process.env.DIRECT_PROVIDER).toBe('ollama')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://custom.example/v1')
    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    )
    expect(credentials.providerApiKeys.OPENROUTER_API_KEY).toBe('stored-key')
  })

  test('fills the registered base URL when the selected provider is already explicit', () => {
    process.env.DIRECT_PROVIDER = 'openrouter'

    saveProviderApiKey('openrouter', 'stored-key')

    expect(process.env.DIRECT_PROVIDER).toBe('openrouter')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://openrouter.ai/api/v1')
  })

  test('preserves a custom endpoint when no provider is explicit', () => {
    process.env.INFERENCE_BASE_URL = 'https://custom.example/v1'

    saveProviderApiKey('openrouter', 'stored-key')

    expect(process.env.DIRECT_PROVIDER).toBeUndefined()
    expect(process.env.INFERENCE_BASE_URL).toBe('https://custom.example/v1')
  })

  test('restores persisted keys without overriding an explicit environment variable', () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: {
          OPENCODE_API_KEY: 'stored-key',
          TOKENHARBOR_API_KEY: 'stored-tokenharbor-key',
          NVIDIA_API_KEY: 'stored-nvidia-key',
        },
      }),
    )
    process.env.OPENCODE_API_KEY = 'shell-key'

    applyPersistedProviderApiKeys()

    expect(process.env.OPENCODE_API_KEY).toBe('shell-key')
    expect(process.env.TOKENHARBOR_API_KEY).toBe('stored-tokenharbor-key')
    expect(process.env.NVIDIA_API_KEY).toBe('stored-nvidia-key')
  })
})
