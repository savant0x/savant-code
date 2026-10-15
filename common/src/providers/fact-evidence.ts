/**
 * Provider fact evidence (FID-2026-1005-009).
 *
 * Provenance as typed metadata beside the fact, not prose elsewhere
 * (converged design decision 1). Two pure rule sets:
 *
 * - `validateFactEvidence` — the evidence RECORD's shape: a closed class
 *   enum, a named source, and `console-verified` requiring a date plus the
 *   witness who saw it (the reference evidence classes).
 * - `changedFactsNeedingEvidence` — the changed-fact rule (decision 2): a
 *   diff against the last generated baseline that ADDS OR CHANGES a numeric
 *   fact without an evidence record is a validation failure naming the
 *   fact. A missing/unparseable baseline grandfathers everything
 *   (honest default: "none are yet evidenced", never "all are").
 *
 * No I/O, no registry imports — this module is pure rules so both
 * `validate.ts` and the docs-count drift script can share one truth
 * (Law 13) without a cycle.
 */
import type { FactEvidence } from './types'

/** Evidence classes (closed). Mirrors the reference FREE_TIERS methodology. */
export const FACT_EVIDENCE_CLASSES = [
  'public-page',
  'api-public',
  'console-verified',
  'reported-unverified',
] as const

/**
 * Shape-rule for one evidence record. Returns human-readable problems;
 * empty means the record is well-formed.
 */
export function validateFactEvidence(
  at: string,
  evidence: FactEvidence,
): string[] {
  const problems: string[] = []
  if (!FACT_EVIDENCE_CLASSES.includes(evidence.class)) {
    problems.push(
      `'${at}' evidence has invalid class: ${String(evidence.class)}`,
    )
  }
  if (evidence.source.trim() === '') {
    problems.push(`'${at}' evidence must name its source (page/endpoint)`)
  }
  if (evidence.class === 'console-verified') {
    // The figure is only visible behind an account — the record MUST say
    // who saw it and when. The gate checks the record, not the claim.
    if (evidence.verified === undefined || evidence.verified.trim() === '') {
      problems.push(
        `'${at}' console-verified evidence requires a verification date`,
      )
    }
    if (evidence.witness === undefined || evidence.witness.trim() === '') {
      problems.push(
        `'${at}' console-verified evidence requires a witness (who saw it)`,
      )
    }
  }
  return problems
}

/** One numeric fact extracted from a provider surface. */
export interface FactRecord {
  /** Stable identity, e.g. `chatanywhere.catalog.model-count`. */
  key: string
  /** The fact's numeric (or string) value. */
  value: string | number
  /** Provenance attached at the source (registry `evidence` metadata). */
  evidence?: FactEvidence
}

/**
 * The changed-fact rule. Compares current facts to the last generated
 * baseline; a fact that is NEW or CHANGED without an evidence record is a
 * problem naming the fact and its old → new values. Untouched facts cost
 * nothing. A missing baseline means "nothing is evidenced yet" — the
 * bootstrap run records it and no failures are raised.
 */
export function changedFactsNeedingEvidence(
  current: readonly FactRecord[],
  baseline: readonly FactRecord[] | undefined,
): string[] {
  if (baseline === undefined) return []
  const problems: string[] = []
  const baselineByKey = new Map(baseline.map((fact) => [fact.key, fact]))
  for (const fact of current) {
    const prior = baselineByKey.get(fact.key)
    const changed = prior === undefined || prior.value !== fact.value
    if (!changed) continue
    if (fact.evidence !== undefined) {
      problems.push(...validateFactEvidence(fact.key, fact.evidence))
      continue
    }
    const delta =
      prior === undefined
        ? `new fact (no baseline value) → ${String(fact.value)}`
        : `${String(prior.value)} → ${String(fact.value)}`
    problems.push(
      `'${fact.key}' changed without evidence (${delta}) — add an ` +
        `\`evidence\` record naming the source, or restore the baseline value`,
    )
  }
  return problems
}
