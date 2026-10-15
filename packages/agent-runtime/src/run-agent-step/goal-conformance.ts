import type {
  Criterion,
  CriterionCheckStrategy,
  CriterionResult,
} from '@savant-code/common/types/auto-drive'

/**
 * FID-2026-0818-006: Auto Drive completion certification — goal-conformance
 * audit. The operator's own acceptance criteria (approved at entry, child 002)
 * are the checklist; each criterion is checked mechanically where possible and
 * a failed criterion becomes a gap → new FID (child 005 rung 4). The `judgment`
 * strategy always routes to the Scribe for an attributed cross-check — never
 * an asserted pass/fail.
 */

export type ConformanceEvidence = {
  /** `/verify` aggregate exit code (0 = all four workspaces clean). */
  typecheckExitCode: number
  /** Optional test-suite exit code for a workspace. */
  testExitCode?: number
  fileExists: (target: string) => boolean
  grepMatches: (pattern: string) => number
}

export function evaluateCriterion(
  criterion: Criterion,
  evidence: ConformanceEvidence,
): CriterionResult {
  switch (criterion.strategy) {
    case 'typecheck': {
      const pass = evidence.typecheckExitCode === 0
      return {
        criterionId: criterion.id,
        strategy: criterion.strategy,
        status: pass ? 'pass' : 'fail',
        evidence: `typecheck exit ${evidence.typecheckExitCode}`,
      }
    }
    case 'test-suite': {
      const code = evidence.testExitCode ?? 1
      return {
        criterionId: criterion.id,
        strategy: criterion.strategy,
        status: code === 0 ? 'pass' : 'fail',
        evidence: `test-suite exit ${code}`,
      }
    }
    case 'feature-grep': {
      const matches = evidence.grepMatches(criterion.target)
      return {
        criterionId: criterion.id,
        strategy: criterion.strategy,
        status: matches > 0 ? 'pass' : 'fail',
        evidence: `${matches} grep match(es) for "${criterion.target}"`,
      }
    }
    case 'file-existence': {
      const exists = evidence.fileExists(criterion.target)
      return {
        criterionId: criterion.id,
        strategy: criterion.strategy,
        status: exists ? 'pass' : 'fail',
        evidence: exists
          ? `"${criterion.target}" exists`
          : `"${criterion.target}" missing`,
      }
    }
    case 'judgment': {
      return {
        criterionId: criterion.id,
        strategy: criterion.strategy,
        status: 'gap',
        evidence: 'requires Scribe cross-check (attributed, not asserted)',
      }
    }
  }
}

/**
 * Run the audit over a criterion registry. Returns the per-criterion results
 * plus the failed/gap criteria that must become new FIDs (rung 4).
 */
export function auditCriteria(
  criteria: readonly Criterion[],
  evidence: ConformanceEvidence,
): { results: CriterionResult[]; gaps: Criterion[] } {
  const results = criteria.map((c) => evaluateCriterion(c, evidence))
  const gaps = criteria.filter((c, i) => results[i].status !== 'pass')
  return { results, gaps }
}

/** All check strategies — the registry vocabulary (exported for tests/docs). */
export const CRITERION_CHECK_STRATEGIES: readonly CriterionCheckStrategy[] = [
  'test-suite',
  'typecheck',
  'feature-grep',
  'file-existence',
  'judgment',
]

/**
 * Build the criterion registry from the operator's approved acceptance
 * criteria (the `<drive-lock>` `acceptanceCriteria` string[], which is the
 * same text the master FID records — single source of truth). Strategy
 * assignment is a deterministic heuristic: criteria that name a workspace
 * test/typecheck map to the matching mechanical check; a quoted path maps to
 * file-existence; everything else maps to feature-grep over the criterion's
 * own tokens (Law 4 production-entry-point pattern). The heuristic is a
 * floor — `judgment` criteria (Scribe cross-check) are added by the
 * certification stage for CHANGELOG-vs-plan coverage.
 */
export function buildCriterionRegistry(
  acceptanceCriteria: readonly string[],
): Criterion[] {
  return acceptanceCriteria.map((text, index) => ({
    id: `c${index + 1}`,
    text,
    strategy: inferStrategy(text),
    target: inferTarget(text),
  }))
}

function inferStrategy(text: string): CriterionCheckStrategy {
  const lower = text.toLowerCase()
  if (/\btest(s|suit)?\b/.test(lower) && !/typecheck|\/verify/.test(lower)) {
    return 'test-suite'
  }
  if (/typecheck|\/verify|tsc|build\b/.test(lower)) {
    return 'typecheck'
  }
  const quoted = text.match(/["']([^"']+)["']/)
  if (quoted && /[./]/.test(quoted[1])) {
    return 'file-existence'
  }
  return 'feature-grep'
}

function inferTarget(text: string): string {
  const quoted = text.match(/["']([^"']+)["']/)
  if (quoted) return quoted[1]
  // Grep target: the longest token that looks like an identifier/path.
  const tokens = text.split(/\s+/).filter((t) => /[A-Za-z0-9_./-]/.test(t))
  const pathy = tokens.find((t) => t.includes('.') || t.includes('/'))
  return pathy ?? tokens[0] ?? text
}

/**
 * Emit a discovery FID draft for a failed/gap criterion (child 005 rung 4 →
 * child 006). The gap becomes a queue item with the criterion as its
 * acceptance target; the drive loop resumes and re-audits at the next
 * zero-open-FID.
 */
export function gapToFidDraft(
  gap: Criterion,
  masterId: string,
): {
  fileName: string
  content: string
} {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const slug = gap.id
  return {
    fileName: `FID-${day}-999-${slug}-gap.md`,
    content: [
      '# FID — Auto Drive gap FID',
      '',
      '**Status:** created',
      '**Master FID:** ' + masterId,
      '',
      '## Summary',
      '',
      'Auto Drive completion-certification gap: an approved acceptance',
      'criterion was unmet at zero-open-FID.',
      '',
      '## Step Status',
      '',
      '- [ ] 1. Satisfy the acceptance criterion — blocked::awaiting drive resume',
      '',
      '## Acceptance Criterion',
      '',
      `- (${gap.strategy}) ${gap.text}`,
      '',
    ].join('\n'),
  }
}
