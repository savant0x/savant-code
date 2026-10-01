import { z } from 'zod'

/**
 * Shared fragments for the TinyFish endpoint schemas (ported from the v1
 * adaptor's endpoints/common.ts).
 */

/**
 * `purpose` — a short statement of WHY the caller is searching or fetching.
 * TinyFish uses it as an extra ranking/extraction signal. Optional on both
 * endpoints; max 2000 chars, non-empty when present.
 */
export const zPurpose = z
  .string()
  .min(1)
  .max(2000)
  .describe(
    'Optional short statement of the task these results are for — the goal ' +
      'behind the request, not the request itself. TinyFish uses it as an ' +
      "extra ranking signal. Example: 'Compare pricing tiers across " +
      "vendors for a procurement report'. Max 2000 characters.",
  )
