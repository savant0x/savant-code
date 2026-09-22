/**
 * FID-2026-0919-021 pins — explicit verification-enforcement reporting.
 *
 * `validateFidVerification` enforces the receipt contract only for
 * `fixed`/`verified`. Every other status was skipped SILENTLY, which is how
 * 284 of 315 archived `closed` records came to carry receipts whose
 * fingerprint no longer matches their content (proven on
 * FID-2026-0918-007: matching while `verified`, stale after the closure
 * batch flipped the status without re-stamping).
 *
 * The operator ruling (T69) is: accept the closed-record semantics as
 * by-design, DOCUMENT them, and make the validator say so explicitly rather
 * than skipping silently. These pins lock both halves — the new explicit
 * report AND the unchanged non-blocking behavior of the validator.
 */
import { describe, expect, it } from 'bun:test'

import {
  describeVerificationEnforcement,
  parseFidStatus,
} from '../fid-verification-enforcement'
import { validateFidVerification } from '../fid-verification-gates'

function fid(status: string | undefined, extra = ''): string {
  const head = status === undefined ? '' : `**Status:** ${status}\n\n`
  return `# FID: enforcement fixture\n\n${head}## Verification Gates\n\n- gate: quality\n${extra}`
}

describe('parseFidStatus (single truth for the status line)', () => {
  it('reads the trimmed status value', () => {
    expect(parseFidStatus(fid('closed'))).toBe('closed')
    expect(parseFidStatus(fid('  fixed  '))).toBe('fixed')
  })

  it('returns undefined when the document declares no status', () => {
    expect(parseFidStatus(fid(undefined))).toBeUndefined()
    expect(parseFidStatus('# FID: x\n')).toBeUndefined()
  })
})

describe('describeVerificationEnforcement', () => {
  it('reports the contract as ENFORCED for fixed/verified', () => {
    for (const status of ['fixed', 'verified']) {
      const result = describeVerificationEnforcement(fid(status))
      expect(result.enforced).toBe(true)
      expect(result.reason).toContain(status)
    }
  })

  it('reports a closed record as NOT enforced, naming the missing guarantee', () => {
    const result = describeVerificationEnforcement(fid('closed'))
    expect(result.enforced).toBe(false)
    expect(result.reason).toContain('closed')
    expect(result.reason).toContain('no live fingerprint guarantee')
    expect(result.reason).toContain('FID-2026-0919-021')
  })

  it('reports every non-terminal status as NOT enforced', () => {
    for (const status of ['created', 'analyzed', 'converged']) {
      const result = describeVerificationEnforcement(fid(status))
      expect(result.enforced).toBe(false)
      expect(result.reason).toContain(status)
    }
  })

  it('reports a missing status line as NOT enforced, with its own reason', () => {
    const result = describeVerificationEnforcement(fid(undefined))
    expect(result.enforced).toBe(false)
    expect(result.reason).toContain('no **Status:** line')
  })
})

describe('validateFidVerification behavior is UNCHANGED by the new report', () => {
  it('still returns [] for closed/analyzed/created (never a new blocking error)', () => {
    // The pre-write tripwire and `fid:verify --check` treat a non-empty
    // return as a hard block, so the explicit reporting MUST NOT leak into
    // the errors array for a skipped status.
    for (const status of ['closed', 'analyzed', 'created', 'converged']) {
      expect(validateFidVerification(fid(status))).toEqual([])
    }
    expect(validateFidVerification(fid(undefined))).toEqual([])
  })

  it('still rejects a fixed FID with no gates declared', () => {
    const errors = validateFidVerification(
      '# FID: x\n\n**Status:** fixed\n\n## Verification Gates\n',
    )
    expect(errors.join('; ')).toContain('no verification gates declared')
  })
})
