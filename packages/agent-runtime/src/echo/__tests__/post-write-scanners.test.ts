import { describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPostWriteScanners } from '../post-write-scanners'

describe('runPostWriteScanners', () => {
  it('scans exact successful content and reports law violations', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/example.ts')

    const result = runPostWriteScanners({
      state,
      mode: 'strict',
      tier: 'all_15',
      getWrittenFileContent: () => 'const value: any = 1 // TODO',
    })

    expect(result.blocked).toBe(true)
    expect(result.warnings.map((warning) => warning.law)).toEqual(
      expect.arrayContaining([5, 6]),
    )
  })

  it('treats an empty string as available content', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/empty.ts')

    const result = runPostWriteScanners({
      state,
      mode: 'strict',
      tier: 'all_15',
      getWrittenFileContent: () => '',
    })

    expect(
      result.warnings.some((warning) =>
        warning.message.includes('content unavailable'),
      ),
    ).toBe(false)
  })

  it('fails closed when successful write content is unavailable', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/unavailable.ts')

    const result = runPostWriteScanners({
      state,
      mode: 'strict',
      tier: 'all_15',
    })

    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('content unavailable')
    // Assert by predicate, not index: the Law 15 cumulative check
    // (FID-2026-0820-014 EC-1) legitimately precedes the per-file scan
    // when the dirty file has no verification credit.
    const unavailable = result.warnings.find(
      (warning) => warning.file === 'src/unavailable.ts',
    )
    expect(unavailable).toBeDefined()
    expect(unavailable?.message).toContain('content unavailable')
  })

  it('does not block or scan extended laws in hybrid mode', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/example.ts')

    const result = runPostWriteScanners({
      state,
      mode: 'hybrid',
      tier: 'core_4',
      getWrittenFileContent: () => 'const value: any = 1 // TODO',
    })

    expect(result).toEqual({ blocked: false, warnings: [] })
  })
})

describe('runPostWriteScanners — Law 15 cumulative verification (FID-2026-0820-014 EC-1)', () => {
  it('does NOT block a fully verified turn even with the stale latch false', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/verified.ts')
    state.verifiedFiles.add('src/verified.ts')
    // The write path sets this false and only resetForNewTurn clears it.
    // The scanner must consult the cumulative predicate instead
    // (FID-2026-0820-014 EC-1) — the latch read deadlocked strict-mode
    // turn end because resetForNewTurn never runs while the scanner
    // keeps blocking.
    state.hasVerifiedSinceLastDirty = false

    const result = runPostWriteScanners({
      state,
      mode: 'strict',
      tier: 'all_15',
      getWrittenFileContent: () => 'export const ok = 1\n',
    })

    expect(result.blocked).toBe(false)
    expect(result.warnings.some((warning) => warning.law === 15)).toBe(false)
  })

  it('still BLOCKS when a dirty file has no verification credit (Law 15 preserved)', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/unverified.ts')
    state.hasVerifiedSinceLastDirty = false

    const result = runPostWriteScanners({
      state,
      mode: 'strict',
      tier: 'all_15',
      getWrittenFileContent: () => 'export const ok = 1\n',
    })

    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 15')
  })

  it('BLOCKS on partial verification and passes the fully verified file', () => {
    const state = createEnforcementState()
    state.dirtyFiles.add('src/a.ts')
    state.dirtyFiles.add('src/b.ts')
    state.verifiedFiles.add('src/a.ts')
    state.hasVerifiedSinceLastDirty = false

    const result = runPostWriteScanners({
      state,
      mode: 'strict',
      tier: 'all_15',
      getWrittenFileContent: () => 'export const ok = 1\n',
    })

    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 15')
  })
})
