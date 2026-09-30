import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  PROVIDER_SETUP_CONFIG,
  RESEARCH_KEY_SERVICES,
  activateConfiguredProvider,
  getConfiguredProviderNames,
  saveProviderApiKey,
} from '../provider-setup'

// Split from provider-setup.test.ts (300-line file cap — the
// FID-2026-0914-001 split precedent). Covers the two-way credential contract
// for Vercel AI Gateway (operator ruling 2026-09-27): the key may live in
// `.env.local`/shell OR in the masked `/provider vercel` store, shell taking
// precedence. The env list is derived (FID-2026-0905-006 rationale) so a
// newly added provider can never leak a shell key into these tests.
const PROVIDER_ENV_VARS = [
  ...Object.values(PROVIDER_SETUP_CONFIG).map((config) => config.envVar),
  ...Object.values(RESEARCH_KEY_SERVICES).map((service) => service.envVar),
  'DIRECT_PROVIDER',
  'INFERENCE_BASE_URL',
] as const

describe('provider setup — Vercel AI Gateway (FID-2026-0927-001)', () => {
  let originalConfigDir: string | undefined
  let tempDir: string
  let originalEnv: Partial<
    Record<(typeof PROVIDER_ENV_VARS)[number], string | undefined>
  >

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-provider-vercel-'))
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

  test('saves the key in the masked store for direct-provider mode', () => {
    saveProviderApiKey('vercel', '  test-vercel-key  ')

    expect(process.env.AI_GATEWAY_API_KEY).toBe('test-vercel-key')
    expect(process.env.DIRECT_PROVIDER).toBe('vercel')
    expect(process.env.INFERENCE_BASE_URL).toBe(
      'https://ai-gateway.vercel.sh/v1',
    )
    expect(getConfiguredProviderNames()).toContain('vercel')
  })

  test('activates from an existing shell key without requiring setup input', () => {
    process.env.AI_GATEWAY_API_KEY = 'env-vercel-key'

    expect(activateConfiguredProvider('vercel')).toBe(true)
    expect(process.env.DIRECT_PROVIDER).toBe('vercel')
    expect(process.env.INFERENCE_BASE_URL).toBe(
      'https://ai-gateway.vercel.sh/v1',
    )
    expect(fs.existsSync(path.join(tempDir, 'credentials.json'))).toBe(false)
  })
})
