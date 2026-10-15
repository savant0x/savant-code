/**
 * EHEL pre-write gates — FID Recorder routing gate (>100 lines, operator
 * directive 2026-08-23). Sibling of the Loop-335 decomposition (parent:
 * pre-write-gates.test.ts).
 */
import { describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'

describe('runPreWriteGates — FID Recorder routing gate (>100 lines, operator directive 2026-08-23)', () => {
  const FID_PATH = '/proj/dev/fids/FID-2026-0823-100-x.md'

  /** Build content whose countLines() (split on '\n') is exactly `lines`. */
  function fidContent(lines: number): string {
    const rows: string[] = []
    for (let i = 0; i < lines; i++) rows.push(`line ${i}`)
    return rows.join('\n')
  }

  function runOrchestratorFidWrite(content: string, agentId?: string) {
    const state = createEnforcementState()
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: FID_PATH, content },
      agentId: agentId ?? 'orchestrator',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
  }

  it('ALLOWS an Orchestrator FID write at exactly 100 payload lines', () => {
    const result = runOrchestratorFidWrite(fidContent(100))
    expect(result.blocked).toBe(false)
  })

  it('BLOCKS an Orchestrator FID write above 100 lines with route-through-Recorder', () => {
    const result = runOrchestratorFidWrite(fidContent(101))
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('> 100')
    expect(result.reason).toContain('Route through the Recorder')
  })

  it('does NOT gate non-Orchestrator agents (Forge relays unaffected)', () => {
    const result = runOrchestratorFidWrite(fidContent(150), 'forge')
    expect(result.blocked).toBe(false)
  })
})
