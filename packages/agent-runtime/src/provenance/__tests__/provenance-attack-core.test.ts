import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  ProvenanceLedger,
  ProvenanceSession,
  validateReceipt,
  validateReceiptBatch,
} from '..'
import { baseManifest, makeTempProject } from './provenance-test-harness'

import type { SessionManifest, TrustReceipt } from './provenance-test-harness'

describe('Attack suite A1–A6 (FID-006)', () => {
  test('A1 replay: a receipt from another session fails session binding', async () => {
    const rootA = makeTempProject()
    const rootB = makeTempProject()
    const sessionA = new ProvenanceSession({
      sessionId: 'sess_a',
      mode: 'record',
      projectRoot: rootA,
    })
    const sessionB = new ProvenanceSession({
      sessionId: 'sess_b',
      mode: 'record',
      projectRoot: rootB,
    })
    const receiptA = (await sessionA.recordWriteReceipt({
      path: path.join(rootA, 'a.ts'),
      tool: 'write_file',
      content: 'a',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await sessionA.finalize()
    // Session B must have its own forge key in the manifest for the cross-key
    // verification to exercise the signature path (role present, key differs).
    await sessionB.recordWriteReceipt({
      path: path.join(rootB, 'b.ts'),
      tool: 'write_file',
      content: 'b',
      writerAgentId: 'forge-2',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })
    await sessionB.finalize()
    // Replay receiptA against session B's manifest: writer role signature must
    // fail (different key) AND sessionId must mismatch.
    const manifestB = ProvenanceLedger.readManifestFrom(
      path.join(rootB, '.savant', 'provenance', 'sess_b'),
    ) as SessionManifest
    const failures = validateReceipt(receiptA, manifestB)
    expect(failures.some((f) => f.includes('sessionId'))).toBe(true)
    expect(failures.some((f) => f.includes('signature invalid'))).toBe(true)
  })

  test('A2 forgery: attacker-crafted receipt with a role not in the manifest', () => {
    const manifest = baseManifest({ roles: { forge: 'somepubkey' } })
    const forged = {
      schema: 'savant.provenance.receipt.v1',
      sessionId: 'sess_test',
      seq: 1,
      status: 'pending',
      changeHash: 'sha256:' + 'a'.repeat(64),
      path: 'evil.ts',
      tool: 'write_file',
      fidId: null,
      lawChecks: [],
      failClosed: false,
      writer: { agentId: 'hacker', agentType: 'forge', phase: 'green' },
      timestamp: '2026-08-13T01:00:00.000Z',
      signatures: [
        {
          role: 'forge',
          agentId: 'hacker',
          over: 'sha256:' + 'b'.repeat(64),
          sig: 'AAAA',
        },
      ],
      verdicts: [],
    } as unknown as TrustReceipt
    const failures = validateReceipt(forged, manifest)
    // Role key is a garbage pubkey, and over-hash won't match the real base.
    expect(failures.some((f) => f.includes('writer over-hash mismatch'))).toBe(
      true,
    )
  })

  test('A3 JCS tamper: any value substitution breaks the writer over-hash', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_jcs',
      mode: 'record',
      projectRoot: root,
    })
    const receipt = (await session.recordWriteReceipt({
      path: path.join(root, 't.ts'),
      tool: 'write_file',
      content: 'export const t = 1\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const manifest = ProvenanceLedger.readManifestFrom(
      path.join(root, '.savant', 'provenance', 'sess_jcs'),
    ) as SessionManifest
    // Substitute the path (value tamper — JCS canonicalization does NOT
    // normalize values; key order is canonical but values must match).
    const tampered: TrustReceipt = { ...receipt, path: 'evil.ts' }
    const failures = validateReceipt(tampered, manifest)
    expect(failures.some((f) => f.includes('writer over-hash mismatch'))).toBe(
      true,
    )
  })

  test('A4 same-entity: a verdict signed by the writer role is not a Verifier verdict', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_same',
      mode: 'record',
      projectRoot: root,
    })
    const receipt = (await session.recordWriteReceipt({
      path: path.join(root, 's.ts'),
      tool: 'write_file',
      content: 'export const s = 5\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const manifest = ProvenanceLedger.readManifestFrom(
      path.join(root, '.savant', 'provenance', 'sess_same'),
    ) as SessionManifest
    // Attacker marks the receipt complete and appends a "verifier" verdict
    // signed with the FORGE key (same entity — the exact attack the per-role
    // design closes).
    const forgedVerdict = {
      phase: 'audit',
      agentType: 'forge', // claims verifier authority but is the writer role
      agentId: 'forge-1',
      verdictText: 'PASS',
      timestamp: new Date().toISOString(),
      over: 'sha256:' + 'c'.repeat(64),
      sig: 'BBBB',
    }
    const attacked: TrustReceipt = {
      ...receipt,
      status: 'complete',
      verdicts: [forgedVerdict as TrustReceipt['verdicts'][number]],
    }
    const failures = validateReceipt(attacked, manifest)
    // The "verdict" is signed by forge's key, so the payload hash won't match
    // a verifier role check — signature invalid (or over-hash mismatch).
    expect(
      failures.some(
        (f) =>
          f.includes('signature invalid') || f.includes('over-hash mismatch'),
      ),
    ).toBe(true)
  })

  test('A5 stale seq: batch validation rejects non-monotonic sequences', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_seq',
      mode: 'record',
      projectRoot: root,
    })
    const r1 = (await session.recordWriteReceipt({
      path: path.join(root, 'a.ts'),
      tool: 'write_file',
      content: 'a',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    const r2 = (await session.recordWriteReceipt({
      path: path.join(root, 'b.ts'),
      tool: 'write_file',
      content: 'b',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const manifest = ProvenanceLedger.readManifestFrom(
      path.join(root, '.savant', 'provenance', 'sess_seq'),
    ) as SessionManifest
    // Reorder the sorted list — seq 2 before seq 1.
    const failures = validateReceiptBatch([r2, r1], manifest)
    expect(failures.some((f) => f.includes('not strictly increasing'))).toBe(
      true,
    )
  })

  test('A6 duplicate seq: batch validation flags it', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_dup',
      mode: 'record',
      projectRoot: root,
    })
    const r = (await session.recordWriteReceipt({
      path: path.join(root, 'a.ts'),
      tool: 'write_file',
      content: 'a',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const manifest = ProvenanceLedger.readManifestFrom(
      path.join(root, '.savant', 'provenance', 'sess_dup'),
    ) as SessionManifest
    const failures = validateReceiptBatch([r, { ...r }], manifest)
    expect(failures.some((f) => f.includes('duplicate seq'))).toBe(true)
  })
})
