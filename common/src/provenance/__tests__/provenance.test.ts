/**
 * Direct unit coverage for the common ZTAP provenance submodules
 * (FID-2026-0813-001/006): schema allowlists, receipt validation, batch
 * validation, export-time classification, and the manifest/ledger loader.
 *
 * The agent-runtime and /attest suites exercise these through integration;
 * these tests pin the submodule behavior in isolation (and the decomposition
 * boundary introduced during the 0.0.24 working-tree work).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  deriveRoleKeypair,
  hashChange,
  jcsCanonicalize,
  signPayload,
  toBase64Url,
} from '../../crypto'
import {
  classifyReceipts,
  loadProvenanceSession,
  readProvenanceManifest,
  receiptBase,
  validateReceipt,
  validateReceiptBatch,
} from '../index'
import { hasUnknownKeys } from '../schemas'

import type { JSONValue } from '../../types/json'
import type { SessionManifest, TrustReceipt } from '../../types/provenance'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ztap-common-'))
  tempDirs.push(dir)
  return dir
}

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

describe('provenance schemas — hasUnknownKeys', () => {
  test('flags keys outside the allowlist', () => {
    expect(hasUnknownKeys({ seq: 1, injected: true }, ['seq'])).toBe(true)
  })

  test('accepts a subset of allowed keys and an empty object', () => {
    expect(hasUnknownKeys({ seq: 1 }, ['seq', 'path'])).toBe(false)
    expect(hasUnknownKeys({}, ['seq'])).toBe(false)
  })
})

describe('provenance receipt — receiptBase', () => {
  test('strips status, signatures, and verdicts; keeps the immutable write record', () => {
    const receipt = baseReceipt({
      status: 'complete',
      signatures: [
        {
          role: 'forge',
          agentId: 'forge-1',
          over: 'sha256:' + '0'.repeat(64),
          sig: 'sig',
        },
      ],
      verdicts: [
        {
          phase: 'audit',
          agentType: 'verifier',
          agentId: 'verifier-1',
          verdictText: 'PASS',
          timestamp: '2026-08-13T00:45:00.000Z',
          over: 'sha256:' + '0'.repeat(64),
          sig: 'sig',
        },
      ],
    })
    const base = receiptBase(receipt)
    expect('status' in base).toBe(false)
    expect('signatures' in base).toBe(false)
    expect('verdicts' in base).toBe(false)
    expect(base.changeHash).toBe(receipt.changeHash)
    expect(base.path).toBe('src/a.ts')
    expect(base.tool).toBe('write_file')
    expect(base.writer).toEqual(receipt.writer)
    expect(base.lawChecks).toEqual(receipt.lawChecks)
    expect(base.timestamp).toBe(receipt.timestamp)
  })
})

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

describe('provenance batch — classifyReceipts', () => {
  test('marks live vs superseded by on-disk content hash', () => {
    const root = makeTempDir()
    const file = path.join(root, 'a.ts')
    const content = 'export const a = 1\n'
    fs.writeFileSync(file, content, 'utf8')
    const receipt = baseReceipt({
      path: 'a.ts',
      changeHash: hashChange(content),
    })

    expect(classifyReceipts([receipt], root).get(1)).toBe('live')

    fs.writeFileSync(file, 'export const a = 999\n', 'utf8')
    expect(classifyReceipts([receipt], root).get(1)).toBe('superseded')

    fs.rmSync(file)
    expect(classifyReceipts([receipt], root).get(1)).toBe('superseded')
  })
})

describe('provenance loader — readProvenanceManifest + loadProvenanceSession', () => {
  test('readProvenanceManifest returns null when missing and the manifest when present', () => {
    const dir = makeTempDir()
    expect(readProvenanceManifest(dir)).toBeNull()
    const manifest = baseManifest()
    fs.writeFileSync(
      path.join(dir, 'session.json'),
      JSON.stringify(manifest),
      'utf8',
    )
    expect(readProvenanceManifest(dir)?.sessionId).toBe('sess_common')
  })

  test('loadProvenanceSession reconstructs receipts and merges verdict lines into complete status', async () => {
    const dir = makeTempDir()
    fs.writeFileSync(
      path.join(dir, 'session.json'),
      JSON.stringify(baseManifest({ finalSeq: 1 })),
      'utf8',
    )
    const receipt = baseReceipt({ seq: 1 })
    const verdict = (phase: 'audit' | 'adversarial', agentType: string) =>
      JSON.stringify({
        type: 'verdict',
        sessionId: 'sess_common',
        seq: 1,
        phase,
        agentType,
        agentId: `${agentType}-1`,
        verdictText: 'PASS',
        timestamp: '2026-08-13T00:45:00.000Z',
        changeHash: receipt.changeHash,
        over: 'sha256:' + '0'.repeat(64),
        sig: 'sig',
      })
    const lines = [
      JSON.stringify({ type: 'receipt', receipt }),
      verdict('audit', 'verifier'),
      verdict('adversarial', 'adversary'),
      JSON.stringify({
        type: 'session_close',
        sessionId: 'sess_common',
        closedAt: '2026-08-13T01:00:00.000Z',
        finalSeq: 1,
      }),
    ]
    fs.writeFileSync(
      path.join(dir, 'receipts.jsonl'),
      lines.join('\n') + '\n',
      'utf8',
    )

    const loaded = await loadProvenanceSession(dir)
    expect(loaded.manifest?.sessionId).toBe('sess_common')
    expect(loaded.receipts).toHaveLength(1)
    expect(loaded.receipts[0].verdicts).toHaveLength(2)
    expect(loaded.receipts[0].status).toBe('complete')
    expect(loaded.entries.some((e) => e.type === 'session_close')).toBe(true)
  })
})
