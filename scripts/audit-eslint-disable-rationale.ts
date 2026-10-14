#!/usr/bin/env bun
/**
 * FID-2026-1013-012 W3-1 — the eslint-disable rationale audit.
 *
 * The repository's rationale-comment rule (stated at its canonical example,
 * `packages/connectors/src/shared/logging.ts:24`) requires every
 * `eslint-disable` / `eslint-disable-next-line` / `eslint-disable-line` comment
 * to carry a `-- <rationale>` explanation, because a suppression without a
 * stated reason is an unauditable hole in ECHO Law 6. Until this probe, the
 * rule was enforced by review convention only: 15 tracked production
 * directives had no rationale and nothing failed when a sixteenth appeared.
 *
 * Shape follows `./audit-exit-codes` (FID-2026-0907-002): a PURE detector
 * (`detectRationaleFreeDirectives`) over line arrays, plus a collector that
 * resolves the tracked file list through `git ls-files` (git state, not
 * filesystem grep) and normalizes separators. Test files are out of scope by
 * design — the repository ESLint config exempts `__tests__`/`*.test.*` from
 * the production rules the directives suppress, so their suppressions are not
 * production suppressions. `node_modules/`, `dist/`, generated files, and
 * `dev/test-prompts/` are excluded for the same reason `./quality-report`
 * excludes build output: they are not authored source.
 *
 * Exit 0 clean / 1 with offending `file:line` rows, so it serves as a
 * `probe` gate (`- gate: probe scripts/audit-eslint-disable-rationale.ts`).
 */
import fs from 'node:fs'
import path from 'node:path'

export interface EslintDisableRationaleIssue {
  file: string
  line: number
  message: string
}

export interface SourceLines {
  file: string
  lines: string[]
}

/**
 * Comment-leading directive forms. Both patterns require the comment opener, so
 * the literal text `eslint-disable` inside a string or an identifier is not a
 * directive (only `// …` and `/* … *\/` are).
 */
const DIRECTIVE_PATTERNS = [
  /\/\/\s*eslint-disable(?:-next-line|-line)?\b([^\n]*)/g,
  /\/\*+\s*eslint-disable(?:-next-line|-line)?\b([\s\S]*?)\*\//g,
] as const

/** The required rationale marker: a `--` followed by non-empty text. */
const RATIONALE_PATTERN = /--\s*\S/

/** Tracked source globs the audit covers. */
export const AUDITED_FILE_ARGS = ['*.ts', '*.tsx']

const EXCLUDED_PATH =
  /(^|\/)(node_modules|dist)(\/|$)|(^|\/)dev\/test-prompts\/|\.generated\.tsx?$/

const TEST_PATH = /(^|\/)__tests__(\/|$)|\.test\.tsx?$|\.spec\.tsx?$/

/**
 * Pure detector: report every disable directive whose comment body carries no
 * `-- <rationale>` explanation. Line numbers are 1-indexed and one finding per
 * directive (a directive reported twice on the same line is deduped).
 */
export function detectRationaleFreeDirectives(
  source: SourceLines,
): EslintDisableRationaleIssue[] {
  const content = source.lines.join('\n')
  const issues: EslintDisableRationaleIssue[] = []
  const reportedLines = new Set<number>()

  for (const pattern of DIRECTIVE_PATTERNS) {
    pattern.lastIndex = 0
    let match = pattern.exec(content)
    while (match) {
      const body = match[1] ?? ''
      const line = content.slice(0, match.index).split('\n').length
      if (!RATIONALE_PATTERN.test(body) && !reportedLines.has(line)) {
        reportedLines.add(line)
        issues.push({
          file: source.file,
          line,
          message:
            'eslint-disable directive has no `-- <rationale>` explanation. ' +
            'State why suppressing this rule is safe here, e.g. ' +
            '`// eslint-disable-next-line no-console -- one diagnostic per ' +
            'mount (log-once rule)`.',
        })
      }
      match = pattern.exec(content)
    }
  }

  return issues.sort((a, b) => a.line - b.line)
}

/** Non-test tracked `.ts`/`.tsx` paths covered by the audit. */
export function isAuditedSourceFile(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  return (
    /\.tsx?$/.test(normalized) &&
    !EXCLUDED_PATH.test(normalized) &&
    !TEST_PATH.test(normalized)
  )
}

function defaultRunner(
  command: string,
  args: string[],
  cwd: string,
): { status: number | null; stdout: string; stderr: string } {
  const spawned = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    status: spawned.exitCode,
    stdout: spawned.stdout.toString(),
    stderr: spawned.stderr.toString(),
  }
}

/**
 * Resolve the audited file list from git (tracked state, per the learnings
 * rule). Injectable runner for tests; non-git environments fail closed with an
 * empty list plus the runner's error, because auditability is unprovable there.
 */
export function collectAuditedSourceFiles(
  root: string,
  runner: (
    command: string,
    args: string[],
    cwd: string,
  ) => {
    status: number | null
    stdout: string
    stderr: string
  } = defaultRunner,
): { files: string[]; error?: string } {
  const result = runner('git', ['ls-files', '--', ...AUDITED_FILE_ARGS], root)
  if ((result.status ?? 1) !== 0) {
    return {
      files: [],
      error: `Unable to list tracked source files (git ls-files exit ${result.status}): ${result.stderr.trim()}`,
    }
  }
  return {
    files: result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((file) => file.replaceAll('\\', '/'))
      .filter(isAuditedSourceFile),
  }
}

/** Read + normalize the audited files that exist on disk. */
export function readAuditedSources(
  root: string,
  files: string[],
): SourceLines[] {
  const sources: SourceLines[] = []
  for (const file of files) {
    const full = path.join(root, file)
    if (!fs.existsSync(full)) continue
    sources.push({
      file,
      lines: fs.readFileSync(full, 'utf8').split(/\r?\n/),
    })
  }
  return sources
}

export function auditEslintDisableRationale(
  root: string,
  runner?: (
    command: string,
    args: string[],
    cwd: string,
  ) => { status: number | null; stdout: string; stderr: string },
): EslintDisableRationaleIssue[] {
  const { files, error } = collectAuditedSourceFiles(root, runner)
  if (error) {
    return [{ file: '(audited sources)', line: 0, message: error }]
  }
  return readAuditedSources(root, files).flatMap((source) =>
    detectRationaleFreeDirectives(source),
  )
}

if (import.meta.main) {
  const issues = auditEslintDisableRationale(
    path.resolve(import.meta.dir, '..'),
  )
  if (issues.length === 0) {
    console.log(
      'eslint-disable-rationale: PASS (every tracked non-test directive carries `-- <rationale>`)',
    )
  } else {
    console.error(`eslint-disable-rationale: FAIL (${issues.length} issue(s))`)
    for (const issue of issues.slice(0, 50))
      console.error(`- ${issue.file}:${issue.line}: ${issue.message}`)
    if (issues.length > 50) console.error(`- (+${issues.length - 50} more)`)
    process.exitCode = 1
  }
}
