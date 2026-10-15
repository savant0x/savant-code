/**
 * FID-2026-0914-003 — the provider provenance stamp (common side).
 *
 * A pipeline-accepted custom provider carries `source: 'discovery-pipeline'`
 * + `acceptedAt` (ISO-8601 UTC) on its `CustomProviderConfig`. The stamp is
 * what the discovery pipeline's health tracking keys on: unstamped
 * (hand-written) configs are never tracked.
 *
 * Validation lives HERE (single validation truth, Law 13) so the settings
 * parser, the SDK option path, and the wizard can never drift. Fail-closed:
 * a malformed or half-present stamp rejects the whole record — a half-stamped
 * config is worse than none (it would vanish from health tracking silently).
 */

import type { CustomProviderConfig } from './types'

export const PIPELINE_SOURCE = 'discovery-pipeline' as const

export type ProviderStamp = {
  source: typeof PIPELINE_SOURCE
  acceptedAt: string
}

const ISO_8601_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/**
 * Validate stamp fields on a raw parsed record. Returns human-readable
 * problems (same style as `parseCustomProviders`). Empty array = no stamp
 * present (fine — hand-written configs) or a fully valid stamp.
 */
export function discoveryStampProblems(record: {
  source?: unknown
  acceptedAt?: unknown
}): string[] {
  const { source, acceptedAt } = record
  if (source === undefined && acceptedAt === undefined) return []
  const problems: string[] = []
  if (source !== PIPELINE_SOURCE) {
    problems.push(
      `source must be 'discovery-pipeline' when present (got ${JSON.stringify(source)})`,
    )
  }
  if (
    typeof acceptedAt !== 'string' ||
    !ISO_8601_UTC_PATTERN.test(acceptedAt)
  ) {
    problems.push(
      'acceptedAt must be an ISO-8601 UTC timestamp when the discovery stamp is present',
    )
  }
  return problems
}

/** Attach the stamp to a validated config (wizard finalize path). */
export function withDiscoveryStamp(
  config: CustomProviderConfig,
  acceptedAtUtc: string,
): CustomProviderConfig {
  return { ...config, source: PIPELINE_SOURCE, acceptedAt: acceptedAtUtc }
}

/** Extract the stamp from a validated config; null when absent/malformed. */
export function readDiscoveryStamp(
  config: CustomProviderConfig,
): ProviderStamp | null {
  const record = config as unknown as Record<string, unknown>
  if (record['source'] !== PIPELINE_SOURCE) return null
  const acceptedAt = record['acceptedAt']
  if (
    typeof acceptedAt !== 'string' ||
    !ISO_8601_UTC_PATTERN.test(acceptedAt)
  ) {
    return null
  }
  return { source: PIPELINE_SOURCE, acceptedAt }
}

export function isDiscoverySourced(config: CustomProviderConfig): boolean {
  return readDiscoveryStamp(config) !== null
}
