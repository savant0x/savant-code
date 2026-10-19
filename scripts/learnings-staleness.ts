/**
 * FID-2026-1016-016 (LF-006) — stale lesson guidance against current
 * executable authority.
 *
 * `dev/LEARNING-RULES.md` is the canonical authority catalog: each rule names
 * the artifact that authorizes it and the check that validates it. Nothing
 * re-resolved those references, so a rule could keep citing a file that had
 * been deleted, or a FID that never existed, while the tier said `boot`. And a
 * rule tiered `historical` could still be linked to a lesson whose `Status` is
 * `active`, which presents dated guidance as current authority.
 *
 * Two findings, deliberately at different severities:
 *
 * - a dead reference in a current rule (`boot`/`reference`) is an ERROR — the
 *   rule claims authority it does not have;
 * - the same dead reference in a `historical` rule is a WARNING — historical
 *   guidance is allowed to point at artifacts that were retired, but it must
 *   be visible that it does. That difference IS the "historical guidance is
 *   visibly distinguished from current protocol authority" requirement.
 *
 * Neither finding rewrites the rule text: detection never changes policy, it
 * only invalidates the readiness of the rule's own claim.
 */

import fs from 'node:fs'
import path from 'node:path'

import { makeIssue } from './learnings-schema.js'
import { sessionSummaryReference } from './session-summaries-organize'

import type { CanonicalLearningRule } from './learnings-rules.js'
import type { LearningIssue, StructuredLearning } from './learnings-types.js'

/** A backticked token that could name a repository artifact. */
const PATH_TOKEN = /^[A-Za-z0-9._/-]+$/
const ARTIFACT_EXTENSION = /\.(ts|tsx|md|json|ya?ml|toml|lock)$/
const FID_TOKEN = /FID-\d{4}-\d{4}-\d{3}/g

/** Repo-relative artifact paths named by a rule's Authority/Validation text. */
export function artifactTokens(text: string): string[] {
  const tokens: string[] = []
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const token = match[1]?.trim() ?? ''
    if (!PATH_TOKEN.test(token)) continue
    if (!(token.includes('/') || ARTIFACT_EXTENSION.test(token))) continue
    tokens.push(token)
  }
  return [...new Set(tokens)]
}

/** FID identities named by a rule's Authority/Validation text. */
export function fidTokens(text: string): string[] {
  return [...new Set([...text.matchAll(FID_TOKEN)].map((match) => match[0]))]
}

/**
 * Resolve a FID to a record: exactly one file in `dev/fids` or its archive.
 * A repository with no records directory at all (fixtures, foreign checkouts)
 * is reported as `unknown`, never as missing — absence of the store is not
 * evidence that the reference is dead.
 */
function resolveFid(root: string, id: string): 'found' | 'missing' | 'unknown' {
  let sawDirectory = false
  for (const directory of ['dev/fids', 'dev/fids/archive']) {
    const folder = path.join(root, directory)
    if (!fs.existsSync(folder)) continue
    sawDirectory = true
    if (
      fs
        .readdirSync(folder)
        .some((name) => name.startsWith(`${id}-`) && name.endsWith('.md'))
    )
      return 'found'
  }
  return sawDirectory ? 'missing' : 'unknown'
}

function isCurrent(rule: CanonicalLearningRule): boolean {
  return rule.tier !== 'historical'
}

function referenceIssues(
  root: string,
  rule: CanonicalLearningRule,
  reference: string,
  detail: string,
): LearningIssue {
  const code = isCurrent(rule)
    ? 'learning.rules.reference.stale'
    : 'learning.rules.reference.historical-stale'
  return {
    code,
    message: `Canonical rule ${rule.name} (${rule.tier}): ${detail} ${reference}`,
    ...(isCurrent(rule) ? {} : { severity: 'warning' as const }),
  }
}

/** Dead artifact or FID references in the canonical rule catalog. */
export function staleRuleReferenceIssues(
  root: string,
  rules: readonly CanonicalLearningRule[],
): LearningIssue[] {
  const issues: LearningIssue[] = []
  for (const rule of rules) {
    const text = `${rule.authority} ${rule.validation}`
    for (const token of artifactTokens(text)) {
      // A summary cited by its old flat path still resolves once the monthly
      // grouping has moved it; the rule text itself is never rewritten.
      const resolved = path.resolve(root, sessionSummaryReference(root, token))
      if (!fs.existsSync(resolved))
        issues.push(
          referenceIssues(root, rule, token, 'cites a missing artifact'),
        )
    }
    for (const id of fidTokens(text)) {
      const state = resolveFid(root, id)
      if (state === 'missing')
        issues.push(
          referenceIssues(root, rule, id, 'cites a missing FID record'),
        )
    }
  }
  return issues
}

/**
 * A rule's tier must agree with the status of the lessons that link to it:
 * a `historical` rule linked to an `active` lesson presents dated guidance as
 * current authority, and a current rule whose live lessons have all retired
 * has outlived its evidence. Rules with no live lesson are not judged.
 */
export function ruleTierLessonIssues(
  rules: readonly CanonicalLearningRule[],
  lessons: readonly StructuredLearning[],
): LearningIssue[] {
  const statusesByRule = new Map<string, string[]>()
  for (const lesson of lessons) {
    const key = lesson.canonicalRule ?? lesson.title
    statusesByRule.set(key, [...(statusesByRule.get(key) ?? []), lesson.status])
  }
  const issues: LearningIssue[] = []
  for (const rule of rules) {
    const statuses = statusesByRule.get(rule.name)
    if (statuses === undefined || statuses.length === 0) continue
    const hasActive = statuses.includes('active')
    if (rule.tier === 'historical' && hasActive)
      issues.push(
        makeIssue(
          'learning.rules.tier.dated-guidance-active',
          `Canonical rule ${rule.name} is tiered historical but a linked lesson is still active (${statuses.join(', ')}); the dated guidance reads as current authority.`,
        ),
      )
    if (rule.tier !== 'historical' && !hasActive)
      issues.push(
        makeIssue(
          'learning.rules.tier.without-active-lesson',
          `Canonical rule ${rule.name} is tiered ${rule.tier} but none of its linked lessons is active (${statuses.join(', ')}); the rule has outlived its evidence.`,
        ),
      )
  }
  return issues
}
