/** In-process availability observations from real serving calls. */
import { isVisibleInAdvertisedLists } from './availability-verdict'

import type { AvailabilityVerdict } from './availability-verdict'

const observed = new Map<string, AvailabilityVerdict>()
const keyFor = (providerId: string, modelId: string): string =>
  `${providerId}\u0000${modelId}`

/** Faults carry no model fact, so they never overwrite a prior verdict. */
export function recordModelAvailability(
  providerId: string,
  modelId: string,
  verdict: AvailabilityVerdict,
): void {
  if (verdict.class === 'gateway-fault') return
  observed.set(keyFor(providerId, modelId), verdict)
}

export function modelAvailability(
  providerId: string,
  modelId: string,
): AvailabilityVerdict | undefined {
  return observed.get(keyFor(providerId, modelId))
}

export function advertisedModelVisible(
  providerId: string,
  modelId: string,
): boolean {
  const verdict = modelAvailability(providerId, modelId)
  return verdict === undefined || isVisibleInAdvertisedLists(verdict)
}

/**
 * Test isolation: drops every in-process availability observation — the
 * process-lifetime map `bun test` shares across files (FID-2026-1007-002).
 */
export function resetObservedAvailability(): void {
  observed.clear()
}
