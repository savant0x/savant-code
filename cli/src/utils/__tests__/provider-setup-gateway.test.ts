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
  ...Object.values(PROVIDER_SETUP_CONFIG).flatMap((config) =>
    (config.extraEnvVars ?? []).map((extra) => extra.envVar),
  ),
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
    expect(() => saveProviderApiKey('tokenharbor', '  ')).toThrow(
      'Provider API key cannot be empty.',
    )
    expect(fs.existsSync(path.join(tempDir, 'credentials.json'))).toBe(false)
  })

  test('restores direct mode from a persisted provider key', () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { TOKENHARBOR_API_KEY: 'stored-key' },
      }),
    )

    applyPersistedProviderApiKeys()

    expect(process.env.DIRECT_PROVIDER).toBe('tokenharbor')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://tokenharbor.ai/v1')
  })

  // FID-2026-0929-003 (operator ruling 2026-09-29): a stored login token does
  // not defer the persisted-key restore — a saved provider key IS the
  // operator's explicit routing command, and there is no deployable backend
  // to fall back to.
  test('a stored credentials token does not defer the persisted-key restore', () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        default: {
          name: 'Test User',
          email: 'test@example.com',
          authToken: 'stored-backend-token',
        },
        providerApiKeys: { TOKENHARBOR_API_KEY: 'stored-key' },
      }),
    )

    applyPersistedProviderApiKeys()

    expect(process.env.DIRECT_PROVIDER).toBe('tokenharbor')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://tokenharbor.ai/v1')
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

  // FID-2026-0929-003 (operator ruling 2026-09-29): a persisted /provider
  // selection outranks a stored login token — the token is residue, not a
  // routing command, and there is no deployable backend to fall back to.
  // Only the explicit SAVANT_CODE_API_KEY defers the auto-arm (pinned below).
  test('a persisted selection outranks a stored login token', () => {
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        default: {
          name: 'Test User',
          email: 'test@example.com',
          authToken: 'stored-backend-token',
        },
      }),
    )
    saveSettings({ activeProvider: 'apinex' })

    configureDefaultDirectProvider()

    expect(process.env.DIRECT_PROVIDER).toBe('apinex')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://api.apinex.bond/v1')
  })

  // FID-2026-0929-003: SAVANT_CODE_API_KEY is the one deliberate backend-mode
  // opt-in and still defers the auto-arm.
  test('a real env backend token still defers the auto-arm', () => {
    saveSettings({ activeProvider: 'apinex' })
    process.env.SAVANT_CODE_API_KEY = 'env-backend-token'

    configureDefaultDirectProvider()

    expect(process.env.DIRECT_PROVIDER).toBeUndefined()
    expect(process.env.INFERENCE_BASE_URL).toBeUndefined()
  })

  test('saved gateway key takes precedence over persisted Ollama mode', () => {
    saveSettings({
      directProvider: 'ollama',
      directProviderBaseUrl: 'http://localhost:11434/v1',
    })

    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { TOKENHARBOR_API_KEY: 'stored-key' },
      }),
    )

    // Startup restores provider keys before persisted Ollama settings. This
    // test mirrors that ordering and ensures the key wins.
    applyPersistedProviderApiKeys()
    applyPersistedDirectProviderSettings()

    expect(process.env.DIRECT_PROVIDER).toBe('tokenharbor')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://tokenharbor.ai/v1')
  })

  test('identifies missing setup only for the active gateway provider', () => {
    process.env.DIRECT_PROVIDER = 'tokenharbor'

    const missing = getMissingProviderSetup()

    expect(missing?.provider).toBe('tokenharbor')
    if (!missing) throw new Error('Expected missing provider setup')
    const guidance = getProviderSetupGuidance(missing)
    expect(guidance).toContain('/provider tokenharbor')
    expect(guidance).toContain('TOKENHARBOR_API_KEY')

    process.env.TOKENHARBOR_API_KEY = 'shell-key'
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

  test('cloudflare is setup-surfaced with its extra credential (T61 Option A)', () => {
    const info = getProviderSetupInfo('cloudflare')
    expect(info).toBeDefined()
    expect(info?.envVar).toBe('CLOUDFLARE_API_TOKEN')
    expect(info?.extraEnvVars).toEqual([
      { envVar: 'CLOUDFLARE_ACCOUNT_ID', label: 'Cloudflare Account ID' },
    ])
  })

  test('saves an extra credential under its own env-var name and re-applies it', () => {
    const { saveProviderApiKeyExtra } = require('../provider-key-store') as {
      saveProviderApiKeyExtra: (
        provider: string,
        extraEnvVar: string,
        value: string,
      ) => void
    }
    saveProviderApiKeyExtra('cloudflare', 'CLOUDFLARE_ACCOUNT_ID', 'abc123')
    // Applied to the process env immediately (shell precedence: env was
    // empty in this sandbox).
    expect(process.env.CLOUDFLARE_ACCOUNT_ID).toBe('abc123')
    // Persisted under its own name in the shared store.
    const stored = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    ) as { providerApiKeys?: Record<string, string> }
    expect(stored.providerApiKeys?.CLOUDFLARE_ACCOUNT_ID).toBe('abc123')
    // A second save persists under its own name too; both survive a re-apply.
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    applyPersistedProviderApiKeys()
    expect(process.env.CLOUDFLARE_ACCOUNT_ID as string | undefined).toBe(
      'abc123',
    )
  })

  test('rejects an unknown extra credential for the provider', () => {
    const { saveProviderApiKeyExtra } = require('../provider-key-store') as {
      saveProviderApiKeyExtra: (
        provider: string,
        extraEnvVar: string,
        value: string,
      ) => void
    }
    expect(() =>
      saveProviderApiKeyExtra('openrouter', 'OPENROUTER_ACCOUNT_ID', 'x'),
    ).toThrow(/no additional credential/)
  })

  test('multi-step setup state: begin stages extras, consume drains, shell env skips', () => {
    const mod = require('../provider-setup') as {
      beginProviderSetup: (p: string) => string | undefined
      getNextPendingExtraCredential: () =>
        { envVar: string; label: string } | undefined
      consumeNextPendingExtraCredential: () =>
        { envVar: string; label: string } | undefined
    }
    // Shell-provided extras are never staged (env takes precedence).
    process.env.CLOUDFLARE_ACCOUNT_ID = 'from-shell'
    mod.beginProviderSetup('cloudflare')
    expect(mod.getNextPendingExtraCredential()).toBeUndefined()
    delete process.env.CLOUDFLARE_ACCOUNT_ID

    mod.beginProviderSetup('cloudflare')
    const staged = mod.getNextPendingExtraCredential()
    expect(staged?.envVar).toBe('CLOUDFLARE_ACCOUNT_ID')
    expect(mod.consumeNextPendingExtraCredential()?.envVar).toBe(
      'CLOUDFLARE_ACCOUNT_ID',
    )
    expect(mod.getNextPendingExtraCredential()).toBeUndefined()
    expect(mod.consumeNextPendingExtraCredential()).toBeUndefined()
  })
})
