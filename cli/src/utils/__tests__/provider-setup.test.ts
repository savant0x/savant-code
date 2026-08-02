import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { applyPersistedDirectProviderSettings } from '../ollama-onboarding'
import {
  applyPersistedProviderApiKeys,
  configureDefaultDirectProvider,
  getConfiguredProviderNames,
  getMissingProviderSetup,
  getProviderSetupGuidance,
  getProviderSetupInfo,
  saveProviderApiKey,
} from '../provider-setup'
import { saveSettings } from '../settings'

const PROVIDER_ENV_VARS = [
  'OPENCODE_GO_API_KEY',
  'TOKENROUTER_API_KEY',
  'NVIDIA_API_KEY',
  'COMMAND_CODE_API_KEY',
  'CLOUDFLARE_API_TOKEN',
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

  test('restores persisted keys without overriding an explicit environment variable', () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: {
          OPENCODE_GO_API_KEY: 'stored-key',
          NVIDIA_API_KEY: 'stored-nvidia-key',
        },
      }),
    )
    process.env.OPENCODE_GO_API_KEY = 'shell-key'

    applyPersistedProviderApiKeys()

    expect(process.env.OPENCODE_GO_API_KEY).toBe('shell-key')
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

    expect(process.env.DIRECT_PROVIDER).toBe('opencode-go')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://opencode.ai/zen/go/v1')
    expect(process.env.OPENCODE_GO_API_KEY).toBeUndefined()
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

  test('returns setup metadata for supported providers only', () => {
    expect(getProviderSetupInfo('OpenCode-Go')).toMatchObject({
      provider: 'opencode-go',
      envVar: 'OPENCODE_GO_API_KEY',
    })
    expect(getProviderSetupInfo('unknown')).toBeUndefined()
  })
})
