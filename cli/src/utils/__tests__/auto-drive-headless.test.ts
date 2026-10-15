import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

import { serializeDrivePlanDirective } from '@savant-code/common/util/drive-directives'
import { afterAll, describe, expect, it } from 'bun:test'

import {
  buildPlanOnlyPrompt,
  buildReviewedPlanLockPrompt,
  buildUpfrontTrustLockPrompt,
  completionExitCode,
  openFidIds,
  runHeadlessAutoDrive,
  scanActiveFids,
  writeCompletionReport,
} from '../auto-drive-headless'

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'auto-drive-headless-'))
afterAll(() => {
  // Best-effort cleanup; bun test temp dirs are also OS-reaped.
})

function writeFid(root: string, name: string, status: string): void {
  const dir = path.join(root, 'dev', 'fids')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    path.join(dir, name),
    `**Status:** ${status}\n\n# ${name}\n`,
    'utf8',
  )
}

describe('drive-lock prompt builders', () => {
  it('buildPlanOnlyPrompt uses the shared Auto Drive plan prompt', () => {
    const prompt = buildPlanOnlyPrompt('fix the thing', undefined)
    expect(prompt).toContain('pre-build plan')
    expect(prompt).toContain('fix the thing')
  })

  it('buildReviewedPlanLockPrompt wraps a reviewed plan into a drive-lock', () => {
    const plan = serializeDrivePlanDirective({
      goal: 'ship the feature',
      plan: 'do the work',
      acceptanceCriteria: ['tests pass'],
      resolutionPolicy: 'never ask',
    })
    const lock = buildReviewedPlanLockPrompt(plan)
    expect(lock).not.toBeNull()
    expect(lock).toContain('<drive-lock')
    expect(lock).toContain('do the work')
  })

  it('buildReviewedPlanLockPrompt returns null without a directive', () => {
    expect(buildReviewedPlanLockPrompt('no directive here')).toBeNull()
  })

  it('buildUpfrontTrustLockPrompt locks an empty acceptance-criteria drive', () => {
    const lock = buildUpfrontTrustLockPrompt('goal text')
    expect(lock).toContain('<drive-lock')
    expect(lock).toContain('goal text')
  })
})

describe('completion certificate', () => {
  it('scanActiveFids returns every active FID with its status', () => {
    writeFid(tmpRoot, 'FID-2026-0818-001-open.md', 'analyzed')
    writeFid(tmpRoot, 'FID-2026-0818-002-done.md', 'closed')
    const fids = scanActiveFids(tmpRoot)
    expect(fids.map((f) => f.status).sort()).toEqual(['analyzed', 'closed'])
  })

  it('openFidIds returns only non-closed FIDs', () => {
    const open = openFidIds([
      { id: 'FID-2026-0818-001', status: 'analyzed' },
      { id: 'FID-2026-0818-002', status: 'closed' },
    ])
    expect(open).toEqual(['FID-2026-0818-001'])
  })

  it('completionExitCode is 0 only on zero open FIDs', () => {
    expect(completionExitCode([])).toBe(0)
    expect(completionExitCode(['FID-2026-0818-001'])).toBe(1)
  })

  it('writeCompletionReport writes a report to dev/exports/', () => {
    const reportPath = writeCompletionReport(tmpRoot, {
      goal: 'g',
      approvalMode: 'upfront-trust',
      openIds: [],
      exitCode: 0,
      output: 'done',
    })
    const content = readFileSync(reportPath, 'utf8')
    expect(content).toContain('Auto Drive Completion Report')
    expect(content).toContain('none (certified)')
  })
})

describe('runHeadlessAutoDrive fail-closed gates (no SDK)', () => {
  it('rejects an underspecified goal before any work (exit 2)', async () => {
    const result = await runHeadlessAutoDrive({
      goal: 'fix it',
      approve: true,
      planOnly: false,
      continueChat: false,
      projectRoot: tmpRoot,
    })
    expect(result.exitCode).toBe(2)
    expect(result.error).toContain('--spec')
  })

  it('rejects execution without an approval signal (exit 2)', async () => {
    const result = await runHeadlessAutoDrive({
      goal: 'g'.repeat(80),
      approve: false,
      planOnly: false,
      continueChat: false,
      projectRoot: tmpRoot,
    })
    expect(result.exitCode).toBe(2)
    expect(result.error).toContain('--approve')
  })
})
