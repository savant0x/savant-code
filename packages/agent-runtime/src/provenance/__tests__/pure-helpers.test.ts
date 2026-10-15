/**
 * Direct unit coverage for the extracted provenance pure helpers
 * (FID-2026-0813-004): `buildWriteReceipt` and `buildVerdictPayload`.
 *
 * These were inlined in `ProvenanceSession` before the decomposition; the
 * session lifecycle suite covers them through integration, while these tests
 * pin the exact construction shape in isolation.
 */
import { jcsCanonicalize } from '@savant-code/common/crypto'
import { describe, expect, test } from 'bun:test'

import { buildWriteReceipt } from '../receipt'
import { buildVerdictPayload } from '../verdict'

import type { JSONValue } from '@savant-code/common/types/json'

describe('provenance pure helper — buildWriteReceipt', () => {
  test('constructs a pending receipt with every field mapped', () => {
    const changeHash = 'sha256:' + 'a'.repeat(64)
    const receipt = buildWriteReceipt({
      sessionId: 'sess_pure',
      seq: 3,
      changeHash,
      path: 'src/a.ts',
      tool: 'str_replace',
      fidId: 'FID-2026-0813-001',
      lawChecks: [{ law: 1, outcome: 'passed' }],
      failClosed: true,
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      timestamp: '2026-08-13T00:00:00.000Z',
    })
    expect(receipt.schema).toBe('savant.provenance.receipt.v1')
    expect(receipt.sessionId).toBe('sess_pure')
    expect(receipt.seq).toBe(3)
    expect(receipt.status).toBe('pending')
    expect(receipt.changeHash).toBe(changeHash)
    expect(receipt.path).toBe('src/a.ts')
    expect(receipt.tool).toBe('str_replace')
    expect(receipt.fidId).toBe('FID-2026-0813-001')
    expect(receipt.lawChecks).toEqual([{ law: 1, outcome: 'passed' }])
    expect(receipt.failClosed).toBe(true)
    expect(receipt.writer).toEqual({
      agentId: 'forge-1',
      agentType: 'forge',
      phase: 'green',
    })
    expect(receipt.timestamp).toBe('2026-08-13T00:00:00.000Z')
    expect(receipt.signatures).toEqual([])
    expect(receipt.verdicts).toEqual([])
  })

  test('exposes only the TrustReceipt schema keys (no extras)', () => {
    const receipt = buildWriteReceipt({
      sessionId: 's',
      seq: 1,
      changeHash: 'sha256:' + 'b'.repeat(64),
      path: 'p',
      tool: 'write_file',
      fidId: null,
      lawChecks: [],
      failClosed: false,
      writerAgentId: 'w',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      timestamp: 't',
    })
    expect(Object.keys(receipt).sort()).toEqual([
      'changeHash',
      'failClosed',
      'fidId',
      'lawChecks',
      'path',
      'schema',
      'seq',
      'sessionId',
      'signatures',
      'status',
      'timestamp',
      'tool',
      'verdicts',
      'writer',
    ])
  })
})

describe('provenance pure helper — buildVerdictPayload', () => {
  test('returns the canonical six-field verdict payload', () => {
    const payload = buildVerdictPayload({
      changeHash: 'sha256:' + 'c'.repeat(64),
      phase: 'audit',
      agentType: 'verifier',
      agentId: 'verifier-1',
      verdictText: 'PASS — base signature verified',
      timestamp: '2026-08-13T00:45:00.000Z',
    })
    expect(payload).toEqual({
      changeHash: 'sha256:' + 'c'.repeat(64),
      phase: 'audit',
      agentType: 'verifier',
      agentId: 'verifier-1',
      verdictText: 'PASS — base signature verified',
      timestamp: '2026-08-13T00:45:00.000Z',
    })
  })

  test('never carries over/sig — those are added by the signer', () => {
    const payload = buildVerdictPayload({
      changeHash: 'h',
      phase: 'adversarial',
      agentType: 'adversary',
      agentId: 'adversary-1',
      verdictText: 'REFUTE',
      timestamp: 't',
    })
    expect(Object.keys(payload).sort()).toEqual([
      'agentId',
      'agentType',
      'changeHash',
      'phase',
      'timestamp',
      'verdictText',
    ])
  })

  test('is JCS-stable regardless of key insertion order', () => {
    const payload = buildVerdictPayload({
      changeHash: 'c',
      phase: 'adversarial',
      agentType: 'adversary',
      agentId: 'adversary-1',
      verdictText: 'REFUTE',
      timestamp: 't',
    })
    const reordered = {
      timestamp: 't',
      verdictText: 'REFUTE',
      agentId: 'adversary-1',
      agentType: 'adversary',
      phase: 'adversarial',
      changeHash: 'c',
    }
    expect(jcsCanonicalize(payload as unknown as JSONValue)).toBe(
      jcsCanonicalize(reordered as unknown as JSONValue),
    )
  })
})
