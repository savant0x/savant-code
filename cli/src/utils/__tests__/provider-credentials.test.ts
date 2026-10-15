import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { resolveProviderApiKey } from '../provider-credentials'

const configDirs: string[] = []

/** Write a credentials.json into a temp config dir and return that dir. */
function withConfigDir(record: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'savant-provider-creds-'))
  writeFileSync(join(dir, 'credentials.json'), JSON.stringify(record))
  configDirs.push(dir)
  return dir
}

describe('resolveProviderApiKey (FID-2026-1006-001 M1)', () => {
  const envNames = ['CODECRAFT_API_KEY', 'APINEX_API_KEY'] as const
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = Object.fromEntries(envNames.map((n) => [n, process.env[n]]))
    for (const name of envNames) delete process.env[name]
  })

  afterEach(() => {
    for (const name of envNames) {
      if (originalEnv[name] === undefined) delete process.env[name]
      else process.env[name] = originalEnv[name]
    }
    delete process.env.SAVANT_CODE_CONFIG_DIR
    for (const dir of configDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('env wins over stored when both present', async () => {
    process.env.SAVANT_CODE_CONFIG_DIR = withConfigDir({
      providerApiKeys: { CODECRAFT_API_KEY: 'stored-key' },
    })
    process.env.CODECRAFT_API_KEY = 'env-key'
    expect(await resolveProviderApiKey('codecraft')).toBe('env-key')
  })

  test('stored key used when env unset', async () => {
    process.env.SAVANT_CODE_CONFIG_DIR = withConfigDir({
      providerApiKeys: { CODECRAFT_API_KEY: 'stored-key' },
    })
    expect(await resolveProviderApiKey('codecraft')).toBe('stored-key')
  })

  test('empty-string env treated as unset (stored key used)', async () => {
    process.env.SAVANT_CODE_CONFIG_DIR = withConfigDir({
      providerApiKeys: { CODECRAFT_API_KEY: 'stored-key' },
    })
    process.env.CODECRAFT_API_KEY = ''
    expect(await resolveProviderApiKey('codecraft')).toBe('stored-key')
  })

  test('whitespace-only env treated as unset (stored key used)', async () => {
    process.env.SAVANT_CODE_CONFIG_DIR = withConfigDir({
      providerApiKeys: { CODECRAFT_API_KEY: 'stored-key' },
    })
    process.env.CODECRAFT_API_KEY = '   '
    expect(await resolveProviderApiKey('codecraft')).toBe('stored-key')
  })

  test('unknown provider resolves undefined', async () => {
    expect(await resolveProviderApiKey('does-not-exist')).toBeUndefined()
  })

  test('non-gateway provider (local) resolves undefined', async () => {
    expect(await resolveProviderApiKey('ollama')).toBeUndefined()
  })

  test('corrupt or malformed credentials never throws', async () => {
    process.env.SAVANT_CODE_CONFIG_DIR = withConfigDir({
      providerApiKeys: 'not-an-object',
    })
    expect(await resolveProviderApiKey('codecraft')).toBeUndefined()
    process.env.SAVANT_CODE_CONFIG_DIR = withConfigDir({
      providerApiKeys: { CODECRAFT_API_KEY: 123 },
    })
    expect(await resolveProviderApiKey('codecraft')).toBeUndefined()
  })
})
