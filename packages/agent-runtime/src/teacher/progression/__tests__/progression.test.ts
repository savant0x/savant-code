import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  deriveRoleKeypair,
  fromBase64Url,
  jcsCanonicalize,
  verifyPayload,
} from '@savant-code/common/crypto'
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  adaptAttemptReceipt,
  buildProgressionRecord,
  ProgressionStore,
} from '../index'

import type {
  AttemptResult,
  CompetencyEdge,
  ProgressionRecord,
  PublicChallenge,
} from '@savant-code/common/teacher'

let tempDir: string
let dbPath: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-progression-'))
  dbPath = path.join(tempDir, 'progression.sqlite')
})

afterEach(() => {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // Windows may hold WAL/SHM handles briefly; cleanup is best-effort.
  }
})

function record(overrides: Partial<ProgressionRecord> = {}): ProgressionRecord {
  return {
    attemptId: 'attempt-1',
    challengeId: 'vs-max',
    challengeHash: `sha256:${'a'.repeat(64)}`,
    skill: 'behavioral-invariants',
    completionState: 'passed',
    evidenceHashes: {
      submissionHash: `sha256:${'b'.repeat(64)}`,
      sandboxResultHash: `sha256:${'c'.repeat(64)}`,
      equivalenceHash: `sha256:${'d'.repeat(64)}`,
      detectionHash: `sha256:${'e'.repeat(64)}`,
    },
    versions: { corpus: '1', sandboxPolicy: 'p', grader: 'g', mutation: 'm' },
    timestamp: '2026-08-13T12:00:00.000Z',
    receiptStatus: 'local-unverified',
    receipt: null,
    ...overrides,
  }
}
describe('progression store', () => {
  test('migrates a fresh store and reopens with the same records', () => {
    const store = ProgressionStore.open(dbPath)
    expect(store.recordAttempt(record())).toBe(true)
    store.close()

    const reopened = ProgressionStore.open(dbPath)
    const attempt = reopened.getAttempt('attempt-1')
    expect(attempt).not.toBeNull()
    expect(attempt?.challengeId).toBe('vs-max')
    expect(attempt?.completionState).toBe('passed')
    reopened.close()
  })

  test('attempt records are idempotent (duplicate insert is a no-op)', () => {
    const store = ProgressionStore.open(dbPath)
    expect(store.recordAttempt(record())).toBe(true)
    expect(store.recordAttempt(record())).toBe(false)
    expect(store.listAttempts()).toHaveLength(1)
    store.close()
  })

  test('lists attempts filtered by skill', () => {
    const store = ProgressionStore.open(dbPath)
    store.recordAttempt(record({ attemptId: 'a1', skill: 'bi' }))
    store.recordAttempt(record({ attemptId: 'a2', skill: 'complexity' }))
    expect(store.listAttempts('bi')).toHaveLength(1)
    expect(store.listAttempts()).toHaveLength(2)
    store.close()
  })

  test('upserts and reads competency edges', () => {
    const store = ProgressionStore.open(dbPath)
    const edge: CompetencyEdge = {
      skill: 'bi',
      state: 'completed',
      evidence: ['attempt-1'],
    }
    store.upsertCompetency(edge)
    expect(store.getCompetency('bi')?.state).toBe('completed')

    store.upsertCompetency({
      skill: 'bi',
      state: 'transferred',
      evidence: ['attempt-1', 'attempt-2'],
    })
    const updated = store.getCompetency('bi')
    expect(updated?.state).toBe('transferred')
    expect(updated?.evidence).toHaveLength(2)
    store.close()
  })

  test('corrupt rows fail safe on read and are skipped on list', () => {
    const store = ProgressionStore.open(dbPath)
    store.recordAttempt(record())
    store.close()

    const raw = new Database(dbPath)
    raw
      .prepare(
        "UPDATE attempts SET evidence_json = '{not json' WHERE attempt_id = ?",
      )
      .run('attempt-1')
    raw.close()

    const reopened = ProgressionStore.open(dbPath)
    expect(reopened.getAttempt('attempt-1')).toBeNull()
    expect(reopened.listAttempts()).toEqual([])
    reopened.close()
  })

  test('refuses to open a store newer than this build (downgrade guard)', () => {
    const store = ProgressionStore.open(dbPath)
    store.close()

    const raw = new Database(dbPath)
    raw
      .prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (99)')
      .run()
    raw.close()

    expect(() => ProgressionStore.open(dbPath)).toThrow(/newer than supported/)
  })

  test('stores only redacted evidence — no source, prompt, or critique text', () => {
    const store = ProgressionStore.open(dbPath)
    const secret = 'the learner wrote this secret critique'
    store.recordAttempt(record())
    const attempt = store.getAttempt('attempt-1')
    const serialized = JSON.stringify(attempt)
    expect(serialized).not.toContain(secret)
    // The record's keys are bounded to hashes + versions + ids + state.
    expect(Object.keys(attempt as object).sort()).toEqual([
      'attemptId',
      'challengeHash',
      'challengeId',
      'completionState',
      'evidenceHashes',
      'receipt',
      'receiptStatus',
      'skill',
      'timestamp',
      'versions',
    ])
    store.close()
  })
})

const RESULT: AttemptResult = {
  attemptId: 'a-9',
  challengeHash: `sha256:${'f'.repeat(64)}`,
  corpusVersion: '1.0.0',
  sandboxPolicyVersion: 'teacher-sandbox-policy-v1',
  graderVersion: 'teacher-grading-v1',
  equivalenceResult: {
    passed: true,
    testSummary: { total: 3, passed: 3, failed: 0, failedNames: [] },
    antiCheat: { passed: true, findings: [] },
    graderVersion: 'equivalence-v1',
  },
  detectionResult: {
    mutationId: 'max-lt-flip',
    grade: {
      mutationId: 'max-lt-flip',
      identified: true,
      evidenceCoverage: { location: true, witness: true, impact: true },
      locationMatch: true,
      witnessMatch: true,
      impactMatch: true,
      confidence: 1,
      reasonCode: 'identified',
      graderVersion: 'detection-v1',
    },
    graderVersion: 'detection-v1',
  },
  evidenceHashes: {
    submissionHash: `sha256:${'1'.repeat(64)}`,
    sandboxResultHash: `sha256:${'2'.repeat(64)}`,
    equivalenceHash: `sha256:${'3'.repeat(64)}`,
    detectionHash: `sha256:${'4'.repeat(64)}`,
  },
  completionState: 'passed',
  timestamp: '2026-08-13T12:00:00.000Z',
}

const CHALLENGE: PublicChallenge = {
  id: 'vs-max',
  version: 1,
  skill: 'behavioral-invariants',
  objective: 'max',
  prompt: 'max',
  visibleGuidance: 'max',
  inputContract: { signature: 'max', examples: [] },
  outputContract: { description: 'max', examples: [] },
  limits: { timeLimitMs: 200, maxOutputBytes: 1024 },
  prerequisites: [],
  challengeHash: RESULT.challengeHash,
}

describe('ZTAP progression adapter', () => {
  test('signs process evidence and falls back honestly without a key', async () => {
    const seed = new Uint8Array(32)
    crypto.getRandomValues(seed)
    const keypair = await deriveRoleKeypair(seed, 'sess-1', 'teacher')

    const signed = adaptAttemptReceipt(RESULT, CHALLENGE, keypair)
    expect(signed).not.toBeNull()
    expect(signed?.over).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(signed?.sig).toBeTruthy()

    // The receipt is independently verifiable from its public key + evidence.
    const publicKey = fromBase64Url(signed!.publicKey)
    expect(publicKey).not.toBeNull()
    expect(
      verifyPayload(
        publicKey!,
        { kind: 'jcs', canonical: jcsCanonicalize(signed!.evidence) },
        signed!.sig,
        signed!.over,
      ),
    ).toBe(true)

    expect(adaptAttemptReceipt(RESULT, CHALLENGE, null)).toBeNull()
  })

  test('buildProgressionRecord maps engine results with version metadata', () => {
    const progression = buildProgressionRecord(RESULT, CHALLENGE, null)
    expect(progression.challengeId).toBe('vs-max')
    expect(progression.skill).toBe('behavioral-invariants')
    expect(progression.versions.mutation).toBe('detection-v1')
    expect(progression.versions.sandboxPolicy).toBe('teacher-sandbox-policy-v1')
    expect(progression.receiptStatus).toBe('local-unverified')
    expect(progression.receipt).toBeNull()
  })
})
