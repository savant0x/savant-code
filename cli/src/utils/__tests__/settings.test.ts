import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

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

    // Telemetry-style settings must default to false/opt-in.
    expect(settings.adsEnabled).toBe(false)

    // Verify the persisted file also reflects the default.
    const settingsPath = path.join(getConfigDir(), 'settings.json')
    expect(fs.existsSync(settingsPath)).toBe(true)
    const persisted = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    expect(persisted.adsEnabled).toBe(false)
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
})
