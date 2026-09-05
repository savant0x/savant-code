/**
 * EHEL pre-write gates — FID verification receipt tripwire
 * (FID-2026-0823-009). Sibling of the Loop-335 decomposition (parent:
 * pre-write-gates.test.ts).
 */
import { describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { computeFidFingerprint } from '../fid-verification-gates'
import { runPreWriteGates } from '../pre-write-gates'

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
