import { describe, expect, test } from 'bun:test'

import {
  describeVerificationEnforcement,
  ENFORCED_VERIFICATION_STATUSES,
  parseFidStatus,
} from '../fid-verification-enforcement'

// FID-2026-0928-002. The `**Status:**` anchor was line-start-only, so records
// authored against the older metadata-bullet template read as `undefined` —
// and one archived `verified` record was therefore never bound by the
// verification contract. These legs pin both directions: a bullet-form
// declaration must be read, and a genuinely absent one must still read absent.

const LINE_FORM = `**Status:** verified
`

const BULLET_FORM = `- **Status:** verified
`

const STAR_FORM = `* **Status:** verified
`

const CLOSED_BULLET = `- **Status:** closed
`

const GATES = `
## Verification Gates

- gate: quality

### Verification Receipt

- fingerprint: sha256:abc
`

describe('parseFidStatus', () => {
  test('reads the line-anchored form (unchanged)', () => {
    expect(parseFidStatus(LINE_FORM)).toBe('verified')
  })

  test('reads a hyphen bullet form', () => {
    expect(parseFidStatus(BULLET_FORM)).toBe('verified')
  })

  test('reads a star bullet form', () => {
    expect(parseFidStatus(STAR_FORM)).toBe('verified')
  })

  test('reads a bullet form that carries surrounding prose', () => {
    const content = `# FID: x

## Metadata

- **ID:** FID-2026-0000-000
- **Status:** closed
- **Created:** 2026-08-04
`
    expect(parseFidStatus(content)).toBe('closed')
  })

  test('returns undefined when no status is declared at all', () => {
    expect(parseFidStatus('# FID: x\n\nno metadata here\n')).toBeUndefined()
  })

  test('does not invent a status from a different field', () => {
    const content = `- **Status of change:** not-a-status\n`
    expect(parseFidStatus(content)).toBeUndefined()
  })
})

describe('describeVerificationEnforcement', () => {
  test('a bullet-form `verified` record IS enforced', () => {
    // The regression that opened this FID: this record was skipped entirely.
    const result = describeVerificationEnforcement(BULLET_FORM + GATES)
    expect(result.enforced).toBe(true)
  })

  test('a line-form `verified` record is still enforced', () => {
    expect(describeVerificationEnforcement(LINE_FORM + GATES).enforced).toBe(
      true,
    )
  })

  test('a bullet-form `closed` record is outside the contract by design', () => {
    const result = describeVerificationEnforcement(CLOSED_BULLET + GATES)
    expect(result.enforced).toBe(false)
    expect(result.reason).toContain('closed')
  })

  test('a status-less document still reports the status as absent', () => {
    // The message must not claim "no Status line" for a document that has one.
    const result = describeVerificationEnforcement(GATES)
    expect(result.enforced).toBe(false)
    expect(result.reason).toContain('no **Status:** line')
  })
})

describe('enforced status set', () => {
  test('covers exactly fixed and verified', () => {
    expect([...ENFORCED_VERIFICATION_STATUSES].sort()).toEqual([
      'fixed',
      'verified',
    ])
  })
})
