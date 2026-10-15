/**
 * FID-2026-1006-002 WP7 + WP8: loop guard rails with a pure decision core.
 *
 * Adopted from the pi harness orchestrator. Three non-progress patterns the
 * step loop cannot see while it is inside them, made visible as pure
 * functions:
 *
 *  1. stale cycle — the same role:event cycle repeating. Trying cycle lengths
 *     2…n/3 and requiring `repeats` (default 3) identical full cycles is what
 *     makes "the loop is going in circles" a decision instead of a feeling.
 *  2. per-role activation budget — a cap on how many times one role may be
 *     activated, beside the global iteration cap. A preset whose roles ping
 *     each other can stay under the global cap forever.
 *  3. single-task injection — a checklist is handed to the model ONE unchecked
 *     task at a time instead of in full, so a long plan cannot be skimmed.
 *
 * WP8: the orchestration decision is ONE pure function,
 * `determineNextAction(context)`, taking `now: number` on the context and
 * returning a discriminated action union. No clock reads, no I/O, no module
 * state — the same context always yields the same action, which is why the
 * convention test can assert both that behaviour and (statically, by reading
 * this file's source) that this module contains no clock or I/O access at all.
 */

export type LoopEvent = {
  /** The role that acted. */
  role: string
  /** The event it acted on. */
  event: string
}

export type StaleCycleVerdict = {
  stale: boolean
  /** The shortest repeating cycle length that was proven, when stale. */
  cycleLength?: number
  /** How many identical full cycles were required (and found). */
  repeats?: number
}

/** Default number of identical full cycles that mean "complete, not stuck". */
export const STALE_CYCLE_REPEATS = 3

/** Shortest cycle length considered — a 1-cycle is a single repeated step. */
export const MIN_STALE_CYCLE_LENGTH = 2

function sameEvent(a: LoopEvent, b: LoopEvent): boolean {
  return a.role === b.role && a.event === b.event
}

/**
 * Whether the tail of `history` is one cycle repeated `repeats` times.
 *
 * Cycle lengths 2…floor(n / repeats) are tried shortest-first, so the verdict
 * names the tightest cycle that explains the tail. A cycle whose last
 * repetition differs anywhere is NOT stale — that is the whole point: a
 * near-cycle is progress, and treating it as a loop would stop real work.
 */
export function detectStaleCycle(
  history: readonly LoopEvent[],
  options: { repeats?: number } = {},
): StaleCycleVerdict {
  const repeats = options.repeats ?? STALE_CYCLE_REPEATS
  const n = history.length
  if (repeats < 2) return { stale: false }
  const maxCycleLength = Math.floor(n / repeats)
  for (
    let cycleLength = MIN_STALE_CYCLE_LENGTH;
    cycleLength <= maxCycleLength;
    cycleLength += 1
  ) {
    const windowStart = n - cycleLength * repeats
    let identical = true
    for (let offset = 0; offset < cycleLength && identical; offset += 1) {
      const first = history[windowStart + offset]
      for (let repeat = 1; repeat < repeats && identical; repeat += 1) {
        const candidate = history[windowStart + offset + repeat * cycleLength]
        if (!sameEvent(first, candidate)) identical = false
      }
    }
    if (identical) return { stale: true, cycleLength, repeats }
  }
  return { stale: false }
}

export type RoleBudget = {
  /** Activations this role is allowed. */
  limit: number
  /** Activations it has already had. */
  activations: number
}

/** The budget verdict for one role (pure; never mutates the budget). */
export function roleBudgetState(budget: RoleBudget): {
  allowed: boolean
  remaining: number
  exhausted: boolean
} {
  const remaining = Math.max(0, budget.limit - budget.activations)
  return {
    allowed: remaining > 0,
    remaining,
    exhausted: remaining <= 0,
  }
}

const UNCHECKED_TASK = /^\s*[-*]\s*\[ \]\s+(.*\S)\s*$/

/**
 * The first unchecked task in a markdown checklist, or null when every item is
 * checked (or there is none). A checked `- [x]` item is never returned, and an
 * empty checkbox is skipped rather than handed to the model as a blank task.
 */
export function nextChecklistTask(markdown: string): string | null {
  for (const line of markdown.split(/\r?\n/)) {
    const match = UNCHECKED_TASK.exec(line)
    if (match) return match[1]
  }
  return null
}

export type DetermineNextActionContext = {
  /** Injected clock, in milliseconds. */
  now: number
  /** When the run started, on the same clock. */
  startedAt: number
  /** Wall-clock budget for the run; omitted means no deadline. */
  deadlineMs?: number
  /** Iterations already spent. */
  iteration: number
  /** Global iteration cap (beside the per-role budget). */
  iterationCap: number
  role: string
  roleBudget: RoleBudget
  /** role:event history, for stale-cycle detection. */
  history: readonly LoopEvent[]
  /** Optional checklist text; the next unchecked task is injected one at a time. */
  checklist?: string
  /** Override for the stale-cycle repeat threshold. */
  staleRepeats?: number
}

export type LoopAction =
  | { kind: 'continue' }
  | { kind: 'inject-task'; task: string }
  | {
      kind: 'stop'
      reason: 'stale-cycle' | 'role-budget' | 'iteration-cap' | 'deadline'
    }

/**
 * The one orchestration decision, pure: a context in, an action out.
 *
 * Precedence is deliberate — the run's own hard limits come first (a deadline
 * is absolute, the iteration cap is global), then the two loop diagnoses
 * (stale cycle before the role budget, because a stale cycle is a statement
 * about the plan while a budget is a statement about one role), then useful
 * work (inject the next unchecked task), and only then continue.
 */
export function determineNextAction(
  context: DetermineNextActionContext,
): LoopAction {
  if (
    context.deadlineMs !== undefined &&
    context.now - context.startedAt >= context.deadlineMs
  ) {
    return { kind: 'stop', reason: 'deadline' }
  }
  if (context.iteration >= context.iterationCap) {
    return { kind: 'stop', reason: 'iteration-cap' }
  }
  if (
    detectStaleCycle(context.history, {
      ...(context.staleRepeats === undefined
        ? {}
        : { repeats: context.staleRepeats }),
    }).stale
  ) {
    return { kind: 'stop', reason: 'stale-cycle' }
  }
  if (!roleBudgetState(context.roleBudget).allowed) {
    return { kind: 'stop', reason: 'role-budget' }
  }
  const task =
    context.checklist === undefined
      ? null
      : nextChecklistTask(context.checklist)
  if (task !== null) {
    return { kind: 'inject-task', task }
  }
  return { kind: 'continue' }
}
