import type { LadderRung } from '@savant-code/common/types/auto-drive'

/**
 * FID-2026-0818-005: Auto Drive self-healing ladder router.
 *
 * Routes a mid-run failure to a deterministic rung — never to a question. The
 * router reads already-existing signals (EHEL receipts, Verifier/Adversary
 * verdicts, circuit-breaker counters) and maps each failure class to a rung
 * that preserves enforcement:
 *
 *   1 mechanical retry (EHEL block / compile error — same phase, correction)
 *   2 standard FSM (Verifier FAIL / Adversary refutation → SELF_CORRECT)
 *   3 re-analysis (the same issue recurs → RED re-entry, fresh agents)
 *   4 new-FID-on-discovery (out-of-scope issue → tracked FID, queue append)
 *   5 documented default (spec gap → most-robust default recorded in GREEN)
 *   6 context compaction (L0-L3)
 *   7 terminal block (circuit breaker / budget / genuine impasse → report)
 */

export type FailureKind =
  | 'mechanical'
  | 'verdict'
  | 'recurrence'
  | 'discovery'
  | 'spec-gap'
  | 'context'
  | 'terminal'

export type FailureSignal = {
  kind: FailureKind
  /** Stable issue signature (child 005: keyed by issue + rung). */
  issueSignature?: string
  /** Consecutive occurrences of this exact signature at this rung. */
  consecutiveOccurrences?: number
}

export const MAX_ITERATION_COUNT = 10
export const OSCILLATION_STRIKES = 3

/**
 * Map a failure signal + circuit-breaker counters to a ladder rung. Terminal
 * (rung 7) wins whenever a breaker trips or the signal is explicitly terminal;
 * otherwise the signal's kind maps to its natural rung. Recurrence is only
 * escalated to terminal after the signature survives a re-analysis
 * (OSCILLATION_STRIKES), per the FID's "breaker fires only after a rethink".
 */
export function classifyFailure(
  signal: FailureSignal,
  counters: {
    iterationCount: number
    budgetExhausted: boolean
  },
): LadderRung {
  if (signal.kind === 'terminal') return 7
  if (counters.budgetExhausted) return 7
  if (counters.iterationCount >= MAX_ITERATION_COUNT) return 7
  if (
    signal.kind === 'recurrence' &&
    (signal.consecutiveOccurrences ?? 0) >= OSCILLATION_STRIKES
  ) {
    return 7
  }

  switch (signal.kind) {
    case 'mechanical':
      return 1
    case 'verdict':
      return 2
    case 'recurrence':
      return 3
    case 'discovery':
      return 4
    case 'spec-gap':
      return 5
    case 'context':
      return 6
  }
}

/** Human-readable rung name for the Run Log. */
export function rungLabel(rung: LadderRung): string {
  const labels: Record<LadderRung, string> = {
    1: 'mechanical-retry',
    2: 'self-correct',
    3: 're-analysis',
    4: 'new-fid-discovery',
    5: 'documented-default',
    6: 'context-compaction',
    7: 'terminal-block',
  }
  return labels[rung]
}
