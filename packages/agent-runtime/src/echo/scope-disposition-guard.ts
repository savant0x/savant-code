/**
 * @module echo/scope-disposition-guard
 *
 * FID-2026-0919-024 — no agent-side scope trimming.
 *
 * The Step-Level Anti-Deferral gate (FID-2026-0817-005) already requires an
 * explicit `operator-approved <YYYY-MM-DD>` marker before a FID step may be
 * `deferred`/`skipped`, and its own rules say only the operator sets those
 * statuses. The SCOPE register and the narrative records had no equivalent
 * guard, so an agent could apply `[OPEN-OUT-OF-SCOPE]`, `[OUT-OF-SCOPE]` or
 * `[DEFERRED]` to approved work by itself and narrate that the item had been
 * "presented" — a scope reduction with no approval (Law 2). Measured before the
 * fix: 2 live register items, 1 index line, 3 CHANGELOG lines and 12 session
 * summaries carried the label, and the pre-2026-09-19 protocol text authorized
 * them.
 *
 * This module is the single authority for the prohibition. The label tokens and
 * the `::` status markers ARE the mechanism, so they are what is checked; prose
 * is left alone. The two protocol documents are deliberately not scanned — they
 * must be free to name what is prohibited.
 */

import fs from 'node:fs'
import path from 'node:path'

import type { AdvisoryWarning, EnforcementResult } from './types'

/** The only marker that legalizes a non-completion disposition. */
export const OPERATOR_APPROVAL_MARKER = /operator-approved\s+\d{4}-\d{2}-\d{2}/

/**
 * The disposition tokens an agent may NEVER write: the bracketed labels that
 * assert a scope disposition, and the `::` status markers that mirror the FID
 * step-status grammar without its approval marker.
 */
const PROHIBITED_TOKEN =
  /\[(?:OPEN-)?OUT-OF-SCOPE\]|\[DEFERRED\]|\b(?:deferred|skipped|dropped)::/i

/** Surfaces scanned on every run: the live planning surfaces. */
const ALWAYS_SCANNED_FILES = ['SCOPE.md', 'dev/agenda.md']

/**
 * Narrative surfaces (session summaries, CHANGELOG) are scanned from this date
 * forward. Records predating the prohibition are history; they are recorded as
 * past practice and are not rewritten.
 */
export const SCOPE_GUARD_EFFECTIVE_DATE = '2026-09-19'

/** One prohibited disposition token found in one file. */
export type ScopeDispositionIssue = {
  file: string
  line: number
  token: string
  message: string
}

/** True when a path is an EHEL-scanned scope surface. */
function isScannedSurface(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/')
  if (normalized.endsWith('SCOPE.md')) return true
  if (normalized.endsWith('dev/agenda.md')) return true
  if (/dev\/fids\/FID-[\w.-]+\.md$/.test(normalized)) return true
  if (/dev\/session-summaries\/[^/]+\.md$/.test(normalized)) return true
  return normalized.endsWith('CHANGELOG.md')
}

/** Extract the write payload from a pre-write gate input bag. */
function writeContent(input: Record<string, unknown>): string {
  const operation = input.operation
  const operationDiff =
    operation && typeof operation === 'object'
      ? (operation as Record<string, unknown>).diff
      : undefined
  const content =
    input.content ??
    input.newString ??
    (typeof operationDiff === 'string' ? operationDiff : '')
  return typeof content === 'string' ? content : ''
}

/**
 * Strip inline code spans. A token written in backticks is a *quotation* — how
 * the protocols and this rule name what is prohibited — while a bare token in a
 * checkbox or bullet is the disposition mechanism itself. That distinction is
 * what lets the rule be stated in an artifact without excusing the tag.
 *
 * Shared with `scope-register-completeness` (FID-2026-0919-025), which applies
 * the same rule to task references: a quoted id is history or documentation, a
 * bare one is a claim on current scope.
 */
export function withoutInlineCode(line: string): string {
  return line.replace(/`[^`]*`/g, '')
}

/**
 * Scan one document body for prohibited disposition tokens. A line carrying an
 * `operator-approved <YYYY-MM-DD>` marker is legal by construction — that is
 * the operator's own ruling.
 */
export function scanScopeDispositions(
  content: string,
  file: string,
): ScopeDispositionIssue[] {
  const issues: ScopeDispositionIssue[] = []
  const lines = content.split('\n')
  for (const [index, line] of lines.entries()) {
    const match = withoutInlineCode(line).match(PROHIBITED_TOKEN)
    if (!match) continue
    if (OPERATOR_APPROVAL_MARKER.test(line)) continue
    issues.push({
      file,
      line: index + 1,
      token: match[0],
      message:
        `prohibited disposition token "${match[0]}" — approved work may not be ` +
        'labelled out-of-scope, deferred or skipped by the agent. Complete it, ' +
        'or record it as blocked with the specific blocker; the only marker ' +
        'that legalizes a drop is "operator-approved <YYYY-MM-DD>"',
    })
  }
  return issues
}

/** Leading `YYYY-MM-DD` of a session-summary filename. */
function summaryDate(fileName: string): string | undefined {
  return fileName.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

/**
 * Scan a CHANGELOG body only inside sections dated on/after the effective date
 * — earlier release blocks are history.
 */
export function scanChangelogSinceEffective(
  content: string,
): ScopeDispositionIssue[] {
  const issues: ScopeDispositionIssue[] = []
  let sectionDate: string | undefined
  const lines = content.split('\n')
  for (const [index, line] of lines.entries()) {
    const heading = line.match(/^##\s+(.*)$/)
    if (heading) {
      const date =
        heading[1]?.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ??
        heading[1]?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
      sectionDate = date
      continue
    }
    if (!sectionDate || sectionDate < SCOPE_GUARD_EFFECTIVE_DATE) continue
    const match = withoutInlineCode(line).match(PROHIBITED_TOKEN)
    if (!match || OPERATOR_APPROVAL_MARKER.test(line)) continue
    issues.push({
      file: 'CHANGELOG.md',
      line: index + 1,
      token: match[0],
      message:
        `prohibited disposition token "${match[0]}" in a current-release ` +
        'entry — describe the work as completed or blocked instead',
    })
  }
  return issues
}

/** Every scope surface under `root`, with the live/narrative split applied. */
export function collectScopeDispositionIssues(
  root: string,
): ScopeDispositionIssue[] {
  const issues: ScopeDispositionIssue[] = []
  const read = (relativePath: string): string | undefined => {
    try {
      return fs.readFileSync(path.join(root, relativePath), 'utf8')
    } catch {
      return undefined
    }
  }

  for (const relativePath of ALWAYS_SCANNED_FILES) {
    const content = read(relativePath)
    if (content !== undefined)
      issues.push(...scanScopeDispositions(content, relativePath))
  }

  const fidsDir = path.join(root, 'dev/fids')
  let fidEntries: string[] = []
  try {
    fidEntries = fs.readdirSync(fidsDir)
  } catch {
    fidEntries = []
  }
  for (const entry of fidEntries) {
    if (!/^FID-[\w.-]+\.md$/.test(entry)) continue
    const content = read(`dev/fids/${entry}`)
    if (content !== undefined) {
      issues.push(...scanScopeDispositions(content, `dev/fids/${entry}`))
    }
  }

  const summariesDir = path.join(root, 'dev/session-summaries')
  let summaryEntries: string[] = []
  try {
    summaryEntries = fs.readdirSync(summariesDir)
  } catch {
    summaryEntries = []
  }
  for (const entry of summaryEntries) {
    if (!entry.endsWith('.md')) continue
    const date = summaryDate(entry)
    if (!date || date < SCOPE_GUARD_EFFECTIVE_DATE) continue
    const content = read(`dev/session-summaries/${entry}`)
    if (content !== undefined) {
      issues.push(
        ...scanScopeDispositions(content, `dev/session-summaries/${entry}`),
      )
    }
  }

  const changelog = read('CHANGELOG.md')
  if (changelog !== undefined)
    issues.push(...scanChangelogSinceEffective(changelog))

  return issues
}

/**
 * EHEL pre-write tripwire: block the write itself when a scope surface would
 * gain a prohibited disposition token. Returns null when the target is not a
 * scanned surface or the payload is clean.
 */
export function runScopeDispositionGate(params: {
  targetPath: string | undefined
  input: Record<string, unknown>
  warnings: AdvisoryWarning[]
}): EnforcementResult | null {
  const { targetPath, warnings } = params
  if (!targetPath || !isScannedSurface(targetPath)) return null
  const content = writeContent(params.input)
  if (!content) return null
  const issues = scanScopeDispositions(content, targetPath)
  if (issues.length === 0) return null
  const first = issues[0]
  return {
    blocked: true,
    reason:
      `Scope gate: ${issues.length} prohibited disposition token(s) in ` +
      `"${targetPath}" (line ${String(first?.line)}: ${String(first?.token)}) — ` +
      'approved work is completed, never trimmed. Operator approval is the only' +
      ' marker that legalizes a drop.',
    warnings,
  }
}
