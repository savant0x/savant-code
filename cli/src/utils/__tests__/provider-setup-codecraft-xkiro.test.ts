import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { buildProviderPickerEntries } from '../../commands/defs/provider-picker-entries'
import {
  activateConfiguredProvider,
  applyPersistedProviderApiKeys,
  saveProviderApiKey,
} from '../provider-setup'
import { saveSettings } from '../settings'

const providers = [
  ['codecraft', 'CODECRAFT_API_KEY', 'https://codecraftapi.com/v1'],
  ['xkiro', 'XKIRO_API_KEY', 'https://api.xkiro.com/v1'],
  ['cleanapis', 'CLEANAPIS_API_KEY', 'https://cleanapis.com/v1'],
] as const
const envNames = [
  ...providers.map(([, env]) => env),
  'SAVANT_CODE_CONFIG_DIR',
  'DIRECT_PROVIDER',
  'INFERENCE_BASE_URL',
]

describe('provider setup for requested integrations (FID-2026-1003-001)', () => {
  let originalEnv: Record<string, string | undefined>
  let tempDir: string
  beforeEach(() => {
    originalEnv = Object.fromEntries(
      envNames.map((name) => [name, process.env[name]]),
    )
    for (const name of envNames) delete process.env[name]
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'savant-provider-integration-'),
    )
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
  })
  afterEach(() => {
    for (const name of envNames) {
      if (originalEnv[name] === undefined) delete process.env[name]
      else process.env[name] = originalEnv[name]
    }
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  for (const [id, envVar, baseUrl] of providers) {
    test(`${id} persists keys and activates the declared API root`, () => {
      saveProviderApiKey(id, '  dummy-stored-key  ')
      expect(process.env[envVar]).toBe('dummy-stored-key')
      expect(process.env.DIRECT_PROVIDER).toBe(id)
      expect(process.env.INFERENCE_BASE_URL).toBe(baseUrl)
      const credentials = JSON.parse(
        fs.readFileSync(path.join(tempDir, 'credentials.json'), 'utf8'),
      )
      expect(credentials.providerApiKeys[envVar]).toBe('dummy-stored-key')
    })

    test(`${id} restores persisted selection and respects the shell credential`, () => {
      saveProviderApiKey(id, 'stored-key')
      saveSettings({ activeProvider: id } as Parameters<typeof saveSettings>[0])
      process.env[envVar] = 'shell-key'
      delete process.env.DIRECT_PROVIDER
      delete process.env.INFERENCE_BASE_URL
      applyPersistedProviderApiKeys()
      expect(process.env[envVar]).toBe('shell-key')
      expect(String(process.env.DIRECT_PROVIDER)).toBe(id)
      expect(String(process.env.INFERENCE_BASE_URL)).toBe(baseUrl)
      expect(activateConfiguredProvider(id)).toBe(true)
    })
  }

  test('setup picker includes all three, remains alphabetical, sentinel last', () => {
    const entries = buildProviderPickerEntries({
      configured: ['xkiro'],
      customProviders: [],
    })
    for (const [id] of providers)
      expect(entries.some((entry) => entry.name === id)).toBe(true)
    expect(entries.find((entry) => entry.name === 'xkiro')?.configured).toBe(
      true,
    )
    expect(entries.at(-1)?.label).toBe('Add a custom provider…')
    const labels = entries.slice(0, -1).map((entry) => entry.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
  })
})
