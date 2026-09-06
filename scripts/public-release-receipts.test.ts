// Public release contract — release receipts, resume validation, and
// transcript evidence. Sibling of the FID-2026-0819-005 Loop 317 decomposition.

import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  buildDiagnosticReceipt,
  finalizeSuccessfulReleaseReceipt,
  redactReceipt,
  sha256Text,
  validateResumeReceipt,
} from './public-release'

describe('public release contract — receipts & evidence', () => {
  test('clears historical failure text during successful receipt finalization', () => {
    const receipt = {
      version: '0.0.21',
      mode: 'automation' as const,
      completedStages: ['GITHUB_RELEASE'],
      failedStage: 'transient npm registry propagation',
      restored: true,
      receiptPath: '/tmp/receipt.json',
    }
    finalizeSuccessfulReleaseReceipt(receipt)
    expect(receipt.failedStage).toBeUndefined()

    const serialized = redactReceipt({
      ...receipt,
      completedStages: [...receipt.completedStages, 'POST_RELEASE_VERIFY'],
    })
    expect(serialized).not.toContain('failedStage')
    expect(serialized).toContain('POST_RELEASE_VERIFY')
  })

  test('redacts credentials from receipt failure details', () => {
    const receipt = redactReceipt({
      version: '0.0.21',
      mode: 'publish',
      schemaVersion: 'release-receipt/v2',
      completedStages: ['PREFLIGHT'],
      failedStage:
        'OPENROUTER_API_KEY=secret-or-key GITHUB_TOKEN:ghs_secret NPM_TOKEN=npm_secret Authorization: Bearer bearer-secret AUTHORIZATION: basic Z2l0LXNlY3JldA==',
      restored: true,
      receiptPath: '/tmp/receipt.json',
    })

    expect(receipt).toContain('PREFLIGHT')
    expect(receipt).toContain('[REDACTED]')
    expect(receipt).not.toContain('secret-or-key')
    expect(receipt).not.toContain('ghs_secret')
    expect(receipt).not.toContain('npm_secret')
    expect(receipt).not.toContain('bearer-secret')
    expect(receipt).not.toContain('Z2l0LXNlY3JldA==')
  })

  test('receipt round-trip preserves the desktop skip flag (FID-2026-0906-002)', () => {
    const serialized = redactReceipt({
      version: '0.0.21',
      mode: 'publish',
      schemaVersion: 'release-receipt/v2',
      completedStages: ['POST_RELEASE_VERIFY'],
      desktopStagesSkipped: true,
      desktopStagesSkipReason:
        'SAVANT_CODE_RELEASE_DESKTOP not set — desktop stages did not run.',
      restored: true,
      receiptPath: '/tmp/receipt.json',
    })
    expect(serialized).toContain('desktopStagesSkipped')
    expect(serialized).toContain('desktopStagesSkipReason')
    expect(serialized).toContain('SAVANT_CODE_RELEASE_DESKTOP not set')
  })

  test('rejects completed gate evidence without an explicit HEAD binding', () => {
    const receipt = {
      schemaVersion: 'release-receipt/v2' as const,
      version: '0.0.21' as const,
      mode: 'publish' as const,
      headSha: 'a'.repeat(40),
      completedStages: ['GATES_AND_PACKAGE_DRY_RUNS'],
      restored: true,
      receiptPath: '/tmp/receipt.json',
      gateManifestHash: 'b'.repeat(64),
      gateAttempts: [],
      evidenceFinalized: true,
    }
    expect(() =>
      validateResumeReceipt('0.0.21', receipt, receipt.receiptPath),
    ).toThrow('incomplete gate evidence')
  })

  test('rejects tampered or missing transcript evidence before resume', () => {
    const transcriptPath = path.join(
      mkdtempSync(path.join(os.tmpdir(), 'savant-release-transcript-')),
      'gate.log',
    )
    try {
      writeFileSync(transcriptPath, 'original transcript')
      const receipt = {
        schemaVersion: 'release-receipt/v2' as const,
        version: '0.0.21' as const,
        mode: 'publish' as const,
        headSha: 'a'.repeat(40),
        completedStages: ['GATES_AND_PACKAGE_DRY_RUNS'],
        restored: true,
        receiptPath: '/tmp/receipt.json',
        gateManifestHash: 'b'.repeat(64),
        evidenceHeadSha: 'a'.repeat(40),
        gateAttempts: [
          {
            label: 'test',
            command: 'bun',
            args: ['run', 'test'],
            cwd: '/repo',
            attempt: 1,
            failureClass: 'success' as const,
            status: 0,
            signal: null,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 1,
            transcriptPath,
            transcriptSha256: sha256Text('different transcript'),
            transcriptFinalized: true,
            summary: '',
          },
        ],
        evidenceFinalized: true,
      }
      expect(() =>
        validateResumeReceipt('0.0.21', receipt, receipt.receiptPath),
      ).toThrow('hash mismatch')
      writeFileSync(transcriptPath, 'original transcript')
      receipt.gateAttempts[0].transcriptSha256 = sha256Text(
        'original transcript',
      )
      expect(
        validateResumeReceipt('0.0.21', receipt, receipt.receiptPath)
          .gateAttempts?.[0]?.transcriptFinalized,
      ).toBe(true)
      rmSync(transcriptPath)
      expect(() =>
        validateResumeReceipt('0.0.21', receipt, receipt.receiptPath),
      ).toThrow('transcript is missing')
    } finally {
      rmSync(path.dirname(transcriptPath), { recursive: true, force: true })
    }
  })

  test('rejects unsafe resume receipts and accepts a restored, HEAD-bound receipt', () => {
    const validReceipt = {
      version: '0.0.21' as const,
      schemaVersion: 'release-receipt/v2' as const,
      mode: 'publish' as const,
      headSha: 'a'.repeat(40),
      completedStages: ['GIT_PUSH'],
      restored: true,
      receiptPath: '/tmp/receipt.json',
    }

    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, schemaVersion: undefined },
        validReceipt.receiptPath,
      ),
    ).toThrow('incompatible')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, restored: false },
        validReceipt.receiptPath,
      ),
    ).toThrow('did not confirm local-state restoration')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, headSha: undefined },
        validReceipt.receiptPath,
      ),
    ).toThrow('no commit binding')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, headSha: 'not-a-sha' },
        validReceipt.receiptPath,
      ),
    ).toThrow('invalid commit binding')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        { ...validReceipt, completedStages: ['GIT_PUSH', 'GIT_PUSH'] },
        validReceipt.receiptPath,
      ),
    ).toThrow('invalid or duplicate stages')
    expect(() =>
      validateResumeReceipt(
        '0.0.21',
        validReceipt,
        validReceipt.receiptPath,
        'automation',
      ),
    ).toThrow('incompatible')
    expect(
      validateResumeReceipt('0.0.21', validReceipt, validReceipt.receiptPath)
        .headSha,
    ).toBe('a'.repeat(40))
  })

  test('builds diagnostic receipts that fail closed and record ignored deltas', () => {
    const headSha = 'a'.repeat(40)
    const failed = buildDiagnosticReceipt(
      '0.0.21',
      undefined,
      'boom',
      undefined,
    )
    expect(failed.completedStages).toEqual([])
    expect(failed.failedStage).toBe('boom')
    expect(failed.evidenceFinalized).toBe(false)

    const attempt = {
      label: 'test',
      command: 'bun',
      args: ['run', 'test'],
      cwd: '/repo',
      attempt: 1,
      failureClass: 'success' as const,
      status: 0,
      signal: null,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 1,
      transcriptPath: '/tmp/gate.log',
      transcriptSha256: 'hash',
      transcriptFinalized: true,
      summary: '',
    }
    const passed = buildDiagnosticReceipt(
      '0.0.21',
      { manifestHash: 'm', attempts: [attempt], passed: true, headSha },
      undefined,
      { added: ['!! cli/debug/'], removed: [] },
    )
    expect(passed.completedStages).toEqual(['GATES_AND_PACKAGE_DRY_RUNS'])
    expect(passed.evidenceFinalized).toBe(true)
    expect(passed.ignoredChanges?.added).toEqual(['!! cli/debug/'])
    expect(passed.evidenceHeadSha).toBe(headSha)
  })
})
