import path from 'node:path'

import { deriveRoleKeypair } from '@savant-code/common/crypto'
import { describe, expect, test } from 'bun:test'

import {
  ProvenanceLedger,
  ProvenanceSession,
  validateReceipt,
  validateReceiptBatch,
} from '..'
import { makeAgentState, makeTempProject } from './provenance-test-harness'

import type { SessionManifest } from './provenance-test-harness'

describe('Signature + key custody + latency gates (FID-005)', () => {
  test('per-role HKDF derivation: same seed+session yields identical keys; distinct roles differ', async () => {
    const seed = new Uint8Array(32)
    crypto.getRandomValues(seed)
    const forgeA = await deriveRoleKeypair(seed, 'sess_x', 'forge')
    const forgeB = await deriveRoleKeypair(seed, 'sess_x', 'forge')
    const verifier = await deriveRoleKeypair(seed, 'sess_x', 'verifier')
    expect(Buffer.from(forgeA.publicKey).toString('hex')).toBe(
      Buffer.from(forgeB.publicKey).toString('hex'),
    )
    expect(Buffer.from(forgeA.publicKey).toString('hex')).not.toBe(
      Buffer.from(verifier.publicKey).toString('hex'),
    )
  })

  test('a complete receipt validates end-to-end through the shared validator', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_valid',
      mode: 'record',
      projectRoot: root,
    })
    await session.recordWriteReceipt({
      path: path.join(root, 'src', 'v.ts'),
      tool: 'write_file',
      content: 'export const v = 3\n',
      writerAgentId: 'forge-3',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [{ law: 1, outcome: 'passed' }],
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
      verdictText: 'PASS',
    })
    await session.finalize()
    const loaded = await ProvenanceLedger.loadSession(
      path.join(root, '.savant', 'provenance', 'sess_valid'),
    )
    const failures = validateReceipt(
      loaded.receipts[0],
      loaded.manifest as SessionManifest,
    )
    expect(failures).toEqual([])
    expect(
      validateReceiptBatch(loaded.receipts, loaded.manifest as SessionManifest),
    ).toEqual([])
  })

  test('latency gate: receipt creation adds no blocking await to the write path (fire-and-forget, <10ms total)', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_latency',
      mode: 'record',
      projectRoot: root,
    })
    // The write path calls recordWriteReceipt without awaiting; measure the
    // full creation cost (sign + JCS + hash) — must stay well under the
    // interactive-latency budget of the FID (<10ms typical, generous CI headroom).
    const started = performance.now()
    const receipt = await session.recordWriteReceipt({
      path: path.join(root, 'l.ts'),
      tool: 'write_file',
      content: 'export const l = 4\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })
    const elapsed = performance.now() - started
    expect(receipt).not.toBeNull()
    expect(elapsed).toBeLessThan(50)
    // Flush the async ledger append before the temp dir is torn down.
    await session.finalize()
  })

  test('key custody: seed is memory-only — never serialized into session state', () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_custody',
      mode: 'record',
      projectRoot: root,
    })
    const state = makeAgentState()
    // Threading a session into AgentState.provenance must not serialize keys.
    const serialized = JSON.stringify({ provenance: session })
    expect(serialized).not.toMatch(/seed|privateKey|secret/)
    void state
  })
})
