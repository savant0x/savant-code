/**
 * EHEL pre-write gates — Law 3 cumulative verification (FID-2026-0820-012).
 * Sibling of the Loop-335 decomposition (parent: pre-write-gates.test.ts).
 */
import { describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'

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

  // FID-2026-0917-002: a markdownlint failure on a documentation artifact
  // must never hard-block writes. Before the docs/code split was wired into
  // this gate, a doc landed in dirtyFiles, the failing lint kept it out of
  // verifiedFiles, and the only tool able to fix the doc (a write to it)
  // was blocked by the doc's own unverified state — the violation blocked
  // its own remedy and the session deadlocked.
  it('does NOT block any write when the only unverified dirty files are DOCS (FID-2026-0917-002)', () => {
    for (const target of [
      '/proj/src/b.ts',
      '/proj/docs/report.md',
      '/proj/dev/handoff.md',
    ]) {
      const result = runLaw3Gate({
        targetPath: target,
        dirtyFiles: ['/proj/dev/handoff.md', '/proj/README.md'],
      })
      expect(result.blocked).toBe(false)
    }
  })

  it('does NOT block the self-fix write to an unverified dirty doc (deadlock regression)', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/dev/handoff.md',
      dirtyFiles: ['/proj/dev/handoff.md'],
    })
    expect(result.blocked).toBe(false)
  })

  it('still BLOCKS when an unverified dirty DOC is mixed with unverified CODE', () => {
    const result = runLaw3Gate({
      targetPath: '/proj/src/b.ts',
      dirtyFiles: ['/proj/dev/handoff.md', '/proj/src/a.ts'],
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 3')
    // The doc is excluded from the blocking set; only the code file is named.
    expect(result.reason).toContain('/proj/src/a.ts')
    expect(result.reason).not.toContain('/proj/dev/handoff.md')
  })
})
