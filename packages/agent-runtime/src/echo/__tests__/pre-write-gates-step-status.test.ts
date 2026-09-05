/**
 * EHEL pre-write gates — anti-deferral FID step-status gate
 * (FID-2026-0817-005). Sibling of the Loop-335 decomposition (parent:
 * pre-write-gates.test.ts).
 */
import { describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'

describe('runPreWriteGates — Anti-Deferral FID step-status gate (FID-2026-0817-005)', () => {
  const FID_PATH = '/proj/dev/fids/FID-2026-0817-010-x.md'

  function runFidWrite(content: string, agentId = 'savant') {
    const state = createEnforcementState()
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: FID_PATH, content },
      agentId,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
  }

  it('BLOCKS a closed FID write with unresolved steps and lists them', () => {
    const content =
      '# FID: test\n\n**Status:** closed\n\n## Step Status\n' +
      '- [x] 1. done — implemented\n' +
      '- [ ] 2. not done\n'
    const result = runFidWrite(content)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('FID gate')
    expect(result.reason).toContain('not done')
    expect(result.reason).toContain('operator')
  })

  it('allows a closed FID write when every step is implemented', () => {
    const content =
      '# FID: test\n\n**Status:** closed\n\n## Step Status\n' +
      '- [x] 1. done — implemented\n'
    const result = runFidWrite(content)
    expect(result.blocked).toBe(false)
  })

  it('allows a closed FID write with an operator-approved deferral', () => {
    const content =
      '# FID: test\n\n**Status:** closed\n\n## Step Status\n' +
      '- [x] 1. done — implemented\n' +
      '- [ ] 2. later — deferred::operator-approved 2026-08-16\n'
    const result = runFidWrite(content)
    expect(result.blocked).toBe(false)
  })

  it('does NOT gate a converged write with no Step Status section (legacy)', () => {
    const content = '# FID: test\n\n**Status:** converged\n'
    const result = runFidWrite(content)
    expect(result.blocked).toBe(false)
  })

  it('does not gate non-FID paths', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: {
        path: '/proj/src/x.ts',
        content: '**Status:** closed\n## Step Status\n- [ ] 1. x\n',
      },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
  })
})
