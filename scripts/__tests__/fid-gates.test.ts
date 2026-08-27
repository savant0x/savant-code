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
  const gatesBlock = gates.map((g) => `- gate: ${g}`).join('\n')
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
  const receiptBody = results.join('\n')
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
