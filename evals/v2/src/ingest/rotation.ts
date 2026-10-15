/**
 * FID-2026-0824-019 — deterministic Tier-3 rotation registry.
 *
 * Selection is a pure function of (release version, corpus): each candidate
 * is scored by sha256(`${version}::${task_id}`) and the top `perStratum`
 * per category/difficulty stratum win. Same version ⇒ same set, so release
 * runs stay reproducible; different versions rotate the set, blunting
 * memorization (blueprint Honest Boundaries: rotation reduces but never
 * eliminates contamination).
 */

import { createHash } from 'node:crypto'

export interface RotationCandidate {
  task_id: string
  category: string
  difficulty: string
}

/** Blueprint risk register: ~2M tokens for a full capability run. */
export const DEFAULT_RELEASE_TOKEN_CEILING = 2_000_000
export const DEFAULT_TOKENS_PER_TASK = 100_000

/** Deterministic selection score for one candidate under one version. */
export function rotationScore(version: string, taskId: string): string {
  return createHash('sha256').update(`${version}::${taskId}`).digest('hex')
}

/**
 * Select up to `perStratum` tasks per `${category}/${difficulty}` stratum,
 * ranked by rotation score (ties broken by task_id). Output is sorted by
 * task_id so callers observe one canonical order.
 */
export function selectForRelease<T extends RotationCandidate>(
  tasks: readonly T[],
  version: string,
  perStratum = 2,
): T[] {
  const strata = new Map<string, T[]>()
  for (const task of tasks) {
    const key = `${task.category}/${task.difficulty}`
    const bucket = strata.get(key)
    if (bucket === undefined) {
      strata.set(key, [task])
    } else {
      bucket.push(task)
    }
  }

  const selected: T[] = []
  for (const bucket of strata.values()) {
    const ranked = [...bucket].sort((a, b) => {
      const scoreA = rotationScore(version, a.task_id)
      const scoreB = rotationScore(version, b.task_id)
      if (scoreA !== scoreB) return scoreA < scoreB ? -1 : 1
      return a.task_id.localeCompare(b.task_id, 'en')
    })
    selected.push(...ranked.slice(0, Math.max(1, perStratum)))
  }
  return selected.sort((a, b) => a.task_id.localeCompare(b.task_id, 'en'))
}

export function estimateTokens(
  taskCount: number,
  tokensPerTask = DEFAULT_TOKENS_PER_TASK,
): number {
  return Math.max(0, taskCount) * tokensPerTask
}

/**
 * Hard ceiling enforcement — throws when the estimate breaches the limit so
 * the release gate fails closed before any token spend.
 */
export function assertTokenCeiling(
  tokenEstimate: number,
  ceiling = DEFAULT_RELEASE_TOKEN_CEILING,
): void {
  if (!Number.isSafeInteger(tokenEstimate) || tokenEstimate < 0) {
    throw new Error(`invalid token estimate: ${tokenEstimate}`)
  }
  if (tokenEstimate > ceiling) {
    throw new Error(
      `Tier-3 token estimate ${tokenEstimate} exceeds ceiling ${ceiling} — shrink the rotated corpus or raise the documented ceiling`,
    )
  }
}
