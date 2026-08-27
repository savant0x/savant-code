import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

import { describe, expect, test } from 'bun:test'

import {
  findChecksumMismatches,
  findMissingVendorBinaries,
  PINNED_RIPGREP_SHA256,
  sha256File,
} from '../../scripts/vendor-manifest'
import { getSdkEnv } from '../env'
import { PLATFORM_TARGETS as LEAF_PLATFORM_TARGETS } from '../native/platform-targets'
import {
  getBundledRgPath,
  PLATFORM_TARGETS,
  resolvePlatformTarget,
} from '../native/ripgrep'

describe('PLATFORM_TARGETS single source (FID-2026-0821-005 B3)', () => {
  test('re-exports the leaf table binding (one source, no copies)', () => {
    expect(PLATFORM_TARGETS).toBe(LEAF_PLATFORM_TARGETS)
  })

  test('covers exactly five platforms with unique directories', () => {
    expect(PLATFORM_TARGETS).toHaveLength(5)
    const dirs = new Set(PLATFORM_TARGETS.map((t) => t.platformDir))
    expect(dirs.size).toBe(5)
  })

  test('windows uses rg.exe; every other platform uses rg', () => {
    for (const target of PLATFORM_TARGETS) {
      if (target.platform === 'win32') {
        expect(target.binaryName).toBe('rg.exe')
      } else {
        expect(target.binaryName).toBe('rg')
      }
    }
  })

  test('resolvePlatformTarget maps all five and throws off-matrix', () => {
    for (const target of PLATFORM_TARGETS) {
      expect(resolvePlatformTarget(target.platform, target.arch)).toBe(target)
    }
    expect(() => resolvePlatformTarget('sunos', 'x64')).toThrow(
      /Unsupported platform: sunos-x64/,
    )
  })
})

describe('getBundledRgPath resolver regimes (FID-2026-0821-005 B4/B6)', () => {
  test('env override wins outright and is announced on the debug line', () => {
    const debugMessages: string[] = []
    const env = { ...getSdkEnv(), SAVANT_CODE_RG_PATH: '/opt/rg-custom' }
    const resolved = getBundledRgPath(undefined, env, {
      debug: (message) => debugMessages.push(message),
    })
    expect(resolved).toBe('/opt/rg-custom')
    expect(debugMessages.join('\n')).toContain('env override')
  })

  test('a throwing debug logger never breaks resolution', () => {
    const env = { ...getSdkEnv(), SAVANT_CODE_RG_PATH: '/opt/rg-custom' }
    const resolved = getBundledRgPath(undefined, env, {
      debug: () => {
        throw new Error('logger exploded')
      },
    })
    expect(resolved).toBe('/opt/rg-custom')
  })

  test('resolves via the esm-dev candidate when the dev tree exists', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rg-esm-dev-'))
    // Two levels below the vendor root: <base>/x/y/module mirrors
    // src/native/ripgrep.ts resolving ../../vendor.
    const moduleDir = join(tmp, 'x', 'y')
    const target = resolvePlatformTarget()
    const binDir = join(tmp, 'vendor', 'ripgrep', target.platformDir)
    mkdirSync(moduleDir, { recursive: true })
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, target.binaryName), '#!/bin/sh fake rg\n')
    const debugMessages: string[] = []
    const metaUrl = pathToFileURL(join(moduleDir, 'ripgrep.ts')).href
    const env = { ...getSdkEnv(), SAVANT_CODE_RG_PATH: undefined }
    const resolved = getBundledRgPath(metaUrl, env, {
      debug: (message) => debugMessages.push(message),
    })
    const expected = join(
      tmp,
      'vendor',
      'ripgrep',
      target.platformDir,
      target.binaryName,
    )
    expect(resolved).toBe(expected)
    expect(debugMessages.join('\n')).toContain('resolved via esm-dev')
  })

  test('throws remediation error and announces exhaustion when all miss', () => {
    const savedCwd = process.cwd()
    const tmp = mkdtempSync(join(tmpdir(), 'rg-exhaust-'))
    const moduleDir = join(tmp, 'x', 'y')
    mkdirSync(moduleDir, { recursive: true })
    const metaUrl = pathToFileURL(join(moduleDir, 'ripgrep.ts')).href
    const debugMessages: string[] = []
    const env = { ...getSdkEnv(), SAVANT_CODE_RG_PATH: undefined }
    process.chdir(tmp)
    try {
      expect(() =>
        getBundledRgPath(metaUrl, env, {
          debug: (message) => debugMessages.push(message),
        }),
      ).toThrow(/Ripgrep binary not found/)
    } finally {
      process.chdir(savedCwd)
    }
    expect(debugMessages.join('\n')).toContain('exhausted all candidates')
  })
})

describe('vendored manifest + checksum pins (FID-2026-0821-005 B2/B6)', () => {
  test('sha256File hashes deterministically', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rg-sha-'))
    const file = join(dir, 'sample.txt')
    writeFileSync(file, 'savant vendored ripgrep')
    expect(sha256File(file)).toBe(
      createHash('sha256').update('savant vendored ripgrep').digest('hex'),
    )
  })

  test('pins cover every platform target with hex digests', () => {
    for (const target of PLATFORM_TARGETS) {
      expect(PINNED_RIPGREP_SHA256[target.platformDir]).toMatch(
        /^[0-9a-f]{64}$/,
      )
    }
  })

  test('findMissingVendorBinaries reports all five on an empty base', () => {
    const emptyBase = mkdtempSync(join(tmpdir(), 'rg-missing-'))
    const missing = findMissingVendorBinaries(emptyBase)
    expect(missing).toHaveLength(5)
    expect(missing).toContain(join('x64-win32', 'rg.exe'))
  })

  test('the working-tree vendor source satisfies manifest and pins', () => {
    const vendorSrc = join(
      import.meta.dir,
      '..',
      '..',
      '..',
      'sdk',
      'vendor',
      'ripgrep',
    )
    if (!existsSync(vendorSrc)) {
      return // hermetic guard: full-checkout assertion only
    }
    expect(findMissingVendorBinaries(vendorSrc)).toEqual([])
    expect(findChecksumMismatches(vendorSrc)).toEqual([])
  })
})

describe('cli compiled-mode parity (FID-2026-0821-005 B3)', () => {
  test('cli embed literals cover every platform target subpath', () => {
    const cliNativePath = join(
      import.meta.dir,
      '..',
      '..',
      '..',
      'cli',
      'src',
      'native',
      'ripgrep.ts',
    )
    const cliSource = readFileSync(cliNativePath, 'utf-8')
    for (const target of PLATFORM_TARGETS) {
      expect(cliSource).toContain(`${target.platformDir}/${target.binaryName}`)
    }
  })
})
