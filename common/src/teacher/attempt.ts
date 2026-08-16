/**
 * Teacher attempt contracts — FID-2026-0813-012/014.
 *
 * Each attempt is immutable: retries create new attempt ids and results are
 * never silently overwritten. Evidence is recorded as hashes, never raw
 * critique text.
 */
import type { CritiqueGrade } from './critique'
import type { TestSummary } from './sandbox'

export type CompletionState = 'passed' | 'failed' | 'unavailable' | 'cancelled'

export type EquivalenceResult = {
  passed: boolean
  testSummary: TestSummary
  antiCheat: {
    passed: boolean
    findings: string[]
  }
  graderVersion: string
}

export type DetectionResult = {
  mutationId: string
  grade: CritiqueGrade
  graderVersion: string
}

export type EvidenceHashes = {
  submissionHash: string
  sandboxResultHash: string
  equivalenceHash: string
  detectionHash: string
}

/** Bounded lifecycle events surfaced to the (read-only) learner view. */
export type AttemptEvent =
  | { type: 'steering_submitted'; timestamp: string }
  | { type: 'forge_running'; timestamp: string }
  | { type: 'sandbox_running'; timestamp: string }
  | { type: 'equivalence_review'; timestamp: string }
  | { type: 'detection_review'; timestamp: string }
  | { type: 'learner_critique'; timestamp: string }
  | { type: 'adjudication'; timestamp: string }
  | { type: 'result'; timestamp: string; state: CompletionState }

export type AttemptResult = {
  attemptId: string
  challengeHash: string
  corpusVersion: string
  sandboxPolicyVersion: string
  graderVersion: string
  equivalenceResult: EquivalenceResult
  detectionResult: DetectionResult
  evidenceHashes: EvidenceHashes
  completionState: CompletionState
  timestamp: string
}
