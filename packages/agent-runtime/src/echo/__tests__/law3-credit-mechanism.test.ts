/**
 * Law 3 credit-mechanism pins (moved verbatim from
 * `pre-write-gates-law3.test.ts` when that file crossed the 300-line
 * ceiling during FID-2026-1007-015 P1 — FID-2026-1001-003 quality-cap
 * discipline: split at the describe seam, no content change).
 */
import { describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'

describe('Law 3 credit mechanism pin (FID-2026-0918-005 repro)', () => {
  /**
   * FID-2026-0918-005 Step 1: pin WHY the 2026-09-18 incidents persisted
   * until operator turn-ends. The credit path (tool-pipeline.ts) fires on
   * DETECTION of a verification command — afterToolCallImpl's result bag
   * carries no exit code, so crediting cannot be exit-gated by
   * construction. The incidents' deadlock was therefore the OTHER leg: no
   * verification command ran mid-batch before the next write was attempted
   * (the gate blocked it first). This pin documents detection-only,
   * exit-blind crediting as the status quo; exit-gating is a separate FID
   * if ever wanted.
   */
  it('does NOT credit when the verification command FAILED (FID-2026-0919-015)', () => {
    const enforcement = new EchoEnforcement('hybrid')
    // Satisfy the session-init gate.
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    const path = '/proj/src/a.ts'
    enforcement.afterToolCall({
      toolName: 'write_file',
      input: { path },
      result: { text: 'ok' },
      writeSucceeded: true,
    })
    // A FAILING verification command (tool-result error) must NOT discharge
    // Law 3: crediting is outcome-aware since FID-2026-0919-015. Observable:
    // the dirty file earns NO verifiedFiles credit.
    enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run typecheck' },
      result: { error: 'error TS2307: Cannot find module' },
      commandSucceeded: false,
    })
    expect(enforcement.getState().verifiedFiles.has(path)).toBe(false)
  })

  it('credits when the verification command SUCCEEDED (FID-2026-0919-015)', () => {
    const enforcement = new EchoEnforcement('hybrid')
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    const path = '/proj/src/a.ts'
    enforcement.afterToolCall({
      toolName: 'write_file',
      input: { path },
      result: { text: 'ok' },
      writeSucceeded: true,
    })
    enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run typecheck' },
      result: { text: 'ok' },
      commandSucceeded: true,
    })
    const result = enforcement.beforeToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/b.ts' },
      agentId: 'savant',
    })
    expect(result.blocked).toBe(false)
  })

  it('blocks the NEXT write when NO verification command ran mid-batch (the incident shape)', () => {
    const enforcement = new EchoEnforcement('hybrid')
    enforcement.beforeToolCall({
      toolName: 'read_files',
      input: { paths: ['ECHO.md'] },
      agentId: 'savant',
    })
    const path = '/proj/src/a.ts'
    enforcement.afterToolCall({
      toolName: 'write_file',
      input: { path },
      result: { text: 'ok' },
      writeSucceeded: true,
    })
    // No verification command — under the RESTORED other-dirty leg
    // (FID-2026-1001-003 step 4, Ruling 1) the next write to a DIFFERENT
    // file now BLOCKS; the FID-2026-0918-005 advisory is history.
    const other = enforcement.beforeToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/b.ts' },
      agentId: 'savant',
    })
    expect(other.blocked).toBe(true)
    expect(other.reason).toContain('Law 3')
    // ...while RE-EDITING the dirty file itself still blocks (the repair
    // loop stays honest).
    const self = enforcement.beforeToolCall({
      toolName: 'str_replace',
      input: { path },
      agentId: 'savant',
    })
    expect(self.blocked).toBe(true)
    expect(self.reason).toContain('Law 3')
  })
})
