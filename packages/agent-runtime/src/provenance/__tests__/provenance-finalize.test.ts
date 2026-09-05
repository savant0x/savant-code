import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { ProvenanceLedger, ProvenanceSession } from '..'
import { makeTempProject } from './provenance-test-harness'

// FID-2026-0814-005: open receipts resolve to the honest `no_verdict`
// terminal at session close via a signed system-role close annotation.
describe('ProvenanceSession finalize semantics (FID-004/005)', () => {
  test('finalize resolves open pending receipts to no_verdict with a system-role close annotation', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_noverdict',
      mode: 'record',
      projectRoot: root,
    })
    const events: string[] = []
    session.onEvent((event) => events.push(event.type))

    const receipt = await session.recordWriteReceipt({
      path: path.join(root, 'src', 'c.ts'),
      tool: 'write_file',
      content: 'export const c = 3\n',
      writerAgentId: 'forge-3',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })
    expect(receipt!.status).toBe('pending')

    await session.finalize()

    // In-memory receipt reaches the terminal state.
    expect(receipt!.status).toBe('no_verdict')
    expect(receipt!.verdicts).toHaveLength(1)
    const annotation = receipt!.verdicts[0]
    expect(annotation.agentType).toBe('system')
    expect(annotation.agentId).toBe('session-close')
    expect(annotation.phase).toBe('audit')
    expect(annotation.verdictText).toContain('No independent verdict')
    expect(annotation.sig).toBeTruthy()
    // Honesty boundary: the annotation is signed by `system`, never by
    // verifier/adversary (no fabricated audit).
    expect(annotation.agentType).not.toBe('verifier')
    expect(annotation.agentType).not.toBe('adversary')
    // The close annotation emitted a verdict_bound-style event for the live
    // matrix to update at session close.
    expect(events).toContain('verdict_bound')

    // Ledger reconstruction: the terminal status survives reload.
    const loaded = await ProvenanceLedger.loadSession(
      path.join(root, '.savant', 'provenance', 'sess_noverdict'),
    )
    expect(loaded.receipts).toHaveLength(1)
    expect(loaded.receipts[0].status).toBe('no_verdict')
    expect(loaded.receipts[0].verdicts).toHaveLength(1)
    expect(loaded.receipts[0].verdicts[0].agentType).toBe('system')
    // The system role key is published on the manifest so the close
    // annotation signature is verifiable.
    expect(loaded.manifest?.roles.system).toBeTruthy()
  })

  test('finalize leaves complete receipts untouched and never downgrades them', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_nodowngrade',
      mode: 'record',
      projectRoot: root,
    })
    const receipt = await session.recordWriteReceipt({
      path: path.join(root, 'd.ts'),
      tool: 'write_file',
      content: 'export const d = 4\n',
      writerAgentId: 'forge-4',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })
    await session.bindVerdict({
      phase: 'audit',
      agentId: 'verifier-1',
      agentType: 'verifier',
      verdictText: 'PASS',
    })
    await session.bindVerdict({
      phase: 'adversarial',
      agentId: 'adversary-1',
      agentType: 'adversary',
      verdictText: 'CONFIRM',
    })
    expect(receipt!.status).toBe('complete')

    await session.finalize()

    expect(receipt!.status).toBe('complete')
    expect(receipt!.verdicts).toHaveLength(2)
    expect(receipt!.verdicts.some((v) => v.agentType === 'system')).toBe(false)

    const loaded = await ProvenanceLedger.loadSession(
      path.join(root, '.savant', 'provenance', 'sess_nodowngrade'),
    )
    expect(loaded.receipts[0].status).toBe('complete')
    expect(loaded.receipts[0].verdicts).toHaveLength(2)
  })
})
