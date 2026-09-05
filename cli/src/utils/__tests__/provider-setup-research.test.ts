import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  PROVIDER_SETUP_CONFIG,
  RESEARCH_KEY_SERVICES,
  applyPersistedResearchApiKeys,
  beginResearchKeySetup,
  getResearchKeyServiceInfo,
  saveResearchApiKey,
} from '../provider-setup'

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
})
