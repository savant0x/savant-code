/**
 * fid-gates repository validator tests (FID-2026-0823-009).
 *
 * Drives validateFidVerificationGates with a temp dev/fids tree whose FIDs
 * declare gates pointing at the REAL repo fixtures — so the C3 live re-run
 * executes real commands and the assertions prove end-to-end behavior.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { computeFidFingerprint } from '@savant-code/agent-runtime/echo/fid-verification-gates'

import { activeFixedFidFiles, validateFidVerificationGates } from '../fid-gates'

const tempRoots: string[] = []
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function createRoot(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-fid-gates-'))
  tempRoots.push(root)
  mkdirSync(path.join(root, 'dev', 'fids'), { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(root, 'dev', 'fids', name), content)
  }
  return root
}

const PROBE = 'scripts/__tests__/fixtures/fid-verify-echo.ts'
const FAIL_PROBE = 'scripts/__tests__/fixtures/fid-verify-fail.ts'

function fixedFid(gates: string[], receipt?: string): string {
  // Task 58: `quality` is mandatory for fixed/verified — fixtures declare it
  // (with its exit-0 receipt line below) so the structural legs exercise the
  // receipt contract, not the mandatory-gate error.
  const gatesBlock = [...gates, 'quality'].map((g) => `- gate: ${g}`).join('\n')
  const content = `# FID: test

**Status:** fixed

## Verification Gates
${gatesBlock}
${receipt ? `\n${receipt}` : ''}
`
  return content
}

/** Attach a receipt whose fingerprint matches the given FID content. */
function withValidReceipt(content: string, results: string[]): string {
  // Task 58: every fixture's receipt covers the mandatory quality gate.
  const receiptBody = [...results, '- quality: exit 0'].join('\n')
  const receipt = `### Verification Receipt

- verified: 2026-08-23T15:04:00Z
${receiptBody}
`
  const withReceipt = content.replace(
    /(\n## Verification Gates[^\n]*\n(?:- gate: [^\n]*\n)*)/,
    `$1\n${receipt}`,
  )
  const fingerprint = computeFidFingerprint(withReceipt)
  return withReceipt.replace(
    '- verified: 2026-08-23T15:04:00Z',
    `- fingerprint: sha256:${fingerprint}\n- verified: 2026-08-23T15:04:00Z`,
  )
}

describe('activeFixedFidFiles', () => {
  it('finds only active fixed/verified FIDs', () => {
    const root = createRoot({
      'FID-2026-0820-001-a.md': fixedFid(['probe x']),
      'FID-2026-0820-002-b.md': fixedFid(['probe x']).replace(
        '**Status:** fixed',
        '**Status:** analyzed',
      ),
    })
    const found = activeFixedFidFiles(root)
    expect(found.map((f) => f.name)).toEqual(['FID-2026-0820-001-a.md'])
  })
})

describe('validateFidVerificationGates', () => {
  it('passes a fixed FID with gates + valid receipt + green live re-run', () => {
    const root = createRoot({
      'FID-2026-0820-001-a.md': withValidReceipt(fixedFid([`probe ${PROBE}`]), [
        `- probe ${PROBE}: exit 0`,
      ]),
    })
    const issues = validateFidVerificationGates(root)
    expect(issues).toEqual([])
  })

  it('flags a fixed FID with no gates section (C1)', () => {
    const root = createRoot({
      'FID-2026-0820-001-a.md':
        '# FID: x\n\n**Status:** fixed\n\n## Summary\nok\n',
    })
    const codes = validateFidVerificationGates(root).map((issue) => issue.code)
    expect(codes).toContain('fid.gates.missing')
  })

  it('flags a fixed FID with gates but no receipt (C2)', () => {
    const root = createRoot({
      'FID-2026-0820-001-a.md': fixedFid([`probe ${PROBE}`]),
    })
    const codes = validateFidVerificationGates(root).map((issue) => issue.code)
    expect(codes).toContain('fid.gates.receipt-missing')
  })

  it('flags a stale receipt (fingerprint mismatch) (C2)', () => {
    const valid = withValidReceipt(fixedFid([`probe ${PROBE}`]), [
      `- probe ${PROBE}: exit 0`,
    ])
    const stale = valid.replace(
      '## Verification Gates',
      '## Verification Gates\n',
    )
    const root = createRoot({ 'FID-2026-0820-001-a.md': stale })
    const codes = validateFidVerificationGates(root).map((issue) => issue.code)
    expect(codes).toContain('fid.gates.stale')
  })

  it('flags a red live re-run (C3) even when the receipt claims exit 0', () => {
    // Receipt says PASS, but the tree is red: the FAIL probe exits 1.
    const root = createRoot({
      'FID-2026-0820-001-a.md': withValidReceipt(
        fixedFid([`probe ${FAIL_PROBE}`]),
        [`- probe ${FAIL_PROBE}: exit 0`],
      ),
    })
    const codes = validateFidVerificationGates(root).map((issue) => issue.code)
    expect(codes).toContain('fid.gates.red')
  })

  it('blocks a hostile gate declaration without executing it (C3 safety)', () => {
    const root = createRoot({
      'FID-2026-0820-001-a.md': withValidReceipt(
        fixedFid(['typecheck not-a-workspace']),
        ['- typecheck not-a-workspace: exit 0'],
      ),
    })
    const codes = validateFidVerificationGates(root).map((issue) => issue.code)
    expect(codes).toContain('fid.gates.unsafe')
  })

  it('deduplicates identical gates across FIDs (C3)', () => {
    const root = createRoot({
      'FID-2026-0820-001-a.md': withValidReceipt(fixedFid([`probe ${PROBE}`]), [
        `- probe ${PROBE}: exit 0`,
      ]),
      'FID-2026-0820-002-b.md': withValidReceipt(fixedFid([`probe ${PROBE}`]), [
        `- probe ${PROBE}: exit 0`,
      ]),
    })
    expect(validateFidVerificationGates(root)).toEqual([])
  })
})

/**
 * FID-2026-0927-003 F3 — a stale receipt is a STALENESS TRIPWIRE, not the
 * enforcement. C3 re-runs every declared gate against the CURRENT tree, so
 * when those gates are green the code is verified regardless of whether the
 * document was edited afterwards. Failing there made the ordinary workflow
 * (implement -> verify -> record findings) self-invalidating: the act of
 * documenting the result is what made the receipt stale.
 *
 * The demotion is conditional, and both directions are pinned. A stale
 * receipt alongside a RED gate stays a hard error — that is the case the
 * receipt contract exists for, because the tree no longer matches the
 * verification at all.
 */
describe('FID-2026-0927-003 F3 — stale receipt vs the live gate re-run', () => {
  /** A receipt made stale by editing the document after stamping. */
  function staleFidWithGates(gates: string[]): string {
    const valid = withValidReceipt(
      fixedFid(gates),
      gates.map((gate) => `- ${gate}: exit 0`),
    )
    return valid.replace('## Verification Gates', '## Verification Gates\n')
  }

  it('DEMOTES a stale receipt to a warning when every declared gate is green', () => {
    // The doc-edit loop: the implementation verified green, and the only
    // reason the fingerprint moved is that findings were written down.
    const root = createRoot({
      'FID-2026-0820-001-a.md': staleFidWithGates([`probe ${PROBE}`]),
    })
    const issues = validateFidVerificationGates(root)
    // It must not be a FAILURE any more.
    expect(issues.filter((i) => i.severity !== 'warning')).toEqual([])
    // ...and it must still be VISIBLE, not silently dropped.
    const stale = issues.find((i) => i.code === 'fid.gates.stale')
    expect(stale).toBeDefined()
    expect(stale?.severity).toBe('warning')
    expect(stale?.message).toContain('gates pass the live re-run')
  })

  it('KEEPS a stale receipt a hard error when a declared gate is red', () => {
    // The receipt says exit 0, the tree disagrees: this is the case the
    // contract must still catch.
    const valid = withValidReceipt(fixedFid([`probe ${FAIL_PROBE}`]), [
      `- probe ${FAIL_PROBE}: exit 0`,
    ])
    const stale = valid.replace(
      '## Verification Gates',
      '## Verification Gates\n',
    )
    const root = createRoot({ 'FID-2026-0820-001-a.md': stale })
    const issues = validateFidVerificationGates(root)
    const staleIssue = issues.find((i) => i.code === 'fid.gates.stale')
    expect(staleIssue).toBeDefined()
    expect(staleIssue?.severity).not.toBe('warning')
    // The red gate is still reported in its own right.
    expect(issues.map((i) => i.code)).toContain('fid.gates.red')
  })

  it('leaves a valid receipt with green gates entirely clean', () => {
    // Regression guard: the demotion must not turn the gate slack in the
    // other direction, or a healthy FID starts reporting.
    const root = createRoot({
      'FID-2026-0820-001-a.md': withValidReceipt(fixedFid([`probe ${PROBE}`]), [
        `- probe ${PROBE}: exit 0`,
      ]),
    })
    expect(validateFidVerificationGates(root)).toEqual([])
  })

  it('does NOT demote when the gate cannot be executed (unsafe declaration)', () => {
    // Fail-closed on the C3 early return. The declared gate is rejected by
    // the allowlist, so NOTHING runs and nothing is proven green.
    //
    // The previous version of this leg stripped the gate lines instead,
    // which made it VACUOUS: with no gates declared, C1+C2 emits
    // `no verification gates declared` (fid.gates.missing) and never emits a
    // stale issue at all, so `find(...)` returned undefined and
    // `expect(undefined).not.toBe('warning')` passed even if the demotion
    // were deleted outright. Asserting `toBeDefined()` first is what makes
    // the leg mean anything — the red-gate sibling already does this.
    const valid = withValidReceipt(fixedFid(['typecheck not-a-workspace']), [
      '- typecheck not-a-workspace: exit 0',
    ])
    const stale = valid.replace(
      '## Verification Gates',
      '## Verification Gates\n',
    )
    const root = createRoot({ 'FID-2026-0820-001-a.md': stale })
    const issues = validateFidVerificationGates(root)
    expect(issues.map((i) => i.code)).toContain('fid.gates.unsafe')
    const staleIssue = issues.find((i) => i.code === 'fid.gates.stale')
    expect(staleIssue).toBeDefined()
    expect(staleIssue?.severity).not.toBe('warning')
  })
})
