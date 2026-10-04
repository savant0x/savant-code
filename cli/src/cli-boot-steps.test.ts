import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  discloseFreeOptionsNoticeOnce,
  spawnDiscoveryHarvestIfStale,
} from './cli-boot-steps'
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

/**
 * FID-2026-1004-001 — the daily discovery cycle, rebuilt to the
 * FID-2026-0914-003 Loop-5 spec. The root cause of the outage was a
 * verified batch deleting the call sites without re-wiring them, so the
 * first pin is a reachability census (Law 4 with a mechanical backstop):
 * if a future refactor removes the wiring, a test fails instead of the
 * automation silently dying again.
 */
describe('daily discovery cycle (FID-2026-1004-001)', () => {
  test('reachability census: both leg call sites exist and the entrypoint calls the cycle', () => {
    const bootSteps = fs.readFileSync(
      path.join(import.meta.dir, 'cli-boot-steps.ts'),
      'utf8',
    )
    expect(bootSteps).toContain("'harvest-freeairouter.ts'")
    expect(bootSteps).toContain("'harvest-custats.ts'")
    expect(bootSteps).toContain('shouldRunBootCheck(')
    expect(bootSteps).toContain('shouldRunCustatsBootCheck(')
    const entrypoint = fs.readFileSync(
      path.join(import.meta.dir, 'index.tsx'),
      'utf8',
    )
    expect(entrypoint).toContain('spawnDiscoveryHarvestIfStale()')
  })

  test('spawns both legs when their artifacts are stale', () => {
    const repoRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'savant-discovery-stale-')),
    )
    try {
      seedRepoFixture(repoRoot, {
        report: 'stale',
        ledger: 'stale',
      })
      const spawned: string[][] = []
      const now = 1_000_000_000_000
      spawnDiscoveryHarvestIfStale(now, (cmd) => spawned.push(cmd), repoRoot)
      expect(spawned).toHaveLength(2)
      expect(spawned[0]?.[0]).toBe('bun')
      expect(spawned[0]?.[1]).toContain('harvest-freeairouter.ts')
      expect(spawned[0]?.[2]).toBe('--probe')
      expect(spawned[1]?.[1]).toContain('harvest-custats.ts')
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('legs are independent: a fresh report does not mask a missing ledger', () => {
    const repoRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'savant-discovery-mix-')),
    )
    try {
      seedRepoFixture(repoRoot, { report: 'fresh', ledger: 'absent' })
      const spawned: string[][] = []
      spawnDiscoveryHarvestIfStale(
        1_000_000_000_000,
        (cmd) => spawned.push(cmd),
        repoRoot,
      )
      expect(spawned).toHaveLength(1)
      expect(spawned[0]?.[1]).toContain('harvest-custats.ts')
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('fresh artifacts on both legs spawn nothing', () => {
    const repoRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'savant-discovery-fresh-')),
    )
    try {
      seedRepoFixture(repoRoot, { report: 'fresh', ledger: 'fresh' })
      const spawned: string[][] = []
      spawnDiscoveryHarvestIfStale(
        1_000_000_000_000,
        (cmd) => spawned.push(cmd),
        repoRoot,
      )
      expect(spawned).toHaveLength(0)
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true })
    }
  })

  test('outside a discovery repo nothing spawns (defense in depth)', () => {
    const plainDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'savant-discovery-plain-')),
    )
    try {
      const spawned: string[][] = []
      spawnDiscoveryHarvestIfStale(
        1_000_000_000_000,
        (cmd) => spawned.push(cmd),
        plainDir,
      )
      expect(spawned).toHaveLength(0)
    } finally {
      fs.rmSync(plainDir, { recursive: true, force: true })
    }
  })
})

/** Seed a minimal in-repo fixture for the daily-cycle spawn pins. */
function seedRepoFixture(
  repoRoot: string,
  state: {
    report: 'stale' | 'fresh' | 'absent'
    ledger: 'stale' | 'fresh' | 'absent'
  },
): void {
  fs.mkdirSync(path.join(repoRoot, 'scripts', 'providers'), {
    recursive: true,
  })
  fs.mkdirSync(path.join(repoRoot, 'dev', 'provider-candidates'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(repoRoot, 'scripts', 'providers', 'harvest-freeairouter.ts'),
    '',
  )
  fs.writeFileSync(
    path.join(repoRoot, 'scripts', 'providers', 'harvest-custats.ts'),
    '',
  )
  const now = 1_000_000_000_000
  const ages = {
    stale: now - 25 * 60 * 60 * 1000,
    fresh: now - 60 * 60 * 1000,
  }
  const artifacts = [
    {
      artifactPath: path.join(
        repoRoot,
        'dev',
        'provider-candidates',
        'report.md',
      ),
      kind: state.report,
    },
    {
      artifactPath: path.join(
        repoRoot,
        'dev',
        'provider-candidates',
        'custats.json',
      ),
      kind: state.ledger,
    },
  ] as const
  for (const { artifactPath, kind } of artifacts) {
    if (kind === 'absent') continue
    fs.writeFileSync(artifactPath, 'x')
    const when = new Date(ages[kind])
    fs.utimesSync(artifactPath, when, when)
  }
}
