import { describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPostWriteScanners } from '../post-write-scanners'

/** Runs the strict-tier scanner over one written file's content. */
function scan(content: string): ReturnType<typeof runPostWriteScanners> {
  const state = createEnforcementState()
  state.dirtyFiles.add('src/example.ts')
  state.verifiedFiles.add('src/example.ts')
  return runPostWriteScanners({
    state,
    mode: 'strict',
    tier: 'all_15',
    getWrittenFileContent: () => content,
  })
}

const law6Warnings = (content: string): string[] =>
  scan(content)
    .warnings.filter((warning) => warning.law === 6)
    .map((warning) => warning.message)

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

describe('runPostWriteScanners — Law 6 two-stage scan (FID-2026-1013-012 W3-4)', () => {
  it('does not flag the English word any in prose comments', () => {
    expect(
      law6Warnings(
        '// Returns true when any entry matches\nexport const x = 1\n',
      ),
    ).toEqual([])
  })

  it('does not flag the English word any in block comments', () => {
    expect(
      law6Warnings('/* any file may match */\nexport const x = 1\n'),
    ).toEqual([])
  })

  it('does not flag the English word any in string literals', () => {
    expect(
      law6Warnings('export const msg = "Could not find any files"\n'),
    ).toEqual([])
  })

  it('still flags the any type keyword in code', () => {
    const messages = law6Warnings('export const value: any = 1\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('any keyword')
  })

  it('still flags as any casts and any arrays', () => {
    expect(law6Warnings('export const v = input as any\n')).toHaveLength(1)
    expect(law6Warnings('export const list: any[] = []\n')).toHaveLength(1)
  })

  it('still flags a ts-expect-error directive on raw content', () => {
    const messages = law6Warnings(
      '// @ts-expect-error - upstream typing gap\nexport const x = 1\n',
    )
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('ts-ignore/ts-expect-error')
  })

  it('still flags any inside a template literal interpolation', () => {
    expect(law6Warnings('type T = `id-${any}`\n')).toHaveLength(1)
  })

  it('does not flag a template literal text chunk that spells any', () => {
    expect(law6Warnings('export const s = `no matches for any`\n')).toEqual([])
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
