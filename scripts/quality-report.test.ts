import { describe, expect, it } from 'bun:test'

import { collectQualityIssues, type QualityBaseline } from './quality-report'

describe('quality ratchet', () => {
  it('enforces the absolute ceiling even when the historical baseline is higher', () => {
    const issues = collectQualityIssues({
      maxFileLines: 10,
      trackedFiles: { 'scripts/quality-report.ts': 10_000 },
    })

    expect(
      issues.some(
        (issue) =>
          issue.file === 'scripts/quality-report.ts' &&
          /^\d+ lines exceeds absolute maximum 10$/.test(issue.message),
      ),
    ).toBe(true)
  })

  it('includes project-owned hidden source roots in the absolute check', () => {
    const issues = collectQualityIssues({
      maxFileLines: 10,
      trackedFiles: { '.agents/types/tools.ts': 10_000 },
    })

    expect(
      issues.some(
        (issue) =>
          issue.file === '.agents/types/tools.ts' &&
          /^\d+ lines exceeds absolute maximum 10$/.test(issue.message),
      ),
    ).toBe(true)
  })

  it('reports ratchet growth below the absolute ceiling', () => {
    const issues = collectQualityIssues({
      maxFileLines: 10_000,
      trackedFiles: { 'scripts/quality-report.ts': 1 },
    })

    expect(
      issues.some(
        (issue) =>
          issue.file === 'scripts/quality-report.ts' &&
          /^\d+ lines exceeds baseline 1$/.test(issue.message),
      ),
    ).toBe(true)
  })

  it('rejects the unsupported approvedGrowth field', () => {
    const legacyBaseline = JSON.parse(
      '{"maxFileLines":300,"trackedFiles":{},"approvedGrowth":{}}',
    ) as QualityBaseline
    const issues = collectQualityIssues(legacyBaseline)

    expect(issues).toContainEqual({
      file: 'dev/quality-baseline.json',
      message: 'approvedGrowth is not supported; remove the exemption field',
    })
  })
})
