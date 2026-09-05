import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { deriveCompetencyEdge } from '../index'

import type {
  CompetencyEdge,
  ProgressionRecord,
} from '@savant-code/common/teacher'

// FID-2026-0819-005 Loop 162: competency-edge derivation + no-network audit
// suites split verbatim from progression.test.ts (shared record() helper
// inlined below).

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

describe('competency edge derivation', () => {
  test('passed attempt marks the skill completed with its attempt id', () => {
    const edge = deriveCompetencyEdge(record(), null)
    expect(edge).not.toBeNull()
    expect(edge?.state).toBe('completed')
    expect(edge?.evidence).toEqual(['attempt-1'])
  })

  test('failed attempt marks attempted and never downgrades a completed edge', () => {
    const failed = deriveCompetencyEdge(
      record({ completionState: 'failed' }),
      null,
    )
    expect(failed?.state).toBe('attempted')

    const completedExisting: CompetencyEdge = {
      skill: 'behavioral-invariants',
      state: 'completed',
      evidence: ['prior'],
    }
    const downgrade = deriveCompetencyEdge(
      record({ completionState: 'failed' }),
      completedExisting,
    )
    expect(downgrade?.state).toBe('completed')
    expect(downgrade?.evidence).toEqual(['prior', 'attempt-1'])
  })

  test('unavailable and cancelled award no progression', () => {
    expect(
      deriveCompetencyEdge(record({ completionState: 'unavailable' }), null),
    ).toBeNull()
    expect(
      deriveCompetencyEdge(record({ completionState: 'cancelled' }), null),
    ).toBeNull()
  })

  test('evidence is deduplicated on idempotent replay', () => {
    const existing: CompetencyEdge = {
      skill: 'behavioral-invariants',
      state: 'attempted',
      evidence: ['attempt-1'],
    }
    const edge = deriveCompetencyEdge(record(), existing)
    expect(edge?.evidence).toEqual(['attempt-1'])
  })
})

describe('progression store no-network audit (FID-2026-0813-019)', () => {
  test('store module has no network import or fetch path', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../store.ts'),
      'utf8',
    )
    expect(source).not.toContain('fetch')
    expect(source).not.toContain('http')
    expect(source).not.toContain('WebSocket')
    expect(source).toContain('bun:sqlite')
  })
})
