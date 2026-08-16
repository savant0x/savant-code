/**
 * Detection grader — FID-2026-0813-017.
 *
 * One deterministic mutation per attempt from a versioned catalog, a fixed flaw
 * contract, structured critique evidence, and bounded adjudication. The
 * deterministic precheck extracts objective evidence (concept match + required
 * evidence coverage); natural-language equivalence is resolved by an injectable
 * Adversary bounded by the mutation contract. The injector never invents
 * untestable random defects.
 */

import { applyMutation, selectMutation } from '../mutation'

import type {
  DetectionGradeInput,
  DetectionGrader,
  DetectionInjectInput,
  DetectionInjectResult,
} from '../exercise/grader'
import type {
  CritiqueGrade,
  CritiqueRubric,
  CritiqueSubmission,
  DetectionResult,
  MutationContract,
} from '@savant-code/common/teacher'

export const DETECTION_GRADER_VERSION = 'detection-v1'

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function containsAny(text: string, concepts: string[]): boolean {
  const lower = text.toLowerCase()
  return concepts.some((concept) => lower.includes(concept.toLowerCase()))
}

function combinedText(critique: CritiqueSubmission): string {
  return [
    critique.statement,
    critique.location ?? '',
    critique.witness ?? '',
    critique.impact ?? '',
  ].join(' ')
}

/** Deterministic precheck: concept match + required evidence coverage. */
export function gradeCritique(
  critique: CritiqueSubmission,
  mutation: MutationContract,
  rubric: CritiqueRubric,
): CritiqueGrade {
  const conceptMatched = containsAny(
    combinedText(critique),
    mutation.acceptableConcepts,
  )
  const evidenceCoverage = {
    location: Boolean(critique.location?.trim()),
    witness: Boolean(critique.witness?.trim()),
    impact: Boolean(critique.impact?.trim()),
  }
  const requiredCovered = rubric.requiredEvidence.every(
    (dimension) => evidenceCoverage[dimension],
  )
  const identified = conceptMatched && requiredCovered

  const statementTokens = tokens(critique.statement).length
  let reasonCode: CritiqueGrade['reasonCode']
  if (identified) reasonCode = 'identified'
  else if (conceptMatched) reasonCode = 'partial'
  else if (statementTokens < 4) reasonCode = 'vague'
  else reasonCode = 'unrelated'

  return {
    mutationId: mutation.mutationId,
    identified,
    evidenceCoverage,
    locationMatch: evidenceCoverage.location,
    witnessMatch: evidenceCoverage.witness,
    impactMatch: evidenceCoverage.impact,
    confidence: identified ? 1 : conceptMatched ? 0.5 : 0,
    reasonCode,
    graderVersion: DETECTION_GRADER_VERSION,
  }
}

export class CatalogDetectionGrader implements DetectionGrader {
  readonly graderVersion = DETECTION_GRADER_VERSION

  inject(input: DetectionInjectInput): DetectionInjectResult {
    const mutation = selectMutation(
      input.pack.mutationContracts,
      input.knownGoodSource,
    )
    const { source } = applyMutation(input.knownGoodSource, mutation)
    return { mutation, mutatedSource: source }
  }

  grade(input: DetectionGradeInput): DetectionResult {
    return {
      mutationId: input.mutation.mutationId,
      grade: gradeCritique(input.critique, input.mutation, input.rubric),
      graderVersion: this.graderVersion,
    }
  }
}

export const catalogDetectionGrader: DetectionGrader =
  new CatalogDetectionGrader()

export type LabeledCritiqueCase = {
  critique: CritiqueSubmission
  mutation: MutationContract
  rubric: CritiqueRubric
  expectedIdentified: boolean
}

export type CalibrationReport = {
  total: number
  correctAcceptances: number
  falseAcceptances: number
  falseRejections: number
  correctRejections: number
  acceptanceRateOfCorrect: number
  acceptanceRateOfVague: number
}

/**
 * Measure detection calibration over a labeled set. V1 gates are declared in
 * FID-017 Loop 4: ≥95% acceptance of correct critiques and ≤5% acceptance of
 * vague/unrelated critiques. Failure disables progression rather than hiding.
 */
export function evaluateCalibration(
  cases: LabeledCritiqueCase[],
  gradeFn: (input: DetectionGradeInput) => DetectionResult,
): CalibrationReport {
  let correctTotal = 0
  let correctAccepted = 0
  let incorrectTotal = 0
  let incorrectAccepted = 0

  for (const item of cases) {
    const result = gradeFn({
      critique: item.critique,
      mutation: item.mutation,
      rubric: item.rubric,
    })
    if (item.expectedIdentified) {
      correctTotal++
      if (result.grade.identified) correctAccepted++
    } else {
      incorrectTotal++
      if (result.grade.identified) incorrectAccepted++
    }
  }

  return {
    total: cases.length,
    correctAcceptances: correctAccepted,
    falseAcceptances: incorrectAccepted,
    falseRejections: correctTotal - correctAccepted,
    correctRejections: incorrectTotal - incorrectAccepted,
    acceptanceRateOfCorrect: correctTotal ? correctAccepted / correctTotal : 1,
    acceptanceRateOfVague: incorrectTotal
      ? incorrectAccepted / incorrectTotal
      : 0,
  }
}
