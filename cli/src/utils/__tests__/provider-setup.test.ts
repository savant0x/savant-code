import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { applyPersistedDirectProviderSettings } from '../ollama-onboarding'
import {
  activateConfiguredProvider,
  applyPersistedProviderApiKeys,
  applyPersistedResearchApiKeys,
  beginResearchKeySetup,
  configureDefaultDirectProvider,
  getConfiguredProviderNames,
  getMissingProviderSetup,
  getProviderSetupGuidance,
  getProviderSetupInfo,
  getResearchKeyServiceInfo,
  saveProviderApiKey,
  saveResearchApiKey,
} from '../provider-setup'
import { saveSettings } from '../settings'

const PROVIDER_ENV_VARS = [
  'OPENROUTER_API_KEY',
  'TOKENROUTER_API_KEY',
  'OPENCODE_GO_API_KEY',
  'TOKENHARBOR_API_KEY',
  'NVIDIA_API_KEY',
  'COMMAND_CODE_API_KEY',
  'NOUS_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'DIRECT_PROVIDER',
  'INFERENCE_BASE_URL',
  'SAVANT_CODE_API_KEY',
  'SERPER_API_KEY',
  'CONTEXT7_API_KEY',
  'PARALLEL_API_KEY',
  'TAVILY_API_KEY',
  'EXA_API_KEY',
  'FIRECRAWL_API_KEY',
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

    expect(process.env.OPENCODE_GO_API_KEY).toBe('test-opencode-key')
    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    )
    expect(credentials.providerApiKeys.OPENCODE_GO_API_KEY).toBe(
      'test-opencode-key',
    )
    expect(credentials.providerApiKeys.OPENCODE_GO_API_KEY).not.toContain('  ')
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
          OPENCODE_GO_API_KEY: 'stored-key',
          TOKENHARBOR_API_KEY: 'stored-tokenharbor-key',
          NVIDIA_API_KEY: 'stored-nvidia-key',
        },
      }),
    )
    process.env.OPENCODE_GO_API_KEY = 'shell-key'

    applyPersistedProviderApiKeys()

    expect(process.env.OPENCODE_GO_API_KEY).toBe('shell-key')
    expect(process.env.TOKENHARBOR_API_KEY).toBe('stored-tokenharbor-key')
    expect(process.env.NVIDIA_API_KEY).toBe('stored-nvidia-key')
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
        providerApiKeys: { OPENCODE_GO_API_KEY: 'stored-key' },
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
        providerApiKeys: { OPENCODE_GO_API_KEY: 'stored-key' },
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
    expect(guidance).toContain('OPENCODE_GO_API_KEY')

    process.env.OPENCODE_GO_API_KEY = 'shell-key'
    expect(getMissingProviderSetup()).toBeUndefined()
  })

  test('bypasses gateway guidance for Ollama and backend auth', () => {
    process.env.DIRECT_PROVIDER = 'ollama'
    expect(getMissingProviderSetup()).toBeUndefined()

    delete process.env.DIRECT_PROVIDER
    process.env.SAVANT_CODE_API_KEY = 'backend-key'
    expect(getMissingProviderSetup()).toBeUndefined()
  })

  test('saves a research key in credentials.json and applies it to the current process', () => {
    saveResearchApiKey('serper', '  test-serper-key  ')

    expect(process.env.SERPER_API_KEY).toBe('test-serper-key')
    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    )
    expect(credentials.researchApiKeys.SERPER_API_KEY).toBe('test-serper-key')
    expect(credentials.researchApiKeys.SERPER_API_KEY).not.toContain('  ')
    // Provider and research sections are independent.
    expect(credentials.providerApiKeys).toBeUndefined()
  })

  test('rejects an empty research key', () => {
    expect(() => saveResearchApiKey('parallel', '  ')).toThrow(
      'Research API key cannot be empty.',
    )
    expect(fs.existsSync(path.join(tempDir, 'credentials.json'))).toBe(false)
  })

  test('restores persisted research keys without overriding an explicit environment variable', () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        researchApiKeys: {
          SERPER_API_KEY: 'stored-serper-key',
          PARALLEL_API_KEY: 'stored-parallel-key',
        },
      }),
    )
    process.env.SERPER_API_KEY = 'shell-serper-key'

    applyPersistedResearchApiKeys()

    expect(process.env.SERPER_API_KEY).toBe('shell-serper-key')
    expect(process.env.PARALLEL_API_KEY).toBe('stored-parallel-key')
    expect(process.env.TAVILY_API_KEY).toBeUndefined()
  })

  test('preserves unrelated credentials when saving a research key', () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { OPENROUTER_API_KEY: 'existing-provider-key' },
      }),
    )

    saveResearchApiKey('context7', 'test-context7-key')

    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    )
    expect(credentials.providerApiKeys.OPENROUTER_API_KEY).toBe(
      'existing-provider-key',
    )
    expect(credentials.researchApiKeys.CONTEXT7_API_KEY).toBe(
      'test-context7-key',
    )
  })

  test('resolves research key services case-insensitively and rejects unknown services', () => {
    expect(beginResearchKeySetup('Serper')).toBe('serper')
    expect(getResearchKeyServiceInfo('PARALLEL')).toMatchObject({
      service: 'parallel',
      label: 'Parallel',
      envVar: 'PARALLEL_API_KEY',
    })
    expect(beginResearchKeySetup('unknown-service')).toBeUndefined()
    expect(getResearchKeyServiceInfo('nope')).toBeUndefined()
  })

  test('returns setup metadata for supported providers only', () => {
    expect(getProviderSetupInfo('OpenRouter')).toMatchObject({
      provider: 'openrouter',
      envVar: 'OPENROUTER_API_KEY',
    })
    expect(getProviderSetupInfo('OpenCode-Go')).toMatchObject({
      provider: 'opencode-go',
      envVar: 'OPENCODE_GO_API_KEY',
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
