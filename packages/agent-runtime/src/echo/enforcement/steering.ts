/**
 * Budgeted corrective-steering drain for blocked pre-write advisories
 * (FID-2026-0819-005 Loop 303: extracted verbatim from `echo/enforcement.ts`;
 * `this.` → `self.`, static caps hoisted to module constants).
 */
import { buildSteeringText } from '../violation-handler'

import type { EnforcementSelf } from './self'

// With the current per-law caps (7:1, 8:1) the practical maximum is two
// steers per instance; MAX_STEERING_TOTAL is a defensive ceiling should a
// future advisory law carry a larger per-law budget.
export const MAX_STEERING_TOTAL = 3
export const MAX_STEERING_PER_LAW: Record<number, number> = {
  7: 1,
  8: 1,
}

/**
 * Drain budgeted corrective steering messages for blocked pre-write
 * advisories (Law 7/8). Bounded per enforcement instance: at most
 * MAX_STEERING_TOTAL messages total, one per law (deduped per law+file).
 */
export function drainSteeringMessages(self: EnforcementSelf): string[] {
  const messages: string[] = []
  for (const warning of self.pendingSteering) {
    if (self.steeringCount >= MAX_STEERING_TOTAL) break
    const key = `${warning.law}:${warning.file ?? ''}`
    if (self.steeredKeys.has(key)) continue
    const perLaw = self.steeringPerLaw.get(warning.law) ?? 0
    const cap = MAX_STEERING_PER_LAW[warning.law] ?? 1
    if (perLaw >= cap) continue
    self.steeredKeys.add(key)
    self.steeringPerLaw.set(warning.law, perLaw + 1)
    self.steeringCount += 1
    messages.push(buildSteeringText(warning))
  }
  self.pendingSteering = []
  return messages
}
