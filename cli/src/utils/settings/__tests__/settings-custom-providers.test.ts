// Settings customProviders (FID-2026-0910-004 Step 5): user-authored
// provider records persist in settings.json, survive validation and the
// save round-trip (never silently erased), and register into the effective
// registry when settings load (register-before-validate).

import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  getEffectiveProviderRegistry,
  resetCustomProviders,
} from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

const { getConfigDir } = await import('../../config-dir')

describe('settings customProviders (FID-2026-0910-004 Step 5)', () => {
  let originalConfigDir: string | undefined
  let tempDir: string

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-settings-custom-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    resetCustomProviders()
  })

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.SAVANT_CODE_CONFIG_DIR
    } else {
      process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    }
    fs.rmSync(tempDir, { recursive: true, force: true })
    resetCustomProviders()
  })

  const VALID = {
    id: 'my-gateway',
    label: 'My Gateway',
    baseUrl: 'https://gw.example.com/v1',
    apiKeyEnvVar: 'MY_GW_KEY',
    catalog: { source: 'none' as const },
  }

  test('validateSettings preserves a valid customProviders array', async () => {
    const { validateSettings } = await import('../validation')
    const settings = validateSettings({ customProviders: [VALID] })
    expect(settings.customProviders).toEqual([VALID])
  })

  test('validateSettings drops malformed entries but keeps valid ones', async () => {
    const { validateSettings } = await import('../validation')
    const settings = validateSettings({
      customProviders: [
        VALID,
        {
          id: 'openrouter',
          label: 'x',
          baseUrl: 'https://x.com',
          apiKeyEnvVar: 'X',
        },
        {
          id: 'BAD_ID',
          label: 'x',
          baseUrl: 'https://x.com',
          apiKeyEnvVar: 'X2',
        },
        'garbage',
      ],
    })
    expect(settings.customProviders).toEqual([VALID])
  })

  test('save round-trip never erases customProviders', async () => {
    const { saveSettings, loadSettings } = await import('../../settings')
    saveSettings({ customProviders: [VALID] } as never)
    saveSettings({ presenceEnabled: false })
    const reloaded = loadSettings()
    expect(reloaded.customProviders).toEqual([VALID])
  })

  test('loadSettings registers the custom set before validation consumers run', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify(
        {
          customProviders: [VALID],
          activeProvider: 'my-gateway',
        },
        null,
        2,
      ),
    )
    const { loadSettings } = await import('../../settings')
    const settings = loadSettings()
    // Field preserved...
    expect(settings.customProviders).toEqual([VALID])
    // ...and the activeProvider field validated against the EFFECTIVE view
    // (a custom id is valid exactly because registration ran first). The
    // settings union widens at Step 9 (FID-2026-0910-004 D8), so the read
    // takes the widened view for the assertion.
    expect(settings.activeProvider as string | undefined).toBe('my-gateway')
    expect(getEffectiveProviderRegistry()['my-gateway']).toBeDefined()
  })
})
