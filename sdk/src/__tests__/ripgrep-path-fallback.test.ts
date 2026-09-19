/**
 * FID-2026-0918-007 — PATH-fallback resolution regression suite.
 *
 * Pins the final resolver candidate added by the FID: when every vendored
 * candidate misses, an `rg` on PATH resolves (via `where`/`which` probe,
 * memoized) instead of the resolver hard-failing. The probe is injected so
 * these tests are deterministic on machines that DO have ripgrep on PATH;
 * `resetPathRgCacheForTests()` clears the memo between regimes.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

import { describe, expect, test } from 'bun:test'

import { getSdkEnv } from '../env'
import { resolvePlatformTarget } from '../native/platform-targets'
import {
  getBundledRgPath,
  resetPathRgCacheForTests,
  resolveRgFromPath,
} from '../native/ripgrep'

const tempDirs: string[] = []

/** Fresh exhaustion layout: <tmp>/x/y/module with no vendor tree. */
function mkdtempForExhaustion(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'rg-path-fallback-'))
  tempDirs.push(tmp)
  mkdirSync(join(tmp, 'x', 'y'), { recursive: true })
  return tmp
}

function moduleUrlIn(tmp: string): string {
  return pathToFileURL(join(tmp, 'x', 'y', 'ripgrep.ts')).href
}

function cleanup(tmp: string): void {
  rmSync(tmp, { recursive: true, force: true })
  const index = tempDirs.indexOf(tmp)
  if (index !== -1) tempDirs.splice(index, 1)
}

describe('PATH fallback (FID-2026-0918-007)', () => {
  test('resolves via path-probe when all vendored candidates miss', () => {
    resetPathRgCacheForTests()
    const tmp = mkdtempForExhaustion()
    const debugMessages: string[] = []
    const env = { ...getSdkEnv(), SAVANT_CODE_RG_PATH: undefined }
    // chdir like the exhaustion test: the cwd-fallback candidate would
    // otherwise resolve the REAL repo's node_modules rg.exe.
    const savedCwd = process.cwd()
    process.chdir(tmp)
    try {
      const resolved = getBundledRgPath(
        moduleUrlIn(tmp),
        env,
        { debug: (message) => debugMessages.push(message) },
        () => '/usr/local/bin/rg',
      )
      expect(resolved).toBe('/usr/local/bin/rg')
      expect(debugMessages.join('\n')).toContain('resolved via path-probe')
    } finally {
      process.chdir(savedCwd)
      cleanup(tmp)
    }
  })

  test('still throws the workspace-correct remediation when PATH probe misses too', () => {
    resetPathRgCacheForTests()
    const tmp = mkdtempForExhaustion()
    const debugMessages: string[] = []
    const env = { ...getSdkEnv(), SAVANT_CODE_RG_PATH: undefined }
    const savedCwd = process.cwd()
    process.chdir(tmp)
    try {
      expect(() =>
        getBundledRgPath(
          moduleUrlIn(tmp),
          env,
          { debug: (message) => debugMessages.push(message) },
          () => undefined,
        ),
      ).toThrow(/Ripgrep binary not found/)
    } finally {
      process.chdir(savedCwd)
      cleanup(tmp)
    }
    expect(debugMessages.join('\n')).toContain('exhausted all candidates')
  })

  test('vendored candidates keep priority over the PATH fallback', () => {
    resetPathRgCacheForTests()
    const tmp = mkdtempForExhaustion()
    // Build a vendored binary in the esm-dev position relative to the fake
    // module dir: <tmp>/x/y/module -> ../../vendor/ripgrep/<dir>/<bin>.
    const target = resolvePlatformTarget()
    const binDir = join(tmp, 'vendor', 'ripgrep', target.platformDir)
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, target.binaryName), '#!/bin/sh fake rg\n')
    const env = { ...getSdkEnv(), SAVANT_CODE_RG_PATH: undefined }
    let probeCalls = 0
    try {
      const resolved = getBundledRgPath(
        moduleUrlIn(tmp),
        env,
        undefined,
        () => {
          probeCalls += 1
          return '/should/not/be/used'
        },
      )
      expect(resolved).not.toBe('/should/not/be/used')
      expect(probeCalls).toBe(0)
    } finally {
      cleanup(tmp)
    }
  })

  test('env override still wins outright (candidate 1 unchanged)', () => {
    resetPathRgCacheForTests()
    const env = { ...getSdkEnv(), SAVANT_CODE_RG_PATH: '/opt/rg-first' }
    const resolved = getBundledRgPath(undefined, env, undefined, () => {
      throw new Error('probe must not run when the env override is set')
    })
    expect(resolved).toBe('/opt/rg-first')
  })

  test('memoizes the PATH probe per process; reset hook clears it', () => {
    resetPathRgCacheForTests()
    let calls = 0
    const first = resolveRgFromPath(undefined, () => {
      calls += 1
      return '/memoized/rg'
    })
    const second = resolveRgFromPath(undefined, () => {
      calls += 1
      return '/other/rg'
    })
    expect(first).toBe('/memoized/rg')
    expect(second).toBe('/memoized/rg')
    expect(calls).toBe(1)
    resetPathRgCacheForTests()
    const third = resolveRgFromPath(undefined, () => {
      calls += 1
      return '/after-reset/rg'
    })
    expect(third).toBe('/after-reset/rg')
    expect(calls).toBe(2)
    resetPathRgCacheForTests()
  })

  test('a memoized PATH miss is cached too (no repeated spawn)', () => {
    resetPathRgCacheForTests()
    let calls = 0
    const first = resolveRgFromPath(undefined, () => {
      calls += 1
      return undefined
    })
    const second = resolveRgFromPath(undefined, () => {
      calls += 1
      return undefined
    })
    expect(first).toBeUndefined()
    expect(second).toBeUndefined()
    expect(calls).toBe(1)
    resetPathRgCacheForTests()
  })
})
