/**
 * FID-2026-1004-007 — launch-digest pins (digest renderer + once-per-day gate).
 *
 * The digest composes the free-lane announce, the expiring offers, and the
 * discovery delta; the gate persists the local digest-shown date. Fixtures
 * come from free-options-test-fixtures.ts (shared with free-options.test.ts).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { CATALOG, CTX } from './free-options-test-fixtures'
import {
  buildFreeOptionsReport,
  renderFreeOptionsDigest,
} from '../free-options'
import {
  loadFreeOptionsDigestShownOn,
  markFreeOptionsDigestShown,
} from '../settings'

describe('FID-2026-1004-007: launch digest (rewired announce + offers + delta)', () => {
  test('composes the free-lane announce, the offers, and the discovery delta', () => {
    const report = {
      ...buildFreeOptionsReport(CATALOG, CTX),
      discoveryOffers: ['Vercel: an advertised offer ends within 24h'],
    }
    const joined = renderFreeOptionsDigest(report, {
      newCount: 1,
      changedCount: 34,
    }).join('\n')
    expect(joined).toContain('Free AI lanes available')
    expect(joined).toContain('Offers: 1 advertised')
    expect(joined).toContain('Discovery: 1 new / 34 changed')
    expect(joined).toContain('/provider free')
    expect(joined).toContain('/notifications')
  })

  test('a null report still surfaces a delta-only digest', () => {
    const joined = renderFreeOptionsDigest(null, {
      newCount: 2,
      changedCount: 0,
    }).join('\n')
    expect(joined).toContain('2 new / 0 changed')
  })

  test('nothing to say renders no lines', () => {
    expect(renderFreeOptionsDigest(null, null)).toEqual([])
    expect(
      renderFreeOptionsDigest(null, { newCount: 0, changedCount: 0 }),
    ).toEqual([])
  })
})

describe('FID-2026-1004-007: once-per-day digest gate', () => {
  let tempDir = ''
  let originalConfigDir: string | undefined

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-digest-gate-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
  })

  afterEach(() => {
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('the digest date flag round-trips and is idempotent per date', () => {
    expect(loadFreeOptionsDigestShownOn()).toBeUndefined()
    markFreeOptionsDigestShown('2026-10-04')
    expect(loadFreeOptionsDigestShownOn()).toBe('2026-10-04')
    markFreeOptionsDigestShown('2026-10-04')
    expect(loadFreeOptionsDigestShownOn()).toBe('2026-10-04')
    markFreeOptionsDigestShown('2026-10-05')
    expect(loadFreeOptionsDigestShownOn()).toBe('2026-10-05')
  })
})
