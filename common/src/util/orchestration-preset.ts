/**
 * FID-2026-1006-002 WP7 + FID-2026-1006-003 WP4: static validation of an
 * orchestration preset.
 *
 * Adopted from the pi harness orchestrator presets. A preset is a set of role
 * definitions wired by events; the failures it can have are all visible in the
 * declaration, before any model call:
 *
 *  - a role with no instructions, no triggers and no publishes is inert — it
 *    can never be activated and can never hand anything on (ERROR).
 *  - a start event no role triggers means the preset cannot begin at all
 *    (ERROR).
 *  - an event some role publishes that nothing consumes is a dead hand-off
 *    (WARNING — the preset still runs, it just drops work silently).
 *  - no completion promise leaves "are we done?" unanswerable (WARNING).
 *  - with three or more roles, no loop-back path means the preset is a
 *    pipeline that cannot re-enter an earlier role (WARNING).
 *
 * Pure: a preset in, issues out. No I/O, no clock, no module state.
 *
 * FID-2026-1006-003 WP4: this module also owns the `orchestration:` block
 * parser, so `readProtocolConfig` gives `validatePreset` its production
 * caller — the declared preset is parsed and validated during config parse,
 * an ERROR-severity issue throwing (the repo gate) and WARNING-severity
 * issues reported on `config.orchestration.warnings`. The pure stepper also
 * validates start dispatch; config parsing does not execute any role.
 */

import { advancePresetStep } from './orchestration-stepper'
export { advancePresetStep } from './orchestration-stepper'
export type { PresetStepDecision } from './orchestration-stepper'

export type RolePreset = {
  role: string
  /** Prose the role runs on. A blank string counts as absent. */
  instructions?: string
  /** Events that activate this role. */
  triggers?: readonly string[]
  /** Events this role hands on. */
  publishes?: readonly string[]
  /** Roles this role may hand off to (loop-back evidence). */
  transitions?: readonly string[]
}

export type PresetShape = {
  /** The event the orchestrator starts on. */
  startEvent: string
  roles: readonly RolePreset[]
  /** Events that mean the preset is done. */
  completionEvents?: readonly string[]
}

export type PresetValidationIssue = {
  severity: 'error' | 'warning'
  code:
    | 'role-without-capability'
    | 'unreachable-start-event'
    | 'unconsumed-event'
    | 'no-completion-promise'
    | 'no-loop-back-path'
  message: string
  role?: string
  event?: string
}

export const LOOP_BACK_ROLE_THRESHOLD = 3

function isPresent(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

function hasAny(value: readonly string[] | undefined): boolean {
  return Array.isArray(value) && value.length > 0
}

function hasLoopBack(roles: readonly RolePreset[]): boolean {
  const known = new Set(roles.map((role) => role.role))
  const edges = new Map<string, string[]>()
  for (const role of roles) {
    edges.set(
      role.role,
      (role.transitions ?? []).filter((target) => known.has(target)),
    )
  }

  const visiting = new Set<string>()
  const done = new Set<string>()
  const revisit = (role: string): boolean => {
    if (visiting.has(role)) return true
    if (done.has(role)) return false
    visiting.add(role)
    for (const target of edges.get(role) ?? []) {
      if (revisit(target)) return true
    }
    visiting.delete(role)
    done.add(role)
    return false
  }

  return roles.some((role) => revisit(role.role))
}

/**
 * Every static issue in a preset, errors first. Codes are stable identifiers an
 * operator can grep; messages name the role or event they are about.
 */
export function validatePreset(preset: PresetShape): PresetValidationIssue[] {
  const errors: PresetValidationIssue[] = []
  const warnings: PresetValidationIssue[] = []

  for (const role of preset.roles) {
    if (
      !isPresent(role.instructions) &&
      !hasAny(role.triggers) &&
      !hasAny(role.publishes)
    ) {
      errors.push({
        severity: 'error',
        code: 'role-without-capability',
        role: role.role,
        message: `role "${role.role}" declares no instructions, triggers or publishes — it can never be activated`,
      })
    }
  }

  if (
    advancePresetStep({
      preset,
      currentRole: null,
      event: preset.startEvent,
      stepCount: 0,
      now: 0,
    }).action === 'halt'
  ) {
    errors.push({
      severity: 'error',
      code: 'unreachable-start-event',
      event: preset.startEvent,
      message: `start event "${preset.startEvent}" is not triggered by any role — the preset cannot begin`,
    })
  }

  const consumed = new Set<string>()
  for (const role of preset.roles) {
    for (const trigger of role.triggers ?? []) consumed.add(trigger)
  }
  const completion = new Set(preset.completionEvents ?? [])
  const reported = new Set<string>()
  for (const role of preset.roles) {
    for (const published of role.publishes ?? []) {
      if (consumed.has(published) || completion.has(published)) continue
      if (reported.has(published)) continue
      reported.add(published)
      warnings.push({
        severity: 'warning',
        code: 'unconsumed-event',
        event: published,
        role: role.role,
        message: `event "${published}" published by role "${role.role}" is consumed by no role and is not a completion event`,
      })
    }
  }

  if (completion.size === 0) {
    warnings.push({
      severity: 'warning',
      code: 'no-completion-promise',
      message:
        'the preset declares no completion event — "done" cannot be decided from the declaration',
    })
  }

  if (
    preset.roles.length >= LOOP_BACK_ROLE_THRESHOLD &&
    !hasLoopBack(preset.roles)
  ) {
    warnings.push({
      severity: 'warning',
      code: 'no-loop-back-path',
      message: `${preset.roles.length} roles with no loop-back path — no role can hand work back to an earlier role`,
    })
  }

  return [...errors, ...warnings]
}

/**
 * The explicit→legacy→inferred→default event ladder. The first present rung
 * wins; `fallback` is returned when every rung above it is absent (it is not
 * itself a rung, so it may be an empty string).
 */
export function resolveStartEvent(ladder: {
  explicit?: string
  legacy?: string
  inferred?: string
  fallback: string
}): string {
  if (isPresent(ladder.explicit)) return ladder.explicit as string
  if (isPresent(ladder.legacy)) return ladder.legacy as string
  if (isPresent(ladder.inferred)) return ladder.inferred as string
  return ladder.fallback
}

/**
 * FID-2026-1006-003 WP4: parse the `orchestration:` block into a `PresetShape`.
 *
 * Line-oriented like the other `protocol.config.yaml` parsers (the loader is
 * hand-rolled, not a YAML engine): `roles:` is a list of `- role: ...` entries
 * whose following `key: value` lines fill the entry in, while `startEvent` and
 * `completionEvents` sit beside the list. A block with no role entries yields
 * `null` — an undeclared preset is not validated and changes nothing.
 */
export function parseOrchestrationPresetConfig(
  lines: string[],
): PresetShape | null {
  if (lines.length === 0) return null

  // Prettier wraps a long list onto several lines (`key:\n  [\n 'a',\n ]`),
  // so continued lines are joined back into one logical line before parsing:
  // bracket balance decides where a logical line ends, and a bare `key:` line
  // is carried onto the bracket-wrapped value that follows it. The loader is
  // hand-rolled, not a YAML engine: without this, a formatted declaration
  // would silently parse as an empty list.
  const logical: string[] = []
  let pendingKey = ''
  let joined = ''
  for (const line of lines) {
    const text = line.trim()
    if (text === '') continue
    joined = joined === '' ? text : `${joined} ${text}`
    const opens = (joined.match(/\[/g) ?? []).length
    const closes = (joined.match(/\]/g) ?? []).length
    if (opens > closes) continue
    if (pendingKey !== '') {
      if (joined.startsWith('[')) joined = `${pendingKey} ${joined}`
      else logical.push(pendingKey)
      pendingKey = ''
    }
    if (/^\w+:$/.test(joined)) pendingKey = joined
    else logical.push(joined)
    joined = ''
  }
  if (pendingKey !== '') logical.push(pendingKey)
  if (joined !== '') logical.push(joined)

  const strip = (raw: string): string =>
    raw
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim()

  const parseList = (raw: string): string[] =>
    strip(raw)
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((item) => strip(item))
      .filter((item) => item !== '')

  const roles: RolePreset[] = []
  let startEvent = ''
  let completionEvents: string[] = []
  let current: {
    role: string
    instructions?: string
    triggers?: string[]
    publishes?: string[]
    transitions?: string[]
  } | null = null

  for (const line of logical) {
    const roleMatch = line.match(/^\s*-\s*role:\s*(.+)$/)
    if (roleMatch) {
      current = { role: strip(roleMatch[1]) }
      roles.push(current)
      continue
    }
    const fieldMatch = line.match(/^\s*(\w+):\s*(.*)$/)
    if (!fieldMatch) continue
    const key = fieldMatch[1]
    const raw = fieldMatch[2]
    if (key === 'startEvent') {
      startEvent = strip(raw)
    } else if (key === 'completionEvents') {
      completionEvents = parseList(raw)
    } else if (current !== null && key === 'instructions') {
      current.instructions = strip(raw)
    } else if (current !== null && key === 'triggers') {
      current.triggers = parseList(raw)
    } else if (current !== null && key === 'publishes') {
      current.publishes = parseList(raw)
    } else if (current !== null && key === 'transitions') {
      current.transitions = parseList(raw)
    }
  }

  const declared = roles.filter((role) => role.role !== '')
  if (declared.length === 0) return null
  return { startEvent, completionEvents, roles: declared }
}
