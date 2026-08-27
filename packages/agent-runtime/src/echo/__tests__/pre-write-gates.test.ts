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
import { computeFidFingerprint } from '../fid-verification-gates'
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

  it('BLOCKS a speculative write when the block lands in assistant TEXT (FID-2026-0822-004)', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      // The payload carries NO block — the model emitted it at the top of its
      // response text per the Forge prompt.
      input: { path: '/proj/x.ts', content: 'const x = 1' },
      agentId: 'forge',
      assistantText: yagniSpeculativeNoMarker,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('YAGNI')
    expect(state.yagni.speculativeWritesRejected).toBe(1)
  })

  it('passes a verified block extracted from assistant TEXT (FID-2026-0822-004)', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: '/proj/x.ts', content: 'const x = 1' },
      agentId: 'forge',
      assistantText: yagniVerified,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
    expect(state.yagni.lastAssessment?.isSpeculative).toBe(false)
  })

  it('prefers the payload channel over assistant TEXT (FID-2026-0822-004)', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      // Payload declares verified; text declares speculative. The payload wins
      // so the block the gate historically parsed still governs.
      input: { path: '/proj/x.ts', content: yagniVerified },
      agentId: 'forge',
      assistantText: yagniSpeculativeNoMarker,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
    expect(state.yagni.lastAssessment?.isSpeculative).toBe(false)
  })

  it('disables the gate entirely when yagni.enforced is false (FID-2026-0822-004)', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: '/proj/x.ts', content: yagniSpeculativeNoMarker },
      agentId: 'forge',
      yagniEnforced: false,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
    expect(result.warnings.length).toBe(0)
    expect(state.yagni.speculativeWritesRejected).toBe(0)
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

describe('runPreWriteGates — FID verification receipt tripwire (FID-2026-0823-009)', () => {
  const FID_PATH = '/proj/dev/fids/FID-2026-0823-010-x.md'

  function fidWithStatus(status: string, includeReceipt: boolean): string {
    const gates =
      '## Verification Gates\n\n- gate: probe scripts/__tests__/fixtures/fid-verify-echo.ts\n'
    const content = `# FID: test\n\n**Status:** ${status}\n\n${gates}`
    if (!includeReceipt) return content
    // Receipt goes AFTER the gate lines (the same shape stampReceipt emits).
    const receipt = `### Verification Receipt\n\n- verified: 2026-08-23T15:04:00Z\n- probe scripts/__tests__/fixtures/fid-verify-echo.ts: exit 0\n`
    const withReceipt = content.replace(/(- gate: [^\n]*\n)/, `$1\n${receipt}`)
    const fingerprint = computeFidFingerprint(withReceipt)
    return withReceipt.replace(
      '- verified: 2026-08-23T15:04:00Z',
      `- fingerprint: sha256:${fingerprint}\n- verified: 2026-08-23T15:04:00Z`,
    )
  }

  function runFidWrite(content: string) {
    const state = createEnforcementState()
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: FID_PATH, content },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
  }

  it('BLOCKS flipping to fixed without a verification receipt', () => {
    const result = runFidWrite(fidWithStatus('fixed', false))
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('FID gate')
    expect(result.reason).toContain('verification receipt')
    expect(result.reason).toContain('fid:verify')
  })

  it('BLOCKS flipping to verified without a verification receipt', () => {
    const result = runFidWrite(fidWithStatus('verified', false))
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('verification receipt')
  })

  it('ALLOWS flipping to fixed with a valid fresh receipt', () => {
    const result = runFidWrite(fidWithStatus('fixed', true))
    expect(result.blocked).toBe(false)
  })

  it('does NOT gate analyzed writes (section-conditional)', () => {
    const result = runFidWrite(fidWithStatus('analyzed', false))
    expect(result.blocked).toBe(false)
  })

  it('does NOT gate non-FID paths', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: {
        path: '/proj/src/x.ts',
        content: fidWithStatus('fixed', false),
      },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
  })
})

describe('runPreWriteGates — Law 3 cumulative verification (FID-2026-0820-012)', () => {
  function runLaw3Gate(params: {
    targetPath: string
    dirtyFiles: string[]
    verifiedFiles?: string[]
  }) {
    const state = createEnforcementState()
    for (const d of params.dirtyFiles) state.dirtyFiles.add(d)
    for (const v of params.verifiedFiles ?? []) state.verifiedFiles.add(v)
    // Simulate the post-write flag: set false by every write, cleared only
    // by resetForNewTurn (the FID-2026-0820-012 deadlock precondition).
    state.hasVerifiedSinceLastDirty = false
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: params.targetPath },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
  }

  it('does NOT block a follow-up write when every dirty file has since passed verification', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/src/a.ts'],
      verifiedFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(false)
  })

  it('still BLOCKS when a dirty file has no verification credit (Law 3 preserved)', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 3')
    expect(result.reason).toContain('/proj/src/a.ts')
  })

  it('BLOCKS on partial verification and lists only the unverified file', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/c.ts',
      dirtyFiles: ['/proj/src/a.ts', '/proj/src/b.ts'],
      verifiedFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('1 unverified')
    expect(result.reason).toContain('/proj/src/b.ts')
    expect(result.reason).not.toContain('/proj/src/a.ts')
  })

  it('does NOT block an exempt-path write (dev/fids/) while code verification is pending', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/dev/fids/FID-2026-0820-012-x.md',
      dirtyFiles: ['/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(false)
  })

  it('does NOT block exempt-path writes under dev/scratchpad/ and dev/nova/', () => {
    for (const target of [
      '/proj/dev/scratchpad/notes.md',
      '/proj/dev/nova/outbox.md',
    ]) {
      const result = runLaw3Gate({
        targetPath: target,
        dirtyFiles: ['/proj/src/a.ts'],
      })
      expect(result.blocked).toBe(false)
    }
  })
})

describe('runPreWriteGates — FID Recorder routing gate (>100 lines, operator directive 2026-08-23)', () => {
  const FID_PATH = '/proj/dev/fids/FID-2026-0823-100-x.md'

  /** Build content whose countLines() (split on '\n') is exactly `lines`. */
  function fidContent(lines: number): string {
    const rows: string[] = []
    for (let i = 0; i < lines; i++) rows.push(`line ${i}`)
    return rows.join('\n')
  }

  function runOrchestratorFidWrite(content: string, agentId?: string) {
    const state = createEnforcementState()
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: FID_PATH, content },
      agentId: agentId ?? 'orchestrator',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
  }

  it('ALLOWS an Orchestrator FID write at exactly 100 payload lines', () => {
    const result = runOrchestratorFidWrite(fidContent(100))
    expect(result.blocked).toBe(false)
  })

  it('BLOCKS an Orchestrator FID write above 100 lines with route-through-Recorder', () => {
    const result = runOrchestratorFidWrite(fidContent(101))
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('> 100')
    expect(result.reason).toContain('Route through the Recorder')
  })

  it('does NOT gate non-Orchestrator agents (Forge relays unaffected)', () => {
    const result = runOrchestratorFidWrite(fidContent(150), 'forge')
    expect(result.blocked).toBe(false)
  })
})
