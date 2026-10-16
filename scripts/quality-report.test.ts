import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import { SKILL_MAX_FILE_LINES } from '@savant-code/common/constants/skills'

import {
  collectQualityIssues,
  readQualityCeiling,
  type QualityBaseline,
} from './quality-report'

// FID-2026-1010-004: every case below calls `collectQualityIssues`, which walks
// the whole repository (every source root) on each invocation — measured at
// 1.8–10.3s per case depending on machine load, against bun's 5s default
// per-test timeout. On a loaded machine two cases timed out; on a quiet rerun a
// different case did (6.3s). No assertion failed in any run — the clock did.
// The ceiling is now explicit instead of inherited from a default sized for
// unit tests. Assertions are untouched.
const SCAN_TIMEOUT_MS = 30_000

function scanTest(name: string, body: () => void): void {
  it(name, body, SCAN_TIMEOUT_MS)
}

describe('quality ratchet', () => {
  // FID-2026-1016-013: the ceiling is tracked policy, not a baseline field.
  // The default second argument resolves it from protocol.config.yaml; every
  // case below passes it explicitly so the assertions stay hermetic instead
  // of depending on whatever value the tracked config carries today.
  scanTest(
    'resolves the default ceiling from tracked protocol.config.yaml',
    () => {
      const configPath = path.resolve(
        import.meta.dir,
        '..',
        'protocol.config.yaml',
      )
      const configured = fs
        .readFileSync(configPath, 'utf8')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.match(/^\s+max_file_lines:\s*(\S+)\s*$/)?.[1])
        .find((value): value is string => value !== undefined)

      expect(configured).toBeDefined()
      expect(readQualityCeiling()).toBe(Number(configured))

      // The local baseline no longer carries a ceiling of its own, so an
      // empty baseline against the real tree passes only if the configured
      // ceiling is the one being enforced.
      const baseline = JSON.parse(
        fs.readFileSync(
          path.resolve(import.meta.dir, '..', 'dev', 'quality-baseline.json'),
          'utf8',
        ),
      ) as QualityBaseline
      expect(baseline).not.toHaveProperty('maxFileLines')
      expect(
        collectQualityIssues(
          { ...baseline, trackedFiles: {} },
          readQualityCeiling(),
        ),
      ).toEqual([])
    },
  )

  // FID-2026-1016-013: skills:check holds a second copy of the ceiling because
  // `common` cannot read YAML at runtime. One policy number, two readers — so
  // the copy is pinned here instead of being trusted.
  it('the skill-document ceiling mirrors the tracked policy value', () => {
    expect(SKILL_MAX_FILE_LINES).toBe(readQualityCeiling())
  })

  scanTest(
    'enforces the absolute ceiling even when the historical baseline is higher',
    () => {
      const issues = collectQualityIssues(
        { trackedFiles: { 'scripts/quality-report.ts': 10_000 } },
        10,
      )

      expect(
        issues.some(
          (issue) =>
            issue.file === 'scripts/quality-report.ts' &&
            /^\d+ lines exceeds absolute maximum 10$/.test(issue.message),
        ),
      ).toBe(true)
    },
  )

  scanTest(
    'includes project-owned hidden source roots in the absolute check',
    () => {
      const issues = collectQualityIssues(
        { trackedFiles: { '.agents/types/tools.ts': 10_000 } },
        10,
      )

      expect(
        issues.some(
          (issue) =>
            issue.file === '.agents/types/tools.ts' &&
            /^\d+ lines exceeds absolute maximum 10$/.test(issue.message),
        ),
      ).toBe(true)
    },
  )

  scanTest(
    'excludes git-ignored build-output directories from the scan',
    () => {
      // FID-2026-0819-005 Loop 145: sdk/dist/*.d.ts is generated output, not
      // project-owned source; the walk must not count it.
      const issues = collectQualityIssues(
        { trackedFiles: { 'sdk/dist/index.d.ts': 10_000 } },
        10,
      )

      expect(issues.some((issue) => issue.file === 'sdk/dist/index.d.ts')).toBe(
        false,
      )
    },
  )

  // Operator ruling 2026-09-13: the per-file growth ratchet is removed —
  // under-cap files may grow freely; only the absolute ceiling fails.
  scanTest(
    'does NOT report growth of an under-cap file past its historical baseline',
    () => {
      const issues = collectQualityIssues(
        { trackedFiles: { 'scripts/quality-report.ts': 1 } },
        10_000,
      )

      expect(issues).toEqual([])
    },
  )

  scanTest(
    'reports an over-cap file at the absolute maximum even with a stale low baseline',
    () => {
      const issues = collectQualityIssues(
        { trackedFiles: { 'scripts/quality-report.ts': 1 } },
        10,
      )

      expect(
        issues.some(
          (issue) =>
            issue.file === 'scripts/quality-report.ts' &&
            /^\d+ lines exceeds absolute maximum 10$/.test(issue.message),
        ),
      ).toBe(true)
    },
  )

  scanTest('rejects the unsupported approvedGrowth field', () => {
    const legacyBaseline = JSON.parse(
      '{"trackedFiles":{},"approvedGrowth":{}}',
    ) as QualityBaseline
    const issues = collectQualityIssues(legacyBaseline, 400)

    expect(issues).toContainEqual({
      file: 'dev/quality-baseline.json',
      message: 'approvedGrowth is not supported; remove the exemption field',
    })
  })

  // FID-2026-0819-005 (operator decision): data-constant exemptions.
  scanTest(
    'exempts a rationaled data constant from the absolute ceiling but keeps it growth-frozen',
    () => {
      // scripts/quality-report.ts really exists (~175 lines) and is scanned;
      // the pin below its actual size proves growth-freezing still fires.
      const issues = collectQualityIssues(
        {
          trackedFiles: { 'scripts/quality-report.ts': 10 },
          dataConstantExemptions: {
            'scripts/quality-report.ts': 'generated data payload',
          },
        },
        10,
      )

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
    },
  )

  scanTest(
    'fails a data-constant exemption whose file no longer exists',
    () => {
      const issues = collectQualityIssues(
        {
          trackedFiles: {},
          dataConstantExemptions: {
            'common/src/constants/deleted.ts': 'gone',
          },
        },
        400,
      )

      expect(issues).toContainEqual({
        file: 'common/src/constants/deleted.ts',
        message:
          'stale dataConstantExemptions entry: file is missing from the source tree',
      })
    },
  )

  scanTest('fails a data-constant exemption that is no longer needed', () => {
    const issues = collectQualityIssues(
      {
        trackedFiles: {},
        dataConstantExemptions: {
          'scripts/quality-report.ts': 'under ceiling now',
        },
      },
      400,
    )

    expect(
      issues.some(
        (issue) =>
          issue.file === 'scripts/quality-report.ts' &&
          issue.message.startsWith('unnecessary dataConstantExemptions entry:'),
      ),
    ).toBe(true)
  })

  scanTest('fails a data-constant exemption with an empty rationale', () => {
    const issues = collectQualityIssues(
      {
        trackedFiles: {},
        dataConstantExemptions: {
          'scripts/quality-report.ts': '   ',
        },
      },
      400,
    )

    expect(issues).toContainEqual({
      file: 'scripts/quality-report.ts',
      message: 'dataConstantExemptions entry has an empty rationale',
    })
  })
})
