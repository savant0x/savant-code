/**
 * fid-surface-coverage tests (FID-2026-1012-027).
 *
 * The defect: a receipt proves the gates a record CHOSE, never that the set
 * covers the surfaces the fix touched. These tests drive the collector over a
 * temp root whose `SCOPE.md` register and `dev/fids` record are both real
 * files, so the assertions exercise the same two inputs `validate:repository`
 * reads.
 *
 * The negative case is driven from the real artifact that produced the finding:
 * a record whose register glob sits under `scripts/**` and whose declared gates
 * omit the scripts-tree typecheck leg.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { collectRecordCoverageIssues } from '../fid-surface-coverage'
import { coverageStampBlockers } from '../fid-verify'

const tempRoots: string[] = []
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

const SCRIPTS_LEG = 'probe scripts/scripts-typecheck-check.ts'
const SCOPE_HEADER = '## Machine-readable scope targets\n\n'

/** A temp repo root with a register section and one record per entry. */
function createRoot(options: {
  register: string
  records: Record<string, string>
}): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-fid-coverage-'))
  tempRoots.push(root)
  writeFileSync(
    path.join(root, 'SCOPE.md'),
    `# SCOPE\n\n${SCOPE_HEADER}${options.register}\n`,
  )
  mkdirSync(path.join(root, 'dev', 'fids'), { recursive: true })
  for (const [name, content] of Object.entries(options.records)) {
    writeFileSync(path.join(root, 'dev', 'fids', name), content)
  }
  return root
}

/** A record with the given status and declared gates. */
function record(
  status: string,
  gates: string[],
  id = 'FID-2026-1013-001',
): string {
  const gateLines = gates.map((gate) => `- gate: ${gate}`).join('\n')
  return (
    `# FID: test\n\n**ID:** ${id}\n**Status:** ${status}\n\n` +
    `## Verification Gates\n\n${gateLines}\n`
  )
}

describe('collectRecordCoverageIssues', () => {
  it('flags a scripts surface whose scripts-typecheck leg is undeclared', () => {
    const root = createRoot({
      register:
        '- FID-2026-1013-001: `scripts/learnings*.ts`, `dev/LEARNINGS.md`\n',
      records: {
        'FID-2026-1013-001-a.md': record('fixed', [
          'test scripts/__tests__/learnings-retire.test.ts',
          'probe scripts/learnings.ts',
          'quality',
        ]),
      },
    })

    const issues = collectRecordCoverageIssues(root)
    expect(issues.map((issue) => issue.code)).toEqual([
      'fid.coverage.missing-gate',
    ])
    // The message names the record, the demanding glob, and the declaration.
    expect(issues[0]?.message).toContain('FID-2026-1013-001-a.md')
    expect(issues[0]?.message).toContain('`scripts/learnings*.ts`')
    expect(issues[0]?.message).toContain(SCRIPTS_LEG)
  })

  it('passes once the demanded leg is declared', () => {
    const root = createRoot({
      register:
        '- FID-2026-1013-001: `scripts/learnings*.ts`, `dev/LEARNINGS.md`\n',
      records: {
        'FID-2026-1013-001-a.md': record('fixed', [
          'probe scripts/learnings.ts',
          SCRIPTS_LEG,
          'quality',
        ]),
      },
    })
    expect(collectRecordCoverageIssues(root)).toEqual([])
  })

  it('demands the typecheck leg of every workspace the surface names', () => {
    const root = createRoot({
      register:
        '- FID-2026-1013-001: `common/src/tools/params/tool/**`, ' +
        '`packages/agent-runtime/src/run-agent-step/**`\n',
      records: {
        'FID-2026-1013-001-a.md': record('fixed', [
          'typecheck packages/agent-runtime',
          'quality',
        ]),
      },
    })

    const issues = collectRecordCoverageIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('typecheck common')
    expect(issues[0]?.message).toContain('`common/src/tools/params/tool/**`')
  })

  it('names the workspace root for a package path, not the package name', () => {
    const root = createRoot({
      register:
        '- FID-2026-1013-001: `packages/agent-runtime/src/echo/scope-targets.ts`\n',
      records: {
        'FID-2026-1013-001-a.md': record('fixed', [
          'typecheck common',
          'quality',
        ]),
      },
    })
    const issues = collectRecordCoverageIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('typecheck packages/agent-runtime')
  })

  it('flags an enforced record with no register line', () => {
    const root = createRoot({
      register: '- FID-2026-1013-002: `scripts/other.ts`\n',
      records: {
        'FID-2026-1013-001-a.md': record('verified', [SCRIPTS_LEG, 'quality']),
      },
    })
    const issues = collectRecordCoverageIssues(root)
    expect(issues.map((issue) => issue.code)).toEqual([
      'fid.coverage.unregistered',
    ])
  })

  it('flags a register line that names no paths', () => {
    const root = createRoot({
      register: '- FID-2026-1013-001: (no write surface)\n',
      records: {
        'FID-2026-1013-001-a.md': record('fixed', [SCRIPTS_LEG, 'quality']),
      },
    })
    const issues = collectRecordCoverageIssues(root)
    expect(issues.map((issue) => issue.code)).toEqual(['fid.coverage.pathless'])
  })

  it('does not gate a pre-implementation record', () => {
    const root = createRoot({
      register: '- FID-2026-1013-001: `scripts/learnings*.ts`\n',
      records: {
        'FID-2026-1013-001-a.md': record('converged', ['quality']),
      },
    })
    expect(collectRecordCoverageIssues(root)).toEqual([])
  })

  it('is inert when the register has no such section', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'savant-fid-coverage-'))
    tempRoots.push(root)
    writeFileSync(path.join(root, 'SCOPE.md'), '# SCOPE\n\n## Open items\n')
    mkdirSync(path.join(root, 'dev', 'fids'), { recursive: true })
    writeFileSync(
      path.join(root, 'dev', 'fids', 'FID-2026-1013-001-a.md'),
      record('fixed', [SCRIPTS_LEG, 'quality']),
    )
    expect(collectRecordCoverageIssues(root)).toEqual([])
  })

  it("uses the executor's own gate label, so a declaration is judged by fid:verify's rule", () => {
    // `quality` carries an EMPTY arg — the case a hand-rolled `${kind} ${arg}`
    // join gets wrong ("quality " with a trailing space). The audit delegates to
    // `gateLabel`, so a record declaring `- gate: quality` is recognised and one
    // declaring an unrelated gate is not.
    const root = createRoot({
      register: '- FID-2026-1013-001: `dev/LEARNINGS.md`\n',
      records: {
        'FID-2026-1013-001-a.md': record('fixed', ['probe scripts/hygiene.ts']),
      },
    })
    const issues = collectRecordCoverageIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('`- gate: quality`')
  })

  describe('option B — the stamp refusal', () => {
    it('does not block a stamp when the surface is covered', () => {
      const root = createRoot({
        register: '- FID-2026-1013-001: `scripts/learnings*.ts`\n',
        records: {
          'FID-2026-1013-001-a.md': record('fixed', [SCRIPTS_LEG, 'quality']),
        },
      })
      expect(coverageStampBlockers(root, 'FID-2026-1013-001-a.md')).toEqual([])
    })

    it('blocks when the demanded leg is missing', () => {
      const root = createRoot({
        register: '- FID-2026-1013-001: `scripts/learnings*.ts`\n',
        records: {
          'FID-2026-1013-001-a.md': record('fixed', ['quality']),
        },
      })
      const blockers = coverageStampBlockers(root, 'FID-2026-1013-001-a.md')
      expect(blockers).toHaveLength(1)
      expect(blockers[0]?.code).toBe('fid.coverage.missing-gate')
    })

    it("ignores another record's findings", () => {
      const root = createRoot({
        register:
          '- FID-2026-1013-001: `scripts/learnings*.ts`\n' +
          '- FID-2026-1013-002: `sdk/src/run/**`\n',
        records: {
          'FID-2026-1013-001-a.md': record('fixed', [SCRIPTS_LEG, 'quality']),
          'FID-2026-1013-002-b.md': record(
            'fixed',
            ['quality'],
            'FID-2026-1013-002',
          ),
        },
      })
      expect(coverageStampBlockers(root, 'FID-2026-1013-001-a.md')).toEqual([])
    })
  })

  it('demands the repo-wide quality gate of every enforced record', () => {
    const root = createRoot({
      register: '- FID-2026-1013-001: `dev/LEARNINGS.md`\n',
      records: {
        'FID-2026-1013-001-a.md': record('fixed', ['probe scripts/hygiene.ts']),
      },
    })
    const issues = collectRecordCoverageIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('`- gate: quality`')
  })
})
