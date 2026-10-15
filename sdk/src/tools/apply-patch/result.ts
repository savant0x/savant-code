/**
 * Result builders for the apply_patch tool (FID-2026-0805-003). Extracted
 * from apply-patch.ts verbatim.
 */

import type { ApplyPatchJson, PatchAction } from './types'

export function successResult(
  file: string,
  action: PatchAction,
): ApplyPatchJson {
  return {
    type: 'json',
    value: {
      message: 'Applied 1 patch operation.',
      applied: [{ file, action }],
    },
  }
}

export function errorResult(errorMessage: string): ApplyPatchJson {
  return {
    type: 'json',
    value: { errorMessage },
  }
}
