/**
 * Headless exercise engine — FID-2026-0813-014.
 */
export { ExerciseEngine } from './engine'
export type {
  AdjudicateFn,
  DetectionGradeInput,
  DetectionGrader,
  DetectionInjectInput,
  DetectionInjectResult,
  EquivalenceGradeInput,
  EquivalenceGrader,
  ExerciseDeps,
  ForgeFn,
} from './grader'
export {
  assertTransition,
  createAttemptId,
  eventTypeForPhase,
  type ExercisePhase,
  type PhaseTransitionListener,
  type TerminalState,
} from './state'
