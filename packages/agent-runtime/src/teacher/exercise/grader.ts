/**
 * Exercise grader interfaces — FID-2026-0813-014.
 *
 * The headless engine orchestrates grading but owns no grading policy. The
 * concrete equivalence (FID-016) and detection (FID-017) graders implement
 * these interfaces; the vertical-slice test injects deterministic fixtures.
 * The engine runs the hidden tests through the sandbox and hands the grader
 * the structured `SandboxResult`, so `unavailable` is visible to the engine.
 */
import type { SandboxBackend } from '../sandbox'
import type {
  CritiqueGrade,
  CritiqueRubric,
  CritiqueSubmission,
  DetectionResult,
  EquivalenceResult,
  MutationContract,
  PrivateChallengePack,
  PublicChallenge,
  SandboxResult,
} from '@savant-code/common/teacher'

/** Produces the learner's steered solution source. The real Forge lives behind
 *  this seam so the engine never talks to the agent loop directly. */
export type ForgeFn = (
  steering: string,
  challenge: PublicChallenge,
) => Promise<string>

export type EquivalenceGradeInput = {
  solutionSource: string
  sandboxResult: SandboxResult
  challenge: PublicChallenge
  pack: PrivateChallengePack
}

export interface EquivalenceGrader {
  readonly graderVersion: string
  grade(input: EquivalenceGradeInput): Promise<EquivalenceResult>
}

export type DetectionInjectInput = {
  /** The known-good source; private and never crossed to the learner. */
  knownGoodSource: string
  pack: PrivateChallengePack
}

export type DetectionInjectResult = {
  mutation: MutationContract
  mutatedSource: string
}

export type DetectionGradeInput = {
  critique: CritiqueSubmission
  mutation: MutationContract
  rubric: CritiqueRubric
}

export interface DetectionGrader {
  readonly graderVersion: string
  /** Deterministically derive the mutated source for this attempt. */
  inject(input: DetectionInjectInput): DetectionInjectResult
  /** Grade the learner critique against the injected mutation contract. */
  grade(input: DetectionGradeInput): DetectionResult
}

/** Bounded adjudication of natural-language critique equivalence. */
export type AdjudicateFn = (input: {
  critique: CritiqueSubmission
  mutation: MutationContract
  rubric: CritiqueRubric
}) => CritiqueGrade

export type ExerciseDeps = {
  challenge: PublicChallenge
  pack: PrivateChallengePack
  sandbox: SandboxBackend
  forge: ForgeFn
  equivalence: EquivalenceGrader
  detection: DetectionGrader
  /** Private known-good source used only by the trusted detection grader. */
  knownGoodSource: string
  /** Injectable clock for deterministic timestamps in tests. */
  now?: () => Date
}
