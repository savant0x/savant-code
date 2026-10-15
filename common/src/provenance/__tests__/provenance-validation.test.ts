import { describe, expect, test } from 'bun:test'

import {
  deriveRoleKeypair,
  hashChange,
  jcsCanonicalize,
  signPayload,
  toBase64Url,
} from '../../crypto'
import { receiptBase, validateReceipt, validateReceiptBatch } from '../index'

import type { JSONValue } from '../../types/json'
import type { SessionManifest, TrustReceipt } from '../../types/provenance'

// FID-2026-0819-005 Loop 215: receipt-validation and batch-validation
// suites moved verbatim from provenance.test.ts; fixtures (baseManifest,
// baseReceipt, signedFixture) copied verbatim.

function baseManifest(
  overrides: Partial<SessionManifest> = {},
): SessionManifest {
  return {
    schema: 'savant.provenance.session.v1',
    sessionId: 'sess_common',
    createdAt: '2026-08-13T00:00:00.000Z',
    closedAt: '2026-08-13T01:00:00.000Z',
    mode: 'record',
    roles: {},
    ...overrides,
  }
}

function baseReceipt(overrides: Partial<TrustReceipt> = {}): TrustReceipt {
  return {
    schema: 'savant.provenance.receipt.v1',
    sessionId: 'sess_common',
    seq: 1,
    status: 'pending',
    changeHash: hashChange('export const a = 1\n'),
    path: 'src/a.ts',
    tool: 'write_file',
    fidId: 'FID-2026-0813-001',
    lawChecks: [{ law: 1, outcome: 'passed' }],
    failClosed: false,
    writer: { agentId: 'forge-1', agentType: 'forge', phase: 'green' },
    timestamp: '2026-08-13T00:30:00.000Z',
    signatures: [],
    verdicts: [],
    ...overrides,
  }
}

/** A fully signed complete receipt + matching manifest (real Ed25519 keys). */
async function signedFixture(): Promise<{
  manifest: SessionManifest
  receipt: TrustReceipt
}> {
  const seed = new Uint8Array(32).fill(7)
  const forge = await deriveRoleKeypair(seed, 'sess_common', 'forge')
  const verifier = await deriveRoleKeypair(seed, 'sess_common', 'verifier')
  const adversary = await deriveRoleKeypair(seed, 'sess_common', 'adversary')
  const manifest: SessionManifest = baseManifest({
    finalSeq: 1,
    roles: {
      forge: toBase64Url(forge.publicKey),
      verifier: toBase64Url(verifier.publicKey),
      adversary: toBase64Url(adversary.publicKey),
    },
  })
  const receipt = baseReceipt()
  const writerSig = signPayload(forge, {
    kind: 'jcs',
    canonical: jcsCanonicalize(receiptBase(receipt) as unknown as JSONValue),
  })
  receipt.signatures = [
    {
      role: 'forge',
      agentId: 'forge-1',
      over: writerSig.over,
      sig: writerSig.sig,
    },
  ]
  const bindings = [
    ['audit', 'verifier', verifier, 'PASS — audit'] as const,
    ['adversarial', 'adversary', adversary, 'PASS — adversarial'] as const,
  ]
  for (const [phase, agentType, key, verdictText] of bindings) {
    // The signed payload includes changeHash; the stored verdict record does
    // not (VerdictRecord is the seven-field record, matching bindVerdict).
    const payload = {
      changeHash: receipt.changeHash,
      phase,
      agentType,
      agentId: `${agentType}-1`,
      verdictText,
      timestamp: '2026-08-13T00:45:00.000Z',
    }
    const signed = signPayload(key, {
      kind: 'jcs',
      canonical: jcsCanonicalize(payload as unknown as JSONValue),
    })
    receipt.verdicts.push({
      phase,
      agentType,
      agentId: `${agentType}-1`,
      verdictText,
      timestamp: '2026-08-13T00:45:00.000Z',
      over: signed.over,
      sig: signed.sig,
    })
  }
  receipt.status = 'complete'
  return { manifest, receipt }
}

describe('provenance receipt — validateReceipt (common submodule)', () => {
  test('accepts a fully signed complete receipt', async () => {
    const { manifest, receipt } = await signedFixture()
    expect(validateReceipt(receipt, manifest)).toEqual([])
  })

  test('rejects a substituted verdict (over-hash mismatch)', async () => {
    const { manifest, receipt } = await signedFixture()
    receipt.verdicts[0].verdictText = 'PASS — forged text'
    const failures = validateReceipt(receipt, manifest)
    expect(failures.some((f) => f.includes('over-hash mismatch'))).toBe(true)
  })

  test('rejects an unknown receipt field (schema attack)', async () => {
    const { manifest, receipt } = await signedFixture()
    const injected = { ...receipt, injected: true }
    const failures = validateReceipt(injected, manifest)
    expect(failures.some((f) => f.includes('unknown fields'))).toBe(true)
  })

  test('rejects a sessionId mismatch', async () => {
    const { manifest, receipt } = await signedFixture()
    receipt.sessionId = 'sess_other'
    const failures = validateReceipt(receipt, manifest)
    expect(failures.some((f) => f.includes('sessionId'))).toBe(true)
  })
})

describe('provenance batch — validateReceiptBatch', () => {
  test('accepts monotonic, distinct seqs within session bounds', () => {
    const manifest = baseManifest()
    const receipts = [
      baseReceipt({ seq: 1 }),
      baseReceipt({ seq: 2 }),
      baseReceipt({ seq: 3 }),
    ]
    expect(validateReceiptBatch(receipts, manifest)).toEqual([])
  })

  test('flags duplicate and non-monotonic seqs', () => {
    const manifest = baseManifest()
    const duplicate = [baseReceipt({ seq: 1 }), baseReceipt({ seq: 1 })]
    expect(
      validateReceiptBatch(duplicate, manifest).some((f) =>
        f.includes('duplicate seq'),
      ),
    ).toBe(true)
    const reordered = [baseReceipt({ seq: 2 }), baseReceipt({ seq: 1 })]
    expect(
      validateReceiptBatch(reordered, manifest).some((f) =>
        f.includes('not strictly increasing'),
      ),
    ).toBe(true)
  })

  test('flags timestamps outside session bounds', () => {
    const manifest = baseManifest()
    const before = baseReceipt({ timestamp: '2026-08-12T23:59:59.000Z' })
    expect(
      validateReceiptBatch([before], manifest).some((f) =>
        f.includes('before session start'),
      ),
    ).toBe(true)
    const after = baseReceipt({ timestamp: '2026-08-13T01:00:01.000Z' })
    expect(
      validateReceiptBatch([after], manifest).some((f) =>
        f.includes('after session close'),
      ),
    ).toBe(true)
  })
})
