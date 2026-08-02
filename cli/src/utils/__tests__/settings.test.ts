import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  DEFAULT_SAVANT_CODE_MODEL_ID,
  DEFAULT_SAVANT_CODE_MODEL_PROVIDER,
} from '../settings'

const { getConfigDir } = await import('../config-dir')

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

  test('default settings file writes adsEnabled as false on first run', async () => {
    const { loadSettings } = await import('../settings')
    const settings = loadSettings()

    // Ads remain separately opt-in; remote analytics is active by default.
    expect(settings.adsEnabled).toBe(false)
    expect(settings.analyticsEnabled).toBe(true)

    // Verify the persisted file also reflects the default.
    const settingsPath = path.join(getConfigDir(), 'settings.json')
    expect(fs.existsSync(settingsPath)).toBe(true)
    const persisted = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    expect(persisted.adsEnabled).toBe(false)
    expect(persisted.analyticsEnabled).toBe(true)
  })

  test('legacy settings inherit active analytics until explicitly disabled', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify({ adsEnabled: false }, null, 2),
    )

    const { loadAnalyticsEnabled, loadSettings, saveAnalyticsEnabled } =
      await import('../settings')
    expect(loadAnalyticsEnabled()).toBe(true)
    saveAnalyticsEnabled(false)
    expect(loadSettings().analyticsEnabled).toBe(false)
    expect(loadAnalyticsEnabled()).toBe(false)
  })

  test('legacy adsEnabled=true is preserved if user explicitly enabled it', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify({ adsEnabled: true }, null, 2),
    )

    const { loadSettings } = await import('../settings')
    const settings = loadSettings()
    expect(settings.adsEnabled).toBe(true)
  })

  test('default savant-code model preference is MiMo 2.5 from OpenCode Go on first run', async () => {
    const { loadSettings } = await import('../settings')
    const settings = loadSettings()

    expect(settings.savantCodeModelPreference).toBe(
      DEFAULT_SAVANT_CODE_MODEL_ID,
    )
    expect(settings.savantCodeModelProviderPreference).toBe(
      DEFAULT_SAVANT_CODE_MODEL_PROVIDER,
    )

    // Verify the persisted file also reflects the defaults.
    const settingsPath = path.join(getConfigDir(), 'settings.json')
    expect(fs.existsSync(settingsPath)).toBe(true)
    const persisted = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    expect(persisted.savantCodeModelPreference).toBe(
      DEFAULT_SAVANT_CODE_MODEL_ID,
    )
    expect(persisted.savantCodeModelProviderPreference).toBe(
      DEFAULT_SAVANT_CODE_MODEL_PROVIDER,
    )
  })

  test('user savant-code model preference is preserved across loads', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify(
        {
          savantCodeModelPreference: 'openrouter/gpt-5',
          savantCodeModelProviderPreference: 'openrouter',
        },
        null,
        2,
      ),
    )

    const { loadSettings } = await import('../settings')
    const settings = loadSettings()
    expect(settings.savantCodeModelPreference).toBe('openrouter/gpt-5')
    expect(settings.savantCodeModelProviderPreference).toBe('openrouter')
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
