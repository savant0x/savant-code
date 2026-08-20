import { escapeAttr, unescapeAttr } from './goal-directives'
import { generateCompactId } from './string'

/**
 * FID-2026-0818-002: Auto Drive directives.
 *
 * Two directives share one attribute-escaping data boundary (reused from
 * `goal-directives`):
 *
 * - `<drive-lock>` — serialized by the CLI ONLY after the operator Confirms the
 *   pre-build plan (Law 2 gate). The runtime parses it into a durable
 *   `DriveRecord` and strips the interactive tools (`ask_user`,
 *   `suggest_followups`, `end_turn`) from the model-facing set for the rest of
 *   the run, so the drive proceeds to completion without asking again.
 * - `<drive-plan>` — emitted by the model at the end of the planning stage so
 *   the CLI can present the plan for confirmation. The CLI parses this one;
 *   the runtime never does.
 *
 * Attribute values are escaped, so plan text (quotes, angle brackets) can
 * never break the parse or leak into instruction context.
 */

/**
 * Interactive tools removed from the model-facing set once drive mode locks.
 * These are the three surfaces through which the model could otherwise ask
 * the operator or end the turn mid-run.
 */
export const DRIVE_STRIPPED_TOOL_NAMES: readonly string[] = [
  'ask_user',
  'suggest_followups',
  'end_turn',
]

/** Serialize the acceptance-criteria list into a single JSON array attribute. */
function serializeCriteria(criteria?: readonly string[]): string {
  if (!criteria || criteria.length === 0) return '[]'
  return JSON.stringify(criteria)
}

function parseCriteria(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(unescapeAttr(raw))
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

export function serializeDriveLockDirective(params: {
  driveId?: string
  goal: string
  planId?: string
  acceptanceCriteria?: readonly string[]
  resolutionPolicy?: string
}): string {
  const attrs = [
    `driveId="${escapeAttr(params.driveId ?? generateCompactId())}"`,
    `goal="${escapeAttr(params.goal)}"`,
    ...(params.planId ? [`planId="${escapeAttr(params.planId)}"`] : []),
    ...(params.resolutionPolicy
      ? [`resolutionPolicy="${escapeAttr(params.resolutionPolicy)}"`]
      : []),
    `acceptanceCriteria="${escapeAttr(serializeCriteria(params.acceptanceCriteria))}"`,
  ]
  return `<drive-lock ${attrs.join(' ')}/>`
}

export type DriveLockDirective = {
  driveId?: string
  goal: string
  planId?: string
  acceptanceCriteria: string[]
  resolutionPolicy?: string
}

/** Parse a `<drive-lock>` directive out of a prompt. */
export function parseDriveLockDirective(
  prompt: string,
): DriveLockDirective | null {
  const match = prompt.match(
    /<drive-lock\s+driveId="([^"]*)"\s+goal="([^"]*)"(?: planId="([^"]*)")?(?: resolutionPolicy="([^"]*)")?(?: acceptanceCriteria="([^"]*)")?\s*\/>/,
  )
  if (!match) return null
  return {
    driveId: match[1] ? unescapeAttr(match[1]) : undefined,
    goal: unescapeAttr(match[2]),
    ...(match[3] ? { planId: unescapeAttr(match[3]) } : {}),
    ...(match[4] ? { resolutionPolicy: unescapeAttr(match[4]) } : {}),
    acceptanceCriteria: parseCriteria(match[5]),
  }
}

export function serializeDrivePlanDirective(params: {
  goal: string
  plan: string
  acceptanceCriteria?: readonly string[]
  resolutionPolicy?: string
}): string {
  const attrs = [
    `goal="${escapeAttr(params.goal)}"`,
    `plan="${escapeAttr(params.plan)}"`,
    ...(params.resolutionPolicy
      ? [`resolutionPolicy="${escapeAttr(params.resolutionPolicy)}"`]
      : []),
    `acceptanceCriteria="${escapeAttr(serializeCriteria(params.acceptanceCriteria))}"`,
  ]
  return `<drive-plan ${attrs.join(' ')}/>`
}

export type DrivePlanDirective = {
  goal: string
  plan: string
  acceptanceCriteria: string[]
  resolutionPolicy?: string
}

/**
 * FID-2026-0818-007: drive control surface. `pause` retains state (turns
 * suspended), `resume` restarts them, `stop` is terminal (recorded in the Run
 * Log). Mirrors `<goal-control>` — the directive is DATA, the CLI escapes the
 * reason attribute.
 */
export function serializeDriveControlDirective(
  action: 'pause' | 'resume' | 'stop',
  reason?: string,
): string {
  const reasonAttr = reason ? ` reason="${escapeAttr(reason)}"` : ''
  return `<drive-control action="${action}"${reasonAttr}/>`
}

export type DriveControlDirective = {
  action: 'pause' | 'resume' | 'stop'
  reason?: string
}

export function parseDriveControlDirective(
  prompt: string,
): DriveControlDirective | null {
  const match = prompt.match(
    /<drive-control action="(pause|resume|stop)"(?: reason="([^"]*)")?\s*\/>/,
  )
  if (!match) return null
  return {
    action: match[1] as DriveControlDirective['action'],
    ...(match[2] ? { reason: unescapeAttr(match[2]) } : {}),
  }
}

/** Parse a `<drive-plan>` directive emitted by the model during planning. */
export function parseDrivePlanDirective(
  text: string,
): DrivePlanDirective | null {
  const match = text.match(
    /<drive-plan\s+goal="([^"]*)"\s+plan="([^"]*)"(?: resolutionPolicy="([^"]*)")?(?: acceptanceCriteria="([^"]*)")?\s*\/>/,
  )
  if (!match) return null
  return {
    goal: unescapeAttr(match[1]),
    plan: unescapeAttr(match[2]),
    ...(match[3] ? { resolutionPolicy: unescapeAttr(match[3]) } : {}),
    acceptanceCriteria: parseCriteria(match[4]),
  }
}
