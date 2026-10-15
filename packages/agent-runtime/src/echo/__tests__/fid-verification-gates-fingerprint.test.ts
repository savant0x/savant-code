/**
 * FID Verification Gates — fingerprint contract tests (FID-2026-0823-009).
 *
 * Locks `computeFidFingerprint` freshness semantics: stability, receipt
 * invariance, and stamp→validate identity for every stamp path. Split from
 * fid-verification-gates.test.ts under the 300-line ceiling
 * (FID-2026-0913-002 discipline; FID-2026-0916-003) — move-only for the four
 * pre-existing pins. The local `fid`/`RECEIPT` fixtures duplicate the main
 * suite's on purpose: test files must not import from each other.
 */
import { describe, expect, it } from 'bun:test'

import { computeFidFingerprint } from '../fid-verification-gates'

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
- probe dev/scratchpad/process-defs-probe.ts: exit 0
- quality: exit 0`

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

  // FID-2026-0916-003: the EOF stamp path (gates section runs to EOF —
  // stampReceipt's `next === -1` branch) must also satisfy the identity.
  // Replayed without self-referential hashing, mirroring the insert-path pin.
  // FID-2026-0916-003: the EOF stamp path (gates section runs to EOF —
  // stampReceipt's `next === -1` branch) must also satisfy the identity.
  it('stamp-path identity holds for the EOF stamp path (FID-2026-0916-003)', () => {
    const before =
      '# FID: test\n\n**Status:** fixed\n\n## Verification Gates\n\n- gate: typecheck sdk\n- gate: quality\n'
    const receipt =
      '### Verification Receipt\n\n- fingerprint: sha256:PENDING\n- verified: 2026-09-16T00:00:00Z\n- typecheck sdk: exit 0\n- quality: exit 0'
    // stampReceipt's EOF branch, replayed: content.trimEnd() + '\n\n' + receipt + '\n'
    const stamped = `${before.trimEnd()}\n\n${receipt}\n`

    expect(computeFidFingerprint(stamped)).toBe(computeFidFingerprint(before))
  })

  // FID-2026-0916-003 MQ1: tail normalization is about the newline COUNT
  // only — content edits (including to the final line's text) must still
  // invalidate the fingerprint.
  it('fingerprint still changes when final-line content differs (freshness preserved)', () => {
    const a = computeFidFingerprint(
      '# FID: test\n\n## Verification Gates\n\n- gate: typecheck sdk\n',
    )
    const b = computeFidFingerprint(
      '# FID: test\n\n## Verification Gates\n\n- gate: typecheck cli\n',
    )
    expect(a).not.toBe(b)
  })
})
