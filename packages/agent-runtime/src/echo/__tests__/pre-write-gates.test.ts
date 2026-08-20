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
 * - In HYBRID (core_4) mode the Law 1 gate is inert: the non-blocking
 *   EchoComplianceTracker (FID-2026-0804-009) emits the advisory receipt,
 *   and a duplicate block/warning here would double-report (the
 *   `echo-compliance-wiring` law1-receipt failure).
 * - In STRICT (all_15) mode the gate blocks writes to existing files that
 *   were never read — hard enforcement is preserved.
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

  it('does NOT block an unread existing file in hybrid mode (tracker owns the advisory)', () => {
    const target = existingFilePath()
    const result = runGate({ targetPath: target, tier: 'core_4' })
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

describe('runPreWriteGates — P5b YAGNI gate (FID-2026-0806-003)', () => {
  const yagniVerified = `<yagni_check>
{"isSpeculative":false,"reusedEntities":["buildArray"],"stdlibAlternatives":[],"dependenciesAvoided":[],"debtMarkersInserted":[],"rungsTraversed":[1,2,3,4,5,6],"exemptions":[]}
</yagni_check>
\nconst x = 1`
  const yagniSpeculativeNoMarker = `<yagni_check>
{"isSpeculative":true,"reusedEntities":[],"stdlibAlternatives":[],"dependenciesAvoided":[],"debtMarkersInserted":[],"rungsTraversed":[1],"exemptions":[]}
</yagni_check>
\nconst x = 1`
  const yagniSpeculativeWithMarker = `<yagni_check>
{"isSpeculative":true,"reusedEntities":[],"stdlibAlternatives":[],"dependenciesAvoided":[],"debtMarkersInserted":["ponytail: ceiling=a; upgrade=b"],"rungsTraversed":[1],"exemptions":[]}
</yagni_check>
\n// ponytail: ceiling=a; upgrade=b\nconst x = 1`

  function runForgeGate(content: string) {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: '/proj/x.ts', content },
      agentId: 'forge',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    return { result, state }
  }

  it('passes a Forge write with a verified yagni_check block', () => {
    const { result } = runForgeGate(yagniVerified)
    expect(result.blocked).toBe(false)
  })

  it('BLOCKS a speculative Forge write without a debt marker', () => {
    const { result, state } = runForgeGate(yagniSpeculativeNoMarker)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('YAGNI')
    expect(state.yagni.speculativeWritesRejected).toBe(1)
  })

  it('allows a speculative write WITH a documented debt marker (Debt-Incurred)', () => {
    const { result, state } = runForgeGate(yagniSpeculativeWithMarker)
    expect(result.blocked).toBe(false)
    expect(state.yagni.lastAssessment?.isSpeculative).toBe(true)
    expect(state.yagni.lastAssessment?.debtMarkersInserted.length).toBe(1)
  })

  it('does not gate non-Forge agents', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: '/proj/x.ts', content: 'no yagni block at all' },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
  })
})

describe('runPreWriteGates — Anti-Deferral FID step-status gate (FID-2026-0817-005)', () => {
  const FID_PATH = '/proj/dev/fids/FID-2026-0817-010-x.md'

  function runFidWrite(content: string, agentId = 'savant') {
    const state = createEnforcementState()
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: FID_PATH, content },
      agentId,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
  }

  it('BLOCKS a closed FID write with unresolved steps and lists them', () => {
    const content =
      '# FID: test\n\n**Status:** closed\n\n## Step Status\n' +
      '- [x] 1. done — implemented\n' +
      '- [ ] 2. not done\n'
    const result = runFidWrite(content)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('FID gate')
    expect(result.reason).toContain('not done')
    expect(result.reason).toContain('operator')
  })

  it('allows a closed FID write when every step is implemented', () => {
    const content =
      '# FID: test\n\n**Status:** closed\n\n## Step Status\n' +
      '- [x] 1. done — implemented\n'
    const result = runFidWrite(content)
    expect(result.blocked).toBe(false)
  })

  it('allows a closed FID write with an operator-approved deferral', () => {
    const content =
      '# FID: test\n\n**Status:** closed\n\n## Step Status\n' +
      '- [x] 1. done — implemented\n' +
      '- [ ] 2. later — deferred::operator-approved 2026-08-16\n'
    const result = runFidWrite(content)
    expect(result.blocked).toBe(false)
  })

  it('does NOT gate a converged write with no Step Status section (legacy)', () => {
    const content = '# FID: test\n\n**Status:** converged\n'
    const result = runFidWrite(content)
    expect(result.blocked).toBe(false)
  })

  it('does not gate non-FID paths', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: {
        path: '/proj/src/x.ts',
        content: '**Status:** closed\n## Step Status\n- [ ] 1. x\n',
      },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
  })
})
