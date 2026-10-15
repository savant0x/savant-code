/**
 * EHEL pre-write gates — P5b YAGNI gate (FID-2026-0806-003), including the
 * assistant-TEXT extraction channel and enforcement kill-switch from
 * FID-2026-0822-004. Sibling of the Loop-335 decomposition (parent:
 * pre-write-gates.test.ts).
 */
import { describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'

describe('runPreWriteGates — P5b YAGNI gate (FID-2026-0806-003)', () => {
  const yagniVerified = `<yagni_check>
{"isSpeculative":false,"reusedEntities":["buildArray"],"stdlibAlternatives":[],"dependenciesAvoided":[],"debtMarkersInserted":[],"rungsTraversed":[1,2,3,4,5,6],"exemptions":[]}
</yagni_check>
\nconst x = 1`
  const yagniSpeculativeNoMarker = `<yagni_check>
{"isSpeculative":true,"reusedEntities":[],"stdlibAlternatives":[],"dependenciesAvoided":[],"debtMarkersInserted":[],"rungsTraversed":[1],"exemptions":[]}
</yagni_check>
\nconst x = 1`
  const yagniSpeculativeWithMarker = `<yagni_check>
{"isSpeculative":true,"reusedEntities":[],"stdlibAlternatives":[],"dependenciesAvoided":[],"debtMarkersInserted":["ponytail: ceiling=a; upgrade=b"],"rungsTraversed":[1],"exemptions":[]}
</yagni_check>
\n// ponytail: ceiling=a; upgrade=b\nconst x = 1`

  function runForgeGate(content: string) {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: '/proj/x.ts', content },
      agentId: 'forge',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    return { result, state }
  }

  it('passes a Forge write with a verified yagni_check block', () => {
    const { result } = runForgeGate(yagniVerified)
    expect(result.blocked).toBe(false)
  })

  it('BLOCKS a speculative Forge write without a debt marker', () => {
    const { result, state } = runForgeGate(yagniSpeculativeNoMarker)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('YAGNI')
    expect(state.yagni.speculativeWritesRejected).toBe(1)
  })

  it('allows a speculative write WITH a documented debt marker (Debt-Incurred)', () => {
    const { result, state } = runForgeGate(yagniSpeculativeWithMarker)
    expect(result.blocked).toBe(false)
    expect(state.yagni.lastAssessment?.isSpeculative).toBe(true)
    expect(state.yagni.lastAssessment?.debtMarkersInserted.length).toBe(1)
  })

  it('does not gate non-Forge agents', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: '/proj/x.ts', content: 'no yagni block at all' },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
  })

  it('BLOCKS a speculative write when the block lands in assistant TEXT (FID-2026-0822-004)', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      // The payload carries NO block — the model emitted it at the top of its
      // response text per the Forge prompt.
      input: { path: '/proj/x.ts', content: 'const x = 1' },
      agentId: 'forge',
      assistantText: yagniSpeculativeNoMarker,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('YAGNI')
    expect(state.yagni.speculativeWritesRejected).toBe(1)
  })

  it('passes a verified block extracted from assistant TEXT (FID-2026-0822-004)', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: '/proj/x.ts', content: 'const x = 1' },
      agentId: 'forge',
      assistantText: yagniVerified,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
    expect(state.yagni.lastAssessment?.isSpeculative).toBe(false)
  })

  it('prefers the payload channel over assistant TEXT (FID-2026-0822-004)', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      // Payload declares verified; text declares speculative. The payload wins
      // so the block the gate historically parsed still governs.
      input: { path: '/proj/x.ts', content: yagniVerified },
      agentId: 'forge',
      assistantText: yagniSpeculativeNoMarker,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
    expect(state.yagni.lastAssessment?.isSpeculative).toBe(false)
  })

  it('disables the gate entirely when yagni.enforced is false (FID-2026-0822-004)', () => {
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: '/proj/x.ts', content: yagniSpeculativeNoMarker },
      agentId: 'forge',
      yagniEnforced: false,
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(false)
    expect(result.warnings.length).toBe(0)
    expect(state.yagni.speculativeWritesRejected).toBe(0)
  })
})
