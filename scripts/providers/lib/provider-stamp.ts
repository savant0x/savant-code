/**
 * FID-2026-0914-003 — the provider provenance stamp (scripts-side view).
 *
 * The SINGLE validation truth lives in `common` (`discovery-stamp.ts`) so
 * the settings parser, the SDK option path, and the wizard can never drift
 * (Law 13). This module re-exports it for the scripts tree — the seams pin
 * suite imports from here, proving the same truth the CLI consumes.
 */
export {
  PIPELINE_SOURCE,
  discoveryStampProblems as stampProblems,
  readDiscoveryStamp as readStamp,
  type DiscoveryStamp,
} from '../../../common/src/providers/discovery-stamp'

import { readDiscoveryStamp } from '../../../common/src/providers/discovery-stamp'

import type { DiscoveryStamp } from '../../../common/src/providers/discovery-stamp'
import type { CustomProviderConfig } from '../../../common/src/providers/types'

/** Add the provenance stamp to a config (the wizard finalize path does this). */
export function writeStamp(
  config: CustomProviderConfig,
  acceptedAtUtc: string,
): CustomProviderConfig & DiscoveryStamp {
  return { ...config, source: 'discovery-pipeline', acceptedAt: acceptedAtUtc }
}

/** True when the config carries a VALID discovery stamp (health tracking keys on this). */
export function isPipelineSourced(config: CustomProviderConfig): boolean {
  return readDiscoveryStamp(config) !== null
}
