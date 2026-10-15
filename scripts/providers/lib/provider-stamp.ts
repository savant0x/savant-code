/**
 * FID-2026-0914-003 — the provider provenance stamp (scripts-side view).
 *
 * The SINGLE validation truth lives in `common` (`discovery-stamp.ts`) so
 * the settings parser, the SDK option path, and the wizard can never drift
 * (Law 13). This module is the scripts-tree seam over that truth under the
 * historical names. It has no production callers (verified 2026-09-28,
 * FID-2026-0928-007 class D: the sole importer is the seam-pin test); the
 * earlier hand-rolled stamp construction here imported a type that no
 * longer existed and re-stated the canonical fields — both defects the
 * canonical typing below now makes impossible.
 */
import { PIPELINE_SOURCE } from '../../../common/src/providers/discovery-stamp'

import type { ProviderStamp } from '../../../common/src/providers/discovery-stamp'
import type { CustomProviderConfig } from '../../../common/src/providers/types'

export {
  discoveryStampProblems as stampProblems,
  isDiscoverySourced as isPipelineSourced,
  readDiscoveryStamp as readStamp,
} from '../../../common/src/providers/discovery-stamp'
export type { ProviderStamp } from '../../../common/src/providers/discovery-stamp'

/**
 * Wizard-shape write: attaches the stamp fields AND declares them in the
 * return type (the canonical writer returns the bare config type). Field
 * names and the source literal come from the canonical constant/type, so
 * drift here is a compile error, not a silent two-truth.
 */
export function writeStamp(
  config: CustomProviderConfig,
  acceptedAtUtc: string,
): CustomProviderConfig & ProviderStamp {
  return { ...config, source: PIPELINE_SOURCE, acceptedAt: acceptedAtUtc }
}
