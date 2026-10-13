/**
 * FID-2026-1012-017 (program FID-2026-1012-022, RC1 / feature E1): the per-tool
 * argument budget for the emit path.
 *
 * The incomplete-arguments class is the largest defect family in the capture
 * (18 classes / 193 records across 18 tool names). Every existing mechanism ran
 * *after* the payload had already been cut: the runtime steered and re-sent with
 * a strike budget, so the class could only be retried, never prevented. Nothing
 * anywhere bounded what the model was asked to emit.
 *
 * This module is that bound, in one place (Law 13):
 *
 * - the budget is derived from the model's own output allowance, so it scales
 *   with the model actually in use rather than a single hard-coded number;
 * - tools whose schema can only carry short fields get a tighter share, because
 *   a large payload there is never legitimate;
 * - `describeArgumentBudget` renders the number into the recovery text the model
 *   reads, so the next attempt can be planned as a split instead of re-sent.
 *
 * The budget is a planning constraint stated to the model and a diagnostic in
 * the recovery message — it is deliberately not a silent rejection of calls that
 * arrive complete (a complete large write is legitimate; its fix is a split
 * shape, not a truncation).
 */

import type { JSONValue } from '../types/json'

/** Provider-neutral characters-per-token estimate, used only to size the bound. */
export const CHARS_PER_OUTPUT_TOKEN = 4

/** Used when the caller cannot resolve the request's output allowance. */
export const DEFAULT_OUTPUT_ALLOWANCE_TOKENS = 8_192

/** Share of the output allowance a single tool call's arguments may occupy. */
export const ARGUMENT_BUDGET_SHARE = 0.5

/** Floor keeps the budget usable on small allowances; ceiling keeps it honest. */
export const MIN_ARGUMENT_CHARS = 2_048
export const MAX_ARGUMENT_CHARS = 60_000

/**
 * Tools whose arguments are structurally short. A payload that fills the whole
 * allowance here is a defect by construction (a todo list, a set of follow-ups,
 * a phase transition, a search pattern), so they do not get the bulk share.
 */
const SHORT_ARGUMENT_TOOL_SHARE: Readonly<Record<string, number>> = {
  write_todos: 0.25,
  suggest_followups: 0.25,
  transition_phase: 0.25,
  transition_parameter: 0.25,
  grep: 0.25,
  glob: 0.25,
  list_directory: 0.25,
}

export interface ToolArgumentBudget {
  toolName: string
  /** Serialized argument characters this tool's calls may occupy. */
  maxArgumentChars: number
  /** The output allowance the budget was derived from. */
  outputAllowanceTokens: number
}

function resolveOutputAllowance(maxOutputTokens: number | undefined): number {
  return maxOutputTokens !== undefined &&
    Number.isFinite(maxOutputTokens) &&
    maxOutputTokens > 0
    ? Math.floor(maxOutputTokens)
    : DEFAULT_OUTPUT_ALLOWANCE_TOKENS
}

/**
 * The budget for one tool, derived from the request's output allowance. The
 * allowance is the model's own `maxOutputTokens`; an absent, non-finite or
 * non-positive value falls back to the default rather than producing a zero
 * budget no call could satisfy.
 */
export function toolArgumentBudget(params: {
  toolName: string
  maxOutputTokens?: number
}): ToolArgumentBudget {
  const outputAllowanceTokens = resolveOutputAllowance(params.maxOutputTokens)
  const share =
    SHORT_ARGUMENT_TOOL_SHARE[params.toolName] ?? ARGUMENT_BUDGET_SHARE
  const derived = Math.floor(
    outputAllowanceTokens * CHARS_PER_OUTPUT_TOKEN * share,
  )
  return {
    toolName: params.toolName,
    maxArgumentChars: Math.min(
      MAX_ARGUMENT_CHARS,
      Math.max(MIN_ARGUMENT_CHARS, derived),
    ),
    outputAllowanceTokens,
  }
}

/**
 * Serialized size of a tool call's arguments, in characters. Values that cannot
 * be serialized at all (a cyclic or otherwise hostile object reaching the
 * boundary) fail closed to `Infinity`: an unmeasurable payload is never reported
 * as within budget (Law 14).
 */
export function measureSerializedArguments(value: JSONValue): number {
  try {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? 0 : serialized.length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export interface ToolArgumentAssessment extends ToolArgumentBudget {
  serializedChars: number
  withinBudget: boolean
}

/** Measure one call's arguments against its tool's budget. */
export function assessToolArguments(params: {
  toolName: string
  arguments: JSONValue
  maxOutputTokens?: number
}): ToolArgumentAssessment {
  const budget = toolArgumentBudget(params)
  const serializedChars = measureSerializedArguments(params.arguments)
  return {
    ...budget,
    serializedChars,
    withinBudget: serializedChars <= budget.maxArgumentChars,
  }
}

/**
 * The one sentence that states the bound to the model. Composed into the
 * recovery text of every truncation cause so the next attempt can be planned
 * against the real number instead of re-sending a payload that was already cut.
 */
export function describeArgumentBudget(budget: ToolArgumentBudget): string {
  return (
    ` One tool call's arguments may occupy at most ${budget.maxArgumentChars} ` +
    `characters (derived from this model's ${budget.outputAllowanceTokens}-token output allowance).`
  )
}
