// provider-key-store custom providers (FID-2026-0910-004 Step 6): the setup
// view, key persistence, and activation all read the EFFECTIVE registry, so
// registered customs are first-class: they appear in PROVIDER_SETUP_CONFIG,
// accept saved keys (0600 file, env precedence), activate, and list.

import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  parseCustomProviders,
  registerCustomProviders,
  resetCustomProviders,
} from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

const {
  applyPersistedProviderApiKeys,
  getConfiguredProviderNames,
  getEffectiveProviderSetupConfig,
  getProviderSetupInfo,
  saveProviderApiKey,
} = await import('../provider-key-store')
const { activateConfiguredProvider } = await import('../provider-setup')

const CUSTOM_ENV_VARS = [
  'MY_GW_KEY',
  'DIRECT_PROVIDER',
  'INFERENCE_BASE_URL',
] as const

/** Read an env var without literal-delete narrowing narrowing the test
 * scope (TS narrows `process.env.X` to undefined after `delete process.env.X`
 * in the same scope — the helper keeps the read `string | undefined`). */
const getEnv = (name: string): string | undefined => process.env[name]

describe('provider key store — custom providers (FID-2026-0910-004 Step 6)', () => {
  let originalConfigDir: string | undefined
  let tempDir: string
  let originalEnv: Record<string, string | undefined>

  const CUSTOM = {
    id: 'my-gateway',
    label: 'My Gateway',
    baseUrl: 'https://gw.example.com/v1',
    apiKeyEnvVar: 'MY_GW_KEY',
    catalog: { source: 'none' as const },
  }

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-keystore-custom-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    originalEnv = Object.fromEntries(
      CUSTOM_ENV_VARS.map((name) => [name, process.env[name]]),
    )
    for (const name of CUSTOM_ENV_VARS) delete process.env[name]
  })

  afterEach(() => {
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
    resetCustomProviders()
  })

  test('registered customs appear in the effective setup view', () => {
    registerCustomProviders([CUSTOM])
    // The static built-in const stays built-ins-only (wizard compat until
    // Step 8); the EFFECTIVE view is what the key-store functions read.
    expect(getEffectiveProviderSetupConfig()['my-gateway']).toEqual({
      label: 'My Gateway',
      envVar: 'MY_GW_KEY',
      baseUrl: 'https://gw.example.com/v1',
    })
    expect(getProviderSetupInfo('my-gateway')?.provider).toBe('my-gateway')
  })

  test('saveProviderApiKey stores a custom key, respects shell precedence, and activates', () => {
    registerCustomProviders([CUSTOM])
    saveProviderApiKey('my-gateway', '  gw-key-123  ')
    expect(process.env.MY_GW_KEY).toBe('gw-key-123')
    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    )
    expect(credentials.providerApiKeys.MY_GW_KEY).toBe('gw-key-123')

    // Activation persisted for a custom id — Step 9 (D8 widening): the
    // settings seam takes the custom id cast-free.
    const settings = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'settings.json'), 'utf8'),
    )
    expect(settings.activeProvider).toBe('my-gateway')
  })

  test('getConfiguredProviderNames lists configured customs', () => {
    registerCustomProviders([CUSTOM])
    saveProviderApiKey('my-gateway', 'gw-key-123')
    expect(getConfiguredProviderNames()).toContain('my-gateway')
  })

  test('applyPersistedProviderApiKeys restores a custom key from disk', () => {
    registerCustomProviders([CUSTOM])
    saveProviderApiKey('my-gateway', 'gw-key-123')
    delete process.env.MY_GW_KEY
    applyPersistedProviderApiKeys()
    expect(getEnv('MY_GW_KEY')).toBe('gw-key-123')
  })

  test('activateConfiguredProvider activates a configured custom provider', () => {
    registerCustomProviders([CUSTOM])
    saveProviderApiKey('my-gateway', 'gw-key-123')
    delete process.env.MY_GW_KEY
    expect(activateConfiguredProvider('my-gateway')).toBe(true)
    expect(process.env.DIRECT_PROVIDER).toBe('my-gateway')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://gw.example.com/v1')
    expect(getEnv('MY_GW_KEY')).toBe('gw-key-123')
  })

  test('a custom env-var claim cannot collide with reserved research vars', () => {
    // Parse-level guard: a custom provider claiming TAVILY_API_KEY is
    // rejected before any key can be written through it.
    const { problems } = parseCustomProviders([
      {
        id: 'squatter',
        label: 'Squatter',
        baseUrl: 'https://squatter.example.com/v1',
        apiKeyEnvVar: 'TAVILY_API_KEY',
        catalog: { source: 'none' },
      },
    ])
    expect(problems.length).toBeGreaterThan(0)
  })
})
