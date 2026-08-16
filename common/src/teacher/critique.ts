/**
 * Teacher critique contracts — FID-2026-0813-012/017.
 *
 * A learner critique must identify the flaw's behavior and provide location,
 * witness, or impact evidence. The Adversary adjudicates only within the
 * mutation contract; the grade is structured, not a free-text binary.
 */

export type CritiqueSubmission = {
  /** The learner's stated defect + evidence, in free text. */
  statement: string
  /** Optional structured evidence dimensions. */
  location?: string
  witness?: string
  impact?: string
}

export type EvidenceCoverage = {
  location: boolean
  witness: boolean
  impact: boolean
}

export type ReasonCode =
  'identified' | 'partial' | 'vague' | 'unrelated' | 'uncalibrated'

export type CritiqueGrade = {
  mutationId: string
  identified: boolean
  evidenceCoverage: EvidenceCoverage
  locationMatch: boolean
  witnessMatch: boolean
  impactMatch: boolean
  /** 0..1 adjudication confidence. */
  confidence: number
  reasonCode: ReasonCode
  graderVersion: string
}
