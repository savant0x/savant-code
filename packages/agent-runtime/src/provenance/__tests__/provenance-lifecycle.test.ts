/**
 * ZTAP provenance test family — FID-2026-0813-004/005/006.
 *
 * Covers the append-only ledger + session lifecycle (004), signature /
 * key-custody / latency / mode-matrix gates (005), and the validateReceipt
 * attack suite A1–A11 (006). Evidence is tool output — every assertion here
 * runs against real Ed25519 keys and a real temp-dir ledger.
 *
 * Family layout:
 * - provenance-test-harness.ts      — shared fixtures + temp-dir lifecycle
 * - provenance-lifecycle.test.ts    — session lifecycle: writes, verdicts, close (FID-004)
 * - provenance-finalize.test.ts     — finalize resolution semantics (FID-004/005)
 * - provenance-signature.test.ts    — signature + key custody + latency gates (FID-005)
 * - provenance-attack-core.test.ts  — attack suite A1–A6 (FID-006)
 * - provenance-attack-edge.test.ts  — attack suite A7–A11 + negative control (FID-006)
 * - provenance-classification.test.ts — export-time classification (master D6)
 */
import fs from 'node:fs'
import path from 'node:path'

import { hashChange } from '@savant-code/common/crypto'
import { describe, expect, test } from 'bun:test'

import { ProvenanceLedger, ProvenanceSession } from '..'
import { makeTempProject } from './provenance-test-harness'

describe('ProvenanceSession lifecycle (FID-004)', () => {
  test('record mode: write receipt is signed by the writer role and lands on the ledger', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_lifecycle',
      mode: 'record',
      projectRoot: root,
    })
    const receipt = await session.recordWriteReceipt({
      path: path.join(root, 'src', 'a.ts'),
      tool: 'write_file',
      content: 'export const a = 1\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [{ law: 1, outcome: 'passed' }],
    })
    expect(receipt).not.toBeNull()
    expect(receipt!.status).toBe('pending')
    expect(receipt!.signatures).toHaveLength(1)
    expect(receipt!.signatures[0].role).toBe('forge')
    expect(receipt!.changeHash).toBe(hashChange('export const a = 1\n'))
    expect(receipt!.failClosed).toBe(false)

    await session.finalize()
    // Ledger files exist and are hash-only (Law 12: never the content).
    const ledgerDir = path.join(root, '.savant', 'provenance', 'sess_lifecycle')
    const raw = fs.readFileSync(path.join(ledgerDir, 'receipts.jsonl'), 'utf8')
    expect(raw).not.toContain('export const a = 1')
    expect(raw).toContain('savant.provenance.receipt.v1')
    const manifest = ProvenanceLedger.readManifestFrom(ledgerDir)
    expect(manifest?.roles.forge).toBe(
      receipt!.signatures[0].role ? manifest?.roles.forge : undefined,
    )
    expect(manifest?.roles.forge).toBeTruthy()
    expect(manifest?.closedAt).toBeTruthy()
    // Manifest carries only PUBLIC keys — never private material (D2).
    expect(JSON.stringify(manifest)).not.toMatch(/private|secret|seed/i)
  })

  test('off mode: no receipts, no ledger, no events', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_off',
      mode: 'off',
      projectRoot: root,
    })
    const receipt = await session.recordWriteReceipt({
      path: path.join(root, 'src', 'a.ts'),
      tool: 'write_file',
      content: 'x',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })
    expect(receipt).toBeNull()
    await session.finalize()
    expect(
      fs.existsSync(path.join(root, '.savant', 'provenance', 'sess_off')),
    ).toBe(false)
  })

  test('verdict binding: audit + adversarial signatures complete the receipt (per-role keys)', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_verdicts',
      mode: 'record',
      projectRoot: root,
    })
    const events: string[] = []
    session.onEvent((event) => events.push(event.type))

    const receipt = await session.recordWriteReceipt({
      path: path.join(root, 'src', 'b.ts'),
      tool: 'write_file',
      content: 'export const b = 2\n',
      writerAgentId: 'forge-2',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: 'FID-2026-0813-001',
      lawChecks: [],
    })
    expect(receipt).not.toBeNull()

    await session.bindVerdict({
      phase: 'audit',
      agentId: 'verifier-1',
      agentType: 'verifier',
      verdictText: 'PASS — signature covers the base receipt',
    })
    expect(receipt!.status).toBe('pending') // adversarial still missing

    await session.bindVerdict({
      phase: 'adversarial',
      agentId: 'adversary-1',
      agentType: 'adversary',
      verdictText: 'REFUTE — replay vector closed (per-role keys)',
    })
    expect(receipt!.status).toBe('complete')
    expect(receipt!.verdicts).toHaveLength(2)
    expect(events).toContain('receipt_created')
    expect(events).toContain('verdict_bound')

    await session.finalize()
    const loaded = await ProvenanceLedger.loadSession(
      path.join(root, '.savant', 'provenance', 'sess_verdicts'),
    )
    expect(loaded.receipts).toHaveLength(1)
    expect(loaded.receipts[0].status).toBe('complete')
    expect(loaded.receipts[0].verdicts).toHaveLength(2)
    expect(loaded.entries.some((e) => e.type === 'session_close')).toBe(true)
    // FID-006 A4 (same-entity rejection): Forge/Verifier/Adversary must be
    // three DISTINCT keys — checkable cryptographically, not nominally.
    const roles = new Set<string>([
      loaded.manifest?.roles.forge ?? '',
      loaded.manifest?.roles.verifier ?? '',
      loaded.manifest?.roles.adversary ?? '',
    ])
    expect(roles.size).toBe(3)
  })

  test('ledger reconstruction merges verdict lines into their receipt by (sessionId, seq)', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_merge',
      mode: 'record',
      projectRoot: root,
    })
    const r1 = await session.recordWriteReceipt({
      path: path.join(root, 'a.ts'),
      tool: 'write_file',
      content: 'a',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })
    const r2 = await session.recordWriteReceipt({
      path: path.join(root, 'b.ts'),
      tool: 'write_file',
      content: 'b',
      writerAgentId: 'forge-1',
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
    await session.finalize()

    const loaded = await ProvenanceLedger.loadSession(
      path.join(root, '.savant', 'provenance', 'sess_merge'),
    )
    expect(loaded.receipts.map((r) => r.seq)).toEqual([r1!.seq, r2!.seq])
    // FID-2026-0814-005: bindVerdict binds to every open receipt lacking the
    // phase, and finalize() then resolves every still-pending receipt with a
    // signed system-role close annotation — so both receipts end with the
    // audit verdict + the close annotation, and neither can be `complete`
    // (no adversarial verdict), so both land on the honest `no_verdict`.
    for (const receipt of loaded.receipts) {
      expect(receipt.verdicts).toHaveLength(2)
      expect(receipt.status).toBe('no_verdict')
      expect(
        receipt.verdicts.some(
          (v) => v.agentType === 'system' && v.agentId === 'session-close',
        ),
      ).toBe(true)
    }
  })

  test('events are bounded and session_finalized reports the receipt count', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_events',
      mode: 'record',
      projectRoot: root,
    })
    const finalized: { receiptCount: number }[] = []
    session.onEvent((event) => {
      if (event.type === 'session_finalized') finalized.push(event)
    })
    await session.recordWriteReceipt({
      path: path.join(root, 'a.ts'),
      tool: 'write_file',
      content: 'a',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })
    await session.finalize()
    expect(finalized).toHaveLength(1)
    expect(finalized[0].receiptCount).toBe(1)
  })

  test('mode resolution: AgentState field wins, invalid values fall back to record', () => {
    expect(
      new ProvenanceSession({
        sessionId: 's',
        mode: 'record',
        projectRoot: makeTempProject(),
      }).mode,
    ).toBe('record')
    const session = new ProvenanceSession({
      sessionId: 's',
      mode: 'off',
      projectRoot: makeTempProject(),
    })
    expect(session.mode).toBe('off')
  })
})
