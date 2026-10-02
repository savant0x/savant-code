import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { discloseFreeOptionsNoticeOnce } from './cli-boot-steps'
import {
  hasFreeOptionsNoticeBeenShown,
  markFreeOptionsNoticeShown,
} from './utils/settings'

/**
 * FID-2026-1001-002 — the one-time free-options discovery notice (RED-first,
 * beside the module like the pre-init precedent). Pins: prints to stderr
 * once, retires after the first show (persisted settings flag), and the
 * flag round-trips idempotently.
 */
describe('free-options discovery notice (FID-2026-1001-002)', () => {
  let tempDir = ''
  let originalConfigDir: string | undefined

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-boot-notice-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
  })

  afterEach(() => {
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('prints the notice to stderr once and retires after the first show', () => {
    const errors: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    }
    try {
      expect(hasFreeOptionsNoticeBeenShown()).toBe(false)
      discloseFreeOptionsNoticeOnce()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('/provider free')
      expect(hasFreeOptionsNoticeBeenShown()).toBe(true)
      // Retirement: the second call prints nothing more.
      discloseFreeOptionsNoticeOnce()
      expect(errors).toHaveLength(1)
    } finally {
      console.error = originalError
    }
  })

  test('markFreeOptionsNoticeShown is idempotent', () => {
    markFreeOptionsNoticeShown()
    expect(hasFreeOptionsNoticeBeenShown()).toBe(true)
    markFreeOptionsNoticeShown()
    expect(hasFreeOptionsNoticeBeenShown()).toBe(true)
  })
})
