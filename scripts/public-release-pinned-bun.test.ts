// Public release contract — pinned Bun runtime resolution. Sibling of the
// FID-2026-0819-005 Loop 317 decomposition.

import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  ensurePinnedBunOnPath,
  pinnedBunCandidates,
  resolvePinnedBun,
  validateToolVersions,
} from './public-release'

describe('public release contract — pinned Bun', () => {
  test('requires the pinned Bun and npm compatibility contract', () => {
    expect(() => validateToolVersions('1.3.14', '10.9.2')).not.toThrow()
    expect(() => validateToolVersions('1.3.11', '10.9.2')).toThrow('Bun 1.3.14')
    expect(() => validateToolVersions('1.3.14', '9.9.9')).toThrow('npm 10.x')
  })

  test('probes the version-pinned Bun install before the standard location', () => {
    const home = mkdtempSync(path.join(os.tmpdir(), 'savant-bun-home-'))
    try {
      const candidates = pinnedBunCandidates(home)
      expect(candidates).toHaveLength(2)
      expect(candidates[0]).toContain('.bun-1.3.14')
      expect(candidates[1]).toContain(path.join('.bun', 'bin'))
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('resolvePinnedBun returns undefined when no pinned install exists', () => {
    const home = mkdtempSync(path.join(os.tmpdir(), 'savant-bun-empty-'))
    try {
      expect(resolvePinnedBun(process.cwd(), home)).toBeUndefined()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  // Environment-dependent by design: this machine's contract is that `bun` on
  // PATH is the pinned version OR a version-pinned install exists to fall back
  // to. On a machine where neither holds the test fails, which is the same
  // fail-closed contract the release gate enforces.
  test('ensurePinnedBunOnPath makes the pinned Bun the effective runtime', () => {
    const previousPath = process.env.PATH
    try {
      ensurePinnedBunOnPath(process.cwd())
      const probe = spawnSync('bun', ['--version'], {
        encoding: 'utf8',
        windowsHide: true,
      })
      expect(probe.status).toBe(0)
      expect(probe.stdout.trim()).toBe('1.3.14')
    } finally {
      if (previousPath === undefined) delete process.env.PATH
      else process.env.PATH = previousPath
    }
  })
})
