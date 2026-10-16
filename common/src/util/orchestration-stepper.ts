import type { PresetShape } from './orchestration-preset'

type HaltReason =
  | 'step-budget-exceeded'
  | 'unconsumed-event'
  | 'illegal-role-publication'
  | 'unreachable-start-event'
export type PresetStepDecision =
  | {
      action: 'complete'
      event: string
      completedAt: number
      stepCount: number
    }
  | {
      action: 'dispatch'
      nextRoles: string[]
      event: string
      fromRole: string | null
      dispatchedAt: number
      stepCount: number
    }
  | {
      action: 'halt'
      reason: HaltReason
      message: string
      haltedAt: number
      stepCount: number
    }

/** One pure event decision. The caller owns time, dispatch and persistence. */
export function advancePresetStep(input: {
  preset: PresetShape
  currentRole: string | null
  event: string
  stepCount: number
  maxSteps?: number
  now: number
}): PresetStepDecision {
  const { preset, currentRole, event, stepCount, now } = input
  const halt = (reason: HaltReason, message: string): PresetStepDecision => ({
    action: 'halt',
    reason,
    message,
    haltedAt: now,
    stepCount,
  })
  if (
    !Number.isInteger(stepCount) ||
    stepCount < 0 ||
    stepCount >= (input.maxSteps ?? 100)
  )
    return halt(
      'step-budget-exceeded',
      'The preset step budget is exhausted or invalid.',
    )
  const publisher = preset.roles.find((role) => role.role === currentRole)
  if (currentRole === null) {
    if (event !== preset.startEvent)
      return halt(
        'unreachable-start-event',
        `Expected start event "${preset.startEvent}".`,
      )
  } else if (!publisher || !publisher.publishes?.includes(event)) {
    return halt(
      'illegal-role-publication',
      `Role "${currentRole}" cannot publish "${event}".`,
    )
  }
  if (currentRole !== null && preset.completionEvents?.includes(event))
    return {
      action: 'complete',
      event,
      completedAt: now,
      stepCount: stepCount + 1,
    }
  const nextRoles = preset.roles
    .filter(
      (role) =>
        role.triggers?.includes(event) &&
        (!publisher?.transitions?.length ||
          publisher.transitions.includes(role.role)),
    )
    .map((role) => role.role)
  if (!nextRoles.length)
    return halt(
      currentRole === null ? 'unreachable-start-event' : 'unconsumed-event',
      `No permitted role consumes "${event}".`,
    )
  return {
    action: 'dispatch',
    nextRoles,
    event,
    fromRole: currentRole,
    dispatchedAt: now,
    stepCount: stepCount + 1,
  }
}
