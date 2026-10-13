import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  getConfiguredProviderNames,
  saveProviderApiKey,
} from '../provider-setup'

const ENV_NAMES = [
  'AIHUBMIX_API_KEY',
  'DIRECT_PROVIDER',
  'INFERENCE_BASE_URL',
] as const

describe('AIHubMix provider setup (FID-2026-1013-004)', () => {
  let originalConfigDir: string | undefined
  let tempDir: string
  let originalEnv: Partial<
    Record<(typeof ENV_NAMES)[number], string | undefined>
  >

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-aihubmix-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    originalEnv = Object.fromEntries(
      ENV_NAMES.map((name) => [name, process.env[name]]),
    )
    for (const name of ENV_NAMES) delete process.env[name]
  })

  afterEach(() => {
    for (const name of ENV_NAMES) {
      const value = originalEnv[name]
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('saves the key and activates the registry-derived route', () => {
    saveProviderApiKey('aihubmix', '  test-aihubmix-key  ')

    expect(process.env.AIHUBMIX_API_KEY).toBe('test-aihubmix-key')
    expect(process.env.DIRECT_PROVIDER).toBe('aihubmix')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://aihubmix.com/v1')
    expect(getConfiguredProviderNames()).toContain('aihubmix')
  })
})
