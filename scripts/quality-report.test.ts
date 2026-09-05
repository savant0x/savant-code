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

  it('excludes git-ignored build-output directories from the scan', () => {
    // FID-2026-0819-005 Loop 145: sdk/dist/*.d.ts is generated output, not
    // project-owned source; the walk must not count it.
    const issues = collectQualityIssues({
      maxFileLines: 10,
      trackedFiles: { 'sdk/dist/index.d.ts': 10_000 },
    })

    expect(issues.some((issue) => issue.file === 'sdk/dist/index.d.ts')).toBe(
      false,
    )
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

  // FID-2026-0819-005 (operator decision): data-constant exemptions.
  it('exempts a rationaled data constant from the absolute ceiling but keeps it growth-frozen', () => {
    // scripts/quality-report.ts really exists (~175 lines) and is scanned;
    // the pin below its actual size proves growth-freezing still fires.
    const issues = collectQualityIssues({
      maxFileLines: 10,
      trackedFiles: { 'scripts/quality-report.ts': 10 },
      dataConstantExemptions: {
        'scripts/quality-report.ts': 'generated data payload',
      },
    })

    // No absolute-ceiling violation for the exempt file.
    expect(
      issues.some(
        (issue) =>
          issue.file === 'scripts/quality-report.ts' &&
          issue.message.includes('absolute maximum'),
      ),
    ).toBe(false)
    // But growth past the pinned baseline still fails the ratchet.
    expect(
      issues.some(
        (issue) =>
          issue.file === 'scripts/quality-report.ts' &&
          /^\d+ lines exceeds baseline 10$/.test(issue.message),
      ),
    ).toBe(true)
  })

  it('fails a data-constant exemption whose file no longer exists', () => {
    const issues = collectQualityIssues({
      maxFileLines: 300,
      trackedFiles: {},
      dataConstantExemptions: {
        'common/src/constants/deleted.ts': 'gone',
      },
    })

    expect(issues).toContainEqual({
      file: 'common/src/constants/deleted.ts',
      message:
        'stale dataConstantExemptions entry: file is missing from the source tree',
    })
  })

  it('fails a data-constant exemption that is no longer needed', () => {
    const issues = collectQualityIssues({
      maxFileLines: 300,
      trackedFiles: {},
      dataConstantExemptions: {
        'scripts/quality-report.ts': 'under ceiling now',
      },
    })

    expect(
      issues.some(
        (issue) =>
          issue.file === 'scripts/quality-report.ts' &&
          issue.message.startsWith('unnecessary dataConstantExemptions entry:'),
      ),
    ).toBe(true)
  })

  it('fails a data-constant exemption with an empty rationale', () => {
    const issues = collectQualityIssues({
      maxFileLines: 300,
      trackedFiles: {},
      dataConstantExemptions: {
        'scripts/quality-report.ts': '   ',
      },
    })

    expect(issues).toContainEqual({
      file: 'scripts/quality-report.ts',
      message: 'dataConstantExemptions entry has an empty rationale',
    })
  })
})
