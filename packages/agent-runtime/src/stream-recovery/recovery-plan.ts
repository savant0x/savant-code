/**
 * FID-2026-1005-007 — the bounded recovery plan (converged design decision
 * 3). Every parameter is a hard number (the measured reference design), and
 * settings may only NARROW these defaults, never exceed them. The budget
 * arithmetic is pure and every produced figure is finite.
 */

/** 1 recovery per logical turn ⇒ 2 physical requests total (hard counter). */
export const RECOVERY_MAX_PHYSICAL_REQUESTS = 2
export const RECOVERY_CHECKPOINT_CAP_CHARS = 131_072
export const RECOVERY_OUTPUT_CAP_TOKENS = 8_192
export const RECOVERY_SEGMENT_BUDGET_MS = 180_000
export const RECOVERY_TOTAL_BUDGET_MS = 480_000
export const RECOVERY_MIN_REMAINING_TOKENS = 512

export interface RecoveryBudget {
  elapsedMs: number
  remainingTokenBudget: number
}

export interface RecoveryPlan {
  go: boolean
  skipReason?: string
  /** Tail-trimmed checkpoint: the most recent reasoning survives (the
   *  request demands the conclusion, so the tail is the informative end). */
  checkpoint: string
  outputCapTokens: number
  segmentBudgetMs: number
}

/**
 * Decide one bounded recovery. Pure: skip below minimum token headroom or
 * without time budget; every figure finite by construction.
 */
export function planRecovery(
  checkpoint: string,
  budget: RecoveryBudget,
): RecoveryPlan {
  const availableTokens = Number.isFinite(budget.remainingTokenBudget)
    ? Math.max(0, Math.floor(budget.remainingTokenBudget))
    : 0
  const base = {
    checkpoint:
      checkpoint.length > RECOVERY_CHECKPOINT_CAP_CHARS
        ? checkpoint.slice(checkpoint.length - RECOVERY_CHECKPOINT_CAP_CHARS)
        : checkpoint,
    outputCapTokens: Math.min(RECOVERY_OUTPUT_CAP_TOKENS, availableTokens),
    segmentBudgetMs: 0,
  }
  if (!Number.isFinite(budget.remainingTokenBudget)) {
    return { ...base, go: false, skipReason: 'token budget is not finite' }
  }
  if (budget.remainingTokenBudget < RECOVERY_MIN_REMAINING_TOKENS) {
    return { ...base, go: false, skipReason: 'fewer than 512 tokens of budget remain' }
  }
  const remainingMs = RECOVERY_TOTAL_BUDGET_MS - budget.elapsedMs
  const segmentBudgetMs = Math.min(RECOVERY_SEGMENT_BUDGET_MS, remainingMs)
  if (!Number.isFinite(segmentBudgetMs) || segmentBudgetMs <= 0) {
    return { ...base, go: false, skipReason: 'no wall-clock budget remains' }
  }
  return { ...base, go: true, segmentBudgetMs }
}

/**
 * The recovery prompt: checkpoint + original input, demanding the finished
 * answer conclusion-first, with reasoning replay forbidden.
 */
export function buildRecoveryPrompt(
  originalInput: string,
  checkpoint: string,
): string {
  return [
    'The previous turn was cut off mid-reasoning before any answer was produced.',
    'Use the reasoning below ONLY as a checkpoint of work already done — do not repeat it.',
    '',
    '[reasoning checkpoint]',
    checkpoint,
    '[/reasoning checkpoint]',
    '',
    '[original request]',
    originalInput,
    '[/original request]',
    '',
    'Produce the finished answer now. Start with the conclusion, then only the',
    'supporting detail needed to justify it.',
  ].join('\n')
}
