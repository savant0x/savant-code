/**
 * @module echo/fid-validator
 *
 * FID Completeness Validator for the ECHO Harness Enforcement Layer.
 *
 * Checks FID markdown files for structural completeness before
 * allowing creation or status transitions.
 *
 * Required sections (all modes):
 *   Summary, Environment, Detailed Description, Impact Assessment,
 *   Proposed Solution, Perfection Loop, Resolution, Lessons Learned
 *
 * Additional required sections (strict mode):
 *   Unanswered Questions (minimum MIN_UNANSWERED_QUESTIONS)
 *
 * Also checks for placeholder text ([pending], TODO, TBD).
 */

import type { FidValidationResult } from './types'

/** Sections required in every FID, regardless of mode. */
const REQUIRED_SECTIONS = [
  '## Summary',
  '## Environment',
  '## Detailed Description',
  '## Impact Assessment',
  '## Proposed Solution',
  '## Perfection Loop',
  '## Resolution',
  '## Lessons Learned',
]

/** Additional sections required in strict mode. */
const STRICT_SECTIONS = ['### Missed Questions']

/** Minimum number of unanswered questions in strict mode. */
const MIN_UNANSWERED_QUESTIONS = 2

/** Pattern matching placeholder text that should not appear in FIDs. */
const PLACEHOLDER_PATTERN = /\[pending\]|\bTODO\b|\bTBD\b|\[TBD\]/gi

/**
 * Validate a FID's `## Step Status` section (Anti-Deferral Gate,
 * FID-2026-0817-005).
 *
 * Every planning FID carries an explicit step-status inventory. Only the
 * operator may mark a step `deferred`/`skipped` (via an explicit
 * `operator-approved <YYYY-MM-DD>` marker); every other unimplemented step
 * is `blocked` by construction and must be presented to the operator before
 * the FID transitions to `converged`/`closed`.
 *
 * Returns an array of errors (empty = valid). Entries prefixed with
 * `advisory:` are informational (orphan markers) and never block.
 *
 * Parsed step-line grammar (one checkbox line per step):
 *   - [x] 1. <desc> — implemented
 *   - [ ] 2. <desc> — blocked::<reason>
 *   - [ ] 3. <desc> — deferred::operator-approved <YYYY-MM-DD>
 *   - [ ] 4. <desc> — skipped::operator-approved <YYYY-MM-DD>
 */
export function validateFidStepStatus(content: string): string[] {
  const errors: string[] = []
  // `(?![^])` is the end-of-input lookahead — `\z` is not valid in JS regex.
  const section = content.match(/^## Step Status[\s\S]*?(?=^## |(?![^]))/m)?.[0]
  if (!section) return errors

  const statusMatch = content.match(/^\*\*Status:\*\*\s*(converged|closed)/m)
  const declaredClosed = statusMatch !== null
  const statusWord = statusMatch?.[1] ?? 'converged/closed'

  const stepLinePattern = /^\s*-\s*\[([ xX])\]\s*(.+)$/
  const approvalPattern = /operator-approved\s+\d{4}-\d{2}-\d{2}/
  const deferralPattern = /(?:deferred|skipped)::/

  for (const line of section.split('\n')) {
    const match = line.match(stepLinePattern)
    if (!match) continue
    const checked = match[1] === 'x' || match[1] === 'X'
    const step = match[2].trim()

    if (checked) {
      if (approvalPattern.test(step)) {
        errors.push(
          `advisory: step "${step}" is marked implemented but carries an ` +
            'operator-approved marker (orphan marker); remove the marker',
        )
      }
      continue
    }

    if (deferralPattern.test(step) && !approvalPattern.test(step)) {
      errors.push(
        `step "${step}" is deferred/skipped without an ` +
          'operator-approved <YYYY-MM-DD> marker — operator approval is ' +
          'required',
      )
    }
    if (declaredClosed && !approvalPattern.test(step)) {
      errors.push(
        `step "${step}" is unresolved (no operator-approved marker) — ` +
          `present it to the operator before the ${statusWord} transition`,
      )
    }
  }
  return errors
}

/**
 * Validate a FID file's structural completeness.
 *
 * @param content  - The full markdown content of the FID file.
 * @param tier     - Enforcement tier ('core_4' for hybrid, 'all_15' for strict).
 * @returns FidValidationResult with errors array (empty if valid).
 */
export function validateFid(
  content: string,
  tier: 'core_4' | 'all_15',
): FidValidationResult {
  const errors: string[] = []

  // ── Required sections (all modes) ───────────────────────────────────
  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      errors.push(`Missing required section: ${section}`)
    }
  }

  // ── Strict-mode sections ────────────────────────────────────────────
  if (tier === 'all_15') {
    for (const section of STRICT_SECTIONS) {
      if (!content.includes(section)) {
        errors.push(`Missing strict-mode section: ${section}`)
      }
    }

    // Check Missed Questions has minimum question count.
    const missedQuestionsMatch = content.match(
      /### Missed Questions[\s\S]*?(?=### |## |$)/,
    )
    if (missedQuestionsMatch) {
      const questionCount = (missedQuestionsMatch[0].match(/^\d+\./gm) ?? [])
        .length
      if (questionCount < MIN_UNANSWERED_QUESTIONS) {
        errors.push(
          `Missed Questions has ${questionCount} questions ` +
            `(minimum is ${MIN_UNANSWERED_QUESTIONS})`,
        )
      }
    }
  }

  // ── Placeholder detection ───────────────────────────────────────────
  const matches = content.match(PLACEHOLDER_PATTERN)
  if (matches && matches.length > 0) {
    const unique = [...new Set(matches.map((m) => m.toUpperCase()))]
    errors.push(`Contains placeholder text: ${unique.join(', ')}`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Check whether a file path targets a FID file.
 *
 * @param path - The file path to check.
 * @returns true if the path matches the FID naming convention.
 */
export function isFidFile(path: string): boolean {
  return /dev\/fids\/FID-[\w.-]+\.md$/.test(path)
}

/** Perfection Loop phases the Auto Drive supervisor validates (FID-2026-0818-004). */
export type FidEvidencePhase =
  'red' | 'green' | 'audit' | 'adversarial' | 'complete'

/**
 * Validate that a FID file contains the evidence required to consider a
 * Perfection Loop phase complete (FID-2026-0818-004). Pure and
 * section-conditional; presence-check only — this is the floor the drive
 * supervisor advances on, never the truth layer (the Verifier's
 * EHEL-injected evidence and the Adversary's citation resolution are the
 * truth layers; they already exist). Returns an array of errors (empty =
 * the phase's evidence is present).
 *
 * Expected evidence per phase:
 * - `red`        — a `### RED` section carrying `file:line`/grep evidence.
 * - `green`      — a `### GREEN` section (the fix) with no unanswered
 *                  `### Missed Questions` (every question answered with a
 *                  `Decision`).
 * - `audit`      — a `### Code Verification Evidence` section with gate
 *                  output AND a Verifier verdict.
 * - `adversarial`— an Adversary verdict block.
 * - `complete`   — `**Status:** closed`.
 */
export function validateFidPhaseEvidence(
  content: string,
  phase: FidEvidencePhase,
): string[] {
  const errors: string[] = []
  const section = (heading: string): string | undefined =>
    content.match(new RegExp(`${heading}[\\s\\S]*?(?=### |## |$)`))?.[0]

  switch (phase) {
    case 'red': {
      const red = section('### RED')
      if (!red) {
        errors.push('RED phase missing a `### RED` section')
      } else if (!/file:line|:\d+/.test(red)) {
        errors.push('RED phase missing file:line evidence')
      }
      break
    }
    case 'green': {
      const green = section('### GREEN')
      if (!green) {
        errors.push('GREEN phase missing a `### GREEN` section')
      }
      const missed = section('### Missed Questions')
      if (missed) {
        const questions = missed.match(/^\d+\./gm) ?? []
        const decisions = missed.match(/Decision(?::| \()/g) ?? []
        if (questions.length > decisions.length) {
          errors.push(
            `GREEN phase has ${questions.length - decisions.length} unanswered Missed Question(s)`,
          )
        }
      }
      break
    }
    case 'audit': {
      const evidence = section('### Code Verification Evidence')
      if (!evidence) {
        errors.push('AUDIT phase missing `### Code Verification Evidence`')
      } else if (!/PASS|pass|✓|0 fail|exit 0/.test(evidence)) {
        errors.push('AUDIT evidence missing gate output (no PASS / exit 0)')
      }
      if (!/Verifier|verdict/i.test(content)) {
        errors.push('AUDIT phase missing a Verifier verdict')
      }
      break
    }
    case 'adversarial': {
      if (!/Adversary|ADVERSARIAL|verdict/i.test(content)) {
        errors.push('ADVERSARIAL phase missing an Adversary verdict')
      }
      break
    }
    case 'complete': {
      const status = content.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1]?.trim()
      if (status !== 'closed') {
        errors.push(
          `COMPLETE requires **Status:** closed (found ${status ?? 'missing'})`,
        )
      }
      break
    }
  }
  return errors
}
