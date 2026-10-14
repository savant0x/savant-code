// FID-2026-1013-012 W3-1 — eslint-disable rationale audit tests.
//
// Positive fixtures pin every rationale-free directive shape that shipped in
// the 15-directive sweep (line comments and block comments); negatives pin the
// rationale form, the multi-line block comment, the `eslint-enable` counterpart
// (which removes a suppression and needs no rationale), and the string-literal
// false positive (`'eslint-disable-next-line'` as data is not a directive).
// The collector is pinned through an injected git runner, and the live tree is
// pinned to stay clean.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  auditEslintDisableRationale,
  collectAuditedSourceFiles,
  detectRationaleFreeDirectives,
  isAuditedSourceFile,
  type SourceLines,
} from '../audit-eslint-disable-rationale'

function source(...entries: string[]): SourceLines {
  return { file: 'fixture.ts', lines: entries }
}

const repoRoot = path.resolve(import.meta.dir, '..', '..')

describe('detectRationaleFreeDirectives (FID-2026-1013-012 W3-1)', () => {
  test('flags a next-line directive with no rationale', () => {
    const issues = detectRationaleFreeDirectives(
      source('const value = 1', '// eslint-disable-next-line no-console'),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].file).toBe('fixture.ts')
    expect(issues[0].line).toBe(2)
    expect(issues[0].message).toContain('-- <rationale>')
  })

  test('flags a block directive with no rationale', () => {
    const issues = detectRationaleFreeDirectives(
      source('/* eslint-disable @typescript-eslint/no-explicit-any */'),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].line).toBe(1)
  })

  test('flags a bare rule-scope disable directive', () => {
    const issues = detectRationaleFreeDirectives(source('/* eslint-disable */'))
    expect(issues).toHaveLength(1)
  })

  test('accepts the rationale form on line and block comments', () => {
    const issues = detectRationaleFreeDirectives(
      source(
        '// eslint-disable-next-line no-console -- dev-only telemetry',
        '/* eslint-disable no-console -- the seam’s default sink IS the console */',
        '// eslint-disable-line no-console -- one diagnostic per mount (MQ-9)',
      ),
    )
    expect(issues).toEqual([])
  })

  test('accepts a multi-line block comment whose rationale is on a later line', () => {
    const issues = detectRationaleFreeDirectives(
      source(
        '/* eslint-disable no-console',
        '   -- structured hosts inject their own Logger (rationale-comment rule) */',
      ),
    )
    expect(issues).toEqual([])
  })

  test('does not treat eslint-enable or string data as directives', () => {
    const issues = detectRationaleFreeDirectives(
      source(
        '// eslint-enable no-console',
        "const text = 'eslint-disable-next-line no-console'",
        'const auditName = "audit-eslint-disable-rationale"',
      ),
    )
    expect(issues).toEqual([])
  })

  test('reports each directive once, in file order', () => {
    const issues = detectRationaleFreeDirectives(
      source(
        '// eslint-disable-next-line no-console',
        'const ok = 1',
        '/* eslint-disable @typescript-eslint/no-explicit-any */',
        '// eslint-disable-next-line no-console -- justified',
      ),
    )
    expect(issues.map((issue) => issue.line)).toEqual([1, 3])
  })
})

describe('collectAuditedSourceFiles (FID-2026-1013-012 W3-1)', () => {
  const runnerFor =
    (stdout: string, status = 0) =>
    () => ({
      status,
      stdout,
      stderr: status === 0 ? '' : 'fatal: not a git repository',
    })

  test('keeps tracked non-test source and drops excluded paths', () => {
    const { files, error } = collectAuditedSourceFiles(
      repoRoot,
      runnerFor(
        [
          'cli/src/index.tsx',
          'desktop/src/x.test.ts',
          'cli/src/__tests__/y.ts',
          'node_modules/pkg/z.ts',
          'packages/agent-runtime/dist/generated.ts',
          'common/src/params.generated.ts',
          'dev/test-prompts/a.ts',
          'scripts/audit-eslint-disable-rationale.ts',
          '',
        ].join('\n'),
      ),
    )
    expect(error).toBeUndefined()
    expect(files).toEqual([
      'cli/src/index.tsx',
      'scripts/audit-eslint-disable-rationale.ts',
    ])
  })

  test('fails closed when git cannot list the tree', () => {
    const { files, error } = collectAuditedSourceFiles(
      repoRoot,
      runnerFor('', 1),
    )
    expect(files).toEqual([])
    expect(error).toContain('git ls-files exit 1')
    const issues = auditEslintDisableRationale(repoRoot, runnerFor('', 1))
    expect(issues).toHaveLength(1)
    expect(issues[0].file).toBe('(audited sources)')
    expect(issues[0].message).toContain('git ls-files exit 1')
  })

  test('reports a rationale-free directive in a probe file it is told about', () => {
    const probePath = path.join(repoRoot, 'scripts', '__rationale-pin-probe.ts')
    fs.writeFileSync(
      probePath,
      ['const value = 1', '// eslint-disable-next-line no-console', ''].join(
        '\n',
      ),
    )
    try {
      const issues = auditEslintDisableRationale(
        repoRoot,
        runnerFor('scripts/__rationale-pin-probe.ts\n'),
      )
      expect(issues).toHaveLength(1)
      expect(issues[0].file).toBe('scripts/__rationale-pin-probe.ts')
      expect(issues[0].line).toBe(2)
    } finally {
      fs.rmSync(probePath, { force: true })
    }
  })
})

describe('isAuditedSourceFile (FID-2026-1013-012 W3-1)', () => {
  test('covers tracked non-test .ts/.tsx and refuses the excluded surfaces', () => {
    expect(isAuditedSourceFile('common/src/types/contracts/client.ts')).toBe(
      true,
    )
    expect(isAuditedSourceFile('cli\\src\\index.tsx')).toBe(true)
    expect(isAuditedSourceFile('common/src/util/object.test.ts')).toBe(false)
    expect(isAuditedSourceFile('scripts/__tests__/x.ts')).toBe(false)
    expect(isAuditedSourceFile('packages/database/dist/index.ts')).toBe(false)
    expect(isAuditedSourceFile('common/src/templates/a.generated.ts')).toBe(
      false,
    )
    expect(isAuditedSourceFile('dev/test-prompts/p.ts')).toBe(false)
    expect(isAuditedSourceFile('dev/quality-baseline.json')).toBe(false)
  })
})

describe('auditEslintDisableRationale — live tree (FID-2026-1013-012 W3-1)', () => {
  test('every tracked non-test directive in this repository carries a rationale', () => {
    expect(auditEslintDisableRationale(repoRoot)).toEqual([])
  })
})
