#!/usr/bin/env bun
// Agent-attribution guard — the single enforcement entry point for the rule that
// no coding agent may be attributed in this repository (operator directive,
// 2026-10-14, verbatim: "it's 100% forbidden from any coding agent to tag my
// repo").
//
// Why it exists: GitHub converts `Co-Authored-By:` trailers into contributor
// credit on the repository's contributors page, and a `Generated with …`
// watermark advertises the tool in permanent history. The 2026-08-17 incident
// put 21 unapproved Codebuff trailers into reachable history; removing them
// needed a history rewrite.
//
// TWO surfaces, ONE rule, three modules (Law 13 — one truth, no divergent
// copies):
//   - `./attribution-patterns`          the names and shapes that count as credit
//   - this module                       commit messages (history) + the aggregate
//   - `./attribution-document-guard`    the records agents write (FID-2026-1016-008)
//
// Enforcement points: `.githooks/commit-msg` (message file), `.githooks/pre-push`
// (pushed range + the working-tree document scan), the `attribution-guard`
// workflow, and `bun run validate:repository`.
//
// Usage (fail-closed: anything unexpected exits 2, never 0):
//   bun scripts/attribution-guard.ts --message-file <path>   # commit-msg hook
//   bun scripts/attribution-guard.ts --range <base>..<head>  # pushed/PR range
//   bun scripts/attribution-guard.ts --all                   # every reachable commit
//   bun scripts/attribution-guard.ts --documents [root]      # governed records

import { spawnSync } from 'child_process'
import fs from 'node:fs'

import {
  collectDocumentAttributionIssues,
  documentAttributionLines,
} from './attribution-document-guard'
import { AGENT_ATTRIBUTION_PATTERNS } from './attribution-patterns'

export {
  AGENT_ATTRIBUTION_PATTERNS,
  collectDocumentAttributionIssues,
  documentAttributionLines,
}

/**
 * Returns the disallowed attribution lines in a commit message (empty = clean).
 * Prose that merely *discusses* the rule (this file, the CHANGELOG, a FID) is a
 * quotation, not a trailer: the patterns in `./attribution-patterns` are anchored
 * on the trailer shapes, so a sentence mentioning an agent never trips them.
 */
export function commitWatermarkLines(message: string): string[] {
  const violations: string[] = []
  for (const rawLine of message.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    for (const pattern of AGENT_ATTRIBUTION_PATTERNS) {
      if (pattern.test(line)) {
        violations.push(line)
        break
      }
    }
  }
  return violations
}

export type AttributionViolation = { sha: string; lines: string[] }

const RECORD_SEP = '\u001e'
const FIELD_SEP = '\u001f'

function runGit(args: string[]): string {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
    shell: false,
  })
  if (result.status !== 0) {
    const detail = String(result.stderr ?? '').trim() || 'unknown git error'
    throw new Error(`git ${args[0] ?? ''} failed: ${detail}`)
  }
  return String(result.stdout ?? '')
}

/**
 * Scans every commit message in `revArgs` (one `git log` call — no per-commit
 * spawn) and returns the offending commits. Throws on any git failure so the
 * caller fails closed.
 */
export function scanRevisions(revArgs: string[]): AttributionViolation[] {
  const output = runGit([
    'log',
    `--format=%H${FIELD_SEP}%B${RECORD_SEP}`,
    ...revArgs,
  ])
  const violations: AttributionViolation[] = []
  for (const record of output.split(RECORD_SEP)) {
    const trimmed = record.replace(/^\s+/, '')
    if (!trimmed) continue
    const sep = trimmed.indexOf(FIELD_SEP)
    if (sep < 0) continue
    const sha = trimmed.slice(0, sep).trim()
    const lines = commitWatermarkLines(trimmed.slice(sep + 1))
    if (lines.length > 0) violations.push({ sha, lines })
  }
  return violations
}

/**
 * Repository-gate collector: EVERY surface of the rule, in the shape
 * `scripts/validate-repository.ts` aggregates — every reachable commit message
 * and every governed record (`./attribution-document-guard`). Both surfaces are
 * reported by one call so the repository gate needs no second `collect…` line of
 * its own: it sits at the 300-line ceiling, and a gate that cannot be wired is
 * not a gate.
 *
 * **Fail-closed**: a git failure or an unscannable document tree becomes an issue
 * (the gate fails) instead of throwing, so an inability to scan can never read as
 * a clean history or a clean record set — and this gate travels with the clone
 * (`bun run validate:repository`), which the local hooks and every optional CI
 * check do not.
 */
export function collectAttributionIssues(): {
  code: string
  message: string
}[] {
  const issues: { code: string; message: string }[] = []
  try {
    issues.push(
      ...scanRevisions(['--all']).map((violation) => ({
        code: 'attribution.agent-trailer',
        message: `${violation.sha.slice(0, 12)}: ${violation.lines.join(' | ')}`,
      })),
    )
  } catch (error) {
    issues.push({
      code: 'attribution.scan-failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
  issues.push(...collectDocumentAttributionIssues())
  return issues
}

function report(violations: AttributionViolation[], remedy: string): void {
  console.error(
    '❌ agent-attribution guard: a coding agent is credited in this repository.',
  )
  console.error(
    '   No coding agent may be attributed — ever, by any layer (operator rule, 2026-10-14).',
  )
  for (const v of violations.slice(0, 20)) {
    // A sha is shortened; a non-sha label (the message-file path) is printed as
    // written, so the heading never renders as a truncated fragment.
    const where = /^[0-9a-f]{7,}$/i.test(v.sha) ? v.sha.slice(0, 12) : v.sha
    console.error(`   ${where}${where ? '  ' : ''}${v.lines.join(' | ')}`)
  }
  if (violations.length > 20) {
    console.error(`   … ${violations.length - 20} further record(s)`)
  }
  console.error(`   ${remedy}`)
}

const COMMIT_REMEDY =
  'Remove the trailer/watermark line from the commit message and re-commit.'
const DOCUMENT_REMEDY =
  'Remove the agent name from the field (a value may credit Savant or a human), or delete the watermark line, then re-run.'

function main(argv: string[]): number {
  const [flag, value] = argv
  if (flag === '--message-file') {
    if (!value || !fs.existsSync(value)) {
      console.error(
        '❌ agent-attribution guard: no readable commit-message file provided.',
      )
      return 2
    }
    const lines = commitWatermarkLines(fs.readFileSync(value, 'utf8'))
    if (lines.length === 0) return 0
    report([{ sha: '(this commit)', lines }], COMMIT_REMEDY)
    return 1
  }
  if (flag === '--range') {
    if (!value || !value.includes('..')) {
      console.error(
        '❌ agent-attribution guard: --range needs an explicit <base>..<head>.',
      )
      return 2
    }
    const violations = scanRevisions([value])
    if (violations.length === 0) return 0
    report(violations, COMMIT_REMEDY)
    return 1
  }
  if (flag === '--documents') {
    // No argument means the repository the caller is standing in — the pushed
    // repo for the pre-push hook, which need not be the hooks' own repo.
    const issues = value
      ? collectDocumentAttributionIssues(value)
      : collectDocumentAttributionIssues()
    if (issues.length === 0) return 0
    // A scan failure is the guard's own fault, not a credit line: exit 2 so it
    // can never be mistaken for — or silenced as — a content finding.
    if (
      issues.some((issue) => issue.code === 'attribution.document-scan-failed')
    ) {
      for (const issue of issues) console.error(`❌ ${issue.message}`)
      return 2
    }
    // The message already carries `path: line`; report prints it once.
    report(
      issues.map((issue) => ({ sha: '', lines: [issue.message] })),
      DOCUMENT_REMEDY,
    )
    return 1
  }
  if (flag === '--all') {
    const violations = scanRevisions(['--all'])
    if (violations.length === 0) return 0
    report(violations, COMMIT_REMEDY)
    return 1
  }
  console.error(
    '❌ agent-attribution guard: usage: --message-file <path> | --range <base>..<head> | --all | --documents [root]',
  )
  return 2
}

// Only run as a CLI; importing the module (tests, pre-push-scan) must not exit.
if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (error) {
    console.error(
      `❌ agent-attribution guard: scan failed, refusing to pass — ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    process.exit(2)
  }
}
