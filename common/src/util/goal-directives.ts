import { generateCompactId } from './string'

/**
 * FID-2026-0814-002: shared `<goal-set>` / `<goal-control>` directive
 * serialization + parsing. The CLI slash surface serializes directives into
 * the message it sends; the runtime parses them out of the prompt. Attribute
 * values are escaped/unescaped so user text (quotes, angle brackets) can never
 * break the parse or leak into instruction context.
 */

/** HTML-escape text for the `<untrusted_objective>` data boundary. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Escape an XML attribute value inside the serialized directive. */
export function escapeAttr(text: string): string {
  return escapeHtml(text)
}

/** Unescape an XML attribute value read back from a directive. */
export function unescapeAttr(text: string): string {
  return text
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&')
}

/**
 * Serialize the `<goal-set>` directive the CLI embeds in the /goal message.
 * Attribute values are escaped so quotes/angle brackets in user text cannot
 * break the parse or leak into instruction context.
 */
export function serializeGoalSetDirective(params: {
  goalId?: string
  objective: string
  completionCriterion?: string
  budgetTokens?: number
  budgetTurns?: number
  budgetTimeMs?: number
}): string {
  const attrs = [
    `goalId="${escapeAttr(params.goalId ?? generateCompactId())}"`,
    `objective="${escapeAttr(params.objective)}"`,
    ...(params.completionCriterion
      ? [`completionCriterion="${escapeAttr(params.completionCriterion)}"`]
      : []),
    ...(params.budgetTokens !== undefined
      ? [`budgetTokens="${params.budgetTokens}"`]
      : []),
    ...(params.budgetTurns !== undefined
      ? [`budgetTurns="${params.budgetTurns}"`]
      : []),
    ...(params.budgetTimeMs !== undefined
      ? [`budgetTimeMs="${params.budgetTimeMs}"`]
      : []),
  ]
  return `<goal-set ${attrs.join(' ')}/>`
}

/** Serialize the `<goal-control>` directive for pause/resume/cancel. */
export function serializeGoalControlDirective(
  action: 'pause' | 'resume' | 'cancel',
  reason?: string,
): string {
  const reasonAttr = reason ? ` reason="${escapeAttr(reason)}"` : ''
  return `<goal-control action="${action}"${reasonAttr}/>`
}

export type GoalSetDirective = {
  goalId?: string
  objective: string
  completionCriterion?: string
  budgetTokens?: number
  budgetTurns?: number
  budgetTimeMs?: number
}

/** Parse a `<goal-set>` directive out of a prompt. */
export function parseGoalSetDirective(prompt: string): GoalSetDirective | null {
  const match = prompt.match(
    /<goal-set\s+goalId="([^"]*)"\s+objective="([^"]*)"(?: completionCriterion="([^"]*)")?(?: budgetTokens="(\d*)")?(?: budgetTurns="(\d*)")?(?: budgetTimeMs="(\d*)")?\s*\/>/,
  )
  if (!match) return null
  return {
    goalId: match[1] ? unescapeAttr(match[1]) : undefined,
    objective: unescapeAttr(match[2]),
    ...(match[3] ? { completionCriterion: unescapeAttr(match[3]) } : {}),
    ...(match[4] ? { budgetTokens: Number(match[4]) } : {}),
    ...(match[5] ? { budgetTurns: Number(match[5]) } : {}),
    ...(match[6] ? { budgetTimeMs: Number(match[6]) } : {}),
  }
}

export type GoalControlDirective = {
  action: 'pause' | 'resume' | 'cancel'
  reason?: string
}

/** Parse a `<goal-control>` directive out of a prompt. */
export function parseGoalControlDirective(
  prompt: string,
): GoalControlDirective | null {
  const match = prompt.match(
    /<goal-control\s+action="(pause|resume|cancel)"(?:\s+reason="([^"]*)")?\s*\/>/,
  )
  if (!match) return null
  return {
    action: match[1] as 'pause' | 'resume' | 'cancel',
    ...(match[2] !== undefined ? { reason: unescapeAttr(match[2]) } : {}),
  }
}
