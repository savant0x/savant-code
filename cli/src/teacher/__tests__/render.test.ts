import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { completionLabel, progressionLine, receiptLine } from '../render'

const HASH = `sha256:${'0'.repeat(64)}`

describe('shared teacher render helpers (FID-2026-0813-022)', () => {
  test('completionLabel maps every terminal state', () => {
    expect(completionLabel('passed')).toBe('✓ PASSED')
    expect(completionLabel('failed')).toBe('✗ FAILED')
    expect(completionLabel('unavailable')).toContain('UNAVAILABLE')
    expect(completionLabel('cancelled')).toBe('· CANCELLED')
  })

  test('receiptLine distinguishes signed from local-unverified', () => {
    expect(receiptLine(null)).toContain('local-unverified')
    expect(
      receiptLine({
        schema: 'savant.teacher.attempt-receipt.v1',
        role: 'teacher',
        publicKey: 'cHVibGlj',
        over: HASH,
        sig: 'c2ln',
        evidence: {
          attemptId: 'attempt-1',
          challengeHash: HASH,
          completionState: 'passed',
          evidenceHashes: {
            submissionHash: HASH,
            sandboxResultHash: HASH,
            equivalenceHash: HASH,
            detectionHash: HASH,
          },
          versions: {
            corpus: '1',
            sandboxPolicy: 'teacher-sandbox-policy-v1',
            grader: 'teacher-grading-v1',
            mutation: 'detection-v1',
          },
          timestamp: '2026-08-13T00:00:00.000Z',
        },
      }),
    ).toBe(`ZTAP receipt: signed by teacher over ${HASH}`)
  })

  test('progressionLine reports recorded vs not recorded', () => {
    expect(progressionLine(false, null)).toBe('Progression: not recorded')
    expect(progressionLine(true, 'completed')).toBe(
      'Progression: recorded (competency completed)',
    )
    expect(progressionLine(true, null)).toBe(
      'Progression: recorded (competency attempted)',
    )
  })

  test('render module is pure (no fs/child_process/store/dynamic import)', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../render.ts'),
      'utf8',
    )
    expect(source).not.toContain('node:fs')
    expect(source).not.toContain('node:child_process')
    expect(source).not.toContain('node:path')
    expect(source).not.toContain('node:crypto')
    expect(source).not.toContain('import(')
    expect(source).not.toContain('useChatStore')
  })
})
