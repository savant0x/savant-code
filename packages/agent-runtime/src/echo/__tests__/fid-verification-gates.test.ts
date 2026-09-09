/**
 * FID Verification Gates — pure contract tests (FID-2026-0823-009).
 *
 * Locks the grammar, receipt parsing, fingerprint freshness, and C1/C2
 * structural validation. Execution is out of scope here — it lives in
 * scripts/fid-verify.ts and scripts/fid-gates.ts.
 */
import { describe, expect, it } from 'bun:test'

import {
  computeFidFingerprint,
  parseVerificationGates,
  parseVerificationReceipt,
  validateFidVerification,
} from '../fid-verification-gates'

function fid(status: string, gates: string[], receipt?: string): string {
  const gatesBlock = gates.map((g) => `- gate: ${g}`).join('\n')
  return `# FID: test

**Status:** ${status}

## Verification Gates
${gatesBlock}
${receipt ? `\n${receipt}` : ''}
`
}

const RECEIPT = `### Verification Receipt

- fingerprint: sha256:0000000000000000000000000000000000000000000000000000000000000000
- verified: 2026-08-23T15:04:00Z
- typecheck sdk: exit 0
- test sdk/src/__tests__/process-definitions.test.ts: exit 0
- probe dev/scratchpad/process-defs-probe.ts: exit 0`

describe('parseVerificationGates', () => {
  it('parses typecheck/test/probe declarations', () => {
    const { gates, errors } = parseVerificationGates(
      fid('fixed', [
        'typecheck sdk',
        'test sdk/src/__tests__/process-definitions.test.ts',
        'probe dev/scratchpad/process-defs-probe.ts',
      ]),
    )
    expect(errors).toEqual([])
    expect(gates).toEqual([
      { kind: 'typecheck', arg: 'sdk' },
      { kind: 'test', arg: 'sdk/src/__tests__/process-definitions.test.ts' },
      { kind: 'probe', arg: 'dev/scratchpad/process-defs-probe.ts' },
    ])
  })

  it('reports missing gates section as an error', () => {
    const { gates, errors } = parseVerificationGates('# FID: x\n')
    expect(gates).toEqual([])
    expect(errors.join('; ')).toContain('missing ## Verification Gates')
  })

  it('rejects unknown kinds and malformed lines', () => {
    const { gates, errors } = parseVerificationGates(
      '# FID: x\n\n## Verification Gates\n' +
        '- gate: rm -rf /\n- nonsense line\n',
    )
    expect(gates).toEqual([])
    expect(errors.join('; ')).toContain('malformed gate declaration')
  })

  it('ignores receipt bullets and headings inside the gates section', () => {
    const { gates, errors } = parseVerificationGates(
      fid('fixed', ['typecheck sdk'], RECEIPT),
    )
    expect(errors).toEqual([])
    expect(gates).toEqual([{ kind: 'typecheck', arg: 'sdk' }])
  })

  it('ignores a fenced ```markdown example of the format (template pattern)', () => {
    const content =
      '# FID: x\n\n## Summary\n\nExample:\n\n```markdown\n## Verification Gates\n\n- gate: typecheck sdk\n\n### Verification Receipt\n\n- fingerprint: sha256:example\n```\n\n## Verification Gates\n\n- gate: probe scripts/__tests__/fixtures/fid-verify-echo.ts\n'
    const { gates, errors } = parseVerificationGates(content)
    expect(errors).toEqual([])
    expect(gates).toEqual([
      { kind: 'probe', arg: 'scripts/__tests__/fixtures/fid-verify-echo.ts' },
    ])
  })
})

describe('parseVerificationReceipt', () => {
  it('parses fingerprint, verified, and exit results', () => {
    const { receipt, errors } = parseVerificationReceipt(
      fid('fixed', ['typecheck sdk'], RECEIPT),
    )
    expect(errors).toEqual([])
    expect(receipt?.fingerprint).toBe(
      '0000000000000000000000000000000000000000000000000000000000000000',
    )
    expect(receipt?.verified).toBe('2026-08-23T15:04:00Z')
    expect(receipt?.results).toEqual([
      { kind: 'typecheck', arg: 'sdk', exit: 0 },
      {
        kind: 'test',
        arg: 'sdk/src/__tests__/process-definitions.test.ts',
        exit: 0,
      },
      { kind: 'probe', arg: 'dev/scratchpad/process-defs-probe.ts', exit: 0 },
    ])
  })

  it('returns undefined receipt when the block is absent', () => {
    const { receipt } = parseVerificationReceipt(
      fid('fixed', ['typecheck sdk']),
    )
    expect(receipt).toBeUndefined()
  })

  it('reports malformed receipt lines', () => {
    const { receipt, errors } = parseVerificationReceipt(
      `### Verification Receipt\n\n- fingerprint: sha256:zzz\n`,
    )
    expect(receipt?.fingerprint).toBeUndefined()
    expect(errors.join('; ')).toContain('malformed receipt line')
  })
})

describe('computeFidFingerprint', () => {
  it('is stable and changes when the FID body changes', () => {
    const content = fid('fixed', ['typecheck sdk'], RECEIPT)
    const first = computeFidFingerprint(content)
    expect(computeFidFingerprint(content)).toBe(first)
    const edited = content.replace('**Status:** fixed', '**Status:** fixed\n')
    expect(computeFidFingerprint(edited)).not.toBe(first)
  })

  it('is invariant to receipt content (fingerprint covers the doc, not the receipt)', () => {
    const base = fid('fixed', ['typecheck sdk'], RECEIPT)
    const otherReceipt = RECEIPT.replace(
      '2026-08-23T15:04:00Z',
      '2026-08-23T16:00:00Z',
    )
    expect(computeFidFingerprint(base)).toBe(
      computeFidFingerprint(fid('fixed', ['typecheck sdk'], otherReceipt)),
    )
  })

  it('hashes the whole doc when no receipt is present', () => {
    const content = fid('fixed', ['typecheck sdk'])
    expect(computeFidFingerprint(content)).toMatch(/^[0-9a-f]{64}$/)
  })

  // FID-2026-0907-010: the stamp-time view (receipt-less doc) and the
  // validate-time view (stamped doc, receipt region removed) MUST hash
  // identically for BOTH stamp paths. Built without self-referential
  // hashing: the stamped shape is constructed to mirror fid:verify's
  // stampReceipt output, then hashed as the validator would.
  it('stamp-path identity: receipt-less hash equals stamped-doc hash (insert path)', () => {
    const before =
      '# FID: test\n\n**Status:** fixed\n\n## Verification Gates\n\n- gate: typecheck sdk\n\n## Perfection Loop\nloop text\n'
    // stampReceipt's insert branch, replayed: A.trimEnd + \n\n + receipt + \n\n + B.trimStart
    const receipt =
      '### Verification Receipt\n\n- fingerprint: sha256:PENDING\n- verified: 2026-09-07T00:00:00Z\n- typecheck sdk: exit 0'
    const anchor = before.indexOf('## Verification Gates')
    const after = before.slice(anchor + '## Verification Gates'.length)
    const next = after.search(/^## |^### /m)
    const insertAt = anchor + '## Verification Gates'.length + next
    const stamped =
      before.slice(0, insertAt).trimEnd() +
      `\n\n${receipt}\n\n` +
      before.slice(insertAt).trimStart()

    const stampedHash = computeFidFingerprint(stamped)
    const beforeHash = computeFidFingerprint(before)
    expect(stampedHash).toBe(beforeHash)
  })
})

const THREE_GATES = [
  'typecheck sdk',
  'test sdk/src/__tests__/process-definitions.test.ts',
  'probe dev/scratchpad/process-defs-probe.ts',
]

/** Build a FID whose receipt fingerprint matches its (receipt-stripped) body. */
function fidWithValidReceipt(
  status: string,
  gates: string[],
  receipt = RECEIPT,
): string {
  const content = fid(status, gates, receipt)
  const fingerprint = computeFidFingerprint(content)
  return content.replace(
    'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    `sha256:${fingerprint}`,
  )
}

describe('validateFidVerification (C1+C2)', () => {
  it('is a no-op for analyzed/created statuses (section-conditional)', () => {
    expect(validateFidVerification(fid('analyzed', []))).toEqual([])
    expect(validateFidVerification('# FID: x\n**Status:** created\n')).toEqual(
      [],
    )
  })

  it('accepts a fixed FID with gates + matching receipt', () => {
    expect(
      validateFidVerification(fidWithValidReceipt('fixed', THREE_GATES)),
    ).toEqual([])
  })

  it('accepts a verified FID with gates + matching receipt', () => {
    expect(
      validateFidVerification(fidWithValidReceipt('verified', THREE_GATES)),
    ).toEqual([])
  })

  it('rejects fixed with no gates declared', () => {
    const errors = validateFidVerification(fid('fixed', []))
    expect(errors.join('; ')).toContain('no verification gates declared')
  })

  it('rejects fixed with gates but no receipt', () => {
    const errors = validateFidVerification(fid('fixed', ['typecheck sdk']))
    expect(errors.join('; ')).toContain('missing ### Verification Receipt')
  })

  it('rejects a stale receipt (fingerprint mismatch)', () => {
    const content = fidWithValidReceipt('fixed', THREE_GATES)
    const edited = content.replace(
      '## Verification Gates',
      '## Verification Gates\n',
    )
    expect(validateFidVerification(edited).join('; ')).toContain(
      'stale verification receipt',
    )
  })

  it('rejects a receipt that omits a declared gate', () => {
    // Declare a 4th gate that the receipt does not cover.
    const content = fidWithValidReceipt('fixed', [
      ...THREE_GATES,
      'test cli/src/__tests__/extra.test.ts',
    ])
    expect(validateFidVerification(content).join('; ')).toContain(
      'declared gate missing from receipt: test cli/src/__tests__/extra.test.ts',
    )
  })

  it('rejects a non-zero exit in the receipt', () => {
    const content = fidWithValidReceipt('fixed', THREE_GATES).replace(
      'typecheck sdk: exit 0',
      'typecheck sdk: exit 1',
    )
    expect(validateFidVerification(content).join('; ')).toContain('exit 1')
  })

  it('rejects receipt results not declared as gates', () => {
    // Declare only typecheck; the receipt's test/probe results are undeclared.
    const content = fidWithValidReceipt('fixed', ['typecheck sdk'])
    expect(validateFidVerification(content).join('; ')).toContain(
      'receipt result not declared as a gate: test',
    )
  })
})
