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

describe('Attack suite A7–A11 (FID-006)', () => {
  test('A7 timestamps outside session bounds are rejected', () => {
    const manifest = baseManifest({ createdAt: '2026-08-13T00:00:00.000Z' })
    const receipt = {
      schema: 'savant.provenance.receipt.v1',
      sessionId: 'sess_test',
      seq: 1,
      status: 'pending',
      changeHash: 'sha256:' + 'a'.repeat(64),
      path: 'x.ts',
      tool: 'write_file',
      fidId: null,
      lawChecks: [],
      failClosed: false,
      writer: { agentId: 'forge-1', agentType: 'forge', phase: 'green' },
      timestamp: '2026-08-12T23:59:59.000Z', // before session start
      signatures: [],
      verdicts: [],
    } as unknown as TrustReceipt
    const failures = validateReceiptBatch([receipt], manifest)
    expect(failures.some((f) => f.includes('before session start'))).toBe(true)
  })

  test('A8 missing writer signature is rejected', () => {
    const manifest = baseManifest({ roles: { forge: 'pub' } })
    const receipt = {
      schema: 'savant.provenance.receipt.v1',
      sessionId: 'sess_test',
      seq: 1,
      status: 'pending',
      changeHash: 'sha256:' + 'a'.repeat(64),
      path: 'x.ts',
      tool: 'write_file',
      fidId: null,
      lawChecks: [],
      failClosed: false,
      writer: { agentId: 'forge-1', agentType: 'forge', phase: 'green' },
      timestamp: '2026-08-13T01:00:00.000Z',
      signatures: [],
      verdicts: [],
    } as unknown as TrustReceipt
    expect(
      validateReceipt(receipt, manifest).some((f) =>
        f.includes('missing writer signature'),
      ),
    ).toBe(true)
  })

  test('A9 malformed changeHash is rejected', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_hash',
      mode: 'record',
      projectRoot: root,
    })
    const receipt = (await session.recordWriteReceipt({
      path: path.join(root, 'h.ts'),
      tool: 'write_file',
      content: 'export const h = 6\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const manifest = ProvenanceLedger.readManifestFrom(
      path.join(root, '.savant', 'provenance', 'sess_hash'),
    ) as SessionManifest
    const tampered = { ...receipt, changeHash: 'sha256:xyz' } as TrustReceipt
    expect(
      validateReceipt(tampered, manifest).some((f) =>
        f.includes('malformed changeHash'),
      ),
    ).toBe(true)
  })

  test('A10 wrong sessionId is rejected', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_wrong',
      mode: 'record',
      projectRoot: root,
    })
    const receipt = (await session.recordWriteReceipt({
      path: path.join(root, 'w.ts'),
      tool: 'write_file',
      content: 'export const w = 7\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const manifest = ProvenanceLedger.readManifestFrom(
      path.join(root, '.savant', 'provenance', 'sess_wrong'),
    ) as SessionManifest
    const tampered = { ...receipt, sessionId: 'sess_other' } as TrustReceipt
    expect(
      validateReceipt(tampered, manifest).some((f) => f.includes('sessionId')),
    ).toBe(true)
  })

  test('A11 adversarial verdict without an adversary role fails the complete check', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_a11',
      mode: 'record',
      projectRoot: root,
    })
    const receipt = (await session.recordWriteReceipt({
      path: path.join(root, 'a11.ts'),
      tool: 'write_file',
      content: 'export const a11 = 8\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const manifest = ProvenanceLedger.readManifestFrom(
      path.join(root, '.savant', 'provenance', 'sess_a11'),
    ) as SessionManifest
    // Craft an adversarial verdict with a role that has NO manifest entry.
    const attacked: TrustReceipt = {
      ...receipt,
      status: 'complete',
      verdicts: [
        {
          phase: 'audit',
          agentType: 'verifier',
          agentId: 'verifier-1',
          verdictText: 'PASS',
          timestamp: new Date().toISOString(),
          over: 'sha256:' + 'd'.repeat(64),
          sig: 'CCCC',
        },
        {
          phase: 'adversarial',
          agentType: 'attacker', // not in manifest
          agentId: 'evil',
          verdictText: 'PASS',
          timestamp: new Date().toISOString(),
          over: 'sha256:' + 'e'.repeat(64),
          sig: 'DDDD',
        },
      ],
    }
    const failures = validateReceipt(attacked, manifest)
    expect(
      failures.some((f) => f.includes('role attacker not in manifest')),
    ).toBe(true)
  })

  test('negative control: a real pending receipt (no verdicts) still validates', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_neg',
      mode: 'record',
      projectRoot: root,
    })
    const receipt = (await session.recordWriteReceipt({
      path: path.join(root, 'n.ts'),
      tool: 'write_file',
      content: 'export const n = 9\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const manifest = ProvenanceLedger.readManifestFrom(
      path.join(root, '.savant', 'provenance', 'sess_neg'),
    ) as SessionManifest
    expect(validateReceipt(receipt, manifest)).toEqual([])
  })
})
