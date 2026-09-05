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

  test('default mode is HYBRID on first run (FID-2026-0805-001)', async () => {
    const { loadModePreference, loadSettings } = await import('../settings')
    expect(loadModePreference()).toBe('HYBRID')
    expect(loadSettings().mode).toBe('HYBRID')

    // Verify the persisted file also reflects the default.
    const settingsPath = path.join(getConfigDir(), 'settings.json')
    expect(fs.existsSync(settingsPath)).toBe(true)
    const persisted = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    expect(persisted.mode).toBe('HYBRID')
  })

  test('legacy EDIT mode migrates to HYBRID on load (FID-2026-0805-001)', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify({ mode: 'EDIT' }, null, 2),
    )

    const { loadModePreference, loadSettings } = await import('../settings')
    expect(loadSettings().mode).toBe('HYBRID')
    expect(loadModePreference()).toBe('HYBRID')
  })

  test('legacy DEFAULT/LITE/MAX/PLAN/FREE modes migrate to HYBRID', async () => {
    for (const legacy of ['DEFAULT', 'LITE', 'MAX', 'PLAN', 'FREE']) {
      fs.mkdirSync(getConfigDir(), { recursive: true })
      fs.writeFileSync(
        path.join(getConfigDir(), 'settings.json'),
        JSON.stringify({ mode: legacy }, null, 2),
      )
      const { loadModePreference } = await import('../settings')
      expect(loadModePreference()).toBe('HYBRID')
    }
  })

  test('default savant-code model preference is openrouter/free on first run (FID-2026-0806-010)', async () => {
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

  test('paid build preserves a non-free-catalog savantFreeModelPreference (FID-2026-0814-002)', async () => {
    // The paid CLI's /model + picker write savantFreeModelPreference with
    // arbitrary OpenRouter ids (free or paid) via switchModel. The strict
    // free-catalog gate must only apply in the SavantFree build — dropping it
    // here silently reverts the sidebar to a paid default on the next launch.
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify(
        { savantFreeModelPreference: 'nous/tencent/hy3:free' },
        null,
        2,
      ),
    )

    const { loadSettings } = await import('../settings')
    expect(loadSettings().savantFreeModelPreference).toBe(
      'nous/tencent/hy3:free',
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

  test('analytics notice is shown exactly once (FID-2026-0806-015)', async () => {
    const { hasAnalyticsNoticeBeenShown, markAnalyticsNoticeShown } =
      await import('../settings')

    expect(hasAnalyticsNoticeBeenShown()).toBe(false)
    markAnalyticsNoticeShown()
    expect(hasAnalyticsNoticeBeenShown()).toBe(true)
    // Idempotent: a second mark does not churn or reset the flag.
    markAnalyticsNoticeShown()
    expect(hasAnalyticsNoticeBeenShown()).toBe(true)
  })

  test('activeProvider defaults to openrouter without persisting it (FID-2026-0809-001 decision 12)', async () => {
    const { getActiveProvider, loadSettings } = await import('../settings')

    // The accessor defaults, but the fresh settings file must not carry an
    // explicit selection — Ollama auto-detection still runs on first run.
    expect(getActiveProvider()).toBe(DEFAULT_SAVANT_CODE_MODEL_PROVIDER)
    expect(loadSettings().activeProvider).toBeUndefined()
  })

  test('legacy directProvider migrates to activeProvider (FID-2026-0809-001 Phase 4)', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify({ directProvider: 'tokenharbor' }, null, 2),
    )

    const { loadSettings } = await import('../settings')
    expect(loadSettings().activeProvider).toBe('tokenharbor')
  })

  test('unknown activeProvider values are dropped on load', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify({ activeProvider: 'mystery-provider' }, null, 2),
    )

    const { loadSettings } = await import('../settings')
    expect(loadSettings().activeProvider).toBeUndefined()
  })

  test('explicit activeProvider wins over a stale legacy directProvider', async () => {
    fs.mkdirSync(getConfigDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getConfigDir(), 'settings.json'),
      JSON.stringify(
        { activeProvider: 'tokenharbor', directProvider: 'ollama' },
        null,
        2,
      ),
    )

    const { loadSettings } = await import('../settings')
    expect(loadSettings().activeProvider).toBe('tokenharbor')
  })
})
