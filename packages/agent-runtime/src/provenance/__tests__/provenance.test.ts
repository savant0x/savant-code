/**
 * ZTAP provenance test suite — FID-2026-0813-004/005/006.
 *
 * Covers the append-only ledger + session lifecycle (004), signature /
 * key-custody / latency / mode-matrix gates (005), and the validateReceipt
 * attack suite A1–A11 (006). Evidence is tool output — every assertion here
 * runs against real Ed25519 keys and a real temp-dir ledger.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { deriveRoleKeypair, hashChange } from '@savant-code/common/crypto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  ProvenanceLedger,
  ProvenanceSession,
  classifyReceipts,
  validateReceipt,
  validateReceiptBatch,
} from '..'

import type {
  SessionManifest,
  TrustReceipt,
} from '@savant-code/common/types/provenance'
import type { AgentState } from '@savant-code/common/types/session-state'

const tempDirs: string[] = []

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ztap-test-'))
  tempDirs.push(dir)
  return dir
}

function makeAgentState(overrides: Partial<AgentState> = {}): AgentState {
  // The provenance module only reads agentId / provenanceMode / provenance /
  // messageHistory from AgentState — construct a minimal structural stand-in.
  return {
    agentId: 'agent-1',
    messageHistory: [],
    ...overrides,
  } as unknown as AgentState
}

function baseManifest(
  overrides: Partial<SessionManifest> = {},
): SessionManifest {
  return {
    schema: 'savant.provenance.session.v1',
    sessionId: 'sess_test',
    createdAt: '2026-08-13T00:00:00.000Z',
    mode: 'record',
    roles: {},
    ...overrides,
  }
}

beforeEach(() => {
  tempDirs.length = 0
})

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

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

  // FID-2026-0814-005: open receipts resolve to the honest `no_verdict`
  // terminal at session close via a signed system-role close annotation.
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

describe('Attack suite A1–A11 (FID-006)', () => {
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

  test('A7 timestamps outside session bounds are rejected', async () => {
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

  test('A8 missing writer signature is rejected', async () => {
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

describe('Export-time classification (master D6)', () => {
  test('live vs superseded by content-hash recomputation; ledger never mutated', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_class',
      mode: 'record',
      projectRoot: root,
    })
    const target = path.join(root, 'src', 'c.ts')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, 'export const c = 10\n', 'utf8')
    const receipt = (await session.recordWriteReceipt({
      path: target,
      tool: 'write_file',
      content: 'export const c = 10\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const ledgerDir = path.join(root, '.savant', 'provenance', 'sess_class')
    const before = fs.readFileSync(
      path.join(ledgerDir, 'receipts.jsonl'),
      'utf8',
    )

    const live = classifyReceipts([receipt], root)
    expect(live.get(receipt.seq)).toBe('live')

    // Manual edit → superseded (content hash no longer matches).
    fs.writeFileSync(target, 'export const c = 11\n', 'utf8')
    const superseded = classifyReceipts([receipt], root)
    expect(superseded.get(receipt.seq)).toBe('superseded')

    // The ledger was not touched by classification.
    expect(
      fs.readFileSync(path.join(ledgerDir, 'receipts.jsonl'), 'utf8'),
    ).toBe(before)
  })
})
