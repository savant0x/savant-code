/**
 * EHEL pre-write gates — regression tests (FID-2026-0805-007).
 *
 * Locks the Law 1 gate contract that regressed and broke the tool-executor
 * wiring:
 *
 * - A NEW file (does not exist on disk) is ALWAYS exempt — it cannot have
 *   been read, so Law 1 does not apply. The unconditional block previously
 *   short-circuited every new-file write in the default hybrid mode (the
 *   `mainPrompt > should handle write_file tool call` failure).
 * - FID-2026-0823-007 (operator directive 2026-0823): Laws 1-4 are
 *   immutable and block in EVERY execution mode — the former HYBRID
 *   (core_4) inertness was revoked. Blocked writes never reach the
 *   tracker's receipt path, so no double-reporting occurs.
 * - STRICT (all_15) keeps identical Law 1 semantics plus extended-law
 *   gates (Laws 7/8) and the post-write scanners.
 * - Law 3 (verify-before-proceed) still blocks unverified follow-up writes.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'

describe('runPreWriteGates — Law 1 (read-before-write)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function existingFilePath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'pre-write-gates-'))
    tempDirs.push(dir)
    const file = join(dir, 'existing.ts')
    writeFileSync(file, '// pre-existing content\n')
    return file
  }

  function runGate(params: {
    targetPath: string | undefined
    tier: 'core_4' | 'all_15'
    readPaths?: string[]
    dirtyFiles?: string[]
    verified?: boolean
    /** Satisfy the strict-mode Law 7/8 preconditions so Law 1 is isolated. */
    strictPreconditions?: boolean
    agentId?: string
  }) {
    const state = createEnforcementState()
    for (const p of params.readPaths ?? []) state.filesRead.add(p)
    for (const d of params.dirtyFiles ?? []) state.dirtyFiles.add(d)
    if (params.verified !== undefined) {
      state.hasVerifiedSinceLastDirty = params.verified
    }
    // Strict mode also enforces Law 7 (search-before-create) and Law 8
    // (intent-logged-before-first-write). Tests isolating Law 1 must satisfy
    // both, otherwise a Law 7/8 block would mask the Law 1 assertion.
    if (params.strictPreconditions) {
      state.hasSearchedSinceGreen = true
      state.intentLogged = true
    }
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: params.targetPath },
      agentId: params.agentId ?? 'savant',
      state,
      mode: params.tier === 'all_15' ? 'strict' : 'hybrid',
      tier: params.tier,
    })
  }

  it('does NOT block a brand-new file in hybrid mode (regression: main-prompt write_file)', () => {
    const result = runGate({
      targetPath: join(tmpdir(), 'pre-write-gates-new', 'new-file.txt'),
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
  })

  it('does NOT block a brand-new file in strict mode (new-file exemption)', () => {
    const result = runGate({
      targetPath: join(tmpdir(), 'pre-write-gates-new2', 'new-file.txt'),
      tier: 'all_15',
      strictPreconditions: true,
    })
    expect(result.blocked).toBe(false)
  })

  it('BLOCKS an unread existing file in hybrid mode (FID-2026-0823-007)', () => {
    const target = existingFilePath()
    const result = runGate({ targetPath: target, tier: 'core_4' })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 1')
    expect(result.reason).toContain('has not been read')
  })

  it('does NOT block an existing file that was read first, even in hybrid mode', () => {
    const target = existingFilePath()
    const result = runGate({
      targetPath: target,
      tier: 'core_4',
      readPaths: [target],
    })
    expect(result.blocked).toBe(false)
  })

  it('BLOCKS an unread existing file in strict mode with a Law 1 reason', () => {
    const target = existingFilePath()
    const result = runGate({ targetPath: target, tier: 'all_15' })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 1')
    expect(result.reason).toContain('has not been read')
  })

  it('does NOT block an existing file that was read first, even in strict mode', () => {
    const target = existingFilePath()
    const result = runGate({
      targetPath: target,
      tier: 'all_15',
      readPaths: [target],
      strictPreconditions: true,
    })
    expect(result.blocked).toBe(false)
  })

  it('still blocks an unverified follow-up write (Law 3 unchanged)', () => {
    const target = existingFilePath()
    const result = runGate({
      targetPath: target,
      tier: 'core_4',
      readPaths: [target],
      dirtyFiles: ['/proj/dirty.ts'],
      verified: false,
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 3')
  })
})
