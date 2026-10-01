// Provider setup for the OpenAI platform entry (FID-2026-1001-001) —
// persists the platform key, activates direct routing, and keeps the
// /provider picker alphabetically sorted with the add-row sentinel last.

import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { buildProviderPickerEntries } from '../../commands/defs/provider-picker-entries'
import {
  PROVIDER_SETUP_CONFIG,
  RESEARCH_KEY_SERVICES,
  activateConfiguredProvider,
  applyPersistedProviderApiKeys,
  getConfiguredProviderNames,
  saveProviderApiKey,
} from '../provider-setup'
import { saveSettings } from '../settings'

// Derived (rationale in provider-setup.test.ts — FID-2026-0905-006).
const PROVIDER_ENV_VARS = [
  ...Object.values(PROVIDER_SETUP_CONFIG).map((config) => config.envVar),
  ...Object.values(RESEARCH_KEY_SERVICES).map((service) => service.envVar),
  'DIRECT_PROVIDER',
  'INFERENCE_BASE_URL',
] as const

describe('provider setup — openai (FID-2026-1001-001)', () => {
  let originalConfigDir: string | undefined
  let tempDir: string
  let originalEnv: Partial<
    Record<(typeof PROVIDER_ENV_VARS)[number], string | undefined>
  >

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-provider-openai-'))
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

  test('saveProviderApiKey persists OPENAI_API_KEY and activates openai routing', () => {
    saveProviderApiKey('openai', '  sk-persisted-openai-key  ')

    expect(process.env.OPENAI_API_KEY).toBe('sk-persisted-openai-key')
    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    )
    expect(credentials.providerApiKeys.OPENAI_API_KEY).toBe(
      'sk-persisted-openai-key',
    )
    // Phase 4 single-setting state: the selection activates direct routing
    // against the registry-derived platform base URL.
    expect(process.env.DIRECT_PROVIDER).toBe('openai')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://api.openai.com/v1')
    expect(getConfiguredProviderNames()).toContain('openai')
  })

  test('activateConfiguredProvider works from an existing shell key', () => {
    process.env.OPENAI_API_KEY = 'sk-shell-openai-key'

    expect(activateConfiguredProvider('openai')).toBe(true)
    expect(process.env.DIRECT_PROVIDER).toBe('openai')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://api.openai.com/v1')
  })

  test('applyPersistedProviderApiKeys restores openai direct mode from the stored key', () => {
    saveSettings({
      activeProvider: 'openai',
    } as Parameters<typeof saveSettings>[0])
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { OPENAI_API_KEY: 'stored-openai-key' },
      }),
    )

    applyPersistedProviderApiKeys()

    expect(process.env.OPENAI_API_KEY).toBe('stored-openai-key')
    expect(process.env.DIRECT_PROVIDER).toBe('openai')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://api.openai.com/v1')
  })

  test('the /provider picker is label-sorted within segments, sentinel last', () => {
    const entries = buildProviderPickerEntries({
      configured: ['openai', 'nous'],
      customProviders: [
        { id: 'zeta', label: 'Zeta Gateway' },
        { id: 'alpha', label: 'Alpha Relay' },
      ],
    })

    const labels = entries.map((entry) => entry.label)
    const sentinelIndex = labels.indexOf('Add a custom provider…')
    expect(sentinelIndex).toBe(labels.length - 1)

    // Built-ins segment: alphabetical, customs after, configured badges set.
    const builtins = entries.slice(0, entries.length - 1).filter((entry) => {
      const customIds = new Set(['zeta', 'alpha'])
      return !customIds.has(entry.name)
    })
    const builtinLabels = builtins.map((entry) => entry.label)
    expect(builtinLabels).toEqual(
      [...builtinLabels].sort((a, b) => a.localeCompare(b)),
    )
    const customLabels = entries
      .filter((entry) => entry.label.endsWith('(custom)'))
      .map((entry) => entry.label)
    expect(customLabels).toEqual([
      'Alpha Relay (custom)',
      'Zeta Gateway (custom)',
    ])
    const openaiEntry = entries.find((entry) => entry.name === 'openai')
    expect(openaiEntry?.configured).toBe(true)
    expect(entries.find((entry) => entry.name === 'nous')?.configured).toBe(
      true,
    )
  })
})
