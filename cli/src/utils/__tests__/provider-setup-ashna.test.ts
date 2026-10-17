// Provider setup for the Ashna entry (FID-2026-1016-018) — persists the
// gateway key, activates direct routing against the documented /v1/api
// root, and keeps the /provider picker label-sorted. Sibling file because
// provider-setup.test.ts sits at its file ceiling (FID-2026-1016-018).

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

describe('provider setup — ashna (FID-2026-1016-018)', () => {
  let originalConfigDir: string | undefined
  let tempDir: string
  let originalEnv: Partial<
    Record<(typeof PROVIDER_ENV_VARS)[number], string | undefined>
  >

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-provider-ashna-'))
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

  test('saveProviderApiKey persists ASHNA_API_KEY and activates ashna routing', () => {
    saveProviderApiKey('ashna', '  ashna-persisted-key  ')

    expect(process.env.ASHNA_API_KEY).toBe('ashna-persisted-key')
    const credentials = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
    )
    expect(credentials.providerApiKeys.ASHNA_API_KEY).toBe(
      'ashna-persisted-key',
    )
    // Direct routing targets the registry-derived ashna base URL.
    expect(process.env.DIRECT_PROVIDER).toBe('ashna')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://api.ashna.ai/v1/api')
    expect(getConfiguredProviderNames()).toContain('ashna')
  })

  test('activateConfiguredProvider works from an existing shell key', () => {
    process.env.ASHNA_API_KEY = 'ashna-shell-key'

    expect(activateConfiguredProvider('ashna')).toBe(true)
    expect(process.env.DIRECT_PROVIDER).toBe('ashna')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://api.ashna.ai/v1/api')
  })

  test('applyPersistedProviderApiKeys restores ashna direct mode from the stored key', () => {
    saveSettings({
      activeProvider: 'ashna',
    } as Parameters<typeof saveSettings>[0])
    fs.writeFileSync(
      path.join(tempDir, 'credentials.json'),
      JSON.stringify({
        providerApiKeys: { ASHNA_API_KEY: 'stored-ashna-key' },
      }),
    )

    applyPersistedProviderApiKeys()

    expect(process.env.ASHNA_API_KEY).toBe('stored-ashna-key')
    expect(process.env.DIRECT_PROVIDER).toBe('ashna')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://api.ashna.ai/v1/api')
  })

  test('the /provider picker keeps builtin rows label-sorted with the add-row sentinel last', () => {
    const entries = buildProviderPickerEntries({
      configured: ['ashna'],
      customProviders: [],
    })

    // FID-2026-0911-001: only the builtin block is label-sorted; the
    // add-new ACTION row is the deliberate grammar-word sentinel at the end.
    const last = entries[entries.length - 1]
    expect(last.label).toBe('Add a custom provider…')
    const builtinLabels = entries.slice(0, -1).map((entry) => entry.label)
    expect(builtinLabels).toEqual(
      [...builtinLabels].sort((a, b) => a.localeCompare(b)),
    )
    expect(entries.find((entry) => entry.name === 'ashna')?.configured).toBe(
      true,
    )
  })
})
