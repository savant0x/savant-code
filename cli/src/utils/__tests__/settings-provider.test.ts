import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

const { getConfigDir } = await import('../config-dir')

// FID-2026-0819-005 Loop 170: provider-preference suites split verbatim from
// settings.test.ts (harness beforeEach/afterEach duplicated verbatim so each
// file is self-contained).

describe('settings telemetry defaults', () => {
  let originalConfigDir: string | undefined
  let tempDir: string

  beforeEach(() => {
    // Override the config directory via env so the test is isolated from the
    // user's real home directory and avoids os.homedir() caching on Windows.
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-settings-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
  })

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.SAVANT_CODE_CONFIG_DIR
    } else {
      process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    }
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('getActiveProvider prefers the selection over the picker preference', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify(
        {
          activeProvider: 'nvidia',
          savantCodeModelProviderPreference: 'openrouter',
        },
        null,
        2,
      ),
    )

    const { getActiveProvider } = await import('../settings')
    expect(getActiveProvider()).toBe('nvidia')
  })

  test('getActiveProvider falls back to the picker preference when no selection exists', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify(
        { savantCodeModelProviderPreference: 'tokenharbor' },
        null,
        2,
      ),
    )

    const { getActiveProvider } = await import('../settings')
    expect(getActiveProvider()).toBe('tokenharbor')
  })

  test('legacy savantCodeModelPreferenceLegacy migrates to savantCodeModelPreference (FID-2026-0813-023)', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify(
        { savantCodeModelPreferenceLegacy: 'openrouter/legacy-model' },
        null,
        2,
      ),
    )

    const { loadSettings } = await import('../settings')
    expect(loadSettings().savantCodeModelPreference).toBe(
      'openrouter/legacy-model',
    )
  })

  test('explicit savantCodeModelPreference wins over the legacy key', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify(
        {
          savantCodeModelPreference: 'openrouter/new-model',
          savantCodeModelPreferenceLegacy: 'openrouter/legacy-model',
        },
        null,
        2,
      ),
    )

    const { loadSettings } = await import('../settings')
    expect(loadSettings().savantCodeModelPreference).toBe(
      'openrouter/new-model',
    )
  })

  test('opencode-go provider preference round-trips through validation', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify(
        {
          savantCodeModelProviderPreference: 'opencode-go',
        },
        null,
        2,
      ),
    )

    const { loadSettings } = await import('../settings')
    const settings = loadSettings()
    expect(settings.savantCodeModelProviderPreference).toBe('opencode-go')
  })
})
