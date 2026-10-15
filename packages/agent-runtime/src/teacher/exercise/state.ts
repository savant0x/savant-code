/**
 * Exercise state machine — FID-2026-0813-014.
 *
 * The headless engine owns phase transitions; the UI only renders events.
 * Transitions are forward-only through the lifecycle, with an early exit to
 * `result` (terminal) allowed from any phase for cancellation/unavailability.
 */
import { randomUUID } from 'node:crypto'

import type { AttemptEvent, CompletionState } from '@savant-code/common/teacher'

export type ExercisePhase =
  | 'ready'
  | 'steering_submitted'
  | 'forge_running'
  | 'sandbox_running'
  | 'equivalence_review'
  | 'detection_review'
  | 'learner_critique'
  | 'adjudication'
  | 'result'

export type TerminalState = Exclude<CompletionState, never>

const PHASE_ORDER: readonly ExercisePhase[] = [
  'ready',
  'steering_submitted',
  'forge_running',
  'sandbox_running',
  'equivalence_review',
  'detection_review',
  'learner_critique',
  'adjudication',
  'result',
]

/** Guard a phase transition: forward one step, or early exit to `result`. */
export function assertTransition(from: ExercisePhase, to: ExercisePhase): void {
  const fromIndex = PHASE_ORDER.indexOf(from)
  const toIndex = PHASE_ORDER.indexOf(to)
  const forwardOne = toIndex === fromIndex + 1
  const toResult = to === 'result'
  if (!forwardOne && !toResult) {
    throw new Error(`invalid exercise transition: ${from} -> ${to}`)
  }
}

/** The AttemptEvent.type emitted on entering a phase (no event for `ready`). */
export function eventTypeForPhase(
  phase: ExercisePhase,
): AttemptEvent['type'] | null {
  switch (phase) {
    case 'steering_submitted':
      return 'steering_submitted'
    case 'forge_running':
      return 'forge_running'
    case 'sandbox_running':
      return 'sandbox_running'
    case 'equivalence_review':
      return 'equivalence_review'
    case 'detection_review':
      return 'detection_review'
    case 'learner_critique':
      return 'learner_critique'
    case 'adjudication':
      return 'adjudication'
    default:
      return null
  }
}

/** A fresh, immutable attempt id. Retries create new ids; nothing overwrites. */
export function createAttemptId(): string {
  return randomUUID()
}

export type PhaseTransitionListener = (event: AttemptEvent) => void
