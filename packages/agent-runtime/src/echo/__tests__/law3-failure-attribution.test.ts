/**
 * FID-2026-0927-003 F2 — Law 3 must not deadlock on the file it is reporting.
 *
 * RED-first. The defect (PROBE B of dev/scratchpad/active/ehel-deadlock-probe.ts):
 * a red verification run withholds credit, the file stays dirty-and-unverified,
 * and the Law 3 gate then blocks the ONLY legal repair — editing the file whose
 * test is red. The gate cannot distinguish "the test is wrong, fix it" from "the
 * code is wrong, do not edit the test to hide it", so the legitimate case is
 * unrecoverable and the only exit is `rm` the file, which defeats the gate.
 *
 * The contract these legs pin:
 *   1. A file NAMED by the failed verification run is editable  → no deadlock.
 *   2. A file NOT named by it is STILL BLOCKED                → anti-masking.
 *   3. In the `self_correct` phase any dirty-unverified code file is editable,
 *      for the case where attribution cannot be determined.
 *
 * Leg 2 is the one that keeps this a safety gate. If it ever inverts, the change
 * has become a bypass: edit the test, delete the assertion, keep the gate quiet.
 */
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import { extractFailingPaths } from '../../tools/tool-executor/verification-failure-paths'
import { EchoEnforcement } from '../enforcement'
import { createEnforcementState } from '../enforcement-state'

import type { runPreWriteGates } from '../pre-write-gates'

/**
 * Fixture paths are rooted at the REAL process cwd, not a synthetic `/proj`.
 *
 * `canonicalizePath` resolves a repo-relative path against `process.cwd()`, so
 * a failure that names `src/tick.test.ts` is stored as
 * `<real repo root>/src/tick.test.ts`. A synthetic root could never match it,
 * and the first draft of this file failed for exactly that reason — a fixture
 * bug that looked like a broken exemption. The production scenario is
 * "attributed relative, target absolute from the same repo", which is what
 * `TICK`/`tickRel` below reproduce.
 */
const TICK = path.join(process.cwd(), 'src', 'tick.test.ts')
const PROVIDER = path.join(process.cwd(), 'src', 'provider.ts')
const tickRel = 'src/tick.test.ts'

function primed(): EchoEnforcement {
  const enforcement = new EchoEnforcement('hybrid')
  enforcement.beforeToolCall({
    toolName: 'read_files',
    input: { paths: ['ECHO.md'] },
    agentId: 'savant',
  })
  return enforcement
}

/**
 * Drive the full cycle: write the file, run a verification that fails and names
 * `attributed`, then attempt a re-edit of `target`.
 */
function attemptReEdit(params: {
  target: string
  attributed: string[]
  fsmPhase?: string
}): ReturnType<typeof runPreWriteGates> {
  const enforcement = primed()
  enforcement.afterToolCall({
    toolName: 'write_file',
    input: { path: params.target },
    result: { text: 'ok' },
    writeSucceeded: true,
  })
  // A failed verification run attributing the failure to `attributed`.
  enforcement.afterToolCall({
    toolName: 'run_readonly_command',
    input: { command: 'bun test' },
    result: { text: '' },
    commandSucceeded: false,
    verificationFailurePaths: params.attributed,
  })
  return enforcement.beforeToolCall({
    toolName: 'str_replace',
    input: { path: params.target },
    agentId: 'savant',
    fsmPhase: params.fsmPhase,
  })
}

describe('FID-2026-0927-003 F2 — failure-attributed exemption', () => {
  it('ALLOWS re-editing a dirty-unverified file the failed run NAMED (the deadlock fix)', () => {
    const result = attemptReEdit({ target: TICK, attributed: [tickRel] })
    expect(result.blocked).toBe(false)
  })

  it('STILL BLOCKS a dirty-unverified file the failed run did NOT name (anti-masking)', () => {
    // The masking vector: the code is wrong, the test is green, and the "fix"
    // is to weaken the test. Attribution says the failure belongs to
    // provider.ts, so editing tick.test.ts must remain blocked.
    const result = attemptReEdit({
      target: TICK,
      attributed: ['src/provider.ts'],
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 3')
  })

  it('emits an advisory rather than a silent pass when it unblocks', () => {
    // The exemption is recorded, not applied silently — an unlogged widening
    // of a safety gate is indistinguishable from a bypass in review.
    const result = attemptReEdit({ target: TICK, attributed: [tickRel] })
    expect(result.blocked).toBe(false)
    expect(result.warnings.some((w) => w.law === 3)).toBe(true)
  })

  it('does NOT attribute to an unrelated file with a shared basename', () => {
    // `other/tick.test.ts` must not satisfy attribution for `src/tick.test.ts`:
    // a match on the basename alone would re-open the masking vector.
    const result = attemptReEdit({
      target: TICK,
      attributed: ['other/tick.test.ts'],
    })
    expect(result.blocked).toBe(true)
  })

  it('a GREEN verification clears attribution', () => {
    // Attribution is scoped to the failed run that produced it. A subsequent
    // green run must not leave a permanent exemption behind.
    const enforcement = primed()
    enforcement.afterToolCall({
      toolName: 'write_file',
      input: { path: TICK },
      result: { text: 'ok' },
      writeSucceeded: true,
    })
    enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun test' },
      result: { text: '' },
      commandSucceeded: false,
      verificationFailurePaths: [tickRel],
    })
    expect(enforcement.getState().failureAttributedFiles.size).toBe(1)
    enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run typecheck' },
      result: { text: '' },
      commandSucceeded: true,
    })
    expect(enforcement.getState().failureAttributedFiles.size).toBe(0)
  })
})

describe('FID-2026-0927-003 F2 — self_correct phase fallback', () => {
  it('ALLOWS any dirty-unverified code file in the self_correct phase', () => {
    // The escape hatch for when attribution cannot be determined. It is the
    // protocol's own sanctioned repair phase, and it is recorded, not silent.
    const result = attemptReEdit({
      target: TICK,
      attributed: [],
      fsmPhase: 'self_correct',
    })
    expect(result.blocked).toBe(false)
  })

  it('the fallback does NOT apply outside self_correct', () => {
    // Guard against a phase check that is accidentally always-true.
    for (const phase of ['green', 'audit', 'idle', undefined]) {
      const result = attemptReEdit({
        target: TICK,
        attributed: [],
        fsmPhase: phase,
      })
      expect(result.blocked).toBe(true)
    }
  })

  it('a fresh EnforcementState has an empty attribution set', () => {
    expect(createEnforcementState().failureAttributedFiles.size).toBe(0)
  })
})

describe('extractFailingPaths — attributing a failure to files', () => {
  it('extracts a bun test failure file header', () => {
    const out = extractFailingPaths(
      'src/__tests__/tick.test.ts:\n(fail) tick > works [3.00ms]\n 1 fail',
    )
    expect(out).toContain('src/__tests__/tick.test.ts')
  })

  it('extracts a tsc error location', () => {
    const out = extractFailingPaths(
      "src/provider.ts(12,5): error TS2307: Cannot find module './x'",
    )
    expect(out).toContain('src/provider.ts')
  })

  it('returns nothing for a clean run', () => {
    expect(extractFailingPaths(' 1 pass\n 0 fail')).toEqual([])
  })

  it('returns nothing for empty or non-string input', () => {
    expect(extractFailingPaths('')).toEqual([])
    expect(extractFailingPaths(undefined)).toEqual([])
  })

  it('PROVIDER is a distinct file from TICK (fixture sanity)', () => {
    expect(TICK).not.toBe(PROVIDER)
  })
})
