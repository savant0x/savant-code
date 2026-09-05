// Public release contract — local-state snapshot/restoration and the
// prior-release guard. Sibling of the FID-2026-0819-005 Loop 317 decomposition.

import {
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  applyPublicProfile,
  assertNoUnrestoredPriorRelease,
  settingsAlreadyPublic,
  snapshotLocalState,
  withLocalStateRestoration,
} from './public-release'

describe('public release contract — local state', () => {
  test('restores local settings after a simulated failed release stage', async () => {
    const configDir = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-test-'),
    )
    const settingsPath = path.join(configDir, 'settings.json')
    const originalSettings = JSON.stringify(
      {
        savantCodeModelPreference: 'personal/model',
        savantCodeModelProviderPreference: 'personal',
      },
      null,
      2,
    )
    writeFileSync(settingsPath, originalSettings)
    const previousConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    const previousModel = process.env.SAVANT_CODE_DEFAULT_MODEL_ID
    process.env.SAVANT_CODE_CONFIG_DIR = configDir
    process.env.SAVANT_CODE_DEFAULT_MODEL_ID = 'personal/model'

    try {
      const snapshot = snapshotLocalState()
      let restored = false
      expect(
        withLocalStateRestoration(
          snapshot,
          () => {
            applyPublicProfile(snapshot)
            expect(readFileSync(settingsPath, 'utf8')).toContain(
              'openrouter/free',
            )
            throw new Error('simulated gate failure')
          },
          () => {
            restored = true
          },
        ),
      ).rejects.toThrow('simulated gate failure')
      expect(restored).toBe(true)

      expect(readFileSync(settingsPath, 'utf8')).toBe(originalSettings)
      expect(process.env.SAVANT_CODE_DEFAULT_MODEL_ID).toBe('personal/model')
    } finally {
      if (previousConfigDir === undefined)
        delete process.env.SAVANT_CODE_CONFIG_DIR
      else process.env.SAVANT_CODE_CONFIG_DIR = previousConfigDir
      if (previousModel === undefined)
        delete process.env.SAVANT_CODE_DEFAULT_MODEL_ID
      else process.env.SAVANT_CODE_DEFAULT_MODEL_ID = previousModel
      rmSync(configDir, { recursive: true, force: true })
    }
  })

  test('detects settings that already carry the public release profile', () => {
    expect(settingsAlreadyPublic(undefined)).toBe(false)
    expect(settingsAlreadyPublic('{"model":"personal"}')).toBe(false)
    expect(
      settingsAlreadyPublic(
        '{"savantCodeModelPreference":"openrouter/free","directProvider":"openrouter"}',
      ),
    ).toBe(true)
  })

  test('refuses to re-bake the public profile when a prior release did not restore', () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-prior-'),
    )
    const publicSettings =
      '{"savantCodeModelPreference":"openrouter/free","directProvider":"openrouter"}'
    // Explicit, strictly increasing mtimes: rapid writeFileSync calls on the
    // same filesystem can otherwise share a timestamp, making the "most
    // recent receipt" selection order-dependent (flaky on Windows NTFS).
    const stamp = (file: string, mtimeMs: number) =>
      utimesSync(path.join(directory, file), mtimeMs / 1000, mtimeMs / 1000)
    try {
      // No receipts at all → safe.
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory),
      ).not.toThrow()
      // Diagnostic receipts never apply or restore → never evidence of a crash.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.21-diagnostic.json'),
        JSON.stringify({ restored: false }),
      )
      stamp('savant-public-release-0.0.21-diagnostic.json', 1_700_000_000_000)
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory),
      ).not.toThrow()
      // An unrestored prior release receipt fails closed.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.21.json'),
        JSON.stringify({ restored: false, version: '0.0.21' }),
      )
      stamp('savant-public-release-0.0.21.json', 1_700_000_100_000)
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory),
      ).toThrow('did not confirm restoration')
      // A newer restored receipt overrides the older unrestored one.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.22.json'),
        JSON.stringify({ restored: true, version: '0.0.22' }),
      )
      stamp('savant-public-release-0.0.22.json', 1_700_000_200_000)
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory),
      ).not.toThrow()
      // Personal settings never trigger the guard, even with unrestored receipts.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.23.json'),
        JSON.stringify({ restored: false, version: '0.0.23' }),
      )
      stamp('savant-public-release-0.0.23.json', 1_700_000_300_000)
      expect(() =>
        assertNoUnrestoredPriorRelease('{"model":"personal"}', directory),
      ).not.toThrow()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('ignores release receipts stamped for another repository', () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-foreign-'),
    )
    const publicSettings =
      '{"savantCodeModelPreference":"openrouter/free","directProvider":"openrouter"}'
    try {
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.24.json'),
        JSON.stringify({
          restored: false,
          version: '0.0.24',
          repositoryKey: 'deadbeef',
        }),
      )
      // A foreign unrestored receipt must never block this repo.
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory, 'cafebabe'),
      ).not.toThrow()
      // Matching repo identity still fails closed.
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory, 'deadbeef'),
      ).toThrow('did not confirm restoration')
      // Legacy receipts (no identity) still count for this repo.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.23.json'),
        JSON.stringify({ restored: false, version: '0.0.23' }),
      )
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory, 'cafebabe'),
      ).toThrow('did not confirm restoration')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('fails closed when the newest prior receipt is unreadable', () => {
    const directory = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-unreadable-'),
    )
    const publicSettings =
      '{"savantCodeModelPreference":"openrouter/free","directProvider":"openrouter"}'
    try {
      // A torn/corrupt receipt is exactly the crash evidence the guard exists
      // for; it must fail closed instead of being silently skipped.
      writeFileSync(
        path.join(directory, 'savant-public-release-0.0.25.json'),
        '{"restored": fals',
      )
      expect(() =>
        assertNoUnrestoredPriorRelease(publicSettings, directory, 'cafebabe'),
      ).toThrow('unreadable')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
